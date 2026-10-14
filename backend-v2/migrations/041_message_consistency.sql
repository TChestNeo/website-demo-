-- 041_message_consistency — 云消息删除、转发来源与每用户置顶持久化
-- 删除沿用 messages.sender_deleted_at 软删列，但读侧从本迁移后的代码起对所有成员隐藏。
-- 转发保存内容快照，同时保留原消息/原发送者来源；置顶是每用户、每会话的私有设置。

ALTER TABLE messages ADD COLUMN forwarded_from_message_id TEXT;
ALTER TABLE messages ADD COLUMN forwarded_from_sender_id TEXT;
ALTER TABLE messages ADD COLUMN forwarded_from_sender_name TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_messages_forwarded_from ON messages(forwarded_from_message_id);

CREATE TABLE message_pins (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id       TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at        TEXT NOT NULL,
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX idx_message_pins_conversation_user
  ON message_pins(conversation_id, user_id, pinned_at DESC);
