// tmp-fix-memory-scheme.js — 补 site-versioning-scheme.md 链尾两条（v0.2.28.13 上轮静默空转 + v0.2.28.14 本轮）
'use strict';
const fs = require('fs');
const sv = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/site-versioning-scheme.md';
let s = fs.readFileSync(sv, 'utf8');
const anchor = 'rev 00180-49x commit 741f078）';
if ((s.match(/rev 00180-49x commit 741f078/g) || []).length !== 1) { console.log('❌ anchor count wrong: ' + (s.match(/rev 00180-49x commit 741f078/g) || []).length); process.exit(1); }
const entry = 'rev 00180-49x commit 741f078）；2026-09-11 v0.2.28.13 = Editor 按钮直入 FluidCanvas 编辑器 + 删除旧文章编辑器 editor.html（补丁位 12→13 口径修正轮——用户「为什么Editor按钮连接的不是 fluidcanvas-editor？」+「肯定是改去fluidcanvas-editor 然后把那个旧的删掉啊」：sidebar.js Editor 项 href 直入 fluidcanvas-editor.html、transitions.js NAV_ORDER 键换 fluidcanvas-editor.html:5、git rm 旧页（113KB 删除前引用两处已置换清零）、fluidcanvas-editor 标题/头部复制模板残留「Article Editor」改「FluidCanvas Editor」；getActiveId 高亮自动正确零改动；零后端、ethereal 零改动无需 inline-css；探针 46/46；rev 00181-cm4 commit a780406 未 push）；2026-09-11 v0.2.28.14 = 恢复 Migrate 两套按钮样式（补丁位 13→14 纯修复轮——用户「为什么fluidcanvas-editor右上角的Migrate按钮有bug？」：git 考古定位 v0.2.8.0 液态玻璃移植轮 4a01104 重写编辑器 head style 尾部误删 189→30 行，顶部 Migrate 钮 cssbuttons-io 紫渐变 + 弹窗 Uiverse 药丸自此裸奔；从 df70a76（v10.28.17.4 同轮修正终版）原样恢复 180 行含暗色覆写；零后端、ethereal 零改动；探针 12/12；rev 00182-m5b commit 6b4832d 未 push）';
s = s.replace(anchor, entry);
fs.writeFileSync(sv, s);
console.log('✅ site-versioning-scheme.md 补链完成');
console.log('验证: v0.2.28.13 =', (s.match(/v0\.2\.28\.13/g) || []).length, '| v0.2.28.14 =', (s.match(/v0\.2\.28\.14/g) || []).length);
