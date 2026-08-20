-- 006_basic_not_builtin.sql — Basic 不是自带：存量 basic 全部落回 free（用户口径 2026-08-20）
-- 背景：005 曾「存量保留」——迁移前已有的 Basic 用户原样不动。用户随后明确：Basic 属于
-- 三个订阅项（Basic / Premium / Ultra）之一，不是自带的——未订阅即拥有的 basic 一律降回 free。
-- Basic 此后只能通过两条路径获得：Stripe 订阅/单次购买（checkout 事件开通），或管理员 PATCH 授予。
-- 说明：静默降级不写 set_tier 审计（迁移级数据修正，不计财务事件）；admin 侧存量 Basic
-- 升级事件的减负 guard（重放自 0 起步）继续兜底财报重放。
-- 适用性：开发库当前所有 basic 均非订阅所得；生产部署时本迁移先于任何真实订阅执行，同样成立。
UPDATE users SET tier = 'free', tier_expires_at = NULL WHERE tier = 'basic';
