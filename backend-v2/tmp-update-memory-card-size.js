// tmp-update-memory-card-size.js — v0.2.30.5 国旗卡/国徽卡默认尺寸轮记忆仪式（backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 计数 81 奇数，09-11 实测过）。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00194-szr', HASH = 'fbd5b8e';
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00193-hj4（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00193-hj4（';
    const B = '；前身 rev 00192-xns（'; // 不含 00193 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00193 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.30.5 国旗卡/国徽卡默认尺寸——用户「把国旗卡片改成 长5格 国徽卡片改成5x5」→问询钦定国旗=8宽×5长：国旗卡 8×6→8×5（assetSpan flag h 6→5 + 草稿恢复 rowSpan||5）、国徽卡（Emblem shield 资产卡）4×3→5×5（assetSpan shield 显式 5×5 + 草稿恢复新增 shield 分支 colSpan||5/rowSpan||5）；存了旧 span 的草稿尊重存值不强制改；FC v10.28.20.5（补丁位 4→5·观感微调轮）；电池 tmp-battery-card-default-size.js 14/14（拖放 flag 8×5/shield 5×5、草稿往返、legacy 无 span 兜底、旧 span 尊重、Z 零 error）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00193-hj4（' + oldBody + l.slice(ib);
    const mk = (l.match(/\*\*/g) || []).length;
    if (mk % 2 !== 0 || !balanced(l) || l.indexOf('）**；前身 rev 00193-hj4（') === -1) { console.error('BAD backend bold state: 计数', mk); process.exit(1); }
    s.lines[li] = l;
    const mi = s.lines.findIndex(x => x.indexOf('modified:') !== -1);
    if (mi === -1) { console.error('MISS modified line'); process.exit(1); }
    s.lines[mi] = s.lines[mi].replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, '2026-09-12T17:00:00.000Z');
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
  if (line.indexOf('v0.2.30.5 = ') === -1 || line.indexOf('当前 v10.28.20.5（') === -1) {
    let l = line;
    const A1 = 'commit 76e1132 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit 76e1132 未 push）；2026-09-12 v0.2.30.5 = 国旗卡/国徽卡默认尺寸（补丁位 4→5·观感微调轮——用户「把国旗卡片改成 长5格 国徽卡片改成5x5」，问询钦定国旗=8宽×5长：国旗卡 8×6→8×5、国徽卡 4×3→5×5，assetSpan+草稿恢复兜底同改，存了旧 span 的草稿尊重存值）；FC v10.28.20.5（补丁位 4→5）；零后端、ethereal 零改动无需 inline-css；电池 tmp-battery-card-default-size.js 14/14；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const A2 = '当前 v10.28.20.4（已部署 rev 00193-hj4，';
    const B2 = '当前 v10.28.20.5（已部署 rev ' + REV + '，2026-09-12 国旗卡/国徽卡默认尺寸轮·FC 侧=assetSpan flag h 6→5 + shield 显式 5×5、草稿恢复兜底同改（flag rowSpan||5、shield 分支 5×5）——拖出来的国旗卡 8宽×5长、国徽卡 5×5；行为=新卡默认尺寸符合用户钦定（补丁位 4→5）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.30.5 在', l.indexOf('v0.2.30.5 = '), '；FC 头 v10.28.20.5 在', l.indexOf('当前 v10.28.20.5'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00193-hj4（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00193-hj4（';
    const B = '；前身 rev 00192-xns（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.30.5 国旗卡/国徽卡默认尺寸——用户「把国旗卡片改成 长5格 国徽卡片改成5x5」→问询钦定国旗=8宽×5长：国旗卡 8×6→8×5、国徽卡 4×3→5×5（assetSpan+草稿恢复兜底同改，存了旧 span 的草稿尊重存值）；FC v10.28.20.5（补丁位 4→5·观感微调轮）；电池 14/14；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00193-hj4（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.30.4**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.30.5**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.30.4**（';
    const B = '；前身 v0.2.30.3（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 国旗卡/国徽卡默认尺寸——补丁位 4→5 观感微调轮（用户「把国旗卡片改成 长5格 国徽卡片改成5x5」，问询钦定国旗=8宽×5长：国旗卡 8×6→8×5、国徽卡 4×3→5×5，assetSpan+草稿恢复兜底同改，存了旧 span 的草稿尊重存值）；FC v10.28.20.5（补丁位 4→5）；电池 14/14；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.30.5**（' + NEW + '；前身 v0.2.30.4（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
