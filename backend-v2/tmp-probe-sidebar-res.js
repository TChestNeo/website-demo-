// tmp-probe-sidebar-res.js — v0.2.53.3 侧栏多分辨率探针：查「最底部卡片没有被去除」真身
// 假设：1080p 下菜单卡收内容高后下方留白；矮屏（笔记本 768p/720p）菜单卡内容本身就贴到屏幕底，
//       用户屏幕上「最底部的卡片」可能仍是菜单卡本身
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4900 + Math.floor(Math.random() * 90);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-probe-res-' + Date.now());
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 几何快照：侧栏三卡 / 菜单卡底 vs 侧栏底 / 菜单卡高度-内容高 / 侧栏可滚动性 / 菜单卡下方 painted
const GEOM = `(function () {
  var sb = document.getElementById('slati-sidebar');
  if (!sb) return null;
  var nav = sb.querySelector('.nav-module');
  var navR = nav.getBoundingClientRect();
  var items = nav.querySelectorAll('.nav-item');
  var lastR = items[items.length - 1].getBoundingClientRect();
  var cs = getComputedStyle(nav);
  var padB = parseFloat(cs.paddingBottom);
  var contentH = lastR.bottom - navR.top;
  var diff = navR.height - (contentH + padB);
  var sbR = sb.getBoundingClientRect();
  var belowPainted = [];
  var all = sb.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (el === nav || nav.contains(el) || el === sb) continue;
    var c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden') continue;
    var r = el.getBoundingClientRect();
    if (r.height < 2 || r.top < navR.bottom - 2) continue;
    var painted = c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.backgroundImage !== 'none';
    if (painted) belowPainted.push(String(el.className).slice(0, 50) + ':' + c.backgroundColor);
  }
  return {
    vw: window.innerWidth, vh: window.innerHeight,
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    kids: Array.prototype.map.call(sb.children, function (c) { return String(c.className).split(' ').slice(0, 2).join('.'); }),
    navTop: Math.round(navR.top), navBottom: Math.round(navR.bottom),
    navH: Math.round(navR.height), contentH: Math.round(contentH), diff: Math.round(diff),
    sbBottom: Math.round(sbR.bottom), sbH: Math.round(sbR.height),
    sbScroll: [sb.scrollHeight, sb.clientHeight],
    navScroll: [nav.scrollHeight, nav.clientHeight],
    gapToBottom: Math.round(sbR.bottom - navR.bottom),
    belowPainted: belowPainted
  };
})()`;

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1920,1080', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-000001', name: 'Neo', email: 'neo@mn.world', tier: 'premium' } })) + ');}catch(e){}'
    });

    for (const [w, h] of [[1366, 768], [1536, 864], [1920, 1080], [1280, 720]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Page.navigate', { url: BASE + '/index.html' });
      await sleep(1600);
      for (let i = 0; i < 40; i++) {
        const done = await cdp.evalJs('!!(document.querySelector(".nav-module"))');
        if (done) break;
        await sleep(200);
      }
      await sleep(500);
      const g = await cdp.evalJs(GEOM);
      console.log('\n══ ' + w + '×' + h + ' ' + g.theme + ' ══');
      console.log('  kids: ' + g.kids.join(' | '));
      console.log('  nav: top=' + g.navTop + ' bottom=' + g.navBottom + ' h=' + g.navH + ' contentH=' + g.contentH + ' diff=' + g.diff);
      console.log('  sidebar: bottom=' + g.sbBottom + ' h=' + g.sbH + ' scroll=' + g.sbScroll[0] + '/' + g.sbScroll[1] + ' navScroll=' + g.navScroll[0] + '/' + g.navScroll[1]);
      console.log('  菜单卡底→侧栏底 gap=' + g.gapToBottom + 'px；菜单卡下方 painted: ' + (g.belowPainted.length ? JSON.stringify(g.belowPainted) : '无'));
    }
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  process.exit(0);
})();
