// tmp-update-memory-caredge-dark.js — v0.2.30.3 卡框高光清除+边框统一暗色轮记忆仪式（backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-11）
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
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00191-rlp（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev 00192-xns（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00191-rlp（';
    const B = '；前身 rev 00190-4w2（'; // 不含 00191 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00191 条目正文（链式无闭合）
    const NEW = '2026-09-11 v0.2.30.3 卡框高光清除+边框统一暗色——用户「请帮我修改这个卡片组件的代码。目前在深色模式下，卡片外框右上角有一条很突兀的白色/浅色高光边线（可能是 Linear Gradient 边框、top/right 单独设置的 border-color、或者是 box-shadow / inset 效果）」+「将卡片整体的外边框（border）统一改为暗色低调的微弱边框（例如 border: 1px solid rgba(255, 255, 255, 0.08)），或者直接去除高亮边框，使其融入深色背景中」：真身=v10.27 磨砂玻璃轮「右上角 2px 高光条」（background-image 白渐变贴 top right——浅色玻璃质感、深色下突兀）；4 处卡面高光全清（玻璃卡 content/stats/flag/asset 规则、.grid-group-bg 组背景、.card-tint 主题卡填充层、card-edge-paint ::before）；边框统一 var(--divider-line)（深色=rgba(255,255,255,0.08) 正是用户举例值），基卡 2px 宽不动（主题卡外板几何按 2px 边宽调过，只换色不动宽）；统计编辑面板高光保留（v10.28.6.2 钦定浮动面板非卡框）；FC v10.28.20.3（补丁位 2→3·观感微调轮）；电池 tmp-battery-caredge-dark.js 9/9（B2 深色边框恰=rgba(255,255,255,0.08)——踩坑=设 data-theme 后 350ms 读仍撞 border-color 0.15s 过渡中途（两次实测读到插值线上不同位置 245,245,246/197,196,204，headless 定时器/全页重算使过渡起跑偏晚）→改采样 15×100ms 等收敛再断言终值；Z 零 console error）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00192-xns）；commit d4d52fd 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev 00192-xns（' + NEW + '）**；前身 rev 00191-rlp（' + oldBody + l.slice(ib);
    const mk = (l.match(/\*\*/g) || []).length;
    if (mk % 2 !== 0 || !balanced(l) || l.indexOf('）**；前身 rev 00191-rlp（') === -1) { console.error('BAD backend bold state: 计数', mk); process.exit(1); }
    s.lines[li] = l;
    const mi = s.lines.findIndex(x => x.indexOf('modified:') !== -1);
    if (mi === -1) { console.error('MISS modified line'); process.exit(1); }
    s.lines[mi] = s.lines[mi].replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, '2026-09-11T16:00:00.000Z');
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
  if (line.indexOf('v0.2.30.3 = ') === -1 || line.indexOf('当前 v10.28.20.3（') === -1) {
    let l = line;
    const A1 = 'commit 1aacff3 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit 1aacff3 未 push）；2026-09-11 v0.2.30.3 = 卡框高光清除+边框统一暗色（补丁位 2→3·观感微调轮——用户「深色模式下卡片外框右上角有一条很突兀的白色/浅色高光边线…清除卡片右上角及整个外框所有的白色/浅色渐变高光线」+「将卡片整体的外边框统一改为暗色低调的微弱边框（例如 rgba(255,255,255,0.08)），或直接去除高亮边框，使其融入深色背景」：真身=v10.27 磨砂玻璃轮「右上角 2px 高光条」；4 处卡面（玻璃卡规则/组背景/主题卡填充层/card-edge-paint）高光全清+统计编辑面板高光保留（v10.28.6.2 钦定浮动面板）；边框统一 var(--divider-line) 深色=rgba(255,255,255,0.08) 正是用户举例值，基卡 2px 宽不动）；FC v10.28.20.3（补丁位 2→3）；零后端、ethereal 零改动无需 inline-css；电池 tmp-battery-caredge-dark.js 9/9；curl（health 58+v0.2.30.3+v10.28.20.3+高光梯度×1+边框统一代码在+editor 200）；部署一次 exit 0（00192-xns）；commit d4d52fd 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const A2 = '当前 v10.28.20.2（已部署 rev 00191-rlp，';
    const B2 = '当前 v10.28.20.3（已部署 rev 00192-xns，2026-09-11 卡框高光清除+边框统一暗色轮·FC 侧=v10.27 「右上角 2px 高光条」从 4 处卡面清除（玻璃卡规则/组背景/主题卡填充层/card-edge-paint ::before）、边框统一 var(--divider-line)（深色=rgba(255,255,255,0.08)）、统计编辑面板高光保留（钦定浮动面板）；行为零变化（补丁位 2→3）；commit d4d52fd）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.30.3 在', l.indexOf('v0.2.30.3 = '), '；FC 头 v10.28.20.3 在', l.indexOf('当前 v10.28.20.3'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00191-rlp（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev 00192-xns（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00191-rlp（';
    const B = '；前身 rev 00190-4w2（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-11 v0.2.30.3 卡框高光清除+边框统一暗色——用户「深色模式下卡片外框右上角有一条很突兀的白色/浅色高光边线…清除所有白色/浅色渐变高光线」+「边框统一暗色低调微弱边框（例如 rgba(255,255,255,0.08)），融入深色背景」：真身=v10.27 磨砂玻璃轮「右上角 2px 高光条」；4 处卡面（玻璃卡规则/组背景/主题卡填充层/card-edge-paint）全清+统计编辑面板高光保留（v10.28.6.2 钦定浮动面板）；边框统一 var(--divider-line)（深色=rgba(255,255,255,0.08) 正是用户举例值）；FC v10.28.20.3（补丁位 2→3·观感微调轮）；电池 9/9；部署一次 exit 0（00192-xns）；commit d4d52fd 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev 00192-xns（' + NEW + '）**；前身 rev 00191-rlp（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.30.2**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.30.3**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.30.2**（';
    const B = '；前身 v0.2.30.1（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-11 卡框高光清除+边框统一暗色——补丁位 2→3 观感微调轮（用户「深色模式下卡片外框右上角有一条很突兀的白色/浅色高光边线…」+「边框统一暗色低调微弱边框（例如 rgba(255,255,255,0.08)）」：真身=v10.27 「右上角 2px 高光条」；4 处卡面全清、统计编辑面板高光保留（钦定浮动面板）；边框统一 var(--divider-line)（深色=rgba(255,255,255,0.08) 正是用户举例值）；FC v10.28.20.3（补丁位 2→3）；电池 9/9；部署一次 exit 0（00192-xns）；commit d4d52fd 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.30.3**（' + NEW + '；前身 v0.2.30.2（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
