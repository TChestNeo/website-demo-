// tmp-update-memory-single-resize.js — v0.2.35.1 / FC v10.28.25.1 单卡调大小修复轮记忆仪式
// （backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 奇数，09-11 实测过）。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00204-44k', HASH = '28d99ee';
const MODIFIED = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00203-td4（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00203-td4（';
    const B = '；前身 rev 00194-szr（'; // 不含 00203 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00203 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.35.1 合并组内单卡调大小——用户「现在是当卡片合并后我要在整体单独选中一个卡片调整他的大小时没办法办到，只能长按拆分」（真身×2·可信输入探针实证）：①单独选中只走原生 dblclick 事件，真实双击偏慢（>~500ms 浏览器阈值）/漂移（>~4-8px）时 dblclick 不触发 → 永远整组选中、手柄锚整组外框（长按拆分走 mousedown 所以只剩拆分一条路）；修法=同卡两击 ≤800ms/漂移 ≤10px 延迟 120ms 补发单独选中（原生 dblclick 先到自然跳过零重复；延迟翻转保 v10.28.21.1 钦定图源弹窗条件——第 2 击时 selectionIsSingle 仍 false；点空画布清双击对——A、空点、A 不算双击）②行组内列成员纵向放大盖住下方行卡（探针 44px 重叠、行卡画在列底上层）；修法=列成员单卡缩放提交后行卡按快照偏移贴回新列块（上下行各贴底/顶 flush，探针 44→0）；FC v10.28.25.1（补丁位 0→1·纯修复轮）；电池 group-resize 24/24（17→24：+F4 静态 +S14 慢双击 +S15 慢+8px 漂移 +S16 900ms 窗口外仍整组 +S17 快双击不弹图源 +S18 行卡下拖贴回 flush +S19 上收仍 flush）+ dblmodal 14/14 + merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
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
  if (line.indexOf('v0.2.35.1 = ') === -1 || line.indexOf('当前 v10.28.25.1（') === -1) {
    let l = line;
    // A1 链头：上轮（整行成行）commit 88354be 在最前——一次替换同时插入新条目
    const A1 = 'commit 88354be 未 push）；commit fe27726 未 push）；commit 4d32d8d 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit ' + HASH + ' 未 push）；commit 88354be 未 push）；commit fe27726 未 push）；commit 4d32d8d 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const E1 = '2026-09-12 v0.2.35.1 = 合并组内单卡调大小修复（补丁位 0→1·纯修复轮——用户「现在是当卡片合并后我要在整体单独选中一个卡片调整他的大小时没办法办到，只能长按拆分」：真身×2（可信输入探针）①单独选中只走原生 dblclick，真实双击偏慢/漂移超浏览器阈值时 dblclick 不触发 → 永远整组选中（长按拆分走 mousedown 所以只剩拆分一条路）；修法=同卡两击 ≤800ms/漂移 ≤10px 延迟 120ms 补发单独选中（原生 dblclick 先到自然跳过、不破坏 v10.28.21.1 图源弹窗条件、点空画布清双击对）②行组内列成员纵向放大盖住下方行卡（探针 44px）；修法=单卡缩放提交后行卡按快照偏移贴回列块 flush（探针 44→0）；FC v10.28.25.1（补丁位 0→1）；电池 group-resize 24/24 + dblmodal 14/14 + merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；';
    const B1f = E1 + B1;
    const A2 = '当前 v10.28.25（已部署 rev 00203-td4，';
    const B2 = '当前 v10.28.25.1（已部署 rev ' + REV + '，2026-09-12 合并组内单卡调大小修复轮·FC 侧=慢双击容错（同卡两击 ≤800ms/漂移 ≤10px 延迟 120ms 补发单独选中、原生 dblclick 先到自然跳过、点空画布清双击对）+行组内列成员单卡缩放提交后行卡按快照偏移贴回列块 flush（探针 44→0）；补丁位 0→1·纯修复轮）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1f], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.35.1 在', l.indexOf('v0.2.35.1 = '), '；FC 头 v10.28.25.1 在', l.indexOf('当前 v10.28.25.1'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00203-td4（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00203-td4（';
    const B = '；前身 rev 00194-szr（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.35.1 合并组内单卡调大小——用户「现在是当卡片合并后我要在整体单独选中一个卡片调整他的大小时没办法办到，只能长按拆分」：真身×2（可信输入探针）=①单独选中只走原生 dblclick，真实双击偏慢/漂移超浏览器阈值时不触发 → 永远整组选中（长按拆分走 mousedown 所以只剩拆分）；修法=同卡两击 ≤800ms/漂移 ≤10px 延迟 120ms 补发单独选中（原生 dblclick 先到自然跳过、不破坏 v10.28.21.1 图源弹窗条件、点空画布清双击对）②行组内列成员纵向放大盖住下方行卡（探针 44px）；修法=单卡缩放提交后行卡按快照偏移贴回列块 flush（44→0）；FC v10.28.25.1（补丁位 0→1·纯修复轮）；电池 group-resize 24/24 + dblmodal 14/14 + merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.35.0**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.35.1**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.35.0**（';
    const B = '；前身 v0.2.30.5（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 合并组内单卡调大小修复——补丁位 0→1 纯修复轮（用户「现在是当卡片合并后我要在整体单独选中一个卡片调整他的大小时没办法办到，只能长按拆分」：真身×2=①单独选中只走原生 dblclick，真实双击偏慢/漂移超浏览器阈值时不触发 → 永远整组选中；修法=同卡两击 ≤800ms/漂移 ≤10px 延迟 120ms 补发单独选中（不破坏 v10.28.21.1 图源弹窗条件、点空画布清双击对）②行组内列成员纵向放大盖住下方行卡（探针 44px）；修法=单卡缩放提交后行卡按快照贴回列块 flush（44→0）；FC v10.28.25.1（补丁位 0→1）；电池 group-resize 24/24 + dblmodal 14/14 + merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.35.1**（' + NEW + '；前身 v0.2.30.5（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
