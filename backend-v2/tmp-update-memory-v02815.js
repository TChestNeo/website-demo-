// tmp-update-memory-v02815.js — v0.2.28.15 收尾锚点：backend-build-state.md 当前线上段 + site-versioning-scheme.md 链尾
'use strict';
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

// —— 1. backend-build-state.md：当前线上 rev 00182-m5b → 00183-wmg，旧链整体转为前身 ——
const bs = M + '/backend-build-state.md';
let b = fs.readFileSync(bs, 'utf8');
const bsAnchor = '**当前线上 rev 00182-m5b（';
const bsEntry = '**当前线上 rev 00183-wmg（2026-09-11 v0.2.28.15 Migrate 按钮定制——用户「大小能不能和旁边的按钮匹配一下然后能不能改成药丸形…滑出的颜色改成白色…字母黑白相反滤镜」：①大小对齐旁边 .btn-sm（font-size var(--fs-label-sm)、span padding 7px 16px、svg 24px、margin 8px，高度 38px 与 History/Tags/Save Draft/Publish 一致——邻钮 .btn-outline 含 1px 边框 38px，migrate 无边框用 7px 上下垫等值对齐，首版 6px 垫=36px 被探针 S1 撞出）②改药丸形（border-radius: var(--radius-full)，与邻居 .btn 同）③横扫面板黑→白（#fff，亮/暗主题一致——两主题对顶部钮零覆写）④字母挂黑白相反滤镜——span 静息 filter:invert(1) 白字反转成黑字压在白色面板上、悬停 invert(0) 面板滑离时同步翻回白字、0.4s 与面板横扫同曲线同步丝滑换色；零后端、ethereal 零改动无需 inline-css；新探针 tmp-migrate-btn-v02815-probe.js 8/8（F1 静态定制块/S1 尺寸对齐/S2 静息药丸+invert(1)+白面板+skew/S3 悬停横扫+滤镜同步翻回/S4 按下 0.95/S5 弹窗回归/S6 暗色一致/Z 零报错；教训：filter:invert(0) 悬停终值序列化 invert(0)/none 两可，断言按两可收）+curl（health 58+v0.2.28.15+编辑器页 invert(1)/invert(0)/白面板/药丸/7px 垫各在+root/overview 回归 200）；部署一次 exit 0（00183-wmg）；docker 登录踩 PS 管道换行坑（--password-stdin 被拒→-p 直传成功）+空 auths 条目盖过 wincred 再清）；前身 rev 00182-m5b（';
if (!b.includes(bsAnchor)) { console.log('❌ backend-build-state anchor not found'); process.exit(1); }
b = b.replace(bsAnchor, bsEntry);
fs.writeFileSync(bs, b);
console.log('✅ backend-build-state.md updated');

// —— 2. site-versioning-scheme.md：链尾 v0.2.28.14 条目后插 v0.2.28.15 ——
const sv = M + '/site-versioning-scheme.md';
let s = fs.readFileSync(sv, 'utf8');
const svAnchor = 'rev 00182-m5b commit 6b4832d 未 push）';
if ((s.match(/rev 00182-m5b commit 6b4832d/g) || []).length !== 1) { console.log('❌ site-versioning-scheme anchor count wrong: ' + (s.match(/rev 00182-m5b commit 6b4832d/g) || []).length); process.exit(1); }
const svEntry = 'rev 00182-m5b commit 6b4832d 未 push）；2026-09-11 v0.2.28.15 = Migrate 按钮定制（补丁位 14→15 观感微调轮——用户「大小能不能和旁边的按钮匹配一下然后能不能改成药丸形…滑出的颜色改成白色…字母黑白相反滤镜」：①大小对齐旁边 .btn-sm（fs-label-sm/7px 16px 垫/svg 24px/高度 38px——邻钮 .btn-outline 1px 边框 38px 等值对齐）②药丸形 radius-full ③横扫面板黑→白（#fff 亮/暗一致）④字母黑白相反滤镜——span 静息 invert(1) 黑字压白面板、悬停 invert(0) 面板滑离同步翻白字、0.4s 同曲线丝滑；零后端、ethereal 零改动；探针 8/8；rev 00183-wmg commit 1d7e823 未 push）';
s = s.replace(svAnchor, svEntry);
fs.writeFileSync(sv, s);
console.log('✅ site-versioning-scheme.md updated');
console.log('验证: v0.2.28.15 =', (s.match(/v0\.2\.28\.15/g) || []).length);
