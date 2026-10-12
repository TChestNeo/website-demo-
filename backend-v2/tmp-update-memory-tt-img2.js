// tmp-update-memory-tt-img2.js — v0.2.33.0 / FC v10.28.23 添加图像弹层升级轮记忆仪式
// （backend-build-state + site-versioning-scheme + MEMORY.md，2026-09-12）
// 幂等：各段若已含新锚点则跳过（部分失败后可安全重跑）。
// B 锚纪律：头条目闭合「）**」不进 B 锚（残留会成孤 ** → 奇数，09-11 实测过）。
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REV = '00199-k6z', HASH = '78c7736';
const MODIFIED = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
function readLines(p) { const raw = fs.readFileSync(p, 'utf8'); return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', lines: raw.split(/\r?\n/) }; }
function writeLines(p, s) { fs.writeFileSync(p, s.lines.join(s.eol), 'utf8'); }
function balanced(x) { let d = 0, i = -1; while ((i = x.indexOf('**', i + 1)) !== -1) d = d ? 0 : 1; return d === 0; }
let cnt = 0;

// ── 1. backend-build-state.md（head 换新 + modified 时间戳；** 数恒偶） ──
{
  const p = MEM + 'backend-build-state.md';
  const s = readLines(p);
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00198-6rf（') !== -1);
  if (li === -1) { console.error('MISS backend head'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00198-6rf（';
    const B = '；前身 rev 00194-szr（'; // 不含 00198 的闭合「）**」——旧闭合对随替换区一起移除，防孤 **
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/）\*\*$/, '）'); // 00198 条目正文（链式无闭合）
    const NEW = '2026-09-12 v0.2.33.0 添加图像弹层升级——用户「为什么该按钮没办法点击？」+「他这个的图像的弹窗是在工具栏上方的就是用户可以直接进行一个预览，而不是覆盖全屏的」+「然后他是一样可以在网页上搜索/上传」：①钮任何态可点（真身=v10.28.22 输入框态置灰 opacity .35+pointer-events:none 无提示 → 用户以为点不了，实点 CDP 探针实证钮本身能点；改为恒可点+插入时无内容卡光标 toast「图像只能插入内容卡的文字里」）②弹层锚定工具栏上方（y=r.top-h-6、贴顶翻下 r.bottom+6）+弹层内格子直览预览（非全屏）③Wikimedia Commons 网页搜索（api.php generator=search gsrnamespace=6 iiurlwidth=640 免费免密钥 CORS origin=*，插 640 缩略图防 TIFF 超大原图；window.FC_IMG_SEARCH_API 电池打桩钩）上传保留④光标回放（打开时存 IMG_SAVED_RANGE/EL 限内容卡内选区，搜索聚焦后选区死 → 插入前先 focus 再 addRange 回放）；真 bug×2 探针实证部署前拦截：a) 搜索框聚焦 → selectionchange → hideTextToolbar → hideImgPop 弹层被关（修：IMG_POP active 时 early-return）b) .radius-popover 非 active=display:none → loading=lazy 缩略图从不请求 → 破图 tile onerror 不触发（修：弹层保持+破图 tile 自动隐藏）；FC v10.28.23（小更新位 22→23·新功能轮·补丁归零）；电池 tt-img 21/21 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
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
  if (line.indexOf('v0.2.33.0 = ') === -1 || line.indexOf('当前 v10.28.23（') === -1) {
    let l = line;
    const A1 = 'commit e599454 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const B1 = 'commit ' + HASH + ' 未 push）；v0.2.28.6 = 平台首页 Create World CTA 样式';
    const E1 = '2026-09-12 v0.2.33.0 = 添加图像弹层升级（小改动位 32→33·新功能轮·补丁归零——用户「为什么该按钮没办法点击？」+「弹窗是在工具栏上方的…直接预览，而不是覆盖全屏」+「一样可以在网页上搜索/上传」：钮任何态可点（去置灰+插入时 toast 引导）；弹层工具栏上方锚定（贴顶翻下）+格子直览预览；Wikimedia Commons 网页搜索（插 640 缩略图）+上传保留；光标回放（搜索后仍插回原光标）；真 bug×2：搜索框聚焦误关弹层+懒加载缩略图从不请求）；FC v10.28.23（小更新位 22→23）；电池 tt-img 21/21 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push）；';
    const B1f = E1 + B1;
    const A2 = '当前 v10.28.22（已部署 rev 00198-6rf，';
    const B2 = '当前 v10.28.23（已部署 rev ' + REV + '，2026-09-12 添加图像弹层升级轮·FC 侧=tt-img-pop 弹层锚定工具栏上方（贴顶翻下）+弹层内格子直览预览、Wikimedia Commons 网页搜索（插 640 缩略图）+上传保留、image 钮任何状态可点（去置灰+插入时 toast 引导）、光标回放（搜索聚焦后先 focus 再 addRange 插回原光标）、hideTextToolbar IMG_POP active 早退（搜索框聚焦不关弹层）；行为=点工具栏 image 钮 → 弹层在钮上方 → 搜「Japan」直览格子图 → 点图插进内容卡光标处、上传照样可用（小更新位 22→23·新功能轮·补丁归零）；commit ' + HASH + '）；前身 ';
    let n = 0;
    for (const [a, b] of [[A1, B1f], [A2, B2]]) {
      if (l.indexOf(a) === -1) { console.error('MISS scheme anchor:', a.slice(0, 40)); process.exit(1); }
      if ((l.split(a).length - 1) !== 1) { console.error('BAD scheme anchor count:', a.slice(0, 40)); process.exit(1); }
      l = l.replace(a, b);
      n++;
    }
    s.lines[10] = l;
    writeLines(p, s); cnt++;
    console.log('OK site-versioning-scheme：替换', n, '处；v0.2.33.0 在', l.indexOf('v0.2.33.0 = '), '；FC 头 v10.28.23 在', l.indexOf('当前 v10.28.23'));
  } else { console.log('SKIP site-versioning-scheme（已更新）'); }
}

// ── 3. MEMORY.md（后端指针 + 站点指针；仅头部加粗，** 总数恒 2） ──
{
  const p = MEM + 'MEMORY.md';
  const s = readLines(p);
  let cnt2 = 0;
  const li = s.lines.findIndex(l => l.indexOf('**当前线上 rev 00198-6rf（') !== -1);
  if (li === -1) { console.error('MISS MEMORY backend pointer'); process.exit(1); }
  if (s.lines[li].indexOf('**当前线上 rev ' + REV + '（') === -1) {
    let l = s.lines[li];
    const A = '**当前线上 rev 00198-6rf（';
    const B = '；前身 rev 00194-szr（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY backend anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib).replace(/\*\*$/, '');
    const NEW = '2026-09-12 v0.2.33.0 添加图像弹层升级——用户「为什么该按钮没办法点击？」「弹窗是在工具栏上方的…直接预览，而不是覆盖全屏」「一样可以在网页上搜索/上传」：钮任何态可点（真身=v10.28.22 输入框态置灰 opacity .35+pointer-events:none 无提示，实点探针实证钮能点 → 改恒可点+插入时 toast「图像只能插入内容卡的文字里」）；弹层锚定工具栏上方（贴顶翻下）+格子直览预览；Wikimedia Commons 搜索（免费免密钥 CORS、插 640 缩略图）+上传保留；光标回放（打开存 IMG_SAVED_RANGE/EL，搜索聚焦选区死 → 先 focus 再 addRange）；真 bug×2 探针实证：搜索框聚焦关弹层+懒加载图零请求；FC v10.28.23（小更新位 22→23·新功能轮·补丁归零）；电池 tt-img 21/21 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push；每轮 rev 全量链见 [[backend-build-state]]';
    l = l.slice(0, ia) + '**当前线上 rev ' + REV + '（' + NEW + '）**；前身 rev 00194-szr（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY backend:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[li] = l; cnt2++;
  }
  const si = s.lines.findIndex(l => l.indexOf('站点号当前 **v0.2.32.0**（') !== -1);
  if (si === -1) { console.error('MISS MEMORY site pointer'); process.exit(1); }
  if (s.lines[si].indexOf('站点号当前 **v0.2.33.0**（') === -1) {
    let l = s.lines[si];
    const A = '站点号当前 **v0.2.32.0**（';
    const B = '；前身 v0.2.30.5（';
    const ia = l.indexOf(A), ib = l.indexOf(B, ia);
    if (ia === -1 || ib === -1) { console.error('MISS MEMORY site anchors'); process.exit(1); }
    const oldBody = l.slice(ia + A.length, ib);
    const NEW = '2026-09-12 添加图像弹层升级——小改动位 32→33 新功能轮·补丁归零（用户「为什么该按钮没办法点击？」+「弹窗是在工具栏上方的…直接预览，而不是覆盖全屏」+「一样可以在网页上搜索/上传」：钮任何态可点（去置灰+插入时 toast 引导）；弹层工具栏上方锚定+格子直览预览；Wikimedia Commons 网页搜索（插 640 缩略图）+上传保留；光标回放；真 bug×2：搜索框聚焦误关弹层+懒加载缩略图从不请求）；FC v10.28.23（小更新位 22→23）；电池 tt-img 21/21 + tt-caret 12/12 + dblmodal 14/14 + group-resize 17/17 + merge-dir 12/12；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（' + REV + '）；commit ' + HASH + ' 未 push';
    l = l.slice(0, ia) + '站点号当前 **v0.2.33.0**（' + NEW + '；前身 v0.2.30.5（' + oldBody + l.slice(ib);
    if ((l.match(/\*\*/g) || []).length !== 2) { console.error('BAD bold count MEMORY site:', (l.match(/\*\*/g) || []).length); process.exit(1); }
    s.lines[si] = l; cnt2++;
  }
  writeLines(p, s); cnt++;
  console.log('OK MEMORY.md：替换', cnt2, '处；后端指针 ** 数', (s.lines[li].match(/\*\*/g) || []).length, '；站点指针 ** 数', (s.lines[si].match(/\*\*/g) || []).length);
}

console.log('DONE 三件套', cnt, '文件');
