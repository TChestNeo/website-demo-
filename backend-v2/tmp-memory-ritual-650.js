// tmp-memory-ritual-650.js — FC v10.28.56.0 Mask 跟随边缘装饰剪影记忆仪式
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REAL83 = '00383-cpj';
const DIGEST = '83e4196436f361c0f23db0df7c03ca7d0ce6190e8289f2cec14bb073e51eda07';

// 1) build-state head
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00382-rm9（2026-10-07 FC v10.28.55.0 AI 边缘/边框自动配色；站点恒 v0.2.58.28）';
  if ((s.match(/当前线上 rev 00382-rm9/g) || []).length !== 1) throw new Error('head anchor');
  const NEW = '**当前线上 rev ' + REAL83 + '（2026-10-07 FC v10.28.56.0 Mask 跟随边缘装饰剪影；站点恒 v0.2.58.28）' +
    '——用户「卡片本身有了 alight motion mask 效果但不符合预期，希望内容在紫色范围内、Mask 跟着紫色部分变化，而不是把 Mask 放在原本矩形上」；' +
    '真身=内容层 Mask（--card-mask-clip）用原多边形 clipRaw（0-100% 近矩形），装饰剪影 ::before 用外扩 clip——形状不一致，外扩滑杆只动装饰不动内容；' +
    '修法=applyCardBg 的 Mask 改用外扩 clip（=装饰剪影同一形状），内容随外扩滑杆一起放大缩小、与紫色装饰完全对齐；clipRaw 保留但不再用于 Mask；' +
    '后端零改动 npm test 413/413；edgemask 电池 maskVar/imgClip 断言原形→外扩+clipRaw 锚 4→2（18/18）；线上探针 5/5；digest sha256:' + DIGEST + '（当前线上）；commit 未 push；**前身 rev 00382-rm9（2026-10-07 FC v10.28.55.0 AI 边缘/边框自动配色；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) build-state ✓ ' + REAL83);
}
// 2) scheme 追加 + 指针
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.55.0**';
  if ((s.match(/FC 当前 v10\.28\.55\.0/g) || []).length !== 1) throw new Error('ptr anchor');
  const entry = '**FC v10.28.56.0（2026-10-07；小改动位 55→56 观感修复轮；rev ' + REAL83 + '；站点恒 v0.2.58.28）**：Mask 跟随边缘装饰剪影——用户「Mask 跟着紫色部分变化，不是放在原本矩形上」；修法=Mask（--card-mask-clip）改用外扩 clip（=装饰剪影同一形状），内容随外扩滑杆一起变；clipRaw 保留但不再用于 Mask；后端零改动 npm test 413/413；线上探针 5/5；digest sha256:' + DIGEST + '（当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.56.0**');
  fs.writeFileSync(f, s);
  console.log('2) scheme ✓ 56.0');
}
// 3) MEMORY.md 顶行
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const line = '- [2026-10-07 — FC v10.28.56.0 Mask 跟随边缘装饰剪影（rev ' + REAL83 + ' commit 未 push；站点恒 58.28）：--card-mask-clip 改用外扩 clip（=装饰剪影同一形状），内容随外扩滑杆一起变；clipRaw 保留但不再用于 Mask；后端零改动 npm test 413/413；线上探针 5/5 见 [2026-10-07-fc-v1028560-maskfollow.md](2026-10-07-fc-v1028560-maskfollow.md)]\n';
  s = line + s;
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓');
}
// 4) 新记忆文件
{
  const f = P + '2026-10-07-fc-v1028560-maskfollow.md';
  const body = '---\nname: 2026-10-07-fc-v1028560-maskfollow\ndescription: FC v10.28.56.0 Mask 跟随边缘装饰剪影（rev ' + REAL83 + ' commit 未 push；站点恒 58.28）\nmetadata:\n  node_type: memory\n  type: project\n  modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z\n---\n\n# FC v10.28.56.0 Mask 跟随边缘装饰剪影（2026-10-07，已完成）\n\n**用户原话**：「卡片本身有了 alight motion mask 效果但不符合预期，希望内容在紫色范围内、Mask 跟着紫色部分变化，而不是把 Mask 放在原本矩形上」\n\n**根因**：内容层 Mask（--card-mask-clip）用原多边形 clipRaw（0-100% 近矩形），装饰剪影 ::before 用外扩 clip——两者形状不一致，外扩滑杆只动装饰不动内容。\n\n**修法**：applyCardBg 的 Mask 改用外扩 clip（=装饰剪影同一形状），内容随外扩滑杆一起放大缩小、与紫色装饰完全对齐；clipRaw 保留但不再用于 Mask。\n\n**新坑**：clipRaw 已成死代码（customEdgeRecipe 仍返回，仅供可能的未来用途）；Mask 与装饰同形状后，装饰剪影可能被不透明图片盖住（图片 z0 > ::before z-1）——若用户要「紫色边框可见」需再调层级。\n\n链条：[[2026-10-06-fc-v1028530-edgemask]] ← 本轮；[[site-versioning-scheme]]；[[backend-build-state]]。\n';
  fs.writeFileSync(f, body);
  console.log('4) 新记忆文件 ✓');
}
console.log('记忆仪式四处完成');
