'use strict';
// tmp-probe-stale.js — 查电池 Chrome 为何读到旧 site-config/旧 CSS（tmp 绝不 commit）
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function cdp(port) {
  const wsUrl = new Promise((resolve, reject) => {
    const tries = setInterval(() => {
      http.get(`http://127.0.0.1:${port}/json/list`, (r) => {
        let b = '';
        r.on('data', (d) => b += d);
        r.on('end', () => {
          try {
            const list = JSON.parse(b);
            const page = list.find((t) => t.type === 'page');
            if (page) { clearInterval(tries); resolve(page.webSocketDebuggerUrl); }
          } catch {}
        });
      }).on('error', () => {});
    }, 150);
    setTimeout(() => { clearInterval(tries); reject(new Error('CDP 超时')); }, 20000);
  });
  let seq = 0;
  const pending = new Map();
  let ws;
  async function connect() {
    ws = new WebSocket(await wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    };
    send('Runtime.enable'); send('Page.enable'); send('Network.enable');
  }
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evalJs(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) throw new Error('页面脚本异常: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
    return r.result.result.value;
  }
  async function waitFor(expression, timeoutMs = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evalJs(expression)) return; } catch {}
      await new Promise((r) => setTimeout(r, 120));
    }
    throw new Error('等待超时: ' + expression);
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
  return { connect, send, evalJs, waitFor, navigate };
}

async function main() {
  const port = 9400 + Math.floor(Math.random() * 300);
  const profile = path.join(os.tmpdir(), `stale-probe-${process.pid}`);
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: 'ignore' });
  const client = cdp(port);
  try {
    await client.connect();
    await client.navigate('http://127.0.0.1:8000/pages/community-hub.html');
    await client.waitFor(`window.MN_SITE_VERSION !== undefined`, 15000);
    console.log('浏览器读到的版本:', await client.evalJs(`window.MN_SITE_VERSION`));
    console.log('页面 style 含 scale(1.25):', await client.evalJs(
      `Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('').indexOf('scale(1.25)') !== -1`));
    console.log('site-config 来源 URL 列表:');
    console.log(JSON.stringify(await client.evalJs(
      `performance.getEntriesByType('resource').filter((e) => e.name.indexOf('site-config') !== -1).map((e) => ({ name: e.name, size: e.transferSize }))`)));
  } finally {
    try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
  }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
