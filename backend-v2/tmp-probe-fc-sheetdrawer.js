// tmp-probe-fc-sheetdrawer.js — 验证表格样式独立抽屉是否渲染出选项
'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path'); const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && this.pending.has(m.id)) { const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); } else if (m.method === 'Runtime.exceptionThrown') { const d = (m.params && m.params.exceptionDetails) || {}; this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300)); } };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.description || r.exceptionDetails.text)); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); } throw new Error('waitFor 超时: ' + l); }
(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-sheetdrawer-' + Date.now());
  let chromePath = null;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe']) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    if (!up) throw new Error('CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-000001', displayName: 'T', citizenId: 'USR-000001' })) + ');}catch(e){}' });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/pages/fluidcanvas-editor.html?new=1' });
    await waitFor(cdp, "!!document.getElementById('gridCanvas') && typeof createSheetCard !== 'undefined'", 30000, '编辑器加载');
    await sleep(1200);
    console.log('表格样式抽屉验证:', JSON.stringify(await cdp.evalJs(`(function(){
      var out = {};
      try {
        var card = createSheetCard(5, 5, 10, 7);
        out.cardCreated = !!card;
        out.cardType = card.dataset.cardType;
        try { selectCard(card, true); } catch (e) { out.selectErr = String(e.message); }
        try { openSheetDrawer(); } catch (e) { out.openErr = String(e.stack || e.message); }
        var d = document.getElementById('fcSheetDrawer');
        out.drawerOpen = d ? d.classList.contains('open') : false;
        var opts = document.getElementById('sheetStyleOptions');
        out.optCount = opts ? opts.querySelectorAll('.sc-opt').length : -1;
        out.optHtml = opts ? opts.innerHTML.slice(0, 400) : null;
      } catch (e) { out.err = String(e.stack || e.message); }
      return out;
    })()`)));
    console.log('errors:', JSON.stringify(cdp.errs.slice(0, 3)));
  } catch (e) { console.log('PROBE ERROR:', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
