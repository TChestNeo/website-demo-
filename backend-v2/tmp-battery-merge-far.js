// tmp-battery-merge-far.js — v0.2.30.1 吸合误判修复验证（2026-09-11）
// 背景：用户「为什么我把卡片拖到一个位置他会被一个和他没有任何接近的卡片吸附合并？
// 这是否是网页html和css带来的一些bug导致的？」——真身=纯 JS 判定 bug：
// findMergeSnap 只按单轴边距 ≤12px 判命中，同高不同 x 的卡隔着一千多像素
// 照样被吸（探针 tmp-merge-far-probe.js 实况抓出）。修法=边对判定加垂直轴
// 严格重叠守卫（x 轴边对→y 范围相交；y 轴边对→x 范围相交）。
// 断言组：
//   F1-F2 静态：守卫代码/版本号与版本链；
//   S1-S4 findMergeSnap 直调：远 x 同高不命中/远 y 同 x 不命中/近邻仍命中/旋转目标仍命中；
//   S5 端到端：真实合成拖拽到远处同高位置——拖中无 merge-target、松手不成组；
//   S6 端到端：拖到近邻——吸合提交成组（groupId 共享+组背景在场）；
//   S7 版本徽章；Z 全程零 console error。
// 跑法：node backend-v2/tmp-battery-merge-far.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4600 + Math.floor(Math.random() * 300);
const CDP_PORT = 5700 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-mergebat-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
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
        this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
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
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } };

  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;

  // ── F1-F2 静态 ──
  const fce = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F1 静态：findMergeSnap 垂直轴严格重叠守卫（x 边对→y 相交 / y 边对→x 相交）+ v10.28.20.1 注释',
    fce.indexOf("if (p[2] === 'x' && (self.bottom <= tgt.top || self.top >= tgt.bottom)) return;") !== -1 &&
    fce.indexOf("if (p[2] === 'y' && (self.right <= tgt.left || self.left >= tgt.right)) return;") !== -1 &&
    fce.indexOf('v10.28.20.1: 边对判定必须同时满足垂直轴重叠') !== -1);
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F2 静态：当前版本 v0.2.45.2 + v10.28.34.2 + 注释链保留 v10.28.20.1 条目 + buildDraft 链新条目',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    sconf.indexOf('补丁位 0→1·纯修复轮；2026-09-11') !== -1 &&
    fce.indexOf('v10.28.20.1 adds NO new fields (吸合误判修复') !== -1);

  // ── Chrome CDP ──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1400,1000', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('CDP 没起来');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    console.log('  ℹ CDP 就绪');

    // 注：不预清 slati_fluidcanvas_draft（S12 陷阱）——全新 --user-data-dir 本就空 localStorage。
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.findMergeSnap === 'function'", 20000, '编辑器加载');
    await sleep(600);

    // 铺卡：A1 拖卡、B 远目标（同高不同 x）、C 近目标、D 远目标（同 x 不同高）、E 旋转目标
    const setup = await cdp.evalJs(`(function(){
      var A1 = window.createFlagCard(); window.moveCardPx(A1, 60, 60);
      var B = window.createFlagCard(); window.moveCardPx(B, 1050, 38);
      var C = window.createFlagCard(); window.moveCardPx(C, 400, 200);
      var D = window.createContentCard(); window.moveCardPx(D, 700, 60);
      var E = window.createMapCard(); window.moveCardPx(E, 60, 200);
      E.dataset.rotate = 45; E.style.transform = 'rotate(45deg)';
      return { a: A1.dataset.cardId, b: B.dataset.cardId, c: C.dataset.cardId, d: D.dataset.cardId, e: E.dataset.cardId };
    })()`);
    console.log('  ℹ 铺卡完成:', JSON.stringify(setup));
    await sleep(300);

    // 所有几何坐标一律运行时动态算（各卡默认尺寸不定，硬编码必翻车）——
    // relRect = 卡视觉 rect 相对画布；守卫/边距数学全部纸上先算（见各断言名）。
    const helpers = "function byId(id){ return Array.from(document.querySelectorAll('.grid-card')).find(function(c){ return c.dataset.cardId === id; }); }" +
      "function relRect(el){ var cr = document.querySelector('.grid-canvas').getBoundingClientRect(); var b = el.getBoundingClientRect(); return { left: b.left - cr.left, top: b.top - cr.top, right: b.right - cr.left, bottom: b.bottom - cr.top }; }";

    // ── S1-S4 findMergeSnap 直调（负对照=旧代码必命中、正对照=真近邻） ──
    ok('S1 远 x 同高不命中：拖卡上边距目标 B 底边仅 8px（旧代码 y 轴必吸），x 相距千余像素 → 垂直轴守卫拦下返回 null',
      await cdp.evalJs(helpers + "(function(){ var m = window.findMergeSnap(byId('" + setup.a + "'), 0, relRect(byId('" + setup.b + "')).bottom - 8); return m === null; })()"));
    ok('S2 远 y 同 x 不命中：拖卡右边与目标 D 左边齐平仅 6px（旧代码 x 轴必吸），y 相距 300+px → 水平轴守卫拦下返回 null',
      await cdp.evalJs(helpers + "(function(){ var rd = relRect(byId('" + setup.d + "')); var wA = byId('" + setup.a + "').offsetWidth; var m = window.findMergeSnap(byId('" + setup.a + "'), rd.left - wA - 6, rd.bottom + 300); return m === null; })()"));
    ok('S3 近邻仍命中：拖卡底边距目标 C 顶边 2px 且 x 重叠 → 返回 {axis:y, target:C}',
      await cdp.evalJs(helpers + "(function(){ var A = byId('" + setup.a + "'), C = byId('" + setup.c + "'), rc = relRect(C); var m = window.findMergeSnap(A, rc.left + 10, rc.top - A.offsetHeight - 2); return !!m && m.axis === 'y' && m.target === C && Math.abs(m.d - 2) <= 1; })()"));
    ok('S4 旋转目标仍命中：E 旋转 45° 后视觉 bbox 顶边距拖卡底边 2px → 感知旋转命中 E',
      await cdp.evalJs(helpers + "(function(){ var A = byId('" + setup.a + "'), E = byId('" + setup.e + "'), re = relRect(E); var m = window.findMergeSnap(A, re.left + 5, re.top - A.offsetHeight - 2); return !!m && m.axis === 'y' && m.target === E && Math.abs(m.d - 2) <= 1; })()"));

    // ── S5 端到端：真实合成拖拽 → 远处同高位置，全程不成组 ──
    const dragTo = (cdp2, id, tx, ty) => cdp2.evalJs(helpers + `(function(){
      var card = byId('${id}');
      var rect = document.querySelector('.grid-canvas').getBoundingClientRect();
      var l = parseFloat(card.style.left) || 0, t = parseFloat(card.style.top) || 0;
      var startX = rect.left + l + 6, startY = rect.top + t + 6;
      card.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: startX, clientY: startY, bubbles: true, cancelable: true }));
      var cx = rect.left + ${tx} + 6, cy = rect.top + ${ty} + 6;
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      return true;
    })()`);
    const dropAt = (cdp2, tx, ty) => cdp2.evalJs(`(function(){
      var rect = document.querySelector('.grid-canvas').getBoundingClientRect();
      var cx = rect.left + ${tx} + 6, cy = rect.top + ${ty} + 6;
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      return true;
    })()`);

    // S5 端到端负对照：真实拖到「B 正下方同 x 远处、上边距 B 底边 8px」——
    // 旧代码在此位置吸合并把卡拽进 x≈1050 的 B 组；修复后必须全程无吸合。
    const s5pos = await cdp.evalJs(helpers + "(function(){ var rb = relRect(byId('" + setup.b + "')); return { x: 0, y: Math.round(rb.bottom - 8) }; })()");
    await dragTo(cdp, setup.a, s5pos.x, s5pos.y);
    await sleep(200);
    ok('S5a 拖到远处同高位置：拖中无 merge-target 高亮（旧代码此处已点亮远处 B）',
      await cdp.evalJs("document.querySelectorAll('.merge-target').length === 0"));
    await dropAt(cdp, s5pos.x, s5pos.y);
    await sleep(300);
    ok('S5b 松手不成组：无 groupId、无组背景、无合并 toast、卡片停在落点附近（x<200，未被拽走）',
      await cdp.evalJs(helpers + `(function(){
        var a = byId('${setup.a}');
        var l = parseFloat(a.style.left) || 0;
        var toast = Array.from(document.querySelectorAll('.toast, [class*="toast"]')).some(function(el){ return el.textContent.indexOf('已合并') !== -1; });
        return !a.dataset.groupId && !document.querySelector('.grid-group-bg') && !toast && l < 200;
      })()`));

    // ── S6 端到端：真实合成拖拽 → 近邻 C 上方，吸合提交成组 ──
    // S6 端到端正对照：真实拖到 C 正上方（底边距 C 顶边 2px、x 重叠）→
    // 吸合提交成组（守卫不能把真近邻也误杀）。
    const s6pos = await cdp.evalJs(helpers + "(function(){ var A = byId('" + setup.a + "'), rc = relRect(byId('" + setup.c + "')); return { x: Math.round(rc.left + 10), y: Math.round(rc.top - A.offsetHeight - 2) }; })()");
    await dragTo(cdp, setup.a, s6pos.x, s6pos.y);
    // v0.2.45.2：rAF 合并后吸合高亮在帧回调里画——--disable-gpu 环境 rAF 慢，
    // 固定 200ms 撞帧相位假红 → 收敛轮询（house 模式同 autosave S3a）
    const s6m = await cdp.evalJs(`(async function(){ var t0 = Date.now(), m = null; while (Date.now() - t0 < 1200 && !m) { await new Promise(function(r){ setTimeout(r, 50); }); m = document.querySelector('.merge-target'); } return m ? m.dataset.cardId : null; })()`);
    ok('S6a 拖到近邻上方：merge-target 高亮正确点亮目标 C（不是远处的 B）', s6m === setup.c);
    await dropAt(cdp, s6pos.x, s6pos.y);
    await sleep(400);
    ok('S6b 松手提交成组：A1 与 C 共享 groupId + 组背景在场 + 合并 toast',
      await cdp.evalJs(helpers + `(function(){
        var a = byId('${setup.a}'), c = byId('${setup.c}');
        var toast = Array.from(document.querySelectorAll('.toast, [class*="toast"]')).some(function(el){ return el.textContent.indexOf('已合并') !== -1; });
        return !!a.dataset.groupId && a.dataset.groupId === c.dataset.groupId && !!document.querySelector('.grid-group-bg') && toast;
      })()`));

    ok('S7 版本徽章：右下角 badge 渲染 FC v10.28.34.2',
      await cdp.evalJs("(function(){ var ds = document.querySelectorAll('body > div'); for (var i=0;i<ds.length;i++){ if (ds[i].textContent === 'FC v10.28.34.2') return true; } return false; })()"));

    ok('Z 零 console error', cdp.errs.length === 0);
    if (cdp.errs.length) console.log('  errors:', JSON.stringify(cdp.errs).slice(0, 600));

    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n  ── 结果: ' + pass + '/' + (pass + fail) + ' 全绿' + (fail === 0 ? ' ✅' : ' ❌'));
  if (fail) process.exit(1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
