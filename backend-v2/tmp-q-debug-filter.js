// tmp-q-debug-filter.js — P10 filter=none 真身定位：dump bg 内联样式/计算 filter/
// matched rules/--divider-line 解析值（house CDP 模式，2026-09-12）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        console.error('[PAGE EXCEPTION]', (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 300));
      }
    };
  }
  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  }
}
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs(expr)) return; } catch (e) {}
    await sleep(250);
  }
  throw new Error('waitFor timeout: ' + label);
}

(async () => {
  const ROOT = path.resolve(__dirname, '..', 'docs');
  const port = 18000 + Math.floor(Math.random() * 2000);
  const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u.indexOf('/api/') === 0) { res.writeHead(404); res.end(); return; }
    let p = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(p).toLowerCase();
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:' + port;

  const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const profile = path.join(os.tmpdir(), 'claude-q-debug-' + crypto.randomBytes(4).toString('hex'));
  const cdpPort = 29000 + Math.floor(Math.random() * 2000);
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--remote-debugging-port=' + cdpPort,
    '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--window-size=1600,1000', 'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(500);
    try {
      const j = JSON.parse(require('child_process').execSync('curl -s http://127.0.0.1:' + cdpPort + '/json').toString());
      const page = (j.find(x => x.type === 'page') || j[0]);
      if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch (e) {}
  }
  if (!wsUrl) { console.error('NO CDP'); process.exit(1); }
  const cdp = new CDP(wsUrl);
  await cdp.connect();
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
  });
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  await waitFor(cdp, "typeof window.createFlagCard === 'function'", 20000, 'load');
  await sleep(800);

  await cdp.evalJs(`(function(){
    window.__a = window.createContentCard(); window.moveCardPx(window.__a, 300, 200);
    window.__b = window.createContentCard(); window.moveCardPx(window.__b, 500, 200);
    window.mergeCards(window.__b, window.__a, 'right'); return true;
  })()`);
  await sleep(300);

  const dump = await cdp.evalJs(`(function(){
    var bg = document.querySelector('.grid-group-bg');
    if (!bg) return { noBg: true };
    return {
      inlineStyle: bg.getAttribute('style'),
      computedFilter: getComputedStyle(bg).filter,
      computedClip: getComputedStyle(bg).clipPath,
      dividerLine: getComputedStyle(document.documentElement).getPropertyValue('--divider-line').trim(),
      colorPrimary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
      hasLg: !!window.LG,
      lgFilterSm: !!(document.getElementById('lg-glass-filter-sm')),
      selected: bg.classList.contains('selected'),
      className: bg.className
    };
  })()`);
  console.log(JSON.stringify(dump, null, 2));

  const doc = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const node = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.grid-group-bg' });
  const matched = await cdp.send('CSS.getMatchedStylesForNode', { nodeId: node.nodeId });
  console.log('--- matched rules mentioning filter ---');
  (matched.matchedCSSRules || []).forEach(r => {
    const sel = (r.rule.selectorList && r.rule.selectorList.text) || '?';
    const cssText = (r.rule.style && r.rule.style.cssText) || '';
    if (cssText.indexOf('filter') !== -1) console.log('  SEL:', sel.slice(0, 90), '=>', cssText.slice(0, 200));
  });
  console.log('--- inline style attr of bg ---');
  console.log('  ', node.attributes || []);

  chrome.kill();
  server.close();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(1); });
