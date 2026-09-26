// tmp-probe-fc-uploadsave.js — FC v10.28.47.4 上传图片落地即存草稿 上线实机探针
// 用户「还有为什么我上传的图片需要自己按保存？上传就上传了怎么会不见？？」
//   S 静态（线上 site-config 45.2 + rev 00317- 前缀 + 站点 58.0 恒、编辑器页上传即存/静默/silent 签名/指纹摘要锚）
//   P 实机（桌面 CDP + 一次性临时 profile）：P1 头像上传→弹窗保存→草稿 localStorage 立即含
//     charAvatar（零心跳等待）｜P2 静默：末次 toast=头像已上传非草稿已保存｜P3 图库同写｜
//     P4 同文件名换图指纹前后不同 + av: 摘要｜P5 autoSave 脏守卫放行落新图｜P6 地图卡同链｜
//     P7 取消弹窗零写入｜E1 零异常零 console error。
// 探针纪律：一次性 user-data-dir（与用户真实 profile 隔离）+ 收尾清草稿/图库键——零草稿污染。
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
const get = (url) => new Promise((resolve) => {
  const req = https.request(url, { headers: { 'User-Agent': 'mn-probe' }, timeout: 30000 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 2000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
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
  ok('S1 线上 site-config：FC v10.28.47.4 + rev 00317- 前缀 + 站点恒 v0.2.58.11',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sc.body.indexOf('rev 00317-') !== -1 && sc.body.indexOf('v0.2.58.11') !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const ed = await get(BASE + '/pages/fluidcanvas-editor.html');
  ok('S2 线上编辑器页：上传落地即存锚 + saveDraft(silent) 签名 + 静默压 toast 守卫 + 指纹 av:/map: 摘要锚在位',
    ed.status === 200 &&
    ed.body.indexOf('上传落地即存（用户「上传就上传了怎么会不见」') !== -1 &&
    ed.body.indexOf('function saveDraft(silent)') !== -1 &&
    ed.body.indexOf("if (!silent) showToast(T('fc.toast.draftSaved')") !== -1 &&
    ed.body.indexOf("av ? 'av:' + av.length") !== -1 &&
    ed.body.indexOf("mi ? 'map:' + mi.length") !== -1,
    'status=' + ed.status + ' err=' + ed.error);

  // ── P 实机（一次性 profile + 收尾清键） ──
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-uplsave-' + Date.now());
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
    await waitFor(cdp, "!!window.MN_I18N && !!document.getElementById('gridCanvas') && !!window.imgMetaSave && !!window.getCardFingerprint", 30000, 'P 编辑器加载');
    await sleep(800);

    await cdp.evalJs(`(function(){
      window.__toast = function () { var t = document.getElementById('toast'); return t ? t.textContent : ''; };
      window.__mkImg = function (name, colorA, colorB) {
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
        var fi = window.__upCard.querySelector('.card-upload-input');
        fi.files = dt.files;
        fi.dispatchEvent(new Event('change', { bubbles: true }));
        return url;
      };
      window.__draft = function () {
        try { return JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || 'null'); } catch (e) { return null; }
      };
    })()`);

    const metaOpen = "!!document.getElementById('imgMetaModal') && !!document.querySelector('#imgMetaModal .modal-card.active')";
    const metaClosed = "!document.querySelector('#imgMetaModal .modal-card.active')";

    // ── P1+P2+P3 头像上传链 ──
    await cdp.evalJs("window.__upCard = window.createCharacterCard(1, 1, 4, 5);");
    const u1 = await cdp.evalJs("window.__mkImg('person1.png', '#e33', '#fff')");
    await waitFor(cdp, metaOpen, 8000, 'P1 元数据弹窗打开');
    await cdp.evalJs("window.imgMetaSave()");
    await waitFor(cdp, metaClosed, 4000, 'P1 元数据弹窗关闭');
    const p1r = await cdp.evalJs(`(function(){
      var card = window.__upCard; var d = window.__draft();
      var c = d && d.cards ? d.cards.filter(function (x) { return x.type === 'character'; })[0] : null;
      var lib = []; try { lib = JSON.parse(localStorage.getItem('slati_img_library') || '[]'); } catch (e) {}
      var li = lib.filter(function (x) { return x.src === card.dataset.charAvatar; })[0];
      return { avatarSet: card.dataset.charAvatar === ${JSON.stringify('__U1__')},
        draftHas: !!(c && c.charAvatar === card.dataset.charAvatar),
        libHas: !!(li && li.name === 'person1'),
        toast: window.__toast() };
    })()`.replace('__U1__', u1));
    ok('P1 头像上传→弹窗保存→草稿 localStorage 立即含 charAvatar（零心跳等待）',
      p1r.avatarSet === true && p1r.draftHas === true, JSON.stringify(p1r));
    ok('P2 静默：末次 toast=头像已上传 非 草稿已保存',
      p1r.toast.indexOf('头像已上传') !== -1 && p1r.toast.indexOf('草稿已保存') === -1, JSON.stringify(p1r.toast));
    ok('P3 图库持久库同写（slati_img_library 含同 src + person1）',
      p1r.libHas === true, JSON.stringify(p1r));

    // ── P4+P5 指纹缺口：同文件名换图 → 脏守卫可见 → autoSave 落新图 ──
    const p4a = await cdp.evalJs(`(function(){
      var card = window.__upCard;
      var fp1 = window.getCardFingerprint();
      var cv = document.createElement('canvas'); cv.width = 8; cv.height = 6;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#3e3'; ctx.fillRect(0, 0, 8, 6);
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 4, 6);
      var url2 = cv.toDataURL('image/png');
      card.dataset.charAvatar = url2;
      card.querySelector('.char-avatar').style.backgroundImage = 'url("' + url2 + '")';
      var fp2 = window.getCardFingerprint();
      return { d: fp1 !== fp2, dig: fp2.indexOf('av:' + url2.length + ':' + url2.slice(-24)) !== -1, url2: url2 };
    })()`);
    ok('P4 同文件名换图：指纹前后不同 + 摘要 av:length:tail 精确在场', p4a.d === true && p4a.dig === true, JSON.stringify(p4a));
    await cdp.evalJs("window.autoSave()");
    const p5r = await cdp.evalJs(`(function(){
      var d = window.__draft();
      var c = d && d.cards ? d.cards.filter(function (x) { return x.type === 'character'; })[0] : null;
      return { draftIsNew: !!(c && c.charAvatar === ${JSON.stringify('__U4__')}) };
    })()`.replace('__U4__', p4a.url2));
    ok('P5 autoSave 脏守卫放行：草稿落新图（旧代码守卫会跳过）', p5r.draftIsNew === true, JSON.stringify(p5r));

    // ── P6 地图卡同链 ──
    await cdp.evalJs("window.__upCard = window.createMapCard(6, 1, 8, 6);");
    const u5 = await cdp.evalJs("window.__mkImg('map1.png', '#46e', '#fff')");
    await waitFor(cdp, metaOpen, 8000, 'P6 元数据弹窗打开');
    await cdp.evalJs("window.imgMetaSave()");
    await waitFor(cdp, metaClosed, 4000, 'P6 元数据弹窗关闭');
    const p6r = await cdp.evalJs(`(function(){
      var card = window.__upCard; var d = window.__draft();
      var c = d && d.cards ? d.cards.filter(function (x) { return x.type === 'map'; })[0] : null;
      return { mapSet: card.dataset.mapImg === ${JSON.stringify('__U5__')},
        draftHas: !!(c && c.mapImg === card.dataset.mapImg) };
    })()`.replace('__U5__', u5));
    ok('P6 地图卡上传→弹窗保存→草稿立即含 mapImg', p6r.mapSet === true && p6r.draftHas === true, JSON.stringify(p6r));

    // ── P7 取消弹窗零写入 ──
    await cdp.evalJs("window.__upCard = window.createCharacterCard(12, 1, 4, 5); window.__u7s = localStorage.getItem('slati_fluidcanvas_draft');");
    await cdp.evalJs("window.__mkImg('cancel1.png', '#f3f', '#000')");
    await waitFor(cdp, metaOpen, 8000, 'P7 元数据弹窗打开');
    await cdp.evalJs("window.imgMetaCancel(); window.closeImgMetaModalCancel();");
    await sleep(300);
    const p7r = await cdp.evalJs("(function(){ return { same: localStorage.getItem('slati_fluidcanvas_draft') === window.__u7s, noAvatar: !window.__upCard.dataset.charAvatar }; })()");
    ok('P7 取消元数据弹窗=零写入：草稿逐字节不变 + 卡 dataset 零残留',
      p7r.same === true && p7r.noAvatar === true, JSON.stringify(p7r));

    ok('E1 全程零 Runtime exception + 零 console error', cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      JSON.stringify({ errs: cdp.errs.slice(0, 3), cons: cdp.consoleErrs.slice(0, 3) }));

    // 收尾：清草稿/图库键（一次性 profile 内零污染，防万一给后续探针留态）
    await cdp.evalJs("localStorage.removeItem('slati_fluidcanvas_draft'); localStorage.removeItem('slati_img_library');");
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
