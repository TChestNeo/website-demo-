// tmp-battery-story.js — v0.2.26.0 Story 政治启蒙故事站电池（2026-09-08）
// 单页架构（用户口径：不要分成 8 页、点下去直接开始）：
//   /（index）= ScrollExpand 序章（小卡→全屏展开；整块可点击 → /wip；BlurText 大标题「政治」）
//   /wip = 六章+尾声 46 场景一张长页（BlurText 章节大标题 + MagicText 滚动逐字 + ch2 开头 WebGL 地球 +
//           DotGrid 点阵底（用户钦定 gsap InertiaPlugin 组件原生移植）+
//           ch4 事件页九段结构 + 冷战两字字体轮转（两字 fill 亮起才开转，纯定时器零滚动）+
//           尾声知识地图点亮（chX 场景入场标 story-read）+ CTA 回主站）
// 本地：静态壳 + /api 404（故事页零 /api 设计；signup 页走 demo 模式）。
// 线上：LIVE_BASE=https://story.mnationworld.com（index+wip 抽验 + 主站交叉）。
// 跑法：node tmp-battery-story.js（LIVE_BASE=https://story.mnationworld.com 跑线上）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-story-' + Date.now());

// ── 静态壳（docs/ 原样；/api 全 404 → signup 页 demo 模式） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
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
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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
  await t.send('Log.enable');
  await t.send('Network.enable');
  // /api 请求计数走 CDP Network（跨导航全局生效——evalJs patchFetch 只活一个文档）
  let apiCalls = 0;
  t.on('Network.requestWillBeSent', p => { if (String(p.request.url).indexOf('/api/') !== -1) apiCalls++; });
  const errs = [];
  t.on('Runtime.exceptionThrown', p => {
    const d = (p.exceptionDetails.exception && p.exceptionDetails.exception.description) || 'exc';
    if (d.indexOf('data:') === -1) errs.push(d);
  });
  t.on('Log.entryAdded', p => {
    if (p.entry.level === 'error' && p.entry.url && p.entry.url.indexOf('/api/') === -1 &&
        p.entry.url.indexOf('data:') === -1 && p.entry.url.indexOf('favicon') === -1 &&
        p.entry.url.indexOf('fonts.gstatic.com') === -1 && p.entry.url.indexOf('fonts.googleapis.com') === -1) errs.push(p.entry.text);
  });

  if (LIVE) await runLive(t);
  else await runLocal(t);

  console.log('\n' + pass.length + ' ✅ / ' + fail.length + ' ❌');
  t.close();
  chrome.kill();
  process.exit(fail.length ? 1 : 0);

  // ──────────────────────────────────────────────
  // 本地：序章展开 / 点击直达 / wip 滚轮 / 知识地图 / 口径守卫 / 事件结构 / 移动端 / reduced / 注册跳转
  // ──────────────────────────────────────────────
  async function runLocal(t) {
    console.log('── A. /wip 单页（序章 hero + 全部内容，渲染/版本/媒体图/BlurText/零 API）──');
    await nav(t, BASE + '/story/wip');
    await waitFor(t, "document.querySelectorAll('.scene').length === 46", 20000, 'wip 46 场景（序章+黑屏段+六章+尾声）');
    await waitFor(t, "document.querySelector('#scene-1') && document.querySelector('#scene-1').classList.contains('in')", 20000, '序章 hero .in');
    const a1 = await t.evalJs("(() => { var v = document.querySelector('meta[name=\"story-version\"]'); var tp = document.querySelector('meta[name=\"story-topic\"]');" +
      " var n = document.querySelectorAll('.narration');" +
      " var im = document.querySelector('#scene-1 .se-img');" +
      " return { title: document.title, ver: v ? v.content : null, topic: tp ? tp.content : null, scenes: document.querySelectorAll('.scene').length," +
      " nar: n.length, img: !!im, imgSrc: im ? im.getAttribute('src') : null," +
      " heroes: document.querySelectorAll('.scene-hero').length," +
      " p1: getComputedStyle(document.querySelector('#scene-1')).getPropertyValue('--p') }; })()");
    check('A wip title/meta 版本/story-all/46 场景/44 narration/7 大标题（ch1 首标题为融变区不计）', a1.title === '政治启蒙 · 完整故事｜M.NationWorld' && a1.ver === 'v0.2.26.0' && a1.topic === 'story-all' && a1.scenes === 46 && a1.nar === 44 && a1.heroes === 7, a1.title + ' nar=' + a1.nar + ' heroes=' + a1.heroes);
    check('A 序章媒体图（.se-img + 相对 hero-media.jpg）', a1.img && a1.imgSrc === 'hero-media.jpg', 'src=' + a1.imgSrc);
    check('A 首场景 load 即 .in + --p 已写', a1.p1 !== '' && a1.p1 !== '0', '--p=' + a1.p1);
    const aBk = await t.evalJs("(() => { var orb = document.querySelector('.orb');" +
      " return { bodyBg: getComputedStyle(document.body).backgroundColor," +
      " beforeImg: getComputedStyle(document.body, '::before').backgroundImage," +
      " orbDisplay: orb ? getComputedStyle(orb).display : null }; })()");
    check('A 全站纯黑底：body 纯黑 + 环境渐变移除 + 光球隐藏', aBk.bodyBg === 'rgb(0, 0, 0)' && aBk.beforeImg === 'none' && aBk.orbDisplay === 'none', 'bg=' + aBk.bodyBg + ' before=' + aBk.beforeImg + ' orb=' + aBk.orbDisplay);
    const aT0 = await t.evalJs("(() => { var t2 = document.querySelector('#scene-1 .se-title');" +
      " var cs = t2.querySelectorAll('.tc'); var ci = Array.prototype.map.call(cs, function (e) { return e.style.getPropertyValue('--ci'); }).join(',');" +
      " return { n: cs.length, ci: ci, joined: Array.prototype.map.call(cs, function (e) { return e.textContent; }).join('') }; })()");
    check('A BlurText 标题拆分（政治 = 2 字 + --ci 0,1）', aT0.n === 2 && aT0.ci === '0,1' && aT0.joined === '政治', 'n=' + aT0.n + ' ci=' + aT0.ci);
    await waitFor(t, "(() => { var cs = document.querySelectorAll('#scene-1 .se-title .tc');" +
      " for (var i = 0; i < cs.length; i++) { var s = getComputedStyle(cs[i]);" +
      "   if (parseFloat(s.opacity) < 0.995 || (s.filter !== 'blur(0px)' && s.filter !== 'none')) return false; } return true; })()", 12000, 'BlurText 动画完全落定');
    check('A BlurText 动画落定（opacity 1 + blur 归零）', true, '政治 2 字全部落定');
    check('A 访客零 /api 请求', apiCalls === 0, 'n=' + apiCalls);

    console.log('── A2. ScrollExpand 序章展开（小卡→全屏 + 标题淡出）──');
    const se0 = await t.evalJs("(() => { var f = document.querySelector('#scene-1 .se-frame'); var t2 = document.querySelector('#scene-1 .se-title');" +
      " return { clip: f.style.clipPath || getComputedStyle(f).clipPath, tOp: parseFloat(getComputedStyle(t2).opacity) }; })()");
    check('A2 初始：小卡 clip-path（inset 21%/29% 圆角）', se0.clip.indexOf('inset(21%') !== -1 && se0.clip.indexOf('29%') !== -1 && se0.clip.indexOf('round 24px') !== -1, se0.clip.slice(0, 60));
    await t.evalJs('window.scrollTo(0, 600)');
    await sleep(500);
    const seSt = await t.evalJs("Math.round(document.querySelector('#scene-1 .se-stage').getBoundingClientRect().top)");
    check('A2 sticky 生效（滚动 600px 后 stage 贴顶 0）', seSt === 0, 'top=' + seSt);
    await t.evalJs('window.scrollTo(0, 1250)');
    await waitFor(t, "parseFloat(getComputedStyle(document.querySelector('#scene-1 .se-title')).opacity) < 0.1", 8000, '大标题淡出完成');
    await waitFor(t, "(() => { var c = getComputedStyle(document.querySelector('#scene-1 .se-frame')).clipPath; var m = /([\\d.]+)%/.exec(c); return m && parseFloat(m[1]) < 0.5; })()", 8000, '展开平滑收敛近全屏');
    const se1 = await t.evalJs("(() => { var f = document.querySelector('#scene-1 .se-frame'); var t2 = document.querySelector('#scene-1 .se-title'); var sub = document.querySelector('#scene-1 .se-sub-line');" +
      " var m = /inset\\(([\\d.]+)%/.exec(getComputedStyle(f).clipPath);" +
      " return { first: m ? parseFloat(m[1]) : -1, clip: getComputedStyle(f).clipPath, tOp: parseFloat(getComputedStyle(t2).opacity), subOp: parseFloat(getComputedStyle(sub).opacity) }; })()");
    check('A2 展开后：近全屏 clip + 大标题/副句淡出', se1.first >= 0 && se1.first < 0.5 && se1.tOp < 0.1 && se1.subOp < 0.1, 'clip=' + se1.clip.slice(0, 40) + ' tOp=' + se1.tOp.toFixed(2));
    await t.evalJs('window.scrollTo(0, 0)');
    await sleep(400);

    console.log('── A3. / 跳转 → /wip（一个链接多用）──');
    await nav(t, BASE + '/story/index.html');
    await waitFor(t, "window.location.pathname.indexOf('/wip') !== -1", 15000, '/ 跳转 wip');
    await waitFor(t, "document.querySelectorAll('.scene').length === 46", 20000, 'wip 46 场景');
    const a3 = await t.evalJs("(() => { var n = document.querySelectorAll('.narration');" +
      " var voices = Array.prototype.map.call(n, function (e) { return e.getAttribute('data-voice'); });" +
      " var uniq = voices.filter(function (x, i) { return x && voices.indexOf(x) === i; }).length;" +
      " return { nar: n.length, uniq: uniq }; })()");
    check('A3 wip 44 narration 全唯一（data-voice）', a3.nar === 44 && a3.uniq === 44, 'nar=' + a3.nar + ' uniq=' + a3.uniq);

    console.log('── B. 滚轮推进（wip ch1-02：严格序列入场 + 一行亮完才亮下一行/回滚不撤销）──');
    await t.evalJs("document.querySelector('[data-scene=\"ch1-02\"]').scrollIntoView({ block: 'start' }); window.scrollBy(0, 80);");
    await waitFor(t, "document.querySelector('[data-scene=\"ch1-02\"]').classList.contains('in')", 10000, 'ch1-02 入场 .in');
    await waitFor(t, "(() => { function st(i) { var l = document.querySelectorAll('[data-scene=\"ch1-02\"] .line')[i]; if (!l) return null;" +
      " var fls = l.querySelectorAll('.mw-fill'); var full = 0, zero = 0;" +
      " for (var k = 0; k < fls.length; k++) { var o = parseFloat(fls[k].style.opacity); if (o >= 0.99) full++; if (o <= 0.01) zero++; }" +
      " return { n: fls.length, full: full, zero: zero }; }" +
      " var s0 = st(0), s1 = st(1), s2 = st(2);" +
      " return s0 && s1 && s2 && s0.full === s0.n && s1.full > 0 && s1.zero > 0 && s2.zero === s2.n; })()", 10000, '行1全亮/行2进行中/行3未开始');
    const bSeq = await t.evalJs("(() => { function st(i) { var l = document.querySelectorAll('[data-scene=\"ch1-02\"] .line')[i];" +
      " var fls = l.querySelectorAll('.mw-fill'); var full = 0, zero = 0;" +
      " for (var k = 0; k < fls.length; k++) { var o = parseFloat(fls[k].style.opacity); if (o >= 0.99) full++; if (o <= 0.01) zero++; }" +
      " return { n: fls.length, full: full, zero: zero }; }" +
      " return [st(0), st(1), st(2)]; })()");
    check('B 一行亮完才亮下一行（行1全亮/行2进行中/行3未开始）', bSeq[0].full === bSeq[0].n && bSeq[1].full > 0 && bSeq[1].zero > 0 && bSeq[2].zero === bSeq[2].n, 'L1=' + bSeq[0].full + '/' + bSeq[0].n + ' L2=' + bSeq[1].full + '/' + bSeq[1].n + ' L3=0/' + bSeq[2].n);
    await t.evalJs('window.scrollBy(0, 100)');
    await waitFor(t, "(() => { var fls = document.querySelectorAll('[data-scene=\"ch1-02\"] .mw-fill'); if (!fls.length) return false;" +
      " for (var i = 0; i < fls.length; i++) { if (parseFloat(fls[i].style.opacity) < 0.99) return false; } return true; })()", 10000, '三行全部亮完');
    const b1 = await t.evalJs("(() => { var sc = document.querySelector('[data-scene=\"ch1-02\"]');" +
      " var ls = sc.querySelectorAll('.line'); var on = 0; for (var i = 0; i < ls.length; i++) if (ls[i].classList.contains('on')) on++;" +
      " var fills = sc.querySelectorAll('.mw-fill'); var fillOk = 0;" +
      " for (var i = 0; i < fills.length; i++) { if (parseFloat(fills[i].style.opacity) >= 0.99) fillOk++; }" +
      " var line2 = ls[1]; var mw = line2 ? line2.querySelectorAll('.mw').length : 0;" +
      " return { on: on, total: ls.length, p: parseFloat(getComputedStyle(sc).getPropertyValue('--p'))," +
      " fillOk: fillOk, fillTotal: fills.length, mw: mw, textLen: line2 ? line2.textContent.length : 0 }; })()");
    check('B 滚到位后：分句全量 .on（序列进度 q 驱动）', b1.on === b1.total, 'on=' + b1.on + '/' + b1.total);
    check('B MagicText 逐字点亮：全场景 fill 落定 opacity ≥ 0.99', b1.fillOk === b1.fillTotal && b1.fillTotal > 0, 'fillOk=' + b1.fillOk + '/' + b1.fillTotal);
    check('B MagicText 结构：行内 .mw 拆分数 = 原文字数', b1.mw > 0 && b1.mw * 2 === b1.textLen, 'mw=' + b1.mw + ' textContent=' + b1.textLen);
    await t.evalJs('window.scrollTo(0, 0)');
    await sleep(400);
    const b2 = await t.evalJs("(() => { var sc = document.querySelector('[data-scene=\"ch1-02\"]');" +
      " var ls = sc.querySelectorAll('.line'); var on = 0; for (var i = 0; i < ls.length; i++) if (ls[i].classList.contains('on')) on++;" +
      " return { inCls: sc.classList.contains('in'), on: on, total: ls.length }; })()");
    check('B 回滚顶部：.in/.on 只加不减（不撤销）', b2.inCls && b2.on === b2.total, 'in=' + b2.inCls + ' on=' + b2.on);

    console.log('── F. 尾声知识地图点亮（ch1 场景入场自动标读 + ch3 预种回放点亮）──');
    // 回访用户场景：storage 里已有 ch3 旧记录 → 任何一次章节入场（ch2 大标题）触发点亮时，旧记录一起亮
    await t.evalJs("(function(){ var m = {}; try { m = JSON.parse(localStorage.getItem('story-read') || '{}'); } catch(e){} m.ch3 = true; localStorage.setItem('story-read', JSON.stringify(m)); })()");
    await t.evalJs("document.querySelector('[data-scene=\"ch2-00\"]').scrollIntoView({ block: 'start' }); window.scrollBy(0, 100)");
    await waitFor(t, "document.querySelectorAll('.kmap-node').length === 6 && document.querySelectorAll('.kmap-node.lit').length >= 2", 15000, '知识地图渲染+预种点亮');
    const f1 = await t.evalJs("(() => { var ns = document.querySelectorAll('.kmap-node');" +
      " var lit = []; for (var i = 0; i < ns.length; i++) if (ns[i].classList.contains('lit')) lit.push(ns[i].getAttribute('data-read'));" +
      " return { lit: lit, total: ns.length }; })()");
    check('F 已读章节点亮（ch1 自动 + ch3 预种回放点亮）', f1.lit.indexOf('ch1') !== -1 && f1.lit.indexOf('ch3') !== -1, f1.lit.join(','));
    const f2 = await t.evalJs("(() => { var cta = document.querySelector('.story-cta'); return cta ? cta.getAttribute('href') : null; })()");
    check('F 尾声 CTA → onboarding-identity 绝对 URL', f2 === 'https://mnationworld.com/pages/onboarding-identity.html', f2);

    console.log('── C. wip 单页口径（守卫/零 api）──');
    const c1 = await t.evalJs("(() => { var guard = { ethereal: document.querySelectorAll('link[href*=\"ethereal\"]').length," +
      " transitions: document.querySelectorAll('script[src*=\"transitions\"]').length," +
      " sidebar: document.querySelectorAll('script[src*=\"sidebar\"]').length," +
      " storage: document.querySelectorAll('script[src*=\"storage.js\"]').length," +
      " api: document.querySelectorAll('script[src*=\"api.js\"]').length };" +
      " return { guard: guard }; })()");
    const gAll = c1.guard.ethereal + c1.guard.transitions + c1.guard.sidebar + c1.guard.storage + c1.guard.api;
    check('C wip 不挂平台样式（ethereal/transitions/sidebar/storage/api 全 0）', gAll === 0, JSON.stringify(c1.guard));
    check('C 全程访客零 /api 请求（故事站段落）', apiCalls === 0, 'n=' + apiCalls);

    console.log('── DG. DotGrid 点阵底 + globe 回归（ch2-00 地球背景；用户钦定组件原生移植）──');
    // globe 回归：经纬线球 canvas 回到 ch2-00（撤销 WovenCloth 后复验）
    const gg2 = await t.evalJs("(() => { var sc = document.querySelector('[data-scene=\"ch2-00\"]');" +
      " var cv = sc ? sc.querySelector('canvas.scene-gl') : null;" +
      " return { inCh2: !!cv, total: document.querySelectorAll('canvas.scene-gl').length," +
      " glOkBool: !!window.storyWebgl && typeof window.storyWebgl.ok === 'boolean'," +
      " fallback: !!(sc && sc.querySelector('.gl-fallback')) }; })()");
    check('DG globe 回归：scene-gl 只在 ch2-00 + storyWebgl.ok 布尔 + fallback 层', gg2.inCh2 && gg2.total === 1 && gg2.glOkBool && gg2.fallback, 'total=' + gg2.total + ' okBool=' + gg2.glOkBool + ' fb=' + gg2.fallback);
    const dg0 = await t.evalJs("(() => { var sc = document.querySelector('[data-scene=\"ch2-00\"]');" +
      " var dg = document.querySelector('.dot-grid'); var cv = dg ? dg.querySelector('.dot-grid__canvas') : null;" +
      " var glCv = sc ? sc.querySelector('canvas.scene-gl') : null;" +
      " return { inCh2: !!(sc && dg && sc.contains(dg)), total: document.querySelectorAll('.dot-grid').length," +
      " canvas: !!cv, pe: cv ? getComputedStyle(cv).pointerEvents : null," +
      " z: dg ? getComputedStyle(dg).zIndex : null, glZ: glCv ? getComputedStyle(glCv).zIndex : null }; })()");
    check('DG 点阵只在 ch2-00（全页 1 个）+ canvas + 滚轮穿透 + z:0 垫在 globe(z:1) 之后', dg0.inCh2 && dg0.total === 1 && dg0.canvas && dg0.pe === 'none' && dg0.z === '0' && dg0.glZ === '1', 'total=' + dg0.total + ' pe=' + dg0.pe + ' z=' + dg0.z + '/' + dg0.glZ);
    await waitFor(t, 'window.storyDots && window.storyDots.ok === true && window.storyDots.count > 0', 20000, 'gsap CDN + storyDots 网格构建');
    const dg1 = await t.evalJs("(() => { var c = window.storyDots.config;" +
      " return { count: window.storyDots.count, dotSize: c.dotSize, gap: c.gap, base: c.baseColor, active: c.activeColor," +
      " prox: c.proximity, trig: c.speedTrigger, shockR: c.shockRadius, shockS: c.shockStrength, max: c.maxSpeed, res: c.resistance, ret: c.returnDuration }; })()");
    check('DG props 口径（用户钦定暗底 base #120826 / active #5227FF，其余原样 16/32/150/100/250/5/5000/750/1.5）+ 点阵已构建', dg1.count > 0 && dg1.dotSize === 16 && dg1.gap === 32 && dg1.base === '#120826' && dg1.active === '#5227FF' && dg1.prox === 150 && dg1.trig === 100 && dg1.shockR === 250 && dg1.shockS === 5 && dg1.max === 5000 && dg1.res === 750 && dg1.ret === 1.5, 'count=' + dg1.count);
    const dgIn = await t.evalJs("(() => { var p = window.storyDots.pointer; return { x: p.x, y: p.y }; })()");
    check('DG 初始全暗：指针在画布外 (-9999) → 无点被点亮（滑鼠靠近才亮）', dgIn.x === -9999 && dgIn.y === -9999, 'pointer=(' + dgIn.x + ',' + dgIn.y + ')');
    // 惯性推离：真实输入快速划过画布上部（viewport 内）→ 点被踢出（offset ≠ 0）→ 弹性回位归零
    await t.evalJs("document.querySelector('[data-scene=\"ch2-00\"]').scrollIntoView({ block: 'start' })");
    await sleep(500);
    const dg2 = await t.evalJs("(() => { var r = document.querySelector('.dot-grid__canvas').getBoundingClientRect();" +
      " return { x: r.left + r.width / 2, y: r.top + 300 }; })()");
    await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dg2.x - 140, y: dg2.y });
    await sleep(120);
    await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dg2.x + 140, y: dg2.y });
    await waitFor(t, 'window.storyDots.getMaxOffset() > 0', 4000, '快速划过触发惯性推离');
    check('DG 指针快速划过 → 点阵被踢出（maxOffset > 0）', true, 'kicked');
    await waitFor(t, 'window.storyDots.getMaxOffset() === 0', 10000, '惯性 + 弹性回位归零');
    check('DG 回位：maxOffset 归零（elastic.out 落定）', true, 'settled');
    // 点击冲击波
    await t.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dg2.x, y: dg2.y, button: 'left', clickCount: 1 });
    await t.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dg2.x, y: dg2.y, button: 'left', clickCount: 1 });
    await waitFor(t, 'window.storyDots.getMaxOffset() > 0', 4000, '点击冲击波推出点阵');
    check('DG 点击冲击波 → 点阵被推出（maxOffset > 0）', true, 'shock');
    await waitFor(t, 'window.storyDots.getMaxOffset() === 0', 10000, '冲击波回位归零');
    check('DG 冲击波回位：maxOffset 归零', true, 'settled2');

    console.log('── M. MorphSlider 融变图集（什么是政治首标题内，滚轮驱动）──');
    const m1 = await t.evalJs("(() => { var sc = document.querySelector('[data-scene=\"ch1-00\"]');" +
      " var cap = document.querySelector('.ms-caption');" +
      " return { inCh1: !!sc && !!sc.querySelector('.ms-canvas'), total: document.querySelectorAll('.ms-canvas').length," +
      " gl: !!window.storyMorph, okBool: window.storyMorph ? (typeof window.storyMorph.ok === 'boolean') : false," +
      " count: window.storyMorph ? window.storyMorph.count : 0, fallback: !!document.querySelector('.ms-fallback')," +
      " align: cap ? getComputedStyle(cap).textAlign : null }; })()");
    check('M 融变区只在 ch1-00（全页仅 1 个 canvas）+ storyMorph.ok 布尔 + 5 图 + 兜底图', m1.inCh1 && m1.total === 1 && m1.gl && m1.okBool && m1.count === 5 && m1.fallback, 'total=' + m1.total + ' count=' + m1.count);
    check('M 字幕「什么是政治」右对齐', m1.align === 'right', 'textAlign=' + m1.align);
    await t.evalJs("document.querySelector('[data-scene=\"ch1-00\"]').scrollIntoView({ block: 'start' })");
    await sleep(600);
    const m2a = await t.evalJs("(() => { var l = document.querySelector('[data-scene=\"ch1-00\"] .narration .line');" +
      " return { idx: window.storyMorph.idx, local: window.storyMorph.local, mw: l ? l.querySelectorAll('.mw').length : 0, len: l ? l.textContent.length : 0 }; })()");
    check('M 区段顶 = 图 0 静止（idx=0 local=0）', m2a.idx === 0 && m2a.local === 0, 'idx=' + m2a.idx + ' local=' + m2a.local);
    check('M 解释文字 MagicText 拆分（.mw = 原文字数）', m2a.mw > 0 && m2a.mw * 2 === m2a.len, 'mw=' + m2a.mw + ' textContent=' + m2a.len);
    // 滚动量按实测 vh 比例（headless 900 窗口 innerHeight=802，绝对 px 会漂）；三行窗口 [0,0.9]/[0.9,1.8]/[1.8,2.7] 屏
    const vhB = await t.evalJs('window.innerHeight');
    // pos≈0.5：行1 进行中 / 行2、行3 未开始
    await t.evalJs('window.scrollBy(0, ' + Math.round(vhB * 0.5) + ')');
    await waitFor(t, "(() => { function lineState(i) { var l = document.querySelectorAll('[data-scene=\"ch1-00\"] .line')[i]; if (!l) return null;" +
      " var fls = l.querySelectorAll('.mw-fill'); var full = 0, zero = 0;" +
      " for (var k = 0; k < fls.length; k++) { var o = parseFloat(fls[k].style.opacity); if (o >= 0.99) full++; if (o <= 0.01) zero++; }" +
      " return { n: fls.length, full: full, zero: zero }; }" +
      " var s0 = lineState(0), s1 = lineState(1), s2 = lineState(2);" +
      " return s0 && s1 && s2 && s0.full > 0 && s0.zero > 0 && s1.zero === s1.n && s2.zero === s2.n; })()", 10000, '行1进行中/行2行3未开始');
    const m2s = await t.evalJs("(() => { function st(i) { var l = document.querySelectorAll('[data-scene=\"ch1-00\"] .line')[i];" +
      " var fls = l.querySelectorAll('.mw-fill'); var full = 0, zero = 0;" +
      " for (var k = 0; k < fls.length; k++) { var o = parseFloat(fls[k].style.opacity); if (o >= 0.99) full++; if (o <= 0.01) zero++; }" +
      " return { n: fls.length, full: full, zero: zero }; }" +
      " return [st(0), st(1), st(2)]; })()");
    check('M 一行亮完才亮下一行（行1进行中/行2行3未开始）', m2s[0].full > 0 && m2s[0].zero > 0 && m2s[1].zero === m2s[1].n && m2s[2].zero === m2s[2].n, 'L1=' + m2s[0].full + '/' + m2s[0].n + ' L2=0/' + m2s[1].n + ' L3=0/' + m2s[2].n);
    // pos≈2.0：行1+行2 全亮，行3 基本未开始
    await t.evalJs('window.scrollBy(0, ' + Math.round(vhB * 1.5) + ')');
    await waitFor(t, "(() => { function lineState(i) { var l = document.querySelectorAll('[data-scene=\"ch1-00\"] .line')[i]; if (!l) return null;" +
      " var fls = l.querySelectorAll('.mw-fill'); var full = 0, zero = 0;" +
      " for (var k = 0; k < fls.length; k++) { var o = parseFloat(fls[k].style.opacity); if (o >= 0.99) full++; if (o <= 0.01) zero++; }" +
      " return { n: fls.length, full: full, zero: zero }; }" +
      " var s0 = lineState(0), s1 = lineState(1), s2 = lineState(2);" +
      " return s0 && s1 && s2 && s0.full === s0.n && s1.full === s1.n && s2.zero >= s2.n - 4; })()", 10000, '行1行2全亮/行3基本未开始');
    const m2s2 = await t.evalJs("(() => { function st(i) { var l = document.querySelectorAll('[data-scene=\"ch1-00\"] .line')[i];" +
      " var fls = l.querySelectorAll('.mw-fill'); var full = 0, zero = 0;" +
      " for (var k = 0; k < fls.length; k++) { var o = parseFloat(fls[k].style.opacity); if (o >= 0.99) full++; if (o <= 0.01) zero++; }" +
      " return { n: fls.length, full: full, zero: zero }; }" +
      " return [st(0), st(1), st(2)]; })()");
    check('M 接力：行1+行2 全亮，行3 基本未开始（≤4 字）', m2s2[0].full === m2s2[0].n && m2s2[1].full === m2s2[1].n && m2s2[2].zero >= m2s2[2].n - 4, 'L1=' + m2s2[0].full + '/' + m2s2[0].n + ' L2=' + m2s2[1].full + '/' + m2s2[1].n + ' L3 亮=' + (m2s2[2].n - m2s2[2].zero));
    // pos≈2.75：第四张图出现（hold3 起点 2.7）时三行全部亮完
    await t.evalJs('window.scrollBy(0, ' + Math.round(vhB * 0.75) + ')');
    await waitFor(t, "window.storyMorph && window.storyMorph.idx === 3", 10000, '第四张图出现');
    await waitFor(t, "(() => { var fls = document.querySelectorAll('[data-scene=\"ch1-00\"] .mw-fill'); if (!fls.length) return false;" +
      " for (var i = 0; i < fls.length; i++) { if (parseFloat(fls[i].style.opacity) < 0.99) return false; } return true; })()", 10000, '三行全部亮完');
    const m2t = await t.evalJs("(() => { function st(i) { var l = document.querySelectorAll('[data-scene=\"ch1-00\"] .line')[i];" +
      " var fls = l.querySelectorAll('.mw-fill'); var full = 0;" +
      " for (var k = 0; k < fls.length; k++) { if (parseFloat(fls[k].style.opacity) >= 0.99) full++; }" +
      " return { n: fls.length, full: full }; }" +
      " return { idx: window.storyMorph.idx, L: [st(0), st(1), st(2)] }; })()");
    check('M 亮起速度：到第四张图（idx=3）时三行全亮完', m2t.idx === 3 && m2t.L[0].full === m2t.L[0].n && m2t.L[1].full === m2t.L[1].n && m2t.L[2].full === m2t.L[2].n, 'idx=' + m2t.idx + ' L=' + m2t.L[0].full + '/' + m2t.L[1].full + '/' + m2t.L[2].full);
    // 图 4 停留静止（停留值生效，hold3 内 local=0）
    await waitFor(t, "window.storyMorph && window.storyMorph.local < 0.05 && window.storyMorph.idx === 3", 10000, '图 4 停留落定');
    const m2b = await t.evalJs("(() => { return { idx: window.storyMorph.idx, local: window.storyMorph.local }; })()");
    check('M 停留值生效：过渡完成后图 4 静止（local=0 不扭曲）', m2b.idx === 3 && m2b.local < 0.05, 'idx=' + m2b.idx + ' local=' + m2b.local.toFixed(3));
    // pos≈3.35：过渡 4 进行中（节奏一致）
    await t.evalJs('window.scrollBy(0, ' + Math.round(vhB * 0.6) + ')');
    await waitFor(t, "window.storyMorph && window.storyMorph.local > 0.1 && window.storyMorph.local < 0.9", 10000, '过渡 4 进行中');
    const m2c = await t.evalJs("(() => { return { idx: window.storyMorph.idx, local: window.storyMorph.local }; })()");
    check('M 过渡段节奏一致（每段 0.6 屏，local 中间值）', m2c.idx === 3 && m2c.local > 0.1 && m2c.local < 0.9, 'idx=' + m2c.idx + ' local=' + m2c.local.toFixed(3));
    await t.evalJs("window.scrollTo(0, 0)");
    await sleep(400);

    console.log('── SR. ScrollReveal 标题入场（大房子起：严格序列入场 + scrub 可逆）──');
    await t.send('Page.reload');
    await waitFor(t, "document.querySelectorAll('.scene').length === 46", 20000, 'SR 前置刷新（回到未揭示态）');
    await waitFor(t, "document.querySelector('#scene-1') && document.querySelector('#scene-1').classList.contains('in')", 15000, '序章 .in');
    const sr0 = await t.evalJs("(() => { var t2 = document.querySelector('[data-scene=\"ch1-01\"] .scene-title');" +
      " var ws = t2 ? t2.querySelectorAll('.word') : []; var stage = document.querySelector('[data-scene=\"ch1-01\"] .scene-stage');" +
      " return { sr: t2 ? t2.classList.contains('sr-title') : false, n: ws.length, len: t2 ? t2.textContent.length : 0," +
      " op: ws.length ? parseFloat(getComputedStyle(ws[0]).opacity) : -1, tf: t2 ? t2.style.transform : null," +
      " stageOp: stage ? getComputedStyle(stage).opacity : null }; })()");
    const srB = await t.evalJs("(() => { var ms = document.querySelector('[data-scene=\"ch1-00\"]');" +
      " var nb = ms.nextElementSibling; var ch1 = document.querySelector('[data-scene=\"ch1-01\"]');" +
      " return { black: nb ? nb.classList.contains('scene-black') : false, after: nb && nb.nextElementSibling === ch1," +
      " h: nb ? Math.round(nb.getBoundingClientRect().height) : 0, vh: window.innerHeight, bg: nb ? getComputedStyle(nb).backgroundColor : null }; })()");
    check('SR 前置黑屏段：融变区后是纯黑段（≥1.5 屏）再接大房子', srB.black && srB.after && srB.h >= srB.vh * 1.5 && (srB.bg === 'rgb(0, 0, 0)'), 'h=' + srB.h + ' bg=' + srB.bg);
    const srC = await t.evalJs("(() => { var sc = document.querySelector('[data-scene=\"ch1-01\"]');" +
      " return { orbs: sc.querySelectorAll('.layer, .orb').length, bg: getComputedStyle(sc).backgroundColor }; })()");
    check('SR 大房子纯黑底：无光球装饰 + bg 纯黑', srC.orbs === 0 && srC.bg === 'rgb(0, 0, 0)', 'orbs=' + srC.orbs + ' bg=' + srC.bg);
    check('SR 拆分：大房子标题 .sr-title + 逐字数 = 原文字数', sr0.sr && sr0.n === sr0.len && sr0.n > 0, 'n=' + sr0.n + ' len=' + sr0.len);
    check('SR 屏下初始态：内容全暗（stage opacity 0）+ 字 0.1 + 3° 旋转', sr0.stageOp === '0' && sr0.op >= 0.05 && sr0.op <= 0.3 && sr0.tf && sr0.tf.indexOf('rotate(3') !== -1, 'stageOp=' + sr0.stageOp + ' op=' + sr0.op + ' tf=' + sr0.tf);
    // 场景到位（顶贴视口顶）时：仍应全暗（严格序列——前场景黑屏段还没出场）
    await t.evalJs("document.querySelector('[data-scene=\"ch1-01\"]').scrollIntoView({ block: 'start' })");
    await sleep(400);
    const srMid = await t.evalJs("(() => { var stage = document.querySelector('[data-scene=\"ch1-01\"] .scene-stage');" +
      " var ws = document.querySelectorAll('[data-scene=\"ch1-01\"] .word');" +
      " return { stageOp: getComputedStyle(stage).opacity, inCls: document.querySelector('[data-scene=\"ch1-01\"]').classList.contains('in'), op: ws.length ? parseFloat(getComputedStyle(ws[0]).opacity) : -1 }; })()");
    check('SR 序列门控：场景到位时仍全暗（等前场景出场）', srMid.stageOp === '0' && !srMid.inCls && srMid.op <= 0.3, 'stageOp=' + srMid.stageOp + ' op=' + srMid.op);
    // 前场景（黑屏段）出场后：大房子开始揭示
    await t.evalJs('window.scrollBy(0, 80)');
    await waitFor(t, "(() => { var ws = document.querySelectorAll('[data-scene=\"ch1-01\"] .word'); if (!ws.length) return false;" +
      " var o0 = parseFloat(getComputedStyle(ws[0]).opacity); return o0 > 0.2 && o0 < 0.9; })()", 10000, '大房子揭示进行中');
    const sr1a = await t.evalJs("(() => { var t2 = document.querySelector('[data-scene=\"ch1-01\"] .scene-title');" +
      " var ws = t2.querySelectorAll('.word'); var inC = document.querySelector('[data-scene=\"ch1-01\"]').classList.contains('in');" +
      " return { tf: t2.style.transform, op: parseFloat(getComputedStyle(ws[0]).opacity), inC: inC }; })()");
    check('SR 揭示进行中：入场触发 + 字部分点亮 + 旋转收窄', sr1a.inC && sr1a.op > 0.2 && sr1a.op < 0.9 && sr1a.tf.indexOf('rotate(1') !== -1, 'op=' + sr1a.op.toFixed(2) + ' tf=' + sr1a.tf);
    await t.evalJs('window.scrollBy(0, 120)');
    await waitFor(t, "(() => { var ws = document.querySelectorAll('[data-scene=\"ch1-01\"] .word'); if (!ws.length) return false;" +
      " for (var i = 0; i < ws.length; i++) { if (parseFloat(getComputedStyle(ws[i]).opacity) < 0.99) return false; } return true; })()", 10000, '大房子标题全亮');
    const sr1 = await t.evalJs("(() => { var t2 = document.querySelector('[data-scene=\"ch1-01\"] .scene-title');" +
      " var ws = t2.querySelectorAll('.word'); var b = getComputedStyle(ws[ws.length - 1]).filter;" +
      " return { tf: t2.style.transform, blur: b }; })()");
    check('SR 揭示完成：旋转归零 + 字全亮 blur 归零', /rotate\((-?0(\.0+)?)deg\)/.test(sr1.tf) && (sr1.blur === 'blur(0px)' || sr1.blur === 'none'), 'tf=' + sr1.tf + ' blur=' + sr1.blur);
    // 中间停留：继续滚 0.3 屏，内容仍 sticky 停在屏顶静止（200vh 场景的第一屏停留段）
    await t.evalJs('window.scrollBy(0, ' + Math.round(vhB * 0.3) + ')');
    await sleep(400);
    const srHold = await t.evalJs("(() => { var st = document.querySelector('[data-scene=\"ch1-01\"] .scene-stage');" +
      " var ws = document.querySelectorAll('[data-scene=\"ch1-01\"] .word'); var all = true;" +
      " for (var i = 0; i < ws.length; i++) { if (parseFloat(getComputedStyle(ws[i]).opacity) < 0.99) all = false; }" +
      " return { stageTop: Math.round(st.getBoundingClientRect().top), all: all }; })()");
    check('SR 中间停留：内容 sticky 停在屏顶静止 + 全亮', srHold.stageTop === 0 && srHold.all, 'stageTop=' + srHold.stageTop);
    await t.evalJs('window.scrollTo(0, 0)');
    await sleep(500);
    const sr2 = await t.evalJs("(() => { var ws = document.querySelectorAll('[data-scene=\"ch1-01\"] .word');" +
      " return { op: ws.length ? parseFloat(getComputedStyle(ws[0]).opacity) : -1 }; })()");
    check('SR 可逆：滚回顶部字回到 0.1 态', sr2.op >= 0.05 && sr2.op <= 0.3, 'op=' + sr2.op.toFixed(3));

    console.log('── G. ch4 事件页统一结构（5 事件 × 9 段）──');
    const g1 = await t.evalJs("(() => { var names = ['evt-background','evt-event','evt-actors','evt-conflict','evt-turning','evt-consequences','evt-perspectives','evt-philosophy','evt-related'];" +
      " var bad = []; for (var i = 0; i < names.length; i++) { if (document.querySelectorAll('.' + names[i]).length !== 5) bad.push(names[i] + '=' + document.querySelectorAll('.' + names[i]).length); }" +
      " var debates = document.querySelectorAll('.evt-perspectives .tag-debate').length;" +
      " return { bad: bad, debates: debates }; })()");
    check('G 每事件 evt-* 九段齐全（5 事件各 1）', g1.bad.length === 0, g1.bad.join(';') || '45 块');
    check('G 不同视角栏 Debate 标签（5 事件全有）', g1.debates === 5, 'debates=' + g1.debates);

    console.log('── FC. 「冷战」两字字体轮转（两字 fill 亮起才开转；硬切 0.2s 停最后一个；零滚动；用户口径）──');
    await t.evalJs("document.querySelector('[data-scene=\"ch4-05\"]').scrollIntoView({ block: 'start' }); window.scrollBy(0, Math.round(window.innerHeight * 0.26))");
    await waitFor(t, "document.querySelector('[data-scene=\"ch4-05\"]').classList.contains('in')", 10000, 'ch4-05 入场');
    const fc0 = await t.evalJs("(() => { var w = document.querySelector('[data-fc]');" +
      " var chars = w ? Array.prototype.map.call(w.querySelectorAll('.mw-fill'), function (e) { return e.textContent; }).join('') : '';" +
      " return { has: !!w, chars: chars, mw: w ? w.querySelectorAll('.mw').length : 0," +
      " probe: !!window.storyFontCycle, lineOn: w ? w.closest('.line').classList.contains('on') : false }; })()");
    check('FC 标记：行内 [data-fc] 包住「冷战」+ MagicText 拆字后 .mw×2 存活 + 探测口 + 行已 .on', fc0.has && fc0.chars === '冷战' && fc0.mw === 2 && fc0.probe && fc0.lineOn, 'chars=' + fc0.chars + ' mw=' + fc0.mw);
    // 行 2 全亮（q 窗口 0.45→0.9；滚 0.26 屏后 q=1.18）→「冷战」两字 fill 全亮 → 自动开转；此后零滚动输入
    await waitFor(t, "(() => { var w = document.querySelector('[data-fc]');" +
      " return /ZCOOL|Ma Shan|Zhi Mang/.test(getComputedStyle(w).fontFamily); })()", 12000, '冷战亮起后字体自动开始轮转（零滚动）');
    const fc1 = await t.evalJs("(() => { var w = document.querySelector('[data-fc]');" +
      " return { ff: getComputedStyle(w).fontFamily, op: parseFloat(getComputedStyle(w).opacity) }; })()");
    check('FC 自动轮转中：font-family 换为轮转字体 + 硬切无淡出（字恒可见 opacity 1）', /ZCOOL|Ma Shan|Zhi Mang/.test(fc1.ff) && fc1.op === 1, fc1.ff.slice(0, 60) + ' op=' + fc1.op);
    // 轮完直接停在最后一个字体（仍零滚动）
    await waitFor(t, "window.storyFontCycle.done === true && /Zhi Mang Xing/.test(getComputedStyle(document.querySelector('[data-fc]')).fontFamily)", 15000, '轮转完成停在最后一个字体');
    await sleep(500);
    const fc2 = await t.evalJs("(() => { var w = document.querySelector('[data-fc]');" +
      " return { ff: getComputedStyle(w).fontFamily }; })()");
    check('FC 轮完停在最后一个字体（Zhi Mang Xing + done 后 500ms 不再回默认）', /Zhi Mang Xing/.test(fc2.ff), fc2.ff.slice(0, 60));
    // reduced-motion：整体跳过（保持默认字体）
    await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await t.send('Page.reload');
    await waitFor(t, "document.querySelector('[data-fc]') && window.storyFontCycle && window.storyFontCycle.skipped === true", 20000, 'FCb reduced 刷新 + 跳过');
    const fcR = await t.evalJs("(() => { var w = document.querySelector('[data-fc]');" +
      " return { ff: w ? w.style.fontFamily : null }; })()");
    check('FC reduced-motion：轮转跳过（字体保持默认）', fcR.ff === '', 'style=' + fcR.ff);
    await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await sleep(400);

    console.log('── D. 移动端一测（390×844，wip 序章）──');
    await nav(t, BASE + '/story/wip');
    await waitFor(t, "document.querySelector('#scene-1') && document.querySelector('#scene-1').classList.contains('in')", 20000, 'wip 入场');
    await t.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(700);
    const d1 = await t.evalJs("(() => { var f = document.querySelector('#scene-1 .se-frame'); var r = f.getBoundingClientRect();" +
      " return { sw: document.scrollingElement.scrollWidth, cw: window.innerWidth, frameVis: r.width > 0 && r.height > 0 }; })()");
    check('D 390 宽无横向溢出', d1.sw <= d1.cw + 2, 'scrollW=' + d1.sw + ' innerW=' + d1.cw);
    check('D 序章卡片可见', d1.frameVis, 'frame rect');
    await t.send('Emulation.clearDeviceMetricsOverride');
    await sleep(400);

    console.log('── R. reduced-motion 路径（自主动画关 + 滚动展开保留 + wip 正文全显）──');
    await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await nav(t, BASE + '/story/index.html');
    await sleep(600);
    await t.evalJs('window.scrollTo(0, 0)');
    await sleep(500);
    const r1 = await t.evalJs("(() => { var f = document.querySelector('#scene-1 .se-frame'); return getComputedStyle(f).clipPath; })()");
    check('R reduced-motion：序章初始仍是小卡（展开为滚动驱动）', r1.indexOf('21%') !== -1, r1.slice(0, 40));
    await t.evalJs('window.scrollTo(0, 1250)');
    await sleep(500);
    const r2 = await t.evalJs("(() => { var c = getComputedStyle(document.querySelector('#scene-1 .se-frame')).clipPath; var m = /([\\d.]+)%/.exec(c); return m ? parseFloat(m[1]) : -1; })()");
    check('R reduced-motion：滚动后仍展开到全屏', r2 >= 0 && r2 < 0.5, 'first=' + r2);
    await nav(t, BASE + '/story/wip');
    await sleep(600);
    const r3 = await t.evalJs("(() => { var l = document.querySelector('[data-scene=\"ch1-01\"] .line');" +
      " var fl = l && l.querySelector('.mw-fill') ? l.querySelector('.mw-fill') : null;" +
      " return { lineOn: l ? l.classList.contains('on') : false, fill: fl ? getComputedStyle(fl).opacity : null }; })()");
    check('R reduced-motion：wip 正文直接可见（.on + fill 1）', r3.lineOn && parseFloat(r3.fill) >= 0.99, 'fill=' + r3.fill);
    await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await sleep(400);

    // 故事站段落 console error 快照（signup 测试属主站页面，另行口径）
    const storyErrCount = errs.length;
    check('I 故事站段落 0 console error', storyErrCount === 0, errs.slice(0, 3).join(' | ').slice(0, 220));

    console.log('── H. 注册成功跳转 story 子域（demo 模式 + frameRequestedNavigation 捕获）──');
    let navTarget = '';
    t.on('Page.frameRequestedNavigation', p => { if (!navTarget && p.url && p.url.indexOf('story.mnationworld.com') !== -1) navTarget = p.url; });
    await nav(t, BASE + '/signup-and-login.html');
    await waitFor(t, "document.getElementById('signupName') && document.getElementById('signupBtnLabel')", 20000, 'signup 表单就绪');
    await sleep(600);
    await t.evalJs("document.getElementById('signupName').value = '电池注册用户';" +
      " document.getElementById('signupEmail').value = 'battery@test.local';" +
      " document.getElementById('signupPassword').value = 'password123';" +
      " document.getElementById('termsAgree').checked = true;");
    await t.evalJs("document.querySelector('button[onclick=\"handleSignup()\"]').click()");
    const hT0 = Date.now();
    while (!navTarget && Date.now() - hT0 < 8000) await sleep(150);
    check('H 注册成功 → https://story.mnationworld.com/wip（导航捕获）', navTarget.indexOf('https://story.mnationworld.com/wip') === 0, navTarget || '(未捕获)');
  }

  // ──────────────────────────────────────────────
  // 线上 LIVE：index + wip 抽验 + 主站交叉
  // ──────────────────────────────────────────────
  async function runLive(t) {
    console.log('── L. 线上故事站（' + BASE + '）──');
    // / 跳转 → /wip（一个链接多用）
    await nav(t, BASE + '/');
    await waitFor(t, "window.location.pathname.indexOf('/wip') !== -1", 30000, '/ 跳转 wip');
    await waitFor(t, "document.querySelectorAll('.scene').length === 46", 30000, 'wip 46 场景');
    const l1 = await t.evalJs("(() => { var v = document.querySelector('meta[name=\"story-version\"]'); var tp = document.querySelector('meta[name=\"story-topic\"]');" +
      " var im = document.querySelector('#scene-1 .se-img'); var cta = document.querySelector('.story-cta');" +
      " return { title: document.title, ver: v ? v.content : null, topic: tp ? tp.content : null," +
      " img: !!im, heroes: document.querySelectorAll('.scene-hero').length, cta: cta ? cta.getAttribute('href') : null }; })()");
    check('L wip title/meta/story-all/46 场景/媒体图/7 大标题/尾声 CTA', l1.title === '政治启蒙 · 完整故事｜M.NationWorld' && l1.ver === 'v0.2.26.0' && l1.topic === 'story-all' && l1.img && l1.heroes === 7 && l1.cta === 'https://mnationworld.com/pages/onboarding-identity.html', l1.title);
    check('L 访客零 /api 请求', apiCalls === 0, 'n=' + apiCalls);
    console.log('── L. 主站交叉（overview Story 卡 + 版本）──');
    await nav(t, 'https://mnationworld.com/pages/overview.html');
    await waitFor(t, 'window.MN_SITE_VERSION', 30000, '主站 site-config 就绪');
    const l3 = await t.evalJs("(() => { var a = document.querySelector('a[href=\"https://story.mnationworld.com/wip\"]');" +
      " return { ver: window.MN_SITE_VERSION, card: !!a }; })()");
    check('L 主站版本 v0.2.26.0 + overview Story 卡 → /wip', l3.ver === 'v0.2.26.0' && l3.card, 'ver=' + l3.ver + ' card=' + l3.card);
    check('L 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | ').slice(0, 220));
  }
}

main().catch(e => { console.error('电池异常：', e.message); process.exit(1); });
