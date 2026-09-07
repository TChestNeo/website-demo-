'use strict';
// tmp-probe-tool-size.js — 一次性探针：工具钮与 Post 钮真实几何（tmp 绝不 commit）
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const BASE = 'http://127.0.0.1:8000';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const port = 9500 + Math.floor(Math.random() * 100);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(os.tmpdir(), 'tsz-' + process.pid)}`,
    '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  const wsUrl = new Promise((res, rej) => {
    const t = setInterval(() => {
      http.get(`http://127.0.0.1:${port}/json/list`, (r) => {
        let b = ''; r.on('data', (d) => b += d);
        r.on('end', () => {
          try { const p = JSON.parse(b).find((x) => x.type === 'page'); if (p) { clearInterval(t); res(p.webSocketDebuggerUrl); } } catch {}
        });
      }).on('error', () => {});
    }, 150);
    setTimeout(() => { clearInterval(t); rej(new Error('CDP 超时')); }, 15000);
  });
  const ws = new WebSocket(await wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pend = new Map();
  ws.onmessage = (m) => { const g = JSON.parse(m.data); if (g.id && pend.has(g.id)) { pend.get(g.id)(g); pend.delete(g.id); } };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then((r) => r.result.result.value);
  await send('Page.navigate', { url: BASE + '/pages/community-hub.html' });
  await new Promise((r) => setTimeout(r, 3000));
  await ev('window.cloudMode = true; window.cloudPosts = []; renderFeed(); true');
  await new Promise((r) => setTimeout(r, 300));
  const out = await ev(`(() => {
    const t = document.querySelector('.composer-tool');
    const p = document.getElementById('postSubmit');
    const tr = t.getBoundingClientRect(); const pr = p.getBoundingClientRect();
    const tc = getComputedStyle(t); const pc = getComputedStyle(p);
    const icon = t.querySelector('.material-symbols-outlined');
    return {
      tool: { w: tr.width, h: tr.height, top: tr.top },
      post: { w: pr.width, h: pr.height, top: pr.top, fs: pc.fontSize, pad: pc.padding, lh: pc.lineHeight, box: pc.boxSizing, border: pc.borderTopWidth },
      iconFs: getComputedStyle(icon).fontSize
    };
  })()`);
  console.log(JSON.stringify(out, null, 2));
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
