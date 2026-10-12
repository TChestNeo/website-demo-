// tmp-probe-me-sheet.js — 验证「我的」sheet 完整设置中心结构
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
  const USER_DATA = path.join(os.tmpdir(), 'mn-mesheet-' + Date.now());
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-000001', displayName: '测试用户', citizenId: 'USR-000001', tier: 'premium' })) + ');}catch(e){}' });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/pages/dashboard.html' });
    await waitFor(cdp, "!!document.querySelector('.mobile-bottom-nav')", 25000);
    await sleep(800);
    // 点「我的」打开 sheet
    await cdp.evalJs("document.querySelector('.mobile-bottom-nav .mbn-item:last-child').click()");
    await sleep(400);
    const r = await cdp.evalJs(`(function(){
      var s = document.getElementById('mbnMeSheet');
      var out = {
        tabCount: document.querySelectorAll('.mobile-bottom-nav .mbn-item').length,
        userCard: !!s.querySelector('.mbn-user-card'),
        userName: (s.querySelector('.mbn-user-name')||{}).textContent || '',
        groups: s.querySelectorAll('.mbn-group').length,
        groupNames: Array.prototype.map.call(s.querySelectorAll('.mbn-group-name'), function(e){return e.textContent;}),
        rows: s.querySelectorAll('.mbn-row').length,
        toggles: s.querySelectorAll('.mbn-switch').length,
        danger: !!s.querySelector('.mbn-danger'),
        dangerLabel: (s.querySelector('.mbn-danger .mbn-row-label')||{}).textContent || '',
        hasHelp: !!s.querySelector('a.mbn-row[href*="help"]'),
        sheetScrollable: s.scrollHeight > s.clientHeight,
        sheetMaxH: getComputedStyle(s).maxHeight
      };
      // 测开关切换
      var sw = s.querySelector('.mbn-switch');
      if (sw) { sw.closest('[data-mbn-toggle]').click(); out.toggleOnAfterClick = sw.getAttribute('data-on'); }
      return out;
    })()`);
    console.log(JSON.stringify(r, null, 0));
  } catch (e) { console.log('ERROR', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => process.exit(0)).catch(e => { console.log('FATAL', e.message); process.exit(1); });
