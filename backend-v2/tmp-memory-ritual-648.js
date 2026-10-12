// tmp-memory-ritual-648.js — FC v10.28.54.0 边缘外扩距离+卡身透明记忆仪式
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REAL81 = '00381-xrv';
const DIGEST = '63380a471a92b54bcd9a7a78b00078929bc6013fbd31a8d54bd87937884f8ef3';

// 1) backend-build-state.md head 换代
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00380-8kn（2026-10-06 FC v10.28.53.0 边缘 Mask 化+图片与边缘同步勾选+边缘外扩；站点恒 v0.2.58.28）';
  const c1 = (s.match(/当前线上 rev 00380-8kn/g) || []).length;
  if (c1 !== 1) throw new Error('build-state head anchor count=' + c1);
  const NEW = '**当前线上 rev ' + REAL81 + '（2026-10-07 FC v10.28.54.0 边缘外扩距离滑杆+卡身透明；站点恒 v0.2.58.28）' +
    '——用户「Z轴最底部的卡片还在并不是透明的…调整图像/内容与卡片边缘的距离时边缘还是在原有卡片范围内增加距离而不是增加整体大小」；' +
    '真身=①自定义边缘卡身 background 恒 --card-bg 矩形底（applyCardBg 只清内联 ' + "''" + ' 不覆盖 CSS 默认）②overflow:hidden 把外扩剪影裁在矩形内③外扩系数 CUSTOM_EDGE_EXPAND 固定 0.06 无 UI；' +
    '修法=①.grid-card.card-edge-custom 卡身 transparent+overflow:visible ②抽屉加「边缘外扩距离」滑杆（0-30% 默认 6%，dataset.edgeExpand %→0-1 系数喂 customEdgeRecipe）③草稿 edgeExpand 往返+i18n fc.edge.expandDist ×12 语；' +
    '后端零改动 npm test 413/413；新电池 edgemask 锚更新 CUSTOM_EDGE_EXPAND 2→4（18/18）；sed 53.0→54.0 54 件；' +
    '线上探针 fc-edgeexpand 648 6/6（S1a site-config 54.0+changelog 头+S1b i18n ×12+P1a 卡身透明+overflow visible+默认 6%+P1b 滑杆可见+P1c 调 20% 外扩变大+E 零异常）；' +
    'digest sha256:' + DIGEST + '（当前线上）；commit 未 push；**前身 rev 00380-8kn（2026-10-06 FC v10.28.53.0 边缘 Mask 化+图片与边缘同步勾选+边缘外扩；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) backend-build-state.md ✓ head ' + REAL81);
}

// 2) site-versioning-scheme.md 链尾追加 + 指针
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.53.0**';
  const c2 = (s.match(/FC 当前 v10\.28\.53\.0/g) || []).length;
  if (c2 !== 1) throw new Error('scheme pointer count=' + c2);
  const entry = '**FC v10.28.54.0（2026-10-07；小改动位 53→54 新功能轮；rev ' + REAL81 + '；站点恒 v0.2.58.28）**：边缘外扩距离滑杆+卡身透明——' +
    '用户「Z轴最底部的卡片还在并不是透明的…调整距离时边缘还是在原有卡片范围内增加距离而不是增加整体大小」；' +
    '真身=卡身 background 恒 --card-bg 矩形底+overflow:hidden 裁外扩剪影+外扩系数固定 0.06 无 UI；' +
    '修法=.card-edge-custom 卡身 transparent+overflow:visible+抽屉「边缘外扩距离」滑杆（0-30% 默认 6%，dataset.edgeExpand 喂 customEdgeRecipe）+草稿往返+i18n fc.edge.expandDist ×12 语；' +
    '后端零改动 npm test 413/413；线上探针 6/6；digest sha256:' + DIGEST + '（当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.54.0**');
  fs.writeFileSync(f, s);
  console.log('2) site-versioning-scheme.md ✓ 追加 + 指针 54.0');
}

// 3) MEMORY.md 新顶行
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const line = '- [2026-10-07 — FC v10.28.54.0 边缘外扩距离滑杆+卡身透明（rev ' + REAL81 + ' commit 未 push；站点恒 58.28）：卡身 transparent+overflow:visible+「边缘外扩距离」滑杆 0-30% 默认 6%（dataset.edgeExpand 喂 customEdgeRecipe）；后端零改动 npm test 413/413；线上探针 6/6；新坑=applyCardBg 清内联 ' + "''" + ' 不覆盖 CSS 默认 background（矩形底残留）见 [2026-10-07-fc-v1028540-edgeexpand.md](2026-10-07-fc-v1028540-edgeexpand.md)]\n';
  s = line + s;
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓ 新顶行');
}

// 4) 新记忆文件
{
  const f = P + '2026-10-07-fc-v1028540-edgeexpand.md';
  const body = '---\nname: 2026-10-07-fc-v1028540-edgeexpand\ndescription: FC v10.28.54.0 边缘外扩距离滑杆+卡身透明（rev ' + REAL81 + ' commit 未 push；站点恒 58.28）\nmetadata:\n  node_type: memory\n  type: project\n  modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z\n---\n\n' +
    '# FC v10.28.54.0 边缘外扩距离+卡身透明（2026-10-07，已完成）\n\n' +
    '**用户原话**：「Z轴最底部的卡片还在并不是透明的…调整图像/内容与卡片边缘的距离时边缘还是在原有卡片范围内增加距离而不是增加整体大小」\n\n' +
    '**根因**：①自定义边缘卡身 background 恒 --card-bg 矩形底（applyCardBg 只清内联 \'\' 不覆盖 CSS 默认 var(--card-bg-color)）②overflow:hidden 把外扩剪影（--card-clip 多边形负坐标）裁在矩形内③外扩系数 CUSTOM_EDGE_EXPAND 固定 0.06 无 UI。\n\n' +
    '**修法**：①.grid-card.card-edge-custom { background: transparent; overflow: visible; }（矩形底去掉、外扩剪影能伸出矩形外）②抽屉「图片与边缘同步」下加「边缘外扩距离」滑杆（0-30% 默认 6%，dataset.edgeExpand %→0-1 系数喂 customEdgeRecipe 的 expandClipPct；仅自定义边缘 edge 种显示）③草稿 edgeExpand 往返+i18n fc.edge.expandDist ×12 语。\n\n' +
    '**新坑**：applyCardBg 清背景用 card.style.background = \'\' 只清内联、不覆盖 CSS 默认 background: var(--card-bg-color)——要透明必须写 transparent（或 CSS 类覆盖）。\n\n' +
    '链条：[[2026-10-06-fc-v1028530-edgemask]] ← 本轮；[[site-versioning-scheme]]；[[backend-build-state]]。\n';
  fs.writeFileSync(f, body);
  console.log('4) 新记忆文件 ✓');
}
console.log('记忆仪式四处完成');
