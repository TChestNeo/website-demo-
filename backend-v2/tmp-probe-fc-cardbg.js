// tmp-probe-fc-cardbg.js — 查看 FC 首页卡片实际计算背景 + 主题
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') { const d = (m.params && m.params.exceptionDetails) || {}; this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 200)); }
      else if (m.method === 'Page.javascriptDialogOpening') { this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.description || r.exceptionDetails.text)); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); } throw new Error('waitFor 超时: ' + l); }

(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-cbg-' + Date.now());
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
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/pages/fluidcanvas.html' });
    await waitFor(cdp, "!!document.querySelector('.card') || !!document.getElementById('channelOverview')", 30000, '加载');
    await sleep(1500);
    const read = (sel) => cdp.evalJs(`(function(){ var el = document.querySelector('${sel}'); if (!el) return null; var cs = getComputedStyle(el); return { bg: cs.backgroundColor, theme: document.documentElement.getAttribute('data-theme'), accent: document.documentElement.getAttribute('data-accent'), inline: el.style.background || el.getAttribute('style') || '' }; })()`);
    console.log('.card:', JSON.stringify(await read('.card')));
    console.log('#channelOverview:', JSON.stringify(await read('#channelOverview')));
    console.log('.upload-zone:', JSON.stringify(await read('.upload-zone')));
    console.log('.studio-header:', JSON.stringify(await read('.studio-header')));
    console.log('.account-team-wrap:', JSON.stringify(await read('.account-team-wrap')));
    console.log('.account-personal:', JSON.stringify(await read('.account-personal')));
    console.log('.tilt-container:', JSON.stringify(await read('.tilt-container')));
    console.log('body:', JSON.stringify(await read('body')));
    // 检查所有 .card 的背景（确认没有漏网灰色）
    const all = await cdp.evalJs(`(function(){ var out = []; document.querySelectorAll('.card').forEach(function (c, i) { if (i > 8) return; var bg = getComputedStyle(c).backgroundColor; if (bg !== 'rgb(255, 255, 255)') out.push(i + ': ' + bg + ' | inline=' + (c.getAttribute('style') || '').slice(0, 60)); }); return out; })()`);
    console.log('非白卡片:', JSON.stringify(all));
    console.log('errors:', JSON.stringify(cdp.errs.slice(0, 3)));
  } catch (e) { console.log('PROBE ERROR:', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
