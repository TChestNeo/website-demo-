// tmp-battery-admin-dark.js — 管理后台暗色「白底白字·尤其按钮」常驻电池（v0.2.49.3，用户二报 Request G）。
// 根因：裸 .btn（无 primary/secondary/outline/ghost）无背景规则 → Chrome UA buttonface 白底 + 继承浅字。
// 第一轮只修静态可见的 #gateLogoutBtn，登录后面板 JS 渲染的裸 .btn 全部漏网。
// 本电池 = smoke-admin 同拓扑（临时库+种子+真后端+静态代理+CDP 真实登录）→ mono 暗全区块 wow2 扫描器
// 零白底白字 + 裸 .btn 计算态断言（顶栏退出/标记跟进/启用分页）+ 蓝暗回归（规则 all accents 通用）+ 控制台零错误。
// 用法：node tmp-battery-admin-dark.js [--chrome <chrome.exe 路径>]
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawn, execFileSync } = require('node:child_process');

const { openDb } = require('./src/db');
const { createServer } = require('./src/server');
const config = require('./src/config');
const { createStaff, assignRole } = require('./src/middleware/staff-auth');
const { hashPassword } = require('./src/password');

const ROOT = path.join(__dirname, '..');
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

// wow2 扫描器：从 tmp-probe-wow2.js 原样提取（解释后的字符串值——vm 跑模板字面量，转义口径与原件一致）
const SCANNER = vm.runInNewContext(
  '(' + fs.readFileSync(path.join(__dirname, 'tmp-probe-wow2.js'), 'utf8')
    .match(/const SCANNER = (`[\s\S]*?`);/)[1] + ')'
);

// ── 种子（smoke-admin 同口径 + 15 用户凑出两页分页 → 启用态「下一页」按钮）──
async function seed(db) {
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const DAY = 86400e3;
  const ins = (sql, ...args) => db.prepare(sql).run(...args);

  const neo = createStaff(db, { email: 'neo@smoke.local', displayName: 'Neo', position: '项目总监', timezone: 'UTC+8', passwordHash: await hashPassword('neo-pass-123') });
  assignRole(db, neo.id, 'project_director');

  const insUser = (id, email, over = {}) => ins(`INSERT INTO users
    (id, email, display_name, tier, status, risk_level, last_active_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, email, over.name || email, over.tier || 'free', over.status || 'active', over.risk || 'low',
    over.lastActive || null, over.createdAt || iso(2 * DAY), iso(0));

  insUser('USR-S1', 'alpha@smoke.local', { name: 'Alpha', createdAt: iso(5 * DAY), lastActive: iso(3600e3) });
  insUser('USR-S2', 'beta@smoke.local', { tier: 'premium', createdAt: iso(6 * DAY), lastActive: iso(2 * 3600e3) });
  insUser('USR-S3', 'gamma@smoke.local', { status: 'banned', risk: 'high', createdAt: iso(9 * DAY) });
  for (let i = 0; i < 22; i++) {
    insUser('USR-N' + i, 'n' + i + '@smoke.local', { name: 'User N' + i, createdAt: iso((10 + i) * DAY) });
  }

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

  ins("INSERT INTO payments (id, user_id, tier_key, amount_micro, currency, status, created_at, paid_at) VALUES (?, ?, ?, ?, 'myr', 'paid', ?, ?)",
    'PAY-S1', 'USR-S2', 'premium', 2000000, iso(6 * DAY), iso(6 * DAY));
  ins("INSERT INTO payments (id, user_id, tier_key, amount_micro, currency, status, created_at, paid_at) VALUES (?, ?, ?, ?, 'myr', 'paid', ?, ?)",
    'PAY-S2', 'USR-S2', 'basic', 1000000, iso(20 * DAY), iso(20 * DAY));

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

  const today = iso(0).slice(0, 10);
  ins('INSERT OR IGNORE INTO activity_daily (user_id, date, last_seen_at) VALUES (?, ?, ?)', 'USR-S1', today, iso(0));
  ins('INSERT OR IGNORE INTO activity_daily (user_id, date, last_seen_at) VALUES (?, ?, ?)', 'USR-S2', today, iso(0));
  return { neo };
}

// ── 静态壳：docs/ 静态 + /api 代理（与 smoke-admin.js 同源拓扑）──
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

// ── CDP 最小客户端（含 console error / 异常收集）──
function cdp(port) {
  const wsUrl = new Promise((resolve, reject) => {
    const tries = setInterval(() => {
      http.get(`http://127.0.0.1:${port}/json/list`, (r) => {
        let b = '';
        r.on('data', (d) => b += d);
        r.on('end', () => {
          try {
            const list = JSON.parse(b);
            const page = list.find((t) => t.type === 'page');
            if (page) { clearInterval(tries); resolve(page.webSocketDebuggerUrl); }
          } catch {}
        });
      }).on('error', () => {});
    }, 150);
    setTimeout(() => { clearInterval(tries); reject(new Error('CDP 超时')); }, 20000);
  });

  let seq = 0;
  const pending = new Map();
  const events = { consoleErrors: [], exceptions: [] };
  let ws;
  async function connect() {
    ws = new WebSocket(await wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
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
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('页面脚本异常: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.value;
  }
  async function waitFor(expression, timeoutMs = 8000, what = expression) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evalJs(expression)) return; } catch {}
      await new Promise((r) => setTimeout(r, 120));
    }
    throw new Error('等待超时: ' + what);
  }
  return { connect, send, evalJs, waitFor, events };
}

// ── 断言 ──
let passed = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures.push(name + (detail ? ' — ' + detail : '')); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function main() {
  console.log('admin-dark：启动…');

  const dbPath = path.join(os.tmpdir(), `admin-dark-${process.pid}.db`);
  const db = openDb(dbPath);
  await seed(db);
  const mails = [];
  const codeOf = (email) => mails.filter((m) => m.email === email && m.opts && m.opts.purpose === 'staff_login').at(-1).code;
  const cfg = { ...config, databasePath: dbPath, nodeEnv: 'development' };
  const backend = createServer({ db, config: cfg, mailer: { sendCode: async (email, code, opts) => { mails.push({ email, code, opts }); } } });
  const backendPort = await new Promise((res) => backend.listen(0, '127.0.0.1', () => res(backend.address().port)));
  const front = serveStatic(backendPort);
  const frontPort = await new Promise((res) => front.listen(0, '127.0.0.1', () => res(front.address().port)));

  const cdpPort = 9300 + Math.floor(Math.random() * 400);
  const profile = path.join(os.tmpdir(), `admin-dark-profile-${process.pid}`);
  const chrome = spawn(CHROME, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--disable-extensions',
    '--window-size=1280,900',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: 'ignore' });

  const client = cdp(cdpPort);
  try {
    await client.connect();
    const monoScript = await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify({ theme: 'dark', accent: 'mono' })) + ');}catch(e){}'
    });
    const URL = `http://127.0.0.1:${frontPort}/admin/index.html`;
    await client.send('Page.navigate', { url: URL });
    await client.waitFor(`document.getElementById('adminLogin').style.display === 'block'`, 10000, '登录页');
    await client.waitFor(`document.documentElement.getAttribute('data-accent') === 'mono' && document.documentElement.getAttribute('data-theme') === 'dark'`, 6000, 'mono 暗色生效');
    ok('A0 mono 暗色生效（data-accent=mono + data-theme=dark）', true);
    await new Promise((r) => setTimeout(r, 500));

    const scan = async (label) => {
      const arr = JSON.parse(await client.evalJs(SCANNER));
      if (arr.length) {
        for (const o of arr) {
          console.log('    [' + (o.hidden ? '藏' : '见') + '] <' + o.tag + (o.id ? '#' + o.id : '') + (o.cls ? '.' + o.cls : '') + '> fgL=' + o.fgL + ' bgL=' + o.bgL + ' src=' + o.bgSrc + ' “' + o.txt + '”');
        }
      }
      return arr;
    };
    const okScan = async (label) => {
      const arr = await scan(label);
      ok(label + ' 白底白字 0 处', arr.length === 0, '实得 ' + arr.length + ' 处');
    };

    // ── mono 暗色：登录页 / 重置视图 ──
    await okScan('A1 登录页');
    await client.evalJs(`document.getElementById('forgotAdminPw').click()`);
    await client.waitFor(`document.getElementById('adminResetPassword').style.display === 'block'`, 6000, '重置页');
    await new Promise((r) => setTimeout(r, 400));
    await okScan('A2 忘记密码视图');
    await client.evalJs(`document.getElementById('resetBackBtn') && document.getElementById('resetBackBtn').click()`);
    await new Promise((r) => setTimeout(r, 300));

    // ── 真实登录（密码 + mailer 桩码）──
    await client.evalJs(`
      (() => { document.getElementById('loginEmail').value = 'neo@smoke.local';
        document.getElementById('loginPassword').value = 'neo-pass-123';
        document.getElementById('sendCodeBtn').click(); })()`);
    await client.waitFor(`document.getElementById('codeRow').style.display === 'flex'`, 6000, '验证码行');
    await client.evalJs(`
      (() => { document.getElementById('loginCode').value = '${codeOf('neo@smoke.local')}';
        document.getElementById('loginBtn').click(); })()`);
    await client.waitFor(`document.getElementById('adminRoot').style.display === 'block'`, 8000, '面板可见');
    ok('A3 真实登录 → 面板', true);

    // ── 面板各区块扫描（mono 暗）──
    await client.waitFor(`document.querySelectorAll('#pane-dashboard .dash-grid .adm-card').length === 6`, 8000, '六组卡');
    await new Promise((r) => setTimeout(r, 500));
    await okScan('A4 Dashboard');

    await client.evalJs(`document.querySelector('#navGroups a[href="#/analytics"]').click()`);
    await client.waitFor(`document.getElementById('pane-analytics').style.display === 'block'`, 4000, 'analytics 面板');
    await client.waitFor(`(() => { const m = document.getElementById('anMeta'); return !!m && m.textContent.includes('用户'); })()`, 8000, 'users 域');
    await new Promise((r) => setTimeout(r, 500));
    await okScan('A5 Analytics 用户');
    await client.evalJs(`[...document.querySelectorAll('#pane-analytics .seg-btn')].find((b) => b.textContent === '财务').click()`);
    await client.waitFor(`(() => { const m = document.getElementById('anMeta'); return !!m && m.textContent.includes('财务'); })()`, 6000, '财务域');
    await new Promise((r) => setTimeout(r, 500));
    await okScan('A6 Analytics 财务');

    await client.evalJs(`document.querySelector('#navGroups a[href="#/users"]').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-users .adm-table tbody tr').length >= 3`, 8000, '用户列表');
    await new Promise((r) => setTimeout(r, 500));
    await okScan('A7 Users 列表');
    // 15 用户 → 两页分页 → 「下一页」启用态（生产常态；禁用态是 UA 半透明样式另一回事）
    ok('A8 分页启用态（25 用户 → 两页）', await client.evalJs(`
      (() => { const b = [...document.querySelectorAll('#pane-users button')].find((x) => x.textContent === '下一页');
        return !!b && b.disabled === false; })()`));
    const pagerOkL = await client.evalJs(`
      (() => { const b = [...document.querySelectorAll('#pane-users button')].find((x) => x.textContent === '下一页');
        const s = getComputedStyle(b).backgroundColor;
        const m = s.match(/rgba?\\((\\d+(?:\\.\\d+)?)[, ]+(\\d+(?:\\.\\d+)?)[, ]+(\\d+(?:\\.\\d+)?)/);
        if (!m) return -1;
        return (Math.max(+m[1], +m[2], +m[3]) + Math.min(+m[1], +m[2], +m[3])) / 2 / 255; })()`);
    ok(`A9 启用分页「下一页」暗底（实得明度 ${pagerOkL.toFixed ? pagerOkL.toFixed(2) : pagerOkL}）`, pagerOkL !== -1 && pagerOkL < 0.5);
    await client.evalJs(`[...document.querySelectorAll('#pane-users button')].find((x) => x.textContent === '下一页').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-users .adm-table tbody tr').length >= 3`, 8000, '第二页');
    await new Promise((r) => setTimeout(r, 400));
    await okScan('A10 Users 第二页');
    // 回第一页（beta 在 created_desc 首页）
    await client.evalJs(`[...document.querySelectorAll('#pane-users button')].find((x) => x.textContent === '上一页').click()`);
    await client.waitFor(`[...document.querySelectorAll('#pane-users .adm-table tbody tr')].some((r) => r.textContent.includes('beta@smoke.local'))`, 8000, '回第一页');

    await client.evalJs(`[...document.querySelectorAll('#pane-users .adm-table tbody tr')].find((r) => r.textContent.includes('beta@smoke.local')).click()`);
    await client.waitFor(`document.querySelector('#pane-users').textContent.includes('基本信息')`, 8000, '详情');
    await new Promise((r) => setTimeout(r, 500));
    await okScan('A11 Users 详情');

    await client.evalJs(`document.querySelector('#navGroups a[href="#/security"]').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-security .adm-table tbody tr').length >= 13`, 8000, '登录史');
    await new Promise((r) => setTimeout(r, 500));
    await okScan('A12 Security 登录史');
    await client.evalJs(`[...document.querySelectorAll('#pane-security .seg-btn')].find((b) => b.textContent === '安全事件').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-security .adm-table tbody tr').length >= 2`, 8000, '事件列表');
    await new Promise((r) => setTimeout(r, 500));
    await okScan('A13 Security 事件');

    // ── 裸 .btn 计算态（根因断言：不再是 UA buttonface 白底 + 浅字）──
    const btnCheck = `(() => { const b = ${'__sel__'};
      const s = getComputedStyle(b);
      const m = s.backgroundColor.match(/rgba?\\((\\d+(?:\\.\\d+)?)[, ]+(\\d+(?:\\.\\d+)?)[, ]+(\\d+(?:\\.\\d+)?)/);
      if (!m) return JSON.stringify({ bgL: -1, color: s.color });
      return JSON.stringify({ bgL: (Math.max(+m[1], +m[2], +m[3]) + Math.min(+m[1], +m[2], +m[3])) / 2 / 255, color: s.color }); })()`;
    const chk = async (name, sel) => {
      const r = JSON.parse(await client.evalJs(btnCheck.replace('__sel__', sel)));
      ok(name + ' 暗底（明度 ' + (r.bgL === -1 ? '无底色' : r.bgL.toFixed(2)) + '）+ 浅字 ' + r.color,
        r.bgL !== -1 && r.bgL < 0.5, JSON.stringify(r));
    };
    await chk('A14 顶栏退出登录 #logoutBtn', `document.getElementById('logoutBtn')`);
    await chk('A15 事件标记跟进按钮', `[...document.querySelectorAll('#pane-security button')].find((x) => x.textContent === '标记跟进')`);
    await chk('A16 用户详情 ← 返回列表', `[...document.querySelectorAll('#pane-users button')].find((x) => x.textContent.includes('返回列表'))`);

    // ── 蓝暗回归：规则 all accents 通用（UA buttonface 通病非 mono 独有）──
    // 先移除 mono 预设注入脚本，否则每次新文档都会把 localStorage 覆写回 mono
    await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: monoScript.identifier });
    await client.evalJs(`localStorage.setItem('slati_settings', JSON.stringify({theme:'dark', accent:'blue'}))`);
    await client.evalJs('location.reload()');
    await client.waitFor(`document.getElementById('adminRoot').style.display === 'block'`, 8000, '蓝暗重载面板');
    {
      const t0 = Date.now();
      let last = '';
      while (Date.now() - t0 < 6000) {
        try {
          last = await client.evalJs(`JSON.stringify({ac: document.documentElement.getAttribute('data-accent'), th: document.documentElement.getAttribute('data-theme'), ls: localStorage.getItem('slati_settings'), ready: document.readyState})`);
          if (await client.evalJs(`(document.documentElement.getAttribute('data-accent') || 'blue') === 'blue' && document.documentElement.getAttribute('data-theme') === 'dark'`)) { last = ''; break; }
        } catch {}
        await new Promise((r) => setTimeout(r, 150));
      }
      if (last) console.log('蓝暗诊断: ' + last);
      ok('B0 蓝暗生效（accent=blue + data-theme=dark）', !last);
    }
    await new Promise((r) => setTimeout(r, 800));
    // 重载后深链恢复到 #/security（mono 段的最后区块）——显式回 Dashboard
    await client.evalJs(`document.querySelector('#navGroups a[href="#/dashboard"]').click()`);
    await client.waitFor(`document.getElementById('pane-dashboard').style.display === 'block'`, 4000, '蓝暗 dashboard 面板');
    await client.waitFor(`document.querySelectorAll('#pane-dashboard .dash-grid .adm-card').length === 6`, 8000, '蓝暗六组卡');
    await okScan('B1 蓝暗 Dashboard');
    await client.evalJs(`document.querySelector('#navGroups a[href="#/security"]').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-security .adm-table tbody tr').length >= 13`, 8000, '蓝暗登录史');
    await client.evalJs(`[...document.querySelectorAll('#pane-security .seg-btn')].find((b) => b.textContent === '安全事件').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-security .adm-table tbody tr').length >= 2`, 8000, '蓝暗事件');
    await new Promise((r) => setTimeout(r, 500));
    await okScan('B2 蓝暗 Security 事件');
    await chk('B3 蓝暗顶栏退出登录暗底', `document.getElementById('logoutBtn')`);

    // ── 控制台零错误（过滤环境性噪声：favicon / Google Fonts / boot 预期 401 me / W3 未上线 404 budget）──
    await new Promise((r) => setTimeout(r, 800));
    const isNoise = (url = '') => /favicon|fonts\.googleapis|fonts\.gstatic|^data:|\/api\/staff\/auth\/me|\/api\/staff\/ai\/budget/.test(url);
    const errs = client.events.consoleErrors.filter((e) => !isNoise(e.url))
      .concat(client.events.exceptions.map((e) => ({ url: e.url || '', text: (e.exception && e.exception.description) || e.text })));
    ok(`Z 控制台零错误（实际 ${errs.length} 条）`, errs.length === 0,
      errs.slice(0, 3).map((e) => `${e.url || e.text}`).join(' | '));

    console.log(`\nadmin-dark 结果：${passed}/${passed + failures.length} 全绿`);
  } catch (err) {
    failures.push('执行异常: ' + err.message);
    console.log(`\nadmin-dark 中断：${err.message}`);
  } finally {
    try { execFileSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
    try { front.close(); backend.close(); db.close(); } catch {}
    try { fs.rmSync(dbPath, { force: true }); fs.rmSync(dbPath + '-wal', { force: true }); fs.rmSync(dbPath + '-shm', { force: true }); } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
  process.exit(failures.length ? 1 : 0);
}
main();
