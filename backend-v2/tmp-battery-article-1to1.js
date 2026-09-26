// tmp-battery-article-1to1.js — v0.2.56.2 文章阅读页 FC 1:1 画布渲染电池
// 用户「不是啊，我要的是FC里的1:1 文章内的卡片位置什么的都要1：1有那么难吗？？」
// 验证：A 画布模式在场（.art-canvas、零 .art-flow）/ B 卡片绝对定位还原 FC 几何（并排不竖堆、
//    fitW/fitH 取胜、span×cellSize 尺寸、z 层级、rotate、hidden 跳过）/ C 完整格舞台投影自洽
//    （v0.2.58.5：inner=115 格横×max(70,内容行)+25 行纵，s=min(availW/stageW,availH/stageH) 下限 0.25，
//    卡位 1:1 逻辑尺寸不动；不再 bbox 裁剪——用户「你是不是只是提取了卡片而已？」）
//    / D legacy 无 x/y 草稿流式兜底 / E 零 Runtime exception + 零 console error / F0 静态锚
// fixture 复刻线上 ART-000004 真实卡（c8 flag aspectLock fitW264.399 fitH174.347 x439 y8 z2 +
//    c1 shield x703 y8 11×8 z1 label Emblem）+ c2 content（高度自适应）+ c5 text rotate 15 +
//    c9 hidden 眼睛开关跳过；纸算期望（cellSize=20 gap=2 M=24）：
//    c5 旋转膨胀 bbox：中心(89,452.267) rw=130cos15+66sin15=142.652 rh=130sin15+66cos15=97.397
//    （offset 盒 130×66 含 2px 边框）→ minX=17.674 minY=8 maxX=945(修正：c1 宽240→943-…) maxY=500.966
//    shiftX=6.326 → offsets：c8(36.393,24) c1(300.393,24) c2(36.393,236) c5(30.326,420.267)；
//    bboxW=564.393 bboxH=524.966（c1 span 公式 11×20+10×2=240×174）
// fetch 打桩：/articles/ART-000004 → 真身口径 {article:{...}}（reader 读 ra.data.article）；
//    ART-LEGACY1 → 无 x/y 旧草稿；其余 /articles 404（comments 404 → 空评论态）
// ⚠ 电池陷阱：parseArticleId 正则 /^ART-[A-Za-z0-9]+$/ 必须含 ART- 后的连字符——
//    'ARTLEGACY1'（删连字符）解析失败直接 404 且 fetch 根本不发（stubLog 空+服务器零请求实证）
// （house CDP 模式；截图全黑纪律，无截图依赖；断言走 offset* 布局值不受 transform 缩放干扰）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-art1to1-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); });
      return;
    }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}
const approx = (v, exp, tol) => Math.abs(v - exp) <= tol;

// ═══ fixture：复刻线上 ART-000004（c8 flag aspectLock fitW/fitH + c1 shield 并排）+ 边界卡 ═══
const FLAG_SVG = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20360%22%3E%3Crect%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%232E5BFF%22%2F%3E%3Crect%20y%3D%22180%22%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C/svg%3E';
const FIXTURE_1TO1 = {
  v: 9,
  title: 'Testing',
  tags: [],
  activePreset: '169',
  presets: {
    '169': { cards: {
      c1: { col: 33, row: 1, colSpan: 11, rowSpan: 8 },
      c8: { col: 21, row: 1, colSpan: 12, rowSpan: 8, aspectLock: '1', aspectRatio: '1.5174603174603174', fitW: 264.39946285714285, fitH: 174.3470057142857 }
    } },
    half: { cards: {} }, tablet: { cards: {} }, mobile: { cards: {} }
  },
  groupStyles: {}, pageBg: null, lastSaved: 1750000000000,
  cards: [
    { id: 'c8', type: 'flag', col: 21, row: 1, x: 439, y: 8, colSpan: 12, rowSpan: 8, rotate: 0, borderRadius: 8, background: '', borderStyle: 'solid', borderColor: '', borderWidth: 2, aspectLock: '1', aspectRatio: '1.5174603174603174', fitW: 264.39946285714285, fitH: 174.3470057142857, label: '', captionBgColor: '#1e1c32', captionBgOpacity: 0, captionShadowOpacity: 0, z: 2, imgSrc: FLAG_SVG },
    { id: 'c1', type: 'shield', col: 33, row: 1, x: 703, y: 8, colSpan: 11, rowSpan: 8, rotate: 0, borderRadius: 8, background: '', borderStyle: 'solid', borderColor: '', borderWidth: 2, label: 'Emblem', z: 1 },
    { id: 'c2', type: 'content', col: 21, row: 11, x: 439, y: 220, colSpan: 12, rowSpan: 4, rotate: 0, background: '', borderWidth: 2, label: 'Body', baseFontSize: 14, z: 1, content: '<p>Hello 1:1</p>' },
    { id: 'c5', type: 'text', col: 21, row: 20, x: 439, y: 420, colSpan: 6, rowSpan: 3, rotate: 15, background: 'rgba(46,91,255,0.15)', borderWidth: 2, label: 'Rot', z: 1, content: 'rotated note' },
    { id: 'c9', type: 'text', col: 40, row: 24, x: 800, y: 500, colSpan: 4, rowSpan: 3, rotate: 0, background: '', borderWidth: 2, label: 'Hidden', z: 1, hidden: '1', content: 'should not render' }
  ]
};
const FIXTURE_LEGACY = {
  v: 8,
  title: 'Legacy Draft',
  activePreset: '169',
  cards: [
    { id: 'l1', type: 'content', col: 2, row: 2, colSpan: 10, rowSpan: 6, content: '<p>legacy flow body</p>', baseFontSize: 14 },
    { id: 'l2', type: 'flag', col: 4, row: 10, colSpan: 12, rowSpan: 7, label: 'Old Flag' }
  ]
};
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/articles") !== -1) {' +
  '   if (u.indexOf("/articles/") !== -1) {' +
  '    var id = decodeURIComponent(u.split("/articles/")[1].split("?")[0].split("#")[0]);' +
  '    if (id === "ART-000004") {' +
  '     return stubResponse(JSON.stringify({ article: { id: id, title: "Testing", status: "published", authorId: "USR-000042", authorName: "Neo", createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z", viewCount: 7, likeCount: 2, likedByMe: false, favoritedByMe: false, contentJson: ' + JSON.stringify(FIXTURE_1TO1) + ' } }), 200);' +
  '    }' +
  '    if (id === "ART-LEGACY1") {' +
  '     return stubResponse(JSON.stringify({ article: { id: id, title: "Legacy Draft", status: "published", authorId: "USR-000042", authorName: "Neo", createdAt: "2026-09-19T10:00:00.000Z", updatedAt: "2026-09-19T10:00:00.000Z", contentJson: ' + JSON.stringify(FIXTURE_LEGACY) + ' } }), 200);' +
  '    }' +
  '    return stubResponse(JSON.stringify({ error: "NOT_FOUND" }), 404);' +
  '   }' +
  '   return stubResponse(JSON.stringify({ articles: [] }), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

(async () => {
  // ═══ F0 静态检查 ═══
  const art = fs.readFileSync(path.join(DOCS, 'pages', 'article.html'), 'utf8');
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F0-1 article.html 1:1 渲染在场（renderBodyCanvas + 12 caption-pos + bbox 两遍量盒 + hasXY 分支）',
    art.indexOf('function renderBodyCanvas') !== -1 &&
    art.indexOf('data-caption-pos="outside-right"') !== -1 &&
    art.indexOf('两遍量盒') !== -1 &&
    art.indexOf('typeof c.x === \'number\'') !== -1);
  ok('F0-2 版本 v0.2.58.5 + changelog 条目（58.0 rev 00276-nnx + 56.2 保留）',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.58.5';") !== -1 &&
    sconf.indexOf('FC 1:1 画布渲染') !== -1 && sconf.indexOf('00276-nnx') !== -1 && sconf.indexOf('00272-g99') !== -1);
  ok('F0-3 渲染顺序修正（先 display:flex 再 renderBody——隐藏容器 clientWidth=0 缩放必错）',
    art.indexOf("document.getElementById('articleDetail').style.display = 'flex';") < art.indexOf('renderBody(a.contentJson)'));

  // ═══ 浏览器场景（登录态 Chrome）═══
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  const connectCdp = async (port) => {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    return cdp;
  };

  try {
    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };

    // ── A/B/C 1:1 画布（ART-000004 真身卡型复刻）──
    await nav(BASE + '/pages/article.html?id=ART-000004',
      "document.querySelectorAll('#artBody .art-card').length === 4", 'A 4 卡画布');
    ok('A1 画布模式在场（.art-canvas + 零 .art-flow 竖堆）',
      await cdp.evalJs("document.querySelector('#artBody .art-canvas') !== null") === true &&
      await cdp.evalJs("document.querySelectorAll('#artBody .art-flow').length") === 0);
    ok('A2 4 卡渲染、hidden c9 跳过',
      await cdp.evalJs("document.querySelectorAll('#artBody .art-card').length") === 4 &&
      await cdp.evalJs("document.querySelector('#artBody .art-card[data-card-id=\"c9\"]')") === null);
    const box = (id) => cdp.evalJs(
      "(function(){ var e = document.querySelector('#artBody .art-card[data-card-id=\"" + id + "\"]'); if (!e) return null; return { left: e.offsetLeft, top: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight, z: getComputedStyle(e).zIndex, tf: e.style.transform }; })()");
    const b8 = await box('c8'), b1 = await box('c1'), b2 = await box('c2'), b5 = await box('c5');
    ok('B1 c8 flag aspectLock 尺寸 = fitW/fitH（264.399×174.347）',
      !!b8 && approx(b8.w, 264.399, 1.5) && approx(b8.h, 174.347, 1.5), JSON.stringify(b8));
    ok('B2 c1 shield span 公式 240×174（11×20+10×2 / 8×20+7×2）',
      !!b1 && approx(b1.w, 240, 1.5) && approx(b1.h, 174, 1.5), JSON.stringify(b1));
    ok('B3 并排不竖堆：c1 紧贴 c8 右缘（-0.4px 叠合同 FC）、顶对齐同 top=24',
      !!b8 && !!b1 && approx(b1.left - (b8.left + b8.w), -0.399, 1.5) && approx(b1.top, 24, 1.5) && approx(b8.top, 24, 1.5),
      'gap=' + (b1 && b8 ? (b1.left - (b8.left + b8.w)).toFixed(2) : '?') + ' tops=' + (b1 && b8 ? b1.top.toFixed(1) + '/' + b8.top.toFixed(1) : '?'));
    ok('B4 位置纸算锚：c8(36.39,24) c1(300.39,24)',
      !!b8 && approx(b8.left, 36.393, 1.5) && !!b1 && approx(b1.left, 300.393, 1.5),
      JSON.stringify([b8 && b8.left, b1 && b1.left]));
    ok('B5 z 层级还原：c8 z-index 2 > c1 z-index 1',
      !!b8 && b8.z === '2' && !!b1 && b1.z === '1', JSON.stringify([b8 && b8.z, b1 && b1.z]));
    ok('B6 c8 图卡：.art-card-img 挂 SVG 图 + 无 label 元素（label 空）',
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-card[data-card-id=\"c8\"]'); return !!e && !!e.querySelector('.art-card-img') && !e.querySelector('.art-card-label'); })()") === true);
    ok('B7 c1 国徽无图：盾徽块 + label Emblem',
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-card[data-card-id=\"c1\"]'); return !!e && !!e.querySelector('.art-card-emblem') && e.querySelector('.art-card-emblem-label') && e.querySelector('.art-card-emblem-label').textContent === 'Emblem'; })()") === true);
    ok('B8 c2 content 高度自适应：minHeight 86 起、正文渲染',
      !!b2 && b2.h >= 86 && approx(b2.top, 236, 1.5) &&
      (await cdp.evalJs("document.querySelector('#artBody .art-card[data-card-id=\"c2\"] .art-card-content').textContent")).indexOf('Hello 1:1') !== -1,
      JSON.stringify(b2));
    ok('B9 c5 rotate 15：transform 在场 + 膨胀 bbox 定位 (30.33,420.27)',
      !!b5 && b5.tf.indexOf('rotate(15deg)') !== -1 && approx(b5.left, 30.326, 1.5) && approx(b5.top, 420.267, 1.5),
      JSON.stringify(b5));

    // ── C 完整格舞台投影自洽（v0.2.58.5：inner = 115 格横 × max(70,内容行)+25 行纵——纸算 contentRows=
    //       ceil((524.966−24)/22)=23 → stageRows=95 → 2530×2090；s=min(availW/stageW,availH/stageH) 下限 0.25，
    //       缩放走 transform 卡位逻辑尺寸不动）──
    ok('C1 inner 画布尺寸 = 完整格舞台（2530×2090；115×22 / 95×22）',
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-canvas-inner'); return Math.abs(e.offsetWidth - 2530) <= 3 && Math.abs(e.offsetHeight - 2090) <= 5; })()") === true,
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-canvas-inner'); return e.offsetWidth + 'x' + e.offsetHeight; })()"));
    ok('C2 宽窗完整舞台投影自洽：s=min(availW/stageW,availH/stageH)（下限 0.25）+ holder=stage×s',
      await cdp.evalJs("(function(){ var b = document.getElementById('artBody'); var h = b.querySelector('.art-canvas'); var e = h.querySelector('.art-canvas-inner'); var m = e.style.transform.match(/scale\\(([\\d.]+)\\)/); var s = m ? parseFloat(m[1]) : 0; var availH = Math.max(200, window.innerHeight - h.getBoundingClientRect().top - 24); var exp = Math.max(0.25, Math.min(b.clientWidth / e.offsetWidth, availH / e.offsetHeight)); return Math.abs(s - exp) <= 0.005 && Math.abs(h.clientWidth - Math.round(e.offsetWidth * s)) <= 2 && Math.abs(h.clientHeight - Math.round(e.offsetHeight * s)) <= 2; })()") === true,
      await cdp.evalJs("(function(){ var b = document.getElementById('artBody'); var h = b.querySelector('.art-canvas'); var e = h.querySelector('.art-canvas-inner'); var availH = Math.max(200, window.innerHeight - h.getBoundingClientRect().top - 24); return 'avail=' + b.clientWidth + 'x' + availH + ' ' + e.style.transform + ' holder=' + h.clientWidth + 'x' + h.clientHeight; })()"));

    // ── D legacy 无 x/y 草稿 → 流式兜底 ──
    await nav(BASE + '/pages/article.html?id=ART-LEGACY1',
      "document.querySelectorAll('#artBody .art-flow').length >= 1", 'D legacy 流式');
    ok('D1 legacy 草稿走流式兜底（.art-flow 在场、零 .art-canvas）',
      await cdp.evalJs("document.querySelectorAll('#artBody .art-flow').length") >= 1 &&
      await cdp.evalJs("document.querySelectorAll('#artBody .art-canvas').length") === 0);
    ok('D2 legacy 正文渲染', (await cdp.evalJs("document.getElementById('artBody').textContent")).indexOf('legacy flow body') !== -1);

    // ── E 全程零 Runtime exception + 零 console error ──
    ok('E1 零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('E2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
    cdp.close();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  try { chrome.kill(); } catch (e) {}
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  process.exit(FAIL === 0 ? 0 : 1);
})();
