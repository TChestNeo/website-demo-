// tmp-probe-621-lvpill.js — v0.2.58.17 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡线上探针（rev 00329- 瞬态注记→00330- 终态）
// 用户「那么能不能添加一个功能就是当滑鼠靠近那个折叠的药丸时药丸会变大然后 向右滑出 一个卡片完整的显示等级信息和经验条」。
//   真身：折叠态（72px/64px 列）药丸只有 LV 标签+水杯+号码，等级信息在展开态 .mn-lv-normal 里；修法：桌面鼠标悬停
//   .mn-lv-badge → 药丸 scale(1.12) + 右侧滑出 .mn-lv-hovercard（position:fixed 挂 body 逃侧栏 overflow-x:hidden+用户卡
//   overflow:hidden 双裁剪；z-index 150；内容每次 show 从活的 .mn-lv-normal clone 最新 innerHTML；200ms 宽限防缝隙闪烁；
//   触屏门控 matchMedia(hover+fine)+CSS @media 双保险）；展开态零卡片（原徽章已可见）；renderSidebar 尾部每轮重挂监听。
// S 静态（线上 site-config 58.15+changelog 58.15 标题/用户原话三片断（滑鼠靠近/向右滑出/显示等级信息和经验条）+rev 00329-/
//   00330- 前缀在位（live 文本滞后一部署：探针时 00329- 已烘焙真值×2+00330-XXX 占位；repo 终态填终值——本探针按前缀
//   容断言两种形态均通过）+58.14 赋值零残留+58.14 标题与原话保留+58.14 rev 行 00323-qsz+00324-xr2 终态注记+58.13 rev 行
//   00321-jbh+00322-cv4 终态注记+58.12 rev 行 00319-mw5+00320-wl8 终态注记+58.11 rev 行 00317-ht9+00318-2vk 终态注记+
//   58.10 rev 行 00315-bm6+00316-s6b 终态注记+58.9 rev 行 00314-sw5+瞬态 00313-xjs 烘焙文本+00312-2n7+00311-wkw+
//   00310-pbk×2+00309-jbl 历史注记+旧 58.13/58.12/58.11/58.10 赋值零残留+58.13-58.1 历史标题保留+FC 47.4 恒；
//   ethereal.css/index.html 58.14 慢浪浅色件套全锚保留+58.15 悬停卡块（@media(hover:hover)+(pointer:fine) ×1/transition
//   transform 0.18s ×1/scale(1.12) ×1/.mn-lv-hovercard 两规则/z-index 150 ×1/translateX(-10px) scale(0.98) ×1/opacity+
//   transform 过渡 ×1/transform-origin left center ×1/中文注释片断；index z-index 150 与页本地样式撞车不计数））；
//   P 实机（demo 用户种子——id 无 USR- 前缀 → hasCloudUser false 零 API 调用，杜绝服务端 401 清会话；
//   两段式种子让页面自写每日登录日期键再覆写 XP → +5 跳过；P1-P4=58.14 药丸全件套原探（水位 8%/三层水件套/
//   几何 48×116/满级 100%/floating 64px 列）；P5-P8=悬停四连（开卡几何 scale1.12+卡片左=药丸未缩放右缘+10±2+宽 200+
//   内容 Lv.1 · 旅行者/100 / 1200 XP+条 8%→驻留零闪烁→离开收卡→addXP 重渲染重开内容新鲜 400/33%）；
//   P9=展开态零卡片+触屏门控（Emulation.setTouchEmulationEnabled → matchMedia false+折叠悬停零卡片；环境不支持
//   则 env-skip 容忍）；E 零异常。悬停必须先 move(5,5) 再移药丸中心否则 mouseenter 不触发（CDP 先例）；cardLeft 断言
//   用 pillURight=未缩放右缘（scale 外扩 2.88px 反算）；color-mix 慢浪浅色 getComputedStyle 返回 color(srgb r g b)
//   浮点格式（58.14 新坑）——rgbSum 双格式解析。收尾：清种子键零污染（一次性 profile 双保险）。全 Node 内置模块：
//   https + ws CDP。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const rgbSum = (s) => {
  const t = String(s || '');
  let m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(t);
  if (m) return (+m[1] + +m[2] + +m[3]);
  m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(t);
  if (m) return Math.round((+m[1] + +m[2] + +m[3]) * 255);
  return -1;
};

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
  ok('S1 线上 site-config（58.15 轮口径）：58.15 赋值+58.15 标题/用户原话三片断（滑鼠靠近/向右滑出/显示等级信息和经验条）+rev 00329-/00330- 前缀在位（live 文本滞后一部署：探针时 00329- 已烘焙真值×2+00330-XXX 占位、repo 终态填终值——前缀容断言两种形态均通过）+58.14 赋值零残留+58.14 标题与原话保留+58.14 rev 行 00323-qsz+00324-xr2 终态注记+58.13 rev 行 00321-jbh+00322-cv4 终态注记+58.12 rev 行 00319-mw5+00320-wl8 终态注记+58.11 rev 行 00317-ht9+00318-2vk 终态注记+58.10 rev 行 00315-bm6+00316-s6b 终态注记+58.9 rev 行 00314-sw5+瞬态 00313-xjs 烘焙文本+00312-2n7+00311-wkw+00310-pbk×2+00309-jbl 历史注记在位+旧 58.13/58.12/58.11/58.10 赋值零残留+58.13-58.1 历史标题保留+FC 47.4 恒',
    sc.status === 200 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.17';") !== -1 &&
    sc.body.indexOf('v0.2.58.15 = 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡') !== -1 &&
    sc.body.indexOf('滑鼠靠近') !== -1 &&
    sc.body.indexOf('向右滑出') !== -1 &&
    sc.body.indexOf('显示等级信息和经验条') !== -1 &&
    sc.body.indexOf('rev 00329-') !== -1 &&
    sc.body.indexOf('rev 00330-') !== -1 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.14';") === -1 &&
    sc.body.indexOf('v0.2.58.14 = 折叠侧栏等级水杯慢浪改浅色') !== -1 &&
    sc.body.indexOf('第二个波浪我希望是浅色的') !== -1 &&
    sc.body.indexOf('rev 00323-') !== -1 &&
    sc.body.indexOf('rev 00324-xr2') !== -1 &&
    sc.body.indexOf('v0.2.58.13 = 折叠侧栏等级水杯双浪同色深蓝+慢浪 z-1 层') !== -1 &&
    sc.body.indexOf('然后把两个颜色改成一样的深蓝色') !== -1 &&
    sc.body.indexOf('波浪Z轴的-1') !== -1 &&
    sc.body.indexOf('慢0.3s') !== -1 &&
    sc.body.indexOf('rev 00321-') !== -1 &&
    sc.body.indexOf('rev 00322-cv4') !== -1 &&
    sc.body.indexOf('v0.2.58.12 = 折叠侧栏等级水杯波浪位置抬高 4px') !== -1 &&
    sc.body.indexOf('rev 00319-') !== -1 &&
    sc.body.indexOf('rev 00320-wl8') !== -1 &&
    sc.body.indexOf('rev 00317-') !== -1 &&
    sc.body.indexOf('rev 00318-2vk') !== -1 &&
    sc.body.indexOf('rev 00315-bm6') !== -1 &&
    sc.body.indexOf('rev 00316-s6b') !== -1 &&
    sc.body.indexOf('rev 00314-sw5') !== -1 &&
    sc.body.indexOf('rev 00313-xjs') !== -1 &&
    sc.body.indexOf('rev 00312-2n7') !== -1 &&
    sc.body.indexOf('00311-wkw') !== -1 &&
    sc.body.split('rev 00310-pbk').length - 1 === 2 &&
    sc.body.indexOf('00309-jbl') !== -1 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.13';") === -1 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.12';") === -1 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.11';") === -1 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.10';") === -1 &&
    sc.body.indexOf('v0.2.58.11 = 折叠侧栏等级水杯两色互换') !== -1 &&
    sc.body.indexOf('波浪和深蓝色倒反') !== -1 &&
    sc.body.indexOf('就只是互换一下颜色而已') !== -1 &&
    sc.body.indexOf('v0.2.58.10 = 折叠侧栏等级水杯收成两层') !== -1 &&
    sc.body.indexOf('为什么是四层颜色') !== -1 &&
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
    sc.body.indexOf("'v10.28.47.4'") !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const ec = await get(BASE + '/assets/css/ethereal.css');
  ok('S2 线上 ethereal.css：58.14 慢浪浅色件套全锚保留（--mn-lv-light 赋值复活、深蓝水 wdeep 单规则 background var(--color-primary)+z-index:-2、快浪 wlightwave 单选择器 background-color var(--color-primary)×1+top -12px+z-index:0+2.2s、慢浪 wlightwave2 单选择器 background-color var(--mn-lv-light)×1+全同款几何+z-index:-1+2.5s、fill z-index:0 stacking context、mask-image ×4+viewBox 80×16+新路径 M0 8 Q20 0 40 8 Q60 16 80 8+mask-size 80px 16px ×2+400% strip 16px ×2+平移 80px+LV 标签 14px/号码 28px+旧色值组合/旧浅水层/旧深浪/旧合写选择器/旧 --mn-lv-wave-c 赋值/旧 1.6s/旧顶线 calc(40% - 8px)/旧 opacity 0.65/旧 height 40%/旧 top -8px/旧 40×32 路径/旧 300% strip 32px/旧平移 40px/旧顶线 calc(40% - 16px)/-16px/-6px/-4px/旧 64×116/旧 56×84/旧 32×58/旧 28×42/旧 28×48/旧 24×32/旧正圆/旧 20×16/旧 16×12/旧 12×8/旧平移 20px/旧花边/7px 7px/conic/pill-core 零残留）+58.15 悬停卡块（@media(hover:hover)+(pointer:fine) ×1/transition transform 0.18s ×1/scale(1.12) ×1/.mn-lv-hovercard 两规则/z-index 150 ×1/translateX(-10px) scale(0.98) ×1/opacity+transform 过渡 ×1/transform-origin left center ×1/中文注释片断：滑鼠靠近/向右滑出）+药丸 48×116/水杯 44×84 恒',
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
    ec.body.indexOf('--mn-lv-light:') !== -1 &&
    ec.body.indexOf('.mn-lv-wdeep { position: absolute; inset: 0; background: var(--color-primary); z-index: -2; }') !== -1 &&
    ec.body.indexOf('.mn-lv-wdeep { position: absolute; inset: 0; background: var(--mn-lv-light); }') === -1 &&
    ec.body.indexOf('.mn-lv-wlightwave {') !== -1 &&
    ec.body.indexOf('.mn-lv-wlightwave2 {') !== -1 &&
    ec.body.indexOf('.mn-lv-wlight {') === -1 &&
    ec.body.indexOf('.mn-lv-wdeepwave {') === -1 &&
    ec.body.indexOf('.mn-lv-wdeepwave, .mn-lv-wlightwave {') === -1 &&
    ec.body.split('background-color: var(--color-primary);').length - 1 === 1 &&
    ec.body.split('background-color: var(--mn-lv-light);').length - 1 === 1 &&
    ec.body.indexOf('.mn-lv-wdeep { position: absolute; inset: 0; background: var(--color-primary); }') === -1 &&
    ec.body.indexOf('background-color: var(--mn-lv-wave-c);') === -1 &&
    ec.body.indexOf('--mn-lv-wave-c:') === -1 &&
    ec.body.indexOf('opacity: 0.65;') === -1 &&
    ec.body.indexOf('height: 40%;') === -1 &&
    ec.body.split('mask-image: url(').length - 1 === 4 &&
    ec.body.split("viewBox='0 0 80 16'").length - 1 === 4 &&
    ec.body.split('M0 8 Q20 0 40 8 Q60 16 80 8 V16 H0 Z').length - 1 === 4 &&
    ec.body.split("viewBox='0 0 40 32'").length - 1 === 0 &&
    ec.body.split("viewBox='0 0 20 16'").length - 1 === 0 &&
    ec.body.split("viewBox='0 0 16 12'").length - 1 === 0 &&
    ec.body.split("viewBox='0 0 12 8'").length - 1 === 0 &&
    ec.body.split('M0 16 Q10 0 20 16 Q30 32 40 16').length - 1 === 0 &&
    ec.body.split('mask-size: 80px 16px').length - 1 === 4 &&
    ec.body.indexOf('mask-size: 40px 32px') === -1 &&
    ec.body.indexOf('mask-size: 20px 16px') === -1 &&
    ec.body.indexOf('mask-size: 16px 12px') === -1 &&
    ec.body.indexOf('mask-size: 12px 8px') === -1 &&
    ec.body.split('position: absolute; left: -100%; width: 400%; height: 16px;').length - 1 === 2 &&
    ec.body.indexOf('position: absolute; left: -100%; width: 300%; height: 32px;') === -1 &&
    ec.body.indexOf('position: absolute; left: -100%; width: 300%; height: 16px;') === -1 &&
    ec.body.indexOf('translateX(-80px)') !== -1 &&
    ec.body.indexOf('translateX(-40px)') === -1 &&
    ec.body.indexOf('translateX(-20px)') === -1 &&
    ec.body.split('top: -12px;').length - 1 === 2 &&
    ec.body.indexOf('top: -8px;') === -1 &&
    ec.body.indexOf('top: calc(40% - 8px);') === -1 &&
    ec.body.indexOf('top: calc(40% - 16px);') === -1 &&
    ec.body.indexOf('top: -16px;') === -1 &&
    ec.body.indexOf('top: -6px;') === -1 &&
    ec.body.indexOf('top: -4px;') === -1 &&
    ec.body.split('mn-lv-pill-in').length - 1 === 2 &&
    ec.body.indexOf('@keyframes mn-lv-wave') !== -1 &&
    ec.body.indexOf('animation: mn-lv-wave 2.2s linear infinite;') !== -1 &&
    ec.body.indexOf('animation: mn-lv-wave 2.5s linear infinite;') !== -1 &&
    ec.body.indexOf('animation: mn-lv-wave 1.6s linear infinite;') === -1 &&
    ec.body.split('z-index: 0;').length - 1 === 2 &&
    ec.body.split('z-index: -2;').length - 1 === 1 &&
    /z-index: -1;[\r\n]+\s*animation: mn-lv-wave 2\.5s linear infinite;/.test(ec.body) &&
    ec.body.indexOf('建 stacking context') !== -1 &&
    ec.body.indexOf('font-size: 14px; font-weight: 700; letter-spacing: 0.06em;') !== -1 &&
    ec.body.indexOf('font-size: 28px; font-weight: 700; color: var(--color-primary);') !== -1 &&
    ec.body.indexOf('第二个波浪我希望是浅色的') !== -1 &&
    ec.body.indexOf('浅色幽灵浪峰') !== -1 &&
    ec.body.indexOf('然后把两个颜色改成一样的深蓝色') !== -1 &&
    ec.body.indexOf('波浪Z轴的-1') !== -1 &&
    ec.body.indexOf('波浪的位置抬高4px') !== -1 &&
    ec.body.indexOf('位置抬高 4px') !== -1 &&
    ec.body.indexOf('波浪和深蓝色倒反') !== -1 &&
    ec.body.indexOf('就只是互换一下颜色而已') !== -1 &&
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
    ec.body.indexOf('mn-lv-pill-core') === -1 &&
    // ── 58.15 悬停卡新锚 ──
    ec.body.split('@media (hover: hover) and (pointer: fine)').length - 1 === 1 &&
    ec.body.split('transition: transform 0.18s ease;').length - 1 === 1 &&
    ec.body.split('transform: scale(1.12);').length - 1 === 1 &&
    ec.body.split('.mn-lv-hovercard {').length - 1 === 1 &&
    ec.body.split('.mn-lv-hovercard.active {').length - 1 === 1 &&
    ec.body.split('z-index: 150;').length - 1 === 1 &&
    ec.body.split('transform: translateX(-10px) scale(0.98);').length - 1 === 1 &&
    ec.body.split('transition: opacity 0.2s ease, transform 0.2s ease;').length - 1 === 1 &&
    ec.body.split('transform-origin: left center;').length - 1 === 1 &&
    ec.body.indexOf('滑鼠靠近') !== -1 &&
    ec.body.indexOf('向右滑出') !== -1,
    'status=' + ec.status + ' err=' + ec.error);
  const ix = await get(BASE + '/');
  ok('S3 线上 index.html：内联块 58.14 慢浪浅色件套同步在位（--mn-lv-light 赋值复活+慢浪 wlightwave2 选择器+深蓝水 wdeep 色值 background var(--color-primary)+z-index:-2+快浪 background-color var(--color-primary)×1+慢浪 background-color var(--mn-lv-light)×1+mask-image ×4+mask-size 80px 16px+400% strip+平移 80px+2.2s+2.5s 双速+top -12px ×2）+58.15 悬停卡块同步（@media(hover:hover)+(pointer:fine) ×1/.mn-lv-hovercard 两规则/scale(1.12) ×1/transition transform 0.18s ×1；z-index 150 与页本地样式撞车不计数）+药丸 48×116/水杯 44×84 恒、旧色值组合/旧深浪/旧浅水层/旧 40px 32px/旧 300% strip/旧 64×116/旧 56×84/旧 top -8px 零残留',
    ix.status === 200 &&
    ix.body.indexOf('.mn-lv-badge .mn-lv-pill { display: none; }') !== -1 &&
    ix.body.split('mn-lv-pill-in').length - 1 === 2 &&
    ix.body.indexOf('.mn-lv-wlightwave {') !== -1 &&
    ix.body.indexOf('.mn-lv-wlightwave2 {') !== -1 &&
    ix.body.indexOf('.mn-lv-wdeepwave {') === -1 &&
    ix.body.indexOf('.mn-lv-wlight {') === -1 &&
    ix.body.indexOf('background: var(--mn-lv-light);') === -1 &&
    ix.body.indexOf('.mn-lv-wdeep { position: absolute; inset: 0; background: var(--color-primary); z-index: -2; }') !== -1 &&
    ix.body.split('background-color: var(--color-primary);').length - 1 === 1 &&
    ix.body.indexOf('.mn-lv-wdeep { position: absolute; inset: 0; background: var(--color-primary); }') === -1 &&
    ix.body.split('background-color: var(--mn-lv-light);').length - 1 === 1 &&
    ix.body.indexOf('--mn-lv-light:') !== -1 &&
    ix.body.indexOf('width: 48px; height: 116px; border-radius: 999px;') !== -1 &&
    ix.body.indexOf('width: 44px; height: 84px; border-radius: 999px;') !== -1 &&
    ix.body.indexOf('width: 64px; height: 116px; border-radius: 999px;') === -1 &&
    ix.body.indexOf('width: 56px; height: 84px; border-radius: 999px;') === -1 &&
    ix.body.split('mask-image: url(').length - 1 === 4 &&
    ix.body.indexOf('mask-size: 80px 16px') !== -1 &&
    ix.body.indexOf('mask-size: 40px 32px') === -1 &&
    ix.body.indexOf('left: -100%; width: 400%') !== -1 &&
    ix.body.indexOf('left: -100%; width: 300%') === -1 &&
    ix.body.indexOf('translateX(-80px)') !== -1 &&
    ix.body.indexOf('translateX(-40px)') === -1 &&
    ix.body.split('top: -12px;').length - 1 === 2 &&
    ix.body.indexOf('top: -8px;') === -1 &&
    ix.body.indexOf('animation: mn-lv-wave 2.2s linear infinite;') !== -1 &&
    ix.body.indexOf('animation: mn-lv-wave 2.5s linear infinite;') !== -1 &&
    ix.body.indexOf('animation: mn-lv-wave 1.6s linear infinite;') === -1 &&
    ix.body.indexOf('@keyframes mn-lv-wave') !== -1 &&
    // ── 58.15 悬停卡新锚（index 内联同步；z-index 150 与页本地样式撞车不计数）──
    ix.body.split('@media (hover: hover) and (pointer: fine)').length - 1 === 1 &&
    ix.body.split('.mn-lv-hovercard {').length - 1 === 1 &&
    ix.body.split('.mn-lv-hovercard.active {').length - 1 === 1 &&
    ix.body.split('transform: scale(1.12);').length - 1 === 1 &&
    ix.body.split('transition: transform 0.18s ease;').length - 1 === 1,
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
      ok('P1 折叠药丸上阵（水位 8%+三层水件套+双浪同顶 -12px+慢浪浅色）', false, 'sidebar 未渲染');
      ok('P2 药丸几何齐平零挤压', false, 'sidebar 未渲染');
      ok('P3 满级水位 100%', false, 'sidebar 未渲染');
      ok('P4 窄列 floating 仍收在列内', false, 'sidebar 未渲染');
      ok('P5 悬停开卡', false, 'sidebar 未渲染');
      ok('P6 卡片驻留', false, 'sidebar 未渲染');
      ok('P7 离开收卡', false, 'sidebar 未渲染');
      ok('P8 重渲染重开', false, 'sidebar 未渲染');
      ok('P9 展开零卡片+触屏门控', false, 'sidebar 未渲染');
      ok('E 全程零异常', cdp.errs.length === 0 && cdp.consoleErrs.length === 0, (cdp.errs.slice(0, 3).join(' | ') + cdp.consoleErrs.slice(0, 3).join(' | ')).slice(0, 300));
      cdp.close();
      console.log('\nlvpill 探针：' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌');
      process.exit(FAIL.n ? 1 : 0);
    }
    // 悬停模拟（announce-hover 先例）：必须先 move 到 (5,5) 再移到目标中心，否则 mouseenter 不触发
    const move = async (x, y) => { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await sleep(80); };
    const rectCenter = async (sel) => {
      const s = await cdp.evalJs("(function(){ var el = document.querySelector(" + JSON.stringify(sel) + "); " +
        "if (!el) return JSON.stringify({ absent: true }); var r = el.getBoundingClientRect(); " +
        "return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }); })()");
      const o = JSON.parse(s);
      if (o.absent) throw new Error('rectCenter 元素缺失: ' + sel);
      return o;
    };
    const hoverNow = () => cdp.evalJs("(function(){ var card = document.querySelector('.mn-lv-hovercard'); " +
      "var pill = document.querySelector('#slati-sidebar .mn-lv-pill'); var badge = document.querySelector('#slati-sidebar .mn-lv-badge'); " +
      "if (!pill || !badge) return JSON.stringify({ absent: true }); " +
      "var pr = pill.getBoundingClientRect(); " +
      "var cr = card ? card.getBoundingClientRect() : null; " +
      "var tf = new DOMMatrixReadOnly(getComputedStyle(pill).transform); " +
      "var bar = card ? card.querySelector('div[style*=\"width\"]') : null; " +
      "return JSON.stringify({ cardExists: !!card, active: card ? card.classList.contains('active') : false, " +
      "opacity: card ? getComputedStyle(card).opacity : null, " +
      "badgeHover: badge.classList.contains('mn-lv-hover'), " +
      "pillScaleA: Math.round(tf.a * 1000) / 1000, pillScaleD: Math.round(tf.d * 1000) / 1000, " +
      "cardLeft: cr ? Math.round(cr.left) : null, cardRight: cr ? Math.round(cr.right) : null, " +
      "cardTop: cr ? Math.round(cr.top) : null, cardBottom: cr ? Math.round(cr.bottom) : null, " +
      "cardW: card ? card.offsetWidth : null, " +
      "pillRight: Math.round(pr.right), pillURight: Math.round(pr.right - (tf.a - 1) * pill.offsetWidth / 2), pillTop: Math.round(pr.top), pillH: Math.round(pr.height), " +
      "txt: card ? card.textContent : null, barWidth: bar ? bar.style.width : null, " +
      "vpW: window.innerWidth, vpH: window.innerHeight }); })()");
    // 种子（两段式——日期键交给页面自己写，杜绝 storage.get() 语义差异漏挡每日 +5）：
    // ①demo 用户（无 USR- → hasCloudUser false 零 API）+ 清 XP 键 → 重载（页面发 +5 并自写日期键）
    // ②覆写 xp=100 → 再重载（页面自写键命中 → +5 跳过 → XP 恒 100 → 水位 8%）
    await cdp.evalJs(`(function(){
      localStorage.setItem('slati_session', JSON.stringify({loggedIn:true}));
      localStorage.setItem('slati_user', JSON.stringify({id:'demo-probe-621', displayName:'Pill Probe', citizenId:'CIT-P621'}));
      ['slati_xp','slati_xp_last_login','slati_xp_gained'].forEach(function(k){ localStorage.removeItem(k); });
      localStorage.setItem('slati_sidebar_collapsed', '0');
    })()`);
    await cdp.send('Page.reload');
    await waitFor(cdp, 'document.querySelector("#slati-sidebar .mn-lv-badge") !== null', 20000, '徽章渲染（页面发 +5）');
    await cdp.evalJs(`localStorage.setItem('slati_xp', '100')`);
    await cdp.send('Page.reload');
    await waitFor(cdp, 'document.querySelector("#slati-sidebar .mn-lv-badge") !== null', 20000, '徽章渲染（XP=100 恒）');
    await sleep(800);

    // P1 折叠切换：药丸上阵（水位+三层水件套+双浪同顶 -12px+慢浪浅色）
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
      var lw = b.querySelector('.mn-lv-wlightwave'), lw2 = b.querySelector('.mn-lv-wlightwave2'), wd = b.querySelector('.mn-lv-wdeep');
      var n = b.querySelector('.mn-lv-normal'), p = b.querySelector('.mn-lv-pill');
      var lwR = lw.getBoundingClientRect(), lw2R = lw2.getBoundingClientRect(), fillR = fill.getBoundingClientRect();
      return JSON.stringify({nDisplay: getComputedStyle(n).display, pDisplay: getComputedStyle(p).display,
        fillStyle: fill.getAttribute('style'), num: num.textContent, tag: tag.textContent,
        waveKids: fill.children.length,
        lwAnim: getComputedStyle(lw).animationName + '/' + getComputedStyle(lw).animationDuration,
        lwMask: getComputedStyle(lw).maskSize, lwRepeat: getComputedStyle(lw).maskRepeat,
        lwMaskImg: getComputedStyle(lw).maskImage || '', lwH: Math.round(lwR.height), lwW: Math.round(lwR.width),
        lwRelFill: Math.round(lwR.top - fillR.top),
        lw2Anim: getComputedStyle(lw2).animationName + '/' + getComputedStyle(lw2).animationDuration,
        lw2Mask: getComputedStyle(lw2).maskSize, lw2H: Math.round(lw2R.height), lw2W: Math.round(lw2R.width),
        lw2RelFill: Math.round(lw2R.top - fillR.top),
        lw2Z: getComputedStyle(lw2).zIndex, lwZ: getComputedStyle(lw).zIndex,
        deepZ: getComputedStyle(wd).zIndex, fillZ: getComputedStyle(fill).zIndex,
        lwBg: getComputedStyle(lw).backgroundColor, lw2Bg: getComputedStyle(lw2).backgroundColor,
        deepBg: getComputedStyle(wd).backgroundColor,
        dwAbsent: !b.querySelector('.mn-lv-wdeepwave'), wlAbsent: !b.querySelector('.mn-lv-wlight'),
        collapsed: document.querySelector('#slati-sidebar').classList.contains('collapsed')});
    })()`);
    const before = JSON.parse(pillBefore), after = JSON.parse(pillAfter);
    ok('P1 折叠药丸上阵：展开药丸隐藏 → 折叠 normal 隐藏+药丸 flex+水位 8%+三层水件套（深蓝水 z:-2+慢浪 wlightwave2 z:-1 mask 80px 16px repeat-x+波形 16px 高+strip 400%=160px+2.5s 慢速+快浪 wlightwave z:0+2.2s+fill z:0 stacking context+两浪同顶 -12px+快浪/水深蓝同色 lwBg === deepBg+慢浪浅色 lw2Bg 浅于 deepBg（color-mix 55%+白≈color(srgb 0.601 0.605 0.907)）+浅水层/深浪已删零残留）+中间 LV/1+collapsed 在位',
      before.nDisplay !== 'none' && before.pDisplay === 'none' &&
      after.nDisplay === 'none' && after.pDisplay === 'flex' &&
      after.fillStyle === 'height:8%' &&
      after.waveKids === 3 &&
      after.lwAnim === 'mn-lv-wave/2.2s' &&
      after.lw2Anim === 'mn-lv-wave/2.5s' &&
      after.lwMask === '80px 16px' && after.lwRepeat === 'repeat-x' &&
      after.lwMaskImg && after.lwMaskImg !== 'none' && after.lwH === 16 && after.lwW === 160 &&
      after.lw2Mask === '80px 16px' && after.lw2H === 16 && after.lw2W === 160 &&
      after.lwRelFill === -12 && after.lw2RelFill === -12 &&
      after.lwBg !== null && after.lwBg === after.deepBg &&
      after.lw2Bg !== null && after.lw2Bg !== after.deepBg &&
      rgbSum(after.lw2Bg) > rgbSum(after.deepBg) &&
      after.lw2Z === '-1' && after.lwZ === '0' && after.deepZ === '-2' && after.fillZ === '0' &&
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

    // ── P5-P8 悬停四连（桌面 72px 列，XP=100）──
    await cdp.evalJs(`document.querySelector('#slati-sidebar').classList.remove('floating')`);
    await cdp.evalJs(`localStorage.setItem('slati_xp', '100')`);
    await cdp.send('Page.reload');
    await waitFor(cdp, 'document.querySelector("#slati-sidebar .mn-lv-badge") !== null', 20000, 'XP=100 重载');
    await sleep(800);

    // P5 悬停开卡（XP=100 → Lv.1 · 旅行者 100 / 1200 XP + 条 8%）
    await move(5, 5);
    let pc = await rectCenter('#slati-sidebar .mn-lv-pill');
    await move(pc.x, pc.y);
    await waitFor(cdp, "document.querySelector('.mn-lv-hovercard') && document.querySelector('.mn-lv-hovercard').classList.contains('active')", 1500, '悬停卡出现(P5)');
    await sleep(450);
    let r = await hoverNow();
    const h5 = JSON.parse(r);
    ok('P5 悬停开卡：卡片 active+opacity 1+徽章 hover 类+药丸 scale(1.12)（a/d∈[1.115,1.125]）+卡片左=药丸未缩放右缘+10 ±2+视口内（右≤vpW/顶≥8/底≤vpH-8）+宽 200+内容 Lv.1 · 旅行者/100 / 1200 XP+条 8%',
      h5.cardExists === true && h5.active === true && h5.opacity === '1' && h5.badgeHover === true &&
      h5.pillScaleA >= 1.115 && h5.pillScaleA <= 1.125 && h5.pillScaleD >= 1.115 && h5.pillScaleD <= 1.125 &&
      Math.abs(h5.cardLeft - (h5.pillURight + 10)) <= 2 &&
      h5.cardRight <= h5.vpW && h5.cardTop >= 8 && h5.cardBottom <= h5.vpH - 8 &&
      h5.cardW === 200 &&
      h5.txt !== null && h5.txt.indexOf('Lv.1 · 旅行者') !== -1 && h5.txt.indexOf('100 / 1200 XP') !== -1 &&
      h5.barWidth === '8%', r);

    // P6 卡片驻留（防缝隙闪烁：>200ms 宽限后仍开）
    await move(Math.round(h5.cardLeft + h5.cardW / 2), Math.round((h5.cardTop + h5.cardBottom) / 2));
    await sleep(350);
    r = await hoverNow();
    const h6 = JSON.parse(r);
    ok('P6 卡片驻留：鼠标移到卡片上 >200ms 宽限后卡片仍 active+opacity 1（badge→卡片 10px 缝隙零闪烁）',
      h6.active === true && h6.opacity === '1' && h6.badgeHover === true, r);

    // P7 离开收卡
    await move(5, 5);
    await sleep(450);
    r = await hoverNow();
    const h7 = JSON.parse(r);
    ok('P7 离开收卡：active 摘除+opacity 0+徽章 hover 类摘除+药丸 transform 回单位矩阵（a/d=1）',
      h7.active === false && h7.opacity === '0' && h7.badgeHover === false &&
      h7.pillScaleA === 1 && h7.pillScaleD === 1, r);

    // P8 重渲染重开+内容新鲜（addXP +300 → 400 = 33%）
    await move(pc.x, pc.y);
    await waitFor(cdp, "document.querySelector('.mn-lv-hovercard') && document.querySelector('.mn-lv-hovercard').classList.contains('active')", 1500, '悬停卡再开(P8)');
    await sleep(450);
    await cdp.evalJs("window.SlatiDB.addXP('probe', 300)");
    await sleep(400);
    r = await hoverNow();
    const h8a = JSON.parse(r);
    // Chrome 静止指针下 DOM 替换会合成 mouseenter 自动重开卡——关键守卫=若开则内容必新鲜（400/33%）
    const h8aFresh = h8a.active === false ||
      (h8a.txt !== null && h8a.txt.indexOf('400 / 1200 XP') !== -1 && h8a.barWidth === '33%');
    await move(5, 5);
    await sleep(450);
    r = await hoverNow();
    const h8b = JSON.parse(r);
    const h8bHidden = h8b.active === false && h8b.badgeHover === false;
    await move(pc.x, pc.y);
    await waitFor(cdp, "document.querySelector('.mn-lv-hovercard') && document.querySelector('.mn-lv-hovercard').classList.contains('active')", 1500, '悬停卡三开(P8)');
    await sleep(450);
    r = await hoverNow();
    const h8c = JSON.parse(r);
    ok('P8 重渲染重开+内容新鲜：addXP +300（100→400=33%）后若合成 mouseenter 重开卡则内容必新鲜（400/33%）→ 移开必收（active false）→ 再悬停重开内容新鲜 Lv.1 · 旅行者/400 / 1200 XP+条 33%',
      h8aFresh === true &&
      h8bHidden === true &&
      h8c.active === true && h8c.badgeHover === true &&
      h8c.txt !== null && h8c.txt.indexOf('Lv.1 · 旅行者') !== -1 && h8c.txt.indexOf('400 / 1200 XP') !== -1 &&
      h8c.barWidth === '33%', r);

    // ── P9 展开态零卡片 + 触屏门控（环境不支持 Emulation 则 env-skip 容忍）──
    await move(5, 5);
    await sleep(300);
    await cdp.evalJs("window._slatiToggleSidebar()"); // → 展开态（原徽章已可见）
    await sleep(500);
    pc = await rectCenter('#slati-sidebar .mn-lv-badge');
    await move(pc.x, pc.y);
    await sleep(300);
    r = await hoverNow();
    const h9 = JSON.parse(r);
    const expandedZero = h9.active === false && h9.badgeHover === false;
    await move(5, 5);
    await sleep(200);
    let touchSkip = false, touchZero = true, mqFalse = false;
    try {
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    } catch (e) { touchSkip = true; }
    if (!touchSkip) {
      await cdp.send('Page.reload');
      await waitFor(cdp, 'document.querySelector("#slati-sidebar .mn-lv-badge") !== null', 20000, '触屏重载');
      await sleep(800);
      mqFalse = await cdp.evalJs("!!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches)") === false;
      await cdp.evalJs("window._slatiToggleSidebar()"); // → 折叠态（触屏下悬停应零卡片）
      await sleep(500);
      pc = await rectCenter('#slati-sidebar .mn-lv-pill');
      await move(5, 5);
      await move(pc.x, pc.y);
      await sleep(300);
      r = await hoverNow();
      const ht = JSON.parse(r);
      touchZero = ht.active === false && ht.badgeHover === false;
      await move(5, 5);
      await sleep(200);
      try { await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }); } catch (e) {}
    }
    ok('P9 展开态零卡片+触屏门控：展开悬停零卡片（active false+无 hover 类）→ 触屏模拟 matchMedia false+折叠悬停零卡片（触屏零行为；Emulation 不可用则 env-skip）',
      expandedZero === true && (touchSkip === true || (mqFalse === true && touchZero === true)),
      'expandedZero=' + expandedZero + ' touchSkip=' + touchSkip + ' mqFalse=' + mqFalse + ' touchZero=' + touchZero + (touchSkip ? '' : ' ' + r));

    // 收尾：清种子键零污染（一次性 profile 双保险）
    await cdp.evalJs(`(function(){ ['slati_session','slati_user','slati_xp','slati_xp_last_login','slati_xp_gained','slati_sidebar_collapsed'].forEach(function(k){ localStorage.removeItem(k); }); })()`);

    ok('E 全程零异常：零 Runtime exception + 零 console error',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      (cdp.errs.slice(0, 3).join(' | ') + cdp.consoleErrs.slice(0, 3).join(' | ')).slice(0, 300));
    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }

  console.log('\nlvpill 探针：' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌');
  process.exit(FAIL.n ? 1 : 0);
})().catch((e) => { console.error('探针崩溃：' + (e && e.stack || e)); process.exit(1); });
