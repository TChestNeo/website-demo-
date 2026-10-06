// tmp-battery-fc-rewards.js — v10.28.52.3 等级奖励电池（本地工作树）
//   S 静态：site-config 52.1 赋值/51.1 零残留/changelog 头 52.1/51.1/51.0/rev 终态 00363-ksq+00364-wdg（640 轮锚改真值）/站点 58.28；
//     storage TEAM_LEVELS 1.5× 阈值表/getTeamLevelState；sidebar mn:level-up → POST /rewards/claim 链；
//     编辑器 teamId 发布分键（getFcTeamPublishId/publishIdKey/body.teamId）；
//     fluidcanvas 团队徽章/成就条/关注切换锚；资料页奖励区全锚（loadRewardsMe/prCosm*/edit 弹窗装饰/边缘门）；
//     后端 config 五事件表/team-xp 双向对称/auth FRAME_KEYS+TITLE_KEYS/social 钩子/server 注册/rewards 端点；
//     i18n common rewards 样键 ×12 + fluidcanvas fc.rewards 样键 ×12；
//   B CDP（community-profile.html?id=USR-000101 + URL 变体罐头；fluidcanvas.html?teamview 团队视图）：
//     B1 mn:level-up → POST /rewards/claim {scope:'user',lv:2} + bottom:80px 领奖 toast + mn:rewards-changed；
//     B2 l2 奖励区：成就「官方对你的认可 Lv.2」+徽章「勋章」+rookie 使用/champion 锁+称号锁+免费边缘 使用中；
//     B3 使用 rookie-frame → PATCH {avatarFrame} + active 芯片 + has-frame frame-rookie + ::after 3px 环 + toast 装饰已更新；
//     B4 卸下 → PATCH null + 环撤；B5 编辑弹窗：champion 金罩锁点击 toast+零 PATCH、选 rookie 保存 → PATCH 含 avatarFrame；
//     B6 l2 边缘门禁：零 edge-locked + 升级链接隐藏；B7 ?empty：奖励空态文案+边缘全锁+升级链接可见+rookie 相框也锁；
//     B8 ?l6：成就 2 条+徽章 2 枚+全解锁 → 使用 veteran-title → PATCH title + 金药丸「我是老资历」+ champion 相框金环；
//     B9 fluidcanvas ?teamview：团队徽章 Lv.4（7200 XP）+7.2K 团队经验+成就条「新国崛起！」+关注 POST/DELETE 双向切换；
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
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-fc-rewards-' + Date.now());
const PROFILE_URL_PATH = '/pages/community-profile.html';
const FC_URL_PATH = '/pages/fluidcanvas.html';

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

// ── 种子（URL 变体驱动）──
const SEED_SCRIPT = 'try{(function(){' +
  ' var q = location.search || "";' +
  ' if (q.indexOf("guest") !== -1) { localStorage.removeItem("slati_session"); localStorage.removeItem("slati_user"); return; }' +
  ' localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "电池用户", citizenId: "CIT-000101", bio: "电池用户简介", gender: "Male", tier: "free" }));' +
  ' localStorage.setItem("slati_lang", "zh-CN");' +
  ' if (q.indexOf("teamview") !== -1) {' +
  '  localStorage.setItem("slati_teams", JSON.stringify([{ id: "TEAM-X001", name: "测试团队", role: "Owner", members: 3 }]));' +
  '  localStorage.setItem("slati_active_account", JSON.stringify("TEAM-X001"));' +
  ' } else { try { localStorage.removeItem("slati_teams"); localStorage.removeItem("slati_active_account"); } catch (e) {} }' +
  '})();}catch(e){}';

// ── fetch 罐头：URL 变体 rewards/me（l2 默认/l6 全档/empty 空）+ claim/PATCH 记录 + 团队三端点 ──
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var q = location.search || "";' +
  ' window.__fetchCalls = []; window.__claimCalls = []; window.__patchedMe = null; window.__patchCount = 0; window.__teamFollowCalls = [];' +
  ' function res(status, body) { return new Promise(function (resolve) { setTimeout(function () {' +
  '   resolve({ status: status, ok: status >= 200 && status < 300, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(body); } });' +
  '  }, 40); }); }' +
  ' function readUser() { try { return JSON.parse(localStorage.getItem("slati_user") || "null") || {}; } catch (e) { return {}; } }' +
  ' function rewardsPayload() {' +
  '  if (q.indexOf("empty") !== -1) return { achievements: [], badges: [], cosmetics: [], edgeUnlocked: false };' +
  '  if (q.indexOf("l6") !== -1) return { achievements: [' +
  '    { id: "ACH-user-2", name: "官方对你的认可", description: "个人等级达到 Lv.2", level: 2 },' +
  '    { id: "ACH-user-6", name: "恭喜你成为老玩家", description: "个人等级达到 Lv.6", level: 6 }],' +
  '   badges: [{ id: "BADGE-user-2" }, { id: "BADGE-user-6" }],' +
  '   cosmetics: [{ kind: "frame", value: "rookie-frame" }, { kind: "frame", value: "champion-frame" },' +
  '               { kind: "title", value: "veteran-title" }, { kind: "edge", value: "free-edge" }], edgeUnlocked: true };' +
  '  return { achievements: [{ id: "ACH-user-2", name: "官方对你的认可", description: "个人等级达到 Lv.2", level: 2 }],' +
  '   badges: [{ id: "BADGE-user-2" }],' +
  '   cosmetics: [{ kind: "frame", value: "rookie-frame" }, { kind: "edge", value: "free-edge" }], edgeUnlocked: true };' +
  ' }' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/api/") === -1) return realFetch(url, opts);' +
  '  var method = (opts && opts.method) || "GET";' +
  '  var rawBody = (opts && opts.body != null) ? opts.body : null;' +
  '  window.__fetchCalls.push({ url: u, method: method, body: typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody == null ? null : rawBody) });' +
  '  if (method === "POST" && u.indexOf("/rewards/claim") !== -1) {' +
  '   var cb = {}; try { cb = JSON.parse(rawBody || "{}"); } catch (e) {}' +
  '   window.__claimCalls.push(cb);' +
  '   return res(200, { ok: true, claimed: true });' +
  '  }' +
  '  if (method === "PATCH" && u.indexOf("/auth/me") !== -1) {' +
  '   window.__patchCount++;' +
  '   var pb = {}; try { pb = JSON.parse(rawBody || "{}"); } catch (e) {}' +
  '   window.__patchedMe = pb;' +
  '   var nu = {}; var base = readUser(); for (var k in base) nu[k] = base[k]; for (var k2 in pb) nu[k2] = pb[k2];' +
  '   return res(200, { user: nu });' +
  '  }' +
  '  if (method === "GET" && u.indexOf("/auth/me") !== -1) return res(200, { user: readUser() });' +
  '  if (method === "GET" && u.indexOf("/health") !== -1) return res(200, { status: "ok", db: "ok", tables: 66 });' +
  '  if (method === "GET" && u.indexOf("/rewards/me") !== -1) return res(200, rewardsPayload());' +
  '  if (u.indexOf("/social/users/USR-000101") !== -1) {' +
  '   if (u.indexOf("/posts") !== -1) return res(200, { posts: [] });' +
  '   var me = readUser();' +
  '   me.isSelf = true; me.followedByMe = false; me.followerCount = 2; me.followingCount = 3;' +
  '   me.stats = { postCount: 0, repostCount: 0, likeReceivedCount: 0, likeCount: 0, favoriteCount: 0 };' +
  '   return res(200, { user: me });' +
  '  }' +
  '  if (method === "GET" && u.indexOf("/fc/overview") !== -1) return res(200, { stats: {} });' +
  '  if (method === "GET" && u.indexOf("/fc/edges/scopes") !== -1) return res(200, { hasFriends: false, hasTeam: false });' +
  '  if (u.indexOf("/teams/TEAM-X001/rewards") !== -1) return Promise.resolve(res(200, { xpGained: 7200, level: 4,' +
  '   achievements: [{ id: "ACH-team-2", name: "新国崛起！", description: "团队等级达到 Lv.2", level: 2 }], badges: [] }));' +
  '  if (u.indexOf("/teams/TEAM-X001/follow") !== -1) {' +
  '   window.__teamFollowCalls.push(method);' +
  '   return Promise.resolve(res(200, method === "DELETE" ? { following: false, followerCount: 5 } : { following: true, followerCount: 6 }));' +
  '  }' +
  '  if (method === "GET" && u.indexOf("/api/teams") !== -1) {' +
  '   return Promise.resolve(res(200, { teams: [{ id: "TEAM-X001", name: "测试团队", role: "Owner", members: 3, avatarUrl: null, color: "#4648d4", xpGained: 7200, followers: 5, followingByMe: false }] }));' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

// ── 页面就绪/探测表达式 ──
const PROFILE_READY = "document.getElementById('profileHeader') && document.querySelector('.profile-rewards') && document.getElementById('slati-sidebar')";
const FC_READY = "document.getElementById('fcTeamFollowBtn') && document.querySelector('.fc-team-lv-badge')";
const toastScan = (txt) => "(function(){ var els = document.querySelectorAll('body > div');" +
  " for (var i = 0; i < els.length; i++) { var el = els[i];" +
  " if (el.textContent === " + JSON.stringify(txt) + " && el.style.position === 'fixed') { return { bottom: el.style.bottom, z: el.style.zIndex }; } } return null; })()";
const REWARDS_EXPR = "(function(){ var s = document.querySelector('.profile-rewards'); if (!s) return null;" +
  " var ach = s.querySelectorAll('.pr-ach-chip'); var bdg = s.querySelectorAll('.pr-badge-chip');" +
  " var chips = s.querySelectorAll('.pr-cosm-chip');" +
  " return { ach: ach.length, achTexts: [].map.call(ach, function (c) { return c.textContent; })," +
  "  bdg: bdg.length, bdgTexts: [].map.call(bdg, function (c) { return c.textContent; })," +
  "  chips: chips.length, chipTexts: [].map.call(chips, function (c) { return c.textContent; })," +
  "  locked: s.querySelectorAll('.pr-cosm-chip.locked').length, active: s.querySelectorAll('.pr-cosm-chip.active').length," +
  "  state: s.querySelector('.pr-cosm-state') ? s.querySelector('.pr-cosm-state').textContent : null }; })()";
const AVATAR_EXPR = "(function(){ var a = document.querySelector('#profileHeader .profile-avatar'); if (!a) return null;" +
  " var cs = getComputedStyle(a, '::after');" +
  " return { cls: a.className, bw: cs.borderTopWidth, content: cs.content, bg: cs.backgroundImage }; })()";

(async () => {
  // ═══ S 静态锚 ═══
  console.log('═══ S 静态锚 ═══');
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;
  const fetchSrc = async (p) => norm(await (await fetch(BASE + p)).text());
  const lineCount = (src, a) => src.split('\n').filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF

  const scSrc = await fetchSrc('/assets/js/site-config.js');
  const sc = mk(scSrc);
  ok('S1 site-config：52.1 赋值 ×1 + 51.1 赋值零残留 + changelog 头 52.1/51.1/51.0 各 ×1 + rev 终态 00363-ksq/00364-wdg 各 ×1（640 轮锚改真值=639 终态口径）+ 站点 58.28',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.60.0';") === 1 && sc("window.FLUIDCANVAS_VERSION = 'v10.28.51.1';") === 0 &&
    sc('// v10.28.52.3 = ') === 1 && sc('// v10.28.51.1 = ') === 1 && sc('// v10.28.51.0 = ') === 1 &&
    sc('00363-ksq') === 1 && sc('00364-wdg') === 1 &&
    sc("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1,
    'fc520=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.60.0';") + ' fc511=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.51.1';") +
    ' cl520=' + sc('// v10.28.52.3 = ') + ' r63=' + sc('00363-ksq') + ' q64=' + sc('00364-wdg'));

  const stSrc = await fetchSrc('/assets/js/storage.js');
  const st = mk(stSrc);
  ok('S2 storage.js：TEAM_LEVELS 1.5× 阈值表（×8）+ getTeamLevelState（×3）+ 阈值字面量逐字',
    st('var TEAM_LEVELS = [0, 1800, 3600, 7200, 14400, 28800, 57600, 115200, 230400, 460800, 921600, 1843200]') === 1 &&
    lineCount(stSrc, 'TEAM_LEVELS') === 8 && lineCount(stSrc, 'getTeamLevelState') === 3,
    'arr=' + st('var TEAM_LEVELS = [0, 1800') + ' tl=' + lineCount(stSrc, 'TEAM_LEVELS') + ' gl=' + lineCount(stSrc, 'getTeamLevelState'));

  const sbSrc = await fetchSrc('/assets/js/sidebar.js');
  const sb = mk(sbSrc);
  ok('S3 sidebar.js：mn:level-up → POST /rewards/claim 链（claim 端点/奖励级门/claimOk toast/广播）',
    sb("'/rewards/claim'") === 1 && sb('{2:1, 6:1, 9:1, 12:1}[st.lv]') === 1 &&
    sb("'rewards.claimOk'") === 1 && sb('mn:rewards-changed') === 2,
    'claim=' + sb("'/rewards/claim'") + ' gate=' + sb('{2:1, 6:1, 9:1, 12:1}[st.lv]') +
    ' ok=' + sb("'rewards.claimOk'") + ' bc=' + sb('mn:rewards-changed'));

  const edSrc = await fetchSrc('/pages/fluidcanvas-editor.html');
  ok('S4 编辑器：团队发布分键（getFcTeamPublishId ×2 + body.teamId ×1 + 分键后缀 ×1）',
    mk(edSrc)('getFcTeamPublishId') === 2 && mk(edSrc)('body.teamId') === 1 &&
    mk(edSrc)("':' + fcTeamPublishId") === 1,
    'gt=' + mk(edSrc)('getFcTeamPublishId') + ' bt=' + mk(edSrc)('body.teamId') + ' pk=' + mk(edSrc)("':' + fcTeamPublishId"));

  const fcSrc = await fetchSrc(FC_URL_PATH);
  const FC_ANCHORS = [
    ['fc-team-lv-badge', 3], ['fc-team-ach-strip', 2], ['fc-team-ach-chip', 3], ['fc-team-ach-empty', 2],
    ['fcToggleTeamFollow', 3], ['loadTeamRewards', 4], ['teamRewardsCache', 3], ['teamAchStripHtml', 2],
    ['fc.rewards.teamXp', 1], ['fc.rewards.follow', 3], ['fc.rewards.unfollow', 1],
    ['fc.rewards.followFail', 2], ['fc.rewards.teamAchEmpty', 1]
  ];
  const fcBad = FC_ANCHORS.filter(([a, n]) => lineCount(fcSrc, a) !== n);
  ok('S5 fluidcanvas.html：团队徽章/成就条/关注/奖励缓存 13 锚全中', fcBad.length === 0,
    fcBad.map(([a, n]) => a + '=' + lineCount(fcSrc, a) + '≠' + n).join(',') || '13/13');

  const pfSrc = await fetchSrc(PROFILE_URL_PATH);
  const PF_ANCHORS = [
    ['loadRewardsMe', 4], ['REWARDS_ME', 14], ['renderRewardsSectionHtml', 2], ['prCosmBtn', 3],
    ['prCosmUse', 2], ['prCosmRemove', 2], ['prCosmPatch', 3], ['pr-edit-swatch', 5],
    ['has-frame', 5], ['pr-title-pill', 2], ['mn:rewards-changed', 2], ['profile-rewards', 4],
    ['pr-ach-chip', 4], ['pr-badge-chip', 3], ['pr-cosm-row', 5], ['gold-locked', 6],
    ['edgeUnlocked', 4], ['edgeFree', 4], ['hasCosmetic', 7], ['badgeName', 2]
  ];
  const pfBad = PF_ANCHORS.filter(([a, n]) => lineCount(pfSrc, a) !== n);
  ok('S6 资料页：奖励区/装饰操作/编辑弹窗/边缘门 20 锚全中', pfBad.length === 0,
    pfBad.map(([a, n]) => a + '=' + lineCount(pfSrc, a) + '≠' + n).join(',') || '20/20');

  const readB = (p) => norm(fs.readFileSync(path.join(ROOT, 'backend-v2', p), 'utf8'));
  const cfg = readB('src/config.js');
  ok('S7a config.js：团队 XP 五事件钦定表（上传24/赞16/粉丝32/收藏36/分享20）',
    mk(cfg)('teamGained: { upload: 24, like: 16, fan: 32, favorite: 36, share: 20 }') === 1,
    'tg=' + mk(cfg)('teamGained'));
  const txp = readB('src/routes/public/team-xp.js');
  ok('S7b team-xp.js：双向对称（gain/lose 同额 + MAX(0,…) 不穿负）',
    mk(txp)('function gainTeamXp') === 1 && mk(txp)('function loseTeamXp') === 1 && mk(txp)('MAX(0, xp_gained - ?)') === 1,
    'g=' + mk(txp)('function gainTeamXp') + ' l=' + mk(txp)('function loseTeamXp') + ' m=' + mk(txp)('MAX(0'));
  const ath = readB('src/routes/public/auth.js');
  ok('S7c auth.js：装饰白名单（FRAME_KEYS/TITLE_KEYS）+ PATCH 拥有权门',
    mk(ath)("const FRAME_KEYS = ['rookie-frame', 'champion-frame']") === 1 && mk(ath)("const TITLE_KEYS = ['veteran-title']") === 1 &&
    mk(ath)('user_cosmetics') >= 1,
    'fk=' + mk(ath)('FRAME_KEYS') + ' tk=' + mk(ath)('TITLE_KEYS'));
  const soc = readB('src/routes/public/social.js');
  ok('S7d social.js：五事件 13 钩子（gain ×7 / lose ×6）', mk(soc)('gainTeamXp') === 7 && mk(soc)('loseTeamXp') === 6,
    'g=' + mk(soc)('gainTeamXp') + ' l=' + mk(soc)('loseTeamXp'));
  const srv = readB('src/server.js');
  const rwd = readB('src/routes/public/rewards.js');
  ok('S7e server.js 注册 + rewards.js 端点（幂等 INSERT OR IGNORE ×6 + 团队阈值 ×6 + edgeUnlocked ×1）',
    mk(srv)('registerRewards') === 2 && mk(rwd)('INSERT OR IGNORE') === 6 && mk(rwd)('TEAM_LEVELS') === 6 && mk(rwd)('edgeUnlocked') === 1,
    'reg=' + mk(srv)('registerRewards') + ' io=' + mk(rwd)('INSERT OR IGNORE') + ' tl=' + mk(rwd)('TEAM_LEVELS') + ' eu=' + mk(rwd)('edgeUnlocked'));

  const cmnSrc = await fetchSrc('/assets/i18n/common.i18n.js');
  ok('S8a common.i18n.js：rewards 样键 ×12（claimOk/badge.user2/title.veteran/frame.rookie/toast.locked）',
    lineCount(cmnSrc, 'rewards.claimOk') === 12 && lineCount(cmnSrc, 'rewards.badge.user2') === 12 && lineCount(cmnSrc, 'rewards.title.veteran') === 12 &&
    lineCount(cmnSrc, 'rewards.frame.rookie') === 12 && lineCount(cmnSrc, 'rewards.toast.locked') === 12,
    'ok=' + lineCount(cmnSrc, 'rewards.claimOk') + ' b2=' + lineCount(cmnSrc, 'rewards.badge.user2') + ' tv=' + lineCount(cmnSrc, 'rewards.title.veteran') +
    ' fr=' + lineCount(cmnSrc, 'rewards.frame.rookie') + ' tl=' + lineCount(cmnSrc, 'rewards.toast.locked'));
  const fciSrc = await fetchSrc('/assets/i18n/fluidcanvas.i18n.js');
  const fm = mk(fciSrc);
  ok('S8b fluidcanvas.i18n.js：fc.rewards 样键 ×12（teamXp/follow/teamAchEmpty）',
    fm('"fc.rewards.teamXp"') === 12 && fm('"fc.rewards.follow"') === 12 && fm('"fc.rewards.teamAchEmpty"') === 12,
    'xp=' + fm('"fc.rewards.teamXp"') + ' fo=' + fm('"fc.rewards.follow"') + ' ae=' + fm('"fc.rewards.teamAchEmpty"'));

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
    const origHandler = cdp.ws.onmessage;
    cdp.ws.onmessage = (ev) => {
      origHandler(ev);
      try {
        const m = JSON.parse(ev.data);
        if (m.method === 'Page.javascriptDialogOpening') cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      } catch (e) {}
    };

    console.log('═══ B 资料页 CDP（?id=USR-000101&l2）═══');
    await cdp.send('Page.navigate', { url: BASE + PROFILE_URL_PATH + '?id=USR-000101&l2' });
    await waitFor(cdp, PROFILE_READY, 40000, '资料页 l2 就绪');
    await sleep(900);

    // ═══ B1 mn:level-up → 自动领奖链（侧栏监听 → claim → 广播）═══
    {
      await cdp.evalJs("(function(){ window.dispatchEvent(new CustomEvent('mn:level-up', { detail: { state: { lv: 2, name: '测试' }, from: { lv: 1 } } })); })()");
      await sleep(600);
      const claims = await cdp.evalJs('window.__claimCalls');
      const t2 = await cdp.evalJs(toastScan('奖励已领取！去个人资料页查看成就与徽章'));
      ok('B1a claim POST 恰一次：体 {scope:"user",lv:2}',
        claims.length === 1 && claims[0].scope === 'user' && claims[0].lv === 2, JSON.stringify(claims));
      ok('B1b 领奖 toast：正文逐字 + fixed + bottom 80px（升级 toast 之上第二层）',
        t2 !== null && t2.bottom === '80px', JSON.stringify(t2));
    }

    // ═══ B2 l2 奖励区结构（成就/徽章/装饰四行）═══
    {
      const rw = await cdp.evalJs(REWARDS_EXPR);
      const av = await cdp.evalJs(AVATAR_EXPR);
      ok('B2a 成就行 1 条：服务端名「官方对你的认可」+ Lv.2 角标',
        rw.ach === 1 && rw.achTexts[0].indexOf('官方对你的认可') !== -1 && rw.achTexts[0].indexOf('Lv.2') !== -1,
        JSON.stringify(rw.achTexts));
      ok('B2b 徽章行 1 枚：i18n rewards.badge.user2 =「勋章」',
        rw.bdg === 1 && rw.bdgTexts[0].indexOf('勋章') !== -1, JSON.stringify(rw.bdgTexts));
      ok('B2c 装饰 4 芯片：rookie 使用/champion 锁/称号锁/免费边缘——locked=2 active=0',
        rw.chips === 4 && rw.locked === 2 && rw.active === 0, JSON.stringify({ chips: rw.chips, locked: rw.locked, active: rw.active }));
      ok('B2d 文案逐字：rookie「新手免费头像相框+使用」+ 边缘「免费名片边缘+使用中」',
        rw.chipTexts[0].indexOf('新手免费头像相框') !== -1 && rw.chipTexts[0].indexOf('使用') !== -1 &&
        rw.chipTexts[3].indexOf('免费名片边缘') !== -1 && rw.chipTexts[3].indexOf('使用中') !== -1,
        JSON.stringify(rw.chipTexts));
      ok('B2e 初始零相框：avatar 无 has-frame', av !== null && av.cls.indexOf('has-frame') === -1, JSON.stringify(av));
    }

    // ═══ B3 使用 rookie-frame → PATCH + 环 + toast ═══
    {
      await cdp.evalJs("(function(){ var b = document.querySelector('.pr-cosm-chip .pr-cosm-use'); b.click(); })()");
      await sleep(500);
      const p1 = await cdp.evalJs('window.__patchedMe');
      const av1 = await cdp.evalJs(AVATAR_EXPR);
      const t1 = await cdp.evalJs(toastScan('装饰已更新'));
      ok('B3 使用 rookie-frame：PATCH {avatarFrame} + active 芯片 + has-frame rookie-frame + ::after 3px 主色环 + toast 装饰已更新',
        p1 && p1.avatarFrame === 'rookie-frame' &&
        av1.cls.indexOf('has-frame') !== -1 && av1.cls.indexOf('rookie-frame') !== -1 &&
        av1.bw === '3px' && av1.content !== 'none' &&
        t1 !== null && t1.bottom === '24px',
        JSON.stringify({ p: p1, av: av1, t: t1 }));
    }

    // ═══ B4 卸下 → PATCH null + 环撤 ═══
    {
      await cdp.evalJs("(function(){ var b = document.querySelector('.pr-cosm-chip.active .pr-cosm-use'); b.click(); })()");
      await sleep(500);
      const p2 = await cdp.evalJs('window.__patchedMe');
      const av2 = await cdp.evalJs(AVATAR_EXPR);
      ok('B4 卸下：PATCH {avatarFrame:null} + has-frame 撤除',
        p2 && p2.avatarFrame === null && av2.cls.indexOf('has-frame') === -1, JSON.stringify({ p: p2, cls: av2.cls }));
    }

    // ═══ B5 编辑弹窗：金罩锁点击拒 + 选择保存 PATCH ═══
    {
      await cdp.evalJs("(function(){ document.getElementById('profileEditBtn').click(); })()");
      await sleep(400);
      const grid = await cdp.evalJs("(function(){ var g = document.getElementById('editFrameGrid'); var sw = g.querySelectorAll('.pr-edit-swatch');" +
        " return { n: sw.length, locked: [].map.call(sw, function (s) { return s.classList.contains('gold-locked'); })," +
        " texts: [].map.call(sw, function (s) { return s.textContent; }) }; })()");
      ok('B5a 相框选择 3 项：无/rookie 解锁/champion 金罩锁',
        grid.n === 3 && grid.locked[0] === false && grid.locked[1] === false && grid.locked[2] === true &&
        grid.texts[2].indexOf('冠军的相框') !== -1, JSON.stringify(grid));
      const c0 = await cdp.evalJs('window.__patchCount');
      await cdp.evalJs("(function(){ var g = document.getElementById('editFrameGrid'); g.children[2].click(); })()");
      await sleep(300);
      const tLock = await cdp.evalJs(toastScan('该奖励尚未解锁（升级后自动领取）'));
      const c1 = await cdp.evalJs('window.__patchCount');
      ok('B5b 点 champion 锁：toast 尚未解锁 + 零 PATCH', tLock !== null && c1 === c0, JSON.stringify({ t: tLock, c0: c0, c1: c1 }));
      await cdp.evalJs("(function(){ var g = document.getElementById('editFrameGrid'); g.children[1].click(); })()");
      await sleep(300);
      await cdp.evalJs("(function(){ document.getElementById('editSaveBtn').click(); })()");
      await sleep(600);
      const p3 = await cdp.evalJs('window.__patchedMe');
      ok('B5c 选 rookie 保存：PATCH 体含 avatarFrame:"rookie-frame"', p3 && p3.avatarFrame === 'rookie-frame', JSON.stringify(p3));
    }

    // ═══ B6 l2 边缘门禁：已解锁 → 零 edge-locked + 升级链接隐藏 ═══
    {
      await cdp.evalJs("(function(){ document.getElementById('profileEditBtn').click(); })()");
      await sleep(400);
      const eg = await cdp.evalJs("(function(){ var grid = document.getElementById('editEdgeGrid'); var link = document.getElementById('cardEdgeUpgradeLink');" +
        " return { lockedN: grid.querySelectorAll('.edge-locked').length, linkDisplay: link ? getComputedStyle(link).display : null }; })()");
      ok('B6 l2 已解锁（edgeUnlocked=true）：边缘网格零锁 + 升级链接 display:none',
        eg.lockedN === 0 && eg.linkDisplay === 'none', JSON.stringify(eg));
      await cdp.evalJs("(function(){ document.getElementById('editCancelBtn').click(); })()");
      await sleep(300);
    }

    console.log('═══ B 资料页 CDP（?empty 变体：未领奖免费用户）═══');
    await cdp.send('Page.navigate', { url: BASE + PROFILE_URL_PATH + '?id=USR-000101&empty' });
    await waitFor(cdp, PROFILE_READY, 40000, '资料页 empty 就绪');
    await sleep(900);

    // ═══ B7 空奖励态 + 边缘门禁锁 ═══
    {
      const emptyTxt = await cdp.evalJs("(function(){ var e = document.querySelector('.profile-rewards .pr-empty'); return e ? e.textContent : null; })()");
      ok('B7a 空态文案逐字（rewards.empty）',
        emptyTxt === '还没有解锁任何奖励——升级到 Lv.2 / Lv.6 / Lv.9 / Lv.12 自动领取', emptyTxt);
      await cdp.evalJs("(function(){ document.getElementById('profileEditBtn').click(); })()");
      await sleep(400);
      const eg2 = await cdp.evalJs("(function(){ var grid = document.getElementById('editEdgeGrid'); var link = document.getElementById('cardEdgeUpgradeLink');" +
        " var fg = document.getElementById('editFrameGrid');" +
        " return { lockedN: grid.querySelectorAll('.edge-locked').length, linkDisplay: link ? getComputedStyle(link).display : null," +
        " rookieLocked: fg.children[1].classList.contains('gold-locked') }; })()");
      ok('B7b 未领奖免费：边缘全锁（≥5）+ 升级链接可见 + rookie 相框也锁',
        eg2.lockedN >= 5 && eg2.linkDisplay === 'inline-block' && eg2.rookieLocked === true, JSON.stringify(eg2));
      await cdp.evalJs("(function(){ document.getElementById('editCancelBtn').click(); })()");
      await sleep(300);
    }

    console.log('═══ B 资料页 CDP（?l6 变体：老玩家全档）═══');
    await cdp.send('Page.navigate', { url: BASE + PROFILE_URL_PATH + '?id=USR-000101&l6' });
    await waitFor(cdp, PROFILE_READY, 40000, '资料页 l6 就绪');
    await sleep(900);

    // ═══ B8 称号使用 + champion 金环 ═══
    {
      const rw6 = await cdp.evalJs(REWARDS_EXPR);
      ok('B8a 成就 2 条（官方对你的认可 + 恭喜你成为老玩家）+ 徽章 2 枚（勋章 + 超绝老资历的骄傲）+ 装饰 4 芯片零锁',
        rw6.ach === 2 && rw6.achTexts[0].indexOf('官方对你的认可') !== -1 && rw6.achTexts[1].indexOf('恭喜你成为老玩家') !== -1 &&
        rw6.bdg === 2 && rw6.bdgTexts[1].indexOf('超绝老资历的骄傲') !== -1 &&
        rw6.chips === 4 && rw6.locked === 0,
        JSON.stringify({ ach: rw6.achTexts, bdg: rw6.bdgTexts, chips: rw6.chips, locked: rw6.locked }));
      await cdp.evalJs("(function(){ var chips = document.querySelectorAll('.pr-cosm-chip');" +
        " for (var i = 0; i < chips.length; i++) { if (chips[i].textContent.indexOf('我是老资历') !== -1) { chips[i].querySelector('.pr-cosm-use').click(); break; } } })()");
      await sleep(500);
      const p4 = await cdp.evalJs('window.__patchedMe');
      const pill = await cdp.evalJs("(function(){ var p = document.querySelector('#profileHeader .pr-title-pill'); return p ? p.textContent : null; })()");
      ok('B8b 使用 veteran-title：PATCH {title} + 昵称旁金药丸「我是老资历」',
        p4 && p4.title === 'veteran-title' && pill === '我是老资历', JSON.stringify({ p: p4, pill: pill }));
      await cdp.evalJs("(function(){ var chips = document.querySelectorAll('.pr-cosm-chip');" +
        " for (var i = 0; i < chips.length; i++) { if (chips[i].textContent.indexOf('冠军的相框') !== -1) { chips[i].querySelector('.pr-cosm-use').click(); break; } } })()");
      await sleep(500);
      const p5 = await cdp.evalJs('window.__patchedMe');
      const avc = await cdp.evalJs(AVATAR_EXPR);
      ok('B8c 使用 champion-frame：PATCH {avatarFrame} + has-frame champion-frame + ::after 金环 conic-gradient',
        p5 && p5.avatarFrame === 'champion-frame' &&
        avc.cls.indexOf('has-frame') !== -1 && avc.cls.indexOf('champion-frame') !== -1 &&
        avc.bg.indexOf('conic-gradient') !== -1,
        JSON.stringify({ p: p5, cls: avc.cls, bg: avc.bg.slice(0, 80) }));
    }

    console.log('═══ B fluidcanvas 团队视图（?teamview：XP 7200=Lv.4）═══');
    await cdp.send('Page.navigate', { url: BASE + FC_URL_PATH + '?teamview' });
    await waitFor(cdp, FC_READY, 40000, 'fluidcanvas 团队视图就绪');
    await sleep(900);

    // ═══ B9 团队等级徽章/XP/成就条/关注切换 ═══
    {
      const badge = await cdp.evalJs("(function(){ var b = document.querySelector('.fc-team-lv-badge'); return b ? b.textContent : null; })()");
      ok('B9a 团队徽章 Lv.4（7200 XP ≥ 1.5× 阈值 7200）', badge === 'Lv.4', badge);
      const xpSpan = await cdp.evalJs("(function(){ var els = document.querySelectorAll('span');" +
        " for (var i = 0; i < els.length; i++) { var t = els[i].textContent;" +
        " if (t.indexOf('7.2K') !== -1 && t.indexOf('团队经验') !== -1) return t; } return null; })()");
      ok('B9b 团队 XP 统计：7.2K 团队经验（fcCompact+fc.rewards.teamXp）', xpSpan !== null, xpSpan);
      const strip = await cdp.evalJs("(function(){ var s = document.querySelector('.fc-team-ach-strip'); return s ? s.textContent : null; })()");
      ok('B9c 团队成就条：新国崛起！（ACH-team-2 服务端名）', strip !== null && strip.indexOf('新国崛起！') !== -1, strip);
      const btn0 = await cdp.evalJs("(function(){ var b = document.getElementById('fcTeamFollowBtn'); return b ? b.textContent : null; })()");
      await cdp.evalJs("(function(){ document.getElementById('fcTeamFollowBtn').click(); })()");
      await sleep(700);
      const btn1 = await cdp.evalJs("(function(){ var b = document.getElementById('fcTeamFollowBtn'); return b ? b.textContent : null; })()");
      const fan1 = await cdp.evalJs("(function(){ var els = document.querySelectorAll('span');" +
        " for (var i = 0; i < els.length; i++) { if (els[i].textContent === '6 关注者') return true; } return false; })()");
      const calls1 = await cdp.evalJs('window.__teamFollowCalls');
      ok('B9d 点关注：POST /teams/:id/follow → 按钮「已关注」+ 粉丝 6',
        btn0.indexOf('关注') !== -1 && btn1.indexOf('已关注') !== -1 && fan1 === true && calls1.length === 1 && calls1[0] === 'POST',
        JSON.stringify({ b0: btn0, b1: btn1, fan1: fan1, calls: calls1 }));
      await cdp.evalJs("(function(){ document.getElementById('fcTeamFollowBtn').click(); })()");
      await sleep(700);
      const btn2 = await cdp.evalJs("(function(){ var b = document.getElementById('fcTeamFollowBtn'); return b ? b.textContent : null; })()");
      const fan2 = await cdp.evalJs("(function(){ var els = document.querySelectorAll('span');" +
        " for (var i = 0; i < els.length; i++) { if (els[i].textContent === '5 关注者') return true; } return false; })()");
      const calls2 = await cdp.evalJs('window.__teamFollowCalls');
      ok('B9e 再点取关：DELETE → 按钮回「关注」+ 粉丝 5（双向对称前端实证）',
        btn2.indexOf('已关注') === -1 && btn2.indexOf('关注') !== -1 && fan2 === true && calls2.length === 2 && calls2[1] === 'DELETE',
        JSON.stringify({ b2: btn2, fan2: fan2, calls: calls2 }));
    }
  } catch (e) {
    console.log('  💔 ' + e.message);
    fail++;
  }
  console.log('═══ E 零异常 ═══');
  const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
  const rawErrs = cdp ? cdp.errs : [];
  const errs = rawErrs.filter(e => !noise.test(e));
  ok('E 零异常（' + rawErrs.length + ' 原始 / ' + errs.length + ' 噪声后）', errs.length === 0, errs.slice(0, 5).join(' || '));
  try { cdp && cdp.close(); } catch (e) {}
  try { require('child_process').spawnSync('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' }); } catch (e) {}

  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(fail === 0 ? 0 : 1);
})();
