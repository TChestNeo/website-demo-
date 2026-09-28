// tmp-diag-p1.js — P1 诊断：CDP 导航 live 资料页后 20s 转储页面状态+控制台
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const SITE = 'https://mnationworld.com';
const CDP_PORT = 5980 + Math.floor(Math.random() * 10);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-diag-' + Date.now());
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
        const d = m.exceptionDetails || {};
        this.errs.push('EXC: ' + JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 300));
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        this.errs.push('LOG: ' + JSON.stringify({ text: m.params.entry.text, url: m.params.entry.url || '' }).slice(0, 300));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        this.errs.push('CON: ' + JSON.stringify(m.params.args.map(a => a.value || a.description || '').join(' ')).slice(0, 300));
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

(async () => {
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  console.log('chrome up:', up);
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const pageTab = pages.find(x => x.type === 'page');
  const cdp = new CDP(pageTab.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
  await cdp.send('Page.navigate', { url: SITE + '/pages/community-profile.html' });
  await sleep(20000);
  const state = await cdp.evalJs(`(function(){
    var gh = document.querySelector('.guest-hero');
    var mn = document.querySelector('.mn-guest');
    var bn = document.querySelector('.profile-banner');
    return {
      ready: document.readyState,
      title: document.title,
      url: location.href,
      txtLen: document.body ? document.body.textContent.length : -1,
      gh: gh ? { exists: true, display: getComputedStyle(gh).display, vis: getComputedStyle(gh).visibility, cls: gh.className } : { exists: false },
      mnGuestOnBody: document.body ? document.body.className.indexOf('mn-guest') >= 0 : false,
      banner: !!bn,
      hasSession: (function(){ try { return localStorage.getItem('slati_session') || 'NULL'; } catch(e){ return 'ERR:'+e.message; } })()
    };
  })()`);
  console.log('STATE:', JSON.stringify(state, null, 2));
  console.log('ERRORS (' + cdp.errs.length + '):');
  cdp.errs.slice(0, 20).forEach(e => console.log('  ' + e));
  cdp.close();
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
})();
