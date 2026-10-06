// tmp-battery-tier-gating.js — v0.2.49.0 / FC v10.28.35.3 等级系统+订阅门禁电池
//   （用户「做一下用户等级系统和订阅与无订阅的功能限制」：等级靠活跃+会员靠订阅双轨；
//   免费=每语言字体 5 个、不能自定义边缘/卡片背景/页面背景，平台主题不限；
//   Xendit 铺垫=premium.html 注记，到账自动开通沿用后端 webhook 状态机）
// F 静态：版本/门禁/等级三组；S1 free（tier:'free' 双态）→ 锁全显；S2 premium → 全解锁；
// S3 等级（index.html 徽章/加 XP/跨级 toast/每日一次/访客无徽章）；编辑器合成 drop → +10 XP；Z 零 error
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-tiergate-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/batt-setup.html') {
    // 真 HTML 文档（同源 localStorage 预设页；404 空文档无 origin → localStorage 拒绝访问）
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><meta charset="utf-8"></head><body>setup</body></html>');
    return;
  }
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
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
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
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

(async () => {
  // ═══ F 静态检查 ═══
  const fceSrc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const storageSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'storage.js'), 'utf8');
  const sidebarSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'sidebar.js'), 'utf8');
  const smSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'settings-modal.js'), 'utf8');
  const premiumSrc = fs.readFileSync(path.join(DOCS, 'pages', 'premium.html'), 'utf8');

  ok('F1 静态：changelog 历史条目保留（v0.2.49.0/v10.28.35.3 轮标题；赋值锚随版本前进失效——00305 维修口径）+ 站点 changelog（等级双轨/Xendit 铺垫/订阅限制清单）',
    sconfSrc.indexOf('v0.2.49.0 = 社交互动经验值来源') !== -1 &&
    sconfSrc.indexOf('v10.28.35.3 = 编辑器发布 XP 钩子 120/5') !== -1 &&
    sconfSrc.indexOf('用户等级系统') !== -1 &&
    sconfSrc.indexOf('Xendit') !== -1 &&
    sconfSrc.indexOf('等级靠活跃') !== -1);

  ok('F2a 静态：订阅门禁激活（TEST_MODE=false）+ 字体上限 5（var + window 暴露）+ fp-lock CSS',
    fceSrc.indexOf('var SUBSCRIPTION_TEST_MODE = false;') !== -1 &&
    fceSrc.indexOf('var FREE_FONT_CAP_PER_LANG = 5;') !== -1 &&
    fceSrc.indexOf('window.FREE_FONT_CAP_PER_LANG = FREE_FONT_CAP_PER_LANG;') !== -1 &&
    fceSrc.indexOf('.fp-lock {') !== -1 &&
    fceSrc.indexOf("FP_BUILT ||") === -1);

  ok('F2b 静态：卡片背景锁（cardBgLockRow/升级链接/守卫 toast×3）+ 页面背景锁（入口锁/拦截 toast×2）',
    fceSrc.indexOf('id="cardBgLockRow"') !== -1 &&
    fceSrc.indexOf('id="cardBgUpgradeLink"') !== -1 &&
    cnt(fceSrc, '卡片背景为订阅用户专属功能') >= 4 &&
    fceSrc.indexOf('id="pageBgEntryLock"') !== -1 &&
    fceSrc.indexOf('id="pageBgUpgradeLink"') !== -1 &&
    cnt(fceSrc, '页面背景为订阅用户专属功能——订阅后解锁') >= 2);

  ok('F2c 静态：XP 钩子（发文章 publishXPReward ×3 接线=演示发布/新建/更新三路径/建卡 drop ×1）+ 边缘守卫保留 + 设置弹窗订阅仅限资料区三层门禁 ×11（Appearance 平台主题仍免费无锁）',
    cnt(fceSrc, 'publishXPReward();') === 3 &&
    cnt(fceSrc, "addXP('publish_article', published ? 5 : 120);") === 1 &&
    cnt(fceSrc, "SlatiDB.addXP('card_create', 10)") === 1 &&
    fceSrc.indexOf('背景边缘为订阅用户专属功能') !== -1 &&
    smSrc.indexOf('Appearance') !== -1 &&
    cnt(smSrc, '订阅') === 11); // 58.22 口径更新：三层门禁 9 处（gif/lib/banner 锁定 toast 兜底 ×3+stCanImg/stCanGif 注释 ×2+订阅谓词注释+升级链接兜底 ×3）——58.21 的 ×5 随新增 stCanImg/stCanGif/bannerLocked/imgUpgrade/premGifUpgrade 失效

  ok('F3a 静态：storage.js 等级模块（LEVELS 旅行者→君主/addXP/getLevelState/每日登录/事件/话题 30 天结算队列）',
    storageSrc.indexOf('XP: \'slati_xp\'') !== -1 &&
    storageSrc.indexOf('XP_LAST_LOGIN: \'slati_xp_last_login\'') !== -1 &&
    storageSrc.indexOf("name: '旅行者'") !== -1 &&
    storageSrc.indexOf("name: '君主'") !== -1 &&
    storageSrc.indexOf('addXP: addXP,') !== -1 &&
    storageSrc.indexOf('getLevelState: getLevelState,') !== -1 &&
    storageSrc.indexOf('mn:xp-changed') !== -1 &&
    storageSrc.indexOf('mn:level-up') !== -1 &&
    storageSrc.indexOf('daily_login') !== -1 &&
    storageSrc.indexOf('grantDailyLoginBonus();') !== -1 &&
    storageSrc.indexOf('submit_nation') !== -1 && storageSrc.indexOf('submit_world') !== -1 &&
    storageSrc.indexOf('XP_TOPIC_PENDING') !== -1 && storageSrc.indexOf("addXP('topic_sustained', 25);") !== -1 &&
    storageSrc.indexOf('onboarding_done') !== -1);

  ok('F3b 静态：sidebar.js 徽章/事件/toast + premium.html gatewayNote（到账自动生效口径）',
    sidebarSrc.indexOf('mn-lv-badge') !== -1 &&
    sidebarSrc.indexOf("addEventListener('mn:xp-changed'") !== -1 &&
    sidebarSrc.indexOf("addEventListener('mn:level-up'") !== -1 &&
    sidebarSrc.indexOf('等级提升') !== -1 &&
    premiumSrc.indexOf('id="gatewayNote"') !== -1 &&
    premiumSrc.indexOf('到账自动生效，无需人工审核') !== -1 &&
    premiumSrc.indexOf('id="planNote"') !== -1);

  // ═══ 浏览器场景 ═══
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
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    // localStorage 预设：先落同源 404 页（origin 成立），再导航目标页（页面脚本读预设）
    const setLS = async (pairs) => {
      await nav(BASE + '/batt-setup.html', "document.readyState === 'complete'", 'LS setup');
      const body = pairs.map(p => p.remove
        ? "localStorage.removeItem('" + p.k + "')"
        : "localStorage.setItem('" + p.k + "', " + JSON.stringify(p.v) + ")").join(';');
      const r = await cdp.evalJs("(function(){ try { " + body + "; return 'ok'; } catch(e){ return 'ERR ' + e.message; } })()");
      if (r !== 'ok') throw new Error('setLS 失败: ' + r);
    };
    const editorReady = "typeof window.createFlagCard === 'function' && typeof window.isSubscriberUser === 'function'";
    // 唯一标签：S1 草稿自动保存会被 S2 页面加载恢复——按 data-label 精确取卡
    const makeCard = (label) => cdp.evalJs("(function(){ var c = window.createFlagCard('" + label + "', 2, 2, 4, 3); window.selectCard(c); return true; })()");
    const toastNow = () => cdp.evalJs("JSON.stringify({ t: document.getElementById('toast').textContent, show: document.getElementById('toast').classList.contains('show') })");

    // ═══ S1 免费用户（tier:'free'）——锁全显 ═══
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt', displayName: 'Free Tester', citizenId: 'CIT-8842', tier: 'free' }) },
      { k: 'slati_xp', v: '0' },
      { k: 'slati_xp_last_login', remove: true },
    ]);
    await nav(BASE + '/pages/fluidcanvas-editor.html', editorReady, '编辑器就绪(free)');
    let r = await cdp.evalJs('window.isSubscriberUser()');
    ok('S1a free 用户 isSubscriberUser() === false', r === false, String(r));
    r = await cdp.evalJs("document.getElementById('pageBgEntryLock').style.display");
    ok('S1b 资产面板页面背景入口锁标可见（flex）+ 升级链接在', r === 'flex' && (await cdp.evalJs("!!document.getElementById('pageBgUpgradeLink')")), r);

    await makeCard('Batt S1');
    // caption 弹层锁
    r = await cdp.evalJs("(function(){ document.getElementById('captionPosPopover').classList.add('active'); window.refreshCaptionPopoverState(); " +
      "return JSON.stringify({ locked: document.querySelectorAll('#captionEdgeButtons .caption-edge-btn.locked').length, " +
      "up: document.getElementById('captionEdgeUpgradeLink').style.display }); })()");
    const s1c = JSON.parse(r);
    ok('S1c caption 边缘 3 锁 + 升级链接可见', s1c.locked === 3 && s1c.up === '', r);
    // 卡片背景弹层锁
    r = await cdp.evalJs("(function(){ window.openCardBgPopover(); " +
      "return JSON.stringify({ lock: getComputedStyle(document.getElementById('cardBgLockRow')).display, " +
      "color: getComputedStyle(document.getElementById('cardBgColorRow')).display, " +
      "upload: getComputedStyle(document.getElementById('cardBgUploadBlock')).display, " +
      "locked: document.querySelectorAll('#cardEdgeButtons .caption-edge-btn.locked').length, " +
      "up: document.getElementById('cardEdgeUpgradeLink').style.display }); })()");
    const s1d = JSON.parse(r);
    ok('S1d cardBg 锁行显示 + 色盘/上传隐藏 + 边缘 14 锁 + 升级链接可见',
      s1d.lock === 'flex' && s1d.color === 'none' && s1d.upload === 'none' && s1d.locked === 14 && s1d.up === '', r);
    // 守卫：setCardBgColor 无效 + toast
    r = await cdp.evalJs("(function(){ window.setCardBgColor('#ff0000'); " +
      "return JSON.stringify({ bg: document.querySelector('.grid-card[data-label=\"Batt S1\"]').dataset.cardBgColor || null, t: document.getElementById('toast').textContent }); })()");
    const s1e = JSON.parse(r);
    ok('S1e setCardBgColor 被拦截（无 dataset）+ toast「卡片背景为订阅用户专属功能」',
      s1e.bg === null && s1e.t === '卡片背景为订阅用户专属功能', r);
    // 守卫：setCardEdge 无效 + toast（边缘 UI 锁的第二道防线）
    r = await cdp.evalJs("(function(){ window.setCardEdge('paper'); " +
      "return JSON.stringify({ edge: document.querySelector('.grid-card[data-label=\"Batt S1\"]').dataset.cardEdge || null, t: document.getElementById('toast').textContent }); })()");
    const s1f = JSON.parse(r);
    ok('S1f setCardEdge 被拦截 + toast「背景边缘为订阅用户专属功能」',
      s1f.edge === null && s1f.t === '背景边缘为订阅用户专属功能', r);
    // 守卫：openPageBgModal 拦截 + toast
    r = await cdp.evalJs("(function(){ window.openPageBgModal(); " +
      "return JSON.stringify({ active: !!(document.querySelector('#pageBgModal .modal-card.active')), t: document.getElementById('toast').textContent }); })()");
    const s1g = JSON.parse(r);
    ok('S1g openPageBgModal 被拦截（弹窗未开）+ toast「页面背景为订阅用户专属功能——订阅后解锁」',
      !s1g.active && s1g.t === '页面背景为订阅用户专属功能——订阅后解锁', r);
    // 字体面板：每语言 5 个 + 锁行
    r = await cdp.evalJs("(function(){ window.showFontPanel(); " +
      "return JSON.stringify({ rows: document.querySelectorAll('.fp-list .fp-row').length, " +
      "locks: document.querySelectorAll('.fp-list .fp-lock').length, " +
      "head1: (document.querySelectorAll('.fp-list .fp-group')[0] || {}).textContent, " +
      "lock1: (document.querySelectorAll('.fp-list .fp-lock')[0] || {}).textContent, " +
      "lockHref: (document.querySelectorAll('.fp-list .fp-lock')[0] || {}).href, " +
      "viHead: Array.prototype.map.call(document.querySelectorAll('.fp-list .fp-group'), function(g){ return g.textContent; }).filter(function(t){ return t.indexOf('Vietnamese') === 0; })[0], " +
      "heHead: Array.prototype.map.call(document.querySelectorAll('.fp-list .fp-group'), function(g){ return g.textContent; }).filter(function(t){ return t.indexOf('Hebrew') === 0; })[0] }); })()");
    const s1h = JSON.parse(r);
    ok('S1h 字体面板免费=47 行（8 组×5+vi4+he3）+ 8 锁行 + 组头 5/283 + 锁行「剩余 278」+ vi/he 全免',
      s1h.rows === 47 && s1h.locks === 8 && s1h.head1 === 'Latin / English · 5/283' &&
      s1h.lock1.indexOf('278') !== -1 && s1h.lockHref.indexOf('premium.html') !== -1 &&
      s1h.viHead === 'Vietnamese Tiếng Việt · 4/4' && s1h.heHead === 'Hebrew עברית · 3/3', r);
    // 设置弹窗 Appearance 无锁可点（平台主题免费）
    r = await cdp.evalJs("(function(){ window.SlatiSettings.open(); " +
      "return JSON.stringify({ menu: Array.prototype.map.call(document.querySelectorAll('#settingsMenu .settings-menu-item'), function(b){ return b.textContent; }) }); })()");
    const s1i = JSON.parse(r);
    ok('S1i 设置弹窗含外观（45.0 i18n 后 zh 渲染）且无订阅锁条目', s1i.menu.some(x => x.indexOf('外观') !== -1), r);
    await cdp.evalJs('window.SlatiSettings.close()');
    // 编辑器合成 drop → +10 XP（free 用户等级照涨——等级与订阅双轨）
    r = await cdp.evalJs("(function(){ var before = JSON.parse(localStorage.getItem('slati_xp') || '0'); " +
      "var dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify({ label: 'Batt Flag', asset: 'flag', isReposition: false })); " +
      "document.getElementById('gridCanvas').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, cancelable: true })); " +
      "var after = JSON.parse(localStorage.getItem('slati_xp') || '0'); " +
      "return JSON.stringify({ before: before, after: after, card: !!document.querySelector('.grid-card[data-label=\"Batt Flag\"]') }); })()");
    const s1j = JSON.parse(r);
    ok('S1j 合成 drop 建卡 + XP +10（' + s1j.before + ' → ' + s1j.after + '）',
      s1j.after === s1j.before + 10 && s1j.card, r);
    // 无 slati_user 双态（会话在、用户缺失）→ 仍判 free
    await setLS([{ k: 'slati_user', remove: true }]);
    await nav(BASE + '/pages/fluidcanvas-editor.html', editorReady, '编辑器就绪(无 user)');
    r = await cdp.evalJs("JSON.stringify({ sub: window.isSubscriberUser(), lock: document.getElementById('pageBgEntryLock').style.display })");
    const s1k = JSON.parse(r);
    ok('S1k 无 slati_user（会话在）→ isSubscriberUser false + 入口锁仍显', !s1k.sub && s1k.lock === 'flex', r);

    // ═══ S2 订阅用户（tier:'premium'）——全解锁 ═══
    await setLS([
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt', displayName: 'Premium Tester', citizenId: 'CIT-8842', tier: 'premium' }) },
    ]);
    await nav(BASE + '/pages/fluidcanvas-editor.html', editorReady, '编辑器就绪(premium)');
    r = await cdp.evalJs('window.isSubscriberUser()');
    ok('S2a premium 用户 isSubscriberUser() === true', r === true, String(r));
    await makeCard('Batt S2');
    r = await cdp.evalJs("(function(){ window.openCardBgPopover(); " +
      "return JSON.stringify({ lock: getComputedStyle(document.getElementById('cardBgLockRow')).display, " +
      "color: getComputedStyle(document.getElementById('cardBgColorRow')).display, " +
      "locked: document.querySelectorAll('#cardEdgeButtons .caption-edge-btn.locked').length, " +
      "up: document.getElementById('cardEdgeUpgradeLink').style.display, " +
      "entry: getComputedStyle(document.getElementById('pageBgEntryLock')).display }); })()");
    const s2b = JSON.parse(r);
    ok('S2b cardBg 锁行隐藏 + 色盘显示 + 边缘零锁 + 升级链接隐藏 + 入口锁标隐藏',
      s2b.lock === 'none' && s2b.color === 'flex' && s2b.locked === 0 && s2b.up === 'none' && s2b.entry === 'none', r);
    r = await cdp.evalJs("(function(){ window.setCardBgColor('#ff0000'); " +
      "return JSON.stringify({ bg: document.querySelector('.grid-card[data-label=\"Batt S2\"]').dataset.cardBgColor || null, t: document.getElementById('toast').textContent }); })()");
    const s2c = JSON.parse(r);
    ok('S2c setCardBgColor 生效（dataset 写入）+ 无拦截 toast', s2c.bg === '#ff0000' && s2c.t !== '卡片背景为订阅用户专属功能', r);
    r = await cdp.evalJs("(function(){ window.setCardEdge('paper'); " +
      "return JSON.stringify({ edge: document.querySelector('.grid-card[data-label=\"Batt S2\"]').dataset.cardEdge || null }); })()");
    const s2d = JSON.parse(r);
    ok('S2d setCardEdge 生效（paper 写入）', s2d.edge === 'paper', r);
    r = await cdp.evalJs("(function(){ window.openPageBgModal(); return !!document.querySelector('#pageBgModal .modal-card.active'); })()");
    ok('S2e openPageBgModal 正常打开', r === true, String(r));
    await cdp.evalJs('window.closePageBgModalCancel()');
    r = await cdp.evalJs("(function(){ window.showFontPanel(); " +
      "return JSON.stringify({ rows: document.querySelectorAll('.fp-list .fp-row').length, " +
      "locks: document.querySelectorAll('.fp-list .fp-lock').length, " +
      "head1: (document.querySelectorAll('.fp-list .fp-group')[0] || {}).textContent }); })()");
    const s2f = JSON.parse(r);
    ok('S2f 字体面板订阅=451 行全部 + 零锁行 + 组头 283', s2f.rows === 451 && s2f.locks === 0 && s2f.head1 === 'Latin / English · 283', r);

    // ═══ S3 等级系统（index.html）═══
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt', displayName: 'Lv Tester', citizenId: 'CIT-8842', tier: 'free' }) },
      { k: 'slati_xp', v: '0' },
      { k: 'slati_xp_last_login', remove: true },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪');
    r = await cdp.evalJs("(function(){ var b = document.querySelector('#slati-sidebar .mn-lv-badge'); " +
      "var n = b.querySelector('.mn-lv-normal'); " +
      "var fill = n && n.lastElementChild && n.lastElementChild.firstElementChild; " +
      "return JSON.stringify({ txt: b.textContent, bar: fill ? fill.style.width : null, xp: JSON.parse(localStorage.getItem('slati_xp') || '0') }); })()");
    const s3a = JSON.parse(r);
    ok('S3a 徽章 Lv.1·旅行者 + 每日登录 +5（0→5）+ 进度 0%', s3a.txt.indexOf('Lv.1 · 旅行者') !== -1 && s3a.xp === 5 && s3a.bar === '0%', r);
    // 监听升级事件后 addXP
    await cdp.evalJs("window.__lvl = []; window.addEventListener('mn:level-up', function(e){ window.__lvl.push(e.detail.state.lv); });");
    await cdp.evalJs("window.SlatiDB.addXP('batt', 10)");
    r = await cdp.evalJs("document.querySelector('#slati-sidebar .mn-lv-badge').textContent");
    ok('S3b addXP +10 → 徽章实时刷新 15 / 1200', r.indexOf('15 / 1200 XP') !== -1, r);
    // 1195 → +10 跨级（Lv2 阈值 1200）
    await cdp.evalJs("localStorage.setItem('slati_xp', '1195'); window.SlatiDB.addXP('batt', 10)");
    r = await cdp.evalJs("JSON.stringify({ badge: document.querySelector('#slati-sidebar .mn-lv-badge').textContent, " +
      "lvl: JSON.stringify(window.__lvl), xp: JSON.parse(localStorage.getItem('slati_xp') || '0'), " +
      "toast: (function(){ var t = null; var all = document.querySelectorAll('div'); for (var i = 0; i < all.length; i++) { if (all[i].textContent === '等级提升！Lv.2 · 拓荒者' && all[i].style.position === 'fixed') t = true; } return !!t; })() })");
    const s3c = JSON.parse(r);
    ok('S3c 1195+10 跨级 → Lv.2·拓荒者 + mn:level-up 事件 + 升级 toast',
      s3c.badge.indexOf('Lv.2 · 拓荒者') !== -1 && s3c.badge.indexOf('1205 / 2400 XP') !== -1 && s3c.lvl === '[2]' && s3c.toast && s3c.xp === 1205, r);
    // 重载两次：每日 +5 只发一次（日期键）
    await cdp.send('Page.reload');
    await waitFor(cdp, "!!document.querySelector('#slati-sidebar .mn-lv-badge')", 20000, '重载1');
    await cdp.send('Page.reload');
    await waitFor(cdp, "!!document.querySelector('#slati-sidebar .mn-lv-badge')", 20000, '重载2');
    r = await cdp.evalJs("JSON.stringify({ xp: JSON.parse(localStorage.getItem('slati_xp') || '0'), badge: document.querySelector('#slati-sidebar .mn-lv-badge').textContent })");
    const s3d = JSON.parse(r);
    ok('S3d 重载两次 XP 仍 1205（每日 +5 只发一次）+ 徽章口径不变', s3d.xp === 1205 && s3d.badge.indexOf('Lv.2 · 拓荒者') !== -1, r);
    // 访客：无会话 → 无徽章、无异常
    await setLS([{ k: 'slati_session', remove: true }]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar')", '访客首页');
    r = await cdp.evalJs("JSON.stringify({ badge: !!document.querySelector('#slati-sidebar .mn-lv-badge'), guest: document.querySelector('#slati-sidebar').textContent.indexOf('注册 / 登录') !== -1 })");
    const s3e = JSON.parse(r);
    ok('S3e 访客无徽章 + 注册/登录 CTA 正常', !s3e.badge && s3e.guest, r);

    // ═══ Z 零 console error ═══
    ok('Z 零 console error', cdp.errs.length === 0, JSON.stringify(cdp.errs));

    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
  }
  console.log('\n  ── 结果: ' + PASS + '/' + (PASS + FAIL) + (FAIL === 0 ? ' 全绿 ✅' : ' 有红 ❌'));
  process.exit(FAIL === 0 ? 0 : 1);
(() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
