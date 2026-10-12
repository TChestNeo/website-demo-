'use strict';
// 线上电池：v0.2.40.0 我的图库（全部页签零样本旗→flag 上传→browser 我的图库搜到→插入卡 B→铅笔改 meta 双卡同步→
// 垃圾桶删除双卡移除+confirm 报 2 处→空态；版本号；零 console error）
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const CDP_PORT = 7300 + Math.floor(Math.random() * 200);
const USER_DATA = path.join(os.tmpdir(), 'mn-live-imglib-' + Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
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
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
  });
  await send('Page.navigate', { url: 'https://mnationworld.com/pages/fluidcanvas-editor.html' });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try { if (await evalJs("typeof window.openFlagBrowser === 'function' && typeof window.editLibImg === 'function' && typeof window.delLibImg === 'function'") === true) break; }
    catch (e) {}
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
    var tileClick = function(name, btnSel){
      var tiles = document.querySelectorAll('#flagBrowserModal .flag-grid .flag-card-item');
      for (var i = 0; i < tiles.length; i++) {
        var nm = tiles[i].querySelector('.flag-name');
        if (nm && nm.textContent === name) {
          if (btnSel) tiles[i].querySelector(btnSel).click(); else tiles[i].click();
          return true;
        }
      }
      return false;
    };
    var search = function(q){ var inp = document.getElementById('flagSearchInput');
      inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true })); };
    // ── 0. 样本旗撤除回归：全新画布「全部」页签零格+空态 ──
    window.openFlagBrowser();
    await wait(300);
    var allTiles = document.querySelectorAll('#flagBrowserModal .flag-grid .flag-card-item').length;
    var allEmpty = document.getElementById('flagBrowserModal').innerText.indexOf('还没有上传过图片') !== -1;
    window.closeAllModals();
    // ── 1. flag 卡 A 上传（走 flagSource 弹窗 → meta → 双窗关） ──
    var fa = window.createFlagCard('测试旗帜', 0, 12, 8, 5);
    window.setCurrentFlagCard(fa);
    window.openFlagSourceModal();
    await upFile('#flagFileInput', 'rgb(200,0,0)', 800, 500, 'my-flag.png');
    for (var k = 0; k < 40 && !metaOpen(); k++) await wait(250);
    fill('我的国旗', '描述 词', 'public');
    window.imgMetaSave();
    await wait(300);
    var aUploaded = !!fa.querySelector('.card-img-bg') && fa.dataset.imgName === '我的国旗' &&
      fa.dataset.imgDesc === '描述 词' && fa.dataset.imgVisibility === 'public';
    // ── 2. browser 我的图库：按名称搜到 → 按描述搜到 ──
    window.openFlagBrowser(); window.switchFlagTab('mylib');
    await wait(300);
    search('我的国旗');
    await wait(300);
    var foundName = false; var items = document.querySelectorAll('#flagBrowserModal .flag-grid .flag-card-item');
    for (var i2 = 0; i2 < items.length; i2++) {
      var nm2 = items[i2].querySelector('.flag-name');
      if (nm2 && nm2.textContent === '我的国旗') { foundName = true; break; }
    }
    search('描述');
    await wait(300);
    var foundDesc = false; items = document.querySelectorAll('#flagBrowserModal .flag-grid .flag-card-item');
    for (var i3 = 0; i3 < items.length; i3++) {
      var nm3 = items[i3].querySelector('.flag-name');
      if (nm3 && nm3.textContent === '我的国旗') { foundDesc = true; break; }
    }
    search('');
    await wait(300);
    // ── 3. 点格选中 → Confirm → 卡 B 插入 ──
    var fb = window.createFlagCard('第二旗', 0, 14, 8, 5);
    window.setCurrentFlagCard(fb);
    tileClick('我的国旗', null);
    await wait(200);
    var selText = document.getElementById('flagSelectCount') ? document.getElementById('flagSelectCount').textContent : '';
    window.confirmFlagSelection();
    await wait(400);
    var bInserted = !!fb.querySelector('.card-img-bg') && fb.dataset.imgName === '我的国旗' &&
      fb.dataset.imgDesc === '描述 词' && fb.dataset.imgVisibility === 'public' && fb.dataset.label === '我的国旗';
    var browserClosed = !document.getElementById('flagBrowserModal').querySelector('.modal-card').classList.contains('active');
    // ── 4. 铅笔：meta 叠 browser + 回填 → 改名保存 → 双卡同步、label 不动、browser 保持 ──
    window.openFlagBrowser(); window.switchFlagTab('mylib');
    await wait(300);
    tileClick('我的国旗', '.lib-edit');
    await wait(300);
    var stacked = metaOpen() && document.getElementById('flagBrowserModal').querySelector('.modal-card').classList.contains('active');
    var initial = { name: document.getElementById('immName').value, desc: document.getElementById('immDesc').value,
      vis: (document.querySelector('#immSeg .segmented-option.active') || { dataset: {} }).dataset.vis };
    fill('改名的旗', '新描述 词', 'team');
    window.imgMetaSave();
    await wait(300);
    var browserKept = !metaOpen() && document.getElementById('flagBrowserModal').querySelector('.modal-card').classList.contains('active');
    var synced = fa.dataset.imgName === '改名的旗' && fa.dataset.imgDesc === '新描述 词' && fa.dataset.imgVisibility === 'team' &&
      fb.dataset.imgName === '改名的旗' && fb.dataset.imgDesc === '新描述 词' && fb.dataset.imgVisibility === 'team';
    var labelKept = fb.dataset.label === '我的国旗' && fa.dataset.label === '我的国旗';
    // ── 5. 垃圾桶：confirm 报 2 处 → 双卡图摘、icon 恢复、空态 ──
    var confirms = []; window.confirm = function(m){ confirms.push(m); return true; };
    tileClick('改名的旗', '.lib-del');
    await wait(400);
    var removed = !fa.querySelector('.card-img-bg') && !fb.querySelector('.card-img-bg') &&
      fa.dataset.imgName === undefined && fb.dataset.imgName === undefined;
    var iconBack = fa.querySelector('.card-icon') && fa.querySelector('.card-icon').style.display !== 'none';
    var emptyText = document.getElementById('flagBrowserModal').innerText.indexOf('还没有上传过图片') !== -1;
    window.closeAllModals();
    return JSON.stringify({ allTiles: allTiles, allEmpty: allEmpty,
      aUploaded: aUploaded, foundName: foundName, foundDesc: foundDesc, selText: selText,
      bInserted: bInserted, browserClosed: browserClosed, stacked: stacked, initial: initial, browserKept: browserKept,
      synced: synced, labelKept: labelKept, confirms: confirms, removed: removed, iconBack: iconBack, emptyText: emptyText,
      ver: window.FLUIDCANVAS_VERSION, mn: window.MN_SITE_VERSION });
  })()`);
  console.log('live-imglib =', r);
  const d = JSON.parse(r);
  console.log('pageErrs =', JSON.stringify(errs));
  try { ws.close(); } catch (e) {}
  try { chrome.kill(); } catch (e) {}
  const all =
    d.allTiles === 0 && d.allEmpty &&
    d.aUploaded &&
    d.foundName && d.foundDesc && d.selText === '已选：我的国旗' &&
    d.bInserted && d.browserClosed &&
    d.stacked && d.initial.name === '我的国旗' && d.initial.desc === '描述 词' && d.initial.vis === 'public' &&
    d.browserKept && d.synced && d.labelKept &&
    d.confirms.some(function (m) { return m.indexOf('改名的旗') !== -1 && m.indexOf('2 处') !== -1; }) &&
    d.removed && d.iconBack && d.emptyText &&
    d.ver === 'v10.28.30.0' && d.mn === 'v0.2.40.0' &&
    errs.length === 0;
  console.log(all ? '线上电池: PASS ✅' : '线上电池: FAIL ❌');
  process.exit(all ? 0 : 1);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
