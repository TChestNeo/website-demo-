// tmp-update-memory-sheet-card.js — v0.2.29.1 表格卡 10×7 微调轮记忆仪式（site-versioning-scheme.md 巨行精准替换，2026-09-11）
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/site-versioning-scheme.md';
const raw = fs.readFileSync(P, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let l = raw.split(/\r?\n/)[10];

const A1 = 'commit d6beec9 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
const B1 = 'commit d6beec9 未 push）；2026-09-11 v0.2.29.1 = 表格卡默认尺寸 8×5 → 宽10格×长7格（补丁位 0→1·观感微调轮——用户「那个卡片大小能不能是默认长7格宽10格」：工厂默认 spanW||10/spanH||7 + assetSpan {w:10,h:7}（拖放同尺寸）+ 草稿恢复兜底 10/7 三处同改；FC v10.28.19.1（补丁位 0→1）；零后端、ethereal 零改动无需 inline-css；探针 tmp-battery-sheet-card.js 20/20（断言更新至 10×7）；curl（health 58+v0.2.29.1+v10.28.19.1+编辑器三处在+index 200）；部署一次 exit 0（00186-s8z）；commit 2e245de 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';

const A2 = '当前 v10.28.19（已部署 rev 00185-9f5，2026-09-11 表格卡 Sheet Card 轮·FC 侧=新卡片族第 7 型可编辑表格（wiki 表格迁移目标，小更新位 18→19）；commit d6beec9）；前身 v10.28.18.1（已部署 rev 00060-h5d，2026-09-03 液态玻璃撤销轮';
const B2 = '当前 v10.28.19.1（已部署 rev 00186-s8z，2026-09-11 表格卡默认尺寸 宽10格×长7格轮·FC 侧=三处 8×5→10×7（补丁位 0→1）；commit 2e245de）；前身 v10.28.19（已部署 rev 00185-9f5，2026-09-11 表格卡 Sheet Card 轮·FC 侧=新卡片族第 7 型可编辑表格（wiki 表格迁移目标，小更新位 18→19）；commit d6beec9）；前身 v10.28.18.1（已部署 rev 00060-h5d，2026-09-03 液态玻璃撤销轮';

let cnt = 0;
for (const [a, b] of [[A1, B1], [A2, B2]]) {
  if (l.indexOf(a) === -1) { console.error('MISS:', a.slice(0, 50)); process.exit(1); }
  l = l.replace(a, b);
  cnt++;
}
const lines = raw.split(/\r?\n/);
lines[10] = l;
fs.writeFileSync(P, lines.join(eol), 'utf8');
console.log('OK 替换', cnt, '处；v0.2.29.1 条目在', l.indexOf('v0.2.29.1 = '), '；FC 头 v10.28.19.1 在', l.indexOf('当前 v10.28.19.1'));
