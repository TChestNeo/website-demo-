// tmp-probe-wow-admin.js — 管理后台 mono 暗色白底白字真实态扫描：临时库+种子+真后端+静态代理（smoke-admin 拓扑）
// → slati_settings {dark, mono} 先注入 → 登录页扫描 → 真实登录（密码+mailer 桩码）→ 面板各区块
// （Dashboard/Analytics 用户·财务/Users 列表+详情/Security 登录史+事件/忘记密码视图）逐态跑 wow2 扫描器
// （全 DOM+宽阈值+隐藏标记）。JS 渲染按钮/真实数据态全覆盖。
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const vm = require('node:vm');

const { openDb } = require('./src/db');
const { createServer } = require('./src/server');
const config = require('./src/config');
const { createStaff, assignRole } = require('./src/middleware/staff-auth');
const { hashPassword } = require('./src/password');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('未找到 Chrome/Edge');
}

// wow2 扫描器：从 tmp-probe-wow2.js 里原样提取（单一来源，口径一致）
// 注意：必须拿「解释后的字符串值」（模板字面量转义已生效），不能拿原始源码——否则 \\d 在页面里变成匹配反斜杠字符
const SCANNER = vm.runInNewContext(
  '(' + fs.readFileSync(path.join(__dirname, 'tmp-probe-wow2.js'), 'utf8')
    .match(/const SCANNER = (`[\s\S]*?`);/)[1] + ')'
);

// ── 种子（与 smoke-admin.js 同口径）──
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

// ── CDP 最小客户端（Node 24 全局 WebSocket；与 smoke-admin.js 同款）──
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
  let ws;
  async function connect() {
    ws = new WebSocket(await wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    };
    send('Runtime.enable'); send('Page.enable');
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
  async function waitFor(expression, timeoutMs = 8000, what = expression) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evalJs(expression)) return; } catch {}
      await new Promise((r) => setTimeout(r, 120));
    }
    throw new Error('等待超时: ' + what);
  }
  return { connect, send, evalJs, waitFor };
}

async function main() {
  console.log('wow-admin：启动…');

  const dbPath = path.join(os.tmpdir(), `wow-admin-${process.pid}.db`);
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
  const profile = path.join(os.tmpdir(), `wow-admin-profile-${process.pid}`);
  const chrome = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--disable-extensions',
    '--window-size=1280,900',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: 'ignore' });

  const client = cdp(cdpPort);
  try {
    await client.connect();
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify({ theme: 'dark', accent: 'mono' })) + ');}catch(e){}'
    });
    const URL = `http://127.0.0.1:${frontPort}/admin/index.html`;
    await client.send('Page.navigate', { url: URL });
    await client.waitFor(`document.getElementById('adminLogin').style.display === 'block'`, 10000, '登录页');
    await client.waitFor(`document.documentElement.getAttribute('data-accent') === 'mono' && document.documentElement.getAttribute('data-theme') === 'dark'`, 6000, 'mono 暗色生效');
    await new Promise((r) => setTimeout(r, 600));

    const scanState = async (label) => {
      const json = await client.evalJs(SCANNER);
      const arr = JSON.parse(json);
      const vis = arr.filter(x => !x.hidden).length;
      const hid = arr.filter(x => x.hidden).length;
      console.log('\n═══ ' + label + '：' + arr.length + ' 处（可见 ' + vis + ' / 隐藏 ' + hid + '）═══');
      for (const o of arr) {
        console.log('  [' + (o.hidden ? '藏' : '见') + '] <' + o.tag + (o.id ? '#' + o.id : '') + (o.cls ? '.' + o.cls : '') + '> fgL=' + o.fgL + ' bgL=' + o.bgL + ' src=' + o.bgSrc + ' “' + o.txt + '”');
      }
    };

    // ① 登录页态（sendCodeBtn/loginBtn/setPwBtn 等按钮族）
    await scanState('登录页');
    // ② 忘记密码视图态
    await client.evalJs(`document.getElementById('forgotAdminPw').click()`);
    await client.waitFor(`document.getElementById('adminResetPassword').style.display === 'block'`, 6000, '重置页');
    await new Promise((r) => setTimeout(r, 400));
    await scanState('忘记密码视图');
    await client.evalJs(`document.getElementById('resetBackBtn') && document.getElementById('resetBackBtn').click()`);
    await new Promise((r) => setTimeout(r, 300));

    // ── 真实登录：密码 + mailer 桩码 ──
    await client.evalJs(`
      (() => { document.getElementById('loginEmail').value = 'neo@smoke.local';
        document.getElementById('loginPassword').value = 'neo-pass-123';
        document.getElementById('sendCodeBtn').click(); })()`);
    await client.waitFor(`document.getElementById('codeRow').style.display === 'flex'`, 6000, '验证码行');
    await client.evalJs(`
      (() => { document.getElementById('loginCode').value = '${codeOf('neo@smoke.local')}';
        document.getElementById('loginBtn').click(); })()`);
    await client.waitFor(`document.getElementById('adminRoot').style.display === 'block'`, 8000, '面板可见');

    // ③ Dashboard（六组卡已渲染）
    await client.waitFor(`document.querySelectorAll('#pane-dashboard .dash-grid .adm-card').length === 6`, 8000, '六组卡');
    await new Promise((r) => setTimeout(r, 600));
    await scanState('Dashboard');

    // ④ Analytics users 域
    await client.evalJs(`document.querySelector('#navGroups a[href="#/analytics"]').click()`);
    await client.waitFor(`document.getElementById('pane-analytics').style.display === 'block'`, 4000, 'analytics 面板');
    await client.waitFor(`(() => { const m = document.getElementById('anMeta'); return !!m && m.textContent.includes('用户'); })()`, 8000, 'users 域');
    await new Promise((r) => setTimeout(r, 600));
    await scanState('Analytics 用户');
    // ⑤ 财务域（.seg-btn 切换）
    await client.evalJs(`[...document.querySelectorAll('#pane-analytics .seg-btn')].find((b) => b.textContent === '财务').click()`);
    await client.waitFor(`(() => { const m = document.getElementById('anMeta'); return !!m && m.textContent.includes('财务'); })()`, 6000, '财务域');
    await new Promise((r) => setTimeout(r, 600));
    await scanState('Analytics 财务');

    // ⑥ Users 列表
    await client.evalJs(`document.querySelector('#navGroups a[href="#/users"]').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-users .adm-table tbody tr').length >= 3`, 8000, '用户列表');
    await new Promise((r) => setTimeout(r, 600));
    await scanState('Users 列表');
    // ⑦ Users 详情（基本信息/支付记录/安全档案）
    await client.evalJs(`document.querySelectorAll('#pane-users .adm-table tbody tr')[0].click()`);
    await client.waitFor(`document.querySelector('#pane-users').textContent.includes('基本信息')`, 8000, '详情');
    await new Promise((r) => setTimeout(r, 600));
    await scanState('Users 详情');

    // ⑧ Security 登录史
    await client.evalJs(`document.querySelector('#navGroups a[href="#/security"]').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-security .adm-table tbody tr').length >= 13`, 8000, '登录史');
    await new Promise((r) => setTimeout(r, 600));
    await scanState('Security 登录史');
    // ⑨ Security 事件（标记跟进按钮态）
    await client.evalJs(`[...document.querySelectorAll('#pane-security .seg-btn')].find((b) => b.textContent === '安全事件').click()`);
    await client.waitFor(`document.querySelectorAll('#pane-security .adm-table tbody tr').length >= 2`, 8000, '事件列表');
    await new Promise((r) => setTimeout(r, 600));
    await scanState('Security 事件');

    // ⑩ 按钮清单（全面板可见按钮：bg/color/filter/子元素 filter/内部结构——过滤豁免会跳过整批图标按钮，逐个查）
    console.log('\n═══ 面板按钮清单 =═══');
    console.log(await client.evalJs(`
      (() => {
        const btns = [...document.querySelectorAll('#adminRoot button')].filter((b) => b.offsetParent !== null);
        return JSON.stringify(btns.map((b) => {
          const s = getComputedStyle(b);
          const kids = [...b.children].map((k) => {
            const ks = getComputedStyle(k);
            return k.tagName + '.' + (k.className.baseVal !== undefined ? k.className.baseVal : k.className) +
              '{color:' + ks.color + ',filter:' + (ks.filter || 'none') + '}';
          }).join('|');
          return {
            id: b.id, cls: (b.className.baseVal !== undefined ? b.className.baseVal : b.className),
            txt: b.textContent.trim().slice(0, 12),
            bg: s.backgroundColor, color: s.color, filter: s.filter || 'none',
            pseudoB: getComputedStyle(b, '::before').filter || 'none',
            pseudoA: getComputedStyle(b, '::after').filter || 'none',
            html: b.innerHTML.replace(/\\s+/g, ' ').slice(0, 90),
            kids: kids
          };
        }), null, 1);
      })()`));
    // ⑪ 顶栏按钮态
    console.log('\n═══ 顶栏按钮态 =═══');
    console.log('logoutBtn computed: ' + await client.evalJs(`
      (() => { const b = document.getElementById('logoutBtn');
        if (!b) return 'MISSING';
        const s = getComputedStyle(b);
        return JSON.stringify({bg: s.backgroundColor, color: s.color, display: s.display, visibility: s.visibility, filter: s.filter || 'none', html: b.innerHTML.replace(/\\s+/g, ' ').slice(0, 120)}); })()`));
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    process.exitCode = 1;
  } finally {
    try { execFileSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
    try { front.close(); backend.close(); db.close(); } catch {}
    try { fs.rmSync(dbPath, { force: true }); fs.rmSync(dbPath + '-wal', { force: true }); fs.rmSync(dbPath + '-shm', { force: true }); } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
  process.exit(process.exitCode || 0);
}
main();
