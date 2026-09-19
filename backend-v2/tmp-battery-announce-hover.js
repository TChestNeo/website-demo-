// tmp-battery-announce-hover.js — v0.2.10.0 Announcements 邻近上浮电池（2026-09-03）
// 用户：「平台首页下方的那个Announcements 的每一项增加一个特性就是当鼠标靠近时在范围内的都会上浮」。
// 断言口径：读 inline style.transform 目标值（transition 0.18s 进行中的 computed 值有竞态，house 教训——
//   药丸断言踩 0.15s transition 竞态）。鼠标用 CDP Input.dispatchMouseEvent 真输入（mouseleave 派生事件靠真鼠标状态）。
// 跑法：node tmp-battery-announce-hover.js（LIVE_BASE=<完整站点 URL> 跑线上）
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

// ── 静态壳（docs/ 原样；/api 全 404 → demo 模式零请求） ──
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
  const errs = [];
  t.on('Runtime.exceptionThrown', p => {
    const d = (p.exceptionDetails.exception && p.exceptionDetails.exception.description) || 'exc';
    if (d.indexOf('data:') === -1) errs.push(d);
  });
  t.on('Log.entryAdded', p => {
    if (p.entry.level === 'error' && p.entry.url && p.entry.url.indexOf('/api/') === -1 &&
        p.entry.url.indexOf('data:') === -1 && p.entry.url.indexOf('favicon') === -1) errs.push(p.entry.text);
  });
  await t.send('Log.enable');

  async function seedAndBoot() {
    await nav(t, BASE + '/');
    await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true }))");
    await nav(t, BASE + '/');
    await waitFor(t, "document.querySelectorAll('#dashAnnouncements .card').length >= 10", 15000, 'announcements boot');
  }
  // transitions.js 入场 stagger 会迟到给卡写 inline transform（实测 ~3s 后仍有余项 18px）——
  // 等全部落到入场终值再动鼠标，否则 rect 缓存被 translateY(18px) 污染、复位被迟到写覆写
  async function waitEntrance() {
    await waitFor(t,
      "Array.prototype.every.call(document.querySelectorAll('#dashAnnouncements .card'), function(el){ return el.style.transform === 'translateY(0px) translateX(0px)'; })",
      20000, 'entrance settle');
  }
  const liftOf = v => { const m = /translateY\((-?[\d.]+)px\)/.exec(v); return m ? parseFloat(m[1]) : 0; };
  const flatVals = v => (v === '' || liftOf(v) >= 0);
  const readTf = () => t.evalJs(
    "Array.prototype.map.call(document.querySelectorAll('#dashAnnouncements .card'), function(el){ return el.style.transform; })");
  const center = async i => {
    const v = await t.evalJs("(() => { const el = document.querySelectorAll('#dashAnnouncements .card')[" + i + "];" +
      " const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()");
    return v;
  };
  const move = async (x, y) => {
    await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await sleep(80);
  };

  console.log('── B. Announcements 邻近上浮 ──');
  await seedAndBoot();
  await waitEntrance();

  // B1 版本 + 10 项
  const ver = await t.evalJs('window.MN_SITE_VERSION');
  const cnt = await t.evalJs("document.querySelectorAll('#dashAnnouncements .card').length");
  check('B1 版本 v0.2.10.0 / 10 项公告卡', ver === 'v0.2.10.0' && cnt === 10, 'ver=' + ver + ' n=' + cnt);

  // B2 常驻过渡规则生效且压过入场 inline transition（transitionProperty 含 transform 且时长 0.18s）
  const tp = await t.evalJs("getComputedStyle(document.querySelectorAll('#dashAnnouncements .card')[0]).transitionProperty");
  const td = await t.evalJs("getComputedStyle(document.querySelectorAll('#dashAnnouncements .card')[0]).transitionDuration");
  check('B2 过渡规则 !important 压过入场 inline（transform 0.18s）',
    typeof tp === 'string' && tp.indexOf('transform') !== -1 && String(td).indexOf('0.18s') !== -1,
    tp + ' / ' + td);

  // B3 初始全平（入场终值 translateY(0)）
  const init = await readTf();
  check('B3 初始全平无上浮', init.length === 10 && init.every(flatVals), JSON.stringify(init));

  // B4 移到第 0 项中心 → 该项上浮到顶、邻项在范围内、第 9 项（~360px 外）不动
  await t.evalJs("document.getElementById('dashAnnouncements').scrollIntoView({block:'center'})");
  await sleep(250);
  const c0 = await center(0);
  await move(c0.x, c0.y);
  const m0 = await readTf();
  check('B4 悬停项上浮到顶（≤-9.5px）', liftOf(m0[0]) <= -9.5, m0[0]);
  check('B4 邻项范围内也上浮', liftOf(m0[1]) <= -2, m0[1]);
  check('B4 范围外第 9 项不动', flatVals(m0[9]), m0[9]);

  // B5 移出左侧列（右列内、y 夹在视口内）→ mouseleave 全重置
  const zr = await t.evalJs("(() => { const r = document.getElementById('dashAnnouncements').parentElement.getBoundingClientRect(); return { r: r.right, t: r.top }; })()");
  await move(Math.min(zr.r + 120, 1240), Math.max(80, Math.min(820, zr.t + 60)));
  const m1 = await readTf();
  check('B5 移出列全重置', m1.every(flatVals), JSON.stringify(m1));

  // B6 重进：移到第 4 项中心 → 该项上浮到顶、第 9 项（距第 4 项 ~200px 在范围内）轻微上浮=梯度正确
  const c4 = await center(4);
  await move(c4.x, c4.y);
  const m2 = await readTf();
  check('B6 重进第 4 项到顶 / 第 9 项轻微上浮（梯度）',
    liftOf(m2[4]) <= -9.5 && liftOf(m2[9]) < -0.1 && liftOf(m2[9]) > -2, 'm4=' + m2[4] + ' m9=' + m2[9]);

  // B7 reduced-motion：全静（emulate 后重载，移动鼠标无上浮）
  await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await nav(t, BASE + '/');
  await waitFor(t, "document.querySelectorAll('#dashAnnouncements .card').length >= 10", 15000, 'reduced boot');
  await waitEntrance();
  await t.evalJs("document.getElementById('dashAnnouncements').scrollIntoView({block:'center'})");
  await sleep(250);
  const c0b = await center(0);
  await move(c0b.x, c0b.y);
  const m3 = await readTf();
  check('B7 reduced-motion 全静', m3.every(flatVals), JSON.stringify(m3));
  await t.send('Emulation.setEmulatedMedia', { features: [] });

  check('B8 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + pass.length + ' ✅ / ' + fail.length + ' ❌');
  t.close();
  chrome.kill();
  process.exit(fail.length ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
