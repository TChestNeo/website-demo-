-- 031_fc_edges — FC 自定义边缘仓库（FC v10.28.50.0）
-- 用户「…AI 生成边缘…上传到仓库的部分可以选择公开/团队/好友/私人」：
-- 边缘/边框的 AI 产物入库共享——平台首个可见性模型（visibility 四值，GET 按 optionalViewer 过滤）。
-- kind=edge|border；clip=AI 输出 polygon()（服务端 sanitizeClip 白名单校验后才入库，CSS 注入防线）。
-- 好友集 = friend_requests status='accepted'；团队集 = team_members 我所在团的成员（团队频道后续版本起有数据，
-- 表已存在零代码——fc-edges.js 提前消费，无数据即空集）。
-- +1 表 health 60→61；user_version 30 → 31。
CREATE TABLE fc_edges (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  id          TEXT UNIQUE,                             -- EDG-xxxxxx（insertWithId 回写）
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('edge','border')),
  clip        TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','team','friends','private')),
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_fc_edges_owner ON fc_edges(owner_id);
CREATE INDEX idx_fc_edges_visibility ON fc_edges(visibility);

-- usage_log 重建扩 feature 'edgeGen'（021 email_codes 同款 rename-建新-拷贝-删旧；无外键引用安全）——
-- Gemini 边缘生成的预算记账行 feature='edgeGen' 否则 007 CHECK 拒插。
ALTER TABLE usage_log RENAME TO usage_log_old;
CREATE TABLE usage_log (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  feature        TEXT NOT NULL CHECK (feature IN ('moderation_text','moderation_image','chat','chat_faq_hit','copilot','edgeGen')),
  tokens_in      INTEGER NOT NULL DEFAULT 0,
  tokens_out     INTEGER NOT NULL DEFAULT 0,
  tokens_cached  INTEGER NOT NULL DEFAULT 0,
  price_snapshot TEXT NOT NULL,                      -- JSON：调用时刻峰谷单价快照
  cost_micro     INTEGER NOT NULL DEFAULT 0,         -- 整数微元
  batch_id       TEXT,
  latency_ms     INTEGER,
  status         TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error','unconfigured')),
  provider       TEXT,                               -- deepseek / tencent-ims / gemini / （unconfigured 时 NULL）
  created_at     TEXT NOT NULL                       -- 不记录任何用户内容文本
);
INSERT INTO usage_log SELECT seq, feature, tokens_in, tokens_out, tokens_cached, price_snapshot, cost_micro, batch_id, latency_ms, status, provider, created_at FROM usage_log_old;
DROP TABLE usage_log_old;
CREATE INDEX idx_usage_feature ON usage_log(feature, created_at);
