// tmp-update-memory-tt-img3.js — v0.2.34.0 / FC v10.28.24 图像插进任何可打字处轮记忆仪式
// （backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 奇数，09-11 实测过）。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00200-jd4', HASH = '8a07627';
const MODIFIED = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00199-k6z（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00199-k6z（';
    const B = '；前身 rev 00194-szr（'; // 不含 00199 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00199 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.34.0 图像插进任何可打字处——用户「我希望他能添加在任何可以打字的地方而不是只限于文字内容卡片」：input/textarea 装不了图 → 第一次插图时把卡内输入框「现场升级」成 contentEditable span（同名同类同内联样式、值文字照搬、dataset.rich=1，纯文字字段永远是 input 零影响既有路径）；序列化全走 fieldHtml/fieldText/setFieldText/makeTextField（带标记文字按 HTML 往返，草稿零新字段——rich HTML 坐既有 label/charName/statsRows/tlEvents/sheetData 串）；升级后原 input 监听死透 → 永久 input 监听+MutationObserver 双管线按类名接回各卡序列化（stats/tl/sheet/char/autoSizeLabel/onContentChange）；架构坑：helpers 必须住主 IIFE（块3 buildDraft 同域）经 window.* 供工具栏 IIFE（块4）调用（首跑电池抓 ReferenceError: fieldHtml is not defined 部署前拦截）；插入定位=showImgPop 存 IMG_SAVED_INPUT（弹层开时 activeElement 是卡内输入框——工具栏 mousedown preventDefault 保焦点）→ 插时现场升级+选区偏移回放（先 focus 再 addRange）；数字/年份字段拒（toast「数字或年份字段不能插图」）、卡外输入框 toast「图像只能插进文字里（内容卡或卡内输入框）」；工厂 createFlagCard/createAssetCard 标签改 makeTextField 出生即富文本；FC v10.28.24（小更新位 23→24·新功能轮·补丁归零）；电池 tt-img 28/28 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
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
  if (line.indexOf('v0.2.34.0 = ') === -1 || line.indexOf('当前 v10.28.24（') === -1) {
    let l = line;
    const A1 = 'commit 78c7736 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit ' + HASH + ' 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const E1 = '2026-09-12 v0.2.34.0 = 图像插进任何可打字处（小改动位 33→34·新功能轮·补丁归零——用户「我希望他能添加在任何可以打字的地方而不是只限于文字内容卡片」：卡内输入框第一次插图现场升级富文本 span（标签/姓名/角色卡/统计/时间线/表格格均可插图）；序列化 fieldHtml/fieldText 零新草稿字段；helpers 住主 IIFE 经 window.* 跨块（电池抓 ReferenceError 部署前拦截）；IMG_SAVED_INPUT 回放+数字/年份字段 toast 拒；工厂标签 makeTextField 出生即富文本）；FC v10.28.24（小更新位 23→24）；电池 tt-img 28/28 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；';
    const B1f = E1 + B1;
    const A2 = '当前 v10.28.23（已部署 rev 00199-k6z，';
    const B2 = '当前 v10.28.24（已部署 rev ' + REV + '，2026-09-12 图像插进任何可打字处轮·FC 侧=卡内输入框插图时现场升级富文本 span（dataset.rich=1、永久 input+MutationObserver 管线接回序列化）、IMG_SAVED_INPUT 记住弹层开时焦点框、数字/年份字段 toast 拒、工厂标签 makeTextField 出生即富文本（小更新位 23→24·新功能轮·补丁归零）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1f], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.34.0 在', l.indexOf('v0.2.34.0 = '), '；FC 头 v10.28.24 在', l.indexOf('当前 v10.28.24'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00199-k6z（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00199-k6z（';
    const B = '；前身 rev 00194-szr（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.34.0 图像插进任何可打字处——用户「我希望他能添加在任何可以打字的地方而不是只限于文字内容卡片」：卡内输入框第一次插图现场升级 contentEditable span（同名同类同内联样式、dataset.rich=1）；fieldHtml/fieldText 序列化零新草稿字段；helpers 住主 IIFE 经 window.* 跨块（电池抓 ReferenceError 部署前拦截）；IMG_SAVED_INPUT 回放+数字/年份字段 toast 拒；FC v10.28.24（小更新位 23→24·新功能轮·补丁归零）；电池 tt-img 28/28 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.33.0**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.34.0**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.33.0**（';
    const B = '；前身 v0.2.30.5（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 图像插进任何可打字处——小改动位 33→34 新功能轮·补丁归零（用户「我希望他能添加在任何可以打字的地方而不是只限于文字内容卡片」：卡内输入框第一次插图现场升级富文本；fieldHtml/fieldText 序列化零新草稿字段；helpers 主 IIFE 跨块；数字/年份字段 toast 拒）；FC v10.28.24（小更新位 23→24）；电池 tt-img 28/28 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.34.0**（' + NEW + '；前身 v0.2.30.5（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
