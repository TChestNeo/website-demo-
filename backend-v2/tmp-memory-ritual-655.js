// tmp-memory-ritual-655.js — FC v10.28.60.0 装饰伸出矩形记忆仪式
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REAL88 = '00388-b2w';
const DIGEST = 'fd2df2422a06ccdf6bc0bfd086d979072e0bdd54d075bf4bd2d60ccfdc01624c';

// 1) build-state head
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00387-d9n（2026-10-07 FC v10.28.59.0 AI 边缘藏宝图式呈现；站点恒 v0.2.58.28）';
  if ((s.match(/当前线上 rev 00387-d9n/g) || []).length !== 1) throw new Error('head anchor');
  const NEW = '**当前线上 rev ' + REAL88 + '（2026-10-07 FC v10.28.60.0 自定义边缘装饰伸出矩形；站点恒 v0.2.58.28）' +
    '——用户「还是看不到，可能是那个矩形的 Mask 导致的，去掉」；' +
    '真身=装饰层 ::before/::after inset:0（矩形），背景只填满矩形、没伸出 1.4× 外扩——clip 是 1.4× 但背景只有矩形，被「矩形 mask」框住藏在图片后；' +
    '修法=clip 改回原多边形 e.clip，CSS 加 .card-edge-custom::before/::after inset:-20%（对应 CUSTOM_EDGE_SCALE=1.4）撑大装饰盒，clip 相对 1.4× 盒解析 → 剪影真的伸出矩形外一圈；' +
    '后端零改动 npm test 413/413；线上探针 5/5；digest sha256:' + DIGEST + '（当前线上）；commit 未 push；**前身 rev 00387-d9n（2026-10-07 FC v10.28.59.0 AI 边缘藏宝图式呈现；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) build-state ✓ ' + REAL88);
}
// 2) scheme 追加 + 指针
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.59.0**';
  if ((s.match(/FC 当前 v10\.28\.59\.0/g) || []).length !== 1) throw new Error('ptr anchor');
  const entry = '**FC v10.28.60.0（2026-10-07；小改动位 59→60 观感修复轮；rev ' + REAL88 + '；站点恒 v0.2.58.28）**：装饰伸出矩形——用户「矩形 mask 导致看不到」；修法=clip 改回 e.clip+CSS ::before/::after inset:-20%（1.4×盒）撑大装饰盒，clip 相对 1.4×盒解析→剪影真的伸出；后端零改动 npm test 413/413；线上探针 5/5；digest sha256:' + DIGEST + '（当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.60.0**');
  fs.writeFileSync(f, s);
  console.log('2) scheme ✓ 60.0');
}
// 3) MEMORY.md 顶行
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const line = '- [2026-10-07 — FC v10.28.60.0 装饰伸出矩形（rev ' + REAL88 + ' commit 未 push；站点恒 58.28）：clip 改回 e.clip+CSS ::before/::after inset:-20%（1.4×盒）——此前 1.4× clip 因背景只有矩形被「矩形 mask」框住；后端零改动 npm test 413/413；线上探针 5/5 见 [2026-10-07-fc-v1028600-maskrect.md](2026-10-07-fc-v1028600-maskrect.md)]\n';
  s = line + s;
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓');
}
// 4) 新记忆文件
{
  const f = P + '2026-10-07-fc-v1028600-maskrect.md';
  const body = '---\nname: 2026-10-07-fc-v1028600-maskrect\ndescription: FC v10.28.60.0 自定义边缘装饰伸出矩形（rev ' + REAL88 + ' commit 未 push；站点恒 58.28）\nmetadata:\n  node_type: memory\n  type: project\n  modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z\n---\n\n# FC v10.28.60.0 装饰伸出矩形（2026-10-07，已完成）\n\n**用户原话**：「还是看不到，可能是那个矩形的 Mask 导致的，去掉」\n\n**根因**：装饰层 ::before/::after 是 inset:0（矩形），背景只填满矩形、没伸出 1.4× 外扩——clip-path 虽是 1.4× 但背景只有矩形（背景绘画区=边框盒），被「矩形 mask」框住、藏在图片（z0）后看不见。\n\n**修法**：clip 改回原多边形 e.clip，CSS 加 .card-edge-custom::before/::after inset:-20%（对应 CUSTOM_EDGE_SCALE=1.4）撑大装饰盒，clip（0-100%）相对 1.4× 盒解析 → 剪影真的伸出矩形外一圈。\n\n**关键坑**：clip-path 的 % 坐标相对元素自身盒；要装饰「伸出」，必须把装饰盒也撑大（inset 负值）——只扩 clip-path 不扩盒是无用的（背景只填盒）。\n\n链条：[[2026-10-06-fc-v1028530-edgemask]] ← 本轮；[[site-versioning-scheme]]；[[backend-build-state]]。\n';
  fs.writeFileSync(f, body);
  console.log('4) 新记忆文件 ✓');
}
console.log('记忆仪式四处完成');
