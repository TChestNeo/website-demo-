// tmp-update-memory-partners.js — v0.2.35.2 / FC v10.28.25.2 挤压让位轮记忆仪式
// （backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 奇数，09-11 实测过）。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00205-hhs', HASH = '530944e';
const MODIFIED = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00204-44k（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00204-44k（';
    const B = '；前身 rev 00194-szr（'; // 不含 00204 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00204 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.35.2 合并组单卡缩放挤压让位——用户「可以单独调整了但是旁边的卡片不会因为被挤压而移动而不是一动不动的保持原位…这是最基础就应该做好的」（真身·可信输入探针实证）=单卡缩放提交只走 alignGroupTops+pushGroupRows，列内伙伴从不移动（A 东扩 +66 → B 冻结重叠 66；东收 -30 → B 不回贴仍重叠 44；3列中间列 → 右侧列冻结；行组块增长 66 行宽仍 348；内容卡 minHeight 假间隙 44）；修法=墙模型——提交时移动边为墙，墙外伙伴按方向整体平移（东扩右集合 +dw / 西扩左集合 -dw / 南扩下方集合 +dh / 北扩上方集合 -dh；收缩=负 delta 拉回），齐平/间隙全保持、独立卡自由缩放不受影响；行宽跟随列块（仅默认全宽行——左≈块左且宽≈块宽才重断言，自定义窄行永不抢回）；origVisH=视觉高（offsetHeight）修内容卡 minHeight 假间隙；Escape 与松手共用 commitSingleResize 收口；探针 14/14（P1-P11 + Q1-Q3）；FC v10.28.25.2（补丁位 1→2·纯修复轮）；电池 group-resize 34/34（24→34：+S20-S28 全可信输入——东扩让位/东收回贴/3列级联/西扩让位/行宽跟随/自定义行不抢回/叠堆南扩让位/Escape 让位/草稿往返行宽持久，S28 首跑抓出多场景 autosave 草稿污染→先清草稿重跑）+ dblmodal 14/14 + merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12（112/112）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
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
  if (line.indexOf('v0.2.35.2 = ') === -1 || line.indexOf('当前 v10.28.25.2（') === -1) {
    let l = line;
    // A1 链头：上轮（单卡调大小）commit 28d99ee 在最前——一次替换同时插入新条目
    const A1 = 'commit 28d99ee 未 push）；commit 88354be 未 push）；commit fe27726 未 push）；commit 4d32d8d 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit ' + HASH + ' 未 push）；commit 28d99ee 未 push）；commit 88354be 未 push）；commit fe27726 未 push）；commit 4d32d8d 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const E1 = '2026-09-12 v0.2.35.2 = 合并组单卡缩放挤压让位修复（补丁位 1→2·纯修复轮——用户「可以单独调整了但是旁边的卡片不会因为被挤压而移动而不是一动不动的保持原位…这是最基础就应该做好的」：真身（可信输入探针）=单卡缩放提交只走 alignGroupTops+pushGroupRows，列内伙伴从不移动（东扩重叠 66、东收不回贴、3列中列冻结右列、行宽冻结差值 66）；修法=墙模型——移动边为墙，墙外伙伴按方向整体平移（东/西/南/北四向集合，收缩=负 delta 拉回），齐平/间隙全保持；行宽跟随列块（仅默认全宽行，自定义窄行永不抢回）；origVisH 视觉高修内容卡 minHeight 假间隙；Escape 与松手共用 commitSingleResize；探针 14/14；FC v10.28.25.2（补丁位 1→2）；电池 group-resize 34/34 + dblmodal 14/14 + merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12（112/112；S28 首跑抓出多场景 autosave 草稿污染→先清草稿重跑）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；';
    const B1f = E1 + B1;
    const A2 = '当前 v10.28.25.1（已部署 rev 00204-44k，';
    const B2 = '当前 v10.28.25.2（已部署 rev ' + REV + '，2026-09-12 挤压让位轮·FC 侧=墙模型（移动边为墙，墙外伙伴按方向整体平移、收缩拉回）+行宽跟随列块（默认全宽行）+origVisH 修假间隙+Escape 与松手共用 commitSingleResize；补丁位 1→2·纯修复轮）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1f], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.35.2 在', l.indexOf('v0.2.35.2 = '), '；FC 头 v10.28.25.2 在', l.indexOf('当前 v10.28.25.2'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00204-44k（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00204-44k（';
    const B = '；前身 rev 00194-szr（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.35.2 合并组单卡缩放挤压让位——用户「可以单独调整了但是旁边的卡片不会因为被挤压而移动而不是一动不动的保持原位…这是最基础就应该做好的」：真身（可信输入探针）=单卡缩放提交只走 alignGroupTops+pushGroupRows，列内伙伴从不移动（东扩重叠 66、东收不回贴、3列中列冻结右列、行宽冻结差值 66、内容卡 minHeight 假间隙 44）；修法=墙模型——移动边为墙，墙外伙伴按方向整体平移（东扩右集合 +dw/西扩左集合 -dw/南扩下方集合 +dh/北扩上方集合 -dh，收缩=负 delta 拉回），齐平/间隙全保持、独立卡自由；行宽跟随列块（仅默认全宽行，自定义窄行永不抢回）；origVisH=视觉高修 minHeight 假间隙；Escape 与松手共用 commitSingleResize；FC v10.28.25.2（补丁位 1→2·纯修复轮）；电池 group-resize 34/34 + dblmodal 14/14 + merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12（112/112；S28 首跑抓出多场景 autosave 草稿污染→先清草稿重跑）；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.35.1**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.35.2**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.35.1**（';
    const B = '；前身 v0.2.30.5（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 合并组单卡缩放挤压让位修复——补丁位 1→2 纯修复轮（用户「可以单独调整了但是旁边的卡片不会因为被挤压而移动而不是一动不动的保持原位…这是最基础就应该做好的」：真身=单卡缩放提交只走 alignGroupTops+pushGroupRows，列内伙伴从不移动（东扩重叠 66、东收不回贴）；修法=墙模型——移动边为墙，墙外伙伴按方向整体平移（四向集合，收缩=负 delta 拉回），齐平/间隙全保持；行宽跟随列块（自定义窄行不抢回）；origVisH 修 minHeight 假间隙；Escape 与松手共用 commitSingleResize；FC v10.28.25.2（补丁位 1→2）；电池 group-resize 34/34 + dblmodal 14/14 + merge-dir 18/18 + tt-img 34/34 + tt-caret 12/12（112/112）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.35.2**（' + NEW + '；前身 v0.2.30.5（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
