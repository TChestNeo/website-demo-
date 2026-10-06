// tmp-battery-student-price.js — v0.2.45.2 学生价 RM5.50 学校邮箱验证码电池（tmp 绝不 commit）
//   （用户「然后在订阅那边添加一个学生价格，以RM5为标准，认证方式使用学生电子邮件接受认证码/邮件进行认证」
//   → 中途修正「改成RM5.50」；问询钦定①两价并存②A 邮箱码③edu 白名单④用户建价）
// F 静态：版本/前端资产/法务/后端配置五组；S1 guest→RM12+学生徽章；S2 未认证入口链+弹窗步骤 1；
// S3 白名单外 400 拒绝；S4 成功流（发码→倒计时→六格自动验→成功态→Basic 卡 RM5.50 双态）；S5 checkout student:true；
// S6 usd 认证者价格不变+仅限 MYR；S7 粘贴分发/退格跳格/Enter 验证；S8 过期 403→toast+重认证弹窗；
// S9 studentHasOnce=false → 年付钮隐藏；Z 零 console error/exception。
// /api 打桩 + /batt-set?sc= 控制端点（同进程内存 state；先设场景再导航）。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const ROOT = path.resolve(__dirname, '..');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-student-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

// ── 打桩 state（同进程内存）──
const STU = { email: 'batt@utm.edu.my', verifiedAt: '2026-09-14T00:00:00.000Z', expiresAt: '2027-09-14T00:00:00.000Z', source: 'email_code' };
const ME_USER = { id: 'U1', tier: 'free', email: 'batt@example.com', tierExpiresAt: null, student: null };
const SC = {
  guest: { me401: true, emailCode: 'ok', verify: 'ok', checkout: 200, once: true },
  user: { me: ME_USER, emailCode: 'ok', verify: 'ok', checkout: 200, once: true },
  domain: { me: ME_USER, emailCode: 'domain', verify: 'ok', checkout: 200, once: true },
  ok: { me: ME_USER, emailCode: 'ok', verify: 'ok', checkout: 200, once: true },
  verified: { me: Object.assign({}, ME_USER, { student: STU }), emailCode: 'ok', verify: 'ok', checkout: 200, once: true },
  stale: { me: Object.assign({}, ME_USER, { student: STU }), emailCode: 'ok', verify: 'ok', checkout: 403, once: true },
  noOnce: { me: Object.assign({}, ME_USER, { student: STU }), emailCode: 'ok', verify: 'ok', checkout: 200, once: false },
};
let scName = 'user';
let verifyLog = [];
let checkoutLog = [];

function json(res, status, body) {
  const b = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) });
  res.end(b);
}
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url);
  const p = url.split('?')[0];
  if (p === '/batt-setup.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><meta charset="utf-8"></head><body>setup</body></html>');
    return;
  }
  if (p === '/batt-set') {
    const q = new URLSearchParams(url.split('?')[1] || '');
    if (SC[q.get('sc')]) { scName = q.get('sc'); verifyLog = []; checkoutLog = []; }
    json(res, 200, { ok: true, sc: scName });
    return;
  }
  if (p === '/api/health') { json(res, 200, { ok: true }); return; }
  if (p.indexOf('/api/') !== 0) {
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
    return;
  }
  const sc = SC[scName];
  let body = '';
  req.on('data', (d) => { body += d; if (body.length > 1e6) req.destroy(); });
  req.on('end', () => {
    let parsed = null;
    try { parsed = body ? JSON.parse(body) : {}; } catch (e) {}
    if (p === '/api/auth/me') {
      if (sc.me401) return json(res, 401, { error: { code: 'UNAUTHORIZED', message: 'no session' } });
      return json(res, 200, { user: sc.me });
    }
    if (p === '/api/subscription/status') {
      return json(res, 200, {
        enabled: true,
        prices: { basic: { hasOnce: sc.once }, premium: { hasOnce: true }, ultra: { hasOnce: true } },
        onceMethods: ['card', 'grabpay'], hasPortal: false,
        studentPrice: true, studentHasOnce: sc.once
      });
    }
    if (p === '/api/student-verify/email-code') {
      if (sc.emailCode === 'domain') return json(res, 400, { error: { code: 'STUDENT_EMAIL_DOMAIN', message: '该邮箱域名不在学校邮箱白名单，暂不支持自动认证' } });
      return json(res, 200, { ok: true, ttlMs: 600000, resendMs: 60000 });
    }
    if (p === '/api/student-verify/verify') {
      verifyLog.push({ email: parsed.email, code: parsed.code });
      if (sc.verify !== 'ok') return json(res, 400, { error: { code: 'VALIDATION', message: '验证码无效或已过期' } });
      return json(res, 200, { ok: true, student: STU });
    }
    if (p === '/api/subscription/checkout') {
      checkoutLog.push(parsed);
      if (sc.checkout === 403) return json(res, 403, { error: { code: 'STUDENT_REQUIRED', message: '请先完成学生邮箱认证' } });
      return json(res, 200, { ok: true, url: 'https://stub-checkout/' });
    }
    json(res, 404, { error: { code: 'NOT_FOUND', message: p } });
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
        this.errs.push('EXC ' + JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        const e = m.params.entry;
        // 预期噪声（非页面脚本错误）：站外跳转拦截（stub-checkout）、favicon 404、
        // /api 打桩的 4xx 均为场景故意返回（S1 401/S3 400/S8 403 走的分支就是断言对象）
        const t = e.text || '';
        const u = e.url || '';
        if (t.indexOf('stub-checkout') !== -1 || u.indexOf('stub-checkout') !== -1) return;
        if (u.indexOf('favicon') !== -1) return;
        if (u.indexOf('/api/') !== -1) return;
        this.errs.push('LOG ' + JSON.stringify({ text: t.slice(0, 200), url: u }).slice(0, 300));
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
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

(async () => {
  // ═══ F 静态检查 ═══
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const premiumSrc = fs.readFileSync(path.join(DOCS, 'pages', 'premium.html'), 'utf8');
  const ftzh = fs.readFileSync(path.join(DOCS, 'assets', 'i18n', 'financial-terms.i18n.js'), 'utf8'); // v0.2.54.0 旧 .zh.js 已迁移删除
  const ftHtml = fs.readFileSync(path.join(DOCS, 'pages', 'financial-terms.html'), 'utf8');
  const termsHtml = fs.readFileSync(path.join(DOCS, 'pages', 'terms.html'), 'utf8');
  const cfgSrc = fs.readFileSync(path.join(ROOT, 'backend-v2', 'src', 'config.js'), 'utf8');
  const subsSrc = fs.readFileSync(path.join(ROOT, 'backend-v2', 'src', 'routes', 'public', 'subscriptions.js'), 'utf8');
  const mig021 = fs.readFileSync(path.join(ROOT, 'backend-v2', 'migrations', '021_student_verify.sql'), 'utf8');
  const studentsSrc = fs.readFileSync(path.join(ROOT, 'backend-v2', 'src', 'students.js'), 'utf8');
  const svRoute = fs.readFileSync(path.join(ROOT, 'backend-v2', 'src', 'routes', 'public', 'student-verify.js'), 'utf8');

  ok('F1 静态：版本 v0.2.45.2 + changelog 学生价串（RM5.50/学校邮箱/365 天）+ FC 线不变 v10.28.34.2',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    sconfSrc.indexOf('学生价 RM5.50') !== -1 &&
    sconfSrc.indexOf('学校邮箱验证码') !== -1 &&
    sconfSrc.indexOf('365 天') !== -1);

  ok('F2 静态：premium.html 学生价资产（RM5.50/RM55/入口/样式/checkout 学生旗/探针/studentHasOnce）',
    cnt(premiumSrc, 'RM5.50') >= 3 &&
    premiumSrc.indexOf('RM55') !== -1 &&
    premiumSrc.indexOf('id="basicStudentEntry"') !== -1 &&
    premiumSrc.indexOf('.sv-cell{') !== -1 &&
    premiumSrc.indexOf('payload.student = true') !== -1 &&
    premiumSrc.indexOf('window.__mnStudent') !== -1 &&
    premiumSrc.indexOf('sub.studentHasOnce') !== -1 &&
    premiumSrc.indexOf("function openStudentModal") !== -1);

  ok('F3 静态：法务三处「常规价 RM12/月；学生用户凭学校邮箱认证后可享学生价 RM5.50/月，认证有效期 365 天」',
    ftzh.indexOf('常规价 RM12/月；学生用户凭学校邮箱认证后可享学生价 RM5.50/月，认证有效期 365 天') !== -1 &&
    ftHtml.indexOf('常规价 RM12/月；学生用户凭学校邮箱认证后可享学生价 RM5.50/月，认证有效期 365 天') !== -1 &&
    termsHtml.indexOf('学生优惠') !== -1 &&
    termsHtml.indexOf('RM5.50/月') !== -1);

  ok('F4 静态：后端 config 学生价 env + subscriptions 守卫 + 迁移 021 + students 白名单',
    cfgSrc.indexOf('STRIPE_PRICE_BASIC_STUDENT') !== -1 &&
    cfgSrc.indexOf('STRIPE_PRICE_BASIC_STUDENT_ONCE') !== -1 &&
    cfgSrc.indexOf('studentPricesOnce') !== -1 &&
    subsSrc.indexOf('STUDENT_REQUIRED') !== -1 &&
    subsSrc.indexOf('studentPricesOnce') !== -1 &&
    subsSrc.indexOf('studentRefresh') !== -1 &&
    mig021.indexOf('student_verify') !== -1 &&
    mig021.indexOf('student_email') !== -1 &&
    studentsSrc.indexOf('DEFAULT_DOMAINS') !== -1 &&
    studentsSrc.indexOf("'.edu.my'") !== -1);

  ok('F5 静态：student-verify 路由（白名单错误码/独立限流桶/audit system 口径）',
    svRoute.indexOf('STUDENT_EMAIL_DOMAIN') !== -1 &&
    svRoute.indexOf("'sv:email:'") !== -1 &&
    svRoute.indexOf("'svf:ip:'") !== -1 &&
    svRoute.indexOf("actorType: 'system'") !== -1);

  // ═══ 浏览器场景 ═══
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
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
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('Log.enable'); await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['https://stub-checkout/*'] }); // 倒数后站外跳转拦截：断言完页面仍在
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const setLS = async (pairs) => {
      await nav(BASE + '/batt-setup.html', "document.readyState === 'complete'", 'LS setup');
      const body = pairs.map(p => p.remove
        ? "localStorage.removeItem('" + p.k + "')"
        : "localStorage.setItem('" + p.k + "', " + JSON.stringify(p.v) + ")").join(';');
      const r = await cdp.evalJs("(function(){ try { " + body + "; return 'ok'; } catch(e){ return 'ERR ' + e.message; } })()");
      if (r !== 'ok') throw new Error('setLS 失败: ' + r);
    };
    const setSc = async (name) => {
      const r = await fetch(BASE + '/batt-set?sc=' + name);
      if (!r.ok) throw new Error('setSc 失败');
    };
    const setLocale = async (loc, tz) => {
      await cdp.send('Emulation.setLocaleOverride', { locale: loc });
      await cdp.send('Emulation.setTimezoneOverride', { timezoneId: tz });
    };
    const MYR = ['ms-MY', 'Asia/Kuala_Lumpur'];
    const ready = "window.__mnSubState && window.__mnSubState.ready";
    const premium = BASE + '/pages/premium.html';
    const card = "document.querySelector('[data-plan-card][data-plan-card=\"basic\"]')";
    const cardState = () => cdp.evalJs("(function(){ var c = " + card + "; " +
      "return JSON.stringify({ price: c.querySelector('[data-plan-price]').textContent.trim(), " +
      "strike: c.querySelector('#basicStrike').style.display, strikeTxt: c.querySelector('#basicStrike').textContent, " +
      "badge: document.getElementById('basicBadge').textContent, " +
      "entry: document.getElementById('basicStudentEntry').style.display, entryTxt: document.getElementById('basicStudentEntry').textContent, " +
      "note: document.getElementById('basicStudentNote').style.display, noteTxt: document.getElementById('basicStudentNote').textContent, " +
      "cta: c.querySelector('[data-plan-cta]').textContent, " +
      "once: (function(){ var o = c.querySelector('[data-plan-once]'); return JSON.stringify({ d: o.style.display, t: o.textContent }); })(), " +
      "hint: (function(){ var h = c.querySelector('[data-once-hint]'); return h ? JSON.stringify({ d: h.style.display, t: h.textContent }) : 'null'; })() }); })()");
    const openModal = async () => {
      await cdp.evalJs("document.getElementById('basicStudentEntry') && document.getElementById('basicStudentEntry').click()");
      await waitFor(cdp, "!!document.querySelector('.modal-card-body input.sv-input')", 8000, '弹窗步骤 1');
    };
    const closeModal = async () => {
      await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
      await waitFor(cdp, "!document.querySelector('.modal-backdrop')", 8000, '弹窗关闭');
    };
    const clickSend = async (email) => {
      await cdp.evalJs("(function(){ var i = document.querySelector('.modal-card-body input.sv-input'); i.value = " + JSON.stringify(email) + "; " +
        "var b = Array.prototype.filter.call(document.querySelectorAll('.modal-card-body button'), function(x){ return x.textContent === '发送验证码'; })[0]; b.click(); })()");
    };
    const fillCells = async (digits, withInput) => {
      await cdp.evalJs("(function(){ var cs = document.querySelectorAll('.sv-cell'); " +
        "for (var i = 0; i < 6; i++) { cs[i].value = " + JSON.stringify(digits) + "[i] || ''; " +
        (withInput ? "cs[i].dispatchEvent(new Event('input', { bubbles: true }));" : "") + " } })()");
    };

    // ═══ S1 访客：RM12 + 学生价徽章 + 无入口链 ═══
    await setSc('guest');
    await setLS([{ k: 'slati_session', remove: true }, { k: 'slati_user', remove: true }]);
    await setLocale(...MYR);
    await nav(premium, ready, 'S1 访客就绪');
    let r = await cdp.evalJs("JSON.stringify({ st: document.getElementById('subStatus').innerText, " +
      "entry: document.getElementById('basicStudentEntry').style.display, badge: document.getElementById('basicBadge').textContent })");
    let s = JSON.parse(r);
    ok('S1 guest：状态行含常规价 RM12 + 学生句 RM5.50，入口链隐藏，徽章学生价 RM5.50',
      s.st.indexOf('Basic 常规价 RM12/月') !== -1 && s.st.indexOf('学校邮箱认证后 RM5.50/月') !== -1 &&
      s.entry === 'none' && s.badge === '学生价 RM5.50', r);
    r = await cdp.evalJs("JSON.stringify({ cur: window.SlatiPrice.currency, st: window.__mnSubState })");
    s = JSON.parse(r);
    ok('S1 guest：myr + __mnSubState（student:false/studentPrice:null）',
      s.cur === 'myr' && s.st && s.st.student === false && s.st.studentPrice === null, r);

    // ═══ S2 未认证用户：入口链可见 → 弹窗步骤 1 ═══
    await setSc('user');
    await setLS([{ k: 'slati_session', v: JSON.stringify({ loggedIn: true }) }]);
    await nav(premium, ready, 'S2 用户就绪');
    r = await cardState();
    s = JSON.parse(r);
    ok('S2 未认证：RM12 + 入口链「学生认证 · 解锁 RM5.50/月」+ 无划线 + 徽章学生价',
      s.price === 'RM12' && s.strike === 'none' && s.entry === 'block' &&
      s.entryTxt === '学生认证 · 解锁 RM5.50/月' && s.badge === '学生价 RM5.50', r);
    await openModal();
    r = await cdp.evalJs("JSON.stringify({ txt: document.querySelector('.modal-card').innerText, " +
      "cellsHidden: getComputedStyle(document.querySelector('.sv-row').parentElement).display })");
    s = JSON.parse(r);
    ok('S2 弹窗步骤 1：标题+白名单提示+MYR 学生价，步骤 2 隐藏',
      s.txt.indexOf('学生认证') !== -1 && s.txt.indexOf('edu') !== -1 && s.txt.indexOf('RM5.50/月') !== -1 &&
      s.txt.indexOf('人工审核') !== -1 && s.cellsHidden === 'none', r);

    // ═══ S3 白名单外：400 STUDENT_EMAIL_DOMAIN → 人工审核提示，不切步骤 2 ═══
    await setSc('domain');
    await closeModal();
    await openModal();
    await clickSend('batt@gmail.com');
    await waitFor(cdp, "getComputedStyle(document.querySelector('.modal-card-body .sv-err')).display === 'block'", 8000, 'S3 错误行');
    r = await cdp.evalJs("JSON.stringify({ err: document.querySelector('.modal-card-body .sv-err').textContent, " +
      "cellsHidden: getComputedStyle(document.querySelector('.sv-row').parentElement).display })");
    s = JSON.parse(r);
    ok('S3 白名单外：显式 400 提示（暂不支持自动认证/人工审核）+ 仍步骤 1',
      s.err.indexOf('暂不支持自动认证') !== -1 && s.err.indexOf('人工审核') !== -1 && s.cellsHidden === 'none', r);

    // ═══ S4 成功流：发码 → 倒计时 → 六格自动验 → 成功态 → 关闭 → Basic 卡双态 ═══
    await setSc('ok');
    await closeModal();
    await openModal();
    await clickSend('batt@utm.edu.my');
    await waitFor(cdp, "getComputedStyle(document.querySelector('.sv-row').parentElement).display !== 'none'", 8000, 'S4 步骤 2');
    r = await cdp.evalJs("JSON.stringify({ mail: document.querySelector('.sv-mail').textContent, " +
      "resend: document.querySelector('.sv-resend').textContent })");
    s = JSON.parse(r);
    ok('S4a 发码成功 → 步骤 2：邮箱行 + 60s 倒计时', s.mail.indexOf('batt@utm.edu.my') !== -1 && s.resend.indexOf('秒') !== -1, r);
    await fillCells('123456', true);
    await waitFor(cdp, "getComputedStyle(document.querySelector('.sv-ok').parentElement).display !== 'none'", 8000, 'S4 成功态');
    r = await cdp.evalJs("JSON.stringify({ txt: document.querySelector('.sv-ok').textContent, " +
      "log: " + JSON.stringify(verifyLog) + " })");
    s = JSON.parse(r);
    ok('S4b 六格输满自动验 → 成功态（认证成功/邮箱/有效期 2027-09-14）+ verify 收到 code 123456',
      s.txt.indexOf('认证成功') !== -1 && s.txt.indexOf('batt@utm.edu.my') !== -1 && s.txt.indexOf('2027-09-14') !== -1 &&
      s.log.length === 1 && s.log[0].code === '123456' && s.log[0].email === 'batt@utm.edu.my', r);
    await cdp.evalJs("(function(){ var b = Array.prototype.filter.call(document.querySelectorAll('.modal-card-body button'), function(x){ return x.textContent === '完成'; })[0]; b.click(); })()");
    await waitFor(cdp, "!document.querySelector('.modal-backdrop')", 8000, 'S4 完成关闭');
    r = await cardState();
    s = JSON.parse(r);
    ok('S4c 认证后 Basic 卡双态：RM5.50 + 原价划线 RM12 + ✓ 学生认证 + CTA「订阅 · RM5.50/月」',
      s.price === 'RM5.50' && s.strike === 'block' && s.strikeTxt === 'RM12' && s.badge === '✓ 学生认证' &&
      s.cta === '订阅 · RM5.50/月', r);
    ok('S4d 年付学生价：每年支付 · RM55/年 + 折合 RM4.58 hint',
      s.once === '{"d":"block","t":"每年支付 · RM55/年"}' && s.hint.indexOf('折合每月 RM4.58/月（月付 RM5.50/月）') !== -1, r);
    r = await cdp.evalJs("JSON.stringify({ st: window.__mnSubState, note: document.getElementById('planNote').innerText })");
    s = JSON.parse(r);
    ok('S4e __mnSubState（student:true/studentPrice:RM5.50）+ planNote 学生句 + 银行卡/GrabPay 保留',
      s.st.student === true && s.st.studentPrice === 'RM5.50' &&
      s.note.indexOf('学校邮箱认证后 RM5.50/月') !== -1 && s.note.indexOf('银行卡') !== -1 && s.note.indexOf('GrabPay') !== -1, r);

    // ═══ S5 checkout 学生旗：payload.student=true + 3-2-1 遮罩 ═══
    await cdp.evalJs("(function(){ var c = " + card + "; c.querySelector('[data-plan-cta]').click(); })()");
    await sleep(400);
    r = await cdp.evalJs("JSON.stringify({ overlay: document.getElementById('cdOverlay').classList.contains('active') })");
    s = JSON.parse(r);
    ok('S5 checkout：记录收到 student:true（tierKey/mode/currency 正确）+ 倒数遮罩启动',
      checkoutLog.length === 1 && checkoutLog[0].student === true && checkoutLog[0].tierKey === 'basic' &&
      checkoutLog[0].mode === 'subscription' && checkoutLog[0].currency === 'myr' && s.overlay === true,
      JSON.stringify(checkoutLog[0]) + ' ' + r);

    // ═══ S6 非 MYR 认证者：价格不变 + 仅限 MYR 提示 ═══
    await setSc('verified');
    await setLocale('en-US', 'America/Los_Angeles');
    await nav(premium, ready, 'S6 usd 就绪');
    const s6cs = JSON.parse(await cardState());
    r = await cdp.evalJs("JSON.stringify({ cur: window.SlatiPrice.currency, st: document.getElementById('subStatus').innerText })");
    s = JSON.parse(r);
    s.cs = s6cs;
    ok('S6 usd 认证者：$5.99 不变 + 无划线 + ✓ 认证徽章 + note「已认证/有效至/仅限 MYR」+ 入口隐藏',
      s.cur === 'usd' && s.cs.price === '$5.99' && s.cs.strike === 'none' && s.cs.badge === '✓ 学生认证' &&
      s.cs.note === 'block' && s.cs.noteTxt.indexOf('已认证') !== -1 && s.cs.noteTxt.indexOf('batt@utm.edu.my') !== -1 &&
      s.cs.noteTxt.indexOf('2027-09-14') !== -1 && s.cs.noteTxt.indexOf('学生价仅限 MYR 结算') !== -1 && s.cs.entry === 'none', r);

    // ═══ S7 OTP 交互：粘贴分发 / 退格跳格 / Enter 验证 ═══
    await setSc('ok');
    await setLocale(...MYR);
    await setLS([{ k: 'slati_session', v: JSON.stringify({ loggedIn: true }) }]);
    await nav(premium, ready, 'S7 就绪');
    await openModal();
    await clickSend('batt@utm.edu.my');
    await waitFor(cdp, "getComputedStyle(document.querySelector('.sv-row').parentElement).display !== 'none'", 8000, 'S7 步骤 2');
    await cdp.evalJs("(function(){ var dt = new DataTransfer(); dt.setData('text/plain', '654321'); " +
      "document.querySelectorAll('.sv-cell')[0].dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()");
    await waitFor(cdp, "getComputedStyle(document.querySelector('.sv-ok').parentElement).display !== 'none'", 8000, 'S7a 粘贴后自动验');
    r = await cdp.evalJs("JSON.stringify({ vals: Array.prototype.map.call(document.querySelectorAll('.sv-cell'), function(c){ return c.value; }).join('') })");
    s = JSON.parse(r);
    ok('S7a 粘贴分发 6 位 → 全落格 → 输满自动验（verify 收到 654321）',
      s.vals === '654321' && verifyLog[verifyLog.length - 1].code === '654321', r + ' ' + JSON.stringify(verifyLog));
    await closeModal();
    await openModal();
    await clickSend('batt@utm.edu.my');
    await waitFor(cdp, "getComputedStyle(document.querySelector('.sv-row').parentElement).display !== 'none'", 8000, 'S7b 步骤 2');
    await fillCells('12', true);
    await cdp.evalJs("(function(){ var cs = document.querySelectorAll('.sv-cell'); cs[2].value = ''; cs[2].focus(); " +
      "cs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })); })()");
    r = await cdp.evalJs("JSON.stringify({ c1: document.querySelectorAll('.sv-cell')[1].value, " +
      "focus: document.activeElement === document.querySelectorAll('.sv-cell')[1], c0: document.querySelectorAll('.sv-cell')[0].value })");
    s = JSON.parse(r);
    ok('S7b 退格跳格：空格退格 → 前一格清空并聚焦', s.c1 === '' && s.focus === true && s.c0 === '1', r);
    // 5 格输入（不触发自动验）+ 第 6 格直写（无 input 事件）→ Enter 触发验证
    await fillCells('12345', true);
    await cdp.evalJs("(function(){ var cs = document.querySelectorAll('.sv-cell'); cs[5].value = '9'; " +
      "cs[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()");
    await waitFor(cdp, "getComputedStyle(document.querySelector('.sv-ok').parentElement).display !== 'none'", 8000, 'S7c Enter 验证');
    ok('S7c Enter 满 6 位触发验证（verify 收到 123459）',
      verifyLog.length === 2 && verifyLog[verifyLog.length - 1].code === '123459', JSON.stringify(verifyLog));
    await closeModal();

    // ═══ S8 过期 403：checkout → toast「重新认证」+ 弹窗自动打开 ═══
    await setSc('stale');
    await nav(premium, ready, 'S8 就绪');
    r = await cardState();
    s = JSON.parse(r);
    ok('S8a 认证态渲染 RM5.50（后端将判过期）', s.price === 'RM5.50', r);
    await cdp.evalJs("(function(){ var c = " + card + "; c.querySelector('[data-plan-cta]').click(); })()");
    await waitFor(cdp, "!!document.querySelector('.modal-card-body input.sv-input')", 8000, 'S8 重认证弹窗');
    r = await cdp.evalJs("JSON.stringify({ toast: (document.querySelector('[data-mn-toast]') || {}).textContent || null })");
    s = JSON.parse(r);
    ok('S8b 403 → toast「学生认证已过期，请重新认证」+ 弹窗打开 + checkout 记录 student:true',
      s.toast === '学生认证已过期，请重新认证' && checkoutLog[checkoutLog.length - 1].student === true, r);
    await closeModal();

    // ═══ S9 studentHasOnce=false：学生年付独立配置缺 → 年付钮隐藏 ═══
    await setSc('noOnce');
    await nav(premium, ready, 'S9 就绪');
    r = await cardState();
    s = JSON.parse(r);
    ok('S9 无学生年付 Price：月付 RM5.50 保留 + 年付钮隐藏（studentHasOnce 独立配置态）',
      s.price === 'RM5.50' && s.once === '{"d":"none","t":"每年支付 · RM55/年"}', r);

    // ═══ Z 零 console error/exception ═══
    ok('Z 零 console error/exception', cdp.errs.length === 0, JSON.stringify(cdp.errs));

    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
  }
  console.log('\n  ── 结果: ' + PASS + '/' + (PASS + FAIL) + (FAIL === 0 ? ' 全绿 ✅' : ' 有红 ❌'));
  process.exit(FAIL === 0 ? 0 : 1);
(() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
