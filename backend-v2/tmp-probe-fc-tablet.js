// tmp-probe-fc-tablet.js — FC v10.28.44.1 iPad 触控桥上线实机探针
// 用户「能不能先对平板做一下FC的操作适配？」——43.0 线上实证：S 静态（线上 site-config 43.0
//   +iPad 触控 changelog+站点 58.0 恒、编辑器页 script 标签+7577 守卫+粗指针 CSS 锚、
//   fc-touch.js 可加载）/ B 实机触控（CDP iPad 仿真：tap 选中 / 拖卡 / 长按菜单 / 捏合 / 平移 / 资产建卡）。
// 全 Node 内置模块：https + ws CDP（登录态 stub 同探针 S12 口径）。
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
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
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

(async () => {
  const BASE = 'https://mnationworld.com';

  // ── S 线上静态 ──
  const sc = await get(BASE + '/assets/js/site-config.js');
  ok('S1 线上 site-config：FC v10.28.44.1 + iPad 触控 changelog 条目 + rev 00291- + 站点恒 v0.2.58.0',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.44.1';") !== -1 &&
    sc.body.indexOf('iPad 触控适配') !== -1 && sc.body.indexOf('rev 00291-') !== -1 &&
    sc.body.indexOf('v0.2.58.0') !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const fc = await get(BASE + '/pages/fluidcanvas-editor.html');
  ok('S2 线上编辑器页：fc-touch.js script 标签 + 7577 守卫 + 粗指针 CSS 锚在场',
    fc.status === 200 &&
    fc.body.indexOf('<script src="../assets/js/fc-touch.js"></script>') !== -1 &&
    fc.body.indexOf('window.__fcTouchGesture') !== -1 &&
    fc.body.indexOf('@media (hover: none) and (pointer: coarse)') !== -1 &&
    fc.body.indexOf('touch-action: none') !== -1,
    'status=' + fc.status + ' err=' + fc.error);
  const tj = await get(BASE + '/assets/js/fc-touch.js');
  ok('S3 线上 fc-touch.js：可加载 + 粗指针门控/测试钩/守卫旗在位',
    tj.status === 200 &&
    tj.body.indexOf("matchMedia('(pointer: coarse)')") !== -1 &&
    tj.body.indexOf('window.__fcTouch') !== -1 &&
    tj.body.indexOf('__fcTouchGesture') !== -1,
    'status=' + tj.status + ' err=' + tj.error);

  // ── B 线上实机触控（iPad 仿真）──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const CDP_PORT = 9600 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fctablet-' + Date.now());
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
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 834, height: 1194, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!document.getElementById('gridCanvas') && !!window.createSneCard && !!window.__fcTouch", 30000, 'B 编辑器加载');
    await sleep(800);

    const tch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts });
    const tpoint = (id, x, y) => ({ x: Math.round(x), y: Math.round(y), radiusX: 2, radiusY: 2, force: 1, id: id });
    const tapAt = async (x, y) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(50); await tch('touchEnd', []); await sleep(120); };
    const dragTouch = async (x1, y1, x2, y2, steps) => {
      await tch('touchStart', [tpoint(0, x1, y1)]);
      await sleep(30);
      for (let i = 1; i <= steps; i++) {
        await sleep(16);
        await tch('touchMove', [tpoint(0, x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps)]);
      }
      await sleep(25);
      await tch('touchEnd', []);
      await sleep(100);
    };
    const holdTouch = async (x, y, ms) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(ms); await tch('touchEnd', []); await sleep(120); };
    const emptyPoint = () => cdp.evalJs("(function(){ var cv = document.getElementById('gridCanvas');" +
      " for (var y = 80; y < 1150; y += 36) for (var x = 80; x < 800; x += 36) {" +
      "  var el = document.elementFromPoint(x, y);" +
      "  if (el && (el === cv || (el.closest && el.closest('.grid-group-bg')))) return { x: x, y: y }; } return null; })()");
    const cardPoint = () => cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card');" +
      " if (!c) return null; var r = c.getBoundingClientRect();" +
      " var bad = 'input, textarea, select, button, a, [contenteditable=\"true\"], .card-text-content, .card-edit-field, .card-label, .resize-handle, .rotate-grip, .sheet-col-grip, .sheet-row-grip';" +
      " for (var fy = 0.2; fy <= 0.85; fy += 0.15) for (var fx = 0.2; fx <= 0.85; fx += 0.15) {" +
      "  var el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);" +
      "  if (el && el.closest('.grid-card') === c && !el.closest(bad)) return { x: Math.round(r.left + r.width * fx), y: Math.round(r.top + r.height * fy) };" +
      " } return null; })()");

    const gate = await cdp.evalJs("(function(){ return { coarse: matchMedia('(pointer: coarse)').matches, mtp: navigator.maxTouchPoints, bridge: !!window.__fcTouch }; })()");
    ok('B0 门控自证：coarse 媒体查询翻转 + maxTouchPoints=5 + 触控桥在场',
      gate && gate.coarse === true && gate.mtp === 5 && gate.bridge, JSON.stringify(gate));

    await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
    await sleep(200);
    const pt = await cardPoint();
    await tapAt(pt.x, pt.y);
    const b1 = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card');" +
      " return { sel: c.classList.contains('selected'), handles: document.querySelectorAll('#gridCanvas .resize-handle').length, tap: window.__fcTouch.stats.tap }; })()");
    ok('B1 tap 选中：.selected + 8 手柄 + stats.tap=1', b1 && b1.sel === true && b1.handles === 8 && b1.tap === 1, JSON.stringify(b1));

    await cdp.evalJs("(function(){ if (document.getElementById('snapToggle').classList.contains('active')) window.toggleSnap();" +
      " if (document.getElementById('alignToggle').classList.contains('active')) window.toggleAlign(); return true; })()");
    const bd = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0 }; })()");
    const pt2 = await cardPoint();
    await dragTouch(pt2.x, pt2.y, pt2.x + 60, pt2.y + 40, 12);
    await sleep(40);
    const ad = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card');" +
      " return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0, jd: c.dataset.justDragged || '', drag: window.__fcTouch.stats.drag }; })()");
    ok('B2 拖卡：+60/+40 位移 ±2 + justDragged + stats.drag=1',
      Math.abs((ad.l - bd.l) - 60) <= 2 && Math.abs((ad.t - bd.t) - 40) <= 2 && ad.jd === '1' && ad.drag === 1,
      JSON.stringify({ before: bd, after: ad }));

    await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); c.dataset.groupId = 'probe-g1'; return true; })()");
    const pt3 = await cardPoint();
    await holdTouch(pt3.x, pt3.y, 650);
    const b3 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu'); var c = document.querySelector('#gridCanvas .sne-card');" +
      " return { menuOpen: !!m && getComputedStyle(m).display !== 'none', longPress: window.__fcTouch.stats.longPress, gid: c.dataset.groupId || '' }; })()");
    ok('B3 长按菜单：菜单现身 + stats.longPress=1 + groupId 未被拆分计时器拆走',
      b3 && b3.menuOpen === true && b3.longPress === 1 && b3.gid === 'probe-g1', JSON.stringify(b3));
    await cdp.evalJs("var cm = document.querySelector('.context-menu'); if (cm) cm.style.display = 'none'");

    const ep = await emptyPoint();
    const zb = await cdp.evalJs("(function(){ var cv = document.getElementById('gridCanvas'); return parseFloat(cv.style.zoom) || 1; })()");
    await tch('touchStart', [tpoint(0, ep.x - 100, ep.y), tpoint(1, ep.x + 100, ep.y)]);
    for (let i = 1; i <= 4; i++) {
      await sleep(20);
      await tch('touchMove', [tpoint(0, ep.x - 100 - i * 10, ep.y), tpoint(1, ep.x + 100 + i * 10, ep.y)]);
    }
    await tch('touchEnd', []);
    await sleep(200);
    const za = await cdp.evalJs("(function(){ var cv = document.getElementById('gridCanvas'); return { z: parseFloat(cv.style.zoom) || 1, pinch: window.__fcTouch.stats.pinch }; })()");
    ok('B4 双指捏合：zoom ' + zb + ' → ' + za.z + '（1.4±0.1）+ stats.pinch≥1',
      za.z > 1.3 && za.z < 1.5 && za.pinch >= 1, JSON.stringify(za));
    await cdp.evalJs('window.resetViewZoom ? window.resetViewZoom() : 0');
    await sleep(250);

    const ep2 = await emptyPoint();
    await cdp.evalJs('window.__fcTouch.stats.pan = 0');
    const p0 = await cdp.evalJs("(function(){ var eb = document.querySelector('.editor-body'); return { l: eb.scrollLeft, t: eb.scrollTop }; })()");
    await dragTouch(ep2.x, ep2.y, ep2.x - 80, ep2.y - 50, 12);
    const pr = await cdp.evalJs("(function(){ var eb = document.querySelector('.editor-body'); return { l: eb.scrollLeft, t: eb.scrollTop, pan: window.__fcTouch.stats.pan }; })()");
    ok('B5 单指平移：scrollLeft ≥+60、scrollTop ≥+30 + stats.pan=1',
      (pr.l - p0.l) >= 60 && (pr.t - p0.t) >= 30 && pr.pan === 1, JSON.stringify({ p0: p0, pr: pr }));

    const assetPt = await cdp.evalJs("(function(){ var a = document.querySelector('.asset-panel .card[draggable][data-asset=\"flag\"]');" +
      " if (!a) return null; var r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, inView: r.top >= 0 && r.bottom <= window.innerHeight }; })()");
    const cb = await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length");
    await tapAt(assetPt.x, assetPt.y);
    await sleep(150);
    const b6 = await cdp.evalJs("(function(){ var cards = document.querySelectorAll('#gridCanvas .grid-card'); var c = cards[cards.length - 1];" +
      " var r = c.getBoundingClientRect(); var cx = window.innerWidth / 2, cy = window.innerHeight / 2;" +
      " return { count: cards.length, center: cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom, asset: window.__fcTouch.stats.asset }; })()");
    ok('B6 tap 资产建卡：卡数 +1 + 新卡覆盖视口中心 + stats.asset=1',
      assetPt && assetPt.inView && b6.count === cb + 1 && b6.center === true && b6.asset === 1,
      JSON.stringify({ assetPt: assetPt, b6: b6 }));

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
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (fc-tablet-live)      │');
  console.log('╰──────────────────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
})().catch((e) => { console.error('💥 探针异常: ' + (e && e.stack || e)); process.exit(1); });
