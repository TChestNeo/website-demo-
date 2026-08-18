'use strict';
// 审核管线（DB 侧编排）：L0 门禁 + 审核项创建 + 处罚阶梯应用。
// 数据流（成本漏斗）：新内容 → L0 规则（0 元）→ 零容忍即时拒绝+封号 / warning·spam → l0_hold 人工 /
//   pass → 文字 night-batch（先发后审 visible）、图像 IMS 即时（pending 过审才 visible）。
// 处罚阶梯（与社区规则第 4 节对齐）：warn（≥3 自动升级 mute）→ remove_content（先行下架后通知）→
//   rate_limit（+24h）→ mute（+72h 可配）→ ban（永久，清 sessions）→ restore（人工申诉）。

const { evaluateText } = require('./rules');
const { insertWithId, pad6 } = require('../ids');

// target_type → 表名（remove_content 下架目标）
const TARGET_TABLES = { post: 'posts', article: 'articles', nation: 'nations', topic: 'topics' };

function createModerationItem(db, item) {
  const iso = item.createdAt || new Date().toISOString();
  const { id } = insertWithId(db, 'moderation_items',
    ['kind', 'target_type', 'target_id', 'content_hash', 'status', 'priority', 'rule_hits', 'created_at'],
    [item.kind, item.targetType, item.targetId, item.contentHash, item.status || 'queued',
      item.priority || 'normal', item.ruleHits ? JSON.stringify(item.ruleHits) : null, iso],
    (s) => 'MOD-' + pad6(s));
  return id;
}

function l0Screen(text, blocklist) {
  return evaluateText(text, blocklist);
}

// 取审核目标的正文（批处理/即时通道共用）：post 正文、article 标题+正文、nation/topic 的 name+lore/description
function textOf(db, targetType, targetId) {
  if (targetType === 'post') {
    const row = db.prepare('SELECT content FROM posts WHERE id = ?').get(targetId);
    return row ? row.content : '';
  }
  if (targetType === 'article') {
    const row = db.prepare('SELECT title, content_json FROM articles WHERE id = ?').get(targetId);
    return row ? (row.title + ' ' + (row.content_json || '')) : '';
  }
  if (targetType === 'nation' || targetType === 'topic') {
    const table = targetType === 'nation' ? 'nations' : 'topics';
    const row = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(targetId);
    if (!row) return '';
    try {
      const d = JSON.parse(row.data);
      return `${d.name || ''} ${d.lore || d.description || ''}`;
    } catch { return ''; }
  }
  return '';
}

// 通用 L0 门禁（nations/topics 等纯文字目标同步过筛 + 建审核项）：
// 零容忍 → 目标下架 + 直接封号（跳过阶梯）；warning/spam → l0_hold 人工；pass → queued（夜间批处理）。
// 返回 L0 结果（调用方决定响应形状）。posts 因媒体分支不同，自行组合本函数件。
function screenTextTarget(db, cfg, blocklist, opts) {
  const l0 = l0Screen(opts.text, blocklist);
  const itemId = createModerationItem(db, {
    kind: 'text', targetType: opts.targetType, targetId: opts.targetId, contentHash: opts.hash,
    status: l0.verdict === 'pass' ? 'queued' : 'l0_hold',
    priority: l0.verdict === 'reject' ? 'high' : 'normal',
    ruleHits: l0.hits.length ? l0.hits : null
  });
  if (l0.verdict === 'reject') {
    if (opts.table) db.prepare(`UPDATE ${opts.table} SET status = 'hidden' WHERE id = ?`).run(opts.targetId);
    if (opts.userId) {
      applyDecision(db, cfg, { itemId, action: 'ban', actor: 'system', reasonCode: 'zero_tolerance', userId: opts.userId });
    }
  }
  return l0;
}

// 新号频控：注册 N 天内 24h ≤maxPosts 帖（L0 频控，0 元）
function newAccountOverLimit(db, userId, maxPosts, nowIso) {
  const since = new Date(new Date(nowIso).getTime() - 24 * 3600 * 1000).toISOString();
  const n = db.prepare('SELECT count(*) AS n FROM posts WHERE author_id = ? AND created_at > ?').get(userId, since).n;
  return n >= maxPosts;
}

// sha1 去重：同一作者 24h 内同哈希内容（邻近去重由 AI 层负责，L0 只做精确）
function isDuplicate(db, userId, hash, nowIso) {
  const since = new Date(new Date(nowIso).getTime() - 24 * 3600 * 1000).toISOString();
  const n = db.prepare('SELECT count(*) AS n FROM moderation_items WHERE kind = ? AND content_hash = ? AND created_at > ? '
    + 'AND target_id IN (SELECT id FROM posts WHERE author_id = ?)')
    .get('text', hash, since, userId).n;
  return n > 0;
}

// 处罚阶梯：写 decision + 应用副作用（状态/时限/清会话）+ 通知（先行下架后通知）
// decision.userId 可显式指定（非 post 目标时必需）
function applyDecision(db, cfg, decision) {
  const iso = new Date().toISOString();
  const muteHours = ((cfg.moderation || {}).muteHours) || 72;
  db.prepare('INSERT INTO moderation_decisions (item_id, action, actor, reason_code, notes, created_at) '
    + 'VALUES (?, ?, ?, ?, ?, ?)')
    .run(decision.itemId, decision.action, decision.actor, decision.reasonCode || null, decision.notes || null, iso);

  const target = db.prepare('SELECT * FROM moderation_items WHERE id = ?').get(decision.itemId) || {};
  const userId = decision.userId || (target.target_type === 'post'
    ? (db.prepare('SELECT author_id FROM posts WHERE id = ?').get(target.target_id) || {}).author_id
    : null);

  function notify(uid, title, body) {
    if (!uid) return;
    db.prepare('INSERT INTO notifications (user_id, type, title, body, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(uid, 'moderation', title, body, iso);
  }

  switch (decision.action) {
    case 'warn': {
      db.prepare('UPDATE users SET warning_count = warning_count + 1, updated_at = ? WHERE id = ?').run(iso, userId);
      const wc = db.prepare('SELECT warning_count AS n FROM users WHERE id = ?').get(userId).n;
      notify(userId, '警告通知', '你的一条内容违反了社区规则。累计 3 次警告将自动禁言。');
      if (wc >= 3) { // 阶梯自动升级
        const until = new Date(new Date(iso).getTime() + muteHours * 3600 * 1000).toISOString();
        db.prepare('UPDATE users SET muted_until = ? WHERE id = ?').run(until, userId);
        notify(userId, '自动禁言', `累计 3 次警告，已禁言 ${muteHours} 小时。`);
      }
      break;
    }
    case 'remove_content': {
      const table = TARGET_TABLES[target.target_type];
      if (table) db.prepare(`UPDATE ${table} SET status = 'hidden' WHERE id = ?`).run(target.target_id);
      notify(userId, '内容已下架', '你的一条内容经审核判定违规，已先行下架。如有异议可通过帮助中心申诉。');
      break;
    }
    case 'rate_limit': {
      const until = new Date(new Date(iso).getTime() + 24 * 3600 * 1000).toISOString();
      db.prepare('UPDATE users SET rate_limited_until = ? WHERE id = ?').run(until, userId);
      notify(userId, '发布受限', '你的发布频率异常，24 小时内限制发帖。');
      break;
    }
    case 'mute': {
      const until = new Date(new Date(iso).getTime() + muteHours * 3600 * 1000).toISOString();
      db.prepare('UPDATE users SET muted_until = ? WHERE id = ?').run(until, userId);
      notify(userId, '禁言通知', `你已被禁言 ${muteHours} 小时。期间无法发帖。`);
      break;
    }
    case 'ban': {
      db.prepare("UPDATE users SET status = 'banned', updated_at = ? WHERE id = ?").run(iso, userId);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); // 立即下线
      notify(userId, '账号封禁', '你的账号因严重违反社区规则已被永久封禁。如有异议可通过帮助中心申诉。');
      break;
    }
    case 'restore': {
      db.prepare("UPDATE users SET status = 'active', warning_count = 0, muted_until = NULL, rate_limited_until = NULL, updated_at = ? WHERE id = ?").run(iso, userId);
      notify(userId, '处罚撤销', '经人工复核，你账号上的处罚已撤销。抱歉造成不便。');
      break;
    }
    default:
      throw new Error('未知处罚 action: ' + decision.action);
  }
  return { ok: true };
}

module.exports = { createModerationItem, l0Screen, screenTextTarget, textOf, newAccountOverLimit, isDuplicate, applyDecision, TARGET_TABLES };
