// tmp-probe-grids.js — 检测 375px 下挤压的多列布局与过小字号
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
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.text || '')); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, t) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(120); } return false; }

const pages = [
  'pages/activity.html', 'pages/overview.html', 'pages/micronationary.html',
  'pages/premium.html', 'pages/community-hub.html', 'pages/community-profile.html',
  'pages/following.html', 'pages/dashboard.html', 'pages/index.html',
  'pages/plugins.html', 'pages/fluidcanvas.html', 'pages/help.html',
  'pages/explore.html', 'pages/messages.html', 'pages/article.html',
  'pages/registry-step-3.html', 'pages/onboarding-identity.html', 'pages/about.html',
  'pages/create-world.html', 'pages/error-codes.html', 'pages/guidelines.html',
  'pages/ticket.html', 'pages/workspace.html', 'pages/editor.html',
  'pages/world-wizard.html', 'pages/badge.html', 'pages/construction.html',
  'pages/create-topic-step-1.html', 'pages/create-topic-step-2.html', 'pages/create-topic-step-3.html',
  'pages/registry-step-1.html', 'pages/registry-step-2.html',
  'pages/community-rules.html', 'pages/financial-terms.html', 'pages/platform-responsibility.html',
  'pages/privacy.html', 'pages/terms.html', 'pages/plugin-guide.html',
  'pages/sovereignty-ratified.html', 'pages/world-created.html', 'pages/transitioning.html',
  'pages/onboarding-complete.html', 'pages/edge-themes-demo.html',
];

(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-grids-' + Date.now());
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    const pages0 = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const cdp = new CDP(pages0.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });

    for (const p of pages) {
      try {
        await cdp.send('Page.navigate', { url: 'https://mnationworld.com/' + p });
        await waitFor(cdp, "document.readyState === 'complete'", 15000);
        await sleep(900);
        const r = await cdp.evalJs(`(function(){
          var vw = 375;
          // 多列挤压：grid 容器 >2 列且每列 <100px，或 flex 子项 >3 个
          var squeezed = [];
          document.querySelectorAll('div, section, ul').forEach(function(el){
            var cs = getComputedStyle(el);
            if (cs.display !== 'grid' && cs.display !== 'flex') return;
            var w = el.getBoundingClientRect().width;
            if (w < 100) return;
            var kids = Array.from(el.children).filter(function(k){ return getComputedStyle(k).display !== 'none'; });
            if (kids.length < 3) return;
            var n;
            if (cs.display === 'grid') {
              n = cs.gridTemplateColumns.split(' ').length;
            } else {
              // flex 横排子项数
              var rowCount = kids.filter(function(k){
                var kr = k.getBoundingClientRect();
                return kr.top < el.getBoundingClientRect().top + kr.height + 2;
              }).length;
              n = rowCount;
            }
            if (n > 2) {
              var perCol = Math.round(w / n);
              if (perCol < 90) {
                var cls = String(el.className).trim().split(/\s+/)[0] || el.tagName.toLowerCase();
                squeezed.push(cls + ':' + n + '列×' + perCol + 'px');
              }
            }
          });
          // 过小字号（<11px 可见文本元素数）
          var tinyText = 0, tinySample = '';
          document.querySelectorAll('body *').forEach(function(el){
            if (el.children.length === 0 && el.textContent.trim() && el.getBoundingClientRect().width > 0) {
              var fs = parseFloat(getComputedStyle(el).fontSize);
              if (fs < 11 && fs > 0) { tinyText++; if (!tinySample) tinySample = el.textContent.trim().slice(0, 20) + '(' + fs + 'px)'; }
            }
          });
          return { squeezed: squeezed.slice(0, 6).join(' | '), tinyText: tinyText, tinySample: tinySample };
        })()`);
        console.log(p + ' => ' + (r.squeezed ? '挤压: ' + r.squeezed : 'OK') + (r.tinyText > 3 ? ' | 小字×' + r.tinyText + ' 例:' + r.tinySample : ''));
      } catch (e) {
        console.log(p + ' => ERROR ' + e.message);
      }
    }
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().then(() => process.exit(0)).catch(e => { console.log('FATAL', e.message); process.exit(1); });
