// tmp-battery-fc-paneltoggle.js — v10.28.50.0 折叠按钮改圆形电池（本地工作树；49.2 轮原位改锚）
//   S 静态：site-config 版本 49.2 在位/49.1 赋值零残留/changelog 头 49.2+49.1+49.0 各 ×1/rev 前缀锚
//     （rev 00352-/00353-/00354-/00355- 各 ×1——前缀口径填真值后恒真）+
//     编辑器锚（:has 折叠态规则收窄为 { left: 6px; }/旧圆角方块规则零残留/32×32+50% 圆形锚/展开态口径锚）；
//   B 编辑器 CDP：B1 展开态按钮贴面板右缘 266px 正圆 32×32 / B2 点击折叠→按钮滑到左缘 6px（中途采样证过渡）
//     +面板宽 0 / B3 点击展开→回 266px / B4 往返后编辑器功能完好（建卡+面板搜索框在位）；
//   E 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-paneltoggle-' + Date.now());
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

// ═══ 面板/按钮状态读取（DOM 计算样式口径）═══
const PANEL_EXPR = "(function(){ var b = document.querySelector('.asset-panel-toggle');" +
  " var p = document.querySelector('.asset-panel'); var bs = getComputedStyle(b), ps = getComputedStyle(p);" +
  " return { left: bs.left, br: bs.borderRadius, blw: bs.borderLeftWidth, w: bs.width, h: bs.height," +
  " txt: b.textContent.trim(), pw: ps.width, brw: ps.borderRightWidth }; })()";

(async () => {
  server.listen(PORT, '127.0.0.1');

  // ═══ S 静态锚（行计数口径=实测 grep -cF）═══
  console.log('═══ S 静态锚 ═══');
  const edSrc = fs.readFileSync(path.join(DOCS, 'pages/fluidcanvas-editor.html'), 'utf8');
  const edLines = edSrc.split(/\r?\n/);
  const el = (a) => edLines.filter((l) => l.includes(a)).length;
  const cfgSrc = fs.readFileSync(path.join(DOCS, 'assets/js/site-config.js'), 'utf8');
  const sc = (s) => cfgSrc.split(s).length - 1;
  ok('S1 site-config：FC 版本 49.2 在位 + 49.1 赋值零残留 + changelog 头 49.2/49.1/49.0 各 ×1 + rev 前缀锚各 ×1',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") === 1 &&
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.49.1';") === 0 &&
    sc('// v10.28.50.0 = ') === 1 && sc('// v10.28.49.1 = ') === 1 && sc('// v10.28.49.0 = ') === 1 &&
    sc('rev 00352-') === 1 && sc('rev 00353-') === 1 && sc('rev 00354-') === 1 && sc('rev 00355-') === 1,
    'fc49.2=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") + ' fc49.1=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.49.1';") +
    ' cl49.2=' + sc('// v10.28.50.0 = ') + ' cl49.1=' + sc('// v10.28.49.1 = ') + ' cl49.0=' + sc('// v10.28.49.0 = ') +
    ' r52=' + sc('rev 00352-') + ' r53=' + sc('rev 00353-') + ' r54=' + sc('rev 00354-') + ' r55=' + sc('rev 00355-'));
  ok('S2 编辑器：:has 折叠态规则收窄在位 + 旧圆角方块规则零残留 + 32×32 正圆锚 + 展开态口径锚在位',
    el('.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle') === 1 &&
    el('{ left: 6px; }') === 1 &&
    el('left: 6px; border-left: 1px solid var(--divider-line-strong); border-radius: 6px;') === 0 &&
    el('border-left: none; border-radius: 0 6px 6px 0;') === 0 &&
    el('.asset-panel.collapsed + .asset-panel-toggle {') === 0 &&
    el('width: 32px; height: 32px;') === 1 &&
    el('left: calc(var(--asset-panel-w) + 6px)') === 1 &&
    el('--asset-panel-w: 260px') === 1 &&
    el('.asset-panel.collapsed {') === 1 &&
    el('transition: left 0.25s;') === 1 &&
    el("classList.toggle('collapsed')") === 1 &&
    el('v10.28.50.0') === 25 && el('v10.28.49.2') === 1 && el('v10.28.49.1') === 1,
    JSON.stringify({
      has: el('.canvas-body:has(.asset-panel.collapsed)'), circle: el('{ left: 6px; }'),
      oldc: el('left: 6px; border-left: 1px solid var(--divider-line-strong); border-radius: 6px;'),
      oldbase: el('border-left: none; border-radius: 0 6px 6px 0;'), oldadj: el('.asset-panel.collapsed + .asset-panel-toggle {'),
      size: el('width: 32px; height: 32px;'), base: el('left: calc(var(--asset-panel-w) + 6px)'),
      knob: el('--asset-panel-w: 260px'), col: el('.asset-panel.collapsed {'), trans: el('transition: left 0.25s;'),
      togg: el("classList.toggle('collapsed')"), v500: el('v10.28.50.0'), v492: el('v10.28.49.2'), v491: el('v10.28.49.1')
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

    // ═══ B1 展开态默认：按钮贴面板右缘 266px ═══
    {
      const f = await cdp.evalJs(PANEL_EXPR);
      ok('B1 展开态：按钮 left 266px / 正圆 32×32（radius 50%+四边 1px）/ ◂ / 面板宽 260px',
        f.left === '266px' && f.br === '50%' && f.blw === '1px' && f.w === '32px' && f.h === '32px' &&
        f.txt === '◂' && f.pw === '260px', JSON.stringify(f));
    }

    // ═══ B2 点击折叠：按钮随菜单滑到左缘 6px ═══
    {
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      await sleep(120);
      const mid = await cdp.evalJs(PANEL_EXPR);
      const midL = parseFloat(mid.left);
      ok('B2a 折叠中途采样：left 过渡中（10~250px 之间，证明按钮随菜单滑动而非瞬移）',
        midL > 10 && midL < 250, JSON.stringify(mid));
      await sleep(500);
      const f = await cdp.evalJs(PANEL_EXPR);
      ok('B2b 折叠终态：按钮 left 6px / 仍是正圆 32×32（radius 50%+四边 1px 恒同）/ ▸ / 面板宽 0',
        f.left === '6px' && f.br === '50%' && f.blw === '1px' && f.w === '32px' && f.h === '32px' &&
        f.txt === '▸' && f.pw === '0px' && f.brw === '0px', JSON.stringify(f));
    }

    // ═══ B3 点击展开：按钮回到 266px ═══
    {
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      await sleep(600);
      const f = await cdp.evalJs(PANEL_EXPR);
      ok('B3 展开回来：按钮 left 266px / 仍正圆 50% / ◂ / 面板宽 260px（往返零漂移）',
        f.left === '266px' && f.br === '50%' && f.txt === '◂' && f.pw === '260px', JSON.stringify(f));
    }

    // ═══ B4 往返后编辑器功能完好 ═══
    {
      await cdp.evalJs("(function(){ window.createAssetCard('text', 'T1', 3, 3, 6, 4); })()");
      await sleep(300);
      const f = await cdp.evalJs("(function(){ return {" +
        " card: !!document.querySelector('#gridCanvas .grid-card[data-label=\"T1\"]')," +
        " search: !!document.querySelector('.asset-panel .search-capsule input')," +
        " gc: !!document.getElementById('gridCanvas') }; })()");
      ok('B4 往返后功能完好：建卡成功 + 面板搜索框在位 + gridCanvas 在位',
        f.card && f.search && f.gc, JSON.stringify(f));
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      await sleep(600);
      const f2 = await cdp.evalJs("(function(){ return {" +
        " card: !!document.querySelector('#gridCanvas .grid-card[data-label=\"T1\"]')," +
        " left: getComputedStyle(document.querySelector('.asset-panel-toggle')).left }; })()");
      ok('B4b 再折叠：画布卡片不受影响 + 按钮仍滑到 6px',
        f2.card && f2.left === '6px', JSON.stringify(f2));
    }

    // ═══ E 零异常 ═══
    {
      const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
      const realErrs = cdp.errs.filter(e => !noise.test(e));
      ok('E 零异常（Runtime exception + 控制台 error 全滤噪声后）', realErrs.length === 0,
        realErrs.slice(0, 3).join(' | '));
    }
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
    try { cdp && cdp.close(); } catch (e2) {}
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  try { server.close(); } catch (e) {}

  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  process.exit(fail === 0 ? 0 : 1);
})();
