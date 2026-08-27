'use strict';
// §28 数据权限掩码矩阵（纯函数精确断言）：客服最小集 vs 扩权角色。

const test = require('node:test');
const assert = require('node:assert');
const { capabilities, maskIp, maskUserRow, maskLoginHistory, maskPayments } = require('../src/middleware/mask');

test('capabilities：客服最小集（🟡 IP 前两段，❌ 支付/内部/私信）', () => {
  assert.deepStrictEqual(capabilities(['customer_support']), {
    fullIp: false, partialIp: true, payments: false, internal: false, dm: false, director: false
  });
});

test('capabilities：director 全量 / finance 支付 / security IP+内部 / management 全量监督', () => {
  assert.deepStrictEqual(capabilities(['project_director']), {
    fullIp: true, partialIp: false, payments: true, internal: true, dm: true, director: true
  });
  const f = capabilities(['finance']);
  assert.strictEqual(f.payments, true);
  assert.strictEqual(f.fullIp, false);
  const s = capabilities(['security']);
  assert.strictEqual(s.fullIp, true);
  assert.strictEqual(s.internal, true);
  const m = capabilities(['management']);
  assert.strictEqual(m.fullIp, true);
  assert.strictEqual(m.payments, true);
  assert.strictEqual(m.dm, true);
});

test('maskIp：三态（前两段 / 完整 / 隐藏）', () => {
  const cs = capabilities(['customer_support']);
  const sec = capabilities(['security']);
  const fin = capabilities(['finance']);
  assert.strictEqual(maskIp(cs, '175.143.10.20'), '175.143.*.*');
  assert.strictEqual(maskIp(sec, '175.143.10.20'), '175.143.10.20');
  assert.strictEqual(maskIp(fin, '175.143.10.20'), null);
});

test('maskUserRow：客服见基础档案+riskLevel、不见内部字段；internal 见全部', () => {
  const u = {
    id: 'USR-1', display_name: 'N', email: 'e@x.y', citizen_id: 'CIT-1', avatar_url: null,
    language: 'zh', country: null, bio: null, tier: 'free', tier_expires_at: null, status: 'active',
    created_at: 't', last_active_at: null, last_login_at: null, risk_level: 'medium',
    risk_reasons: '["new_device"]', warning_count: 2, muted_until: null, dob: null
  };
  const cs = maskUserRow(capabilities(['customer_support']), u);
  assert.strictEqual(cs.riskLevel, 'medium');   // 安全标记永见
  assert.strictEqual(cs.riskReasons, undefined); // 内部字段不见
  assert.strictEqual(cs.warningCount, undefined);
  const sec = maskUserRow(capabilities(['security']), u);
  assert.deepStrictEqual(sec.riskReasons, ['new_device']);
  assert.strictEqual(sec.warningCount, 2);
});

test('maskLoginHistory：客服仅近 10 条 + IP 前两段；finance 无 IP 全 null', () => {
  // 行序约定 = created_at DESC（最新在前）——slice(0,10) 必须留最新 10 条
  const rows = Array.from({ length: 15 }, (_, i) => ({ seq: i, ip: `175.143.10.${i}` }));
  const cs = maskLoginHistory(capabilities(['customer_support']), rows);
  assert.strictEqual(cs.length, 10);
  assert.deepStrictEqual(cs.map((r) => r.seq), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], '最新在前 → 保留最新 10 条（不是最旧 10 条）');
  assert.strictEqual(cs[0].ip, '175.143.*.*');
  const fin = maskLoginHistory(capabilities(['finance']), rows);
  assert.strictEqual(fin.length, 15);
  assert.ok(fin.every((r) => r.ip === null));
});

test('maskPayments：无 payments 能力 → null（区块隐藏信号，非空数组）', () => {
  assert.strictEqual(maskPayments(capabilities(['customer_support']), [{ id: 1 }]), null);
  assert.deepStrictEqual(maskPayments(capabilities(['finance']), [{ id: 1 }]), [{ id: 1 }]);
});
