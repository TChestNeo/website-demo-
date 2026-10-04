'use strict';
// 等级奖励（FC v10.28.52.0）：成就/徽章/装饰品（纯装饰性，claim 幂等 INSERT OR IGNORE）。
// 个人 claim 信任客户端 lv（个人 XP 双轨：动作 XP 在客户端 localStorage，服务端无从完整校验——
//   装饰性可接受，changelog 注明；滥用影响仅装饰）；团队 claim 校验 teams.xp_gained 对团队阈值
//   （团队 XP 五事件全服务端记账，可完整校验）+ 成员门。
// 团队阈值 = 个人 LEVELS ×1.5（用户钦定 0/1200/…/1228800 → 0/1800/…/1843200）；
// 团队 XP 双向对称扣回见 social/articles/teams 钩子（team-xp.js）。
const { HttpError, sendJson, readJson } = require('../../http');
const { requireSession } = require('../../middleware/auth');

// 团队等级阈值（个人 ×1.5，Lv1-12）
const TEAM_LEVELS = [0, 1800, 3600, 7200, 14400, 28800, 57600, 115200, 230400, 460800, 921600, 1843200];

// 奖励表（等级 → 成就/徽章/装饰品；徽章授予=本人行，团队徽章授予 claim 发起人）
// 个人 L2：成就+勋章+新手相框+免费名片边缘解锁；L6：成就+徽章+称号；L9：成就；L12：成就+徽章+冠军相框。
// 团队 L2/L6/L9/L12：成就+徽章（徽章名照用户原文逐字，前端 i18n 逐字表）。
const USER_REWARDS = {
  2: { ach: 'ACH-user-2', badges: ['BADGE-user-2'], cosmetics: [['frame', 'rookie-frame'], ['edge', 'free-edge']] },
  6: { ach: 'ACH-user-6', badges: ['BADGE-user-6'], cosmetics: [['title', 'veteran-title']] },
  9: { ach: 'ACH-user-9', badges: [], cosmetics: [] },
  12: { ach: 'ACH-user-12', badges: ['BADGE-user-12'], cosmetics: [['frame', 'champion-frame']] },
};
const TEAM_REWARDS = {
  2: { ach: 'ACH-team-2', badges: ['BADGE-team-2'] },
  6: { ach: 'ACH-team-6', badges: ['BADGE-team-6'] },
  9: { ach: 'ACH-team-9', badges: ['BADGE-team-9'] },
  12: { ach: 'ACH-team-12', badges: ['BADGE-team-12'] },
};

function teamLevelOf(xp) {
  let lv = 1;
  for (let i = 0; i < TEAM_LEVELS.length; i++) {
    if (xp >= TEAM_LEVELS[i]) lv = i + 1;
  }
  return lv;
}

function register(router, ctx) {
  // ── 领奖（幂等；user 信任 lv / team 校验阈值+成员）──
  router.add('POST', '/api/rewards/claim', requireSession(async (req, res, c) => {
    const body = await readJson(req, 16 * 1024);
    const scope = body.scope === 'team' ? 'team' : 'user';
    const lv = parseInt(body.lv, 10);
    const iso = new Date().toISOString();

    if (scope === 'user') {
      const reward = USER_REWARDS[lv];
      if (!reward) throw new HttpError('VALIDATION', '等级不在奖励表内');
      c.db.transaction(() => {
        c.db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, ach_id, unlocked_at) VALUES (?, ?, ?)')
          .run(c.user.id, reward.ach, iso);
        for (const b of reward.badges) {
          c.db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id, owned_at) VALUES (?, ?, ?)')
            .run(c.user.id, b, iso);
        }
        for (const [kind, value] of reward.cosmetics) {
          c.db.prepare('INSERT OR IGNORE INTO user_cosmetics (user_id, kind, value, owned_at) VALUES (?, ?, ?, ?)')
            .run(c.user.id, kind, value, iso);
        }
      })();
      sendJson(res, 200, { claimed: { scope: 'user', lv, ach: reward.ach } });
      return;
    }

    const teamId = String(body.teamId || '');
    if (!teamId) throw new HttpError('VALIDATION', '缺少团队 id');
    const team = c.db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
    if (!team) throw new HttpError('NOT_FOUND', '团队不存在');
    if (!c.db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, c.user.id)) {
      throw new HttpError('FORBIDDEN', '你不是该团队成员');
    }
    const reward = TEAM_REWARDS[lv];
    if (!reward) throw new HttpError('VALIDATION', '等级不在奖励表内');
    const xp = team.xp_gained || 0;
    if (xp < TEAM_LEVELS[lv - 1]) throw new HttpError('VALIDATION', '团队等级未达到');
    c.db.transaction(() => {
      c.db.prepare('INSERT OR IGNORE INTO team_achievements (team_id, ach_id, unlocked_at) VALUES (?, ?, ?)')
        .run(teamId, reward.ach, iso);
      for (const b of reward.badges) {
        c.db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id, owned_at) VALUES (?, ?, ?)')
          .run(c.user.id, b, iso);
      }
    })();
    sendJson(res, 200, { claimed: { scope: 'team', teamId, lv, ach: reward.ach } });
  }));

  // ── 我的奖励清单（成就/徽章/装饰品 + 免费边缘解锁旗）──
  router.add('GET', '/api/rewards/me', requireSession((req, res, c) => {
    const ach = c.db.prepare(`
      SELECT a.id, a.scope, a.name, a.description, a.level, ua.unlocked_at
      FROM user_achievements ua JOIN achievements a ON a.id = ua.ach_id
      WHERE ua.user_id = ? ORDER BY a.level, a.scope
    `).all(c.user.id);
    const badges = c.db.prepare('SELECT badge_id, owned_at FROM user_badges WHERE user_id = ? ORDER BY owned_at')
      .all(c.user.id);
    const cosmetics = c.db.prepare('SELECT kind, value, owned_at FROM user_cosmetics WHERE user_id = ? ORDER BY owned_at')
      .all(c.user.id);
    sendJson(res, 200, {
      achievements: ach.map((r) => ({
        id: r.id, scope: r.scope, name: r.name, description: r.description, level: r.level, unlockedAt: r.unlocked_at
      })),
      badges: badges.map((r) => ({ id: r.badge_id, ownedAt: r.owned_at })),
      cosmetics: cosmetics.map((r) => ({ kind: r.kind, value: r.value, ownedAt: r.owned_at })),
      edgeUnlocked: cosmetics.some((r) => r.kind === 'edge' && r.value === 'free-edge'),
    });
  }));

  // ── 团队奖励（XP/等级/成就；成员可见）──
  router.add('GET', '/api/teams/:id/rewards', requireSession((req, res, c) => {
    const team = c.db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) throw new HttpError('NOT_FOUND', '团队不存在');
    if (!c.db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(team.id, c.user.id)) {
      throw new HttpError('FORBIDDEN', '你不是该团队成员');
    }
    const xp = team.xp_gained || 0;
    const ach = c.db.prepare(`
      SELECT a.id, a.name, a.description, a.level, ta.unlocked_at
      FROM team_achievements ta JOIN achievements a ON a.id = ta.ach_id
      WHERE ta.team_id = ? ORDER BY a.level
    `).all(team.id);
    sendJson(res, 200, {
      xpGained: xp,
      level: teamLevelOf(xp),
      levels: TEAM_LEVELS,
      achievements: ach.map((r) => ({
        id: r.id, name: r.name, description: r.description, level: r.level, unlockedAt: r.unlocked_at
      })),
    });
  }));
}

module.exports = { register, TEAM_LEVELS, teamLevelOf };
