// tmp-probe-subnav-slide.js — 验证 Micronationary 顶部导航滑动高亮动画
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-slide-' + Date.now());
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

  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/micronationary?showTab=overview' });
    await waitFor(cdp, "!!document.querySelector('.subnav-highlight-bg') && typeof window.mnShowTab === 'function'", 30000, '加载');
    await sleep(1500);

    const before = await cdp.evalJs(`(function(){
      var sb = document.getElementById('mnTopSubnav');
      var bg = sb.querySelector('.subnav-highlight-bg');
      return { left: Math.round(parseFloat(bg.style.left) || 0), hasAnimate: typeof sb._animateTo === 'function' };
    })()`);
    console.log('切换前:', JSON.stringify(before));

    // 点击「探索」药丸
    await cdp.evalJs(`(function(){
      var p = [].slice.call(document.querySelectorAll('.subnav-pill')).filter(function (x) { return (x.getAttribute('href') || '').indexOf('showTab=explore') !== -1; })[0];
      p.click();
    })()`);
    var samples = [];
    var t0 = Date.now();
    while (Date.now() - t0 < 1000) {
      samples.push(await cdp.evalJs(`(function(){
        var sb = document.getElementById('mnTopSubnav');
        var bg = sb.querySelector('.subnav-highlight-bg');
        var cs = getComputedStyle(bg);
        return [Math.round(parseFloat(cs.left) || 0), cs.transform];
      })()`));
      await sleep(50);
    }
    var target = await cdp.evalJs(`(function(){
      var t = document.querySelector('#mnTopSubnav .subnav-pill.active');
      return t ? t.offsetLeft : -1;
    })()`);
    var lefts = samples.map(function (s) { return s[0]; });
    var peak = Math.max.apply(null, lefts);
    var scaleDip = samples.map(function (s) {
      var m = /matrix\(([^)]+)\)/.exec(s[1]);
      return m ? Math.round(parseFloat(m[1].split(',')[0]) * 100) / 100 : 1;
    });
    var minScale = Math.min.apply(null, scaleDip);
    console.log('left 采样:', JSON.stringify(lefts));
    console.log('scaleX 采样:', JSON.stringify(scaleDip));
    console.log('目标:', target, '| left 峰值:', peak, '| 位移过冲:', peak > target ? 'YES ✗' : 'NO ✓', '| 落地挤压 scaleX 最低:', minScale, minScale < 1 ? '(duai ✓)' : '(无挤压)');
    console.log('runtime exceptions:', JSON.stringify(cdp.errs));
  } catch (e) {
    console.log('PROBE ERROR:', e.message);
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
