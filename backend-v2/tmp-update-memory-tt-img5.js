// tmp-update-memory-tt-img5.js — v0.2.34.2 / FC v10.28.24.2 双修复轮记忆仪式
// （backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 奇数，09-11 实测过）。
// scheme 链：上一轮 tt-img4 在链头留下双「commit 4d32d8d 未 push）；」残留——
// 本次 A1 把双段一起吞掉，一次替换同时插入新条目+修双残留。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00202-qpv', HASH = 'fe27726';
const MODIFIED = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00201-5b5（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00201-5b5（';
    const B = '；前身 rev 00194-szr（'; // 不含 00201 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00201 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.34.2 双修复——用户「就只有content card正常 sheet card不正常」+「一添加它的大小就已经超出了表格而且也没办法像文字一样删除」：①大字号时宽图（如国旗 1.6:1）溢出表格格（live 实证 font 32 图宽 77px > 格 69px）→ 内联图规则补 max-width:100% + object-fit:contain，宽图按比例收进所在文字区盒内、不溢出不压扁（常规字号零变化）；②点击 rich 字段（[data-rich="1"]）里的内联图=整图选中（可视反馈），Delete/Backspace 即删（click 委托 closest img.tt-inline-img → Range.selectNode 整图；探针实证光标法删除本就可用、失效只在鼠标点击光标落点不可预测 → 确定性选中即删；内容卡点击行为不动——用户基线「content card 正常」）；FC v10.28.24.2（补丁位 1→2·纯修复轮）；电池 tt-img 34/34（T23a/b/c 真点击真键删除矩阵 + T24 真国旗 32px 断言不溢出）+ tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
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
  if (line.indexOf('v0.2.34.2 = ') === -1 || line.indexOf('当前 v10.28.24.2（') === -1) {
    let l = line;
    // A1 吞掉上一轮双 commit 残留（双段一起换：既修残留又插入新条目）
    const A1 = 'commit 4d32d8d 未 push）；commit 4d32d8d 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit ' + HASH + ' 未 push）；commit 4d32d8d 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const E1 = '2026-09-12 v0.2.34.2 = 两个修复（补丁位 1→2·纯修复轮——用户「就只有content card正常 sheet card不正常」+「一添加它的大小就已经超出了表格而且也没办法像文字一样删除」：①大字号时宽图（如国旗 1.6:1）溢出表格格 → max-width:100% + object-fit:contain 按比例收进文字盒，不溢出不压扁（常规字号零变化）；②点击 rich 字段内联图=整图选中（可视反馈）Delete/Backspace 即删（内容卡点击行为不动——用户基线）；FC v10.28.24.2（补丁位 1→2）；电池 tt-img 34/34 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；';
    const B1f = E1 + B1;
    const A2 = '当前 v10.28.24.1（已部署 rev 00201-5b5，';
    const B2 = '当前 v10.28.24.2（已部署 rev ' + REV + '，2026-09-12 双修复轮·FC 侧=内联图规则补 max-width:100% + object-fit:contain（大字号宽图按比例收进文字盒、不溢出表格格）+ 点击 rich 字段内联图整图选中即删（补丁位 1→2·纯修复轮）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1f], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.34.2 在', l.indexOf('v0.2.34.2 = '), '；FC 头 v10.28.24.2 在', l.indexOf('当前 v10.28.24.2'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00201-5b5（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00201-5b5（';
    const B = '；前身 rev 00194-szr（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.34.2 双修复——用户「就只有content card正常 sheet card不正常」+「一添加它的大小就已经超出了表格而且也没办法像文字一样删除」：①大字号时宽图（如国旗 1.6:1）溢出表格格（live 实证 font 32 图宽 77px > 格 69px）→ 补 max-width:100% + object-fit:contain 按比例收进文字盒（常规字号零变化）；②点击 rich 字段内联图=整图选中（可视反馈）Delete/Backspace 即删（内容卡点击行为不动——用户基线「content card 正常」）；FC v10.28.24.2（补丁位 1→2·纯修复轮）；电池 tt-img 34/34 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.34.1**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.34.2**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.34.1**（';
    const B = '；前身 v0.2.30.5（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 双修复——补丁位 1→2 纯修复轮（用户「就只有content card正常 sheet card不正常」+「一添加它的大小就已经超出了表格而且也没办法像文字一样删除」：大字号宽图（如国旗 1.6:1）超表格格 → max-width:100% + object-fit:contain 按比例收进文字盒（常规字号零变化）；点击 rich 字段内联图=整图选中可视反馈 Delete/Backspace 即删（内容卡点击行为不动）；FC v10.28.24.2（补丁位 1→2）；电池 tt-img 34/34 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.34.2**（' + NEW + '；前身 v0.2.30.5（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
