-- 013_users_gender — v0.2.11.0 用户性别记录（2026-09-03 用户「在后端做一下用户性别的记录，然后在用户资料里也单独显示」）：
-- users 加 gender。取值 Male/Female/Other（与注册第二页下拉逐字一致），路由层校验（同 dob 模式，见 auth.js PATCH /me）；
-- 历史用户 NULL = 未填写。
ALTER TABLE users ADD COLUMN gender TEXT;
