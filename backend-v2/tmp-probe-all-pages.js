// tmp-probe-all-pages.js — 52 页移动端体检：横向溢出 / 超宽元素 / 明显布局问题
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
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.text || r.exceptionDetails.exception?.description || '')); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, t) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(120); } return false; }

const pages = [
  'index.html', 'signup-and-login', 'forgot-password.html',
  'pages/about.html', 'pages/activity.html', 'pages/article.html', 'pages/badge.html',
  'pages/community-hub.html', 'pages/community-post.html', 'pages/community-profile.html',
  'pages/community-rules.html', 'pages/construction.html',
  'pages/create-topic-step-1.html', 'pages/create-topic-step-2.html', 'pages/create-topic-step-3.html',
  'pages/create-world.html', 'pages/dashboard.html', 'pages/download.html',
  'pages/editor.html', 'pages/error-codes.html', 'pages/explore.html',
  'pages/financial-terms.html', 'pages/fluidcanvas.html', 'pages/fluidcanvas-editor.html',
  'pages/following.html', 'pages/guidelines.html', 'pages/help.html',
  'pages/messages.html', 'pages/micronationary.html',
  'pages/onboarding-complete.html', 'pages/onboarding-identity.html', 'pages/overview.html',
  'pages/platform-responsibility.html', 'pages/plugin-guide.html', 'pages/plugins.html',
  'pages/premium.html', 'pages/privacy.html',
  'pages/registry-step-1.html', 'pages/registry-step-2.html', 'pages/registry-step-3.html',
  'pages/sovereignty-ratified.html', 'pages/terms.html', 'pages/ticket.html',
  'pages/transitioning.html', 'pages/workspace.html',
  'pages/world-created.html', 'pages/world-wizard.html',
  'pages/blackhole-demo.html', 'pages/cyberfall-demo.html', 'pages/edge-themes-demo.html',
  'pages/fluidcanvas-analytics.html', 'pages/fluidcanvas-articles.html',
];

(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-allpages-' + Date.now());
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  const results = [];
  try {
    let up = false;
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    if (!up) throw new Error('CDP 未就绪');
    const pages0 = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages0.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });

    for (const p of pages) {
      try {
        await cdp.send('Page.navigate', { url: 'https://mnationworld.com/' + p });
        await waitFor(cdp, "document.readyState === 'complete'", 15000);
        await sleep(900);
        const r = await cdp.evalJs(`(function(){
          var vw = window.innerWidth;
          var sw = document.documentElement.scrollWidth;
          var overflow = sw - vw;
          // 找最宽的溢出元素
          var widest = null, widestInfo = '';
          document.querySelectorAll('body *').forEach(function(el){
            var rect = el.getBoundingClientRect();
            if (rect.width > vw + 4 && rect.right > vw) {
              if (!widest || rect.right > widest.right) {
                widest = rect;
                widestInfo = el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0,2).join('.') + ' w=' + Math.round(rect.width) + ' right=' + Math.round(rect.right);
              }
            }
          });
          // 常见多列容器在 375 下的列数
          var grids = [];
          ['grid-template-columns'].forEach(function(){});
          document.querySelectorAll('[style*="grid-template"], .kpi-grid, .dl-grid, .fc-two-col, .fc-split-grid, .plan-grid, .pkg-grid').forEach(function(g){
            var cs = getComputedStyle(g);
            if (cs.display === 'grid' || cs.display === 'flex') {
              var cols = cs.gridTemplateColumns ? cs.gridTemplateColumns.split(' ').length : (cs.display === 'flex' ? 'flex' : '?');
              var w = Math.round(g.getBoundingClientRect().width);
              if (w > vw + 2) grids.push(String(g.className).split(' ')[0] + '(' + cols + '列,w=' + w + ')');
            }
          });
          return {
            overflow: overflow,
            widest: widestInfo,
            wideGrids: grids.slice(0, 3).join(' | '),
            sidebar: (function(){ var s = document.getElementById('slati-sidebar'); return s ? getComputedStyle(s).display : 'no-sidebar'; })(),
            bottomNav: !!document.querySelector('.mobile-bottom-nav')
          };
        })()`);
        results.push({ page: p, ...r });
        console.log(p + ' => overflow:' + r.overflow + (r.overflow > 4 ? ' ⚠ 元凶:' + r.widest + (r.wideGrids ? ' 宽栅格:' + r.wideGrids : '') : '') );
      } catch (e) {
        console.log(p + ' => ERROR ' + e.message);
        results.push({ page: p, error: e.message });
      }
    }
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
    fs.writeFileSync(path.join(__dirname, 'tmp-allpages-report.json'), JSON.stringify(results, null, 2));
    console.log('\n报告已存 tmp-allpages-report.json');
  }
})().then(() => process.exit(0)).catch(e => { console.log('FATAL', e.message); process.exit(1); });
