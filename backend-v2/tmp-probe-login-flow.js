// tmp-probe-login-flow.js — 实测登录流程（手机尺寸 + console 错误捕获）
'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path'); const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.events = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method === 'Runtime.consoleAPICalled') { this.events.push('[console.' + m.params.type + '] ' + (m.params.args || []).map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' ')); }
      else if (m.method === 'Runtime.exceptionThrown') { this.events.push('[exception] ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text)); }
      else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') { this.events.push('[log.error] ' + m.params.entry.text); }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.description || r.exceptionDetails.text)); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, t) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); } return false; }
(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-loginflw-' + Date.now());
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/signup-and-login' });
    await waitFor(cdp, "document.readyState === 'complete'", 25000);
    await sleep(3000);

    // 1. 页面结构
    const struct = await cdp.evalJs(`(function(){
      return {
        loginEmail: !!document.getElementById('loginEmail'),
        loginSendBtn: !!document.getElementById('loginSendBtn'),
        loginCodeGroup: !!document.getElementById('loginCodeGroup'),
        loginBtn: (function(){ var b = document.querySelector('#loginForm button.btn-primary.btn-lg'); return b ? b.textContent.trim() : null; })(),
        terms: !!document.getElementById('termsAgree'),
        mnGuest: document.documentElement.classList.contains('mn-guest'),
        authApi: typeof AUTH_API,
        mnApi: typeof MN_API
      };
    })()`);
    console.log('结构:', JSON.stringify(struct));

    // 2. 填邮箱 + 点 Send Code（登录流程第一步）
    await cdp.evalJs(`(function(){
      var e = document.getElementById('loginEmail');
      e.value = 'probe-test@example.com';
      e.dispatchEvent(new Event('input', { bubbles: true }));
      return 'filled';
    })()`);
    await sleep(300);
    await cdp.evalJs(`document.getElementById('loginSendBtn').click(); 'clicked'`);
    await sleep(4000);
    const afterSend = await cdp.evalJs(`(function(){
      return {
        codeGroupDisplay: document.getElementById('loginCodeGroup') ? getComputedStyle(document.getElementById('loginCodeGroup')).display : null,
        codeHint: document.getElementById('loginCodeHint') ? document.getElementById('loginCodeHint').textContent : null,
        loginError: document.getElementById('loginError') ? (getComputedStyle(document.getElementById('loginError')).display + ' | ' + document.getElementById('loginError').textContent) : null,
        otpCells: document.querySelectorAll('#loginOtp .otp-cell').length
      };
    })()`);
    console.log('发码后:', JSON.stringify(afterSend));

    // 3. console 错误
    console.log('=== console 事件 ===');
    cdp.events.slice(-15).forEach(e => console.log(e));
    if (cdp.events.length === 0) console.log('(无错误事件)');
  } catch (e) { console.log('ERROR', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => process.exit(0)).catch(e => { console.log('FATAL', e.message); process.exit(1); });
