-- 005_social_content — 社交内容（§6 Content / §7 Community）
-- nations/topics/teams/following/posts/team_members：v1 001 原样（data 完整 JSON 镜像 SlatiDB，前端零适配）
-- 新增（D6，公网新端点全部是加法）：comments（CMT-）/wikis（WKI-）/content_likes/favorites/shares
-- conversations：kind 加 'support'（§16 人工对话绑定工单）+ ticket_id；
--   conversation_members + actor_type user|staff（staff 不在 users 表，actor_id 多态无 FK——D4）；
--   messages + sender_type user|staff（sender_id 多态）。

CREATE TABLE nations (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT UNIQUE,                            -- NAT-xxxxxx
  owner_id   TEXT REFERENCES users(id),
  data       TEXT NOT NULL,                          -- JSON：与 slati_nations 元素同形状
  status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_nations_owner ON nations(owner_id);

CREATE TABLE topics (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT UNIQUE,                            -- TOP-xxxxxx
  creator_id TEXT REFERENCES users(id),
  data       TEXT NOT NULL,                          -- JSON：与 slati_topics 元素同形状
  status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE teams (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,                   -- 一期只读 + 种子
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE following (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('user','nation','topic','team')),
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE posts (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT UNIQUE,                            -- PST-xxxxxx
  author_id  TEXT NOT NULL REFERENCES users(id),
  topic_id   TEXT REFERENCES topics(id),
  content    TEXT NOT NULL,
  media      TEXT NOT NULL DEFAULT '[]',             -- JSON 数组 ≤3 项
  status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('pending','visible','hidden','removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_posts_status ON posts(status, created_at);
CREATE INDEX idx_posts_author ON posts(author_id);

CREATE TABLE team_members (
  team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

-- ── 评论（§6）：一层回复（parent_id 自引用只允许一级，杜绝深链）──
CREATE TABLE comments (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT UNIQUE,                            -- CMT-xxxxxx
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id),
  parent_id  TEXT REFERENCES comments(id),           -- 回复某条评论；NULL = 直接评帖
  content    TEXT NOT NULL,                          -- ≤2000 字（写入层校验）
  status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_comments_post ON comments(post_id, created_at);

-- ── 维基（§7 国家共建百科）──
CREATE TABLE wikis (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT UNIQUE,                          -- WKI-xxxxxx
  nation_id    TEXT NOT NULL REFERENCES nations(id) ON DELETE CASCADE,
  author_id    TEXT NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL,
  content_json TEXT NOT NULL,                        -- Notion 风格块 JSON（与编辑器同形状）
  status       TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_wikis_nation ON wikis(nation_id, updated_at);

-- ── 互动（§6/§7 计数，与目标行事务同步）──
CREATE TABLE content_likes (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,                         -- post/article/comment/wiki/nation/topic
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);
CREATE INDEX idx_likes_target ON content_likes(target_type, target_id);

CREATE TABLE favorites (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,                         -- post/article/nation/topic
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE shares (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,                         -- post/article/nation
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);

-- ═══ 私讯（明文 + 参与者 ACL；审核管线绝不触碰本区；staff 调阅强制审计）═══

CREATE TABLE conversations (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT UNIQUE,                            -- CONV-xxxxxx
  kind       TEXT NOT NULL DEFAULT 'dm' CHECK (kind IN ('dm','group','support')),
  ticket_id  TEXT,                                   -- kind='support' 时绑定的工单（§16）
  created_at TEXT NOT NULL
);

CREATE TABLE conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('user','staff')),
  actor_id        TEXT NOT NULL,                     -- 多态：users.id / staff.id（无 FK）
  last_read_at    TEXT,                              -- 已读位置（unread 按 seq 比较）
  joined_at       TEXT NOT NULL,
  PRIMARY KEY (conversation_id, actor_type, actor_id)
);
CREATE INDEX idx_conv_members_actor ON conversation_members(actor_type, actor_id);

CREATE TABLE messages (
  seq               INTEGER PRIMARY KEY AUTOINCREMENT,
  id                TEXT UNIQUE,                     -- MSG-xxxxxx
  conversation_id   TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type       TEXT NOT NULL DEFAULT 'user' CHECK (sender_type IN ('user','staff')),
  sender_id         TEXT NOT NULL,                   -- 多态：users.id / staff.id（无 FK）
  content           TEXT NOT NULL,                   -- ≤4000 字（写入层校验）
  created_at        TEXT NOT NULL,
  sender_deleted_at TEXT                            -- 发送者删除（仅自己不可见）
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, seq);
