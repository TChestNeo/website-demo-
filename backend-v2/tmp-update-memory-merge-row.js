// tmp-update-memory-merge-row.js — v0.2.35.0 / FC v10.28.25 整行成行轮记忆仪式
// （backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 奇数，09-11 实测过）。
// scheme 链：上一轮 tt-img5 在链头留下双「commit fe27726 未 push）；」残留——
// 本次 A1 把双段一起吞掉，一次替换同时插入新条目+修双残留。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00203-td4', HASH = '88354be';
const MODIFIED = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00202-qpv（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00202-qpv（';
    const B = '；前身 rev 00194-szr（'; // 不含 00202 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00202 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.35.0 整行成行——用户「好了然后我现在是卡片合并的时候我希望是如果那个卡片已经有左右两个合并了的 然后我在下面上去合并他只会变成左右两列，我希望是从下面合并时他是可以变成上下两行的就是不只是两列，能不能办到？」（真身（探针实证）=下方拖入卡挤进目标列，reflow fill 把矮列拉高填满（2列组下方并入 → 另一列 130→216 被拉大），组永远只是左右两列）；修法=上/下并入既有组时整宽成行贴组底/组顶（宽度=组左缘到组右缘），rowInGroup 标记（additive，随草稿往返）行卡不进列划分/不参与 fill/列顶对齐跳过/重排幂等，拆分/侧并入清标记；左右并入仍是列；FC v10.28.25（小更新位 24→25·新功能轮·补丁归零）；电池 merge-dir 18/18（S5 改行语义 + 新增 S6 用户场景零拉伸/S7 草稿往返/S8 幂等/S9 拆分回列/S10 列顶对齐跳行）+ tt-img 34/34 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
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
  if (line.indexOf('v0.2.35.0 = ') === -1 || line.indexOf('当前 v10.28.25（') === -1) {
    let l = line;
    // A1 吞掉上一轮双 commit 残留（双段一起换：既修残留又插入新条目）
    const A1 = 'commit fe27726 未 push）；commit fe27726 未 push）；commit 4d32d8d 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit ' + HASH + ' 未 push）；commit fe27726 未 push）；commit 4d32d8d 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const E1 = '2026-09-12 v0.2.35.0 = 合并组可整行成行（小改动位 34→35·新功能轮·补丁清零——用户「好了然后我现在是卡片合并的时候我希望是如果那个卡片已经有左右两个合并了的 然后我在下面上去合并他只会变成左右两列，我希望是从下面合并时他是可以变成上下两行的就是不只是两列，能不能办到？」：真身（探针实证）=下方拖入卡挤进目标列+reflow fill 拉高矮列（2列组下方并入 → 另一列 130→216），组永远只有左右两列；修法=上/下并入既有组时整宽成行贴组底/组顶（rowInGroup 标记 additive 随草稿往返、行卡不进列划分/不参与 fill/列顶对齐跳过/重排幂等、拆分/侧并入清标记）；左右并入仍是列；FC v10.28.25（小更新位 24→25·新功能轮·补丁归零）；电池 merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；';
    const B1f = E1 + B1;
    const A2 = '当前 v10.28.24.2（已部署 rev 00202-qpv，';
    const B2 = '当前 v10.28.25（已部署 rev ' + REV + '，2026-09-12 整行成行轮·FC 侧=上/下并入既有组时整宽成行贴组底/组顶（rowInGroup 标记 additive 随草稿往返、行卡不进列划分/不参与 fill/列顶对齐跳过/重排幂等、拆分/侧并入清标记；左右并入仍是列；小更新位 24→25·新功能轮·补丁归零）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1f], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.35.0 在', l.indexOf('v0.2.35.0 = '), '；FC 头 v10.28.25 在', l.indexOf('当前 v10.28.25'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00202-qpv（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00202-qpv（';
    const B = '；前身 rev 00194-szr（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.35.0 整行成行——用户「好了然后我现在是卡片合并的时候我希望是如果那个卡片已经有左右两个合并了的 然后我在下面上去合并他只会变成左右两列，我希望是从下面合并时他是可以变成上下两行的就是不只是两列，能不能办到？」：真身（探针实证）=下方拖入卡挤进目标列+reflow fill 拉高矮列（2列组下方并入 → 另一列 130→216）；修法=上/下并入既有组时整宽成行贴组底/组顶（rowInGroup 标记 additive 随草稿往返、行卡不进列划分/不参与 fill/列顶对齐跳过、拆分/侧并入清标记）；左右并入仍是列；FC v10.28.25（小更新位 24→25·新功能轮·补丁归零）；电池 merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.34.2**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.35.0**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.34.2**（';
    const B = '；前身 v0.2.30.5（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 合并组可整行成行——小改动位 34→35 新功能轮·补丁归零（用户「好了然后我现在是卡片合并的时候我希望是如果那个卡片已经有左右两个合并了的 然后我在下面上去合并他只会变成左右两列，我希望是从下面合并时他是可以变成上下两行的就是不只是两列，能不能办到？」：真身=下方拖入卡挤进目标列+fill 拉高矮列，组永远只有左右两列；修法=上/下并入既有组时整宽成行贴组底/组顶，rowInGroup 标记 additive 随草稿往返、行卡不进列不 fill、列顶对齐跳过、拆分/侧并入清标记；左右并入仍是列；FC v10.28.25（小更新位 24→25）；电池 merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.35.0**（' + NEW + '；前身 v0.2.30.5（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
