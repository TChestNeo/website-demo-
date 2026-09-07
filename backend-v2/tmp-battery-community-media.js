// tmp-battery-community-media.js — v0.2.16.0 Community 帖子媒体电池（2026-09-05）
// 用户：「Post 会展示该post的多个图片/视频」。
// 断言口径：结构性断言（画廊 DOM/灯箱/composer 上传链/escapeHtml），不依赖图片像素加载——
//   截图管线 Chrome 151 全黑（house 教训），假 /uploads/ URL 404 只产 console error 不断言 console。
// 上传链：monkeypatch window.fetch 只拦 /social/uploads（记录 method/URL/body 是 File、假返 url），
//   CDP DOM.setFileInputFiles 真触发 change；发布捕 MN_API.post payload，真端点零污染。
// 跑法：node tmp-battery-community-media.js（LIVE_BASE=<完整站点 URL> 跑线上）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-' + Date.now());

// ── 静态壳（docs/ 原样；/api 与 /uploads 全 404 → demo 模式零请求） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
      return;
    }
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

// ── CDP 客户端 ──
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) {
        const ls = this.listeners.get(m.method);
        if (ls) ls.forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('waitFor 超时: ' + label);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pass = [], fail = [];
function check(name, cond, detail) {
  const line = (cond ? '  ✅ ' : '  ❌ ') + name + (detail ? '（' + detail + '）' : '');
  console.log(line);
  (cond ? pass : fail).push(line);
}
async function nav(t, url) { await t.send('Page.navigate', { url }); await sleep(900); }

// 假云帖：P1 三媒体（2 图 + 1 mp4）、P2 单图、P3 双媒体（图 + webm）、P4 零媒体、P5 XSS 载荷 + 外部 URL 混合
const FAKE_POSTS = [
  { id: 'PST-000101', authorName: 'CitizenA', content: '三图视频帖', createdAt: new Date().toISOString(),
    media: ['/uploads/UPL-000001.jpg', '/uploads/UPL-000002.png', '/uploads/UPL-000003.mp4'] },
  { id: 'PST-000102', authorName: 'CitizenB', content: '单图帖', createdAt: new Date().toISOString(),
    media: ['/uploads/UPL-000004.jpg'] },
  { id: 'PST-000103', authorName: 'CitizenC', content: '双媒体帖', createdAt: new Date().toISOString(),
    media: ['/uploads/UPL-000005.jpg', '/uploads/UPL-000006.webm'] },
  { id: 'PST-000104', authorName: 'CitizenD', content: '纯文字帖无媒体', createdAt: new Date().toISOString(), media: [] },
  { id: 'PST-000105', authorName: '<img src=x onerror=window.__xss=1>', content: '<b>bold</b> 带图帖',
    createdAt: new Date().toISOString(),
    media: ['/uploads/UPL-000007.jpg', 'https://evil.example/x.jpg'] },
];

async function main() {
  const LIVE = process.env.LIVE_BASE || '';
  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
  if (!LIVE) server.listen(PORT);
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
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  const errs = [];
  t.on('Runtime.exceptionThrown', p => {
    const d = (p.exceptionDetails.exception && p.exceptionDetails.exception.description) || 'exc';
    if (d.indexOf('data:') === -1) errs.push(d);
  });
  await t.send('Log.enable');

  // 临时 PNG（客户端不做魔数校验，字节随意；fetch 被拦真端点零接触）
  const tmpPng = path.join(os.tmpdir(), 'batt-media-' + Date.now() + '.png');
  fs.writeFileSync(tmpPng, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01, 0x02, 0x03, 0x04]));

  console.log('── B. Community 帖子媒体（v0.2.16.0）──');
  await nav(t, BASE + '/pages/community-hub');
  await waitFor(t, "document.querySelectorAll('#feedContent > .card').length >= 3", 15000, 'feed boot');
  await sleep(600); // 等 initCloudFeed 的 probe 落定（demo 路径 cloudMode=false）
  await t.evalJs(
    'window.cloudMode = true; window.cloudPosts = ' + JSON.stringify(FAKE_POSTS) + '; renderFeed();');
  await waitFor(t, "document.getElementById('postComposer')", 10000, 'composer 渲染');
  await waitFor(t, "document.querySelectorAll('#feedContent .post-media').length === 4", 10000, '画廊渲染');

  // B1 版本 + 卡片结构（composer + 5 云帖 + 3 demo）
  const ver = await t.evalJs('window.MN_SITE_VERSION');
  const cards = await t.evalJs("document.querySelectorAll('#feedContent > .card').length");
  check('B1 版本 v0.2.16.0 / 9 卡（composer+5 云帖+3 demo）', ver === 'v0.2.16.0' && cards === 9, 'ver=' + ver + ' n=' + cards);

  // B2 画廊网格形状：P1 .pm-3（2 IMG + 1 VIDEO）、P2 .pm-1、P3 .pm-2（IMG + VIDEO）、P5 过滤后 .pm-1、P4 无网格
  const g0 = await t.evalJs(`(() => { const g = document.querySelectorAll('#feedContent .post-media')[0];
    return { cls: g.className, kids: Array.prototype.map.call(g.children, c => c.tagName) }; })()`);
  const vid0 = await t.evalJs(`(() => { const v = document.querySelectorAll('#feedContent .post-media')[0].querySelector('video');
    return v ? { src: v.getAttribute('src'), controls: v.hasAttribute('controls'), preload: v.getAttribute('preload') } : null; })()`);
  const imgs0 = await t.evalJs(`Array.prototype.map.call(
    document.querySelectorAll('#feedContent .post-media')[0].querySelectorAll('img'), i => i.getAttribute('src'))`);
  check('B2 P1 .pm-3：2 IMG + 1 VIDEO 且 src 对',
    g0.cls.indexOf('pm-3') !== -1 && g0.kids.length === 3 &&
    g0.kids[0] === 'BUTTON' && g0.kids[1] === 'BUTTON' && g0.kids[2] === 'BUTTON' &&
    imgs0.length === 2 && vid0 && vid0.src === '/uploads/UPL-000003.mp4' &&
    vid0.controls === true && vid0.preload === 'metadata',
    JSON.stringify({ cls: g0.cls, kids: g0.kids, vid: vid0 }));
  const g1 = await t.evalJs("document.querySelectorAll('#feedContent .post-media')[1].className");
  const g2 = await t.evalJs(`(() => { const g = document.querySelectorAll('#feedContent .post-media')[2];
    const v = g.querySelector('video'); return { cls: g.className, isVideo2nd: g.children[1].querySelector('video') !== null, src: v && v.getAttribute('src') }; })()`);
  const g3 = await t.evalJs("document.querySelectorAll('#feedContent .post-media')[3].className");
  const p4NoGrid = await t.evalJs("document.querySelectorAll('#feedContent > .card')[4].querySelectorAll('.post-media').length === 0");
  check('B2 P2 .pm-1 / P3 .pm-2 第 2 位 VIDEO(webm) / P4 无网格 / P5 过滤后 .pm-1',
    g1.indexOf('pm-1') !== -1 && g2.cls.indexOf('pm-2') !== -1 && g2.isVideo2nd && g2.src === '/uploads/UPL-000006.webm' &&
    p4NoGrid && g3.indexOf('pm-1') !== -1, JSON.stringify({ g1, g2, g3, p4NoGrid }));

  // B3 escapeHtml：XSS 载荷作者/标题被转义（无注入元素、textContent 含原文、window.__xss 未触发）
  const xss = await t.evalJs(`(() => {
    const card = document.querySelectorAll('#feedContent > .card')[5];
    const h4 = card.querySelector('h4');
    const author = card.querySelector('span[style*="font-weight:600"]');
    return {
      xss: window.__xss, h4text: h4.textContent, h4Kids: h4.children.length,
      authorText: author ? author.textContent : '', authorKids: author ? author.children.length : -1,
      imgsInH4: h4.querySelectorAll('img').length
    };
  })()`);
  check('B3 escapeHtml：载荷转义、无注入元素、__xss 未触发',
    xss.xss === undefined && xss.h4text === '<b>bold</b> 带图帖' && xss.h4Kids === 0 && xss.imgsInH4 === 0 &&
    xss.authorText.indexOf('<img src=x') !== -1 && xss.authorKids === 0, JSON.stringify(xss));

  // B4 灯箱：点 P1 第 1 张 → backdrop 开 + IMG src 对 + prev 禁用/next 可用；next → 第 2 张；再 next → 第 3 张 VIDEO controls
  await t.evalJs("document.querySelectorAll('#feedContent .post-media')[0].querySelector('.pm-tile').click()");
  await sleep(350);
  const lb1 = await t.evalJs(`(() => {
    const b = document.querySelector('.modal-backdrop'); const m = document.querySelector('.lb-card .lb-media');
    return { open: b && b.classList.contains('active'), tag: m && m.tagName, src: m && m.getAttribute('src'),
      prevDisabled: document.querySelector('.lb-arrow.lb-prev').disabled,
      nextDisabled: document.querySelector('.lb-arrow.lb-next').disabled };
  })()`);
  check('B4 灯箱开：IMG src 对 / prev 禁用 / next 可用',
    lb1.open && lb1.tag === 'IMG' && lb1.src === '/uploads/UPL-000001.jpg' && lb1.prevDisabled && !lb1.nextDisabled,
    JSON.stringify(lb1));
  await t.evalJs("document.querySelector('.lb-arrow.lb-next').click()"); await sleep(200);
  const lb2src = await t.evalJs("document.querySelector('.lb-card .lb-media').getAttribute('src')");
  check('B4 箭头 → 第 2 张（png）', lb2src === '/uploads/UPL-000002.png', lb2src);
  await t.evalJs("document.querySelector('.lb-arrow.lb-next').click()"); await sleep(200);
  const lb3 = await t.evalJs(`(() => { const m = document.querySelector('.lb-card .lb-media');
    return { tag: m.tagName, src: m.getAttribute('src'), controls: m.hasAttribute('controls') }; })()`);
  check('B4 箭头 → 第 3 张 VIDEO controls（mp4）', lb3.tag === 'VIDEO' && lb3.src === '/uploads/UPL-000003.mp4' && lb3.controls, JSON.stringify(lb3));

  // B5 Escape 关灯箱
  await t.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await t.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(200);
  const escClosed = await t.evalJs("!document.querySelector('.modal-backdrop').classList.contains('active')");
  check('B5 Escape 关灯箱', escClosed === true);

  // B6 backdrop 真坐标点击关（elementFromPoint 定位到 backdrop 本体再点——绕开侧栏/头部遮挡）
  await t.evalJs("document.querySelectorAll('#feedContent .post-media')[0].querySelectorAll('.pm-tile')[1].click()");
  await sleep(350);
  const pt = await t.evalJs(`(() => {
    const backdrop = document.querySelector('.modal-backdrop');
    for (let x = 1240; x > 320; x -= 60) for (let y = 40; y < 800; y += 60) {
      if (document.elementFromPoint(x, y) === backdrop) return { x: x, y: y };
    }
    return null;
  })()`);
  if (!pt) { check('B6 backdrop 点击关灯箱（定位失败）', false, 'elementFromPoint 未命中 backdrop'); }
  else {
    await t.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    await t.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    await sleep(250);
    const bcClosed = await t.evalJs("!document.querySelector('.modal-backdrop').classList.contains('active')");
    check('B6 backdrop 点击关灯箱', bcClosed === true, 'pt=' + pt.x + ',' + pt.y);
  }

  // B7 composer 上传链：拦 fetch → setFileInputFiles 真触发 → 缩略图 + POST 记录（method/URL/body 是 File）
  await t.evalJs(`
    window.__fetchCalls = [];
    window.__realFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (String(url).indexOf('/social/uploads') !== -1) {
        window.__fetchCalls.push({
          method: (opts || {}).method || 'GET', url: String(url),
          bodyIsFile: !!(opts && opts.body && Object.prototype.toString.call(opts.body) === '[object File]')
        });
        return Promise.resolve({ ok: true, status: 200, json: async function () { return { url: '/uploads/UPL-000042.jpg' }; } });
      }
      return window.__realFetch(url, opts);
    };
    window.__toasts = [];
    var origToast = window.MN_Report && MN_Report.toast;
    if (typeof origToast === 'function') MN_Report.toast = function (m, e) { window.__toasts.push(String(m)); return origToast.apply(this, arguments); };
  `);
  await t.send('DOM.enable');
  const doc = await t.send('DOM.getDocument');
  const q = await t.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#postImgInput' });
  if (!q.nodeId) throw new Error('找不到 #postImgInput');
  await t.send('DOM.setFileInputFiles', { files: [tmpPng], nodeId: q.nodeId });
  await waitFor(t, "document.querySelectorAll('#pendingMedia .pm-thumb').length === 1", 10000, '缩略图出现');
  const up = await t.evalJs(`({ calls: window.__fetchCalls,
    thumbSrc: document.querySelector('#pendingMedia .pm-thumb img').getAttribute('src'),
    gifAccept: document.getElementById('postGifInput').getAttribute('accept'),
    imgAccept: document.getElementById('postImgInput').getAttribute('accept') })`);
  check('B7 上传链：POST + ?ext=.png + body 是 File + 缩略图 URL + 输入框 accept',
    up.calls.length === 1 && up.calls[0].method === 'POST' && up.calls[0].url.indexOf('/social/uploads?ext=.png') !== -1 &&
    up.calls[0].bodyIsFile && up.thumbSrc === '/uploads/UPL-000042.jpg' &&
    up.gifAccept === 'image/gif' && up.imgAccept === 'image/*,video/*', JSON.stringify(up));

  // B8 发布随帖携带 media：捕 MN_API.post → 填文字 → 点 Post → payload 断言 + 成功后清空
  await t.evalJs(`
    window.__postCalls = [];
    MN_API.post = function (p, body) {
      window.__postCalls.push({ p: p, body: body });
      return Promise.resolve({ ok: true, status: 200, data: { post: { id: 'PST-000043', status: 'visible' }, moderation: { verdict: 'pass' } } });
    };
    var el = document.getElementById('postComposer'); el.value = '带图测试帖';
    document.getElementById('postSubmit').click();
  `);
  await waitFor(t, "window.__postCalls && window.__postCalls.length === 1", 10000, '发布 payload');
  const post = await t.evalJs(`({ c: window.__postCalls[0],
    pendingAfter: window.pendingMedia.length,
    thumbLeft: document.querySelectorAll('#pendingMedia .pm-thumb').length,
    toasts: window.__toasts.slice() })`);
  check('B8 发布 payload 带 media + 成功后清空待传 + 成功 toast',
    post.c.p === '/social/posts' && post.c.body.content === '带图测试帖' &&
    JSON.stringify(post.c.body.media) === JSON.stringify(['/uploads/UPL-000042.jpg']) &&
    post.pendingAfter === 0 && post.thumbLeft === 0 && post.toasts.indexOf('发布成功') !== -1,
    JSON.stringify(post));

  // B9 投票钮仍 toast「即将上线」（未上线不装死）；上传钮带 data-action 真接
  await t.evalJs("document.querySelector('.composer-tool[data-tip=\\'投票\\']').click()");
  await sleep(150);
  const b9 = await t.evalJs(`({ toasts: window.__toasts.slice(),
    upAction: document.querySelector('.composer-tool[data-tip=\\'上传图片\\']').getAttribute('data-action'),
    gifAction: document.querySelector('.composer-tool[data-tip=\\'GIF\\']').getAttribute('data-action') })`);
  check('B9 投票钮仍 toast「投票功能即将上线」/ 上传与 GIF 钮 data-action',
    b9.toasts.indexOf('投票功能即将上线') !== -1 && b9.upAction === 'upload' && b9.gifAction === 'gif',
    JSON.stringify(b9));

  check('B10 全程 0 Runtime exception', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + pass.length + ' ✅ / ' + fail.length + ' ❌');
  t.close();
  chrome.kill();
  try { fs.unlinkSync(tmpPng); } catch (e) {}
  process.exit(fail.length ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
