// tmp-diag-edge-648.js — 诊断：应用自定义边缘后卡片各层的 computed 样式
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-diag648-' + Date.now());
const EDGE_CLIP = 'polygon(0% 0%, 100% 3%, 98% 97%, 3% 100%, 0% 0%)';
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); } throw new Error('waitFor:' + l); }
class CDP {
  constructor(u) { this.u = u; this.id = 0; this.p = new Map(); }
  async connect() { this.w = new WebSocket(this.u); await new Promise((r, j) => { this.w.onopen = r; this.w.onerror = () => j(new Error('ws')); }); this.w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } }; }
  send(m, p) { return new Promise((r, j) => { const id = ++this.id; this.p.set(id, { r, j }); this.w.send(JSON.stringify({ id, method: m, params: p || {} })); }); }
  async evalJs(x) { const r = await this.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
}
const SESSION = 'try{(function(){ localStorage.setItem("slati_session","{\\"loggedIn\\":true}"); localStorage.setItem("slati_user",JSON.stringify({id:"USR-000101",displayName:"探针",tier:"premium"})); localStorage.setItem("slati_lang","zh-CN"); try{localStorage.removeItem("slati_fluidcanvas_draft");}catch(e){} })();}catch(e){}';
const READY = "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.edgeMyApply && window.createAssetCard && window.setCardImage && window.selectCard";
const LIB = [{ id: 'ce-mask1', name: 'Mask边', kind: 'edge', clip: EDGE_CLIP, clipSoft: null, createdAt: 1760000000000, source: 'ai', repoId: null }];

(async () => {
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
    await sleep(500);
    const dump = await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"IMG1\"]');" +
      " var cs=getComputedStyle(c);" +
      " var tint=c.querySelector('.card-tint'); var img=c.querySelector('.card-img-bg'); var stripes=c.querySelector('.card-stripes'); var bg=c.querySelector('.card-bg-img');" +
      " function g(el){ if(!el) return null; var s=getComputedStyle(el); return { bg:s.backgroundColor, bgImg:s.backgroundImage.slice(0,40), clip:s.clipPath, maskClip:s.getPropertyValue('--card-mask-clip'), cardClip:s.getPropertyValue('--card-clip'), z:s.zIndex }; }" +
      " return { root:g(c), tint:g(tint), img:g(img), stripes:g(stripes), bgimg:g(bg)," +
      "  rootShadow: cs.boxShadow, rootBorder: cs.border, rootRadius: cs.borderRadius, rootOverflow: cs.overflow," +
      "  rootEdge: c.dataset.cardEdge, rootMask: c.dataset.edgeMask }; })()");
    console.log(JSON.stringify(dump, null, 2));
  } catch (e) { console.log('💥 ' + (e && e.message)); }
  finally { try { cdp && cdp.w.close(); } catch (e) {} try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {} (() => { for (let i = 0; i < 15; i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const t = Date.now(); while (Date.now() - t < 200) {} } } })(); }
  process.exit(0);
})();
