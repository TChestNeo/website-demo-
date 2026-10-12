// tmp-diag-edgecolor-649.js — 本地验证 v10.28.55.0 边缘自动配色
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-color649-' + Date.now());
const DOCS = path.resolve(__dirname, '..', 'docs');
const EDITOR_URL_PATH = '/pages/fluidcanvas-editor.html';
const CLIP = 'polygon(0% 0%, 100% 3%, 98% 97%, 3% 100%, 0% 0%)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : ' — ' + (d || ''))); };
async function waitFor(cdp, e, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + e + ')')) return true; } catch (x) {} await sleep(150); } throw new Error('waitFor:' + l); }
class CDP {
  constructor(u) { this.u = u; this.id = 0; this.p = new Map(); this.errs = []; }
  async connect() { this.w = new WebSocket(this.u); await new Promise((r, j) => { this.w.onopen = r; this.w.onerror = () => j(new Error('ws')); }); this.w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } }; }
  send(m, p) { return new Promise((r, j) => { const id = ++this.id; this.p.set(id, { r, j }); this.w.send(JSON.stringify({ id, method: m, params: p || {} })); }); }
  async evalJs(x) { const r = await this.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = require('http').createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  let f = path.join(DOCS, u); if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const SESSION = 'try{(function(){ localStorage.setItem("slati_session","{\\"loggedIn\\":true}"); localStorage.setItem("slati_user",JSON.stringify({id:"USR-000101",displayName:"探针",tier:"premium"})); localStorage.setItem("slati_lang","zh-CN"); try{localStorage.removeItem("slati_fluidcanvas_draft");}catch(e){} })();}catch(e){}';
const READY = "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.edgeMyApply && window.createAssetCard";
const LIB = [
  { id: 'ce-star', name: '星星', kind: 'edge', clip: CLIP, clipSoft: null, createdAt: 1760000000000, source: 'ai', repoId: null },
  { id: 'ce-wave', name: '水浪', kind: 'edge', clip: CLIP, clipSoft: null, createdAt: 1760000000100, source: 'ai', repoId: null },
  { id: 'ce-unknown', name: '无名形状', kind: 'edge', clip: 'polygon(0% 0%, 50% 0%, 100% 50%, 50% 100%, 0% 100%)', clipSoft: null, createdAt: 1760000000200, source: 'ai', repoId: null }
];
const LAYERS = "(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"T1\"]'); return c?getComputedStyle(c).getPropertyValue('--card-layers').trim():null; })()";

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
    await cdp.evalJs("(function(){ window.createAssetCard('text','T1',2,2,6,4); })()");
    await sleep(400);
    await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"T1\"]'); window.selectCard(c,true); })()");
    await sleep(250);

    await cdp.evalJs('(function(){ window.edgeMyApply("ce-star"); })()'); await sleep(400);
    let l1 = await cdp.evalJs(LAYERS);
    ok('星星 → 金色渐变（255,200,60）', l1.indexOf('255,200,60') !== -1, l1);

    await cdp.evalJs('(function(){ window.edgeMyApply("ce-wave"); })()'); await sleep(400);
    let l2 = await cdp.evalJs(LAYERS);
    ok('水浪 → 蓝色渐变（70,130,235）', l2.indexOf('70,130,235') !== -1, l2);

    await cdp.evalJs('(function(){ window.edgeMyApply("ce-unknown"); })()'); await sleep(400);
    let l3 = await cdp.evalJs(LAYERS);
    ok('无名形状 → 形状哈希取色（非紫非金蓝，有渐变）', l3.indexOf('linear-gradient') !== -1 && l3.indexOf('255,200,60') === -1 && l3.indexOf('70,130,235') === -1, l3);

    ok('星星≠水浪 颜色确实不同', l1 !== l2, 'l1=' + l1 + ' / l2=' + l2);
  } catch (e) { console.log('  💥 ' + (e && e.message)); fail++; }
  finally { try { cdp && cdp.w.close(); } catch (e) {} try { server.close(); } catch (e) {} try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {} (() => { for (let i = 0; i < 15; i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const t = Date.now(); while (Date.now() - t < 200) {} } } })(); }
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail ? 1 : 0);
})();
