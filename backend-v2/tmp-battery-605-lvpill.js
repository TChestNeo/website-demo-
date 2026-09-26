// tmp-battery-605-lvpill.js — v0.2.58.4 折叠侧栏等级水位环波纹改正弦水面电池（58.3 水位环电池同文件
//   口径随轮改：58.3 的圆点花边 radial-gradient 波纹改成参考 CodePen wave.png 的正弦水面——mask SVG 正弦
//   路径（12×8 一个波长、水面线下实填）+背景色 var(--mn-lv-wave-c) 着色（主色/浅色随主题自适应）；
//   translateX 平移一个波长 12px 无缝循环。用户「那个水波能不能参考这个」（贴 wave.png 水杯代码）
//   「我要你参考他的波纹不是动画」——只换波纹形状：两层结构/两速 1.6s/2.2s 相位漂移/水位从底往上灌/
//   0.5s 过渡全保持，动画节奏零改动。
//   折叠态等级徽章=纵向药丸 28×48（LV 小字在上）+ 正圆水杯 24×24 只围号码；经验进度=水位从杯底往上灌
//   （.mn-lv-fill 内联 height 百分比）；水动效两层——底层主色 .mn-lv-wdeep + 上层浅色 .mn-lv-wlight
//   （主色兑白 55%+半透明叠层次），两层各带正弦水面波形（1.6s/2.2s 纯 CSS 零 JS）；
//   号码 z 上浮+白色描边晕影水位高时仍可读。展开态 .mn-lv-normal 原徽章原样零变化。
// F 静态：site-config 58.4+changelog+rev 00307-、sidebar.js 新结构、ethereal.css 药丸规则+内联块同步；
// S 浏览器：展开零变化/折叠切换/药丸几何零挤压/水位进度刷新/满级/窄列 floating/展开恢复；E 零异常。
// /api 全 404（demo 模式，同 xp-rebalance 口径）；会话+XP 本地种子。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-lvpill-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url);
  const p = url.split('?')[0];
  if (p.indexOf('/api/') === 0) {
    const b = JSON.stringify({ error: { code: 'NOT_FOUND', message: 'offline' } });
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) });
    res.end(b);
    return;
  }
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
        const d = m.exceptionDetails || {};
        this.errs.push('EXC ' + JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
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
  let lastErr = '';
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; }
    catch (e) { lastErr = String(e.message || e).slice(0, 160); }
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label + (lastErr ? '（最后 eval 错误: ' + lastErr + '）' : ''));
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

(async () => {
  // ═══ F 静态检查 ═══
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const sidebarSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'sidebar.js'), 'utf8');
  const etherealSrc = fs.readFileSync(path.join(DOCS, 'assets', 'css', 'ethereal.css'), 'utf8');
  const indexSrc = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  const editorSrc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');

  ok('F1 静态：58.4 赋值 + FC 恒 47.4 + changelog 用户原话两段 + rev 00307- + 58.3 赋值零残留 + 58.3/58.2/58.1 历史条目标题保留',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.4';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sconfSrc.indexOf('参考这个') !== -1 &&
    sconfSrc.indexOf('波纹不是动画') !== -1 &&
    sconfSrc.indexOf('rev 00307-') !== -1 &&
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.3';") === -1 &&
    sconfSrc.indexOf('v0.2.58.3 = 折叠侧栏等级水位环+双层水波') !== -1 &&
    sconfSrc.indexOf('v0.2.58.2 = 折叠侧栏等级纵向药丸+经验环') !== -1 &&
    sconfSrc.indexOf('v0.2.58.1 = 左侧菜单底部不透明背景完全删除') !== -1);

  ok('F2 静态：sidebar.js 新结构（normal 原徽章字节原样 + 药丸/水杯/水位/双层水波件套 + fillPct + conic/ringPct/pill-core 零残留）',
    cnt(sidebarSrc, 'class="mn-lv-normal"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-pill"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-ring"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-cup"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-fill"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-wdeep"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-wlight"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-wdeepwave"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-wlightwave"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-pill-tag"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-pill-num"') === 1 &&
    sidebarSrc.indexOf("style=\"height:' + fillPct + '%\"") !== -1 &&
    sidebarSrc.indexOf('var fillPct = Math.round(st.progress * 100);') !== -1 &&
    sidebarSrc.indexOf('conic-gradient') === -1 &&
    sidebarSrc.indexOf('ringPct') === -1 &&
    sidebarSrc.indexOf('mn-lv-pill-core') === -1 &&
    sidebarSrc.indexOf('display:flex;align-items:center;justify-content:space-between;margin-bottom:4px') !== -1 &&
    sidebarSrc.indexOf('height:5px;border-radius:999px;background:rgba(128,128,140,0.25)') !== -1);

  ok('F3 静态：ethereal.css 药丸规则在位（默认隐藏/折叠三规则+keyframes pill-in + 药丸 28×48 + 水杯 24×24 圆 + 浅色 color-mix + 正弦水面 mask 件套 12×8/平移 12px/两速动画）+ 旧花边/7px 7px/conic/pill-core 零残留 + index/editor 内联块同款同步',
    etherealSrc.indexOf('.mn-lv-badge .mn-lv-pill { display: none; }') !== -1 &&
    etherealSrc.indexOf('.app-sidebar.collapsed .mn-lv-badge { margin-top: 0 !important; }') !== -1 &&
    etherealSrc.indexOf('.app-sidebar.collapsed .mn-lv-badge .mn-lv-normal { display: none; }') !== -1 &&
    etherealSrc.indexOf('animation: mn-lv-pill-in 0.3s ease;') !== -1 &&
    etherealSrc.indexOf('@keyframes mn-lv-pill-in') !== -1 &&
    etherealSrc.indexOf('width: 28px; height: 48px; border-radius: 999px;') !== -1 &&
    etherealSrc.indexOf('width: 24px; height: 24px; border-radius: 50%;') !== -1 &&
    etherealSrc.indexOf('--mn-lv-light: color-mix(in srgb, var(--color-primary) 55%, #ffffff);') !== -1 &&
    cnt(etherealSrc, 'mask-image: url("data:image/svg+xml') === 2 &&
    cnt(etherealSrc, "viewBox='0 0 12 8'") === 2 &&
    cnt(etherealSrc, 'mask-size: 12px 8px') === 2 &&
    etherealSrc.indexOf('background-color: var(--mn-lv-wave-c);') !== -1 &&
    etherealSrc.indexOf('translateX(-12px)') !== -1 &&
    etherealSrc.indexOf('animation: mn-lv-wave 1.6s linear infinite;') !== -1 &&
    etherealSrc.indexOf('animation: mn-lv-wave 2.2s linear infinite;') !== -1 &&
    etherealSrc.indexOf('@keyframes mn-lv-wave') !== -1 &&
    etherealSrc.indexOf('background: radial-gradient(circle at 50% 0, transparent 3.5px, var(--mn-lv-wave-c) 3.5px) repeat-x;') === -1 &&
    etherealSrc.indexOf('background-size: 7px 7px') === -1 &&
    etherealSrc.indexOf('conic-gradient') === -1 &&
    etherealSrc.indexOf('mn-lv-pill-core') === -1 &&
    cnt(indexSrc, '.mn-lv-badge .mn-lv-pill { display: none; }') === 1 &&
    cnt(indexSrc, 'mn-lv-pill-in') === 2 &&
    cnt(indexSrc, '.mn-lv-wdeepwave {') === 1 &&
    cnt(indexSrc, 'mask-size: 12px 8px') === 2 &&
    cnt(indexSrc, '@keyframes mn-lv-wave') === 1 &&
    cnt(indexSrc, 'animation: mn-lv-wave ') === 2 &&
    cnt(editorSrc, 'mn-lv-pill-in') === 2 &&
    cnt(editorSrc, '.mn-lv-wdeepwave {') === 1 &&
    cnt(editorSrc, 'mask-size: 12px 8px') === 2 &&
    cnt(editorSrc, '@keyframes mn-lv-wave') === 1 &&
    cnt(editorSrc, 'animation: mn-lv-wave ') === 2,
    'index-pill=' + cnt(indexSrc, 'mn-lv-pill-in') + ' editor-pill=' + cnt(editorSrc, 'mn-lv-pill-in'));

  // ═══ 浏览器场景 ═══
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
    '--disable-extensions', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    ok('P0 Chrome CDP 就绪', up, 'port=' + CDP_PORT);
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page') || pages[0];
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('Page.bringToFront');

    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const setLS = async (pairs) => {
      await nav(BASE + '/index.html', "document.readyState === 'complete'", 'LS setup');
      const body = pairs.map(p => p.remove
        ? "localStorage.removeItem('" + p.k + "')"
        : "localStorage.setItem('" + p.k + "', " + JSON.stringify(p.v) + ")").join(';');
      const r = await cdp.evalJs("(function(){ try { " + body + "; return 'ok'; } catch(e){ return 'ERR ' + e.message; } })()");
      if (r !== 'ok') throw new Error('setLS 失败: ' + r);
    };
    const pillNow = () => cdp.evalJs("(function(){ var b = document.querySelector('#slati-sidebar .mn-lv-badge'); " +
      "if (!b) return JSON.stringify({ absent: true }); " +
      "var n = b.querySelector('.mn-lv-normal'); var p = b.querySelector('.mn-lv-pill'); " +
      "var fill = b.querySelector('.mn-lv-fill'); var num = b.querySelector('.mn-lv-pill-num'); " +
      "var tag = b.querySelector('.mn-lv-pill-tag'); " +
      "var dw = b.querySelector('.mn-lv-wdeepwave'); var lw = b.querySelector('.mn-lv-wlightwave'); " +
      "var wl = b.querySelector('.mn-lv-wlight'); var wd = b.querySelector('.mn-lv-wdeep'); " +
      "var tagR = tag ? tag.getBoundingClientRect() : null; var ring = b.querySelector('.mn-lv-ring'); " +
      "var ringR = ring ? ring.getBoundingClientRect() : null; " +
      "return JSON.stringify({ txt: b.textContent, nDisplay: n ? getComputedStyle(n).display : null, " +
      "pDisplay: p ? getComputedStyle(p).display : null, fillStyle: fill ? fill.getAttribute('style') : null, " +
      "num: num ? num.textContent : null, tag: tag ? tag.textContent : null, " +
      "waveKids: fill ? fill.children.length : -1, " +
      "dwAnim: dw ? getComputedStyle(dw).animationName + '/' + getComputedStyle(dw).animationDuration : null, " +
      "lwAnim: lw ? getComputedStyle(lw).animationName + '/' + getComputedStyle(lw).animationDuration : null, " +
      "dwMask: dw ? getComputedStyle(dw).maskSize : null, " +
      "dwRepeat: dw ? getComputedStyle(dw).maskRepeat : null, " +
      "dwMaskImg: dw ? (getComputedStyle(dw).maskImage || '') : null, " +
      "dwH: dw ? Math.round(dw.getBoundingClientRect().height) : -1, " +
      "dwEdgeBg: dw ? getComputedStyle(dw).backgroundColor : null, " +
      "lwEdgeBg: lw ? getComputedStyle(lw).backgroundColor : null, " +
      "lightOpacity: wl ? getComputedStyle(wl).opacity : null, " +
      "lightBg: wl ? getComputedStyle(wl).backgroundColor : null, " +
      "deepBg: wd ? getComputedStyle(wd).backgroundColor : null, " +
      "tagAbove: (tagR && ringR) ? tagR.bottom <= ringR.top + 0.5 : null, " +
      "barKids: n ? n.children.length : -1, xp: JSON.parse(localStorage.getItem('slati_xp') || '0') }); })()");
    const geoNow = () => cdp.evalJs("(function(){ var pill = document.querySelector('#slati-sidebar .mn-lv-pill'); " +
      "var ring = document.querySelector('#slati-sidebar .mn-lv-ring'); " +
      "var av = document.querySelector('#slati-sidebar .user-info-bar .avatar'); " +
      "var mod = document.querySelector('#slati-sidebar .user-module'); var bd = document.querySelector('#slati-sidebar .mn-lv-badge'); " +
      "if (!pill || !ring || !av || !mod || !bd) return JSON.stringify({ absent: true }); " +
      "var p = pill.getBoundingClientRect(), r = ring.getBoundingClientRect(), a = av.getBoundingClientRect(), m = mod.getBoundingClientRect(); " +
      "var overlap = !(p.right <= a.left || p.left >= a.right || p.bottom <= a.top || p.top >= a.bottom); " +
      "return JSON.stringify({ pw: Math.round(p.width), ph: Math.round(p.height), rw: Math.round(r.width), rh: Math.round(r.height), " +
      "aw: Math.round(a.width), ah: Math.round(a.height), gap: Math.round((p.top - a.bottom) * 10) / 10, " +
      "inMod: p.left >= m.left && p.right <= m.right, overlap: overlap, " +
      "ringRadius: getComputedStyle(ring).borderRadius, badgeMarginTop: getComputedStyle(bd).marginTop }); })()");

    // ── 种子：先让页面写下每日登录日期键（+5），再固定 XP=100 ──
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt-605', displayName: 'Pill Tester', citizenId: 'CIT-605', tier: 'free' }) },
      { k: 'slati_xp', v: '0' },
      { k: 'slati_xp_gained', remove: true },
      { k: 'slati_xp_last_login', remove: true },
      { k: 'slati_sidebar_collapsed', remove: true },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(种子)');
    await cdp.evalJs("localStorage.setItem('slati_xp', '100')");
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S1)');
    let r = await pillNow();
    const s1 = JSON.parse(r);
    ok('S1 展开态零变化：原徽章可见（Lv.1·旅行者 100/1200 + 8% 条）+ 药丸默认隐藏 + 头像 40×40',
      s1.txt.indexOf('Lv.1 · 旅行者') !== -1 && s1.txt.indexOf('100 / 1200 XP') !== -1 &&
      s1.nDisplay !== 'none' && s1.pDisplay === 'none' && s1.barKids === 2 && s1.xp === 100, r);
    let g = await geoNow();
    const g1 = JSON.parse(g);
    ok('S1b 展开态头像 40×40（折叠前基准）', g1.aw === 40 && g1.ah === 40 && g1.badgeMarginTop === '8px', g);

    // ── S2 折叠切换 ──
    await cdp.evalJs("window._slatiToggleSidebar()");
    await sleep(500);
    r = await pillNow();
    const s2 = JSON.parse(r);
    ok('S2 折叠切换：normal 隐藏 + 药丸 flex + 水位 8% + 中间 LV/1 + 双层正弦水面（mask 12px 8px repeat-x + 波形 8px 高 + 两速 1.6s/2.2s）+ 波形色与水面层同色（深=主色/浅=浅色且两色不同）+ 浅层半透明 0.65 + LV 在杯上方',
      s2.nDisplay === 'none' && s2.pDisplay === 'flex' &&
      s2.fillStyle === 'height:8%' &&
      s2.num === '1' && s2.tag === 'LV' && s2.waveKids === 4 &&
      s2.dwAnim === 'mn-lv-wave/1.6s' && s2.lwAnim === 'mn-lv-wave/2.2s' &&
      s2.dwMask === '12px 8px' && s2.dwRepeat === 'repeat-x' &&
      s2.dwMaskImg && s2.dwMaskImg !== 'none' &&
      s2.dwH === 8 &&
      s2.dwEdgeBg !== null && s2.dwEdgeBg === s2.deepBg && s2.lwEdgeBg === s2.lightBg && s2.dwEdgeBg !== s2.lwEdgeBg &&
      s2.lightOpacity === '0.65' && s2.lightBg !== null && s2.lightBg !== s2.deepBg &&
      s2.tagAbove === true, r);
    const clsOk = await cdp.evalJs("document.querySelector('#slati-sidebar').classList.contains('collapsed')");
    ok('S2b .app-sidebar.collapsed 类在位', clsOk === true);

    // ── S3 药丸几何零挤压 ──
    g = await geoNow();
    const g2 = JSON.parse(g);
    ok('S3 药丸几何：药丸 28×48 + 水杯 24×24 正圆 + 头像 32×32 不挤压 + 上下间距 8px（margin-top 0 生效）+ 模块内零溢出 + 零重叠',
      g2.pw === 28 && g2.ph === 48 && g2.rw === 24 && g2.rh === 24 && g2.ringRadius === '50%' &&
      g2.aw === 32 && g2.ah === 32 &&
      g2.gap >= 7 && g2.gap <= 9 && g2.inMod === true && g2.overlap === false && g2.badgeMarginTop === '0px', g);

    // ── S4 水位进度刷新（折叠态保持）──
    await cdp.evalJs("window.SlatiDB.addXP('batt', 600)");
    await sleep(400);
    r = await pillNow();
    const s4 = JSON.parse(r);
    ok('S4 addXP +600（100→700=58%）：徽章重渲染水位 58% + 折叠态与等级保持（collapsed 不丢）',
      s4.fillStyle === 'height:58%' && s4.num === '1' && s4.xp === 700 &&
      await cdp.evalJs("document.querySelector('#slati-sidebar').classList.contains('collapsed')") === true, r);

    // ── S5 满级 ──
    await cdp.evalJs("localStorage.setItem('slati_xp', '1228800')");
    await cdp.send('Page.reload');
    await waitFor(cdp, "!!document.querySelector('#slati-sidebar .mn-lv-badge')", 20000, '满级重载');
    await sleep(700);
    r = await pillNow();
    const s5 = JSON.parse(r);
    ok('S5 满级 Lv12·传奇：展开视图无条（kids=1）+ 水位 100% + 中间 12 + 折叠偏好重载保持（collapsed 在位）',
      s5.txt.indexOf('Lv.12 · 传奇') !== -1 && s5.txt.indexOf('1228800 XP') !== -1 && s5.txt.indexOf(' / ') === -1 &&
      s5.barKids === 1 && s5.fillStyle === 'height:100%' && s5.num === '12' &&
      await cdp.evalJs("document.querySelector('#slati-sidebar').classList.contains('collapsed')") === true, r);

    // ── S6 窄列 floating（64px 列）药丸仍收得下 ──
    await cdp.evalJs("document.querySelector('#slati-sidebar').classList.add('floating')");
    await sleep(400);
    g = await geoNow();
    const g3 = JSON.parse(g);
    ok('S6 floating 折叠 64px 列：药丸 28×48 仍在模块内零溢出 + 与头像零重叠',
      g3.pw === 28 && g3.ph === 48 && g3.inMod === true && g3.overlap === false, g);

    // ── S7 展开恢复 ──
    await cdp.evalJs("document.querySelector('#slati-sidebar').classList.remove('floating'); window._slatiToggleSidebar()");
    await sleep(500);
    r = await pillNow();
    const s7 = JSON.parse(r);
    ok('S7 展开恢复：normal 复显 + 药丸回隐藏 + margin-top 回 8px',
      s7.nDisplay !== 'none' && s7.pDisplay === 'none' && s7.txt.indexOf('Lv.12 · 传奇') !== -1 &&
      await cdp.evalJs("getComputedStyle(document.querySelector('#slati-sidebar .mn-lv-badge')).marginTop") === '8px', r);

    ok('E1 全程零 Runtime exception + 零 console error',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      (cdp.errs.slice(0, 3).join(' | ') + cdp.consoleErrs.slice(0, 3).join(' | ')).slice(0, 300));
    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }

  console.log('\nlvpill 电池：' + PASS + ' ✅ / ' + FAIL + ' ❌');
  process.exit(FAIL ? 1 : 0);
})().catch((e) => { console.error('电池崩溃：' + (e && e.stack || e)); process.exit(1); });
