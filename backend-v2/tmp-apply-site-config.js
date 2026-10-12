// tmp-apply-site-config.js — v0.2.58.16 site-config.js 一次性应用（3 处）：
// ①changelog 58.16 条目（58.15 rev 行与 58.14 条目之间）②版本行 58.15→58.16 ③文件尾全站灯塔块。
// CRLF 归一化：读入去 \r、写回全 \r\n。
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', 'docs', 'assets', 'js', 'site-config.js');
let s = fs.readFileSync(F, 'utf8').replace(/\r\n/g, '\n');

// ① changelog 条目
const A1 = '//   （rev 00325-555 瞬态占位上直播；二次烘焙重部署终态 rev 00326-j6m——live 文本 00325-555 滞后一部署=58.14 同款下轮烘焙）\n// v0.2.58.14 = ';
const E1 = `//   （rev 00325-555 瞬态占位上直播；二次烘焙重部署终态 rev 00326-j6m——live 文本 00325-555 滞后一部署=58.14 同款下轮烘焙）
// v0.2.58.16 = 活动页真实数据接入（补丁位 15→16·新功能轮；2026-09-29）——用户「能不能先把动态页面的
//   所有实际功能做一下？」：动态页六大区块全是硬编码假数据（kpiData/generateGrowthSeries/topNations
//   等种子数组）、搜索胶囊是死的（输入框无监听）、热力图 page_views 全站无人上报是空表；修法（四项用户
//   钦定：①KPI 第 5 卡「条约签署」无 treaties 表→新公民数（窗口新注册+趋势）②「内容分类分布」无分类
//   字段→内容类型分布（文章/帖子/评论/点赞真实计数）③死搜索框→排行榜名字+里程碑标题实时过滤 ④热力图→
//   全站装 pageview 灯塔攒数据（空态友好提示、保持 6 时段×7 天形状））：
//   后端零迁移新增 GET /api/public/activity（匿名公开+轻限流 30/min）聚合六区块——KPI 五卡（国家/公民=
//   全量总数+窗口增量趋势、新公民/文章/动态=窗口计数、trend=等长前窗 deltaPct 前窗空→'—'）、趋势图恒
//   30 天日序列、内容类型四条形、热力图最近 7 完整 UTC 日×6 时段（page_views）、排行榜 activity_daily
//   请求和 TOP5（零分不上榜）、里程碑三类型（nation/article/citizen）——公民 title 恒 null（公开端点
//   PII 禁令零邮箱零 display_name）；
//   前端 IIFE 整体重写：state{range/cache/search}+loadData 缓存+陈旧守卫、失败/空态绝不回退假数据
//   （离线一张提示卡五容器清空、热力图空态友好提示）、搜索过滤两区零重拉、切语言从缓存重渲、subnav
//   .active 归 subnav.js（页面零触碰）；全站灯塔（本文件尾）：sendBeacon 优先+fetch keepalive 兜底
//   POST /api/analytics/pageview（slati_cid 一次性生成、__slatiPvSent 每页一次守卫、try/catch 静默）；
//   i18n 16 新键×11 语言+旧条约/分类键族整体删除（OpenCC 重生成 zh-Hant）；切页动画/10 分钟心跳/药丸
//   悬停卡零触碰；FC 恒 v10.28.47.4；后端测试 342/342；电池 activity 14/14+舰队 42 套全绿+冒烟 60/60+
//   i18n 34/34；镜像内容验证两次构建各验一次、先验后推；线上探针 activity 8/8）：
//   （rev 00327-XXX 瞬态占位上直播；二次烘焙重部署终态 rev 00328-???——live 文本 00327-XXX 滞后一部署=58.15 同款下轮烘焙）
// v0.2.58.14 = `;
if (s.split(A1).length - 1 !== 1) throw new Error('anchor A1 count != 1');
s = s.replace(A1, E1);

// ② 版本行
const A2 = "window.MN_SITE_VERSION = 'v0.2.58.15';";
if (s.split(A2).length - 1 !== 1) throw new Error('anchor A2 count != 1');
s = s.replace(A2, "window.MN_SITE_VERSION = 'v0.2.58.16';");

// ③ 文件尾灯塔块
const A3 = "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';\n";
if (s.split(A3).length - 1 !== 1) throw new Error('anchor A3 count != 1');
const BEACON = `window.FLUIDCANVAS_VERSION = 'v10.28.47.4';

/* ─────────────────────────────────────────────
   v0.2.58.16 全站灯塔：每页一次 POST /api/analytics/pageview（动态页热力图数据源）。
   sendBeacon 优先 + fetch keepalive 兜底；全程 try/catch 静默——绝不干扰页面任何功能。
   slati_cid 一次性生成（localStorage）；UA 嗅探只发粗粒度设备/浏览器/OS。
   ───────────────────────────────────────────── */
(function () {
  'use strict';
  try {
    if (window.__slatiPvSent) return;
    window.__slatiPvSent = true;
    var cid = null;
    try { cid = localStorage.getItem('slati_cid'); } catch (e) { cid = null; }
    if (!cid) {
      cid = 'pv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem('slati_cid', cid); } catch (e) {}
    }
    var ua = navigator.userAgent || '';
    var payload = {
      path: location.pathname,
      clientId: cid,
      referer: (document.referrer || '').slice(0, 512),
      language: (navigator.language || '').slice(0, 16),
      device: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop',
      browser: /Edg\\//.test(ua) ? 'Edge' : /Chrome\\//.test(ua) ? 'Chrome' : /Firefox\\//.test(ua) ? 'Firefox' : /Safari\\//.test(ua) ? 'Safari' : 'other',
      os: /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'other'
    };
    var url = ((window.MN_SITE && MN_SITE.apiBase) || '/api') + '/analytics/pageview';
    var body = JSON.stringify(payload);
    var sent = false;
    if (navigator.sendBeacon) {
      try { sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' })); } catch (e) { sent = false; }
    }
    if (!sent && window.fetch) {
      try { fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {}); } catch (e) {}
    }
  } catch (e) {}
})();
`;
s = s.replace(A3, BEACON);

fs.writeFileSync(F, s.replace(/\n/g, '\r\n'));
console.log('site-config.js 应用完成');
console.log('58.16 ×', s.split('v0.2.58.16').length - 1,
  '| __slatiPvSent ×', s.split('__slatiPvSent').length - 1,
  '| /analytics/pageview ×', s.split('/analytics/pageview').length - 1,
  '| slati_cid ×', s.split('slati_cid').length - 1,
  '| 版本赋值 58.15 残留 ×', s.split("MN_SITE_VERSION = 'v0.2.58.15'").length - 1);
