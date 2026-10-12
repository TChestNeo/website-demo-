// tmp-update-memory-v02813.js — v0.2.28.13 收尾锚点：backend-build-state.md 当前线上段 + site-versioning-scheme.md 链尾
'use strict';
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

// —— 1. backend-build-state.md：当前线上 rev 00180-49x → 00181-cm4，旧链整体转为前身 ——
const bs = M + '/backend-build-state.md';
let b = fs.readFileSync(bs, 'utf8');
const bsAnchor = '**当前线上 rev 00180-49x（';
const bsEntry = '**当前线上 rev 00181-cm4（2026-09-11 v0.2.28.13 Editor 按钮直入 FluidCanvas 编辑器+删旧文章编辑器——用户「为什么Editor按钮连接的不是 fluidcanvas-editor？」+「我都这么说了肯定是改去fluidcanvas-editor 然后把那个旧的删掉啊」：①sidebar.js Editor 项 href → ../pages/fluidcanvas-editor.html（getActiveId 的 editor 判断先于 fluidcanvas，高亮自动正确零改动）②transitions.js NAV_ORDER 键 editor.html:5 → fluidcanvas-editor.html:5（导航序不变）③git rm docs/pages/editor.html（113KB 旧 Markdown 文章编辑器，删除前全站引用仅 sidebar.js/transitions.js 两处均已置换清零；FC 编辑器访客送返 ?locked=1 门禁保留、可直入）④fluidcanvas-editor.html <title> 与 editor-header 头部「Article Editor」建页复制模板残留两处改「FluidCanvas Editor」；零后端；ethereal 零改动无需 inline-css；探针 tmp-hub-composer-probe.js 46/46（原 41 项全绿+F5 文件级四断言：sidebar.js 新 href 在旧链接除/transitions.js 新键在旧键除/editor.html 文件不存在/FC 编辑器标题头部新文案在旧文案除+S23 侧栏渲染 Editor 项 href=fluidcanvas-editor.html 且旧链接不存在+Z 零 console error）+curl（health 58+v0.2.28.13+editor.html 404+fluidcanvas-editor 200 新标题+sidebar.js 新 href+root/overview/hub 回归 200）；部署一次 exit 0（00181-cm4））；前身 rev 00180-49x（';
if (!b.includes(bsAnchor)) { console.log('❌ backend-build-state anchor not found'); process.exit(1); }
b = b.replace(bsAnchor, bsEntry);
fs.writeFileSync(bs, b);
console.log('✅ backend-build-state.md updated');

// —— 2. site-versioning-scheme.md：链尾 v0.2.28.12 条目后插 v0.2.28.13 ——
const sv = M + '/site-versioning-scheme.md';
let s = fs.readFileSync(sv, 'utf8');
const svAnchor = 'commit 741f078 未 push）';
if ((s.match(/commit 741f078/g) || []).length !== 1) { console.log('❌ site-versioning-scheme anchor count wrong'); process.exit(1); }
const svEntry = 'commit 741f078 未 push）；2026-09-11 v0.2.28.13 = Editor 按钮直入 FluidCanvas 编辑器 + 删除旧文章编辑器 editor.html（补丁位 12→13 口径修正轮——用户「为什么Editor按钮连接的不是 fluidcanvas-editor？」+「肯定是改去fluidcanvas-editor 然后把那个旧的删掉啊」：sidebar.js Editor 项 href 直入 fluidcanvas-editor.html、transitions.js NAV_ORDER 键换 fluidcanvas-editor.html:5、git rm 旧页（113KB 删除前引用两处已置换清零）、fluidcanvas-editor 标题/头部复制模板残留「Article Editor」改「FluidCanvas Editor」；getActiveId 高亮自动正确零改动；零后端、ethereal 零改动无需 inline-css；探针 46/46；rev 00181-cm4 commit a780406 未 push）';
s = s.replace(svAnchor, svEntry);
fs.writeFileSync(sv, s);
console.log('✅ site-versioning-scheme.md updated');
