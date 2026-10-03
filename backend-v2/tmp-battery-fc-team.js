// tmp-battery-fc-team.js — v10.28.51.0 团队频道电池（本地工作树）
//   S 静态：site-config（51.0/rev 占位/站点恒 58.26）/fluidcanvas 向导 16 锚/messages 群真接口 12 锚/
//     premium slots 13 锚/后端 19 锚（teams/messages/subscriptions/032/health 61/user_version 32）/
//     i18n 7 样键 ×12+slots12 零残留（行计数口径=实测 grep -cF）；
//   B fluidcanvas CDP：B1 访客门禁 / B2 就绪 / B3 step1 选是 / B4 step2 搬运多选全勾→取消贴文联动 /
//     B5 step3 好友多选+群名→POST 体奇偶校验 / B6 成功流（toast+关弹窗+团队卡真数据） / B7 失败流 toast /
//     B8 团队频道卡（有头像图卡/无头像字母卡+成员数）；
//   C messages CDP：C1 云群入侧栏（mergeCloudGroups）/ C2 群消息云端拉取 / C3 发群消息 POST 体奇偶 /
//     C4 建群真接口（好友多选+POST 体奇偶+成功文案）/ C5 群名超长本地拒 / C6 400 分支文案；
//   D premium CDP：D1 slots 点击=startCheckout(cta,'once') 奇偶（basic+ultra 双验）；
//   E 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-fcteam-' + Date.now());
const FC_URL_PATH = '/pages/fluidcanvas.html';
const MSG_URL_PATH = '/pages/messages.html';
const PM_URL_PATH = '/pages/premium.html';

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

// ── 本地静态服务器 ──
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
const server = require('http').createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.indexOf('/api') === 0) { res.writeHead(404); res.end('{"error":"NOT_FOUND"}'); return; }
  if (u === '/' || u === '/dashboard') u = '/index.html';
  let f = path.join(DOCS, u);
  if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
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
        this.errs.push('EXC:' + JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
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

// ── 罐头形状 ──
const ISO = '2026-10-04T10:00:00.000Z';
const FRIENDS = [
  { id: 'USR-000042', displayName: 'Neo', citizenId: 'CIT-000042', avatarUrl: null },
  { id: 'USR-000043', displayName: 'Nia', citizenId: 'CIT-000043', avatarUrl: null }
];
const TEAM_A = { id: 'TEA-000001', name: '王者团', avatarUrl: 'https://cdn.example.com/t1.png', color: '#8127cf', role: 'owner', members: 3 };
const TEAM_B = { id: 'TEA-000002', name: '新星团', avatarUrl: null, color: '#ea580c', role: 'member', members: 2 };
const GROUP_CONV = {
  id: 'CONV-000001', kind: 'group', name: '电池群',
  members: [{ id: 'USR-000101', displayName: '电池用户' }, { id: 'USR-000042', displayName: 'Neo' }],
  unreadCount: 0, lastMessage: { content: '欢迎入群', createdAt: ISO }
};
const DM_CONV = {
  id: 'CONV-000002', kind: 'dm',
  members: [{ id: 'USR-000101', displayName: '电池用户' }, { id: 'USR-000042', displayName: 'Neo' }],
  unreadCount: 0, lastMessage: { content: '你好', createdAt: ISO }
};

// ── fetch 罐头：/api/health（probe）/api/friends/api/teams/api/conversations(+messages)/api/fc/overview/
//    /api/friend-requests ──
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' window.__fcalls = []; window.__teamPosted = null; window.__convPosted = null; window.__msgPosted = null; window.__checkoutPosted = null;' +
  ' var FRIENDS = ' + JSON.stringify(FRIENDS) + '; var TEAM_A = ' + JSON.stringify(TEAM_A) + '; var TEAM_B = ' + JSON.stringify(TEAM_B) + ';' +
  ' var GROUP_CONV = ' + JSON.stringify(GROUP_CONV) + '; var DM_CONV = ' + JSON.stringify(DM_CONV) + ';' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status || 200, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  var method = (opts && opts.method) || "GET";' +
  '  var bodyObj = null;' +
  '  try { if (opts && opts.body && typeof opts.body === "string") bodyObj = JSON.parse(opts.body); } catch (e) {}' +
  '  if (u.indexOf("/api/health") !== -1) return stubResponse(JSON.stringify({ ok: true }));' +
  '  if (u.indexOf("/api/friends") !== -1) { window.__fcalls.push({ m: method, url: u }); return stubResponse(JSON.stringify({ friends: FRIENDS })); }' +
  '  if (u.indexOf("/api/teams") !== -1) {' +
  '   if (method === "POST") {' +
  '    window.__fcalls.push({ m: method, url: u, body: bodyObj });' +
  '    window.__teamPosted = bodyObj;' +
  '    if (window.__teamMode === "fail") return stubResponse(JSON.stringify({ error: "TEAM_FULL" }), 403);' +
  '    var newTeam = { id: "TEA-000042", name: (bodyObj && bodyObj.name) || "电池团", avatarUrl: null, color: "#4648d4", role: "owner", members: 1 };' +
  '    window.__teamList = [TEAM_A, newTeam, TEAM_B];' +
  '    var chatOut = null; if (bodyObj && bodyObj.chat && bodyObj.chat.name) chatOut = { id: "CONV-000042", kind: "group", name: bodyObj.chat.name };' +
  '    return stubResponse(JSON.stringify({ team: newTeam, chat: chatOut, cap: 3 }));' +
  '   }' +
  '   window.__fcalls.push({ m: method, url: u });' +
  '   return stubResponse(JSON.stringify({ teams: window.__teamList || [TEAM_A, TEAM_B] }));' +
  '  }' +
  '  if (u.indexOf("/api/subscription/checkout") !== -1) {' +
  '   window.__checkoutPosted = bodyObj;' +
  '   return stubResponse(JSON.stringify({ error: "NOT_READY" }), 409);' +
  '  }' +
  '  if (u.indexOf("/api/conversations") !== -1) {' +
  '   var mm = u.match(/\\/api\\/conversations\\/([^\\/]+)\\/messages/);' +
  '   if (mm) {' +
  '    window.__fcalls.push({ m: method, url: u });' +
  '    if (method === "POST") {' +
  '     window.__msgPosted = bodyObj;' +
  '     return stubResponse(JSON.stringify({ message: { id: "MSG-000099", senderId: "USR-000101", senderName: "电池用户", content: bodyObj && bodyObj.content, createdAt: "2026-10-04T11:00:00.000Z" } }));' +
  '    }' +
  '    return stubResponse(JSON.stringify({ messages: [{ id: "MSG-000001", senderId: "USR-000101", senderName: "电池用户", content: "欢迎入群", createdAt: "2026-10-04T10:00:00.000Z" }] }));' +
  '   }' +
  '   if (method === "POST") {' +
  '    window.__fcalls.push({ m: method, url: u, body: bodyObj });' +
  '    window.__convPosted = bodyObj;' +
  '    if (window.__convMode === "bad400") return stubResponse(JSON.stringify({ error: "VALIDATION" }), 400);' +
  '    return stubResponse(JSON.stringify({ conversation: { id: "CONV-000099", kind: "group", name: bodyObj && bodyObj.name, members: [{ id: "USR-000101", displayName: "电池用户" }].concat((bodyObj && bodyObj.memberIds || []).map(function (id) { return { id: id, displayName: "F" }; })) } }));' +
  '   }' +
  '   window.__fcalls.push({ m: method, url: u });' +
  '   return stubResponse(JSON.stringify({ conversations: [DM_CONV, GROUP_CONV] }));' +
  '  }' +
  '  if (u.indexOf("/api/friend-requests") !== -1) { return stubResponse(JSON.stringify({ requests: [] })); }' +
  '  if (u.indexOf("/api/fc/overview") !== -1) return stubResponse(JSON.stringify({ ok: true, stats: {}, windows: {} }), 404);' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

// ── 会话/用户/语言（?guest=清登录态）──
const SEED_SCRIPT = 'try{(function(){' +
  ' var q = location.search || "";' +
  ' if (q.indexOf("guest") !== -1) { try { localStorage.removeItem("slati_session"); localStorage.removeItem("slati_user"); } catch (e) {} return; }' +
  ' localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' var u = { id: "USR-000101", displayName: "电池用户", citizenId: "CIT-000101", bio: "电池用户简介", gender: "Male",' +
  '  tier: q.indexOf("prem") !== -1 ? "premium" : "free", avatarUrl: null, bannerUrl: null };' +
  ' localStorage.setItem("slati_user", JSON.stringify(u));' +
  ' localStorage.setItem("slati_lang", "zh-CN");' +
  '})();}catch(e){}';

// ── 状态读取 ──
const FC_READY = "document.getElementById('fcTeamWizard') && window.openTeamWizard && window.teamWizardNext && window.loadTeamsFromApi && window.fcEnsureApi";
const MSG_READY = "document.getElementById('groupList') && window.chooseAction && window.createGroupDemo && window.sendGroupMessage && window.openGroupChat && window.refreshCloudChat && window.MN_API";
const PM_READY = "document.querySelector('[data-addon-cta=slots-basic]') && window.MN_API && document.getElementById('cdOverlay')";
const WIZ_EXPR = "(function(){ var o = document.getElementById('fcTeamWizard'); var nb = document.getElementById('fcTwNext');" +
  " var s1 = document.getElementById('fcTwS1');" +
  " var items = document.querySelectorAll('#fcTwBody .fc-tw-item');" +
  " var allItem = document.querySelector('#fcTwBody .fc-tw-item.all-item');" +
  " var friends = document.querySelectorAll('#fcTwBody .fc-tw-friend');" +
  " return { open: o.classList.contains('open')," +
  "  nextDisabled: nb.disabled, nextText: nb.textContent," +
  "  backDisplay: getComputedStyle(document.getElementById('fcTwBack')).display," +
  "  s1Active: s1.classList.contains('active')," +
  "  itemCount: items.length," +
  "  allChecked: allItem ? allItem.querySelector('.art-checkbox').classList.contains('checked') : null," +
  "  itemChecked: Array.prototype.map.call(items, function (it) { return it.querySelector('.art-checkbox').classList.contains('checked'); })," +
  "  friendCount: friends.length," +
  "  friendChecked: Array.prototype.map.call(friends, function (f) { return f.querySelector('.art-checkbox').classList.contains('checked'); }) }; })()";
const TOAST_EXPR = "(function(){ var t = document.getElementById('toast');" +
  " return t ? { text: t.textContent, show: t.classList.contains('show') } : null; })()";
const TEAM_SEC_EXPR = "(function(){ var w = document.getElementById('teamAccount'); var cards = document.querySelectorAll('#teamContent .team-card-item');" +
  " return { hasTeams: w.classList.contains('has-teams'), cardCount: cards.length," +
  "  names: Array.prototype.map.call(cards, function (c) { return c.textContent; }) }; })()";
const CH_CARD_EXPR = "(function(){ var co = document.getElementById('channelOverview');" +
  " return { img: !!co.querySelector('img.fc-ch-avatar-img')," +
  "  text: co.textContent.slice(0, 120) }; })()";

(async () => {
  // ═══ S 静态锚 ═══
  console.log('═══ S 静态锚 ═══');
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  const scSrc = norm(await (await fetch(BASE + '/assets/js/site-config.js')).text());
  const sc = mk(scSrc);
  ok('S1 site-config：51.0 在位+50.0 赋值零残留+changelog 头各 ×1+rev 占位各 ×1+站点恒 58.26',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.51.0';") === 1 && sc("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") === 0 &&
    sc('// v10.28.51.0 = ') === 1 && sc('// v10.28.50.0 = ') === 1 &&
    sc('rev 00359-XXX') === 1 && sc('rev 00360-???') === 1 &&
    sc("window.MN_SITE_VERSION = 'v0.2.58.26';") === 1 && sc("window.MN_SITE_VERSION = 'v0.2.58.25';") === 0,
    'fc51=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.51.0';") + ' fc50=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") +
    ' cl51=' + sc('// v10.28.51.0 = ') + ' r59=' + sc('rev 00359-XXX') + ' q60=' + sc('rev 00360-???') +
    ' v26=' + sc("window.MN_SITE_VERSION = 'v0.2.58.26';"));

  const fc = norm(await (await fetch(BASE + FC_URL_PATH)).text());
  const fcLines = fc.split('\n');
  const c = (a) => fcLines.filter((l) => l.includes(a)).length;
  const FC_ANCHORS = [['id="fcTeamWizard"', 1], ['id="fcTwStepper"', 1],
    ['function openTeamWizard', 1], ['function closeTeamWizard', 1], ['function teamWizardSubmit', 1],
    ['function loadTeamsFromApi', 1], ['function fcEnsureApi', 1], ['no-teams-cta', 2],
    ['copyItems: cur.all', 1], ['body.chat = { name: chatName', 1], ["MN_API.post('/teams', body)", 1],
    ["MN_API.get('/friends')", 1], ['selectAccount(res.data.team.id)', 1], ['fc-ch-avatar-crop', 6],
    ["TEAM_ITEM_KEYS = ['posts'", 1], ["'has-teams'", 2]];
  const fcBad = FC_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S2 fluidcanvas 向导 16 锚全中', fcBad.length === 0, fcBad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '16/16');

  const msg = norm(await (await fetch(BASE + MSG_URL_PATH)).text());
  const msgLines = msg.split('\n');
  const mc = (a) => msgLines.filter((l) => l.includes(a)).length;
  const MSG_ANCHORS = [['var cloudGroups = {}', 1], ['function mergeCloudGroups', 1], ["kind !== 'group'", 1],
    ['id="groupFriendPick"', 1], ['function loadGroupFriendPick', 1], ['function groupFriendToggle', 1],
    ["MN_API.get('/friends')", 1], ["MN_API.post('/conversations', { kind: 'group'", 1],
    ["MN_API.get('/conversations/' + id + '/messages')", 2], ['function renderGroupMessages', 1],
    ["MN_API.post('/conversations/' + activeGroup + '/messages'", 1], ['messages.toast.groupNoFile', 1]];
  const msgBad = MSG_ANCHORS.filter(([a, n]) => mc(a) !== n);
  ok('S3 messages 群真接口 12 锚全中', msgBad.length === 0, msgBad.map(([a, n]) => a + '=' + mc(a) + '≠' + n).join(',') || '12/12');

  const pm = norm(await (await fetch(BASE + PM_URL_PATH)).text());
  const pmLines = pm.split('\n');
  const pc = (a) => pmLines.filter((l) => l.includes(a)).length;
  const PM_ANCHORS = [['data-i18n-html="premium.addon.slots8"', 1], ['data-i18n-html="premium.addon.slots16"', 1],
    ['data-i18n-html="premium.addon.slots26"', 1], ['data-i18n-html="premium.addon.slotsUnl"', 1],
    ['data-addon-cta="slots-basic"', 1], ['data-addon-cta="slots-plus"', 1],
    ['data-addon-cta="slots-premium"', 1], ['data-addon-cta="slots-ultra"', 1],
    ["startCheckout(ab, ab.dataset.addonCta, 'once')", 1], ['<strong>8</strong>', 1], ['<strong>16</strong>', 1],
    ['<strong>26</strong>', 1], ['<strong>Unlimited</strong>', 1]];
  const pmBad = PM_ANCHORS.filter(([a, n]) => pc(a) !== n);
  ok('S4 premium slots 13 锚全中（8/16/26/∞+once 结算）', pmBad.length === 0, pmBad.map(([a, n]) => a + '=' + pc(a) + '≠' + n).join(',') || '13/13');

  const BF = (p) => fs.readFileSync(path.join(ROOT, 'backend-v2', p), 'utf8');
  const blines = (src) => norm(src).split('\n');
  const bc = (src) => (a) => blines(src).filter((l) => l.includes(a)).length;
  const teams = BF('src/routes/public/teams.js'), msgRt = BF('src/routes/public/messages.js');
  const srv = BF('src/server.js'), mig32 = BF('migrations/032_team_channels.sql');
  const health = BF('test/health.test.js'), migTest = BF('test/migrations.test.js');
  const subs = BF('src/routes/public/subscriptions.js'), http = BF('src/http.js');
  const B_ANCHORS = [
    ['teams SLOT_CAP', bc(teams)('SLOT_CAP'), 2], ['teams TEAM_FULL', bc(teams)('TEAM_FULL'), 2],
    ['teams copyItems', bc(teams)('copyItems'), 1], ['teams copyIdentity', bc(teams)('copyIdentity'), 2],
    ['teams /api/friends route', bc(teams)("'/api/friends'"), 1], ['teams acceptedFriends', bc(teams)('acceptedFriends'), 4],
    ['teams chat.name', bc(teams)('chat.name'), 1], ['teams kind group', bc(teams)("'group'"), 4],
    ['messages kind=group', bc(msgRt)("kind === 'group'"), 1], ['messages name 1-60', bc(msgRt)('1-60'), 2],
    ['server registerTeams', bc(srv)('registerTeams'), 2],
    ['032 conversations.name', bc(mig32)('conversations ADD COLUMN name'), 1],
    ['032 slots-basic', bc(mig32)('slots-basic'), 1], ['032 slots-plus', bc(mig32)('slots-plus'), 1],
    ['032 slots-premium', bc(mig32)('slots-premium'), 1], ['032 slots-ultra', bc(mig32)('slots-ultra'), 1],
    ['health 61 张表', bc(health)('61'), 2],
    ['migTest user_version 32 ×5', blines(migTest).filter((l) => l.includes("user_version', { simple: true }), 32")).length, 5],
    ['subs slots-basic ×1+team_cap_addon ×5', bc(subs)('slots-basic') === 1 && bc(subs)('team_cap_addon') === 5, true],
    ['http TEAM_FULL 403', bc(http)('TEAM_FULL'), 1]
  ];
  const bBad = B_ANCHORS.filter(([, got, want]) => got !== want);
  ok('S5 后端 19 锚全中（teams/建群/SKU/032/health 61/uv32）', bBad.length === 0,
    bBad.map(([n, got, want]) => n + '=' + got + '≠' + want).join(',') || '19/19');

  const i18nSrc = norm(await (await fetch(BASE + '/assets/i18n/fluidcanvas.i18n.js')).text());
  const msgI18n = norm(await (await fetch(BASE + '/assets/i18n/messages.i18n.js')).text());
  const pmI18n = norm(await (await fetch(BASE + '/assets/i18n/premium.i18n.js')).text());
  const ic = mk(i18nSrc), im = mk(msgI18n), ip = mk(pmI18n);
  ok('S6 i18n：7 样键 ×12 + slots12 零残留',
    ic('"fc.team.wizardTitle"') === 12 && ic('"fc.team.s2All"') === 12 && ic('"fc.team.capHint"') === 12 && ic('"fc.team.back"') === 12 &&
    im('"messages.modal.groupFriendsLoading"') === 12 && im('"messages.toast.groupNoFile"') === 12 &&
    ip('premium.addon.slots8') === 12 && ip('premium.addon.slots12') === 0,
    'wt=' + ic('"fc.team.wizardTitle"') + ' a2=' + ic('"fc.team.s2All"') + ' cap=' + ic('"fc.team.capHint"') +
    ' gf=' + im('"messages.modal.groupFriendsLoading"') + ' gnf=' + im('"messages.toast.groupNoFile"') +
    ' s8=' + ip('premium.addon.slots8') + ' s12=' + ip('premium.addon.slots12'));

  // ═══ Chrome ═══
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED_SCRIPT });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    await cdp.send('Page.setDownloadBehavior', { behavior: 'deny' });
    const origHandler = cdp.ws.onmessage;
    cdp.ws.onmessage = (ev) => {
      origHandler(ev);
      try {
        const m = JSON.parse(ev.data);
        if (m.method === 'Page.javascriptDialogOpening') cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      } catch (e) {}
    };
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 30000, label);
      await sleep(700);
    };
    const wizard = () => cdp.evalJs(WIZ_EXPR);
    const toast = async () => { await sleep(150); return cdp.evalJs(TOAST_EXPR); };
    const clickNext = () => cdp.evalJs('(function(){ window.teamWizardNext(); return true; })()');
    const clickChoice = (idx) => cdp.evalJs('(function(){ var cards = document.querySelectorAll("#fcTwBody .fc-tw-choice-card"); if (cards[' + idx + ']) cards[' + idx + '].click(); return !!cards[' + idx + ']; })()');
    const clickItem = (idx) => cdp.evalJs('(function(){ var items = document.querySelectorAll("#fcTwBody .fc-tw-item"); if (items[' + idx + ']) items[' + idx + '].click(); return !!items[' + idx + ']; })()');
    const clickFriend = (idx) => cdp.evalJs('(function(){ var fs = document.querySelectorAll("#fcTwBody .fc-tw-friend"); if (fs[' + idx + ']) fs[' + idx + '].click(); return !!fs[' + idx + ']; })()');

    // ═══ B fluidcanvas CDP ═══
    console.log('═══ B fluidcanvas CDP ═══');
    // B1 访客门禁（?guest 清登录态）
    await nav(BASE + FC_URL_PATH + '?guest', FC_READY, 'fc 访客就绪');
    {
      await cdp.evalJs('(function(){ window.openTeamWizard(); })()');
      const t = await toast();
      const w = await wizard();
      ok('B1 访客门禁：toast 登录后即可创建团队频道 + 弹窗不开',
        t && t.show && t.text.indexOf('登录后即可创建团队频道') !== -1 && w.open === false, JSON.stringify({ t: t, w: w }));
    }
    // B2-B8 云模式（?prem）
    await nav(BASE + FC_URL_PATH + '?prem', FC_READY, 'fc 云模式就绪');
    {
      const w = await wizard();
      ok('B2 就绪：弹窗存在未开（未打开前无向导渲染）', w.open === false, JSON.stringify(w));
    }
    // B3 step1：选「是，直接转换」→ 下一步可用 → 进 step2
    {
      await cdp.evalJs('(function(){ window.openTeamWizard(); })()');
      await sleep(250);
      let w = await wizard();
      ok('B3a 打开弹窗：.open + 下一步禁用（未选身份）', w.open === true && w.nextDisabled === true, JSON.stringify(w));
      await clickChoice(0);
      await sleep(200);
      w = await wizard();
      ok('B3b 选是：下一步可用', w.nextDisabled === false, JSON.stringify(w));
      await clickNext();
      await sleep(200);
      w = await wizard();
      ok('B3c 进 step2：全部+四类全勾（5 行含 all-item）+ 返回钮显示', w.itemCount === 5 && w.allChecked === true &&
        w.itemChecked.join(',') === 'true,true,true,true,true' && w.backDisplay !== 'none', JSON.stringify(w));
    }
    // B4 step2：取消「贴文」→ 全部联动取消 → 进 step3
    {
      await clickItem(1); // all-item=index0，贴文=index1
      await sleep(200);
      let w = await wizard();
      ok('B4a 取消贴文：全部未勾 + 贴文未勾其余仍勾', w.allChecked === false && w.itemChecked.join(',') === 'false,false,true,true,true',
        JSON.stringify(w));
      await clickNext();
      await sleep(300);
      w = await wizard();
      ok('B4b 进 step3：好友 2 行全未勾 + 返回钮显示', w.friendCount === 2 && w.friendChecked.join(',') === 'false,false',
        JSON.stringify(w));
    }
    // B5 step3：勾 Neo + 填群名 → 提交 → POST 体奇偶
    {
      await clickFriend(0);
      await sleep(200);
      let w = await wizard();
      ok('B5a 勾 Neo：friendChecked[0]=true', w.friendChecked[0] === true, JSON.stringify(w));
      await cdp.evalJs('(function(){ var i = document.getElementById("fcTwChatName"); i.value = "电池群"; window.teamWizardChatName("电池群"); return true; })()');
      await clickNext();
      await sleep(600);
      const posted = await cdp.evalJs('(function(){ return window.__teamPosted; })()');
      ok('B5b POST 体奇偶：name 空+copyIdentity true+copyItems [media,activity,decorations]+chat {name,memberIds:[USR-000042]}',
        posted && posted.name === '' && posted.copyIdentity === true &&
        JSON.stringify(posted.copyItems) === JSON.stringify(['media', 'activity', 'decorations']) &&
        posted.chat && posted.chat.name === '电池群' && JSON.stringify(posted.chat.memberIds) === JSON.stringify(['USR-000042']),
        JSON.stringify(posted));
    }
    // B6 成功流：toast+关弹窗+团队列表刷新（3 卡含新团）+频道卡=字母卡（无头像 URL）
    {
      const t = await toast();
      const w = await wizard();
      const sec = await cdp.evalJs(TEAM_SEC_EXPR);
      const ch = await cdp.evalJs(CH_CARD_EXPR);
      const allNames = sec.names.join('|');
      ok('B6 成功流：toast 团队频道已创建+弹窗关+团队区 3 卡（王者团/电池团/新星团）+频道卡无图字母卡',
        t && t.show && t.text.indexOf('团队频道已创建') !== -1 && w.open === false &&
        sec.hasTeams === true && sec.cardCount === 3 &&
        allNames.indexOf('王者团') !== -1 && allNames.indexOf('电池团') !== -1 && allNames.indexOf('新星团') !== -1 &&
        ch.img === false,
        JSON.stringify({ t: t, w: w, sec: sec, ch: ch }));
    }
    // B7 失败流：__teamMode=fail → 403 → toast 创建失败 + 弹窗仍开
    {
      await cdp.evalJs('(function(){ window.__teamMode = "fail"; window.openTeamWizard(); })()');
      await sleep(200);
      await clickChoice(0); await sleep(150);
      await clickNext(); await sleep(150);
      await clickNext(); await sleep(150);
      await clickNext(); await sleep(600);
      const t = await toast();
      const w = await wizard();
      ok('B7 失败流：toast 创建失败，请稍后重试 + 弹窗保持开',
        t && t.show && t.text.indexOf('创建失败，请稍后重试') !== -1 && w.open === true, JSON.stringify({ t: t, w: w }));
      await cdp.evalJs('(function(){ window.closeTeamWizard(); window.__teamMode = null; })()');
    }
    // B8 团队频道卡：有头像 URL 团队=图片卡（selectAccount 王者团）
    {
      await cdp.evalJs('(function(){ window.selectAccount("TEA-000001"); return true; })()');
      await sleep(300);
      const ch = await cdp.evalJs(CH_CARD_EXPR);
      ok('B8 团队频道卡：王者团头像图卡（fc-ch-avatar-crop img）+ 名称/成员数文案',
        ch.img === true && ch.text.indexOf('王者团') !== -1 && ch.text.indexOf('3') !== -1, JSON.stringify(ch));
    }

    // ═══ C messages CDP ═══
    console.log('═══ C messages CDP ═══');
    await nav(BASE + MSG_URL_PATH + '?prem', MSG_READY, 'messages 就绪');
    await waitFor(cdp, "document.querySelectorAll('#groupList .card').length > 0", 15000, '云群入侧栏');
    {
      const gl = await cdp.evalJs("(function(){ var cards = document.querySelectorAll('#groupList .card');" +
        " return Array.prototype.map.call(cards, function (c) { return c.textContent; }); })()");
      ok('C1 云群入侧栏：群卡含 电池群/2 名成员（dm 不进群侧栏）', gl.length === 1 && gl[0].indexOf('电池群') !== -1 &&
        gl[0].indexOf('2 名成员') !== -1, JSON.stringify(gl));
    }
    // C2 打开云群：消息从 API 拉（欢迎入群）
    {
      await cdp.evalJs('(function(){ window.openGroupChat("CONV-000001"); return true; })()');
      await sleep(600);
      const gml = await cdp.evalJs("(function(){ var l = document.getElementById('groupMessageList');" +
        " var n = document.getElementById('groupChatName'); return { text: l.textContent, name: n.textContent }; })()");
      ok('C2 云群消息：群头 电池群 + 消息 欢迎入群', gml.name === '电池群' && gml.text.indexOf('欢迎入群') !== -1,
        JSON.stringify(gml));
    }
    // C3 发群消息：POST 体奇偶 + 新气泡
    {
      await cdp.evalJs('(function(){ var i = document.getElementById("groupChatInput"); i.value = "hello team"; window.sendGroupMessage(); return true; })()');
      await sleep(600);
      const posted = await cdp.evalJs('(function(){ return window.__msgPosted; })()');
      const gml = await cdp.evalJs("document.getElementById('groupMessageList').textContent");
      ok('C3 发群消息：POST {content:hello team} + 气泡出现',
        posted && posted.content === 'hello team' && gml.indexOf('hello team') !== -1,
        JSON.stringify({ posted: posted, tail: gml.slice(-60) }));
    }
    // C4 建群真接口：chooseAction(group) → 好友多选 → POST 体奇偶 → 成功文案
    {
      await cdp.evalJs('(function(){ window.chooseAction("group"); return true; })()');
      await waitFor(cdp, "document.querySelectorAll('#groupFriendPick .group-friend-item').length === 2", 10000, '好友列表');
      await cdp.evalJs('(function(){ var fs = document.querySelectorAll("#groupFriendPick .group-friend-item"); window.groupFriendToggle(fs[0]); return true; })()');
      await cdp.evalJs('(function(){ var i = document.getElementById("groupNameInput"); i.value = "新电池群"; window.createGroupDemo(); return true; })()');
      await sleep(700);
      const posted = await cdp.evalJs('(function(){ return window.__convPosted; })()');
      const res = await cdp.evalJs("(function(){ var r = document.getElementById('groupResult'); return { text: r.textContent, show: r.style.display !== 'none' }; })()");
      ok('C4 建群真接口：POST {kind:group,name:新电池群,memberIds:[USR-000042]} + 成功文案「新电池群」创建成功',
        posted && posted.kind === 'group' && posted.name === '新电池群' &&
        JSON.stringify(posted.memberIds) === JSON.stringify(['USR-000042']) &&
        res.show && res.text.indexOf('新电池群') !== -1 && res.text.indexOf('创建成功') !== -1,
        JSON.stringify({ posted: posted, res: res }));
    }
    // C5 群名超长本地拒（不发 POST）
    {
      const before = await cdp.evalJs('(function(){ return (window.__fcalls || []).filter(function (c) { return c.m === "POST" && c.url.indexOf("/api/conversations") !== -1; }).length; })()');
      await cdp.evalJs('(function(){ var i = document.getElementById("groupNameInput"); i.value = "x".repeat(61); window.createGroupDemo(); return true; })()');
      await sleep(300);
      const after = await cdp.evalJs('(function(){ return (window.__fcalls || []).filter(function (c) { return c.m === "POST" && c.url.indexOf("/api/conversations") !== -1; }).length; })()');
      const res = await cdp.evalJs("(function(){ var r = document.getElementById('groupResult'); return r.textContent; })()");
      ok('C5 群名超长本地拒：60 字文案 + 零新增 POST', after === before && res.indexOf('1-60') !== -1,
        JSON.stringify({ before: before, after: after, res: res }));
    }
    // C6 400 分支文案
    {
      await cdp.evalJs('(function(){ window.__convMode = "bad400"; var i = document.getElementById("groupNameInput"); i.value = "非法群"; window.createGroupDemo(); return true; })()');
      await sleep(500);
      const res = await cdp.evalJs("(function(){ var r = document.getElementById('groupResult'); return r.textContent; })()");
      ok('C6 400 分支：groupBad400 文案（1-60 字符且只能邀请好友）', res.indexOf('1-60') !== -1 && res.indexOf('好友') !== -1,
        JSON.stringify(res));
    }

    // ═══ D premium CDP ═══
    console.log('═══ D premium CDP ═══');
    await nav(BASE + PM_URL_PATH + '?prem', PM_READY, 'premium 就绪');
    {
      await cdp.evalJs('(function(){ var b1 = document.querySelector("[data-addon-cta=slots-basic]"); b1.click(); return true; })()');
      await sleep(400);
      const p1 = await cdp.evalJs('(function(){ return window.__checkoutPosted; })()');
      ok('D1a slots-basic 点击奇偶：checkout {tierKey:slots-basic, mode:once}',
        p1 && p1.tierKey === 'slots-basic' && p1.mode === 'once', JSON.stringify(p1));
      await cdp.evalJs('(function(){ var b4 = document.querySelector("[data-addon-cta=slots-ultra]"); b4.click(); return true; })()');
      await sleep(400);
      const p2 = await cdp.evalJs('(function(){ return window.__checkoutPosted; })()');
      ok('D1b slots-ultra 点击奇偶：checkout {tierKey:slots-ultra, mode:once}',
        p2 && p2.tierKey === 'slots-ultra' && p2.mode === 'once', JSON.stringify(p2));
    }

    // ═══ E 零异常 ═══
    console.log('═══ E 零异常 ═══');
    ok('E1 全程零 JS 异常/控制台错误', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '零异常');

    console.log('🎉 ' + pass + '/' + (pass + fail) + ' 全绿');
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.log('💔 电池崩溃: ' + e.message);
    if (cdp && cdp.errs && cdp.errs.length) console.log('  异常: ' + cdp.errs.slice(0, 5).join(' | '));
    process.exit(1);
  } finally {
    try { cdp && cdp.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
  }
})();
