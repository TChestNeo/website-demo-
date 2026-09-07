// tmp-catchup-test.js — v0.2.20.4 catch-up 追恢复合并逻辑单机验证（用两份真实快照模拟）
// 场景：live 库 = 启动恢复的旧快照（like@15:51:44）；追恢复源 = 旧实例 SIGTERM 新快照（like@15:54:49）
'use strict';
const fs = require('fs');
const Database = require('better-sqlite3');

fs.copyFileSync('./tmp-snap-old.sqlite', './tmp-catchup-live.sqlite');
const src = '../tmp-snap-latest.sqlite';

const api = { db: new Database('./tmp-catchup-live.sqlite') };
let dbWrites = 0;
const origPrepare = api.db.prepare.bind(api.db);
api.db.prepare = (sql) => {
  const stmt = origPrepare(sql);
  if (!/^\s*(select|pragma|explain)\b/i.test(sql)) {
    const run = stmt.run.bind(stmt);
    stmt.run = (...a) => { dbWrites++; return run(...a); };
  }
  return stmt;
};

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('✅ ' + name); }
  else { fail++; console.log('❌ ' + name + (extra !== undefined ? ' → ' + extra : '')); }
};

// 守卫自检：读不计数、写计数
const before = dbWrites;
api.db.prepare('SELECT 1 AS x').get();
api.db.prepare('PRAGMA user_version').get();
ok('写计数守卫：SELECT/PRAGMA 不计', dbWrites === before, 'dbWrites=' + dbWrites);
api.db.prepare('UPDATE users SET updated_at = updated_at WHERE id = ?').run('USR-000001');
ok('写计数守卫：UPDATE 计数', dbWrites === before + 1, 'dbWrites=' + dbWrites);

// 合并前状态
ok('合并前：live 是旧快照（like@15:51:44）',
  api.db.prepare('SELECT created_at FROM content_likes').get().created_at === '2026-09-06T15:51:44.817Z',
  JSON.stringify(api.db.prepare('SELECT * FROM content_likes').all()));
const auditBefore = api.db.prepare('SELECT COUNT(*) c FROM audit_log').get().c;

// ── 追恢复合并（与 entrypoint 同逻辑）──
api.db.pragma('foreign_keys = OFF');
const snapDb = new Database(src, { readonly: true });
const tables = snapDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
  .map((r) => r.name).filter((t) => t !== 'audit_log');
api.db.exec('ATTACH DATABASE ' + JSON.stringify(src) + ' AS snap');
const merge = api.db.transaction(() => {
  for (const t of tables) {
    api.db.exec('DELETE FROM main.' + t);
    api.db.exec('INSERT INTO main.' + t + ' SELECT * FROM snap.' + t);
  }
});
merge();
try { api.db.exec('DETACH DATABASE snap'); } catch {}
snapDb.close();
api.db.pragma('foreign_keys = ON');
const fkBad = api.db.pragma('foreign_key_check');

ok('合并表数 = 57（59 - sqlite_sequence - audit_log）', tables.length === 57, tables.length);
ok('合并后：content_likes 更新为新快照（like@15:54:49）',
  api.db.prepare('SELECT created_at FROM content_likes').get().created_at === '2026-09-06T15:54:49.404Z',
  JSON.stringify(api.db.prepare('SELECT * FROM content_likes').all()));
ok('合并后：users 完好（2 用户）', api.db.prepare('SELECT COUNT(*) c FROM users').get().c === 2);
ok('合并后：posts view_count=10', api.db.prepare('SELECT view_count FROM posts').get().view_count === 10);
ok('合并后：audit_log 未动（append-only 跳过）', api.db.prepare('SELECT COUNT(*) c FROM audit_log').get().c === auditBefore, auditBefore);
ok('合并后：FK 校验 0 违例', fkBad.length === 0, fkBad.length + ' 条');
ok('合并后：user_version 仍 16', api.db.prepare('PRAGMA user_version').get().user_version === 16);
// 合并后写入仍可用（ID 单调性不受影响——users 已存在 id 占位，新插入仍按 seq 走）
api.db.prepare("UPDATE users SET bio = 't' WHERE id = 'USR-000001'").run();
ok('合并后：正常写入可用', api.db.prepare("SELECT bio FROM users WHERE id='USR-000001'").get().bio === 't');
// 再跑一次合并（幂等：同源快照再并一次）
api.db.pragma('foreign_keys = OFF');
const snapDb2 = new Database(src, { readonly: true });
api.db.exec('ATTACH DATABASE ' + JSON.stringify(src) + ' AS snap');
const merge2 = api.db.transaction(() => { for (const t of tables) { api.db.exec('DELETE FROM main.' + t); api.db.exec('INSERT INTO main.' + t + ' SELECT * FROM snap.' + t); } });
merge2();
try { api.db.exec('DETACH DATABASE snap'); } catch {}
snapDb2.close();
api.db.pragma('foreign_keys = ON');
ok('二次合并幂等：like 仍 @15:54:49', api.db.prepare('SELECT created_at FROM content_likes').get().created_at === '2026-09-06T15:54:49.404Z');

console.log(`\n${pass} 过 / ${fail} 败`);
api.db.close();
fs.unlinkSync('./tmp-catchup-live.sqlite');
process.exit(fail ? 1 : 0);
