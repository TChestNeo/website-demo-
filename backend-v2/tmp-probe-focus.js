'use strict';
// tmp-probe-focus.js — 一次性探针：composer :focus 为何不匹配（tmp 绝不 commit）
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const BASE = 'http://127.0.0.1:8000';
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
  let ws;
  async function connect() {
    ws = new WebSocket(await wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
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
  async function waitFor(expression, timeoutMs = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evalJs(expression)) return; } catch {}
      await new Promise((r) => setTimeout(r, 120));
    }
    throw new Error('等待超时: ' + expression);
  }
  return { connect, evalJs, waitFor, send };
}

(async () => {
  const port = 9400 + Math.floor(Math.random() * 300);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--disable-extensions', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(os.tmpdir(), 'probe-focus-' + process.pid)}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  const c = cdp(port);
  try {
    await c.connect();
    await c.send('Page.navigate', { url: BASE + '/pages/community-hub.html' });
    await c.waitFor(`window.MN_SITE_VERSION !== undefined`);
    await c.evalJs(`window.cloudMode = true; window.cloudPosts = []; renderFeed(); true`);
    await c.waitFor(`document.getElementById('postComposer') !== null`, 5000);
    const r = await c.evalJs(`(() => {
      const el = document.getElementById('postComposer');
      const cap = document.querySelector('.search-capsule');
      const capInput = cap.querySelector('input');
      el.style.transition = 'none'; cap.style.transition = 'none';
      const out = {};
      // A) 先 textarea
      el.focus();
      out.textareaFirst = {
        hasFocus: document.hasFocus(), matches: el.matches(':focus'),
        border: getComputedStyle(el).borderColor
      };
      el.blur();
      // B) 先 input
      capInput.focus();
      out.inputFirst = {
        hasFocus: document.hasFocus(), matches: capInput.matches(':focus'),
        capBorder: getComputedStyle(cap).borderColor
      };
      capInput.blur();
      // C) textarea + window.focus() 补救
      el.focus(); window.focus();
      out.textareaWindowFocus = {
        hasFocus: document.hasFocus(), matches: el.matches(':focus'),
        border: getComputedStyle(el).borderColor, shadow: getComputedStyle(el).boxShadow,
        bg: getComputedStyle(el).backgroundColor
      };
      el.blur();
      return out;
    })()`);
    console.log(JSON.stringify(r, null, 2));
  } finally {
    try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
  }
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
