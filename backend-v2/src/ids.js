'use strict';
// 可读 ID：INSERT 后以 AUTOINCREMENT seq 生成「前缀 + 6 位序号」回写。
// 依赖目标表 id 列允许 NULL（SQLite UNIQUE 对 NULL 不冲突）——见 001_init.sql。

function pad6(n) {
  return String(n).padStart(6, '0');
}

// 插入一行（不含 id/seq 列）并回写可读 id。
// idFor(seq) 返回 id；返回 null/'' 则跳过回写（表无公开 id 时）。
// 返回 { id, seq }。
function insertWithId(db, table, fields, values, idFor) {
  const stmt = db.prepare(
    `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`
  );
  const info = stmt.run(...values);
  const seq = Number(info.lastInsertRowid);
  const id = idFor ? idFor(seq) : null;
  if (id) db.prepare(`UPDATE ${table} SET id = ? WHERE seq = ?`).run(id, seq);
  return { id, seq };
}

module.exports = { pad6, insertWithId };
