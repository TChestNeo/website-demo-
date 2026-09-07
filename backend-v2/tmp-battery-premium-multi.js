'use strict';
// tmp-battery-premium-multi.js — v0.2.13.0 年付轮 premium 页 locale→币种电池（2026-09-04，tmp 绝不 commit）
// 逐 locale 断言（线上或本地 --base）：
//   window.SlatiPrice.currency / 月付方案价渲染（innerText 命中期望串 + 排除异币 sentinel）
//   v0.2.13.0 年付：yearPrice/yearPerMonth('premium') = yP/ymP 期望值（yP 逐币字面量双校验）、
//   innerText 无「单次」无「1 个月」、5 个 [data-plan-once] 静态标签 = 每年支付、0 页脚本异常。
// 期望网格（纸上先算）：月付行 usd $11.99 myr RM23.50 gbp £9.99 sgd S$15.99 php ₱311.99 eur €11.00
//   jpy ¥1,800 krw ₩16,000 thb ฿186.99；年付行（yP premium / ymP premium）见 S 表；en-NZ → usd 兜底。
// 用法：node tmp-battery-premium-multi.js [--base http://127.0.0.1:8000] [--chrome <chrome.exe>]
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const aB = process.argv.indexOf('--base');
const BASE = (aB !== -1 && process.argv[aB + 1]) || 'https://mnationworld.com';
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

// ── CDP 最小客户端（同 smoke-admin.js 模式）──
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
    setTimeout(() => { clearInterval(tries); reject(new Error('CDP 超时')); }, 20000);
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
    send('Log.enable'); send('Runtime.enable'); send('Page.enable');
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
  async function waitFor(expression, timeoutMs = 10000, what = expression) {
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
  return { connect, send, evalJs, waitFor, navigate, events };
}

let passed = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures.push(name + (detail ? ' — ' + detail : '')); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function main() {
  console.log('premium 多币年付电池：启动中… base=' + BASE);
  const cdpPort = 9400 + Math.floor(Math.random() * 300);
  const profile = path.join(os.tmpdir(), `premium-multi-profile-${process.pid}`);
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--disable-extensions',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: 'ignore' });
  const client = cdp(cdpPort);
  try {
    await client.connect();
    const URL = BASE + '/pages/premium.html';
    // 场景：{ 名, locale, tz, 期望币, 月付 has/no, 年付 yT（yP premium）, ym（ymP premium）, 月付对照 mp }
    const S = [
      { n: 'en-US → usd', loc: 'en-US', tz: 'America/Los_Angeles', cur: 'usd', has: '$11.99', no: 'RM23.50', yT: '$119.99', ym: '$10.00', mp: '$11.99' },
      { n: 'ms-MY → myr（回归）', loc: 'ms-MY', tz: 'Asia/Kuala_Lumpur', cur: 'myr', has: 'RM23.50', no: '$11.99', yT: 'RM235', ym: 'RM19.58', mp: 'RM23.50' },
      { n: 'en-GB → gbp', loc: 'en-GB', tz: 'Europe/London', cur: 'gbp', has: '£9.99', no: '€11.00', yT: '£99.99', ym: '£8.33', mp: '£9.99' },
      { n: 'en-SG → sgd（新分支）', loc: 'en-SG', tz: 'Asia/Singapore', cur: 'sgd', has: 'S$15.99', no: 'A$18.99', yT: 'S$159.99', ym: 'S$13.33', mp: 'S$15.99' },
      { n: 'en-PH → php（新分支）', loc: 'en-PH', tz: 'Asia/Manila', cur: 'php', has: '₱311.99', no: '฿186.99', yT: '₱3,119.99', ym: '₱260.00', mp: '₱311.99' },
      { n: 'de-DE → eur（EU 时区兜底）', loc: 'de-DE', tz: 'Europe/Berlin', cur: 'eur', has: '€11.00', no: '£9.99', yT: '€110.00', ym: '€9.17', mp: '€11.00' },
      { n: 'ja-JP → jpy', loc: 'ja-JP', tz: 'Asia/Tokyo', cur: 'jpy', has: '¥1,800', no: '₩16,000', yT: '¥18,000', ym: '¥1,500', mp: '¥1,800' },
      { n: 'ko-KR → krw', loc: 'ko-KR', tz: 'Asia/Seoul', cur: 'krw', has: '₩16,000', no: '₹459.00', yT: '₩160,000', ym: '₩13,333', mp: '₩16,000' },
      { n: 'en-NZ → usd 兜底（非 16 币）', loc: 'en-NZ', tz: 'Pacific/Auckland', cur: 'usd', has: '$11.99', no: 'RM23.50', yT: '$119.99', ym: '$10.00', mp: '$11.99' },
      { n: 'th-TH → thb（弱币马币档）', loc: 'th-TH', tz: 'Asia/Bangkok', cur: 'thb', has: '฿186.99', no: '₱311.99', yT: '฿1,869.99', ym: '฿155.83', mp: '฿186.99' }
    ];
    for (const s of S) {
      await client.send('Emulation.setLocaleOverride', { locale: s.loc });
      await client.send('Emulation.setTimezoneOverride', { timezoneId: s.tz });
      await client.navigate(URL);
      await client.waitFor(`window.SlatiPrice && window.SlatiPrice.currency === '${s.cur}'`, 15000, s.n + ' SlatiPrice');
      const got = await client.evalJs(`(() => ({
        cur: window.SlatiPrice.currency,
        has: document.body.innerText.includes(${JSON.stringify(s.has)}),
        no: document.body.innerText.includes(${JSON.stringify(s.no)}),
        yearFn: window.yearPrice && window.yearPrice('premium') === ${JSON.stringify(s.yT)},
        ymFn: window.yearPerMonth && window.yearPerMonth('premium') === ${JSON.stringify(s.ym)},
        ypLit: window.yP && window.yP[${JSON.stringify(s.cur)}] && window.yP[${JSON.stringify(s.cur)}].premium === ${JSON.stringify(s.yT)},
        ymLit: window.ymP && window.ymP[${JSON.stringify(s.cur)}] && window.ymP[${JSON.stringify(s.cur)}].premium === ${JSON.stringify(s.ym)},
        noDanci: !document.body.innerText.includes('单次'),
        no1mo: !document.body.innerText.includes('1 个月')
      }))()`);
      ok(s.n + ' currency=' + got.cur, got.cur === s.cur, '实得 ' + got.cur);
      ok(s.n + ' 月付渲染含 ' + s.has, got.has === true, 'innerText 未命中');
      ok(s.n + ' 不渲染异币 ' + s.no, got.no === false, 'innerText 混入异币价');
      ok(s.n + ' 年付 yearPrice(premium)=' + s.yT, got.yearFn === true, '实得异值');
      ok(s.n + ' ymP yearPerMonth(premium)=' + s.ym, got.ymFn === true, '实得异值');
      ok(s.n + ' yP[' + s.cur + '] 字面量 premium=' + s.yT, got.ypLit === true, '字面量不符');
      ok(s.n + ' ymP[' + s.cur + '] 字面量 premium=' + s.ym, got.ymLit === true, '字面量不符');
      ok(s.n + ' 无「单次」口吻', got.noDanci === true, 'innerText 出现单次');
      ok(s.n + ' 无「1 个月」口吻', got.no1mo === true, 'innerText 出现 1 个月');
      // 按钮小字模板（guest 下按钮藏起不渲染，直接验函数产物 = setOnceBtn 拼串来源）
      const hint = await client.evalJs(`window.yearPerMonth('premium') ? '折合每月 ' + window.yearPerMonth('premium') + '/月（月付 ' + ${JSON.stringify(s.mp)} + '/月）' : ''`);
      ok(s.n + ' 折合每月提示模板命中', hint.indexOf('折合每月') === 0 && hint.indexOf(s.ym) !== -1, hint);
    }
    // 静态标签清扫：5 个 data-plan-once 按钮无论显隐 textContent 均为 每年支付（guest 只藏不写价）
    const onceLabels = await client.evalJs(`(() => { const els = document.querySelectorAll('[data-plan-once]'); return { n: els.length, bad: [...els].filter((b) => b.textContent !== '每年支付').map((b) => b.textContent) }; })()`);
    ok('5 个每年支付按钮静态标签（无单次残留）', onceLabels.n === 5 && onceLabels.bad.length === 0, JSON.stringify(onceLabels));
    // v0.2.13.1 回归：myr plan-note 真实方式 = 银行卡/GrabPay（status 回写或回退清单）——FPX/支付宝账户层不可用，
    // 页面不得再声称（曾致 MYR 每年支付 checkout 400 全死的活线 bug 类）
    await client.send('Emulation.setLocaleOverride', { locale: 'ms-MY' });
    await client.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Kuala_Lumpur' });
    await client.navigate(URL);
    await client.waitFor(`window.SlatiPrice && window.SlatiPrice.currency === 'myr'`, 15000, 'v0.2.13.1 回归 myr');
    await client.waitFor(`document.getElementById('planNote').innerText.indexOf('GrabPay') !== -1`, 10000, 'plan-note 含 GrabPay');
    const note = await client.evalJs(`document.getElementById('planNote').innerText`);
    ok('v0.2.13.1 plan-note 含 银行卡/GrabPay', note.indexOf('银行卡') !== -1 && note.indexOf('GrabPay') !== -1, note.slice(0, 120));
    ok('v0.2.13.1 plan-note 无 FPX/支付宝 口吻（账户不可用不再声称）', note.indexOf('FPX') === -1 && note.indexOf('支付宝') === -1, note.slice(0, 120));
    // [data-slati-price] 角标 autofill（community-hub，pricing.js 尾段）
    for (const s of [
      { n: 'hub en-GB 角标 = £9.99', loc: 'en-GB', tz: 'Europe/London', want: '£9.99' },
      { n: 'hub ms-MY 角标 = RM23.50', loc: 'ms-MY', tz: 'Asia/Kuala_Lumpur', want: 'RM23.50' }
    ]) {
      await client.send('Emulation.setLocaleOverride', { locale: s.loc });
      await client.send('Emulation.setTimezoneOverride', { timezoneId: s.tz });
      await client.navigate(BASE + '/pages/community-hub.html');
      await client.waitFor(`window.SlatiPrice && window.SlatiPrice.currency !== undefined`, 15000, s.n + ' SlatiPrice');
      const r = await client.evalJs(`(() => {
        const els = document.querySelectorAll('[data-slati-price]');
        return { count: els.length, bad: [...els].filter((e) => e.textContent !== ${JSON.stringify(s.want)}).length };
      })()`);
      ok(s.n, r.count > 0 && r.bad === 0, `count=${r.count} bad=${r.bad}`);
    }
    const excAll = client.events.exceptions.length;
    ok('全程 0 页面脚本异常', excAll === 0, excAll + ' 个 Runtime.exceptionThrown');
    console.log(`════ premium 多币年付电池完成：${passed}/${passed + failures.length} 通过 ════`);
    if (failures.length) { console.log('失败：', failures.join(' | ')); process.exit(1); }
  } finally {
    try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
  }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
