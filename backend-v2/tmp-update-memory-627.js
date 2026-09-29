// tmp-update-memory-627.js — v0.2.58.21 记忆仪式：
//   ① backend-build-state.md 头旋转（REV2 新 head；00337-wxl 降前身）
//   ② site-versioning-scheme.md 追加 58.21 条目+当前指针
//   ③ MEMORY.md 新行+三处「当前」指针更新
//   ④ 新记忆文件 2026-09-30-v025821-sidebar-pop-settings.md
'use strict';
const REV1 = '00338-tj5';   // 部署#1 瞬态真 rev
const REV2 = '00339-m4j';   // 部署#2 终态真 rev
const DIGEST = 'sha256:9d408769085bc4a27b8d65e2c0f16ebb22ae196d5100fbef33560c2e9da8194e'; // 二次烘焙 push digest（=当前线上）
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
  const headAnchor = '**当前线上 rev 00337-wxl（';
  const demote = '**前身 rev 00337-wxl（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-09-30 v0.2.58.21 侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义——用户两连「能不能点击左侧用户卡片或头像时是弹出用户完整信息弹窗而不是跳转到主页，还有你根本就没有在设置里完成我要的用户头像和横幅的自定义功能 >:(」；' +
    '真身=sidebar.js 侧栏用户模块锚整页跳转+settings-modal.js 资料区相机按钮死按钮（无 id 无监听）；' +
    '三项钦定：①设置弹窗资料区直接放完整控件（头像预览+上传+FC 图库；横幅预览+上传+图库+移除；同步勾选；免费/付费 gif 门禁同款）改完即时生效不跳页 ②侧栏卡弹完整信息卡（横幅+头像+名字+公民号+性别+简介+订阅状态+关注/粉丝/帖子数+加入时间+编辑资料/查看主页两按钮）' +
    '③弹窗「编辑资料」→就地开设置弹窗不跳页；纯前端后端零改动 FC 恒 v10.28.48.0；' +
    '修法=sidebar.js openUserPop（两段式数据：本地 slati_user 即时渲染+异步 GET /social/users/:id 回填服务器真值新鲜度守卫+失败/离线统计 \'—\' 零回退假数据）+initUserPopWiring 锚保留（中键/ctrl/cmd/shift/alt 原生 href）左键 preventDefault+**e.stopPropagation() 拦 transitions.js document 层程序化导航**（location.href 赋值 preventDefault 拦不住——transitions.js 零改动不碰页面过渡动画）+popShow 显式 display:block（基态 display:none，\'\' 回落基态仍不可见=电池抓出的真实渲染 bug）+' +
    'settings-modal.js 资料区控件群（stUpload 统一链=gif 免费锁 toast+升级链接→白名单→10MB→POST /social/uploads→PATCH /auth/me 只 {avatarUrl}/{bannerUrl}/{bannerUrl:null}→ok 才改 UI+raw setItem 合并写 slati_user 绝不 SlatiDB.saveUser 双 PATCH 坑/stRawMergeUser/stPickFromLibrary 只收 data:/makeToggle 复用/隐藏 file input/免费层 sub-locked+两升级链接）；' +
    'i18n common 21 新键×12 语（zh-Hant OpenCC 重生成）；CSS 全进 sidebar.js/settings-modal.js ensureStyle 注入（ethereal 零改动→跳过 inline-css.js）；site-config 58.21 单 changelog（FC 恒 48.0 零条目）rev 前缀 ×1；' +
    '后端零改动 npm test 359/359 不重跑+新电池 sidebar-userpop 10/10+settings-profilecust 17/17+舰队 48 套全绿（首跑 5 红+1 崩：两新电池总结行 💔 假红+bannerfixed F3 弹窗默认渐变破坏「#4648d4,#3b3dc4 恰 2 处」冻结锚改 var(--color-primary, #4648d4),#3b3dc4 主题响应+tier-gating F2c「设置零订阅」改口径订阅恰 5 处+profile-banner S2 旧「点侧栏锚真导航」改弹窗→查看主页两段式+profile-subtier D10 ERR_NO_BUFFER_SPACE 负载 flake 独立复跑——6 套复跑全绿销账）+冒烟 60/60+i18n 34/34；' +
    '镜像内容验证两次构建各验一次先验后推（二次锚改终态口径 00338-tj5 真值在位+占位零残留；verify 100 项全绿）；线上探针 usercard 10/10（S1 静态五面+S1e rev 口径 00338- 真值+00339-??? 占位 live 滞后惯例/P1 CDP 真实点击侧栏卡弹窗不跳页+GET 404 静默统计 \'—\'/P2 齿轮开设置弹窗控件在位+free 层 sub-locked/E1 零异常）；' +
    'digest ' + DIGEST + '（二次烘焙镜像=当前线上）；commit 未 push；rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 文本滞后一部署=惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00337-wxl（') !== -1 && read(f).indexOf('**当前线上 rev 00337-wxl（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.20；FC 当前 v10.28.48.0**。';
  step('versioning 58.20 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.21（补丁位 20→21·新功能轮；2026-09-30；FC 恒 v10.28.48.0）**：侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义——用户两连「能不能点击左侧用户卡片或头像时是弹出用户完整信息弹窗而不是跳转到主页，还有你根本就没有在设置里完成我要的用户头像和横幅的自定义功能 >:(」；' +
    '三项钦定：①设置弹窗资料区直接放完整控件（头像预览+上传+FC 图库；横幅预览+上传+图库+移除；同步勾选；gif 门禁同款）即时生效不跳页 ②侧栏卡弹完整信息卡（横幅/头像/名字/公民号/性别/简介/订阅状态/统计/加入时间/两按钮）③「编辑资料」就地开设置弹窗；' +
    '修法=sidebar.js openUserPop 两段式数据（本地即时+GET 回填新鲜度守卫）+e.stopPropagation() 拦 transitions.js 程序化导航（preventDefault 拦不住 location.href 赋值——transitions.js 零改动）+settings-modal.js 资料区控件群（stUpload 统一链+PATCH 只发目标键+raw setItem 合并写绝不 SlatiDB.saveUser+图库只收 data:+free 层 sub-locked）；' +
    'i18n common 21 新键×12 语；ethereal 零改动→跳过 inliner；后端零改动 npm test 359/359 不重跑；' +
    '新电池 sidebar-userpop 10/10+settings-profilecust 17/17+舰队 48 套全绿（6 套复跑销账）+冒烟 60/60+i18n 34/34；镜像验证 ×2（两次构建各验一次先验后推）；线上探针 usercard 10/10；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.21；FC 当前 v10.28.48.0**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.21 条目+新尾指针在位', read(f).indexOf('v0.2.58.21（补丁位 20→21·新功能轮；2026-09-30') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.21；FC 当前 v10.28.48.0**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+三处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  const anchor20 = '](2026-09-30-v025820-avatar-sync.md)\n';
  step('MEMORY.md 58.20 行在位', s.indexOf(anchor20) !== -1);
  const newLine =
    '- [2026-09-30 — v0.2.58.21 侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义（rev ' + REV1 + '→' + REV2 + ' commit 未 push）：「能不能点击左侧用户卡片或头像时是弹出用户完整信息弹窗而不是跳转到主页，还有你根本就没有在设置里完成我要的用户头像和横幅的自定义功能 >:(」——' +
    '三项钦定（设置弹窗资料区完整控件/完整信息卡/编辑资料就地开设置弹窗）；修法=sidebar.js openUserPop 两段式+stopPropagation 拦 transitions.js 程序化导航（preventDefault 拦不住 location.href）+settings-modal stUpload 统一链+gif 门禁+raw setItem 绝不 SlatiDB.saveUser；' +
    '电池 10/10+17/17+舰队 48 全绿（6 套复跑销账）+冒烟 60/60+i18n 34/34+验证 ×2 先验后推+探针 10/10；' +
    '新坑：transitions.js 程序化导航须 e.stopPropagation()、popShow 显式 display:block（基态 none \'\' 回落不可见）、舰队 runner 💔 把总结行「PASS N / 💔 FAIL 0」计红（新电池总结改条件输出）、bannerfixed F3/tier-gating F2c 两冻结锚随新功能改口径、旧电池依赖旧交互（profile-banner 点侧栏锚真导航改两段式）、探针选择器写前先 grep 核实（#settingsProfileSec 不存在）](2026-09-30-v025821-sidebar-pop-settings.md)\n';
  s = s.replace(anchor20, anchor20 + newLine);
  const bbAnchor = '**当前线上 rev 00337-wxl（v0.2.58.20 个人资料头像↔FC 频道主页头像双向同步；FC v10.28.48.0；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（v0.2.58.21 侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义；FC 恒 v10.28.48.0；commit 未 push）；详见 [[backend-build-state]]**');
  const svAnchor = '**当前：站点号 v0.2.58.20（58.20 个人资料头像↔FC 频道主页头像双向同步；rev 00337-wxl；commit 未 push）、FC v10.28.48.0（48.0 频道卡头像图+点击换头像同轮；rev 00337-wxl；commit 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.21（58.21 侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义；rev ' + REV2 + '；commit 未 push）、FC v10.28.48.0（48.0 频道卡头像图+点击换头像同轮；rev 00337-wxl；commit 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-09-30-v025821-sidebar-pop-settings.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（v0.2.58.21') !== -1 && s2.indexOf('站点号 v0.2.58.21（58.21 侧栏用户卡片信息弹窗') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-09-30-v025821-sidebar-pop-settings.md';
  const body =
    '---\n' +
    'name: 2026-09-30-v025821-sidebar-pop-settings\n' +
    'description: v0.2.58.21 侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义轮（rev ' + REV1 + '→' + REV2 + ' 未 push）——设置弹窗资料区完整控件/完整信息卡/编辑资料就地开设置弹窗三项钦定；sidebar.js openUserPop 两段式+stopPropagation 拦 transitions.js 程序化导航；settings-modal stUpload 统一链+gif 门禁；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.21 — 侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义（2026-09-30）\n\n' +
    '用户两连「能不能点击左侧用户卡片或头像时是弹出用户完整信息弹窗而不是跳转到主页，还有你根本就没有在设置里完成我要的用户头像和横幅的自定义功能 >:(」。' +
    '真身：①sidebar.js 侧栏用户模块锚（.user-info-bar a href=community-profile.html?id=USR-xxx，22 页共用）点击整页跳转 ②settings-modal.js 资料区相机按钮是死的（无 id 无监听）——58.18-58.20 的头像/横幅自定义全只在资料页编辑弹窗。\n\n' +
    '**三项钦定**：①设置弹窗资料区直接放完整控件（头像预览+上传+FC 图库；横幅预览+上传+图库+移除；同步勾选 slati_avatar_sync；免费/付费 gif 门禁同款）改完即时生效不跳页 ②侧栏卡弹完整信息卡（横幅+头像+名字+公民号+性别+简介+订阅状态+关注/粉丝/帖子数+加入时间+「编辑资料」「查看主页」两按钮）③弹窗「编辑资料」→就地开设置弹窗（不跳页）。纯前端，后端零改动，FC 恒 v10.28.48.0。\n\n' +
    '**修法**（docs/assets/js/sidebar.js + docs/assets/js/settings-modal.js）：\n' +
    '- sidebar.js：initUserPopWiring 锚保留（中键/ctrl/cmd/shift/alt 原生 href）；左键 preventDefault + **e.stopPropagation() 拦 transitions.js document 层程序化导航**（transitions.js 拦所有锚点击 setTimeout 后 location.href 赋值——preventDefault 拦不住赋值；transitions.js 零改动=不触碰页面过渡动画家规）。' +
    'openUserPop 两段式数据：本地 slati_user 即时渲染（名字/公民号/tier 徽章 free 不显示/bio/性别）+异步 GET /api/social/users/:id 回填服务器真值（stats/createdAt/gender/bio/bannerUrl/avatarUrl）——回填按元素 id 原位替换+新鲜度守卫（userPopEls.bd===bd 弹窗仍开才写）；失败/离线=本地数据+统计 \'—\' 零回退假数据；' +
    '编辑资料=closeUserPop(true)+window.SlatiSettings.open()（无则兜底跳资料页）；查看主页=原 href 锚；关闭=X/backdrop/ESC；CSS ensureStyle 注入 #slati-user-pop-style 零 ethereal 改动。\n' +
    '- settings-modal.js 资料区控件群：stUpload(file,kind) 统一链=gif 免费层锁 toast+升级链接显→白名单 jpg/jpeg/png/gif/webp→≤10MB→POST /social/uploads?ext=→PATCH /auth/me 只 {avatarUrl} 或 {bannerUrl} 或 {bannerUrl:null}（移除语义）→ok 才改 UI（预览 src+侧栏 .user-module img.avatar 直改+toast 成功；全失败路径 toast failed 零状态回滚）；' +
    'stRawMergeUser raw setItem 合并写 slati_user（avatarUrl 且同步旗标 ON 时；**绝不 SlatiDB.saveUser**=storage.js mirrorProfile 双 PATCH 坑；bannerUrl 恒写）；stPickFromLibrary 只收 data: 条目（http(s) 后门钦定禁止）；makeToggle 复用；隐藏 file input 挂弹窗容器；免费层 .sub-locked+两升级链接；未登录/演示用户控件隐藏只读。\n' +
    '- i18n：common.i18n.js 21 新键×12 语（sidebar.pop ×6+settings.profile ×15；zh-Hant OpenCC 重生成；en 值=兜底串逐字节一致）。site-config：58.21 单 changelog 条目（FC 恒 48.0 零条目）→ rev 前缀 ×1（与 58.20 双条目 ×2 相反——sed 计数锚逐电池实测先行）。\n\n' +
    '**验证全链**：后端零改动 npm test 359/359 不重跑｜新电池 sidebar-userpop 10/10（U1 静态锚/U2 点击弹窗不跳页+DOM 全件/U3 GET 恰 1 回填/U4 离线统计 \'—\'/U5 编辑资料→SlatiSettings.open/U6 查看主页 href/U7 三路关闭/U8 演示用户零锚/E 零异常）+settings-profilecust 17/17（S0 静态/S1 弹窗控件/S2 头像上传 PATCH 恰 1 {avatarUrl}+同步 ON raw 合并写/S3 同步 OFF 零写 PATCH 照发/S4 gif+free 锁/S5 gif+premium 放行/S6 图库 free 锁 premium 放/S7 横幅上传+移除 {bannerUrl:null}/S8 toggle 写旗标/S9 演示用户隐藏/E 零异常）｜' +
    '舰队 48 套全绿（首跑 5 红+1 崩→6 套独立复跑全绿销账；grep exit=1|💥 复核零命中）｜冒烟 60/60｜i18n 34/34｜镜像验证两次构建各验一次先验后推（二次锚改终态口径 00338-tj5 真值在位+占位零残留）｜线上探针 usercard 10/10。\n' +
    'digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态。\n\n' +
    '**新坑**：\n' +
    '1. transitions.js 全局锚点击劫持（document 层 setTimeout 后 location.href 赋值）——preventDefault 拦不住程序化导航，必须在源头 handler e.stopPropagation() 让事件到不了 document 层（transitions.js 零改动=不触碰页面过渡动画家规）。\n' +
    '2. 电池抓出的真实渲染 bug：.slati-user-pop-joined CSS 基态 display:none，popShow display:\'\' 会回落基态仍不可见——必须显式 display:\'block\'（断言用 getComputedStyle 而非元素文本）。\n' +
    '3. 舰队 runner 💔 计数把电池总结行「PASS N / 💔 FAIL 0」的 💔 计红——新电池总结行改条件输出（FAIL>0 才印 💔，全绿印「🎉 全部通过 N/N」），与旧电池口径统一。\n' +
    '4. bannerfixed F3 冻结锚「sidebar.js #4648d4,#3b3dc4 恰 2 处」——新默认横幅渐变必须写 var(--color-primary, #4648d4),#3b3dc4（主题响应式且不含冻结子串），裸双色直写=第三处破坏锚。\n' +
    '5. tier-gating F2c「settings-modal 零订阅」随资料区 gif 门禁失效——改口径订阅恰 5 处（toast 兜底 ×2+订阅谓词注释+渲染注释+升级链接兜底），断言本意（Appearance 平台主题免费）保留。\n' +
    '6. 旧电池依赖旧交互行为：profile-banner S2 点侧栏锚真导航——58.21 改弹窗后 waitFor 超时崩（FATAL exit=1）；改两段式（弹窗断言+点 #userPopViewBtn 导航），新断言 +1 变 123/123。\n' +
    '7. 探针 P2 选择器 #settingsProfileSec 不存在（资料区无 id 裸 div）——同步勾选用 [data-i18n="settings.profile.avatarSync"] 父元素定位；写探针选择器前先 grep 核实 DOM 是铁律。\n' +
    '8. ERR_NO_BUFFER_SPACE = Chrome 资源加载负载 flake 家族（舰队并行多 Chrome 实例）——独立复跑销账，不改断言。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-09-30-v025820-avatar-sync]]、[[2026-09-30-v025819-profile-subtier]]、[[2026-09-29-v025818-profile-banner]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.21 — 侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
