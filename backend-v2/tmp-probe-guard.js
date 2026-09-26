// tmp-probe-guard.js — 双动画守卫探针：查 dashboard 欢迎卡与 auth 卡在 boot 时刻的 getAnimations 状态
// 手法：同 fadefix 电池 harness；加载后每 ~100ms 快照一次 getAnimations 轨迹
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-guardprobe-' + Date.now());
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

// 守卫判定 + 状态轨迹（与 transitions.js hasActiveOpacityAnim 同逻辑）
const SNAP = `(function () {
  var out = [];
  function snap() {
    var w = document.querySelector('#welcomeBanner');
    w = w ? w.closest('.card') : null;
    if (!w) { out.push('(无欢迎卡)'); return; }
    var anims = w.getAnimations ? w.getAnimations() : [];
    var rows = anims.map(function (a) {
      var ct = null; try { ct = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null; } catch (e) {}
      var kfs = null; try { kfs = a.effect.getKeyframes ? a.effect.getKeyframes() : null; } catch (e) {}
      var kfInfo = '(无kfs)';
      if (kfs) kfInfo = kfs.map(function (k) { return (k.opacity !== undefined ? 'o' : '') + (k.transform !== undefined ? 't' : ''); }).join(',');
      var applies = false;
      if (ct) applies = ct.phase === 'active' || (ct.phase === 'after' && ct.fill === 'forwards') || (ct.phase === 'before' && (ct.fill === 'backwards' || ct.fill === 'both'));
      return {
        n: (a.animationName || (a.constructor && a.constructor.name) || '?'),
        phase: ct ? ct.phase : '?', fill: ct ? ct.fill : '?', applies: applies, kfs: kfInfo,
        progress: ct ? +(ct.progress || 0).toFixed(2) : -1
      };
    });
    out.push(rows);
  }
  snap();
  var t = 0;
  var iv = setInterval(function () { t += 100; snap(); if (t >= 3000) clearInterval(iv); }, 100);
  return new Promise(function (res) { setTimeout(function () { res(out); }, 3200); });
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
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-demo-local', name: 'You', email: 'you@demo.local' } })) + ');}catch(e){}'
    });

    console.log('═══ 探针 1：dashboard 欢迎卡 getAnimations 轨迹（0-3s，100ms 步长）═══');
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await sleep(400);
    const traj = await cdp.evalJs(SNAP);
    traj.forEach((rows, i) => {
      if (i === 0) console.log('  t=' + (i * 100) + 'ms (navigate+400ms 起):');
      console.log('  t≈' + (i * 100) + 'ms: ' + JSON.stringify(rows));
    });
    // boot 时刻 guard 判定复现（DOMContentLoaded 后立即由页面自身脚本记录——探针内注入到新文档）
    console.log('\n═══ 探针 2：boot 时刻快照（DOMContentLoaded 时由注入脚本记录）═══');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(function(){
        window.__bootSnap = null;
        document.addEventListener('DOMContentLoaded', function () {
          var w = document.querySelector('#welcomeBanner');
          w = w ? w.closest('.card') : null;
          if (!w) { window.__bootSnap = '(无欢迎卡)'; return; }
          var anims = w.getAnimations ? w.getAnimations() : [];
          window.__bootSnap = anims.map(function (a) {
            var ct = null; try { ct = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null; } catch (e) {}
            var kfs = null; try { kfs = a.effect.getKeyframes ? a.effect.getKeyframes() : null; } catch (e) {}
            var kfInfo = '(无kfs)';
            if (kfs) kfInfo = kfs.map(function (k) { return (k.opacity !== undefined ? 'o' : '') + (k.transform !== undefined ? 't' : ''); }).join(',');
            return { n: (a.animationName || (a.constructor && a.constructor.name) || '?'), phase: ct ? ct.phase : '?', fill: ct ? ct.fill : '?', kfs: kfInfo };
          });
        });
      })();`
    });
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await sleep(3000);
    const bootSnap = await cdp.evalJs('window.__bootSnap');
    console.log('  boot 快照: ' + JSON.stringify(bootSnap));
    // boot 时欢迎卡是否已被写内联（transitions.js 跑完后的状态）
    const bootInline = await cdp.evalJs("(function(){var w=document.querySelector('#welcomeBanner');w=w?w.closest('.card'):null;return w?{t:(w.style.transition||''),o:(w.style.opacity||''),tr:(w.style.transform||''),wc:(w.style.willChange||'')}:'(无)';})()");
    console.log('  落定后内联: ' + JSON.stringify(bootInline));
    const selCount = await cdp.evalJs("(function(){var cs=document.querySelectorAll('.card, .app-main h1, .app-main h1 + p, .app-main h2, .app-main .search-capsule, .app-main header, .auth-card');var o=[];for(var i=0;i<cs.length;i++){o.push(i+':'+(cs[i].className.toString().slice(0,30))+'@display:'+getComputedStyle(cs[i]).display);}return o.slice(0,12).join(' | ');})()");
    console.log('  CARD_SELECTOR 前 12 个匹配: ' + selCount);

    console.log('\n═══ 探针 3：auth 页 .auth-card 状态 + 入场事件 ═══');
    await cdp.send('Page.navigate', { url: BASE + '/signup-and-login' });
    await sleep(2500);
    const authInfo = await cdp.evalJs("(function(){var a=document.querySelector('.auth-card');if(!a)return '(无 .auth-card)';var anims=a.getAnimations?a.getAnimations():[];return {animCount:anims.length,anims:anims.map(function(x){return (x.animationName||(x.constructor&&x.constructor.name)||'?')+':'+(x.playState||'?');}),inlineT:(a.style.transition||''),inlineWC:(a.style.willChange||''),computedAnim:getComputedStyle(a).animationName};})()");
    console.log('  auth: ' + JSON.stringify(authInfo));

    cdp.close();
    try { chrome.kill(); } catch (e) {}
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
  process.exit(0);
})();
