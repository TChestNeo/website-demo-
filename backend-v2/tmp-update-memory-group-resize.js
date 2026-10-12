// tmp-update-memory-group-resize.js — v0.2.31.0 合并组整体缩放+单击恒选整组轮记忆仪式（backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 奇数，09-11 实测过）。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00195-rsb', HASH = 'a8d457f';
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00194-szr（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00194-szr（';
    const B = '；前身 rev 00193-hj4（'; // 不含 00194 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00194 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.31.0 合并组整体缩放+单击恒选整组——用户「那个合并后整体的卡片能不能做一个可以放大缩小的功能和独立卡片一样，然后当我只是要选中整体的卡片时会直接触发到独立卡片而不是在选中独立卡片的情况下双击才会触发」：①整组选中时 8 手柄锚定整组外框（bbox）统一缩放（轴对齐、成员独立量化、锁比例成员等比、沿拖拽轴去重叠链保 flush、commit 只 moveCardPx+updateGroupBgs 无 reflow 回抢、Escape/双点等交互全接）；②单击组内成员恒选整组、单独选中只走双击（mousedownAlreadySelected 全删）；探针抓出去重叠真 bug（连续比例位置+独立量化尺寸差半格 → flush 重叠 → 草稿恢复 reflowGroup 塌成竖列）；电池 tmp-battery-group-resize.js 17/17 + merge 回归 12/12；FC v10.28.21（小更新位 20→21·新功能轮·补丁归零）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    const mk = (l.match(/\*\*/g) || []).length;
    if (mk % 2 !== 0 || !balanced(l) || l.indexOf('）**；前身 rev 00194-szr（') === -1) { console.error('BAD backend bold state: 计数', mk); process.exit(1); }
    s.lines[li] = l;
    const mi = s.lines.findIndex(x => x.indexOf('modified:') !== -1);
    if (mi === -1) { console.error('MISS modified line'); process.exit(1); }
    s.lines[mi] = s.lines[mi].replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, '2026-09-12T18:30:00.000Z');
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
  if (line.indexOf('v0.2.31.0 = ') === -1 || line.indexOf('当前 v10.28.21（') === -1) {
    let l = line;
    const A1 = 'commit fbd5b8e 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit fbd5b8e 未 push）；2026-09-12 v0.2.31.0 = 合并组整体缩放+单击恒选整组（小改动位 30→31·新功能轮·补丁归零——用户「合并后整体的卡片…放大缩小…选中整体的卡片时会直接触发到独立卡片」：①组选中时 8 手柄锚定整组外框统一缩放（成员独立量化、锁比例等比、去重叠链、无 reflow 回抢）②单击组内成员恒选整组、单独选中只走双击；FC v10.28.21（小更新位 20→21）；零后端、ethereal 零改动无需 inline-css；电池 tmp-battery-group-resize.js 17/17 + merge 回归 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const A2 = '当前 v10.28.20.5（已部署 rev 00194-szr，';
    const B2 = '当前 v10.28.21（已部署 rev ' + REV + '，2026-09-12 合并组整体缩放+单击恒选整组轮·FC 侧=整组选中 8 手柄挂组外框（bbox）统一缩放（onGroupResizeMove 连续比例位置+独立量化尺寸+沿拖拽轴去重叠链、commitGroupResize 只 moveCardPx+updateGroupBgs 不 reflow）、单击组内成员恒选整组/单独选中只走双击（mousedownAlreadySelected 全删）——用户「合并后整体的卡片能不能…放大缩小…选中整体的卡片时会直接触发到独立卡片」；行为=整组整体缩放+单击恒选整组（小更新位 20→21）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.31.0 在', l.indexOf('v0.2.31.0 = '), '；FC 头 v10.28.21 在', l.indexOf('当前 v10.28.21'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00194-szr（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00194-szr（';
    const B = '；前身 rev 00193-hj4（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.31.0 合并组整体缩放+单击恒选整组——用户「合并后整体的卡片能不能…放大缩小…选中整体的卡片时会直接触发到独立卡片」：组选中时 8 手柄锚定整组外框统一缩放（成员独立量化、锁比例等比、去重叠链保 flush、commit 不 reflow）；单击组内成员恒选整组、单独选中只走双击；FC v10.28.21（小更新位 20→21·新功能轮·补丁归零）；电池 17/17 + merge 回归 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.30.5**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.31.0**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.30.5**（';
    const B = '；前身 v0.2.30.4（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 合并组整体缩放+单击恒选整组——小改动位 30→31 新功能轮·补丁归零（用户「合并后整体的卡片能不能…放大缩小…选中整体的卡片时会直接触发到独立卡片」：组选中时 8 手柄锚定整组外框统一缩放+去重叠链保 flush；单击组内成员恒选整组、单独选中只走双击）；FC v10.28.21（小更新位 20→21）；电池 17/17 + merge 回归 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.31.0**（' + NEW + '；前身 v0.2.30.5（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
