// tmp-memory-ritual-652.js — FC v10.28.57.0 紫色=1.4×内容（同心矩形）记忆仪式
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REAL85 = '00385-n8k';
const DIGEST = 'c49640c3feb2b86841ce514403afb1b155a3dced2556e8281e0dc08440293a4d';

// 1) build-state head
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00384-2j9（2026-10-07 FC v10.28.56.1 紫色边框可见；站点恒 v0.2.58.28）';
  if ((s.match(/当前线上 rev 00384-2j9/g) || []).length !== 1) throw new Error('head anchor');
  const NEW = '**当前线上 rev ' + REAL85 + '（2026-10-07 FC v10.28.57.0 紫色=1.4×内容（同心矩形）；站点恒 v0.2.58.28）' +
    '——用户「希望紫色始终比原本的内容大 1.4 倍，像苹果 ConcentricRectangle 同心矩形，外围背景怎么变都始终在范围内」；' +
    '真身=56.1 固定内缩 3% 非比例关系；' +
    '修法=customEdgeRecipe 改 clip=expandClipPct(e.clip, CUSTOM_EDGE_SCALE-1)（SCALE=1.4 同心 1.4×缩放）、clipInner=clipRaw=e.clip（内容=原形）；移除「边缘外扩距离」滑杆（HTML/JS/草稿 edgeExpand/i18n expandDist ×12 语）；' +
    '后端零改动 npm test 413/413；线上探针 6/6；digest sha256:' + DIGEST + '（当前线上）；commit 未 push；**前身 rev 00384-2j9（2026-10-07 FC v10.28.56.1 紫色边框可见；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) build-state ✓ ' + REAL85);
}
// 2) scheme 追加 + 指针
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.56.1**';
  if ((s.match(/FC 当前 v10\.28\.56\.1/g) || []).length !== 1) throw new Error('ptr anchor');
  const entry = '**FC v10.28.57.0（2026-10-07；小改动位 56→57 观感修复轮；rev ' + REAL85 + '；站点恒 v0.2.58.28）**：紫色=1.4×内容（同心矩形）——用户「像苹果 ConcentricRectangle，紫色始终比内容大 1.4 倍」；修法=clip=expandClipPct(e.clip, SCALE-1)（SCALE=1.4）、clipInner=clipRaw=e.clip（内容原形）；移除外扩滑杆（HTML/JS/草稿/i18n ×12）；后端零改动 npm test 413/413；线上探针 6/6；digest sha256:' + DIGEST + '（当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.57.0**');
  fs.writeFileSync(f, s);
  console.log('2) scheme ✓ 57.0');
}
// 3) MEMORY.md 顶行
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const line = '- [2026-10-07 — FC v10.28.57.0 紫色=1.4×内容（同心矩形，rev ' + REAL85 + ' commit 未 push；站点恒 58.28）：CUSTOM_EDGE_SCALE=1.4 同心缩放、内容=原形、移除外扩滑杆；后端零改动 npm test 413/413；线上探针 6/6 见 [2026-10-07-fc-v1028570-concentric.md](2026-10-07-fc-v1028570-concentric.md)]\n';
  s = line + s;
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓');
}
// 4) 新记忆文件
{
  const f = P + '2026-10-07-fc-v1028570-concentric.md';
  const body = '---\nname: 2026-10-07-fc-v1028570-concentric\ndescription: FC v10.28.57.0 紫色=1.4×内容（同心矩形，rev ' + REAL85 + ' commit 未 push；站点恒 58.28）\nmetadata:\n  node_type: memory\n  type: project\n  modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z\n---\n\n# FC v10.28.57.0 紫色=1.4×内容（同心矩形，2026-10-07，已完成）\n\n**用户原话**：「希望紫色始终比原本的内容大 1.4 倍，像苹果的 ConcentricRectangle 同心矩形，外围背景怎么变都始终在范围内」\n\n**根因**：56.1 用固定内缩 3%（CUSTOM_EDGE_FRAME）非比例关系。\n\n**修法**：customEdgeRecipe 改 clip=expandClipPct(e.clip, CUSTOM_EDGE_SCALE-1)（SCALE=1.4 同心 1.4×缩放）、clipInner=clipRaw=e.clip（内容=原形）；移除「边缘外扩距离」滑杆（HTML fcEdgeExpandRow / JS setEdgeExpand / 草稿 edgeExpand / i18n expandDist ×12 语）。\n\n**新坑**：expandClipPct 的 f=比例-1（1.4×→f=0.4）；同心缩放用 % 坐标 50+(v-50)×(1+f) 天然围绕中心 50%。\n\n链条：[[2026-10-06-fc-v1028530-edgemask]] ← 本轮；[[site-versioning-scheme]]；[[backend-build-state]]。\n';
  fs.writeFileSync(f, body);
  console.log('4) 新记忆文件 ✓');
}
console.log('记忆仪式四处完成');
