#!/usr/bin/env bash
# 在线备份（P10）：better-sqlite3 .backup()，WAL 下无需停服；保留 30 天；文件 600。
# 用法：MN_DB_PATH=/opt/mn/backend/data/mn.sqlite ./backup.sh
# cron（北京时间 10:17，错开整点）：17 2 * * * /opt/mn/backend/scripts/backup.sh >> /var/log/mn-backup.log 2>&1
# 恢复演练：node -e "const{openDb}=require('./src/db');openDb('/tmp/mn-restore.sqlite').close()"（在 backend/ 下）
set -euo pipefail

MN_DB_PATH="${MN_DB_PATH:-/opt/mn/backend/data/mn.sqlite}"
MN_BACKUP_DIR="${MN_BACKUP_DIR:-/var/backups/mn}"
KEEP_DAYS="${MN_KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$MN_BACKUP_DIR/mn-$STAMP.sqlite"

mkdir -p "$MN_BACKUP_DIR"
cd "$(dirname "$0")/.." # backend/ —— node -e 的 require('./src/db') 依赖 cwd

if [ ! -f "$MN_DB_PATH" ]; then
  echo "backup FAIL: 数据库不存在：$MN_DB_PATH" >&2
  exit 1
fi

export MN_DB_PATH DEST
node -e "
const { openDb } = require('./src/db');
const db = openDb(process.env.MN_DB_PATH, { readonly: true });
db.backup(process.env.DEST).then(() => {
  const n = db.prepare('SELECT count(*) AS n FROM users').get().n;
  console.log('backup ok: ' + process.env.DEST + ' (users=' + n + ')');
  db.close();
}).catch((e) => { console.error('backup FAIL:', e.message); process.exit(1); });
"

chmod 600 "$DEST"
# 保留最近 KEEP_DAYS 天
find "$MN_BACKUP_DIR" -name 'mn-*.sqlite' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
echo "backup dir: $(ls "$MN_BACKUP_DIR" | wc -l) 份"
