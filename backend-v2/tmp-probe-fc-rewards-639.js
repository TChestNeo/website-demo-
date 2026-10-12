// tmp-probe-fc-rewards-639.js — FC v10.28.52.0 等级奖励线上探针（mnationworld.com）
//   S1a site-config：58.26 赋值 ×1 + FC 52.0 赋值 ×1 + 51.1 赋值零残留 + changelog 头 52.0/51.1 各 ×1；
//   S1b rev live 口径：rev 00363-真值 ×1 + 00363-XXX 零残留 + 00364-??? 占位 ×1 + 00364-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00364-终态，live 仍二次烘焙镜像）；
//   S1c 资料页 live 锚（' has-frame ' 发射 ×1/rookie-frame CSS ×1/champion-frame CSS ×1/frame-rookie 旧残 ×0/
//      profile-rewards ×4/loadRewardsMe ×4）；S1d sidebar /rewards/claim ×2+mn:rewards-changed ×2/
//      storage TEAM_LEVELS ×8+getTeamLevelState ×3/fluidcanvas fc-team-lv-badge ×3+fc-team-ach-strip ×2+
//      fcToggleTeamFollow ×3+loadTeamRewards ×4；S1e i18n rewards.claimOk ×12+fc.rewards.teamXp ×12；
//   S2 API：health 200 + tables:66（033 五新表）；S3 匿名口径：rewards/me 401+rewards/claim 401+
//      teams/:id/rewards 401+fc/edges 匿名公开 200（回归）；
//   P1 CDP：P1a 资料页 isSelf 门反向实证（真实用户 USR-000001 匿名视角：主区显示+头卡渲染+奖励区缺席+
//      tab=2 非本人只帖子/转发——空态文案需真会话，本地电池罐头已锚）；P1b 升级领取链 live 实证=
//      fetch 记录器捕获 POST /rewards/claim {scope:'user',lv:2}（401 无碍——链路接线证据）；P1c fluidcanvas
//      ?teamview 团队视图结构（fc-team-lv-badge+fcTeamFollowBtn 在场；ach-strip 缺席=teamRewardsCache
//      数据门实证——live 无真团队数据，有数据渲染由本地电池罐头证）；E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REAL63 = '00363-ksq'; // deploy#1 实得 rev（部署后填真）
const REAL64 = '00364-wdg'; // deploy#2 实得 rev（部署后填真；live 断言=零残留）
const SITE = 'https://mnationworld.com';
const PROFILE = SITE + '/pages/community-profile.html?id=USR-000101';
const REAL_PROFILE = SITE + '/pages/community-profile.html?id=USR-000001'; // live 真实种子用户（Neo）；匿名视角 isSelf=false
const FC = SITE + '/pages/fluidcanvas.html?teamview';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fc639-' + Date.now());
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}
const hget = (url, opts) => new Promise((resolve) => {
  opts = opts || {};
  const req = https.request(url, Object.assign({ method: opts.method || 'GET', headers: Object.assign({}, opts.headers), timeout: 25000 }), (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 12000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  if (opts.body) req.write(opts.body);
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
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
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const txt = (m.params.args || []).map(a => a.value || a.description || '').join(' ');
        if (txt.indexOf('Failed to load resource') === -1) this.errs.push('CON:' + txt.slice(0, 200));
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

const SESSION_SCRIPT = 'try{(function(){ localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "探针用户", tier: "free" }));' +
  ' localStorage.setItem("slati_lang", "zh-CN");' +
  ' localStorage.setItem("slati_teams", JSON.stringify([{ id: "TEAM-X001", name: "测试团队", role: "Owner", members: 3 }]));' +
  ' localStorage.setItem("slati_active_account", JSON.stringify("TEAM-X001")); })();}catch(e){}';
// fetch 记录器（只记录不拦截；真实 fetch 照常走——P1b 升级领取链 live 接线证据）
const REC_SCRIPT = 'try{(function(){ if (window.__recStub) return; window.__recStub = true;' +
  ' window.__recCalls = []; var realFetch = window.fetch.bind(window);' +
  ' window.fetch = function (url, opts) { var u = String(url); var m = (opts && opts.method) || "GET";' +
  '  if (u.indexOf("/api/") !== -1) { var b = null; if (opts && opts.body != null) { try { b = JSON.parse(opts.body); } catch (e) { b = String(opts.body); } }' +
  '   window.__recCalls.push({ url: u, method: m, body: b }); }' +
  '  return realFetch(url, opts); }; })();}catch(e){}';

(async () => {
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  console.log('═══ S1 静态锚（live）═══');
  const sc = await hget(SITE + '/assets/js/site-config.js');
  const scSrc = norm(sc.body);
  const scCount = mk(scSrc);
  ok('S1a site-config：58.26 赋值 ×1 + FC 52.0 赋值 ×1 + 51.1 赋值零残留 + changelog 头 52.0/51.1 各 ×1',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.51.1';") === 0 &&
    scCount('// v10.28.52.0 = ') === 1 && scCount('// v10.28.51.1 = ') === 1,
    'v26=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") +
    ' fc520=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") +
    ' fc511=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.51.1';") +
    ' cl520=' + scCount('// v10.28.52.0 = ') + ' cl511=' + scCount('// v10.28.51.1 = '));
  ok('S1b site-config rev live 口径：rev ' + REAL63 + ' ×1 + 00363-XXX 零残留 + 00364-??? 占位 ×1 + ' + REAL64 + ' 零残留',
    scCount('rev ' + REAL63) === 1 && scCount('00363-XXX') === 0 && scCount('00364-???') === 1 && scCount(REAL64) === 0,
    'r63=' + scCount('rev ' + REAL63) + ' x63=' + scCount('00363-XXX') + ' q64=' + scCount('00364-???') + ' r64=' + scCount(REAL64));

  const lc = (src, a) => src.split('\n').filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const PF = await hget(PROFILE);
  const pfSrc = norm(PF.body);
  const PF_ANCHORS = [["' has-frame '", 1], ['.profile-avatar.rookie-frame::after', 1], ['.profile-avatar.champion-frame::after', 1],
    ['frame-rookie', 0], ['profile-rewards', 4], ['loadRewardsMe', 4]];
  const pfBad = PF_ANCHORS.filter(([a, n]) => lc(pfSrc, a) !== n);
  ok('S1c 资料页 live 6 锚（相框类发射修复/奖励区）', pfBad.length === 0,
    pfBad.map(([a, n]) => a + '=' + lc(pfSrc, a) + '≠' + n).join(',') || '6/6');

  const sbSrc = norm((await hget(SITE + '/assets/js/sidebar.js')).body);
  const stSrc = norm((await hget(SITE + '/assets/js/storage.js')).body);
  const fcSrc = norm((await hget(SITE + '/pages/fluidcanvas.html')).body);
  ok('S1d sidebar/storage/fluidcanvas live 8 锚（claim 链/1.5× 阈值表/团队徽章与成就条）',
    lc(sbSrc, '/rewards/claim') === 2 && lc(sbSrc, 'mn:rewards-changed') === 2 &&
    lc(stSrc, 'TEAM_LEVELS') === 8 && lc(stSrc, 'getTeamLevelState') === 3 &&
    lc(fcSrc, 'fc-team-lv-badge') === 3 && lc(fcSrc, 'fc-team-ach-strip') === 2 &&
    lc(fcSrc, 'fcToggleTeamFollow') === 3 && lc(fcSrc, 'loadTeamRewards') === 4,
    'sb=' + lc(sbSrc, '/rewards/claim') + '/' + lc(sbSrc, 'mn:rewards-changed') +
    ' st=' + lc(stSrc, 'TEAM_LEVELS') + '/' + lc(stSrc, 'getTeamLevelState') +
    ' fc=' + lc(fcSrc, 'fc-team-lv-badge') + '/' + lc(fcSrc, 'fc-team-ach-strip') + '/' + lc(fcSrc, 'fcToggleTeamFollow') + '/' + lc(fcSrc, 'loadTeamRewards'));
  const cmnSrc = norm((await hget(SITE + '/assets/i18n/common.i18n.js')).body);
  const fciSrc = norm((await hget(SITE + '/assets/i18n/fluidcanvas.i18n.js')).body);
  ok('S1e i18n live：rewards.claimOk ×12 + "fc.rewards.teamXp" ×12',
    lc(cmnSrc, 'rewards.claimOk') === 12 && lc(fciSrc, '"fc.rewards.teamXp"') === 12,
    'cmn=' + lc(cmnSrc, 'rewards.claimOk') + ' fci=' + lc(fciSrc, '"fc.rewards.teamXp"'));

  console.log('═══ S2 API（匿名口径）═══');
  const health = await hget(SITE + '/api/health');
  let healthJson = null; try { healthJson = JSON.parse(health.body); } catch (e) {}
  ok('S2 /api/health 200 + tables:66（033 五新表）', health.status === 200 && healthJson && healthJson.status === 'ok' && healthJson.tables === 66,
    JSON.stringify({ status: health.status, tables: healthJson && healthJson.tables }));

  console.log('═══ S3 匿名 401 族 + 回归 ═══');
  const rMe = await hget(SITE + '/api/rewards/me');
  const rClaim = await hget(SITE + '/api/rewards/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'user', lv: 2 }) });
  const tRwd = await hget(SITE + '/api/teams/TEAM-X001/rewards');
  const edges = await hget(SITE + '/api/fc/edges?scope=all');
  ok('S3 rewards/me 401 + rewards/claim 401 + teams/:id/rewards 401 + fc/edges 匿名公开 200（回归）',
    rMe.status === 401 && rClaim.status === 401 && tRwd.status === 401 && edges.status === 200,
    JSON.stringify({ me: rMe.status, claim: rClaim.status, team: tRwd.status, edges: edges.status }));

  console.log('═══ P1 CDP（假会话；结构实证）═══');
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
  let cdp = null;
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: REC_SCRIPT });
    const origHandler = cdp.ws.onmessage;
    cdp.ws.onmessage = (ev) => {
      origHandler(ev);
      try {
        const m = JSON.parse(ev.data);
        if (m.method === 'Page.javascriptDialogOpening') cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      } catch (e) {}
    };

    // P1a 资料页 isSelf 门反向实证：真实用户 USR-000001 匿名视角——主区显示+头卡渲染+奖励区缺席（非本人）
    await cdp.send('Page.navigate', { url: REAL_PROFILE });
    await waitFor(cdp, "document.getElementById('profileHeader') && document.getElementById('profileMain') && document.getElementById('profileMain').style.display === 'flex' && document.getElementById('slati-sidebar')", 40000, '资料页就绪');
    await sleep(1200);
    const p1a = await cdp.evalJs("(function(){ var main = document.getElementById('profileMain'); var s404 = document.getElementById('profileState404');" +
      " var pr = document.querySelector('.profile-rewards'); var h = document.getElementById('profileHeader');" +
      " return { main: main ? main.style.display : null, s404: s404 ? s404.style.display : null, pr: !!pr," +
      " tabs: document.querySelectorAll('#profileTabs .profile-tab').length, name: h ? h.innerText.slice(0, 40) : null }; })()");
    ok('P1a 资料页 isSelf 门反向实证（真实用户匿名视角：主区显示+无奖励区+tab=2 非本人只帖子/转发；空态文案=本地电池锚）',
      p1a.main === 'flex' && p1a.s404 === 'none' && p1a.pr === false && p1a.tabs === 2 && p1a.name && p1a.name.indexOf('TChestBox_Neo') !== -1,
      JSON.stringify(p1a));

    // P1b 升级领取链 live 接线：fetch 记录器捕获 claim POST（401 无碍——接线证据）
    await cdp.evalJs("(function(){ window.dispatchEvent(new CustomEvent('mn:level-up', { detail: { state: { lv: 2, name: '探针' }, from: { lv: 1 } } })); })()");
    await sleep(1500);
    const rec = await cdp.evalJs('window.__recCalls');
    const claim = (rec || []).find(x => x.url.indexOf('/rewards/claim') !== -1);
    ok('P1b mn:level-up → POST /rewards/claim {scope:"user",lv:2} live 接线实证',
      claim && claim.method === 'POST' && claim.body && claim.body.scope === 'user' && claim.body.lv === 2,
      JSON.stringify(claim || null));

    // P1c fluidcanvas 团队视图结构（badge/关注钮在场；ach-strip 缺席=数据门——live 无真团队数据）
    await cdp.send('Page.navigate', { url: FC });
    await waitFor(cdp, "document.getElementById('fcTeamFollowBtn') && document.querySelector('.fc-team-lv-badge')", 40000, 'fluidcanvas 团队视图就绪');
    await sleep(1200);
    const p1c = await cdp.evalJs("(function(){ var b = document.querySelector('.fc-team-lv-badge');" +
      " var s = document.querySelector('.fc-team-ach-strip'); var btn = document.getElementById('fcTeamFollowBtn');" +
      " return { badge: b ? b.textContent : null, strip: !!s, btn: btn ? btn.textContent : null }; })()");
    ok('P1c fluidcanvas 团队视图：等级徽章 + 关注钮在场 + ach-strip 数据门缺席（有数据渲染=本地电池罐头证）',
      p1c.badge !== null && p1c.badge.indexOf('Lv.') === 0 && p1c.strip === false && p1c.btn !== null,
      JSON.stringify(p1c));
  } catch (e) {
    console.log('  💔 ' + e.message);
    fail++;
  }
  console.log('═══ E1 零异常 ═══');
  const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
  const rawErrs = cdp ? cdp.errs : [];
  const errs = rawErrs.filter(e => !noise.test(e));
  ok('E1 零异常（' + rawErrs.length + ' 原始 / ' + errs.length + ' 噪声后）', errs.length === 0, errs.slice(0, 5).join(' || '));
  try { cdp && cdp.close(); } catch (e) {}
  try { spawn('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' }); } catch (e) {}

  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail === 0 ? 0 : 1);
})();
