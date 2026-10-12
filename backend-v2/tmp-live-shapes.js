'use strict';
// 线上探针：v0.2.36.0 自由形状合并组（面宽 + 保尺寸左右并入 + 组背景 clip-path + 十字）
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const CDP_PORT = 6810 + Math.floor(Math.random() * 200);
const USER_DATA = path.join(os.tmpdir(), 'mn-live-shapes-' + Date.now());
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
  await send('CSS.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
  });
  await send('Page.navigate', { url: 'https://mnationworld.com/pages/fluidcanvas-editor.html' });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try { if (await evalJs("typeof window.findMergeSnap === 'function'")) break; } catch (e) {}
    if (i === 119) { console.log('线上编辑器未就绪; errs=', JSON.stringify(errs)); process.exit(1); }
  }
  await sleep(800);

  const r = await evalJs(`(function(){
    var pos = function(c){ return { l: parseFloat(c.style.left)||0, t: parseFloat(c.style.top)||0, w: c.offsetWidth, h: c.offsetHeight }; };
    // ① 倒 L：旗卡(174) + 短内容卡(80)右并入 → 保 80；内容卡从下并入 x 只叠短卡 → 面宽=80
    var A = window.createFlagCard(); window.moveCardPx(A, 800, 500);
    var B = window.createContentCard(); window.moveCardPx(B, 980, 500); B.style.width = '80px';
    window.mergeCards(B, A, 'right');
    var g1 = A.dataset.groupId;
    var C = window.createContentCard(); window.moveCardPx(C, 820, 700);
    window.mergeCards(C, B, 'bottom');
    var AP = pos(A), BP = pos(B), CP = pos(C);
    var bg1 = document.querySelector('.grid-group-bg[data-group-id="' + g1 + '"]');
    var clip = bg1 ? String(bg1.style.clipPath || bg1.style.webkitClipPath || '') : '';
    var r1 = { faceWidth: Math.abs(CP.w - BP.w) < 0.5, leftAligned: Math.abs(CP.l - BP.l) < 0.5,
      below: Math.abs(CP.t - (BP.t + BP.h)) < 1, sameGroup: C.dataset.groupId === g1,
      bKept: BP.w === 80, clipPath: clip.indexOf('path(') !== -1, arc: clip.indexOf('A') !== -1 };
    // ② 十字：另起中心卡四向并入 → 五卡同组、上下臂面宽=中心宽、左右臂保 80
    var M = window.createContentCard(); window.moveCardPx(M, 1200, 300);
    var MP = pos(M);
    var N2 = window.createContentCard(); window.moveCardPx(N2, MP.l + 10, MP.t - MP.h - 6); window.mergeCards(N2, M, 'top');
    var S2 = window.createContentCard(); window.moveCardPx(S2, MP.l + 10, MP.t + MP.h + 6); window.mergeCards(S2, M, 'bottom');
    var W2 = window.createContentCard(); window.moveCardPx(W2, MP.l - 90, MP.t + 10); W2.style.width = '80px'; window.mergeCards(W2, M, 'left');
    var E2 = window.createContentCard(); window.moveCardPx(E2, MP.l + MP.w + 10, MP.t + 10); E2.style.width = '80px'; window.mergeCards(E2, M, 'right');
    var g2 = M.dataset.groupId;
    var r2 = { five: [N2,S2,W2,E2].every(function(c){ return c.dataset.groupId === g2; }),
      eKept: E2.offsetWidth === 80, wKept: W2.offsetWidth === 80,
      nFace: Math.abs(N2.offsetWidth - M.offsetWidth) < 0.5, sFace: Math.abs(S2.offsetWidth - M.offsetWidth) < 0.5 };
    return JSON.stringify({ r1: r1, r2: r2, ver: window.FLUIDCANVAS_VERSION, errs: 0 });
  })()`);
  console.log('live =', r);
  console.log('pageErrs =', JSON.stringify(errs));
  try { ws.close(); } catch (e) {}
  try { chrome.kill(); } catch (e) {}
  const d = JSON.parse(r);
  const all = d.r1.faceWidth && d.r1.leftAligned && d.r1.below && d.r1.sameGroup && d.r1.bKept && d.r1.clipPath && d.r1.arc &&
    d.r2.five && d.r2.eKept && d.r2.wKept && d.r2.nFace && d.r2.sFace && d.ver === 'v10.28.26.0' && errs.length === 0;
  console.log(all ? '线上电池: PASS ✅' : '线上电池: FAIL ❌');
  process.exit(all ? 0 : 1);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
