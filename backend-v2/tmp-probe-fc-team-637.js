// tmp-probe-fc-team-637.js — FC v10.28.51.0 团队频道线上探针（mnationworld.com）
//   S1a site-config：58.26 赋值 ×1 + FC 51.0 赋值 ×1 + 50.0 赋值零残留 + changelog 头 51.0/50.0 各 ×1；
//   S1b rev live 口径：rev 00359-真值 ×1 + 00359-XXX 零残留 + 00360-??? 占位 ×1 + 00360-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00360-终态，live 仍二次烘焙镜像）；
//   S1c fluidcanvas live 锚（fcTeamWizard ×5/fcTwStepper ×2/openTeamWizard ×2/teamWizardSubmit ×2/
//      loadTeamsFromApi ×3/no-teams-cta ×2/v10.28.51.0 ×5）；
//   S1d messages live 锚（mergeCloudGroups ×4/groupFriendPick ×3/cloudGroups ×4/v10.28.51.0 ×7）；
//   S1e i18n live（fc.team.wizardTitle ×12 + messages.modal.groupFriendsLoading ×12 + premium.addon.slots8 ×12）；
//   S2 API：health tables:61（032 列级无新表）/ GET /api/teams 匿名 401 / GET /api/friends 匿名 401 /
//      GET /api/teams/x 匿名 401（requireSession 实证）；
//   P1 CDP 流体画布（种子 slati_session loggedIn）：向导打开+三步 stepper+步1 双选卡+步2 5 行全选首+
//      步3 建群名输入+无好友提示（live 假会话 401→空好友降级）→E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REAL59 = '00359-nfc'; // deploy#1 实得 rev（部署后填）
const REAL60 = '00360-bk7'; // deploy#2 实得 rev（部署后填；live 断言=零残留）
const SITE = 'https://mnationworld.com';
const FC = SITE + '/pages/fluidcanvas.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fct637-' + Date.now());
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
  ' localStorage.setItem("slati_user", "{\\"id\\":\\"USR-000101\\",\\"displayName\\":\\"探针用户\\"}");' +
  ' localStorage.setItem("slati_lang", "zh-CN"); })();}catch(e){}';

(async () => {
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  console.log('═══ S1 静态锚（live）═══');
  const sc = await hget(SITE + '/assets/js/site-config.js');
  const scSrc = norm(sc.body);
  const scCount = mk(scSrc);
  ok('S1a site-config：58.26 赋值 ×1 + FC 51.0 赋值 ×1 + 50.0 赋值零残留 + changelog 头 51.0/50.0 各 ×1',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.51.0';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") === 0 &&
    scCount('// v10.28.51.0 = ') === 1 && scCount('// v10.28.50.0 = ') === 1,
    'v26=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") +
    ' fc51=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.51.0';") +
    ' fc50=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") +
    ' cl51=' + scCount('// v10.28.51.0 = ') + ' cl50=' + scCount('// v10.28.50.0 = '));
  ok('S1b site-config rev live 口径：rev ' + REAL59 + ' ×1 + 00359-XXX 零残留 + 00360-??? 占位 ×1 + ' + REAL60 + ' 零残留',
    scCount('rev ' + REAL59) === 1 && scCount('00359-XXX') === 0 && scCount('00360-???') === 1 && scCount(REAL60) === 0,
    'r59=' + scCount('rev ' + REAL59) + ' x59=' + scCount('00359-XXX') + ' q60=' + scCount('00360-???') + ' r60=' + scCount(REAL60));

  const F = await hget(FC);
  const flines = norm(F.body).split('\n');
  const c = (a) => flines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const F_ANCHORS = [['fcTeamWizard', 5], ['fcTwStepper', 2], ['openTeamWizard', 2],
    ['teamWizardSubmit', 2], ['loadTeamsFromApi', 3], ['no-teams-cta', 2], ['v10.28.51.0', 5]];
  const fbad = F_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1c fluidcanvas 7 锚全中（向导/stepper/提交/团队真数据/入口/51.0×5）', fbad.length === 0,
    fbad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '7/7');

  const M = await hget(SITE + '/pages/messages.html');
  const mlines = norm(M.body).split('\n');
  const mc = (a) => mlines.filter((l) => l.includes(a)).length;
  const M_BAD = [['mergeCloudGroups', 4], ['groupFriendPick', 3], ['cloudGroups', 4], ['v10.28.51.0', 7]]
    .filter(([a, n]) => mc(a) !== n);
  ok('S1d messages 4 锚全中（云群合并/好友选择/群表/51.0×7）', M_BAD.length === 0,
    M_BAD.map(([a, n]) => a + '=' + mc(a) + '≠' + n).join(',') || '4/4');

  const I = await hget(SITE + '/assets/i18n/fluidcanvas.i18n.js');
  const ic = mk(norm(I.body));
  const I2 = await hget(SITE + '/assets/i18n/messages.i18n.js');
  const ic2 = mk(norm(I2.body));
  const I3 = await hget(SITE + '/assets/i18n/premium.i18n.js');
  const ic3 = mk(norm(I3.body));
  ok('S1e i18n live：fc.team.wizardTitle ×12 + messages.modal.groupFriendsLoading ×12 + premium.addon.slots8 ×12',
    ic('"fc.team.wizardTitle"') === 12 && ic2('"messages.modal.groupFriendsLoading"') === 12 && ic3('premium.addon.slots8') === 12,
    'wt=' + ic('"fc.team.wizardTitle"') + ' gf=' + ic2('"messages.modal.groupFriendsLoading"') + ' s8=' + ic3('premium.addon.slots8'));

  console.log('═══ S2 API（匿名口径）═══');
  const health = await hget(SITE + '/api/health');
  let healthJson = null; try { healthJson = JSON.parse(health.body); } catch (e) {}
  ok('S2a /api/health 200 + tables:61（032 列级无新表）', health.status === 200 && healthJson && healthJson.status === 'ok' && healthJson.tables === 61,
    JSON.stringify({ status: health.status, tables: healthJson && healthJson.tables }));
  const teamsAnon = await hget(SITE + '/api/teams');
  ok('S2b GET /api/teams 匿名 401（requireSession 实证）', teamsAnon.status === 401, JSON.stringify({ status: teamsAnon.status, body: teamsAnon.body.slice(0, 60) }));
  const friendsAnon = await hget(SITE + '/api/friends');
  ok('S2c GET /api/friends 匿名 401（向导好友源）', friendsAnon.status === 401, JSON.stringify({ status: friendsAnon.status, body: friendsAnon.body.slice(0, 60) }));
  const teamOneAnon = await hget(SITE + '/api/teams/TEA-000001');
  ok('S2d GET /api/teams/:id 匿名 401', teamOneAnon.status === 401, JSON.stringify({ status: teamOneAnon.status, body: teamOneAnon.body.slice(0, 60) }));

  console.log('═══ P1 CDP 流体画布向导（种子 slati_session loggedIn）═══');
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
    const origHandler = cdp.ws.onmessage;
    cdp.ws.onmessage = (ev) => {
      origHandler(ev);
      try {
        const m = JSON.parse(ev.data);
        if (m.method === 'Page.javascriptDialogOpening') cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      } catch (e) {}
    };
    await cdp.send('Page.navigate', { url: FC });
    await waitFor(cdp, "document.getElementById('fcTeamWizard') && window.openTeamWizard && window.teamWizardNext && window.loadTeamsFromApi && window.fcEnsureApi", 40000, 'P1 画布就绪');
    await sleep(900);
    await cdp.evalJs('(function(){ window.openTeamWizard(); })()');
    await sleep(500);
    const s1 = await cdp.evalJs("(function(){ var w = document.getElementById('fcTeamWizard');" +
      " var steps = document.querySelectorAll('#fcTwStepper .fc-tw-step');" +
      " var body = document.getElementById('fcTwBody');" +
      " return { open: w.classList.contains('open'), steps: steps.length, active1: steps[0].classList.contains('active')," +
      "  choices: body.querySelectorAll('.fc-tw-choice-card').length, cap: !!body.querySelector('.fc-tw-cap')," +
      "  title: (steps[1] || {}).textContent }; })()");
    ok('P1a 向导打开 + 三步 stepper + 步1 双选卡 + 容量提示（8/16/26/∞）', s1.open === true && s1.steps === 3 && s1.active1 === true &&
      s1.choices === 2 && s1.cap === true, JSON.stringify(s1));
    await cdp.evalJs('(function(){ var cards = document.querySelectorAll("#fcTwBody .fc-tw-choice-card"); if (cards[0]) cards[0].click(); })()');
    await sleep(300);
    await cdp.evalJs('(function(){ window.teamWizardNext(); })()');
    await sleep(300);
    const s2 = await cdp.evalJs("(function(){ var steps = document.querySelectorAll('#fcTwStepper .fc-tw-step');" +
      " var body = document.getElementById('fcTwBody'); var items = body.querySelectorAll('.fc-tw-item');" +
      " return { active2: steps[1].classList.contains('active'), items: items.length," +
      "  allFirst: items[0] ? items[0].classList.contains('all-item') : false," +
      "  allChecked: items[0] ? items[0].querySelector('.art-checkbox').classList.contains('checked') : false }; })()");
    ok('P1b 步2 五搬运项 + 全选首行默认勾选（贴文/视频&贴图/动态/主页装饰）', s2.active2 === true && s2.items === 5 &&
      s2.allFirst === true && s2.allChecked === true, JSON.stringify(s2));
    await cdp.evalJs('(function(){ window.teamWizardNext(); })()');
    await sleep(600);
    const s3 = await cdp.evalJs("(function(){ var steps = document.querySelectorAll('#fcTwStepper .fc-tw-step');" +
      " var body = document.getElementById('fcTwBody');" +
      " var hint = body.querySelector('.fc-tw-hint');" +
      " return { active3: steps[2].classList.contains('active'), chatName: !!body.querySelector('#fcTwChatName')," +
      "  hint: hint ? hint.textContent : null, friends: body.querySelectorAll('.fc-tw-friend').length }; })()");
    ok('P1c 步3 建群名输入 + 无好友降级提示（live 假会话 401→空好友）', s3.active3 === true && s3.chatName === true &&
      s3.hint === '暂无好友，可先跳过建群' && s3.friends === 0, JSON.stringify(s3));
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
