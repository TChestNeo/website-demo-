// tmp-update-memory-sheet-card2.js — v0.2.29.2 表格卡自动变长变宽轮记忆仪式（site-versioning-scheme.md 巨行精准替换，2026-09-11）
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/site-versioning-scheme.md';
const raw = fs.readFileSync(P, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let l = raw.split(/\r?\n/)[10];

const A1 = 'commit 2e245de 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
const B1 = 'commit 2e245de 未 push）；2026-09-11 v0.2.29.2 = 表格卡加行/加列自动变长变宽（补丁位 1→2·观感微调轮——用户「然后能不能在添加行/列的时候自动变长和宽啊」：+添加行 → rowSpan+1、+添加列 → colSpan+1，sheetGrow 读 dataset 现有跨度写回+setCardSize+刷手柄、跨度随草稿往返，种子 3 行/删光自补/恢复路径不增长；FC v10.28.19.2（补丁位 1→2）；零后端、ethereal 零改动无需 inline-css；探针 tmp-battery-sheet-card.js 21/21（F7+S7/S8/S9/S10/S12/S13 增补）；curl（health 58+v0.2.29.2+v10.28.19.2+编辑器 sheetGrow 三处在+index 200）；部署一次 exit 0（00187-t8w）；commit 55eba64 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';

const A2 = '当前 v10.28.19.1（已部署 rev 00186-s8z，2026-09-11 表格卡默认尺寸 宽10格×长7格轮·FC 侧=三处 8×5→10×7（补丁位 0→1）；commit 2e245de）';
const B2 = '当前 v10.28.19.2（已部署 rev 00187-t8w，2026-09-11 表格卡加行/加列自动变长变宽轮·FC 侧=sheetGrow 读 dataset 跨度+1 写回+setCardSize+刷手柄、种子/恢复不增长（补丁位 1→2）；commit 55eba64）；前身 v10.28.19.1（已部署 rev 00186-s8z，2026-09-11 表格卡默认尺寸 宽10格×长7格轮·FC 侧=三处 8×5→10×7（补丁位 0→1）；commit 2e245de）';

let cnt = 0;
for (const [a, b] of [[A1, B1], [A2, B2]]) {
  if (l.indexOf(a) === -1) { console.error('MISS:', a.slice(0, 50)); process.exit(1); }
  l = l.replace(a, b);
  cnt++;
}
const lines = raw.split(/\r?\n/);
lines[10] = l;
fs.writeFileSync(P, lines.join(eol), 'utf8');
console.log('OK 替换', cnt, '处；v0.2.29.2 条目在', l.indexOf('v0.2.29.2 = '), '；FC 头 v10.28.19.2 在', l.indexOf('当前 v10.28.19.2'));
