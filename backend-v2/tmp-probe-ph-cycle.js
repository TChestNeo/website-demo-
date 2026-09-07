'use strict';
// tmp-probe-ph-cycle.js — v0.2.15.7 前置探针：真实 initCloudFeed 路径（假 USR- 用户 + 公众 API 真帖子）
// 观察 placeholder 轮播在真实场景（60s 自动刷新/打字清空/切 tab）下是否持续走动。
// 只输出时间线（placeholder 变化 + /api 网络 + 异常），tmp 绝不 commit。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const BASE = 'https://mnationworld.com';
const CHROME = (function () {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('未找到 Chrome/Edge');
})();
const PORT = 9339;
const UDD = path.join(os.tmpdir(), 'mn-probe-ph-' + Date.now());

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + UDD,
  '--window-size=1440,1000', '--hide-scrollbars', 'about:blank'
], { stdio: 'ignore' });

function cdpConn() {
  return new Promise((resolve, reject) => {
    const tries = setInterval(() => {
      http.get(`http://127.0.0.1:${PORT}/json/list`, (r) => {
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
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  let seq = 0;
  const pending = new Map();
  const errors = [];
  const net = [];
  const ws = new WebSocket(await cdpConn());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WS 失败')); });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push('console: ' + msg.params.entry.text);
    else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push('exception: ' + (d.exception && d.exception.description || d.text));
    } else if (msg.method === 'Network.requestWillBeSent' && String(msg.params.request.url).indexOf('/api/') !== -1) {
      net.push(msg.params.request.url.replace('https://mnationworld.com', ''));
    }
  };
  function send(method, params) {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((res) => pending.set(id, res));
  }
  async function evalJs(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result && r.result.result) return r.result.result.value;
    return undefined;
  }

  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  // 页面脚本跑之前注入假 USR- 用户（cloudMode 判定只看 id 前缀）
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-PROBE-1', name: 'Probe' })); } catch (e) {}`
  });
  const t0 = Date.now();
  await send('Page.navigate', { url: BASE + '/pages/community-hub' });
  await sleep(6000); // 等 probe + fetch + renderFeed 落定

  let lastPh = null; let lastNetCount = 0;
  const marks = [];
  function mark(s) { marks.push(((Date.now() - t0) / 1000).toFixed(1) + 's ' + s); }

  for (let i = 0; i < 160; i++) { // ~80s
    const st = await evalJs(`(() => {
      var b = document.getElementById('postComposer');
      return b ? { ph: b.placeholder, val: b.value, tab: document.querySelector('#communitySubnav .subnav-pill.active') ? document.querySelector('#communitySubnav .subnav-pill.active').dataset.tab : null } : null;
    })()`);
    if (st && st.ph !== lastPh) { mark('placeholder → ' + st.ph + (st.val ? '（框内有内容）' : '')); lastPh = st.ph; }
    else if (!st && lastPh !== null) { mark('composer 消失'); lastPh = null; }
    else if (st && lastPh === null) { mark('composer 出现 · ' + st.ph + ' · tab=' + st.tab); lastPh = st.ph; }
    while (net.length > lastNetCount) { mark('[api] ' + net[lastNetCount]); lastNetCount++; }
    // 场景注入
    if (i === 44 && st) { // ~22s：模拟打字 → 清空
      await evalJs(`(() => { var b = document.getElementById('postComposer'); b.value = '测试内容'; b.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      mark('场景：写入「测试内容」');
      await sleep(1500);
      await evalJs(`(() => { var b = document.getElementById('postComposer'); b.value = ''; b.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      mark('场景：清空输入框');
    }
    if (i === 90 && st) { // ~45s：切 Following 再切回 Recommend
      await evalJs(`document.querySelector('#communitySubnav .subnav-pill[data-tab="following"]').click(); true`);
      mark('场景：切到 Following');
      await sleep(2000);
      await evalJs(`document.querySelector('#communitySubnav .subnav-pill[data-tab="recommend"]').click(); true`);
      mark('场景：切回 Recommend');
    }
    await sleep(500);
  }

  const final = await evalJs(`(() => {
    var b = document.getElementById('postComposer');
    return b ? { ph: b.placeholder } : { none: true };
  })()`);
  mark('结束 · 最终 placeholder = ' + (final.ph || '(无 composer)'));
  if (errors.length) { mark('—— 页面错误 ——'); errors.forEach((e) => mark(e)); }
  else mark('—— 全程 0 console error / exception ——');
  console.log(marks.join('\n'));
  ws.close();
  chrome.kill();
  fs.rmSync(UDD, { recursive: true, force: true });
})().catch((e) => { console.error('PROBE FAIL: ' + e.message); try { chrome.kill(); fs.rmSync(UDD, { recursive: true, force: true }); } catch {} process.exit(1); });
