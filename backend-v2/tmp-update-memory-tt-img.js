// tmp-update-memory-tt-img.js — v0.2.32.0 / FC v10.28.22 工具栏添加图像·Wiki 式内联图轮记忆仪式
// （backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 奇数，09-11 实测过）。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00198-6rf', HASH = 'e599454';
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00197-pf8（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00197-pf8（';
    const B = '；前身 rev 00194-szr（'; // 不含 00197 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00197 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.32.0 工具栏添加图像·Wiki 式内联图——用户「然后能不能在工具栏的右侧那边再增加一个按钮叫添加图像，就是你可以添加国旗/国徽等等的图像，然后图像的大小是根据文字的大小进行等比例变化的，这样可以完成类似于Wiki 的功能」：工具栏右端 image 钮（title 添加图像；输入框态置灰——标签/姓名/表格格等输入框装不了图）+ tt-img-pop 弹层（4 列格：国旗库 15 面程序化条纹 canvas 240×150 光栅化 PNG data URL——块2 IIFE 经 window.FC_FLAG_LIBRARY 供数 + 「上传」格任意图、国徽等同口径）；只进内容卡文字：insertInlineImage 选区替换/光标插入、光标置图后、onContentChange 入撤销快照；img.tt-inline-img CSS height 1.5em → em 继承字号变图等比变（光标态整块字号/选区 span 两条路都等比，电池 32→48px、24→36px 实测）；内容卡草稿本就 innerHTML 往返 + sanitizeDraftHtml 放行 data: 图 → 保存/刷新无损、零新字段；块1 showToast 上窗供跨 IIFE 调用（电池抓出上传成功 toast ReferenceError——真 bug 部署前拦截）；FC v10.28.22（小更新位 21→22·新功能轮·补丁归零）；电池 tt-img 13/13 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    const mk = (l.match(/\*\*/g) || []).length;
    if (mk % 2 !== 0 || !balanced(l) || l.indexOf('）**；前身 rev 00194-szr（') === -1) { console.error('BAD backend bold state: 计数', mk); process.exit(1); }
    s.lines[li] = l;
    const mi = s.lines.findIndex(x => x.indexOf('modified:') !== -1);
    if (mi === -1) { console.error('MISS modified line'); process.exit(1); }
    s.lines[mi] = s.lines[mi].replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, '2026-09-12T22:10:00.000Z');
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
  if (line.indexOf('v0.2.32.0 = ') === -1 || line.indexOf('当前 v10.28.22（') === -1) {
    let l = line;
    const A1 = 'commit 2544f10 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit ' + HASH + ' 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const E1 = '2026-09-12 v0.2.32.0 = 工具栏添加图像·Wiki 式内联图（小改动位 31→32·新功能轮·补丁归零——用户「在工具栏的右侧那边再增加一个按钮叫添加图像，就是你可以添加国旗/国徽等等的图像，图像的大小根据文字大小等比例变化，完成类似于Wiki 的功能」：工具栏右端 image 钮+tt-img-pop 弹层（国旗库 15 面 canvas 光栅化 PNG data URL + 上传任意图）；只进内容卡文字（输入框态按钮置灰）；img.tt-inline-img height 1.5em 字号等比（光标态整块/选区 span 两条路）；草稿 innerHTML 往返 + data: 放行无损零新字段；showToast 上窗跨块）；FC v10.28.22（小更新位 21→22）；电池 tt-img 13/13 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；';
    const B1f = E1 + B1;
    const A2 = '当前 v10.28.21.2（已部署 rev 00197-pf8，';
    const B2 = '当前 v10.28.22（已部署 rev ' + REV + '，2026-09-12 工具栏添加图像·Wiki 式内联图轮·FC 侧=工具栏右端 image 钮（title 添加图像、输入框态置灰）+tt-img-pop 弹层（国旗库 15 面 canvas 光栅化 PNG data URL——块2 经 window.FC_FLAG_LIBRARY 供数+上传任意图）、insertInlineImage 选区替换/光标插入光标置图后、img.tt-inline-img height 1.5em 字号等比（光标态整块/选区 span 两条路）、内容卡草稿 innerHTML 往返+data: 放行无损零新字段、showToast 上窗跨块；行为=内容卡光标态点工具栏最右侧 image 钮选旗/上传 → 图插进文字、改字号图等比变、保存/刷新图不丢（小更新位 21→22·新功能轮·补丁归零）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1f], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.32.0 在', l.indexOf('v0.2.32.0 = '), '；FC 头 v10.28.22 在', l.indexOf('当前 v10.28.22'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00197-pf8（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00197-pf8（';
    const B = '；前身 rev 00194-szr（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.32.0 工具栏添加图像·Wiki 式内联图——用户「在工具栏的右侧那边再增加一个按钮叫添加图像，就是你可以添加国旗/国徽等等的图像，图像的大小是根据文字的大小进行等比例变化的，这样可以完成类似于Wiki 的功能」：工具栏右端 image 钮（输入框态置灰）+ tt-img-pop 弹层（国旗库 15 面 canvas 光栅化 PNG data URL+上传任意图）；只进内容卡文字，insertInlineImage 选区替换/光标插入、光标置图后、onContentChange 入撤销快照；img.tt-inline-img height 1.5em 字号等比（光标态整块/选区 span 两条路，电池 32→48、24→36 实测）；草稿 innerHTML 往返+data: 放行无损零新字段；showToast 上窗跨块（电池抓出 ReferenceError 部署前拦截）；FC v10.28.22（小更新位 21→22·新功能轮·补丁归零）；电池 tt-img 13/13 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.31.2**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.32.0**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.31.2**（';
    const B = '；前身 v0.2.30.5（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 工具栏添加图像·Wiki 式内联图——小改动位 31→32 新功能轮·补丁归零（用户「在工具栏的右侧那边再增加一个按钮叫添加图像…国旗/国徽等等的图像…图像的大小是根据文字的大小进行等比例变化的…完成类似于Wiki 的功能」：工具栏右端 image 钮+tt-img-pop 弹层（国旗库 15 面 canvas 光栅化 PNG data URL+上传任意图）；只进内容卡文字（输入框态置灰）；img.tt-inline-img height 1.5em 字号等比；草稿 innerHTML 往返+data: 放行无损零新字段；showToast 上窗跨块）；FC v10.28.22（小更新位 21→22）；电池 tt-img 13/13 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.32.0**（' + NEW + '；前身 v0.2.30.5（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
