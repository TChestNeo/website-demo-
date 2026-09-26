// tmp-probe-single-resize.js — Round O 真身探针：组内单独选中单卡调整大小（用户报「没办法办到，只能长按拆分」）
// 真实事件序列（mousedown/mouseup/click/dblclick 带 detail + 手抖 wobble mousemove）+ elementFromPoint 命中测试
// 基线：电池（dblmodal S5/S10、group-resize S10）合成路径全绿，但用户真实操作失败 → 找合成路径没覆盖的差异
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-psr-' + Date.now());
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
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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
    const install = () => cdp.evalJs("(function(){ if (window.__psr) return true; " +
      // 真实双击：两次完整按下-抬起-click（detail 1/2）+ dblclick；两击间加 ±2px 手抖 mousemove（模拟真实手）
      "window.__realDblClick = function(el, cx, cy){ var m1 = new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0, detail: 1 }); el.dispatchEvent(m1); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx, clientY: cy, button: 0, detail: 1 })); el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy, button: 0, detail: 1 })); document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + 2, clientY: cy + 1 })); el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx + 2, clientY: cy + 1, button: 0, detail: 2 })); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + 2, clientY: cy + 1, button: 0, detail: 2 })); el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx + 2, clientY: cy + 1, button: 0, detail: 2 })); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: cx + 2, clientY: cy + 1, button: 0, detail: 2 })); return true; };" +
      "window.__center = function(el){ var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };" +
      // 真实手柄拖：mousedown 落在手柄元素自身（真实命中测试后浏览器会给的 target）→ document mousemove×3 → document mouseup
      "window.__dragHandle = function(dir, dx, dy){ var h = null; document.querySelectorAll('.resize-handle').forEach(function(x){ if (x.dataset.dir === dir) h = x; }); if (!h || h.style.display === 'none') return { err: 'handle ' + dir + ' hidden' }; var r = h.getBoundingClientRect(); var cx = r.left + r.width / 2, cy = r.top + r.height / 2; h.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0, cancelable: true })); for (var i = 1; i <= 3; i++) { document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + dx * i / 3, clientY: cy + dy * i / 3 })); } document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + dx, clientY: cy + dy, button: 0 })); return { ok: true }; };" +
      // 手柄命中测试：可见手柄中心 elementFromPoint 返回什么
      "window.__hitTest = function(){ var out = []; document.querySelectorAll('.resize-handle').forEach(function(h){ if (h.style.display === 'none') return; var r = h.getBoundingClientRect(); var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); out.push(h.dataset.dir + ':' + (el ? (el.className || el.tagName) : 'null')); }); return out; };" +
      "window.__cardGeo = function(el){ return { l: parseFloat(el.style.left) || 0, t: parseFloat(el.style.top) || 0, w: el.offsetWidth, h: el.offsetHeight, cs: el.dataset.colSpan, rs: el.dataset.rowSpan, g: el.dataset.groupId || null, single: el.classList.contains('group-single'), sel: el.classList.contains('selected'), rowIn: el.dataset.rowInGroup || null }; };" +
      "window.__psr = true; return true; })()");

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function' && typeof window.createContentCard === 'function'", 'load');
    await install();

    const log = (tag, obj) => console.log('  [' + tag + '] ' + JSON.stringify(obj));

    // ═══ E1：真实双击（带手抖）→ 单独选中 ═══
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 300, 200); var B = window.createFlagCard(); window.moveCardPx(B, 600, 200); window.mergeCards(B, A, 'right'); return true; })()");
    let r = JSON.parse(await cdp.evalJs("(function(){ var s = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]')[1]; var c = window.__center(s); window.__realDblClick(s, c.x, c.y); var sel = document.querySelectorAll('.grid-card.selected').length; var gs = document.querySelectorAll('.grid-card.group-single').length; var hv = []; document.querySelectorAll('.resize-handle').forEach(function(h){ if (h.style.display !== 'none') hv.push(h.dataset.dir); }); return JSON.stringify({ sel: sel, gs: gs, handlesVisible: hv }); })()"));
    log('E1 真实双击→单独选中', r);
    console.log('  E1 结论: ' + (r.gs === 1 && r.sel === 1 ? '单独选中成功' : '❌ 单独选中失败'));

    // ═══ E2：手柄命中测试（真实鼠标会点到的元素） ═══
    r = JSON.parse(await cdp.evalJs("JSON.stringify(window.__hitTest())"));
    log('E2 elementFromPoint 手柄命中', r);

    // ═══ E3：单卡 e 手柄真实拖 +60px → 尺寸变化？松手后粘住？组还完整？ ═══
    r = JSON.parse(await cdp.evalJs("(function(){ var cards = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]'); var s = cards[1], f = cards[0]; var before = { s: window.__cardGeo(s), f: window.__cardGeo(f) }; var dr = window.__dragHandle('e', 60, 0); var after = { s: window.__cardGeo(s), f: window.__cardGeo(f) }; return JSON.stringify({ before: before, drag: dr, after: after }); })()"));
    log('E3 单卡 e 拖', r);

    // ═══ E4：内容卡组同样流程（用户最常用卡型） ═══
    r = JSON.parse(await cdp.evalJs("(function(){ var A = window.createContentCard(); window.moveCardPx(A, 300, 500); var B = window.createContentCard(); window.moveCardPx(B, 600, 500); window.mergeCards(B, A, 'right'); var c = window.__center(B); window.__realDblClick(B, c.x, c.y); var hv = []; document.querySelectorAll('.resize-handle').forEach(function(h){ if (h.style.display !== 'none') hv.push(h.dataset.dir); }); var before = window.__cardGeo(B); var dr = window.__dragHandle('e', 60, 0); var after = window.__cardGeo(B); var gIntact = !!B.dataset.groupId && !!A.dataset.groupId; return JSON.stringify({ handlesVisible: hv, before: before, drag: dr, after: after, groupIntact: gIntact }); })()"));
    log('E4 内容卡组单卡 e 拖', r);

    // ═══ E5：单独选中后单击同卡 → 保持单独？（v10.28.21.1 口径） ═══
    r = JSON.parse(await cdp.evalJs("(function(){ var B = document.querySelectorAll('.grid-card[data-card-type=\"content\"]')[1]; var c = window.__center(B); B.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: c.x, clientY: c.y, button: 0, detail: 1 })); return JSON.stringify({ single: B.classList.contains('group-single'), sel: document.querySelectorAll('.grid-card.selected').length }); })()"));
    log('E5 单卡选中后单击同卡', r);

    // ═══ E6：长按（按下不动 700ms）→ 拆分基线（用户说「只能长按拆分」的路径） ═══
    r = JSON.parse(await cdp.evalJs("(async function(){ var cards = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]'); var s = cards[1]; var c = window.__center(s); window.__realDblClick(s, c.x, c.y); s.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: c.x, clientY: c.y, button: 0, detail: 1 })); await new Promise(function(res){ setTimeout(res, 750); }); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: c.x, clientY: c.y, button: 0 })); return JSON.stringify({ sGroup: !!s.dataset.groupId, fGroup: !!cards[0].dataset.groupId, sSingle: s.classList.contains('group-single') }); })()"));
    log('E6 长按 750ms 不动', r);

    // ═══ E7：单独选中后按下卡片拖动 40px（越过 3px 阈值）→ 拆出路径 ═══
    r = JSON.parse(await cdp.evalJs("(function(){ var cards = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); var A = cards[0], B = cards[1]; window.mergeCards(B, A, 'right'); var c = window.__center(B); window.__realDblClick(B, c.x, c.y); B.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: c.x, clientY: c.y, button: 0, detail: 1 })); document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: c.x + 40, clientY: c.y + 10 })); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: c.x + 40, clientY: c.y + 10, button: 0 })); return JSON.stringify({ bGroup: !!B.dataset.groupId, aGroup: !!A.dataset.groupId }); })()"));
    log('E7 单卡拖 40px 拆出', r);

    // ═══ Z：console error ═══
    await sleep(400);
    console.log('  Z console errors: ' + (cdp.errs.length === 0 ? '零 ✅' : JSON.stringify(cdp.errs.slice(0, 5))));

    await cdp.close();
    process.exitCode = 0;
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
