// tmp-sidebar-shadow-scan.js — 一次性侦查 v2：暗色模式下左侧栏「亮色元素」全维扫描
// （2026-09-10 用户「还是一样有啊，那个东西会不会是向内的阴影导致的」——v0.2.28.10 只改了
//   user-banner 背景但仍亮；本探针升级：box-shadow 逐层解析（含 inset）、边框、伪元素全测，
//   原 tmp-sidebar-scan.js 只测了背景色/背景图——内阴影是盲区）
// 跑法：node tmp-sidebar-shadow-scan.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4400 + Math.floor(Math.random() * 300);
const CDP_PORT = 5400 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-shadscan-' + Date.now());

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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
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

(async () => {
  await new Promise(r => server.listen(PORT, r));

  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!up) throw new Error('CDP 没起来');
  const pageInfo = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' })).json();
  const cdp = new CDP(pageInfo.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  try {
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/community-hub.html' });
    await waitFor(cdp, "document.getElementById('slati-sidebar') && document.getElementById('slati-sidebar').innerHTML.length > 0", 10000, '侧栏渲染');
    await cdp.evalJs(`(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('slati_settings', JSON.stringify({ theme: 'dark' })); } catch (e) {}
    })()`);
    await sleep(600);

    const scan = await cdp.evalJs(`(() => {
      const out = [];
      const root = document.getElementById('slati-sidebar');
      const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const colors = (s) => {
        const list = [];
        const re = /rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/g;
        let m;
        while ((m = re.exec(s))) list.push({ r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] });
        return list;
      };
      // box-shadow 分层解析：顶层逗号切层（括号深度 0 才算层边界——
      //   Chrome 151 序列化颜色在前「rgba(70, 72, 212, 0.25) 0px 4px 16px」，
      //   色值内逗号后跟数字，正则按「逗号+数字」切层会把色值切碎导致全层漏报）
      const splitTop = (s) => {
        const parts = [];
        let depth = 0, cur = '';
        for (const ch of s) {
          if (ch === '(') depth++;
          if (ch === ')') depth--;
          if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
          cur += ch;
        }
        if (cur.trim()) parts.push(cur);
        return parts;
      };
      const shadowLayers = (s) => {
        if (!s || s === 'none') return [];
        return splitTop(s).map((layer) => {
          const t = layer.trim();
          const inset = t.indexOf('inset') !== -1;
          const cs = colors(t);
          return { raw: t, inset: inset, colors: cs };
        });
      };
      const elName = (el) => '<' + el.tagName.toLowerCase() + ' class="' + ((el.className && String(el.className).slice(0, 50)) || '') + '">';

      root.querySelectorAll('*').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const css = (pseudo) => {
          const cs = getComputedStyle(el, pseudo || null);
          const hits = [];
          // 1) 背景
          const bgc = colors(cs.backgroundColor)[0];
          if (bgc && bgc.a > 0 && lum(bgc.r, bgc.g, bgc.b) >= 40) hits.push('bg:' + cs.backgroundColor);
          if (cs.backgroundImage && cs.backgroundImage !== 'none') {
            const im = colors(cs.backgroundImage);
            const bl = im.length ? Math.max.apply(null, im.map((c) => lum(c.r, c.g, c.b))) : -1;
            if (bl >= 40) hits.push('bgimg:' + cs.backgroundImage.slice(0, 80));
          }
          // 2) box-shadow 逐层（含 inset）
          shadowLayers(cs.boxShadow).forEach((ly) => {
            ly.colors.forEach((c) => {
              const l = lum(c.r, c.g, c.b);
              if (ly.inset && c.a >= 0.04 && l >= 40) hits.push('INSET[' + ly.raw.slice(0, 60) + ']');
              else if (!ly.inset && c.a >= 0.1 && l >= 55) hits.push('shadow[' + ly.raw.slice(0, 60) + ']');
            });
          });
          // 3) 边框（每边）
          ['top', 'right', 'bottom', 'left'].forEach((side) => {
            const w = parseFloat(cs['border-' + side + '-width']) || 0;
            if (w > 0) {
              const c = colors(cs['border-' + side + '-color'])[0];
              if (c && c.a > 0 && lum(c.r, c.g, c.b) >= 40) hits.push('border-' + side + ':' + w + 'px ' + cs['border-' + side + '-color']);
            }
          });
          // 4) outline（须 style≠none 才算可见——宽/色在 outline:none 时仍有计算值，只看宽会误报）
          if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) {
            const c = colors(cs.outlineColor)[0];
            if (c && c.a > 0 && lum(c.r, c.g, c.b) >= 40) hits.push('outline:' + cs.outlineWidth + ' ' + cs.outlineColor);
          }
          return hits;
        };
        const main = css(null);
        const before = css('::before');
        const after = css('::after');
        if (main.length || before.length || after.length) {
          out.push({
            w: Math.round(rect.width), h: Math.round(rect.height),
            tag: el.tagName.toLowerCase(), cls: (el.className && String(el.className).slice(0, 50)) || '',
            main: main, before: before.length ? before : [], after: after.length ? after : []
          });
        }
      });
      return JSON.stringify({
        loggedIn: !!(window.SlatiDB && SlatiDB.isLoggedIn && SlatiDB.isLoggedIn()),
        hasSlatiDB: !!window.SlatiDB,
        htmlClasses: document.documentElement.className,
        hits: out
      });
    })()`);
    const res = JSON.parse(scan);
    console.log('登录态:', res.hasSlatiDB ? (res.loggedIn ? '已登录' : '未登录（访客模块）') : '无 SlatiDB（访客模块）');
    console.log('html classes =', res.htmlClasses);
    console.log('--- 侧栏内所有亮色源（背景 / 阴影含 INSET / 边框 / 伪元素）---');
    if (!res.hits.length) console.log('（无）');
    res.hits.forEach((e) => {
      console.log('[' + e.w + '×' + e.h + '] <' + e.tag + ' class="' + e.cls + '">');
      e.main.forEach((h) => console.log('    ' + h));
      e.before.forEach((h) => console.log('    ::before ' + h));
      e.after.forEach((h) => console.log('    ::after  ' + h));
    });
  } catch (e) {
    console.error('ERR', e);
  } finally {
    cdp.close();
    chrome.kill();
    server.close();
    process.exit(0);
  }
})();
