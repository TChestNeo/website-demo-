'use strict';
// 时间窗口工具（D9 读时聚合共用）：range → ISO 窗口 + 日桶补齐（图表零值连续）。
// range：today | 7d | 30d | 90d | 1y | custom（custom 需要 from/to，缺省回退 30d）。

const DAY_MS = 86400e3;
const RANGES = ['today', '7d', '30d', '90d', '1y', 'custom'];

function rangeWindow(range, from, to, now = new Date()) {
  let toMs = now.getTime();
  let fromMs;
  switch (range) {
    case 'today': { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); fromMs = d.getTime(); break; }
    case '7d': fromMs = toMs - 7 * DAY_MS; break;
    case '30d': fromMs = toMs - 30 * DAY_MS; break;
    case '90d': fromMs = toMs - 90 * DAY_MS; break;
    case '1y': fromMs = toMs - 365 * DAY_MS; break;
    case 'custom': {
      const f = from ? Date.parse(from) : NaN;
      const t = to ? Date.parse(to) : NaN;
      fromMs = !Number.isNaN(f) ? f : toMs - 30 * DAY_MS;
      if (!Number.isNaN(t) && t > fromMs) toMs = t;
      break;
    }
    default: fromMs = toMs - 30 * DAY_MS;
  }
  const fromIso = new Date(fromMs).toISOString();
  const toIso = new Date(toMs).toISOString();
  return { fromIso, toIso, fromDate: fromIso.slice(0, 10), toDate: toIso.slice(0, 10), fromMs, toMs };
}

// 日桶补齐：map 为 { 'YYYY-MM-DD': {k:v} }，输出 [{date, ...keys 零值}]（升序，含首末日）
function fillDays(fromDate, toDate, map, keys) {
  const out = [];
  const d = new Date(fromDate + 'T00:00:00Z');
  const end = new Date(toDate + 'T00:00:00Z');
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    const row = { date: ds };
    const hit = map.get(ds) || {};
    for (const k of keys) row[k] = hit[k] || 0;
    out.push(row);
  }
  return out;
}

module.exports = { rangeWindow, fillDays, RANGES };
