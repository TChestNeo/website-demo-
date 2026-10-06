// tmp-battery-dblmodal.js — v0.2.31.2 / FC v10.28.22 组内图源弹窗劫持双击修复电池
// （house CDP 模式；真实事件序列带 detail——真实双击=两次 click(detail 1/2)+dblclick，
//  旧电池只 dispatch dblclick 单体事件所以没抓到遮罩劫持）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-dbm2-' + Date.now());
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

(async () => {
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const dropAsset = (asset, label) => cdp.evalJs("(function(){ var dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify({ asset: " + JSON.stringify(asset) + ", label: " + JSON.stringify(label) + " })); window.gridCanvas.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return true; })()");
    const install = () => cdp.evalJs("(function(){ if (window.__batt) return true; " +
      "window.__modalOpen = function(){ return document.getElementById('modalBackdrop') && document.getElementById('modalBackdrop').classList.contains('active'); };" +
      "window.__state = function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); return { flagSel: !!(f && f.classList.contains('selected')), shieldSel: !!(s && s.classList.contains('selected')), flagSingle: !!(f && f.classList.contains('group-single')), flagGroup: !!(f && f.dataset.groupId), shieldGroup: !!(s && s.dataset.groupId), modal: window.__modalOpen() }; };" +
      "window.__clickAt = function(el, cx, cy, detail){ el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 })); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx, clientY: cy, button: 0 })); el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy, button: 0, detail: detail || 1 })); return true; };" +
      "window.__dblclickAt = function(el, cx, cy){ window.__clickAt(el, cx, cy, 1); window.__clickAt(el, cx, cy, 2); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: cx, clientY: cy, button: 0, detail: 2 })); return true; };" +
      "window.__center = function(el){ var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };" +
      "window.__clickSel = function(t, dbl){ var el = document.querySelector('.grid-card[data-card-type=\"' + t + '\"]'); if (!el) return 'no card'; var c = window.__center(el); (dbl ? window.__dblclickAt : window.__clickAt)(el, c.x, c.y); return true; };" +
      "window.__dragOut = function(t, dx, dy){ var el = document.querySelector('.grid-card[data-card-type=\"' + t + '\"]'); var c = window.__center(el); el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: c.x, clientY: c.y, button: 0 })); for (var i = 1; i <= 6; i++) { document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: c.x + dx * i / 6, clientY: c.y + dy * i / 6 })); } document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: c.x + dx, clientY: c.y + dy })); return true; };" +
      "window.__batt = true; return true; })()");
    const st = () => cdp.evalJs('JSON.stringify(window.__state())');

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await install();

    // ── S1/S2: 组外（独立）国旗/国徽卡单击仍弹图源（旧行为回归） ──
    await cdp.evalJs("window.__clickSel('flag'); true");
    let s = JSON.parse(await st());
    ok('S1 独立国旗卡单击弹图源（旧行为保留）', s.modal === true, JSON.stringify(s));
    await cdp.evalJs('window.closeAllModals(); true');
    await cdp.evalJs("window.__clickSel('shield'); true");
    s = JSON.parse(await st());
    ok('S2 独立国徽卡单击弹图源（旧行为保留）', s.modal === true, JSON.stringify(s));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── 建组 ──
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s2 = document.querySelector('.grid-card[data-card-type=\"shield\"]'); window.mergeCards(f, s2, 'right'); return true; })()");

    // ── S3: 组内国旗卡单击 → 整组选中 + 不弹图源（本轮核心修复） ──
    await cdp.evalJs("window.__clickSel('flag'); true");
    s = JSON.parse(await st());
    ok('S3 组内国旗卡单击=整组选中+不弹图源', s.flagSel && s.shieldSel && !s.flagSingle && !s.modal, JSON.stringify(s));

    // ── S4: 组内国徽卡单击 → 整组选中 + 不弹图源 ──
    await cdp.evalJs("window.__clickSel('shield'); true");
    s = JSON.parse(await st());
    ok('S4 组内国徽卡单击=整组选中+不弹图源', s.flagSel && s.shieldSel && !s.modal, JSON.stringify(s));

    // ── S5: 整组态双击国旗卡 → 单独选中 + 不弹图源 ──
    await cdp.evalJs("window.__clickSel('flag', true); true");
    s = JSON.parse(await st());
    ok('S5 整组态双击=单独选中+不弹图源', s.flagSingle && !s.shieldSel && !s.modal, JSON.stringify(s));

    // ── S6: 单独选中后单击同一张卡 → 保持单独 + 不弹 ──
    await cdp.evalJs("window.__clickSel('flag'); true");
    s = JSON.parse(await st());
    ok('S6 单独选中后单击同卡=保持单独+不弹', s.flagSingle && !s.modal, JSON.stringify(s));

    // ── S7: 单独选中后再双击 → 弹图源（用户钦定「双击才会触发」） ──
    await cdp.evalJs("window.__clickSel('flag', true); true");
    s = JSON.parse(await st());
    ok('S7 单独选中后再双击=弹图源', s.flagSingle && s.modal, JSON.stringify(s));

    // ── S8: 关弹窗后再双击 → 弹窗可重复 ──
    await cdp.evalJs('window.closeAllModals(); true');
    await cdp.evalJs("window.__clickSel('flag', true); true");
    s = JSON.parse(await st());
    ok('S8 关弹窗后再双击=再弹（可重复）', s.flagSingle && s.modal, JSON.stringify(s));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S9: 单独选中后单击另一成员 → 回整组 ──
    await cdp.evalJs("window.__clickSel('shield'); true");
    s = JSON.parse(await st());
    ok('S9 单独选中后单击另一成员=回整组', s.flagSel && s.shieldSel && !s.flagSingle && !s.modal, JSON.stringify(s));

    // ── S10: 单独选中后拖出 → 拆分（2 人组拆走 1 张 → 剩 1 张自动解散，splitCardFromGroup 注释「<2 张自动解散」） ──
    await cdp.evalJs("window.__clickSel('flag', true); true");
    await cdp.evalJs("window.__dragOut('flag', 240, 120); true");
    s = JSON.parse(await st());
    ok('S10 单独选中后拖出=拆分（国旗出组+剩 1 张组自动解散）', !s.flagGroup && !s.shieldGroup, JSON.stringify(s));

    // ── S11: 已设图的组内国旗卡单击/单独双击都不弹（既有 stripes 守卫回归） ──
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var stripes = document.createElement('div'); stripes.className = 'card-stripes'; f.appendChild(stripes); return true; })()");
    await cdp.evalJs("window.__clickSel('flag'); true");
    s = JSON.parse(await st());
    ok('S11a 已设图组内卡单击不弹（stripes 守卫）', !s.modal, JSON.stringify(s));
    await cdp.evalJs("window.__clickSel('flag', true); true");
    s = JSON.parse(await st());
    ok('S11b 已设图组内卡单独双击也不弹', !s.modal, JSON.stringify(s));

    // ── S12: 版本（静态：site v0.2.36.0 + FC v10.28.26.0 + buildDraft 链；运行时：页面含 v10.28.26.0） ──
    const fceSrc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
    const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
    const verRt = await cdp.evalJs("JSON.stringify({ mn: window.MN_SITE_VERSION, fc: window.FLUIDCANVAS_VERSION, badge: document.body.innerText.indexOf('v10.28.34.2') !== -1 })");
    ok('S12 版本 v0.2.45.2 + FC v10.28.34.2 + buildDraft 链 + 页面徽章（v0.2.45.2 复跑口径）',
      sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
      sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
      fceSrc.indexOf('v10.28.21.1 adds NO new fields (组内图源弹窗劫持双击修复') !== -1 &&
      JSON.parse(verRt).mn === 'v0.2.45.2' && JSON.parse(verRt).fc === 'v10.28.34.2' && JSON.parse(verRt).badge, verRt);

    // ── Z: 零 console error ──
    await sleep(400);
    ok('Z 零 console error', cdp.errs.length === 0, JSON.stringify(cdp.errs.slice(0, 3)));

    console.log('\n  ── 结果: ' + PASS + '/' + (PASS + FAIL) + (FAIL ? ' ❌' : ' 全绿 ✅'));
    await cdp.close();
    process.exitCode = FAIL ? 1 : 0;
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
