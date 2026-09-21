'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CDP_PORT = 5900 + Math.floor(Math.random() * 80);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-diagpan-' + Date.now());
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') this.errs.push(JSON.stringify(m.params.exceptionDetails || {}).slice(0, 200));
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
(async () => {
  let chromePath = null;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe']) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--hide-scrollbars', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
  await cdp.send('Page.navigate', { url: 'https://mnationworld.com/pages/fluidcanvas-editor.html' });
  await sleep(4000);
  console.log('page:', await cdp.evalJs('location.pathname + " canvas=" + !!document.getElementById("gridCanvas")'));
  const at = await cdp.evalJs(`(function(){
    var body = document.getElementById('gridCanvas').parentElement;
    var b = body.getBoundingClientRect();
    var c = document.getElementById('gridCanvas').getBoundingClientRect();
    var at = function(x, y){ var el = document.elementFromPoint(x, y); return el ? (el.tagName + '.' + String(el.className || '').split(' ').slice(0,3).join('.')) : 'null'; };
    return JSON.stringify({ body: {l:b.left,t:b.top}, canvas: {l:c.left,t:c.top},
      p1: at(b.left+300, b.top+250), p2: at(c.left+300, c.top+250), p3: at(b.left+600, b.top+300), p4: at(b.left+900, b.top+400) });
  })()`);
  console.log('hits:', at);
  const pts = JSON.parse(at);
  const tries = [['body+300/250', pts.body.l+300, pts.body.t+250], ['canvas+300/250', pts.canvas.l+300, pts.canvas.t+250], ['body+600/300', pts.body.l+600, pts.body.t+300], ['body+900/400', pts.body.l+900, pts.body.t+400]];
  for (const [label, x, y] of tries) {
    try {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x, y: y, button: 'middle', clickCount: 1, modifiers: 0 });
      await sleep(100);
      const mov = await cdp.evalJs('document.body.classList.contains("fc-moving")');
      console.log(label + ' @(' + Math.round(x) + ',' + Math.round(y) + ') -> fc-moving=' + mov);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x, y: y, button: 'middle', clickCount: 1, modifiers: 0 });
      await sleep(400);
    } catch (e) {
      console.log(label + ' -> ERROR: ' + e.message);
      break;
    }
  }
  console.log('errs:', cdp.errs.length);
  cdp.close();
  try { chrome.kill(); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('💥 ' + e.message); process.exit(1); });
