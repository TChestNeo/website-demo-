// tmp-merge-far-probe.js — 「拖卡被远处卡片吸附合并」实况诊断（2026-09-11）
// 目标：找出哪种卡的吸附几何（cardBBox 公式）与视觉真实位置不符，或
// findMergeSnap 会在视觉上远离的位置命中目标。
// 跑法：node backend-v2/tmp-merge-far-probe.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4600 + Math.floor(Math.random() * 300);
const CDP_PORT = 5700 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-mergefar-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
      return;
    }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
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
        this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
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

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;

  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1400,1000', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('CDP 没起来');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');

    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.findMergeSnap === 'function'", 20000, '编辑器加载');
    await sleep(600);

    // 铺一组各类型卡片：content(短/超长文本)/sheet/stats/timeline/character/flag/asset/map/sne
    const setup = await cdp.evalJs(`(function(){
      var out = [];
      function place(c, x, y){ window.moveCardPx(c, x, y); out.push({t: c.dataset.cardType, x: x, y: y}); return c; }
      var c1 = window.createContentCard(); c1.querySelector('.card-text-content').textContent = '短文本卡片';
      place(c1, 60, 60);
      var c2 = window.createContentCard(); c2.querySelector('.card-text-content').textContent = '超长文本\\n'.repeat(40) + '结尾';
      place(c2, 700, 60);
      var c3 = window.createSheetCard(3, 4); place(c3, 60, 420);
      var c4 = window.createStatsCard(); place(c4, 420, 420);
      var c5 = window.createTimelineCard(); place(c5, 700, 420);
      var c6 = window.createCharacterCard(); place(c6, 1050, 60);
      var c7 = window.createFlagCard(); place(c7, 1050, 420);
      var c8 = window.createMapCard(); place(c8, 60, 200);
      var c9 = window.createSneCard(); place(c9, 420, 60);
      // 旋转一张（吸附 bbox 必须感知旋转）
      c8.dataset.rotate = 45; c8.style.transform = 'rotate(45deg)';
      return out;
    })()`);
    console.log('已铺卡:', JSON.stringify(setup));
    await sleep(400);

    // ── 诊断 A：每张卡 吸附几何 vs 视觉真实位置 ──
    const diagA = await cdp.evalJs(`(function(){
      var canvas = document.querySelector('.grid-canvas');
      var rect = canvas.getBoundingClientRect();
      var cards = Array.from(canvas.querySelectorAll('.grid-card'));
      var res = [];
      cards.forEach(function(card){
        var l = parseFloat(card.style.left) || 0, t = parseFloat(card.style.top) || 0;
        var w = card.offsetWidth || 0, h = card.offsetHeight || 0;
        var rad = Math.abs(parseFloat(card.dataset.rotate) || 0) * Math.PI / 180;
        var bw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
        var bh = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
        var cx = l + w / 2, cy = t + h / 2;
        var bbox = { left: cx - bw/2, top: cy - bh/2, right: cx + bw/2, bottom: cy + bh/2 };
        var vr = card.getBoundingClientRect();
        var vis = { left: vr.left - rect.left, top: vr.top - rect.top, right: vr.right - rect.left, bottom: vr.bottom - rect.top };
        res.push({ t: card.dataset.cardType, x: Math.round(l), y: Math.round(t),
          w: Math.round(w), h: Math.round(h), rot: card.dataset.rotate || 0,
          dL: Math.round((bbox.left - vis.left)*10)/10, dT: Math.round((bbox.top - vis.top)*10)/10,
          dR: Math.round((bbox.right - vis.right)*10)/10, dB: Math.round((bbox.bottom - vis.bottom)*10)/10 });
      });
      return res;
    })()`);
    console.log('── 诊断A：吸附bbox − 视觉rect（正值=bbox比视觉大）');
    diagA.forEach(function (r) { console.log('  ' + r.t + ' @(' + r.x + ',' + r.y + ') ' + r.w + 'x' + r.h + ' rot' + r.rot + ' ΔL' + r.dL + ' ΔT' + r.dT + ' ΔR' + r.dR + ' ΔB' + r.dB); });

    // ── 诊断 B：findMergeSnap 网格扫描——在视觉远离目标的地方是否会命中 ──
    const diagB = await cdp.evalJs(`(function(){
      var canvas = document.querySelector('.grid-canvas');
      var rect = canvas.getBoundingClientRect();
      var cards = Array.from(canvas.querySelectorAll('.grid-card'));
      var drag = cards[0]; // 短内容卡
      var farHits = [];
      for (var x = 0; x <= 1400; x += 40) {
        for (var y = 0; y <= 800; y += 40) {
          var m = window.findMergeSnap(drag, x, y);
          if (!m) continue;
          var t = m.target;
          var vr = t.getBoundingClientRect();
          var tL = vr.left - rect.left, tT = vr.top - rect.top, tR = vr.right - rect.left, tB = vr.bottom - rect.top;
          // 落点（拖动卡左上角）到目标视觉矩形的最近距离
          var dx = Math.max(tL - x, 0, x - tR), dy = Math.max(tT - y, 0, y - tB);
          var dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 20) farHits.push({ x: x, y: y, target: t.dataset.cardType, d: Math.round(m.d*10)/10, axis: m.axis, dist: Math.round(dist) });
        }
      }
      return farHits.slice(0, 40);
    })()`);
    console.log('── 诊断B：远距误命中数（落点距目标视觉矩形 >20px 仍被吸附）:', diagB.length);
    diagB.forEach(function (r) { console.log('  落点(' + r.x + ',' + r.y + ') → ' + r.target + ' 边距d=' + r.d + ' 轴=' + r.axis + ' 视觉距离=' + r.dist + 'px'); });

    // ── 诊断 C：style.left/top 与视觉位置的偏差（防 static/transform 定位漂移） ──
    const diagC = await cdp.evalJs(`(function(){
      var canvas = document.querySelector('.grid-canvas');
      var rect = canvas.getBoundingClientRect();
      var cards = Array.from(canvas.querySelectorAll('.grid-card'));
      var res = [];
      cards.forEach(function(card){
        var l = parseFloat(card.style.left) || 0, t = parseFloat(card.style.top) || 0;
        var vr = card.getBoundingClientRect();
        res.push({ t: card.dataset.cardType, sL: Math.round(l), sT: Math.round(t),
          vL: Math.round(vr.left - rect.left), vT: Math.round(vr.top - rect.top),
          pos: getComputedStyle(card).position, tf: getComputedStyle(card).transform !== 'none' ? '有transform' : '无' });
      });
      return res;
    })()`);
    console.log('── 诊断C：style vs 视觉定位');
    diagC.forEach(function (r) { console.log('  ' + r.t + ' style(' + r.sL + ',' + r.sT + ') 视觉(' + r.vL + ',' + r.vT + ') position=' + r.pos + ' ' + r.tf); });

    console.log('console errors:', cdp.errs.length, cdp.errs.slice(0, 3));
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
