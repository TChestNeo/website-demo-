// tmp-battery-auth-sendbtn.js — v0.2.49.0 注册/登录页六格 OTP 验证码电池（tmp 绝不 commit）
//   （用户「能不能把输入验证码的收入框换成这个」粘贴 React OtpInput 组件源码 → 原生复刻）
// F 静态：版本/OTP 资产/startCountdown 挂 OTP/首击自动发码链/交互标记（粘贴分发/退格跳格/抖动/弹入/reduced-motion）；
// S1 api 模式两组可见（各 6 格）+文案恒常；S2 空表单点发码→校验错误；S3 填表点发码→hint+倒计时+焦点落首格；
// S4 逐字键入自动跳格→verify 收到 code 不重发→落库；S4c 整码粘贴分发（非数字过滤）+焦点跳回首个空位；
// S5 登录侧镜像→passwordSetupRequired 设密引导；S5b 错码→OTP 红框抖动+信息行变红+焦点回首格+已填值保留（组件口径）→改对重验；
// S6 主按钮首击自动发码；S7 倒计时到期→Resend Code 恢复→429 提示（OTP 不红）→带码恒走验证不重发；
// S8 demo 模式组隐藏不渲染；Z 零 console error/exception。
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
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-sendbtn-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

// ── 打桩 state（同进程内存）──
const SIGNUP_USER = { id: 'U1', displayName: 'Batt Tester', email: 'batt@example.com', citizenId: 'CIT-1', createdAt: '2026-09-15T00:00:00.000Z' };
const LOGIN_USER = { id: 'U2', displayName: 'Login Batt', email: 'login@example.com', citizenId: 'CIT-2', createdAt: '2026-09-15T00:00:00.000Z' };
const SC = {
  api: { health: 200 },       // 后端可达：health 200 → AUTH_API=true；/auth/me 401 → 页面不走免登录直达
  api429: { health: 200 },    // 同 api，但 email-code 恒 429（测重发限流提示分支）
  apiWrong: { health: 200 },  // 同 api，但 verify 恒 400（测 OTP 错误态：红框+抖动+值保留）
  demo: { health: 404 },      // 后端不可达 → demo 模式：验证码组隐藏
};
let scName = 'api';
let emailCodeLog = [];        // POST /api/auth/email-code 请求记录
let verifyLog = [];           // POST /api/auth/verify 请求记录

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
    if (SC[q.get('sc')]) { scName = q.get('sc'); } // 打桩记录全程累计（断言按累计数），切场景不重置
    json(res, 200, { ok: true, sc: scName });
    return;
  }
  if (p === '/api/health') {
    if (SC[scName].health !== 200) return json(res, 404, { error: { code: 'NOT_FOUND', message: 'offline' } });
    return json(res, 200, { ok: true });
  }
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
      return json(res, 401, { error: { code: 'UNAUTHORIZED', message: 'no session' } });
    }
    if (p === '/api/auth/email-code') {
      emailCodeLog.push({ email: parsed.email });
      if (scName === 'api429') return json(res, 429, { error: { code: 'RATE_LIMITED', message: 'too fast' } });
      return json(res, 200, { ok: true, ttlMs: 600000, resendMs: 60000 });
    }
    if (p === '/api/auth/verify') {
      verifyLog.push({ email: parsed.email, code: parsed.code, displayName: parsed.displayName || null, hasPassword: !!(parsed.password && parsed.password.length >= 8) });
      if (scName === 'apiWrong') return json(res, 400, { error: { code: 'INVALID_CODE', message: 'bad code' } });
      // 注册流（带 displayName）→ new；登录流（无 displayName）→ passwordSetupRequired 引导设密（同页不导航，可断言）
      if (parsed.displayName) return json(res, 200, { ok: true, user: SIGNUP_USER, status: 'new' });
      return json(res, 200, { ok: true, user: LOGIN_USER, passwordSetupRequired: true });
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
      } else if (m.method === 'Fetch.requestPaused') {
        // story.mnationworld.com 导航拦截（Fetch 域才拦得住跨站主帧导航；setBlockedURLs 拦不住浏览器进程导航）
        this.send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' });
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        const e = m.params.entry;
        // 预期噪声（非页面脚本错误）：站外跳转拦截（story.mnationworld.com 注册成功导航被 setBlockedURLs 拦下）、
        // favicon 404、/api 打桩的 4xx 均为场景故意返回（401/404/400/429 走的分支就是断言对象）
        const t = e.text || '';
        const u = e.url || '';
        if (t.indexOf('story.mnationworld.com') !== -1 || u.indexOf('story.mnationworld.com') !== -1) return;
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
  let lastErr = '';
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; }
    catch (e) { lastErr = String(e.message || e).slice(0, 160); }
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label + (lastErr ? '（最后 eval 错误: ' + lastErr + '）' : ''));
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
  const pageSrc = fs.readFileSync(path.join(DOCS, 'signup-and-login.html'), 'utf8');

  ok('F1 静态：版本 v0.2.49.0 + changelog 六格 OTP 串（用户原话+原生复刻）+ FC 线 v10.28.35.3',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.49.0';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.35.3';") !== -1 &&
    sconfSrc.indexOf('能不能把输入验证码的收入框换成这个') !== -1 &&
    sconfSrc.indexOf('原生 JS/CSS 1:1 复刻') !== -1);

  ok('F2 静态：两表单六格 OTP 资产（signupOtp/loginOtp + 12 个 otp-cell + aria 标签）+ initOtpBox + Send Code 按钮 + sendSignupCode/sendLoginCode 定义',
    pageSrc.indexOf('id="signupOtp"') !== -1 &&
    pageSrc.indexOf('id="loginOtp"') !== -1 &&
    cnt(pageSrc, 'class="otp-cell"') === 12 &&
    pageSrc.indexOf('aria-label="Verification code, character 1 of 6"') >= 2 &&
    pageSrc.indexOf('function initOtpBox') !== -1 &&
    pageSrc.indexOf('id="signupSendBtn"') !== -1 &&
    pageSrc.indexOf('id="loginSendBtn"') !== -1 &&
    pageSrc.indexOf('>Send Code<') >= 2 &&
    pageSrc.indexOf('function sendSignupCode()') !== -1 &&
    pageSrc.indexOf('function sendLoginCode()') !== -1);

  ok('F3 静态：startCountdown 挂发码按钮+焦点落 OTP 首格（无旧单输入框引用）且 codeSent 保持 true；主按钮首击自动发码链（两 tab）保留',
    pageSrc.indexOf("getElementById(tab + 'SendBtn')") !== -1 &&
    pageSrc.indexOf("otps[tab].focus()") !== -1 &&
    pageSrc.indexOf("getElementById(tab + 'Code')") === -1 &&
    pageSrc.indexOf("codeSent[tab] = true") !== -1 &&
    pageSrc.indexOf("if (!codeSent.signup) { sendSignupCode(); return; }") !== -1 &&
    pageSrc.indexOf("if (!codeSent.login) { sendLoginCode(); return; }") !== -1 &&
    pageSrc.indexOf("if (countdown.signup > 0) return;") !== -1);

  ok('F4 静态：主按钮文案恒常 Create Account / Enter Console（不再随倒计时变身）',
    pageSrc.indexOf('<span id="signupBtnLabel">Create Account</span>') !== -1 &&
    pageSrc.indexOf('<span id="loginBtnLabel">Enter Console</span>') !== -1);

  ok('F5 静态：OTP 交互标记（粘贴分发/退格跳格/方向键/弹入+抖动动画/reduced-motion）+ 验证错误走 OTP 状态行（三种文案）',
    pageSrc.indexOf('clipboardData.getData') !== -1 &&
    pageSrc.indexOf("e.key === 'Backspace'") !== -1 &&
    pageSrc.indexOf("e.key === 'ArrowLeft'") !== -1 &&
    pageSrc.indexOf("e.key === 'Home'") !== -1 &&
    pageSrc.indexOf('function fillFrom') !== -1 &&
    pageSrc.indexOf('@keyframes otp-pop') !== -1 &&
    pageSrc.indexOf('@keyframes otp-shake') !== -1 &&
    pageSrc.indexOf('prefers-reduced-motion') !== -1 &&
    pageSrc.indexOf('Invalid or expired code') !== -1 &&
    pageSrc.indexOf('Invalid code or password') !== -1 &&
    pageSrc.indexOf('Enter the 6-digit code from your email') >= 2);

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
    await cdp.send('Network.setBlockedURLs', { urls: ['https://story.mnationworld.com/*'] }); // 双保险；主拦截靠 Fetch 域
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'https://story.mnationworld.com/*', requestStage: 'Request' }] }); // 注册成功站外跳转拦截：断言完页面仍在
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    const nav = async (url, waitExpr, label) => {
      for (let attempt = 1; ; attempt++) {
        await cdp.send('Page.navigate', { url });
        try {
          await waitFor(cdp, waitExpr, 20000, label + (attempt > 1 ? '（重试 ' + attempt + '）' : ''));
          await sleep(600);
          return;
        } catch (e) {
          if (attempt >= 2) throw e;
          await sleep(1200); // 前次导航（如被拦的故事站跳转仍在飞）落定后重试一次
        }
      }
    };
    const setSc = async (name) => {
      const r = await fetch(BASE + '/batt-set?sc=' + name);
      if (!r.ok) throw new Error('setSc 失败');
    };
    const setLS = async (pairs) => {
      await nav(BASE + '/batt-setup.html', "document.readyState === 'complete'", 'LS setup');
      const body = pairs.map(p => p.remove
        ? "localStorage.removeItem('" + p.k + "')"
        : "localStorage.setItem('" + p.k + "', " + JSON.stringify(p.v) + ")").join(';');
      const r = await cdp.evalJs("(function(){ try { " + body + "; return 'ok'; } catch(e){ return 'ERR ' + e.message; } })()");
      if (r !== 'ok') throw new Error('setLS 失败: ' + r);
    };
    const fill = async (id, val) => {
      const r = await cdp.evalJs("(function(){ var el = document.getElementById(" + JSON.stringify(id) + "); if (!el) return 'MISSING'; el.value = " + JSON.stringify(val) + "; return 'ok'; })()");
      if (r !== 'ok') throw new Error('fill 失败: ' + id + ' ' + r);
    };
    const otpCells = (boxId) => "Array.prototype.slice.call(document.querySelectorAll('#" + boxId + " .otp-cell'))";
    // 逐字键入（Input.insertText 走真实 input 事件链 → 自动跳格路径）
    const typeChars = async (text) => {
      for (const c of text) {
        await cdp.send('Input.insertText', { text: c });
        await sleep(40);
      }
    };
    const signupPage = BASE + '/signup-and-login.html';
    const apiReady = 'window.AUTH_API === true';

    // ═══ S1 api 模式：两组可见（各 6 格）+ 主按钮文案恒常 + demoHint 切换 ═══
    await setSc('api');
    await setLS([{ k: 'slati_user', remove: true }, { k: 'slati_session', remove: true }]);
    await nav(signupPage, apiReady, 'S1 api 模式就绪');
    let r = await cdp.evalJs("JSON.stringify({ sg: getComputedStyle(document.getElementById('signupCodeGroup')).display, " +
      "lg: getComputedStyle(document.getElementById('loginCodeGroup')).display, " +
      "hint: document.getElementById('demoHint').textContent, " +
      "sl: document.getElementById('signupBtnLabel').textContent, ll: document.getElementById('loginBtnLabel').textContent, " +
      "ssb: document.getElementById('signupSendBtn').textContent, lsb: document.getElementById('loginSendBtn').textContent, " +
      "sd: document.getElementById('signupSendBtn').disabled, ld: document.getElementById('loginSendBtn').disabled, " +
      "sc1: document.querySelectorAll('#signupOtp .otp-cell').length, lc1: document.querySelectorAll('#loginOtp .otp-cell').length })");
    let s = JSON.parse(r);
    ok('S1 api 模式：验证码两组可见（display 非 none）各 6 格 + demoHint 双因素文案 + 主按钮文案恒常 + 发码钮 Send Code 未禁用',
      s.sg !== 'none' && s.lg !== 'none' && s.sc1 === 6 && s.lc1 === 6 &&
      s.hint === 'Secure login — password + email verification code' &&
      s.sl === 'Create Account' && s.ll === 'Enter Console' &&
      s.ssb === 'Send Code' && s.lsb === 'Send Code' && s.sd === false && s.ld === false, r);

    // ═══ S2 空表单点发码 → 校验错误（零请求）═══
    await cdp.evalJs("document.getElementById('tabSignup').click()");
    await sleep(800); // 蓝板滑动 0.6s
    await cdp.evalJs("document.getElementById('signupSendBtn').click()");
    await waitFor(cdp, "document.getElementById('signupError').style.display !== 'none'", 8000, 'S2 错误行');
    r = await cdp.evalJs("JSON.stringify({ err: document.getElementById('signupError').textContent })");
    s = JSON.parse(r);
    ok('S2 空表单点 Send Code：显示名校验错误提示 + 打桩零 email-code 请求',
      s.err === 'Please enter a display name' && emailCodeLog.length === 0, r + ' ' + JSON.stringify(emailCodeLog));

    // ═══ S3 填表点发码 → 打桩收到 email-code + hint + 发码钮倒计时禁用 + 主标签不变 + 焦点落 OTP 首格 ═══
    await fill('signupName', 'Batt Tester');
    await fill('signupEmail', 'batt@example.com');
    await fill('signupPassword', 'password123');
    await cdp.evalJs("document.getElementById('signupSendBtn').click()");
    await waitFor(cdp, "document.getElementById('signupCodeHint').textContent.indexOf('Verification code sent to') !== -1", 8000, 'S3 hint');
    r = await cdp.evalJs("JSON.stringify({ hint: document.getElementById('signupCodeHint').textContent, " +
      "dt: document.getElementById('signupSendBtn').textContent, dd: document.getElementById('signupSendBtn').disabled, " +
      "label: document.getElementById('signupBtnLabel').textContent, " +
      "focus: document.activeElement === document.querySelectorAll('#signupOtp .otp-cell')[0] })");
    s = JSON.parse(r);
    ok('S3 填表点 Send Code：hint 含邮箱+10 分钟 + 发码钮禁用「Resend in 60s」+ 主标签仍 Create Account + 焦点落 OTP 首格',
      s.hint === 'Verification code sent to batt@example.com — valid for 10 minutes' &&
      s.dt.indexOf('Resend in ') === 0 && s.dd === true && s.label === 'Create Account' && s.focus === true, r);
    ok('S3b 打桩收到 email-code（email 正确，无 code 字段混入）',
      emailCodeLog.length === 1 && emailCodeLog[0].email === 'batt@example.com' && emailCodeLog[0].code === undefined,
      JSON.stringify(emailCodeLog));

    // ═══ S4 逐字键入自动跳格 → 主按钮验证（收到 123456 且不重发；成功导航被拦截，页面仍在）═══
    await cdp.evalJs("document.getElementById('termsAgree').click()");
    await typeChars('123456');
    r = await cdp.evalJs("JSON.stringify({ vals: " + otpCells('signupOtp') + ".map(function(c){return c.value;}).join(''), " +
      "focus: document.activeElement === document.querySelectorAll('#signupOtp .otp-cell')[5], " +
      "filled: document.querySelectorAll('#signupOtp .otp-cell.filled').length })");
    s = JSON.parse(r);
    ok('S4a 逐字键入：自动跳格 6 格全填 123456 + 焦点停末格 + filled 样式 6 格', s.vals === '123456' && s.focus === true && s.filled === 6, r);
    await cdp.evalJs("document.getElementById('signupBtnLabel').click()"); // span 冒泡到按钮 onclick=handleSignup
    for (let i = 0; i < 80; i++) { if (verifyLog.length === 1) break; await sleep(100); }
    ok('S4b 填码点主按钮：verify 收到 code 123456（email/displayName/密码齐）+ 验证步骤零重发（email-code 仍 1）',
      verifyLog.length === 1 && verifyLog[0].email === 'batt@example.com' && verifyLog[0].code === '123456' &&
      verifyLog[0].displayName === 'Batt Tester' && verifyLog[0].hasPassword === true && emailCodeLog.length === 1,
      JSON.stringify(verifyLog) + ' ' + JSON.stringify(emailCodeLog));
    // 注册成功 → location.href=story.mnationworld.com/wip 被 Fetch 域拦下（帧成错误页）；等落定再回注册页查 localStorage 落库
    await sleep(800);
    await nav(signupPage, apiReady, 'S4b 回注册页验落库');
    r = await cdp.evalJs("JSON.stringify({ ls: localStorage.getItem('slati_user'), path: location.pathname })");
    s = JSON.parse(r);
    ok('S4c 注册成功落库（slati_user 含邮箱）+ 回注册页仍可继续',
      s.ls !== null && s.ls.indexOf('batt@example.com') !== -1 && s.path.indexOf('signup-and-login.html') !== -1, r);

    // ═══ S4d 整码粘贴分发（非数字过滤）+ 焦点跳回首个空位 ═══
    await cdp.evalJs("document.getElementById('tabSignup').click()");
    await sleep(800);
    r = await cdp.evalJs("(function(){ var cells = " + otpCells('signupOtp') + "; cells[3].focus(); return document.activeElement === cells[0] ? 'JUMP' : 'NOJUMP'; })()");
    ok('S4d-1 焦点跳回首个空位：空格点第 4 格 → 焦点自动落第 1 格（组件同款）', r === 'JUMP', String(r));
    r = await cdp.evalJs("(function(){ var cells = " + otpCells('signupOtp') + "; var dt = new DataTransfer(); dt.setData('text', '11-22-33'); " +
      "cells[1].dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return 'ok'; })()");
    if (r !== 'ok') throw new Error('paste 派发失败: ' + r);
    r = await cdp.evalJs("JSON.stringify({ vals: " + otpCells('signupOtp') + ".map(function(c){return c.value;}).join(''), " +
      "focus: document.activeElement === document.querySelectorAll('#signupOtp .otp-cell')[5] })");
    s = JSON.parse(r);
    ok('S4d-2 整码粘贴（含分隔符）：非数字过滤后 6 格分发 112233 + 焦点停末格 + 零 API 请求',
      s.vals === '112233' && s.focus === true && emailCodeLog.length === 1 && verifyLog.length === 1, r);

    // ═══ S5 登录侧镜像：发码 → hint+倒计时 → 逐字键入验证 → passwordSetupRequired 引导设密（同页可断言）═══
    await cdp.evalJs("document.getElementById('tabLogin').click()");
    await sleep(800);
    await fill('loginEmail', 'login@example.com');
    await fill('loginPassword', 'password123');
    await cdp.evalJs("document.getElementById('loginSendBtn').click()");
    await waitFor(cdp, "document.getElementById('loginCodeHint').textContent.indexOf('Verification code sent to') !== -1", 8000, 'S5 登录 hint');
    r = await cdp.evalJs("JSON.stringify({ hint: document.getElementById('loginCodeHint').textContent, " +
      "dt: document.getElementById('loginSendBtn').textContent, dd: document.getElementById('loginSendBtn').disabled, " +
      "label: document.getElementById('loginBtnLabel').textContent })");
    s = JSON.parse(r);
    ok('S5 登录侧发码：hint + 发码钮禁用「Resend in」+ 主标签仍 Enter Console',
      s.hint === 'Verification code sent to login@example.com — valid for 10 minutes' &&
      s.dt.indexOf('Resend in ') === 0 && s.dd === true && s.label === 'Enter Console', r);
    await typeChars('654321');
    await cdp.evalJs("document.getElementById('loginBtnLabel').click()");
    await waitFor(cdp, "document.getElementById('setupForm').style.display !== 'none'", 8000, 'S5 设密引导');
    r = await cdp.evalJs("JSON.stringify({ setup: document.getElementById('setupForm').style.display })");
    s = JSON.parse(r);
    ok('S5b 登录验证：verify 收到 code 654321（无 displayName=登录流）+ passwordSetupRequired 引导设密同页显示',
      verifyLog.length === 2 && verifyLog[verifyLog.length - 1].email === 'login@example.com' &&
      verifyLog[verifyLog.length - 1].code === '654321' && verifyLog[verifyLog.length - 1].displayName === null &&
      verifyLog[verifyLog.length - 1].hasPassword === true && s.setup !== 'none',
      JSON.stringify(verifyLog) + ' ' + r);

    // ═══ S5c 错码 → OTP 错误态（红框+抖动类+信息行变红+焦点回首格+已填值保留）→ 改对重验成功 ═══
    await setSc('apiWrong');
    await nav(signupPage, apiReady, 'S5c 就绪（页面重载 codeSent 归零）');
    await cdp.evalJs("document.getElementById('tabLogin').click()");
    await sleep(800);
    await fill('loginEmail', 'login@example.com');
    await fill('loginPassword', 'password123');
    await cdp.evalJs("document.getElementById('loginSendBtn').click()");
    await waitFor(cdp, "document.getElementById('loginCodeHint').textContent.indexOf('Verification code sent to') !== -1", 8000, 'S5c 登录 hint');
    await typeChars('111111');
    await cdp.evalJs("document.getElementById('loginBtnLabel').click()");
    // 等页面处理完 400 响应（verifyLog 在请求到达时就 +1，UI 错误态在其后落定）
    await waitFor(cdp, "document.getElementById('loginCodeHint').textContent === 'Invalid code or password'", 8000, 'S5c 错误提示落定');
    r = await cdp.evalJs("JSON.stringify({ hint: document.getElementById('loginCodeHint').textContent, " +
      "cls: document.getElementById('loginCodeHint').className, " +
      "boxErr: document.getElementById('loginOtp').classList.contains('otp-error'), " +
      "vals: " + otpCells('loginOtp') + ".map(function(c){return c.value;}).join(''), " +
      "focus: document.activeElement === document.querySelectorAll('#loginOtp .otp-cell')[0] })");
    s = JSON.parse(r);
    ok('S5c-1 错码验证：打桩收到 111111 → OTP 错误态（信息行 ' + "'Invalid code or password'" + ' 变红 + 红框类 + 焦点回首格）+ 已填值保留（组件口径）',
      verifyLog.length === 3 && verifyLog[2].code === '111111' && s.hint === 'Invalid code or password' &&
      s.cls.indexOf('otp-error') !== -1 && s.boxErr === true && s.vals === '111111' && s.focus === true, r);
    ok('S5c-2 错码不发码不导航：email-code 仍 3 + 无落库动作', emailCodeLog.length === 3, JSON.stringify(emailCodeLog));
    await setSc('api');
    await cdp.evalJs("document.getElementById('loginBtnLabel').click()"); // 值保留 → 直接重验（同码改对场景）
    await waitFor(cdp, "document.getElementById('setupForm').style.display !== 'none'", 8000, 'S5c 改对设密引导');
    r = await cdp.evalJs("JSON.stringify({ setup: document.getElementById('setupForm').style.display, " +
      "loginHidden: document.getElementById('loginForm').style.display === 'none' })");
    s = JSON.parse(r);
    ok('S5c-3 改对后重验成功：verify 再收 111111（值保留佐证）+ 设密引导显示 + 登录表单整体隐藏（红框不可见不残留）',
      verifyLog.length === 4 && verifyLog[3].code === '111111' && s.setup !== 'none' && s.loginHidden === true,
      JSON.stringify(verifyLog) + ' ' + r);

    // ═══ S6 主按钮首击自动发码（旧路径零破坏）═══
    await setSc('api');
    await nav(signupPage, apiReady, 'S6 就绪（页面重载 codeSent 归零）');
    await cdp.evalJs("document.getElementById('tabSignup').click()");
    await sleep(800);
    await fill('signupName', 'Batt Tester');
    await fill('signupEmail', 'batt@example.com');
    await fill('signupPassword', 'password123');
    await cdp.evalJs("document.getElementById('termsAgree').click()");
    await cdp.evalJs("document.getElementById('signupBtnLabel').click()"); // 直接点主按钮，不点发码钮
    await waitFor(cdp, "document.getElementById('signupCodeHint').textContent.indexOf('Verification code sent to') !== -1", 8000, 'S6 首击发码');
    r = await cdp.evalJs("JSON.stringify({ dt: document.getElementById('signupSendBtn').textContent, " +
      "dd: document.getElementById('signupSendBtn').disabled, label: document.getElementById('signupBtnLabel').textContent })");
    s = JSON.parse(r);
    ok('S6 主按钮首击自动发码：打桩收到 email-code + 发码钮进入倒计时 + 主标签仍 Create Account + 未触发验证',
      emailCodeLog.length === 4 && emailCodeLog[emailCodeLog.length - 1].email === 'batt@example.com' &&
      s.dt.indexOf('Resend in ') === 0 && s.dd === true && s.label === 'Create Account' && verifyLog.length === 4,
      JSON.stringify(emailCodeLog) + ' ' + r);

    // ═══ S7 倒计时到期 → Resend Code 恢复 → 重发 429 提示（OTP 不红）→ 主按钮带码走验证不重发 ═══
    await cdp.evalJs("countdown.signup = 1"); // 加速倒计时到期
    await waitFor(cdp, "!document.getElementById('signupSendBtn').disabled && document.getElementById('signupSendBtn').textContent === 'Resend Code'", 5000, 'S7 倒计时到期');
    await setSc('api429');
    await cdp.evalJs("document.getElementById('signupSendBtn').click()");
    await waitFor(cdp, "document.getElementById('signupError').style.display !== 'none'", 8000, 'S7 429 提示');
    r = await cdp.evalJs("JSON.stringify({ err: document.getElementById('signupError').textContent, " +
      "dt: document.getElementById('signupSendBtn').textContent, dd: document.getElementById('signupSendBtn').disabled, " +
      "hint: document.getElementById('signupCodeHint').textContent, " +
      "hintCls: document.getElementById('signupCodeHint').className, " +
      "boxErr: document.getElementById('signupOtp').classList.contains('otp-error') })");
    s = JSON.parse(r);
    ok('S7a 倒计时到期：发码钮恢复「Resend Code」可点 → 重发 429 → 请稍后提示 + 不再重启倒计时（按钮未禁用）+ OTP 不误伤（信息行中性无红框）',
      s.err === 'Please wait before requesting another code' && s.dt === 'Resend Code' && s.dd === false &&
      s.hint.indexOf('Verification code sent to') !== -1 && s.hintCls.indexOf('otp-error') === -1 && s.boxErr === false, r);
    ok('S7b 重发确实发到了打桩（email-code 请求 +1）',
      emailCodeLog.length === 5, JSON.stringify(emailCodeLog));
    await setSc('api');
    await cdp.evalJs("localStorage.removeItem('slati_user')");
    await cdp.evalJs("document.querySelectorAll('#signupOtp .otp-cell')[0].focus()");
    await typeChars('123459');
    await cdp.evalJs("document.getElementById('signupBtnLabel').click()");
    for (let i = 0; i < 80; i++) { if (verifyLog.length === 5) break; await sleep(100); }
    ok('S7c 倒计时结束后主按钮带码点击：恒走验证（verify 收到 123459）不再重发（email-code 请求数不变）',
      verifyLog.length === 5 && verifyLog[verifyLog.length - 1].code === '123459' &&
      verifyLog[verifyLog.length - 1].displayName === 'Batt Tester' && emailCodeLog.length === 5,
      JSON.stringify(verifyLog) + ' ' + JSON.stringify(emailCodeLog));
    await sleep(800); // 等注册成功的故事站跳转被拦下落定，再导航回（nav 自带一次重试兜底）
    await nav(signupPage, apiReady, 'S7c 回注册页');
    r = await cdp.evalJs("localStorage.getItem('slati_user') !== null");
    ok('S7d 验证成功仍落库（回注册页查 slati_user 重写）', r === true, String(r));

    // ═══ S8 demo 模式：验证码组隐藏不渲染（旧路径零变化）═══
    await setSc('demo');
    await nav(signupPage, 'window.MN_API && typeof window.MN_API.isBackend === "function"', 'S8 demo 就绪');
    await sleep(1200); // probe 完成（health 404 → up=false，页面无可见变化标记）
    r = await cdp.evalJs("JSON.stringify({ authApi: window.AUTH_API, sg: getComputedStyle(document.getElementById('signupCodeGroup')).display, " +
      "lg: getComputedStyle(document.getElementById('loginCodeGroup')).display, hint: document.getElementById('demoHint').textContent, " +
      "hasOtps: !!(document.getElementById('signupOtp') && document.getElementById('loginOtp')), " +
      "hasBtns: !!(document.getElementById('signupSendBtn') && document.getElementById('loginSendBtn')) })");
    s = JSON.parse(r);
    ok('S8 demo 模式：AUTH_API 保持 false + 验证码两组隐藏（display:none）+ demoHint 原样 + OTP/发码钮 DOM 存在但不渲染',
      s.authApi === false && s.sg === 'none' && s.lg === 'none' &&
      s.hint.indexOf('Demo mode — any credentials work') !== -1 && s.hasOtps === true && s.hasBtns === true, r);

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
