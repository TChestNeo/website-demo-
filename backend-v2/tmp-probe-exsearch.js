// tmp-probe-exsearch.js — 诊断 explore.html 文章搜索下拉点击无法跳转
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
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-exsearch-' + Date.now());
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
    await cdp.send('Page.navigate', { url: BASE + '/pages/explore.html' });
    await waitFor(cdp, "!!document.getElementById('exSearchInput')", 30000, 'explore 加载');
    await sleep(1200);

    console.log('href:', await cdp.evalJs('location.href'));
    console.log('dy-profile:', await cdp.evalJs("!!document.querySelector('.dy-profile')"));
    console.log('dy-tabs:', await cdp.evalJs("document.querySelectorAll('#dyTabs .dy-tab').length"));
    console.log('dy-grid cards:', await cdp.evalJs("document.querySelectorAll('#dyGrid .dy-card').length"));
    console.log('dy-name:', await cdp.evalJs("(document.getElementById('dyName')||{}).textContent"));
    console.log('dy-stats:', await cdp.evalJs("(document.getElementById('dyStats')||{}).textContent"));
    console.log('MN_API:', await cdp.evalJs('typeof window.MN_API'));

    // 输入触发搜索
    await cdp.evalJs(`(function(){
      var i = document.getElementById('exSearchInput');
      i.focus();
      i.value = '白森';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(2000);

    const panelInfo = await cdp.evalJs(`(function(){
      var p = document.getElementById('exSearchPanel');
      var items = p.querySelectorAll('a.dash-search-item');
      var first = items[0];
      if (!first) return { display: p.style.display, count: items.length, html: p.innerHTML.slice(0, 200) };
      var r = first.getBoundingClientRect();
      var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        display: p.style.display, count: items.length,
        firstHref: first.getAttribute('href'),
        firstText: (first.textContent || '').slice(0, 40),
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        coveredBy: el ? (el.tagName + '.' + String(el.className).slice(0, 80) + ' :: ' + (el.textContent || '').slice(0, 30)) : 'none'
      };
    })()`);
    console.log('panel:', JSON.stringify(panelInfo, null, 1));

    console.log('exArticleResults:', await cdp.evalJs("(function(){var e=document.getElementById('exArticleResults');return e ? {display:e.style.display, items:e.querySelectorAll('a').length, text:(e.textContent||'').slice(0,60)} : 'missing';})()"));
    console.log('搜索列表态:', await cdp.evalJs("(function(){var g=document.getElementById('dyGrid');return g ? g.className : 'missing';})()"));

    // 直接点击第一项
    const clickInfo = await cdp.evalJs(`(function(){
      var p = document.getElementById('exSearchPanel');
      var a = p.querySelector('a.dash-search-item');
      if (!a) return { clicked: false };
      var r = a.getBoundingClientRect();
      var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      var cover = el ? (el.tagName + '.' + String(el.className).slice(0, 80) + ' :: ' + (el.textContent || '').slice(0, 30)) : 'none';
      a.click();
      return { clicked: true, href: a.getAttribute('href'), coveredBy: cover };
    })()`);
    console.log('click:', JSON.stringify(clickInfo));
    await sleep(800);
    console.log('after-click href:', await cdp.evalJs('location.href'));

    console.log('runtime exceptions:', JSON.stringify(cdp.errs));
    console.log('console errors:', JSON.stringify(cdp.consoleErrs));
  } catch (e) {
    console.log('PROBE ERROR:', e.message);
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
