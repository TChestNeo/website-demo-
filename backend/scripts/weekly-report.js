'use strict';
// 周报（P11）：成本 vs 预算 + 审核时效 + 调参建议。输出文本到 stdout。
// 用法：node --env-file-if-exists=.env scripts/weekly-report.js [--days N] [--send]
//   --days N  统计窗口（默认 7 天）
//   --send    同时发邮件到 ADMIN_EMAIL（走 src/email.js；未配 SMTP 打 dev 日志）
// 服务器 cron（每周一北京时间 10:00，错开日结告警 10:30）：
//   0 2 * * 1 cd /opt/mn/backend && node --env-file-if-exists=.env scripts/weekly-report.js --send >> /var/log/mn-weekly.log 2>&1
// 只读打开（WAL 下安全，与 backup.sh 同法）。

const path = require('node:path');
const { openDb } = require('../src/db');

const args = process.argv.slice(2);
const days = (() => {
  const i = args.indexOf('--days');
  const n = i >= 0 ? Number(args[i + 1]) : 7;
  return Number.isFinite(n) && n > 0 ? n : 7;
})();
const send = args.includes('--send');

const db = openDb(process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'mn.sqlite'), { readonly: true });
try {
  const now = new Date();
  const sinceIso = new Date(now.getTime() - days * 86400e3).toISOString();
  const month = now.toISOString().slice(0, 7);
  const dayOfMonth = Number(now.toISOString().slice(8, 10));

  const yuan = (micro) => (micro / 1e6).toFixed(2);
  const row = (sql, ...p) => db.prepare(sql).get(...p) || {};
  const all = (sql, ...p) => db.prepare(sql).all(...p);

  const lines = [];
  const push = (s = '') => lines.push(s);

  push(`M.LoreWorld 周报 ${sinceIso.slice(0, 10)} ~ ${now.toISOString().slice(0, 10)}（${days} 天窗口）`);
  push('');

  // ── 成本 vs 预算 ──
  push('── 成本 vs 预算 ──');
  const features = ['moderation_text', 'moderation_image', 'chat', 'total'];
  const labels = { moderation_text: '文字审核', moderation_image: '图像审核', chat: 'AI 客服', total: '总计' };
  const weekCost = {}, monthCost = {};
  for (const f of features) {
    const w = row("SELECT COALESCE(SUM(cost_micro),0) n FROM usage_log WHERE created_at >= ?" + (f === 'total' ? '' : ' AND feature = ?'), sinceIso, ...(f === 'total' ? [] : [f]));
    const m = row("SELECT COALESCE(SUM(cost_micro),0) n FROM usage_log WHERE created_at LIKE ?" + (f === 'total' ? '' : ' AND feature = ?'), month + '%', ...(f === 'total' ? [] : [f]));
    weekCost[f] = w.n; monthCost[f] = m.n;
  }
  const limits = {};
  for (const r of all("SELECT key, value FROM kv WHERE key LIKE 'budget.%'")) {
    limits[r.key.replace('budget.', '')] = Number(r.value);
  }
  push('功能 / 本周(元) / 本月累计(元) / 额度(元) / 本月占比');
  for (const f of features) {
    const lim = limits[f] || 0;
    const pct = lim > 0 ? Math.round((monthCost[f] / (lim * 1e6)) * 100) + '%' : '—';
    push(`  ${labels[f]}：${yuan(weekCost[f])} / ${yuan(monthCost[f])} / ${lim} / ${pct}`);
  }
  push('');

  // ── 调参建议（月耗推算 × 1.5 为安全线；对齐上线手册 §7「按真实流量调额度」）──
  push('── 调参建议 ──');
  let suggested = false;
  for (const f of features) {
    const lim = limits[f] || 0;
    if (lim <= 0 || f === 'total') continue;
    const projected = (monthCost[f] / Math.max(dayOfMonth, 1)) * 30;
    if (projected > lim) {
      push(`- ${labels[f]}：推算月耗 ≈${yuan(projected)} 元 已超额度 ${lim} 元 → 建议后台调至 ${Math.ceil(projected * 1.5)} 元，或排查异常消耗`);
      suggested = true;
    } else if (projected < lim * 0.3 && dayOfMonth > 10) {
      push(`- ${labels[f]}：推算月耗 ≈${yuan(projected)} 元 远低于额度 ${lim} 元 → 可下调额度收紧防线`);
      suggested = true;
    }
  }
  if (!suggested) push('- 各分项额度健康（推算月耗在额度 30%~100% 区间），无需调整。');
  push('');

  // ── 审核时效 ──
  push('── 审核时效 ──');
  const resolved = all("SELECT created_at, resolved_at FROM moderation_items WHERE resolved_at IS NOT NULL AND created_at >= ?", sinceIso);
  if (resolved.length) {
    const hours = resolved.map((r) => (Date.parse(r.resolved_at) - Date.parse(r.created_at)) / 36e5).sort((a, b) => a - b);
    const avg = hours.reduce((s, x) => s + x, 0) / hours.length;
    const median = hours[Math.floor(hours.length / 2)];
    const p95 = hours[Math.min(Math.floor(hours.length * 0.95), hours.length - 1)];
    push(`本周完成审核 ${resolved.length} 项：平均 ${avg.toFixed(1)}h / 中位 ${median.toFixed(1)}h / p95 ${p95.toFixed(1)}h`);
  } else {
    push('本周无已完成审核项（可能是新站初期）。');
  }
  const backlog = all("SELECT id, status, priority, created_at FROM moderation_items WHERE status IN ('l0_hold','queued','needs_human','ai_rejected')");
  if (backlog.length) {
    const oldest = backlog.reduce((min, b) => (b.created_at < min ? b.created_at : min), backlog[0].created_at);
    const oldestH = (Date.now() - Date.parse(oldest)) / 36e5;
    push(`队列积压 ${backlog.length} 项，最长等待 ${oldestH.toFixed(0)}h（含周末班次暂停期）`);
  } else {
    push('队列无积压。');
  }
  const pen = all("SELECT action, COUNT(*) n FROM moderation_decisions WHERE created_at >= ? GROUP BY action", sinceIso);
  push('本周处罚：' + (pen.length ? pen.map((p) => `${p.action} ×${p.n}`).join(' / ') : '无'));
  push('');

  // ── 活跃 ──
  push('── 活跃 ──');
  push(`新用户 ${row('SELECT COUNT(*) n FROM users WHERE created_at >= ?', sinceIso).n} · `
    + `新帖 ${row('SELECT COUNT(*) n FROM posts WHERE created_at >= ?', sinceIso).n} · `
    + `举报 ${row('SELECT COUNT(*) n FROM reports WHERE created_at >= ?', sinceIso).n} · `
    + `工单 ${row('SELECT COUNT(*) n FROM tickets WHERE created_at >= ?', sinceIso).n}`);
  push('');
  push('（预算 80%/耗尽 实时告警见每日邮件；管理后台 admin.<域名> 成本看板可查明细。）');

  const text = lines.join('\n');
  console.log(text);

  if (send) {
    const config = require('../src/config');
    const { createMailer } = require('../src/email');
    if (!config.adminEmail) { console.error('[weekly-report] ADMIN_EMAIL 未配置，跳过发送'); process.exitCode = 1; }
    else {
      createMailer(config).sendAlert(`[M.LoreWorld] 周报 ${now.toISOString().slice(0, 10)}`, text)
        .then((r) => { if (r.skipped) console.error('[weekly-report] 发送跳过'); else console.error('[weekly-report] 已发送（或 dev 日志）'); })
        .catch((e) => { console.error('[weekly-report] 发送失败:', e.message); process.exitCode = 1; });
    }
  }
} finally {
  db.close();
}
