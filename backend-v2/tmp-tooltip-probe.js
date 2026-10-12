// tmp-tooltip-probe.js — Community 顶部 composer 工具 icon 悬停气泡 CDP 断言（2026-09-10 v3）
// 用户口径演进：2026-09-05「停留5秒后才显示」→ 2026-09-10 报 3s 不亮（5s 太久）→「改成2.5s」→「改成1.5s」。
// 现口径：.composer-tool:hover::after transition: opacity .15s ease 1.5s, visibility 0s linear 1.5s。
// B1 停留 0.9s 气泡仍隐藏（1.5s 延迟口径）；B2 停留 2.1s 气泡已亮；
// B3 气泡文字 = data-tip；B4 移开后隐藏；B5 按钮中心 elementFromPoint 命中按钮（无遮挡悬停必失效）；
// Z 全程零 console error。
// 注入 composerHtml 同款完整 DOM（含 textarea——气泡浮在其上，验证 z 序）。
// 跑法：node tmp-tooltip-probe.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3910 + Math.floor(Math.random() * 400);
const CDP_PORT = 4910 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-tooltip-' + Date.now());

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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.errs.push(m.params.exceptionDetails.text || 'exception');
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + r.exceptionDetails.text);
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
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
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
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/community-hub.html' });
    await waitFor(cdp, "document.getElementById('feedContent')", 10000, 'feed 出现');
    // 摘掉访客门禁 + 注入 composerHtml 同款完整 DOM（composer 只在 cloudMode 渲染，本地壳手动放回）
    await cdp.evalJs("document.documentElement.classList.remove('mn-guest'); true");
    await cdp.evalJs(`(() => {
      var feed = document.getElementById('feedContent');
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<textarea id="postComposer" rows="3" style="width:100%;border-radius:8px;padding:10px;font:inherit;margin-bottom:8px"></textarea>' +
        '<div class="pm-list" id="pendingMedia"></div>' +
        '<div class="composer-actions"><div class="composer-tools">' +
        '<button type="button" class="composer-tool" data-action="upload" data-tip="上传图片" aria-label="上传图片"><span class="material-symbols-outlined">image</span></button>' +
        '<button type="button" class="composer-tool" data-action="gif" data-tip="GIF" aria-label="GIF"><span class="material-symbols-outlined">gif</span></button>' +
        '<button type="button" class="composer-tool" data-tip="投票" aria-label="投票"><span class="material-symbols-outlined">poll</span></button>' +
        '<button type="button" class="composer-tool" data-tip="表情符号" aria-label="表情符号"><span class="material-symbols-outlined">sentiment_satisfied</span></button>' +
        '<button type="button" class="composer-tool" data-tip="创办活动" aria-label="创办活动"><span class="material-symbols-outlined">event</span></button>' +
        '</div><button class="btn btn-primary btn-sm" id="postSubmit">Post</button></div>';
      feed.insertBefore(card, feed.firstChild);
      return true;
    })()`);

    const rect = await cdp.evalJs(`(() => { const r = document.querySelector('.composer-tool').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; })()`);
    const cx = rect.left + rect.w / 2, cy = rect.top + rect.h / 2;
    const after = "getComputedStyle(document.querySelector('.composer-tool'), '::after')";

    ok('B0 气泡内容 = data-tip（上传图片）', await cdp.evalJs(after + ".content.indexOf('上传图片') !== -1"));
    ok('B0b 悬停前气泡隐藏', await cdp.evalJs("parseFloat(" + after + ".opacity) === 0 && " + after + ".visibility === 'hidden'"));

    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
    // 按钮中心命中检查：真机若被 overlay/透明层盖住，hover 永不触发（用户报「不亮」的可能根因）
    const hit = await cdp.evalJs(`(() => { var el = document.elementFromPoint(${cx}, ${cy}); return el ? (el.closest('.composer-tool') ? 'tool' : el.tagName + '.' + el.className) : 'null'; })()`);
    ok('B5 按钮中心无遮挡 (elementFromPoint 命中 composer-tool)', hit === 'tool');
    // 停留 ~0.9s：按 1.5s 延迟口径应仍隐藏
    await sleep(900);
    const s1 = await cdp.evalJs("(() => { var c = " + after + "; return { o: parseFloat(c.opacity), v: c.visibility }; })()");
    ok('B1 停留 0.9s 气泡仍隐藏（1.5s 延迟口径）', s1.o < 0.05 && s1.v === 'hidden');
    // 继续停到 ~2.1s：应已亮（opacity 1.5s 起 0.15s 淡入完成）
    await sleep(1250);
    const s2 = await cdp.evalJs("(() => { var c = " + after + "; return { o: parseFloat(c.opacity), v: c.visibility }; })()");
    ok('B2 停留 2.1s 气泡亮起（opacity 1 + visible）', s2.o > 0.9 && s2.v === 'visible');

    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    await sleep(400);
    const sOut = await cdp.evalJs("(() => { var c = " + after + "; return { o: parseFloat(c.opacity), v: c.visibility }; })()");
    ok('B4 移开后气泡隐藏', sOut.o < 0.05 && sOut.v === 'hidden');
    ok('Z 零 console error', cdp.errs.length === 0);

    console.log('  (采样: 0.9s → opacity=' + s1.o + ' visibility=' + s1.v + ' | 2.1s → opacity=' + s2.o + ' visibility=' + s2.v + ' | hit=' + hit + ')');
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
