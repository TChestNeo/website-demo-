'use strict';
// 举报（community-rules 第 5 节承诺）：POST /api/reports → report + 高优先级审核项。
// 即时通道（高峰时段仅两处即时 AI 之一）：目标有正文 → 单条批处理立即判定（量小接受高峰价）；
// 无正文（user 举报等）/预算耗尽 → needs_human 人工。响应先行返回回执，判定异步落库。

const { HttpError, sendJson, readJson } = require('../http');
const { requireSession } = require('../middleware/auth');
const { insertWithId, pad6 } = require('../ids');
const { createModerationItem, textOf } = require('../moderation/pipeline');
const { hashOf } = require('../moderation/rules');
const queue = require('../moderation/queue');

const TARGET_TYPES = ['post', 'article', 'nation', 'topic', 'user'];
const REASONS = ['spam', 'abuse', 'hate', 'sexual', 'scam', 'impersonation', 'other'];

function register(router, ctx) {
  const db = ctx.db;

  router.add('POST', '/api/reports', requireSession(async (req, res, c) => {
    const w = (ctx.config.rateLimits || {}).reportWrite || { max: 5, windowMs: 3600000 };
    if (!ctx.limiter('rp:user:' + c.user.id, w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '举报过于频繁');
    const body = await readJson(req, 16 * 1024);
    const targetType = String(body.targetType || '');
    const targetId = String(body.targetId || '').trim();
    const reason = String(body.reason || '');
    const description = String(body.description || '').slice(0, 2000);
    if (!TARGET_TYPES.includes(targetType)) throw new HttpError('VALIDATION', '举报对象类型无效');
    if (!targetId || targetId.length > 64) throw new HttpError('VALIDATION', '举报对象无效');
    if (!REASONS.includes(reason)) throw new HttpError('VALIDATION', '举报理由无效');

    const iso = new Date().toISOString();
    const { id } = insertWithId(db, 'reports',
      ['reporter_id', 'target_type', 'target_id', 'reason', 'description', 'status', 'created_at'],
      [c.user.id, targetType, targetId, reason, description, 'open', iso], (s) => 'RPT-' + pad6(s));

    // 高优先级审核项：有正文 → 即时 AI；无正文 → 直接人工
    const text = textOf(db, targetType, targetId);
    const itemId = createModerationItem(db, {
      kind: 'text', targetType, targetId,
      contentHash: hashOf(text || targetId),
      status: text ? 'queued' : 'needs_human',
      priority: 'high',
      ruleHits: null
    });
    if (text) {
      // 即时通道：await 保证测试确定性（单条 ~1s）；失败不影响回执（项已 queued，重试/降级兜底）
      try { await queue.processImmediate(ctx, itemId); } catch (err) {
        console.error('[reports] 即时审核失败:', err.message);
      }
    }
    sendJson(res, 200, { report: { id, targetType, targetId, reason, status: 'open', createdAt: iso } });
  }));
}

module.exports = { register, TARGET_TYPES, REASONS };
