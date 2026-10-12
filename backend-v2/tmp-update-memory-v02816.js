// tmp-update-memory-v02816.js — v0.2.28.16 收尾锚点：site-versioning-scheme.md 链尾 + MEMORY.md 双指针
'use strict';
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

// —— 1. site-versioning-scheme.md：链尾 v0.2.28.15 条目后插 v0.2.28.16 ——
const sv = M + '/site-versioning-scheme.md';
let s = fs.readFileSync(sv, 'utf8');
if ((s.match(/v0\.2\.28\.16 = FluidCanvas/g) || []).length === 0) {
  const svAnchor = 'rev 00183-wmg commit 1d7e823 未 push）';
  if ((s.match(/rev 00183-wmg commit 1d7e823/g) || []).length !== 1) { console.log('❌ site-versioning-scheme anchor count wrong: ' + (s.match(/rev 00183-wmg commit 1d7e823/g) || []).length); process.exit(1); }
  const svEntry = 'rev 00183-wmg commit 1d7e823 未 push）；2026-09-11 v0.2.28.16 = FluidCanvas 主题色适配（补丁位 15→16 修复轮——用户「FuildCanvas怎么还没做主题色的适配？我现在明明设置是黑白主题」：真身=FC 两页从未加载 settings-modal.js → data-accent 不落、mono 规则从未注入；两页 site-config 后接入 + settings-modal.js 新 mono 规则块约 55 行（次色家族亮 #4a4a56/暗 #b0b0c2、FC 组件硬编码蓝紫逐项翻黑白：publish-btn 黑灰→暗纯黑族 #1e1e2d→#32324a 白字、channelOverview 内联渐变 !important 去蓝、channel-avatar 暗色纯黑族 !important 压内联）+ JS 模板 var 化（TYPE_META.article/Articles 指标）；blue 零影响、零后端、ethereal 零改动无需 inline-css；探针 43/43（踩坑：本机 Chrome CSS.enable 要求 DOM 先 enable、content 视图惰性初始化先点导航、0.15s border 过渡竞态）；rev 00184-7sw commit 16aa6d2 未 push）';
  s = s.replace(svAnchor, svEntry);
  fs.writeFileSync(sv, s);
  console.log('✅ site-versioning-scheme.md updated（v0.2.28.16 计数 ' + (s.match(/v0\.2\.28\.16/g) || []).length + '）');
} else { console.log('ℹ site-versioning-scheme.md 已含 v0.2.28.16 条目，跳过'); }

// —— 2. MEMORY.md：backend-build-state 指针 00183-wmg → 00184-7sw ——
const mm = M + '/MEMORY.md';
let m = fs.readFileSync(mm, 'utf8');
const mmAnchor1 = '**当前线上 rev 00183-wmg（';
if ((m.match(/\*\*当前线上 rev 00183-wmg（/g) || []).length !== 1) { console.log('❌ MEMORY.md bs anchor count wrong: ' + (m.match(/\*\*当前线上 rev 00183-wmg（/g) || []).length); process.exit(1); }
const mmEntry1 = '**当前线上 rev 00184-7sw（2026-09-11 v0.2.28.16 FluidCanvas 主题色适配——用户「FuildCanvas怎么还没做主题色的适配？我现在明明设置是黑白主题」：真身=FC 两页从未加载 settings-modal.js → data-accent 不落、mono 规则从未注入；两页接入 + settings-modal.js 新 mono 规则块约 55 行（FC 组件硬编码蓝紫逐项翻黑白、次色家族亮 #4a4a56/暗 #b0b0c2、channelOverview/channel-avatar !important 压内联）+ JS 模板 var 化；blue 零影响、零后端、ethereal 零改动无需 inline-css；探针 43/43（踩坑：本机 Chrome CSS.enable 要求 DOM 先 enable、content 视图惰性初始化、0.15s border 过渡竞态）；rev 00184-7sw commit 16aa6d2 未 push；每轮 rev 全量链见 [[backend-build-state]]）**；前身 rev 00183-wmg（';
m = m.replace(mmAnchor1, mmEntry1);

// —— 3. MEMORY.md：site-versioning 指针 v0.2.28.14 → v0.2.28.16（上轮指针未随 28.15 更新，本轮一并追上） ——
const mmAnchor2 = '站点号当前 **v0.2.28.15**（2026-09-11 Migrate 按钮定制——补丁位 14→15 观感微调轮；①大小对齐旁边 .btn-sm（高度 38px——邻钮 .btn-outline 1px 边框 38px 等值对齐）②药丸形 radius-full ③横扫面板黑→白（#fff 亮/暗一致）④字母黑白相反滤镜——span 静息 invert(1) 黑字压白面板、悬停 invert(0) 面板滑离同步翻白字、0.4s 同曲线丝滑；零后端、ethereal 零改动无需 inline-css；探针 8/8；rev 00183-wmg commit 1d7e823 未 push）';
if ((m.match(/站点号当前 \*\*v0\.2\.28\.15\*\*/g) || []).length !== 1) { console.log('❌ MEMORY.md sv anchor count wrong: ' + (m.match(/站点号当前 \*\*v0\.2\.28\.15\*\*/g) || []).length); process.exit(1); }
const mmEntry2 = '站点号当前 **v0.2.28.16**（2026-09-11 FluidCanvas 主题色适配——补丁位 15→16 纯修复轮；真身=FC 两页从未加载 settings-modal.js → data-accent 不落、黑白主题色全失效；两页接入 + mono 规则块约 55 行 + JS 模板 var 化；blue 零影响；零后端、ethereal 零改动无需 inline-css；探针 43/43；rev 00184-7sw commit 16aa6d2 未 push）';
m = m.replace(mmAnchor2, mmEntry2);
fs.writeFileSync(mm, m);
console.log('✅ MEMORY.md updated（00184 计数 ' + (m.match(/00184-7sw/g) || []).length + '、v0.2.28.16 计数 ' + (m.match(/v0\.2\.28\.16/g) || []).length + '）');
