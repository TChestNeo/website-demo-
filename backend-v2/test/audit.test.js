'use strict';
// 审计助手：哈希链追加、canonical 确定性、denied 拒绝记录、篡改检出（§25 + D12）。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');
const { audit, auditDenied, verifyChain, canonical } = require('../src/audit');

test('audit：追加行 + verifyChain 全链通过 + prev_hash 链接', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const r1 = audit(a.db, null, {}, { action: 'a1', prev: { b: 1, a: 2 }, next: 'x', reason: 'r', ip: '1.2.3.4' });
  const r2 = audit(a.db, null, {}, { action: 'a2', targetType: 'user', targetId: 'USR-000001' });
  assert.ok(r1.id.startsWith('AUD-'));
  assert.strictEqual(r2.id, 'AUD-000002');
  assert.deepStrictEqual(verifyChain(a.db), { ok: true, count: 2 });
  const row2 = a.db.prepare('SELECT * FROM audit_log WHERE seq = 2').get();
  assert.strictEqual(row2.prev_hash, r1.hash);
  assert.strictEqual(row2.ip, ''); // 无 req 时 ip 空串
});

test('canonical：键排序稳定（同内容同串，财报审计重放依赖）', () => {
  assert.strictEqual(
    canonical({ b: 1, a: [2, { d: 4, c: 3 }] }),
    canonical({ a: [2, { c: 3, d: 4 }], b: 1 })
  );
  assert.strictEqual(canonical(undefined), null);
  assert.strictEqual(canonical(null), null);
});

test('auditDenied：result=denied、actor=已认证 staff（§24 拒绝尝试入库）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  auditDenied(a.db, null, { staff: { id: 'STAFF-000001' } }, { action: 'perm_denied', targetId: 'GET /x', reason: '缺少权限 y' });
  const row = a.db.prepare('SELECT * FROM audit_log WHERE seq = 1').get();
  assert.strictEqual(row.result, 'denied');
  assert.strictEqual(row.actor_id, 'STAFF-000001');
  assert.strictEqual(row.actor_type, 'staff');
});

test('篡改检出：绕过触发器改行 → verifyChain 断链定位', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  audit(a.db, null, {}, { action: 'a1' });
  audit(a.db, null, {}, { action: 'a2' });
  // 触发器挡 UPDATE；模拟破坏 = 拆触发器后改（验证 verifyChain 本身能查出）
  a.db.exec('DROP TRIGGER trg_audit_no_update;');
  a.db.prepare("UPDATE audit_log SET reason = 'tampered' WHERE seq = 1").run();
  const v = verifyChain(a.db);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.brokenAt, 1);
});
