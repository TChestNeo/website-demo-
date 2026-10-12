// tmp-probe-login-mobile.js — 验证手机登录页重设计
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
  const USER_DATA = path.join(os.tmpdir(), 'mn-loginm-' + Date.now());
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    if (!up) throw new Error('CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/signup-and-login' });
    await waitFor(cdp, "document.readyState === 'complete'", 25000);
    await sleep(2500);
    const r = await cdp.evalJs(`(function(){
      var hero = document.querySelector('.auth-mobile-hero');
      var heroCs = hero ? getComputedStyle(hero) : null;
      var panel = document.querySelector('.auth-panel');
      var tabs = document.querySelector('.auth-tabs');
      var card = document.getElementById('authCard');
      var email = document.getElementById('loginEmail');
      var emailBg = email ? getComputedStyle(email).backgroundImage : null;
      var trust = document.querySelector('.amh-trust');
      var steps = document.querySelectorAll('.amh-step').length;
      return {
        heroDisplay: heroCs ? heroCs.display : null,
        heroRadius: heroCs ? heroCs.borderRadius : null,
        heroBg: heroCs ? heroCs.backgroundImage.slice(0, 60) : null,
        panelDisplay: panel ? getComputedStyle(panel).display : null,
        tabsDisplay: tabs ? getComputedStyle(tabs).display : null,
        amhTabs: document.querySelectorAll('.amh-tab').length,
        emailIcon: emailBg ? (emailBg.indexOf('data:image/svg') !== -1 ? '有图标' : '无图标') : null,
        trustVisible: trust ? getComputedStyle(trust).display : null,
        steps: steps,
        cardRadius: card ? getComputedStyle(card).borderRadius : null,
        paneLoginVisible: (function(){ var p = document.querySelector('.auth-pane-login'); return p ? getComputedStyle(p).display : null; })()
      };
    })()`);
    console.log(JSON.stringify(r));
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'tmp-loginm-shot.png'), Buffer.from(shot.data, 'base64'));
    console.log('截图已保存 tmp-loginm-shot.png');
  } catch (e) { console.log('ERROR', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => process.exit(0)).catch(e => { console.log('FATAL', e.message); process.exit(1); });
