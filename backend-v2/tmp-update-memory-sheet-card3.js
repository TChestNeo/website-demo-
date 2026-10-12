// tmp-update-memory-sheet-card3.js — v0.2.29.3 表格卡列宽/行高手柄轮记忆仪式（site-versioning-scheme.md 巨行精准替换，2026-09-11）
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/site-versioning-scheme.md';
const raw = fs.readFileSync(P, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let l = raw.split(/\r?\n/)[10];

const A1 = 'commit 55eba64 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
const B1 = 'commit 55eba64 未 push）；2026-09-11 v0.2.29.3 = 表格卡列宽/行高手柄（补丁位 2→3·观感微调轮——用户「能不能在每一列/行的外面再增加一个格子点击这个格子可以调整该行的长度该列的宽度」：每列上方 ↔、每行左侧 ↕（含表头行）按住拖动调整单列宽/单行高；colgroup 三截制+事件委托+拖卡白名单两处排除；sheetData 增 colW/rowH 随草稿往返（legacy 省略→默认等分）；FC v10.28.19.3（补丁位 2→3）；零后端、ethereal 零改动无需 inline-css；探针 tmp-battery-sheet-card.js 25/25（F8+S14+S15/S16 拖拽+S12 尺寸往返）；curl（health 58+v0.2.29.3+v10.28.19.3+编辑器手柄标记在+index 200）；部署一次 exit 0（00188-sts）；commit 3b55598 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';

const A2 = '当前 v10.28.19.2（已部署 rev 00187-t8w，2026-09-11 表格卡加行/加列自动变长变宽轮·FC 侧=sheetGrow 读 dataset 跨度+1 写回+setCardSize+刷手柄、种子/恢复不增长（补丁位 1→2）；commit 55eba64）';
const B2 = '当前 v10.28.19.3（已部署 rev 00188-sts，2026-09-11 表格卡列宽/行高手柄轮·FC 侧=每列 ↔ 每行 ↕ 按住拖动调整，colgroup 三截制，sheetData 增 colW/rowH 随草稿往返（补丁位 2→3）；commit 3b55598）；前身 v10.28.19.2（已部署 rev 00187-t8w，2026-09-11 表格卡加行/加列自动变长变宽轮·FC 侧=sheetGrow 读 dataset 跨度+1 写回+setCardSize+刷手柄、种子/恢复不增长（补丁位 1→2）；commit 55eba64）';

let cnt = 0;
for (const [a, b] of [[A1, B1], [A2, B2]]) {
  if (l.indexOf(a) === -1) { console.error('MISS:', a.slice(0, 50)); process.exit(1); }
  l = l.replace(a, b);
  cnt++;
}
const lines = raw.split(/\r?\n/);
lines[10] = l;
fs.writeFileSync(P, lines.join(eol), 'utf8');
console.log('OK 替换', cnt, '处；v0.2.29.3 条目在', l.indexOf('v0.2.29.3 = '), '；FC 头 v10.28.19.3 在', l.indexOf('当前 v10.28.19.3'));
