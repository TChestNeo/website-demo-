// tmp-battery-fc-uploadsave.js — FC v10.28.48.0 上传图片落地即存草稿电池
// 用户「还有为什么我上传的图片需要自己按保存？上传就上传了怎么会不见？？」
// 验证：F 静态锚（site-config 45.2/00348-/58.0 恒 + 上传即存锚在源 + 指纹摘要锚在源）
//   / U 上传段（桌面 CDP + 真实 FileReader/DataTransfer 上传链）：
//         U1 头像上传→元数据弹窗保存→localStorage 草稿立即含 charAvatar（零心跳等待）
//         U2 silent 静默：imgMetaSave 只弹「头像已上传」无「草稿已保存」；手动 saveDraft() 才弹
//         U3 图库持久库同写（slati_img_library 含 src+名）
//         U4 指纹缺口：同文件名换图 getCardFingerprint 前后不同 + autoSave() 立即落新图
//         U5 地图卡上传同样立即落草稿
//         U6 取消元数据弹窗=零写入（草稿逐字节不变、卡 dataset 零残留）
//   / E 全程零异常零 console error
// （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-uplsave-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
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

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

(async () => {
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
    // ── F 静态锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text();
    ok('F1 site-config：FC v10.28.48.0 + rev 00348- 占位 + 站点版本恒 v0.2.58.28',
      siteCfg.indexOf('v10.28.62.5') !== -1 && siteCfg.indexOf('00348-') !== -1 && siteCfg.indexOf('v0.2.58.28') !== -1);
    ok('F2 上传落地即存锚在源：imgMetaSave 后 saveDraft(true) + saveDraft(silent) 签名 + silent 压成功 toast',
      editorHtml.indexOf('上传落地即存（用户「上传就上传了怎么会不见」') !== -1 &&
      editorHtml.indexOf('function saveDraft(silent)') !== -1 &&
      editorHtml.indexOf('if (!silent) showToast(T(\'fc.toast.draftSaved\')') !== -1);
    ok('F3 指纹摘要锚在源：charAvatar/mapImg dataURL length+tail 摘要（同文件名换图脏守卫可见）',
      editorHtml.indexOf("av ? 'av:' + av.length") !== -1 &&
      editorHtml.indexOf("mi ? 'map:' + mi.length") !== -1);

    // ── 桌面段 ──
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
    await waitFor(cdp, "!!window.MN_I18N && !!document.getElementById('gridCanvas') && !!window.imgMetaSave && !!window.getCardFingerprint", 30000, '编辑器加载');
    await sleep(800);

    // 页内工具：读当前 toast（#toast 单元素 textContent=末次 toast——imgMetaSave 的
    // 头像 toast 在后、silent saveDraft 在前，静默守卫若破会被「草稿已保存」覆盖文本）
    // + 合成图片上传 + 读草稿
    await cdp.evalJs("window.__toast = function () { var t = document.getElementById('toast'); return t ? t.textContent : ''; };");
    await cdp.evalJs(`(function(){
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
      window.__draftStr = function () { return localStorage.getItem('slati_fluidcanvas_draft'); };
    })()`);

    const metaOpen = "!!document.getElementById('imgMetaModal') && !!document.querySelector('#imgMetaModal .modal-card.active')";
    const metaClosed = "!document.querySelector('#imgMetaModal .modal-card.active')";

    // ── U1+U2+U3 头像上传链 ──
    await cdp.evalJs("window.__upCard = window.createCharacterCard(1, 1, 4, 5);");
    const u1 = await cdp.evalJs("window.__mkImg('person1.png', '#e33', '#fff')");
    await waitFor(cdp, metaOpen, 8000, 'U1 元数据弹窗打开');
    await cdp.evalJs("window.imgMetaSave()");
    await waitFor(cdp, metaClosed, 4000, 'U1 元数据弹窗关闭');
    const u1r = await cdp.evalJs(`(function(){
      var card = window.__upCard; var d = window.__draft();
      var c = d && d.cards ? d.cards.filter(function (x) { return x.type === 'character'; })[0] : null;
      var lib = []; try { lib = JSON.parse(localStorage.getItem('slati_img_library') || '[]'); } catch (e) {}
      var li = lib.filter(function (x) { return x.src === card.dataset.charAvatar; })[0];
      return { avatarSet: card.dataset.charAvatar === ${JSON.stringify('__U1__')},
        draftHas: !!(c && c.charAvatar === card.dataset.charAvatar),
        libHas: !!(li && li.name === 'person1'),
        toast: window.__toast() };
    })()`.replace('__U1__', u1));
    ok('U1 头像上传→弹窗保存→草稿立即含 charAvatar（零心跳等待）',
      u1r.avatarSet === true && u1r.draftHas === true, JSON.stringify(u1r));
    ok('U2 silent 静默：imgMetaSave 末次 toast 是「头像已上传」而非「草稿已保存」',
      u1r.toast.indexOf('头像已上传') !== -1 && u1r.toast.indexOf('草稿已保存') === -1, JSON.stringify(u1r.toast));
    ok('U3 图库持久库同写：slati_img_library 含同 src + 名称 person1',
      u1r.libHas === true, JSON.stringify(u1r));
    await cdp.evalJs("window.saveDraft()");
    const u2r = await cdp.evalJs("window.__toast()");
    ok('U2b 手动 saveDraft() 仍弹「草稿已保存」',
      u2r.indexOf('草稿已保存') !== -1, JSON.stringify(u2r));

    // ── U4 指纹缺口：同文件名换图 → 脏守卫可见 → autoSave 立即落新图 ──
    // 真身：v10.28.28 保存才落地——change 只开弹窗、dataset 只在 imgMetaSave apply 里写。
    // 缺口场景 = 图像 dataURL 已变而未随 saveDraft 落盘（老草稿载入/其他路径），心跳守卫
    // 只看元数据会把「换图」当「无变化」跳过。直写 dataset 模拟该态（不 dispatch change，
    // 否则弹窗挂着干扰后续 U5）。新代码摘要 av: length+tail → 指纹变 → autoSave 落新图。
    const u4a = await cdp.evalJs(`(function(){
      var card = window.__upCard;
      var fp1 = window.getCardFingerprint();
      var cv = document.createElement('canvas'); cv.width = 8; cv.height = 6;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#3e3'; ctx.fillRect(0, 0, 8, 6);
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 4, 6);
      var url2 = cv.toDataURL('image/png');
      card.dataset.charAvatar = url2; // 同名同元数据、仅图像字节变
      card.querySelector('.char-avatar').style.backgroundImage = 'url("' + url2 + '")';
      var fp2 = window.getCardFingerprint();
      return { fp1: fp1, fp2: fp2, url2: url2, avatarNow: card.dataset.charAvatar === url2,
        hasAvDigest: fp2.indexOf('av:' + url2.length + ':' + url2.slice(-24)) !== -1 };
    })()`);
    ok('U4 同文件名换图：指纹前后不同（旧口径只有元数据=假无变化）+ 摘要 av:length:tail 精确在场',
      u4a.fp1 !== u4a.fp2 && u4a.hasAvDigest === true && u4a.avatarNow === true, JSON.stringify({ d: u4a.fp1 !== u4a.fp2, dig: u4a.hasAvDigest }));
    await cdp.evalJs("window.autoSave()");
    const u4b = await cdp.evalJs(`(function(){
      var d = window.__draft();
      var c = d && d.cards ? d.cards.filter(function (x) { return x.type === 'character'; })[0] : null;
      return { draftIsNew: !!(c && c.charAvatar === ${JSON.stringify('__U4__')}) };
    })()`.replace('__U4__', u4a.url2));
    ok('U4b autoSave() 脏守卫放行：草稿落新图（旧代码守卫会跳过 → 刷新回旧图）',
      u4b.draftIsNew === true, JSON.stringify(u4b));

    // ── U5 地图卡上传链 ──
    await cdp.evalJs("window.__upCard = window.createMapCard(6, 1, 8, 6);");
    const u5 = await cdp.evalJs("window.__mkImg('map1.png', '#46e', '#fff')");
    await waitFor(cdp, metaOpen, 8000, 'U5 元数据弹窗打开');
    await cdp.evalJs("window.imgMetaSave()");
    await waitFor(cdp, metaClosed, 4000, 'U5 元数据弹窗关闭');
    const u5r = await cdp.evalJs(`(function(){
      var card = window.__upCard; var d = window.__draft();
      var c = d && d.cards ? d.cards.filter(function (x) { return x.type === 'map'; })[0] : null;
      return { mapSet: card.dataset.mapImg === ${JSON.stringify('__U5__')},
        draftHas: !!(c && c.mapImg === card.dataset.mapImg) };
    })()`.replace('__U5__', u5));
    ok('U5 地图卡上传→弹窗保存→草稿立即含 mapImg', u5r.mapSet === true && u5r.draftHas === true, JSON.stringify(u5r));

    // ── U6 取消元数据弹窗 = 零写入 ──
    await cdp.evalJs("window.__upCard = window.createCharacterCard(12, 1, 4, 5); window.__u6s = localStorage.getItem('slati_fluidcanvas_draft');");
    await cdp.evalJs("window.__mkImg('cancel1.png', '#f3f', '#000')");
    await waitFor(cdp, metaOpen, 8000, 'U6 元数据弹窗打开');
    await cdp.evalJs("window.imgMetaCancel(); window.closeImgMetaModalCancel();");
    await sleep(300);
    const u6r = await cdp.evalJs("(function(){ return { same: localStorage.getItem('slati_fluidcanvas_draft') === window.__u6s, noAvatar: !window.__upCard.dataset.charAvatar }; })()");
    ok('U6 取消元数据弹窗=零写入：草稿逐字节不变 + 卡 dataset 零残留',
      u6r.same === true && u6r.noAvatar === true, JSON.stringify(u6r));

    ok('E1 全程零 Runtime.exceptionThrown', cdp.errs.length === 0, JSON.stringify(cdp.errs.slice(0, 3)));
    ok('E2 全程零 console error', cdp.consoleErrs.length === 0, JSON.stringify(cdp.consoleErrs.slice(0, 3)));
    cdp.close();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  try { chrome.kill(); } catch (e) {}
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS + '  (fc-uploadsave)' : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(FAIL === 0 ? 0 : 1);
})();
