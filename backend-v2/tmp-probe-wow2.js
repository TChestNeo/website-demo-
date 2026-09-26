// tmp-probe-wow2.js — 白底白字扫描器 v2：全 DOM（含 display:none 隐藏弹窗/下拉）+ 更宽阈值
// （fgL>0.8 && bgL>0.7——#b0b0c2 类浅灰底白字对比度 ~2 也归入「白底白字」视觉族）+ 隐藏标记
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-wow2-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); });
      return;
    }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function listPages() {
  const out = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.name.endsWith('.html')) out.push(r);
    }
  })(DOCS, '');
  return out;
}

const SCANNER = `(function(){
  function rgbToHsl(r, g, b) {
    r/=255; g/=255; b/=255;
    var max=Math.max(r,g,b), min=Math.min(r,g,b), l=(max+min)/2;
    if (max===min) return {h:0, s:0, l:l};
    var d=max-min, s=l>0.5 ? d/(2-max-min) : d/(max+min), h;
    switch(max){ case r: h=(g-b)/d+(g<b?6:0); break; case g: h=(b-r)/d+2; break; default: h=(r-g)/d+4; }
    return {h:h*60, s:s, l:l};
  }
  function parseCssColor(str) {
    if (!str || str==='transparent' || str==='rgba(0, 0, 0, 0)') return null;
    str = str.replace(/\\s+/g,'');
    var m;
    if ((m=str.match(/^rgba?\\((\\d+(?:\\.\\d+)?)[, ]+(\\d+(?:\\.\\d+)?)[, ]+(\\d+(?:\\.\\d+)?)(?:[,/ ]+(\\d+(?:\\.\\d+)?))?\\)$/))) {
      var a = m[4]===undefined ? 1 : parseFloat(m[4]);
      return { h: rgbToHsl(+m[1],+m[2],+m[3]).h, s: rgbToHsl(+m[1],+m[2],+m[3]).s, l: rgbToHsl(+m[1],+m[2],+m[3]).l, a: a };
    }
    if ((m=str.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i))) {
      var h=m[1];
      if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      var r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
      var a=h.length===8?parseInt(h.slice(6,8),16)/255:1;
      var x=rgbToHsl(r,g,b); return {h:x.h, s:x.s, l:x.l, a:a};
    }
    if ((m=str.match(/^hsla?\\((\\d+(?:\\.\\d+)?)[, ]+(\\d+(?:\\.\\d+)?)%[, ]+(\\d+(?:\\.\\d+)?)%(?:[,/ ]+(\\d+(?:\\.\\d+)?))?\\)$/))) {
      var a=m[4]===undefined?1:parseFloat(m[4]);
      return {h:parseFloat(m[1]), s:parseFloat(m[2])/100, l:parseFloat(m[3])/100, a:a};
    }
    return null;
  }
  function maxStopLightness(gradStr) {
    var re=/(rgba?\\([^)]*\\)|hsla?\\([^)]*\\)|#[0-9a-fA-F]{3,8})/g, m, maxL=-1, any=false;
    while ((m=re.exec(gradStr))) {
      var c=parseCssColor(m[1]);
      if (c && c.a>0.05) { any=true; maxL=Math.max(maxL, c.l); }
    }
    return any?maxL:-1;
  }
  function effectiveBg(el) {
    function composite(fgC, bgC) {
      if (!fgC) return bgC;
      var a = fgC.a + bgC.a * (1 - fgC.a);
      if (a <= 0.0001) return { h: bgC.h, s: bgC.s, l: bgC.l, a: 0 };
      return { h: fgC.h, s: fgC.s, l: (fgC.l * fgC.a + bgC.l * bgC.a * (1 - fgC.a)) / a, a: a };
    }
    var chain = [];
    var src = 'none';
    var st = getComputedStyle(el);
    var self = parseCssColor(st.backgroundColor);
    if (self && self.a > 0.05) {
      var g = maxStopLightness(st.backgroundImage);
      if (g >= 0) { chain.push({ h: 0, s: 0, l: g, a: self.a }); src = 'self(grad)'; }
      else { chain.push(self); src = 'self'; }
    } else if (st.backgroundImage && st.backgroundImage !== 'none') {
      var g2 = maxStopLightness(st.backgroundImage);
      if (g2 >= 0) { chain.push({ h: 0, s: 0, l: g2, a: 1 }); src = 'self(grad)'; }
    }
    for (var pe of ['::before','::after']) {
      var ps = getComputedStyle(el, pe);
      var pb = parseCssColor(ps.backgroundColor);
      if (pb && pb.a > 0.05) {
        var pg = maxStopLightness(ps.backgroundImage);
        if (pg >= 0) { chain.unshift({ h: 0, s: 0, l: pg, a: pb.a }); src = pe + '(grad)'; }
        else { chain.unshift(pb); src = pe; }
      }
    }
    var clsOf = null;
    var a = el.parentElement;
    while (a) {
      var ast = getComputedStyle(a);
      var ab = parseCssColor(ast.backgroundColor);
      if (ab && ab.a > 0.05) {
        if (!clsOf) clsOf = ((a.className && a.className.baseVal !== undefined ? a.className.baseVal : a.className) || a.tagName).toString().slice(0, 40);
        var ag = maxStopLightness(ast.backgroundImage);
        if (ag >= 0) chain.push({ h: 0, s: 0, l: ag, a: ab.a });
        else chain.push(ab);
      } else if (ast.backgroundImage && ast.backgroundImage !== 'none') {
        var ag2 = maxStopLightness(ast.backgroundImage);
        if (ag2 >= 0) { chain.push({ h: 0, s: 0, l: ag2, a: 1 }); if (!clsOf) clsOf = ((a.className && a.className.baseVal !== undefined ? a.className.baseVal : a.className) || a.tagName).toString().slice(0, 40); }
      }
      a = a.parentElement;
    }
    var bg = { h: 0, s: 0, l: 1, a: 1 };
    for (var i = chain.length - 1; i >= 0; i--) bg = composite(chain[i], bg);
    if (src === 'none') src = clsOf ? 'anc:' + clsOf : 'none';
    return { l: bg.l, a: bg.a, src: src };
  }
  var out = [];
  var all = document.querySelectorAll('body *');
  for (var i=0; i<all.length; i++) {
    var el = all[i];
    try {
      var vis = true;
      try { vis = !!el.checkVisibility({contentVisibilityAuto:true, opacityProperty:true, visibilityProperty:true}); } catch(e) {}
      var hasDirect = false;
      for (var n of el.childNodes) if (n.nodeType===3 && n.textContent.trim().length>0) { hasDirect=true; break; }
      var isCtl = el.tagName==='INPUT' || el.tagName==='BUTTON' || el.tagName==='TEXTAREA' || el.tagName==='SELECT' || el.getAttribute('role')==='button';
      if (!hasDirect && !isCtl) continue;
      var st = getComputedStyle(el);
      if (st.filter && st.filter !== 'none') continue;
      var pseudoFiltered = false;
      try {
        if (getComputedStyle(el, '::before').filter !== 'none' || getComputedStyle(el, '::after').filter !== 'none') pseudoFiltered = true;
      } catch (e) {}
      if (pseudoFiltered) continue;
      if (isCtl && !hasDirect) {
        var childFiltered = false;
        try {
          var kids = el.querySelectorAll('span, svg');
          for (var k = 0; k < kids.length; k++) {
            var cf = getComputedStyle(kids[k]).filter;
            if (cf && cf !== 'none') { childFiltered = true; break; }
          }
        } catch (e) {}
        if (childFiltered) continue;
      }
      if (st.webkitBackgroundClip === 'text' || st.backgroundClip === 'text') continue;
      var fg = parseCssColor(st.color);
      if (!fg || fg.a<=0.05) continue;
      var bg = effectiveBg(el);
      if (bg.l < 0) continue;
      if (fg.l > 0.8 && bg.l > 0.7) {
        var txt = isCtl ? (el.value || el.placeholder || el.textContent || '') : el.textContent;
        out.push({
          tag: el.tagName,
          cls: ((el.className && el.className.baseVal!==undefined ? el.className.baseVal : el.className) || '').toString().slice(0,70),
          id: el.id ? el.id.slice(0,30) : '',
          hidden: !vis,
          fg: st.color,
          fgL: Math.round(fg.l*100)/100,
          bgL: (Math.round(bg.l*100)/100),
          bgA: (Math.round(bg.a*100)/100),
          bgSrc: bg.src,
          txt: txt.trim().slice(0,24)
        });
      }
    } catch(e) {}
  }
  return JSON.stringify(out);
})()`;

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    const mode = process.argv[2] === 'light' ? 'light' : 'dark';
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { username: 'Neo', role: 'director' } })) + ');}catch(e){}'
    });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify({ theme: mode, accent: 'mono' })) + ');}catch(e){}'
    });
    const pagesList = listPages();
    const results = [];
    for (const pg of pagesList) {
      try {
        await cdp.send('Page.navigate', { url: BASE + '/' + pg });
        await sleep(900);
        const finalUrl = await cdp.evalJs('location.pathname');
        const json = await cdp.evalJs(SCANNER);
        const arr = JSON.parse(json);
        const vis = arr.filter(x => !x.hidden).length;
        const hid = arr.filter(x => x.hidden).length;
        results.push({ page: pg, landed: finalUrl, offenders: arr });
        if (arr.length) {
          console.log('🔴 /' + pg + ' 共' + arr.length + '（可见' + vis + ' / 隐藏' + hid + '）' + (finalUrl !== '/' + pg ? ' →' + finalUrl : ''));
          for (const o of arr) {
            console.log('    [' + (o.hidden ? '藏' : '见') + '] <' + o.tag + (o.id ? '#' + o.id : '') + (o.cls ? '.' + o.cls : '') + '> fgL=' + o.fgL + ' bgL=' + o.bgL + ' src=' + o.bgSrc + ' “' + o.txt + '”');
          }
        } else {
          console.log('🟢 /' + pg);
        }
      } catch (e) {
        results.push({ page: pg, error: String(e && e.message || e) });
        console.log('💥 /' + pg + ' ' + (e && e.message || e));
      }
    }
    fs.writeFileSync(path.join(__dirname, 'tmp-wow2-' + mode + '.json'), JSON.stringify(results, null, 1));
    const total = results.reduce((s, r) => s + (r.offenders ? r.offenders.length : 0), 0);
    console.log('════ TOTAL ' + mode + ' mono offenders: ' + total);
    cdp.close();
    try { chrome.kill(); } catch (e) {}
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
})();
