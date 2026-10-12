// tmp-probe-root-nav.js — 根路径 + iPhone UA + 截图验证底部导航
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
  const USER_DATA = path.join(os.tmpdir(), 'mn-rootnav-' + Date.now());
  let chromePath = null;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe']) if (fs.existsSync(p)) { chromePath = p; break; }
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
    await sleep(3500);
    const r = await cdp.evalJs(`(function(){
      var nav = document.querySelector('.mobile-bottom-nav');
      var cs = nav ? getComputedStyle(nav) : null;
      var rect = nav ? nav.getBoundingClientRect() : null;
      var sheet = getComputedStyle(document.documentElement);
      return {
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
        url: location.href,
        navExists: !!nav,
        display: cs ? cs.display : null,
        position: cs ? cs.position : null,
        bottom: cs ? cs.bottom : null,
        zIndex: cs ? cs.zIndex : null,
        rect: rect ? { top: rect.top, bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right } : null,
        tabs: nav ? nav.querySelectorAll('.mbn-item').length : 0,
        mnGuest: document.documentElement.classList.contains('mn-guest'),
        guestHeroDisplay: (function(){ var g = document.querySelector('.guest-hero'); return g ? getComputedStyle(g).display : null; })(),
        bodyScrollHeight: document.body.scrollHeight,
        sidebarDisplay: (function(){ var s = document.getElementById('slati-sidebar'); return s ? getComputedStyle(s).display : null; })()
      };
    })()`);
    console.log(JSON.stringify(r));
    // 截图
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'tmp-rootnav-shot.png'), Buffer.from(shot.data, 'base64'));
    console.log('截图已保存 tmp-rootnav-shot.png');
  } catch (e) { console.log('ERROR', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => process.exit(0)).catch(e => { console.log('FATAL', e.message); process.exit(1); });
