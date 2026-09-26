// tmp-probe-msg-preempt.js — Messages M1i 差额机制裁决（v0.2.50.4）
// 问题：fadefix 电池 M1i itTargets=5/vis=8——8 张波浪头卡里 3 张的 transitionstart 瞬间
// 没带波浪内联过渡。裁决：t=350ms（8 张全起播、清理未开始）快照前 8 张 CARD_SELECTOR 的
// inline transition——若 8 张全部带 cubic-bezier(0.22 → 波浪全部写入，差额=页内原生动画
// 抢先到终值、startCard 写入即终值无新过渡可起（观感无损）；若某张无内联 → 守卫误判真凶。
// 用法：node tmp-probe-msg-preempt.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4950 + Math.floor(Math.random() * 100);
const CDP_PORT = 5950 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-msgpre-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  const file = path.join(DOCS, p === '/' ? '/index.html' : p);
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
    await sleep(120);
  }
  throw new Error('waitFor 超时: ' + label);
}

const PROBE = `(function () {
  window.__mp = { starts: [], snap: null };
  document.addEventListener('transitionstart', function (e) {
    window.__mp.starts.push({
      t: Math.round(performance.now()),
      cls: String(e.target.className || e.target.tagName).slice(0, 30),
      it: (e.target.style && e.target.style.transition) || ''
    });
  }, true);
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var all = Array.prototype.slice.call(document.querySelectorAll('.card, .app-main h1, .app-main h1 + p, .app-main h2, .app-main .search-capsule, .app-main header, .auth-card'));
      var scope = all.slice(0, 8);
      window.__mp.snap = scope.map(function (el) {
        var cs = getComputedStyle(el);
        return {
          cls: String(el.className || el.tagName).slice(0, 30),
          inlineT: el.style.transition || '',
          inlineWC: el.style.willChange || '',
          inlineO: el.style.opacity || '',
          computedT: cs.transform,
          computedO: cs.opacity,
          anim: cs.animationName
        };
      });
    }, 350);
  });
})();`;

(async () => {
  console.log('═══ tmp-probe-msg-preempt.js — Messages M1i 差额机制裁决 ═══');
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
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
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
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-demo-local', name: 'You', email: 'you@demo.local' } })) + ');}catch(e){}' + PROBE
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/messages.html' });
    await waitFor(cdp, "document.readyState === 'complete'", 30000, 'messages ready');
    await sleep(1500);
    const r = await cdp.evalJs('window.__mp');
    console.log('── t=350ms 快照（前 8 张 CARD_SELECTOR）──');
    (r.snap || []).forEach(function (s, i) {
      console.log(' [' + i + '] ' + s.cls);
      console.log('      inlineT=' + (s.inlineT ? '✅ ' + s.inlineT.slice(0, 60) : '❌ 空') +
        ' | inlineWC=' + (s.inlineWC || '(空)') + ' | inlineO=' + (s.inlineO || '(空)'));
      console.log('      computedT=' + s.computedT.slice(0, 40) + ' | computedO=' + s.computedO + ' | anim=' + s.anim);
    });
    console.log('── transitionstart 事件流 ──');
    (r.starts || []).forEach(function (s) {
      console.log(' t=' + s.t + 'ms ' + s.cls + ' it=' + (s.it ? s.it.slice(0, 40) : '(空)'));
    });
    const withCubic = (r.starts || []).filter(function (s) { return s.it.indexOf('cubic-bezier(0.22') !== -1; }).length;
    const snapWithInline = (r.snap || []).filter(function (s) { return s.inlineT.indexOf('cubic-bezier(0.22') !== -1; }).length;
    console.log('── 裁决 ──');
    console.log(' t=350ms 带波浪内联的卡数 = ' + snapWithInline + '/8');
    console.log(' transitionstart 带波浪内联的事件数 = ' + withCubic);
    console.log(snapWithInline === 8
      ? ' ✅ 波浪写入全部 8 张——差额 3 张 = 页内原生动画抢先到终值、写入即终值无新过渡可起（观感无损，守卫无误判）'
      : ' ❌ 有卡没收到波浪内联——守卫仍有问题，继续查');
    cdp.close();
    try { chrome.kill(); } catch (e) {}
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
})();
