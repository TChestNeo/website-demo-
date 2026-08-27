'use strict';
// content 域聚合：帖子/审核管线/举报/文章（D9 读时现算）。

const { fillDays } = require('./window');

function overview(db, w) {
  const posts = db.prepare('SELECT count(*) AS n FROM posts WHERE created_at >= ? AND created_at < ?').get(w.fromIso, w.toIso).n;
  const byStatus = db.prepare('SELECT status, count(*) AS n FROM posts WHERE created_at >= ? AND created_at < ? GROUP BY status ORDER BY n DESC, status')
    .all(w.fromIso, w.toIso);
  const pendingModeration = db.prepare(
    "SELECT count(*) AS n FROM moderation_items WHERE status IN ('queued','l0_hold','needs_human')"
  ).get().n;
  const decisions = db.prepare('SELECT action, count(*) AS n FROM moderation_decisions WHERE created_at >= ? AND created_at < ? GROUP BY action ORDER BY n DESC, action')
    .all(w.fromIso, w.toIso);
  const openReports = db.prepare("SELECT count(*) AS n FROM reports WHERE status = 'open'").get().n;
  const articles = db.prepare('SELECT count(*) AS n FROM articles WHERE created_at >= ? AND created_at < ?').get(w.fromIso, w.toIso).n;
  return { posts, byStatus, pendingModeration, decisions, openReports, articles };
}

function daily(db, w) {
  const po = new Map(db.prepare('SELECT substr(created_at,1,10) AS d, count(*) AS n FROM posts WHERE created_at >= ? AND created_at < ? GROUP BY d')
    .all(w.fromIso, w.toIso).map((r) => [r.d, { posts: r.n }]));
  const rm = new Map(db.prepare(
    "SELECT substr(created_at,1,10) AS d, count(*) AS n FROM moderation_decisions WHERE action IN ('remove_content','ban') AND created_at >= ? AND created_at < ? GROUP BY d"
  ).all(w.fromIso, w.toIso).map((r) => [r.d, { removed: r.n }]));
  const rp = new Map(db.prepare('SELECT substr(created_at,1,10) AS d, count(*) AS n FROM reports WHERE created_at >= ? AND created_at < ? GROUP BY d')
    .all(w.fromIso, w.toIso).map((r) => [r.d, { reports: r.n }]));
  const merged = new Map();
  for (const [d, v] of po) merged.set(d, { ...(merged.get(d) || {}), ...v });
  for (const [d, v] of rm) merged.set(d, { ...(merged.get(d) || {}), ...v });
  for (const [d, v] of rp) merged.set(d, { ...(merged.get(d) || {}), ...v });
  return fillDays(w.fromDate, w.toDate, merged, ['posts', 'removed', 'reports']);
}

module.exports = { overview, daily };
