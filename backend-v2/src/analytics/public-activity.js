'use strict';
// 公网活动页聚合（GET /api/public/activity 数据源，只读零迁移）。
// 口径：nations/citizens 为全量总数（非窗口）+ 窗口增量趋势；newCitizens/articles/activity 为窗口计数。
// PII 禁令：本模块输出不含任何 email/display_name/citizen_id——公民里程碑 title 恒 null（前端渲染匿名文案）。
// heatmap 为 UTC 口径（page_views.created_at 是 UTC ISO）：不按客户端时区偏移，保周一开头列契约。

const { rangeWindow, fillDays } = require('./window');

// prev=0 时无基准 → deltaPct null（前端渲染 '—'）；1 位小数（与旧种子样式 3.2 一致）
function trendOf(cur, prev) {
  return { value: cur, prev, deltaPct: prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null };
}

function cnt2(db, sql, a, b) {
  return (sql.indexOf('?') === -1 ? db.prepare(sql).get() : db.prepare(sql).get(a, b)).n;
}

function kpi(db, w, prevW) {
  const nationsTotal = cnt2(db, "SELECT count(*) AS n FROM nations WHERE status = 'visible'");
  const nationsNew = cnt2(db, "SELECT count(*) AS n FROM nations WHERE status = 'visible' AND created_at >= ? AND created_at < ?", w.fromIso, w.toIso);
  const nationsPrev = cnt2(db, "SELECT count(*) AS n FROM nations WHERE status = 'visible' AND created_at >= ? AND created_at < ?", prevW.fromIso, prevW.toIso);

  const citizensTotal = cnt2(db, "SELECT count(*) AS n FROM users WHERE status = 'active'");
  const newCitizens = cnt2(db, 'SELECT count(*) AS n FROM users WHERE created_at >= ? AND created_at < ?', w.fromIso, w.toIso);
  const newCitizensPrev = cnt2(db, 'SELECT count(*) AS n FROM users WHERE created_at >= ? AND created_at < ?', prevW.fromIso, prevW.toIso);

  const articles = cnt2(db, "SELECT count(*) AS n FROM articles WHERE status = 'published' AND created_at >= ? AND created_at < ?", w.fromIso, w.toIso);
  const articlesPrev = cnt2(db, "SELECT count(*) AS n FROM articles WHERE status = 'published' AND created_at >= ? AND created_at < ?", prevW.fromIso, prevW.toIso);

  const msgs = cnt2(db, 'SELECT count(*) AS n FROM messages WHERE created_at >= ? AND created_at < ?', w.fromIso, w.toIso);
  const comments = cnt2(db, "SELECT count(*) AS n FROM comments WHERE status = 'visible' AND created_at >= ? AND created_at < ?", w.fromIso, w.toIso);
  const likes = cnt2(db, "SELECT count(*) AS n FROM content_likes WHERE target_type = 'post' AND created_at >= ? AND created_at < ?", w.fromIso, w.toIso);
  const msgsPrev = cnt2(db, 'SELECT count(*) AS n FROM messages WHERE created_at >= ? AND created_at < ?', prevW.fromIso, prevW.toIso);
  const commentsPrev = cnt2(db, "SELECT count(*) AS n FROM comments WHERE status = 'visible' AND created_at >= ? AND created_at < ?", prevW.fromIso, prevW.toIso);
  const likesPrev = cnt2(db, "SELECT count(*) AS n FROM content_likes WHERE target_type = 'post' AND created_at >= ? AND created_at < ?", prevW.fromIso, prevW.toIso);

  return {
    // 趋势=窗口增量 vs 等长前窗；value 保持全量总数口径
    nations: { value: nationsTotal, prev: nationsPrev, deltaPct: trendOf(nationsNew, nationsPrev).deltaPct },
    citizens: { value: citizensTotal, prev: newCitizensPrev, deltaPct: trendOf(newCitizens, newCitizensPrev).deltaPct },
    newCitizens: trendOf(newCitizens, newCitizensPrev),
    articles: trendOf(articles, articlesPrev),
    activity: trendOf(msgs + comments + likes, msgsPrev + commentsPrev + likesPrev)
  };
}

// 趋势图恒为最近 30 天日序列（range 药丸只驱动 KPI/类型/榜/里程碑——页面钦定口径）。
// custom 窗 29d 前起：fillDays 首尾含闭区间，30d 窗会吐 31 个日期——29d 前→今天恰好 30 天。
function trends(db) {
  const w = rangeWindow('custom', new Date(Date.now() - 29 * 86400e3).toISOString(), new Date().toISOString());
  const series = (sql) => {
    const map = new Map(db.prepare(sql).all(w.fromIso, w.toIso).map((r) => [r.d, { value: r.n }]));
    return fillDays(w.fromDate, w.toDate, map, ['value']);
  };
  return {
    users: series('SELECT substr(created_at,1,10) AS d, count(*) AS n FROM users WHERE created_at >= ? AND created_at < ? GROUP BY d'),
    nations: series('SELECT substr(created_at,1,10) AS d, count(*) AS n FROM nations WHERE created_at >= ? AND created_at < ? GROUP BY d'),
    articles: series("SELECT substr(created_at,1,10) AS d, count(*) AS n FROM articles WHERE status = 'published' AND created_at >= ? AND created_at < ? GROUP BY d"),
    teams: series('SELECT substr(created_at,1,10) AS d, count(*) AS n FROM teams WHERE created_at >= ? AND created_at < ? GROUP BY d')
  };
}

function contentTypes(db, w) {
  return {
    articles: cnt2(db, "SELECT count(*) AS n FROM articles WHERE status = 'published' AND created_at >= ? AND created_at < ?", w.fromIso, w.toIso),
    posts: cnt2(db, "SELECT count(*) AS n FROM posts WHERE status = 'visible' AND created_at >= ? AND created_at < ?", w.fromIso, w.toIso),
    comments: cnt2(db, "SELECT count(*) AS n FROM comments WHERE status = 'visible' AND created_at >= ? AND created_at < ?", w.fromIso, w.toIso),
    likes: cnt2(db, "SELECT count(*) AS n FROM content_likes WHERE target_type = 'post' AND created_at >= ? AND created_at < ?", w.fromIso, w.toIso)
  };
}

const HEAT_BLOCKS = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24'];
const HEAT_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// 最近 7 个完整 UTC 日 × 6 时段。UTC 口径（见文件头注释）：page_views.created_at 为 UTC ISO，
// hour/dow 直取不偏移——热力图无「今天」高亮，跨时区错位可接受且保周一开头列契约。
function heatmap(db) {
  const toDate = new Date().toISOString().slice(0, 10);
  const fromMs = Date.parse(toDate + 'T00:00:00Z') - 6 * 86400e3;
  const fromDate = new Date(fromMs).toISOString().slice(0, 10);
  const toIso = new Date(Date.parse(toDate + 'T00:00:00Z') + 86400e3).toISOString();
  const rows = db.prepare(
    "SELECT substr(created_at,12,2) AS hour, strftime('%w', created_at) AS dow, count(*) AS n FROM page_views WHERE created_at >= ? AND created_at < ? GROUP BY hour, dow"
  ).all(fromDate + 'T00:00:00.000Z', toIso);

  const days = HEAT_DAYS.map((key) => ({ key, total: 0, cells: [0, 0, 0, 0, 0, 0] }));
  let maxCell = 0;
  for (const r of rows) {
    const block = Math.min(5, Math.floor(Number(r.hour) / 4));
    const col = (Number(r.dow) + 6) % 7; // SQLite %w：0=周日 → 0=周一
    days[col].cells[block] += r.n;
    days[col].total += r.n;
    if (days[col].cells[block] > maxCell) maxCell = days[col].cells[block];
  }
  return { timeBlocks: HEAT_BLOCKS, days, maxCell };
}

function leaderboard(db, w) {
  const rows = db.prepare(
    `SELECT n.id, n.data, COALESCE(SUM(a.requests), 0) AS score
     FROM nations n
     LEFT JOIN activity_daily a ON a.user_id = n.owner_id AND a.date >= ? AND a.date <= ?
     WHERE n.status = 'visible'
     GROUP BY n.id ORDER BY score DESC, n.seq ASC LIMIT 5`
  ).all(w.fromDate, w.toDate);
  const out = [];
  for (const r of rows) {
    if (r.score === 0) continue; // 零活跃国家不上榜（空表期友好）
    let d = {};
    try { d = JSON.parse(r.data || '{}'); } catch { d = {}; }
    out.push({
      rank: out.length + 1,
      name: d.name || 'Nation ' + r.id.slice(4),
      flag: d.emoji || d.flag || null,
      score: r.score
    });
  }
  return out;
}

function milestones(db, w) {
  const rows = db.prepare(
    `SELECT 'nation' AS type, id, created_at AS at FROM nations WHERE status = 'visible' AND created_at >= ? AND created_at < ?
     UNION ALL SELECT 'article', id, created_at FROM articles WHERE status = 'published' AND created_at >= ? AND created_at < ?
     UNION ALL SELECT 'citizen', id, created_at FROM users WHERE created_at >= ? AND created_at < ?
     ORDER BY at DESC LIMIT 5`
  ).all(w.fromIso, w.toIso, w.fromIso, w.toIso, w.fromIso, w.toIso);
  return rows.map((r) => {
    let title = null;
    if (r.type === 'nation') {
      const row = db.prepare('SELECT data FROM nations WHERE id = ?').get(r.id);
      let d = {};
      try { d = JSON.parse((row && row.data) || '{}'); } catch { d = {}; }
      title = d.name || 'Nation ' + r.id.slice(4);
    } else if (r.type === 'article') {
      const row = db.prepare('SELECT title FROM articles WHERE id = ?').get(r.id);
      title = row ? row.title : null;
    }
    // citizen：title 恒 null——公开端点禁任何 PII（email/display_name/citizen_id 一律不出）
    return { type: r.type, title, at: r.at };
  });
}

module.exports = { kpi, trends, contentTypes, heatmap, leaderboard, milestones };
