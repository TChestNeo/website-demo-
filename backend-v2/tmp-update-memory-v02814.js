// tmp-update-memory-v02814.js — v0.2.28.14 收尾锚点：backend-build-state.md 当前线上段 + site-versioning-scheme.md 链尾
'use strict';
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

// —— 1. backend-build-state.md：当前线上 rev 00181-cm4 → 00182-m5b，旧链整体转为前身 ——
const bs = M + '/backend-build-state.md';
let b = fs.readFileSync(bs, 'utf8');
const bsAnchor = '**当前线上 rev 00181-cm4（';
const bsEntry = '**当前线上 rev 00182-m5b（2026-09-11 v0.2.28.14 恢复 Migrate 两套按钮样式——用户「为什么fluidcanvas-editor右上角的Migrate按钮有bug？」：git 考古定位 v0.2.8.0 液态玻璃移植轮（4a01104）重写编辑器 head style 尾部时把 Migrate 两套按钮样式整块误删（189→30 行）——顶部 Migrate 钮 cssbuttons-io 紫渐变（v10.28.17.4 用户钦定）+ 弹窗 Migrate to Cards Uiverse 药丸（v10.28.17.3）自此裸奔成默认按钮；修法=从 df70a76（v10.28.17.4 同轮修正终版）原样恢复 180 行样式块（含暗色主题覆写）插入 .fc-locked-hero 块后；零后端、ethereal 零改动无需 inline-css；新探针 tmp-migrate-restore-probe.js 12/12（顶部钮紫渐变+悬停横扫 translateX 172px+按下 0.95+点击开弹窗；药丸结构+悬停放大 1.1 紫环 6px+暗色翻浅 #f2f1fb 星芒深紫+零 console error；教训：悬停/主题切换断言踩 --active 回落 transition 竞态等待 700ms）+curl（health 58+v0.2.28.14+编辑器页样式块各在+回归 200）；部署一次 exit 0（00182-m5b））；前身 rev 00181-cm4（';
if (!b.includes(bsAnchor)) { console.log('❌ backend-build-state anchor not found'); process.exit(1); }
b = b.replace(bsAnchor, bsEntry);
fs.writeFileSync(bs, b);
console.log('✅ backend-build-state.md updated');

// —— 2. site-versioning-scheme.md：链尾 v0.2.28.13 条目后插 v0.2.28.14 ——
const sv = M + '/site-versioning-scheme.md';
let s = fs.readFileSync(sv, 'utf8');
const svAnchor = 'commit a780406 未 push）';
if ((s.match(/commit a780406/g) || []).length !== 1) { console.log('❌ site-versioning-scheme anchor count wrong'); process.exit(1); }
const svEntry = 'commit a780406 未 push）；2026-09-11 v0.2.28.14 = 恢复 Migrate 两套按钮样式（补丁位 13→14 纯修复轮——用户「为什么fluidcanvas-editor右上角的Migrate按钮有bug？」：git 考古定位 v0.2.8.0 液态玻璃移植轮 4a01104 重写编辑器 head style 尾部误删 189→30 行，顶部 Migrate 钮 cssbuttons-io 紫渐变 + 弹窗 Uiverse 药丸自此裸奔；从 df70a76（v10.28.17.4 同轮修正终版）原样恢复 180 行含暗色覆写；零后端、ethereal 零改动；探针 12/12；rev 00182-m5b commit 6b4832d 未 push）';
s = s.replace(svAnchor, svEntry);
fs.writeFileSync(sv, s);
console.log('✅ site-versioning-scheme.md updated');
