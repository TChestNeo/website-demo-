// tmp-probe-fc-new.js — 验证 FC「新建文章」真正清空（本地+云端草稿不回流、发布 id 作废）
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
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 200));
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
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fcnew-' + Date.now());
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

  // 本地旧草稿 + 发布 id 记忆
  const OLD_LOCAL = { v: 9, title: '旧文章', cards: [{ id: 'c1', type: 'shield', label: '旧', col: 1, row: 1, colSpan: 5, rowSpan: 5, x: 0, y: 0 }], lastSaved: Date.now() };
  const CLOUD = { ok: true, data: { draft: { version: 7, data: { v: 9, title: '云端旧稿', cards: [{ id: 'cc', type: 'shield', label: '云', col: 1, row: 1, colSpan: 5, rowSpan: 5, x: 0, y: 0 }], lastSaved: Date.now() }, updatedAt: new Date(Date.now() + 999999).toISOString() } } };

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
        'localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-000001', displayName: 'T', citizenId: 'USR-000001' })) + ');' +
        'localStorage.setItem("slati_fluidcanvas_draft", ' + JSON.stringify(JSON.stringify(OLD_LOCAL)) + ');' +
        'localStorage.setItem("slati_article_publish_id", "ART-000006");' +
        'var __of3 = window.fetch; var __putCount = 0; var __getCount = 0;' +
        'window.fetch = function (u, o) {' +
        '  if (String(u).indexOf("/drafts/fluidcanvas/main") !== -1) {' +
        '    if (o && String(o.method).toUpperCase() === "PUT") { __putCount++; return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true, data: { draft: { version: 8, data: {} } } }); } }); }' +
        '    __getCount++; return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(' + JSON.stringify(CLOUD) + '); } });' +
        '  }' +
        '  return __of3.apply(this, arguments);' +
        '};' +
        '}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/pages/fluidcanvas-editor.html?new=1' });
    await waitFor(cdp, "!!document.getElementById('titleInput') && !!document.getElementById('gridCanvas')", 30000, '编辑器加载');
    await sleep(2500);

    console.log('新建文章验证:', await cdp.evalJs(`(function(){
      var title = document.getElementById('titleInput').value;
      var cards = document.querySelectorAll('#gridCanvas .grid-card').length;
      var pid = localStorage.getItem('slati_article_publish_id');
      var local = localStorage.getItem('slati_fluidcanvas_draft');
      var putCount = window.__putCount;
      var getCount = window.__getCount;
      var cloudMode = window.fcCloudMode;
      var newSession = window.fcNewSession;
      return { title: title, cardCount: cards, publishIdCleared: pid == null, localDraftAfter: local, cloudPutCount: putCount, cloudGetCount: getCount, fcCloudMode: cloudMode, fcNewSession: newSession };
    })()`));
    console.log('runtime exceptions:', JSON.stringify(cdp.errs));
  } catch (e) {
    console.log('PROBE ERROR:', e.message);
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
