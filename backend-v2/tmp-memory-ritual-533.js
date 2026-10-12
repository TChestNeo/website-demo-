// tmp-memory-ritual-533.js — v0.2.53.3 记忆仪式（backend-build-state head 换代 / scheme 链尾 / MEMORY.md 两指针）
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const NEW_HEAD_PREFIX =
  '**当前线上 rev 00258-7hf（2026-09-19 v0.2.53.3 左侧菜单底部空白面板去掉——用户「那个左侧菜单的底部背景能不能去掉？或者变成刚才给你的那个液态玻璃或者只保留那个用户卡片，logo卡片 还有菜单卡片？」（问询钦定「去掉空白面板（推荐）」；补丁位 2→3·观感修复轮）；后端零改动（user_version 27/health 59 表不变、测试 311/311）；前端只动 sidebar.js 菜单卡内联 style 去 flex:1 高度收为内容高——侧栏只剩 logo/用户/菜单三张卡、下方留纯色侧栏底（上轮钦定口径不动）、亮/暗两模式同生效（探针实证底部背景真身=菜单卡 flex:1 拉伸到屏幕底部，1080p 下菜单项下面空出约 280px 空白卡片背景；lg-specular 光晕层零触碰）；site-config v0.2.53.3+changelog；ethereal/inline-css/entrypoint 零改动（ethereal 零改动无需 inline-css）；FC v10.28.36.1 零改动；零草稿字段（v 保持 9）；电池：新 sidebar-bottom 11/11（S1-S4 静态+B1-B4 亮色三卡收内容高/下方零 painted/纯色底+D1-D3 暗色同口径；GEOM 判别式 高度-内容高≤6px）+十电池版本锚 53.2→53.3 同步+全回归绿（msg-anim 51+smoke-admin 48+pageswitch 23+notif-home 23+mono-flash 22+monodark 29+fadefix 36+msglink 15+cit2usr 21+sidebar-light 10+article-view 38+community-profile 99）；部署 exit 0（docker build 查 exit/容器内 grep 前端锚 sb-flex1-old 0+sb-shrink-new 1/push digest 前缀核对 28314af787c9/gcloud.ps1 env 30 条零新键）；curl 链全绿（health 59 表+db ok/无 cookie auth/me 401/site-config v0.2.53.3+v10.28.36.1 在线/sidebar.js 在线锚 v0.2.53.3×1+旧 flex:1×0+新收缩 style×1）；commit 6179872 未 push；**前身 rev 00257-jl2（2026-09-19 v0.2.53.2';

const OLD_HEAD_ANCHOR = '**当前线上 rev 00257-jl2（2026-09-19 v0.2.53.2';
const NOW = '2026-09-18T18:56:00.000Z';

// ═══ 1) backend-build-state.md：head 换代 + modified ═══
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const c1 = (s.match(/\*\*当前线上 rev 00257-jl2（2026-09-19 v0\.2\.53\.2/g) || []).length;
  if (c1 !== 1) throw new Error('build-state head anchor count=' + c1);
  s = s.replace(OLD_HEAD_ANCHOR, NEW_HEAD_PREFIX);
  s = s.replace(/modified: 2026-09-19T19:25:00\.000Z/, 'modified: ' + NOW);
  fs.writeFileSync(f, s);
  console.log('1) backend-build-state.md  ✓ head 换代 + modified ' + NOW);
}

// ═══ 2) site-versioning-scheme.md：L28 链尾追加 + modified ═══
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const tailAnchor = 'defs 零改动；电池版本锚 36.0→36.1 同步+全回归绿；commit 5f247a1 未 push。';
  const c2 = (s.match(/defs 零改动；电池版本锚 36\.0→36\.1 同步\+全回归绿；commit 5f247a1 未 push。/g) || []).length;
  if (c2 !== 1) throw new Error('scheme tail anchor count=' + c2);
  const entry =
    'v0.2.53.3（2026-09-19；补丁位 2→3 观感修复轮；rev 00258-7hf）= 左侧菜单底部空白面板去掉——用户「那个左侧菜单的底部背景能不能去掉？或者变成刚才给你的那个液态玻璃或者只保留那个用户卡片，logo卡片 还有菜单卡片？」（问询钦定「去掉空白面板（推荐）」）；探针实证底部背景真身=菜单卡 flex:1 拉伸到屏幕底部（1080p 下菜单项下面空出约 280px 空白卡片背景）；sidebar.js 菜单卡内联 style 去 flex:1 高度收为内容高——侧栏只剩 logo/用户/菜单三张卡、下方留纯色侧栏底（上轮钦定口径不动）、亮/暗两模式同生效；site-config v0.2.53.3+changelog；ethereal/inline-css/entrypoint 零改动（ethereal 零改动无需 inline-css）；后端零改动（user_version 27/health 59 表不变、测试 311/311）；FC v10.28.36.1 零改动；零草稿字段（v 保持 9）；电池：新 sidebar-bottom 11/11+十电池版本锚 53.2→53.3 同步+全回归绿；部署 exit 0（digest 前缀核对 28314af787c9）；curl 链全绿；commit 6179872 未 push。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  s = s.replace(/modified: 2026-09-18T18:24:07\.484Z/, 'modified: ' + NOW);
  fs.writeFileSync(f, s);
  console.log('2) site-versioning-scheme.md ✓ 链尾追加 + modified ' + NOW);
}

// ═══ 3) MEMORY.md：backend 行 head 段 + 版本口径行 ═══
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const c3 = (s.match(/\*\*当前线上 rev 00257-jl2（2026-09-19 v0\.2\.53\.2/g) || []).length;
  if (c3 !== 1) throw new Error('MEMORY backend row anchor count=' + c3);
  s = s.replace(OLD_HEAD_ANCHOR, NEW_HEAD_PREFIX);
  const oldVer = '**当前：站点号 v0.2.53.2（个人页卡片背景液态玻璃换代（生成器代码 glass-distortion）；补丁位 1→2 观感修复轮；rev 00257-jl2；commit 01b43de 未 push）、FC v10.28.36.1（零改动）**';
  const newVer = '**当前：站点号 v0.2.53.3（左侧菜单底部空白面板去掉；补丁位 2→3 观感修复轮；rev 00258-7hf；commit 6179872 未 push）、FC v10.28.36.1（零改动）**';
  if ((s.match(/站点号 v0\.2\.53\.2（个人页卡片背景液态玻璃换代/g) || []).length !== 1) throw new Error('version row anchor not unique');
  s = s.replace(oldVer, newVer);
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓ backend 行 head 段 + 版本口径行');
}
console.log('记忆仪式三处完成');
