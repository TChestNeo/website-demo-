-- 010_analytics：分析数据面（D9 读时聚合的唯二事实表）。
--   activity_daily：DAU/WAU/MAU/留存源。鉴权中间件每请求 upsert（requests 计数）。
--   page_views：公网访问流水（POST /api/analytics/pageview；country 由 GEOIP_URL 可选解析，D10）。
-- 附加：security_events 补 flagged 三列（W2 security 路由的 flag 操作，增量 ALTER 不破坏幂等）。
CREATE TABLE activity_daily (
  user_id TEXT NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,            -- YYYY-MM-DD（UTC）
  requests INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE page_views (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE,
  client_id TEXT,
  path TEXT NOT NULL,
  referer TEXT,
  country TEXT,
  language TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  created_at TEXT NOT NULL
);

ALTER TABLE security_events ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE security_events ADD COLUMN flagged_by TEXT;
ALTER TABLE security_events ADD COLUMN flagged_at TEXT;
