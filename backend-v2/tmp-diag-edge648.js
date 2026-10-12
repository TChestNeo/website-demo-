// tmp-diag-edge648.js — 本地验证 v10.28.54.0 边缘外扩（透明 + overflow + 滑杆）
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-diag648-' + Date.now());
const DOCS = path.resolve(__dirname, '..', 'docs');
const EDITOR_URL_PATH = '/pages/fluidcanvas-editor.html';
const EDGE_CLIP = 'polygon(0% 0%, 100% 3%, 98% 97%, 3% 100%, 0% 0%)';
const EXP_EDGE = 'polygon(-3% -3%, 103% 0.18%, 100.88% 99.82%, 0.18% 103%, -3% -3%)';
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : ' — ' + (d || ''))); };
async function waitFor(cdp, expr, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); } throw new Error('waitFor:' + l); }
class CDP {
  constructor(u) { this.u = u; this.id = 0; this.p = new Map(); this.errs = []; }
  async connect() { this.w = new WebSocket(this.u); await new Promise((r, j) => { this.w.onopen = r; this.w.onerror = () => j(new Error('ws')); }); this.w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } else if (m.method === 'Runtime.exceptionThrown') { this.errs.push('EXC:' + (m.exceptionDetails || {}).text); } }; }
  send(m, p) { return new Promise((r, j) => { const id = ++this.id; this.p.set(id, { r, j }); this.w.send(JSON.stringify({ id, method: m, params: p || {} })); }); }
  async evalJs(x) { const r = await this.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = require('http').createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  let f = path.join(DOCS, u);
  if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const SESSION = 'try{(function(){ localStorage.setItem("slati_session","{\\"loggedIn\\":true}"); localStorage.setItem("slati_user",JSON.stringify({id:"USR-000101",displayName:"探针",tier:"premium"})); localStorage.setItem("slati_lang","zh-CN"); try{localStorage.removeItem("slati_fluidcanvas_draft");}catch(e){} })();}catch(e){}';
const READY = "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.edgeMyApply && window.createAssetCard && window.setCardImage && window.selectCard && window.setEdgeExpand";
const LIB = [{ id: 'ce-mask1', name: 'Mask边', kind: 'edge', clip: EDGE_CLIP, clipSoft: null, createdAt: 1760000000000, source: 'ai', repoId: null }];
const MCARD = "(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"IMG1\"]'); if(!c) return null;" +
  " var cs=getComputedStyle(c); var img=c.querySelector('.card-img-bg');" +
  " return { bg: cs.backgroundColor, overflow: cs.overflow, clip: cs.getPropertyValue('--card-clip').trim()," +
  "  maskVar: cs.getPropertyValue('--card-mask-clip').trim(), imgClip: img?getComputedStyle(img).clipPath:null }; })()";

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
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
    await cdp.send('Page.navigate', { url: BASE + EDITOR_URL_PATH + '?prem' });
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

    // 1. 卡身透明 + overflow visible + 默认 6% 外扩
    let card = await cdp.evalJs(MCARD);
    ok('P1 卡身透明（background 无矩形底）+ overflow visible', card.bg === 'rgba(0, 0, 0, 0)' && card.overflow === 'visible', JSON.stringify(card));
    ok('P2 默认外扩 6%：--card-clip = EXP_EDGE（装饰外扩）+ maskVar 原形', card.clip === EXP_EDGE && card.maskVar === EDGE_CLIP, JSON.stringify(card));
    // 2. 开抽屉后滑杆可见 + 默认值 6
    await cdp.evalJs('(function(){ window.openEdgeDrawer("edge"); })()');
    await sleep(400);
    const slider = await cdp.evalJs("(function(){ var s=document.getElementById('fcEdgeExpandSlider'); var r=document.getElementById('fcEdgeExpandRow'); return { show: r?getComputedStyle(r).display:'none', val: s?s.value:null }; })()");
    ok('P3 外扩滑杆可见 + 默认值 6', slider.show === 'flex' && slider.val === '6', JSON.stringify(slider));
    // 3. 调滑杆到 20 → clip 变（0% 顶点 → -10%）
    await cdp.evalJs('(function(){ window.setEdgeExpand(20); })()');
    await sleep(400);
    card = await cdp.evalJs(MCARD);
    ok('P4 调到 20%：--card-clip 外扩变大（含 -10%）+ maskVar 仍原形 + 卡身仍透明', card.clip.indexOf('-10%') !== -1 && card.clip !== EXP_EDGE && card.maskVar === EDGE_CLIP && card.bg === 'rgba(0, 0, 0, 0)', JSON.stringify(card));
    // 4. 草稿往返：edgeExpand 持久化
    await cdp.evalJs('(function(){ window.saveDraft(); })()');
    await sleep(400);
    const draft = await cdp.evalJs("(function(){ try{ return JSON.parse(localStorage.getItem('slati_fluidcanvas_draft')||'{}'); }catch(e){ return {}; } })()");
    const c1 = (draft.cards || []).find(x => x.label === 'IMG1');
    ok('P5 草稿含 edgeExpand=20', c1 && c1.edgeExpand === '20', JSON.stringify(c1 && { e: c1.edgeExpand, edge: c1.cardEdge }));
    // 5. E 零异常
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E 零异常（' + realErrs.length + '）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
  } catch (e) { console.log('  💥 ' + (e && e.message)); fail++; }
  finally { try { cdp && cdp.w.close(); } catch (e) {} try { server.close(); } catch (e) {} try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {} (() => { for (let i = 0; i < 15; i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const t = Date.now(); while (Date.now() - t < 200) {} } } })(); }
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail ? 1 : 0);
})();
