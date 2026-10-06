// tmp-battery-fc-whitenav.js — v10.28.52.2 折叠按钮+顶部菜单纯白不透明电池（本地工作树；52.3 轮改锚；52.4 轮再改锚；52.5 轮三改锚）
//   S 静态：site-config 52.3 赋值 ×1/52.2 赋值零残留/changelog 头 52.3/52.2 各 ×1/rev 真值 00371-zvn+00372-svk
//     各 ×1/站点恒 58.28；编辑器锚（折叠按钮+头栏 lowest 纯白锚各 ×1/暗色还原规则 ×2 行/注释原话 ×1/
//     旧头栏 surface-container 行零残留/49.1 :has 折叠规则在位）；
//   B 编辑器 CDP：B1 亮色 toggle+header 纯白 #ffffff 不透明+blur 摘除（52.4 按钮驻右缘 214px）/
//     B2 折叠往返按钮仍纯白（214px→6px 双态恒驻）/B3 暗色主题还原 #202038 实心零回归 /
//     B4 暗 mono 还原 #151518 实心 / E 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-whitenav-' + Date.now());
const EDITOR_URL_PATH = '/pages/fluidcanvas-editor.html';
const BASE = 'http://127.0.0.1:' + PORT;

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

// ── 本地静态服务器 ──
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
const server = require('http').createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.indexOf('/api') === 0) { res.writeHead(404); res.end('{"error":"NOT_FOUND"}'); return; }
  if (u === '/' || u === '/dashboard') u = '/index.html';
  let f = path.join(DOCS, u);
  if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
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

const SESSION_SCRIPT = 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}';

// ═══ 按钮/头栏背景读取（DOM 计算样式口径）═══
const FACE_EXPR = "(function(){ var t = document.querySelector('.asset-panel-toggle');" +
  " var h = document.querySelector('.editor-header'); var ts = getComputedStyle(t), hs = getComputedStyle(h);" +
  " return { tb: ts.backgroundColor, tblur: ts.backdropFilter || 'none'," +
  " hb: hs.backgroundColor, hblur: hs.backdropFilter || 'none'," +
  " tl: ts.left, tw: ts.width, th: ts.height, pw: getComputedStyle(document.querySelector('.asset-panel')).width }; })()";
const parseColor = (s) => (s || '').replace(/[^\d,.]/g, '').split(',').map(Number);
const near = (a, b, tol) => a && a.length >= 3 && b && b.length >= 3 &&
  Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
const isOpaque = (s) => !/rgba\(/.test(s) || (parseColor(s).length === 4 && parseColor(s)[3] >= 0.999);

(async () => {
  server.listen(PORT, '127.0.0.1');

  // ═══ S 静态锚（行计数口径=实测 grep -cF）═══
  console.log('═══ S 静态锚 ═══');
  const edSrc = fs.readFileSync(path.join(DOCS, 'pages/fluidcanvas-editor.html'), 'utf8');
  const edLines = edSrc.split(/\r?\n/);
  const el = (a) => edLines.filter((l) => l.includes(a)).length;
  const cfgSrc = fs.readFileSync(path.join(DOCS, 'assets/js/site-config.js'), 'utf8');
  const sc = (s) => cfgSrc.split(s).length - 1;
  ok('S1 site-config：52.5 赋值 ×1 + 52.4 赋值零残留 + changelog 头 52.5/52.4/52.3 各 ×1 + rev 真值 00371-zvn/00372-svk 各 ×1 + 站点恒 58.28',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.62.1';") === 1 && sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.5';") === 0 &&
    sc('// v10.28.62.1 = ') === 1 && sc('// v10.28.52.5 = ') === 1 && sc('// v10.28.52.4 = ') === 1 &&
    sc('rev 00371-zvn') === 1 && sc('rev 00372-svk') === 1 &&
    sc("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1,
    'fc525=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.62.1';") + ' fc524=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.4';") +
    ' cl525=' + sc('// v10.28.62.1 = ') + ' cl524=' + sc('// v10.28.52.4 = ') + ' cl523=' + sc('// v10.28.52.3 = ') +
    ' r71=' + sc('rev 00371-zvn') + ' r72=' + sc('rev 00372-svk'));
  ok('S2 编辑器：折叠按钮+头栏 lowest 纯白锚各 ×1 + 暗色还原规则 ×2 行 + 注释原话 ×1 + 旧头栏 surface-container 行零残留 + 49.1 :has 折叠规则在位',
    el('background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */') === 1 &&
    el('background: var(--color-surface-container-lowest); /* 42.1 全不透明+52.2 纯白') === 1 &&
    el(':root[data-theme="dark"] .asset-panel-toggle,') === 1 &&
    el(':root[data-theme="dark"] .editor-header { background: var(--color-surface-container); }') === 1 &&
    el('那个FC编辑器的左侧菜单的折叠按钮的背景能不能改成') === 1 &&
    el('background: var(--color-surface-container); /* 42.1 全不透明：头栏铺不透明底+摘 16px 模糊 */') === 0 &&
    el('.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }') === 1,
    JSON.stringify({
      togLow: el('background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */'),
      hdrLow: el('background: var(--color-surface-container-lowest); /* 42.1 全不透明+52.2 纯白'),
      dark1: el(':root[data-theme="dark"] .asset-panel-toggle,'),
      dark2: el(':root[data-theme="dark"] .editor-header { background: var(--color-surface-container); }'),
      quote: el('那个FC编辑器的左侧菜单的折叠按钮的背景能不能改成'),
      oldhdr: el('background: var(--color-surface-container); /* 42.1 全不透明：头栏铺不透明底+摘 16px 模糊 */'),
      has: el('.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }')
    }));

  // ═══ B 编辑器 CDP ═══
  console.log('═══ B 编辑器 CDP ═══');
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
    await cdp.send('Page.setDownloadBehavior', { behavior: 'deny' });
    await cdp.send('Page.navigate', { url: BASE + EDITOR_URL_PATH });
    await waitFor(cdp, "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.toggleAssetPanel", 40000, '编辑器就绪');
    await sleep(900);

    // ═══ B1 亮色默认：按钮+头栏纯白 #ffffff 不透明+blur 摘除 ═══
    {
      const f = await cdp.evalJs(FACE_EXPR);
      ok('B1 亮色：折叠按钮+头栏 computed 纯白 rgb(255,255,255) 不透明 + blur 摘除（52.4 按钮驻右缘 214px）',
        f && near(parseColor(f.tb), [255, 255, 255], 0) && isOpaque(f.tb) && f.tblur === 'none' &&
        near(parseColor(f.hb), [255, 255, 255], 0) && isOpaque(f.hb) && f.hblur === 'none' &&
        f.tl === '214px' && f.tw === '40px' && f.pw === '260px', JSON.stringify(f));
    }

    // ═══ B2 折叠往返：按钮 6px 落定仍纯白 → 展开回 214px 仍纯白 ═══
    {
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      await sleep(1400);
      const f = await cdp.evalJs(FACE_EXPR);
      ok('B2a 折叠终态：按钮 left 6px 仍纯白 rgb(255,255,255) 不透明（面板宽 0）',
        f && f.tl === '6px' && near(parseColor(f.tb), [255, 255, 255], 0) && isOpaque(f.tb) &&
        near(parseColor(f.hb), [255, 255, 255], 0) && isOpaque(f.hb) && f.pw === '0px', JSON.stringify(f));
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      await sleep(1400);
      const f2 = await cdp.evalJs(FACE_EXPR);
      ok('B2b 展开回来：按钮 left 214px 仍纯白（52.4 展开=0.25s 过渡滑回右缘+白底恒同）',
        f2 && f2.tl === '214px' && near(parseColor(f2.tb), [255, 255, 255], 0) && isOpaque(f2.tb) &&
        near(parseColor(f2.hb), [255, 255, 255], 0) && isOpaque(f2.hb) && f2.pw === '260px', JSON.stringify(f2));
    }

    // ═══ B3 暗色主题：还原规则实证（#202038 实心零回归）═══
    {
      await cdp.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
      await sleep(300);
      const f = await cdp.evalJs(FACE_EXPR);
      ok('B3 暗色：按钮+头栏还原 rgb(32,32,56) #202038 实心（52.2 还原规则零回归）',
        f && near(parseColor(f.tb), [32, 32, 56], 0) && isOpaque(f.tb) &&
        near(parseColor(f.hb), [32, 32, 56], 0) && isOpaque(f.hb), JSON.stringify(f));
    }

    // ═══ B4 暗色 mono：还原 #151518 实心 ═══
    {
      await cdp.evalJs("document.documentElement.setAttribute('data-accent', 'mono')");
      await sleep(300);
      const f = await cdp.evalJs(FACE_EXPR);
      ok('B4 暗 mono：按钮+头栏还原 rgb(21,21,24) #151518 实心（mono 覆盖令牌自适应）',
        f && near(parseColor(f.tb), [21, 21, 24], 0) && isOpaque(f.tb) &&
        near(parseColor(f.hb), [21, 21, 24], 0) && isOpaque(f.hb), JSON.stringify(f));
      await cdp.evalJs("document.documentElement.removeAttribute('data-theme'); document.documentElement.removeAttribute('data-accent');");
      await sleep(300);
      const f2 = await cdp.evalJs(FACE_EXPR);
      ok('B4b 回亮色：纯白 rgb(255,255,255) 恢复（双态往返零残留）',
        f2 && near(parseColor(f2.tb), [255, 255, 255], 0) && isOpaque(f2.tb) &&
        near(parseColor(f2.hb), [255, 255, 255], 0) && isOpaque(f2.hb), JSON.stringify(f2));
    }

    // ═══ E 零异常 ═══
    {
      const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
      const realErrs = cdp.errs.filter(e => !noise.test(e));
      ok('E 零异常（实际 ' + realErrs.length + ' 条）', realErrs.length === 0, realErrs.join(' | '));
    }
  } catch (e) {
    console.log('  💥 ' + (e && e.message || e));
    fail++;
  } finally {
    try { cdp && cdp.close(); } catch (e) {}
    chrome.kill();
    server.close();
  }
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(fail ? 1 : 0);
})();
