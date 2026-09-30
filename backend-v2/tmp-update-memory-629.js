// tmp-update-memory-629.js — v0.2.58.23 记忆仪式：
//   ① backend-build-state.md 头旋转（REV2 新 head；00341-hbw 降前身）
//   ② site-versioning-scheme.md 追加 58.23 条目+当前指针
//   ③ MEMORY.md 新行+三处「当前」指针更新
//   ④ 新记忆文件 2026-09-30-v025823-hover-prefetch.md
'use strict';
const REV1 = '00342-zsw';   // 部署#1 瞬态真 rev（部署后填真值）
const REV2 = '00343-gxb';   // 部署#2 终态真 rev（部署后填真值）
const DIGEST = 'sha256:2615d1780da7ed37ab4fcebd7aafe140c77b856eb6aac4bc675c974a21d98bb3'; // 二次烘焙 push digest（=当前线上，push 后填真值）
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
  const headAnchor = '**当前线上 rev 00341-hbw（';
  const demote = '**前身 rev 00341-hbw（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-09-30 v0.2.58.23 悬停预加载消除切页白闪——用户「为什么我在切换页面的时候会闪一下 然而我在抖音或者Youtube切换页面的时候并不会闪烁一下是不是没有做预先加载？」；' +
    '真身=本站是多页应用（每页独立 HTML，跳页=销毁旧文档冷下载新文档→白闪），抖音/YouTube 单页应用壳常驻不重建；此前全站零预加载（仅视频 preload 属性）；' +
    '钦定 A=悬停预加载：鼠标悬停站内链接 65ms 后 <link rel="prefetch" as="document"> 后台预下载目标页，点击导航命中预取缓存（本站 HTML/JS/CSS no-cache+ETag 也走 304 重校验、正文零传输）→ 白闪消；' +
    '修法=纯前端 transitions.js 新增悬停预取块（isInternal/isSamePage 复用+桌面 hover 门控 matchMedia 触屏自动关+Save-Data 省流量跳过+65ms 防误触+每链接一次性 dataset 守卫+鼠标移开取消计时器=快速扫过零预取+失败静默——切页动画/点击劫持/节奏时长缓动逐字零改动）；' +
    '后端零改动 npm test 359/359 不重跑、CSS 零改动→跳过 inline-css.js、i18n 零新键、FC 恒 v10.28.48.0；' +
    '新电池 prefetch 12/12（快扫零预取/悬停恰 1 预取/外链 mailto javascript #hash 同页全跳过/一次性守卫/点击导航过渡完好/saveData+触屏门控）+冒烟 60/60+i18n 34/34+舰队 49 套全绿（grep exit=1|💥 复核零命中）；' +
    '镜像内容验证两次构建各验一次先验后推（二次锚改终态口径 ' + REV1 + ' 真值在位+00342-XXX 占位零残留）；线上探针 prefetch 629 6/6（S1 静态锚+动画常量零触碰+S1d rev 终态口径/P1 CDP guest 真实悬停 500ms 恰 1 预取 link href/as 精确+不跳页/E1 零异常）；' +
    'digest ' + DIGEST + '（二次烘焙镜像=当前线上）；commit 未 push；rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 文本滞后一部署=惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00341-hbw（') !== -1 && read(f).indexOf('**当前线上 rev 00341-hbw（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.22；FC 当前 v10.28.48.0**。';
  step('versioning 58.22 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.23（补丁位 22→23·新功能轮；2026-09-30；FC 恒 v10.28.48.0）**：悬停预加载消除切页白闪——用户「为什么我在切换页面的时候会闪一下 然而我在抖音或者Youtube切换页面的时候并不会闪烁一下是不是没有做预先加载？」；' +
    '真身=本站多页应用（每页独立 HTML 跳页=销毁旧文档冷下载新文档→白闪），抖音/YouTube 单页壳常驻不重建；此前全站零预加载；' +
    '钦定 A=悬停预加载：悬停站内链接 65ms 后 <link rel="prefetch" as="document"> 后台预下载，点击命中预取缓存（no-cache+ETag 也走 304 重校验零传输）→ 白闪消；' +
    '修法=纯前端 transitions.js 悬停预取块（isInternal/isSamePage 复用+hover 门控触屏自动关+Save-Data 跳过+一次性 dataset 守卫+移开取消计时器+失败静默——切页动画/点击劫持逐字零改动）；' +
    '后端零改动、CSS 零改动→跳过 inliner、i18n 零新键；' +
    '电池 prefetch 12/12+冒烟 60/60+i18n 34/34+舰队 49 套全绿；镜像验证 ×2（两次构建各验一次先验后推）；线上探针 prefetch 629 6/6；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.23；FC 当前 v10.28.48.0**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.23 条目+新尾指针在位', read(f).indexOf('v0.2.58.23（补丁位 22→23·新功能轮；2026-09-30') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.23；FC 当前 v10.28.48.0**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+三处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  const anchor22 = '](2026-09-30-v025822-banner-tier-gold.md)\n';
  step('MEMORY.md 58.22 行在位', s.indexOf(anchor22) !== -1);
  const newLine =
    '- [2026-09-30 — v0.2.58.23 悬停预加载消除切页白闪（rev ' + REV1 + '→' + REV2 + ' commit 未 push）：「为什么我在切换页面的时候会闪一下 然而我在抖音或者Youtube切换页面的时候并不会闪烁一下是不是没有做预先加载？」——' +
    '真身=多页应用跳页销毁旧文档冷下载新文档→白闪（抖音/YouTube 单页壳常驻）；钦定 A=悬停预加载：悬停站内链接 65ms 后 <link rel="prefetch" as="document"> 预下载，点击命中缓存（no-cache+ETag 也走 304 零传输）→ 白闪消；' +
    '修法=纯前端 transitions.js 悬停预取块（hover 门控触屏自动关+Save-Data 跳过+一次性 dataset 守卫+移开取消计时器+失败静默——切页动画/点击劫持/节奏时长缓动逐字零改动）；后端零改动/CSS 零改动跳过 inliner/i18n 零新键/FC 恒 48.0；' +
    '电池 prefetch 12/12（快扫零预取/外链 mailto #hash 同页全跳过/saveData+触屏门控）+冒烟 60/60+i18n 34/34+舰队 49 全绿（grep exit=1|💥 复核零命中）+验证 ×2 先验后推+探针 prefetch 629 6/6（CDP guest 真实悬停恰 1 预取 link href/as 精确+不跳页）；' +
    '新坑：hover 目标需选第一个可见元素（width/height>0 扫描——登录态种子下 hero btn-lg 首个 explore 锚不可见）、悬停时序先预计算 away 点再 hover（evalJs 往返吃掉 65ms 窗口）、saveData 模拟 Object.defineProperty(Navigator.prototype,\'connection\')、matchMedia(\'(hover: hover)\') 覆写 matches:false](2026-09-30-v025823-hover-prefetch.md)\n';
  s = s.replace(anchor22, anchor22 + newLine);
  const bbAnchor = '**当前线上 rev 00341-hbw（v0.2.58.22 横幅订阅三层门禁+金罩+预设扩展；FC 恒 v10.28.48.0；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（v0.2.58.23 悬停预加载消除切页白闪；FC 恒 v10.28.48.0；commit 未 push）；详见 [[backend-build-state]]**');
  const svAnchor = '**当前：站点号 v0.2.58.22（58.22 横幅订阅三层门禁+金罩+预设扩展；rev 00341-hbw；commit 未 push）、FC v10.28.48.0（48.0 频道卡头像图+点击换头像同轮；rev 00337-wxl；commit 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.23（58.23 悬停预加载消除切页白闪；rev ' + REV2 + '；commit 未 push）、FC v10.28.48.0（48.0 频道卡头像图+点击换头像同轮；rev 00337-wxl；commit 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-09-30-v025823-hover-prefetch.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（v0.2.58.23') !== -1 && s2.indexOf('站点号 v0.2.58.23（58.23 悬停预加载') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-09-30-v025823-hover-prefetch.md';
  const body =
    '---\n' +
    'name: 2026-09-30-v025823-hover-prefetch\n' +
    'description: v0.2.58.23 悬停预加载消除切页白闪轮（rev ' + REV1 + '→' + REV2 + ' 未 push）——多页应用跳页白闪真身；transitions.js 悬停 65ms <link rel="prefetch" as="document"> 预下载；hover/saveData 双门控+一次性守卫+移开取消；切页动画逐字零改动；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.23 — 悬停预加载消除切页白闪（2026-09-30）\n\n' +
    '用户「为什么我在切换页面的时候会闪一下 然而我在抖音或者Youtube切换页面的时候并不会闪烁一下是不是没有做预先加载？」。\n\n' +
    '**真身**：本站是多页应用——每页独立 HTML 文档，跳页=销毁旧文档+冷下载新文档→白闪；抖音/YouTube 是单页应用（壳常驻、内容 JS 换、文档不重建）。本站此前全站零预加载（仅视频 preload 属性）。\n\n' +
    '**钦定**（AskUserQuestion）：A 悬停预加载——鼠标悬停站内链接 65ms 后注入 `<link rel="prefetch" as="document">` 后台预下载目标页，点击导航命中预取缓存。本站 HTML/JS/CSS 是 no-cache+ETag 服务，预取缓存仍对下一导航生效（304 重校验、正文零传输），因此零服务器改动。**纯隐形性能层：切页动画/点击劫持/节奏时长缓动逐字零改动**（[[transitions-animation-untouchable]] 家规）。\n\n' +
    '**修法**（docs/assets/js/transitions.js，368 行 IIFE 内新增悬停预取块）：\n' +
    '- `var prefetchTimer = null` + `prefetchPage(href)` 建 link 注入 head（try/catch 失败静默）；\n' +
    '- 双门控：`matchMedia(\'(hover: hover)\').matches`（触屏自动关）+ `!(navigator.connection && navigator.connection.saveData)`（省流量跳过）；\n' +
    '- `document.addEventListener(\'mouseover\')` → closest(\'a\') → href 过滤（复用 `isInternal` 跳过 http///#/mailto:/javascript: + `isSamePage` 同页跳过）→ `link.dataset.prefetchDone` 一次性守卫 → clearTimeout 后 65ms setTimeout（最后悬停者赢，快速扫过零预取）→ mouseleave `{once:true}` 取消计时器。\n' +
    '- 后端零改动（entrypoint.js no-cache 服务对预取安全）、CSS 零改动→跳过 inline-css.js、i18n 零新键、FC 恒 v10.28.48.0。site-config 58.23 单 changelog。\n\n' +
    '**验证全链**：新电池 tmp-battery-prefetch 12/12（S0 静态锚/S2 20ms 快扫零预取/S1 悬停 400ms 恰 1 预取 link href=pages/explore.html as=document/S3 外链+mailto+javascript 零/S4 #hash 零/S5 同页零/S6 重悬停仍 1=dataset 守卫/S7 点击导航 pathname+readyState complete+过渡完好/S8a saveData 覆写零/S8b matchMedia false 零/E 零异常）+冒烟 60/60+i18n 34/34｜舰队 49 套全绿（grep exit=1|💥 复核零命中）｜镜像验证两次构建各验一次先验后推（二次终态口径）｜线上探针 prefetch 629 6/6（S1 静态锚+动画常量 STAGGER_DELAY=60/LIGHT_STAGGER_DELAY=40/STAGGER_CAP=8 零触碰/S1d rev 终态口径/P1 CDP guest 真实悬停 500ms 恰 1 预取 link+不跳页/E1 零异常）。\n' +
    'digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态。\n\n' +
    '**新坑**：\n' +
    '1. 悬停目标必须选第一个可见元素：登录态种子下页首 hero btn-lg（DOM 第一 explore 锚）不可见，bBox 全零——hoverSelector 扫描 querySelectorAll 取 width>0&&height>0 者（电池首跑 💥 真身）。\n' +
    '2. 悬停时序先预计算 away 点：moveAway 经 evalJs 往返会吃掉 65ms 计时窗口（快扫测试变假红）——hover 前 `const s2away = await awayPoint()` 再直接 dispatch。\n' +
    '3. saveData 模拟：`Object.defineProperty(Navigator.prototype, \'connection\', {configurable:true, get:function(){return {saveData:true}}})`；触屏模拟：覆写 `matchMedia` 对 \'(hover: hover)\' 返回 matches:false。\n' +
    '4. no-cache 响应预取安全性：预取缓存对下一导航仍生效（304 重校验零正文传输），零服务器改动——entrypoint.js 属排除族不碰。\n' +
    '5. 切页动画家规红线：本性能轮只做隐形改动（后台预下载），动画/渐隐/节奏零触碰；fadefix/pageswitch 电池 presence 断言（indexOf）不受新增块影响。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[transitions-animation-untouchable]]、[[page-flash-fix]]、[[2026-09-30-v025822-banner-tier-gold]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.23 — 悬停预加载消除切页白闪') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
