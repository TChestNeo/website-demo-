'use strict';
// tmp-probe-composer-h.js — 查 renderFeed 重渲染后 composer 基线 97→99 的 2px 差异来源（tmp 绝不 commit）
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const BASE = process.argv[2] || 'http://127.0.0.1:8000';
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
    send('Runtime.enable'); send('Page.enable');
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
const MEASURE = `(() => {
  const el = document.getElementById('postComposer');
  const cs = getComputedStyle(el);
  return {
    oh: el.offsetHeight, sh: el.scrollHeight, ch: el.clientHeight,
    inlineH: el.style.height, lh: cs.lineHeight, fs: cs.fontSize,
    padT: cs.paddingTop, padB: cs.paddingBottom, border: cs.borderTopWidth,
    boxSizing: cs.boxSizing, ph: el.placeholder, val: JSON.stringify(el.value),
    display: cs.display, position: cs.position, float: cs.float, w: cs.width
  };
})()`;
async function main() {
  const port = 9400 + Math.floor(Math.random() * 300);
  const profile = path.join(os.tmpdir(), `composer-h-probe-${process.pid}`);
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: 'ignore' });
  const client = cdp(port);
  try {
    await client.connect();
    await client.navigate(BASE + '/pages/community-hub.html');
    await client.waitFor(`window.MN_SITE_VERSION !== undefined`, 15000);
    await client.evalJs(`window.cloudMode = true; window.cloudPosts = []; renderFeed(); true`);
    await client.waitFor(`document.getElementById('postComposer') !== null`, 5000);
    const m1 = await client.evalJs(MEASURE);
    console.log('第 1 次渲染:', JSON.stringify(m1));
    await client.evalJs(`renderFeed(); true`);
    const m2 = await client.evalJs(MEASURE);
    console.log('第 2 次渲染:', JSON.stringify(m2));
    // 只换长 placeholder 不动其它，看高度是否跟 placeholder 有关
    await client.evalJs(`document.getElementById('postComposer').placeholder = '同志有什么新消息要分享分享？'; true`);
    const m3 = await client.evalJs(MEASURE);
    console.log('换长 placeholder:', JSON.stringify(m3));
    // 有内容时 scrollHeight 与高度
    await client.evalJs(`(() => { const el = document.getElementById('postComposer'); el.value = 'hi'; el.dispatchEvent(new Event('input')); return true; })()`);
    const m4 = await client.evalJs(MEASURE);
    console.log("输入 'hi' 后:", JSON.stringify(m4));
  } finally {
    try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
  }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
