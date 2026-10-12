// tmp-probe-fc-grpsave.js — 组缩放（v63.0 刚体变换）后保存草稿诊断
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
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
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
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

async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

(async () => {
  const BASE = 'https://mnationworld.com';
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-grpsave-' + Date.now());
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
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!window.createFlagCard && !!window.mergeCards && !!window.selectCard && !!window.buildDraft", 30000, '编辑器加载');
    await sleep(800);

    // 建两张国旗卡 + 合并成组
    const setup = await cdp.evalJs(`(function(){
      try {
        var c1 = createFlagCard('Flag A', 2, 2, 8, 5);
        var c2 = createFlagCard('Flag B', 10, 2, 8, 5);
        mergeCards(c1, c2, 'right');
        selectCard(c1);
        return { ok: true, cards: getAllCards().length, g: c1.dataset.groupId || null };
      } catch (e) { return { ok: false, err: String(e && e.message || e) }; }
    })()`);
    console.log('setup:', JSON.stringify(setup));

    // 找到 se 手柄，合成拖拽
    const drag = await cdp.evalJs(`(function(){
      var se = document.querySelector('.resize-handle[data-dir="se"]');
      if (!se) return { ok: false, err: 'no se handle', handles: document.querySelectorAll('.resize-handle').length };
      var r = se.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      function fire(target, type, x, y) {
        target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true, cancelable: true, view: window }));
      }
      fire(se, 'mousedown', cx, cy);
      fire(document, 'mousemove', cx + 120, cy + 60);
      fire(document, 'mousemove', cx + 121, cy + 61);
      fire(document, 'mouseup', cx + 121, cy + 61);
      return { ok: true, from: { x: cx, y: cy }, to: { x: cx + 121, y: cy + 61 } };
    })()`);
    console.log('drag:', JSON.stringify(drag));
    await sleep(400);

    // 检查卡数据
    const cards = await cdp.evalJs(`(function(){
      return getAllCards().map(function(c){
        return { type: c.dataset.cardType, span: c.dataset.colSpan + 'x' + c.dataset.rowSpan, x: c.dataset.x, y: c.dataset.y, g: c.dataset.groupId || '', w: c.style.width, h: c.style.height, minH: c.style.minHeight };
      });
    })()`);
    console.log('cards after resize:', JSON.stringify(cards));

    // buildDraft + 检查 NaN
    const draftRes = await cdp.evalJs(`(function(){
      try {
        var d = buildDraft();
        var s = JSON.stringify(d);
        return { ok: true, len: s.length, hasNaN: s.indexOf('NaN') !== -1, cards: (d.cards || []).length };
      } catch (e) { return { ok: false, err: String(e && e.stack || e) }; }
    })()`);
    console.log('buildDraft:', JSON.stringify(draftRes));

    // saveDraft
    const saveRes = await cdp.evalJs(`(function(){
      try {
        saveDraft();
        var t = document.getElementById('toast');
        return { ok: true, toast: t ? t.textContent : '' };
      } catch (e) { return { ok: false, err: String(e && e.message || e) }; }
    })()`);
    console.log('saveDraft:', JSON.stringify(saveRes));

    await sleep(500);
    console.log('exceptions:', JSON.stringify(cdp.errs));
    console.log('console errors:', JSON.stringify(cdp.consoleErrs));
  } catch (e) {
    console.log('PROBE ERROR:', e.message);
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
