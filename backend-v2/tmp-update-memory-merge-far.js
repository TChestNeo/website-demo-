// tmp-update-memory-merge-far.js — v0.2.30.1 吸合误判修复轮记忆仪式（backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-11）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00189-z6x（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev 00190-4w2（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00189-z6x（';
    const B = '；前身 rev 00188-sts（'; // 不含 00189 的闭合「）**」——旧闭合对必须随替换区一起移除，否则残留成孤 **（本轮实测 81 奇数）
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00189 条目正文（旧闭合「）**」移除；链式无闭合——同 00188 风格）
    const NEW = '2026-09-11 v0.2.30.1 吸合误判修复——用户「为什么我把卡片拖到一个位置他会被一个和他没有任何接近的卡片吸附合并？这是否是网页html和css带来的一些bug导致的？」：真身=纯 JS 判定 bug，与 HTML/CSS 无关——findMergeSnap 只按单轴边距 ≤12px 判命中，横向隔着一千多像素、仅仅上下边同高（≤12px）的卡也会被吸（实况探针 tmp-merge-far-probe.js 诊断 B 抓出 40 个远距误命中：落点 (0,160) 命中 x=1050 的卡，d=8px 却视觉相距 1050px）；修法=边对判定加垂直轴严格重叠守卫（x 轴边对→y 范围相交、y 轴边对→x 范围相交，严格重叠边相切不算）；拖中判定与 mouseup 吸合提交 recheck 同函数自动继承守卫；FC v10.28.20.1（补丁位 0→1·纯修复轮）；电池 tmp-battery-merge-far.js 12/12（S1/S2/S5 远距负对照全拦、S3/S4/S6 近邻与旋转目标正对照照常成组、Z 零 console error）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00190-4w2）；commit 92a8ab0 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev 00190-4w2（' + NEW + '）**；前身 rev 00189-z6x（' + oldBody + l.slice(ib);
    const mk = (l.match(/\*\*/g) || []).length;
    if (mk % 2 !== 0 || !balanced(l) || l.indexOf('）**；前身 rev 00189-z6x（') === -1) { console.error('BAD backend bold state: 计数', mk); process.exit(1); }
    s.lines[li] = l;
    const mi = s.lines.findIndex(x => x.indexOf('modified:') !== -1);
    if (mi === -1) { console.error('MISS modified line'); process.exit(1); }
    s.lines[mi] = s.lines[mi].replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, '2026-09-11T15:15:00.000Z');
    writeLines(p, s); cnt++;
    console.log('OK backend-build-state：head 行', li + 1, '；modified 行', mi + 1, '；** 数', mk, '偶数且配对平衡');
  } else { console.log('SKIP backend-build-state（已更新）'); }
}

// ── 2. site-versioning-scheme.md（行 11 双锚：站点链 + FC 头） ──
{
  const p = MEM + 'site-versioning-scheme.md';
  const s = readLines(p);
  const line = s.lines[10];
  if (!line || line.indexOf('v0.2.30.1 = 吸合误判修复') === -1 || line.indexOf('当前 v10.28.20.1（') === -1) {
    if (!line) { console.error('MISS scheme line 11'); process.exit(1); }
    let l = line;
    const A1 = 'commit 3f79fcc 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit 3f79fcc 未 push）；2026-09-11 v0.2.30.1 = 吸合误判修复（补丁位 0→1·纯修复轮——用户「为什么我把卡片拖到一个位置他会被一个和他没有任何接近的卡片吸附合并？这是否是网页html和css带来的一些bug导致的？」：真身=纯 JS 判定 bug，与 HTML/CSS 无关——findMergeSnap 只按单轴边距 ≤12px 判命中，同高不同 x 的卡隔着一千多像素照样被吸（实况探针诊断 B 抓出 40 个远距误命中）；修法=边对判定加垂直轴严格重叠守卫（x 轴边对→y 范围相交、y 轴边对→x 范围相交）；拖中判定与 mouseup 吸合提交 recheck 同函数自动继承；FC v10.28.20.1（补丁位 0→1）；零后端、ethereal 零改动无需 inline-css；探针+电池 tmp-battery-merge-far.js 12/12（远距负对照全拦+近邻旋转正对照照常+Z 零 error）；curl（health 58+v0.2.30.1+v10.28.20.1+守卫在+editor/index 200）；部署一次 exit 0（00190-4w2）；commit 92a8ab0 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const A2 = '当前 v10.28.20（已部署 rev 00189-z6x，';
    const B2 = '当前 v10.28.20.1（已部署 rev 00190-4w2，2026-09-11 吸合误判修复轮·FC 侧=findMergeSnap 边对判定加垂直轴严格重叠守卫——x 轴边对（右-左/左-右）要求两卡 y 范围相交、y 轴边对（底-顶/顶-底）要求 x 范围相交（严格重叠，边相切不算）；旧代码只按单轴边距 ≤12px 判命中，同高不同 x 的卡隔着一千多像素照样被吸（补丁位 0→1）；commit 92a8ab0）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.30.1 在', l.indexOf('v0.2.30.1 = '), '；FC 头 v10.28.20.1 在', l.indexOf('当前 v10.28.20.1'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00189-z6x（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev 00190-4w2（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00189-z6x（';
    const B = '；前身 rev 00188-sts（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-11 v0.2.30.1 吸合误判修复——用户「为什么我把卡片拖到一个位置他会被一个和他没有任何接近的卡片吸附合并？这是否是网页html和css带来的一些bug导致的？」：真身=纯 JS 判定 bug 与 HTML/CSS 无关——findMergeSnap 只按单轴边距 ≤12px 判命中，同高不同 x 的卡隔着一千多像素照样被吸（实况探针诊断 B 抓出 40 个远距误命中）；修法=边对判定加垂直轴严格重叠守卫（x 轴边对→y 范围相交、y 轴边对→x 范围相交）；FC v10.28.20.1（补丁位 0→1·纯修复轮）；电池 12/12；部署一次 exit 0（00190-4w2）；commit 92a8ab0 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev 00190-4w2（' + NEW + '）**；前身 rev 00189-z6x（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.30.0**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.30.1**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.30.0**（';
    const B = '；前身 v0.2.29.3（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-11 吸合误判修复——补丁位 0→1 纯修复轮（用户「为什么我把卡片拖到一个位置他会被一个和他没有任何接近的卡片吸附合并？这是否是网页html和css带来的一些bug导致的？」：真身=纯 JS 判定 bug 与 HTML/CSS 无关——findMergeSnap 只按单轴边距 ≤12px 判命中，同高不同 x 的卡隔着一千多像素照样被吸；修法=边对判定加垂直轴严格重叠守卫）；FC v10.28.20.1（补丁位 0→1）；电池 12/12；部署一次 exit 0（00190-4w2）；commit 92a8ab0 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.30.1**（' + NEW + '；前身 v0.2.30.0（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
