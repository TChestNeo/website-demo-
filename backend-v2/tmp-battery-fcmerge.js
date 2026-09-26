// tmp-battery-fcmerge.js — v0.2.45.2 / FC v10.28.34.2 FC 三页合一 Douyin 式 URL 视图切换电池
// （v0.2.45.1 追加：F0-6 + N 场景——暗色菜单卡白顶线修复）
// 用户「把 FuildCanva 首页除了编辑页面以外的页面切换方式改成这个链接的结构」（参考抖音用户页结构：一条路径+查询参数
// 决定显示哪个 tab）；范围钦定「全部并进一个页面，但除了 editor 的页面是独立的那个」。
// 验证：A 裸载入 dashboard / B 直载 analytics 子态 / C 点 pill pushState / D history.back 恢复不增条目
//       E articles 委托勾选+删除+批量发布 toast / F 旧 #hash replaceState 规范化 / G 旧页 stub 重定向
//       H content tab=media / I 侧栏点击 URL+1 条目 / J reload 保留视图周期 / K guest 门禁锁屏（新 spawn）
//       L 全程零 Runtime exception + 零 console error（资源 404 豁免）/ M 390×844 五视图无横向滚动
//       N v0.2.45.1 暗蓝/暗 mono 菜单卡阴影无 inset 白线+hover 内联压得住+亮色零触碰
//       F0 静态：双版本串+合并标记+旧 href/onclick 消失+stub 目标+编辑器未动。
// 可见性判据：dashboardView 从不带 .active（默认显示，切换走内联 display:none）；
//             其余四视图 .active{display:block} → 统一用 computed display !== 'none'。
// （house CDP 模式；截图全黑纪律，无截图依赖；confirm 对话框自动接受防挂起）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcmerge-batt-' + Date.now());
const USER_DATA_GUEST = path.join(os.tmpdir(), 'mn-cdp-fcmerge-guest-' + Date.now()); // K 场景全新 profile：同 profile localStorage 跨 target 共享会漏种子
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
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        // 静态壳 /api 404 会以 Failed to load resource 进 console——豁免；其余 console error 记作真错误
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); // deleteArticle/bulkDelete 的 confirm() 自动接受，否则 headless 挂起
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
// 五视图统一可见性判据：computed display !== 'none'（dashboard 无 .active 类，靠默认显示）
const vis = (id) => "getComputedStyle(document.getElementById('" + id + "')).display !== 'none'";

(async () => {
  // ═══ F0 静态检查 ═══
  const main = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas.html'), 'utf8');
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const stubAna = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-analytics.html'), 'utf8');
  const stubArt = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-articles.html'), 'utf8');
  const editor = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F0-1 版本双线 v0.2.45.2 / v10.28.34.2 + 三页合一注释块',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    sconf.indexOf('三页合一') !== -1);
  ok('F0-2 合并标记在场（两视图 DOM + 双 IIFE + initURLSync）',
    main.indexOf('id="analyticsView"') !== -1 && main.indexOf('id="articlesView"') !== -1 &&
    main.indexOf('window.FC_ANALYTICS') !== -1 && main.indexOf('window.FC_ARTICLES') !== -1 &&
    main.indexOf('initURLSync();') !== -1);
  ok('F0-3 旧页 href / 旧 hash href / 内联 onclick 全消失',
    main.indexOf('href="fluidcanvas-analytics.html') === -1 && main.indexOf('href="fluidcanvas-articles.html') === -1 &&
    main.indexOf('href="fluidcanvas.html#') === -1 &&
    main.indexOf('onclick="toggleSelect') === -1 && main.indexOf('onclick="deleteArticle') === -1);
  ok('F0-4 两 stub 各含 ?view= 目标 + location.replace',
    stubAna.indexOf('fluidcanvas.html?view=analytics') !== -1 && stubAna.indexOf("location.replace('fluidcanvas.html?view=analytics')") !== -1 &&
    stubArt.indexOf('fluidcanvas.html?view=articles') !== -1 && stubArt.indexOf("location.replace('fluidcanvas.html?view=articles')") !== -1);
  ok('F0-5 编辑器页独立未动（不含合并标记）',
    editor.length > 500000 && editor.indexOf('initURLSync') === -1 && editor.indexOf('analyticsView') === -1);
  ok('F0-6 v0.2.45.1 暗色菜单卡灭顶线规则在场（.tilt-container:not(.card) + 无白阴影 !important）',
    main.indexOf(':root[data-theme="dark"] .tilt-container:not(.card)') !== -1 &&
    main.indexOf('0 20px 50px -12px rgba(0, 0, 0, 0.12), 0 4px 16px -4px rgba(0, 0, 0, 0.06) !important') !== -1);

  // ═══ 浏览器场景（登录态 Chrome #1）═══
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }

  const spawnChrome = (port, profile) => spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile, 'about:blank'
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

  let chrome = spawnChrome(CDP_PORT, USER_DATA);
  try {
    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };

    // ── A 裸载入 → dashboard 视图（默认可见）、URL 无参 ──
    await nav(BASE + '/pages/fluidcanvas.html', vis('dashboardView'), 'A 首页');
    ok('A1 裸载入 dashboard 可见', await cdp.evalJs(vis('dashboardView')) === true);
    ok('A2 analytics 视图隐藏', await cdp.evalJs("getComputedStyle(document.getElementById('analyticsView')).display") === 'none');
    ok('A3 location.search 为空', await cdp.evalJs('location.search') === '');

    // ── B 直载 ?view=analytics&tab=media&period=month ──
    await nav(BASE + '/pages/fluidcanvas.html?view=analytics&tab=media&period=month', vis('analyticsView'), 'B analytics');
    ok('B1 视图可见', await cdp.evalJs(vis('analyticsView')) === true);
    ok('B2 dashboard 隐藏', await cdp.evalJs("getComputedStyle(document.getElementById('dashboardView')).display") === 'none');
    ok('B3 period pill month active', await cdp.evalJs("document.querySelector('#periodTabs .subnav-pill[data-period=\"month\"]').classList.contains('active')") === true);
    ok('B4 detail pill media active', await cdp.evalJs("document.querySelector('#detailTabs .subnav-pill[data-tab=\"media\"]').classList.contains('active')") === true);
    ok('B5 4 张 metric-card', await cdp.evalJs("document.querySelectorAll('#overviewCards .metric-card').length") === 4);
    ok('B6 URL 原样保留', await cdp.evalJs('location.search') === '?view=analytics&tab=media&period=month');

    // ── C 点 detail pill articles → pushState ──
    const hLenB = await cdp.evalJs('history.length');
    await cdp.evalJs("document.querySelector('#detailTabs .subnav-pill[data-tab=\"articles\"]').click()");
    await sleep(500);
    ok('C1 URL 含 tab=articles', (await cdp.evalJs('location.search')).indexOf('tab=articles') !== -1);
    ok('C2 detail pill articles active', await cdp.evalJs("document.querySelector('#detailTabs .subnav-pill[data-tab=\"articles\"]').classList.contains('active')") === true);
    ok('C3 history.length +1', (await cdp.evalJs('history.length')) === hLenB + 1, 'hLen=' + hLenB);

    // ── D history.back() → 恢复 media+month、无新条目 ──
    const hLenC = await cdp.evalJs('history.length');
    await cdp.evalJs('history.back()');
    await waitFor(cdp, "document.querySelector('#detailTabs .subnav-pill[data-tab=\"media\"]').classList.contains('active')", 8000, 'D back');
    await sleep(400);
    ok('D1 URL 恢复 media+month', await cdp.evalJs('location.search') === '?view=analytics&tab=media&period=month');
    ok('D2 period month 恢复', await cdp.evalJs("document.querySelector('#periodTabs .subnav-pill[data-period=\"month\"]').classList.contains('active')") === true);
    ok('D3 history.length 不增（无新条目）', (await cdp.evalJs('history.length')) === hLenC, 'hLen=' + hLenC);

    // ── E articles：15 行 → 勾选（委托）→ 删除（confirm 自动接受）→ 批量发布 toast ──
    await nav(BASE + '/pages/fluidcanvas.html?view=articles', "document.querySelectorAll('#artList .art-row').length === 15", 'E articles');
    ok('E1 15 行渲染', await cdp.evalJs("document.querySelectorAll('#artList .art-row').length") === 15);
    await cdp.evalJs("document.querySelector('#artList .art-row .art-checkbox').click()");
    await sleep(300);
    ok('E2 勾选首行（事件委托实证，行 selected + bulkBar）',
      (await cdp.evalJs("document.querySelector('#artList .art-row').classList.contains('selected')")) === true &&
      (await cdp.evalJs("getComputedStyle(document.getElementById('bulkBar')).display") === 'flex') &&
      (await cdp.evalJs("document.getElementById('bulkCount').textContent") === '1 selected'));
    await cdp.evalJs("document.querySelector('#artList .art-row .art-action-btn.danger').click()");
    await waitFor(cdp, "document.querySelectorAll('#artList .art-row').length === 14", 8000, 'E 删除');
    ok('E3 删除后 14 行（confirm 自动接受）', await cdp.evalJs("document.querySelectorAll('#artList .art-row').length") === 14);
    await cdp.evalJs("document.querySelectorAll('#artList .art-row .art-checkbox')[0].click(); document.querySelectorAll('#artList .art-row .art-checkbox')[1].click()");
    await sleep(300);
    await cdp.evalJs("document.getElementById('bulkPublish').click()");
    await sleep(400);
    ok('E4 批量发布 toast 含 Published', (await cdp.evalJs("document.getElementById('toast').textContent")).indexOf('Published') !== -1,
      await cdp.evalJs("document.getElementById('toast').textContent"));

    // ── F 旧 #hash → replaceState 规范化 ──
    await nav(BASE + '/pages/fluidcanvas.html#upload', vis('uploadView'), 'F hash');
    ok('F1 upload 视图可见', await cdp.evalJs(vis('uploadView')) === true);
    ok('F2 hash 清空 + search=?view=upload', await cdp.evalJs('location.hash') === '' && await cdp.evalJs('location.search') === '?view=upload');

    // ── G 旧页 stub 重定向 ──
    await nav(BASE + '/pages/fluidcanvas-analytics.html', vis('analyticsView'), 'G stub');
    ok('G1 终态 pathname=fluidcanvas.html', (await cdp.evalJs('location.pathname')).indexOf('fluidcanvas.html') !== -1);
    ok('G2 终态 search=?view=analytics', await cdp.evalJs('location.search') === '?view=analytics');
    ok('G3 periodTabs 在场', await cdp.evalJs("document.getElementById('periodTabs') !== null") === true);

    // ── H content tab=media ──
    await nav(BASE + '/pages/fluidcanvas.html?view=content&tab=media', vis('contentView'), 'H content');
    ok('H1 media pill active', await cdp.evalJs("document.querySelector('#contentTabs .subnav-pill[data-tab=\"media\"]').classList.contains('active')") === true);
    ok('H2 滑轨 transform -100%', await cdp.evalJs("document.getElementById('slideTrack').style.transform") === 'translateX(-100%)');

    // ── I 侧栏点 Upload → URL + 1 条目 ──
    const hLenI = await cdp.evalJs('history.length');
    await cdp.evalJs("document.querySelector('.nav-item[data-view=\"upload\"]').click()");
    await waitFor(cdp, vis('uploadView'), 8000, 'I nav upload');
    await sleep(400);
    ok('I1 视图切换 + URL', await cdp.evalJs(vis('uploadView')) === true && await cdp.evalJs('location.search') === '?view=upload');
    ok('I2 history.length +1', (await cdp.evalJs('history.length')) === hLenI + 1, 'hLen=' + hLenI);

    // ── J reload 保留视图周期 ──
    await nav(BASE + '/pages/fluidcanvas.html?view=analytics&tab=media&period=7d', vis('analyticsView'), 'J analytics 7d');
    await cdp.send('Page.reload', { ignoreCache: true });
    await waitFor(cdp, vis('analyticsView'), 15000, 'J reload');
    await sleep(700);
    ok('J1 reload 后同视图', await cdp.evalJs(vis('analyticsView')) === true);
    ok('J2 reload 后 period 7d 恢复', await cdp.evalJs("document.querySelector('#periodTabs .subnav-pill[data-period=\"7d\"]').classList.contains('active')") === true);
    ok('J3 reload 后 detail media 恢复', await cdp.evalJs("document.querySelector('#detailTabs .subnav-pill[data-tab=\"media\"]').classList.contains('active')") === true);

    // ── M 390×844 五视图无横向滚动 ──
    // 口径（探针实证）：390px 下既有页面本身横向溢出（原版 HEAD 同值同元素：dashboard 容器内 teamGroup
    // 顶到 655、upload 441、content 470）——FC 首页桌面优先，390 全适配是另一轮的事。本轮真门：
    // 合并视图不得比既有最坏（dashboard 655）更宽；页面级不差于 dashboard 基线。
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const views = [['dashboard', ''], ['upload', '?view=upload'], ['content', '?view=content&tab=articles'], ['analytics', '?view=analytics'], ['articles', '?view=articles']];
    let mBaseline = null, mWorst = null;
    // 只算「未裁剪」溢出：祖先 overflow-x auto/scroll/hidden 且祖先盒在视口内 = 被内部滚动/裁剪区吃掉的溢出
    // （dashboard 既有 .content-row 表格行 905、#artList overflow:hidden 同模式——不推页面、不计）
    const overflowScan = (v) => "(function(){ var maxRight = 0; var worst = '';" +
      " function clipped(el) { var p = el.parentElement;" +
      "  while (p) { var cs = getComputedStyle(p);" +
      "   if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') && p.getBoundingClientRect().right <= 392) return true;" +
      "   p = p.parentElement; } return false; }" +
      " var scope = document.getElementById('" + v + "View');" +
      " if (!scope) return { err: 'NOVIEW' }; var r = scope.getBoundingClientRect();" +
      " if (r.right > 392 && !clipped(scope)) { maxRight = r.right; worst = 'SELF'; }" +
      " var all = scope.querySelectorAll('*');" +
      " for (var i = 0; i < all.length; i++) { var el = all[i]; var b = el.getBoundingClientRect();" +
      "  if (b.width === 0 && b.height === 0) continue;" +
      "  var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;" +
      "  if (b.right > maxRight && b.right > 392 && !clipped(el)) { maxRight = b.right; worst = (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : '')); } }" +
      " return { maxRight: Math.round(maxRight), worst: worst }; })()";
    for (const [v, q] of views) {
      await nav(BASE + '/pages/fluidcanvas.html' + q, vis(v + 'View'), 'M ' + v);
      const sw = await cdp.evalJs('document.documentElement.scrollWidth');
      const scan = await cdp.evalJs(overflowScan(v));
      if (v === 'dashboard') { mBaseline = sw; mWorst = scan.maxRight; }
      ok('M ' + v + ' 页面级不差于基线', sw <= mBaseline + 4, 'sw=' + sw + ' baseline=' + mBaseline);
      ok('M ' + v + ' 未裁剪溢出不宽于既有最坏', scan.maxRight <= mWorst + 5, 'max=' + scan.maxRight + ' (' + scan.worst + ') 既有最坏=' + mWorst);
    }

    // ── N v0.2.45.1 暗色菜单卡白顶线修复（用户「FC 首页左侧菜单上方有一个白白的东西？深色模式下才看得见」）──
    // 真身=菜单卡 inline box-shadow inset 0 1px 0 rgba(255,255,255,0.8) 白高光线（hover 内联加亮到 0.9），
    // 亮色卡上隐形、暗色卡上独亮。修法=暗色 !important 覆写（外侧深投影保留），亮色零触碰。
    await cdp.send('Emulation.clearDeviceMetricsOverride'); // 退出 M 场景的 390×844
    const menuShadow = "(function(){ var c = document.querySelector('.tilt-container'); var s = getComputedStyle(c).boxShadow; return JSON.stringify({ shadow: s, hasInset: s.indexOf('inset') !== -1, hasWhite: s.indexOf('255, 255, 255') !== -1 }); })()";
    await cdp.evalJs('localStorage.setItem("slati_settings", JSON.stringify({ theme: "dark" }))');
    await cdp.send('Page.reload', { ignoreCache: true });
    await waitFor(cdp, "document.querySelector('.tilt-container')", 15000, 'N dark');
    await sleep(700);
    let sh = JSON.parse(await cdp.evalJs(menuShadow));
    ok('N1 暗蓝菜单卡阴影无 inset、无白', !sh.hasInset && !sh.hasWhite, sh.shadow.slice(0, 90));
    await cdp.evalJs("document.querySelector('.tilt-container').dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))");
    await sleep(250);
    sh = JSON.parse(await cdp.evalJs(menuShadow));
    ok('N2 hover 内联加亮被 !important 压住（仍无白）', !sh.hasInset && !sh.hasWhite, sh.shadow.slice(0, 90));
    await cdp.evalJs('localStorage.setItem("slati_settings", JSON.stringify({ theme: "dark", accent: "mono" }))');
    await cdp.send('Page.reload', { ignoreCache: true });
    await waitFor(cdp, "document.querySelector('.tilt-container')", 15000, 'N mono');
    await sleep(700);
    sh = JSON.parse(await cdp.evalJs(menuShadow));
    ok('N3 暗 mono 菜单卡阴影无 inset、无白', !sh.hasInset && !sh.hasWhite, sh.shadow.slice(0, 90));
    await cdp.evalJs('localStorage.setItem("slati_settings", JSON.stringify({ theme: "light" }))');
    await cdp.send('Page.reload', { ignoreCache: true });
    await waitFor(cdp, "document.querySelector('.tilt-container')", 15000, 'N light');
    await sleep(700);
    sh = JSON.parse(await cdp.evalJs(menuShadow));
    ok('N4 亮色零触碰（inset 白线保留）', sh.hasInset && sh.hasWhite, sh.shadow.slice(0, 90));

    // ── L 全程零 Runtime exception + 零 console error（资源 404 豁免）──
    ok('L1 零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('L2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
    cdp.close();
    try { chrome.kill(); } catch (e) {}

    // ── K guest 门禁（全新 profile 新 spawn，无种子）──
    const chromeG = spawnChrome(CDP_PORT + 1, USER_DATA_GUEST);
    try {
      const cdpG = await connectCdp(CDP_PORT + 1);
      await cdpG.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
      await waitFor(cdpG, "document.querySelector('.fc-locked-hero')", 20000, 'K guest');
      await sleep(700);
      ok('K1 html.fc-guest 已挂', await cdpG.evalJs("document.documentElement.classList.contains('fc-guest')") === true);
      ok('K2 .studio-main 隐藏', await cdpG.evalJs("getComputedStyle(document.querySelector('.studio-main')).display") === 'none');
      ok('K3 锁屏卡可见', await cdpG.evalJs("getComputedStyle(document.querySelector('.fc-locked-hero')).display") !== 'none');
      ok('K4 guest 零 Runtime exception', cdpG.errs.length === 0, cdpG.errs.slice(0, 5).join(' | ') || '干净');
      cdpG.close();
    } finally { try { chromeG.kill(); } catch (e) {} }
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  process.exit(FAIL === 0 ? 0 : 1);
})();
