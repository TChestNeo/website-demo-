// tmp-nav-area-dump.js — 一次性侦查 v4：导航模块区域零阈值全量转储（v0.2.28.12 轮）
// （2026-09-10 用户「在 Home 和 MicroNationary 菜单项的背后出现异常长方形白色/浅色亮光块，
//   疑似残余内边框/旧选中背景/伪元素没清干净」——上一版扫描阈值 L≥45 可能漏掉 30-44 的浅色块；
//   本探针零阈值：nav-module 子树（含 ::before/::after、lg-backdrop/lg-specular 注入层）+
//   与 y∈[300,470] x∈[0,300] 相交的所有元素，完整转储 bg/bgimg/border/boxShadow/filter/opacity）
// 跑法：node tmp-nav-area-dump.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4400 + Math.floor(Math.random() * 300);
const CDP_PORT = 5400 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-navdump-' + Date.now());

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
    for (const pagePath of ['/index.html', '/pages/community-hub.html']) {
      await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + pagePath });
      await waitFor(cdp, "document.getElementById('slati-sidebar') && document.getElementById('slati-sidebar').innerHTML.length > 0", 10000, pagePath + ' 侧栏渲染');
      await cdp.evalJs(`(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        try { localStorage.setItem('slati_settings', JSON.stringify({ theme: 'dark' })); } catch (e) {}
      })()`);
      await sleep(800);

      const dump = await cdp.evalJs(`(() => {
        const styles = (el, pseudo) => {
          const cs = getComputedStyle(el, pseudo || null);
          return {
            bg: cs.backgroundColor, bgimg: cs.backgroundImage, bgpos: cs.backgroundPosition, bgsize: cs.backgroundSize,
            border: cs.border, br: cs.borderRadius,
            shadow: cs.boxShadow, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
            filter: cs.filter, backdrop: cs.backdropFilter, opacity: cs.opacity, z: cs.zIndex, pos: cs.position
          };
        };
        const out = [];
        const dumpEl = (el, label) => {
          const rect = el.getBoundingClientRect();
          const row = {
            label: label,
            x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height),
            tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 70),
            inline: (el.getAttribute('style') || '').slice(0, 100),
            main: styles(el, null),
            before: null, after: null
          };
          const b = styles(el, '::before');
          const a = styles(el, '::after');
          // 伪元素只在确有内容/样式时保留（content:none 的 getComputedStyle 会返回空样）
          if (b.content && b.content !== 'none') row.before = b;
          if (a.content && a.content !== 'none') row.after = a;
          out.push(row);
        };
        // A) nav-module 子树（含注入层）+ 模块本身
        const navMod = document.querySelector('#slati-sidebar .nav-module');
        if (navMod) {
          dumpEl(navMod, 'nav-module');
          navMod.querySelectorAll('*').forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return;
            dumpEl(el, '  · ' + (el.tagName.toLowerCase() === 'div' && el.className === '' ? 'div(anonymous)' : el.tagName.toLowerCase()));
          });
        }
        // B) 与 y∈[290,480] x∈[0,310] 相交的所有元素（防亮块在模块外/侧栏透明透出）
        const region = [];
        document.querySelectorAll('body *').forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          if (!(rect.left < 310 && rect.right > 0 && rect.top < 480 && rect.bottom > 290)) return;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          if (navMod && navMod.contains(el)) return; // A 已覆盖
          region.push(el);
        });
        region.forEach((el) => dumpEl(el, 'REGION'));
        // C) 关键 CSS 变量值
        const vars = {};
        const r = document.documentElement;
        ['--sidebar-bg', '--card-bg', '--card-border', '--shadow-md', '--lg-bg'].forEach((v) => {
          vars[v] = getComputedStyle(r).getPropertyValue(v).trim();
        });
        return JSON.stringify({ page: location.pathname, vars: vars, items: out });
      })()`);
      const res = JSON.parse(dump);
      console.log('\\n================ ' + pagePath + ' ================');
      console.log('CSS 变量:', JSON.stringify(res.vars, null, 1));
      res.items.forEach((it) => {
        console.log('[' + it.x + ',' + it.y + ' ' + it.w + '×' + it.h + '] ' + it.label + ' <' + it.tag + ' class="' + it.cls + '">' + (it.inline ? ' inline=' + it.inline : ''));
        const p = it.main;
        console.log('    bg=' + p.bg + ' bgimg=' + p.bgimg.slice(0, 110) + ' bgpos=' + p.bgpos + ' bgsize=' + p.bgsize);
        console.log('    border=' + p.border + ' br=' + p.br + ' shadow=' + p.shadow);
        console.log('    outline=' + p.outline + ' filter=' + p.filter + ' backdrop=' + p.backdrop + ' opacity=' + p.opacity + ' z=' + p.z + ' pos=' + p.pos);
        if (it.before) console.log('    ::before content=' + it.before.content + ' bg=' + it.before.bg + ' bgimg=' + it.before.bgimg.slice(0, 80) + ' border=' + it.before.border + ' shadow=' + it.before.shadow);
        if (it.after) console.log('    ::after  content=' + it.after.content + ' bg=' + it.after.bg + ' bgimg=' + it.after.bgimg.slice(0, 80) + ' border=' + it.after.border + ' shadow=' + it.after.shadow);
      });
    }
  } catch (e) {
    console.error('ERR', e);
  } finally {
    cdp.close();
    chrome.kill();
    server.close();
    process.exit(0);
  }
})();
