// tmp-probe-channel-glow.js — 用户「FC 首页顶部的个人频道/团队频道边缘亮光割裂 + 频道切换动画很卡」
// G 场景（割裂实证）：暗色下账号卡（.account-personal/#personalAccount、.account-team-wrap/#teamAccount）
//   层栈检查 + 三张对照截图：A 原样 / C 只关 .lg-backdrop 的 SVG 色散滤镜 / B 摘掉全部 lg 层
//   → 像素分析三图差集 = 亮光真身。
// A 场景（卡顿剖析）：rAF 帧剖析 + MutationObserver 换手时刻 + 退出尾被 250ms 换手截断实证
//   + tilt.js mousemove 覆写切场 transform + SlatiTilt.init 监听器堆叠计数/单次 mousemove 开销。
// 跑法：node tmp-probe-channel-glow.js（house CDP 模式；截图无 --disable-gpu，带 --hide-scrollbars 对齐坐标）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4820 + Math.floor(Math.random() * 380);
const CDP_PORT = 5820 + Math.floor(Math.random() * 380);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-changlow-' + Date.now());

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

const TEAMS = [
  { id: 'team-alpha', name: 'Alpha Wing', role: 'Commander', members: 12, color: '#4648d4', avatar: 'A' },
  { id: 'team-beta', name: 'Beta Circle', role: 'Captain', members: 8, color: '#8127cf', avatar: 'B' }
];

// 层栈检查：三张卡（个人/团队/频道总览）的类名、lg 子层、边框/阴影/滤镜/矩形
const INSPECT = `(function(){
  function one(id){
    var el = document.getElementById(id); if (!el) return { id: id, missing: true };
    var cs = getComputedStyle(el);
    var kids = []; for (var i=0;i<el.children.length;i++) kids.push(el.children[i].className);
    var bd = el.querySelector('.lg-backdrop'), sp = el.querySelector('.lg-specular');
    var bdCs = bd ? getComputedStyle(bd) : null;
    var r = el.getBoundingClientRect();
    return {
      id: id, cls: el.className, kids: kids,
      bdFilter: bdCs ? bdCs.filter : null,
      bdBackdrop: bdCs ? bdCs.backdropFilter : null,
      bdInlineFilter: bd ? bd.style.filter : null,
      specularVisible: sp ? getComputedStyle(sp).display : null,
      border: cs.border, boxShadow: cs.boxShadow, bg: cs.background,
      overflow: cs.overflow, borderRadius: cs.borderRadius,
      transitionDuration: cs.transitionDuration, transitionProperty: cs.transitionProperty,
      rect: Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)
    };
  }
  return JSON.stringify({ theme: document.documentElement.getAttribute('data-theme'),
    personal: one('personalAccount'), team: one('teamAccount'), overview: one('channelOverview') });
})()`;

(async () => {
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
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--hide-scrollbars', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
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

  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html?seedme=1' });
  await sleep(400);

  const seedDark = async () => {
    await cdp.evalJs('localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify({ theme: 'dark' })) + ');' +
      'localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');' +
      'localStorage.setItem("slati_teams", ' + JSON.stringify(JSON.stringify(TEAMS)) + ');');
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
    await waitFor(cdp, "document.getElementById('channelOverview') && document.getElementById('channelOverview').children.length > 0", 15000, 'dark load');
    await sleep(900);
  };

  const shot = async (name) => {
    const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const f = path.join(__dirname, name);
    fs.writeFileSync(f, Buffer.from(s.data, 'base64'));
    console.log('   📸 ' + name + ' (' + fs.statSync(f).size + ' bytes)');
    return f;
  };

  console.log('════ G 场景：边缘亮光割裂实证 ════');
  await seedDark();
  const g1 = JSON.parse(await cdp.evalJs(INSPECT));
  for (const k of ['personal', 'team', 'overview']) {
    const c = g1[k];
    console.log('── ' + c.id + '  cls=' + JSON.stringify(c.cls) + '  rect=' + c.rect);
    console.log('   kids=' + JSON.stringify(c.kids));
    console.log('   bdFilter=' + c.bdFilter + '  bdBackdrop=' + c.bdBackdrop);
    console.log('   border=' + c.border + '  shadow=' + c.boxShadow);
    console.log('   overflow=' + c.overflow + '  transition=' + c.transitionProperty + ' / ' + c.transitionDuration);
  }
  fs.writeFileSync(path.join(__dirname, 'tmp-chan-glow-rects.json'), await cdp.evalJs(INSPECT));

  await shot('tmp-chan-glow-A.png'); // A 原样

  // C 对照：只关 SVG 色散滤镜（保留背层模糊）
  await cdp.evalJs(`(function(){
    ['personalAccount','teamAccount','channelOverview'].forEach(function(id){
      var bd = document.getElementById(id).querySelector('.lg-backdrop');
      if (bd) bd.style.filter = 'none';
    });
  })()`);
  await sleep(300);
  await shot('tmp-chan-glow-C.png'); // C 关滤镜

  // B 对照：摘掉全部 lg 层
  await cdp.evalJs(`(function(){
    ['personalAccount','teamAccount','channelOverview'].forEach(function(id){
      var el = document.getElementById(id);
      el.querySelectorAll('.lg-backdrop, .lg-specular').forEach(function(n){ n.remove(); });
    });
  })()`);
  await sleep(300);
  await shot('tmp-chan-glow-B.png'); // B 摘 lg 层

  // 亮色主题：文本层栈检查（零截图）
  await cdp.evalJs('localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify({ theme: 'light' })) + ');');
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
  await waitFor(cdp, "document.getElementById('channelOverview') && document.getElementById('channelOverview').children.length > 0", 15000, 'light load');
  await sleep(900);
  const gl = JSON.parse(await cdp.evalJs(INSPECT));
  console.log('── 亮色 personal: border=' + gl.personal.border + ' shadow=' + gl.personal.boxShadow +
    ' specular=' + gl.personal.specularVisible + ' bdFilter=' + gl.personal.bdFilter);

  console.log('════ A 场景：频道切换动画剖析 ════');
  await seedDark();
  // 页面内仪表：rAF 帧间隔 + 换手时刻 + 定点采样 4 卡 computed opacity + addEventListener 计数
  await cdp.evalJs(`(function(){
    window.__probe = { frames: [], last: 0, swaps: [], samples: [], listenAdd: 0, moveCost: [] };
    function raf(t){
      var d = t - window.__probe.last;
      if (d > 0) window.__probe.frames.push(Math.round(d * 10) / 10);
      window.__probe.last = t;
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(function(t){ window.__probe.last = t; requestAnimationFrame(raf); });
    var mo = new MutationObserver(function(recs){
      recs.forEach(function(r){ if (r.type === 'childList' && r.addedNodes.length > 0) window.__probe.swaps.push(Math.round(performance.now())); });
    });
    ['channelOverview','quickStats','contentTabs','slideTrack'].forEach(function(id){
      var el = document.getElementById(id); if (el) mo.observe(el, { childList: true });
    });
    window.__armSamples = function(){
      [255, 300, 345, 420].forEach(function(t){
        setTimeout(function(){
          window.__probe.samples.push({ t: t,
            ov: +getComputedStyle(document.getElementById('channelOverview')).opacity,
            qs: +getComputedStyle(document.getElementById('quickStats')).opacity,
            ct: +getComputedStyle(document.getElementById('contentTabs')).opacity,
            st: +getComputedStyle(document.getElementById('slideTrack')).opacity,
            ov_tr: document.getElementById('channelOverview').style.transform });
        }, t);
      });
    };
    var origAdd = Element.prototype.addEventListener;
    Element.prototype.addEventListener = function(type, fn, opts){
      if (this.id === 'channelOverview' && type === 'mousemove') window.__probe.listenAdd++;
      return origAdd.call(this, type, fn, opts);
    };
  })()`);

  // 首切：个人 → team-alpha（带帧剖析）
  await cdp.evalJs(`(function(){
    window.__probe.frames = []; window.__probe.swaps = []; window.__probe.samples = [];
    window.__probe.t0 = performance.now();
    window.__armSamples();
    selectAccount('team-alpha');
    return 'ok';
  })()`);
  await sleep(1850);
  const a1 = JSON.parse(await cdp.evalJs(`(function(){
    var f = window.__probe.frames;
    var maxGap = 0, over32 = 0, over50 = 0;
    f.forEach(function(d){ if (d > maxGap) maxGap = d; if (d > 32) over32++; if (d > 50) over50++; });
    return JSON.stringify({ frames: f, swaps: window.__probe.swaps, samples: window.__probe.samples,
      maxGap: maxGap, over32: over32, over50: over50, listenAdd: window.__probe.listenAdd, t0: window.__probe.t0 });
  })()`));
  console.log('── 首切 personal→team-alpha：');
  console.log('   rAF 帧数=' + a1.frames.length + ' 最大间隔=' + a1.maxGap + 'ms  >32ms 帧=' + a1.over32 + '  >50ms 帧=' + a1.over50);
  console.log('   innerHTML 换手时刻(ms, 相对切发)=' + JSON.stringify(a1.swaps.map(function(t){ return Math.round(t - a1.t0); })) + ' （绝对 ' + JSON.stringify(a1.swaps) + '）');
  a1.samples.forEach(function(s){ console.log('   t=' + s.t + 'ms  ov=' + s.ov + ' qs=' + s.qs + ' ct=' + s.ct + ' st=' + s.st + '  ov_tr=' + s.ov_tr); });

  // 二切：team → personal，中途在 channelOverview 上派发 mousemove（tilt 覆写实证）
  await cdp.evalJs(`(function(){
    window.__probe.samples = [];
    selectAccount('personal');
    var ov = document.getElementById('channelOverview');
    setTimeout(function(){
      var r = ov.getBoundingClientRect();
      var t0 = performance.now();
      ov.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
      window.__probe.moveCost.push(Math.round((performance.now() - t0) * 10) / 10);
      window.__probe.ovTrMid = ov.style.transform;
    }, 150);
    return 'ok';
  })()`);
  await sleep(1000);
  const a2 = JSON.parse(await cdp.evalJs(`(function(){
    var ov = document.getElementById('channelOverview');
    return JSON.stringify({ ovTrMid: window.__probe.ovTrMid, ovTrNow: ov.style.transform,
      moveCost: window.__probe.moveCost, listenAdd: window.__probe.listenAdd,
      activeNow: SlatiDB.getActiveAccount() });
  })()`));
  console.log('── 二切 team→personal + 150ms 时 mousemove 覆写：');
  console.log('   150ms 覆写后 inline transform=' + a2.ovTrMid);
  console.log('   mousemove 单次派发耗时=' + JSON.stringify(a2.moveCost) + 'ms（监听器堆叠下） 监听器总数=' + a2.listenAdd);
  console.log('   activeAccount 现=' + a2.activeNow);

  // 三切：personal → team-beta（tilt 监听器堆叠 +1 验证）
  await cdp.evalJs('selectAccount("team-beta")');
  await sleep(1000);
  const a3 = await cdp.evalJs(`(function(){
    var ov = document.getElementById('channelOverview');
    var r = ov.getBoundingClientRect();
    var t0 = performance.now();
    ov.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
    return JSON.stringify({ listenAdd: window.__probe.listenAdd, cost: Math.round((performance.now() - t0) * 10) / 10 });
  })()`);
  console.log('── 三切后监听器总数=' + JSON.parse(a3).listenAdd + '（每次 renderContent 堆叠 +1） 单次 mousemove 耗时=' + JSON.parse(a3).cost + 'ms');

  console.log('══ console errors: ' + cdp.errs.length + ' ══');
  cdp.errs.forEach(e => console.log('   ' + e));
  cdp.close();
  try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(0);
})().catch(e => { console.error('💥 ' + e.message); process.exit(1); });
