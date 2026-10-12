// tmp-probe-topnav.js — 验证 Micronationary 社区式顶部导航（单标签行 + 右侧搜索胶囊）
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
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-tn-' + Date.now());
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
    await waitFor(cdp, "!!document.getElementById('mnTopSubnav') && !!document.querySelector('.subnav-highlight-bg')", 30000, '加载');
    await sleep(1200);

    console.log('顶部导航结构:', await cdp.evalJs(`(function(){
      var top = document.getElementById('mnTopSubnav');
      var cap = document.getElementById('mnTopSearchCapsule');
      var pills = top ? top.querySelectorAll('.subnav-pill') : [];
      var bg = top ? top.querySelector('.subnav-highlight-bg') : null;
      var bgRect = bg ? (function(){ var r = bg.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; })() : null;
      var capRect = cap ? (function(){ var r = cap.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; })() : null;
      var allSubnavs = document.querySelectorAll('.subnav[data-slider]').length;
      var viewSubnavs = document.querySelectorAll('.mn-view .subnav').length;
      return {
        topPills: pills.length,
        activePill: top ? (top.querySelector('.subnav-pill.active') || {}).textContent : null,
        subnavCount: allSubnavs,
        viewSubnavCount: viewSubnavs,
        bgRect: bgRect, capRect: capRect,
        capRightOfPills: bgRect && capRect ? capRect.x > bgRect.x + bgRect.w : false,
        visibleView: (document.querySelector('.mn-view:not([hidden-view])') || {}).id
      };
    })()`));

    // 点「探索」验证单标签切换 + 滑动
    await cdp.evalJs(`(function(){
      var p = [].slice.call(document.querySelectorAll('#mnTopSubnav .subnav-pill')).filter(function (x) { return (x.getAttribute('href') || '').indexOf('showTab=explore') !== -1; })[0];
      p.click();
    })()`);
    await sleep(150);
    var mid = await cdp.evalJs(`(function(){
      var bg = document.querySelector('#mnTopSubnav .subnav-highlight-bg');
      return { computed: Math.round(parseFloat(getComputedStyle(bg).left) || 0), view: (document.querySelector('.mn-view:not([hidden-view])') || {}).id, active: (document.querySelector('#mnTopSubnav .subnav-pill.active') || {}).textContent };
    })()`);
    await sleep(700);
    var end = await cdp.evalJs(`(function(){
      var bg = document.querySelector('#mnTopSubnav .subnav-highlight-bg');
      var t = document.querySelector('#mnTopSubnav .subnav-pill.active');
      return { computed: Math.round(parseFloat(getComputedStyle(bg).left) || 0), target: t ? t.offsetLeft : -1 };
    })()`);
    console.log('切换中:', JSON.stringify(mid), '切换后:', JSON.stringify(end));

    // 顶部搜索胶囊：回车 → 切到探索并跑搜索
    await cdp.evalJs(`(function(){
      var inp = document.getElementById('mnTopSearchInput');
      inp.value = '斯拉曼';
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    })()`);
    await sleep(1200);
    console.log('顶部搜索联动:', await cdp.evalJs(`(function(){
      return {
        view: (document.querySelector('.mn-view:not([hidden-view])') || {}).id,
        bigInput: (document.getElementById('exSearchInput') || {}).value,
        results: document.querySelectorAll('#exArticleResults .mn-glass-row').length
      };
    })()`));
    console.log('runtime exceptions:', JSON.stringify(cdp.errs));
  } catch (e) {
    console.log('PROBE ERROR:', e.message);
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
