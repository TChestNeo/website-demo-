// tmp-update-memory-622.js — v0.2.58.16 记忆仪式：
//   ① backend-build-state.md 头旋转（00328-c67 新 head；00326-j6m 降前身）
//   ② site-versioning-scheme.md 追加 58.16 条目+当前指针
//   ③ MEMORY.md 新行+两处「当前」指针更新
//   ④ 新记忆文件 2026-09-29-v025816-activity-real.md
'use strict';
const fs = require('fs');
const path = require('path');
const MEM = 'C:\\Users\\USER\\.claude\\projects\\c--Users-USER-Downloads-stitch-slatiworld-micronation-interface\\memory';
const read = (f) => fs.readFileSync(path.join(MEM, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(MEM, f), s, 'utf8');
let steps = 0;
const step = (n, cond) => { steps++; console.log((cond ? '  ✅ ' : '  ❌ ') + n); if (!cond) process.exitCode = 1; };

// ═══ ① backend-build-state.md 头旋转 ═══
{
  const f = 'backend-build-state.md';
  let s = read(f);
  const headAnchor = '**当前线上 rev 00326-j6m（';
  const demote = '**前身 rev 00326-j6m（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev 00328-c67（2026-09-29 v0.2.58.16 动态页真实数据接入——用户「能不能先把动态页面的所有实际功能做一下？」；' +
    '真身=docs/pages/activity.html 六大区块全硬编码假数据（kpiData/generateGrowthSeries/topNations 种子）+搜索框死输入（无监听）+' +
    '后端 analytics 引擎齐全但只 staff 路由用+page_views 表全站无人上报（空表）；修法=后端 GET /api/public/activity' +
    '（routes/public/activity-stats.js+analytics/public-activity.js 纯读聚合零迁移：kpi 5 卡+trends 4 序列×30 天+contentTypes 4 型+' +
    'heatmap 6 时段×7 天（UTC 口径周一开头契约）+leaderboard+里程碑，公民里程碑 title=null PII 禁令、限流 pa:ip: 30/min）+' +
    '前端 IIFE 整体重写（state 缓存+失败绝不回退假数据+搜索实时过滤排行榜/里程碑+trends 切 metric 零重拉+range 药丸 .active 归 subnav.js 零触碰）+' +
    '四项钦定（KPI 第 5 卡条约签署→新公民数/内容分类分布→内容类型分布/死搜索接过滤/热力图装埋点攒数据）+' +
    '全站灯塔 site-config.js 尾（__slatiPvSent 每页一次守卫+slati_cid localStorage 一次性+sendBeacon 优先 fetch keepalive 兜底+' +
    'POST /api/analytics/pageview 全程 try/catch 静默）；FC 恒 v10.28.47.4；npm test 342/342+电池 activity 26/26（F1 静态锚/R9 无桩离线态先跑/R10' +
    ' localStorage 空旗/R11 sendBeacon 补 patch 记录）+舰队 42 套全绿（grep exit=1|💥 复核零命中；i18n 超时被杀 flake 独立复跑 34/34 销账）+' +
    '冒烟 60/60；镜像内容验证 47/47+48/48（两次构建各验一次、先验后推）；线上探针 activity 9/9（S1 静态+S2 形状+S3 range 族+S4 PII 禁令+' +
    'P1 页面值=端点值+P2 灯塔恰 1 条+P3 切 7d+E1 零异常）；digest sha256:3bbf9a13a785161d864cef5a0350f663e32c8147264a80727f00d481e5746cae（二次烘焙镜像=当前线上）；' +
    'commit 未 push；新坑：探针 P1/P3 按位比页面卡序≠端点 JSON 键序（页面第五卡=newCitizens 收尾、端点键序 newCitizens 第三位）——按语义键对齐；' +
    'rev 00327-n5s 瞬态→00328-c67 终态（live 文本 00327-n5s 烘焙、00328-c67 真值注记随 commit 滞后一部署=58.15 同款惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev 00328-c67（') !== -1 && read(f).indexOf('**前身 rev 00326-j6m（') !== -1 && read(f).indexOf('**当前线上 rev 00326-j6m（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.15；FC 当前 v10.28.47.4**。';
  step('versioning 58.15 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.16（小改动位 15→16·新功能轮；2026-09-29）**：动态页全部真实数据接入——用户「能不能先把动态页面的所有实际功能做一下？」；' +
    '真身=activity.html 六大区块全硬编码假数据+搜索框死输入+后端 analytics 引擎只 staff 路由用+page_views 空表无人上报；' +
    '修法=后端 GET /api/public/activity（纯读聚合零迁移：kpi/trends/contentTypes/heatmap/leaderboard/里程碑；公民里程碑 title=null PII 禁令；限流 pa:ip:）+' +
    '前端 IIFE 整体重写（缓存+失败绝不回退假数据+搜索实时过滤+切 metric 零重拉）+' +
    '四项钦定（KPI 第 5 卡条约签署→新公民数、内容分类分布→内容类型分布、死搜索接过滤、热力图装埋点攒数据+空态友好）+' +
    '全站灯塔 site-config 尾（每页一次守卫+sendBeacon 优先+fetch keepalive 兜底）；FC 恒 v10.28.47.4；' +
    'npm test 342/342+电池 activity 26/26+舰队 42 套全绿（grep exit=1|💥 零命中；i18n flake 独立复跑 34/34）+冒烟 60/60；' +
    '镜像内容验证 47/47+48/48（两次构建各验一次、先验后推）；线上探针 activity 9/9；digest sha256:3bbf9a13…；' +
    'commit 未 push，rev 00327-n5s→00328-c67（首部署瞬态 00327-n5s、二次烘焙重部署终态 00328-c67——live 文本 00327-n5s 滞后一部署=58.15 同款惯例））。' +
    '**站点号当前 v0.2.58.16；FC 当前 v10.28.47.4**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.16 条目+新尾指针在位', read(f).indexOf('v0.2.58.16（小改动位 15→16·新功能轮；2026-09-29）') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.16；FC 当前 v10.28.47.4**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+两处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  // 新行插在 58.15 行之后
  const anchor15 = '](2026-09-28-v025815-lvpill-hover.md)\n';
  step('MEMORY.md 58.15 行在位', s.indexOf(anchor15) !== -1);
  const newLine =
    '- [2026-09-29 — v0.2.58.16 动态页真实数据接入（rev 00327-n5s→00328-c67 commit 未 push）：「能不能先把动态页面的所有实际功能做一下？」——' +
    'activity.html 六大区块假数据全撤 IIFE 重写真数据（缓存+失败绝不回退假数据+搜索实时过滤+切 metric 零重拉）+后端 GET /api/public/activity 纯读聚合（公民里程碑 PII 匿名）+' +
    '四项钦定（条约签署→新公民/分类→内容类型/死搜索接过滤/热力图装埋点攒数据）+全站灯塔 site-config 尾；' +
    'npm test 342/342+电池 26/26+舰队 42 全绿（i18n flake 复跑 34/34）+冒烟 60/60+验证 47/47+48/48+探针 9/9；' +
    '新坑：探针按位比页面卡序≠端点 JSON 键序（按语义键对齐）、grep -c 同行双出现按行=1](2026-09-29-v025816-activity-real.md)\n';
  s = s.replace(anchor15, anchor15 + newLine);
  // backend-build-state 行「当前线上」指针
  const bbAnchor = '**当前线上 rev 00326-j6m（v0.2.58.15 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡；FC 恒 v10.28.47.4；commit a5125be 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev 00328-c67（v0.2.58.16 动态页真实数据接入；FC 恒 v10.28.47.4；commit 未 push）；详见 [[backend-build-state]]**');
  // site-versioning 行「当前」指针
  const svAnchor = '**当前：站点号 v0.2.58.15（58.15 药丸悬停放大+右侧滑出等级信息卡；rev 00326-j6m；commit a5125be 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.16（58.16 动态页真实数据接入；rev 00328-c67；commit 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-09-29-v025816-activity-real.md') !== -1 && s2.indexOf('当前线上 rev 00328-c67（v0.2.58.16') !== -1 && s2.indexOf('站点号 v0.2.58.16（58.16 动态页真实数据接入') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-09-29-v025816-activity-real.md';
  const body =
    '---\n' +
    'name: 2026-09-29-v025816-activity-real\n' +
    'description: v0.2.58.16 动态页真实数据接入轮（rev 00327-n5s→00328-c67 未 push）——activity.html 假数据全撤接 GET /api/public/activity、搜索过滤、全站 pageview 灯塔；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.16 — 动态页全部真实数据接入（2026-09-29）\n\n' +
    '用户「能不能先把动态页面的所有实际功能做一下？」。真身：activity.html 六大区块（KPI/趋势/分类/热力图/排行榜/里程碑）全是硬编码假数据，搜索胶囊是死的，' +
    '后端 analytics 引擎齐全但只有 staff 路由用，page_views 表全站无人上报。\n\n' +
    '**修法**（计划 8-tidy-rossum.md 四问钦定）：\n' +
    '- 后端：GET /api/public/activity（routes/public/activity-stats.js + analytics/public-activity.js 纯读聚合零迁移）。KPI 第 5 卡「条约签署」→**新公民数**（无 treaties 表）；' +
    '「内容分类分布」→**内容类型分布**（文章/帖子/评论/点赞真实计数）；公民里程碑 title=null（PII 禁令）；限流 pa:ip: 30/min。\n' +
    '- 前端 IIFE 整体重写：state 缓存+失败绝不回退假数据（renderOffline）+搜索实时过滤排行榜/里程碑+trends 切 metric 零重拉（缓存再渲）+range 药丸 .active 归 subnav.js 页面零触碰。\n' +
    '- 热力图：全站灯塔 site-config.js 尾（__slatiPvSent 每页一次+slati_cid 一次性+sendBeacon 优先 fetch keepalive 兜底 POST /api/analytics/pageview），空表友好空态保 6×7 形状。\n' +
    '- i18n：第 4 轮块 16 键 ×11 语手写+zh-Hant OpenCC 重生成；en 值=页面兜底串逐字节一致。\n\n' +
    '**验证全链**：npm test 342/342（+8 新案）｜电池 activity 26/26｜舰队 42 套全绿（grep exit=1|💥 零命中；i18n 超时被杀 flake 独立复跑 34/34）｜冒烟 60/60｜' +
    '镜像验证 47/47+48/48（两次构建各验一次、先验后推）｜线上探针 9/9。digest sha256:3bbf9a13…（二次烘焙=当前线上）。rev 00327-n5s 瞬态→00328-c67 终态。\n\n' +
    '**新坑**：\n' +
    '1. 探针 P1/P3 按位比对会红——页面卡序 [nations, citizens, articles, activity, newCitizens]（新公民收尾）≠端点 JSON 键序（newCitizens 第三位）——比对必须按语义键对齐。\n' +
    '2. grep -c 按行计数：`rev 00327-n5s` 同行双出现（占位+滞后注记）→ 期望 1 不是 2（mask-size 双写同款老坑）。\n' +
    '3. i18n 电池在 42 套舰队里超时被杀（exit=null 零失败但不完整）→ 独立复跑销账。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-09-28-v025815-lvpill-hover]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.16 — 动态页全部真实数据接入') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
