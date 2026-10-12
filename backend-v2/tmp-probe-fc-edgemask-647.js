// tmp-probe-fc-edgemask-647.js — FC v10.28.53.0 边缘 Mask 化线上探针（mnationworld.com）
//   S1a site-config live：53.0 赋值 ×1 + 52.5 赋值零残留 + 站点 58.28 ×1 + changelog 头 53.0/52.5/52.4 各 ×1；
//   S1b rev live 口径：rev 00379-6k8 ×1 + 00379-XXX 零残留 + 00380-??? 占位 ×1 + 00380-8kn 零残留
//      （live 滞后一部署=惯例：工作树已填 00380-8kn，live 仍是二次烘焙镜像）；
//   S1c 编辑器 live 8 锚（expandClipPct/CUSTOM_EDGE_EXPAND/--card-mask-clip/fcEdgeMaskSync/setEdgeMaskSync/
//      renderEdgeMaskSec/clipRaw/Mask 规则）；
//   S1d i18n fc.edge.maskSync ×12 语；S2 API health 200 + tables:66；S3 fc/edges 匿名 200（回归）；
//   P1 CDP 编辑器（假会话）：P1a 应用自定义 edge → edgeMask='1' + --card-mask-clip 原多边形 + --card-clip 外扩；
//      P1b 图片卡 .card-img-bg clipPath=原形 + 卡根不剪；P1c 勾选节三态（可见已勾 → 点击取消 → 重勾恢复）；
//      E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REAL79 = '00379-6k8'; // deploy#1 实得 rev（瞬态已直播）
const REAL80 = '00380-8kn'; // deploy#2 实得 rev（live 断言=零残留，滞后一部署）
const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fc647-' + Date.now());
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

const EDGE_CLIP = 'polygon(0% 0%, 100% 3%, 98% 97%, 3% 100%, 0% 0%)';
const EXP_EDGE = 'polygon(-3% -3%, 103% 0.18%, 100.88% 99.82%, 0.18% 103%, -3% -3%)';
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SESSION_SCRIPT = 'try{(function(){ localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "探针用户", citizenId: "CIT-000101", bio: "探针", gender: "Male", tier: "premium", avatarUrl: null, bannerUrl: null }));' +
  ' localStorage.setItem("slati_lang", "zh-CN"); try { localStorage.removeItem("slati_fluidcanvas_draft"); } catch (e) {} })();}catch(e){}';

const LIB_SEED = [
  { id: 'ce-mask1', name: 'Mask边', kind: 'edge', clip: EDGE_CLIP, clipSoft: null, createdAt: 1760000000000, source: 'ai', repoId: null }
];
const READY = "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.openEdgeDrawer && window.setCardEdge && window.setEdgeMaskSync && window.expandClipPct && window.createAssetCard && window.setCardImage && window.edgeMyApply";
const MCARD_EXPR = (label) => "(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"" + label + "\"]');" +
  " if (!c) return null;" +
  " var cs = getComputedStyle(c);" +
  " var img = c.querySelector('.card-img-bg');" +
  " return { edge: c.dataset.cardEdge || '', mask: c.dataset.edgeMask || ''," +
  "  clip: cs.getPropertyValue('--card-clip').trim(), maskVar: cs.getPropertyValue('--card-mask-clip').trim()," +
  "  imgClip: img ? getComputedStyle(img).clipPath : null, rootClip: cs.clipPath," +
  "  bgImg: !!img }; })()";
const MASK_SEC_EXPR = "(function(){ var sec = document.getElementById('fcEdgeMaskSec'); var cb = document.getElementById('fcEdgeMaskSync');" +
  " return { show: sec ? sec.style.display !== 'none' : null, checked: cb ? cb.checked : null }; })()";

(async () => {
  // ═══ S1 静态（live 文本口径）═══
  console.log('═══ S1 静态（live）═══');
  const sc = await hget(SITE + '/assets/js/site-config.js');
  const ed = await hget(ED);
  const i18n = await hget(SITE + '/assets/i18n/fluidcanvas.i18n.js');
  const scS = sc.body;
  const scC = (s) => scS.split(s).length - 1;
  ok('S1a site-config：53.0 赋值 ×1 + 52.5 赋值零残留 + 站点 58.28 ×1 + changelog 头 53.0/52.5/52.4 各 ×1',
    scC("window.FLUIDCANVAS_VERSION = 'v10.28.53.0';") === 1 && scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.5';") === 0 &&
    scC("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 &&
    scC('// v10.28.53.0 = ') === 1 && scC('// v10.28.52.5 = ') === 1 && scC('// v10.28.52.4 = ') === 1,
    'fc53=' + scC("window.FLUIDCANVAS_VERSION = 'v10.28.53.0';") + ' fc525=' + scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.5';") +
    ' cl53=' + scC('// v10.28.53.0 = ') + ' cl525=' + scC('// v10.28.52.5 = ') + ' cl524=' + scC('// v10.28.52.4 = '));
  ok('S1b rev live 口径：rev ' + REAL79 + ' ×1 + 00379-XXX 零残留 + 00380-??? 占位 ×1 + ' + REAL80 + ' 零残留（live 滞后一部署）',
    scC(REAL79) === 1 && scC('00379-XXX') === 0 && scC('00380-???') === 1 && scC(REAL80) === 0,
    'r79=' + scC(REAL79) + ' p79=' + scC('00379-XXX') + ' p80=' + scC('00380-???') + ' r80=' + scC(REAL80));
  const edLines = ed.body.split(/\r?\n/);
  const el = (a) => edLines.filter((l) => l.includes(a)).length;
  const eanchors = [
    ['function expandClipPct', 1], ['CUSTOM_EDGE_EXPAND', 2], ['--card-mask-clip', 5],
    ['fcEdgeMaskSync', 3], ['setEdgeMaskSync', 3], ['renderEdgeMaskSec', 3], ['clipRaw', 4],
    ['.grid-card .card-stripes { clip-path: var(--card-mask-clip, none); }', 1]
  ];
  const ebad = eanchors.filter(([a, n]) => el(a) !== n).map(([a, n]) => a + '=' + el(a) + '≠' + n);
  ok('S1c 编辑器 live 8 锚全中（expandClipPct/CUSTOM_EDGE_EXPAND/--card-mask-clip/fcEdgeMaskSync/setEdgeMaskSync/renderEdgeMaskSec/clipRaw/Mask 规则）',
    ebad.length === 0, ebad.join(',') || '8/8');
  const ic = (s) => i18n.body.split(s).length - 1;
  ok('S1d i18n：fc.edge.maskSync ×12 语', ic('"fc.edge.maskSync"') === 12, 'ms=' + ic('"fc.edge.maskSync"'));

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
    await waitFor(cdp, READY, 40000, 'P1 编辑器就绪');
    await sleep(900);

    await cdp.evalJs("localStorage.setItem('slati_custom_edges', " + JSON.stringify(JSON.stringify(LIB_SEED)) + ")");
    await cdp.evalJs("(function(){ window.createAssetCard('text', 'IMG1', 10, 2, 6, 4); })()");
    await sleep(400);
    await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"IMG1\"]'); window.setCardImage(c, " + JSON.stringify(PNG_1PX) + ", 'IMG1'); })()");
    await sleep(500);
    await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"IMG1\"]'); window.selectCard(c, true); return !!c; })()");
    await sleep(250);
    await cdp.evalJs('(function(){ window.edgeMyApply("ce-mask1"); })()');
    await sleep(400);
    const card = await cdp.evalJs(MCARD_EXPR('IMG1'));
    ok('P1a 应用自定义 edge live：edgeMask=\'1\' + --card-mask-clip 原多边形 + --card-clip 外扩',
      card && card.edge === 'custom:ce-mask1' && card.mask === '1' && card.maskVar === EDGE_CLIP && card.clip === EXP_EDGE,
      JSON.stringify(card));
    ok('P1b 图片卡 Mask live：.card-img-bg clipPath=原多边形 + 卡根不剪（rootClip none）',
      card && card.bgImg === true && card.imgClip === EDGE_CLIP && card.rootClip === 'none',
      JSON.stringify(card));

    await cdp.evalJs('(function(){ window.openEdgeDrawer("edge"); })()');
    await sleep(400);
    let sec = await cdp.evalJs(MASK_SEC_EXPR);
    ok('P1c 勾选节三态①：抽屉开 → 勾选节可见 + 已勾（edge 种默认）', sec && sec.show === true && sec.checked === true, JSON.stringify(sec));
    await cdp.evalJs("(function(){ var cb = document.getElementById('fcEdgeMaskSync'); if (cb) cb.click(); return !!cb; })()");
    await sleep(400);
    const card2 = await cdp.evalJs(MCARD_EXPR('IMG1'));
    sec = await cdp.evalJs(MASK_SEC_EXPR);
    ok('P1c 勾选节三态②：点击取消 → edgeMask=\'0\' + maskVar 移除 + img 回整矩形 none + 未勾',
      card2 && card2.mask === '0' && card2.maskVar === '' && card2.imgClip === 'none' && sec && sec.checked === false,
      JSON.stringify({ card: card2, sec: sec }));
    await cdp.evalJs('(function(){ window.setEdgeMaskSync(true); })()');
    await sleep(400);
    const card3 = await cdp.evalJs(MCARD_EXPR('IMG1'));
    sec = await cdp.evalJs(MASK_SEC_EXPR);
    ok('P1c 勾选节三态③：重勾恢复 → edgeMask=\'1\' + img clipPath 原形回来 + 已勾',
      card3 && card3.mask === '1' && card3.maskVar === EDGE_CLIP && card3.imgClip === EDGE_CLIP && sec && sec.checked === true,
      JSON.stringify({ card: card3, sec: sec }));

    // E1 零异常
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 零异常（实际 ' + realErrs.length + ' 条）', realErrs.length === 0, realErrs.join(' | '));
  } catch (e) {
    console.log('  💥 ' + (e && e.message || e));
    fail++;
  } finally {
    try { cdp && cdp.close(); } catch (e) {}
    try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
    (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  }
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail ? 1 : 0);
})();
