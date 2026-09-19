'use strict';
// 通知聚合（v0.2.52.0 首页铃铛聚合通知 + 文章点赞收藏；v0.2.55.0 文章评论加第八类）：GET /api/notifications
// 实时聚合八类事件（post_like / post_favorite / article_like / article_favorite / post_comment /
// article_comment / follow / friend_request）。
// 设计：零迁移（content_likes/favorites 的 target_type='article' 在 005 已预留且无 CHECK，文章互动直接复用）；
// 不建事件表、不写 notifications 表（001 表仅审核管线在写、无读端点，不碰）；
// 未读红点由前端 localStorage lastSeen 负责（按用户 id 隔离）。
// 公告天然不在任何查询中（公告是前端静态区块，不写任何通知数据），「除公告外」自动满足。
// 红线沿用：零审核 import。

const { HttpError, sendJson } = require('../../http');
const { requireSession } = require('../../middleware/auth');

const LIMIT = 50; // 每类先取 50 再合并截断（与 comments LIMIT 200 同口径兜底）

// actor 公开档案（照 friend-requests.js 口径：displayName/avatarUrl/citizenId）
function actorOf(r) {
  return { id: r.actor_id, displayName: r.display_name, avatarUrl: r.avatar_url, citizenId: r.citizen_id };
}

function register(router, ctx) {
  const db = ctx.db;

  router.add('GET', '/api/notifications', requireSession((req, res, c) => {
    const me = c.user.id;
    const items = [];
    let i = 0;
    const push = (type, rows, idOf, targetOf) => {
      for (const r of rows) {
        items.push({
          type,
          id: idOf ? idOf(r) : null, // 赞/藏/关注无事件行 id → null（前端 key 用 type|targetId|actor.id|createdAt 复合串）
          targetId: targetOf(r),
          actor: actorOf(r),
          createdAt: r.created_at,
          __i: i++, // 全局追加序：同毫秒 createdAt 的稳定次级排序键
        });
      }
    };

    // 1) 谁点赞/收藏了我的帖子（帖子仍可见才浮现；排除自己）
    push('post_like', db.prepare(`
      SELECT l.user_id AS actor_id, l.target_id, l.created_at, u.display_name, u.avatar_url, u.citizen_id
      FROM content_likes l JOIN posts p ON p.id = l.target_id JOIN users u ON u.id = l.user_id
      WHERE l.target_type = 'post' AND p.author_id = ? AND p.status = 'visible' AND l.user_id != ?
      ORDER BY l.created_at DESC, l.rowid DESC LIMIT ?`).all(me, me, LIMIT), null, (r) => r.target_id);
    push('post_favorite', db.prepare(`
      SELECT f.user_id AS actor_id, f.target_id, f.created_at, u.display_name, u.avatar_url, u.citizen_id
      FROM favorites f JOIN posts p ON p.id = f.target_id JOIN users u ON u.id = f.user_id
      WHERE f.target_type = 'post' AND p.author_id = ? AND p.status = 'visible' AND f.user_id != ?
      ORDER BY f.created_at DESC, f.rowid DESC LIMIT ?`).all(me, me, LIMIT), null, (r) => r.target_id);

    // 2) 谁点赞/收藏了我的文章（未公开文章的互动事件不浮现——点击才不 404）
    push('article_like', db.prepare(`
      SELECT l.user_id AS actor_id, l.target_id, l.created_at, u.display_name, u.avatar_url, u.citizen_id
      FROM content_likes l JOIN articles a ON a.id = l.target_id JOIN users u ON u.id = l.user_id
      WHERE l.target_type = 'article' AND a.author_id = ? AND a.status = 'published' AND l.user_id != ?
      ORDER BY l.created_at DESC, l.rowid DESC LIMIT ?`).all(me, me, LIMIT), null, (r) => r.target_id);
    push('article_favorite', db.prepare(`
      SELECT f.user_id AS actor_id, f.target_id, f.created_at, u.display_name, u.avatar_url, u.citizen_id
      FROM favorites f JOIN articles a ON a.id = f.target_id JOIN users u ON u.id = f.user_id
      WHERE f.target_type = 'article' AND a.author_id = ? AND a.status = 'published' AND f.user_id != ?
      ORDER BY f.created_at DESC, f.rowid DESC LIMIT ?`).all(me, me, LIMIT), null, (r) => r.target_id);

    // 3) 谁评论了我的帖子（回复同口径；removed/hidden 不浮现；排除自己）
    push('post_comment', db.prepare(`
      SELECT c.id, c.post_id AS target_id, c.author_id AS actor_id, c.created_at, u.display_name, u.avatar_url, u.citizen_id
      FROM comments c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.author_id
      WHERE p.author_id = ? AND p.status = 'visible' AND c.status = 'visible' AND c.author_id != ?
      ORDER BY c.created_at DESC, c.seq DESC LIMIT ?`).all(me, me, LIMIT), (r) => r.id, (r) => r.target_id);

    // 3b) 谁评论了我的文章（v0.2.55.0；removed 不浮现；排除自己）
    push('article_comment', db.prepare(`
      SELECT c.id, c.article_id AS target_id, c.author_id AS actor_id, c.created_at, u.display_name, u.avatar_url, u.citizen_id
      FROM article_comments c JOIN articles a ON a.id = c.article_id JOIN users u ON u.id = c.author_id
      WHERE a.author_id = ? AND a.status = 'published' AND c.status = 'visible' AND c.author_id != ?
      ORDER BY c.created_at DESC, c.seq DESC LIMIT ?`).all(me, me, LIMIT), (r) => r.id, (r) => r.target_id);

    // 4) 谁关注了我（targetId = 关注者 id，前端跳其主页）
    push('follow', db.prepare(`
      SELECT f.user_id AS actor_id, f.created_at, u.display_name, u.avatar_url, u.citizen_id
      FROM following f JOIN users u ON u.id = f.user_id
      WHERE f.target_type = 'user' AND f.target_id = ? AND f.user_id != ?
      ORDER BY f.created_at DESC, f.rowid DESC LIMIT ?`).all(me, me, LIMIT), null, (r) => r.actor_id);

    // 5) 待处理好友请求（accept/decline 后 status 变化自然消失）
    push('friend_request', db.prepare(`
      SELECT fr.id, fr.sender_id AS actor_id, fr.created_at, u.display_name, u.avatar_url, u.citizen_id
      FROM friend_requests fr JOIN users u ON u.id = fr.sender_id
      WHERE fr.recipient_id = ? AND fr.status = 'pending'
      ORDER BY fr.seq DESC LIMIT ?`).all(me, LIMIT), (r) => r.id, (r) => r.actor_id);

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.__i - b.__i);
    const out = items.slice(0, LIMIT).map((x) => ({
      type: x.type, id: x.id, targetId: x.targetId, actor: x.actor, createdAt: x.createdAt,
    }));
    sendJson(res, 200, { notifications: out });
  }));
}

module.exports = { register };
