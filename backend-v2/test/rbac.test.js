'use strict';
// RBAC（§24）：staffPermissions 矩阵、director 全键、多角色并集、requirePerm 拒绝审计 denied。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');
const { staffPermissions, requirePerm } = require('../src/middleware/staff-auth');

test('staffPermissions：客服矩阵 / director 全键 / 多角色并集', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const cs = a.seedStaff({ email: 'cs@x.y' }, ['customer_support']).id;
  const perms = staffPermissions(a.db, cs);
  assert.ok(perms.includes('cs.tickets.reply'));
  assert.ok(perms.includes('ai.copilot'));
  assert.ok(!perms.includes('finance.view'));
  assert.ok(!perms.includes('users.manage'));

  const director = a.seedStaff({ email: 'boss@x.y' }, ['project_director']).id;
  assert.deepStrictEqual(staffPermissions(a.db, director), ['*']);

  // Daniel = finance + customer_support → 并集（§21）
  const daniel = a.seedStaff({ email: 'daniel@x.y' }, ['finance', 'customer_support']).id;
  const dperms = staffPermissions(a.db, daniel);
  assert.ok(dperms.includes('finance.view'));
  assert.ok(dperms.includes('cs.tickets.reply'));
  assert.ok(!dperms.includes('users.manage')); // 两角色都没有
});

test('requirePerm：缺权限 → 403 + 审计 denied（actor=该 staff）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const { cookie, staff } = a.loginStaffAs('alex@x.y', {}, ['customer_support']);
  const req = { headers: { cookie }, socket: { remoteAddress: '127.0.0.1' }, method: 'GET', url: '/api/staff/finance/view' };
  const ctx = { db: a.db, config: a.app.ctx.config };
  const handler = requirePerm('finance.view')(() => { throw new Error('不应执行'); });
  // 注意：同步 throw 不会被 assert.rejects 当拒绝处理，须 async 包装（实测 Node 24 行为）
  await assert.rejects(async () => handler(req, {}, ctx), (err) => err.code === 'FORBIDDEN');
  const row = a.db.prepare("SELECT * FROM audit_log WHERE action = 'perm_denied'").get();
  assert.ok(row, '拒绝尝试必须审计');
  assert.strictEqual(row.result, 'denied');
  assert.strictEqual(row.actor_id, staff.id);
  assert.ok(row.reason.includes('finance.view'));
});

test('requirePerm：director 全键放行；持有权限放行', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const cfg = a.app.ctx.config;
  // director
  const boss = a.loginStaffAs('boss@x.y', {}, ['project_director']);
  let called = false;
  const req = { headers: { cookie: boss.cookie }, socket: { remoteAddress: '127.0.0.1' }, method: 'GET', url: '/x' };
  await requirePerm('staff.rbac')(() => { called = true; })(req, {}, { db: a.db, config: cfg });
  assert.ok(called);
  // finance 持键
  const fin = a.loginStaffAs('fin@x.y', {}, ['finance']);
  called = false;
  await requirePerm('refunds.approve')(() => { called = true; })({ headers: { cookie: fin.cookie }, socket: { remoteAddress: '127.0.0.1' }, method: 'POST', url: '/x' }, {}, { db: a.db, config: cfg });
  assert.ok(called);
});

test('requirePerm：未登录（无会话）→ 401 不落审计', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' }, method: 'GET', url: '/x' };
  await assert.rejects(
    async () => requirePerm('finance.view')(() => {})(req, {}, { db: a.db, config: a.app.ctx.config }),
    (err) => err.code === 'UNAUTHORIZED'
  );
  assert.strictEqual(a.db.prepare('SELECT count(*) AS n FROM audit_log').get().n, 0);
});
