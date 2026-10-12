// tmp-migrate-btn-v02815-probe.js — v0.2.28.15 Migrate 按钮定制验证（2026-09-11）
// 背景：v0.2.28.14 恢复了两套样式；v0.2.28.15 用户四项定制——①大小对齐旁边 .btn-sm
//   （History/Tags/Save Draft/Publish）②药丸形 ③横扫面板黑→白（亮/暗一致）④字母黑白相反
//   滤镜（静息 invert(1) 黑字压白面板，悬停面板滑离同步翻白字、0.4s 同曲线丝滑）。
// 断言组：
//   F1 静态：新样式在（radius-full 药丸 + fs-label-sm + svg 24px + 白面板 + invert 双态）；
//   S1 尺寸对齐：与邻居 .btn-outline.btn-sm（History）高度差 ≤1px + font-size 一致；
//   S2 静息：药丸 9999px + span filter=invert(1) + 白面板 rgb(255,255,255) + skew c=0.57735；
//   S3 悬停：面板横扫 translateX>100 + span filter 翻回 invert(0)（同步滑离）；
//   S4 按下：scale(0.95)；
//   S5 点击开弹窗回归：modalBackdrop + migrateCard 双 active；
//   S6 暗色：面板仍白 rgb(255,255,255) + 静息 filter 仍 invert(1)（两主题一致）；
//   Z 全程零 console error。
// 跑法：node tmp-migrate-btn-v02815-probe.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4410 + Math.floor(Math.random() * 400);
const CDP_PORT = 5410 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-migrate15-' + Date.now());

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
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
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

  // —— F1 静态：v0.2.28.15 定制样式在 ——
  const t = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  const btIdx = t.indexOf('.migrate-btn {');
  const spanIdx = t.indexOf('.migrate-btn span {', btIdx);
  const beforeIdx = t.indexOf('.migrate-btn::before {', spanIdx);
  ok('F1 静态：药丸形 radius-full + fs-label-sm + svg 24px + 白面板 + invert 双态（v0.2.28.15 定制块）',
    t.indexOf('border-radius: var(--radius-full);', btIdx) !== -1 &&
    t.indexOf('font-size: var(--fs-label-sm);', btIdx) !== -1 &&
    t.indexOf('width: 24px;', spanIdx) !== -1 &&
    t.indexOf('filter: invert(1);', spanIdx) !== -1 &&
    t.indexOf('.migrate-btn:hover span {', spanIdx) !== -1 &&
    t.indexOf('filter: invert(0);', spanIdx) !== -1 &&
    t.indexOf('background: #fff;', beforeIdx) !== -1);

  // —— Chrome CDP ——
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!up) throw new Error('CDP 没起来');
  const pageInfo = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' })).json();
  const cdp = new CDP(pageInfo.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  try {
    // 编辑器页有未登录门禁——先落 FC 首页（同源无门禁）种 session，再进编辑器页。
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas.html' });
    await waitFor(cdp, "document.readyState === 'complete'", 10000, 'FC 首页就绪');
    await cdp.evalJs(`(() => {
      localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, user: { id: 'USR-TEST', displayName: 'Probe' } }));
      return true;
    })()`);
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "document.querySelector('.migrate-btn') && document.getElementById('migrateModal')", 15000, '编辑器页就绪');
    await sleep(800);

    // —— S1 尺寸对齐：与邻居 .btn-outline.btn-sm（History）——
    ok('S1 尺寸对齐：高度差 ≤1px + font-size 与邻居 .btn-sm 一致（v0.2.28.15）', await cdp.evalJs(`(() => {
      var m = document.querySelector('.migrate-btn');
      var n = document.querySelector('.editor-header .btn-outline.btn-sm');
      var hM = getComputedStyle(m).height, hN = getComputedStyle(n).height;
      var fM = getComputedStyle(m).fontSize, fN = getComputedStyle(n).fontSize;
      if (!(Math.abs(parseFloat(hM) - parseFloat(hN)) <= 1 && fM === fN)) {
        console.log('[S1 实际]', hM, 'vs', hN, '| font', fM, 'vs', fN);
        return false;
      }
      return true;
    })()`));

    // —— S2 静息：药丸 + invert(1) 黑字 + 白面板 + skew ——
    ok('S2 静息：药丸 9999px + span filter=invert(1) + 白面板 + skew c=0.57735', await cdp.evalJs(`(() => {
      var b = document.querySelector('.migrate-btn');
      var cs = getComputedStyle(b);
      var sp = getComputedStyle(b.querySelector('span'));
      var bs = getComputedStyle(b, '::before');
      var m = bs.transform.replace('matrix(', '').replace(')', '').split(',').map(parseFloat);
      if (!(cs.borderRadius === '9999px' && sp.filter === 'invert(1)' &&
        bs.backgroundColor === 'rgb(255, 255, 255)' &&
        m.length === 6 && Math.abs(m[2] - 0.57735) < 0.001)) {
        console.log('[S2 实际]', cs.borderRadius, '|', sp.filter, '|', bs.backgroundColor, '|', bs.transform);
        return false;
      }
      return true;
    })()`));

    // —— S3 悬停：白面板滑离 + 字母同步翻白（forcePseudoState；transition 竞态等 700ms）——
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const doc3 = await cdp.send('DOM.getDocument', { depth: -1 });
    const btn3 = await cdp.send('DOM.querySelector', { nodeId: doc3.root.nodeId, selector: '.migrate-btn' });
    await cdp.send('CSS.forcePseudoState', { nodeId: btn3.nodeId, forcedPseudoClasses: ['hover'] });
    await sleep(700);
    const hovRes = await cdp.evalJs(`(() => {
      var b = document.querySelector('.migrate-btn');
      var sp = getComputedStyle(b.querySelector('span'));
      var bs = getComputedStyle(b, '::before');
      var m = bs.transform.replace('matrix(', '').replace(')', '').split(',').map(parseFloat);
      return JSON.stringify({ t: bs.transform, e: m[4], f: sp.filter });
    })()`);
    const hov = JSON.parse(hovRes);
    await cdp.send('CSS.forcePseudoState', { nodeId: btn3.nodeId, forcedPseudoClasses: [] });
    await sleep(700);
    ok('S3 悬停：白面板横扫 translateX>100 + span filter 同步翻回（invert(0)/none）', hov.e > 100 && (hov.f === 'invert(0)' || hov.f === 'none'));

    await cdp.send('CSS.forcePseudoState', { nodeId: btn3.nodeId, forcedPseudoClasses: ['active'] });
    await sleep(200);
    const actMat = await cdp.evalJs("getComputedStyle(document.querySelector('.migrate-btn')).transform");
    await cdp.send('CSS.forcePseudoState', { nodeId: btn3.nodeId, forcedPseudoClasses: [] });
    ok('S4 按下：scale(0.95)（矩阵 a=d=0.95）', (() => {
      const m = actMat.replace('matrix(', '').replace(')', '').split(',').map(parseFloat);
      return m.length === 6 && Math.abs(m[0] - 0.95) < 0.001 && Math.abs(m[3] - 0.95) < 0.001;
    })());

    ok('S5 点击开弹窗回归：modalBackdrop + migrateCard 双 active', await cdp.evalJs(`(async () => {
      document.querySelector('.migrate-btn').click();
      await new Promise(function (r) { setTimeout(r, 300); });
      return document.getElementById('modalBackdrop').classList.contains('active') &&
        document.getElementById('migrateModal').querySelector('.modal-card').classList.contains('active');
    })()`));

    // —— S6 暗色：面板仍白 + 静息 invert 仍生效（两主题一致）——
    await cdp.evalJs(`(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      var s = JSON.parse(localStorage.getItem('slati_settings') || '{}');
      s.theme = 'dark';
      localStorage.setItem('slati_settings', JSON.stringify(s));
      return true;
    })()`);
    await sleep(700);
    ok('S6 暗色：白面板仍白 rgb(255,255,255) + span 静息 filter 仍 invert(1)', await cdp.evalJs(`(() => {
      var b = document.querySelector('.migrate-btn');
      var bs = getComputedStyle(b, '::before');
      var sp = getComputedStyle(b.querySelector('span'));
      if (!(bs.backgroundColor === 'rgb(255, 255, 255)' && sp.filter === 'invert(1)')) {
        console.log('[S6 实际]', bs.backgroundColor, '|', sp.filter);
        return false;
      }
      return true;
    })()`));

    ok('Z 零 console error', cdp.errs.length === 0);
    if (cdp.errs.length) console.log('  [errs]', JSON.stringify(cdp.errs.slice(0, 5)));
  } catch (e) {
    fail++;
    console.log('  ❌ 异常: ' + e.message);
  }

  console.log('\n结果: ' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  cdp.close();
  chrome.kill();
  server.close();
  process.exit(fail ? 1 : 0);
})();
