-- 002（P9 管理端）：moderation_decisions 支持「无审核项的直接处罚」与「按用户查处罚历史」
--   item_id 可空：管理端直接处罚（POST /api/admin/penalties）没有对应 moderation_item
--   user_id 新列：处罚历史时间线索引（applyDecision 落库；存量行按 item → target → owner 回填）

CREATE TABLE moderation_decisions_new (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     TEXT REFERENCES moderation_items(id),   -- NULL = 管理端直接处罚
  user_id     TEXT REFERENCES users(id),              -- 被处罚用户（时间线查询）
  action      TEXT NOT NULL CHECK (action IN ('warn','remove_content','rate_limit','mute','ban','restore')),
  actor       TEXT NOT NULL,                          -- system / ai / admin:email
  reason_code TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL
);

INSERT INTO moderation_decisions_new (seq, item_id, action, actor, reason_code, notes, created_at)
  SELECT seq, item_id, action, actor, reason_code, notes, created_at FROM moderation_decisions;

-- 存量回填：item → target → owner/author/user
UPDATE moderation_decisions_new SET user_id =
  (SELECT CASE
     WHEN mi.target_type = 'post'    THEN (SELECT author_id   FROM posts    WHERE id = mi.target_id)
     WHEN mi.target_type = 'article' THEN (SELECT author_id   FROM articles WHERE id = mi.target_id)
     WHEN mi.target_type = 'nation'  THEN (SELECT owner_id    FROM nations  WHERE id = mi.target_id)
     WHEN mi.target_type = 'topic'   THEN (SELECT creator_id  FROM topics   WHERE id = mi.target_id)
     WHEN mi.target_type = 'user'    THEN mi.target_id
   END
   FROM moderation_items mi WHERE mi.id = moderation_decisions_new.item_id);

DROP TABLE moderation_decisions;
ALTER TABLE moderation_decisions_new RENAME TO moderation_decisions;
CREATE INDEX idx_mod_decisions_item ON moderation_decisions(item_id);
CREATE INDEX idx_mod_decisions_user ON moderation_decisions(user_id, created_at);
