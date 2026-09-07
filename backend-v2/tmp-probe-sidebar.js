// tmp-probe-sidebar.js — 左侧菜单空位 bug 探针（2026-09-03）
// 登录态实测线上侧栏几何：nav-module 子序、玻璃层是否占流、菜单项相对位置
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-sidebar-' + Date.now());
const BASE = process.env.LIVE_BASE || 'https://mnationworld.com';

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
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
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

  // 先落登录态再导航（同电池口径）
  await t.send('Page.navigate', { url: BASE + '/' });
  await sleep(900);
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true }))");
  await t.send('Page.navigate', { url: BASE + '/' });
  await sleep(1500);

  const out = await t.evalJs(`(() => {
    const side = document.querySelector('.app-sidebar');
    const nav = document.querySelector('.nav-module');
    const brand = document.querySelector('.brand-module');
    const user = document.querySelector('.user-module');
    const items = nav ? Array.from(nav.children) : [];
    const kid = (el, cls) => {
      const r = el.getBoundingClientRect();
      return { cls: cls, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom),
        pos: getComputedStyle(el).position, disp: getComputedStyle(el).display };
    };
    const navItem = nav ? nav.querySelector('.nav-item, a, button') : null;
    return {
      guest: document.documentElement.className,
      sidebar: kid(side, 'sidebar'),
      brand: kid(brand, 'brand'),
      user: kid(user, 'user'),
      nav: nav ? { rect: kid(nav, 'nav'), scrollH: nav.scrollHeight, clientH: nav.clientHeight, overflowY: getComputedStyle(nav).overflowY } : null,
      navKids: items.map(el => ({ tag: el.tagName, cls: el.className.slice(0, 50), pos: getComputedStyle(el).position })),
      firstItem: navItem ? kid(navItem, 'firstItem') : null,
      lg: nav ? Array.from(nav.querySelectorAll('.lg-backdrop, .lg-specular')).map(el => kid(el, el.className)) : []
    };
  })()`);
  console.log(JSON.stringify(out, null, 1));
  t.close();
  chrome.kill();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
