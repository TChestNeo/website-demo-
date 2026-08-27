'use strict';
// finance 域聚合：收入（payments 已付）/ MRR（活跃订阅）/ AI 成本（usage_log）/ 流水账（D9 读时现算）。
// 金额一律整数微元（D1 机器事件平面）；AI 成本 CNY 微元经 money.cnyMicroToRMMicro 折 RM。

const { fillDays } = require('./window');
const money = require('../money');

function overview(db, w) {
  const revenueMicro = db.prepare(
    "SELECT COALESCE(SUM(amount_micro), 0) AS n FROM payments WHERE status IN ('paid','refunded','partial_refunded') AND paid_at >= ? AND paid_at < ?"
  ).get(w.fromIso, w.toIso).n;
  const mrrMicro = db.prepare("SELECT COALESCE(SUM(amount_micro), 0) AS n FROM subscriptions WHERE status = 'active'").get().n;
  const activeSubs = db.prepare("SELECT count(*) AS n FROM subscriptions WHERE status = 'active'").get().n;
  const payingUsers = db.prepare("SELECT count(*) AS n FROM users WHERE tier != 'free'").get().n;
  const aiCostCnyMicro = db.prepare('SELECT COALESCE(SUM(cost_micro), 0) AS n FROM usage_log WHERE created_at >= ? AND created_at < ?')
    .get(w.fromIso, w.toIso).n;
  const aiCostMicro = money.cnyMicroToRMMicro(db, aiCostCnyMicro);
  const ledger = db.prepare("SELECT kind, COALESCE(SUM(amount), 0) AS total FROM ledger WHERE occurred_at >= ? AND occurred_at <= ? GROUP BY kind")
    .all(w.fromDate, w.toDate);
  const ledgerIncomeMicro = Math.round((ledger.find((r) => r.kind === 'income') || { total: 0 }).total * 1e6);
  const ledgerExpenseMicro = Math.round((ledger.find((r) => r.kind === 'expense') || { total: 0 }).total * 1e6);
  return { revenueMicro, mrrMicro, activeSubs, payingUsers, aiCostMicro, ledgerIncomeMicro, ledgerExpenseMicro };
}

function daily(db, w) {
  const rv = new Map(db.prepare(
    "SELECT substr(paid_at,1,10) AS d, COALESCE(SUM(amount_micro), 0) AS n FROM payments WHERE status IN ('paid','refunded','partial_refunded') AND paid_at >= ? AND paid_at < ? GROUP BY d"
  ).all(w.fromIso, w.toIso).map((r) => [r.d, { revenueMicro: r.n }]));
  const ai = new Map(db.prepare('SELECT substr(created_at,1,10) AS d, COALESCE(SUM(cost_micro), 0) AS n FROM usage_log WHERE created_at >= ? AND created_at < ? GROUP BY d')
    .all(w.fromIso, w.toIso).map((r) => [r.d, { aiCostCnyMicro: r.n }]));
  const merged = new Map();
  for (const [d, v] of rv) merged.set(d, { ...(merged.get(d) || {}), ...v });
  for (const [d, v] of ai) merged.set(d, { ...(merged.get(d) || {}), ...v });
  return fillDays(w.fromDate, w.toDate, merged, ['revenueMicro', 'aiCostCnyMicro']);
}

module.exports = { overview, daily };
