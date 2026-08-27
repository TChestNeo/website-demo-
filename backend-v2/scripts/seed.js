'use strict';
// 首位 staff（project_director）+ 演示 staff（§21：Neo 项目总监 / Alex 客服 / Daniel 财务&支持）。
//   node --env-file-if-exists=.env scripts/seed.js（或 npm run seed）
// ADMIN_EMAIL 必配：据此建 director；SEED_DEMO_STAFF !== 'false'（且非生产）建 Alex/Daniel。
// 幂等：按邮箱已存在则不重复建（已建行补角色不重置）。

const config = require('../src/config');
const { openDb } = require('../src/db');
const { createStaff, assignRole } = require('../src/middleware/staff-auth');

const db = openDb(config.databasePath);

function ensureStaff(email, displayName, roleIds, extra = {}) {
  const existing = db.prepare('SELECT * FROM staff WHERE email = ?').get(email);
  if (existing) {
    for (const r of roleIds) assignRole(db, existing.id, r);
    console.log(`staff 已存在: ${existing.id} ${existing.email} (${displayName})`);
    return existing;
  }
  const row = createStaff(db, { email, displayName, ...extra });
  for (const r of roleIds) assignRole(db, row.id, r);
  console.log(`staff 已创建: ${row.id} ${row.email} (${displayName})`);
  return row;
}

if (!config.adminEmail) {
  console.error('未配置 ADMIN_EMAIL：project_director 无法建立。在 backend-v2/.env 设置 ADMIN_EMAIL= 后重跑。');
  process.exit(1);
}

ensureStaff(config.adminEmail, 'Neo', ['project_director'], {
  position: '项目总监',
  alias: 'Neo',
  realName: null,
  timezone: 'UTC+8',
  languages: '["zh","en"]'
});

if (config.seedDemoStaff && config.nodeEnv !== 'production') {
  ensureStaff('alex@slatiworld.local', 'Alex', ['customer_support'], {
    position: '客户支持',
    alias: 'Alex',
    timezone: 'UTC+8',
    languages: '["zh","en","ms"]'
  });
  ensureStaff('daniel@slatiworld.local', 'Daniel', ['finance', 'customer_support'], {
    position: '财务与支持',
    alias: 'Daniel',
    timezone: 'UTC+8',
    languages: '["zh","en"]'
  });
}

console.log('seed 完成。');
