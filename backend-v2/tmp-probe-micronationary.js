// tmp-probe-micronationary.js — 验证合并页：showTab 视图切换 + 无 JS 报错
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
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
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
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
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-mnmerge-' + Date.now());
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
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/micronationary?showTab=explore' });
    await waitFor(cdp, "!!document.getElementById('view-explore') && typeof window.mnShowTab === 'function'", 30000, '合并页加载');
    await sleep(2500);

    console.log('href:', await cdp.evalJs('location.href'));
    console.log('显示状态:', await cdp.evalJs(`(function(){
      return ['overview','explore','guidelines'].map(function(t){
        var v = document.getElementById('view-' + t);
        return t + ':' + (v.hasAttribute('hidden-view') ? '隐藏' : '显示');
      }).join(' | ');
    })()`));
    console.log('dy-profile 在场:', await cdp.evalJs("!!document.querySelector('.dy-profile')"));
    console.log('作品卡数:', await cdp.evalJs("document.querySelectorAll('#dyGrid .dy-card').length"));
    console.log('统计行:', await cdp.evalJs("(document.getElementById('dyStats')||{}).textContent"));
    console.log('statsRow 在场:', await cdp.evalJs("!!document.getElementById('statsRow')"));

    // 点击 Guidelines 药丸（无刷新切换）
    await cdp.evalJs(`(function(){
      var a = [].slice.call(document.querySelectorAll('.subnav-pill')).filter(function(p){ return (p.getAttribute('href')||'').indexOf('showTab=guidelines') !== -1; })[0];
      if (a) a.click();
    })()`);
    await sleep(500);
    console.log('切换后 href:', await cdp.evalJs('location.href'));
    console.log('切换后显示:', await cdp.evalJs(`(function(){
      return ['overview','explore','guidelines'].map(function(t){
        var v = document.getElementById('view-' + t);
        return t + ':' + (v.hasAttribute('hidden-view') ? '隐藏' : '显示');
      }).join(' | ');
    })()`));
    console.log('指南标题:', await cdp.evalJs("(document.querySelector('#view-guidelines h1')||{}).textContent"));

    console.log('runtime exceptions:', JSON.stringify(cdp.errs));
    console.log('console errors:', JSON.stringify(cdp.consoleErrs));
  } catch (e) {
    console.log('PROBE ERROR:', e.message);
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
