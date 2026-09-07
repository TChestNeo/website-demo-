'use strict';
// tmp-probe-login-composer.js — 一次性探针：线上真实登录态路径（不强制 cloudMode）能否自然渲染 composer（tmp 绝不 commit）
// 种 slati_session/slati_user（USR- 开头 id）→ 重载 → 等 initCloudFeed 真实链路（probe → getUser → cloudMode=true）
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const BASE = 'https://mnationworld.com';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function cdp(port) {
  const wsUrl = new Promise((resolve, reject) => {
    const t = setInterval(() => {
      http.get(`http://127.0.0.1:${port}/json/list`, (r) => {
        let b = '';
        r.on('data', (d) => b += d);
        r.on('end', () => {
          try { const p = JSON.parse(b).find((x) => x.type === 'page'); if (p) { clearInterval(t); resolve(p.webSocketDebuggerUrl); } } catch {}
        });
      }).on('error', () => {});
    }, 150);
    setTimeout(() => { clearInterval(t); reject(new Error('CDP 超时')); }, 20000);
  });
  let seq = 0; const pending = new Map();
  const consoleErrors = [];
  let ws;
  async function connect() {
    ws = new WebSocket(await wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') consoleErrors.push(msg.params.entry);
      else if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(msg.params.exceptionDetails);
    };
    send('Log.enable'); send('Runtime.enable'); send('Page.enable');
  }
  function send(method, params = {}) {
    return new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  }
  async function evalJs(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) throw new Error('页面脚本异常: ' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text));
    return r.result.result.value;
  }
  async function waitFor(expression, timeoutMs = 15000, what = expression) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evalJs(expression)) return; } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('等待超时: ' + what);
  }
  async function navigate(url) {
    const loaded = new Promise((resolve) => {
      const onMsg = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); resolve(); }
      };
      ws.addEventListener('message', onMsg);
    });
    await send('Page.navigate', { url });
    await loaded;
  }
  return { connect, send, evalJs, waitFor, navigate, consoleErrors };
}

(async () => {
  const port = 9400 + Math.floor(Math.random() * 300);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--disable-extensions', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(os.tmpdir(), 'probe-login-' + process.pid)}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  const c = cdp(port);
  try {
    await c.connect();
    await c.navigate(BASE + '/pages/community-hub.html');
    // 1) 访客基线：无 composer
    await c.waitFor(`window.MN_SITE_VERSION !== undefined`);
    const guest = await c.evalJs(`document.getElementById('postComposer') === null`);
    console.log('访客态 composer 不存在（基线）:', guest);
    // 2) 种登录态 → 重载 → 真实 initCloudFeed 链路
    await c.evalJs(`(() => {
      localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, at: new Date().toISOString() }));
      localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-BATTERYLOGIN', name: 'BatteryTester', email: 'battery@test.local' }));
      return true;
    })()`);
    await c.navigate(BASE + '/pages/community-hub.html');
    await c.waitFor(`window.MN_SITE_VERSION !== undefined`);
    let composer = null;
    try { await c.waitFor(`document.getElementById('postComposer') !== null`, 12000, '真实链路 composer 渲染'); composer = true; }
    catch (e) { composer = false; }
    const state = await c.evalJs(`(() => {
      const el = document.getElementById('postComposer');
      const btn = document.getElementById('postSubmit');
      return {
        composer: el !== null,
        btn: btn !== null,
        btnText: btn ? btn.innerText : null,
        cloudMode: (typeof cloudMode !== 'undefined') ? cloudMode : 'n/a',
        user: (window.SlatiDB && SlatiDB.getUser()) ? SlatiDB.getUser().id : null,
        isLoggedIn: (window.SlatiDB && SlatiDB.isLoggedIn()) ? SlatiDB.isLoggedIn() : 'n/a'
      };
    })()`);
    console.log('真实登录态链路:', JSON.stringify(state, null, 2));
    console.log('console 错误数:', c.consoleErrors.length);
    if (c.consoleErrors.length) console.log('首条错误:', JSON.stringify(c.consoleErrors[0]).slice(0, 300));
  } finally {
    try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
  }
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
