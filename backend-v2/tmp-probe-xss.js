// tmp-probe-xss.js — P0-1 回归：恶意消息/名称渲染后只显示文本，零 img/svg/script/onerror 节点
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
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, t) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); } return false; }

(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-xss-' + Date.now());
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  const pageUrl = 'file:///' + path.resolve(__dirname, '..', 'docs', 'pages', 'messages.html').replace(/\\/g, '/');
  try {
    let up = false;
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: pageUrl });
    await waitFor(cdp, "document.readyState === 'complete'", 20000);
    await sleep(2500);

    const r = await cdp.evalJs(`(function(){
      var out = {};
      // 1. 转义函数单测
      out.escapeHtml = typeof msgEscapeHtml === 'function' ? msgEscapeHtml('<img src=x onerror=alert(1)> & "q" \\'s') : 'MISSING';
      out.escapeAttr = typeof msgEscapeAttr === 'function' ? msgEscapeAttr('x\\" onclick=\\"evil()') : 'MISSING';

      function probe(html) {
        var d = document.createElement('div');
        d.innerHTML = html;
        return {
          img: d.querySelectorAll('img').length,
          svg: d.querySelectorAll('svg').length,
          script: d.querySelectorAll('script').length,
          onerror: d.querySelectorAll('[onerror]').length,
          onload: d.querySelectorAll('[onload]').length,
          onclickAttr: d.querySelectorAll('[onclick]').length,
          text: d.textContent
        };
      }

      // 2. msgBubble 恶意正文 + 恶意名称
      if (typeof msgBubble === 'function') {
        var evil = { text: '<img src=x onerror=alert(1)><svg onload=alert(2)>', from: '"><svg onload=alert(3)>', sent: false, _file: null };
        var bubbleHtml = msgBubble(evil, 0, false, 'dm', 'CHAT-000001', false);
        out.bubble = probe(bubbleHtml);
      } else out.bubble = { error: 'msgBubble MISSING' };

      // 3. 转发标签恶意
      if (typeof msgBubble === 'function') {
        var fwd = { text: 'ok', from: 'A', sent: false, _file: null, _forwardedFrom: '<img src=x onerror=alert(4)>' };
        out.fwd = probe(msgBubble(fwd, 0, false, 'dm', 'CHAT-000002', false));
      }

      // 4. 文件名恶意（alt 属性逃逸）
      if (typeof msgBubble === 'function') {
        var file = { text: '', from: 'A', sent: true, _file: { name: 'x" onerror="alert(5)', dataUrl: 'data:image/png;base64,AAAA' } };
        out.fileAlt = probe(msgBubble(file, 0, false, 'dm', 'CHAT-000003', false));
      }
      return out;
    })()`);
    console.log(JSON.stringify(r, null, 1));
    const pass =
      !r.escapeHtml.includes('<img') &&
      r.bubble.img === 0 && r.bubble.svg === 0 && r.bubble.script === 0 &&
      r.bubble.onerror === 0 && r.bubble.onload === 0 &&
      r.bubble.text.includes('<img src=x') &&
      r.fwd.img === 0 && r.fwd.onerror === 0 &&
      r.fileAlt.onerror === 0 && r.fileAlt.img === 1;
    console.log(pass ? 'XSS 回归：PASS' : 'XSS 回归：FAIL');
    process.exitCode = pass ? 0 : 1;
  } catch (e) { console.log('ERROR', e.message); process.exitCode = 1; }
  finally { try { chrome.kill(); } catch (e) {} try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})().then(() => process.exit(process.exitCode || 0));
