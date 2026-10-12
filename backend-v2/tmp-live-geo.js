// tmp-live-geo.js — 一次性线上几何诊断：故事站首页第一屏到底渲染成什么样（scroll 0 快照）
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CDP_PORT = 5900 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-geo-' + Date.now());

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) {
        const ls = this.listeners.get(m.method);
        if (ls) ls.forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  let chromePath = null;
  for (const p of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {} await sleep(250); }
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  const errs = [];
  t.on('Runtime.exceptionThrown', p => errs.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || 'exc')));
  t.on('Log.entryAdded', p => { if (p.entry.level === 'error' && p.entry.url && p.entry.url.indexOf('fonts') === -1) errs.push(p.entry.text + ' @ ' + p.entry.url); });
  await t.send('Log.enable');

  await t.send('Page.navigate', { url: 'https://story.mnationworld.com/' });
  await sleep(5000);
  const g = await t.evalJs("(() => { var r = function (el) { if (!el) return null; var b = el.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width) }; };" +
    " var main = document.querySelector('main'); var first = main ? main.firstElementChild : null;" +
    " var stage = document.querySelector('.se-stage'); var track = document.querySelector('.se-track');" +
    " var frame = document.querySelector('.se-frame'); var img = document.querySelector('.se-img');" +
    " var title = document.querySelector('.se-title'); var overlay = document.querySelector('.se-overlay');" +
    " return { scrollY: window.scrollY, docH: document.documentElement.scrollHeight, vh: window.innerHeight," +
    " mainFirst: first ? (first.tagName + '.' + first.className + '#' + first.id) : null," +
    " sceneCount: document.querySelectorAll('.scene').length," +
    " stage: r(stage), track: r(track), frame: r(frame), frameClip: frame ? getComputedStyle(frame).clipPath : null," +
    " title: r(title), titleOp: title ? getComputedStyle(title).opacity : null," +
    " titleTc: title ? title.querySelectorAll('.tc').length : 0," +
    " overlay: r(overlay), overlayOp: overlay ? getComputedStyle(overlay).opacity : null," +
    " img: img ? { src: img.getAttribute('src'), complete: img.complete, nw: img.naturalWidth } : null," +
    " seTrackCount: document.querySelectorAll('.se-track').length }; })()");
  console.log(JSON.stringify(g, null, 2));
  console.log('console errs:', errs.length, errs.slice(0, 3).join(' | '));
  t.close();
  chrome.kill();
  process.exit(0);
}
main().catch(e => { console.error('诊断异常:', e.message); process.exit(1); });
