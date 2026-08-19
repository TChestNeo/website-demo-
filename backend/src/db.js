'use strict';
// SQLite 连接与迁移。连接参数：WAL + busy_timeout=5000 + foreign_keys=ON。
// 迁移按 migrations/NNN_*.sql 字典序执行，PRAGMA user_version 记录已应用版本。

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function migrate(db, dir) {
  const files = fs.readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  // 版本号必须唯一：同号迁移在已迁移过的库上会被静默跳过（新增迁移一律取下一个号）
  const seen = new Set();
  for (const f of files) {
    const version = Number.parseInt(f, 10);
    if (seen.has(version)) throw new Error(`迁移版本号重复: ${version}（${f}）`);
    seen.add(version);
  }
  const applied = db.pragma('user_version', { simple: true });
  for (const f of files) {
    const version = Number.parseInt(f, 10);
    if (version <= applied) continue;
    db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
    db.pragma(`user_version = ${version}`);
  }
}

function openDb(databasePath) {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  migrate(db, path.join(__dirname, '..', 'migrations'));
  return db;
}

module.exports = { openDb };
