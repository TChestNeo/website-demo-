// tmp-probe-s24.js — S24/S25 复刻探针：修后编辑器上实测台阶组单选东扩的失败值（不暂存）
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 18799, CDP_PORT = 18809;
const USER_DATA = path.join(process.env.TEMP || '/tmp', 'tmp-probe-s24-' + crypto.randomBytes(3).toString('hex'));

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((res, rej) => { this.ws.addEventListener('open', res); this.ws.addEventListener('error', () => rej(new Error('ws error'))); });
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data.toString());
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.rej(new Error(p.method + ' 失败: ' + m.error.message)) : p.res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') this.errs.push(m.params.exceptionDetails.text);
    });
  }
  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  evalJs(expr) { return this.send('Runtime.evaluate', { expression: expr, returnByValue: true }).then(r => r.result.value); }
  async mouse(type, x, y, clickCount) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: clickCount || 1 });
  }
  async close() { try { this.ws.close(); } catch (e) {} }
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

const server = http.createServer((req, res) => {
  let f = path.join(DOCS, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DOCS, 'index.html');
  const ext = path.extname(f).toLowerCase();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
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
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session",' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const cen = (which) => cdp.evalJs("(function(){ var r = window.__" + which + ".getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()");
    const singleSel = async (which) => {
      const c = JSON.parse(await cen(which));
      await cdp.mouse('mousePressed', c.x, c.y, 1); await cdp.mouse('mouseReleased', c.x, c.y, 1);
      await sleep(600);
      await cdp.mouse('mousePressed', c.x, c.y, 1); await cdp.mouse('mouseReleased', c.x, c.y, 1);
      await sleep(350);
    };
    const hdl = (dir) => cdp.evalJs("(function(){ var hs = Array.prototype.slice.call(document.querySelectorAll('.resize-handle[data-dir=\"" + dir + "\"]')).filter(function(h){ var r = h.getBoundingClientRect(); return r.width > 2 && r.height > 2; }); if (!hs.length) return 'null'; var r = hs[0].getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()");
    const drag2 = async (dir, dx, dy) => {
      const h = JSON.parse(await hdl(dir));
      if (h === 'null') throw new Error('no handle ' + dir);
      await cdp.mouse('mousePressed', h.x, h.y, 1);
      for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', h.x + dx * i / 4, h.y + dy * i / 4);
      await cdp.mouse('mouseReleased', h.x + dx, h.y + dy, 1);
      await sleep(250);
    };
    const g2 = (a, b) => cdp.evalJs("(function(){ var A = window.__" + a + ", B = window.__" + b + "; var al = parseFloat(A.style.left) || 0, bl = parseFloat(B.style.left) || 0; return JSON.stringify({ gap: +(bl - (al + A.offsetWidth)).toFixed(1), overlap: +Math.max(0, (al + A.offsetWidth) - bl).toFixed(1) }); })()");

    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S0');
    // S24 复刻：A=内容卡（8×4）B=国旗卡（8×5）右并 C=内容卡下并 B → 单选 A → e 拖 +60
    await cdp.evalJs("(function(){ var A = window.createContentCard(); window.moveCardPx(A, 250, 350); var B = window.createFlagCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 440, 520); window.mergeCards(C, B, 'bottom'); window.__A = A; window.__B = B; window.__C = C; return true; })()");
    await singleSel('A');
    console.log('S24 sel=' + await cdp.evalJs("JSON.stringify({ sel: document.querySelectorAll('.grid-card.selected').length, gs: document.querySelectorAll('.grid-card.group-single').length, ty: (function(){ var s = document.querySelector('.grid-card.selected'); return s ? s.dataset.cardType : null; })() })"));
    const bL0 = await cdp.evalJs('parseFloat(window.__B.style.left) || 0');
    const cL0 = await cdp.evalJs('parseFloat(window.__C.style.left) || 0');
    const cT0 = await cdp.evalJs('parseFloat(window.__C.style.top) || 0');
    const cW0 = await cdp.evalJs('window.__C.offsetWidth');
    console.log('S24 hdl-e=' + await hdl('e'));
    await drag2('e', 60, 0);
    console.log('S24 after → A-B ' + await g2('A', 'B') + ' | bΔ=' + ((await cdp.evalJs('parseFloat(window.__B.style.left) || 0')) - bL0).toFixed(1) + ' | cΔL=' + ((await cdp.evalJs('parseFloat(window.__C.style.left) || 0')) - cL0).toFixed(1) + ' cΔT=' + ((await cdp.evalJs('parseFloat(window.__C.style.top) || 0')) - cT0).toFixed(1) + ' cΔW=' + ((await cdp.evalJs('window.__C.offsetWidth')) - cW0));
    // S25 复刻：单选 C → e 拖 -60 收窄 → 单选 A → e 拖 +60 → C 宽保持自定义
    await singleSel('C');
    await drag2('e', -60, 0);
    const cWcustom = await cdp.evalJs('window.__C.offsetWidth');
    console.log('S25 cWcustom=' + cWcustom + ' (cW0=' + cW0 + ')');
    await singleSel('A');
    await drag2('e', 60, 0);
    const cWafter = await cdp.evalJs('window.__C.offsetWidth');
    console.log('S25 after → cWafter=' + cWafter + ' | kept=' + (Math.abs(cWafter - cWcustom) < 0.5));
    console.log('DONE');
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
