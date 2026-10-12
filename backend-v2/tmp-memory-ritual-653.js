// tmp-memory-ritual-653.js — FC v10.28.58.0 移除边缘 Mask 效果记忆仪式
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REAL86 = '00386-hsb';
const DIGEST = '08876688ac897b718496edd67714a1ef12cfe7b0e20e9d3a4a4122731eb521fb';

// 1) build-state head
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00385-n8k（2026-10-07 FC v10.28.57.0 紫色=1.4×内容（同心矩形）；站点恒 v0.2.58.28）';
  if ((s.match(/当前线上 rev 00385-n8k/g) || []).length !== 1) throw new Error('head anchor');
  const NEW = '**当前线上 rev ' + REAL86 + '（2026-10-07 FC v10.28.58.0 移除边缘 Mask 效果；站点恒 v0.2.58.28）' +
    '——用户「能不能去掉那个 Mask 效果」——图片不再被裁进边缘形状、恢复完整矩形，紫色边缘装饰（1.4×同心）保留；' +
    '修法=移除内容层 clip-path（CSS .card-img-bg/.card-stripes）+applyCardBg --card-mask-clip 写入+「图片与边缘同步」勾选节（HTML/JS setEdgeMaskSync/renderEdgeMaskSec）+草稿 edgeMask+i18n fc.edge.maskSync ×12 语+recipe clipInner/clipRaw 死代码；删 edgemask 电池（其测的 Mask 已移除）；' +
    '后端零改动 npm test 413/413；线上探针 5/5；digest sha256:' + DIGEST + '（当前线上）；commit 未 push；**前身 rev 00385-n8k（2026-10-07 FC v10.28.57.0 紫色=1.4×内容（同心矩形）；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) build-state ✓ ' + REAL86);
}
// 2) scheme 追加 + 指针
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.57.0**';
  if ((s.match(/FC 当前 v10\.28\.57\.0/g) || []).length !== 1) throw new Error('ptr anchor');
  const entry = '**FC v10.28.58.0（2026-10-07；小改动位 57→58 观感修复轮；rev ' + REAL86 + '；站点恒 v0.2.58.28）**：移除边缘 Mask 效果——用户「去掉那个 Mask」；图片恢复完整矩形、紫色边缘（1.4×同心）保留；删 clip-path 规则+勾选节+草稿 edgeMask+i18n maskSync ×12+clipInner/clipRaw 死代码+edgemask 电池；后端零改动 npm test 413/413；线上探针 5/5；digest sha256:' + DIGEST + '（当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.58.0**');
  fs.writeFileSync(f, s);
  console.log('2) scheme ✓ 58.0');
}
// 3) MEMORY.md 顶行
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const line = '- [2026-10-07 — FC v10.28.58.0 移除边缘 Mask 效果（rev ' + REAL86 + ' commit 未 push；站点恒 58.28）：图片恢复完整矩形、紫色 1.4×同心边缘保留；删 clip-path+勾选节+edgeMask+i18n maskSync ×12+edgemask 电池；后端零改动 npm test 413/413；线上探针 5/5 见 [2026-10-07-fc-v1028580-removemask.md](2026-10-07-fc-v1028580-removemask.md)]\n';
  s = line + s;
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓');
}
// 4) 新记忆文件
{
  const f = P + '2026-10-07-fc-v1028580-removemask.md';
  const body = '---\nname: 2026-10-07-fc-v1028580-removemask\ndescription: FC v10.28.58.0 移除边缘 Mask 效果（rev ' + REAL86 + ' commit 未 push；站点恒 58.28）\nmetadata:\n  node_type: memory\n  type: project\n  modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z\n---\n\n# FC v10.28.58.0 移除边缘 Mask 效果（2026-10-07，已完成）\n\n**用户原话**：「能不能去掉那个 Mask 效果」\n\n**修法**：图片不再被裁进边缘形状、恢复完整矩形显示，紫色边缘装饰（1.4×同心）保留。移除：CSS .card-img-bg/.card-stripes clip-path 规则、applyCardBg --card-mask-clip 写入、「图片与边缘同步」勾选节（HTML fcEdgeMaskSec/JS setEdgeMaskSync/renderEdgeMaskSec）、草稿 edgeMask、i18n fc.edge.maskSync ×12 语、recipe clipInner/clipRaw 死代码；删 edgemask 电池（其测的 Mask 功能已移除）。\n\n**新坑**：edgeMask 历史草稿字段已成为无害残留（applyDraft 不再写，但旧草稿里的 edgeMask 被忽略）。\n\n链条：[[2026-10-06-fc-v1028530-edgemask]] ← 本轮（该轮的 Mask 功能已被移除）；[[site-versioning-scheme]]；[[backend-build-state]]。\n';
  fs.writeFileSync(f, body);
  console.log('4) 新记忆文件 ✓');
}
console.log('记忆仪式四处完成');
