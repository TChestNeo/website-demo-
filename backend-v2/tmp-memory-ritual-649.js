// tmp-memory-ritual-649.js — FC v10.28.55.0 AI 边缘/边框自动配色记忆仪式
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REAL82 = '00382-rm9';
const DIGEST = '91dd46c24549c3e1da69a1dffea5cd8ac682bb7010f0a962342ae3d33dc58dc3';

// 1) build-state head
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00381-xrv（2026-10-07 FC v10.28.54.0 边缘外扩距离滑杆+卡身透明；站点恒 v0.2.58.28）';
  const c1 = (s.match(/当前线上 rev 00381-xrv/g) || []).length;
  if (c1 !== 1) throw new Error('head anchor=' + c1);
  const NEW = '**当前线上 rev ' + REAL82 + '（2026-10-07 FC v10.28.55.0 AI 边缘/边框自动配色；站点恒 v0.2.58.28）' +
    '——用户「处理完之后能不能在 Ai 生成边缘/边框那边添加一个底层代码会根据图形或名称给边缘/边框添加自带颜色」；' +
    '真身=customEdgeRecipe 恒定紫渐变（所有自定义边缘/边框同色）；' +
    '修法=CUSTOM_EDGE_PALETTE 关键词色板（星=金/火=红橙/水浪=蓝/叶=绿/金=金黄/粉/雷=亮黄/暗/云=灰/紫=默认）+pickEdgeColor（名称关键词→无匹配按 clip 多边形哈希取色，同形状稳定同色）+edgeColorGradients（rgb→tint/layer 双透明度渐变）；customEdgeRecipe 改用 pickEdgeColor(e.name, e.clip)；' +
    '后端零改动 npm test 413/413；诊断 4/4（星星金/水浪蓝/无名哈希/颜色区分）+线上探针 5/5（S1 site-config 55.0+P1a 星星金+P1b 水浪蓝+P1c 颜色区分+E 零异常）；digest sha256:' + DIGEST + '（当前线上）；commit 未 push；**前身 rev 00381-xrv（2026-10-07 FC v10.28.54.0 边缘外扩距离滑杆+卡身透明；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) build-state ✓ ' + REAL82);
}
// 2) scheme 追加 + 指针
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.54.0**';
  if ((s.match(/FC 当前 v10\.28\.54\.0/g) || []).length !== 1) throw new Error('ptr anchor');
  const entry = '**FC v10.28.55.0（2026-10-07；小改动位 54→55 新功能轮；rev ' + REAL82 + '；站点恒 v0.2.58.28）**：AI 边缘/边框自动配色——用户「添加底层代码根据图形或名称给边缘/边框自带颜色」；修法=CUSTOM_EDGE_PALETTE 关键词色板+pickEdgeColor（名称关键词→形状哈希）+edgeColorGradients；后端零改动 npm test 413/413；线上探针 5/5；digest sha256:' + DIGEST + '（当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.55.0**');
  fs.writeFileSync(f, s);
  console.log('2) scheme ✓ 55.0');
}
// 3) MEMORY.md 顶行
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const line = '- [2026-10-07 — FC v10.28.55.0 AI 边缘/边框自动配色（rev ' + REAL82 + ' commit 未 push；站点恒 58.28）：CUSTOM_EDGE_PALETTE 关键词色板+pickEdgeColor（名称→形状哈希）给自定义边缘/边框自动配色；后端零改动 npm test 413/413；线上探针 5/5 见 [2026-10-07-fc-v1028550-edgecolor.md](2026-10-07-fc-v1028550-edgecolor.md)]\n';
  s = line + s;
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓');
}
// 4) 新记忆文件
{
  const f = P + '2026-10-07-fc-v1028550-edgecolor.md';
  const body = '---\nname: 2026-10-07-fc-v1028550-edgecolor\ndescription: FC v10.28.55.0 AI 边缘/边框自动配色（rev ' + REAL82 + ' commit 未 push；站点恒 58.28）\nmetadata:\n  node_type: memory\n  type: project\n  modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z\n---\n\n# FC v10.28.55.0 边缘/边框自动配色（2026-10-07，已完成）\n\n**用户原话**：「处理完之后能不能在 Ai 生成边缘/边框那边添加一个底层代码会根据图形或名称给边缘/边框添加自带颜色」\n\n**根因**：customEdgeRecipe 恒定紫渐变，所有自定义边缘/边框同色，不随名称/形状区分。\n\n**修法**：CUSTOM_EDGE_PALETTE 关键词色板（星=金/火=红橙/水浪=蓝/叶=绿/金=金黄/粉/雷=亮黄/暗/云=灰/紫=默认）+pickEdgeColor(name, clip)（名称关键词匹配→无匹配按 clip 多边形字符串哈希取色，同形状稳定同色）+edgeColorGradients(rgb)（rgb→tint/layer 双透明度渐变）；customEdgeRecipe 改用 pickEdgeColor(e.name, e.clip)。\n\n**新坑**：颜色按名称计算（apply 时派生），改名称会换色——当前名称是 AI 生成时固定的，稳定。\n\n链条：[[2026-10-06-fc-v1028530-edgemask]] ← 本轮；[[site-versioning-scheme]]；[[backend-build-state]]。\n';
  fs.writeFileSync(f, body);
  console.log('4) 新记忆文件 ✓');
}
console.log('记忆仪式四处完成');
