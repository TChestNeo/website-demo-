'use strict';
// tmp-cdp-i18n-live.js — 真浏览器验证 premium 页 i18n 生效：slati_lang=en/de 后重载，断言关键元素译文 + 无页面异常（tmp 绝不 commit）
const http = require('node:http');
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9621 + Math.floor(Math.random() * 100);
const BASE = 'http://127.0.0.1:8901/pages/premium.html';

function wsUrl() {
  return new Promise((resolve, reject) => {
    const tries = setInterval(() => {
      http.get(`http://127.0.0.1:${PORT}/json/list`, (r) => {
        let b = '';
        r.on('data', d => b += d);
        r.on('end', () => {
          try {
            const list = JSON.parse(b);
            const page = list.find(t => t.type === 'page');
            if (page) { clearInterval(tries); resolve(page.webSocketDebuggerUrl); }
          } catch {}
        });
      }).on('error', () => {});
    }, 150);
    setTimeout(() => { clearInterval(tries); reject(new Error('CDP timeout')); }, 20000);
  });
}

(async () => {
  const profile = path.join(os.tmpdir(), `i18n-live-${process.pid}`);
  const chrome = spawn(CHROME, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--disable-extensions',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  const ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); });
  let seq = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === 'Runtime.exceptionThrown') exceptions.push(((msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description) || msg.params.exceptionDetails.text));
  };
  function send(method, params = {}) {
    return new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  }
  async function evalJs(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) throw new Error('eval err: ' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text));
    return r.result.result.value;
  }
  function navLoaded(url) {
    return new Promise((resolve) => {
      const onMsg = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); resolve(); }
      };
      ws.addEventListener('message', onMsg);
      send('Page.navigate', { url });
    });
  }
  send('Log.enable'); send('Runtime.enable'); send('Page.enable');

  const failures = [];
  function ok(name, cond, detail) {
    console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : ' — ' + detail));
    if (!cond) failures.push(name);
  }

  // 1) 默认 zh（无 slati_lang）
  await navLoaded(BASE);
  await new Promise(r => setTimeout(r, 1500));
  let s = JSON.parse(await evalJs(`JSON.stringify({
    lang: document.documentElement.lang,
    badge: document.querySelector('[data-i18n="premium.hero.badge"]').textContent,
    chip: document.querySelector('.cur-chip').textContent,
    slots: document.querySelector('[data-i18n-html="premium.addon.slots36"]').innerHTML,
    gw: document.getElementById('gatewayNote').textContent,
    matrixPre: document.getElementById('basicNoteMatrix').textContent.slice(0, 14),
    note: document.getElementById('planNote').innerText.slice(0, 10)
  })`));
  ok('zh 回落：lang=zh', s.lang === 'zh', s.lang);
  ok('zh 回落：hero 徽章原文', s.badge === '⭐ M.NationWorld Premium', s.badge);
  ok('zh 回落：chip 当前方案', s.chip === '✓ 当前方案', s.chip);
  ok('zh 回落：slots36 内嵌 strong', s.slots === '增至 <strong>36</strong> 位成员', s.slots);
  ok('zh 回落：矩阵注中文', s.matrixPre === '注册默认免费「普通用户」层；', s.matrixPre);  ok('zh 回落：页底注中文', s.note.indexOf('注册默认「普通用户」') === 0, s.note);

  // 2) 切 en 重载
  await evalJs(`localStorage.setItem('slati_lang','en'); location.reload(); true`);
  await new Promise(r => setTimeout(r, 1800));
  s = JSON.parse(await evalJs(`JSON.stringify({
    lang: document.documentElement.lang,
    hero: document.querySelector('[data-i18n="premium.hero.choose"]').textContent + document.querySelector('[data-i18n="premium.hero.plan"]').textContent,
    chip: document.querySelector('.cur-chip').textContent,
    slots: document.querySelector('[data-i18n-html="premium.addon.slots36"]').innerHTML,
    gw: document.getElementById('gatewayNote').textContent.slice(0, 40),
    matrixPre: document.getElementById('basicNoteMatrix').textContent.slice(0, 12),
    note: document.getElementById('planNote').innerText.slice(0, 20),
    guest: document.getElementById('subStatus').innerText.slice(0, 20),
    onceBtn: document.querySelector('[data-plan-once]').textContent
  })`));
  ok('en：lang=en', s.lang === 'en', s.lang);
  ok('en：Choose Your Plan', s.hero === 'Choose Your Plan', s.hero);
  ok('en：Current Plan chip', s.chip === '✓ Current Plan', s.chip);
  ok('en：slots36 英文 + strong', s.slots === 'Increase to <strong>36</strong> members', s.slots);
  ok('en：gatewayNote 英文', s.gw === 'Payment gateway upgrade coming soon (Xen', s.gw);
  ok('en：矩阵注英文', s.matrixPre === 'New sign-ups', s.matrixPre);
  ok('en：页底注英文', s.note.indexOf('New sign-ups') === 0, s.note);
  ok('en：guest 横幅英文', s.guest.indexOf('Log in to subscribe') === 0, s.guest);
  ok('en：每年支付按钮静态标签保持（电池字节断言）', s.onceBtn === '每年支付', s.onceBtn);

  // 3) 切 de 重载（抽验）
  await evalJs(`localStorage.setItem('slati_lang','de'); location.reload(); true`);
  await new Promise(r => setTimeout(r, 1800));
  s = JSON.parse(await evalJs(`JSON.stringify({
    lang: document.documentElement.lang,
    chip: document.querySelector('.cur-chip').textContent,
    perMo: document.querySelector('[data-i18n="premium.plan.perMonth"]').textContent,
    badge: document.querySelector('[data-i18n="premium.plan.popularBadge"]').textContent
  })`));
  ok('de：lang=de', s.lang === 'de', s.lang);
  ok('de：Aktueller Plan', s.chip === '✓ Aktueller Plan', s.chip);
  ok('de：pro Monat', s.perMo === 'pro Monat', s.perMo);
  ok('de：Am beliebtesten', s.badge === 'Am beliebtesten', s.badge);

  ok('全程 0 页面脚本异常', exceptions.length === 0, exceptions.join(' | '));
  console.log(failures.length ? 'FAILED ' + failures.length : 'I18N LIVE TEST ALL PASSED');
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
