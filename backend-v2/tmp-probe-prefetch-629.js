// tmp-probe-prefetch-629.js — v0.2.58.23 悬停预加载线上探针（mnationworld.com）
//   S1 静态锚（live transitions.js 预取块件 rel/as/function prefetchPage/prefetchDone ×2/clearTimeout(prefetchTimer) ×2/
//   prefetchTimer ×4/(hover: hover)/saveData/, 65)/{ once: true }/mouseover ×1/click 劫持 ×1+动画常量零触碰
//   STAGGER_DELAY = 60/LIGHT_STAGGER_DELAY = 40/STAGGER_CAP = 8 各 ×1；site-config 58.23/48.0+changelog 标题 58.23+
//   rev 终态口径（00342- 前缀 ×1+00342-XXX 零残留+00343-??? ×1+00340-wgj/00341-hbw 保留））
//   → P1 CDP guest 真实悬停 a[href="pages/explore.html"] ≥400ms → 恰 1 link[rel=prefetch] href/as 精确+不跳页
//   → E1 零异常。
// 口径：live 文本滞后一部署=惯例——探针跑在 deploy#2 之后（二次烘焙镜像=当前线上）。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SITE = 'https://mnationworld.com';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-prefetch-' + Date.now());
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

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
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        this.errs.push(JSON.stringify({ text: m.params.entry.text, url: m.params.entry.url || '' }).slice(0, 200));
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

(async () => {
  console.log('═══ S1 静态锚（live transitions.js+site-config）═══');
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  const tr = await fetch(SITE + '/assets/js/transitions.js');
  const trSrc = norm(await tr.text());
  const trc = mk(trSrc);
  ok('S1a live transitions.js 预取块件（l.rel = prefetch ×1+l.as = document ×1+function prefetchPage ×1+prefetchDone ×2+clearTimeout(prefetchTimer) ×2+prefetchTimer ×4+(hover: hover) ×1+saveData ×1+", 65)" ×1+{ once: true } ×1+mouseover 监听 ×1+click 劫持保留 ×1）',
    trc("l.rel = 'prefetch'") === 1 && trc("l.as = 'document'") === 1 && trc('function prefetchPage') === 1 &&
    trc('prefetchDone') === 2 && trc('clearTimeout(prefetchTimer)') === 2 && trc('prefetchTimer') === 4 &&
    trc('(hover: hover)') === 1 && trc('saveData') === 1 && trc(', 65)') === 1 && trc('{ once: true }') === 1 &&
    trc("addEventListener('mouseover'") === 1 && trc("addEventListener('click'") === 1,
    'pf=' + trc("l.rel = 'prefetch'") + ' done=' + trc('prefetchDone') + ' timer=' + trc('prefetchTimer') +
    ' hover=' + trc('(hover: hover)') + ' click=' + trc("addEventListener('click'"));
  ok('S1b live transitions.js 动画常量零触碰（STAGGER_DELAY = 60+LIGHT_STAGGER_DELAY = 40+STAGGER_CAP = 8 各 ×1）',
    trc('STAGGER_DELAY = 60') === 1 && trc('LIGHT_STAGGER_DELAY = 40') === 1 && trc('STAGGER_CAP = 8') === 1,
    'd60=' + trc('STAGGER_DELAY = 60') + ' d40=' + trc('LIGHT_STAGGER_DELAY = 40') + ' cap8=' + trc('STAGGER_CAP = 8'));

  const sc = await fetch(SITE + '/assets/js/site-config.js');
  const scSrc = norm(await sc.text());
  const scCount = mk(scSrc);
  ok('S1c site-config：58.23/48.0 赋值在位 + 58.22 赋值零残留 + 58.23 changelog 标题 + FC 48.0 标题',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.23';") === 1 && scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") === 1 &&
    scCount("window.MN_SITE_VERSION = 'v0.2.58.22';") === 0 && scCount('// v0.2.58.23 = ') === 1 &&
    scCount('// v10.28.48.0 = ') === 1,
    'v58.23=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.23';") + ' fc48=' +
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") + ' v58.22=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.22';") +
    ' cl=' + scCount('// v0.2.58.23 = '));
  ok('S1d site-config rev 终态口径：00342- 前缀 ×1（真值已填）+ 00342-XXX 零残留 + 00343-??? 占位 ×1 + 58.22 条目 00340-wgj/00341-hbw 保留',
    scCount('00342-') === 1 && scCount('00342-XXX') === 0 && scCount('00343-???') === 1 &&
    scCount('00340-wgj') === 1 && scCount('00341-hbw') === 1,
    'r42=' + scCount('00342-') + ' x42=' + scCount('00342-XXX') + ' q43=' + scCount('00343-???') +
    ' r40=' + scCount('00340-wgj') + ' r41=' + scCount('00341-hbw'));

  console.log('═══ P1 CDP guest 真实悬停内链 → 预取 link 注入（不跳页）═══');
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const pageTab = pages.find(x => x.type === 'page');
    const cdp = new CDP(pageTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Page.navigate', { url: SITE + '/index.html' });
    await waitFor(cdp, "document.querySelector('a[href=\"pages/explore.html\"]')", 60000, 'P1 站内链接');
    await sleep(1200);
    const href0 = await cdp.evalJs('window.location.href');
    // 悬停第一可见 explore 链接（58.15 教训：先 move(5,5) 再目标中心）
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    const r = await cdp.evalJs("(function(){ var els = document.querySelectorAll('a[href=\"pages/explore.html\"]'); for (var i = 0; i < els.length; i++) { var b = els[i].getBoundingClientRect(); if (b.width > 0 && b.height > 0) return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; } return null; })()");
    if (!r) throw new Error('P1 无可见 explore 链接');
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
    await sleep(500);
    const p1 = await cdp.evalJs("(function(){ var ls = document.head.querySelectorAll('link[rel=\"prefetch\"]'); var out = []; for (var i = 0; i < ls.length; i++) out.push({ href: ls[i].getAttribute('href'), as: ls[i].getAttribute('as') }); return out; })()");
    ok('P1 真实悬停 explore 链接 500ms：恰 1 link[rel=prefetch] + href="pages/explore.html" + as="document"（预取真实注入）',
      p1.length === 1 && p1[0].href === 'pages/explore.html' && p1[0].as === 'document', JSON.stringify(p1));
    ok('P1 悬停不跳页（location 不变——预取纯后台零导航）',
      (await cdp.evalJs('window.location.href')) === href0,
      'href0=' + href0.slice(0, 60) + ' now=' + (await cdp.evalJs('window.location.href')).slice(0, 60));

    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|Failed to load resource|\/api\/|404|429|analytics|pageview|mnationworld/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 控制台零错误（噪声已滤）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}

  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  process.exit(fail === 0 ? 0 : 1);
})();
