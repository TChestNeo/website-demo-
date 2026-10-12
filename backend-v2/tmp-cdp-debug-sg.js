'use strict';
// tmp-cdp-debug-sg.js — 复现 premium-multi 电池 en-SG 卡点：抓 SlatiPrice / 页面异常 / console 错误（tmp 绝不 commit）
const http = require('node:http');
const { spawn } = require('node:child_process');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9521 + Math.floor(Math.random() * 100);
const os = require('node:os');
const path = require('node:path');

function wsUrl() {
  return new Promise((resolve, reject) => {
    const tries = setInterval(() => {
      http.get(`http://127.0.0.1:${PORT}/json/list`, (r) => {
        let b = '';
        r.on('data', d => b += d);
        r.on('end', () => {
          try {
            const list = JSON.parse(b);
            const page = list.find(t => t.type === 'page');
            if (page) { clearInterval(tries); resolve(page.webSocketDebuggerUrl); }
          } catch {}
        });
      }).on('error', () => {});
    }, 150);
    setTimeout(() => { clearInterval(tries); reject(new Error('CDP timeout')); }, 20000);
  });
}

(async () => {
  const profile = path.join(os.tmpdir(), `sg-debug-${process.pid}`);
  const chrome = spawn(CHROME, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--disable-extensions',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  const ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); });
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + ((msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description) || msg.params.exceptionDetails.text));
    else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push('LOG: ' + msg.params.entry.text + ' @ ' + (msg.params.entry.url || ''));
  };
  function send(method, params = {}) {
    return new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  }
  send('Log.enable'); send('Runtime.enable'); send('Page.enable');
  const r1 = await send('Emulation.setLocaleOverride', { locale: 'en-SG' });
  const r2 = await send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Singapore' });
  const loaded = new Promise((resolve) => {
    const onMsg = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); resolve(); }
    };
    ws.addEventListener('message', onMsg);
  });
  await send('Page.navigate', { url: 'http://127.0.0.1:8901/pages/premium.html' });
  await loaded;
  await new Promise(r => setTimeout(r, 2500));
  const r3 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({ sp: window.SlatiPrice, nav: navigator.language, tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || ''), lang: document.documentElement.lang, hasI18n: !!window.MN_I18N, subStatus: (document.getElementById('subStatus')||{}).innerText || '' })`,
    returnByValue: true
  });
  console.log('page state:', r3.result.result.value);
  console.log('page errors:');
  errors.forEach(e => console.log('  ', e.slice(0, 300)));
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
