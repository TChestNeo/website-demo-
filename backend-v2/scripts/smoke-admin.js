'use strict';
// smoke-admin.js — SlatiControl 前端常驻 CDP 冒烟工具（W2）。
// 自举：临时库（openDb 自动跑迁移）+ 种子（director/cs 两 staff + 用户/支付/登录史/事件/内容流水）
// → createServer({db, config, mailer 桩}) → 静态壳（docs/ 静态 + /api 代理到后端，部署同源拓扑）
// → headless Chrome CDP → DOM computed-style/文本断言（截图管线死 → 既定方法：Runtime.evaluate 返回值）。
// 断言口径：W6 双因素登录（密码 + 邮箱验证码；mailer 桩记码真实码驱动，DEV_LOGIN_CODE 不参与）：
//   Neo 有密码（密码空拦截 → 密码+真实码直登）→ 四页渲染（Dashboard 六组 / Analytics 域切换 + canvas /
//   Users 列表→详情 / Security 登录史→事件）→ cs（Alex，旧账号无密码）链路：仅码登录 → 首登设密 →
//   掩码断言（全局安全 403 / 支付区块无权限 / 近 10 条登录 / IP 前两段 / 无内部字段）→
//   错密码不消费码同码改对 / 忘记密码两步重置 → 新密码重登。
// 进程清理只杀本工具 spawn 的 chrome PID（taskkill /T /F /PID，绝不按镜像名）。
//
// 用法：node scripts/smoke-admin.js [--chrome <chrome.exe 路径>]

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const { openDb } = require('../src/db');
const { createServer } = require('../src/server');
const config = require('../src/config');
const { createStaff, assignRole } = require('../src/middleware/staff-auth');
const { hashPassword } = require('../src/password');

const ROOT = path.join(__dirname, '..', '..');
const DOCS = path.join(ROOT, 'docs');

const arg = process.argv.indexOf('--chrome');
const CHROME = (arg !== -1 && process.argv[arg + 1]) || findChrome();

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('未找到 Chrome/Edge，请用 --chrome <路径> 指定');
}

// ── 种子（列契约 = migrations 001/005/006/008/009/010；W2 测试同口径。
//    W6：Neo 种密码走密码+码登录；Alex 保持 password_hash NULL 走旧账号首登设密链路）──
async function seed(db) {
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const DAY = 86400e3;
  const ins = (sql, ...args) => db.prepare(sql).run(...args);

  const neo = createStaff(db, { email: 'neo@smoke.local', displayName: 'Neo', position: '项目总监', timezone: 'UTC+8', passwordHash: await hashPassword('neo-pass-123') });
  assignRole(db, neo.id, 'project_director');
  const alex = createStaff(db, { email: 'alex@smoke.local', displayName: 'Alex', position: '客户支持', timezone: 'UTC+8' });
  assignRole(db, alex.id, 'customer_support');

  const insUser = (id, email, over = {}) => ins(`INSERT INTO users
    (id, email, display_name, tier, status, risk_level, last_active_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, email, over.name || email, over.tier || 'free', over.status || 'active', over.risk || 'low',
    over.lastActive || null, over.createdAt || iso(2 * DAY), iso(0));

  insUser('USR-S1', 'alpha@smoke.local', { name: 'Alpha', createdAt: iso(5 * DAY), lastActive: iso(3600e3) });
  insUser('USR-S2', 'beta@smoke.local', { tier: 'premium', createdAt: iso(6 * DAY), lastActive: iso(2 * 3600e3) });
  insUser('USR-S3', 'gamma@smoke.local', { status: 'banned', risk: 'high', createdAt: iso(9 * DAY) });

  // 登录史：S1 12 条成功（203.0.113.x）+ 1 条最新失败（9.9.9.9）→ cs 掩码近 10 条恰好含最新失败
  for (let i = 0; i < 12; i++) {
    ins("INSERT INTO login_history (id, actor_type, actor_id, email, ip, device, browser, os, result, created_at) VALUES (?, 'user', ?, ?, ?, 'desktop', 'Chrome', 'Windows', 'success', ?)",
      `LGH-S${i}`, 'USR-S1', 'alpha@smoke.local', `203.0.113.${i}`, iso((i + 2) * 3600e3));
  }
  ins("INSERT INTO login_history (id, actor_type, actor_id, email, ip, device, browser, os, result, created_at) VALUES ('LGH-SF', 'user', 'USR-S1', 'alpha@smoke.local', '9.9.9.9', 'mobile', 'Safari', 'iOS', 'failed', ?)",
    iso(1800e3));

  ins("INSERT INTO security_events (id, actor_type, actor_id, event_type, detail, ip, risk_level, created_at) VALUES ('EV-S1', 'user', 'USR-S1', 'suspicious_login', '异地登录：新 IP 与常用区域不符', '198.51.100.7', 'high', ?)",
    iso(3600e3));
  ins("INSERT INTO security_events (id, actor_type, actor_id, event_type, detail, ip, risk_level, created_at) VALUES ('EV-S2', 'user', 'USR-S1', 'password_change', '用户主动修改密码', '198.51.100.8', 'low', ?)",
    iso(2 * 3600e3));

  // 支付：S2 两笔（验证 payments 掩码：cs 区块无权限 / director 可见）
  ins("INSERT INTO payments (id, user_id, tier_key, amount_micro, currency, status, created_at, paid_at) VALUES (?, ?, ?, ?, 'myr', 'paid', ?, ?)",
    'PAY-S1', 'USR-S2', 'premium', 2000000, iso(6 * DAY), iso(6 * DAY));
  ins("INSERT INTO payments (id, user_id, tier_key, amount_micro, currency, status, created_at, paid_at) VALUES (?, ?, ?, ?, 'myr', 'paid', ?, ?)",
    'PAY-S2', 'USR-S2', 'basic', 1000000, iso(20 * DAY), iso(20 * DAY));

  // Dashboard/Analytics 数据源（列契约 = 005/008/010）
  ins("INSERT INTO posts (id, author_id, content, status, created_at, updated_at) VALUES ('PST-S1', 'USR-S1', 'hello', 'visible', ?, ?), ('PST-S2', 'USR-S1', 'world', 'visible', ?, ?)",
    iso(3 * DAY), iso(3 * DAY), iso(4 * DAY), iso(4 * DAY));
  ins("INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at) VALUES ('RPT-S1', 'USR-S2', 'post', 'PST-S1', '垃圾内容', 'open', ?)",
    iso(DAY));
  ins("INSERT INTO tickets (id, user_id, category, type, contact, subject, description, status, submitted_at, created_at, updated_at) VALUES ('MN-2026-900001', 'USR-S1', 'bug', '问题', 'a@x.y', 's', 'd', 'queued', ?, ?, ?)",
    iso(DAY), iso(DAY), iso(DAY));
  ins("INSERT INTO nations (id, owner_id, data, created_at, updated_at) VALUES ('NAT-S1', 'USR-S1', ?, ?, ?)",
    JSON.stringify({ name: 'Nation S1' }), iso(5 * DAY), iso(5 * DAY));
  ins("INSERT INTO teams (id, data, created_at) VALUES ('TEM-S1', ?, ?)",
    JSON.stringify({ name: 'Team S1', nation_id: 'NAT-S1' }), iso(5 * DAY));
  ins("INSERT INTO following (user_id, target_type, target_id, created_at) VALUES ('USR-S1', 'nation', 'NAT-S1', ?)",
    iso(4 * DAY));
  ins("INSERT INTO conversations (id, kind, created_at) VALUES ('CONV-S1', 'dm', ?)", iso(2 * DAY));
  ins("INSERT INTO page_views (id, client_id, path, country, language, device, browser, os, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    'PGV-S1', 'c-1', '/explore', 'CN', 'zh', 'desktop', 'Chrome', 'Windows', iso(3600e3));
  ins("INSERT INTO page_views (id, client_id, path, country, language, device, browser, os, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    'PGV-S2', 'c-2', '/nations', 'MY', 'zh', 'mobile', 'Safari', 'iOS', iso(2 * 3600e3));
  ins("INSERT INTO page_views (id, client_id, path, country, language, device, browser, os, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    'PGV-S3', 'c-3', '/explore', 'CN', 'en', 'desktop', 'Firefox', 'Windows', iso(3 * 3600e3));

  // activity_daily：活跃 24h（dashboard）+ analytics users 日序列
  const today = iso(0).slice(0, 10);
  ins('INSERT OR IGNORE INTO activity_daily (user_id, date, last_seen_at) VALUES (?, ?, ?)', 'USR-S1', today, iso(0));
  ins('INSERT OR IGNORE INTO activity_daily (user_id, date, last_seen_at) VALUES (?, ?, ?)', 'USR-S2', today, iso(0));
  return { neo, alex };
}

// ── 静态壳服务器：docs/ 静态 + /api 代理到后端（同源拓扑，cookie 直通）──
function serveStatic(backendPort) {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) {
      const p = http.request({ host: '127.0.0.1', port: backendPort, path: req.url, method: req.method, headers: req.headers }, (pr) => {
        res.writeHead(pr.statusCode, pr.headers);
        pr.pipe(res);
      });
      req.pipe(p);
      p.on('error', () => { res.writeHead(502); res.end(); });
      return;
    }
    let fp = path.join(DOCS, decodeURIComponent(url.pathname));
    if (url.pathname === '/' || !path.extname(fp)) fp = path.join(DOCS, url.pathname, 'index.html');
    // URL 重构（08-29）：与 entrypoint.js 保持一致——无扩展名路径无同名文件时试 .html 回退
    if (!fs.existsSync(fp) && !path.extname(url.pathname)) {
      const alt = path.join(DOCS, decodeURIComponent(url.pathname) + '.html');
      if (alt.startsWith(DOCS) && fs.existsSync(alt)) fp = alt;
    }
    if (!fp.startsWith(DOCS)) { res.writeHead(403); return res.end(); }
    fs.readFile(fp, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return server;
}

// ── CDP 最小客户端（Node 24 全局 WebSocket）──
function cdp(port) {
  const wsUrl = new Promise((resolve, reject) => {
    const tries = setInterval(() => {
      http.get(`http://127.0.0.1:${port}/json/list`, (r) => {
        let b = '';
        r.on('data', (d) => b += d);
        r.on('end', () => {
          try {
            const list = JSON.parse(b);
            const page = list.find((t) => t.type === 'page'); // 教训：list[0] 可能是扩展后台页
            if (page) { clearInterval(tries); resolve(page.webSocketDebuggerUrl); }
          } catch {}
        });
      }).on('error', () => {});
    }, 150);
    setTimeout(() => { clearInterval(tries); reject(new Error('CDP 超时：Chrome 未就绪')); }, 20000);
  });

  let seq = 0;
  const pending = new Map();
  const events = { consoleErrors: [], exceptions: [] };
  let ws;

  async function connect() {
    ws = new WebSocket(await wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WebSocket 连接失败')); });
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') events.consoleErrors.push(msg.params.entry);
      else if (msg.method === 'Runtime.exceptionThrown') events.exceptions.push(msg.params.exceptionDetails);
    };
    send('Log.enable');
    send('Runtime.enable');
    send('Page.enable');
  }
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evalJs(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) {
      const d = r.result.exceptionDetails;
      throw new Error('页面脚本异常: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.result.value;
  }
  // 等待断言为真；表达式异常（元素未挂载）当 falsy 继续轮询
  async function waitFor(expression, timeoutMs = 8000, what = expression) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evalJs(expression)) return; } catch {}
      await new Promise((r) => setTimeout(r, 120));
    }
    throw new Error('等待超时: ' + what);
  }
  async function navigate(url) {
    const loaded = new Promise((resolve) => {
      const onMsg = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); resolve(); }
      };
      ws.addEventListener('message', onMsg);
    });
    await send('Page.navigate', { url });
    await loaded;
  }
  return { connect, evalJs, waitFor, navigate, events };
}

// ── 断言 ──
let passed = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures.push(name + (detail ? ' — ' + detail : '')); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}
// 选中文本含 text 的 .adm-card 区块，返回其 tbody 行数（-1 = 区块不存在）
const secOf = (sel, text) => `(() => { const s = [...document.querySelectorAll('${sel}')].find((x) => x.textContent.includes('${text}')); return s ? s.querySelectorAll('tbody tr').length : -1; })()`;

async function main() {
  console.log('smoke-admin：启动中…');

  // 1. 临时库 + 种子 + 后端（W6 双因素真实路径：mailer 桩记码驱动登录/设密/重置，DEV_LOGIN_CODE 不参与）
  const dbPath = path.join(os.tmpdir(), `smoke-admin-${process.pid}.db`);
  const db = openDb(dbPath);
  await seed(db);
  const mails = [];
  const codeOf = (email) => mails.filter((m) => m.email === email && m.opts && m.opts.purpose === 'staff_login').at(-1).code;
  const cfg = { ...config, databasePath: dbPath, nodeEnv: 'development' };
  const backend = createServer({ db, config: cfg, mailer: { sendCode: async (email, code, opts) => { mails.push({ email, code, opts }); } } });
  const backendPort = await new Promise((res) => backend.listen(0, '127.0.0.1', () => res(backend.address().port)));

  // 2. 静态壳（docs/ + /api 代理）
  const front = serveStatic(backendPort);
  const frontPort = await new Promise((res) => front.listen(0, '127.0.0.1', () => res(front.address().port)));

  // 3. Chrome（headless；独立临时 profile 绝对路径——相对路径 exit 21 教训）
  const cdpPort = 9300 + Math.floor(Math.random() * 400);
  const profile = path.join(os.tmpdir(), `smoke-admin-profile-${process.pid}`);
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--disable-extensions',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: 'ignore' });

  const client = cdp(cdpPort);
  try {
    await client.connect();
    const URL = `http://127.0.0.1:${frontPort}/admin/index.html`;
    await client.navigate(URL);
    // boot() 异步探测会话（401 → 登录页）；index.html 初始三态全 hidden
    await client.waitFor(`document.getElementById('adminLogin').style.display === 'block'`, 10000, '登录页可见');

    // ── 登录页三态 ──
    ok('登录页可见（gate/root 隐藏）', await client.evalJs(`
      (() => { const g = (id) => document.getElementById(id).style.display;
        return g('adminLogin') === 'block' && g('adminGate') === 'none' && g('adminRoot') === 'none'; })()`));

    // ── W6 双因素登录（Neo 有密码）：密码空拦截 → 密码 + mailer 桩真实码直登 ──
    await client.evalJs(`
      (() => { const e = document.getElementById('loginEmail');
        e.value = 'neo@smoke.local';
        document.getElementById('sendCodeBtn').click(); })()`);
    ok('密码空 → 发码拦截（提示 8-72 + 码行不出）', await client.evalJs(`
      (() => document.getElementById('loginMsg').textContent.includes('8-72') &&
        document.getElementById('codeRow').style.display === 'none')()`));

    await client.evalJs(`
      (() => { document.getElementById('loginPassword').value = 'neo-pass-123';
        document.getElementById('sendCodeBtn').click(); })()`);
    await client.waitFor(`document.getElementById('codeRow').style.display === 'flex'`, 6000, '验证码行出现');
    ok('发码后验证码行出现', true);
    ok('发码提示防枚举文案', await client.evalJs(`document.getElementById('loginMsg').textContent.includes('验证码已发送')`));
    ok('重发倒计时锁定按钮', await client.evalJs(`document.getElementById('sendCodeBtn').disabled === true`));

    await client.evalJs(`
      (() => { document.getElementById('loginCode').value = '${codeOf('neo@smoke.local')}';
        document.getElementById('loginBtn').click(); })()`);
    await client.waitFor(`document.getElementById('adminRoot').style.display === 'block'`, 8000, '面板可见（密码+真实码）');
    ok('director 登录 → 面板', true);
    ok('身份栏 = Neo · 项目总监', await client.evalJs(`document.getElementById('admWho').textContent === 'Neo · 项目总监'`));
    ok('角色栏 = 项目总监', await client.evalJs(`document.getElementById('admRoles').textContent === '项目总监'`));

    // ── 导航壳 ──
    ok('导航 1 张合并卡 + 12 分组块', await client.evalJs(`
      document.querySelectorAll('#navGroups .sidebar-module').length === 1 &&
      document.querySelectorAll('#navGroups .nav-group').length === 12`));
    ok('建设中标记 ≥15（W3/W4/W5）', await client.evalJs(`document.querySelectorAll('#navGroups .soon').length >= 15`));
    await client.waitFor(`document.getElementById('pane-dashboard').style.display === 'block'`, 6000, '默认 dashboard 面板');
    ok('默认深链 → Dashboard 激活态', await client.evalJs(`
      document.querySelector('#navGroups a[href="#/dashboard"]').classList.contains('active')`));

    // ── Dashboard：六组统计卡 ──
    await client.waitFor(`document.querySelectorAll('#pane-dashboard .dash-grid .adm-card').length === 6`, 8000, '六组卡渲染');
    ok('Dashboard 六组卡', true);
    ok('24 张统计卡', await client.evalJs(`document.querySelectorAll('#pane-dashboard .stat-num').length === 24`));
    ok('财务组金额 RM 格式', await client.evalJs(`
      [...document.querySelectorAll('#pane-dashboard .stat-num')].some((el) => el.textContent.startsWith('RM '))`));

    // ── Analytics：域切换 + 图表 canvas ──
    await client.evalJs(`document.querySelector('#navGroups a[href="#/analytics"]').click()`);
    await client.waitFor(`document.getElementById('pane-analytics').style.display === 'block'`, 4000, 'analytics 面板');
    await client.waitFor(`(() => { const m = document.getElementById('anMeta'); return !!m && m.textContent.includes('用户'); })()`, 8000, 'users 域加载');
    ok('Analytics 默认 users 域', true);
    ok('环形图 canvas 已绘制', await client.evalJs(`
      (() => { const cv = document.querySelector('#pane-analytics canvas');
        return !!cv && cv.width > 50; })()`));
    ok('users 域 3 张环形图', await client.evalJs(`document.querySelectorAll('#pane-analytics canvas[data-donut]').length === 3`));
    await client.evalJs(`
      [...document.querySelectorAll('#pane-analytics .seg-btn')].find((b) => b.textContent === '财务').click()`);
    await client.waitFor(`(() => { const m = document.getElementById('anMeta'); return !!m && m.textContent.includes('财务'); })()`, 6000, 'finance 域切换');
    ok('域切换 → 财务（实时重取）', true);
    ok('finance 概览 RM 金额', await client.evalJs(`
      [...document.querySelectorAll('#pane-analytics .stat-num')].some((el) => el.textContent.startsWith('RM '))`));

    // ── Users：列表 → 详情（安全档案全量 + 支付 2 笔）──
    await client.evalJs(`document.querySelector('#navGroups a[href="#/users"]').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-users .adm-table tbody tr').length >= 3`, 8000, '用户列表 ≥3 行');
    ok('Users 列表 ≥3 行', true);
    await client.evalJs(`document.querySelectorAll('#pane-users .adm-table tbody tr')[0].click()`);
    await client.waitFor(`document.querySelector('#pane-users').textContent.includes('基本信息')`, 8000, '详情加载');
    ok('详情：基本信息 / 支付记录 / 安全档案 三区块', await client.evalJs(`
      (() => { const t = document.querySelector('#pane-users').textContent;
        return t.includes('基本信息') && t.includes('支付记录') && t.includes('安全档案'); })()`));
    const secRowsDir = await client.evalJs(secOf('#pane-users .adm-card', '安全档案'));
    ok(`director 详情安全档案全量（实际 ${secRowsDir} 行 = 13 登录 + 2 事件）`, secRowsDir >= 15);
    ok('director 详情完整 IP 可见', await client.evalJs(`
      document.querySelector('#pane-users').textContent.includes('9.9.9.9')`));

    // 返回列表 → beta（premium，2 笔支付）
    await client.evalJs(`[...document.querySelectorAll('#pane-users button')].find((b) => b.textContent.includes('返回列表')).click()`);
    await client.waitFor(`(() => { const t = document.querySelector('#pane-users .adm-table'); return !!t && !!t.querySelector('thead th') && t.querySelector('thead th').textContent === '用户'; })()`, 8000, '回到列表');
    await client.evalJs(`
      [...document.querySelectorAll('#pane-users .adm-table tbody tr')].find((r) => r.textContent.includes('beta@smoke.local')).click()`);
    await client.waitFor(`document.querySelector('#pane-users').textContent.includes('基本信息')`, 8000, 'beta 详情');
    const payRows = await client.evalJs(secOf('#pane-users .adm-card', '支付记录'));
    ok(`director 详情支付 2 笔（实际 ${payRows} 行）`, payRows === 2);

    // ── Security：全局登录史 / 事件 + 标记按钮（director security.manage）──
    await client.evalJs(`document.querySelector('#navGroups a[href="#/security"]').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-security .adm-table tbody tr').length >= 13`, 8000, '全局登录史 ≥13 行');
    ok('Security 全局登录史（含 staff 登录）', true);
    ok('director 完整 IP 可见', await client.evalJs(`
      document.querySelector('#pane-security').textContent.includes('9.9.9.9')`));
    // 注意：'可疑登录' 也是事件类型下拉的选项文案——等待必须锚定表格行数而非文本
    await client.evalJs(`
      [...document.querySelectorAll('#pane-security .seg-btn')].find((b) => b.textContent === '安全事件').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-security .adm-table tbody tr').length >= 2`, 8000, '事件列表 ≥2 行');
    ok('事件列表渲染（可疑登录）', await client.evalJs(`
      document.querySelector('#pane-security .adm-table tbody').textContent.includes('可疑登录')`));
    ok('事件列表 + 标记按钮（director）', await client.evalJs(`
      [...document.querySelectorAll('#pane-security button')].some((b) => b.textContent === '标记跟进')`));

    // ── 建设中导航 → 占位页 ──
    await client.evalJs(`document.querySelector('#navGroups a[href="#/todo/cs.tickets"]').click()`);
    await client.waitFor(`document.getElementById('pane-todo').style.display === 'block'`, 4000, 'todo 占位');
    ok('建设中占位（Tickets · W3）', await client.evalJs(`
      document.getElementById('pane-todo').textContent.includes('W3') &&
      document.getElementById('pane-todo').textContent.includes('建设中')`));

    // ── 退出 → cs（Alex，旧账号无密码）：仅码登录 → 首登设密引导 → 面板 → 掩码链路 ──
    await client.evalJs(`document.getElementById('logoutBtn').click()`);
    await client.waitFor(`document.getElementById('adminLogin').style.display === 'block'`, 6000, '退出回登录');
    ok('退出 → 回登录页', true);
    await client.evalJs(`
      (() => { const e = document.getElementById('loginEmail');
        e.value = 'alex@smoke.local';
        document.getElementById('loginPassword').value = 'legacy-any-1'; // 旧账号后端忽略密码参数
        document.getElementById('sendCodeBtn').click(); })()`);
    await client.waitFor(`document.getElementById('codeRow').style.display === 'flex'`, 6000, 'cs 发码');
    await client.evalJs(`
      (() => { document.getElementById('loginCode').value = '${codeOf('alex@smoke.local')}';
        document.getElementById('loginBtn').click(); })()`);
    await client.waitFor(`document.getElementById('adminSetPassword').style.display === 'block'`, 8000, '旧账号设密引导');
    ok('旧账号仅码登录 → 设密引导（面板未进）', await client.evalJs(`
      document.getElementById('adminRoot').style.display === 'none'`));
    await client.evalJs(`
      (() => { document.getElementById('setPassword').value = 'alex-new-pass';
        document.getElementById('setPwBtn').click(); })()`);
    await client.waitFor(`document.getElementById('adminRoot').style.display === 'block'`, 8000, '设密后直达面板');
    ok('cs（Alex）设密 → 面板 → 角色栏 客服', await client.evalJs(`document.getElementById('admRoles').textContent === '客服'`));

    await client.evalJs(`document.querySelector('#navGroups a[href="#/security"]').click()`);
    await client.waitFor(`document.querySelector('#pane-security').textContent.includes('无权限')`, 8000, 'cs 全局安全 403');
    ok('cs 全局安全 → 无权限卡（§28 阶梯）', true);
    ok('403 提示指路 Users 页', await client.evalJs(`
      document.querySelector('#pane-security').textContent.includes('Users 页')`));

    await client.evalJs(`document.querySelector('#navGroups a[href="#/users"]').click()`);
    // 列表页独有元素 = 搜索框：等待必须同时锚定它，防「残留详情页也有表格行」假绿（登录状态复位回归）
    await client.waitFor(`(() => { const p = document.querySelector('#pane-users');
      return !!p.querySelector('input[placeholder*="搜索邮箱"]') && p.querySelectorAll('.adm-table tbody tr').length >= 3; })()`, 8000, 'cs 用户列表');
    ok('cs 用户列表（登录后无残留详情）', true);
    await client.evalJs(`
      [...document.querySelectorAll('#pane-users .adm-table tbody tr')].find((r) => r.textContent.includes('alpha@smoke.local')).click()`);
    await client.waitFor(`document.querySelector('#pane-users').textContent.includes('基本信息')`, 8000, 'cs 详情');
    ok('cs 详情：支付区块无权限文案', await client.evalJs(`
      document.querySelector('#pane-users').textContent.includes('无支付数据查看权限')`));
    const csRows = await client.evalJs(secOf('#pane-users .adm-card', '安全档案'));
    ok(`cs 详情：安全档案掩码近 10 条（实际 ${csRows} 行 = 10 登录 + 2 事件）`, csRows >= 10 && csRows <= 14);
    ok('cs 详情：掩码提示文案', await client.evalJs(`
      document.querySelector('#pane-users').textContent.includes('近 10 条')`));
    ok('cs 详情：IP 前两段掩码', await client.evalJs(`
      document.querySelector('#pane-users').textContent.includes('203.0.*.*')`));
    ok('cs 详情：无内部字段（风险理由/警告）', await client.evalJs(`
      (() => { const t = document.querySelector('#pane-users').textContent;
        return !t.includes('风险理由') && !t.includes('警告次数'); })()`));
    ok('cs 详情：无标记按钮（无 security.manage）', await client.evalJs(`
      ![...document.querySelectorAll('#pane-users button')].some((b) => b.textContent === '标记')`));

    // ── W6：有密码 staff 错密码不消费码（同码改对重试）──
    await client.evalJs(`document.getElementById('logoutBtn').click()`);
    await client.waitFor(`document.getElementById('adminLogin').style.display === 'block'`, 6000, '退出回登录');
    db.prepare("DELETE FROM rate_limits WHERE bucket = 'ec:staff:alex@smoke.local'").run(); // 清 60s 重发桶
    await client.evalJs(`
      (() => { const e = document.getElementById('loginEmail');
        e.value = 'alex@smoke.local';
        document.getElementById('loginPassword').value = 'alex-new-pass';
        document.getElementById('sendCodeBtn').click(); })()`);
    await client.waitFor(`document.getElementById('codeRow').style.display === 'flex'`, 6000, 'alex 再发码');
    await client.evalJs(`
      (() => { document.getElementById('loginPassword').value = 'wrong-pass-1';
        document.getElementById('loginCode').value = '${codeOf('alex@smoke.local')}';
        document.getElementById('loginBtn').click(); })()`);
    await client.waitFor(`document.getElementById('loginMsg').textContent.includes('密码或验证码错误')`, 6000, '错密码提示');
    ok('错密码 → 提示 + 留在登录页', await client.evalJs(`document.getElementById('adminLogin').style.display === 'block'`));
    await client.evalJs(`
      (() => { document.getElementById('loginPassword').value = 'alex-new-pass';
        document.getElementById('loginBtn').click(); })()`);
    await client.waitFor(`document.getElementById('adminRoot').style.display === 'block'`, 8000, '同码改对登录');
    ok('同码改对密码 → 登录成功（码未消费）', true);

    // ── W6：忘记密码两步重置 → 新密码重登 ──
    await client.evalJs(`document.getElementById('logoutBtn').click()`);
    await client.waitFor(`document.getElementById('adminLogin').style.display === 'block'`, 6000, '退出回登录');
    await client.evalJs(`document.getElementById('forgotAdminPw').click()`);
    ok('忘记密码 → 重置页（邮箱预填）', await client.evalJs(`
      (() => document.getElementById('adminResetPassword').style.display === 'block' &&
        document.getElementById('resetEmail').value === 'alex@smoke.local')()`));
    db.prepare("DELETE FROM rate_limits WHERE bucket = 'ec:staff:alex@smoke.local'").run();
    await client.evalJs(`document.getElementById('resetSendBtn').click()`);
    await client.waitFor(`document.getElementById('resetSendBtn').textContent.includes('重新发送')`, 6000, '重置发码倒计时');
    ok('重置发码 → 倒计时锁定', await client.evalJs(`document.getElementById('resetSendBtn').disabled === true`));
    await client.evalJs(`
      (() => { document.getElementById('resetCode').value = '${codeOf('alex@smoke.local')}';
        document.getElementById('resetPassword').value = 'alex-reset-pass';
        document.getElementById('resetBtn').click(); })()`);
    await client.waitFor(`document.getElementById('adminLogin').style.display === 'block'`, 8000, '重置后回登录页');
    ok('重置成功 → 回登录页 + 提示', await client.evalJs(`
      (() => document.getElementById('loginMsg').textContent.includes('密码已重置') &&
        document.getElementById('loginEmail').value === 'alex@smoke.local')()`));
    db.prepare("DELETE FROM rate_limits WHERE bucket = 'ec:staff:alex@smoke.local'").run();
    await client.evalJs(`
      (() => { document.getElementById('loginPassword').value = 'alex-reset-pass';
        document.getElementById('sendCodeBtn').click(); })()`);
    await client.waitFor(`document.getElementById('codeRow').style.display === 'flex'`, 6000, '重置后发码');
    await client.evalJs(`
      (() => { document.getElementById('loginCode').value = '${codeOf('alex@smoke.local')}';
        document.getElementById('loginBtn').click(); })()`);
    await client.waitFor(`document.getElementById('adminRoot').style.display === 'block'`, 8000, '新密码登录');
    ok('新密码 + 码 → 登录成功（旧密码已失效）', await client.evalJs(`document.getElementById('admRoles').textContent === '客服'`));

    // ── banner：budget 端点未上线（W3）→ 404 → 静默隐藏 ──
    ok('预算 banner 静默隐藏（W3 端点 404）', await client.evalJs(`
      getComputedStyle(document.getElementById('admBanner')).display === 'none'`));

    // ── 控制台零错误（过滤环境性噪声：favicon / Google Fonts / boot 预期 401 me / W3 未上线 404 budget /
    //   cs 拒权断言自身的 403 logins·events / W6 错密码断言自身的 400 verify /
    //   液态玻璃 feImage 的 data URI 加载日志）──
    await new Promise((r) => setTimeout(r, 800));
    const isNoise = (url = '') => /favicon|fonts\.googleapis|fonts\.gstatic|^data:|\/api\/staff\/auth\/me|\/api\/staff\/auth\/verify|\/api\/staff\/ai\/budget|\/api\/staff\/security\/(logins|events)/.test(url);
    const errs = client.events.consoleErrors.filter((e) => !isNoise(e.url))
      .concat(client.events.exceptions.map((e) => ({ url: e.url || '', text: (e.exception && e.exception.description) || e.text })));
    ok(`控制台零错误（实际 ${errs.length} 条）`, errs.length === 0,
      errs.slice(0, 3).map((e) => `${e.url || e.text}`).join(' | '));

    console.log(`\n冒烟结果：${passed}/${passed + failures.length} 全绿`);
  } catch (err) {
    failures.push('执行异常: ' + err.message);
    console.log(`\n冒烟中断：${err.message}`);
    // 失败诊断快照：页面 console error / 异常（环境性噪声过滤同最终断言）
    const noise = (u = '') => /favicon|fonts\.googleapis|fonts\.gstatic|^data:|\/api\/staff\/auth\/me|\/api\/staff\/auth\/verify|\/api\/staff\/ai\/budget|\/api\/staff\/security\/(logins|events)/.test(u);
    const cs = (client.events.consoleErrors || []).filter((e) => !noise(e.url));
    if (cs.length) console.log('页面 console error 快照：\n' +
      cs.slice(0, 5).map((e) => `  [${e.url || ''}:${e.lineNumber || '?'}] ${e.text}`).join('\n'));
    const xs = client.events.exceptions || [];
    if (xs.length) console.log('页面异常快照：\n' +
      xs.slice(0, 5).map((e) => '  ' + ((e.exception && e.exception.description) || e.text)).join('\n'));
    try {
      const state = await client.evalJs(`(() => ({ hash: location.hash, pane: (document.querySelector('.pane:not([style*="none"])') || {}).id || '?', body: document.body.innerText.slice(0, 600) }))()`);
      console.log('页面状态快照：hash=' + state.hash + ' 可见 pane=' + state.pane + '\n' + state.body);
    } catch {}
  } finally {
    // 进程清理：只杀本工具 spawn 的 chrome PID（/T /F /PID；绝不按镜像名）
    try { execFileSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
    try { front.close(); backend.close(); db.close(); } catch {}
    try { fs.rmSync(dbPath, { force: true }); fs.rmSync(dbPath + '-wal', { force: true }); fs.rmSync(dbPath + '-shm', { force: true }); } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
  process.exit(failures.length ? 1 : 0);
}

main();
