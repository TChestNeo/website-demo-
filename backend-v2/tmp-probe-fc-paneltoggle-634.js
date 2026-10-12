// tmp-probe-fc-paneltoggle-634.js — FC v10.28.49.1 折叠按钮随菜单移动线上探针（mnationworld.com）
//   S1a site-config：58.26 赋值 ×1 + FC 49.1 赋值 ×1 + 49.0 赋值零残留 + changelog 头 49.1/49.0 各 ×1；
//   S1b rev live 口径：rev 00352-真值 ×1 + 00352-XXX 零残留 + 00353-??? 占位 ×1 + 00353-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00353-终态，live 仍二次烘焙镜像）；
//   S1c 编辑器 live 8 锚（:has 折叠态规则/旧相邻兄弟死规则零残留/展开态口径锚/left 过渡/49.1 注释）；
//   P1 CDP 编辑器交互（种子 slati_session loggedIn）：展开态 266px→点击折叠→按钮滑到 6px+▸+面板宽 0→
//       点击展开→回 266px+◂→E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const REAL52 = '00352-sdl'; // deploy#1 实得 rev
const REAL53 = '00353-8d2'; // deploy#2 实得 rev（live 断言=零残留）
const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fcpt634-' + Date.now());
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
        this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        this.errs.push(JSON.stringify({ text: m.params.entry.text, url: m.params.entry.url || '' }).slice(0, 200));
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

const PANEL_EXPR = "(function(){ var b = document.querySelector('.asset-panel-toggle');" +
  " var p = document.querySelector('.asset-panel'); var bs = getComputedStyle(b), ps = getComputedStyle(p);" +
  " return { left: bs.left, br: bs.borderRadius, blw: bs.borderLeftWidth, txt: b.textContent.trim(), pw: ps.width }; })()";

(async () => {
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  console.log('═══ S1 静态锚（live site-config + 编辑器）═══');
  const sc = await fetch(SITE + '/assets/js/site-config.js');
  const scSrc = norm(await sc.text());
  const scCount = mk(scSrc);
  ok('S1a site-config：58.26 赋值 ×1 + FC 49.1 赋值 ×1 + 49.0 赋值零残留 + changelog 头 49.1/49.0 各 ×1',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.49.1';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.49.0';") === 0 &&
    scCount('// v10.28.49.1 = ') === 1 && scCount('// v10.28.49.0 = ') === 1,
    'v26=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") +
    ' fc491=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.49.1';") +
    ' fc490=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.49.0';") +
    ' cl491=' + scCount('// v10.28.49.1 = ') + ' cl490=' + scCount('// v10.28.49.0 = '));
  ok('S1b site-config rev live 口径：rev ' + REAL52 + ' ×1 + 00352-XXX 零残留 + 00353-??? 占位 ×1 + ' + REAL53 + ' 零残留（live 滞后一部署）',
    scCount('rev ' + REAL52) === 1 && scCount('00352-XXX') === 0 && scCount('00353-???') === 1 && scCount(REAL53) === 0,
    'r52=' + scCount('rev ' + REAL52) + ' x52=' + scCount('00352-XXX') + ' q53=' + scCount('00353-???') + ' r53=' + scCount(REAL53));

  const E = await fetch(ED);
  const eSrc = norm(await E.text());
  const elines = eSrc.split('\n');
  const c = (a) => elines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const E_ANCHORS = [['.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle', 1],
    ['.asset-panel.collapsed + .asset-panel-toggle {', 0],
    ['left: calc(var(--asset-panel-w) + 6px)', 1],
    ['left: 6px; border-left: 1px solid var(--divider-line-strong); border-radius: 6px;', 1],
    ['--asset-panel-w: 260px', 1], ['.asset-panel.collapsed {', 1],
    ['transition: left 0.25s;', 1], ['v10.28.49.1', 1]];
  const ebad = E_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1c 编辑器 8 锚全中（:has 折叠态规则/旧相邻兄弟死规则零残留/展开态口径锚/left 过渡/49.1 注释）', ebad.length === 0,
    ebad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '8/8');

  console.log('═══ P1 CDP 编辑器交互（展开 266px→折叠 6px→展开回来）═══');
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
    const pageTab = pages.find(x => x.type === 'page');
    const cdp = new CDP(pageTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable');
    const SESSION_SCRIPT = 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}';
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
    await cdp.send('Page.navigate', { url: ED });
    await waitFor(cdp, "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.toggleAssetPanel", 40000, '编辑器就绪');
    await sleep(900);
    {
      const f = await cdp.evalJs(PANEL_EXPR);
      ok('P1a 展开态：按钮 left 266px / ◂ / 面板宽 260px', f.left === '266px' && f.txt === '◂' && f.pw === '260px', JSON.stringify(f));
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      await sleep(600);
      const g = await cdp.evalJs(PANEL_EXPR);
      ok('P1b 点击折叠：按钮随菜单滑到 6px / 圆角方块 6px / ▸ / 面板宽 0', g.left === '6px' && g.br === '6px' && g.txt === '▸' && g.pw === '0px', JSON.stringify(g));
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      await sleep(600);
      const h = await cdp.evalJs(PANEL_EXPR);
      ok('P1c 点击展开：按钮回 266px / ◂ / 面板宽 260px（往返零漂移）', h.left === '266px' && h.txt === '◂' && h.pw === '260px', JSON.stringify(h));
    }
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|analytics|pageview/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 零异常（Runtime exception + Log error 全滤噪声后）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}

  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  process.exit(fail === 0 ? 0 : 1);
})();
