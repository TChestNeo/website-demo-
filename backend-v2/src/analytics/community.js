'use strict';
// community 域聚合：国家/团队/话题/关注/私信/评论/点赞（D9 读时现算）。

const { fillDays } = require('./window');

function overview(db, w) {
  const nations = db.prepare('SELECT count(*) AS n FROM nations').get().n;
  const teams = db.prepare('SELECT count(*) AS n FROM teams').get().n;
  const topics = db.prepare('SELECT count(*) AS n FROM topics').get().n;
  const following = db.prepare('SELECT count(*) AS n FROM following').get().n;
  const conversations = db.prepare('SELECT count(*) AS n FROM conversations').get().n;
  const comments = db.prepare('SELECT count(*) AS n FROM comments WHERE created_at >= ? AND created_at < ?').get(w.fromIso, w.toIso).n;
  const likes = db.prepare("SELECT count(*) AS n FROM content_likes WHERE target_type = 'post'").get().n;
  const messages = db.prepare('SELECT count(*) AS n FROM messages WHERE created_at >= ? AND created_at < ?').get(w.fromIso, w.toIso).n;
  return { nations, teams, topics, following, conversations, comments, likes, messages };
}

function daily(db, w) {
  const ms = new Map(db.prepare('SELECT substr(created_at,1,10) AS d, count(*) AS n FROM messages WHERE created_at >= ? AND created_at < ? GROUP BY d')
    .all(w.fromIso, w.toIso).map((r) => [r.d, { messages: r.n }]));
  const cm = new Map(db.prepare('SELECT substr(created_at,1,10) AS d, count(*) AS n FROM comments WHERE created_at >= ? AND created_at < ? GROUP BY d')
    .all(w.fromIso, w.toIso).map((r) => [r.d, { comments: r.n }]));
  const lk = new Map(db.prepare("SELECT substr(created_at,1,10) AS d, count(*) AS n FROM content_likes WHERE target_type = 'post' AND created_at >= ? AND created_at < ? GROUP BY d")
    .all(w.fromIso, w.toIso).map((r) => [r.d, { likes: r.n }]));
  const merged = new Map();
  for (const [d, v] of ms) merged.set(d, { ...(merged.get(d) || {}), ...v });
  for (const [d, v] of cm) merged.set(d, { ...(merged.get(d) || {}), ...v });
  for (const [d, v] of lk) merged.set(d, { ...(merged.get(d) || {}), ...v });
  return fillDays(w.fromDate, w.toDate, merged, ['messages', 'comments', 'likes']);
}

module.exports = { overview, daily };
