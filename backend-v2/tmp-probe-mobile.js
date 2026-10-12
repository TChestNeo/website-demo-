// tmp-probe-mobile.js — 手机端适配盘点：加载一个页面（375×667），报横向溢出 + 溢出元凶
'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path'); const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const URL = process.argv[2];
if (!URL) { console.log('用法: node tmp-probe-mobile.js <url>'); process.exit(1); }

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
  const USER_DATA = path.join(os.tmpdir(), 'mn-mobile-' + Date.now());
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
    await cdp.send('Page.navigate', { url: URL });
    await waitFor(cdp, "document.readyState === 'complete'", 20000);
    await sleep(2500);
    const result = await cdp.evalJs(`(function(){
      var vw = window.innerWidth;
      var sw = document.documentElement.scrollWidth;
      var over = sw > vw + 1;
      var culprits = [];
      if (over) {
        var all = document.querySelectorAll('*');
        var seen = 0;
        for (var i = 0; i < all.length && seen < 8; i++) {
          var el = all[i];
          var r = el.getBoundingClientRect();
          if (r.right > vw + 2 || r.width > vw + 2) {
            var cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0,2).join('.') : '';
            culprits.push((el.tagName.toLowerCase() + (cls ? '.' + cls : '')) + ' w=' + Math.round(r.width) + ' right=' + Math.round(r.right));
            seen++;
          }
        }
      }
      var sb = document.querySelector('.app-sidebar');
      var sbState = sb ? { collapsed: sb.classList.contains('collapsed'), floating: sb.classList.contains('floating'), w: sb.offsetWidth } : null;
      return { url: location.pathname, vw: vw, scrollW: sw, overflow: over, culprits: culprits, sidebar: sbState };
    })()`);
    console.log(JSON.stringify(result));
  } catch (e) { console.log('ERROR', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => process.exit(0)).catch(e => { console.log('FATAL', e.message); process.exit(1); });
