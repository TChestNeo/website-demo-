'use strict';
// users 域聚合（D9 读时现算，无缓存表）：总量/新增/活跃/留存/分层。
// 留存源 = activity_daily（鉴权中间件落库）；日期比较一律用 substr(iso,1,10)（ISO UTC 字典序 = 时序）。

const { fillDays } = require('./window');

// 概览：{ total, newCount, active, retention:{day1,day7,day30}, byTier, byStatus, byRisk }
function overview(db, w) {
  const total = db.prepare('SELECT count(*) AS n FROM users').get().n;
  const newCount = db.prepare('SELECT count(*) AS n FROM users WHERE created_at >= ? AND created_at < ?').get(w.fromIso, w.toIso).n;
  const active = db.prepare('SELECT count(DISTINCT user_id) AS n FROM activity_daily WHERE date >= ? AND date <= ?').get(w.fromDate, w.toDate).n;

  // 留存：窗口内注册的 cohort，按各自注册日 +1/+7/+30 天仍活跃的比例
  const cohort = db.prepare('SELECT count(*) AS n FROM users WHERE created_at >= ? AND created_at < ?').get(w.fromIso, w.toIso).n;
  const ret = (days) => cohort
    ? Number(db.prepare(`
        SELECT count(*) AS n FROM users u
        WHERE u.created_at >= ? AND u.created_at < ?
          AND EXISTS (SELECT 1 FROM activity_daily a WHERE a.user_id = u.id
            AND a.date = date(substr(u.created_at, 1, 10), ?))
      `).get(w.fromIso, w.toIso, `+${days} day`).n) / cohort
    : 0;
  const retention = { day1: round2(ret(1)), day7: round2(ret(7)), day30: round2(ret(30)), cohort };

  return {
    total, newCount, active, retention,
    byTier: db.prepare('SELECT tier, count(*) AS n FROM users GROUP BY tier ORDER BY n DESC, tier').all(),
    byStatus: db.prepare('SELECT status, count(*) AS n FROM users GROUP BY status ORDER BY n DESC, status').all(),
    byRisk: db.prepare('SELECT risk_level AS risk, count(*) AS n FROM users GROUP BY risk_level ORDER BY n DESC, risk').all(),
    byCountry: db.prepare('SELECT country, count(*) AS n FROM users WHERE country IS NOT NULL AND country != \'\' GROUP BY country ORDER BY n DESC, country LIMIT 10').all()
  };
}

// 日序列：[{date, signups, active}]（缺日补零）
function daily(db, w) {
  const su = new Map(db.prepare('SELECT substr(created_at,1,10) AS d, count(*) AS n FROM users WHERE created_at >= ? AND created_at < ? GROUP BY d')
    .all(w.fromIso, w.toIso).map((r) => [r.d, { signups: r.n }]));
  const ac = new Map(db.prepare('SELECT date AS d, count(DISTINCT user_id) AS n FROM activity_daily WHERE date >= ? AND date <= ? GROUP BY d')
    .all(w.fromDate, w.toDate).map((r) => [r.d, { active: r.n }]));
  const merged = new Map();
  for (const [d, v] of su) merged.set(d, { ...(merged.get(d) || {}), ...v });
  for (const [d, v] of ac) merged.set(d, { ...(merged.get(d) || {}), ...v });
  return fillDays(w.fromDate, w.toDate, merged, ['signups', 'active']);
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

module.exports = { overview, daily };
