'use strict';
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, t) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); } return false; }
(async () => {
  const port = 9900 + Math.floor(Math.random() * 100);
  const ud = path.join(os.tmpdir(), 'mn-nosb-' + Date.now());
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    for (const url of ['https://mnationworld.com/', 'https://mnationworld.com/pages/micronationary']) {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, "document.readyState === 'complete'", 25000);
      await sleep(2500);
      const r = await cdp.evalJs(`(function(){
        var sb = document.getElementById('slati-sidebar');
        var main = document.querySelector('.app-main');
        return {
          url: location.pathname,
          sidebarDisplay: sb ? getComputedStyle(sb).display : 'no-el',
          mainMarginLeft: main ? getComputedStyle(main).marginLeft : null,
          bottomNav: (function(){ var n = document.querySelector('.mobile-bottom-nav'); return n ? getComputedStyle(n).display : 'no-el'; })()
        };
      })()`);
      console.log(JSON.stringify(r));
    }
  } catch (e) { console.log('ERROR', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {} }
})().then(() => process.exit(0));
