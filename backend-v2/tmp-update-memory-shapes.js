// tmp-update-memory-shapes.js — v0.2.36.0 自由形状合并组收尾锚点：build-state head + scheme 链尾 + MEMORY.md 双指针
'use strict';
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

const BS_ENTRY = '**当前线上 rev 00206-m9x（2026-09-12 v0.2.36.0 自由形状合并组（L 型/十字型）——用户「合并时能不能不只是正方形：左右合并保持一样的大小、上下合并只拿动到的那一边的最宽值、不再只是四边形可以是6边形L型或十字型」：真身=mergeCards 等宽归一+reflowGroup 压形（左右并入拉成等宽、上下并入拉整组宽、任何形状压回等宽列+整行）；修法=①接触面模型（上下并入 face=对边≤12px 且 x 相交的成员，宽=面并集跨度——台阶底只拿那一面最宽值、平底自然=整面宽；左右并入零归一化保尺寸贴侧边顶对齐）②reflowGroup 保形（只重画背景手柄永不改成员几何；行卡机制整体退役：snapshotGroupRows/pushGroupRows/reassertRowWidths/alignGroupTops 全删、草稿无 rowInGroup）③墙模型泛化（右/左集合加垂直重叠守卫，台阶斜对不误推）④组背景 computeGroupOutline 多边形（区间带扫描→XOR 段→Eulerian 走环→凸角 r14 圆弧/凹角直角）+clip-path path()+drop-shadow 栈跟随 L/十字剪影（空角点击落画布）⑤修整组缩放级联下推 bug（S7 实况：链从 style 反解析坐标被 CSSOM 6 位序列化污染——齐平 1005.1018 读回 1005.1 假重叠 0.002px→y 链把臂推落一整卡高；修法=坐标走内存 mm.nx/mm.ny，探针 replica 与真实帧逐值吻合）；FC v10.28.26.0（小更新位 25→26·新功能轮·补丁归零）；电池 group-shapes 17/17（新）+ merge-dir 19/19 + group-resize 34/34 + tt-img 34/34 + tt-caret 12/12 + dblmodal 14/14 + merge-far 12/12（142/142）+ 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00206-m9x）；commit 446dd57 未 push；每轮 rev 全量链见 [[backend-build-state]]）**；前身 rev 00205-hhs（';

const SV_ENTRY = '站点号当前 **v0.2.36.0**（2026-09-12 自由形状合并组——小改动位 35→36 新功能轮·补丁归零（用户「合并时能不能不只是正方形：左右合并保持一样的大小、上下合并只拿动到的那一边的最宽值、不再只是四边形可以是6边形L型或十字型」：接触面模型上下并入只拿那一面的最宽值、左右并入保尺寸零归一、reflow 保形+行卡机制整体退役、墙守卫垂直重叠、组背景 clip-path 多边形剪影、整组缩放级联下推修复（CSSOM 6 位序列化假重叠→链坐标走内存 mm.nx/mm.ny））；FC v10.28.26.0（小更新位 25→26）；电池 group-shapes 17/17 + merge-dir 19/19 + group-resize 34/34 + tt-img 34/34 + tt-caret 12/12 + dblmodal 14/14 + merge-far 12/12（142/142）+ 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00206-m9x）；commit 446dd57 未 push）；前身 v0.2.35.2（';

// —— 1. backend-build-state.md head：00205-hhs → 00206-m9x ——
{
  const p = M + '/backend-build-state.md';
  let s = fs.readFileSync(p, 'utf8');
  const anchor = '**当前线上 rev 00205-hhs（';
  const n = s.split(anchor).length - 1;
  if (n !== 1) { console.log('❌ build-state anchor count wrong: ' + n); process.exit(1); }
  s = s.replace(anchor, BS_ENTRY);
  fs.writeFileSync(p, s);
  console.log('✅ backend-build-state.md updated（00206-m9x 计数 ' + (s.split('00206-m9x').length - 1) + '）');
}

// —— 2. site-versioning-scheme.md 链尾：v0.2.35.2 条目后插 v0.2.36.0 ——
{
  const p = M + '/site-versioning-scheme.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.split('v0.2.36.0 = ').length > 1) { console.log('ℹ scheme 已含 v0.2.36.0 条目，跳过'); }
  else {
    const anchor = '部署一次 exit 0（00205-hhs）；commit 530944e 未 push）';
    const n = s.split(anchor).length - 1;
    if (n !== 1) { console.log('❌ scheme anchor count wrong: ' + n); process.exit(1); }
    const entry = anchor + '；2026-09-12 v0.2.36.0 = 自由形状合并组（小改动位 35→36·新功能轮·补丁归零——用户「合并时能不能不只是正方形：左右合并保持一样的大小、上下合并只拿动到的那一边的最宽值、不再只是四边形可以是6边形L型或十字型」：接触面模型（上下并入 face=对边≤12px 且 x 相交的成员，宽=面并集跨度——台阶底只拿那一面最宽值、平底自然=整面宽；左右并入零归一化保尺寸贴侧边顶对齐）；reflowGroup 保形（只重画背景手柄、永不改成员几何）+行卡机制整体退役；墙模型右/左集合垂直重叠守卫（台阶斜对不误推）；组背景 computeGroupOutline 多边形+clip-path path()+drop-shadow 栈跟随 L/十字剪影；整组缩放级联下推修复（链从 style 反解析被 CSSOM 6 位序列化污染→内存 mm.nx/mm.ny）；FC v10.28.26.0（小更新位 25→26）；电池 group-shapes 17/17 + merge-dir 19/19 + group-resize 34/34 + tt-img 34/34 + tt-caret 12/12 + dblmodal 14/14 + merge-far 12/12（142/142）+ 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00206-m9x）；commit 446dd57 未 push）';
    s = s.replace(anchor, entry);
    fs.writeFileSync(p, s);
    console.log('✅ site-versioning-scheme.md updated（v0.2.36.0 计数 ' + (s.split('v0.2.36.0').length - 1) + '）');
  }
}

// —— 3. MEMORY.md 双指针 ——
{
  const p = M + '/MEMORY.md';
  let s = fs.readFileSync(p, 'utf8');
  const a1 = '**当前线上 rev 00205-hhs（';
  const n1 = s.split(a1).length - 1;
  if (n1 !== 1) { console.log('❌ MEMORY.md bs anchor count wrong: ' + n1); process.exit(1); }
  s = s.replace(a1, BS_ENTRY);
  const a2 = '站点号当前 **v0.2.35.2**（';
  const n2 = s.split(a2).length - 1;
  if (n2 !== 1) { console.log('❌ MEMORY.md sv anchor count wrong: ' + n2); process.exit(1); }
  s = s.replace(a2, SV_ENTRY);
  fs.writeFileSync(p, s);
  console.log('✅ MEMORY.md updated（00206 计数 ' + (s.split('00206-m9x').length - 1) + '、v0.2.36.0 计数 ' + (s.split('v0.2.36.0').length - 1) + '）');
}

// —— 4. ** 平衡校验 ——
{
  const p = M + '/MEMORY.md';
  const s = fs.readFileSync(p, 'utf8');
  const open = (s.match(/\*\*/g) || []).length;
  console.log(open % 2 === 0 ? '✅ MEMORY.md ** 平衡（' + open + ' 个）' : '❌ MEMORY.md ** 不平衡: ' + open);
  if (open % 2 !== 0) process.exit(1);
  const b = M + '/backend-build-state.md';
  const sb = fs.readFileSync(b, 'utf8');
  const openB = (sb.match(/\*\*/g) || []).length;
  console.log(openB % 2 === 0 ? '✅ backend-build-state.md ** 平衡（' + openB + ' 个）' : '❌ backend-build-state.md ** 不平衡: ' + openB);
  if (openB % 2 !== 0) process.exit(1);
  const v = M + '/site-versioning-scheme.md';
  const sv2 = fs.readFileSync(v, 'utf8');
  const openV = (sv2.match(/\*\*/g) || []).length;
  console.log(openV % 2 === 0 ? '✅ site-versioning-scheme.md ** 平衡（' + openV + ' 个）' : '❌ site-versioning-scheme.md ** 不平衡: ' + openV);
  if (openV % 2 !== 0) process.exit(1);
}
