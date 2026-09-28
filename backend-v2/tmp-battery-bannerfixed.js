// tmp-battery-bannerfixed.js — v0.2.55.0 用户横幅/头像主题无关电池（用户「那个用户横幅和头像能不能不要被网页主题影响到？」问询钦定「两处都要」）
// 断言：F 静态锚（ethereal 暗色隐藏规则+mono 黑族/灰环移除、sidebar 内联固定 #4648d4、个人页 9+3+1 处垫底固定
//   #e6e8ea+头像环 #f7f9fb、41 页+admin 内联块刷新、site-config v0.2.55.0）
// + S1-S5 侧栏横幅/头像 亮/暗/mono亮/mono暗 四主题 computed 样式恒同（含访客模块）+ P1-P6 个人页横幅/头像
//   亮/暗/mono亮/mono暗 + glass-rose 预设 + edge paper 边缘态 computed 恒同 + Z 零 JS 错误
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-bannerfixed-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
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

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name + (detail !== undefined ? '  ' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail !== undefined ? '  ' + detail : '')); }
}
const countOcc = (s, sub) => s.split(sub).length - 1;

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

const BANNER_BG = "linear-gradient(135deg, rgb(70, 72, 212), rgb(59, 61, 196))";
const BANNER_BASE = "rgb(230, 232, 234)";
const AVATAR_WHITE = "rgb(255, 255, 255)";
const AVATAR_RING = "rgb(247, 249, 251)";

(async () => {
  // ═══ F 静态检查 ═══
  const css = fs.readFileSync(path.join(DOCS, 'assets/css/ethereal.css'), 'utf8');
  const sbSrc = fs.readFileSync(path.join(DOCS, 'assets/js/sidebar.js'), 'utf8');
  const cpSrc = fs.readFileSync(path.join(DOCS, 'pages/community-profile.html'), 'utf8');
  const idxSrc = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  const adminSrc = fs.readFileSync(path.join(DOCS, 'admin/index.html'), 'utf8');
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets/js/site-config.js'), 'utf8');
  const msgSrc = fs.readFileSync(path.join(DOCS, 'pages/messages.html'), 'utf8');

  ok('F1 ethereal 暗色隐藏规则整体移除（09-10 反转）+ 54.6 注释在位',
    css.indexOf(':root[data-theme="dark"] .user-banner') === -1 &&
    css.indexOf('rgba(255, 255, 255, 0.04) !important') === -1 &&
    css.indexOf('v0.2.54.6 用户「那个用户横幅和头像能不能不要被网页主题影响到？」') !== -1 &&
    css.indexOf('反转 09-10 隐藏决定') !== -1);
  ok('F2 ethereal mono 暗色横幅翻黑族+头像灰环规则移除、AI 悬浮球保留',
    css.indexOf('[data-theme="dark"] .user-banner { background: linear-gradient(135deg, #1e1e2d') === -1 &&
    css.indexOf('[data-theme="dark"] .user-module .avatar') === -1 &&
    css.indexOf('[data-theme="dark"] .mn-ai-fab') !== -1 &&
    css.indexOf('[data-theme="dark"] .featured-nation-avatar') !== -1);
  ok('F3 sidebar.js 两处内联渐变固定 #4648d4（var(--color-primary) 零残留）+ 头像白环在位',
    sbSrc.indexOf('var(--color-primary),#3b3dc4') === -1 &&
    countOcc(sbSrc, '#4648d4,#3b3dc4') === 2 &&
    sbSrc.indexOf('border:3px solid white') !== -1);
  ok('F4 个人页横幅 9 处垫底固定 #e6e8ea（默认/bg-default/6 玻璃预设/glass-bg 兜底）',
    countOcc(cpSrc, '#e6e8ea; }') === 9 &&
    cpSrc.indexOf('.profile-banner { height: 140px') !== -1 && cpSrc.indexOf('.profile-banner { height: 140px') < cpSrc.indexOf('transparent 40%), #e6e8ea; }'),
    '9 处：8 横幅垫底+1 边缘默认填充色块');
  ok('F5 6 玻璃预设逐个固定垫底', ['glass-frost', 'glass-ocean', 'glass-violet', 'glass-rose', 'glass-mint', 'glass-sunset']
    .every(c => { const i = cpSrc.indexOf('.' + c + ' {'); return i !== -1 && cpSrc.indexOf('#e6e8ea', i) !== -1 && cpSrc.indexOf('#e6e8ea', i) < cpSrc.indexOf('}', i) + 30; }));
  ok('F6 编辑弹窗 3 处预览兜底固定（var(--lg-bg, #e6e8ea) ×4 含 glass-bg 兜底）',
    countOcc(cpSrc, 'var(--lg-bg, #e6e8ea)') === 4);
  ok('F7 个人页头像环固定 #f7f9fb（var(--color-surface) 零残留）',
    cpSrc.indexOf('border: 3px solid #f7f9fb') !== -1 && cpSrc.indexOf('border: 3px solid var(--color-surface)') === -1);
  ok('F8 pagebg-custom 色块零触碰（全文件仅剩 1 处 var 垫底=页面背景示意块，非横幅）',
    countOcc(cpSrc, 'var(--color-surface-container-high); }') === 1 &&
    cpSrc.indexOf('.swatch-fill.pagebg-custom') !== -1);
  ok('F9 41 页内联块刷新（index/个人页/admin 暗色隐藏规则+mono 黑族均无、54.6 注释在位）',
    idxSrc.indexOf(':root[data-theme="dark"] .user-banner') === -1 && idxSrc.indexOf('v0.2.54.6 用户「那个用户横幅') !== -1 &&
    cpSrc.indexOf(':root[data-theme="dark"] .user-banner') === -1 && cpSrc.indexOf('v0.2.54.6 用户「那个用户横幅') !== -1 &&
    adminSrc.indexOf(':root[data-theme="dark"] .user-banner') === -1);
  ok('F10 site-config v0.2.55.0 + changelog 用户原话 + FC v10.28.36.1 不动',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.18';") !== -1 &&
    sconfSrc.indexOf('用户横幅与头像不再受网页主题影响') !== -1 &&
    sconfSrc.indexOf('问询钦定「两处都要」') !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1);
  const msgAvLines = msgSrc.split('\n').filter(l => l.indexOf('msg-avatar') !== -1 && l.indexOf('style=') !== -1);
  ok('F11 messages 头像族 11 个 msg-avatar 类 + 头像行零 var(--color-) 残留',
    countOcc(msgSrc, 'msg-acc msg-avatar') === 11 &&
    msgAvLines.length === 11 && msgAvLines.every(l => l.indexOf('var(--color-') === -1),
    'msg-avatar=' + countOcc(msgSrc, 'msg-acc msg-avatar') + ' 头像行=' + msgAvLines.length);
  ok('F12 messages mono 暗色规则改 :not(.msg-avatar) 豁免（09-17 注释保留）',
    msgSrc.indexOf('html[data-accent="mono"][data-theme="dark"] .msg-acc:not(.msg-avatar)') !== -1 &&
    msgSrc.indexOf('统一给这些元素加 msg-acc 类翻深底') !== -1);
  ok('F13 messages 头像固定色 11 处（#4648d4×7 + #8127cf×4）',
    msgAvLines.filter(l => l.indexOf('background:#4648d4') !== -1).length === 7 &&
    msgAvLines.filter(l => l.indexOf('background:#8127cf') !== -1).length === 4);

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
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    // 首访种子（sessionStorage 防重复种——S5 清库重载后走访客）；fetch 拦截罐头用户（auth/me + 三主页 id）
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source:
        "try{if(!sessionStorage.getItem('__bf_seeded')){localStorage.setItem('slati_session'," + JSON.stringify(JSON.stringify({ loggedIn: true, at: '2026-09-20T00:00:00.000Z' })) + ");" +
        "localStorage.setItem('slati_user'," + JSON.stringify(JSON.stringify({ id: 'USR-000101', displayName: '电池用户', citizenId: 'USR-000101', avatarUrl: '' })) + ");" +
        "localStorage.setItem('slati_lang','zh');sessionStorage.setItem('__bf_seeded','1');}}catch(e){}" +
        "(function(){var __ME={id:'USR-000101',displayName:'电池用户',avatarUrl:'',bio:'电池简介',gender:'Male',citizenId:'USR-000101',isSelf:true,followedByMe:false,followerCount:0,followingCount:0,cardBg:null,cardPlate:null,pageBgImage:null,cardEdge:null,stats:{postCount:0,repostCount:0,likeReceivedCount:0,likeCount:0,favoriteCount:0}};" +
        "var __P202={id:'USR-000202',displayName:'玻璃用户',avatarUrl:null,bio:null,gender:'Female',citizenId:'USR-000202',isSelf:false,followedByMe:false,followerCount:0,followingCount:0,cardBg:'glass-rose',cardPlate:'glass-clear',pageBgImage:null,cardEdge:null,stats:{postCount:0,repostCount:0,likeReceivedCount:0,likeCount:0,favoriteCount:0}};" +
        "var __P303={id:'USR-000303',displayName:'边缘用户',avatarUrl:null,bio:null,gender:'Other',citizenId:'USR-000303',isSelf:false,followedByMe:false,followerCount:0,followingCount:0,cardBg:null,cardPlate:null,pageBgImage:null,cardEdge:'paper',stats:{postCount:0,repostCount:0,likeReceivedCount:0,likeCount:0,favoriteCount:0}};" +
        "function __res(st,body){return {status:st,ok:st>=200&&st<300,headers:{get:function(){return null;}},json:function(){return Promise.resolve(body);}};}" +
        "var __realFetch=window.fetch.bind(window);" +
        "window.fetch=function(url,opts){var u=String(url);if(u.indexOf('/api/')===-1)return __realFetch.call(window,url,opts);" +
        "if(sessionStorage.getItem('__bf_guest')==='1'&&u.indexOf('/api/auth/me')===0)return Promise.resolve(__res(401,{error:{message:'未登录'}}));" +
        "if(u.indexOf('/api/auth/me')===0)return Promise.resolve(__res(200,{user:__ME}));" +
        "if(u.indexOf('/api/health')===0)return Promise.resolve(__res(200,{status:'ok'}));" +
        "if(u.indexOf('/api/social/users/USR-000101')===0&&u.indexOf('posts')===-1&&u.indexOf('follow')===-1)return Promise.resolve(__res(200,{user:__ME}));" +
        "if(u.indexOf('/api/social/users/USR-000202')===0&&u.indexOf('posts')===-1&&u.indexOf('follow')===-1)return Promise.resolve(__res(200,{user:__P202}));" +
        "if(u.indexOf('/api/social/users/USR-000303')===0&&u.indexOf('posts')===-1&&u.indexOf('follow')===-1)return Promise.resolve(__res(200,{user:__P303}));" +
        "return Promise.resolve(__res(404,{error:{message:'nf'}}));};})();"
    });

    const navTo = async (url, readyExpr, label) => {
      await cdp.send('Page.navigate', { url: BASE + url });
      await waitFor(cdp, readyExpr, 30000, label);
    };
    const setTheme = async (dark, mono) => {
      await cdp.evalJs("var h=document.documentElement;" + (dark ? "h.setAttribute('data-theme','dark');" : "h.removeAttribute('data-theme');") + (mono ? "h.setAttribute('data-accent','mono');" : "h.removeAttribute('data-accent');"));
    };
    const sbState = () => cdp.evalJs(
      "(function(){var b=document.querySelector('.user-banner');var a=document.querySelector('.user-module .avatar');" +
      "return {bg:b?getComputedStyle(b).backgroundImage:null,av:a?getComputedStyle(a).borderTopColor:null};})()");
    const pfState = () => cdp.evalJs(
      "(function(){var b=document.querySelector('.profile-banner');var a=document.querySelector('.profile-avatar');" +
      "return {bgc:b?getComputedStyle(b).backgroundColor:null,av:a?getComputedStyle(a).borderTopColor:null,clip:b?getComputedStyle(b).clipPath:null};})()");
    const assertSb = async (name, dark, mono) => {
      await setTheme(dark, mono);
      await waitFor(cdp, "document.querySelector('.user-banner') && getComputedStyle(document.querySelector('.user-banner')).backgroundImage === '" + BANNER_BG + "' && " +
        "document.querySelector('.user-module .avatar') && getComputedStyle(document.querySelector('.user-module .avatar')).borderTopColor === '" + AVATAR_WHITE + "'", 8000, name);
      const s = await sbState();
      ok(name, s.bg === BANNER_BG && s.av === AVATAR_WHITE, s.bg + ' / ' + s.av);
    };
    const assertPf = async (name, dark, mono) => {
      await setTheme(dark, mono);
      await waitFor(cdp, "document.querySelector('.profile-banner') && getComputedStyle(document.querySelector('.profile-banner')).backgroundColor === '" + BANNER_BASE + "' && " +
        "document.querySelector('.profile-avatar') && getComputedStyle(document.querySelector('.profile-avatar')).borderTopColor === '" + AVATAR_RING + "'", 8000, name);
      const s = await pfState();
      ok(name, s.bgc === BANNER_BASE && s.av === AVATAR_RING, s.bgc + ' / ' + s.av);
    };

    // ═══ S 侧栏用户卡（index.html，登录态）═══
    await navTo('/index.html', "document.querySelector('.user-banner') && document.querySelector('.user-module .avatar')", 'index 就绪');
    await sleep(1500);
    await assertSb('S1 亮色：横幅恒靛蓝渐变+头像恒白环', false, false);
    await assertSb('S2 暗色：同亮色（09-10 隐藏规则已解除）', true, false);
    await assertSb('S3 mono 亮色：同亮色（内联 var(--color-primary) 已固定）', false, true);
    await assertSb('S4 mono 暗色：同亮色（黑族/灰环规则已移除）', true, true);
    // S5 访客模块（清库重载 → 种子守卫跳过 → 访客横幅）
    await cdp.evalJs("sessionStorage.setItem('__bf_guest','1');localStorage.removeItem('slati_session');localStorage.removeItem('slati_user');");
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await waitFor(cdp, "document.querySelector('.guest-module .user-banner')", 30000, '访客模块就绪');
    await setTheme(true, true);
    await waitFor(cdp, "getComputedStyle(document.querySelector('.guest-module .user-banner')).backgroundImage === '" + BANNER_BG + "'", 8000, 'S5');
    const s5 = await cdp.evalJs("getComputedStyle(document.querySelector('.guest-module .user-banner')).backgroundImage");
    ok('S5 访客模块横幅 mono 暗色也恒靛蓝渐变', s5 === BANNER_BG, s5);

    // ═══ P 个人页 header（community-profile.html）═══
    await cdp.evalJs("sessionStorage.removeItem('__bf_guest');localStorage.setItem('slati_session'," + JSON.stringify(JSON.stringify({ loggedIn: true, at: '2026-09-20T00:00:00.000Z' })) + ");localStorage.setItem('slati_user'," + JSON.stringify(JSON.stringify({ id: 'USR-000101', displayName: '电池用户', citizenId: 'USR-000101', avatarUrl: '' })) + ");");
    await navTo('/pages/community-profile.html?id=USR-000101', "document.querySelector('.profile-banner') && document.querySelector('.profile-avatar')", '个人页就绪');
    await sleep(1500);
    await assertPf('P1 亮色：横幅垫底+头像环同亮色', false, false);
    await assertPf('P2 暗色：同亮色（垫底固定不透明 #e6e8ea）', true, false);
    await assertPf('P3 mono 亮色：同亮色', false, true);
    await assertPf('P4 mono 暗色：同亮色', true, true);
    // P5 glass-rose 玻璃预设（USR-000202）
    await navTo('/pages/community-profile.html?id=USR-000202', "document.querySelector('.profile-banner') && document.querySelector('.profile-header.glass-rose')", 'glass-rose 就绪');
    await sleep(1200);
    await assertPf('P5 glass-rose 预设暗色：横幅垫底同亮色', true, false);
    // P6 edge paper 边缘态（USR-000303）
    await navTo('/pages/community-profile.html?id=USR-000303', "document.querySelector('.profile-banner') && document.querySelector('.profile-header[data-card-edge]')", 'edge paper 就绪');
    await sleep(1200);
    await setTheme(true, false);
    await waitFor(cdp, "getComputedStyle(document.querySelector('.profile-banner')).backgroundColor === '" + BANNER_BASE + "'", 8000, 'P6');
    const p6 = await pfState();
    ok('P6 edge paper 边缘态暗色：横幅垫底同亮色+剪影在位', p6.bgc === BANNER_BASE && p6.clip !== 'none', p6.bgc + ' / clip=' + p6.clip);

    // ═══ M Messages 头像（用户中途追加「还有message那边的头像」）═══
    await navTo('/pages/messages.html', "document.getElementById('groupAvatar') && document.getElementById('infoAvatar') && document.getElementById('notifDecisionAvatar')", 'messages 就绪');
    await sleep(1200);
    const AV_SET = ["rgb(70, 72, 212)", "rgb(129, 39, 207)"];
    const msgAv = () => cdp.evalJs(
      "(function(){var els=document.querySelectorAll('.msg-avatar');var bg=[];for(var i=0;i<els.length;i++)bg.push(getComputedStyle(els[i]).backgroundColor);return bg;})()");
    const assertMsg = async (name, dark, mono) => {
      await setTheme(dark, mono);
      await waitFor(cdp, "document.querySelectorAll('.msg-avatar').length >= 4", 8000, name);
      const bg = await msgAv();
      const bad = bg.filter(x => AV_SET.indexOf(x) === -1);
      ok(name, bg.length >= 4 && bad.length === 0, bg.join(',') + (bad.length ? ' bad:' + bad.join(',') : ''));
    };
    await assertMsg('M1 亮色：Messages 头像恒靛蓝/紫固定色', false, false);
    await assertMsg('M2 暗色：同亮色', true, false);
    await assertMsg('M3 mono 亮色：同亮色', false, true);
    await assertMsg('M4 mono 暗色：同亮色（msg-avatar 豁免 09-17 翻深规则）', true, true);

    ok('Z 零 JS 错误', cdp.errs.length === 0, cdp.errs.join(' | ').slice(0, 160));

    console.log('\n=== bannerfixed: ' + pass + '/' + (pass + fail) + ' ===');
    await cdp.close();
  } catch (e) {
    console.error('电池异常: ' + e.message);
    process.exitCode = 2;
  } finally {
    chrome.kill();
    server.close();
  }
})();
