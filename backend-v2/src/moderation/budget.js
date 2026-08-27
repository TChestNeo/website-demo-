'use strict';
// 月度预算硬上限（成本红线）：额度存 platform_settings budget.*（D8，强类型表；管理员 UI 可调）。
// 每次 AI 调用前 canSpend() 预检；调用后 record() 落 usage_log（调用时刻单价快照 + cost_micro，绝不记录内容）。
// 状态机：ratio ≥0.8 → warn（看板标黄，P11 邮件告警）；≥1.0 → exhausted → 该功能降级
//   （文字审核退 L0+人工 / 客服退 FAQ+规则文案 / 图像全人工）——登录/发帖/浏览/工单/私讯永不硬下线。
// 账期 = UTC 自然月（usage_log.created_at LIKE 'YYYY-MM%'）。
// 峰谷价（元/百万 tokens，DeepSeek V4 Pro 2026-08-17 起）：高峰 in 9 / cached 0.30 / out 27；低谷半价。
// 低谷窗口 = 16:30–00:30 UTC（跨午夜，可 config.deepseek.offPeakWindow 覆盖）。

const FEATURES = ['moderation_text', 'moderation_image', 'chat', 'copilot'];
const PRICES = {
  peak: { in: 9, cached: 0.30, out: 27 },
  offPeak: { in: 4.5, cached: 0.15, out: 13.5 }
};

// usage_log.provider 归属（§14/§20 可观测性）
const PROVIDER_OF = {
  moderation_text: 'deepseek',
  chat: 'deepseek',
  chat_faq_hit: 'deepseek',
  copilot: 'deepseek',
  moderation_image: 'tencent-ims'
};

// 分钟数比较（不依赖 Date 构造，纯字符串解析，测试用显式 ISO）
function minutesOfUtc(iso) {
  const h = Number(iso.slice(11, 13));
  const m = Number(iso.slice(14, 16));
  return h * 60 + m;
}

function isOffPeak(iso, windowCfg) {
  const w = windowCfg || { start: '16:30', end: '00:30' };
  const [sh, sm] = w.start.split(':').map(Number);
  const [eh, em] = w.end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const t = minutesOfUtc(iso);
  if (Number.isNaN(t)) throw new Error(`isOffPeak: 非法时间 ${iso}`);
  return start <= end ? t >= start && t < end : t >= start || t < end; // 跨午夜
}

function priceOf(iso, windowCfg) {
  const offPeak = isOffPeak(iso, windowCfg);
  const rates = offPeak ? PRICES.offPeak : PRICES.peak;
  return { snapshot: { rates, offPeak }, rates };
}

// cost_micro = Σ tokens × 单价（元/百万）× 1e6 微元/元 = tokens × 单价（微元/token）
function costMicro(tokens, rates) {
  return Math.round(
    (tokens.in || 0) * rates.in + (tokens.cached || 0) * rates.cached + (tokens.out || 0) * rates.out
  );
}

function createBudget(db, cfg) {
  const defaults = (cfg.budgets || {});

  function limitOf(feature) {
    const row = db.prepare("SELECT value FROM platform_settings WHERE key = ?").get('budget.' + feature);
    return row ? Number(row.value) : (defaults[feature] || 0);
  }

  function setLimit(feature, yuan) {
    db.prepare('INSERT INTO platform_settings (key, value, type, updated_at) VALUES (?, ?, ?, ?) '
      + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
      .run('budget.' + feature, String(yuan), 'number', new Date().toISOString());
  }

  function spentMicro(feature, nowIso) {
    const prefix = nowIso.slice(0, 7);
    const row = feature === 'total'
      ? db.prepare("SELECT COALESCE(SUM(cost_micro), 0) AS n FROM usage_log WHERE created_at LIKE ?").get(prefix + '%')
      : db.prepare("SELECT COALESCE(SUM(cost_micro), 0) AS n FROM usage_log WHERE feature = ? AND created_at LIKE ?").get(feature, prefix + '%');
    return row.n;
  }

  // 状态：{ limit, spent, ratio, totalRatio, state }（state: ok|warn|exhausted；ratio 取分项与总额较大者）
  function status(feature, nowIso = new Date().toISOString()) {
    const limit = limitOf(feature);
    const spent = spentMicro(feature, nowIso);
    const totalLimit = limitOf('total');
    const totalSpent = spentMicro('total', nowIso);
    const ratio = limit > 0 ? spent / (limit * 1e6) : Infinity;
    const totalRatio = totalLimit > 0 ? totalSpent / (totalLimit * 1e6) : 0;
    const r = Math.max(ratio, totalRatio);
    return {
      limit, spent, ratio, totalLimit, totalSpent, totalRatio,
      state: r >= 1 ? 'exhausted' : r >= 0.8 ? 'warn' : 'ok'
    };
  }

  function canSpend(feature, nowIso) {
    return status(feature, nowIso).state !== 'exhausted';
  }

  // 调用后记账（先预检后调用；失败重试只记成功的一次）。
  // costMicroOverride：非 token 计价的调用（如 IMS 按张计费）显式传成本
  function record(feature, tokens, opts = {}) {
    const nowIso = opts.nowIso || new Date().toISOString();
    const { snapshot, rates } = priceOf(nowIso, (cfg.deepseek || {}).offPeakWindow);
    db.prepare('INSERT INTO usage_log (feature, tokens_in, tokens_out, tokens_cached, price_snapshot, cost_micro, batch_id, latency_ms, status, provider, created_at) '
      + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(feature, tokens.in || 0, tokens.out || 0, tokens.cached || 0,
        JSON.stringify(snapshot),
        opts.costMicroOverride != null ? opts.costMicroOverride : costMicro(tokens, rates),
        opts.batchId || null, opts.latencyMs || null,
        opts.status || 'ok', PROVIDER_OF[feature] || null, nowIso);
  }

  return { FEATURES, limitOf, setLimit, spentMicro, status, canSpend, record };
}

module.exports = { createBudget, isOffPeak, priceOf, costMicro, PRICES, FEATURES, PROVIDER_OF };
