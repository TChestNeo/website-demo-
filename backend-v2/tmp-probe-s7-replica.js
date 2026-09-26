'use strict';
// 探针：S7 整组缩放之谜——页面内复制 onGroupResizeMove 算法+逐步日志 vs 真实帧状态
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4710 + Math.floor(Math.random() * 200);
const CDP_PORT = 5810 + Math.floor(Math.random() * 200);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-s7rep-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(DOCS, p === '/' ? 'index.html' : p);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain' });
    res.end(data);
  });
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1600,1200', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try {
      const list = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
      target = list.find(t => t.type === 'page');
    } catch (e) {}
  }
  if (!target) { console.log('CDP 起不来'); process.exit(1); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.error) throw new Error('evalJs: ' + JSON.stringify(r.error).slice(0, 200));
    if (r.result && r.result.exceptionDetails) throw new Error('evalJs: ' + (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text));
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('CSS.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
  });
  const pageErrs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') pageErrs.push(String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 300));
  });
  const navR = await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html' });
  console.log('navR =', JSON.stringify(navR).slice(0, 300));
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try { if (await evalJs("typeof window.findMergeSnap === 'function'")) break; } catch (e) {}
    if (i === 79) {
      console.log('编辑器未就绪');
      const raw = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
      console.log('rawEval =', JSON.stringify(raw).slice(0, 500));
      const raw2 = await send('Runtime.evaluate', { expression: 'typeof window.findMergeSnap', returnByValue: true });
      console.log('rawEval2 =', JSON.stringify(raw2).slice(0, 500));
      const list2 = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
      console.log('targets =', JSON.stringify(list2.map(t => ({ type: t.type, url: t.url }))));
      console.log('pageErrs =', JSON.stringify(pageErrs));
      process.exit(1);
    }
  }
  await sleep(600);

  const helpers = "function byId(id){ return Array.from(document.querySelectorAll('.grid-card')).find(function(c){ return c.dataset.cardId === id; }); }" +
    "function posCard(el){ return { left: parseFloat(el.style.left) || 0, top: parseFloat(el.style.top) || 0, w: el.offsetWidth, h: el.offsetHeight }; }";

  // 建十字（同电池 S4 配方）
  const setup = await evalJs(helpers + `(function(){
    var C0 = window.createContentCard(); window.moveCardPx(C0, 800, 500);
    var c0p = posCard(C0);
    var N = window.createContentCard(); window.moveCardPx(N, c0p.left + 10, c0p.top - c0p.h - 6);
    window.mergeCards(N, C0, 'top');
    var S = window.createContentCard(); window.moveCardPx(S, c0p.left + 10, c0p.top + c0p.h + 6);
    window.mergeCards(S, C0, 'bottom');
    var W = window.createContentCard(); window.moveCardPx(W, c0p.left - 90, c0p.top + 10); W.style.width = '80px';
    window.mergeCards(W, C0, 'left');
    var E = window.createContentCard(); window.moveCardPx(E, c0p.left + 190, c0p.top + 10); E.style.width = '80px';
    window.mergeCards(E, C0, 'right');
    return { c0: C0.dataset.cardId, n: N.dataset.cardId, s: S.dataset.cardId, w: W.dataset.cardId, e: E.dataset.cardId };
  })()`);
  console.log('setup:', JSON.stringify(setup));

  const preInfo = await evalJs(helpers + `(function(){
    var C0 = byId('${setup.c0}'), N = byId('${setup.n}'), S = byId('${setup.s}'), W = byId('${setup.w}'), E = byId('${setup.e}');
    window.selectCard(C0);
    var g = C0.dataset.groupId;
    var g = function(c){ return { l: c.style.left, t: c.style.top, w: c.offsetWidth, h: c.offsetHeight, col: c.dataset.colSpan, row: c.dataset.rowSpan }; };
    // 成员序 = getAllCards 序（groupMembers 用 getAllCards().filter）
    var order = Array.from(document.querySelectorAll('.grid-card')).filter(function(c){ return c.dataset.groupId === C0.dataset.groupId; }).map(function(c){ return c.dataset.cardId; });
    return { c0: g(C0), n: g(N), s: g(S), w: g(W), e: g(E), order: order, gid: C0.dataset.groupId };
  })()`);
  console.log('preInfo:', JSON.stringify(preInfo, null, 1));
  const idToKey = { [setup.c0]: 'c0', [setup.n]: 'n', [setup.s]: 's', [setup.w]: 'w', [setup.e]: 'e' };
  const memberOrder = preInfo.order.map(id => idToKey[id]);
  console.log('memberOrder:', memberOrder.join(','));

  const h = JSON.parse(await evalJs(`(function(){ var h = document.querySelector('.resize-handle[data-dir="se"]'); var r = h.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()`));
  console.log('se handle center:', JSON.stringify(h));

  // CDP 真 mousePressed 打在手柄上（手柄自己的 mousedown 监听器带真实 e+dir 调 beginResize）
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: h.x, y: h.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x + 30, y: h.y + 22.5, button: 'none' });
  await sleep(200);
  const real = await evalJs(helpers + `(function(){
    var g = function(c){ return { l: c.style.left, t: c.style.top, w: c.offsetWidth, h: c.offsetHeight }; };
    return { c0: g(byId('${setup.c0}')), n: g(byId('${setup.n}')), s: g(byId('${setup.s}')), w: g(byId('${setup.w}')), e: g(byId('${setup.e}')) };
  })()`);
  console.log('real frame3:', JSON.stringify(real, null, 1));

  // 页面内复制算法：真实 pre 串 + 真实成员序，逐步日志
  const preJs = JSON.stringify({ c0: preInfo.c0, n: preInfo.n, s: preInfo.s, w: preInfo.w, e: preInfo.e });
  const replica = await evalJs(`(function(){
    var log = [];
    var pre = ${preJs};
    var KEYS = ${JSON.stringify(memberOrder)}; // st.members 序
    var cs = 20, gap = 2, step = 22;
    var box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    KEYS.forEach(function(k){
      var m = pre[k]; var l = parseFloat(m.l), t = parseFloat(m.t);
      if (l < box.left) box.left = l; if (t < box.top) box.top = t;
      if (l + m.w > box.right) box.right = l + m.w; if (t + m.h > box.bottom) box.bottom = t + m.h;
    });
    var bw = box.right - box.left, bh = box.bottom - box.top;
    log.push('box: ' + box.left + ',' + box.top + ' ' + bw + 'x' + bh);
    var dx = 30, dy = 22.5, dirX = 1, dirY = 1;
    var boxW = Math.max(cs, bw + dirX * dx);
    var boxH = Math.max(cs, bh + dirY * dy);
    var spanW = Math.max(1, Math.round((boxW + gap) / step));
    var spanH = Math.max(1, Math.round((boxH + gap) / step));
    var newW = spanW * step - gap, newH = spanH * step - gap;
    var dw = newW - bw, dh = newH - bh;
    var newLeft = box.left + bw / 2 + dirX * dw / 2 - newW / 2;
    var newTop = box.top + bh / 2 + dirY * dh / 2 - newH / 2;
    var scaleX = newW / bw, scaleY = newH / bh;
    log.push('span ' + spanW + 'x' + spanH + ' newW ' + newW + ' newH ' + newH + ' newLeft ' + newLeft + ' newTop ' + newTop + ' sx ' + scaleX + ' sy ' + scaleY);
    var cur = {};
    KEYS.forEach(function(k){
      var m = pre[k];
      var sL = newLeft + (parseFloat(m.l) - box.left) * scaleX;
      var sT = newTop + (parseFloat(m.t) - box.top) * scaleY;
      var sW = Math.max(1, Math.round((m.w * scaleX + gap) / step));
      var sH = Math.max(1, Math.round((m.h * scaleY + gap) / step));
      cur[k] = { x: sL, y: sT, w: sW * step - gap, h: sH * step - gap };
      log.push('scale ' + k + ': x=' + sL + ' y=' + sT + ' w=' + (sW * step - gap) + ' h=' + (sH * step - gap));
    });
    var byX = KEYS.slice().sort(function(a,b){ return cur[a].x - cur[b].x; });
    log.push('byX: ' + byX.join(','));
    var rows = [];
    byX.forEach(function(k){
      var m = cur[k];
      var edge = -Infinity;
      rows.forEach(function(p){
        if (p.b > m.y && m.y + m.h > p.t) { if (p.edge > edge) edge = p.edge; }
      });
      if (m.x < edge) { m.x = edge; log.push('xchain push ' + k + ' -> ' + edge); }
      rows.push({ t: m.y, b: m.y + m.h, edge: m.x + m.w });
    });
    log.push('after xchain: ' + JSON.stringify(cur));
    var byY = KEYS.slice().sort(function(a,b){ return cur[a].y - cur[b].y; });
    log.push('byY: ' + byY.join(','));
    var placed = [];
    byY.forEach(function(k){
      var m = cur[k];
      var cand = -Infinity;
      placed.forEach(function(o){
        if (o.right > m.x && o.left < m.x + m.w) { if (o.bottom > cand) cand = o.bottom; }
      });
      if (m.y < cand) { m.y = cand; log.push('ychain push ' + k + ' -> ' + cand); }
      placed.push({ left: m.x, right: m.x + m.w, top: m.y, bottom: m.y + m.h });
    });
    log.push('after ychain: ' + JSON.stringify(cur));
    return log.join('\\n');
  })()`);
  console.log('replica log:\n' + replica);

  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: h.x + 30, y: h.y + 22.5, button: 'left', clickCount: 1 });
  try { ws.close(); } catch (e) {}
  try { chrome.kill(); } catch (e) {}
  try { server.close(); } catch (e) {}
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
