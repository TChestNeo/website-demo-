// tmp-probe-dl-btn.js — 验证手机首页右上角下载按钮 + 下载页 + APK 直链
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
  const USER_DATA = path.join(os.tmpdir(), 'mn-dlbtn-' + Date.now());
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
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/' });
    await waitFor(cdp, "document.readyState === 'complete'", 25000);
    await sleep(3000);
    const home = await cdp.evalJs(`(function(){
      var b = document.querySelector('.mn-dl-btn');
      var cs = b ? getComputedStyle(b) : null;
      var rect = b ? b.getBoundingClientRect() : null;
      return {
        exists: !!b,
        display: cs ? cs.display : null,
        href: b ? b.getAttribute('href') : null,
        text: b ? b.textContent.trim() : null,
        rect: rect ? { top: rect.top, right: rect.right } : null,
        mnGuest: document.documentElement.classList.contains('mn-guest')
      };
    })()`);
    console.log('首页按钮:', JSON.stringify(home));

    // 下载页
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/pages/download.html' });
    await waitFor(cdp, "document.readyState === 'complete'", 25000);
    await sleep(2000);
    const dl = await cdp.evalJs(`(function(){
      var apk = document.querySelector('a[href*="MNationWorld.apk"]');
      var btn = document.querySelector('.mn-dl-btn');
      return {
        title: document.title,
        apkLink: apk ? apk.getAttribute('href') : null,
        apkVisible: apk ? getComputedStyle(apk).display : null,
        dlBtnDisplay: btn ? getComputedStyle(btn).display : null
      };
    })()`);
    console.log('下载页:', JSON.stringify(dl));
  } catch (e) { console.log('ERROR', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => process.exit(0)).catch(e => { console.log('FATAL', e.message); process.exit(1); });
