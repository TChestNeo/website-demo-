// tmp-migrate-restore-probe.js — v0.2.28.14 Migrate 两套按钮样式恢复验证（2026-09-11）
// 背景：v0.2.8.0 液态玻璃移植轮（4a01104）重写 fluidcanvas-editor.html head style 尾部时，
//   把 Migrate 按钮 cssbuttons-io 紫渐变 + 弹窗 Uiverse 药丸两套样式整块误删（189→30 行）——
//   顶部 Migrate 钮与弹窗 Migrate to Cards 药丸自此裸奔（用户「为什么fluidcanvas-editor右上角的
//   Migrate按钮有bug？」）。本轮从 df70a76（v10.28.17.4 同轮修正终版）原样恢复 180 行。
// 断言组：
//   F1 静态：两套样式块在（.migrate-btn 紫渐变 + .migrate-pill 药丸 + 暗色覆写 + 双 keyframes）；
//   S1 顶部钮：紫渐变底 linear-gradient(#8e2de2,#4a00e0) + ghostwhite 字 + 无边框；
//   S2 悬停横扫：静息 ::before skew(30deg)（矩阵 c=0.57735）→ 强制 :hover 500ms 后 translateX>0；
//   S3 按下：forcePseudoState active → transform scale(0.95)；
//   S4 点击开弹窗：modalBackdrop + migrateCard 双 active；
//   S5 药丸结构：dots_border + sparkle path×3 + text_button 在场；
//   S6 药丸 ::before 近黑底 rgb(31,31,31) + 9999px 圆角；
//   S7 药丸悬停：--active:1 → 放大 scale(1.1) + 紫环 0 0 0 6px rgba(109,3,246,.75)；
//   S8 暗色：药丸翻浅 rgb(242,241,251) + 星芒深紫 hsl(260 55% 42%)；
//   S9 暗色：顶部钮紫渐变仍共用（两主题零覆写）；
//   Z 全程零 console error。
// 跑法：node tmp-migrate-restore-probe.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4410 + Math.floor(Math.random() * 400);
const CDP_PORT = 5410 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-migrate-' + Date.now());

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

  // —— F1 静态：样式块恢复在 ——
  const t = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  const btIdx = t.indexOf('.migrate-btn {');
  const pillIdx = t.indexOf('.migrate-pill {');
  const darkIdx = t.indexOf(':root[data-theme="dark"] .migrate-pill {');
  ok('F1 静态：Migrate 两套样式块恢复在（紫渐变 + 药丸 + 暗色覆写 + 双 keyframes，v0.2.28.14）',
    btIdx !== -1 && pillIdx !== -1 && pillIdx > btIdx && darkIdx !== -1 && darkIdx > pillIdx &&
    t.indexOf('linear-gradient(to right, #8e2de2, #4a00e0)', btIdx) !== -1 &&
    t.indexOf('@keyframes rotate', pillIdx) !== -1 && t.indexOf('@keyframes path', pillIdx) !== -1);

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
    // 编辑器页有未登录门禁（head 同步 slati_session.loggedIn → replace 送返）。
    // 先落 FC 首页（同源无门禁）种 session，再进编辑器页。
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas.html' });
    await waitFor(cdp, "document.readyState === 'complete'", 10000, 'FC 首页就绪');
    await cdp.evalJs(`(() => {
      localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, user: { id: 'USR-TEST', displayName: 'Probe' } }));
      return true;
    })()`);
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "document.querySelector('.migrate-btn') && document.getElementById('migrateModal')", 15000, '编辑器页就绪');
    await sleep(800);

    ok('S1 顶部钮：紫渐变底 + ghostwhite 字 + 无边框（v0.2.28.14 恢复）', await cdp.evalJs(`(() => {
      var b = document.querySelector('.migrate-btn');
      var cs = getComputedStyle(b);
      return cs.backgroundImage.indexOf('linear-gradient(to right, rgb(142, 45, 226), rgb(74, 0, 224))') !== -1 &&
        cs.color === 'rgb(248, 248, 255)' && cs.borderTopStyle === 'none' && cs.position === 'relative';
    })()`));

    // —— S2/S3 强制伪类（CSS.forcePseudoState；悬停横扫 0.4s transition → 等 500ms）——
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const doc2 = await cdp.send('DOM.getDocument', { depth: -1 });
    const btn2 = await cdp.send('DOM.querySelector', { nodeId: doc2.root.nodeId, selector: '.migrate-btn' });
    const restMat = await cdp.evalJs("getComputedStyle(document.querySelector('.migrate-btn'), '::before').transform");
    const restBg = await cdp.evalJs("getComputedStyle(document.querySelector('.migrate-btn'), '::before').backgroundColor");
    ok('S2a 静息：黑面板 skew(30deg)（矩阵 c=0.57735）', (() => {
      const m = restMat.replace('matrix(', '').replace(')', '').split(',').map(parseFloat);
      return m.length === 6 && Math.abs(m[2] - 0.57735) < 0.001 && restBg === 'rgb(0, 0, 0)';
    })());
    await cdp.send('CSS.forcePseudoState', { nodeId: btn2.nodeId, forcedPseudoClasses: ['hover'] });
    await sleep(500);
    const hovMat = await cdp.evalJs("getComputedStyle(document.querySelector('.migrate-btn'), '::before').transform");
    await cdp.send('CSS.forcePseudoState', { nodeId: btn2.nodeId, forcedPseudoClasses: [] });
    await sleep(500);
    ok('S2b 悬停：黑面板横扫（translateX 约 172px——hover 规则纯平移替换 skew，cssbuttons-io 原设计）', (() => {
      const m = hovMat.replace('matrix(', '').replace(')', '').split(',').map(parseFloat);
      return m.length === 6 && m[4] > 100;
    })());
    await cdp.send('CSS.forcePseudoState', { nodeId: btn2.nodeId, forcedPseudoClasses: ['active'] });
    await sleep(200);
    const actMat = await cdp.evalJs("getComputedStyle(document.querySelector('.migrate-btn')).transform");
    await cdp.send('CSS.forcePseudoState', { nodeId: btn2.nodeId, forcedPseudoClasses: [] });
    ok('S3 按下：scale(0.95)（矩阵 a=d=0.95）', (() => {
      const m = actMat.replace('matrix(', '').replace(')', '').split(',').map(parseFloat);
      return m.length === 6 && Math.abs(m[0] - 0.95) < 0.001 && Math.abs(m[3] - 0.95) < 0.001;
    })());

    ok('S4 点击开弹窗：modalBackdrop + migrateCard 双 active（onclick 链路完好）', await cdp.evalJs(`(async () => {
      document.querySelector('.migrate-btn').click();
      await new Promise(function (r) { setTimeout(r, 300); });
      return document.getElementById('modalBackdrop').classList.contains('active') &&
        document.getElementById('migrateModal').querySelector('.modal-card').classList.contains('active');
    })()`));

    ok('S5 药丸结构：dots_border + sparkle path×3 + text_button 在场', await cdp.evalJs(`(() => {
      var p = document.querySelector('.migrate-pill');
      if (!p) return false;
      return !!p.querySelector('.dots_border') && p.querySelectorAll('.sparkle .path').length === 3 &&
        !!p.querySelector('.text_button');
    })()`));
    ok('S6 药丸静息：::before 近黑底 + 9999px 圆角（Uiverse 药丸）', await cdp.evalJs(`(() => {
      var p = document.querySelector('.migrate-pill');
      var cs = getComputedStyle(p, '::before');
      return cs.backgroundColor === 'rgb(31, 31, 31)' && cs.borderRadius === '9999px';
    })()`));

    // —— S7 药丸悬停：--active:1 → 放大 + 紫环 ——
    const doc7 = await cdp.send('DOM.getDocument', { depth: -1 });
    const pill7 = await cdp.send('DOM.querySelector', { nodeId: doc7.root.nodeId, selector: '.migrate-pill' });
    await cdp.send('CSS.forcePseudoState', { nodeId: pill7.nodeId, forcedPseudoClasses: ['hover'] });
    await sleep(700);
    ok('S7 药丸悬停：放大 scale(1.1) + 紫环 0 0 0 6px（--active 驱动）', await cdp.evalJs(`(() => {
      var p = document.querySelector('.migrate-pill');
      var cs = getComputedStyle(p);
      var bs = getComputedStyle(p, '::before');
      if (!(cs.transform === 'matrix(1.1, 0, 0, 1.1, 0, 0)' &&
        bs.boxShadow.indexOf('rgba(86, 4, 251, 0.75) 0px 0px 0px 6px') !== -1)) {
        console.log('[S7 实际]', cs.transform, '|', bs.boxShadow);
        return false;
      }
      return true;
    })()`));
    await cdp.send('CSS.forcePseudoState', { nodeId: pill7.nodeId, forcedPseudoClasses: [] });
    await sleep(700);

    // —— 深色主题（直设 data-theme + localStorage 同步 = 主题 pill 等价）——
    await cdp.evalJs(`(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      var s = JSON.parse(localStorage.getItem('slati_settings') || '{}');
      s.theme = 'dark';
      localStorage.setItem('slati_settings', JSON.stringify(s));
      return true;
    })()`);
    await sleep(700);
    ok('S8 暗色：药丸翻浅 rgb(242,241,251) + 星芒深紫 hsl(260 55% 42%)', await cdp.evalJs(`(() => {
      var p = document.querySelector('.migrate-pill');
      var bs = getComputedStyle(p, '::before');
      var sp = getComputedStyle(p.querySelector('.sparkle .path'));
      if (!(bs.backgroundColor === 'rgb(242, 241, 251)' && sp.color === 'rgb(87, 48, 166)')) {
        console.log('[S8 实际]', bs.backgroundColor, '|', sp.color);
        return false;
      }
      return true;
    })()`));
    ok('S9 暗色：顶部钮紫渐变仍共用（两主题零覆写）', await cdp.evalJs(`(() => {
      var b = document.querySelector('.migrate-btn');
      return getComputedStyle(b).backgroundImage.indexOf('linear-gradient(to right, rgb(142, 45, 226), rgb(74, 0, 224))') !== -1;
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
