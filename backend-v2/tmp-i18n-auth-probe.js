// tmp-i18n-auth-probe.js — v0.2.54.0 B1 冒烟探针：signup-and-login / forgot-password 两页 i18n 运行时验证
// 面：A de-DE 浏览器语言自动选（静态 data-i18n + data-i18n-html + placeholder）→ B 交互错误文案 T() →
//     C zh 默认回落 → D 无字典语言回落 zh → E 零 JS 错误
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
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-i18n-auth-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};

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

    // ═══ A signup 页 de-DE 浏览器语言自动选 ═══
    console.log('═══ A signup de-DE 自动选 ═══');
    await cdp.send('Page.navigate', { url: BASE + '/signup-and-login.html' });
    await waitFor(cdp, "document.getElementById('tabLogin').textContent.indexOf('Anmelden') !== -1", 20000, 'A tab 德语');
    const a = await cdp.evalJs("(function(){var g=function(s){return document.querySelector(s)?document.querySelector(s).textContent.trim():null};return {tab:g('#tabLogin'),step:g('.progress-step .dot+span, .progress-step span[data-i18n=\"auth.step1\"]'),h1:g('h1[data-i18n=\"auth.login.title\"]'),hero:document.querySelector('h1[data-i18n-html]')?document.querySelector('h1[data-i18n-html]').innerHTML:null,ph:document.getElementById('loginPassword').getAttribute('placeholder'),lang:window.MN_I18N.getLang()};})()");
    ok('A1 tab 德语', a.tab === 'Anmelden', JSON.stringify(a.tab));
    ok('A2 蓝板 Welcome back h1 德语', a.h1 === 'Willkommen zurück', JSON.stringify(a.h1));
    ok('A3 蓝板 Build Your World data-i18n-html 德语含 <br>', a.hero && a.hero.indexOf('Baue deine<br>Welt') !== -1, JSON.stringify(a.hero));
    ok('A4 placeholder 德语', a.ph === 'Dein Passwort', JSON.stringify(a.ph));
    ok('A5 getLang()=de', a.lang === 'de', JSON.stringify(a.lang));
    // 注册半 + 步骤标签 + 条款行
    const a2 = await cdp.evalJs("(function(){var q=function(s){var e=document.querySelector(s);return e?e.textContent.trim():null};return {signupCard:q('h2[data-i18n=\"auth.signup.cardTitle\"]'),agree:q('.auth-terms span'),step2:q('span[data-i18n=\"auth.step2\"]'),demo:q('#demoHint')};})()");
    ok('A6 注册卡标题+步骤2 德语', a2.signupCard === 'Konto erstellen' && a2.step2 === 'Identität einrichten', JSON.stringify(a2.signupCard) + '/' + JSON.stringify(a2.step2));
    ok('A7 条款行德语（Ich akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung）', a2.agree.indexOf('Ich akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung') !== -1, JSON.stringify(a2.agree));
    ok('A8 demoHint 德语', a2.demo === 'Demo-Modus — beliebige Zugangsdaten funktionieren', JSON.stringify(a2.demo));

    // ═══ B 交互错误文案 T()（未勾条款点注册 → auth.err.agree）═══
    console.log('═══ B 交互错误 T() ═══');
    await cdp.evalJs("handleSignup()");
    await waitFor(cdp, "document.getElementById('signupError').style.display !== 'none'", 5000, 'B 错误出现');
    const b = await cdp.evalJs("document.getElementById('signupError').textContent");
    ok('B1 条款错误德语', b.indexOf('Nutzungsbedingungen') !== -1 && b.indexOf('Datenschutzerklärung') !== -1, JSON.stringify(b));

    // ═══ C forgot 页 de-DE ═══
    console.log('═══ C forgot de-DE ═══');
    await cdp.send('Page.navigate', { url: BASE + '/forgot-password.html' });
    await waitFor(cdp, "document.querySelector('h2.headline-md').textContent.trim() === 'Passwort vergessen?'", 20000, 'C 标题德语');
    const c = await cdp.evalJs("(function(){var q=function(s){var e=document.querySelector(s);return e?e.textContent.trim():null};return {title:q('h2.headline-md'),passTitle:q('h2[data-i18n=\"rp.newTitle\"]'),confirmPh:document.getElementById('rpNewPassword2').getAttribute('placeholder'),backCode:q('span[data-i18n=\"rp.backCode\"]'),footer:q('.rp-footer'),demo:q('#rpDemoHint'),demoShown:document.getElementById('rpDemoHint').style.display};})()");
    ok('C1 忘记密码标题+新密码卡+返回验证码 德语', c.title === 'Passwort vergessen?' && c.passTitle === 'Neues Passwort festlegen' && c.backCode === 'Zurück zum Code', JSON.stringify(c));
    ok('C2 placeholder + 页脚德语', c.confirmPh === 'Neues Passwort erneut eingeben' && c.footer.indexOf('Zurück zur Anmeldung') !== -1, JSON.stringify(c.confirmPh) + '/' + JSON.stringify(c.footer));
    ok('C3 demo 提示显示且德语（后端不可达 → demo 分支）', c.demoShown === '' && c.demo === 'Demo-Modus — jeder 6-stellige Code funktioniert', JSON.stringify(c.demo) + '/' + c.demoShown);

    // ═══ D 手动切 zh（forgot 页上 setLang + apply）═══
    console.log('═══ D zh 回落 ═══');
    await cdp.evalJs("MN_I18N.setLang('zh'); MN_I18N.apply();");
    const d = await cdp.evalJs("(function(){var q=function(s){var e=document.querySelector(s);return e?e.textContent.trim():null};return {title:q('h2.headline-md'),passTitle:q('h2[data-i18n=\"rp.newTitle\"]'),lang:window.MN_I18N.getLang()};})()");
    ok('D1 zh 应用生效（forgot 页）', d.title === '忘记密码？' && d.passTitle === '设置新密码' && d.lang === 'zh', JSON.stringify(d));

    // ═══ E 无字典语言回落（xx 无字典 → 回落浏览器语言 de，非 zh）═══
    console.log('═══ E 无字典语言回落 ═══');
    await cdp.evalJs("MN_I18N.setLang('xx'); MN_I18N.apply();");
    const e = await cdp.evalJs("(function(){var q=function(s){var e=document.querySelector(s);return e?e.textContent.trim():null};return {title:q('h2.headline-md'),lang:window.MN_I18N.getLang()};})()");
    ok('E1 xx 无字典 → 回落浏览器 de', e.title === 'Passwort vergessen?' && e.lang === 'de', JSON.stringify(e));

    // ═══ Z 零 JS 错误（两页；/api/* 404 为静态服务器预期）═══
    const errs = cdp.errs.filter(x => x.indexOf('favicon') === -1 && x.indexOf('/api/') === -1);
    ok('Z 零 JS 错误（两页）', errs.length === 0, errs.slice(0, 3).join(' | '));

    console.log('\n═══ 探针结果: ' + pass + '/' + (pass + fail) + ' ═══');
    cdp.close();
  } finally {
    try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
    server.close();
  }
  process.exit(fail ? 1 : 0);
})();
