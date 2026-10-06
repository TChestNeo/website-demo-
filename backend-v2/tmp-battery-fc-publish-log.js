// tmp-battery-fc-publish-log.js — FC v10.28.42.1 发布日志弹窗电池
// 用户「点击发布的时候能不能先弹出一个弹窗填写日志 他的长度要是固定的会跟着
//   日志长度变化，然后限制320字」
// 验证：F0 静态锚（FC v10.28.48.0 + rev 00348- 占位 + 站点 58.0 恒 + 弹窗 DOM/
//         确认发布按钮 + buildDraft log 字段 + applyDraft 恢复 + CSS 固定初始高）
//   / P 演示段（api.js 原样、/api/health 404 → fcCloudMode=false）：
//         P1 点真发布按钮弹窗开+空日志+0/320+初始固定高 ~110
//         P2 'hello world'→2/320；P3 'code'→1/320（用户钦定口径锚）
//         P4 8 行日志 → 高度随内容自动增长；P5 超长 → 恰 220px 上限+内滚
//         P6 321 词 → 321/320 + .over 红字；P7 confirm 拦截 toast+弹窗留+未发布
//         P8 取消 → 弹窗关+未发布；P9 演示确认 → 弹窗关+Published+toast
//         P10 演示路径最终日志落本地草稿；P11 再开弹窗预填上条日志（草稿往返）
//   / C 云端段（server 注入 patched api.js：probe 恒 true + slati_user USR-
//         实测 init 激活 fcCloudMode）：
//         C1 空标题 confirm → 标题预校验 toast+弹窗留（关窗前拦截）
//         C2 确认 → POST /articles + contentJson.log 骑草稿 + 发布 id 记忆
//         C3 再发布 → 预填上条 → PUT /articles/ART-NEW-1 + 新日志
//   / E 全程零异常零 console error
// （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-publog-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
// 云端段开关：注入 patched api.js（probe 恒 true → init 激活 fcCloudMode 真管线）
let PATCH_API = false;
const API_PATCH = ';window.MN_API.probe=function(){return Promise.resolve(true);};';
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
    if (f === '/assets/js/api.js') {
      // no-store：两次导航（演示段→云端段）必须重新拉取 patched 版本
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(buf.toString('utf8') + (PATCH_API ? API_PATCH : ''));
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

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
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  const connectCdp = async (port) => {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    return cdp;
  };

  try {
    // ── F0 静态锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text();
    ok('F1 site-config：FC v10.28.48.0 + rev 00348- 占位 + 站点版本恒 v0.2.58.28',
      siteCfg.indexOf('v10.28.54.0') !== -1 && siteCfg.indexOf('00348-') !== -1 && siteCfg.indexOf('v0.2.58.28') !== -1);
    ok('F2 编辑器页静态锚：发布日志弹窗 DOM + 计数 0 / 320 + 确认发布/取消按钮',
      editorHtml.indexOf('id="publishLogModal"') !== -1 &&
      editorHtml.indexOf('id="pubLogInput"') !== -1 &&
      editorHtml.indexOf('id="pubLogCount">0 / 320') !== -1 &&
      editorHtml.indexOf('onclick="confirmPublish()"') !== -1);
    ok('F3 编辑器页静态锚：发布按钮仍锚 publishArticle + buildDraft log 字段 + applyDraft 恢复 + 输入框固定初始高 CSS（双类选择器压过 textarea.input-glass）',
      editorHtml.indexOf('onclick="publishArticle()"') !== -1 &&
      editorHtml.indexOf("log: document.getElementById('pubLogInput').value.trim()") !== -1 &&
      editorHtml.indexOf("document.getElementById('pubLogInput').value = draft.log") !== -1 &&
      editorHtml.indexOf('textarea.pub-log-input') !== -1 &&
      editorHtml.indexOf('min-height: 110px') !== -1);

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    // 云端段激活要件：USR- 用户（api.js probe 由 server 段注入补丁）
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-TEST-1' })) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const setLog = async (v) => cdp.evalJs("(function(){ var ta=document.getElementById('pubLogInput'); ta.value=" + JSON.stringify(v) + "; ta.dispatchEvent(new Event('input',{bubbles:true})); return ta.value; })()");
    const state = () => cdp.evalJs("(function(){ var ta=document.getElementById('pubLogInput'); var card=document.querySelector('#publishLogModal .modal-card'); return { backdrop: document.getElementById('modalBackdrop').classList.contains('active'), card: card ? card.classList.contains('active') : null, val: ta.value, cnt: document.getElementById('pubLogCount').textContent, over: document.getElementById('pubLogCount').classList.contains('over'), h: ta.offsetHeight, sh: ta.style.height, scrollH: ta.scrollHeight, hs: document.getElementById('headerStatus').textContent, toast: document.getElementById('toast').textContent }; })()");
    const clickBtn = (id, text) => cdp.evalJs("(function(){ var btn = Array.prototype.slice.call(document.querySelectorAll('#" + id + " button')).filter(function(b){ return b.textContent.trim() === '" + text + "'; })[0]; if (btn) btn.click(); return !!btn; })()");
    const clickPublishBtn = () => cdp.evalJs("(function(){ var b = document.querySelector('button[onclick=\"publishArticle()\"]'); if (b) b.click(); return !!b; })()");

    // ── P 演示段（probe 404 → fcCloudMode=false）──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.publishArticle", 'P 编辑器加载');
    const b1 = await clickPublishBtn();
    await sleep(200);
    let s = await state();
    ok('P1 点真发布按钮 → 弹窗开 + 空日志 + 0 / 320 + 初始固定高 ~110px',
      b1 === true && s.backdrop === true && s.card === true && s.val === '' && s.cnt === '0 / 320' &&
      s.h >= 110 && s.h <= 120, JSON.stringify(s));

    await setLog('hello world'); s = await state();
    ok('P2 "hello world" → 计数 2 / 320（按空格分词）', s.cnt === '2 / 320', s.cnt);
    await setLog('code'); s = await state();
    ok('P3 "code" → 计数 1 / 320（用户钦定口径："code"=1 词不是 4 个）', s.cnt === '1 / 320', s.cnt);

    const h0 = (await state()).h;
    await setLog(Array(8).fill('这是一行比较长的日志内容文字').join('\n'));
    s = await state();
    ok('P4 8 行日志 → 输入框随日志自动长高（固定初始高之上增长、未触顶）',
      s.h > h0 + 30 && s.h <= 226, 'h0=' + h0 + ' h=' + s.h + ' sh=' + s.sh);

    await setLog(Array(120).fill('abcdefgh').join(' '));
    s = await state();
    ok('P5 超长日志 → 高度恰达上限 220px + 内部滚动（scrollHeight>220）',
      s.sh === '220px' && s.scrollH > 220 && s.h <= 226, 'sh=' + s.sh + ' scrollH=' + s.scrollH);

    await setLog(Array(321).fill('x').join(' '));
    s = await state();
    ok('P6 321 词 → 计数 321 / 320 + 红字 .over', s.cnt === '321 / 320' && s.over === true, s.cnt + ' over=' + s.over);

    await cdp.evalJs('window.confirmPublish()');
    await sleep(200);
    s = await state();
    ok('P7 超限确认被硬拦：toast「日志超过 320 词上限」+ 弹窗仍开 + 状态徽章未变 已发布',
      s.toast === '日志超过 320 词上限，请删减' && s.backdrop === true && s.card === true && s.hs !== '已发布',
      JSON.stringify({ toast: s.toast, hs: s.hs, backdrop: s.backdrop }));

    await clickBtn('publishLogModal', '取消');
    await sleep(200);
    s = await state();
    ok('P8 取消 → 弹窗关 + 发布未发生（徽章仍 草稿）', s.backdrop === false && s.card === false && s.hs === '草稿',
      JSON.stringify({ backdrop: s.backdrop, hs: s.hs }));

    await cdp.evalJs('window.publishArticle()');
    await sleep(200);
    await setLog('初版发布 国旗上线');
    await cdp.evalJs('window.confirmPublish()');
    await sleep(200);
    s = await state();
    ok('P9 演示路径确认 → 弹窗关 + 徽章 已发布 + toast 文章发布成功！',
      s.backdrop === false && s.card === false && s.hs === '已发布' && s.toast === '文章发布成功！',
      JSON.stringify({ hs: s.hs, toast: s.toast, backdrop: s.backdrop }));

    const draftLog = await cdp.evalJs("(function(){ try { return JSON.parse(localStorage.getItem('slati_fluidcanvas_draft')).log; } catch (e) { return null; } })()");
    ok('P10 演示路径最终日志落本地草稿 log 字段', draftLog === '初版发布 国旗上线', JSON.stringify(draftLog));

    await cdp.evalJs('window.publishArticle()');
    await sleep(200);
    s = await state();
    ok('P11 再开弹窗预填上一条日志（草稿 log 往返，可继续编辑）', s.val === '初版发布 国旗上线', JSON.stringify(s.val));
    await clickBtn('publishLogModal', '取消');
    await sleep(150);

    // ── C 云端段：patched api.js（probe 恒 true）+ USR- 用户 → init 真管线激活 fcCloudMode ──
    PATCH_API = true;
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.publishArticle", 'C 云端段编辑器重载');
    // init 已跑完（probe patched → fcCloudMode 已激活）；装记录桩（发布只读 MN_API.post/request 调用点）
    await cdp.evalJs("window.__publishCalls = []; window.MN_API = { BASE: '/api', probe: function () { return Promise.resolve(true); }, isBackend: function () { return true; }, request: function (p, opts) { opts = opts || {}; window.__publishCalls.push({ m: opts.method || 'GET', p: String(p), body: opts.body || null }); return Promise.resolve({ ok: true, status: 200, data: { article: { id: 'ART-NEW-1' } }, retryAfter: null }); }, get: function (p) { return this.request(p, { method: 'GET' }); }, post: function (p, body) { return this.request(p, { method: 'POST', body: body }); }, patch: function (p, body) { return this.request(p, { method: 'PATCH', body: body }); }, del: function (p) { return this.request(p, { method: 'DELETE' }); } }; true");
    await clickPublishBtn();
    await sleep(200);
    s = await state();
    // 草稿 log 从上一段带入（applyDraft 恢复），标题空 → 关窗前拦截
    await cdp.evalJs('window.confirmPublish()');
    await sleep(200);
    s = await state();
    ok('C1 云端段空标题确认 → 标题预校验 toast「请先填写标题再发布」+ 弹窗留（关窗前拦截）',
      s.toast === '请先填写标题再发布' && s.backdrop === true && s.card === true,
      JSON.stringify({ toast: s.toast, backdrop: s.backdrop }));

    await cdp.evalJs("document.getElementById('titleInput').value = '云端测试文章'");
    await setLog('云端首版');
    await cdp.evalJs('window.confirmPublish()');
    await sleep(350);
    const c1 = await cdp.evalJs("(function(){ var arts = window.__publishCalls.filter(function (c) { return c.p.indexOf('/articles') !== -1; }); var last = arts[arts.length - 1]; var lg = null; try { lg = JSON.parse(last.body.contentJson).log; } catch (e) {} return { n: arts.length, m: last.m, p: last.p, log: lg, pubId: localStorage.getItem('slati_article_publish_id'), hs: document.getElementById('headerStatus').textContent }; })()");
    ok('C2 云端创建：POST /articles + contentJson.log 骑草稿「云端首版」+ 发布 id 记忆 + 徽章 已发布',
      c1.n === 1 && c1.m === 'POST' && c1.p === '/articles' && c1.log === '云端首版' && c1.pubId === 'ART-NEW-1' && c1.hs === '已发布',
      JSON.stringify(c1));

    await clickPublishBtn();
    await sleep(200);
    s = await state();
    const okPrefill = s.val === '云端首版';
    await setLog('云端更新');
    await cdp.evalJs('window.confirmPublish()');
    await sleep(350);
    const c2 = await cdp.evalJs("(function(){ var arts = window.__publishCalls.filter(function (c) { return c.p.indexOf('/articles') !== -1; }); var last = arts[arts.length - 1]; var lg = null; try { lg = JSON.parse(last.body.contentJson).log; } catch (e) {} return { n: arts.length, m: last.m, p: last.p, log: lg }; })()");
    ok('C3 再发布：预填上条日志 + PUT /articles/ART-NEW-1 + 新日志「云端更新」',
      okPrefill === true && c2.n === 2 && c2.m === 'PUT' && c2.p === '/articles/ART-NEW-1' && c2.log === '云端更新',
      JSON.stringify({ prefill: okPrefill, c2: c2 }));

    // ── E 全程零 Runtime exception + 零 console error ──
    ok('E1 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('E2 全程零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
    cdp.close();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  try { chrome.kill(); } catch (e) {}
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(FAIL === 0 ? 0 : 1);
})();
