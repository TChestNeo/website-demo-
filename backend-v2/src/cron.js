'use strict';
// 定时器（与服务器时区无关，全部显式换算）：每 60s tick，仅 main 进程启动（测试不启动）。
// 文字审核三班：北京时间 20:00/00:00/04:00（= UTC 12:00/16:00/20:00，04:00 班落 DeepSeek 低谷窗口）。
//   班次窗口 = 该 CST 小时前 30 分钟；每天每班只跑一次（kv cron.text_shift = 'YYYY-MM-DD-HH'，先写后跑防重入）。
// 图像滞留兜底：queued image 项超过 15 分钟未决 → 重新处理（POST 内联处理进程中断的恢复路径）。
// 预算日结告警（P11）：每天北京时间 10:30-10:59 一次（kv cron.budget_alert = 'YYYY-MM-DD'，先写后跑防重入）。

const queue = require('./moderation/queue');
const { runDailyBudgetAlert } = require('./budget-alert');

const SHIFT_HOURS_CST = [20, 0, 4];
const SHIFT_WINDOW_MIN = 30;
const IMAGE_STALE_MIN = 15;
const ALERT_HOUR_CST = 10;
const ALERT_MIN_CST = 30;

// UTC ms → 北京时间的 {date, hour, minute}（+8 后用 getUTC* 读）
function cstParts(utcMs) {
  const d = new Date(utcMs + 8 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

// 日结告警窗口判定 + kv 防重入（先写后跑）。parts = cstParts() 返回值。
function maybeRunDailyAlert(db, parts, nowIso = new Date().toISOString()) {
  if (parts.hour !== ALERT_HOUR_CST || parts.minute < ALERT_MIN_CST) return false;
  const ran = db.prepare('SELECT value FROM kv WHERE key = ?').get('cron.budget_alert');
  if (ran && ran.value === parts.date) return false;
  db.prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) '
    + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .run('cron.budget_alert', parts.date, nowIso);
  return true;
}

function startCron(ctx) {
  const db = ctx.db;
  const fire = (label, fn) => {
    (async () => {
      try { await fn(); } catch (err) { console.error(`[cron:${label}]`, err); }
    })();
  };
  setInterval(() => {
    const parts = cstParts(Date.now());
    const { date, hour, minute } = parts;
    // 1) 文字三班（kv 防重入：先写后跑）
    if (SHIFT_HOURS_CST.includes(hour) && minute < SHIFT_WINDOW_MIN) {
      const key = `${date}-${hour}`;
      const ran = db.prepare('SELECT value FROM kv WHERE key = ?').get('cron.text_shift');
      if (!ran || ran.value !== key) {
        db.prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) '
          + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
          .run('cron.text_shift', key, new Date().toISOString());
        fire('text_shift', () => queue.processTextBatch(ctx));
      }
    }
    // 2) 图像滞留兜底（进程中断恢复）
    const staleSince = new Date(Date.now() - IMAGE_STALE_MIN * 60000).toISOString();
    const stale = db.prepare("SELECT * FROM moderation_items WHERE kind = 'image' AND status = 'queued' AND created_at < ? LIMIT 20")
      .all(staleSince);
    for (const it of stale) fire('image_retry', () => queue.processImageItem(ctx, it));
    // 3) 预算日结告警（kv 防重入：先写后跑）
    if (maybeRunDailyAlert(db, parts)) fire('budget_alert', () => runDailyBudgetAlert(ctx));
    // 4) 删号后悔期到期：delete_pending 超过 30 天 → deleted（真正删除；每 tick 清一次，幂等）
    const deleteCutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    db.prepare("UPDATE users SET status = 'deleted', updated_at = ? WHERE status = 'delete_pending' AND delete_requested_at IS NOT NULL AND delete_requested_at < ?")
      .run(new Date().toISOString(), deleteCutoff);
  }, 60000);
}

module.exports = { startCron, cstParts, maybeRunDailyAlert, SHIFT_HOURS_CST, ALERT_HOUR_CST, ALERT_MIN_CST };
