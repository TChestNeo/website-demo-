// tmp-update-memory-tt-img4.js — v0.2.34.1 / FC v10.28.24.1 双修复轮记忆仪式
// （backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 奇数，09-11 实测过）。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00201-5b5', HASH = '4d32d8d';
const MODIFIED = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00200-jd4（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00200-jd4（';
    const B = '；前身 rev 00194-szr（'; // 不含 00200 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00200 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.34.1 双修复——用户「在Sheet卡片里添加图像时它的大小没有跟随文本大小」+「为什么在content card输入时工具栏会跑到左上角」：①Sheet 卡表格格插图不随字号（v10.28.24 只写了 .card-text-content img.tt-inline-img 1.5em 选择器，富文本化字段里的图规则落空）→ 补 [data-rich="1"] img.tt-inline-img，表格格/标签/统计…里的图随所在字号等比；②content card 插图后打字工具栏跳左上角（真身=插图后光标 setStartAfter(img) 元素级落在内联图边界，Chrome 光标矩形退化 0,0,0,0 → positionToolbar 锚到视口左上角，探针实证；修法=光标优先放进图后文本节点偏移 0（探针实证矩形正常）+positionToolbar 退化矩形兜底锚回 textEl 矩形，图是末节点等残余情况也绝不跳左上角）；FC v10.28.24.1（补丁位 0→1·纯修复轮）；电池 tt-img 30/30（T3/T12b 光标断言改双形态兼容新光标）+ tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    const mk = (l.match(/\*\*/g) || []).length;
    if (mk % 2 !== 0 || !balanced(l) || l.indexOf('）**；前身 rev 00194-szr（') === -1) { console.error('BAD backend bold state: 计数', mk); process.exit(1); }
    s.lines[li] = l;
    const mi = s.lines.findIndex(x => x.indexOf('modified:') !== -1);
    if (mi === -1) { console.error('MISS modified line'); process.exit(1); }
    s.lines[mi] = s.lines[mi].replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, MODIFIED);
    writeLines(p, s); cnt++;
    console.log('OK backend-build-state：head 行', li + 1, '；modified 行', mi + 1, '；** 数', mk, '偶数且配对平衡');
  } else { console.log('SKIP backend-build-state（已更新）'); }
}

// ── 2. site-versioning-scheme.md（行 11 双锚：站点链 + FC 头） ──
{
  const p = MEM + 'site-versioning-scheme.md';
  const s = readLines(p);
  const line = s.lines[10];
  if (!line) { console.error('MISS scheme line 11'); process.exit(1); }
  if (line.indexOf('v0.2.34.1 = ') === -1 || line.indexOf('当前 v10.28.24.1（') === -1) {
    let l = line;
    const A1 = 'commit 8a07627 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit ' + HASH + ' 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const E1 = '2026-09-12 v0.2.34.1 = 两个修复（补丁位 0→1·纯修复轮——用户「在Sheet卡片里添加图像时它的大小没有跟随文本大小」+「为什么在content card输入时工具栏会跑到左上角」：①内联图 1.5em 规则选择器只写 .card-text-content → 补 [data-rich="1"] img.tt-inline-img，富文本化字段（表格格/标签/统计…）里的图随所在字号等比；②真身=插图后光标 setStartAfter(img) 元素级落在内联图边界，Chrome 光标矩形退化 0,0,0,0 → 工具栏锚到视口左上角；修法=光标优先放进图后文本节点偏移 0（探针实证矩形正常）+positionToolbar 退化矩形兜底锚回 textEl 矩形）；FC v10.28.24.1（补丁位 0→1）；电池 tt-img 30/30 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；';
    const B1f = E1 + B1;
    const A2 = '当前 v10.28.24（已部署 rev 00200-jd4，';
    const B2 = '当前 v10.28.24.1（已部署 rev ' + REV + '，2026-09-12 双修复轮·FC 侧=富文本化字段内联图 1.5em 选择器补 [data-rich="1"] img、插图后光标优先放进图后文本节点偏移 0 + positionToolbar 退化矩形兜底锚回 textEl（工具栏绝不跳左上角，探针实证）（补丁位 0→1·纯修复轮）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1f], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.34.1 在', l.indexOf('v0.2.34.1 = '), '；FC 头 v10.28.24.1 在', l.indexOf('当前 v10.28.24.1'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00200-jd4（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00200-jd4（';
    const B = '；前身 rev 00194-szr（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.34.1 双修复——用户「在Sheet卡片里添加图像时它的大小没有跟随文本大小」+「为什么在content card输入时工具栏会跑到左上角」：①1.5em 选择器补 [data-rich="1"] img.tt-inline-img（富文本化字段里的图随字号等比）；②真身=插图后光标元素级落内联图边界矩形退化 0,0,0,0 → 工具栏锚视口左上角（探针实证）；修法=光标优先进图后文本节点偏移 0 + positionToolbar 退化矩形兜底锚回 textEl；FC v10.28.24.1（补丁位 0→1·纯修复轮）；电池 tt-img 30/30 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.34.0**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.34.1**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.34.0**（';
    const B = '；前身 v0.2.30.5（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 双修复——补丁位 0→1 纯修复轮（用户「在Sheet卡片里添加图像时它的大小没有跟随文本大小」+「为什么在content card输入时工具栏会跑到左上角」：内联图 1.5em 选择器补 [data-rich="1"] img（富文本化字段图随字号）；插图后光标优先进图后文本节点偏移 0 + positionToolbar 退化矩形兜底锚回 textEl（工具栏绝不跳左上角，探针实证））；FC v10.28.24.1（补丁位 0→1）；电池 tt-img 30/30 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.34.1**（' + NEW + '；前身 v0.2.30.5（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
