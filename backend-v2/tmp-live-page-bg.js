'use strict';
// 线上探针：v0.2.37.0 自定义页面背景（上传 3 张→拖序→虚化→7 比例→保存→刷新恢复→撤销/重做→移除）
// 同 tmp-live-shapes.js 骨架；合成断言用 renderPageBgComposite 解码像素（截图全黑纪律）
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const CDP_PORT = 6810 + Math.floor(Math.random() * 200);
const USER_DATA = path.join(os.tmpdir(), 'mn-live-pbg-' + Date.now());
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
  let putWithPageBg = false;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') errs.push(String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 200));
    if (m.method === 'Network.requestWillBeSent') {
      const r = m.params.request || {};
      // 仅供参考：fcCloudMode 仅对真登录云用户（probe 成功 + USR- 用户）开——
      // 本电池假 session 过不了门禁，PUT 必然不发；载荷含 pageBg 由
      // buildDraft 保证（本地电池 F4）。不作通过条件。
      if (r.method === 'PUT' && r.postData && r.postData.indexOf('pageBg') !== -1) putWithPageBg = true;
    }
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
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
  });
  await send('Page.navigate', { url: 'https://mnationworld.com/pages/fluidcanvas-editor.html' });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try { if (await evalJs("typeof window.openPageBgModal === 'function'")) break; } catch (e) {}
    if (i === 119) { console.log('线上编辑器未就绪; errs=', JSON.stringify(errs)); process.exit(1); }
  }
  await sleep(800);

  const r = await evalJs(`(async function(){
    var wait = function(ms){ return new Promise(function(r2){ setTimeout(r2, ms); }); };
    var upload = function(color, w, h, name){ return new Promise(function(res){
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var cx = cv.getContext('2d'); cx.fillStyle = color; cx.fillRect(0, 0, w, h);
      cv.toBlob(function(blob){ var file = new File([blob], name, { type: 'image/png' });
        var dt = new DataTransfer(); dt.items.add(file);
        var input = document.getElementById('pageBgFileInput');
        input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); res(true); }, 'image/png');
    }); };
    var items = function(){ return Array.prototype.map.call(document.querySelectorAll('.pbg-list-item'), function(li){ return li.dataset.pbgId; }); };
    window.openPageBgModal();
    await upload('rgb(255,0,0)', 1600, 900, 'red.png');
    await wait(600); var n1 = items().length;
    await upload('rgb(0,0,255)', 1600, 900, 'blue.png');
    await wait(600); var n2 = items().length;
    await upload('rgb(0,255,0)', 1600, 900, 'green.png');
    await wait(600); var n3 = items().length;
    // 拖序：绿(bg3) 拖到最顶
    var lis = document.querySelectorAll('.pbg-list-item');
    var dt = new DataTransfer();
    lis[2].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    var rt = lis[0].getBoundingClientRect();
    lis[0].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rt.top + 1, dataTransfer: dt }));
    lis[2].dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    await wait(200); var order = items();
    // 重排后顶图仍带非首图默认虚化 {top:80}——顶部采样点混底色致 topGreen:false；
    // 断言前清零顶图顶边，采样确定全绿
    window.pbgSetFeather(order[0], 'top', 0);
    await wait(300);
    // 虚化：第 2 张（红）上边缘 150
    var id2 = order[1];
    window.pbgSetFeather(id2, 'top', 150);
    await wait(300);
    // 7 比例逐个切
    var ratios = ['1.6','2.222','1.778','2.333','0.714','1.333','1'];
    var ratioOk = true;
    var frame = document.getElementById('pbgFrame');
    for (var k = 0; k < ratios.length; k++) { window.pbgSetRatio(ratios[k], null); if (frame.style.aspectRatio.replace(/\\s+/g,'') !== ratios[k] + '/1') ratioOk = false; }
    window.pbgSetRatio('1.778', null);
    // 保存
    window.closePageBgModal();
    await wait(300);
    var saved = { bg: gridCanvas.style.backgroundImage.indexOf('data:image/jpeg') !== -1,
      cls: gridCanvas.classList.contains('has-page-bg'),
      entry: document.getElementById('pageBgEntryState').textContent,
      minH: parseInt(gridCanvas.style.minHeight) || 0, offH: gridCanvas.offsetHeight,
      ratioOk: ratioOk, n3: n3 };
    // 合成顶≈绿（绿在顶）
    var c = window.renderPageBgComposite();
    var img = new Image();
    await new Promise(function(res2){ img.onload = res2; img.src = c.dataURL; });
    var cv2 = document.createElement('canvas'); cv2.width = c.w; cv2.height = c.h;
    var cx2 = cv2.getContext('2d'); cx2.drawImage(img, 0, 0);
    var top = cx2.getImageData(800, 40, 1, 1).data;
    // v0.2.40.0 周期制：不等防抖，显式 saveDraft（云端 PUT 火忘，恢复段有轮询）
    window.saveDraft();
    await wait(600);
    var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}');
    return JSON.stringify({ n1: n1, n2: n2, n3: n3, order: order, saved: saved,
      topGreen: top[1] > 200 && top[0] < 60, compH: c.h,
      draftHas: (d.pageBg || { imgs: [] }).imgs.length === 3,
      draftRaw: d.pageBg ? 'pb:' + d.pageBg.imgs.length : 'no-pageBg',
      ver: window.FLUIDCANVAS_VERSION, errs: 0 });
  })()`);
  console.log('live-save =', r, 'putWithPageBg =', putWithPageBg);

  // 刷新恢复
  await send('Page.reload', {});
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try { if (await evalJs("typeof window.openPageBgModal === 'function'")) break; } catch (e) {}
  }
  let restored = false;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try { if (await evalJs("gridCanvas.classList.contains('has-page-bg')")) { restored = true; break; } } catch (e) {}
  }
  const r2 = await evalJs(`(async function(){
    var entry = document.getElementById('pageBgEntryState').textContent;
    // 刷新后撤销栈为空（基线在初始化时拍）——先移除（commit 快照）再撤销/重做
    window.confirm = function(){ return true; };
    window.pbgRemoveAll();
    await new Promise(function(r2){ setTimeout(r2, 800); });
    var removed = !gridCanvas.classList.contains('has-page-bg') && document.getElementById('pageBgEntryState').textContent === '未设置';
    window.historyUndoAction();
    await new Promise(function(r2){ setTimeout(r2, 800); });
    var undone = gridCanvas.classList.contains('has-page-bg');
    window.historyRedoAction();
    await new Promise(function(r2){ setTimeout(r2, 800); });
    var redone = !gridCanvas.classList.contains('has-page-bg');
    return JSON.stringify({ entry: entry, undone: undone, redone: redone, removed: removed, restored: ${restored}, ver: window.FLUIDCANVAS_VERSION });
  })()`);

  const d1 = JSON.parse(r), d2 = JSON.parse(r2);
  console.log('live-reload =', r2);
  console.log('pageErrs =', JSON.stringify(errs));
  try { ws.close(); } catch (e) {}
  try { chrome.kill(); } catch (e) {}
  const all = d1.n1 === 1 && d1.n2 === 2 && d1.n3 === 3 && d1.order.join(',') === 'bg3,bg1,bg2' &&
    d1.saved.bg && d1.saved.cls && d1.saved.entry === '3 张' && d1.saved.minH > 0 && d1.saved.offH >= d1.saved.minH &&
    d1.saved.ratioOk && d1.topGreen && d1.draftHas && d1.ver === 'v10.28.27.0' &&
    d2.restored && d2.entry === '3 张' && d2.undone && d2.redone && d2.removed &&
    d2.ver === 'v10.28.27.0' && errs.length === 0;
  console.log(all ? '线上电池: PASS ✅' : '线上电池: FAIL ❌' + ' putWithPageBg=' + putWithPageBg);
  process.exit(all ? 0 : 1);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
