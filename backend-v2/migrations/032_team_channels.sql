-- 032_team_channels — 团队频道（FC v10.28.51.0）
-- 用户「把团队频道体系做出来」：三步向导一键建团（①身份转换 ②内容搬运 ③建群聊）；
-- teams/team_members 表自 005 已有（一期只读种子 social.js TEAM_SEED）——本轮写路径复活，无新表 health 恒 61。
-- 搬运=只搬数据不搬频道（个人频道保留、私人点赞收藏恒留个人）：
--   贴文 posts → 新行 team_id=新团（原件不动）；视频&贴图 uploads → 新行 copy_of=原件（同文件对象，服务端
--   fs 复制到新 id）；动态=已发布文章 articles → 新行 team_id=新团（口径：平台动态页 KPI 的文章实体）；
--   主页装饰 → 拷入 teams.data JSON（decorations 字段），零新列。
-- 成员上限：标配 3（owner+2）、扩容订阅项 slots-* 增至 8/16/26/∞（users.team_cap_addon + team_cap_expires_at，
--   Stripe 支付成功后由 webhook 写入；有效期内生效，过期回落 3）。
-- 群聊：conversations.kind 已含 'group'（005），本轮补 name 列；成员=conversation_members 多成员（服务端校验好友）。
-- user_version 31 → 32；表数恒 61（列级迁移 + pricing_plans 四 SKU 插行）。
ALTER TABLE conversations ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN team_cap_addon TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN team_cap_expires_at TEXT;
ALTER TABLE posts ADD COLUMN team_id TEXT;
ALTER TABLE articles ADD COLUMN team_id TEXT;
ALTER TABLE uploads ADD COLUMN team_id TEXT;
ALTER TABLE uploads ADD COLUMN copy_of TEXT;
CREATE INDEX idx_posts_team ON posts(team_id);
CREATE INDEX idx_articles_team ON articles(team_id);
CREATE INDEX idx_uploads_team ON uploads(team_id);

-- 扩容订阅 SKU（与 premium.html Team Slots 占位卡 data-addon-cta 同名接通；结算走 once 通道一次性支付 1 个月）
INSERT OR IGNORE INTO pricing_plans (plan_key, name, description, created_at, updated_at) VALUES
  ('slots-basic',   'Team Slots — Basic',   '团队成员上限增至 8',   '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('slots-plus',    'Team Slots — Plus',    '团队成员上限增至 16',  '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('slots-premium', 'Team Slots — Premium', '团队成员上限增至 26',  '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('slots-ultra',   'Team Slots — Ultra',   '团队成员上限无限',      '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z');
