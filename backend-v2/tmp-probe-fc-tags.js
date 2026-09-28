// tmp-probe-fc-tags.js — FC v10.28.47.0 图库标签+图库桥+AI 混合查重 上线实机探针（rev 00299-）
// 用户「做！但是再添加一个标签分类例如默认标配 国旗 国徽 地图…用AI检查一下是否有重复的标签…」
//   S 静态（线上 site-config 46.0 + rev 00298- + 站点 58.0 恒、编辑器页标签 store/桥/筛选/管理锚）
//   P 实机（桌面 CDP + 一次性临时 profile）：P1 惰性播种 3 sys 标签+上传带标签+条目 tags 在位｜
//     P2 筛选并集（越选越多）｜P3 跨语言命中 Flag/国旗｜P4 桥-头像右键→图库双击→草稿立即含
//     charAvatar｜P5 /api/tags/dedup 无 cookie 401｜P6 伪会话 cookie → 仍 401 JSON 体（端点在线；
//     200 路径由本地 334 测试 + 模型实调覆盖）｜P7 两处建标签（元数据弹窗+标签管理）｜E1 零异常。
// 探针纪律：一次性 user-data-dir（与用户真实 profile 隔离）+ 收尾清草稿/图库/标签键——零污染。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (url, opts) => new Promise((resolve) => {
  opts = opts || {};
  const req = https.request(url, { method: opts.method || 'GET', headers: Object.assign({ 'User-Agent': 'mn-probe' }, opts.headers), timeout: 30000 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 2000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  if (opts.body) req.write(opts.body);
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
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

(async () => {
  const BASE = 'https://mnationworld.com';

  // ── S 线上静态 ──
  const sc = await get(BASE + '/assets/js/site-config.js');
  ok('S1 线上 site-config：FC v10.28.47.4 + rev 00327- 前缀 + 站点恒 v0.2.58.16 + 图库标签 changelog + 旧 47.3 版本赋值锚零残留',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sc.body.indexOf('rev 00327-') !== -1 && sc.body.indexOf('v0.2.58.16') !== -1 &&
    sc.body.indexOf('图库标签') !== -1 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.3';") === -1,
    'status=' + sc.status + ' err=' + sc.error);
  const ed = await get(BASE + '/pages/fluidcanvas-editor.html');
  ok('S2 线上编辑器页：标签 store/桥菜单项/筛选钮/标签管理/桥入口锚在位',
    ed.status === 200 &&
    ed.body.indexOf("'slati_img_tags'") !== -1 &&
    ed.body.indexOf("id=\"avatarLibMenuItem\"") !== -1 &&
    ed.body.indexOf("id=\"flagFilterBtn\"") !== -1 &&
    ed.body.indexOf("id=\"tagManageModal\"") !== -1 &&
    ed.body.indexOf('function openLibForSlot(') !== -1,
    'status=' + ed.status + ' err=' + ed.error);

  // ── P5/P6 API（无浏览器，先跑） ──
  const dedupBody = JSON.stringify({ original: '国旗', enName: '', existing: [] });
  const r5 = await get(BASE + '/api/tags/dedup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: dedupBody
  });
  ok('P5 POST /api/tags/dedup 无 cookie → 401 拦截', r5.status === 401,
    'status=' + r5.status + ' body=' + String(r5.body || r5.error || '').slice(0, 120));
  const r6 = await get(BASE + '/api/tags/dedup', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': 'mn_session=probe-invalid-token' }, body: dedupBody
  });
  ok('P6 伪会话 cookie → 仍 401 JSON 体（端点在线非 404；200 路径=本地 334 测试+模型实调覆盖）',
    r6.status === 401 && r6.body.indexOf('"error"') !== -1,
    'status=' + r6.status + ' body=' + String(r6.body || r6.error || '').slice(0, 120));

  // ── P 实机（一次性 profile + 收尾清键） ──
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fctags-' + Date.now());
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
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!window.MN_I18N && !!document.getElementById('gridCanvas') && !!window.tagLoad && !!window.openLibForSlot && !!window.imgLibPut", 30000, 'P 编辑器加载');
    await sleep(800);

    await cdp.evalJs(`(function(){
      localStorage.removeItem('slati_img_tags'); localStorage.removeItem('slati_img_library');
      window.__toast = function () { var t = document.getElementById('toast'); return t ? t.textContent : ''; };
      window.__draft = function () { try { return JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || 'null'); } catch (e) { return null; } };
      window.__lib = function () { try { return JSON.parse(localStorage.getItem('slati_img_library') || '[]'); } catch (e) { return []; } };
      window.__tags = function () { return window.tagLoad(); };
      window.__mkImgTo = function (name, colorA, colorB, sel) {
        var cv = document.createElement('canvas'); cv.width = 8; cv.height = 6;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = colorA; ctx.fillRect(0, 0, 8, 6);
        ctx.fillStyle = colorB; ctx.fillRect(0, 0, 4, 6);
        var url = cv.toDataURL('image/png');
        var bin = atob(url.split(',')[1]);
        var u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        var dt = new DataTransfer();
        dt.items.add(new File([u8], name, { type: 'image/png' }));
        var fi = (sel || window.__upCard).querySelector('.card-upload-input');
        fi.files = dt.files;
        fi.dispatchEvent(new Event('change', { bubbles: true }));
        return url;
      };
      window.__gridSrcs = function () {
        return Array.prototype.slice.call(document.querySelectorAll('#flagGrid .flag-card-item img')).map(function (i) { return i.src; });
      };
    })()`);

    const metaOpen = "!!document.getElementById('imgMetaModal') && !!document.querySelector('#imgMetaModal .modal-card.active')";
    const metaClosed = "!document.querySelector('#imgMetaModal .modal-card.active')";

    // ── P1 惰性播种 3 sys 标签 + 上传带标签 + 条目 tags 在位 ──
    const p1a = await cdp.evalJs("(function(){ var t = window.__tags(); return { n: t.length, sysN: t.filter(function(x){ return x.sys; }).length, ids: t.map(function(x){ return x.id; }).join(',') }; })()");
    ok('P1a 惰性播种：恰好 3 个系统标签（sys-flag/sys-emblem/sys-map）',
      p1a.n === 3 && p1a.sysN === 3 && p1a.ids.indexOf('sys-flag') !== -1 &&
      p1a.ids.indexOf('sys-emblem') !== -1 && p1a.ids.indexOf('sys-map') !== -1, JSON.stringify(p1a));
    await cdp.evalJs("window.__upCard = window.createCharacterCard(1, 1, 4, 5);");
    const u1 = await cdp.evalJs("window.__mkImgTo('probe1.png', '#e33', '#fff')");
    await waitFor(cdp, metaOpen, 8000, 'P1 元数据弹窗打开');
    await cdp.evalJs("(function(){ var c = document.querySelectorAll('#immTagChips .imm-tag-chip')[0]; c.click(); })()");
    await cdp.evalJs("window.imgMetaSave()");
    await waitFor(cdp, metaClosed, 4000, 'P1 元数据弹窗关闭');
    const p1b = await cdp.evalJs(`(function(){ var e = window.__lib().filter(function(x){ return x.src === '${u1}'; })[0]; return { has: !!e, tags: e ? JSON.stringify(e.tags) : null }; })()`);
    ok('P1b 上传→选标签→保存：图库条目 tags==["sys-flag"]', p1b.has === true && p1b.tags === '["sys-flag"]', JSON.stringify(p1b));

    // ── P2+P3 筛选并集 + 跨语言命中 ──
    await cdp.evalJs(`window.imgLibPut('${u1}', {name:'probe1', tags:['sys-flag']}); window.imgLibPut('data:image/png;base64,cHJvYmUy', {name:'probe2', tags:['sys-map']}); window.openFlagBrowser();`);
    const p2r = await cdp.evalJs(`(function(){
      var chk = function () { return document.querySelectorAll('#flagFilterMenu input[type="checkbox"]'); };
      var n0 = window.__gridSrcs().length;
      window.toggleFlagFilterMenu();
      chk()[0].click();
      var n1 = window.__gridSrcs().length;
      chk()[2].click();  // toggle 会重渲染菜单——每次重查 NodeList（陈旧节点点击 no-op）
      var n2 = window.__gridSrcs().length;
      var badge = document.getElementById('flagFilterCount');
      return { n0: n0, n1: n1, n2: n2, badge: badge ? badge.textContent : null };
    })()`);
    ok('P2 筛选并集实机：0 选 n=' + p2r.n0 + ' → 选国旗 n=' + p2r.n1 + ' → 加选地图 n=' + p2r.n2 + '（越选越多）+ 徽章=' + p2r.badge,
      p2r.n1 === 1 && p2r.n2 === 2 && p2r.badge === '2', JSON.stringify(p2r));
    const p3r = await cdp.evalJs(`(function(){
      var q = document.getElementById('flagSearchInput');
      q.value = 'Flag'; q.dispatchEvent(new Event('input', { bubbles: true }));
      var s1 = window.__gridSrcs();
      q.value = '国旗'; q.dispatchEvent(new Event('input', { bubbles: true }));
      var s2 = window.__gridSrcs();
      return { s1: s1.length, s2: s2.length };
    })()`);
    ok('P3 跨语言命中实机：q=Flag 与 q=国旗 均命中带 sys-flag 的图', p3r.s1 === 1 && p3r.s2 === 1, JSON.stringify(p3r));
    await cdp.evalJs("window.closeFlagBrowser ? window.closeFlagBrowser() : null; window.toggleFlagFilterMenu();");

    // ── P4 桥-头像右键 → 图库双击 → 草稿立即含 charAvatar ──
    await cdp.evalJs("window.__charCard = window.createCharacterCard(6, 1, 4, 5);");
    await cdp.evalJs("window.__charCard.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 }));");
    const p4a = await cdp.evalJs("(function(){ return { av: document.getElementById('avatarLibMenuItem').style.display }; })()");
    ok('P4a 右键人物卡 → 「从图库选择头像」菜单项显示', p4a.av === 'flex', JSON.stringify(p4a));
    await cdp.evalJs("document.getElementById('avatarLibMenuItem').click()");
    const p4b = await cdp.evalJs("(function(){ var h = document.getElementById('flagSlotHint'); return { shown: h.style.display !== 'none', txt: h.textContent, open: !!document.querySelector('#flagBrowserModal .modal-card.active') }; })()");
    ok('P4b 桥开图库：slot 提示「正在为头像卡选图」+ 图库弹窗打开', p4b.shown === true && p4b.txt.indexOf('头像卡') !== -1 && p4b.open === true, JSON.stringify(p4b));
    // 双击第 2 格（probe2 图）：与 P1 卡已持的 probe1 区分——草稿断言按末位人物卡（P4 卡最后建）
    const P2SRC = 'data:image/png;base64,cHJvYmUy';
    await cdp.evalJs(`(function(){ var items = document.querySelectorAll('#flagGrid .flag-card-item'); items[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); })()`);
    const p4c = await cdp.evalJs(`(function(){
      var c = window.__charCard; var d = window.__draft();
      var chars = d && d.cards ? d.cards.filter(function(x){ return x.type === 'character'; }) : [];
      var dc = chars[chars.length - 1];
      return { avatarSet: c.dataset.charAvatar === '${P2SRC}', fi: !!c.querySelector('.card-upload-input'),
        draft: !!(dc && dc.charAvatar === '${P2SRC}'), toast: window.__toast() };
    })()`);
    ok('P4c 双击 tile：charAvatar 补上 probe2 图 + fi 覆盖层保留 + 草稿立即含（零心跳）',
      p4c.avatarSet === true && p4c.fi === true && p4c.draft === true, JSON.stringify(p4c));

    // ── P7 两处建标签（元数据弹窗 + 标签管理） ──
    await cdp.evalJs(`window.openImgMetaModal('${u1}', 'probe1', function(){ return true; }); window.imgMetaOpenTagCreate();`);
    await cdp.evalJs("document.getElementById('immTagOrig').value='皇室'; document.getElementById('immTagEn').value='Royal'; window.imgMetaSubmitTagCreate();");
    await waitFor(cdp, "window.__tags().filter(function(x){ return !x.sys; }).length === 1", 15000, 'P7a 远端降级直建');
    const p7a = await cdp.evalJs("(function(){ var t = window.__tags().filter(function(x){ return !x.sys; })[0]; return { orig: t && t.original, en: t && t.enName }; })()");
    ok('P7a 元数据弹窗建标签：皇室 · Royal 入 store', p7a.orig === '皇室' && p7a.en === 'Royal', JSON.stringify(p7a));
    await cdp.evalJs("window.imgMetaCancel(); window.closeImgMetaModalCancel();");
    await cdp.evalJs("window.openTagManage(); window.tagManageOpenCreate();");
    await cdp.evalJs("document.getElementById('tagManageOrig').value='城邦'; document.getElementById('tagManageEn').value='CityState'; document.getElementById('tagManageCreate').querySelector('.btn-primary').click();");
    await waitFor(cdp, "window.__tags().filter(function(x){ return !x.sys; }).length === 2", 15000, 'P7b 标签管理直建');
    const p7b = await cdp.evalJs("(function(){ var t = window.__tags().filter(function(x){ return !x.sys; }); var hit = t.filter(function(x){ return x.original === '城邦' && x.enName === 'CityState'; })[0]; return { n: t.length, hit: !!hit }; })()");
    ok('P7b 标签管理面板建标签：城邦 · CityState 入 store（两处都能建）', p7b.hit === true, JSON.stringify(p7b));

    ok('E1 全程零 Runtime exception + 零 console error', cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      JSON.stringify({ errs: cdp.errs.slice(0, 3), cons: cdp.consoleErrs.slice(0, 3) }));

    // 收尾：清草稿/图库/标签键（一次性 profile 内零污染）
    await cdp.evalJs("localStorage.removeItem('slati_fluidcanvas_draft'); localStorage.removeItem('slati_img_library'); localStorage.removeItem('slati_img_tags');");
    cdp.close();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  try { chrome.kill(); } catch (e) {}
  console.log('');
  console.log(FAIL.n === 0 ? '🎉 全部通过 ' + PASS.n + '/' + PASS.n : '💔 失败 ' + FAIL.n + ' / 共 ' + (PASS.n + FAIL.n));
  process.exit(FAIL.n === 0 ? 0 : 1);
})();
