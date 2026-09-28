// tmp-probe-fc-all-opaque.js — FC v10.28.42.1 编辑器镶边全不透明上线实机探针
// 用户「我要全部 >:( 我说过了」——42.1 线上实证：S 静态（线上 site-config 42.1+站点 58.0 恒、
//   线上编辑器页 42.1 锚在场+旧玻璃写法零在场）/ B 实机 computed（头栏/标签弹窗真开四查/圆角弹层/
//   编辑面板真开/右键菜单/地图区三面/字体面板/暗色黑族/背底遮罩 keep/注入层藏）。
// 全 Node 内置模块：https + ws CDP（无 Chrome 依赖外组件；登录态 stub 同探针 S12 口径）。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (url) => new Promise((resolve) => {
  const req = https.request(url, { headers: { 'User-Agent': 'mn-probe' }, timeout: 30000 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 800000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
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
function parseColor(s) {
  if (!s) return null;
  let m = s.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
  if (m) return [parseFloat(m[1]) * 255, parseFloat(m[2]) * 255, parseFloat(m[3]) * 255];
  m = s.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
  return null;
}
function near(a, b, tol) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
}
function isOpaque(s) {
  if (!s) return false;
  if (/rgba?\([\d.]+, [\d.]+, [\d.]+, (0|0\.\d+)\)/.test(s)) return false;
  if (s.indexOf('/') !== -1 && s.indexOf('color(') === 0) return false;
  return /^rgba?\(|^color\(/.test(s);
}

(async () => {
  const BASE = 'https://mnationworld.com';

  // ── S 线上静态 ──
  const sc = await get(BASE + '/assets/js/site-config.js');
  ok('S1 线上 site-config：FC v10.28.47.4 + 42.1 changelog 条目 + 站点恒 v0.2.58.18',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sc.body.indexOf('编辑器镶边玻璃全灭') !== -1 && sc.body.indexOf('v0.2.58.18') !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const fc = await get(BASE + '/pages/fluidcanvas-editor.html');
  ok('S2 线上编辑器页：42.1 浮面锚在场 + 旧玻璃写法零残留（头栏/弹窗/面板/菜单/输入框全灭）',
    fc.status === 200 &&
    fc.body.indexOf('background: var(--color-surface-container); /* 42.1 全不透明') !== -1 &&
    fc.body.indexOf('.modal-card > .lg-backdrop, .modal-card > .lg-specular {') !== -1 &&
    fc.body.indexOf('var(--modal-bg, var(--card-bg));') === -1 &&
    fc.body.indexOf('background: var(--input-bg);\n  backdrop-filter: blur(12px);') === -1 &&
    fc.body.indexOf('background-size: 45% 2px') === -1,
    'status=' + fc.status + ' err=' + fc.error);

  // ── B 线上实机 computed ──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const CDP_PORT = 9300 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fcallopaque-' + Date.now());
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
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!document.getElementById('gridCanvas') && !!window.createSneCard", 30000, 'B 编辑器加载');
    await sleep(800);

    const SURFACE = [236, 238, 240];
    const SURFACE_LOW = [242, 244, 246];
    const faceOf = (sel) => "(function(){ var c = document.querySelector('" + sel + "'); if (!c) return null; var cs = getComputedStyle(c); return { bg: cs.backgroundColor, blur: cs.backdropFilter || 'none', webkitBlur: cs.webkitBackdropFilter || 'none', bgImg: cs.backgroundImage.slice(0, 60) }; })()";

    let f = await cdp.evalJs(faceOf('.editor-header'));
    ok('B1 编辑器头栏（实机）：不透明 surface-container + blur 摘除（含 -webkit）',
      f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none' && f.webkitBlur === 'none', JSON.stringify(f));

    await cdp.evalJs("window.openModal('tagsModal')");
    await sleep(250);
    f = await cdp.evalJs(faceOf('.modal-card'));
    const inp = await cdp.evalJs(faceOf('#tagModalInput'));
    const inj = await cdp.evalJs("(function(){ var mc = document.querySelector('.modal-card'); if (!mc) return null; var out = []; mc.querySelectorAll(':scope > .lg-backdrop, :scope > .lg-specular').forEach(function(l){ out.push(l.className + ':' + getComputedStyle(l).display); }); return out; })()");
    const backdrop = await cdp.evalJs(faceOf('#modalBackdrop'));
    ok('B2a 标签弹窗卡面（实机真开）：不透明 surface-container + blur 摘除', f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none', JSON.stringify(f));
    ok('B2b 弹窗内输入框：不透明 surface-container-low + blur 摘除', inp && near(parseColor(inp.bg), SURFACE_LOW, 1) && isOpaque(inp.bg) && inp.blur === 'none', JSON.stringify(inp));
    ok('B2c 弹窗玻璃注入层：不在场或 display:none', inj && inj.every(function (s) { return s.indexOf(':none') !== -1; }), JSON.stringify(inj));
    ok('B2d 弹窗暗化背底 keep：blur(8px) 在位（按设计压暗不是表面）', backdrop && backdrop.blur.indexOf('blur') !== -1, JSON.stringify(backdrop));
    await cdp.evalJs("document.getElementById('modalBackdrop').classList.remove('active'); document.querySelectorAll('.modal-card.active').forEach(function(c){c.classList.remove('active');})");
    await sleep(120);

    await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
    await sleep(200);
    await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); window.selectCard(c); })()");
    await sleep(150);
    await cdp.evalJs('window.openBorderRadiusPopover()');
    await sleep(150);
    f = await cdp.evalJs(faceOf('.radius-popover'));
    ok('B3 圆角弹层（实机真开）：不透明 surface-container + blur 摘除', f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none', JSON.stringify(f));
    await cdp.evalJs("var rp = document.querySelector('.radius-popover'); if (rp) rp.classList.remove('active')");

    await cdp.evalJs("(function(){ var c = window.createStatsCard(20, 2, 8, 6); window.selectCard(c); window.applyStatsChart(c, 'bar'); return true; })()");
    await sleep(250);
    f = await cdp.evalJs(faceOf('.stats-edit-panel'));
    ok('B4 编辑面板（实机真开）：不透明 surface-container + blur 摘除 + 白色高光条已撤',
      f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none' && f.bgImg.indexOf('linear-gradient') === -1, JSON.stringify(f));

    await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); var r = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + 30 })); })()");
    await sleep(200);
    f = await cdp.evalJs(faceOf('.context-menu'));
    ok('B5 右键菜单（实机真开）：不透明 surface-container + blur 摘除', f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none', JSON.stringify(f));
    await cdp.evalJs("var cm = document.querySelector('.context-menu'); if (cm) cm.style.display = 'none'");

    const mre = await cdp.evalJs("(function(){ return ['.mre-stage', '.mre-side', '.mre-panel'].map(function(sel){ var c = document.querySelector(sel); if (!c) return null; var cs = getComputedStyle(c); return { bg: cs.backgroundColor, blur: cs.backdropFilter || 'none' }; }); })()");
    ok('B6 地图区三面（实机）：不透明 surface-container + blur 摘除（stage/side/panel）',
      mre && mre.length === 3 && mre.every(function (m) { return m && near(parseColor(m.bg), SURFACE, 1) && isOpaque(m.bg) && m.blur === 'none'; }), JSON.stringify(mre));

    f = await cdp.evalJs(faceOf('.font-panel'));
    ok('B7 字体面板（实机）：不透明 surface-container + blur 摘除',
      f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none', JSON.stringify(f));

    await cdp.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
    await sleep(200);
    const DARK = [32, 32, 56];
    f = await cdp.evalJs(faceOf('.editor-header'));
    await cdp.evalJs("window.openModal('tagsModal')");
    await sleep(200);
    const dm = await cdp.evalJs(faceOf('.modal-card'));
    ok('B8 暗色主题（实机）：头栏+弹窗卡面黑族 #202038 不透明（var() 自适应）',
      f && near(parseColor(f.bg), DARK, 1) && isOpaque(f.bg) &&
      dm && near(parseColor(dm.bg), DARK, 1) && isOpaque(dm.bg) && dm.blur === 'none',
      JSON.stringify({ header: f, modal: dm }));

    ok('E1 实机全程零 Runtime.exceptionThrown + 零 console.error',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      JSON.stringify({ errs: cdp.errs.slice(0, 3), cons: cdp.consoleErrs.slice(0, 3) }));
    cdp.close();
  } catch (e) {
    console.error('💥 探针异常: ' + (e && e.stack || e));
    FAIL.n++;
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
  console.log('');
  console.log('╭──────────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (fc-all-opaque-live)   │');
  console.log('╰──────────────────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
})().catch((e) => { console.error('💥 探针异常: ' + (e && e.stack || e)); process.exit(1); });
