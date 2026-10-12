// tmp-verify-622.js — v0.2.58.16 动态页真实数据接入镜像内容验证（两次构建各验一次、先验后推）
//   锚在位：后端 server/路由/聚合 SQL、site-config 版本+changelog+灯塔块、activity.html 新 IIFE、i18n 新键族；
//   零残留：58.15 赋值、假数据种子 7 项、旧 i18n 键族。
//   （docker run sh -c 读 /app；grep -c 按行计；-F 字面量；计数全部=电池 tmp-battery-activity.js F1 区实测口径）
'use strict';
const { spawnSync } = require('child_process');
const sv = '/app/src/server.js';
const rt = '/app/src/routes/public/activity-stats.js';
const ag = '/app/src/analytics/public-activity.js';
const sc = '/app/docs/assets/js/site-config.js';
const act = '/app/docs/pages/activity.html';
const i18n = '/app/docs/assets/i18n/activity.i18n.js';
const cmds = [
  // ── 后端装配 ──
  ['server.js require 路由 ×1', `grep -cF "require('./routes/public/activity-stats')" ${sv}`, '1'],
  ['server.js registerActivityStats ×2', `grep -cF 'registerActivityStats' ${sv}`, '2'],
  ['路由文件端点字符串 ×1', `grep -cF "'/api/public/activity'" ${rt}`, '1'],
  ['路由文件限流配置 publicActivity ×1', `grep -cF 'publicActivity' ${rt}`, '1'],
  ['路由文件限流键 pa:ip: ×1', `grep -cF "'pa:ip:'" ${rt}`, '1'],
  ['聚合 heatmap SQL strftime ×1', `grep -cF "strftime('%w'" ${ag}`, '1'],
  ['聚合 heatmap SQL substr 小时桶 ×1', `grep -cF 'substr(created_at,12,2)' ${ag}`, '1'],
  ['聚合点赞 SQL target_type=post ×3', `grep -cF "target_type = 'post'" ${ag}`, '3'],
  ['聚合 activity_daily 连接 ×1', `grep -cF 'activity_daily' ${ag}`, '1'],
  ['聚合 LIMIT 5 ×2（榜+里程碑）', `grep -cF 'LIMIT 5' ${ag}`, '2'],
  // ── site-config 版本+changelog+灯塔 ──
  ['site-config 58.16 赋值在位', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.16';" ${sc}`, '1'],
  ['site-config 58.15 赋值零残留(应 0)', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.15';" ${sc}`, '0'],
  ['site-config FC 47.4 恒（零改动）', `grep -cF "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';" ${sc}`, '1'],
  ['changelog 58.16 条目标题在位', `grep -cF '// v0.2.58.16 = ' ${sc}`, '1'],
  ['changelog 58.16 用户原话片断', `grep -c '能不能先把动态页面的' ${sc}`, '1'],
  ['changelog rev 00327-n5s 瞬态真值注记（占位+滞后注记同行=1 行）', `grep -cF 'rev 00327-n5s' ${sc}`, '1'],
  ['changelog rev 00327-XXX 占位零残留(应 0)', `grep -cF 'rev 00327-XXX' ${sc}`, '0'],
  ['changelog rev 00328-??? 终态占位注记', `grep -cF 'rev 00328-???' ${sc}`, '1'],
  ['灯塔 __slatiPvSent ×3（守卫注释+判+置）', `grep -cF '__slatiPvSent' ${sc}`, '3'],
  ['灯塔 /analytics/pageview ×3（changelog 注记+块头注释+拼接）', `grep -cF '/analytics/pageview' ${sc}`, '3'],
  ['灯塔 slati_cid ×4', `grep -cF 'slati_cid' ${sc}`, '4'],
  ['灯塔 navigator.sendBeacon ×2（判+发）', `grep -cF 'navigator.sendBeacon' ${sc}`, '2'],
  ['灯塔 fetch keepalive 兜底 ×1', `grep -cF 'keepalive: true' ${sc}`, '1'],
  // ── activity.html 新 IIFE ──
  ['页面 api.js 引入 ×1', `grep -cF 'assets/js/api.js' ${act}`, '1'],
  ['页面搜索框 id ×1', `grep -cF 'id="activitySearch"' ${act}`, '1'],
  ['页面内容类型键 ×1', `grep -cF 'activity.chart.contentTypes' ${act}`, '1'],
  ['页面端点调用 ×1', `grep -cF "MN_API.get('/public/activity" ${act}`, '1'],
  ['页面新键 kpi.newCitizens ×1', `grep -cF 'activity.kpi.newCitizens' ${act}`, '1'],
  ['页面新键 empty.heatmap ×1', `grep -cF 'activity.empty.heatmap' ${act}`, '1'],
  ['页面新键 offline.title ×1', `grep -cF 'activity.offline.title' ${act}`, '1'],
  ['页面新键 ms.title.citizen ×1', `grep -cF 'activity.ms.title.citizen' ${act}`, '1'],
  ['页面假数据种子零残留(应 0)', `grep -cF 'Republic of Etheria' ${act}`, '0'],
  ['页面 generateGrowthSeries 零残留(应 0)', `grep -cF 'generateGrowthSeries' ${act}`, '0'],
  ['页面 kpiData 零残留(应 0)', `grep -cF 'kpiData' ${act}`, '0'],
  ['页面 topNations 零残留(应 0)', `grep -cF 'topNations' ${act}`, '0'],
  ['页面 trendData 零残留(应 0)', `grep -cF 'trendData' ${act}`, '0'],
  ['页面 892 零残留(应 0)', `grep -cF '892' ${act}`, '0'],
  ['页面 treaties 零残留(应 0)', `grep -cF 'treaties' ${act}`, '0'],
  // ── i18n 新键族 ×12 语 ──
  ['i18n kpi.newCitizens ×12', `grep -cF 'activity.kpi.newCitizens' ${i18n}`, '12'],
  ['i18n chart.contentTypes ×12', `grep -cF 'activity.chart.contentTypes' ${i18n}`, '12'],
  ['i18n ms.title.citizen ×12', `grep -cF 'activity.ms.title.citizen' ${i18n}`, '12'],
  ['i18n empty.heatmap ×12', `grep -cF 'activity.empty.heatmap' ${i18n}`, '12'],
  ['i18n offline.title ×12', `grep -cF 'activity.offline.title' ${i18n}`, '12'],
  ['i18n treatiesSigned 零残留(应 0)', `grep -cF 'treatiesSigned' ${i18n}`, '0'],
  ['i18n cat.governance 零残留(应 0)', `grep -cF 'activity.cat.governance' ${i18n}`, '0'],
  ['i18n ms.desc.anniv2 零残留(应 0)', `grep -cF 'ms.desc.anniv2' ${i18n}`, '0'],
  ['i18n ms.time.t2d 零残留(应 0)', `grep -cF 'ms.time.t2d' ${i18n}`, '0'],
  ['i18n chart.category 零残留(应 0)', `grep -cF 'activity.chart.category' ${i18n}`, '0'],
  ['i18n zh-Hant 自动生成标记 ×1', `grep -cF '__ZH_HANT_AUTO__' ${i18n}`, '1'],
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  console.log(`[${name}] → ${out}`);
  if (out !== want) bad++;
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
