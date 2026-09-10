// tmp-sidebar-strip-scan.js — 一次性侦查 v3：左侧整条区域几何扫描（v0.2.28.12 轮）
// （2026-09-10 用户「没有啊还是阴影在啊 在平台左侧的根菜单那边」——v0.2.28.11 修了访客按钮
//   仍亮；本探针不再只扫 #slati-sidebar 子孙，而是按几何坐标扫 x<400 全可见元素——
//   含侧栏容器本身（旧版 querySelectorAll('*') 不含根）、固定装饰层、玻璃注入层；
//   亮度改用「合成亮度」（颜色按 alpha 混在暗底 #1a1a2e 上）防白 0.05 误报；
//   另转储侧栏容器/body/html 原始背景 + 左侧条带 3 个探针点的实际堆叠，判「侧栏透明」假说）
// 跑法：node tmp-sidebar-strip-scan.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4400 + Math.floor(Math.random() * 300);
const CDP_PORT = 5400 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-stripscan-' + Date.now());

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
      // 暗色：加载后手动强制（预置脚本会被 theme-init 覆盖——上一版实证 theme=light）
      await cdp.evalJs(`(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        try { localStorage.setItem('slati_settings', JSON.stringify({ theme: 'dark' })); } catch (e) {}
      })()`);
      await sleep(800); // 玻璃引擎注入层 + 主题规则落地
      const themeNow = await cdp.evalJs(`document.documentElement.getAttribute('data-theme')`);
      if (themeNow !== 'dark') throw new Error(pagePath + ' 暗色未生效: ' + themeNow);
      console.log(pagePath + ' 暗色已强制 (data-theme=' + themeNow + ')');

      const scan = await cdp.evalJs(`(() => {
        const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
        // 合成亮度：颜色按 alpha 混在暗底 #1a1a2e(26,26,46) 上
        const compLum = (c) => {
          const a = c.a === undefined ? 1 : c.a;
          const r = c.r * a + 26 * (1 - a), g = c.g * a + 26 * (1 - a), b = c.b * a + 46 * (1 - a);
          return Math.round(lum(r, g, b) * 10) / 10;
        };
        const colors = (s) => {
          const list = [];
          const re = /rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/g;
          let m;
          while ((m = re.exec(s))) list.push({ r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] });
          return list;
        };
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
        const probe = (el, pseudo) => {
          const cs = getComputedStyle(el, pseudo || null);
          const hits = [];
          const bc = colors(cs.backgroundColor)[0];
          if (bc && bc.a > 0 && compLum(bc) >= 45) hits.push('bg:' + cs.backgroundColor + ' L=' + compLum(bc));
          if (cs.backgroundImage && cs.backgroundImage !== 'none') {
            const im = colors(cs.backgroundImage);
            let maxL = -1;
            im.forEach((c) => { const l = compLum(c); if (l > maxL) maxL = l; });
            if (maxL >= 45) hits.push('bgimg:' + cs.backgroundImage.slice(0, 90) + ' Lmax=' + Math.round(maxL * 10) / 10);
          }
          shadowLayers(cs.boxShadow).forEach((ly) => {
            ly.colors.forEach((c) => {
              const l = compLum(c);
              if (c.a >= 0.03 && l >= 45) hits.push((ly.inset ? 'INSET[' : 'shadow[') + ly.raw.slice(0, 70) + '] L=' + l);
            });
          });
          ['top', 'right', 'bottom', 'left'].forEach((side) => {
            const w = parseFloat(cs['border-' + side + '-width']) || 0;
            if (w > 0) {
              const c = colors(cs['border-' + side + '-color'])[0];
              if (c && c.a > 0 && compLum(c) >= 45) hits.push('border-' + side + ':' + w + 'px ' + cs['border-' + side + '-color'] + ' L=' + compLum(c));
            }
          });
          if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) {
            const c = colors(cs.outlineColor)[0];
            if (c && c.a > 0 && compLum(c) >= 45) hits.push('outline:' + cs.outlineWidth + ' ' + cs.outlineColor + ' L=' + compLum(c));
          }
          return hits;
        };

        const hits = [];
        const seen = new Set();
        const all = [document.documentElement, document.body].concat(Array.from(document.querySelectorAll('body *')));
        all.forEach((el) => {
          if (seen.has(el)) return; seen.add(el);
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          if (rect.left >= 400 || rect.right <= 0) return; // 只扫左侧条带
          if (rect.bottom <= 0 || rect.top >= window.innerHeight) return; // 视口内
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
          const main = probe(el, null);
          const before = probe(el, '::before');
          const after = probe(el, '::after');
          if (main.length || before.length || after.length) {
            hits.push({
              x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height),
              tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 60),
              pos: cs.position, z: cs.zIndex, area: Math.round(rect.width * rect.height),
              main: main, before: before, after: after
            });
          }
        });
        hits.sort((a, b) => b.area - a.area);

        // 侧栏容器 + body + html 原始计算值（不设阈值，全量转储）
        const sb = document.getElementById('slati-sidebar');
        const raw = (el) => el ? {
          tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 60),
          bg: getComputedStyle(el).backgroundColor, bgimg: getComputedStyle(el).backgroundImage.slice(0, 120),
          border: getComputedStyle(el).border, boxShadow: getComputedStyle(el).boxShadow,
          backdrop: getComputedStyle(el).backdropFilter
        } : null;

        // 左侧条带 3 个探针点：实际堆叠最顶元素（判「侧栏透明、页面背景透出」假说）
        const points = [];
        [60, 300, 700].forEach((y) => {
          let chain = [];
          let el = document.elementFromPoint(150, y);
          let guard = 0;
          while (el && guard < 6) {
            const cs = getComputedStyle(el);
            chain.push({
              t: el.tagName.toLowerCase(), c: String(el.className || '').slice(0, 40),
              bg: cs.backgroundColor, bgimg: cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 60) : '',
              z: cs.zIndex
            });
            el = el.parentElement; guard++;
          }
          points.push({ y: y, chain: chain });
        });

        return JSON.stringify({
          theme: document.documentElement.getAttribute('data-theme'),
          sidebarRaw: raw(sb),
          bodyRaw: raw(document.body),
          htmlRaw: raw(document.documentElement),
          points: points,
          hitCount: hits.length,
          hits: hits.slice(0, 45)
        });
      })()`);
      const res = JSON.parse(scan);
      console.log('\\n================ ' + pagePath + ' ================');
      console.log('theme =', res.theme);
      console.log('--- 原始计算值（无阈值）---');
      ['sidebarRaw', 'bodyRaw', 'htmlRaw'].forEach((k) => {
        if (!res[k]) { console.log(k + ': (无此元素)'); return; }
        console.log(k + ' <' + res[k].tag + ' class="' + res[k].cls + '">');
        console.log('    bg=' + res[k].bg + '  bgimg=' + res[k].bgimg);
        console.log('    border=' + res[k].border + '  boxShadow=' + res[k].boxShadow + '  backdrop=' + res[k].backdrop);
      });
      console.log('--- 左侧条带探针点堆叠 ---');
      res.points.forEach((p) => {
        console.log('y=' + p.y + ': ' + p.chain.map((c) => '<' + c.t + ' class="' + c.c + '" bg=' + c.bg + (c.bgimg ? ' img=' + c.bgimg : '') + ' z=' + c.z + '>').join(' ← '));
      });
      console.log('--- 亮色命中（合成亮度 L≥45，按面积降序，共 ' + res.hitCount + ' 条取前 45）---');
      if (!res.hits.length) console.log('（无）');
      res.hits.forEach((e) => {
        console.log('[' + e.x + ',' + e.y + ' ' + e.w + '×' + e.h + ' 面积' + e.area + '] <' + e.tag + ' class="' + e.cls + '" pos=' + e.pos + ' z=' + e.z + '>');
        e.main.forEach((h) => console.log('    ' + h));
        e.before.forEach((h) => console.log('    ::before ' + h));
        e.after.forEach((h) => console.log('    ::after  ' + h));
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
