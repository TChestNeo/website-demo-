// tmp-memory-ritual-651.js — FC v10.28.56.1 紫色边框可见记忆仪式
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REAL84 = '00384-2j9';
const DIGEST = 'c404ec6537b67b6014175e3b9719be837a354433bc3eb167d491749b57f6bcc5';

// 1) build-state head
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00383-cpj（2026-10-07 FC v10.28.56.0 Mask 跟随边缘装饰剪影；站点恒 v0.2.58.28）';
  if ((s.match(/当前线上 rev 00383-cpj/g) || []).length !== 1) throw new Error('head anchor');
  const NEW = '**当前线上 rev ' + REAL84 + '（2026-10-07 FC v10.28.56.1 紫色边框可见；站点恒 v0.2.58.28）' +
    '——用户「现状是那个紫色的部分不见了」；' +
    '真身=56.0 让 Mask=装饰同形状后，不透明图片（z0）盖住紫色剪影（z-1），紫边消失；' +
    '修法=customEdgeRecipe 增 clipInner=expandClipPct(e.clip, f-CUSTOM_EDGE_FRAME)（FRAME=0.03 内缩），applyCardBg 的 Mask 改用 clipInner——内容跟紫色走但内缩一圈、紫色作边框可见；' +
    '后端零改动 npm test 413/413；线上探针 6/6；digest sha256:' + DIGEST + '（当前线上）；commit 未 push；**前身 rev 00383-cpj（2026-10-07 FC v10.28.56.0 Mask 跟随边缘装饰剪影；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) build-state ✓ ' + REAL84);
}
// 2) scheme 追加 + 指针
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.56.0**';
  if ((s.match(/FC 当前 v10\.28\.56\.0/g) || []).length !== 1) throw new Error('ptr anchor');
  const entry = '**FC v10.28.56.1（2026-10-07；补丁位 0→1 修复轮；rev ' + REAL84 + '；站点恒 v0.2.58.28）**：紫色边框可见——用户「紫色的部分不见了」；修法=clipInner=内缩 3%（CUSTOM_EDGE_FRAME），Mask 用 clipInner 让内容跟紫色走但内缩一圈、紫边作边框可见；后端零改动 npm test 413/413；线上探针 6/6；digest sha256:' + DIGEST + '（当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.56.1**');
  fs.writeFileSync(f, s);
  console.log('2) scheme ✓ 56.1');
}
// 3) MEMORY.md 顶行
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const line = '- [2026-10-07 — FC v10.28.56.1 紫色边框可见（rev ' + REAL84 + ' commit 未 push；站点恒 58.28）：clipInner=内缩 3% 让内容跟紫色走但紫边作边框可见（修复 56.0 图片盖住紫边）；后端零改动 npm test 413/413；线上探针 6/6 见 [2026-10-07-fc-v1028561-maskframe.md](2026-10-07-fc-v1028561-maskframe.md)]\n';
  s = line + s;
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓');
}
// 4) 新记忆文件
{
  const f = P + '2026-10-07-fc-v1028561-maskframe.md';
  const body = '---\nname: 2026-10-07-fc-v1028561-maskframe\ndescription: FC v10.28.56.1 紫色边框可见（rev ' + REAL84 + ' commit 未 push；站点恒 58.28）\nmetadata:\n  node_type: memory\n  type: project\n  modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z\n---\n\n# FC v10.28.56.1 紫色边框可见（2026-10-07，已完成）\n\n**用户原话**：「现状是那个紫色的部分不见了」\n\n**根因**：56.0 让 Mask=装饰同形状后，不透明图片（z0）盖住紫色剪影（z-1），紫边消失。\n\n**修法**：customEdgeRecipe 增 clipInner=expandClipPct(e.clip, f-CUSTOM_EDGE_FRAME)（FRAME=0.03 内缩），applyCardBg 的 Mask 改用 clipInner——内容跟紫色走但内缩一圈、紫色作边框可见。\n\n**新坑**：Mask 与装饰剪影同层（图片 z0 > 紫色 z-1）会导致图片盖住紫边——必须内缩 clipInner 留边框；内缩量 CUSTOM_EDGE_FRAME=0.03 可调。\n\n链条：[[2026-10-06-fc-v1028530-edgemask]] ← 本轮；[[site-versioning-scheme]]；[[backend-build-state]]。\n';
  fs.writeFileSync(f, body);
  console.log('4) 新记忆文件 ✓');
}
console.log('记忆仪式四处完成');
