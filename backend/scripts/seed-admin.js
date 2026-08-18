'use strict';
// seed-admin.js（P9）：按 .env 的 ADMIN_EMAIL 把既有用户升级为管理员（部署清单步骤）。
// 用法：npm run seed —— 前置：该邮箱已注册账号；adminEmail 未配置或用户不存在 → exit 1。
// 幂等：已是 admin 直接报告。审计由 P9 端点落库，此处属部署引导不写审计。

const config = require('../src/config');
const { openDb } = require('../src/db');

if (!config.adminEmail) {
  console.error('seed-admin: ADMIN_EMAIL 未配置（.env 缺失？）');
  process.exit(1);
}

const db = openDb(config.databasePath);
const user = db.prepare('SELECT * FROM users WHERE email = ?').get(config.adminEmail);
if (!user) {
  console.error(`seed-admin: 用户 ${config.adminEmail} 不存在——请先完成注册（邮箱验证码登录）再执行。`);
  process.exit(1);
}

if (user.role === 'admin') {
  console.log(`seed-admin: ${user.email}（${user.id}）已是管理员，无需操作。`);
} else {
  db.prepare("UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), user.id);
  console.log(`seed-admin: ${user.email}（${user.id}）已升级为管理员。`);
}
db.close();
