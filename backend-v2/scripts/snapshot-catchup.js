'use strict';
// snapshot-catchup.js — catch-up 追恢复合并（v0.2.20.4 部署丢点赞修复，entrypoint 专用，由 test 直接引用回归）。
// 场景：部署瞬间新旧实例并存，新实例冷启动恢复的是旧实例上一次定时快照；旧实例 SIGTERM 临终快照
// 晚 ~6s 才落地（晚于新实例恢复），其中旧实例最后 ≤interval 的写入（点赞/收藏等）无人再读 → 丢进修剪链。
// 合并 = 把临终快照并回活库。活库连接句柄常驻进程——直接覆盖库文件不会生效，必须经 live 连接 ATTACH
// 整表替换（本实例零写入前提由调用方写计数守卫保证，防覆盖用户在新实例上的新操作）。
// audit_log 为 append-only（trg_audit_no_delete 触发器禁 DELETE）默认跳过；FK 临时关闭（先删后插顺序
// 随意）+ 完成后 foreign_key_check 校验。抛错时事务自动回滚（better-sqlite3），FK 状态由 finally 复原。
const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');

// 找桶内 mtime 晚于 newerThan 的其他实例快照（排除本实例文件与 .tmp 中途文件），无则 null
function findNewerSnap(dir, base, ownFile, newerThan) {
  let best = null;
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(base + '.') || f.endsWith('.tmp') || f === ownFile) continue;
    const m = fs.statSync(path.join(dir, f)).mtimeMs;
    if (m > newerThan && (!best || m > best.m)) best = { f, m };
  }
  return best;
}

function catchupMerge(liveDb, snapPath, opts = {}) {
  const skip = opts.skipTables || ['audit_log'];
  const snapDb = new Database(snapPath, { readonly: true });
  const tables = snapDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
    .map((r) => r.name).filter((t) => !skip.includes(t));
  liveDb.pragma('foreign_keys = OFF'); // PRAGMA 事务外才生效；同步合并阻塞事件循环，期间无并发写入窗口
  try {
    liveDb.exec('ATTACH DATABASE ' + JSON.stringify(snapPath) + ' AS snap');
    const merge = liveDb.transaction(() => {
      for (const t of tables) {
        liveDb.exec('DELETE FROM main.' + t);
        liveDb.exec('INSERT INTO main.' + t + ' SELECT * FROM snap.' + t);
      }
    });
    merge();
    try { liveDb.exec('DETACH DATABASE snap'); } catch {}
  } finally {
    snapDb.close();
    liveDb.pragma('foreign_keys = ON');
  }
  return { tables, fkBad: liveDb.pragma('foreign_key_check') };
}

module.exports = { catchupMerge, findNewerSnap };
