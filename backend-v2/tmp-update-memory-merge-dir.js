// tmp-update-memory-merge-dir.js — v0.2.30.4 吸合方向感轮记忆仪式（backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 计数 81 奇数，09-11 实测过）。
// 占位：00193-hj4=本轮部署 rev、76e1132=本轮 commit（运行前 sed 替换）。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00193-hj4', HASH = '76e1132';
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00192-xns（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00192-xns（';
    const B = '；前身 rev 00191-rlp（'; // 不含 00192 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00192 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.30.4 吸合方向感——用户「能不能判定一下方向，如果卡片是在左侧合并后应该就是在左侧而不是变成跑到下方」：真身=mergeCards 等宽归一以左缘为锚，窄卡从左/右并入既有组时被拉成组宽、右缘越过目标竖边 → reflowGroup 按水平重叠把全组压成一列叠到下方（实况探针：80px 窄卡左并入 174px 组 → 整组塌成一列，拖卡落到目标下方）；修法=findMergeSnap 边对加 side（拖动卡在目标左/右/上/下哪一侧），mergeCards(card, target, side) 归一后按 side 重新贴齐（左/右贴竖边、上/下贴横边并 x 对齐目标列）再 reflow——贴齐边恒 flush，reflow 按边分列不再塌；FC v10.28.20.4（补丁位 3→4·纯修复轮）；电池 tmp-battery-merge-dir.js 12/12（S3=用户场景窄卡左并入组→左列+列顶齐+组完好；S1 首合并左并/S4 右并/S5 上并/S2 下意图胜出；R1 远距不吸合回归+R2 一体式高亮回归；Z 零 console error）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00192-xns（' + oldBody + l.slice(ib);
    const mk = (l.match(/\*\*/g) || []).length;
    if (mk % 2 !== 0 || !balanced(l) || l.indexOf('）**；前身 rev 00192-xns（') === -1) { console.error('BAD backend bold state: 计数', mk); process.exit(1); }
    s.lines[li] = l;
    const mi = s.lines.findIndex(x => x.indexOf('modified:') !== -1);
    if (mi === -1) { console.error('MISS modified line'); process.exit(1); }
    s.lines[mi] = s.lines[mi].replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, '2026-09-12T16:00:00.000Z');
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
  if (line.indexOf('v0.2.30.4 = ') === -1 || line.indexOf('当前 v10.28.20.4（') === -1) {
    let l = line;
    const A1 = 'commit d4d52fd 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit d4d52fd 未 push）；2026-09-12 v0.2.30.4 = 吸合方向感（补丁位 3→4·纯修复轮——用户「能不能判定一下方向，如果卡片是在左侧合并后应该就是在左侧而不是变成跑到下方」：真身=mergeCards 等宽归一以左缘为锚，窄卡并入既有组被拉成组宽、右缘越过目标竖边 → reflowGroup 按水平重叠把全组压成一列叠到下方；修法=findMergeSnap 边对加 side + mergeCards(card, target, side) 归一后按 side 重新贴齐再 reflow）；FC v10.28.20.4（补丁位 3→4）；零后端、ethereal 零改动无需 inline-css；电池 tmp-battery-merge-dir.js 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const A2 = '当前 v10.28.20.3（已部署 rev 00192-xns，';
    const B2 = '当前 v10.28.20.4（已部署 rev ' + REV + '，2026-09-12 吸合方向感轮·FC 侧=findMergeSnap 边对加 side（\'left\'/\'right\'/\'top\'/\'bottom\'）+ mergeCards(card, target, side) 归一后按吸合边重新贴齐再 reflow（左/右贴竖边、上/下贴横边+x 对齐目标列）——窄卡并入组不再被拉宽后压成一列叠到下方（用户「卡片在左侧合并后应该就是在左侧而不是变成跑到下方」）；行为=吸合位置符合直觉（补丁位 3→4）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.30.4 在', l.indexOf('v0.2.30.4 = '), '；FC 头 v10.28.20.4 在', l.indexOf('当前 v10.28.20.4'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00192-xns（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00192-xns（';
    const B = '；前身 rev 00191-rlp（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.30.4 吸合方向感——用户「能不能判定一下方向，如果卡片是在左侧合并后应该就是在左侧而不是变成跑到下方」：真身=mergeCards 等宽归一以左缘为锚，窄卡从左/右并入既有组被拉成组宽、右缘越过目标竖边 → reflowGroup 按水平重叠把全组压成一列叠到下方（实况探针：80px 窄卡左并入 174px 组 → 整组塌成一列）；修法=findMergeSnap 边对加 side + mergeCards(card, target, side) 归一后按 side 重新贴齐（左/右贴竖边、上/下贴横边+x 对齐目标列）再 reflow；FC v10.28.20.4（补丁位 3→4·纯修复轮）；电池 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00192-xns（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.30.3**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.30.4**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.30.3**（';
    const B = '；前身 v0.2.30.2（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 吸合方向感——补丁位 3→4 纯修复轮（用户「能不能判定一下方向，如果卡片是在左侧合并后应该就是在左侧而不是变成跑到下方」：真身=mergeCards 等宽归一以左缘为锚，窄卡并入既有组被拉成组宽 → reflowGroup 按水平重叠把全组压成一列叠到下方；修法=findMergeSnap 边对加 side + mergeCards 归一后按 side 重新贴齐再 reflow）；FC v10.28.20.4（补丁位 3→4）；电池 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.30.4**（' + NEW + '；前身 v0.2.30.3（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
