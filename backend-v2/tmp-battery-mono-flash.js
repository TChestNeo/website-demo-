// tmp-battery-mono-flash.js — v0.2.49.1 / FC v10.28.35.4 黑白主题切页闪修复电池
// 2026-09-17 复跑（v0.2.49.3 白底白字第二轮）：F0 版本锚更新 49.2→49.3（本电池断言面与 Request G 无交叠）
// 用户「那个黑白主题在切换页面时会先显示默认主题的颜色再转变成黑白主题的颜色」
// 验证：mono 主题色不再依赖 settings-modal.js 运行时注入——①head 内联块同步落 data-accent ②mono 规则静态在
// ethereal.css 随内联首帧生效。核心手法：全程 Network 屏蔽 settings-modal.js，若 mono 仍全量生效=静态路径成立
// （首帧即黑白，切页无蓝家族闪现）；附暗蓝回归+亮 mono 回归+零 console error。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-monoflash-batt-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); });
      return;
    }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

// 页面状态快照：html 属性 + mono 令牌 + body 底色 + 注入样式是否在场
const SNAP = `(function(){
  var h = document.documentElement;
  var cs = getComputedStyle(h);
  return JSON.stringify({
    accent: h.getAttribute('data-accent'),
    theme: h.getAttribute('data-theme'),
    bg: cs.getPropertyValue('--color-background').trim(),
    primary: cs.getPropertyValue('--color-primary').trim(),
    card: cs.getPropertyValue('--card-bg').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    injected: !!document.getElementById('slati-settings-menu-style')
  });
})()`;

(async () => {
  // ═══ F 静态检查 ═══
  const ethSrc = fs.readFileSync(path.join(DOCS, 'assets', 'css', 'ethereal.css'), 'utf8');
  const smSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'settings-modal.js'), 'utf8');
  const tiSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'theme-init.js'), 'utf8');
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const readAll = (dir, out) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) readAll(p, out);
      else if (ent.name.endsWith('.html')) out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  const allHtml = []; readAll(DOCS, allHtml);
  const countHtml = (pred) => allHtml.filter(pred).length;
  ok('F0 版本双线 v0.2.54.0 / v10.28.36.1 + 用户原话注释（49.1 注释块保留）',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.0';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.45.1';") !== -1 &&
    sconfSrc.indexOf('黑白主题') !== -1 && sconfSrc.indexOf('转变成黑白主题的颜色') !== -1);
  ok('F1 settings-modal.js 已无 mono 规则（迁出干净）+ 弹窗 UI 规则保留',
    smSrc.indexOf('0b0b0d') === -1 && smSrc.indexOf('32324a') === -1 &&
    smSrc.indexOf('#settingsCard') !== -1 && smSrc.indexOf('切页闪修复') !== -1);
  ok('F2 ethereal.css 静态含 mono 三族（暗黑族/白底白字族/FC Migrate 族）',
    ethSrc.indexOf('--color-background: #0b0b0d') !== -1 &&
    ethSrc.indexOf('.grid-controls .col-btn.active') !== -1 &&
    ethSrc.indexOf('.migrate-pill::before') !== -1);
  ok('F3 theme-init.js 原版源含 data-accent 同步落', tiSrc.indexOf("setAttribute('data-accent', 'mono')") !== -1);
  ok('F4 30 页 head 内联块含 accent + 41 页内联含 mono 令牌（55.0 article.html 入族）',
    countHtml(s => s.indexOf("if (accent === 'mono')") !== -1) === 30 &&
    countHtml(s => s.indexOf('--color-background: #0b0b0d') !== -1) === 41,
    countHtml(s => s.indexOf("if (accent === 'mono')") !== -1) + ' 页 accent / ' + countHtml(s => s.indexOf('--color-background: #0b0b0d') !== -1) + ' 页 mono');

  // ═══ 浏览器场景（settings-modal.js 全程屏蔽——mono 仍生效=静态路径实证）═══
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('Network.enable');
    // 全程屏蔽 settings-modal.js——mono 若仍全量生效，证明规则与属性都不再依赖运行时注入
    await cdp.send('Network.setBlockedURLs', { urls: ['*settings-modal.js'] });
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    const preset = (settings) => cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify(settings)) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const snap = async () => JSON.parse(await cdp.evalJs(SNAP));

    // ── S1 首页 暗 mono（屏蔽注入后首帧即黑白）──
    await preset({ theme: 'dark', accent: 'mono' });
    await nav(BASE + '/', "document.documentElement.getAttribute('data-accent') === 'mono'", '首页 暗 mono');
    let s = await snap();
    ok('S1a 屏蔽注入下 data-accent=mono + data-theme=dark（head 内联同步落）', s.accent === 'mono' && s.theme === 'dark', 'accent=' + s.accent + ' theme=' + s.theme);
    ok('S1b 暗 mono 令牌全黑族（--color-background #0b0b0d / primary #ececf2 / card rgba(21,21,25,0.55)）',
      s.bg === '#0b0b0d' && s.primary === '#ececf2' && s.card === 'rgba(21, 21, 25, 0.55)', 'bg=' + s.bg + ' p=' + s.primary);
    ok('S1c body 中性黑 rgb(11,11,13)', s.bodyBg === 'rgb(11, 11, 13)', s.bodyBg);
    ok('S1d 注入样式确已屏蔽（mono 生效却无 #slati-settings-menu-style = 静态路径实证）', s.injected === false, 'injected=' + s.injected);

    // ── S2 FC 首页 暗 mono ──
    await nav(BASE + '/pages/fluidcanvas.html', "document.documentElement.getAttribute('data-accent') === 'mono' && document.querySelector('.studio-header')", 'FC 首页');
    s = await snap();
    ok('S2a FC 首页 data-accent=mono + 暗黑族令牌（首帧即黑白）', s.accent === 'mono' && s.bg === '#0b0b0d' && s.primary === '#ececf2', 'bg=' + s.bg);
    ok('S2b FC 首页注入样式同样不在场', s.injected === false);

    // ── S3 FC 编辑器 暗 mono（FC 专属 mono 组件规则从 ethereal 生效）──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.documentElement.getAttribute('data-accent') === 'mono' && document.getElementById('gridCanvas')", 'FC 编辑器');
    s = await snap();
    ok('S3a 编辑器 data-accent=mono + 网格画布黑族 rgb(10,10,12)',
      s.accent === 'mono' && (await cdp.evalJs("(function(){var g=document.getElementById('gridCanvas');return g?getComputedStyle(g).backgroundColor:null;})()")) === 'rgb(10, 10, 12)');
    ok('S3b col-btn.active = #32324a 白字（白底白字族从 ethereal 生效）',
      (await cdp.evalJs("(function(){var b=document.querySelector('.grid-controls .col-btn.active');return b?getComputedStyle(b).backgroundColor+'|'+getComputedStyle(b).color:null;})()")) === 'rgb(50, 50, 74)|rgb(255, 255, 255)');
    ok('S3c tim-search-btn = #32324a 白字',
      (await cdp.evalJs("(function(){var b=document.querySelector('.tim-search-btn');return b?getComputedStyle(b).backgroundColor+'|'+getComputedStyle(b).color:null;})()")) === 'rgb(50, 50, 74)|rgb(255, 255, 255)');
    ok('S3d 编辑器 toast 翻黑族 rgb(26,26,30)',
      (await cdp.evalJs("(function(){var t=document.getElementById('toast');return t?getComputedStyle(t).backgroundColor:null;})()")) === 'rgb(26, 26, 30)');
    ok('S3e 注入样式不在场', s.injected === false);

    // ── S4 切页链（模拟用户换页：head 内联块在 CSS 前同步落属性——每页到达即已是黑白，无蓝家族窗口）──
    for (const [url, label] of [
      [BASE + '/pages/explore.html', 'explore'],
      [BASE + '/pages/community-hub.html', 'community-hub'],
      [BASE + '/', '回首页']
    ]) {
      await nav(url, "document.documentElement.getAttribute('data-accent') === 'mono'", '切页 ' + label);
      s = await snap();
      ok('S4 切页 ' + label + ' 到达即 mono+黑族（无蓝家族窗口）', s.accent === 'mono' && s.bg === '#0b0b0d' && s.bodyBg === 'rgb(11, 11, 13)', 'bg=' + s.bg);
    }

    // ── S5 亮 mono 回归（暗规则不污染亮主题）──
    await preset({ theme: 'light', accent: 'mono' });
    await nav(BASE + '/', "document.documentElement.getAttribute('data-accent') === 'mono'", '首页 亮 mono');
    s = await snap();
    {
      const m = s.bodyBg.replace(/[^\d.,]/g, '').split(',').map(Number);
      const l = m.length >= 3 ? (Math.max(m[0], m[1], m[2]) + Math.min(m[0], m[1], m[2])) / 510 : 0;
      ok('S5a 亮 mono 保持亮底 + 主色近黑族 #1c1c22', l > 0.9 && s.primary === '#1c1c22' && s.bg !== '#0b0b0d', 'L=' + l.toFixed(3) + ' p=' + s.primary);
    }

    // ── S6 暗蓝回归（无 mono accent → 蓝家族原样）──
    await preset({ theme: 'dark' });
    await nav(BASE + '/', "document.documentElement.getAttribute('data-theme') === 'dark'", '首页 暗蓝');
    s = await snap();
    ok('S6a 无 accent 时蓝家族原样（#161625 / body rgb(22,22,37) / primary #4648d4）',
      s.accent === null && s.bg === '#161625' && s.bodyBg === 'rgb(22, 22, 37)' && s.primary === '#4648d4',
      'accent=' + s.accent + ' bg=' + s.bg + ' p=' + s.primary);

    // ── Z console errors ──
    ok('Z 全程零 console error（settings-modal 屏蔽亦零报错）', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');

    cdp.close();
    try { chrome.kill(); } catch (e) {}
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  process.exit(FAIL === 0 ? 0 : 1);
})();
