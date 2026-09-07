// tmp-probe-hub-like.js — v0.2.18.1 线上 hub 点赞动画实探 v2（2026-09-05）
// ① 同步快照抓乐观态（click 后同一任务内立即读，排除 401 回滚竞速）
// ② 直接调 armLikePop 验 CSS 动画机械（绕过 API，只测用户看到的动画）
// ③ 抓 toast + console 错误
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-' + Date.now());
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  send(method, params) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

async function main() {
  const BASE = 'https://mnationworld.com';
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  const errs = [];
  t.on('Runtime.exceptionThrown', p => {
    const d = (p.exceptionDetails.exception && p.exceptionDetails.exception.description) || 'exc';
    errs.push(d);
  });

  await t.send('Page.navigate', { url: BASE + '/pages/community-hub.html' });
  await sleep(1200);
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, at: new Date().toISOString() }));" +
    "localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-000101', name: '探针', avatarUrl: null }));");
  await t.send('Page.reload');
  await sleep(2500);
  for (let i = 0; i < 60; i++) {
    const n = await t.evalJs("document.querySelectorAll('[data-cloud-id]').length");
    if (n >= 1) break;
    await sleep(500);
  }
  const ver = await t.evalJs('window.MN_SITE_VERSION');
  const cardN = await t.evalJs("document.querySelectorAll('[data-cloud-id]').length");
  console.log('版本:', ver, '｜云卡数:', cardN);

  // toast 捕获
  await t.evalJs("window.__toasts = []; if (window.MN_Report && window.MN_Report.toast) { var o = MN_Report.toast.bind(MN_Report); MN_Report.toast = function (m, e) { window.__toasts.push(String(m)); return o(m, e); }; }");

  // ① 点击 + 同任务同步快照（乐观态必现）+ 定时快照
  const clickRes = await t.evalJs("(function () {" +
    " var btn = document.querySelector('[data-cloud-id] [data-like-post]');" +
    " if (!btn) return { missing: true };" +
    " var out = {};" +
    " function snap(tag) { var icon = btn.querySelector('.material-symbols-outlined'); var burst = btn.querySelector('.like-burst');" +
    "   out[tag] = { pressed: btn.getAttribute('aria-pressed'), pop: btn.classList.contains('like-pop')," +
    "   iconAnim: getComputedStyle(icon).animationName, burstDisp: getComputedStyle(burst).display," +
    "   count: btn.querySelector('[data-like-count]').textContent }; }" +
    " snap('before'); btn.click(); snap('t0');" +
    " setTimeout(function(){ snap('t50'); }, 50);" +
    " setTimeout(function(){ snap('t150'); }, 150);" +
    " setTimeout(function(){ snap('t600'); }, 600);" +
    " window.__clickOut = out; return true;" +
    " })()");
  console.log('① 点击执行:', JSON.stringify(clickRes));
  await sleep(900);
  console.log('① 快照序列:', JSON.stringify(await t.evalJs('window.__clickOut')));

  // ② 直接调 armLikePop 验动画机械（绕过 API）
  await sleep(200);
  const armRes = await t.evalJs("(function () {" +
    " var btn = document.querySelector('[data-cloud-id] [data-like-post]');" +
    " if (!btn) return { missing: true };" +
    " btn.setAttribute('aria-pressed', 'true'); btn.classList.add('liked');" +
    " btn.querySelector('.material-symbols-outlined').textContent = 'favorite';" +
    " armLikePop(btn);" +
    " var icon = btn.querySelector('.material-symbols-outlined'); var burst = btn.querySelector('.like-burst');" +
    " return { pop: btn.classList.contains('like-pop')," +
    "   iconAnim: getComputedStyle(icon).animationName," +
    "   burstDisp: getComputedStyle(burst).display," +
    "   burstAnim: getComputedStyle(burst).animationName };" +
    " })()");
  console.log('② 直接 armLikePop 后:', JSON.stringify(armRes));
  await sleep(1200);
  const armAfter = await t.evalJs("(() => { var b = document.querySelector('[data-cloud-id] [data-like-post]');" +
    " var burst = b.querySelector('.like-burst');" +
    " return { pop: b.classList.contains('like-pop'), burstDisp: getComputedStyle(burst).display }; })()");
  console.log('② 1.2s 后摘类:', JSON.stringify(armAfter));

  const toasts = await t.evalJs('window.__toasts.join("|")');
  console.log('toast:', JSON.stringify(toasts));
  console.log('console 错误:', errs.length, errs.slice(0, 3).join(' | '));

  t.close();
  chrome.kill();
  process.exit(0);
}
main().catch(e => { console.error('探针异常:', e.message); process.exit(2); });
