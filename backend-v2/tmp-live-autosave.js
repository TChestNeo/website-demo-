'use strict';
// 线上电池：v0.2.40.0 / FC v10.28.30.0 自动保存周期制
// （默认 10 分钟 → 齿轮设置弹窗「编辑器」区点 5 分钟 → reload 持久 300000 → 改动落草稿 → 点回 10 复位 → 零 error）
// 同 tmp-live-page-bg.js 骨架；时钟=注入式 setTimeout 加速（≥60s→150ms 真跑+记录原 delay）——10 分钟节拍不真等
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const CDP_PORT = 6910 + Math.floor(Math.random() * 200);
const USER_DATA = path.join(os.tmpdir(), 'mn-live-autosave-' + Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1600,1200', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
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
    await send('Page.bringToFront');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    // 时钟加速包（仅电池注入）：delay ≥60s 记入 __longTimers 后以 150ms 真跑
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: "(function(){ var r = window.setTimeout.bind(window); window.__longTimers = []; " +
        "window.setTimeout = function(fn, d){ var a = Array.prototype.slice.call(arguments, 2); " +
        "if (typeof d === 'number' && d >= 60000) { window.__longTimers.push(d); return r(function(){ fn.apply(null, a); }, 150); } " +
        "return r.apply(null, [fn, d].concat(a)); }; })();"
    });
    await send('Page.navigate', { url: 'https://mnationworld.com/pages/fluidcanvas-editor.html' });
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      try { if (await evalJs("typeof window.createFlagCard === 'function' && typeof window.SlatiSettings !== 'undefined'")) break; } catch (e) {}
      if (i === 119) { console.log('线上编辑器未就绪; errs=', JSON.stringify(errs)); process.exit(1); }
    }
    await sleep(400);

    const d1 = await evalJs("JSON.stringify({ long600: window.__longTimers.indexOf(600000) !== -1, mn: window.MN_SITE_VERSION, fc: window.FLUIDCANVAS_VERSION })");
    const D1 = JSON.parse(d1);
    const c1 = D1.long600 && D1.mn === 'v0.2.40.0' && D1.fc === 'v10.28.30.0';
    console.log(c1 ? '✅ 默认 10 分钟心跳 600000 + 线上版本 v0.2.40.0/v10.28.30.0' : '❌ 默认心跳/版本', d1);

    await evalJs("document.getElementById('settingsBtn').click()");
    await sleep(400);
    const d2 = await evalJs("JSON.stringify({ menu: Array.prototype.map.call(document.querySelectorAll('#settingsMenu .settings-menu-item'), function(b){ return b.textContent; }), " +
      "activeSec: (document.querySelector('.settings-menu-item.active') || { dataset: {} }).dataset.sec || null, " +
      "pill10: !!(document.querySelector('#fcAutoSubnav .subnav-pill[data-min=\"10\"]') || {}).classList.contains('active') })");
    const D2 = JSON.parse(d2);
    const c2 = D2.menu.some(function (x) { return x.indexOf('编辑器') !== -1; }) && D2.activeSec === 'editor' && D2.pill10;
    console.log(c2 ? '✅ 齿轮→设置弹窗「编辑器」区默认落位+10 分钟 active' : '❌ 齿轮流', d2);

    await evalJs("document.querySelector('#fcAutoSubnav .subnav-pill[data-min=\"5\"]').click()");
    await sleep(400);
    const d3 = await evalJs("JSON.stringify({ v: (JSON.parse(localStorage.getItem('slati_settings') || '{}')).fcAutoSave, long300: window.__longTimers.indexOf(300000) !== -1 })");
    const D3 = JSON.parse(d3);
    const c3 = D3.v === 5 && D3.long300;
    console.log(c3 ? '✅ 点 5 分钟=偏好持久 5+心跳 300000 重排' : '❌ 点 5 分钟', d3);
    await evalJs('window.SlatiSettings.close()');

    await send('Page.reload', {});
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      try { if (await evalJs("typeof window.createFlagCard === 'function' && typeof window.SlatiSettings !== 'undefined'")) break; } catch (e) {}
      if (i === 119) { console.log('reload 未就绪'); process.exit(1); }
    }
    await sleep(400);
    const d4 = await evalJs("JSON.stringify({ long300: window.__longTimers.indexOf(300000) !== -1, v: (JSON.parse(localStorage.getItem('slati_settings') || '{}')).fcAutoSave })");
    const D4 = JSON.parse(d4);
    const c4 = D4.long300 && D4.v === 5;
    console.log(c4 ? '✅ reload 后 5 分钟偏好持久+心跳仍 300000' : '❌ reload 持久', d4);

    await evalJs("window.createFlagCard('live-autosave-probe', 3, 16, 8, 5)");
    await sleep(500);
    const c5 = await evalJs("JSON.stringify(JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')).indexOf('live-autosave-probe') !== -1");
    console.log(c5 === true ? '✅ 改动按节拍自动落草稿' : '❌ 改动落草稿', '');

    await evalJs("window.SlatiSettings.open()");
    await sleep(300);
    await evalJs("document.querySelector('#fcAutoSubnav .subnav-pill[data-min=\"10\"]').click()");
    await sleep(400);
    const d6 = await evalJs("JSON.stringify({ v: (JSON.parse(localStorage.getItem('slati_settings') || '{}')).fcAutoSave })");
    const D6 = JSON.parse(d6);
    const c6 = D6.v === 10;
    console.log(c6 ? '✅ 点回 10 分钟复位（用户设置不残留）' : '❌ 复位', d6);
    await evalJs('window.SlatiSettings.close()');

    const cZ = errs.length === 0;
    console.log(cZ ? '✅ 零 console error' : '❌ console errors', JSON.stringify(errs));
    const all = c1 && c2 && c3 && c4 && c5 === true && c6 && cZ;
    console.log(all ? '线上电池: PASS ✅' : '线上电池: FAIL ❌');
    process.exit(all ? 0 : 1);
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
