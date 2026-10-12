// tmp-memory-ritual-656.js — FC v10.28.61.0 恢复图片与边缘同步勾选记忆仪式
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REAL89 = '00389-9fc';
const DIGEST = 'a8d68af526e197ae8a96e159e9055c31debb071d02c9d7bce072f9f4e2d763ad';

// 1) build-state head
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00388-b2w（2026-10-07 FC v10.28.60.0 自定义边缘装饰伸出矩形；站点恒 v0.2.58.28）';
  if ((s.match(/当前线上 rev 00388-b2w/g) || []).length !== 1) throw new Error('head anchor');
  const NEW = '**当前线上 rev ' + REAL89 + '（2026-10-07 FC v10.28.61.0 恢复「图片与边缘同步」勾选；站点恒 v0.2.58.28）' +
    '——用户「那个让图片和边缘/边框同步的勾选呢」——上一轮去 Mask 时把勾选一起删了；' +
    '修法=恢复内容层 Mask：CSS .card-edge-custom .card-img-bg/.card-stripes clip-path=var(--card-mask-clip)+applyCardBg 按 edgeMask 写 --card-mask-clip=edge.clip（e.clip 原多边形）+勾选节 HTML+setEdgeMaskSync/renderEdgeMaskSec+setCardEdge 旗+草稿 edgeMask+i18n maskSync ×12 语；' +
    '后端零改动 npm test 413/413；线上探针 6/6；digest sha256:' + DIGEST + '（当前线上）；commit 未 push；**前身 rev 00388-b2w（2026-10-07 FC v10.28.60.0 自定义边缘装饰伸出矩形；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) build-state ✓ ' + REAL89);
}
// 2) scheme 追加 + 指针
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.60.0**';
  if ((s.match(/FC 当前 v10\.28\.60\.0/g) || []).length !== 1) throw new Error('ptr anchor');
  const entry = '**FC v10.28.61.0（2026-10-07；小改动位 60→61 新功能轮；rev ' + REAL89 + '；站点恒 v0.2.58.28）**：恢复「图片与边缘同步」勾选——上一轮去 Mask 时把勾选一起删了；修法=恢复内容层 Mask（--card-mask-clip=edge.clip）+勾选节+草稿 edgeMask+i18n maskSync ×12；后端零改动 npm test 413/413；线上探针 6/6；digest sha256:' + DIGEST + '（当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.61.0**');
  fs.writeFileSync(f, s);
  console.log('2) scheme ✓ 61.0');
}
// 3) MEMORY.md 顶行
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const line = '- [2026-10-07 — FC v10.28.61.0 恢复「图片与边缘同步」勾选（rev ' + REAL89 + ' commit 未 push；站点恒 58.28）：恢复内容层 Mask（--card-mask-clip=edge.clip）+勾选节+草稿+i18n ×12；后端零改动 npm test 413/413；线上探针 6/6 见 [2026-10-07-fc-v1028610-masksync.md](2026-10-07-fc-v1028610-masksync.md)]\n';
  s = line + s;
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓');
}
// 4) 新记忆文件
{
  const f = P + '2026-10-07-fc-v1028610-masksync.md';
  const body = '---\nname: 2026-10-07-fc-v1028610-masksync\ndescription: FC v10.28.61.0 恢复「图片与边缘同步」勾选（rev ' + REAL89 + ' commit 未 push；站点恒 58.28）\nmetadata:\n  node_type: memory\n  type: project\n  modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z\n---\n\n# FC v10.28.61.0 恢复「图片与边缘同步」勾选（2026-10-07，已完成）\n\n**用户原话**：「那个让图片和边缘/边框同步的勾选呢」\n\n**根因**：上一轮（60.0）去 Mask 时把「图片与边缘同步」勾选一起删了。\n\n**修法**：恢复内容层 Mask——CSS .card-edge-custom .card-img-bg/.card-stripes clip-path=var(--card-mask-clip)、applyCardBg 按 edgeMask 写 --card-mask-clip=edge.clip（e.clip 原多边形）、勾选节 HTML、setEdgeMaskSync/renderEdgeMaskSec、setCardEdge 旗、草稿 edgeMask、i18n maskSync ×12 语。\n\n**新坑**：现在装饰剪影用 --card-clip=e.clip 相对 1.4× 盒（inset:-20%）解析出外扩，而 Mask 用同 --card-mask-clip=e.clip 相对 0-100% 盒解析出原形——同一 e.clip 两个盒各自解析，天然对齐。\n\n链条：[[2026-10-06-fc-v1028530-edgemask]] ← 本轮；[[site-versioning-scheme]]；[[backend-build-state]]。\n';
  fs.writeFileSync(f, body);
  console.log('4) 新记忆文件 ✓');
}
console.log('记忆仪式四处完成');
