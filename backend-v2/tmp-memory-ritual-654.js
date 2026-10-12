// tmp-memory-ritual-654.js — FC v10.28.59.0 AI 边缘藏宝图式呈现记忆仪式
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REAL87 = '00387-d9n';
const DIGEST = '6c7c065355b484e482ff25219019f3fc8bd89b35258845e2d96274ab461a7b11';

// 1) build-state head
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00386-hsb（2026-10-07 FC v10.28.58.0 移除边缘 Mask 效果；站点恒 v0.2.58.28）';
  if ((s.match(/当前线上 rev 00386-hsb/g) || []).length !== 1) throw new Error('head anchor');
  const NEW = '**当前线上 rev ' + REAL87 + '（2026-10-07 FC v10.28.59.0 AI 边缘藏宝图式呈现；站点恒 v0.2.58.28）' +
    '——用户「参考藏宝图这个边缘的呈现代码，让 AI 生成部分的成品以一样的方式呈现」；' +
    '修法=customEdgeRecipe 照搬藏宝图渲染：clipSoft=TORN_CLIP_SOFT+cardLayers 加中性噪点 NOISE_CUSTOM（黑+alpha 0.30）+cardOverlay 两段暗角 radial-gradient+glow=inset 辉光+border 1px+radius 3px；' +
    '后端零改动 npm test 413/413；诊断 4/4（1.4×+噪点+暗角+inset 辉光）+线上探针 6/7（P5 标签软撕边属 caption/outer 路径，card 边缘不适用，与藏宝图同口径）；digest sha256:' + DIGEST + '（当前线上）；commit 未 push；**前身 rev 00386-hsb（2026-10-07 FC v10.28.58.0 移除边缘 Mask 效果；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) build-state ✓ ' + REAL87);
}
// 2) scheme 追加 + 指针
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.58.0**';
  if ((s.match(/FC 当前 v10\.28\.58\.0/g) || []).length !== 1) throw new Error('ptr anchor');
  const entry = '**FC v10.28.59.0（2026-10-07；小改动位 58→59 观感修复轮；rev ' + REAL87 + '；站点恒 v0.2.58.28）**：AI 边缘藏宝图式呈现——用户「参考藏宝图呈现代码」；修法=customEdgeRecipe 照搬藏宝图（clipSoft+中性噪点 NOISE_CUSTOM+暗角 overlay+inset 辉光+border+radius）；后端零改动 npm test 413/413；线上探针 6/7；digest sha256:' + DIGEST + '（当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.59.0**');
  fs.writeFileSync(f, s);
  console.log('2) scheme ✓ 59.0');
}
// 3) MEMORY.md 顶行
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const line = '- [2026-10-07 — FC v10.28.59.0 AI 边缘藏宝图式呈现（rev ' + REAL87 + ' commit 未 push；站点恒 58.28）：customEdgeRecipe 照搬藏宝图渲染（中性噪点 NOISE_CUSTOM+暗角+inset 辉光+border+radius+clipSoft）；后端零改动 npm test 413/413；线上探针 6/7 见 [2026-10-07-fc-v1028590-treasure.md](2026-10-07-fc-v1028590-treasure.md)]\n';
  s = line + s;
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓');
}
// 4) 新记忆文件
{
  const f = P + '2026-10-07-fc-v1028590-treasure.md';
  const body = '---\nname: 2026-10-07-fc-v1028590-treasure\ndescription: FC v10.28.59.0 AI 边缘藏宝图式呈现（rev ' + REAL87 + ' commit 未 push；站点恒 58.28）\nmetadata:\n  node_type: memory\n  type: project\n  modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z\n---\n\n# FC v10.28.59.0 AI 边缘藏宝图式呈现（2026-10-07，已完成）\n\n**用户原话**：「参考藏宝图这个边缘的呈现代码，让 AI 生成部分的成品以一样的方式呈现」\n\n**修法**：customEdgeRecipe 照搬藏宝图渲染——clipSoft=TORN_CLIP_SOFT、cardLayers 加中性噪点 NOISE_CUSTOM（黑+alpha 0.30，适配任何自动配色）、cardOverlay 两段暗角 radial-gradient、glow=inset 辉光、border 1px、radius 3px。\n\n**新坑**：recipe 的 clipSoft/border/radius 只在 applyCaptionBg（captionEdge）/applyOuterBg（outerEdge）路径应用到标签；card 边缘（cardEdge）不应用这些——与藏宝图同口径，非 bug。\n\n链条：[[2026-10-06-fc-v1028530-edgemask]] ← 本轮；[[site-versioning-scheme]]；[[backend-build-state]]。\n';
  fs.writeFileSync(f, body);
  console.log('4) 新记忆文件 ✓');
}
console.log('记忆仪式四处完成');
