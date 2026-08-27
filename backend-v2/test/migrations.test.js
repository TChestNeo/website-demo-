'use strict';
// 迁移 001-009：版本推进、幂等、重复版本号拒绝、append-only 触发器、种子完整性。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { openDb, migrate } = require('../src/db');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mn2-mig-'));
}

test('迁移：user_version=9、55 表、角色/权限/平台种子齐整', () => {
  const db = openDb(path.join(tmpDir(), 'a.sqlite'));
  assert.strictEqual(db.pragma('user_version', { simple: true }), 9);
  // 表数：001 七 + 002 六 + 003 一 + 004 两 + 005 十四 + 006 四 + 007 四 + 008 六 + 009 十一 = 55（触发器不算表）
  const n = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n;
  assert.strictEqual(n, 55);
  // 角色 7、权限 42、矩阵基线（每角色授权数逐一断言 = 设计契约锁定）
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM roles').get().n, 7);
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM permissions').get().n, 42);
  const count = (role) => db.prepare('SELECT count(*) AS n FROM role_permissions WHERE role_id = ?').get(role).n;
  assert.deepStrictEqual(
    { cs: count('customer_support'), finance: count('finance'), moderation: count('moderation'),
      security: count('security'), technical: count('technical'), management: count('management') },
    { cs: 17, finance: 15, moderation: 12, security: 10, technical: 9, management: 14 }
  );
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM role_permissions').get().n, 77);
  // project_director 无矩阵行（全键走代码层，§4）
  assert.strictEqual(db.prepare("SELECT count(*) AS n FROM role_permissions WHERE role_id = 'project_director'").get().n, 0);
  // 平台设置种子（D8 预算红线默认值）
  assert.strictEqual(db.prepare("SELECT value FROM platform_settings WHERE key = 'budget.total'").get().value, '60');
  assert.strictEqual(db.prepare("SELECT value FROM platform_settings WHERE key = 'budget.copilot'").get().value, '10');
  // users.role 只允许 'user'（D4）
  assert.throws(() => db.prepare("INSERT INTO users (email, role, created_at, updated_at) VALUES ('x@y.z', 'admin', 't', 't')").run(), /CHECK/);
});

test('迁移：重复打开同库幂等（版本不再推进、无重复执行）', () => {
  const p = path.join(tmpDir(), 'b.sqlite');
  openDb(p);
  const db = openDb(p);
  assert.strictEqual(db.pragma('user_version', { simple: true }), 9);
});

test('迁移 005-009：社交/工单/知识库/审核/财务关键表与扩展列就位（D5/D6 口径）', () => {
  const db = openDb(path.join(tmpDir(), 'd.sqlite'));
  const has = (name) => db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name = ?").get(name).n === 1;
  for (const t of ['comments', 'wikis', 'content_likes', 'favorites', 'shares',
    'tickets', 'ticket_replies', 'ticket_escalations', 'ticket_feedback',
    'kb_categories', 'kb_articles', 'chat_logs',
    'refunds', 'subscriptions', 'donations', 'pricing_plans', 'pricing_regions', 'promos', 'checkout_events', 'payroll', 'staff_rates']) {
    assert.ok(has(t), '缺表 ' + t);
  }
  const col = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c);
  // D5：chat_logs 记问答内容；conversations 加 support 通道；消息/成员多态
  assert.ok(col('chat_logs', 'question') && col('chat_logs', 'answer') && col('chat_logs', 'answer_source'));
  assert.ok(col('conversations', 'kind') && col('conversations', 'ticket_id'));
  assert.ok(col('conversation_members', 'actor_type') && col('messages', 'sender_type'));
  // D4/D6：staff 只在 staff 表；audit 哈希链列
  assert.ok(col('staff', 'alias') && col('staff', 'real_name'));
  assert.ok(col('audit_log', 'prev_hash') && col('audit_log', 'hash'));
});

test('迁移：重复版本号启动即报错（防静默跳过）', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE x_a (id TEXT);');
  fs.writeFileSync(path.join(dir, '001_b.sql'), 'CREATE TABLE x_b (id TEXT);');
  const db = new Database(':memory:');
  assert.throws(() => migrate(db, dir), /版本号重复/);
});

test('审计表 append-only：UPDATE/DELETE 一律触发器拒绝（D12）', () => {
  const db = openDb(path.join(tmpDir(), 'c.sqlite'));
  db.prepare("INSERT INTO audit_log (actor_type, actor_id, action, created_at, hash) VALUES ('system', 's', 'x', ?, 'h')")
    .run(new Date().toISOString());
  assert.throws(() => db.prepare('UPDATE audit_log SET action = ? WHERE seq = 1').run('y'), /append-only/);
  assert.throws(() => db.prepare('DELETE FROM audit_log WHERE seq = 1').run(), /append-only/);
});
