// tmp-update-memory-cellhl-unified.js — v0.2.30.2 一体式高亮轮记忆仪式（backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-11）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 计数 81 奇数，09-11 实测过）。
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
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00190-4w2（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev 00191-rlp（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00190-4w2（';
    const B = '；前身 rev 00189-z6x（'; // 不含 00190 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00190 条目正文（链式无闭合）
    const NEW = '2026-09-11 v0.2.30.2 一体式高亮——用户「那个编辑的画布是不是一体，如果是重复的一个一个就请你把他改成全部一体式的不要偷懒就搞成一个一个的」→追问「我怕你又偷懒就是做出一个画布然后再复制变长但是只使用一个感应，其他都只是花瓶并没有实际的功能」：先给实据（画布本体本来就一体——单一 div 自己长高、拖拽感应挂 document 全页生效，零复制零花瓶段）；唯一「一个一个」=拖卡/拖资产的覆盖高亮一格建一个 div（拖 10×7 的卡 = 70 个小方块各自描边）→drawHighlightRange 改为整个覆盖范围只建 ONE 块矩形（位置/尺寸按 c1..c2 × r1..r2 连续外框），两个调用点（拖卡覆盖预览/侧栏资产落点预览）共用同函数自动一体；FC v10.28.20.2（补丁位 1→2·观感微调轮）；电池 tmp-battery-cellhl-unified.js 10/10（B1/B3 拖卡与旋转卡高亮恰好 1 个 .cell-hl 且矩形=覆盖范围 ±1px、B2 松手移除、B4 资产落点预览一体、B5 吸合回归、Z 零 console error）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00191-rlp）；commit 1aacff3 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev 00191-rlp（' + NEW + '）**；前身 rev 00190-4w2（' + oldBody + l.slice(ib);
    const mk = (l.match(/\*\*/g) || []).length;
    if (mk % 2 !== 0 || !balanced(l) || l.indexOf('）**；前身 rev 00190-4w2（') === -1) { console.error('BAD backend bold state: 计数', mk); process.exit(1); }
    s.lines[li] = l;
    const mi = s.lines.findIndex(x => x.indexOf('modified:') !== -1);
    if (mi === -1) { console.error('MISS modified line'); process.exit(1); }
    s.lines[mi] = s.lines[mi].replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, '2026-09-11T15:30:00.000Z');
    writeLines(p, s); cnt++;
    console.log('OK backend-build-state：head 行', li + 1, '；modified 行', mi + 1, '；** 数', mk, '偶数且配对平衡');
  } else { console.log('SKIP backend-build-state（已更新）'); }
}

// ── 2. site-versioning-scheme.md（行 11 双锚：站点链 + FC 头） ──
{
  const p = MEM + 'site-versioning-scheme.md';
  const s = readLines(p);
  const line = s.lines[10];
  if (!line || line.indexOf('v0.2.30.2 = 一体式高亮') === -1 || line.indexOf('当前 v10.28.20.2（') === -1) {
    if (!line) { console.error('MISS scheme line 11'); process.exit(1); }
    let l = line;
    const A1 = 'commit 92a8ab0 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit 92a8ab0 未 push）；2026-09-11 v0.2.30.2 = 一体式高亮（补丁位 1→2·观感微调轮——用户「那个编辑的画布是不是一体，如果是重复的一个一个就请你把他改成全部一体式的不要偷懒就搞成一个一个的」→追问「我怕你又偷懒就是做出一个画布然后再复制变长但是只使用一个感应，其他都只是花瓶并没有实际的功能」：先给实据——画布本体本来就一体（单一 div 自己长高、拖拽感应挂 document 全页生效，零复制零花瓶段）；唯一「一个一个」=拖卡/拖资产的覆盖高亮一格建一个 div（拖 10×7 的卡 = 70 个小方块各自描边）→drawHighlightRange 改为整个覆盖范围只建 ONE 块矩形，两调用点共用同函数自动一体）；FC v10.28.20.2（补丁位 1→2）；零后端、ethereal 零改动无需 inline-css；电池 tmp-battery-cellhl-unified.js 10/10（恰好 1 个 .cell-hl 且矩形=覆盖范围、松手移除、旋转卡一体、资产落点预览一体、吸合回归、Z 零 error）；curl（health 58+v0.2.30.2+v10.28.20.2+一体式代码在+editor/index 200）；部署一次 exit 0（00191-rlp）；commit 1aacff3 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const A2 = '当前 v10.28.20.1（已部署 rev 00190-4w2，';
    const B2 = '当前 v10.28.20.2（已部署 rev 00191-rlp，2026-09-11 一体式高亮轮·FC 侧=drawHighlightRange 一格一 div → 整个覆盖范围只建 ONE 块矩形（位置/尺寸按 c1..c2 × r1..r2 连续外框），highlightCellRange 与 highlightCardCoverage 两调用点共用同函数；行为零变化（同范围缓存键、松手/离场整块移除）（补丁位 1→2）；commit 1aacff3）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.30.2 在', l.indexOf('v0.2.30.2 = '), '；FC 头 v10.28.20.2 在', l.indexOf('当前 v10.28.20.2'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00190-4w2（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev 00191-rlp（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00190-4w2（';
    const B = '；前身 rev 00189-z6x（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-11 v0.2.30.2 一体式高亮——用户「那个编辑的画布是不是一体，如果是重复的一个一个就请你把他改成全部一体式的不要偷懒就搞成一个一个的」→追问「我怕你又偷懒就是做出一个画布然后再复制变长但是只使用一个感应，其他都只是花瓶并没有实际的功能」：先给实据（画布本体本来就一体——单一 div 自己长高、拖拽感应挂 document 全页生效，零复制零花瓶段）；唯一「一个一个」=拖卡/拖资产覆盖高亮一格建一个 div（拖 10×7 的卡 = 70 个小方块各自描边）→drawHighlightRange 改为整个覆盖范围只建 ONE 块矩形，两调用点共用同函数自动一体；FC v10.28.20.2（补丁位 1→2·观感微调轮）；电池 10/10；部署一次 exit 0（00191-rlp）；commit 1aacff3 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev 00191-rlp（' + NEW + '）**；前身 rev 00190-4w2（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.30.1**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.30.2**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.30.1**（';
    const B = '；前身 v0.2.30.0（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-11 一体式高亮——补丁位 1→2 观感微调轮（用户「那个编辑的画布是不是一体，如果是重复的一个一个就请你把他改成全部一体式的不要偷懒就搞成一个一个的」→追问「我怕你又偷懒就是做出一个画布然后再复制变长但是只使用一个感应，其他都只是花瓶」：先给实据——画布本体本来就一体（单一 div 自己长高、拖拽感应挂 document 全页生效，零复制零花瓶段）；唯一「一个一个」=拖卡/拖资产的覆盖高亮一格建一个 div（拖 10×7 的卡 = 70 个小方块各自描边）→drawHighlightRange 改为整个覆盖范围只建 ONE 块矩形，两调用点共用同函数自动一体）；FC v10.28.20.2（补丁位 1→2）；电池 10/10；部署一次 exit 0（00191-rlp）；commit 1aacff3 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.30.2**（' + NEW + '；前身 v0.2.30.1（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
