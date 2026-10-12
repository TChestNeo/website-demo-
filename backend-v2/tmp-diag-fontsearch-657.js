// tmp-diag-fontsearch-657.js — 本地验证 v10.28.62.0 字体面板搜索 + 语言筛选
'use strict';
const fs = require('fs'); const path = require('path'); const os = require('os'); const { spawn } = require('child_process');
const PORT = 4800 + Math.floor(Math.random() * 400); const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-fs657-' + Date.now()); const DOCS = path.resolve(__dirname, '..', 'docs');
const EDITOR_URL_PATH = '/pages/fluidcanvas-editor.html';
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
const server = require('http').createServer((req, res) => { let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html'; let f = path.join(DOCS, u); if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; } if (!fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const SESSION = 'try{(function(){ localStorage.setItem("slati_session","{\\"loggedIn\\":true}"); localStorage.setItem("slati_user",JSON.stringify({id:"USR-000101",displayName:"探针",tier:"premium"})); localStorage.setItem("slati_lang","zh-CN"); try{localStorage.removeItem("slati_fluidcanvas_draft");}catch(e){} })();}catch(e){}';
const READY = "document.getElementById('fontPanel') && window.FLUIDCANVAS_FONTS && window.showFontPanel && document.getElementById('ttFontBtn')";
(async () => {
  await new Promise(r => server.listen(PORT, r)); const BASE = 'http://127.0.0.1:' + PORT;
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let cdp = null;
  try {
    let up = false; for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    if (!up) throw new Error('CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json(); const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl); await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION }); await cdp.send('Page.navigate', { url: BASE + EDITOR_URL_PATH + '?prem' });
    await waitFor(cdp, READY, 40000, 'ready'); await sleep(900);
    const groups = await cdp.evalJs('window.FLUIDCANVAS_FONTS.length');
    await cdp.evalJs('(function(){ window.showFontPanel(); })()'); await sleep(500);
    const t = await cdp.evalJs("(function(){ var s=document.getElementById('fpSearch'); var l=document.getElementById('fpLangFilter'); var p=document.getElementById('fontPanel');" +
      " return { panelShow: getComputedStyle(p).display, search: !!s, lang: !!l, langOpts: l?l.options.length:0, firstLang: l&&l.options[1]?l.options[1].value:null, totalRows: document.querySelectorAll('.fp-row').length }; })()");
    ok('P1 面板打开 + 工具栏（搜索栏 + 语言筛选）存在', t.panelShow === 'block' && t.search && t.lang, JSON.stringify(t));
    ok('P2 语言筛选有选项（10 语言 + 全部）', t.langOpts >= 11 && t.firstLang, JSON.stringify({ opts: t.langOpts, first: t.firstLang }));
    // 搜索测试：搜一个具体字体名
    const sample = await cdp.evalJs("(function(){ var rows=document.querySelectorAll('.fp-row'); return rows[0]?rows[0].dataset.name:null; })()");
    await cdp.evalJs("(function(){ var s=document.getElementById('fpSearch'); s.value=" + JSON.stringify(sample) + "; window.filterFontPanel(); })()"); await sleep(300);
    const r1 = await cdp.evalJs("(function(){ var vis=0; document.querySelectorAll('.fp-row').forEach(function(r){ if(getComputedStyle(r).display!=='none') vis++; }); return vis; })()");
    ok('P3 搜索字体名 → 只剩匹配行（1-2 行可见）', sample && r1 >= 1 && r1 <= 3, JSON.stringify({ sample: sample, visible: r1 }));
    // 清空搜索 + 语言筛选测试
    await cdp.evalJs("(function(){ document.getElementById('fpSearch').value=''; window.filterFontPanel(); })()"); await sleep(300);
    const langName = t.firstLang;
    await cdp.evalJs("(function(){ var l=document.getElementById('fpLangFilter'); l.value=" + JSON.stringify(langName) + "; window.filterFontPanel(); })()"); await sleep(300);
    const r2 = await cdp.evalJs("(function(){ var vis=0, groups=0; document.querySelectorAll('.fp-group').forEach(function(g){ if(getComputedStyle(g).display!=='none') groups++; }); document.querySelectorAll('.fp-row').forEach(function(r){ if(getComputedStyle(r).display!=='none') vis++; }); return { vis: vis, groups: groups }; })()");
    ok('P4 选语言 → 只剩该组（1 个组头可见）', r2.groups === 1, JSON.stringify(r2));
  } catch (e) { console.log('  💥 ' + (e && e.message)); fail++; }
  finally { try { cdp && cdp.w.close(); } catch (e) {} try { server.close(); } catch (e) {} try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {} (() => { for (let i = 0; i < 15; i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const t = Date.now(); while (Date.now() - t < 200) {} } } })(); }
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌'); process.exit(fail ? 1 : 0);
})();
