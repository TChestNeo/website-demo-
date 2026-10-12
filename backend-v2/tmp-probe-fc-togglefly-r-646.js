// tmp-probe-fc-togglefly-r-646.js — FC v10.28.52.5 折叠出画加深+画外停拍+展开Q弹线上探针（mnationworld.com）
//   S1a site-config live：52.5 赋值 ×1 + 52.4 赋值零残留 + 站点 58.28 ×1 + changelog 头 52.5/52.4/52.3 各 ×1；
//   S1b rev live 口径：rev 00377-真值 ×1 + 00377-XXX 零残留 + 00378-??? 占位 ×1 + 00378-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00378-终态，live 仍二次烘焙镜像）；
//   S1c 编辑器 live 15 锚（52.5 注释头/fine 右缘 214px top 12px 带展开 Q弹/胶囊让位 46px/双动画挂接/
//      位移关键帧头/Q弹关键帧头/28% 深出画 -80px/50% 画外停拍/Q弹 70% 拉长/展开 Q弹关键帧头/45% 展开拉长/
//      40×40 同高/49.1 :has 折叠规则/52.2 纯白锚/暗色还原规则）；
//   S2 API：health 200 + tables:66（本轮零迁移）；S3 fc/edges 匿名公开 200（回归）；
//   P1 CDP 编辑器（假会话）：P1a 展开态按钮驻搜索菜单右侧 214px+top 12px+正圆 40×40 与胶囊同高+纯白
//     （52.2 回归）+胶囊让位（margin-left 0/左缘 12/宽 180~200/按钮左缘 214 留 ≥10 缝）→
//     P1b 点击折叠 live 双通道轨迹（页内 16ms 采样 1300ms：位移=双名命中+动画数 ≥2+样本 ≥60+
//     起步右缘 earlyMax>100+min ≤ -70 深出画+画外停拍 dwell ≥8（left≤-75）+maxAfterMin ≥ 8 过冲+
//     顺序 minIdx<maxAfterMinIdx+终态 6px；Q弹=scaleX 峰值 ≥1.25 拉长+scaleY 谷 ≤0.75 压扁+
//     终态 scale 回规 1）→
//     P1c 点击展开→0.25s 过渡滑回 214px+fcToggleInQSquash 展开 Q弹命中（an 含名+scaleX 峰值 ≥1.15+
//     滑回中途 6<left<214+终态 scale 回规 1）→ P1d 再折叠再出画回弹（重触发+min ≤ -70）+面板宽 0 →
//     E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REAL77 = '00377-628'; // deploy#1 实得 rev（瞬态已直播）
const REAL78 = '00378-rjd'; // deploy#2 实得 rev（live 断言=零残留）
const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fc646-' + Date.now());
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}
const hget = (url, opts) => new Promise((resolve) => {
  opts = opts || {};
  const req = https.request(url, Object.assign({ method: opts.method || 'GET', headers: Object.assign({}, opts.headers), timeout: 25000 }), (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 12000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  if (opts.body) req.write(opts.body);
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push('EXC:' + JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const txt = (m.params.args || []).map(a => a.value || a.description || '').join(' ');
        if (txt.indexOf('Failed to load resource') === -1) this.errs.push('CON:' + txt.slice(0, 200));
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

const SESSION_SCRIPT = 'try{(function(){ localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "探针用户", tier: "premium" }));' +
  ' localStorage.setItem("slati_lang", "zh-CN"); })();}catch(e){}';
const FACE_EXPR = "(function(){ var t = document.querySelector('.asset-panel-toggle');" +
  " var p = document.querySelector('.asset-panel'); var c = document.querySelector('.asset-panel .search-capsule');" +
  " var ts = getComputedStyle(t);" +
  " var br = t.getBoundingClientRect(), pr = p.getBoundingClientRect(), cr = c.getBoundingClientRect();" +
  " return { tl: ts.left, tt: ts.top, tw: ts.width, th: ts.height, br: ts.borderRadius," +
  " tb: ts.backgroundColor, tblur: ts.backdropFilter || 'none', txt: t.textContent.trim()," +
  " pw: getComputedStyle(p).width," +
  " capL: Math.round(cr.left - pr.left), capW: getComputedStyle(c).width, capML: getComputedStyle(c).marginLeft," +
  " btnL: Math.round(br.left - pr.left) }; })()";
// 页内 16ms 采样 1300ms 双通道（left 位移 + transform 缩放）：对 CDP 往返延迟免疫
// （动画钟电池法——照 togglefly-r 电池原版裸 Promise，不套额外调用括号）
const TRACE_EXPR = "new Promise(function(res){" +
  " var b = document.querySelector('.asset-panel-toggle');" +
  " var t = []; var t0 = performance.now();" +
  " var an = getComputedStyle(b).animationName; var ac = b.getAnimations().length;" +
  " var h = setInterval(function(){" +
  "   var cs = getComputedStyle(b); var tf = cs.transform || 'none';" +
  "   var m = tf.match(/matrix\\(([^)]+)\\)/);" +
  "   var a = m ? parseFloat(m[1].split(',')[0]) : 1, d = m ? parseFloat(m[1].split(',')[3]) : 1;" +
  "   t.push([performance.now() - t0, parseFloat(cs.left), a, d]);" +
  "   if (performance.now() - t0 >= 1300) { clearInterval(h); res({ t: t, an: an, ac: ac }); }" +
  " }, 16); })";
const parseColor = (s) => (s || '').replace(/[^\d,.]/g, '').split(',').map(Number);
const near = (a, b, tol) => a && a.length >= 3 && b && b.length >= 3 &&
  Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
const isOpaque = (s) => !/rgba\(/.test(s) || (parseColor(s).length === 4 && parseColor(s)[3] >= 0.999);

(async () => {
  // ═══ S1 静态（live 文本口径）═══
  console.log('═══ S1 静态（live）═══');
  const sc = await hget(SITE + '/assets/js/site-config.js');
  const ed = await hget(ED);
  const scS = sc.body;
  const scC = (s) => scS.split(s).length - 1;
  ok('S1a site-config：52.5 赋值 ×1 + 52.4 赋值零残留 + 站点 58.28 ×1 + changelog 头 52.5/52.4/52.3 各 ×1',
    scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.5';") === 1 && scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.4';") === 0 &&
    scC("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 &&
    scC('// v10.28.52.5 = ') === 1 && scC('// v10.28.52.4 = ') === 1 && scC('// v10.28.52.3 = ') === 1,
    'fc525=' + scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.5';") + ' fc524=' + scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.4';") +
    ' cl525=' + scC('// v10.28.52.5 = ') + ' cl524=' + scC('// v10.28.52.4 = ') + ' cl523=' + scC('// v10.28.52.3 = '));
  ok('S1b rev live 口径：rev ' + REAL77 + ' ×1 + 00377-XXX 零残留 + 00378-??? 占位 ×1 + ' + REAL78 + ' 零残留（live 滞后一部署）',
    scC(REAL77) === 1 && scC('00377-XXX') === 0 && scC('00378-???') === 1 && scC(REAL78) === 0,
    'r77=' + scC(REAL77) + ' p77=' + scC('00377-XXX') + ' p78=' + scC('00378-???') + ' r78=' + scC(REAL78));
  const ebad = [];
  const eanchors = [
    ['52.5 注释头', 'v10.28.52.5: 折叠出画加深+画外停一拍+展开加 Q弹', 1],
    ['fine 右缘 214px top 12px 带展开 Q弹', '.asset-panel-toggle { left: calc(var(--asset-panel-w) - 46px); top: 12px; animation: fcToggleInQSquash 0.28s; }', 1],
    ['胶囊让位 46px', '.asset-panel .search-capsule { width: calc(100% - 46px); }', 1],
    ['双动画挂接', 'animation: fcToggleOutSpring 0.9s, fcToggleQSquash 0.9s;', 1],
    ['位移关键帧头', '@keyframes fcToggleOutSpring {', 1],
    ['Q弹关键帧头', '@keyframes fcToggleQSquash {', 1],
    ['28% 深出画 -80px', '28%  { left: -80px; animation-timing-function: linear; }', 1],
    ['50% 画外停拍', '50%  { left: -80px; animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }', 1],
    ['Q弹 70% 拉长', '70%  { transform: scale(1.35, 0.65); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }', 1],
    ['展开 Q弹关键帧头', '@keyframes fcToggleInQSquash {', 1],
    ['45% 展开拉长', '45%  { transform: scale(1.3, 0.7); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }', 1],
    ['40×40 同高', 'width: 40px; height: 40px; /* 52.4', 1],
    ['49.1 :has 折叠规则', '.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }', 1],
    ['52.2 纯白锚', 'background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */', 1],
    ['暗色还原规则', ':root[data-theme="dark"] .asset-panel-toggle,', 1]
  ];
  eanchors.forEach(([n, s, want]) => { if (ed.body.split(s).length - 1 !== want) ebad.push(n + '=' + (ed.body.split(s).length - 1)); });
  ok('S1c 编辑器 live 15 锚全中（52.5 十一件+49.1 :has/52.2 纯白/暗色还原/40×40 回归）', ebad.length === 0, ebad.join(','));

  console.log('═══ S2 API（匿名口径）═══');
  const health = await hget(SITE + '/api/health');
  let healthJson = null; try { healthJson = JSON.parse(health.body); } catch (e) {}
  ok('S2 /api/health 200 + tables:66（本轮零迁移）', health.status === 200 && healthJson && healthJson.status === 'ok' && healthJson.tables === 66,
    'status=' + health.status + ' tables=' + (healthJson && healthJson.tables));

  console.log('═══ S3 匿名回归 ═══');
  const edges = await hget(SITE + '/api/fc/edges');
  ok('S3 fc/edges 匿名公开 200（回归）', edges.status === 200, 'status=' + edges.status);

  // ═══ P1 CDP 编辑器（假会话）═══
  console.log('═══ P1 CDP（假会话）═══');
  let chromePath = null;
  (['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]).forEach((p) => { if (!chromePath && fs.existsSync(p)) chromePath = p; });
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let cdp = null;
  try {
    let up = false;
    for (let i = 0; i <80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
    await cdp.send('Page.navigate', { url: ED });
    await waitFor(cdp, "document.getElementById('gridCanvas') && document.querySelector('.asset-panel-toggle')", 40000, 'P1 编辑器就绪');
    await sleep(900);

    // P1a 展开态：按钮驻搜索菜单右侧 214px + top 12px + 正圆 40×40 同高 + 纯白（52.2 回归）+ 胶囊让位
    const f = await cdp.evalJs(FACE_EXPR);
    ok('P1a 展开态 live：按钮 left 214px+top 12px+正圆 40×40（=搜索胶囊同高）+纯白 rgb(255,255,255) 不透明+blur 摘除（52.2 回归）',
      f && f.tl === '214px' && f.tt === '12px' && f.tw === '40px' && f.th === '40px' && f.br === '50%' &&
      near(parseColor(f.tb), [255, 255, 255], 0) && isOpaque(f.tb) && f.tblur === 'none' && f.txt === '◂' && f.pw === '260px',
      JSON.stringify(f));
    ok('P1a2 胶囊让位 live：margin-left 0+左缘 12px+宽 180~200px+按钮左缘 214 留 ≥10px 缝',
      f && f.capML === '0px' && f.capL === 12 && parseFloat(f.capW) >= 180 && parseFloat(f.capW) <= 200 &&
      f.btnL === 214 && (f.btnL - f.capL - parseFloat(f.capW)) >= 10,
      'capML=' + (f && f.capML) + ' capL=' + (f && f.capL) + ' capW=' + (f && f.capW) + ' btnL=' + (f && f.btnL));

    // P1b 点击折叠：页内 16ms 采样 live 双通道轨迹（位移 + Q弹缩放）
    await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
    const tr = await cdp.evalJs(TRACE_EXPR);
    const tt = tr.t || [];
    const xs = tt.map((p) => p[1]);
    const as = tt.map((p) => p[2]);
    const ds = tt.map((p) => p[3]);
    const earlyMax = Math.max.apply(null, xs.slice(0, 12));
    const mn = Math.min.apply(null, xs);
    const mnIdx = xs.indexOf(mn);
    const after = xs.slice(mnIdx);
    const mxAfter = Math.max.apply(null, after);
    const mxAfterIdx = mnIdx + after.indexOf(mxAfter);
    const dwell = xs.filter((x) => x <= -75).length;
    const maxA = Math.max.apply(null, as), minD = Math.min.apply(null, ds);
    const final = xs[xs.length - 1];
    const finalA = as[as.length - 1], finalD = ds[ds.length - 1];
    const anHit = tr.an && tr.an.indexOf('fcToggleOutSpring') !== -1 && tr.an.indexOf('fcToggleQSquash') !== -1 ? 1 : 0;
    ok('P1b 折叠 live 位移轨迹：animationName ' + tr.an + ' 双名命中+动画数 ' + tr.ac + ' ≥2+样本 ' + xs.length + ' ≥60+起步右缘 earlyMax ' + earlyMax + ' >100+min ' + mn + ' ≤ -70 深出画+画外停拍 dwell ' + dwell + ' ≥8（left≤-75）+回弹过冲 ' + mxAfter + ' ≥ 8+顺序 minIdx(' + mnIdx + ')<maxAfterMinIdx(' + mxAfterIdx + ')+终态落定 6px',
      anHit >= 1 && tr.ac >= 2 && xs.length >= 60 && earlyMax > 100 && mn <= -70 && dwell >= 8 && mxAfter >= 8 && mnIdx < mxAfterIdx && final === 6,
      JSON.stringify({ n: xs.length, min: mn, dwell: dwell, maxAfter: mxAfter, minIdx: mnIdx, maxAfterIdx: mxAfterIdx, final: final, an: tr.an, ac: tr.ac }));
    ok('P1b2 折叠 live Q弹缩放：scaleX 峰值 ' + maxA + ' ≥1.25 弹出拉长+scaleY 谷值 ' + minD + ' ≤0.75 纵向压扁+终态 scale 回规 1（|a-1|≤0.03+|d-1|≤0.03）',
      maxA >= 1.25 && minD <= 0.75 && Math.abs(finalA - 1) <= 0.03 && Math.abs(finalD - 1) <= 0.03,
      JSON.stringify({ maxA: maxA, minD: minD, finalA: finalA, finalD: finalD }));

    // P1c 点击展开：0.25s 过渡滑回右缘 214px + fcToggleInQSquash 展开 Q弹（页内采样实证）
    await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
    const tre = await cdp.evalJs(TRACE_EXPR);
    const tte = tre.t || [];
    const xe = tte.map((p) => p[1]);
    const ae = tte.map((p) => p[2]);
    const midLe = xe.length ? xe[Math.min(7, xe.length - 1)] : NaN;   // ~112ms=滑回中途
    const maxAe = Math.max.apply(null, ae.slice(0, 19));              // 前 ~304ms 展开 Q弹峰值
    const finalLe = xe.length ? xe[xe.length - 1] : NaN;
    const finalAe = ae.length ? ae[ae.length - 1] : NaN;
    const anEHit = tre.an && tre.an.indexOf('fcToggleInQSquash') !== -1 ? 1 : 0;
    const fe = await cdp.evalJs(FACE_EXPR);
    ok('P1c 展开 live：滑回中途 ' + midLe + ' 6<left<214+展开 Q弹命中（an ' + tre.an + ' 含 fcToggleInQSquash+scaleX 峰值 ' + maxAe + ' ≥1.15）→ 落定 214px/◂/面板 260px/scale 回规 1',
      midLe > 6 && midLe < 214 && anEHit >= 1 && maxAe >= 1.15 && finalLe === 214 && fe && fe.txt === '◂' && fe.pw === '260px' && Math.abs(finalAe - 1) <= 0.03,
      JSON.stringify({ midL: midLe, an: tre.an, maxA: maxAe, finalL: finalLe, finalA: finalAe, face: fe }));

    // P1d 再折叠：双动画重触发（重挂即重放）+ 面板宽 0
    await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
    const tr2 = await cdp.evalJs(TRACE_EXPR);
    const tt2 = tr2.t || [];
    const xs2 = tt2.map((p) => p[1]);
    const mn2 = Math.min.apply(null, xs2);
    const mn2Idx = xs2.indexOf(mn2);
    const mxAfter2 = Math.max.apply(null, xs2.slice(mn2Idx));
    const anHit2 = tr2.an && tr2.an.indexOf('fcToggleOutSpring') !== -1 && tr2.an.indexOf('fcToggleQSquash') !== -1 ? 1 : 0;
    const f2 = await cdp.evalJs(FACE_EXPR);
    ok('P1d 再折叠 live：重触发轨迹（an ' + tr2.an + ' 双名+min ' + mn2 + ' ≤ -70+回弹 ' + mxAfter2 + ' ≥ 8+动画数 ' + tr2.ac + ' ≥2）+终态按钮 6px+面板宽 0+▸',
      anHit2 >= 1 && tr2.ac >= 2 && mn2 <= -70 && mxAfter2 >= 8 && f2 && f2.tl === '6px' && f2.pw === '0px' && f2.txt === '▸',
      JSON.stringify({ n: xs2.length, min: mn2, maxAfter: mxAfter2, an: tr2.an, ac: tr2.ac, face: f2 }));

    // E1 零异常
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 零异常（实际 ' + realErrs.length + ' 条）', realErrs.length === 0, realErrs.join(' | '));
  } catch (e) {
    console.log('  💥 ' + (e && e.message || e));
    fail++;
  } finally {
    try { cdp && cdp.close(); } catch (e) {}
    chrome.kill();
  }
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail ? 1 : 0);
})();
