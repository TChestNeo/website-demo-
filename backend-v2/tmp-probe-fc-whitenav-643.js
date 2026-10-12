// tmp-probe-fc-whitenav-643.js — FC v10.28.52.2 折叠按钮+顶部菜单纯白不透明线上探针（mnationworld.com）
//   S1a site-config live：52.2 赋值 ×1 + 52.1 赋值零残留 + 站点 58.28 ×1 + changelog 头 52.2/52.1 各 ×1；
//   S1b rev live 口径：rev 00371-真值 ×1 + 00371-XXX 零残留 + 00372-??? 占位 ×1 + 00372-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00372-终态，live 仍二次烘焙镜像）；
//   S1c 编辑器 live 5 锚（toggle lowest 纯白/header lowest 纯白/暗色还原 ×2/注释原话）；
//   S2 API：health 200 + tables:66（本轮零迁移）；S3 fc/edges 匿名公开 200（回归）；
//   P1 CDP 编辑器（假会话）：P1a 亮色 toggle+header computed 纯白 rgb(255,255,255) 不透明+blur 摘除 →
//     P1b 折叠往返按钮仍纯白（left 6px→266px）→ P1c 暗色主题还原 rgb(32,32,56) 实心零回归 →
//     P1d 回亮色纯白恢复 → E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REAL71 = '00371-zvn'; // deploy#1 实得 rev
const REAL72 = '00372-svk'; // deploy#2 实得 rev（live 断言=零残留）
const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fc643-' + Date.now());
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}
const hget = (url, opts) => new Promise((resolve) => {
  opts = opts || {};
  const req = https.request(url, Object.assign({ method: opts.method || 'GET', headers: Object.assign({}, opts.headers), timeout: 25000 }), (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 12000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  if (opts.body) req.write(opts.body);
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
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
        this.errs.push('EXC:' + JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const txt = (m.params.args || []).map(a => a.value || a.description || '').join(' ');
        if (txt.indexOf('Failed to load resource') === -1) this.errs.push('CON:' + txt.slice(0, 200));
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

const SESSION_SCRIPT = 'try{(function(){ localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "探针用户", tier: "premium" }));' +
  ' localStorage.setItem("slati_lang", "zh-CN"); })();}catch(e){}';
const FACE_EXPR = "(function(){ var t = document.querySelector('.asset-panel-toggle');" +
  " var h = document.querySelector('.editor-header'); var ts = getComputedStyle(t), hs = getComputedStyle(h);" +
  " return { tb: ts.backgroundColor, tblur: ts.backdropFilter || 'none'," +
  " hb: hs.backgroundColor, hblur: hs.backdropFilter || 'none'," +
  " tl: ts.left, pw: getComputedStyle(document.querySelector('.asset-panel')).width }; })()";
const parseColor = (s) => (s || '').replace(/[^\d,.]/g, '').split(',').map(Number);
const near = (a, b, tol) => a && a.length >= 3 && b && b.length >= 3 &&
  Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
const isOpaque = (s) => !/rgba\(/.test(s) || (parseColor(s).length === 4 && parseColor(s)[3] >= 0.999);

(async () => {
  // ═══ S1 静态（live 文本口径）═══
  console.log('═══ S1 静态（live）═══');
  const sc = await hget(SITE + '/assets/js/site-config.js');
  const ed = await hget(ED);
  const scS = sc.body;
  const scC = (s) => scS.split(s).length - 1;
  ok('S1a site-config：52.2 赋值 ×1 + 52.1 赋值零残留 + 站点 58.28 ×1 + changelog 头 52.2/52.1 各 ×1',
    scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.2';") === 1 && scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.1';") === 0 &&
    scC("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 &&
    scC('// v10.28.52.2 = ') === 1 && scC('// v10.28.52.1 = ') === 1,
    'fc522=' + scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.2';") + ' fc521=' + scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.1';") +
    ' cl522=' + scC('// v10.28.52.2 = ') + ' cl521=' + scC('// v10.28.52.1 = '));
  ok('S1b rev live 口径：rev ' + REAL71 + ' ×1 + 00371-XXX 零残留 + 00372-??? 占位 ×1 + ' + REAL72 + ' 零残留（live 滞后一部署）',
    scC(REAL71) === 1 && scC('00371-XXX') === 0 && scC('00372-???') === 1 && scC(REAL72) === 0,
    'r71=' + scC(REAL71) + ' p71=' + scC('00371-XXX') + ' p72=' + scC('00372-???') + ' r72=' + scC(REAL72));
  const ebad = [];
  const eanchors = [
    ['toggle lowest 纯白锚', 'background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */', 1],
    ['header lowest 纯白锚', 'background: var(--color-surface-container-lowest); /* 42.1 全不透明+52.2 纯白', 1],
    ['暗色还原选择器行1', ':root[data-theme="dark"] .asset-panel-toggle,', 1],
    ['暗色还原选择器行2', ':root[data-theme="dark"] .editor-header { background: var(--color-surface-container); }', 1],
    ['注释原话', '那个FC编辑器的左侧菜单的折叠按钮的背景能不能改成', 1]
  ];
  eanchors.forEach(([n, s, want]) => { if (ed.body.split(s).length - 1 !== want) ebad.push(n + '=' + (ed.body.split(s).length - 1)); });
  ok('S1c 编辑器 live 5 锚全中（toggle/header lowest+暗色还原 ×2+注释原话）', ebad.length === 0, ebad.join(','));

  console.log('═══ S2 API（匿名口径）═══');
  const health = await hget(SITE + '/api/health');
  let healthJson = null; try { healthJson = JSON.parse(health.body); } catch (e) {}
  ok('S2 /api/health 200 + tables:66（本轮零迁移）', health.status === 200 && healthJson && healthJson.status === 'ok' && healthJson.tables === 66,
    'status=' + health.status + ' tables=' + (healthJson && healthJson.tables));

  console.log('═══ S3 匿名回归 ═══');
  const edges = await hget(SITE + '/api/fc/edges');
  ok('S3 fc/edges 匿名公开 200（回归）', edges.status === 200, 'status=' + edges.status);

  // ═══ P1 CDP 编辑器（假会话）═══
  console.log('═══ P1 CDP（假会话）═══');
  let chromePath = null;
  (['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]).forEach((p) => { if (!chromePath && fs.existsSync(p)) chromePath = p; });
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let cdp = null;
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
    await cdp.send('Page.navigate', { url: ED });
    await waitFor(cdp, "document.getElementById('gridCanvas') && document.querySelector('.asset-panel-toggle')", 40000, 'P1 编辑器就绪');
    await sleep(900);

    // P1a 亮色：按钮+头栏 computed 纯白 rgb(255,255,255) 不透明+blur 摘除
    const f = await cdp.evalJs(FACE_EXPR);
    ok('P1a 亮色 live：折叠按钮+头栏 computed 纯白 rgb(255,255,255) 不透明 + blur 摘除（left 266px/面板 260px）',
      f && near(parseColor(f.tb), [255, 255, 255], 0) && isOpaque(f.tb) && f.tblur === 'none' &&
      near(parseColor(f.hb), [255, 255, 255], 0) && isOpaque(f.hb) && f.hblur === 'none' &&
      f.tl === '266px' && f.pw === '260px', JSON.stringify(f));

    // P1b 折叠往返：按钮仍纯白
    await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
    await sleep(600);
    const fc = await cdp.evalJs(FACE_EXPR);
    await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
    await sleep(600);
    const fb = await cdp.evalJs(FACE_EXPR);
    ok('P1b 折叠往返 live：left 6px→266px 全程按钮仍纯白 rgb(255,255,255) 不透明',
      fc && fc.tl === '6px' && near(parseColor(fc.tb), [255, 255, 255], 0) && isOpaque(fc.tb) &&
      fb && fb.tl === '266px' && near(parseColor(fb.tb), [255, 255, 255], 0) && isOpaque(fb.tb),
      JSON.stringify({ folded: fc, back: fb }));

    // P1c 暗色主题：还原 rgb(32,32,56) 实心零回归
    await cdp.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
    await sleep(400);
    const fd = await cdp.evalJs(FACE_EXPR);
    ok('P1c 暗色 live：按钮+头栏还原 rgb(32,32,56) 实心（52.2 还原规则零回归）',
      fd && near(parseColor(fd.tb), [32, 32, 56], 0) && isOpaque(fd.tb) &&
      near(parseColor(fd.hb), [32, 32, 56], 0) && isOpaque(fd.hb), JSON.stringify(fd));

    // P1d 回亮色：纯白恢复
    await cdp.evalJs("document.documentElement.removeAttribute('data-theme')");
    await sleep(400);
    const f2 = await cdp.evalJs(FACE_EXPR);
    ok('P1d 回亮色 live：纯白 rgb(255,255,255) 恢复（双态往返零残留）',
      f2 && near(parseColor(f2.tb), [255, 255, 255], 0) && isOpaque(f2.tb) &&
      near(parseColor(f2.hb), [255, 255, 255], 0) && isOpaque(f2.hb), JSON.stringify(f2));

    // E1 零异常
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 零异常（实际 ' + realErrs.length + ' 条）', realErrs.length === 0, realErrs.join(' | '));
  } catch (e) {
    console.log('  💥 ' + (e && e.message || e));
    fail++;
  } finally {
    try { cdp && cdp.close(); } catch (e) {}
    chrome.kill();
  }
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail ? 1 : 0);
})();
