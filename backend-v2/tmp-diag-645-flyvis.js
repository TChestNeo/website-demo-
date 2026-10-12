// tmp-diag-645-flyvis.js — 52.4 折叠出画「看不见」诊断：飞行途中按钮视口真实坐标+遮挡探测+祖先裁剪链（一次性诊断，不提交）
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-diag-flyvis-' + Date.now());
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
const server = require('http').createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.indexOf('/api') === 0) { res.writeHead(404); res.end('{"error":"NOT_FOUND"}'); return; }
  if (u === '/' || u === '/dashboard') u = '/index.html';
  let f = path.join(DOCS, u);
  if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push('EXC:' + JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
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

const SESSION_SCRIPT = 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}';

// 页内 16ms 采样 1200ms：视口 rect + elementFromPoint 遮挡 + 胶囊/面板 rect + visibility/opacity（照电池原版裸 Promise）
const SAMP_EXPR = "new Promise(function(res){" +
  " var b = document.querySelector('.asset-panel-toggle');" +
  " var p = document.querySelector('.asset-panel');" +
  " var s = document.querySelector('.asset-panel .search-capsule');" +
  " var t0 = performance.now(); var rows = [];" +
  " var h = setInterval(function(){" +
  "   var br = b.getBoundingClientRect();" +
  "   var cs = getComputedStyle(b);" +
  "   var cx = br.left + br.width/2, cy = br.top + br.height/2;" +
  "   var topEl = null;" +
  "   try { var e = document.elementFromPoint(cx, cy); topEl = e ? (e.className && e.className.baseVal !== undefined ? 'SVG:' + e.tagName : (typeof e.className === 'string' && e.className ? (e.tagName + '.' + e.className.toString().split(' ')[0]) : e.tagName)) : 'null'; } catch(ex) { topEl = 'ERR'; }" +
  "   var pr = p.getBoundingClientRect(); var sr = s.getBoundingClientRect();" +
  "   rows.push([Math.round(performance.now()-t0), Math.round(br.left*10)/10, Math.round(br.top*10)/10, Math.round(br.width*10)/10, Math.round(br.height*10)/10, topEl, Math.round(sr.left*10)/10, Math.round(sr.width*10)/10, Math.round(pr.width*10)/10, cs.visibility, cs.opacity, Math.round(cx*10)/10]);" +
  "   if (performance.now()-t0 >= 1200) { clearInterval(h); res({rows: rows}); }" +
  " }, 16); })";

const ANC_EXPR = "(function(){" +
  " var out = []; var el = document.querySelector('.asset-panel-toggle');" +
  " while (el && el !== document.documentElement) {" +
  "   var cs = getComputedStyle(el);" +
  "   if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || (cs.position !== 'static' && el.tagName !== 'BUTTON')) {" +
  "     var r = el.getBoundingClientRect();" +
  "     out.push((el.tagName + '.' + ((typeof el.className === 'string' ? el.className : '') || '').toString().split(' ')[0]).slice(0, 60) + ' ovx=' + cs.overflowX + ' ovy=' + cs.overflowY + ' pos=' + cs.position + ' z=' + cs.zIndex + ' rect=[' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + ',' + Math.round(r.height) + ']');" +
  "   }" +
  "   el = el.parentElement;" +
  " }" +
  " return out; })()";

const Z_EXPR = "(function(){ var g=function(e){var c=getComputedStyle(e); return {name:(e.tagName + '.' + ((typeof e.className === 'string' ? e.className : '') || '').toString().split(' ')[0]).slice(0,50), z:c.zIndex, pos:c.position, bg:c.backgroundColor};};" +
  " return [g(document.querySelector('.asset-panel-toggle')), g(document.querySelector('.asset-panel')), g(document.querySelector('.asset-panel .search-capsule')), g(document.querySelector('.canvas-body'))]; })()";

(async () => {
  server.listen(PORT, '127.0.0.1');
  let chromePath = null;
  (['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]).forEach((p) => { if (!chromePath && fs.existsSync(p)) chromePath = p; });
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let cdp = null;
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
    await cdp.send('Page.setDownloadBehavior', { behavior: 'deny' });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    for (let i = 0; i < 300; i++) {
      try { if (await cdp.evalJs("!!(document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.toggleAssetPanel)")) break; } catch (e) {}
      await sleep(150);
    }
    await sleep(900);

    console.log('═══ 基础环境 ═══');
    console.log('pointer:fine =', await cdp.evalJs("matchMedia('(pointer: fine)').matches"),
      '| innerWidth =', await cdp.evalJs('window.innerWidth'),
      '| scrollX =', await cdp.evalJs('window.scrollX'));
    console.log('z/pos/bg 栈：', JSON.stringify(await cdp.evalJs(Z_EXPR)));
    console.log('祖先裁剪/定位链：');
    const anc = await cdp.evalJs(ANC_EXPR);
    anc.forEach((l) => console.log('  ' + l));

    console.log('\n═══ 点击折叠：16ms 采样飞行全程（t ms | 按钮rect.x y w h | 中心点顶层元素 | 胶囊L/W | 面板W | vis op）═══');
    await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
    const tr = await cdp.evalJs(SAMP_EXPR);
    const rows = tr.rows || [];
    // 每 4 行打印一行（~64ms 间隔），重点区段（按钮 x<214）全打
    rows.forEach((r, i) => {
      if (i % 4 === 0 || r[1] < 210) {
        console.log('  t=' + String(r[0]).padStart(4) + ' x=' + String(r[1]).padStart(7) + ' y=' + String(r[2]).padStart(5) +
          ' w=' + String(r[3]).padStart(5) + ' h=' + String(r[4]).padStart(5) +
          ' topEl=' + String(r[5]).padEnd(28) + ' capL=' + String(r[6]).padStart(6) + ' capW=' + String(r[7]).padStart(5) +
          ' panelW=' + String(r[8]).padStart(5) + ' ' + r[9] + '/' + r[10]);
      }
    });
    // 分析
    const xs = rows.map((r) => r[1]);
    const minX = Math.min.apply(null, xs);
    const minXIdx = xs.indexOf(minX);
    const xMax = Math.max.apply(null, xs);
    const onScreen = rows.filter((r) => r[1] >= 0 && r[1] <= 1280).length;
    const covered = rows.filter((r) => r[5] && r[5].indexOf('BUTTON') === -1).length;
    const exitT = rows.find((r) => r[1] < 0);
    const reenterT = rows.find((r, i) => i > minXIdx && r[1] >= 0);
    console.log('\n═══ 分析 ═══');
    console.log('视口 x 范围：max=' + xMax + ' min=' + minX + '（min<0 才真正出画）| 出画首采样 t=' + (exitT ? exitT[0] : '从未') + 'ms | 回屏首采样 t=' + (reenterT ? reenterT[0] : '从未') + 'ms');
    console.log('中心点被非按钮元素遮挡的采样数：' + covered + '/' + rows.length);
    const topEls = {};
    rows.forEach((r) => { topEls[r[5]] = (topEls[r[5]] || 0) + 1; });
    console.log('顶层元素分布：' + JSON.stringify(topEls));
  } catch (e) {
    console.error('DIAG FAIL:', e && e.message);
    process.exitCode = 1;
  } finally {
    try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
    try { server.close(); } catch (e) {}
  }
})();
