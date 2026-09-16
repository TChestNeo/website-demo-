-- 024_subscriptions_open — 订阅开放开关（官方开发者测试通道；无新表 → health 58 不变）
-- false 时公开结账关闭（webhook/portal/status 不受影响，存量订阅照常扣款续费）
-- 运行时切换由 staff 端点写本键（subscriptions.manage / director 全键），即时生效不重启
INSERT OR IGNORE INTO platform_settings (key, value, type, description, updated_at)
VALUES ('subscriptions.open', 'true', 'boolean', '订阅开放开关：false 时公开结账关闭（官方开发者测试通道；仅订阅管理权限可切换）', '2026-09-17T00:00:00.000Z');
