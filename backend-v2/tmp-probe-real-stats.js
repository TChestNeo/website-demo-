// tmp-probe-real-stats.js — 验证真实文章 ART-000006 数据卡/表格卡几何
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
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
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
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-rs-' + Date.now());
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
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/pages/article.html?id=ART-000006' });
    await waitFor(cdp, "!!document.querySelector('#artBody .art-canvas')", 30000, '文章加载');
    await sleep(1200);

    console.log('真实文章几何:', await cdp.evalJs(`(function(){
      var canvas = document.querySelector('#artBody .art-canvas');
      var stats = canvas.querySelector('.art-card-stats');
      var sheet = canvas.querySelector('.art-card-sheet');
      function r(el){ var b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; }
      var pie = stats ? stats.querySelector('.art-chart-pie') : null;
      var legend = stats ? stats.querySelector('.art-chart-legend-row') : null;
      var body = stats ? stats.querySelector('.art-stats-body') : null;
      return {
        statsCard: stats ? r(stats) : null,
        statsBody: body ? r(body) : null,
        pie: pie ? r(pie) : null,
        pieLegend: legend ? legend.querySelectorAll('.art-chart-legend').length : 0,
        fillRatio: pie && stats ? Math.round((pie.getBoundingClientRect().height / stats.getBoundingClientRect().height) * 100) + '%' : 'n/a',
        sheetCard: sheet ? r(sheet) : null,
        sheetTable: sheet && sheet.querySelector('.art-sheet-table') ? r(sheet.querySelector('.art-sheet-table')) : null,
        sheetTh: sheet ? sheet.querySelectorAll('th').length : 0,
        sheetTd: sheet ? sheet.querySelectorAll('td').length : 0
      };
    })()`));
    console.log('runtime exceptions:', JSON.stringify(cdp.errs));
  } catch (e) {
    console.log('PROBE ERROR:', e.message);
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
