// tmp-probe-fc-paste.js — 验证 FC 编辑器纯文本粘贴（拦掉字体/分割线/白底）
'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path'); const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && this.pending.has(m.id)) { const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); } else if (m.method === 'Runtime.exceptionThrown') { const d = (m.params && m.params.exceptionDetails) || {}; this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 200)); } };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.description || r.exceptionDetails.text)); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); } throw new Error('waitFor 超时: ' + l); }
(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-paste-' + Date.now());
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
    await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/pages/fluidcanvas-editor.html?new=1' });
    await waitFor(cdp, "!!document.getElementById('gridCanvas') && typeof createContentCard !== 'undefined'", 30000, '编辑器加载');
    await sleep(1200);
    // 造一张内容卡 + 模拟粘贴带内联样式的富文本
    console.log('纯文本粘贴验证:', JSON.stringify(await cdp.evalJs(`(function(){
      var card = null;
      try { card = createContentCard ? createContentCard(3, 3, 10, 6) : null; } catch (e) {}
      if (!card) { return { error: 'createContentCard 不可用' }; }
      var ed = card.querySelector('.card-text-content');
      ed.focus();
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(ed); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
      // 构造一个 ClipboardEvent：text/plain 正常文字，text/html 带 junk（字体/hr/白底）
      var dt = new DataTransfer();
      dt.setData('text/plain', '第一行\\n第二行');
      dt.setData('text/html', '<div style="font-family:serif;background:#fff"><hr><b>带样式</b>的文字</div>');
      ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      var html = ed.innerHTML;
      return { html: html, hasStyle: /style=|font-family|<hr|background/.test(html), hasBold: /<b>|<strong>/.test(html), text: ed.textContent };
    })()`)));
    console.log('errors:', JSON.stringify(cdp.errs.slice(0, 3)));
  } catch (e) { console.log('PROBE ERROR:', e.message); }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
