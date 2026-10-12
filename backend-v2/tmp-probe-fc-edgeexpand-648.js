// tmp-probe-fc-edgeexpand-648.js — FC v10.28.54.0 边缘外扩距离+卡身透明线上探针（mnationworld.com）
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');
const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe648-' + Date.now());
const EDGE_CLIP = 'polygon(0% 0%, 100% 3%, 98% 97%, 3% 100%, 0% 0%)';
const EXP_EDGE = 'polygon(-3% -3%, 103% 0.18%, 100.88% 99.82%, 0.18% 103%, -3% -3%)';
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : ' — ' + (d || ''))); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, e, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + e + ')')) return true; } catch (x) {} await sleep(150); } throw new Error('waitFor:' + l); }
const hget = (url) => new Promise((res) => { const r = https.request(url, { timeout: 25000 }, (x) => { let b = ''; x.on('data', c => { b += c; if (b.length > 12000000) r.destroy(); }); x.on('end', () => res({ status: x.statusCode, body: b })); }); r.on('error', e => res({ status: 0, error: String(e.message) })); r.end(); });
class CDP {
  constructor(u) { this.u = u; this.id = 0; this.p = new Map(); this.errs = []; }
  async connect() { this.w = new WebSocket(this.u); await new Promise((r, j) => { this.w.onopen = r; this.w.onerror = () => j(new Error('ws')); }); this.w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } else if (m.method === 'Runtime.exceptionThrown') { this.errs.push('EXC:' + (m.exceptionDetails || {}).text); } }; }
  send(m, p) { return new Promise((r, j) => { const id = ++this.id; this.p.set(id, { r, j }); this.w.send(JSON.stringify({ id, method: m, params: p || {} })); }); }
  async evalJs(x) { const r = await this.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
}
const SESSION = 'try{(function(){ localStorage.setItem("slati_session","{\\"loggedIn\\":true}"); localStorage.setItem("slati_user",JSON.stringify({id:"USR-000101",displayName:"探针",tier:"premium"})); localStorage.setItem("slati_lang","zh-CN"); try{localStorage.removeItem("slati_fluidcanvas_draft");}catch(e){} })();}catch(e){}';
const READY = "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.edgeMyApply && window.setEdgeExpand && window.createAssetCard && window.setCardImage";
const LIB = [{ id: 'ce-mask1', name: 'Mask边', kind: 'edge', clip: EDGE_CLIP, clipSoft: null, createdAt: 1760000000000, source: 'ai', repoId: null }];
const MCARD = "(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"IMG1\"]'); if(!c) return null; var cs=getComputedStyle(c);" +
  " return { bg: cs.backgroundColor, ov: cs.overflow, clip: cs.getPropertyValue('--card-clip').trim(), maskVar: cs.getPropertyValue('--card-mask-clip').trim() }; })()";

(async () => {
  // S1 静态
  const sc = await hget(SITE + '/assets/js/site-config.js');
  const i18n = await hget(SITE + '/assets/i18n/fluidcanvas.i18n.js');
  const scC = (s) => sc.body.split(s).length - 1;
  ok('S1a site-config live：54.0 赋值 ×1 + changelog 头 54.0 ×1 + 53.0 头(回归) ×1 + 站点 58.28',
    scC("window.FLUIDCANVAS_VERSION = 'v10.28.54.0';") === 1 && scC('// v10.28.54.0 = ') === 1 && scC('// v10.28.53.0 = ') === 1 && scC("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1,
    'fc54=' + scC("window.FLUIDCANVAS_VERSION = 'v10.28.54.0';") + ' cl54=' + scC('// v10.28.54.0 = '));
  const ic = (s) => i18n.body.split(s).length - 1;
  ok('S1b i18n live：fc.edge.expandDist ×12 语', ic('"fc.edge.expandDist"') === 12, 'ed=' + ic('"fc.edge.expandDist"'));
  // P1 CDP
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let cdp = null;
  try {
    let up = false;
    for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    if (!up) throw new Error('CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION });
    await cdp.send('Page.navigate', { url: ED });
    await waitFor(cdp, READY, 40000, 'ready');
    await sleep(900);
    await cdp.evalJs("localStorage.setItem('slati_custom_edges', " + JSON.stringify(JSON.stringify(LIB)) + ")");
    await cdp.evalJs("(function(){ window.createAssetCard('text','IMG1',10,2,6,4); })()");
    await sleep(400);
    await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"IMG1\"]'); window.setCardImage(c," + JSON.stringify(PNG_1PX) + ",'IMG1'); })()");
    await sleep(500);
    await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"IMG1\"]'); window.selectCard(c,true); })()");
    await sleep(250);
    await cdp.evalJs('(function(){ window.edgeMyApply("ce-mask1"); })()');
    await sleep(400);
    let card = await cdp.evalJs(MCARD);
    ok('P1a live 应用自定义 edge：卡身透明（bg rgba(0,0,0,0)）+ overflow visible + 默认 6% 外扩 + maskVar 原形',
      card && card.bg === 'rgba(0, 0, 0, 0)' && card.ov === 'visible' && card.clip === EXP_EDGE && card.maskVar === EDGE_CLIP, JSON.stringify(card));
    await cdp.evalJs('(function(){ window.openEdgeDrawer("edge"); })()');
    await sleep(400);
    const slider = await cdp.evalJs("(function(){ var s=document.getElementById('fcEdgeExpandSlider'); var r=document.getElementById('fcEdgeExpandRow'); return { show: r?getComputedStyle(r).display:'none', val: s?s.value:null }; })()");
    ok('P1b live 外扩滑杆可见 + 默认 6', slider.show === 'flex' && slider.val === '6', JSON.stringify(slider));
    await cdp.evalJs('(function(){ window.setEdgeExpand(20); })()');
    await sleep(400);
    card = await cdp.evalJs(MCARD);
    ok('P1c live 调到 20%：--card-clip 外扩变大（含 -10%）+ 卡身仍透明 + maskVar 原形',
      card.clip.indexOf('-10%') !== -1 && card.clip !== EXP_EDGE && card.bg === 'rgba(0, 0, 0, 0)' && card.maskVar === EDGE_CLIP, JSON.stringify(card));
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 零异常（' + realErrs.length + '）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
  } catch (e) { console.log('  💥 ' + (e && e.message)); fail++; }
  finally { try { cdp && cdp.w.close(); } catch (e) {} try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {} (() => { for (let i = 0; i < 15; i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const t = Date.now(); while (Date.now() - t < 200) {} } } })(); }
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail ? 1 : 0);
})();
