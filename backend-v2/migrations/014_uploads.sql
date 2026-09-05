-- 014_uploads — v0.2.16.0 Community 帖子多图/视频附件（2026-09-05 用户「Post 会展示该post的多个图片/视频」）：
-- 上传文件存 GCS FUSE 挂载盘（UPLOADS_DIR，默认 /mnt/data/uploads），本表只记元数据（属主/扩展名/字节数），
-- 与 posts.media 的 URL 字符串（'/uploads/UPL-xxxxxx.<ext>'）解耦——快照只搬 sqlite，媒体文件靠挂载盘跨实例持久。
CREATE TABLE uploads (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT UNIQUE,                            -- UPL-xxxxxx
  owner_id   TEXT NOT NULL REFERENCES users(id),
  ext        TEXT NOT NULL,                          -- jpg/jpeg/png/gif/webp/mp4/webm/mov（上传端点白名单）
  mime       TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_uploads_owner ON uploads(owner_id);
