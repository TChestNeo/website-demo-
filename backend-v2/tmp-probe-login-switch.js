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
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + r.exceptionDetails.text); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, t) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); } return false; }
(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-loginsw-' + Date.now());
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/signup-and-login' });
    await waitFor(cdp, "document.readyState === 'complete'", 25000);
    await sleep(2500);
    const before = await cdp.evalJs(`(function(){
      return { cardClass: document.getElementById('authCard').className, amhLoginActive: document.getElementById('amhTabLogin').classList.contains('active') };
    })()`);
    // 点 Sign up（hero tab）
    await cdp.evalJs(`document.getElementById('amhTabSignup').click(); 'ok'`);
    await sleep(800);
    const after = await cdp.evalJs(`(function(){
      return {
        cardClass: document.getElementById('authCard').className,
        amhSignupActive: document.getElementById('amhTabSignup').classList.contains('active'),
        amhLoginActive: document.getElementById('amhTabLogin').classList.contains('active'),
        signupPaneDisplay: getComputedStyle(document.querySelector('.auth-pane-signup')).display,
        loginPaneDisplay: getComputedStyle(document.querySelector('.auth-pane-login')).display
      };
    })()`);
    console.log('切换前:', JSON.stringify(before));
    console.log('切换后:', JSON.stringify(after));
  } catch (e) { console.log('ERROR', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => process.exit(0));
