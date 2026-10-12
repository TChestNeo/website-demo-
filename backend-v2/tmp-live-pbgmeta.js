'use strict';
// 线上探针：v0.2.38.0 上传图片信息弹窗（pageBg 上传→meta→保存→刷新恢复；
// flag 上传→meta→双窗关；内联图 data-*；取消宿主弹窗保持；零 console error）
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const CDP_PORT = 6810 + Math.floor(Math.random() * 200);
const USER_DATA = path.join(os.tmpdir(), 'mn-live-pbgmeta-' + Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1600,1200', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try {
      const list = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
      target = list.find(t => t.type === 'page');
    } catch (e) {}
  }
  if (!target) { console.log('CDP 起不来'); process.exit(1); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  const errs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') errs.push(String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 200));
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) throw new Error('evalJs: ' + (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text));
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('Network.enable');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
  });
  await send('Page.navigate', { url: 'https://mnationworld.com/pages/fluidcanvas-editor.html' });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try { if (await evalJs("typeof window.openPageBgModal === 'function' && typeof window.openImgMetaModal === 'function'") === true) break; } catch (e) {}
    if (i === 119) { console.log('线上编辑器未就绪; errs=', JSON.stringify(errs)); process.exit(1); }
  }
  await sleep(800);

  const r = await evalJs(`(async function(){
    var wait = function(ms){ return new Promise(function(r2){ setTimeout(r2, ms); }); };
    var upFile = function(inputExpr, color, w, h, name){ return new Promise(function(res){
      var el = typeof inputExpr === 'string' ? document.querySelector(inputExpr) : inputExpr;
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var cx = cv.getContext('2d'); cx.fillStyle = color; cx.fillRect(0, 0, w, h);
      cv.toBlob(function(blob){ var file = new File([blob], name, { type: 'image/png' });
        var dt = new DataTransfer(); dt.items.add(file);
        el.files = dt.files; el.dispatchEvent(new Event('change', { bubbles: true })); res(true); }, 'image/png');
    }); };
    var metaOpen = function(){ var m = document.getElementById('imgMetaModal'); return !!(m && m.querySelector('.modal-card').classList.contains('active')); };
    var fill = function(name, desc, vis){ document.getElementById('immName').value = name;
      document.getElementById('immDesc').value = desc; window.imgMetaRefreshCount();
      if (vis) window.imgMetaSetVisibility(vis); };
    // ── pageBg：上传 → meta 弹窗 → 填元数据 → 保存（宿主弹窗保持）→ 保存背景 ──
    window.openPageBgModal();
    await upFile('#pageBgFileInput', 'rgb(200,0,0)', 1600, 900, 'red.png');
    for (var k = 0; k < 40 && !metaOpen(); k++) await wait(250);
    var stacked = metaOpen() && document.getElementById('pageBgModal').querySelector('.modal-card').classList.contains('active');
    fill('红色背景', '背景 红色', 'team');
    window.imgMetaSave();
    await wait(300);
    var afterMeta = !metaOpen() && document.getElementById('pageBgModal').querySelector('.modal-card').classList.contains('active');
    var nameRow = document.querySelector('.pbg-list-item .pbg-name') ? document.querySelector('.pbg-list-item .pbg-name').textContent : '';
    window.closePageBgModal();
    await wait(300);
    var bgOn = gridCanvas.classList.contains('has-page-bg');
    window.saveDraft(); await wait(600); // v0.2.40.0 周期制：显式存（云端 PUT 火忘，恢复段有轮询）
    var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}');
    var im = d.pageBg && d.pageBg.imgs && d.pageBg.imgs[0];
    var draftMeta = { has: !!(d.pageBg && d.pageBg.imgs && d.pageBg.imgs.length === 1),
      name: im ? im.name : null, desc: im ? im.desc : null, vis: im ? im.visibility : null };
    // ── flag：上传 → meta → 保存（双窗全关） ──
    var fc = window.createFlagCard('测试旗帜', 0, 12, 8, 5);
    window.setCurrentFlagCard(fc);
    window.openFlagSourceModal();
    await upFile('#flagFileInput', 'rgb(0,128,0)', 800, 500, 'my-flag.png');
    for (var k2 = 0; k2 < 40 && !metaOpen(); k2++) await wait(250);
    fill('我的国旗', '描述 词', 'public');
    window.imgMetaSave();
    await wait(300);
    var flagClosed = !metaOpen() && !document.getElementById('flagSourceModal').querySelector('.modal-card').classList.contains('active');
    var flagMeta = { imgName: fc.dataset.imgName, imgDesc: fc.dataset.imgDesc, imgVis: fc.dataset.imgVisibility,
      label: fc.dataset.label, hasImg: !!fc.querySelector('.card-img-bg'), labelVal: fc.querySelector('.card-label').value };
    // ── 内联图：光标 → tt 弹层上传 → meta → data-* ──
    var cc = window.createContentCard(0, 22, 8, 4);
    var txc = cc.querySelector('.card-text-content');
    txc.textContent = 'Hello world';
    var rg = document.createRange(); rg.setStart(txc.firstChild, 1); rg.collapse(true);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rg); txc.focus();
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await wait(300);
    document.getElementById('ttImgBtn').click();
    await wait(300);
    document.querySelector('#ttImgGrid .tim-tile.tim-upload').click();
    await upFile('#ttInlineFileInput', 'rgb(0,0,255)', 1, 1, 'inline.png');
    for (var k3 = 0; k3 < 40 && !metaOpen(); k3++) await wait(250);
    fill('内联图', 'desc1', 'public');
    window.imgMetaSave();
    await wait(300);
    var inl = document.querySelector('.grid-card[data-card-type="content"] .card-text-content img.tt-inline-img');
    var inlMeta = inl ? { name: inl.dataset.imgName, desc: inl.dataset.imgDesc, vis: inl.dataset.imgVisibility, alt: inl.alt } : null;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // ── 取消：pageBg 再上传 → meta 取消 → 宿主弹窗保持 ──
    window.openPageBgModal();
    await wait(200);
    await upFile('#pageBgFileInput', 'rgb(0,0,255)', 1600, 900, 'blue.png');
    for (var k4 = 0; k4 < 40 && !metaOpen(); k4++) await wait(250);
    window.closeImgMetaModalCancel();
    await wait(200);
    var cancelKeep = !metaOpen() && document.getElementById('pageBgModal').querySelector('.modal-card').classList.contains('active');
    window.closePageBgModalCancel();
    window.saveDraft();  // flag/内联图在 autosave 等待之后才创建——显式落草稿再重载
    await wait(300);
    return JSON.stringify({ stacked: stacked, afterMeta: afterMeta, nameRow: nameRow, bgOn: bgOn,
      draftMeta: draftMeta, flagClosed: flagClosed, flagMeta: flagMeta, inlMeta: inlMeta, cancelKeep: cancelKeep,
      ver: window.FLUIDCANVAS_VERSION, mn: window.MN_SITE_VERSION });
  })()`);
  console.log('live-save =', r);
  const d1 = JSON.parse(r);

  // ── 刷新恢复 ──
  await send('Page.reload', {});
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try { if (await evalJs("typeof window.openPageBgModal === 'function'") === true) break; } catch (e) {}
  }
  let restored = false;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try { if (await evalJs("gridCanvas.classList.contains('has-page-bg')") === true) { restored = true; break; } } catch (e) {}
  }
  const r2 = await evalJs(`(async function(){
    var wait = function(ms){ return new Promise(function(r2){ setTimeout(r2, ms); }); };
    window.openPageBgModal();
    await wait(300);
    var nameRow = document.querySelector('.pbg-list-item .pbg-name') ? document.querySelector('.pbg-list-item .pbg-name').textContent : '';
    // 编辑钮回填
    document.querySelector('.pbg-edit').click();
    await wait(300);
    var edit = { name: document.getElementById('immName').value, count: document.getElementById('immCount').textContent,
      vis: (document.querySelector('#immSeg .segmented-option.active') || { dataset: {} }).dataset.vis };
    window.closeImgMetaModalCancel();
    await wait(200);
    window.closePageBgModalCancel();
    var fc = document.querySelector('.grid-card[data-card-type="flag"][data-label="我的国旗"]');
    var flagRestored = fc ? { imgName: fc.dataset.imgName, imgDesc: fc.dataset.imgDesc, imgVis: fc.dataset.imgVisibility } : null;
    var inl = document.querySelector('.grid-card[data-card-type="content"] .card-text-content img.tt-inline-img');
    var inlRestored = inl ? { name: inl.dataset.imgName, desc: inl.dataset.imgDesc, vis: inl.dataset.imgVisibility, alt: inl.alt } : null;
    return JSON.stringify({ nameRow: nameRow, edit: edit, flagRestored: flagRestored, inlRestored: inlRestored,
      restored: ${restored}, ver: window.FLUIDCANVAS_VERSION });
  })()`);
  const d2 = JSON.parse(r2);
  console.log('live-reload =', r2);
  console.log('pageErrs =', JSON.stringify(errs));
  try { ws.close(); } catch (e) {}
  try { chrome.kill(); } catch (e) {}
  const all =
    d1.stacked && d1.afterMeta && d1.nameRow === '红色背景' && d1.bgOn &&
    d1.draftMeta.has && d1.draftMeta.name === '红色背景' && d1.draftMeta.desc === '背景 红色' && d1.draftMeta.vis === 'team' &&
    d1.flagClosed && d1.flagMeta.imgName === '我的国旗' && d1.flagMeta.imgDesc === '描述 词' && d1.flagMeta.imgVis === 'public' &&
    d1.flagMeta.label === '我的国旗' && d1.flagMeta.hasImg && d1.flagMeta.labelVal === '我的国旗' &&
    d1.inlMeta && d1.inlMeta.name === '内联图' && d1.inlMeta.desc === 'desc1' && d1.inlMeta.vis === 'public' && d1.inlMeta.alt === '内联图' &&
    d1.cancelKeep && d1.ver === 'v10.28.28.0' && d1.mn === 'v0.2.38.0' &&
    d2.restored && d2.nameRow === '红色背景' &&
    d2.edit.name === '红色背景' && d2.edit.count === '2 / 320' && d2.edit.vis === 'team' &&
    d2.flagRestored && d2.flagRestored.imgName === '我的国旗' && d2.flagRestored.imgDesc === '描述 词' && d2.flagRestored.imgVis === 'public' &&
    d2.inlRestored && d2.inlRestored.name === '内联图' && d2.inlRestored.desc === 'desc1' && d2.inlRestored.vis === 'public' &&
    d2.ver === 'v10.28.28.0' && errs.length === 0;
  console.log(all ? '线上电池: PASS ✅' : '线上电池: FAIL ❌');
  process.exit(all ? 0 : 1);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
