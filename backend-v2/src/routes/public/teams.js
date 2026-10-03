'use strict';
// 团队频道（FC v10.28.51.0）：三步向导一键建团（①身份转换 ②内容搬运 ③建群聊）+ 成员管理。
// teams/team_members 表自 005 已有（一期只读种子 social.js TEAM_SEED 保留为演示数据）——本轮写路径复活。
// 搬运=只搬数据不搬频道（个人频道保留不动；私人点赞/收藏 content_likes/favorites 恒留个人，不搬）：
//   贴文 posts / 动态=已发布文章 articles → 新行 team_id=新团（原件不动，复制语义）；
//   视频&贴图 uploads → 新行 copy_of=原件（同文件对象 fs 复制到新 id，源文件缺失跳过文件但保留登记行）；
//   主页装饰 → 拷入 teams.data JSON（decorations 字段），零新列。
// 成员上限：标配 3（owner+2）；slots-* 扩容订阅（Stripe webhook 写 users.team_cap_addon+team_cap_expires_at）
//   有效期内 8/16/26/∞，过期回落 3。
// 好友口径：friend_requests status='accepted'（任一方向）——与 fc-edges.js 好友集同款（dm-shared.acceptedFriends）。
// 红线沿用 messages.js：零审核 import（团队名/群聊名写入路径不跑审核管线——群聊先例；帖文搬运=本人已可见原件复制）。
// 群聊复用 conversations kind='group'（005 已含）+ conversation_members 多成员；成员限好友。

const fs = require('node:fs');
const path = require('node:path');
const { HttpError, sendJson, readJson } = require('../../http');
const { requireSession } = require('../../middleware/auth');
const { insertWithId, pad6 } = require('../../ids');
const { acceptedFriends } = require('./dm-shared');

const MAX_TEAM_NAME = 60;
const MAX_CHAT_NAME = 60;
const MAX_COPY = 200; // 每类搬运上限（防超长建团请求）
const BASE_CAP = 3; // 标配：owner + 2
const SLOT_CAP = { basic: 8, plus: 16, premium: 26, ultra: Infinity }; // 扩容订阅口径 8/16/26/∞（用户钦定）

function parseJson(v) {
  try { return JSON.parse(v); } catch { return null; }
}

function writeLimit(ctx) {
  const w = (ctx.config.rateLimits || {}).teamsWrite || { max: 20, windowMs: 3600000 }; // 20/小时
  return ctx.limiter('team:user:' + ctx.user.id, w.max, w.windowMs);
}

// 成员上限：owner 的扩容订阅有效期内生效；过期/未购回落标配 3
function capOf(db, ownerId) {
  const u = db.prepare('SELECT team_cap_addon, team_cap_expires_at FROM users WHERE id = ?').get(ownerId);
  if (!u || !u.team_cap_addon) return BASE_CAP;
  if (u.team_cap_expires_at && u.team_cap_expires_at <= new Date().toISOString()) return BASE_CAP;
  return SLOT_CAP[u.team_cap_addon] || BASE_CAP;
}

function memberCountOf(db, teamId) {
  return db.prepare('SELECT count(*) AS n FROM team_members WHERE team_id = ?').get(teamId).n;
}

function requireTeamMember(db, teamId, userId) {
  const row = db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, userId);
  if (!row) throw new HttpError('FORBIDDEN', '你不是该团队成员');
  return row;
}

function requireOwner(db, teamId, userId) {
  const row = requireTeamMember(db, teamId, userId);
  if (row.role !== 'owner') throw new HttpError('FORBIDDEN', '仅队长可操作');
  return row;
}

// 团队形状（读侧统一：data JSON + 实时成员数 + 我的角色 + 上限）
function teamShape(db, row, myRole, ownerId) {
  const d = parseJson(row.data) || {};
  return {
    id: row.id,
    name: d.name || row.id,
    avatar: d.avatar || String(d.name || 'T').replace(/\s+/g, '').substring(0, 2).toUpperCase(),
    color: d.color || '#4648d4',
    role: myRole || 'member',
    members: memberCountOf(db, row.id),
    nations: d.nations || [],
    ownerId: ownerId || d.ownerId || null,
    cap: ownerId ? capOf(db, ownerId) : BASE_CAP,
    createdAt: row.created_at,
    avatarUrl: d.avatarUrl || null,
    bannerUrl: d.bannerUrl || null,
    decorations: d.decorations || {}
  };
}

// 好友校验 + 去重 + 自排除（建团拉人/后加人共用；非好友 → 400 点名）
function checkInvitees(db, me, ids) {
  const friends = acceptedFriends(db, me);
  const friendIds = new Set(friends.map((f) => f.id));
  const out = [];
  const seen = new Set();
  for (const raw of ids) {
    const id = String(raw || '');
    if (!id || id === me) throw new HttpError('VALIDATION', '不能拉自己进团队');
    if (seen.has(id)) continue;
    seen.add(id);
    if (!friendIds.has(id)) throw new HttpError('VALIDATION', '只能邀请你的好友加入团队');
    out.push(id);
  }
  return out;
}

// 内容搬运（复制语义：新 id 新行，原件不动；私人点赞收藏不搬）
function copyContent(c, teamId, me, items) {
  const db = c.db;
  const iso = new Date().toISOString();
  const out = { posts: 0, media: 0, activity: 0, decorations: false };
  if (items.includes('posts') || items.includes('all')) {
    const rows = db.prepare("SELECT * FROM posts WHERE author_id = ? AND status = 'visible' ORDER BY seq LIMIT ?").all(me, MAX_COPY);
    for (const r of rows) {
      insertWithId(db, 'posts', ['author_id', 'topic_id', 'content', 'media', 'status', 'team_id', 'created_at', 'updated_at'],
        [me, r.topic_id, r.content, r.media, r.status, teamId, iso, iso], (s) => 'PST-' + pad6(s));
      out.posts++;
    }
  }
  if (items.includes('media') || items.includes('all')) {
    const rows = db.prepare('SELECT * FROM uploads WHERE owner_id = ? ORDER BY seq LIMIT ?').all(me, MAX_COPY);
    const dir = c.config.uploadDir || '/mnt/data/uploads';
    for (const r of rows) {
      const { id } = insertWithId(db, 'uploads', ['owner_id', 'ext', 'mime', 'bytes', 'team_id', 'copy_of', 'created_at'],
        [me, r.ext, r.mime, r.bytes, teamId, r.id, iso], (s) => 'UPL-' + pad6(s));
      // 同文件对象复制到新 id（GCS FUSE 整文件写安全）；源缺失跳过文件、登记行保留（copy_of 可溯源）
      try { fs.copyFileSync(path.join(dir, r.id + '.' + r.ext), path.join(dir, id + '.' + r.ext)); }
      catch (e) { /* 测试环境无真实文件；生产源缺失=原件已清理 */ }
      out.media++;
    }
  }
  if (items.includes('activity') || items.includes('all')) {
    const rows = db.prepare("SELECT * FROM articles WHERE author_id = ? AND status = 'published' ORDER BY seq LIMIT ?").all(me, MAX_COPY);
    for (const r of rows) {
      insertWithId(db, 'articles', ['author_id', 'title', 'content_json', 'status', 'team_id', 'created_at', 'updated_at'],
        [me, r.title, r.content_json, r.status, teamId, iso, iso], (s) => 'ART-' + pad6(s));
      out.activity++;
    }
  }
  if (items.includes('decorations') || items.includes('all')) {
    const u = db.prepare('SELECT card_bg, card_plate, page_bg_image, banner_url, card_edge FROM users WHERE id = ?').get(me);
    if (u) {
      out.decorations = true;
      return { ...out, decorationsData: { cardBg: u.card_bg, cardPlate: u.card_plate, pageBgImage: u.page_bg_image, bannerUrl: u.banner_url, cardEdge: u.card_edge } };
    }
  }
  return out;
}

function register(router, ctx) {
  const db = ctx.db;

  // ── 好友清单（团队向导/群聊共用；accepted 口径）──
  router.add('GET', '/api/friends', requireSession((req, res, c) => {
    sendJson(res, 200, { friends: acceptedFriends(c.db, c.user.id) });
  }));

  // ── 我的团队（拥有+加入；种子团队无成员行自动不可见）──
  router.add('GET', '/api/teams', requireSession((req, res, c) => {
    const rows = c.db.prepare(`
      SELECT t.*, tm.role AS my_role, tm.user_id AS me
      FROM teams t JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
      ORDER BY t.seq DESC
    `).all(c.user.id);
    sendJson(res, 200, { teams: rows.map((r) => teamShape(c.db, r, r.my_role, null)) });
  }));

  // ── 一键建团（三步向导一次承载）：身份转换 + 内容搬运 + 建群聊 ──
  router.add('POST', '/api/teams', requireSession(async (req, res, c) => {
    if (!writeLimit(c)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    const body = await readJson(req, 64 * 1024);
    const me = c.user;
    const iso = new Date().toISOString();
    // ① 身份转换（是=直接使用现有横幅&头像&名称&id；个人频道保留不动，此后各自独立）
    const copyIdentity = body.copyIdentity === true;
    let name = String(body.name || '').trim();
    let avatarUrl = body.avatarUrl || null;
    let bannerUrl = body.bannerUrl || null;
    let citizenId = null;
    if (copyIdentity) {
      name = me.display_name;
      avatarUrl = me.avatar_url;
      bannerUrl = me.banner_url;
      citizenId = me.citizen_id;
    }
    if (!name || name.length > MAX_TEAM_NAME) throw new HttpError('VALIDATION', `团队名需 1-${MAX_TEAM_NAME} 字符`);
    if (avatarUrl && typeof avatarUrl !== 'string') throw new HttpError('VALIDATION', '头像地址无效');
    if (bannerUrl && typeof bannerUrl !== 'string') throw new HttpError('VALIDATION', '横幅地址无效');
    const items = Array.isArray(body.copyItems) ? body.copyItems.filter((x) => typeof x === 'string') : [];
    const color = String(body.avatarColor || '#4648d4');
    // ③ 群聊（可选）：拉的好友=成员+群成员，受成员上限约束
    const chat = body.chat && typeof body.chat === 'object' ? body.chat : null;
    let invitees = [];
    if (chat) {
      invitees = checkInvitees(c.db, me.id, Array.isArray(chat.memberIds) ? chat.memberIds : []);
      if (invitees.length + 1 > capOf(c.db, me.id)) throw new HttpError('TEAM_FULL', '成员超出上限，请先扩容');
    }
    const cap = capOf(c.db, me.id);
    const teamData = {
      id: '', name, avatar: name.replace(/\s+/g, '').substring(0, 2).toUpperCase(), color,
      role: 'owner', members: invitees.length + 1, nations: [],
      ownerId: me.id, createdAt: iso,
      avatarUrl, bannerUrl, citizenId,
      decorations: {}
    };
    // teams.id 为 NOT NULL UNIQUE（005 建表口径）——insertWithId 依赖 id 可空回写，先插临时唯一 id 再按 seq 覆写
    const tmpId = 'TMP-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const { id } = insertWithId(c.db, 'teams', ['id', 'data', 'created_at'], [tmpId, JSON.stringify(teamData), iso], (s) => 'TEAM-' + pad6(s));
    teamData.id = id;
    c.db.prepare('UPDATE teams SET data = ? WHERE id = ?').run(JSON.stringify(teamData), id);
    c.db.prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").run(id, me.id, iso);
    // ② 内容搬运（只搬数据不搬频道；点赞收藏私人数据不搬）
    const copied = copyContent(c, id, me.id, items);
    const decorations = copied.decorationsData;
    if (decorations) {
      teamData.decorations = decorations;
      c.db.prepare('UPDATE teams SET data = ? WHERE id = ?').run(JSON.stringify(teamData), id);
    }
    // 建群聊（conversations kind='group' + name + N 成员）
    let chatOut = null;
    if (chat) {
      const chatName = String(chat.name || '').trim();
      if (!chatName || chatName.length > MAX_CHAT_NAME) throw new HttpError('VALIDATION', `群聊名需 1-${MAX_CHAT_NAME} 字符`);
      const { id: cid } = insertWithId(c.db, 'conversations', ['kind', 'name', 'created_at'], ['group', chatName, iso], (s) => 'CONV-' + pad6(s));
      const ins = c.db.prepare("INSERT INTO conversation_members (conversation_id, actor_type, actor_id, last_read_at, joined_at) VALUES (?, 'user', ?, ?, ?)");
      ins.run(cid, me.id, iso, iso);
      for (const uid of invitees) {
        ins.run(cid, uid, null, iso);
        c.db.prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)").run(id, uid, iso);
      }
      chatOut = { id: cid, kind: 'group', name: chatName };
    }
    const fresh = c.db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    sendJson(res, 200, {
      team: teamShape(c.db, fresh, 'owner', me.id),
      copied: { posts: copied.posts, media: copied.media, activity: copied.activity, decorations: !!decorations },
      chat: chatOut, cap
    });
  }));

  // ── 团队详情（成员可见；含装饰与上限）──
  router.add('GET', '/api/teams/:id', requireSession((req, res, c) => {
    const row = c.db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!row) throw new HttpError('NOT_FOUND', '团队不存在');
    const mine = requireTeamMember(c.db, row.id, c.user.id);
    const d = parseJson(row.data) || {};
    sendJson(res, 200, { team: teamShape(c.db, row, mine.role, d.ownerId || c.user.id) });
  }));

  // ── 成员列表 ──
  router.add('GET', '/api/teams/:id/members', requireSession((req, res, c) => {
    requireTeamMember(c.db, req.params.id, c.user.id);
    const rows = c.db.prepare(`
      SELECT tm.user_id, tm.role, tm.joined_at, u.display_name, u.avatar_url, u.citizen_id
      FROM team_members tm JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ? ORDER BY tm.joined_at
    `).all(req.params.id);
    sendJson(res, 200, {
      members: rows.map((r) => ({
        userId: r.user_id, displayName: r.display_name, avatarUrl: r.avatar_url, citizenId: r.citizen_id,
        role: r.role, joinedAt: r.joined_at
      }))
    });
  }));

  // ── 加人（队长；限好友；上限校验）──
  router.add('POST', '/api/teams/:id/members', requireSession(async (req, res, c) => {
    if (!writeLimit(c)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    const team = c.db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) throw new HttpError('NOT_FOUND', '团队不存在');
    requireOwner(c.db, team.id, c.user.id);
    const body = await readJson(req, 16 * 1024);
    const uid = String(body.userId || '');
    if (!uid) throw new HttpError('VALIDATION', '缺少成员 id');
    if (c.db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(team.id, uid)) {
      throw new HttpError('CONFLICT', '该成员已在团队中');
    }
    const [okId] = checkInvitees(c.db, c.user.id, [uid]);
    const d = parseJson(team.data) || {};
    if (memberCountOf(c.db, team.id) + 1 > capOf(c.db, d.ownerId || c.user.id)) {
      throw new HttpError('TEAM_FULL', '成员已满，请先扩容');
    }
    c.db.prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)")
      .run(team.id, okId, new Date().toISOString());
    sendJson(res, 200, { added: { userId: okId }, memberCount: memberCountOf(c.db, team.id) });
  }));

  // ── 移出/退出（队长移出成员；成员可自行退出；队长不可退出）──
  router.add('DELETE', '/api/teams/:id/members/:uid', requireSession((req, res, c) => {
    const team = c.db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) throw new HttpError('NOT_FOUND', '团队不存在');
    const mine = requireTeamMember(c.db, team.id, c.user.id);
    const target = c.db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?').get(team.id, req.params.uid);
    if (!target) throw new HttpError('NOT_FOUND', '该成员不在团队中');
    if (target.role === 'owner') throw new HttpError('VALIDATION', '队长不能退出团队');
    if (mine.role !== 'owner' && req.params.uid !== c.user.id) throw new HttpError('FORBIDDEN', '仅队长可移出成员');
    c.db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(team.id, req.params.uid);
    sendJson(res, 200, { removed: { userId: req.params.uid }, memberCount: memberCountOf(c.db, team.id) });
  }));
}

module.exports = { register };
