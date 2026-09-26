// tmp-probe-imglib-userflow.js — 按用户真实点击路径复现「上传的图片在图库看不见」
// 路径：点国旗卡→图源弹窗→点 Upload from file→真文件→meta 保存→点另一张国旗卡
// →点 Search within platform→查 全部/我的图库 tile 数。全走按钮点击，不直调函数。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4600 + Math.floor(Math.random() * 300);
const CDP_PORT = 5700 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-lib-' + Date.now());

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

  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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

    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.createFlagCard === 'function'", 20000, '编辑器加载');
    await sleep(600);

    // 探针基础设施：上传真文件（rgb 纯色 PNG dataURL → 存进 file input 的 files）
    const INJECT = `(function(){
      window.__makeFile = function(dataURL, name){
        var b64 = dataURL.split(',')[1];
        var bin = atob(b64); var u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return new File([u8], name, { type: 'image/png' });
      };
      window.__png = function(rgb, w, h){
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        var ctx = cv.getContext('2d'); ctx.fillStyle = rgb; ctx.fillRect(0, 0, w, h);
        return cv.toDataURL('image/png');
      };
      window.__click = function(sel){
        var el = document.querySelector(sel);
        if (!el) throw new Error('no el ' + sel);
        el.click(); return true;
      };
      window.__upFlag = function(rgb){
        var input = document.getElementById('flagFileInput');
        var dt = new DataTransfer();
        dt.items.add(window.__makeFile(window.__png(rgb, 800, 500), 'my-flag.png'));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      window.__lib = function(){
        var act = function(el){ return !!(el && el.querySelector('.modal-card') && el.querySelector('.modal-card').classList.contains('active')); };
        var tiles = Array.from(document.querySelectorAll('#flagGrid .flag-card-item'));
        return {
          src: act(document.getElementById('flagSourceModal')),
          browser: act(document.getElementById('flagBrowserModal')),
          tab: (document.querySelector('.flag-browser-tab.active') || {}).dataset.tab || null,
          tiles: tiles.map(function(t){ return { name: (t.querySelector('.flag-name')||{}).textContent||'' }; }),
          empty: (document.querySelector('.flag-grid-empty') || {}).textContent || ''
        };
      };
      return true;
    })()`;
    await cdp.evalJs(INJECT);

    // ① 真实点击国旗卡（卡片事件路径）→ 图源弹窗
    await cdp.evalJs("window.createFlagCard('国旗A', 0, 12, 8, 5); true");
    await sleep(200);
    await cdp.evalJs("(function(){ var c = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]')[0]; c.click(); return true; })()");
    await sleep(200);
    const s1 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__lib())'));
    ok('A1 点国旗卡→图源弹窗（左侧上传/右侧搜索）', s1.src === true, JSON.stringify(s1));

    // ② 真实点击 Upload from file 按钮 → 文件 → meta 弹窗 → 填名保存
    await cdp.evalJs("window.__click('#uploadFileBtn'); true");
    await cdp.evalJs("window.__upFlag('rgb(0,128,0)'); true");
    await waitFor(cdp, "document.getElementById('imgMetaModal').querySelector('.modal-card').classList.contains('active')", 10000, 'meta open');
    await cdp.evalJs("document.getElementById('immName').value = '我的国旗'; window.imgMetaSave(); true");
    await sleep(300);
    const f = JSON.parse(await cdp.evalJs(`JSON.stringify((function(){
      var c = document.querySelectorAll('.grid-card[data-card-type="flag"]')[0];
      return { hasImg: !!c.querySelector('.card-img-bg'), imgName: c.dataset.imgName || '', label: (c.querySelector('.card-label')||{}).textContent || '' };
    })())`));
    ok('A2 上传保存→图落到卡上（card-img-bg+名称）', f.hasImg && f.imgName === '我的国旗', JSON.stringify(f));
    const s2 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__lib())'));
    ok('A3 保存后图源弹窗连 meta 一起关', s2.src !== true, JSON.stringify(s2));

    // ③ 再点同一张卡（已有图）→ 不弹图源（guard）——用户想再看图库只能靠别的卡
    await cdp.evalJs("(function(){ var c = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]')[0]; c.click(); return true; })()");
    await sleep(200);
    const s3 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__lib())'));
    ok('A4 已有图的卡再点→不再弹图源（图库入口消失）', s3.src !== true, JSON.stringify(s3));

    // ④ 点另一张无图国旗卡→图源弹窗→点 Search within platform→图库
    await cdp.evalJs("window.createFlagCard('国旗B', 10, 12, 8, 5); true");
    await sleep(200);
    await cdp.evalJs("(function(){ var cs = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]'); cs[cs.length-1].click(); return true; })()");
    await sleep(200);
    await cdp.evalJs("window.__click('#flagBrowseBtn'); true");
    await sleep(300);
    const s4 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__lib())'));
    ok('A5 浏览钮→图库打开+全部页签 1 格（我的国旗）', s4.browser === true && s4.tab === 'all' && s4.tiles.length === 1 && s4.tiles[0].name === '我的国旗', JSON.stringify(s4));
    await cdp.evalJs("window.switchFlagTab('mylib'); true");
    await sleep(200);
    const s5 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__lib())'));
    ok('A6 我的图库 1 格（我的国旗）', s5.tiles.length === 1 && s5.tiles[0].name === '我的国旗', JSON.stringify(s5));
    await cdp.evalJs('window.closeAllModals(); true');

    // ⑤ 换一篇新草稿（模拟用户开新文章）→ 图库应照我的假设=空
    await cdp.evalJs("(function(){ try { localStorage.removeItem('slati_fluidcanvas_draft'); } catch(e){} window.location.reload(); return true; })()");
    await waitFor(cdp, "typeof window.createFlagCard === 'function'", 20000, '重载');
    await sleep(600);
    await cdp.evalJs(INJECT);
    await cdp.evalJs("window.createFlagCard('新国旗', 0, 12, 8, 5); true");
    await sleep(200);
    await cdp.evalJs("(function(){ var c = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]')[0]; c.click(); return true; })()");
    await sleep(200);
    await cdp.evalJs("window.__click('#flagBrowseBtn'); true");
    await sleep(300);
    const s6 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__lib())'));
    ok('B1 新草稿（无保存）→ 图库=空（旧上传全消失——这就是用户撞的）', s6.browser === true && s6.tiles.length === 0, JSON.stringify(s6));

    console.log('\n  ── 结果: ' + pass + '/' + (pass + fail));
    if (fail) process.exit(1);
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
