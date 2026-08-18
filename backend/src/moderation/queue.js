'use strict';
// 夜间批处理：cron 三班（北京 20:00/00:00/04:00 → UTC 12:00/16:00/20:00）调用 processTextBatch。
// 每班 ≤500 条、50 条/请求、每条截断 2000 字——缓存前缀只计一次，摊薄 50 条。
// 结果应用：pass → ai_approved；reject → ai_rejected + remove_content（AI 不下 warn，误伤虚构世界观内容时人工可恢复）；
//   escalate / severity≥2 / confidence<0.7 → needs_human（AI 只粗筛，人工兜底）。
// 降级（绝不硬下线）：预算耗尽 → 全部 needs_human；批次重试 3 次仍败 → needs_human；
//   图像 IMS 未配置/5xx/超时 → needs_human（图像不先发后审，默认不上线）。

const { applyDecision, textOf } = require('./pipeline');
const textClient = require('./text');
const imageClient = require('./image');

const BATCH_MAX = 500;    // 每班上限
const CHUNK_SIZE = 50;    // 一条请求审一批
const TEXT_TRUNC = 2000;  // 每条截断（DeepSeek 输入上限保护 + 成本钳制）
const IMG_COST_MICRO = 2500; // IMS ~0.0025 元/张（无峰谷，上线前用真实账单校准）

// AI 结果 → 本地判定：reject 即下架；pass 需 severity<2 且 confidence≥0.7，否则人工
function toVerdict(r) {
  if (r.verdict === 'reject') return 'reject';
  if (r.verdict === 'pass' && r.severity < 2 && r.confidence >= 0.7) return 'approve';
  return 'needs_human';
}

function markNeedsHuman(db, item, reasonCode) {
  db.prepare('UPDATE moderation_items SET status = ?, ai_result = ? WHERE id = ?')
    .run('needs_human', JSON.stringify({ reasonCode }), item.id);
}

// 单条判定落库 + 副作用（媒体帖 approve → 上线；reject → 下架）
function resolveItem(db, cfg, item, verdictInfo, actor) {
  const { verdict, reasonCode, labels, severity } = verdictInfo;
  const iso = new Date().toISOString();
  const aiResult = JSON.stringify({ verdict, reasonCode, labels, severity, actor });
  if (verdict === 'approve') {
    db.prepare('UPDATE moderation_items SET status = ?, ai_result = ?, resolved_at = ? WHERE id = ?')
      .run(actor === 'admin' ? 'human_approved' : 'ai_approved', aiResult, iso, item.id);
    if (item.kind === 'image') {
      db.prepare("UPDATE posts SET status = 'visible', updated_at = ? WHERE id = ?").run(iso, item.target_id);
    }
    return;
  }
  if (verdict === 'reject') {
    db.prepare('UPDATE moderation_items SET status = ?, ai_result = ?, resolved_at = ? WHERE id = ?')
      .run(actor === 'admin' ? 'human_rejected' : 'ai_rejected', aiResult, iso, item.id);
    applyDecision(db, cfg, { itemId: item.id, action: 'remove_content', actor, reasonCode });
    return;
  }
  markNeedsHuman(db, item, reasonCode || 'ai_escalate');
}

// 通用文字处理：预算预检 → 50 条/请求 → 记账 + 逐条落库。rows 已按优先级排序。
async function processItems(ctx, rows, batchId) {
  const db = ctx.db;
  const cfg = ctx.config;
  const budget = ctx.moderation.budget;
  if (!rows.length) return { processed: 0 };
  if (!budget.canSpend('moderation_text', new Date().toISOString())) {
    for (const it of rows) markNeedsHuman(db, it, 'budget_exhausted'); // 降级：退 L0+人工
    return { processed: rows.length, degraded: true };
  }
  let processed = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
      .map(it => ({ id: it.id, text: (textOf(db, it) || '').slice(0, TEXT_TRUNC) }));
    try {
      const { results, usage, latencyMs } = await textClient.classifyBatch(cfg, ctx.moderation.fetchImpl, chunk, batchId);
      budget.record('moderation_text', usage, { batchId, latencyMs });
      for (const r of results) {
        const item = rows.find(x => x.id === r.id);
        if (!item) continue;
        resolveItem(db, cfg, item, { verdict: toVerdict(r), reasonCode: r.reasonCode, labels: r.labels, severity: r.severity }, 'ai');
        processed++;
      }
    } catch (err) {
      console.error('[moderation] 批次失败 → needs_human:', err.message);
      for (const c of chunk) {
        const item = rows.find(x => x.id === c.id);
        if (item) markNeedsHuman(db, item, 'batch_failed');
      }
      processed += chunk.length;
    }
  }
  return { processed };
}

function batchIdOf(prefix) {
  return prefix + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
}

// 三班入口：取全部 queued 文字项（优先级高的先审）
async function processTextBatch(ctx) {
  const rows = ctx.db.prepare("SELECT * FROM moderation_items WHERE kind = 'text' AND status = 'queued' "
    + 'ORDER BY priority DESC, created_at LIMIT ?').all(BATCH_MAX);
  return processItems(ctx, rows, batchIdOf('TB-'));
}

// 即时通道（举报高优先级 / 新号首发）：单条走同一管线
async function processImmediate(ctx, itemId) {
  const item = ctx.db.prepare("SELECT * FROM moderation_items WHERE id = ?").get(itemId);
  if (!item || item.status !== 'queued') return { processed: 0 };
  return processItems(ctx, [item], batchIdOf('IM-'));
}

// 图像即时审核（POST 内联 + cron 滞留兜底）
async function processImageItem(ctx, item) {
  const db = ctx.db;
  const cfg = ctx.config;
  const budget = ctx.moderation.budget;
  if (!budget.canSpend('moderation_image', new Date().toISOString())) {
    markNeedsHuman(db, item, 'budget_exhausted'); // IMS 预算耗尽 → 图像全人工
    return { verdict: 'needs_human' };
  }
  let url = null;
  try {
    const row = db.prepare('SELECT media FROM posts WHERE id = ?').get(item.target_id);
    const arr = JSON.parse(row ? row.media : '[]');
    url = arr[0];
  } catch { url = null; }
  const started = Date.now();
  const result = await imageClient.moderateImage(cfg, url, ctx.moderation.fetchImpl);
  const noCall = result.raw === null; // raw null ⇔ 未真正调用 IMS（未配置/校验失败/网络错误）→ 不记账
  budget.record('moderation_image', {}, {
    batchId: item.batch_id, latencyMs: Date.now() - started,
    costMicroOverride: noCall ? 0 : IMG_COST_MICRO
  });
  resolveItem(db, cfg, item, {
    verdict: result.verdict, reasonCode: result.reasonCode, labels: result.labels,
    severity: result.verdict === 'reject' ? 2 : 0
  }, 'ai');
  return { verdict: result.verdict };
}

module.exports = { processTextBatch, processImmediate, processImageItem, processItems, resolveItem, toVerdict, BATCH_MAX, CHUNK_SIZE };
