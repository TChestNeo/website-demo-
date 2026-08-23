'use strict';
// 预算 80% 告警（P11）：每日北京时间 10:30-10:59 由 cron 触发一次（防重入见 cron.js maybeRunDailyAlert）。
// 档位去重：kv budget.alert.<feature> 存上次已告警档位（ok|warn|exhausted），仅档位变化时发信——不会每天重复打扰。
// 复用 budget.status()：state 已把 total 超额折算进每个分项（ratio 与 totalRatio 取大者判定）。
// 邮件走 mailer.sendAlert → config.adminEmail；未配 SMTP/邮箱时打 dev 日志（告警链路不崩）。

const FEATURES = ['moderation_text', 'moderation_image', 'chat', 'total'];
const LABELS = { moderation_text: '文字审核', moderation_image: '图像审核', chat: 'AI 客服', total: '月度总额' };

function kvGet(db, key) {
  const r = db.prepare('SELECT value FROM kv WHERE key = ?').get(key);
  return r ? r.value : null;
}

function kvSet(db, key, value, nowIso) {
  db.prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) '
    + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .run(key, value, nowIso);
}

// 返回 { sent: [{feature, tier}], skipped } 便于测试断言；失败抛给调用方（cron fire 包裹 try/catch）。
function runDailyBudgetAlert(ctx, nowIso = new Date().toISOString()) {
  const { db, config, mailer, budget } = ctx;
  const sent = [];
  for (const f of FEATURES) {
    const s = budget.status(f, nowIso);
    if (s.limit <= 0) continue; // 未设额度（=功能关闭）不告警，也不落档位
    const tier = s.state; // ok | warn | exhausted
    const prev = kvGet(db, 'budget.alert.' + f) || 'ok';
    if (tier === prev) continue;
    const pct = Math.round(Math.max(s.ratio, s.totalRatio) * 100);
    const yuan = (s.spent / 1e6).toFixed(2);
    const limitYuan = s.limit.toFixed(2);
    if (tier !== 'ok' && config.adminEmail) {
      const subject = tier === 'exhausted'
        ? `[M.NationWorld] 预算耗尽：${LABELS[f]} 已降级`
        : `[M.NationWorld] 预算预警 80%：${LABELS[f]}`;
      const text = tier === 'exhausted'
        ? `${LABELS[f]} 本月已用 ${yuan} 元，达到额度 ${limitYuan} 元的 ${pct}%。该功能已自动降级`
          + '（文字审核→规则+人工、AI 客服→FAQ+工单引导、图像审核→人工）。登录/发帖/私讯/工单不受影响。'
          + '如需恢复，请到管理后台成本看板调整额度。'
        : `${LABELS[f]} 本月已用 ${yuan} 元，达到额度 ${limitYuan} 元的 ${pct}%。`
          + '请到管理后台成本看板检查用量；预计会在数日内耗尽，建议及时调额或排查异常消耗。';
      Promise.resolve(mailer.sendAlert(subject, text)).catch((err) =>
        console.error('[budget-alert] 发送失败:', err.message));
      sent.push({ feature: f, tier });
    } else if (tier !== 'ok') {
      console.log(`[budget-alert] ADMIN_EMAIL 未配置，跳过发信（${f}=${tier}）`);
    }
    kvSet(db, 'budget.alert.' + f, tier, nowIso);
  }
  return { sent };
}

module.exports = { runDailyBudgetAlert, FEATURES, LABELS };
