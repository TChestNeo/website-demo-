// tmp-probe-sidebar-name.js — 验证侧栏档案同步（账户名 → 显示名）
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
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-sbname-' + Date.now());
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

  // 本地陈旧记录：displayName = 账户名（邮箱前缀）；服务端真实档案 = 显示名
  const STALE_USER = { id: 'USR-000999', displayName: 'accountname', citizenId: 'USR-000999', avatarUrl: 'https://ui-avatars.com/api/?name=old&background=4648d4&color=fff&size=80' };
  const REAL_USER = { id: 'USR-000999', displayName: '我的显示名', citizenId: 'USR-000999', avatarUrl: 'https://ui-avatars.com/api/?name=new&background=4648d4&color=fff&size=80', email: 'a@b.com' };

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
      source:
        'try{' +
        'localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');' +
        'localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify(STALE_USER)) + ');' +
        'var __of2 = window.fetch;' +
        'window.fetch = function (u, o) {' +
        '  if (String(u).indexOf("/auth/me") !== -1) {' +
        '    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true, data: { user: ' + JSON.stringify(REAL_USER) + ' } }); }, text: function () { return Promise.resolve("{}"); }, headers: { get: function () { return null; } } });' +
        '  }' +
        '  return __of2.apply(this, arguments);' +
        '};' +
        '}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/index.html' });
    await waitFor(cdp, "!!document.querySelector('.sidebar-module .user-name')", 30000, '加载');
    await sleep(2500);

    console.log('侧栏名字:', await cdp.evalJs(`(function(){
      var el = document.querySelector('.sidebar-module .user-name');
      var local = JSON.parse(localStorage.getItem('slati_user') || '{}');
      return {
        shown: el ? el.textContent.trim() : null,
        localStorageNow: local.displayName,
        expected: '我的显示名'
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
