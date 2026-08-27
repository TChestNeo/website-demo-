'use strict';
// traffic 域聚合：page_views 访问流水（D9 读时现算；country 由 GEOIP_URL 可选解析，D10）。

const { fillDays } = require('./window');

function overview(db, w) {
  const views = db.prepare('SELECT count(*) AS n FROM page_views WHERE created_at >= ? AND created_at < ?').get(w.fromIso, w.toIso).n;
  const clients = db.prepare('SELECT count(DISTINCT client_id) AS n FROM page_views WHERE created_at >= ? AND created_at < ? AND client_id IS NOT NULL')
    .get(w.fromIso, w.toIso).n;
  // 次级排序按名称字典序——并列计数条目顺序稳定，图表不随请求乱跳
  const top = (col) => db.prepare(
    `SELECT ${col} AS name, count(*) AS n FROM page_views WHERE created_at >= ? AND created_at < ? AND ${col} IS NOT NULL AND ${col} != '' GROUP BY ${col} ORDER BY n DESC, ${col} LIMIT 10`
  ).all(w.fromIso, w.toIso);
  return { views, clients, byPath: top('path'), byCountry: top('country'), byDevice: top('device'), byBrowser: top('browser'), byLanguage: top('language') };
}

function daily(db, w) {
  const pv = new Map(db.prepare('SELECT substr(created_at,1,10) AS d, count(*) AS n FROM page_views WHERE created_at >= ? AND created_at < ? GROUP BY d')
    .all(w.fromIso, w.toIso).map((r) => [r.d, { views: r.n }]));
  return fillDays(w.fromDate, w.toDate, pv, ['views']);
}

module.exports = { overview, daily };
