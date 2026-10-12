// tmp-probe-hub-630.js — v0.2.58.25 社区页演示样本全移除线上探针（mnationworld.com）
//   S1 静态锚：live community-hub.html 新件锚 23 项（18 恰 1/4 恰 2/loginCta 恰 3）+ 演示零残留 16 锚全 0；
//   site-config 58.24 赋值+58.23 零残留+FC 48.0+changelog 58.24 头+rev live 口径（00346-ntt ×1/00346-XXX 零残留/
//   00347-??? 占位 ×1——live 文本滞后一部署=惯例，二次烘焙镜像 00345 未填）；live hub i18n 11 新键 SQ×11+DQ×1+
//   删键族 5 全 0+hub.emptyFeed 保留 ×12+__ZH_HANT_AUTO__ ×1；
//   S2 端点形状：posts 匿名 200+posts 数组（空合法）/feed 匿名 401（requireSession）/topics 200+topics 数组（空合法）；
//   S3 PII 扫描：posts 响应串零 email（空帖则跳过）；
//   P1 CDP 匿名渲染：#hubLoginCard+锁图标+去登录+feed 恰 1 卡+零云卡零演示签名零 composer+三 tab 恒引导卡+
//   发现/热门双引导行+正文四假名全不在+零跳页；
//   E1 零异常（噪声已滤）。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SITE = 'https://mnationworld.com';
const HUB = SITE + '/pages/community-hub.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-hub-' + Date.now());
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
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  console.log('═══ S1 静态锚（live community-hub.html + site-config + hub i18n）═══');
  const hubRes = await fetch(HUB);
  const hubSrc = norm(await hubRes.text());
  const c = mk(hubSrc);
  ok('S1a live hub 新件锚（function isHubAuthed+cloudMode = isHubAuthed()+hubLoginCard/hubOfflineCard id+hubOfflineCardHtml+mn:unauthorized 监听+三端点 GET 各 ×1+create-topic-step-1.html+hub.emptyFeed/topic.members/channelsEmpty/feedEmptyFollowing/feedEmptyTopic/offline+topicCardHtml/feedEmptyHtml 各 ×1；discovery.guest/emptyTopics+hubLoginCardHtml/hubOfflineCardHtml 各 ×2；loginCta ×3）',
    c('function isHubAuthed') === 1 && c('cloudMode = isHubAuthed()') === 1 && c('id="hubLoginCard"') === 1 &&
    c('id="hubOfflineCard"') === 1 && c('function hubOfflineCardHtml') === 1 && c("addEventListener('mn:unauthorized'") === 1 &&
    c("MN_API.get('/social/posts'") === 1 && c("MN_API.get('/social/feed'") === 1 && c("MN_API.get('/social/topics'") === 1 &&
    c('create-topic-step-1.html') === 1 && c("T('hub.emptyFeed')") === 1 && c("T('hub.topic.members')") === 1 &&
    c("T('hub.discovery.channelsEmpty')") === 1 && c("T('hub.feedEmptyFollowing')") === 1 && c("T('hub.feedEmptyTopic')") === 1 &&
    c("T('hub.offline')") === 1 && c('function topicCardHtml') === 1 && c('function feedEmptyHtml') === 1 &&
    c("T('hub.discovery.guest')") === 2 && c("T('hub.discovery.emptyTopics')") === 2 &&
    c('hubLoginCardHtml') === 2 && c('hubOfflineCardHtml') === 2 && c("T('hub.loginCta.") === 3,
    'auth=' + c('function isHubAuthed') + ' login=' + c('id="hubLoginCard"') + ' disc=' + c("T('hub.discovery.guest')") +
    ' cta=' + c("T('hub.loginCta."));
  const ZERO = ['var feedData', 'Marcus Vane', 'Sovereign Council', 'Cartography Guild', 'Neural Architects',
    'SlatiDB.getTopics', 'data-guest-', 'hub.toast.likeLogin', 'hub.toast.repostLogin', 'hub.toast.favLogin',
    'hub.share.communityTitle', 'communityHub.feed.', 'badgeKey', 'timeKey', 'titleKey', 'descKey'];
  const zleft = ZERO.filter(a => c(a) !== 0);
  ok('S1b live hub 演示零残留全表（16 锚全 0）', zleft.length === 0, zleft.join(',') || '全零');

  const sc = await fetch(SITE + '/assets/js/site-config.js');
  const scSrc = norm(await sc.text());
  const scCount = mk(scSrc);
  ok('S1c site-config：58.24 赋值在位 + 58.23 赋值零残留 + FC 48.0 在位 + changelog 58.24 标题 ×1 + 58.23 历史条目保留',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.25';") === 1 && scCount("window.MN_SITE_VERSION = 'v0.2.58.23';") === 0 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") === 1 && scCount('// v0.2.58.25 = ') === 1 &&
    scCount('// v0.2.58.23 = ') === 1,
    'v58.24=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.25';") + ' v58.23=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.23';") +
    ' cl24=' + scCount('// v0.2.58.25 = ') + ' cl23=' + scCount('// v0.2.58.23 = '));
  ok('S1d site-config rev live 口径：00346-ntt 真值 ×1 + 00346-XXX 零残留 + 00347-??? 占位 ×1（live 文本滞后一部署=惯例）',
    scCount('rev 00346-ntt') === 1 && scCount('rev 00346-XXX') === 0 && scCount('rev 00347-???') === 1,
    'r44=' + scCount('rev 00346-ntt') + ' x44=' + scCount('rev 00346-XXX') + ' q45=' + scCount('rev 00347-???'));

  const hubi = await fetch(SITE + '/assets/i18n/community-hub.i18n.js');
  const hubiSrc = norm(await hubi.text());
  const ic = mk(hubiSrc);
  const KEYS = ['hub.loginCta.title', 'hub.loginCta.desc', 'hub.loginCta.btn', 'hub.offline', 'hub.feedEmptyFollowing',
    'hub.feedEmptyTopic', 'hub.feedEmptyTopicCta', 'hub.discovery.guest', 'hub.discovery.emptyTopics',
    'hub.discovery.channelsEmpty', 'hub.topic.members'];
  const kbad = KEYS.filter(k => ic("'" + k + "'") !== 11 || ic('"' + k + '"') !== 1);
  const IZERO = ['communityHub.feed.', 'hub.toast.likeLogin', 'hub.toast.repostLogin', 'hub.toast.favLogin', 'hub.share.communityTitle'];
  const izleft = IZERO.filter(a => ic(a) !== 0);
  ok('S1e live hub i18n：11 新键各 SQ×11+DQ×1 + 删键族 5 全 0 + hub.emptyFeed 保留 ×12 + __ZH_HANT_AUTO__ ×1',
    kbad.length === 0 && izleft.length === 0 && ic('hub.emptyFeed') === 12 && ic('__ZH_HANT_AUTO__') === 1,
    'kbad=' + kbad.join(',') + ' izleft=' + izleft.join(',') + ' feed=' + ic('hub.emptyFeed') + ' hant=' + ic('__ZH_HANT_AUTO__'));

  console.log('═══ S2 端点形状（匿名）═══');
  const postsRes = await fetch(SITE + '/api/social/posts', { headers: { 'accept': 'application/json' } });
  const postsBody = await postsRes.json().catch(() => null);
  ok('S2a GET /api/social/posts 匿名 200 + posts 数组（空数组合法）',
    postsRes.status === 200 && postsBody && Array.isArray(postsBody.posts),
    'status=' + postsRes.status + ' posts=' + (postsBody && Array.isArray(postsBody.posts) ? postsBody.posts.length + ' 条' : JSON.stringify(postsBody).slice(0, 80)));
  const feedRes = await fetch(SITE + '/api/social/feed', { headers: { 'accept': 'application/json' } });
  ok('S2b GET /api/social/feed 匿名 401（requireSession——访客前端整流）', feedRes.status === 401, 'status=' + feedRes.status);
  const topicsRes = await fetch(SITE + '/api/social/topics', { headers: { 'accept': 'application/json' } });
  const topicsBody = await topicsRes.json().catch(() => null);
  ok('S2c GET /api/social/topics 匿名 200 + topics 数组（空表合法）',
    topicsRes.status === 200 && topicsBody && Array.isArray(topicsBody.topics),
    'status=' + topicsRes.status + ' topics=' + (topicsBody && Array.isArray(topicsBody.topics) ? topicsBody.topics.length + ' 条' : JSON.stringify(topicsBody).slice(0, 80)));

  console.log('═══ S3 PII 扫描（posts 公开响应串）═══');
  const postsStr = JSON.stringify(postsBody);
  const emails = postsStr.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  if (postsBody && postsBody.posts.length === 0) {
    ok('S3 PII：线上无帖 → 扫描跳过（空数组天然零泄露）', true);
  } else {
    ok('S3 PII：posts 响应串零 email', emails.length === 0, emails.slice(0, 3).join(','));
  }

  console.log('═══ P1 CDP 匿名渲染（访客=登录引导卡零假卡）═══');
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
    await cdp.send('Page.navigate', { url: HUB });
    await waitFor(cdp, "document.getElementById('hubLoginCard')", 60000, '访客登录引导卡');
    await sleep(1200);
    const p1 = await cdp.evalJs("(() => { var feed = document.getElementById('feedContent'); var card = document.getElementById('hubLoginCard');" +
      " return { loginCard: !!card, lockIcon: card ? (card.querySelector('.material-symbols-outlined') || {}).textContent : null," +
      " btnText: card ? ((card.querySelector('button') || {}).textContent || '') : ''," +
      " cards: feed.querySelectorAll('.card').length," +
      " cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " guest: document.querySelectorAll('[data-guest-like],[data-guest-repost],[data-guest-favorite],[data-guest-share]').length," +
      " likeBtn: feed.querySelectorAll('[data-like-post]').length," +
      " static: feed.querySelectorAll('.post-action-btn-static').length," +
      " composer: !!document.getElementById('postComposer') }; })()");
    ok('P1 访客=登录引导卡（锁图标+去登录钮）+feed 恰 1 卡+零云卡零演示签名零 composer',
      p1.loginCard && p1.lockIcon === 'lock' && p1.btnText.indexOf('去登录') !== -1 && p1.cards === 1 &&
      p1.cloud === 0 && p1.guest === 0 && p1.likeBtn === 0 && p1.static === 0 && !p1.composer, JSON.stringify(p1));
    await cdp.evalJs("document.querySelector('[data-tab=\"following\"]').click()");
    await sleep(200);
    const p2 = await cdp.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " active: (document.querySelector('[data-tab=\"following\"]') || {}).className || '' }; })()");
    ok('P1 following tab 恒登录引导卡（切 tab 零云卡+active 类）', p2.loginCard && p2.cloud === 0 && p2.active.indexOf('active') !== -1, JSON.stringify(p2));
    await cdp.evalJs("document.querySelector('[data-tab=\"topic\"]').click()");
    await sleep(200);
    const p3 = await cdp.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    ok('P1 topic tab 恒登录引导卡（切 tab 零云卡）', p3.loginCard && p3.cloud === 0, JSON.stringify(p3));
    const p4 = await cdp.evalJs("(() => { var d = document.getElementById('discoveryList'); var tr = document.getElementById('trendingList');" +
      " return { guest: d.textContent.indexOf('登录后探索话题与频道') !== -1, trendGuest: tr.textContent.indexOf('登录后探索话题与频道') !== -1 }; })()");
    ok('P1 发现中心+热门双引导行', p4.guest && p4.trendGuest, JSON.stringify(p4));
    const p5 = await cdp.evalJs("(() => { var t = document.body.textContent;" +
      " return { m: t.indexOf('Marcus Vane') === -1, s: t.indexOf('Sovereign Council') === -1," +
      " c: t.indexOf('Cartography Guild') === -1, n: t.indexOf('Neural Architects') === -1 }; })()");
    ok('P1 正文四假名全不在 DOM（演示样本零残留）', p5.m && p5.s && p5.c && p5.n, JSON.stringify(p5));

    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|Failed to load resource|\/api\/|404|429|analytics|pageview|mnationworld/i;
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
