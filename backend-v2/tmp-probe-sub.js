// tmp-probe-sub.js — 验证「我的」二级子 sheet（语言/显示/辅助功能）
'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path'); const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.description || r.exceptionDetails.text)); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, t) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); } return false; }
(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-sub-' + Date.now());
  let chromePath = null;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe']) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=375,667', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    if (!up) throw new Error('CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-000001', displayName: '测试用户', citizenId: 'USR-000001' })) + ');}catch(e){}' });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/pages/dashboard.html' });
    await waitFor(cdp, "!!document.querySelector('.mobile-bottom-nav')", 25000);
    await sleep(800);
    await cdp.evalJs("document.querySelector('.mobile-bottom-nav .mbn-item:last-child').click()");
    await sleep(400);
    // 点「语言」→ 子 sheet
    await cdp.evalJs("Array.prototype.find.call(document.querySelectorAll('#mbnMeSheet .mbn-row'), function(r){return r.textContent.indexOf('语言')>-1;}).click()");
    await sleep(400);
    const r = await cdp.evalJs(`(function(){
      var sub = document.getElementById('mbnSubSheet');
      var out = {
        subOpen: !!sub,
        subTitle: (sub.querySelector('.mbn-sub-title')||{}).textContent || '',
        subRows: sub ? sub.querySelectorAll('.mbn-sub-row').length : 0,
        langs: sub ? Array.prototype.map.call(sub.querySelectorAll('.mbn-sub-row'), function(e){return e.textContent.trim();}) : []
      };
      return out;
    })()`);
    console.log('语言子sheet:', JSON.stringify(r));
    // 点「显示」子 sheet
    await cdp.evalJs("window._slatiCloseSub()");
    await cdp.evalJs("Array.prototype.find.call(document.querySelectorAll('#mbnMeSheet .mbn-row'), function(r){return r.textContent.indexOf('显示')>-1;}).click()");
    await sleep(300);
    const r2 = await cdp.evalJs(`(function(){
      var sub = document.getElementById('mbnSubSheet');
      return { title: (sub.querySelector('.mbn-sub-title')||{}).textContent || '', secs: sub ? sub.querySelectorAll('.mbn-sub-sec').length : 0, rows: sub ? sub.querySelectorAll('.mbn-sub-row').length : 0 };
    })()`);
    console.log('显示子sheet:', JSON.stringify(r2));
  } catch (e) { console.log('ERROR', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => process.exit(0)).catch(e => { console.log('FATAL', e.message); process.exit(1); });
