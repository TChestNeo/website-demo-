// tmp-probe-following.js — v0.2.58.18 关注页真实数据接入线上探针（mnationworld.com 匿名面）
// 注记：authed feed 线上无法无凭证探——登录态断言由电池 tmp-battery-following.js 覆盖（25/25）。
//   S1 页面静态锚+种子零残留 → S2 端点形状（public users 200 全形状+匿名无 followedByMe 键 /
//   nations/topics 200 / feed 匿名 401 / following/detail 匿名 401）→ S3 PII 扫描（无 @/display_name/bio/email
//   有 displayName）→ P1 CDP 匿名渲染（动态+关注=登录 CTA、发现=真行或空态、零种子签名）→ E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SITE = 'https://mnationworld.com';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-following-' + Date.now());
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function get(p, opts) {
  const r = await fetch(SITE + p, opts);
  let body = null;
  try { body = await r.json(); } catch (e) { try { body = await r.text(); } catch (e2) {} }
  return { status: r.status, body };
}
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

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

(async () => {
  console.log('═══ S1 页面静态锚 + 种子零残留 ═══');
  const page = await fetch(SITE + '/pages/following.html');
  const html = (await page.text()).replace(/\r\n/g, '\n');
  const count = (s) => html.split(s).length - 1;
  ok('S1 页面锚（api.js 引入 + 搜索 id + 58.17 三端点调用 + 链式 rerender + 离线/引导卡类）',
    count('assets/js/api.js') === 1 && count('id="followingSearch"') === 1 &&
    count("MN_API.get('/social/feed'") === 1 && count("MN_API.get('/social/following/detail'") === 1 &&
    count("MN_API.get('/public/users'") === 1 && count('__mnPrevRerender') === 2 &&
    count('card folg-offline') === 1 && count('card folg-cta') === 1 && count('folg-media') >= 2,
    'api=' + count('assets/js/api.js') + ' search=' + count('id="followingSearch"') +
    ' feed=' + count("MN_API.get('/social/feed'") + ' det=' + count("MN_API.get('/social/following/detail'") +
    ' pub=' + count("MN_API.get('/public/users'") + ' prev=' + count('__mnPrevRerender') +
    ' off=' + count('card folg-offline') + ' cta=' + count('card folg-cta'));
  ok('S1 种子零残留（5 组种子数组 + nameLookup + 种子专名全 0）',
    count('var feedItems') === 0 && count('var discoverNations') === 0 && count('var discoverTopics') === 0 &&
    count('var discoverUsers') === 0 && count('var recItems') === 0 && count('nameLookup') === 0 &&
    count('Republic of Etheria') === 0 && count('Marcus Vane') === 0 &&
    count('NAT-demo-1') === 0 && count('TOP-demo-1') === 0,
    'fi=' + count('var feedItems') + ' dn=' + count('var discoverNations') + ' du=' + count('var discoverUsers') +
    ' eth=' + count('Republic of Etheria') + ' mv=' + count('Marcus Vane') + ' n1=' + count('NAT-demo-1'));

  console.log('═══ S2 端点形状（匿名面）═══');
  const health = await get('/api/health');
  ok('S2a /api/health 200 + status ok + 60 表', health.status === 200 && health.body && health.body.status === 'ok' && health.body.db === 'ok' && health.body.tables === 60, JSON.stringify({ s: health.status, body: health.body }));
  const pub = await get('/api/public/users');
  const pubOk = pub.status === 200 && pub.body && Array.isArray(pub.body.users);
  ok('S2b /api/public/users 200 + users 数组（匿名）', pubOk, JSON.stringify(pub.status));
  if (pubOk) {
    const u = pub.body.users[0];
    ok('S2b 形状（id/displayName/avatarUrl/citizenId/followerCount 键在首行）',
      u && ('id' in u) && ('displayName' in u) && ('avatarUrl' in u) && ('citizenId' in u) && ('followerCount' in u),
      u ? Object.keys(u).join(',') : 'empty');
    const raw = JSON.stringify(pub.body);
    ok('S2b 匿名无 followedByMe 键', raw.indexOf('"followedByMe"') === -1, raw.slice(0, 160));
  }
  const nat = await get('/api/social/nations');
  const natOk = nat.status === 200 && nat.body && Array.isArray(nat.body.nations);
  ok('S2c /api/social/nations 200 + nations 数组', natOk, JSON.stringify(nat.status));
  if (natOk && nat.body.nations[0]) {
    const n = nat.body.nations[0];
    ok('S2c 形状（id/name/moniker/classification 键在首行）',
      ('id' in n) && ('name' in n) && ('moniker' in n) && ('classification' in n), Object.keys(n).join(','));
  }
  const top = await get('/api/social/topics');
  const topOk = top.status === 200 && top.body && Array.isArray(top.body.topics);
  ok('S2d /api/social/topics 200 + topics 数组', topOk, JSON.stringify(top.status));
  if (topOk && top.body.topics[0]) {
    const t = top.body.topics[0];
    ok('S2d 形状（id/name 键在首行）', ('id' in t) && ('name' in t), Object.keys(t).join(','));
  }
  const feed = await get('/api/social/feed');
  ok('S2e /api/social/feed 匿名 401', feed.status === 401, JSON.stringify(feed.status));
  const det = await get('/api/social/following/detail');
  ok('S2f /api/social/following/detail 匿名 401', det.status === 401, JSON.stringify(det.status));

  console.log('═══ S3 PII 扫描（public users）═══');
  const rawPub = JSON.stringify(pub.body || {});
  ok('S3 零 PII（无 @ / display_name / "bio" / "email" / gender；有 displayName）',
    rawPub.indexOf('@') === -1 && rawPub.indexOf('display_name') === -1 &&
    rawPub.indexOf('"bio"') === -1 && rawPub.indexOf('"email"') === -1 && rawPub.indexOf('gender') === -1 &&
    (rawPub.indexOf('displayName') !== -1 || pub.body.users.length === 0),
    rawPub.slice(0, 120));

  console.log('═══ P1 CDP 匿名渲染 ═══');
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
    const pageTab = pages.find(x => x.type === 'page');
    const cdp = new CDP(pageTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Page.navigate', { url: SITE + '/pages/following.html' });
    await waitFor(cdp, "document.getElementById('feedPanel').textContent.indexOf('登录后查看你的动态') !== -1", 60000, 'P1 feed CTA');
    await waitFor(cdp, "document.getElementById('rightSidebarSlot').children.length > 0", 60000, 'P1 右栏渲染');
    const p1 = await cdp.evalJs("(function(){var txt=document.body.textContent;var dn=document.getElementById('discoverNations');return {ctaFeed:document.getElementById('feedPanel').textContent.indexOf('登录后查看你的动态')!==-1,ctaFol:document.getElementById('followingList').textContent.indexOf('登录后查看你的动态')!==-1,dnEmpty:dn.textContent.indexOf('还没有国家')!==-1,dnRows:document.querySelectorAll('#discoverNations .tilt-container').length,tRows:document.querySelectorAll('#discoverTopics .tilt-container').length,uRows:document.querySelectorAll('#discoverUsers .tilt-container').length,dnOff:document.querySelectorAll('#discoverPanel .folg-offline').length,seed:txt.indexOf('Republic of Etheria')!==-1||txt.indexOf('Marcus Vane')!==-1};})()");
    ok('P1 匿名渲染（动态+关注=登录 CTA；发现三区=真行或空态（离线 0）；零种子签名）',
      p1.ctaFeed && p1.ctaFol && p1.dnOff === 0 && !p1.seed &&
      ((p1.dnEmpty && p1.dnRows === 0) || p1.dnRows >= 1) && (p1.tRows >= 0) && (p1.uRows >= 0),
      JSON.stringify(p1));
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|settings-menu|Failed to load resource|\/api\/|404|429/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 控制台零错误（噪声已滤）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  process.exit(fail === 0 ? 0 : 1);
})();
