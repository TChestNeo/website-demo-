// tmp-battery-msg-anim.js — v0.2.49.8 Messages 页动画掉帧修复电池（Request H）
// 用户「现在是Messages 那边的动画有明显掉帧请优化一下」
// 断言面：F0 静态（修复标记）→ M1-M8 功能回归（切换/侧栏/会话/发送/公告/滚动/弹窗）
//        → M9 帧健康（动画窗口内帧流动 + 主线程零长任务）→ Z 控制台零错误
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-msg-anim-batt-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); });
      return;
    }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(120);
  }
  throw new Error('waitFor 超时: ' + label);
}

// 帧/长任务记录器（document start 注入）
const FRAME_REC = `(function () {
  var last = null, twLast = null, twBuf = [], active = 0, ltBuf = [];
  (function loop(t) {
    if (last !== null) { if (active > 0) { if (twLast !== null) twBuf.push(t - twLast); twLast = t; } else twLast = null; }
    last = t;
    requestAnimationFrame(loop);
  })(0);
  ['transitionstart', 'animationstart'].forEach(function (ev) { document.addEventListener(ev, function () { active++; }, true); });
  ['transitionend', 'animationend', 'transitioncancel', 'animationcancel'].forEach(function (ev) { document.addEventListener(ev, function () { active--; if (active < 0) active = 0; }, true); });
  try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { ltBuf.push(e.duration); }); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  window.__twreset = function () { twBuf = []; twLast = null; ltBuf = []; };
  window.__twstats = function () {
    var ds = twBuf.slice(), n = ds.length, sum = 0;
    for (var i = 0; i < n; i++) sum += ds[i];
    return { n: n, mean: +((n ? sum / n : 0)).toFixed(2), lt: ltBuf.length };
  };
})();`;

(async () => {
  // ═══ F0 静态 ═══
  const msgSrc = fs.readFileSync(path.join(DOCS, 'pages', 'messages.html'), 'utf8');
  const count = (n) => msgSrc.split(n).length - 1;
  console.log('═══ F0 静态（修复标记）═══');
  // v0.2.51.2 口径：50.x 显式过渡列表已按 09-17「页面专属 CSS 永不入内联块」迁出内联块独立块
  // （当时直接写进内联块、从未回写 ethereal.css，重跑 inliner 被抹除的漂移血证）；内联块（ethereal
  // 原版）含 transition: all 属正常——页专块同特异性靠后全覆盖，F0-1 只数页专块区域
  const pgMarker = '/* ═══ Messages 页专属过渡/弹窗块';
  const pgCss = msgSrc.slice(msgSrc.indexOf(pgMarker));
  const countPg = (n) => pgCss.split(n).length - 1;
  ok('F0-1 transition: all 清零（页专块显式列表覆盖内联块 ethereal 原版）',
    msgSrc.indexOf(pgMarker) !== -1 && countPg('transition: all') === 0 && countPg('transition:all') === 0,
    'marker=' + (msgSrc.indexOf(pgMarker) !== -1) + ' all=' + countPg('transition: all') + ' 无空格=' + countPg('transition:all'));
  ok('F0-2 #msgSlide will-change: transform 层提升', msgSrc.indexOf('#msgSlide { will-change: transform') !== -1);
  ok('F0-3 面板 opacity 渐隐过渡已移除（瞬时调暗）', count('transition:opacity 0.4s ease') === 0);
  ok('F0-4 announceList CSS mask 已移除（真实属性零残留）', count('-webkit-mask-image:linear-gradient') === 0 && count('mask-image:linear-gradient') === 0);
  ok('F0-5 侧栏 width 过渡换锐曲线 0.25s cubic-bezier(0.22,0.61,0.36,1)', count('transition:width 0.25s cubic-bezier(0.22,0.61,0.36,1)') === 2);
  ok('F0-6 .msg-row.fade-up will-change', msgSrc.indexOf('.msg-row.fade-up { will-change: transform, opacity') !== -1);
  ok('F0-7 .card-hover 基础过渡（悬停抬升双向平滑）', msgSrc.indexOf('.card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }') !== -1);
  ok('F0-8 公告卡 transition 仅 box-shadow（tilt 即时跟手）', count('transition:box-shadow 0.25s ease') === 2);
  ok('F0-9 .btn/.input-glass/.modal-card/.subnav-pill/.upload-zone/.segmented-option 显式列表',
    count('transition: opacity 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease') === 1 &&
    count('transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease') === 1 &&
    count('transition: transform 0.25s ease, opacity 0.25s ease') === 1 &&
    count('transition: background 0.2s ease, color 0.2s ease') === 1 &&
    count('transition: border-color 0.2s ease, background 0.2s ease') === 1 &&
    count('transition:border-color 0.2s ease,background 0.2s ease') === 2 &&
    count('transition: background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease') === 1);
  ok('F0-10 msg-acc mono 暗色块保留（Request G 修复不受扰）', count('html[data-accent="mono"][data-theme="dark"] .msg-acc') === 1 && count('msg-acc') >= 19);
  ok('F0-11 fadeUp 关键帧保留', count('@keyframes fadeUp') === 1);
  // v0.2.50.5 用户「能不能把message内测试用的群和聊天去除？」——演示私聊/群/消息/成员表全清、DATA_VERSION 进位失效旧存档；
  // 公告保留（用户只要求群和聊天）
  ok('F0-12 测试聊天/群已移除（空默认 + DATA_VERSION=4 + 演示 id/私聊名零残留 + 公告保留）',
    count('var conversations = [];') === 1 && count('var mockMessages = {};') === 1 &&
    count('var groups = [];') === 1 && count('var groupMembers = {};') === 1 && count('var mockGroupMessages = {};') === 1 &&
    count('DATA_VERSION = 4') === 1 &&
    count("id: 'c1'") === 0 && count("id: 'c2'") === 0 && count("id: 'c3'") === 0 &&
    count("id: 'g1'") === 0 && count("id: 'g2'") === 0 && count("id: 'g3'") === 0 &&
    count("id: 'g4'") === 0 && count("id: 'g5'") === 0 && count("id: 'g6'") === 0 &&
    count('Marcus Vane') === 0 && count('Etheria Editorial Board') === 0 && count('Studio Prime') === 0 &&
    // 公告保留（用户只要求群和聊天）——Sovereign Council/Cartography Guild 是公告作者/标题，须仍在
    count('Sovereign Council') >= 1 && count('Cartography Guild') >= 1 &&
    count('Governance Summit 2026') >= 1,
    'conv=' + count('var conversations = [];') + ' mock=' + count('var mockMessages = {};') +
    ' groups=' + count('var groups = [];') + ' members=' + count('var groupMembers = {};') +
    ' gmock=' + count('var mockGroupMessages = {};') + ' dv=' + count('DATA_VERSION = 4') +
    ' c1=' + count("id: 'c1'") + ' g1=' + count("id: 'g1'") +
    ' marcus=' + count('Marcus Vane') + ' etheria=' + count('Etheria Editorial Board') + ' studio=' + count('Studio Prime') +
    ' sov=' + count('Sovereign Council') + ' carto=' + count('Cartography Guild') + ' announce=' + count('Governance Summit 2026'));
  // v0.2.50.6 用户「把那个Add Friend Chat 的email添加改成 输入用户id添加」——加好友弹窗输入即用户 ID、email 分支零残留
  ok('F0-13 Add Friend 改用户 ID 添加（占位/文案换 ID + email 分支零残留 + 404 新文案）',
    count('Enter a user ID') >= 1 && count('User ID (USR-XXXXXX)') === 1 &&
    count('Email address') === 0 && count('Username or Friend Code') === 0 &&
    count('email: name') === 0 && count('{ userId: name }') === 1 &&
    count('No user found with that ID.') === 1 && count('No user found with that email.') === 0,
    'idph=' + count('User ID (USR-XXXXXX)') + ' emailaddr=' + count('Email address') +
    ' emailbr=' + count('email: name') + ' uidbr=' + count('{ userId: name }') +
    ' nf404=' + count('No user found with that ID.'));
  // v0.2.50.7 用户「那个弹窗出现时能不能添加一个淡入的动画？」——actionModal 遮罩+卡片双 keyframes 淡入
  ok('F0-14 弹窗淡入动画（遮罩+卡片双 keyframes + actionModal 动画规则）',
    count('@keyframes modalFadeIn') === 1 && count('@keyframes modalCardIn') === 1 &&
    count('#actionModal { animation: modalFadeIn 0.2s ease; }') === 1 &&
    count('#actionModal > div:first-child { animation: modalCardIn 0.25s cubic-bezier(0.22,0.61,0.36,1); }') === 1,
    'kf1=' + count('@keyframes modalFadeIn') + ' kf2=' + count('@keyframes modalCardIn') +
    ' rule1=' + count('#actionModal { animation: modalFadeIn 0.2s ease; }') +
    ' rule2=' + count('#actionModal > div:first-child { animation: modalCardIn 0.25s cubic-bezier(0.22,0.61,0.36,1); }'));
  // v0.2.50.8 用户「能不能把上方的那个搜索栏统一在右侧和平台首页一样放上一个通知的铃铛？」——搜索胶囊右端分隔线+铃铛（首页同款）
  // 顺序断言用 indexOf（对 CRLF/LF 免疫——跨行 count 锚曾在 CRLF 文件上失配）
  ok('F0-15 搜索栏右侧通知铃铛（搜索框后分隔线 + notifications 图标入 searchCapsule）',
    count('>notifications</span>') === 1 &&
    count('width:1px;height:20px;background:var(--divider-line)') === 1 &&
    msgSrc.indexOf('handleSearch(this.value)">') !== -1 &&
    msgSrc.indexOf('handleSearch(this.value)">') < msgSrc.indexOf('width:1px;height:20px') &&
    msgSrc.indexOf('width:1px;height:20px') < msgSrc.indexOf('>notifications</span>'),
    'bell=' + count('>notifications</span>') +
    ' divider=' + count('width:1px;height:20px;background:var(--divider-line)') +
    ' order=' + msgSrc.indexOf('handleSearch(this.value)">') + '<' +
    msgSrc.indexOf('width:1px;height:20px') + '<' + msgSrc.indexOf('>notifications</span>'));
  // v0.2.51.0 用户「这个通知弹窗我希望可以做成有灵动岛效果的…」——铃铛点击+红点徽章+灵动岛弹窗 DOM
  // 徽章是铃铛 span 的兄弟（绝不入内——保护 F0-15 的 >notifications</span> 精确串）
  ok('F0-16 铃铛按钮+红点徽章+灵动岛弹窗 DOM（唯一性 + 徽章在铃铛 span 之后）',
    count('id="bellBtn"') === 1 && count('onclick="toggleNotifPopup()"') === 1 &&
    count('id="bellBadge"') === 1 && count('id="notifPopup"') === 1 &&
    count('id="notifListView"') === 1 && count('id="notifDecisionView"') === 1 &&
    count('id="notifTitle"') === 1 && count('style="margin-left:auto;position:relative"') === 1 &&
    msgSrc.indexOf('>notifications</span>') < msgSrc.indexOf('id="bellBadge"'),
    'bell=' + count('id="bellBtn"') + ' badge=' + count('id="bellBadge"') +
    ' popup=' + count('id="notifPopup"') + ' order=' + msgSrc.indexOf('>notifications</span>') + '<' + msgSrc.indexOf('id="bellBadge"'));
  ok('F0-17 灵动岛展开动画 + morph 规则（island-open 主规则+降动效规则/show-decision 双规则/高度过渡/右上原点）',
    count('@keyframes notifIslandIn') === 1 && count('#notifPopup.island-open') === 2 &&
    count('#notifPopup.show-decision') === 2 && count('transform-origin:top right') === 1 &&
    count('transition:height 0.28s cubic-bezier(0.22,0.61,0.36,1)') === 1,
    'kf=' + count('@keyframes notifIslandIn') + ' open=' + count('#notifPopup.island-open') +
    ' dec=' + count('#notifPopup.show-decision') + ' h=' + count('transition:height 0.28s cubic-bezier(0.22,0.61,0.36,1)'));
  ok('F0-18 决定视图双药丸 + 加好友改发好友请求（/friend-requests 在、建会话调用不在）',
    count('>不同意</button>') === 1 && count('>同意</button>') === 1 &&
    count("MN_API.post('/friend-requests', body)") === 1 &&
    count('好友请求已发送') === 1 &&
    count('Friend request already sent or you are already friends.') === 1 &&
    count("MN_API.post('/conversations', body)") === 0,
    'no=' + count('>不同意</button>') + ' yes=' + count('>同意</button>') +
    ' frpost=' + count("MN_API.post('/friend-requests', body)") +
    ' convpost=' + count("MN_API.post('/conversations', body)"));
  ok('F0-19 invites 存取管线（唯一声明/loadData 守卫/saveData 字段/accept/decline/refresh 三函数）',
    count('var invites = [];') === 1 && count('if (d.invites) invites = d.invites;') === 1 &&
    count('invites: invites') === 1 &&
    count('function acceptInvite') === 1 && count('function declineInvite') === 1 &&
    count('function refreshFriendRequests') === 1,
    'decl=' + count('var invites = [];') + ' load=' + count('if (d.invites) invites = d.invites;') +
    ' save=' + count('invites: invites') + ' fns=' + count('function acceptInvite') + '/' +
    count('function declineInvite') + '/' + count('function refreshFriendRequests'));
  console.log('');

  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
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
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Log.enable'); await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-demo-local', name: 'You', email: 'you@demo.local' } })) + ');}catch(e){}' +
        'try{localStorage.setItem("slati_messages", ' + JSON.stringify(JSON.stringify({ _version: 4, conversations: [], mockMessages: {}, groups: [], mockGroupMessages: {}, pinnedMessages: {}, invites: [{ id: 'inv-1', name: 'Nova Prime', userId: 'USR-000042', avatar: 'N', time: 'Now' }, { id: 'inv-2', name: 'Kaito Mori', userId: 'USR-000077', avatar: 'K', time: 'Now' }] })) + ');}catch(e){}' + FRAME_REC
    });

    await cdp.send('Page.navigate', { url: BASE + '/pages/messages.html' });
    // v0.2.50.5 起测试聊天已移除：conversationList 初始只有空态提示，不再以 children>0 为渲染标志
    await waitFor(cdp, "document.querySelector('#conversationList') && document.querySelectorAll('#slati-sidebar .nav-item').length > 3", 30000, 'messages 页应用渲染');
    await sleep(700);

    // ═══ M1 面板切换（transform + 瞬时调暗 + 激活态）═══
    console.log('═══ M 功能回归 ═══');
    {
      const r = await cdp.evalJs("(function(){var btn=document.querySelector('#msgSubnav [data-tab=\\'groups\\']');btn.click();var s=document.getElementById('msgSlide');return {tf:s.style.transform,po:document.getElementById('privatePanel').style.opacity,go:document.getElementById('groupsPanel').style.opacity,active:btn.classList.contains('active')};})()");
      ok('M1-1 private→groups：translateX(-100%) + private 瞬时 0.3 + groups 1 + 激活态', r.tf === 'translateX(-100%)' && r.po === '0.3' && r.go === '1' && r.active, JSON.stringify(r));
      await sleep(700);
    }
    {
      const r = await cdp.evalJs("(function(){var btn=document.querySelector('#msgSubnav [data-tab=\\'announcements\\']');btn.click();var s=document.getElementById('msgSlide');return {tf:s.style.transform,po:document.getElementById('privatePanel').style.opacity,ao:document.getElementById('announcementsPanel').style.opacity};})()");
      ok('M1-2 groups→announcements：translateX(-200%) + announce 1', r.tf === 'translateX(-200%)' && r.ao === '1', JSON.stringify(r));
      await sleep(700);
    }
    {
      const r = await cdp.evalJs("(function(){document.querySelector('#msgSubnav [data-tab=\\'private\\']').click();var s=document.getElementById('msgSlide');return {tf:s.style.transform,po:document.getElementById('privatePanel').style.opacity,ao:document.getElementById('announcementsPanel').style.opacity};})()");
      ok('M1-3 announcements→private：translateX(0) + private 1 + announce 0.3', r.tf === 'translateX(0%)' && r.po === '1' && r.ao === '0.3', JSON.stringify(r));
      await sleep(700);
    }

    // ═══ M2 计算态（合成层/过渡移除/mask 清除）═══
    {
      const r = await cdp.evalJs("(function(){var s=document.getElementById('msgSlide');var p=document.getElementById('privatePanel');var a=document.getElementById('announceList');var sb=document.getElementById('convSidebar');var btn=document.querySelector('.btn');var gs=function(el){return getComputedStyle(el)};return {wc:gs(s).willChange,td:gs(p).transitionDuration,am:gs(a).webkitMaskImage||gs(a).maskImage,tp:gs(sb).transitionProperty,td2:gs(sb).transitionDuration,btp:gs(btn).transitionProperty};})()");
      ok('M2-1 #msgSlide willChange=transform（层提升在线）', r.wc === 'transform', r.wc);
      ok('M2-2 privatePanel 无过渡（瞬时调暗，transitionDuration=0s）', r.td === '0s', r.td);
      ok('M2-3 announceList maskImage=none', r.am === 'none', r.am);
      ok('M2-4 convSidebar 过渡=width 0.25s', r.tp === 'width' && r.td2 === '0.25s', r.tp + '/' + r.td2);
      ok('M2-5 .btn 过渡为显式属性列表（无 all）', r.btp.indexOf('opacity') !== -1 && r.btp.indexOf('box-shadow') !== -1 && r.btp.indexOf('all') === -1, r.btp);
    }

    // ═══ M3 侧栏折叠/恢复 ═══
    {
      const w0 = await cdp.evalJs("document.getElementById('convSidebar').getBoundingClientRect().width");
      await cdp.evalJs("document.getElementById('convCollapseBtn').click()");
      await sleep(500);
      const w1 = await cdp.evalJs("document.getElementById('convSidebar').getBoundingClientRect().width");
      await cdp.evalJs("document.getElementById('convCollapseBtn').click()");
      await sleep(500);
      const w2 = await cdp.evalJs("document.getElementById('convSidebar').getBoundingClientRect().width");
      ok('M3 侧栏折叠→恢复（320→窄→320）', w0 > 300 && w1 < 100 && w2 > 300, w0 + '→' + w1 + '→' + w2);
    }

    // ═══ M4 空态 + 新建会话真实流（v0.2.50.5 移除测试聊天后）═══
    {
      const empty = await cdp.evalJs("(function(){var c=document.getElementById('conversationList');var ec=document.getElementById('emptyChat');var exp=((window.MN_I18N&&MN_I18N.t('messages.empty.noChats'))||'No chats').replace(/<[^>]+>/g,'');return {n:c.children.length,txt:c.textContent,exp:exp,main:ec?getComputedStyle(ec).display:'gone'};})()");
      ok('M4-1 无测试聊天（侧栏空态提示 + 主区 emptyChat 可见）', empty.n === 1 && empty.txt.indexOf(empty.exp) !== -1 && empty.main !== 'none', JSON.stringify(empty));
      await cdp.evalJs("window.openActionModal();window.chooseAction('friend')");
      await sleep(200);
      await cdp.evalJs("document.getElementById('friendInput').value='Battery Friend';window.addFriendDemo()");
      await sleep(1600);
      const listAfter = await cdp.evalJs("(function(){var c=document.getElementById('conversationList');return {n:c.children.length,txt:c.textContent};})()");
      ok('M4-2 新建会话入列表（1 张卡 + 名字在）', listAfter.n === 1 && listAfter.txt.indexOf('Battery Friend') !== -1, JSON.stringify(listAfter));
      await cdp.evalJs("document.querySelector('#conversationList > div').click()");
      await sleep(400);
      const r = await cdp.evalJs("(function(){var h=document.getElementById('chatHeader');var ib=document.getElementById('chatInputBar');var ml=document.getElementById('messageList');var exp=((window.MN_I18N&&MN_I18N.t('messages.empty.noMessages'))||'No messages yet').replace(/<[^>]+>/g,'');return {h:h.style.display,ib:ib.style.display,empty:ml.textContent.indexOf(exp)!==-1};})()");
      ok('M4-3 打开新会话：chatHeader + 输入栏可见 + 空消息提示', r.h !== 'none' && r.ib !== 'none' && r.empty, JSON.stringify(r));
    }

    // ═══ M5 发送消息（fade-up 气泡 + 清理）═══
    {
      const before = await cdp.evalJs("document.querySelectorAll('#messageList .msg-row').length");
      await cdp.evalJs("document.getElementById('chatInput').value='Battery — fadeUp test';window.sendMessage()");
      await sleep(150);
      const during = await cdp.evalJs("(function(){var rows=document.querySelectorAll('#messageList .msg-row');var last=rows[rows.length-1];return {n:rows.length,cls:last?last.className:''};})()");
      await sleep(600);
      const after = await cdp.evalJs("(function(){var rows=document.querySelectorAll('#messageList .msg-row');var last=rows[rows.length-1];return {n:rows.length,cls:last?last.className:'',input:document.getElementById('chatInput').value};})()");
      ok('M5-1 发送：行 +1 且末行带 fade-up（动画中）', during.n === before + 1 && during.cls.indexOf('fade-up') !== -1, JSON.stringify(during));
      ok('M5-2 动画结束：fade-up 清理 + 输入框清空', after.n === before + 1 && after.cls.indexOf('fade-up') === -1 && after.input === '', JSON.stringify(after));
    }

    // ═══ M4b 群空态 + 新建群真实流（v0.2.50.5 移除测试群后）═══
    {
      await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'groups\\']').click()");
      await sleep(700);
      const empty = await cdp.evalJs("(function(){var g=document.getElementById('groupList');var exp=((window.MN_I18N&&MN_I18N.t('messages.empty.noGroups'))||'No groups').replace(/<[^>]+>/g,'');return {n:g.children.length,txt:g.textContent,exp:exp};})()");
      ok('M4b-1 无测试群（空态提示可见）', empty.n === 1 && empty.txt.indexOf(empty.exp) !== -1, JSON.stringify(empty));
      await cdp.evalJs("window.openActionModal();window.chooseAction('group')");
      await sleep(200);
      await cdp.evalJs("document.getElementById('groupNameInput').value='Battery Group';window.createGroupDemo()");
      await sleep(1600);
      const after = await cdp.evalJs("(function(){var g=document.getElementById('groupList');return {n:g.children.length,txt:g.textContent};})()");
      ok('M4b-2 新建群入列表（1 张卡 + 名字在）', after.n === 1 && after.txt.indexOf('Battery Group') !== -1, JSON.stringify(after));
      await cdp.evalJs("document.querySelector('#groupList > div').click()");
      await sleep(400);
      const r = await cdp.evalJs("(function(){var h=document.getElementById('groupChatHeader');var ib=document.getElementById('groupChatInputBar');return {h:h.style.display,ib:ib.style.display};})()");
      ok('M4b-3 打开新群：groupChatHeader + 输入栏可见', r.h !== 'none' && r.ib !== 'none', JSON.stringify(r));
    }

    // ═══ M6 公告展开/收起（box-shadow 过渡 + 列表重渲）═══
    {
      await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'announcements\\']').click()");
      await sleep(700);
      const n0 = await cdp.evalJs("document.querySelectorAll('#announceList > div').length");
      await cdp.evalJs("document.querySelector('#announceList > div').click()");
      await sleep(400);
      const r1 = await cdp.evalJs("(function(){var c=document.querySelector('#announceList > div');return {n:document.querySelectorAll('#announceList > div').length,bs:c.style.boxShadow};})()");
      await cdp.evalJs("document.querySelector('#announceList > div').click()");
      await sleep(400);
      const r2 = await cdp.evalJs("(function(){var c=document.querySelector('#announceList > div');return {n:document.querySelectorAll('#announceList > div').length,bs:c.style.boxShadow};})()");
      ok('M6 公告展开→收起：列表重渲 + 展开态描边 box-shadow 出现后消失', n0 === 8 && r1.n === 8 && r1.bs.length > 10 && r2.n === 8 && r2.bs === '', JSON.stringify({ n0, r1, r2 }));
    }

    // ═══ M7 公告列表滚动（mask 移除后功能完好）═══
    {
      await cdp.evalJs("document.getElementById('announceList').scrollTop=400");
      await sleep(250);
      const st = await cdp.evalJs("document.getElementById('announceList').scrollTop");
      ok('M7 announceList 滚动正常（scrollTop=400）', st === 400, String(st));
    }

    // ═══ M8 FAB：私有面板显示 / 公告面板隐藏 / 弹窗开关 ═══
    {
      await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'private\\']').click()");
      await sleep(700);
      const vis0 = await cdp.evalJs("(function(){var f=document.getElementById('fabBtn');return {op:getComputedStyle(f).opacity,pe:getComputedStyle(f).pointerEvents};})()");
      await cdp.evalJs("window.openActionModal()");
      await sleep(60);
      const mid = await cdp.evalJs("(function(){var m=document.getElementById('actionModal');var c=m.firstElementChild;return {mAnim:m.getAnimations().length,mName:getComputedStyle(m).animationName,op:getComputedStyle(m).opacity,cAnim:c.getAnimations().length,cName:getComputedStyle(c).animationName};})()");
      // 注：本环境动画时间轴滞后墙钟且滞后量逐次漂移（M9 已知 ~10-15fps；实测同 +500ms 墙钟有时遮罩 0.2s 动画
      // 仍未跑完 opacity 0.96）——落定改用 waitFor 轮询等 computed opacity 双双到 1（8s 上限），抗时间轴抖动
      await waitFor(cdp, "(function(){var m=document.getElementById('actionModal');var c=m.firstElementChild;return getComputedStyle(m).opacity==='1'&&getComputedStyle(c).opacity==='1';})()", 8000, '弹窗淡入落定全不透明');
      const settled = await cdp.evalJs("(function(){var m=document.getElementById('actionModal');var c=m.firstElementChild;return {mOp:getComputedStyle(m).opacity,cOp:getComputedStyle(c).opacity,mAnim:m.getAnimations().length,cAnim:c.getAnimations().length};})()");
      const modalOn = await cdp.evalJs("document.getElementById('actionModal').style.display");
      await cdp.evalJs("window.closeModal()");
      await sleep(300);
      const modalOff = await cdp.evalJs("document.getElementById('actionModal').style.display");
      await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'announcements\\']').click()");
      await sleep(700);
      const vis1 = await cdp.evalJs("(function(){var f=document.getElementById('fabBtn');return {op:getComputedStyle(f).opacity,pe:getComputedStyle(f).pointerEvents};})()");
      ok('M8-1 FAB 私有面板可见', vis0.op === '1' && vis0.pe !== 'none', JSON.stringify(vis0));
      ok('M8-2 actionModal 开→关（display flex→none）', modalOn === 'flex' && modalOff === 'none', modalOn + '→' + modalOff);
      // 落定断言只看 opacity 全不透明（waitFor 已轮询保证；anims 数不放行条件——时间轴滞后时动画可能仍标记运行中）
      ok('M8-2b 弹窗淡入（开场遮罩+卡片动画在跑+animationName 正确 → 落定全不透明）',
        mid.mAnim >= 1 && mid.cAnim >= 1 && mid.mName === 'modalFadeIn' && mid.cName === 'modalCardIn' &&
        settled.mOp === '1' && settled.cOp === '1',
        JSON.stringify(mid) + ' | ' + JSON.stringify(settled));
      ok('M8-3 FAB 公告面板隐藏', vis1.pe === 'none', JSON.stringify(vis1));
    }

    // ═══ M9 帧健康（动画窗口帧流动 + 主线程零长任务；3 轮取中位抗 headless 噪声）═══
    // 注：headless --disable-gpu 软件渲染下大区域合成帧率被管线限死（实测与内容无关、禁磨砂后不变），
    // 均帧绝对值在此环境无断言意义；真实不变量=帧在流动 + 主线程零长任务（帧慢≠主线程忙）。
    {
      await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'groups\\']').click()");
      await sleep(800);
      const nList = [], lts = [];
      for (let i = 0; i < 3; i++) {
        await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'private\\']').click()");
        await sleep(800);
        await cdp.evalJs("window.__twreset()");
        await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'announcements\\']').click()");
        await sleep(1100);
        const s = await cdp.evalJs("window.__twstats()");
        nList.push(s.n); lts.push(s.lt);
        await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'groups\\']').click()");
        await sleep(800);
        await cdp.evalJs("window.__twreset()");
        await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'private\\']').click()");
        await sleep(1100);
        const s2 = await cdp.evalJs("window.__twstats()");
        nList.push(s2.n); lts.push(s2.lt);
      }
      const minN = Math.min(...nList);
      const totalLt = lts.reduce((a, b) => a + b, 0);
      ok('M9-1 切换动画窗口内有帧流动（6 窗口最小 n≥4，此环境 TS3 型窗口 ≈10-15fps）', minN >= 4, 'minN=' + minN + ' ' + nList.join('/'));
      ok('M9-2 主线程零长任务（>50ms 任务=0，共 6 窗口）', totalLt === 0, 'lt=' + totalLt);
    }

    // ═══ M10/M11 灵动岛通知弹窗（种子 invites 2 条；headless 动画时间轴滞后墙钟 → 落定一律 waitFor 轮询 computed）═══
    {
      await cdp.evalJs("document.getElementById('bellBtn').click()");
      await waitFor(cdp, "getComputedStyle(document.getElementById('notifPopup')).opacity === '1'", 8000, 'M10-1 弹窗展开落定');
      const r101 = await cdp.evalJs("(function(){var p=document.getElementById('notifPopup');var b=document.getElementById('bellBadge');return {disp:p.style.display,entries:document.querySelectorAll('#notifListView .notif-entry').length,badgeTxt:b.textContent,badgeDisp:getComputedStyle(b).display};})()");
      ok('M10-1 点铃铛开窗（display flex + 2 条目 + 徽章 2 可见）',
        r101.disp === 'flex' && r101.entries === 2 && r101.badgeTxt === '2' && r101.badgeDisp !== 'none', JSON.stringify(r101));

      await cdp.evalJs("document.querySelector('#notifListView .notif-entry').click()");
      await waitFor(cdp, "getComputedStyle(document.getElementById('notifDecisionView')).opacity === '1' && getComputedStyle(document.getElementById('notifListView')).opacity === '0'", 8000, 'M10-2 morph 决定视图');
      const r102 = await cdp.evalJs("(function(){var p=document.getElementById('notifPopup');var bs=Array.prototype.map.call(document.querySelectorAll('#notifDecisionView button'),function(b){return b.textContent;});return {name:document.getElementById('notifDecisionName').textContent,id:document.getElementById('notifDecisionId').textContent,btns:bs,cls:p.classList.contains('show-decision'),bh:document.getElementById('notifBody').getBoundingClientRect().height,title:document.getElementById('notifTitle').textContent};})()");
      ok('M10-2 点邀请整窗 morph 决定视图（名称/ID 上方居中 + 左右双药丸 + show-decision + 高度>0 + 标题）',
        r102.name === 'Nova Prime' && r102.id === 'USR-000042' && r102.btns.join('|') === '不同意|同意' &&
        r102.cls && r102.bh > 0 && r102.title === '好友请求', JSON.stringify(r102));

      await cdp.evalJs("(function(){var bs=document.querySelectorAll('#notifDecisionView button');bs[1].click();})()");
      await waitFor(cdp, "document.getElementById('conversationList').textContent.indexOf('Nova Prime') !== -1", 5000, 'M10-3 同意建会话');
      await waitFor(cdp, "getComputedStyle(document.getElementById('notifListView')).opacity === '1'", 8000, 'M10-3 morph 回列表');
      const r103 = await cdp.evalJs("(function(){return {inv:JSON.parse(localStorage.getItem('slati_messages')).invites.length,badge:document.getElementById('bellBadge').textContent,entries:document.querySelectorAll('#notifListView .notif-entry').length};})()");
      ok('M10-3 同意（会话入列表 + invites 剩 1 + 徽章 1 + morph 回列表 1 条目）',
        r103.inv === 1 && r103.badge === '1' && r103.entries === 1, JSON.stringify(r103));

      await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
      const r104 = await cdp.evalJs("document.getElementById('notifPopup').style.display");
      ok('M10-4 Escape 关闭即时生效（display none）', r104 === 'none', 'display=' + r104);

      await cdp.evalJs("document.getElementById('bellBtn').click()");
      await waitFor(cdp, "getComputedStyle(document.getElementById('notifPopup')).opacity === '1'", 8000, 'M11-1 弹窗重开');
      await cdp.evalJs("document.querySelector('#notifListView .notif-entry').click()");
      await waitFor(cdp, "getComputedStyle(document.getElementById('notifDecisionView')).opacity === '1'", 8000, 'M11-1 决定视图');
      await cdp.evalJs("(function(){document.querySelectorAll('#notifDecisionView button')[0].click();})()");
      await waitFor(cdp, "getComputedStyle(document.getElementById('notifListView')).opacity === '1'", 8000, 'M11-1 拒绝 morph 回列表');
      const r111 = await cdp.evalJs("(function(){return {entries:document.querySelectorAll('#notifListView .notif-entry').length,empty:document.getElementById('notifListView').textContent.indexOf('暂无好友请求') !== -1,badge:getComputedStyle(document.getElementById('bellBadge')).display,inv:JSON.parse(localStorage.getItem('slati_messages')).invites.length};})()");
      ok('M11-1 拒绝后空态（0 条目 + 暂无好友请求 + 徽章隐藏 + invites 0）',
        r111.entries === 0 && r111.empty && r111.badge === 'none' && r111.inv === 0, JSON.stringify(r111));

      await cdp.evalJs("document.getElementById('bellBtn').click()"); // 当前开着 → 关（即时）
      await cdp.evalJs("document.getElementById('bellBtn').click()"); // 再开
      await waitFor(cdp, "getComputedStyle(document.getElementById('notifPopup')).opacity === '1'", 8000, 'M11-2 弹窗再开');
      await cdp.evalJs("document.body.click()");
      const r112 = await cdp.evalJs("document.getElementById('notifPopup').style.display");
      ok('M11-2 外点关闭即时生效（display none）', r112 === 'none', 'display=' + r112);
    }

    // ═══ Z 控制台零错误 ═══
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|settings-menu|\/api\//i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('Z 控制台零错误（噪声已滤）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));

    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
  }
  try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(fail === 0 ? 0 : 1);
})();
