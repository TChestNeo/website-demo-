// tmp-probe-616-lvpill.js — v0.2.58.10 折叠侧栏等级水杯收成两层 线上探针（rev 00315- 首部署占位 XXX）
// 用户「为什么是四层颜色？能不能只有两层？」——一问钦定「只有主色水+一道浅浪」。真身：58.9 杯里 4 件套
//   （深水+浅水半透明叠层+深浪压交界线+浅浪）视觉上四段颜色；修法：删浅水层 .mn-lv-wlight 与深浪
//   .mn-lv-wdeepwave，只留主色水 .mn-lv-wdeep+杯顶一道浅色浪 .mn-lv-wlightwave（80×16 mask/16px 带高/
//   400% strip/平移 80px/2.2s 全零改动）；sidebar.js 模板删两 div；水位从底往上灌/0.5s 过渡/药丸 48×116/
//   水杯 44×84/LV 标签 14px/号码 28px 全保持。
// S 静态（线上 site-config 58.10+changelog 58.10 标题/用户原话/一问钦定只有主色水+一道浅浪+rev 00315- 占位 XXX
//   （repo 终态填真值=二次烘焙、live 滞后一部署=58.9 同款下轮烘焙；本探针按 live 实况断言前缀 00315-）+
//   58.9 rev 行 00314-sw5+瞬态 00313-xjs 烘焙文本+00312-2n7+00311-wkw+00310-pbk×2+00309-jbl 历史注记+
//   旧 58.9 赋值零残留+58.9-58.1 历史标题保留+FC 47.4 恒；ethereal.css/index.html 单层水件套在位
//   （主色水 wdeep 单规则+浅色浪 wlightwave 单规则 80×16 路径+mask-size 80px 16px+400% strip 16px+平移 80px+
//   顶线 -8px+2.2s 单速+背景色 var(--mn-lv-light)）+旧浅水层 .mn-lv-wlight/旧深浪 .mn-lv-wdeepwave/
//   旧合写选择器/旧 --mn-lv-wave-c 赋值/旧 1.6s/旧顶线 calc(40% - 8px)/旧 opacity 0.65/旧 height 40% 零残留）；
//   P 实机（demo 用户种子——id 无 USR- 前缀 → hasCloudUser false 零 API 调用，杜绝服务端 401 清会话；
//   两段式种子让页面自写每日登录日期键再覆写 XP → +5 跳过；折叠药丸上阵/水位 8%/单层水件套/几何 48×116
//   齐平零挤压/满级 100%/floating 右溢 1px 可忽略仍收在 64px 列内）；E 零异常。收尾：清种子键零污染
//   （一次性 profile 双保险）。全 Node 内置模块：https + ws CDP。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (url) => new Promise((resolve) => {
  const req = https.request(url, { headers: { 'User-Agent': 'mn-probe' }, timeout: 30000 }, (res) => {
    const chunks = [];
    let len = 0;
    res.on('data', (c) => { chunks.push(c); len += c.length; if (len > 2000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
  });
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
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
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
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
    try { if (await cdp.evalJs(expr)) return true; } catch (e) {}
    await sleep(200);
  }
  console.log('  ⏳ waitFor 超时: ' + label);
  return false;
}

(async () => {
  const BASE = 'https://mnationworld.com';

  // ── S 线上静态 ──
  const sc = await get(BASE + '/assets/js/site-config.js');
  ok('S1 线上 site-config（58.10 轮口径）：58.10 赋值+58.10 标题/用户原话（为什么是四层颜色/能不能只有两层）+一问钦定只有主色水+一道浅浪+rev 00315- 占位 XXX（repo 终态填真值=二次烘焙、live 滞后一部署；探针按 live 实况断言前缀）+58.9 rev 行 00314-sw5+瞬态 00313-xjs 烘焙文本+00312-2n7+00311-wkw+00310-pbk×2+00309-jbl 历史注记在位+旧 58.9 赋值零残留+58.9-58.1 历史标题保留+FC 47.4 恒',
    sc.status === 200 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.10';") !== -1 &&
    sc.body.indexOf('v0.2.58.10 = 折叠侧栏等级水杯收成两层') !== -1 &&
    sc.body.indexOf('为什么是四层颜色') !== -1 &&
    sc.body.indexOf('能不能只有两层') !== -1 &&
    sc.body.indexOf('一问钦定') !== -1 &&
    sc.body.indexOf('只有主色水+一道浅浪') !== -1 &&
    sc.body.indexOf('rev 00315-') !== -1 &&
    sc.body.indexOf('rev 00314-sw5') !== -1 &&
    sc.body.indexOf('rev 00313-xjs') !== -1 &&
    sc.body.indexOf('rev 00312-2n7') !== -1 &&
    sc.body.indexOf('00311-wkw') !== -1 &&
    sc.body.split('rev 00310-pbk').length - 1 === 2 &&
    sc.body.indexOf('00309-jbl') !== -1 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.9';") === -1 &&
    sc.body.indexOf('v0.2.58.9 = 折叠侧栏等级药丸波浪改平改宽') !== -1 &&
    sc.body.indexOf('那个波浪能不能') !== -1 &&
    sc.body.indexOf('高度减半+宽度翻倍') !== -1 &&
    sc.body.indexOf('v0.2.58.8 = 折叠侧栏等级药丸收窄对齐菜单按钮') !== -1 &&
    sc.body.indexOf('能不能把他的') !== -1 &&
    sc.body.indexOf('v0.2.58.7 = 折叠侧栏等级药丸与水波全翻倍') !== -1 &&
    sc.body.indexOf('v0.2.58.6 = 折叠侧栏等级水杯药丸与波浪再放大') !== -1 &&
    sc.body.indexOf('v0.2.58.5 = 折叠侧栏等级水杯改药丸形+波浪加大') !== -1 &&
    sc.body.indexOf('v0.2.58.4 = 折叠侧栏等级水位环波纹改正弦水面') !== -1 &&
    sc.body.indexOf('v0.2.58.3 = 折叠侧栏等级水位环+双层水波') !== -1 &&
    sc.body.indexOf('v0.2.58.2 = 折叠侧栏等级纵向药丸+经验环') !== -1 &&
    sc.body.indexOf('v0.2.58.1 = 左侧菜单底部不透明背景完全删除') !== -1 &&
    sc.body.indexOf("'v10.28.48.0'") !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const ec = await get(BASE + '/assets/css/ethereal.css');
  ok('S2 线上 ethereal.css：单层水件套在位（主色水 wdeep 单规则+浅色浪 wlightwave 单选择器+背景色 var(--mn-lv-light)+mask-image ×2+viewBox 80×16+新路径 M0 8 Q20 0 40 8 Q60 16 80 8+mask-size 80px 16px+400% strip 16px+平移 80px+顶线 -8px+2.2s 单速+LV 标签 14px/号码 28px+新轮注释：为什么是四层颜色/只有主色水+一道浅浪）+ 药丸 48×116/水杯 44×84 恒 + 旧浅水层 .mn-lv-wlight/旧深浪 .mn-lv-wdeepwave/旧合写选择器/旧 --mn-lv-wave-c 赋值/旧 1.6s/旧顶线 calc(40% - 8px)/旧 opacity 0.65/旧 height 40%/旧 40×32 路径/旧 300% strip 32px/旧平移 40px/旧顶线 calc(40% - 16px)/-16px/旧 64×116/旧 56×84/旧 32×58/旧 28×42/旧 28×48/旧 24×32/旧正圆/旧 20×16/旧 16×12/旧 12×8/旧平移 20px/旧花边/7px 7px/conic/pill-core 零残留',
    ec.status === 200 &&
    ec.body.indexOf('.mn-lv-badge .mn-lv-pill { display: none; }') !== -1 &&
    ec.body.indexOf('.app-sidebar.collapsed .mn-lv-badge .mn-lv-normal { display: none; }') !== -1 &&
    ec.body.indexOf('width: 48px; height: 116px; border-radius: 999px;') !== -1 &&
    ec.body.indexOf('width: 64px; height: 116px; border-radius: 999px;') === -1 &&
    ec.body.indexOf('width: 44px; height: 84px; border-radius: 999px;') !== -1 &&
    ec.body.indexOf('width: 56px; height: 84px; border-radius: 999px;') === -1 &&
    ec.body.indexOf('width: 32px; height: 58px; border-radius: 999px;') === -1 &&
    ec.body.indexOf('width: 28px; height: 42px; border-radius: 999px;') === -1 &&
    ec.body.indexOf('width: 28px; height: 48px;') === -1 &&
    ec.body.indexOf('width: 24px; height: 32px;') === -1 &&
    ec.body.indexOf('width: 24px; height: 24px; border-radius: 50%;') === -1 &&
    ec.body.indexOf('--mn-lv-light: color-mix(in srgb, var(--color-primary) 55%, #ffffff);') !== -1 &&
    ec.body.indexOf('.mn-lv-wdeep { position: absolute; inset: 0; background: var(--color-primary); }') !== -1 &&
    ec.body.indexOf('.mn-lv-wlightwave {') !== -1 &&
    ec.body.indexOf('.mn-lv-wlight {') === -1 &&
    ec.body.indexOf('.mn-lv-wdeepwave {') === -1 &&
    ec.body.indexOf('.mn-lv-wdeepwave, .mn-lv-wlightwave {') === -1 &&
    ec.body.indexOf('background-color: var(--mn-lv-light);') !== -1 &&
    ec.body.indexOf('background-color: var(--mn-lv-wave-c);') === -1 &&
    ec.body.indexOf('--mn-lv-wave-c:') === -1 &&
    ec.body.indexOf('opacity: 0.65;') === -1 &&
    ec.body.indexOf('height: 40%;') === -1 &&
    ec.body.split('mask-image: url(').length - 1 === 2 &&
    ec.body.split("viewBox='0 0 80 16'").length - 1 === 2 &&
    ec.body.split('M0 8 Q20 0 40 8 Q60 16 80 8 V16 H0 Z').length - 1 === 2 &&
    ec.body.split("viewBox='0 0 40 32'").length - 1 === 0 &&
    ec.body.split("viewBox='0 0 20 16'").length - 1 === 0 &&
    ec.body.split("viewBox='0 0 16 12'").length - 1 === 0 &&
    ec.body.split("viewBox='0 0 12 8'").length - 1 === 0 &&
    ec.body.split('M0 16 Q10 0 20 16 Q30 32 40 16').length - 1 === 0 &&
    ec.body.indexOf('mask-size: 80px 16px') !== -1 &&
    ec.body.indexOf('mask-size: 40px 32px') === -1 &&
    ec.body.indexOf('mask-size: 20px 16px') === -1 &&
    ec.body.indexOf('mask-size: 16px 12px') === -1 &&
    ec.body.indexOf('mask-size: 12px 8px') === -1 &&
    ec.body.indexOf('position: absolute; left: -100%; width: 400%; height: 16px;') !== -1 &&
    ec.body.indexOf('position: absolute; left: -100%; width: 300%; height: 32px;') === -1 &&
    ec.body.indexOf('position: absolute; left: -100%; width: 300%; height: 16px;') === -1 &&
    ec.body.indexOf('translateX(-80px)') !== -1 &&
    ec.body.indexOf('translateX(-40px)') === -1 &&
    ec.body.indexOf('translateX(-20px)') === -1 &&
    ec.body.indexOf('top: -8px;') !== -1 &&
    ec.body.indexOf('top: calc(40% - 8px);') === -1 &&
    ec.body.indexOf('top: calc(40% - 16px);') === -1 &&
    ec.body.indexOf('top: -16px;') === -1 &&
    ec.body.split('mn-lv-pill-in').length - 1 === 2 &&
    ec.body.indexOf('@keyframes mn-lv-wave') !== -1 &&
    ec.body.indexOf('animation: mn-lv-wave 2.2s linear infinite;') !== -1 &&
    ec.body.indexOf('animation: mn-lv-wave 1.6s linear infinite;') === -1 &&
    ec.body.indexOf('font-size: 14px; font-weight: 700; letter-spacing: 0.06em;') !== -1 &&
    ec.body.indexOf('font-size: 28px; font-weight: 700; color: var(--color-primary);') !== -1 &&
    ec.body.indexOf('为什么是四层颜色') !== -1 &&
    ec.body.indexOf('只有主色水+一道浅浪') !== -1 &&
    ec.body.indexOf('那个波浪能不能') !== -1 &&
    ec.body.indexOf('高度减半+宽度翻倍') !== -1 &&
    ec.body.indexOf('能不能把他的') !== -1 &&
    ec.body.indexOf('和菜单按钮一样 48px') !== -1 &&
    ec.body.indexOf('大2倍') !== -1 &&
    ec.body.indexOf('药丸形不是圆形') !== -1 &&
    ec.body.indexOf('波纹不是动画') !== -1 &&
    ec.body.indexOf('background: radial-gradient(circle at 50% 0') === -1 &&
    ec.body.indexOf('background-size: 7px 7px') === -1 &&
    ec.body.indexOf('conic-gradient') === -1 &&
    ec.body.indexOf('mn-lv-pill-core') === -1,
    'status=' + ec.status + ' err=' + ec.error);
  const ix = await get(BASE + '/');
  ok('S3 线上 index.html：内联块单层水件套同步在位（浅色浪单选择器+mask-size 80px 16px+400% strip+平移 80px+2.2s 单速）+药丸 48×116/水杯 44×84 恒、旧深浪/旧浅水层/旧 40px 32px/旧 300% strip/旧 64×116/旧 56×84 零残留',
    ix.status === 200 &&
    ix.body.indexOf('.mn-lv-badge .mn-lv-pill { display: none; }') !== -1 &&
    ix.body.split('mn-lv-pill-in').length - 1 === 2 &&
    ix.body.indexOf('.mn-lv-wlightwave {') !== -1 &&
    ix.body.indexOf('.mn-lv-wdeepwave {') === -1 &&
    ix.body.indexOf('.mn-lv-wlight {') === -1 &&
    ix.body.indexOf('width: 48px; height: 116px; border-radius: 999px;') !== -1 &&
    ix.body.indexOf('width: 44px; height: 84px; border-radius: 999px;') !== -1 &&
    ix.body.indexOf('width: 64px; height: 116px; border-radius: 999px;') === -1 &&
    ix.body.indexOf('width: 56px; height: 84px; border-radius: 999px;') === -1 &&
    ix.body.split('mask-image: url(').length - 1 === 2 &&
    ix.body.indexOf('mask-size: 80px 16px') !== -1 &&
    ix.body.indexOf('mask-size: 40px 32px') === -1 &&
    ix.body.indexOf('left: -100%; width: 400%') !== -1 &&
    ix.body.indexOf('left: -100%; width: 300%') === -1 &&
    ix.body.indexOf('translateX(-80px)') !== -1 &&
    ix.body.indexOf('translateX(-40px)') === -1 &&
    ix.body.indexOf('animation: mn-lv-wave 2.2s linear infinite;') !== -1 &&
    ix.body.indexOf('animation: mn-lv-wave 1.6s linear infinite;') === -1 &&
    ix.body.indexOf('@keyframes mn-lv-wave') !== -1,
    'status=' + ix.status + ' err=' + ix.error);

  // ── P 实机（demo 用户种子——零 API 调用零 401）──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const CDP_PORT = 9600 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-lvpill-' + Date.now());
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
    // 只挑真标签页（pages[0] 可能是扩展后台页）
    const tab = pages.find(p => p.type === 'page') || pages[0];
    const cdp = new CDP(tab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: BASE + '/' });
    let sbOk = await waitFor(cdp, 'document.querySelector(".app-sidebar") !== null', 15000, 'sidebar 渲染');
    if (!sbOk) {
      await cdp.send('Page.reload');
      sbOk = await waitFor(cdp, 'document.querySelector(".app-sidebar") !== null', 20000, 'reload 后 sidebar 渲染');
    }
    if (!sbOk) {
      ok('P1 折叠药丸上阵（水位 8%+单层水件套）', false, 'sidebar 未渲染');
      ok('P2 药丸几何齐平零挤压', false, 'sidebar 未渲染');
      ok('P3 满级水位 100%', false, 'sidebar 未渲染');
      ok('P4 窄列 floating 仍收在列内', false, 'sidebar 未渲染');
      ok('E1 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 3).join(' | '));
      ok('E2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 3).join(' | '));
      cdp.close();
      console.log('\nlvpill 探针：' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌');
      process.exit(FAIL.n ? 1 : 0);
    }
    // 种子（两段式——日期键交给页面自己写，杜绝 storage.get() 语义差异漏挡每日 +5）：
    // ①demo 用户（无 USR- → hasCloudUser false 零 API）+ 清 XP 键 → 重载（页面发 +5 并自写日期键）
    // ②覆写 xp=100 → 再重载（页面自写键命中 → +5 跳过 → XP 恒 100 → 水位 8%）
    await cdp.evalJs(`(function(){
      localStorage.setItem('slati_session', JSON.stringify({loggedIn:true}));
      localStorage.setItem('slati_user', JSON.stringify({id:'demo-probe-616', displayName:'Pill Probe', citizenId:'CIT-P616'}));
      ['slati_xp','slati_xp_last_login','slati_xp_gained'].forEach(function(k){ localStorage.removeItem(k); });
      localStorage.setItem('slati_sidebar_collapsed', '0');
    })()`);
    await cdp.send('Page.reload');
    await waitFor(cdp, 'document.querySelector("#slati-sidebar .mn-lv-badge") !== null', 20000, '徽章渲染（页面发 +5）');
    await cdp.evalJs(`localStorage.setItem('slati_xp', '100')`);
    await cdp.send('Page.reload');
    await waitFor(cdp, 'document.querySelector("#slati-sidebar .mn-lv-badge") !== null', 20000, '徽章渲染（XP=100 恒）');
    await sleep(800);

    // P1 折叠切换：药丸上阵（水位+单层水件套）
    const pillBefore = await cdp.evalJs(`(function(){
      var b = document.querySelector('#slati-sidebar .mn-lv-badge');
      if (!b) return JSON.stringify({absent:true});
      var n = b.querySelector('.mn-lv-normal'), p = b.querySelector('.mn-lv-pill');
      return JSON.stringify({nDisplay: getComputedStyle(n).display, pDisplay: getComputedStyle(p).display});
    })()`);
    await cdp.evalJs(`window._slatiToggleSidebar()`);
    await sleep(500);
    const pillAfter = await cdp.evalJs(`(function(){
      var b = document.querySelector('#slati-sidebar .mn-lv-badge');
      var fill = b.querySelector('.mn-lv-fill'), num = b.querySelector('.mn-lv-pill-num'), tag = b.querySelector('.mn-lv-pill-tag');
      var lw = b.querySelector('.mn-lv-wlightwave'), wd = b.querySelector('.mn-lv-wdeep');
      var n = b.querySelector('.mn-lv-normal'), p = b.querySelector('.mn-lv-pill');
      var lwR = lw.getBoundingClientRect();
      return JSON.stringify({nDisplay: getComputedStyle(n).display, pDisplay: getComputedStyle(p).display,
        fillStyle: fill.getAttribute('style'), num: num.textContent, tag: tag.textContent,
        waveKids: fill.children.length,
        lwAnim: getComputedStyle(lw).animationName + '/' + getComputedStyle(lw).animationDuration,
        lwMask: getComputedStyle(lw).maskSize, lwRepeat: getComputedStyle(lw).maskRepeat,
        lwMaskImg: getComputedStyle(lw).maskImage || '', lwH: Math.round(lwR.height), lwW: Math.round(lwR.width),
        lwBg: getComputedStyle(lw).backgroundColor, deepBg: getComputedStyle(wd).backgroundColor,
        dwAbsent: !b.querySelector('.mn-lv-wdeepwave'), wlAbsent: !b.querySelector('.mn-lv-wlight'),
        collapsed: document.querySelector('#slati-sidebar').classList.contains('collapsed')});
    })()`);
    const before = JSON.parse(pillBefore), after = JSON.parse(pillAfter);
    ok('P1 折叠药丸上阵：展开药丸隐藏 → 折叠 normal 隐藏+药丸 flex+水位 8%+单层水件套（主色水+杯顶一道浅色浪 mask 80px 16px repeat-x+波形 16px 高+strip 400%=160px+2.2s 单速+浅浪色与主色水不同+浅水层/深浪已删零残留）+中间 LV/1+collapsed 在位',
      before.nDisplay !== 'none' && before.pDisplay === 'none' &&
      after.nDisplay === 'none' && after.pDisplay === 'flex' &&
      after.fillStyle === 'height:8%' &&
      after.waveKids === 2 &&
      after.lwAnim === 'mn-lv-wave/2.2s' &&
      after.lwMask === '80px 16px' && after.lwRepeat === 'repeat-x' &&
      after.lwMaskImg && after.lwMaskImg !== 'none' && after.lwH === 16 && after.lwW === 160 &&
      after.lwBg !== null && after.lwBg !== after.deepBg &&
      after.dwAbsent === true && after.wlAbsent === true &&
      after.num === '1' && after.tag === 'LV' && after.collapsed === true,
      'before=' + pillBefore + ' after=' + pillAfter);

    // P2 几何齐平零挤压（药丸 48=用户卡内容宽、与内容列齐平零溢出）
    const geo = await cdp.evalJs(`(function(){
      var pill = document.querySelector('#slati-sidebar .mn-lv-pill');
      var ring = document.querySelector('#slati-sidebar .mn-lv-ring');
      var av = document.querySelector('#slati-sidebar .user-info-bar .avatar');
      var mod = document.querySelector('#slati-sidebar .user-module');
      var sb = document.querySelector('#slati-sidebar');
      var p = pill.getBoundingClientRect(), r = ring.getBoundingClientRect(), a = av.getBoundingClientRect(), m = mod.getBoundingClientRect();
      var s = sb.getBoundingClientRect();
      var overlap = !(p.right <= a.left || p.left >= a.right || p.bottom <= a.top || p.top >= a.bottom);
      var alignMod = Math.round(p.left - m.left) + '/' + Math.round(m.right - p.right);
      return JSON.stringify({pw: Math.round(p.width), ph: Math.round(p.height), rw: Math.round(r.width), rh: Math.round(r.height),
        aw: Math.round(a.width), ah: Math.round(a.height), gap: Math.round((p.top - a.bottom) * 10) / 10,
        inMod: p.left >= m.left && p.right <= m.right,
        inSidebar: p.left >= s.left - 0.5 && p.right <= s.right + 0.5,
        overlap: overlap, ringRadius: getComputedStyle(ring).borderRadius, alignMod: alignMod});
    })()`);
    const G = JSON.parse(geo);
    ok('P2 药丸几何：药丸 48×116 + 水杯 44×84 胶囊（border-radius 999px）+ 头像 32×32 不挤压 + 间距 8px + 药丸 48=用户卡内容宽与内容列齐平（inMod true·左右各 4px）+ 收在 72px 列内 + 零重叠',
      G.pw === 48 && G.ph === 116 && G.rw === 44 && G.rh === 84 && G.ringRadius === '999px' &&
      G.aw === 32 && G.ah === 32 &&
      G.gap >= 7 && G.gap <= 9 && G.inMod === true && G.inSidebar === true && G.overlap === false, geo);

    // P3 满级水位 100%
    await cdp.evalJs(`localStorage.setItem('slati_xp', '1228800')`);
    await cdp.send('Page.reload');
    await waitFor(cdp, 'document.querySelector("#slati-sidebar .mn-lv-fill") !== null', 20000, '满级重载');
    await sleep(800);
    const max = await cdp.evalJs(`(function(){
      var b = document.querySelector('#slati-sidebar .mn-lv-badge');
      var fill = b.querySelector('.mn-lv-fill'), num = b.querySelector('.mn-lv-pill-num');
      return JSON.stringify({fillStyle: fill.getAttribute('style'), num: num.textContent,
        txt: b.textContent, collapsed: document.querySelector('#slati-sidebar').classList.contains('collapsed')});
    })()`);
    const M = JSON.parse(max);
    ok('P3 满级 Lv12：水位 100% + 中间 12 + 折叠偏好重载保持',
      M.fillStyle === 'height:100%' &&
      M.num === '12' && M.txt.indexOf('Lv.12 · 传奇') !== -1 && M.collapsed === true, max);

    // P4 窄列 floating：右边线 1px 致模块 47、药丸右溢 1px 可忽略但仍收在 64px 列内
    await cdp.evalJs(`document.querySelector('#slati-sidebar').classList.add('floating')`);
    await sleep(400);
    const floatGeo = await cdp.evalJs(`(function(){
      var pill = document.querySelector('#slati-sidebar .mn-lv-pill');
      var mod = document.querySelector('#slati-sidebar .user-module');
      var sb = document.querySelector('#slati-sidebar');
      var p = pill.getBoundingClientRect(), m = mod.getBoundingClientRect(), s = sb.getBoundingClientRect();
      return JSON.stringify({pw: Math.round(p.width), ph: Math.round(p.height),
        inMod: p.left >= m.left && p.right <= m.right,
        inSidebar: p.left >= s.left - 0.5 && p.right <= s.right + 0.5});
    })()`);
    const F = JSON.parse(floatGeo);
    ok('P4 窄列 floating（64px）：药丸 48×116 右溢 1px 可忽略（inMod false=右边线致模块 47）但仍收在 64px 列内零越界',
      F.pw === 48 && F.ph === 116 && F.inMod === false && F.inSidebar === true, floatGeo);

    // 收尾：清种子键零污染（一次性 profile 双保险）
    await cdp.evalJs(`(function(){ ['slati_session','slati_user','slati_xp','slati_xp_last_login','slati_xp_gained','slati_sidebar_collapsed'].forEach(function(k){ localStorage.removeItem(k); }); })()`);

    ok('E1 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 3).join(' | '));
    ok('E2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 3).join(' | '));
    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }

  console.log('\nlvpill 探针：' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌');
  process.exit(FAIL.n ? 1 : 0);
})().catch((e) => { console.error('探针崩溃：' + (e && e.stack || e)); process.exit(1); });
