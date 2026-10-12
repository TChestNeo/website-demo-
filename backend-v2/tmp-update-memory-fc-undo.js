// tmp-update-memory-fc-undo.js — v0.2.30.0 撤回/恢复轮记忆仪式（backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-11）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// backend-build-state.md 历史遗留修复：旧链丢 2 个加粗标记（头部闭合 + 00091 条目开），
// 造成三大段倒挂粗体——本轮换头的同时补回 00091 开，全链配对归正。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + 00091 补开 + modified 时间戳） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00188-sts（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev 00189-z6x（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00188-sts（';
    const B = '；前身 rev 00187-t8w（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib); // 00188 条目正文（头部闭合加粗早已丢，正文无标记）
    const NEW = '2026-09-11 v0.2.30.0 编辑器撤回/恢复按钮——用户「能不能在顶部添加一个撤回和恢复按钮」：快照式撤销栈（buildDraft JSON 串剥 lastSaved 时间戳对比、600ms 防抖挂 onContentChange 尾零调用点改动、基线初始化完成后即拍下——首个改动即可撤回回原点、栈上限 60）；historyUndoAction/historyRedoAction 走 applyDraft 恢复（v10.28.15.2 先清画布幂等）+saveDraft 落库+重基线防漂移；工具栏 History 左侧 撤回/恢复 两钮（disabled 灰态）+Ctrl+Z/Ctrl+Y（input/textarea/contenteditable 焦点让位原生撤销）；踩坑=大脚本 IIFE 函数必须显式挂窗否则 onclick 全灭（电池 S1 抓出）；FC v10.28.20；电池 tmp-battery-fc-undo.js 15/15（F4+S8 三步深栈/键盘/输入框守卫/落草稿/重载持久）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00189-z6x）；commit 3f79fcc 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev 00189-z6x（' + NEW + '）**；前身 rev 00188-sts（' + oldBody + l.slice(ib);
    const A91 = '——前身 rev 00091-pqx（';
    const c91 = l.split(A91).length - 1;
    if (c91 !== 1) { console.error('BAD 00091 anchor count', c91); process.exit(1); }
    l = l.replace(A91, '——**前身 rev 00091-pqx（');
    const mk = (l.match(/\*\*/g) || []).length;
    if (mk % 2 !== 0 || !balanced(l) || l.indexOf('）**；前身 rev 00188-sts（') === -1) { console.error('BAD backend bold state: 计数', mk); process.exit(1); }
    s.lines[li] = l;
    const mi = s.lines.findIndex(x => x.indexOf('modified:') !== -1);
    if (mi === -1) { console.error('MISS modified line'); process.exit(1); }
    s.lines[mi] = s.lines[mi].replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, '2026-09-11T10:30:00.000Z');
    writeLines(p, s); cnt++;
    console.log('OK backend-build-state：head 行', li + 1, '；modified 行', mi + 1, '；** 数', mk, '偶数且配对归正 + 00091 开补回');
  } else { console.log('SKIP backend-build-state（已更新）'); }
}

// ── 2. site-versioning-scheme.md（行 11 双锚：站点链 + FC 头） ──
{
  const p = MEM + 'site-versioning-scheme.md';
  const s = readLines(p);
  if (s.lines[10].indexOf('v0.2.30.0 = 编辑器撤回/恢复按钮') === -1) {
    let l = s.lines[10];
    const A1 = 'commit 3b55598 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit 3b55598 未 push）；2026-09-11 v0.2.30.0 = 编辑器撤回/恢复按钮（小改动位 29→30·新功能轮·补丁归零——用户「能不能在顶部添加一个撤回和恢复按钮」：快照式撤销栈 buildDraft JSON 串剥 lastSaved 时间戳对比、600ms 防抖挂 onContentChange 尾零调用点改动、基线初始化完成后即拍下——首个改动即可撤回回原点、栈上限 60；恢复走 applyDraft 先清画布幂等+saveDraft 落库+重基线防漂移；工具栏 History 左侧 撤回/恢复 两钮（disabled 灰态）+Ctrl+Z/Ctrl+Y（input/textarea/contenteditable 焦点让位原生撤销）；踩坑=大脚本 IIFE 函数必须显式 window 挂窗（电池 S1 抓出）；FC v10.28.20（小更新位 19→20·小功能轮）；零后端、ethereal 零改动无需 inline-css；探针 tmp-battery-fc-undo.js 15/15（F4+S8：三步深栈/键盘/输入框守卫/撤销态落草稿/重载持久）；curl（health 58+v0.2.30.0+v10.28.20+编辑器双钮与挂窗在+index 200）；部署一次 exit 0（00189-z6x）；commit 3f79fcc 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const A2 = '当前 v10.28.19.3（已部署 rev 00188-sts，2026-09-11 表格卡列宽/行高手柄轮·FC 侧=每列 ↔ 每行 ↕ 按住拖动调整，colgroup 三截制，sheetData 增 colW/rowH 随草稿往返（补丁位 2→3）；commit 3b55598）';
    const B2 = '当前 v10.28.20（已部署 rev 00189-z6x，2026-09-11 编辑器撤回/恢复轮·FC 侧=快照式撤销栈（historySnapshot 剥 lastSaved 时间戳、600ms 防抖挂 onContentChange 尾零调用点改动、基线初始化后即拍、栈上限 60、恢复走 applyDraft 先清画布幂等+saveDraft 落库+重基线防漂移；工具栏 撤回/恢复 两钮+Ctrl+Z/Y 输入框焦点让位；IIFE 显式挂窗）（小更新位 19→20·小功能轮）；commit 3f79fcc）；前身 ' + A2;
    let n = 0;
    for (const [a, b] of [[A1, B1], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.30.0 在', l.indexOf('v0.2.30.0 = '), '；FC 头 v10.28.20 在', l.indexOf('当前 v10.28.20'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00188-sts（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev 00189-z6x（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00188-sts（';
    const B = '；前身 rev 00187-t8w（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-11 v0.2.30.0 编辑器撤回/恢复按钮——用户「能不能在顶部添加一个撤回和恢复按钮」：快照式撤销栈（600ms 防抖挂 onContentChange、基线初始化后即拍、栈上限 60、恢复走 applyDraft+saveDraft+重基线、Ctrl+Z/Y 输入框让位；IIFE 需显式挂窗）；FC v10.28.20；电池 15/15；部署一次 exit 0（00189-z6x）；commit 3f79fcc 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev 00189-z6x（' + NEW + '）**；前身 rev 00188-sts（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.29.3**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.30.0**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.29.3**（';
    const B = '；前身 v0.2.29.2（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-11 编辑器撤回/恢复按钮——小改动位 29→30 新功能轮·补丁归零；FC v10.28.20（小更新位 19→20）；电池 15/15；部署一次 exit 0（00189-z6x）；commit 3f79fcc 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.30.0**（' + NEW + '；前身 v0.2.29.3（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
