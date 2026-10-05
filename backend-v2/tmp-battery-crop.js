// tmp-battery-crop.js — v0.2.58.28 上传裁切弹窗 + 横幅 1.5 倍高 + 视频横幅电池（Round 45 主电池）
// 用户「那个横幅和头像在上传后能不能先弹出一个选择裁切范围的弹窗调整裁切范围，还有那个横幅能不能再高1.5倍？」
//   +「还有要允许上传视频，大小的话平台自己压缩，然后上传视频最长1分钟」+「那个视频是指横幅的部分」
// 六钦定+视频四钦定：裁切=显示范围（绝不重编码 GIF 保动画）/固定比例框+缩放平移（视窗模型）/
//   两处同改（资料页 210px+设置 144px）/图库同漏斗/FC 频道卡同裁切（48.1）/重裁钮两处；
//   视频=只横幅/浏览器压缩（1280/30fps/1.2Mbps/静音/webm）/超 60s 截前 60s（MN_VideoCap）/GIF 同门
// 验证：S0 静态锚（settings-modal/profile 页/FC 页/site-config/i18n 新键/后端 030+parseCrop 件）；
//   C2 Esc 捕获相不连锁关设置弹窗；C3 设置横幅上传 confirm 精确体 keys bannerUrl,bannerCrop+rect 深等
//   +slati_user 合并写+预览 data-crop；C4 拖拽数学（视窗模型 zoom×2 后 rect 重算+拖 dx 跟手——Node
//   同式复算逐位比对 confirm 产物）；C5 缩放钳制（方形图 3×sFull 时 w=1/3、缩回 sFull 时 rect 回整图）；
//   C6 图库取消零上传零 PATCH；C7 资料页横幅重裁（保存 PATCH 恰 {bannerCrop}）；C9 设置重裁同口径；
//   C10 FC 换头像链 keys avatarUrl,avatarCrop 无 bio+频道卡 wrapper；C11 FC 显示几何精确值；
//   C12 爷爷 null crop 居中 cover 零回归；C13 GIF 保真（stage blob: 前缀+上传体原字节 type image/gif）；
//   C14 触屏拖拽；C15 高度 computed 210/144；V2 MN_VideoCap 纯函数；V3 门禁 free/basic mp4 双页；
//   V4 资料页真视频全链（页面内 MediaRecorder 录 2s→File test.mp4→压缩→弹窗 video→confirm→ext=.webm→
//   PATCH {bannerUrl,bannerCrop}→头部 video autoplay/muted/loop/playsinline+data-crop）；V5 头像链 mp4 拒绝；
//   V6 设置弹窗视频同链；V7 视频横幅重裁（远程 .webm stage video+只改 crop）；E 零异常零 console error。
//   （house CDP 模式；判定看输出体 🎉/💔 行；DEMO01=真 200×100 PNG、DEMO02=1×1 像素、DEMO-V=现场录制 webm）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-crop-' + Date.now());
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const PIXEL_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// ── 真 PNG 生成（zlib+crc32）：200×100（横幅比）与 200×200（方形）——拖拽/钳制数学需非退化自然尺寸 ──
function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xFF;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function makePng(w, h, rgba) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (1 + w * 4) + 1 + x * 4;
      raw[o] = rgba[0]; raw[o + 1] = rgba[1]; raw[o + 2] = rgba[2]; raw[o + 3] = rgba[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}
const PNG_200_100 = makePng(200, 100, [70, 72, 212, 255]);
const PNG_200_200 = makePng(200, 200, [70, 72, 212, 255]);
const B64_200_100 = PNG_200_100.toString('base64');
const B64_200_200 = PNG_200_200.toString('base64');

// ── 弹窗数学 Node 同式复算（逐行照抄 settings-modal.js cropOpen 视窗模型——同序同算 IEEE754 逐位一致） ──
// vw/vh=真实视口（CDP 实测 innerWidth/innerHeight——headless 1280×900 窗口有滚动条实为 1258×802，
// 帧长 513 而非 576；tmp-debug-drag.js 实证事件流逐像素精确，错的是旧硬编码 1280×900 假设）
function simDialog(vw, vh, kind, nw, nh, steps) {
  const W = kind === 'banner' ? Math.min(720, Math.round(vw * 0.8)) : Math.floor(Math.min(vh * 0.64, vw * 0.8));
  const H = kind === 'banner' ? Math.round(W / 3) : W;
  const rect = { x: 0, y: 0, w: 1, h: 1 };
  const sFull = Math.max(W / nw, H / nh);
  let s = Math.max(W / (rect.w * nw), H / (rect.h * nh));
  function windowFromZoom() {
    var cw = W / (nw * s), ch = H / (nh * s);
    var w2 = Math.min(1, cw), h2 = Math.min(1, ch);
    var cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    rect.x = Math.max(0, Math.min(1 - w2, cx - w2 / 2));
    rect.y = Math.max(0, Math.min(1 - h2, cy - h2 / 2));
    rect.w = w2;
    rect.h = h2;
  }
  for (const st of steps) {
    if (st.t === 'wheel') { s = Math.max(sFull, Math.min(3 * sFull, s * (st.deltaY < 0 ? 1.15 : 1 / 1.15))); windowFromZoom(); }
    else if (st.t === 'drag') {
      rect.x = Math.max(0, Math.min(1 - rect.w, rect.x - st.dx / (nw * s)));
      rect.y = Math.max(0, Math.min(1 - rect.h, rect.y - st.dy / (nh * s)));
    }
  }
  return {
    x: Math.round(rect.x * 10000) / 10000, y: Math.round(rect.y * 10000) / 10000,
    w: Math.round(rect.w * 10000) / 10000, h: Math.round(rect.h * 10000) / 10000,
    W: W, H: H, sFull: sFull
  };
}

// ── document-start 种子：URL 标记矩阵 → session/user/旗标/图库 ──
//   nov=头像 null；banner=横幅 DEMO01；vbanner=横幅 DEMO-V.webm；prem=高级；basic=基础；crop=头像裁切 {0.25,0,0.5,1}；lib=图库
const SEED = `try{(function(){
  var q = location.search || '';
  if (q.indexOf('guest') !== -1) {
    try { localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user'); } catch (e) {}
    return;
  }
  localStorage.setItem('slati_session', '{"loggedIn":true}');
  localStorage.setItem('slati_lang', 'zh-CN'); // 钉死语言——toast 断言按 zh-CN 块值
  var u = {
    id: 'USR-000101', displayName: '电池用户', citizenId: 'CIT-000101', bio: '电池用户简介', gender: 'Male',
    tier: q.indexOf('prem') !== -1 ? 'premium' : (q.indexOf('basic') !== -1 ? 'basic' : 'free'),
    avatarUrl: q.indexOf('nov') !== -1 ? null : '/uploads/UPL-DEMO01.jpg',
    bannerUrl: q.indexOf('vbanner') !== -1 ? '/uploads/UPL-DEMO-V.webm' : (q.indexOf('banner') !== -1 ? '/uploads/UPL-DEMO01.jpg' : null)
  };
  if (q.indexOf('crop') !== -1) u.avatarCrop = { x: 0.25, y: 0, w: 0.5, h: 1 };
  localStorage.setItem('slati_user', JSON.stringify(u));
  if (q.indexOf('lib') !== -1) localStorage.setItem('slati_img_library', JSON.stringify([{ src: 'data:image/png;base64,${PIXEL_B64}' }]));
  else { try { localStorage.removeItem('slati_img_library'); } catch (e) {} }
  try { localStorage.removeItem('slati_avatar_sync'); } catch (e) {} // 缺键=ON
})();}catch(e){}`;

// ── document-start fetch 罐头：uploads 图片→DEMO02（1×1）视频 ext=.webm→DEMO-V.webm；PATCH 持久化 __serverUser
//   （真实后端语义：PATCH 后 GET 回读落库值——V4 保存后 loadProfile 重拉头部靠它）；__lastUpload 记上传体字节/类型 ──
const FETCH_STUB = `try{(function(){
  if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;
  var realFetch = window.fetch.bind(window);
  window.__fetchCalls = [];
  window.__patchedMe = null;
  window.__patchCount = 0;
  window.__lastUpload = null;
  window.__serverUser = null;
  function readUser() { try { return JSON.parse(localStorage.getItem('slati_user') || 'null') || {}; } catch (e) { return {}; } }
  function srvUser() { if (!window.__serverUser) window.__serverUser = readUser(); return window.__serverUser; }
  function res(status, body) {
    return { status: status, ok: status >= 200 && status < 300, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(body); } };
  }
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('/api/') !== -1) {
      var method = (opts && opts.method) || 'GET';
      var rawBody = (opts && opts.body != null) ? opts.body : null;
      window.__fetchCalls.push({ url: u, method: method, body: typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody == null ? null : rawBody) });
      if (method === 'POST' && u.indexOf('/api/social/uploads?ext=') !== -1) {
        window.__lastUpload = { size: rawBody && rawBody.size != null ? rawBody.size : null, type: rawBody && rawBody.type ? rawBody.type : null };
        return Promise.resolve(res(200, { url: u.indexOf('ext=.webm') !== -1 ? '/uploads/UPL-DEMO-V.webm' : '/uploads/UPL-DEMO02.jpg' }));
      }
      if (method === 'PATCH' && u.indexOf('/api/auth/me') !== -1) {
        window.__patchCount++;
        var pb = {}; try { pb = JSON.parse(rawBody || '{}'); } catch (e) {}
        window.__patchedMe = pb;
        var nu = {}; var base = srvUser(); for (var k in base) nu[k] = base[k]; for (var k2 in pb) nu[k2] = pb[k2];
        window.__serverUser = nu;
        return Promise.resolve(res(200, { user: nu }));
      }
      if (method === 'GET' && u.indexOf('/api/auth/me') !== -1) return Promise.resolve(res(200, { user: srvUser() }));
      if (method === 'GET' && u.indexOf('/api/health') !== -1) return Promise.resolve(res(200, { status: 'ok', db: 'ok', tables: 60 }));
      if (method === 'GET' && u.indexOf('/api/social/users/USR-000101') !== -1) {
        if (u.indexOf('/posts') !== -1) return Promise.resolve(res(200, { posts: [] }));
        var me = srvUser();
        me.isSelf = true; me.followedByMe = false; me.followerCount = 2; me.followingCount = 3;
        me.stats = { postCount: 0, repostCount: 0, likeReceivedCount: 0, likeCount: 0, favoriteCount: 0 };
        return Promise.resolve(res(200, { user: me }));
      }
    }
    return realFetch(url, opts);
  };
})();}catch(e){}`;

// ── 静态壳（DEMO01=真 200×100 PNG 供非退化几何；DEMO02=1×1 像素；DEMO-V=现场录制 webm 运行时读盘） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.webm': 'video/webm' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/uploads/UPL-DEMO01.jpg') { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(PNG_200_100); return; }
  if (p === '/uploads/UPL-DEMO02.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(PIXEL_PNG); return; }
  if (p === '/uploads/UPL-DEMO-V.webm') {
    try {
      res.writeHead(200, { 'Content-Type': 'video/webm' });
      res.end(fs.readFileSync(path.join(__dirname, 'tmp-631-demo-v.webm')));
    } catch (e) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); }
    return;
  }
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
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
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

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

// 页面内录制 webm（canvas 320×180 约 0.4s）→ 返回 base64（DEMO-V 素材）或注入 File 'test.mp4' 到输入框
const RECORD_BODY = `function(){
  var c = document.createElement('canvas'); c.width = 320; c.height = 180;
  var ctx = c.getContext('2d');
  var chunks = [];
  var stream = c.captureStream(30);
  var mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : (MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm');
  var rec = new MediaRecorder(stream, { mimeType: mime });
  rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
  var done = new Promise(function (res) { rec.onstop = res; });
  var frames = 0;
  (function tick() {
    ctx.fillStyle = (frames % 2) ? '#4648d4' : '#e6e8ea';
    ctx.fillRect(0, 0, 320, 180);
    frames++;
    if (frames < 22) requestAnimationFrame(tick); else rec.stop();
  })();
  rec.start(100);
  return done.then(function () { return new Blob(chunks, { type: mime }); });
}`;
const RECORD_B64_JS = `(function(){ return (${RECORD_BODY})().then(function (blob) {
  return blob.arrayBuffer().then(function (ab) {
    var bytes = new Uint8Array(ab);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  });
}); })()`;
const VIDEO_TO_INPUT_JS = (selector) => `(function(){ return (${RECORD_BODY})().then(function (blob) {
  var f = new File([blob], 'test.mp4', { type: 'video/mp4' });
  var dt = new DataTransfer();
  dt.items.add(f);
  var inp = document.querySelector(${JSON.stringify(selector)});
  if (!inp) throw new Error('input not found');
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}); })()`;

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const cnt = (s, t) => s.split(t).length - 1;
  const get = async (p) => await (await fetch(BASE + p)).text();
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  const connectCdp = async (port) => {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    return cdp;
  };

  try {
    // ── S0 静态锚（计数=写锚前实测口径） ──
    const siteSrc = await get('/assets/js/site-config.js');
    const setSrc = await get('/assets/js/settings-modal.js');
    const profileSrc = await get('/pages/community-profile.html');
    const fcSrc = await get('/pages/fluidcanvas.html');
    const comI18n = await get('/assets/i18n/common.i18n.js');
    const proI18n = await get('/assets/i18n/community-profile.i18n.js');
    ok('S0a site-config：58.25 赋值 1 + changelog 1 + rev 00348-/00349- 各 2（站点+FC 双条目）+ FC 48.1 赋值 1 + MN_CompressVideo/MN_VideoCap 各 1',
      cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.28'") === 1 && cnt(siteSrc, '// v0.2.58.28 = ') === 1 &&
      cnt(siteSrc, '00348-') === 2 && cnt(siteSrc, '00349-') === 2 &&
      cnt(siteSrc, "window.FLUIDCANVAS_VERSION = 'v10.28.52.4'") === 1 &&
      cnt(siteSrc, 'MN_CompressVideo') === 1 && cnt(siteSrc, 'MN_VideoCap') === 2,
      'r40=' + cnt(siteSrc, '00348-') + ' r41=' + cnt(siteSrc, '00349-'));
    ok('S0b settings-modal 58.25 件：window.MN_CropDialog ×2 + MN_CropDialog.open ×4 + applyCrop ×8 + data-crop ×3 + mn-crop-stage ×5 + windowFromZoom ×3 + stDoUpload ×5 + 重裁钮 ×2×2 + settings-banner-img ×7 + settings-banner-video ×7 + stIsVideoUrl ×3 + vp9 ×1 + captureStream ×2 + MN_CompressVideo ×1 + MN_VideoCap ×2 + mnVideoCap ×3 + height: 144px ×1 + 96px 零残留',
      cnt(setSrc, 'window.MN_CropDialog') === 2 && cnt(setSrc, 'MN_CropDialog.open') === 4 && cnt(setSrc, 'applyCrop') === 8 &&
      cnt(setSrc, 'data-crop') === 3 && cnt(setSrc, 'mn-crop-stage') === 5 && cnt(setSrc, 'windowFromZoom') === 3 &&
      cnt(setSrc, 'stDoUpload') === 5 && cnt(setSrc, 'settingsBannerReCropBtn') === 2 && cnt(setSrc, 'settingsAvatarReCropBtn') === 2 &&
      cnt(setSrc, 'settings-banner-img') === 7 && cnt(setSrc, 'settings-banner-video') === 7 && cnt(setSrc, 'stIsVideoUrl') === 3 &&
      cnt(setSrc, 'video/webm;codecs=vp9') === 1 && cnt(setSrc, 'captureStream') === 2 &&
      cnt(setSrc, 'MN_CompressVideo') === 1 && cnt(setSrc, 'MN_VideoCap') === 2 && cnt(setSrc, 'mnVideoCap') === 3 &&
      cnt(setSrc, 'height: 144px') === 1 && cnt(setSrc, 'height: 96px') === 0,
      'crop=' + cnt(setSrc, 'window.MN_CropDialog') + ' wfz=' + cnt(setSrc, 'windowFromZoom') + ' vid=' + cnt(setSrc, 'settings-banner-video'));
    ok('S0c 资料页 58.25 件：profile-banner-video ×3 + isProfileVideoUrl ×3 + VIDEO_EXTS ×4 + 重裁钮 ×3/×2 + MN_CropDialog ×25 + profile-banner-crop ×9 + profile-banner-img ×3 + avatarCrop ×10 + bannerCrop ×5 + profile-avatar-img ×5（52.1 has-frame 规则 +1）+ accept 视频 ×1 + height: 210px ×2 + 140px 零残留（post-media/注释 2 处豁免）+ 视频 i18n 锚 ×1/×1/×1/×2',
      cnt(profileSrc, 'profile-banner-video') === 3 && cnt(profileSrc, 'isProfileVideoUrl') === 3 && cnt(profileSrc, 'VIDEO_EXTS') === 4 &&
      cnt(profileSrc, 'editBannerReCropBtn') === 3 && cnt(profileSrc, 'editAvatarReCropBtn') === 2 &&
      cnt(profileSrc, 'MN_CropDialog') === 25 && cnt(profileSrc, 'profile-banner-crop') === 9 && cnt(profileSrc, 'profile-banner-img') === 3 &&
      cnt(profileSrc, 'avatarCrop') === 10 && cnt(profileSrc, 'bannerCrop') === 5 && cnt(profileSrc, 'profile-avatar-img') === 5 &&
      cnt(profileSrc, '.mp4,.webm,.mov') === 1 && cnt(profileSrc, 'height: 210px') === 2 &&
      cnt(profileSrc, 'avatarNoVideo') === 1 && cnt(profileSrc, 'videoLocked') === 1 && cnt(profileSrc, 'videoCompressing') === 1 && cnt(profileSrc, 'videoFail') === 2,
      'crop=' + cnt(profileSrc, 'MN_CropDialog') + ' v=' + cnt(profileSrc, 'profile-banner-video'));
    ok('S0d FC 页 48.2 件：fc-ch-avatar-crop ×6 + fc-ch-avatar-img ×4 + v10.28.48.2 ×3（58.26 新注释）+ 48.1/48.0 注释历史冻结 ×4/×2 + bannerUrl ×0（avatar-only 边界）+ MN_CropDialog ×4 + avatarCrop ×12 + applyCrop ×2',
      cnt(fcSrc, 'fc-ch-avatar-crop') === 6 && cnt(fcSrc, 'fc-ch-avatar-img') === 4 &&
      cnt(fcSrc, 'v10.28.48.2') === 3 && cnt(fcSrc, 'v10.28.48.1') === 4 && cnt(fcSrc, 'v10.28.48.0') === 2 &&
      cnt(fcSrc, 'bannerUrl') === 0 && cnt(fcSrc, 'MN_CropDialog') === 4 && cnt(fcSrc, 'avatarCrop') === 12 && cnt(fcSrc, 'applyCrop') === 2,
      'crop=' + cnt(fcSrc, 'fc-ch-avatar-crop') + ' 482=' + cnt(fcSrc, 'v10.28.48.2') + ' 481=' + cnt(fcSrc, 'v10.28.48.1') + ' 480=' + cnt(fcSrc, 'v10.28.48.0'));
    ok('S0e i18n 新键：common crop 6+reCrop 2+video 4 键单引号 ×11 各 + profile reCrop 2+video 4 键单引号 ×11 各 + zh-Hant 双引号 ×1 各 + 生成标记 ×1',
      cnt(comI18n, "'crop.titleAvatar'") === 11 && cnt(comI18n, "'crop.hint'") === 11 && cnt(comI18n, "'crop.loadFail'") === 11 &&
      cnt(comI18n, "'settings.profile.reCropAvatar'") === 11 && cnt(comI18n, "'settings.profile.reCropBanner'") === 11 &&
      cnt(comI18n, "'settings.profile.videoLocked'") === 11 && cnt(comI18n, "'settings.profile.videoCompressing'") === 11 &&
      cnt(comI18n, "'settings.profile.avatarNoVideo'") === 11 && cnt(comI18n, "'settings.profile.videoFail'") === 11 &&
      cnt(comI18n, '"crop.titleAvatar"') === 1 && cnt(comI18n, '"settings.profile.videoLocked"') === 1 && cnt(comI18n, '__ZH_HANT_AUTO__') === 1 &&
      cnt(proI18n, "'prof.edit.reCropAvatar'") === 11 && cnt(proI18n, "'prof.edit.reCropBanner'") === 11 &&
      cnt(proI18n, "'prof.toast.videoLocked'") === 11 && cnt(proI18n, "'prof.edit.videoCompressing'") === 11 &&
      cnt(proI18n, "'prof.edit.avatarNoVideo'") === 11 && cnt(proI18n, "'prof.edit.videoFail'") === 11 &&
      cnt(proI18n, '"prof.edit.reCropAvatar"') === 1 && cnt(proI18n, '"prof.toast.videoLocked"') === 1 && cnt(proI18n, '__ZH_HANT_AUTO__') === 1,
      'crop=' + cnt(comI18n, "'crop.titleAvatar'") + ' v=' + cnt(comI18n, "'settings.profile.videoLocked'"));
    const BACKEND = path.resolve(__dirname, '..');
    const mig030 = fs.readFileSync(path.join(BACKEND, 'backend-v2/migrations/030_user_crop.sql'), 'utf8');
    const authJs = fs.readFileSync(path.join(BACKEND, 'backend-v2/src/routes/public/auth.js'), 'utf8');
    const socialJs = fs.readFileSync(path.join(BACKEND, 'backend-v2/src/routes/public/social.js'), 'utf8');
    ok('S0f 后端 58.25 件：030 迁移 avatar_crop ×2 + auth.js avatar_crop = ?/banner_crop = ? 各 ×2 + parseCrop ×7 + social.js parseCrop ×6 + bannerCrop: ×1 + video/webm ×1',
      cnt(mig030, 'avatar_crop') === 2 && cnt(authJs, 'avatar_crop = ?') === 2 && cnt(authJs, 'banner_crop = ?') === 2 &&
      cnt(authJs, 'parseCrop') === 7 && cnt(socialJs, 'parseCrop') === 6 && cnt(socialJs, 'bannerCrop:') === 1 && cnt(socialJs, 'video/webm') === 1,
      'mig=' + cnt(mig030, 'avatar_crop') + ' p=' + cnt(authJs, 'parseCrop'));

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const setFile = async (selector, tmpFile) => {
      await cdp.send('DOM.enable');
      const docNode = await cdp.send('DOM.getDocument', { depth: -1 });
      const fileNode = await cdp.send('DOM.querySelector', { nodeId: docNode.root.nodeId, selector: selector });
      await cdp.send('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [tmpFile] });
    };
    const readUserLs = () => cdp.evalJs("(function(){ try { return JSON.parse(localStorage.getItem('slati_user') || 'null') || null; } catch (e) { return null; } })()");
    const counts = () => cdp.evalJs("(function(){ var up = window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/social/uploads') !== -1; }).length; return { up: up, patch: window.__patchCount || 0, patched: window.__patchedMe, lastUpload: window.__lastUpload }; })()");
    const openSettings = async () => {
      await cdp.evalJs('window.SlatiSettings.open()');
      await waitFor(cdp, "!!document.getElementById('settingsCard')", 10000, '设置弹窗打开');
      await sleep(400);
    };
    const toastText = () => cdp.evalJs("(function(){ var t = document.getElementById('settingsProfileToast'); return t ? { text: t.textContent, active: t.classList.contains('active') } : null; })()");
    const recToast = () => cdp.evalJs("(function(){ window.__toasts = []; if (window.MN_Report) { var orig = window.MN_Report.toast; window.MN_Report.toast = function (msg, isErr) { window.__toasts.push({ msg: msg, err: !!isErr }); if (orig) orig.apply(window.MN_Report, arguments); }; } return true; })()");
    const lastToast = () => cdp.evalJs("(function(){ return window.__toasts && window.__toasts.length ? window.__toasts[window.__toasts.length - 1] : null; })()");
    const waitDialog = async (label) => { await waitFor(cdp, "!!document.querySelector('.mn-crop-stage')", 25000, label); await sleep(400); };
    const dialogInfo = () => cdp.evalJs("(function(){ var st = document.querySelector('.mn-crop-stage'); if (!st) return null; var m = st.querySelector('img') || st.querySelector('video'); var r = st.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, tag: m ? m.tagName : null, src: m ? String(m.getAttribute('src') || m.src) : null }; })()");
    const viewport = () => cdp.evalJs('(function(){ return { w: window.innerWidth, h: window.innerHeight }; })()');
    const probeRect = () => cdp.evalJs('window.__probeRect');
    const confirmCrop = async () => { await cdp.evalJs("document.querySelector('.mn-crop-confirm').click()"); await sleep(400); };
    const cancelCrop = async () => { await cdp.evalJs("document.querySelector('.mn-crop-cancel').click()"); await sleep(400); };
    const wheelAt = async (x, y, deltaY) => {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(x), y: Math.round(y), deltaX: 0, deltaY: deltaY });
      await sleep(90);
    };
    const dragAt = async (x, y, dx, dy) => {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', buttons: 1, clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(x + dx), y: Math.round(y + dy), button: 'left', buttons: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(x + dx), y: Math.round(y + dy), button: 'left', buttons: 0, clickCount: 1 });
      await sleep(200);
    };
    const touchDragAt = async (x, y, dx, dy) => {
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y), radiusX: 1, radiusY: 1, force: 1, id: 0 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(x + dx), y: Math.round(y + dy), radiusX: 1, radiusY: 1, force: 1, id: 0 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await sleep(200);
    };
    const pressEsc = async () => {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
      await sleep(400);
    };
    const openCropDirect = (kind, b64) => cdp.evalJs(`(function(){ window.__probeRect = null; window.MN_CropDialog.open({ kind: ${JSON.stringify(kind)}, src: 'data:image/png;base64,${b64}', initial: null, onConfirm: function (rect) { window.__probeRect = rect; } }); return true; })()`);
    const openEditModal = async () => {
      await cdp.evalJs("document.getElementById('profileEditBtn').click()");
      await waitFor(cdp, "!!document.getElementById('editAvatarBtn')", 10000, '资料页编辑弹窗');
      await sleep(500);
    };
    const tmpAv = path.join(__dirname, 'tmp-av-631.jpg');
    const tmpGif = path.join(__dirname, 'tmp-av-631.gif');
    const tmpMp4 = path.join(__dirname, 'tmp-av-631.mp4');
    fs.writeFileSync(tmpAv, PIXEL_PNG);
    fs.writeFileSync(tmpGif, PIXEL_PNG);
    fs.writeFileSync(tmpMp4, PIXEL_PNG); // 假视频字节——门禁在解码前拦截，内容无需真视频

    // ── 准备 DEMO-V 素材：about:blank 现场录制真 webm → 写盘（V4/V6/V7 依赖） ──
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(500);
    const demoB64 = await cdp.evalJs(RECORD_B64_JS);
    fs.writeFileSync(path.join(__dirname, 'tmp-631-demo-v.webm'), Buffer.from(demoB64, 'base64'));
    console.log('  ℹ️ DEMO-V.webm 已生成 ' + (demoB64.length * 3 / 4 | 0) + 'B');

    // ── C2：Esc 捕获相——关裁切弹窗不连锁关设置弹窗 ──
    await nav(BASE + '/index.html?nov&prem', "!!document.querySelector('#slati-sidebar .user-module')", 'C2 主页');
    await openSettings();
    await setFile('#settingsAvatarFile', tmpAv);
    await waitDialog('C2 裁切弹窗');
    await pressEsc();
    let s = await counts();
    let c2 = await cdp.evalJs("(function(){ return { overlay: !!document.querySelector('.mn-crop-overlay'), settings: !!document.getElementById('settingsCard') }; })()");
    ok('C2 Esc：裁切弹窗关 + 设置弹窗仍在（捕获相 stopPropagation 不连锁关）+ 零上传零 PATCH', c2.overlay === false && c2.settings && s.up === 0 && s.patch === 0, JSON.stringify({ c2, up: s.up, patch: s.patch }));

    // ── C3：设置横幅上传 confirm 精确体（keys+rect 深等）+ slati_user 合并写 + 预览 data-crop ──
    await nav(BASE + '/index.html?nov&prem', "!!document.querySelector('#slati-sidebar .user-module')", 'C3 主页');
    await openSettings();
    await setFile('#settingsBannerFile', tmpAv);
    await waitDialog('C3 裁切弹窗');
    await confirmCrop();
    await sleep(600);
    s = await counts();
    const c3u = await readUserLs();
    const c3prev = await cdp.evalJs("(function(){ var bp = document.getElementById('settingsBannerPreview'); var m = bp.querySelector('.settings-banner-img'); return { hasImg: bp.classList.contains('has-img'), src: m ? m.getAttribute('src') : null, dataCrop: m ? m.dataset.crop : null, w: m ? m.style.width : null }; })()");
    ok('C3 设置横幅上传：上传恰 1 + PATCH 恰 1 体 keys bannerUrl,bannerCrop + rect 深等 {0,0,1,1} + slati_user 合并写（字段保留）+ 预览 img data-crop 精确',
      s.up === 1 && s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'bannerUrl,bannerCrop' &&
      JSON.stringify(s.patched.bannerCrop) === '{"x":0,"y":0,"w":1,"h":1}' && s.patched.bannerUrl === '/uploads/UPL-DEMO02.jpg' &&
      c3u && c3u.bannerUrl === '/uploads/UPL-DEMO02.jpg' && JSON.stringify(c3u.bannerCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      c3u.displayName === '电池用户' && c3prev.hasImg && c3prev.src === '/uploads/UPL-DEMO02.jpg' &&
      c3prev.dataCrop === '{"x":0,"y":0,"w":1,"h":1}',
      JSON.stringify({ up: s.up, patch: s.patch, keys: s.patched && Object.keys(s.patched).join(','), rect: s.patched && s.patched.bannerCrop, c3prev }));
    const c15s = await cdp.evalJs("getComputedStyle(document.getElementById('settingsBannerPreview')).height");
    ok('C15a 设置横幅预览高度 computed 144px（钦定③ 96→144）', c15s === '144px', c15s);

    // ── V2：MN_VideoCap 纯函数直测 ──
    const v2 = await cdp.evalJs("[window.MN_VideoCap(65), window.MN_VideoCap(5), window.MN_VideoCap(NaN), window.MN_VideoCap(Infinity), window.MN_VideoCap(-3), window.MN_VideoCap(0)]");
    ok('V2 MN_VideoCap：65→60 / 5→5 / NaN→60 / ∞→60 / -3→60 / 0→60（超 60s 截取纯逻辑）', JSON.stringify(v2) === '[60,5,60,60,60,60]', JSON.stringify(v2));

    // ── C9：设置横幅重裁（远程 URL 零 blob 处理 + PATCH 恰 {bannerCrop}） ──
    await nav(BASE + '/index.html?banner&prem', "!!document.querySelector('#slati-sidebar .user-module')", 'C9 主页');
    await openSettings();
    await cdp.evalJs("document.getElementById('settingsBannerReCropBtn').click()");
    await waitDialog('C9 重裁弹窗');
    let c9d = await dialogInfo();
    await confirmCrop();
    await sleep(600);
    s = await counts();
    const c9u = await readUserLs();
    const c9prev = await cdp.evalJs("(function(){ var m = document.querySelector('#settingsBannerPreview .settings-banner-img'); return m ? m.dataset.crop : null; })()");
    ok('C9 设置重裁：stage src=远程 URL 无 blob: + confirm → PATCH 恰 {bannerCrop:{0,0,1,1}} 无 bannerUrl + slati_user.bannerCrop 写 + 预览 data-crop 更新',
      c9d && c9d.src === '/uploads/UPL-DEMO01.jpg' && c9d.src.indexOf('blob:') === -1 &&
      s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'bannerCrop' &&
      JSON.stringify(s.patched.bannerCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      c9u && JSON.stringify(c9u.bannerCrop) === '{"x":0,"y":0,"w":1,"h":1}' && c9u.bannerUrl === '/uploads/UPL-DEMO01.jpg' &&
      c9prev === '{"x":0,"y":0,"w":1,"h":1}',
      JSON.stringify({ src: c9d && c9d.src, keys: s.patched && Object.keys(s.patched).join(','), ls: c9u && c9u.bannerCrop, prev: c9prev }));

    // ── C6：图库选图 → 取消 → 零上传零 PATCH ──
    await nav(BASE + '/index.html?nov&prem&lib', "!!document.querySelector('#slati-sidebar .user-module')", 'C6 主页');
    await openSettings();
    await cdp.evalJs("document.getElementById('settingsBannerLibBtn').click()");
    await waitFor(cdp, "!!document.querySelector('.settings-lib-grid')", 5000, 'C6 图库网格');
    await cdp.evalJs("document.querySelector('.settings-lib-cell').click()");
    await waitDialog('C6 图库裁切弹窗');
    await cancelCrop();
    s = await counts();
    ok('C6 图库取消：弹窗开（图库同漏斗）+ 取消零上传零 PATCH', s.up === 0 && s.patch === 0, JSON.stringify({ up: s.up, patch: s.patch }));

    // ── C13：GIF 保真（stage blob: + 上传体原字节 image/gif） ──
    await nav(BASE + '/index.html?nov&prem', "!!document.querySelector('#slati-sidebar .user-module')", 'C13 主页');
    await openSettings();
    await setFile('#settingsBannerFile', tmpGif);
    await waitDialog('C13 gif 裁切弹窗');
    let c13d = await dialogInfo();
    await confirmCrop();
    await sleep(600);
    s = await counts();
    ok('C13 GIF 保真：stage src blob: 前缀（objectURL 不重编码）+ 上传体原字节（size 相等+type image/gif）+ PATCH keys bannerUrl,bannerCrop',
      c13d && c13d.src.indexOf('blob:') === 0 &&
      s.lastUpload && s.lastUpload.size === PIXEL_PNG.length && s.lastUpload.type === 'image/gif' &&
      s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'bannerUrl,bannerCrop',
      JSON.stringify({ src: c13d && c13d.src, up: s.lastUpload, keys: s.patched && Object.keys(s.patched).join(',') }));

    // ── C4：拖拽数学（200×100 真 PNG；zoom×2 视窗重算 + 拖 +100x → Node 同式复算逐位比对） ──
    await nav(BASE + '/index.html?nov', "!!document.querySelector('#slati-sidebar .user-module')", 'C4 主页');
    await openCropDirect('avatar', B64_200_100);
    await waitDialog('C4 弹窗');
    let c4d = await dialogInfo();
    await wheelAt(c4d.x, c4d.y, -120);
    await wheelAt(c4d.x, c4d.y, -120);
    await dragAt(c4d.x, c4d.y, 100, 0);
    await confirmCrop();
    const c4r = await probeRect();
    const c4v = await viewport();
    const c4e = simDialog(c4v.w, c4v.h, 'avatar', 200, 100, [{ t: 'wheel', deltaY: -120 }, { t: 'wheel', deltaY: -120 }, { t: 'drag', dx: 100, dy: 0 }]);
    ok('C4 拖拽数学：zoom×2 后视窗重算 + 拖 +100x（x -= dx/(Nw·s) 跟手）→ confirm 产物与 Node 同式复算逐位一致 + 视窗已物化 w<1',
      c4r && c4r.x === c4e.x && c4r.y === c4e.y && c4r.w === c4e.w && c4r.h === c4e.h && c4r.w < 1,
      JSON.stringify({ got: c4r, exp: c4e }));

    // ── C5：缩放钳制（方形图 200×200：25 次放大→s=3·sFull w=1/3；40 次缩小→s=sFull 视窗回整图） ──
    await nav(BASE + '/index.html?nov', "!!document.querySelector('#slati-sidebar .user-module')", 'C5 主页');
    await openCropDirect('avatar', B64_200_200);
    await waitDialog('C5 弹窗');
    let c5d = await dialogInfo();
    for (let i = 0; i < 25; i++) await wheelAt(c5d.x, c5d.y, -120);
    await confirmCrop();
    const c5in = await probeRect();
    await openCropDirect('avatar', B64_200_200);
    await waitDialog('C5 弹窗二');
    c5d = await dialogInfo();
    for (let i = 0; i < 40; i++) await wheelAt(c5d.x, c5d.y, 120);
    await confirmCrop();
    const c5out = await probeRect();
    const c5v = await viewport();
    const c5eIn = simDialog(c5v.w, c5v.h, 'avatar', 200, 200, (function () { const a = []; for (let i = 0; i < 25; i++) a.push({ t: 'wheel', deltaY: -120 }); return a; })());
    const c5eOut = simDialog(c5v.w, c5v.h, 'avatar', 200, 200, (function () { const a = []; for (let i = 0; i < 40; i++) a.push({ t: 'wheel', deltaY: 120 }); return a; })());
    ok('C5 钳制：25 放大→w 钳 [1/3,1]（方形图 3·sFull 时 w=1/3）+ 40 缩小→sFull 视窗回整图 {0,0,1,1}（重裁可缩回整图）',
      c5in && c5in.w === c5eIn.w && c5in.h === c5eIn.h && c5in.x === c5eIn.x && c5in.y === c5eIn.y &&
      Math.abs(c5in.w - 1 / 3) < 0.001 &&
      c5out && JSON.stringify(c5out) === '{"x":0,"y":0,"w":1,"h":1}',
      JSON.stringify({ in: c5in, expIn: c5eIn, out: c5out, expOut: c5eOut }));

    // ── C14：触屏拖拽（zoom×2 后 touchStart/Move/End → 与鼠标同数学） ──
    await nav(BASE + '/index.html?nov', "!!document.querySelector('#slati-sidebar .user-module')", 'C14 主页');
    await openCropDirect('avatar', B64_200_100);
    await waitDialog('C14 弹窗');
    let c14d = await dialogInfo();
    await wheelAt(c14d.x, c14d.y, -120);
    await wheelAt(c14d.x, c14d.y, -120);
    await touchDragAt(c14d.x, c14d.y, 80, 0);
    await confirmCrop();
    const c14r = await probeRect();
    const c14v = await viewport();
    const c14e = simDialog(c14v.w, c14v.h, 'avatar', 200, 100, [{ t: 'wheel', deltaY: -120 }, { t: 'wheel', deltaY: -120 }, { t: 'drag', dx: 80, dy: 0 }]);
    ok('C14 触屏：touch 拖拽走同一 pointer 链（dx=80 跟手）→ confirm 产物与复算逐位一致',
      c14r && c14r.x === c14e.x && c14r.y === c14e.y && c14r.w === c14e.w && c14r.h === c14e.h,
      JSON.stringify({ got: c14r, exp: c14e }));

    // ── C7：资料页横幅重裁（保存 PATCH 恰 {bannerCrop} 无其他字段） ──
    await nav(BASE + '/pages/community-profile.html?id=USR-000101&banner&prem', "!!document.getElementById('profileEditBtn')", 'C7 资料页');
    await openEditModal();
    await recToast();
    await cdp.evalJs("document.getElementById('editBannerReCropBtn').click()");
    await waitDialog('C7 重裁弹窗');
    let c7d = await dialogInfo();
    // 滚轮放大一次（rect 必异于 {0,0,1,1}——cropSame 语义比较不交互 confirm 的整图 rect 视为无改动不入包）
    await wheelAt(c7d.x, c7d.y, -120);
    await confirmCrop();
    await sleep(500);
    await cdp.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(900);
    s = await counts();
    const c7v = await viewport();
    const c7e = simDialog(c7v.w, c7v.h, 'banner', 200, 100, [{ t: 'wheel', deltaY: -120 }]);
    const c7expStr = JSON.stringify({ x: c7e.x, y: c7e.y, w: c7e.w, h: c7e.h });
    const c7hdr = await cdp.evalJs("(function(){ var m = document.querySelector('#profileHeader .profile-banner-img'); return m ? { crop: m.dataset.crop, src: m.getAttribute('src') } : null; })()");
    ok('C7 资料页重裁：stage src=DEMO01 无 blob: + 放大确认 → 保存 PATCH 恰 {bannerCrop}（无 bannerUrl 无 name/bio）rect 与 Node 同式复算逐位一致 + loadProfile 后头部 img data-crop 同 rect',
      c7d && c7d.src === '/uploads/UPL-DEMO01.jpg' &&
      s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'bannerCrop' &&
      JSON.stringify(s.patched.bannerCrop) === c7expStr &&
      c7hdr && c7hdr.crop === c7expStr,
      JSON.stringify({ src: c7d && c7d.src, keys: s.patched && Object.keys(s.patched).join(','), got: s.patched && s.patched.bannerCrop, exp: c7e, hdr: c7hdr }));

    // ── C12：爷爷 null crop 居中 cover 零回归（200×100 真图居中覆盖=旧 background cover+center 等价） ──
    await nav(BASE + '/pages/community-profile.html?id=USR-000101&banner', "!!document.getElementById('profileEditBtn')", 'C12 资料页');
    await waitFor(cdp, "(function(){ var m = document.querySelector('#profileHeader .profile-avatar-img'); return m && m.style.width !== ''; })()", 10000, 'C12 头像几何');
    let c12 = await cdp.evalJs("(function(){ var ai = document.querySelector('#profileHeader .profile-avatar-img'); var ab = ai.parentElement; var bi = document.querySelector('#profileHeader .profile-banner-img'); var bb = bi.parentElement; return { aw: ab.clientWidth, ah: ab.clientHeight, asw: parseFloat(ai.style.width), asl: parseFloat(ai.style.left), ast: parseFloat(ai.style.top), bw: bb.clientWidth, bh: bb.clientHeight, bsw: parseFloat(bi.style.width), bsl: parseFloat(bi.style.left), bst: parseFloat(bi.style.top) }; })()");
    const c12expAv = (() => { const W = c12.aw, H = c12.ah, s = Math.max(W / 200, H / 100); return { w: 200 * s, l: W / 2 - 200 * s / 2, t: H / 2 - 100 * s / 2 }; })();
    const c12expBn = (() => { const W = c12.bw, H = c12.bh, s = Math.max(W / 200, H / 100); return { w: 200 * s, l: W / 2 - 200 * s / 2, t: H / 2 - 100 * s / 2 }; })();
    ok('C12 爷爷零回归：null crop → {0,0,1,1} 居中 cover（头像/横幅几何与解析值 <0.01）+ 高度 210px',
      Math.abs(c12.asw - c12expAv.w) < 0.01 && Math.abs(c12.asl - c12expAv.l) < 0.01 && Math.abs(c12.ast - c12expAv.t) < 0.01 &&
      Math.abs(c12.bsw - c12expBn.w) < 0.01 && Math.abs(c12.bsl - c12expBn.l) < 0.01 && Math.abs(c12.bst - c12expBn.t) < 0.01 &&
      (await cdp.evalJs("getComputedStyle(document.querySelector('.profile-banner')).height")) === '210px',
      JSON.stringify({ av: c12expAv, bn: c12expBn, got: c12 }));

    // ── V3a：设置弹窗 free + mp4 → 锁 toast + 升级链 + 零上传零弹窗 ──
    await nav(BASE + '/index.html?nov', "!!document.querySelector('#slati-sidebar .user-module')", 'V3a 主页（free）');
    await openSettings();
    await setFile('#settingsBannerFile', tmpMp4);
    await sleep(600);
    s = await counts();
    const v3at = await toastText();
    const v3aLk = await cdp.evalJs("(function(){ var a = document.getElementById('settingsBannerGifUpgradeLink'); return a ? getComputedStyle(a).display !== 'none' : null; })()");
    const v3aDlg = await cdp.evalJs("!!document.querySelector('.mn-crop-overlay')");
    ok('V3a free 设置 mp4：videoLocked toast 精确串 + 升级链显 + 零上传零 PATCH + 零弹窗', v3at && v3at.text === '视频横幅为高级订阅专属功能' && v3at.active && v3aLk === true && s.up === 0 && s.patch === 0 && v3aDlg === false, JSON.stringify({ t: v3at, lk: v3aLk, up: s.up, patch: s.patch, dlg: v3aDlg }));

    // ── V6：设置弹窗 premium 真视频全链 ──
    await nav(BASE + '/index.html?nov&prem', "!!document.querySelector('#slati-sidebar .user-module')", 'V6 主页（prem）');
    await openSettings();
    await cdp.evalJs(VIDEO_TO_INPUT_JS('#settingsBannerFile'));
    await waitFor(cdp, "!!document.querySelector('.mn-crop-stage video')", 25000, 'V6 压缩后裁切弹窗');
    let v6d = await dialogInfo();
    await confirmCrop();
    await sleep(700);
    s = await counts();
    const v6u = await readUserLs();
    const v6prev = await cdp.evalJs("(function(){ var bp = document.getElementById('settingsBannerPreview'); var v = bp.querySelector('.settings-banner-video'); return v ? { autoplay: v.autoplay, muted: v.muted, loop: v.loop, playsinline: v.hasAttribute('playsinline'), src: v.getAttribute('src'), crop: v.dataset.crop } : null; })()");
    ok('V6 设置视频全链：stage 为 video + confirm → 上传 ext=.webm → PATCH {bannerUrl:DEMO-V,bannerCrop} + slati_user 写 + 预览 video autoplay/muted/loop/playsinline + data-crop',
      v6d && v6d.tag === 'VIDEO' &&
      s.up === 1 && s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'bannerUrl,bannerCrop' &&
      s.patched.bannerUrl === '/uploads/UPL-DEMO-V.webm' && JSON.stringify(s.patched.bannerCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      v6u && v6u.bannerUrl === '/uploads/UPL-DEMO-V.webm' &&
      v6prev && v6prev.autoplay && v6prev.muted && v6prev.loop && v6prev.playsinline &&
      v6prev.src === '/uploads/UPL-DEMO-V.webm' && v6prev.crop === '{"x":0,"y":0,"w":1,"h":1}',
      JSON.stringify({ tag: v6d && v6d.tag, keys: s.patched && Object.keys(s.patched).join(','), url: s.patched && s.patched.bannerUrl, prev: v6prev }));

    // ── V7：视频横幅重裁（远程 .webm → stage video + PATCH 只 bannerCrop） ──
    await nav(BASE + '/index.html?vbanner&prem', "!!document.querySelector('#slati-sidebar .user-module')", 'V7 主页');
    await openSettings();
    const v7pv = await cdp.evalJs("(function(){ var bp = document.getElementById('settingsBannerPreview'); var v = bp.querySelector('.settings-banner-video'); return v ? { src: v.getAttribute('src'), hasImg: bp.classList.contains('has-img') } : null; })()");
    await cdp.evalJs("document.getElementById('settingsBannerReCropBtn').click()");
    await waitDialog('V7 重裁弹窗');
    let v7d = await dialogInfo();
    await confirmCrop();
    await sleep(600);
    s = await counts();
    const v7u = await readUserLs();
    ok('V7 视频重裁：预览即 video（src DEMO-V）+ 重裁 stage 为 video 远程 URL 无 blob: + PATCH 恰 {bannerCrop} + slati_user.bannerCrop 写',
      v7pv && v7pv.src === '/uploads/UPL-DEMO-V.webm' && v7pv.hasImg &&
      v7d && v7d.tag === 'VIDEO' && v7d.src.indexOf('blob:') === -1 &&
      s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'bannerCrop' &&
      v7u && JSON.stringify(v7u.bannerCrop) === '{"x":0,"y":0,"w":1,"h":1}' && v7u.bannerUrl === '/uploads/UPL-DEMO-V.webm',
      JSON.stringify({ pv: v7pv, dlg: v7d && { tag: v7d.tag, src: v7d.src }, keys: s.patched && Object.keys(s.patched).join(',') }));

    // ── V3b：资料页 basic + mp4 → 锁 toast + 升级链 + 零上传零弹窗 ──
    await nav(BASE + '/pages/community-profile.html?id=USR-000101&nov&basic', "!!document.getElementById('profileEditBtn')", 'V3b 资料页（basic）');
    await openEditModal();
    await recToast();
    await setFile('#editBannerFile', tmpMp4);
    await sleep(600);
    s = await counts();
    const v3bt = await lastToast();
    const v3bLk = await cdp.evalJs("(function(){ var a = document.getElementById('bannerGifUpgradeLink'); return a ? getComputedStyle(a).display !== 'none' : null; })()");
    const v3bDlg = await cdp.evalJs("!!document.querySelector('.mn-crop-overlay')");
    ok('V3b basic 资料页 mp4：videoLocked toast 精确串 + 升级链显 + 零上传零 PATCH + 零弹窗', v3bt && v3bt.msg === '视频横幅为高级订阅专属功能' && v3bt.err && v3bLk === true && s.up === 0 && s.patch === 0 && v3bDlg === false, JSON.stringify({ t: v3bt, lk: v3bLk, up: s.up, patch: s.patch, dlg: v3bDlg }));

    // ── V4：资料页 premium 真视频全链（录制→压缩→弹窗→confirm→上传 webm→保存→头部 video） ──
    await nav(BASE + '/pages/community-profile.html?id=USR-000101&nov&prem', "!!document.getElementById('profileEditBtn')", 'V4 资料页（prem）');
    await openEditModal();
    await recToast();
    await cdp.evalJs(VIDEO_TO_INPUT_JS('#editBannerFile'));
    await waitFor(cdp, "!!document.querySelector('.mn-crop-stage video')", 25000, 'V4 压缩后裁切弹窗');
    let v4d = await dialogInfo();
    await confirmCrop();
    await waitFor(cdp, "!!document.querySelector('#editBannerPreview video')", 10000, 'V4 弹窗内视频预览');
    s = await counts();
    await cdp.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(1000);
    s = await counts();
    await waitFor(cdp, "!!document.querySelector('#profileHeader .profile-banner-video')", 10000, 'V4 头部视频');
    const v4hdr = await cdp.evalJs("(function(){ var v = document.querySelector('#profileHeader .profile-banner-video'); return v ? { autoplay: v.autoplay, muted: v.muted, loop: v.loop, playsinline: v.hasAttribute('playsinline'), src: v.getAttribute('src'), crop: v.dataset.crop, parent: v.parentElement.className, hasImgCls: v.parentElement.parentElement.classList.contains('has-img') } : null; })()");
    ok('V4 资料页视频全链：stage video → 上传 ext=.webm → 保存 PATCH {bannerUrl:DEMO-V,bannerCrop:{0,0,1,1}} → loadProfile 头部 video autoplay/muted/loop/playsinline + data-crop + profile-banner-crop 盒 + has-img',
      v4d && v4d.tag === 'VIDEO' &&
      s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'bannerUrl,bannerCrop' &&
      s.patched.bannerUrl === '/uploads/UPL-DEMO-V.webm' && JSON.stringify(s.patched.bannerCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      v4hdr && v4hdr.autoplay && v4hdr.muted && v4hdr.loop && v4hdr.playsinline &&
      v4hdr.src === '/uploads/UPL-DEMO-V.webm' && v4hdr.crop === '{"x":0,"y":0,"w":1,"h":1}' &&
      v4hdr.parent === 'profile-banner-crop' && v4hdr.hasImgCls,
      JSON.stringify({ tag: v4d && v4d.tag, keys: s.patched && Object.keys(s.patched).join(','), hdr: v4hdr }));

    // ── V5：头像链 mp4 拒绝 ──
    await nav(BASE + '/pages/community-profile.html?id=USR-000101&nov&prem', "!!document.getElementById('profileEditBtn')", 'V5 资料页（prem）');
    await openEditModal();
    await recToast();
    await setFile('#editAvatarFile', tmpMp4);
    await sleep(600);
    s = await counts();
    const v5t = await lastToast();
    const v5Dlg = await cdp.evalJs("!!document.querySelector('.mn-crop-overlay')");
    ok('V5 头像链 mp4：toast 头像仅支持图片 + 零上传零 PATCH + 零弹窗（视频只横幅钦定）', v5t && v5t.msg === '头像仅支持图片' && v5t.err && s.up === 0 && s.patch === 0 && v5Dlg === false, JSON.stringify({ t: v5t, up: s.up, patch: s.patch, dlg: v5Dlg }));

    // ── C10：FC 换头像链（keys avatarUrl,avatarCrop 无 bio + 频道卡 wrapper） ──
    await nav(BASE + '/pages/fluidcanvas.html?prem', "!!document.querySelector('#channelOverview .channel-avatar')", 'C10 FC 页');
    await setFile('#fcAvatarFile', tmpAv);
    await waitDialog('C10 FC 裁切弹窗');
    await confirmCrop();
    await waitFor(cdp, "(function(){ var i = document.querySelector('#channelOverview img.fc-ch-avatar-img'); return i && i.getAttribute('src') === '/uploads/UPL-DEMO02.jpg'; })()", 10000, 'C10 频道卡更新');
    s = await counts();
    const c10u = await readUserLs();
    const c10card = await cdp.evalJs("(function(){ var wrap = document.querySelector('#channelOverview .fc-ch-avatar-crop'); var img = wrap && wrap.querySelector('img.fc-ch-avatar-img'); return { wrap: !!wrap, img: !!img, src: img ? img.getAttribute('src') : null, personal: document.getElementById('personalAvatar').getAttribute('src') }; })()");
    ok('C10 FC 链：上传 1 + PATCH 1 体 keys avatarUrl,avatarCrop 无 bio + slati_user 合并写 avatarCrop + 频道卡 .fc-ch-avatar-crop wrapper + 头像换 DEMO02 + personalAvatar 同步',
      s.up === 1 && s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'avatarUrl,avatarCrop' && !('bio' in s.patched) &&
      JSON.stringify(s.patched.avatarCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      c10u && c10u.avatarUrl === '/uploads/UPL-DEMO02.jpg' && JSON.stringify(c10u.avatarCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      c10card.wrap && c10card.img && c10card.src === '/uploads/UPL-DEMO02.jpg' && c10card.personal === '/uploads/UPL-DEMO02.jpg',
      JSON.stringify({ keys: s.patched && Object.keys(s.patched).join(','), card: c10card }));

    // ── C11：FC 显示几何精确值（种子 crop {0.25,0,0.5,1} + DEMO01 200×100 → applyCrop 数学解析比对） ──
    await nav(BASE + '/pages/fluidcanvas.html?crop', "!!document.querySelector('#channelOverview .channel-avatar')", 'C11 FC 页');
    await waitFor(cdp, "(function(){ var i = document.querySelector('#channelOverview img.fc-ch-avatar-img'); return i && i.style.width !== ''; })()", 10000, 'C11 频道卡几何');
    const c11 = await cdp.evalJs("(function(){ var img = document.querySelector('#channelOverview img.fc-ch-avatar-img'); var box = img.parentElement; return { w: box.clientWidth, h: box.clientHeight, sw: parseFloat(img.style.width), sh: parseFloat(img.style.height), sl: parseFloat(img.style.left), st: parseFloat(img.style.top), crop: img.dataset.crop }; })()");
    const c11s = Math.max(c11.w / (0.5 * 200), c11.h / (1 * 100));
    ok('C11 FC 几何：rect {0.25,0,0.5,1} 中心锚定渲染（s=max(W/(w·Nw),H/(h·Nh)) 解析比对 <0.01）+ data-crop 在位',
      Math.abs(c11.sw - 200 * c11s) < 0.01 && Math.abs(c11.sh - 100 * c11s) < 0.01 &&
      Math.abs(c11.sl - (c11.w / 2 - (0.25 + 0.25) * 200 * c11s)) < 0.01 &&
      Math.abs(c11.st - (c11.h / 2 - (0 + 0.5) * 100 * c11s)) < 0.01 &&
      c11.crop === '{"x":0.25,"y":0,"w":0.5,"h":1}',
      JSON.stringify({ got: c11, s: c11s }));

    // ── E：零异常 ──
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|Failed to load resource|slati_entrance|404|429/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    const realConsole = cdp.consoleErrs.filter(e => !noise.test(e));
    ok('E 全程零异常零 console error（噪声已滤）', realErrs.length === 0 && realConsole.length === 0, realErrs.slice(0, 3).join(' | ') + realConsole.slice(0, 3).join(' | '));
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    FAIL++;
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  console.log('\n' + (FAIL ? ('🎉 PASS ' + PASS + ' / 💔 FAIL ' + FAIL) : ('🎉 全部通过 ' + PASS + '/' + PASS)));
  process.exit(FAIL === 0 ? 0 : 1);
})();
