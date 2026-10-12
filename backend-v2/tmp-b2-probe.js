// tmp-b2-probe.js — v0.2.54.0 B2 五页联合冒烟探针（一次性验收）
// 面：de-DE 浏览器自动选 × 5 页（期望值=各页字典 de 值，机制断言零硬编码德语）
//     + zh 回落 + 零 JS 错误（过滤 favicon+/api/ 404）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-i18n-b2-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};

// 载入 5 页字典（de/zh 双值），复用 hant 脚本同款 stub
const dicts = {};
for (const f of ['about', 'terms', 'privacy', 'edge', 'premium']) {
  const d = { de: {}, zh: {} };
  const s = { MN_I18N: { add: (l, x) => { if (l === 'de' || l === 'zh') Object.assign(d[l], x); return s.MN_I18N; } } };
  new Function('window', fs.readFileSync(path.join(DOCS, 'assets', 'i18n', f + '.i18n.js'), 'utf8'))(s);
  dicts[f] = d;
}
// 每页断言键（静态 data-i18n 挂载点；-html 键另标）
const PLAN = [
  { page: 'about.html', dict: 'about', keys: ['about.hero.title', 'about.who.title', 'about.features.title'] },
  { page: 'terms.html', dict: 'terms', keys: ['terms.back', 'terms.hero.title', 'terms.s1.title'] },
  { page: 'privacy.html', dict: 'privacy', keys: ['privacy.back', 'privacy.page.title', 'privacy.toc.sec1'] },
  { page: 'edge-themes-demo.html', dict: 'edge', keys: ['edge.hero.title', 'edge.parchment.title'] },
  { page: 'premium.html', dict: 'premium', keys: ['premium.hero.choose', 'premium.hero.plan', 'premium.plan.current'] }
];

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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(120);
  }
  throw new Error('waitFor 超时: ' + label);
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=de-DE', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Log.enable'); await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });

    for (const { page: pageName, dict: dictName, keys } of PLAN) {
      console.log('═══ ' + pageName + ' (de-DE 自动选) ═══');
      await cdp.send('Page.navigate', { url: BASE + '/pages/' + pageName });
      // 先等 apply() 落地（lang 属性由 apply() 同步设置——比逐个元素等文本更稳，无加载竞态）
      await waitFor(cdp, "document.documentElement.getAttribute('lang') === 'de'", 20000, pageName + ' apply 落地');
      const de = dicts[dictName].de;
      for (const key of keys) {
        const exp = de[key];
        if (exp == null) { ok(pageName + ' ' + key + ' 字典存在', false, '键缺失'); continue; }
        const sel = JSON.stringify('[data-i18n="' + key + '"], [data-i18n-html="' + key + '"]');
        const js = `(function(){var e=document.querySelector(${sel});if(!e)return null;return e.getAttribute('data-i18n-html')!=null?e.innerHTML:e.textContent;})()`;
        try {
          const got = await cdp.evalJs(js);
          const want = exp;
          const passKey = got != null && (got.indexOf(want) !== -1 || want.indexOf(got) !== -1);
          ok(pageName + ' ' + key + ' 德语', passKey, JSON.stringify(got) + ' ≠ ' + JSON.stringify(want));
        } catch (e) { ok(pageName + ' ' + key + ' 德语', false, e.message); }
      }
      const lang = await cdp.evalJs("document.documentElement.getAttribute('lang') + '/' + (window.MN_I18N ? MN_I18N.getLang() : 'NO_MN')");
      ok(pageName + ' html lang + getLang=de', lang === 'de/de', JSON.stringify(lang));
    }

    // ═══ zh 回落（premium 页 setLang）═══
    console.log('═══ zh 回落 ═══');
    await cdp.evalJs("MN_I18N.setLang('zh');");
    await waitFor(cdp, "MN_I18N.getLang() === 'zh'", 5000, 'zh 生效');
    const zhGot = await cdp.evalJs("(function(){var e=document.querySelector('[data-i18n=\"premium.hero.choose\"]');return e?e.textContent:null;})()");
    ok('zh 回落 premium.hero.choose', zhGot === dicts.premium.zh['premium.hero.choose'], JSON.stringify(zhGot));

    const errs = cdp.errs.filter(x => x.indexOf('favicon') === -1 && x.indexOf('/api/') === -1);
    ok('零 JS 错误（5 页）', errs.length === 0, errs.slice(0, 3).join(' | '));

    console.log('\n═══ 探针结果: ' + pass + '/' + (pass + fail) + ' ═══');
    cdp.close();
  } finally {
    try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
    server.close();
  }
  process.exit(fail ? 1 : 0);
})();
