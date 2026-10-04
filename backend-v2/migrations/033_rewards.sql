-- 033_rewards — 等级奖励（FC v10.28.52.0）
-- 用户钦定（2026-10-04）团队 XP 五事件数值表：上传一个作品 24 / 获得一个赞 16 / 一个粉丝 32 /
--   一个收藏 36 / 一个分享/转发 20；「少一个就收走」=双向对称扣回（取消赞/取消收藏/取关/撤销转发/
--   删除作品同额扣，MAX(0) 不穿负）——钩子见 social/articles/teams + team-xp.js。
-- 成就/徽章/装饰品=纯装饰性奖励（claim 幂等 INSERT OR IGNORE；个人 XP 只进不出不动）。
-- 团队阈值 = 个人 LEVELS ×1.5（0/1200/…/1228800 → 0/1800/…/1843200）。
-- 新表 5（achievements/user_achievements/team_achievements/user_badges/user_cosmetics）→ health 61→66；
-- teams.xp_gained = 团队经验列；users.avatar_frame/title = 装饰品激活态列。
-- user_version 32 → 33。
ALTER TABLE teams ADD COLUMN xp_gained INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN avatar_frame TEXT;
ALTER TABLE users ADD COLUMN title TEXT;

-- 成就定义表（种子=用户原文逐字；scope user/team 各 2/6/9/12 四级）
CREATE TABLE achievements (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  id          TEXT NOT NULL UNIQUE,                  -- ACH-user-2 / ACH-team-2 …
  scope       TEXT NOT NULL CHECK (scope IN ('user','team')),
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  level       INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);

-- 个人成就解锁记录（幂等：PK 去重）
CREATE TABLE user_achievements (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ach_id      TEXT NOT NULL REFERENCES achievements(id),
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, ach_id)
);

-- 团队成就解锁记录（一团队一次；团队徽章授予 claim 发起人 → user_badges）
CREATE TABLE team_achievements (
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  ach_id      TEXT NOT NULL REFERENCES achievements(id),
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (team_id, ach_id)
);

-- 徽章（含团队徽章；badge_id 稳定编码，名称走前端 i18n 逐字表）
CREATE TABLE user_badges (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  owned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);

-- 装饰品：相框/名片边缘解锁/称号（value 稳定编码；active 态=users.avatar_frame/title 列）
CREATE TABLE user_cosmetics (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind     TEXT NOT NULL CHECK (kind IN ('frame','edge','title')),
  value    TEXT NOT NULL,
  owned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kind, value)
);

-- 成就种子（8 条：个人 2/6/9/12 + 团队 2/6/9/12；名称=用户原文逐字）
INSERT INTO achievements (id, scope, name, description, level, created_at) VALUES
  ('ACH-user-2',  'user', '官方对你的认可',   '个人等级达到 Lv.2',  2,  '2026-10-04T00:00:00.000Z'),
  ('ACH-user-6',  'user', '恭喜你成为老玩家', '个人等级达到 Lv.6',  6,  '2026-10-04T00:00:00.000Z'),
  ('ACH-user-9',  'user', '我是五星上将！',   '个人等级达到 Lv.9',  9,  '2026-10-04T00:00:00.000Z'),
  ('ACH-user-12', 'user', '我是冠军！',       '个人等级达到 Lv.12', 12, '2026-10-04T00:00:00.000Z'),
  ('ACH-team-2',  'team', '新国崛起！',       '团队等级达到 Lv.2',  2,  '2026-10-04T00:00:00.000Z'),
  ('ACH-team-6',  'team', '老了',             '团队等级达到 Lv.6',  6,  '2026-10-04T00:00:00.000Z'),
  ('ACH-team-9',  'team', '鼎世春秋',         '团队等级达到 Lv.9',  9,  '2026-10-04T00:00:00.000Z'),
  ('ACH-team-12', 'team', '我是一个空气',     '团队等级达到 Lv.12', 12, '2026-10-04T00:00:00.000Z');
