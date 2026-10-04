'use strict';
// 团队 XP 记账（FC v10.28.52.0）：五事件双向对称——上传作品 24/获赞 16/粉丝 32/收藏 36/分享转发 20。
// 正向=事件发生 +n（gainTeamXp）；反向=取消/删除 -n（loseTeamXp，MAX(0) 不穿负）。
// 个人 XP（users.xp_gained）只进不出不动；数值表 config.xp.teamGained（未配置=不记，防 config 缺块崩路由）。
// 钩子：social.js（发帖 teamId/赞/收藏/转发）、articles.js（发布 teamId/删除）、teams.js（关注/取关）。

function xpOf(c, key) {
  const n = (((c.config || {}).xp || {}).teamGained || {})[key];
  return n || 0;
}

function gainTeamXp(c, teamId, key) {
  const n = xpOf(c, key);
  if (!teamId || !n) return;
  c.db.prepare('UPDATE teams SET xp_gained = xp_gained + ? WHERE id = ?').run(n, teamId);
}

function loseTeamXp(c, teamId, key) {
  const n = xpOf(c, key);
  if (!teamId || !n) return;
  c.db.prepare('UPDATE teams SET xp_gained = MAX(0, xp_gained - ?) WHERE id = ?').run(n, teamId);
}

module.exports = { gainTeamXp, loseTeamXp };
