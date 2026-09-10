// tmp-hub-composer-probe.js — Community 三页 composer 样式恢复验证（2026-09-10 v0.2.28.7）
// 背景：d370f05 重跑 inline-css.js（43 页）把留在 ethereal 内联标记块内的页级样式整块洗掉——
//   community-hub/post/profile 三页各丢 121 行（搜索胶囊 UI 适配 + Composer 输入框 + 发帖工具条 icon 按钮）。
//   用户「为什么Community首页顶部的输入框卡片没有做适配？」+「还有那个icon按钮又是怎么回事」。
// 断言组：
//   F1-F3 三页静态 grep：.composer-tool { 各 1 处 + 恢复块在 v0.2.16.0 本地段（无标记块）内；
//   S1 hub 页五工具钮在场（image/gif/poll/sentiment_satisfied/event）；
//   S2 钮 38×38（v0.2.15.1 钦定触控尺寸）；
//   S3 图标 24px；
//   S4 Post 钮 14px 字号 + 实高 38 与工具钮等高；
//   S5 composer-actions space-between（左工具右发布）；
//   S6 输入框背景 = --input-bg 计算值非白 + border none（v0.2.15.3 去边缘口径）；
//   S7 悬停气泡伪元素生效（content=attr(data-tip)、白底黑字、默认 hidden）；
//   S8 搜索胶囊背景 = --input-bg 计算值非白 + 1px 描边（2026-09-03 Ui 适配口径）；
//   S9 深色：输入框/胶囊背景随 --input-bg 翻深（≠亮色值且≠白）；
//   S10 深色：工具钮文字色 = --color-outline 计算值；
//   Z 全程零 console error。
// 验证口径：composer 标记由探针直接注入 feedContent（cloudMode 启动链是页面自身逻辑、线上真后端可跑，
//   非本轮恢复目标——本轮断言的是被洗后恢复的 CSS 规则对标记的适配）。
// 跑法：node tmp-hub-composer-probe.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4410 + Math.floor(Math.random() * 400);
const CDP_PORT = 5410 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-hubcomposer-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
      return;
    }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
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
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

(async () => {
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } };

  await new Promise(r => server.listen(PORT, r));

  // —— F1-F3 三页静态断言（规则回到无标记块）——
  const pages = ['community-hub.html', 'community-post.html', 'community-profile.html'];
  const ANCHOR = 'v0.2.16.0 本地段';
  for (const pg of pages) {
    const t = fs.readFileSync(path.join(DOCS, 'pages', pg), 'utf8');
    const toolIdx = t.indexOf('.composer-tool {');
    const anchorIdx = t.indexOf(ANCHOR);
    ok('F ' + pg + '：.composer-tool { 规则在 + 位于 v0.2.16.0 无标记本地段之后（防再洗）', toolIdx !== -1 && anchorIdx !== -1 && toolIdx > anchorIdx);
  }

  // —— Chrome CDP ——
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!up) throw new Error('CDP 没起来');
  const pageInfo = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' })).json();
  const cdp = new CDP(pageInfo.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  try {
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/community-hub.html' });
    await waitFor(cdp, "document.getElementById('feedContent') && document.getElementById('feedContent').innerHTML.length > 0", 10000, 'feed 就绪');

    // composer 标记 = 页面 composerHtml() 的静态输出，探针注入以验证恢复的 CSS 适配
    await cdp.evalJs(`(() => {
      document.getElementById('feedContent').innerHTML =
        '<div class="card">' +
        '<textarea id="postComposer" rows="3" maxlength="2000" placeholder="" aria-label="有什么好事？" style="width:100%;border-radius:var(--radius-md);padding:10px;color:inherit;font:inherit;resize:none;overflow-y:auto;max-height:240px;margin-bottom:8px"></textarea>' +
        '<input type="file" id="postImgInput" accept="image/*,video/*" multiple style="display:none">' +
        '<input type="file" id="postGifInput" accept="image/gif" multiple style="display:none">' +
        '<div class="pm-list" id="pendingMedia"></div>' +
        '<div class="composer-actions">' +
        '<div class="composer-tools">' +
        '<button type="button" class="composer-tool" data-action="upload" data-tip="上传图片" aria-label="上传图片"><span class="material-symbols-outlined">image</span></button>' +
        '<button type="button" class="composer-tool" data-action="gif" data-tip="GIF" aria-label="GIF"><span class="material-symbols-outlined">gif</span></button>' +
        '<button type="button" class="composer-tool" data-tip="投票" aria-label="投票"><span class="material-symbols-outlined">poll</span></button>' +
        '<button type="button" class="composer-tool" data-tip="表情符号" aria-label="表情符号"><span class="material-symbols-outlined">sentiment_satisfied</span></button>' +
        '<button type="button" class="composer-tool" data-tip="创办活动" aria-label="创办活动"><span class="material-symbols-outlined">event</span></button>' +
        '</div>' +
        '<button class="btn btn-primary btn-sm" id="postSubmit">Post</button>' +
        '</div></div>';
      return true;
    })()`);
    await waitFor(cdp, "document.querySelectorAll('.composer-tool').length >= 5", 3000, '注入就绪');
    const diag = await cdp.evalJs(`(() => JSON.stringify({
      href: location.href,
      tools: document.querySelectorAll('.composer-tool').length,
      capsule: !!document.querySelector('.search-capsule'),
      guest: document.documentElement.className
    }))()`);
    console.log('  [诊断] ' + diag);

    ok('S1 hub 页五工具钮在场（上传图片/GIF/投票/表情符号/创办活动）', await cdp.evalJs(`(() => {
      var tools = document.querySelectorAll('.composer-tool');
      return tools.length === 5 && tools[0].dataset.action === 'upload' && tools[1].dataset.action === 'gif' &&
        tools[0].dataset.tip === '上传图片' && tools[4].dataset.tip === '创办活动';
    })()`));

    ok('S2 工具钮 38×38（触控尺寸）', await cdp.evalJs(`(() => {
      var t = document.querySelector('.composer-tool');
      return t.offsetWidth === 38 && t.offsetHeight === 38;
    })()`));

    ok('S3 图标 24px', await cdp.evalJs(`(() => {
      var ic = document.querySelector('.composer-tool .material-symbols-outlined');
      return getComputedStyle(ic).fontSize === '24px';
    })()`));

    ok('S4 Post 钮 14px 字号 + 实高 38 与工具钮等高', await cdp.evalJs(`(() => {
      var b = document.getElementById('postSubmit');
      return getComputedStyle(b).fontSize === '14px' && b.offsetHeight === 38;
    })()`));

    ok('S5 composer-actions 左工具右发布（space-between）', await cdp.evalJs(`(() => {
      var ca = document.querySelector('.composer-actions');
      if (!ca) return false;
      return getComputedStyle(ca).justifyContent === 'space-between';
    })()`));

    ok('S6 输入框背景 = --input-bg 计算值非白 + 去边框（v0.2.15.3 口径）', await cdp.evalJs(`(() => {
      var c = document.getElementById('postComposer');
      var cs = getComputedStyle(c);
      return cs.backgroundColor !== 'rgb(255, 255, 255)' && cs.borderTopStyle === 'none' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    })()`));

    console.log('  [S7 调试] ' + await cdp.evalJs(`(() => {
      var t = document.querySelector('.composer-tool');
      var a = getComputedStyle(t, '::after');
      return JSON.stringify({ content: a.content, bg: a.backgroundColor, color: a.color, vis: a.visibility, opacity: a.opacity, tip: t.dataset.tip });
    })()`));
    ok('S7 悬停气泡伪元素生效（attr(data-tip) 解析为提示文案 + 白底黑字 + 默认隐藏）', await cdp.evalJs(`(() => {
      var t = document.querySelector('.composer-tool');
      var a = getComputedStyle(t, '::after');
      return a.content.replace(/"/g, '') === t.dataset.tip && a.backgroundColor === 'rgb(255, 255, 255)' &&
        a.color === 'rgb(0, 0, 0)' && a.visibility === 'hidden';
    })()`));

    ok('S8 搜索胶囊背景 = --input-bg 计算值非白 + 1px 描边（09-03 Ui 适配口径）', await cdp.evalJs(`(() => {
      var c = document.querySelector('.search-capsule');
      if (!c) return false;
      var cs = getComputedStyle(c);
      return cs.backgroundColor !== 'rgb(255, 255, 255)' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        cs.borderTopWidth === '1px' && cs.borderTopStyle !== 'none';
    })()`));

    // —— 深色模式（直设 data-theme + localStorage 同步 = 主题 pill 等价）——
    const lightBg = await cdp.evalJs("getComputedStyle(document.getElementById('postComposer')).backgroundColor");
    const lightCapsule = await cdp.evalJs("getComputedStyle(document.querySelector('.search-capsule')).backgroundColor");
    await cdp.evalJs(`(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      var s = JSON.parse(localStorage.getItem('slati_settings') || '{}');
      s.theme = 'dark';
      localStorage.setItem('slati_settings', JSON.stringify(s));
      return true;
    })()`);
    await sleep(500);
    ok('S9 深色：输入框 + 搜索胶囊背景随 --input-bg 翻深（≠亮色值且非白）', await cdp.evalJs(`(() => {
      var cb = getComputedStyle(document.getElementById('postComposer')).backgroundColor;
      var cc = getComputedStyle(document.querySelector('.search-capsule')).backgroundColor;
      var lightBg = ${JSON.stringify(lightBg)}, lightCapsule = ${JSON.stringify(lightCapsule)};
      return cb !== 'rgb(255, 255, 255)' && cb !== lightBg && cc !== 'rgb(255, 255, 255)' && cc !== lightCapsule;
    })()`));
    ok('S10 深色：工具钮文字色 = --color-outline 计算值', await cdp.evalJs(`(() => {
      var t = document.querySelector('.composer-tool');
      var probe = document.createElement('span');
      probe.style.color = 'var(--color-outline)';
      document.body.appendChild(probe);
      var outUsed = getComputedStyle(probe).color;
      probe.remove();
      return getComputedStyle(t).color === outUsed;
    })()`));
    // 恢复亮色
    await cdp.evalJs(`(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      var s = JSON.parse(localStorage.getItem('slati_settings') || '{}');
      s.theme = 'light';
      localStorage.setItem('slati_settings', JSON.stringify(s));
      return true;
    })()`);
    await sleep(500);

    ok('Z 零 console error', cdp.errs.length === 0);
  } catch (e) {
    fail++;
    console.log('  ❌ 异常: ' + e.message);
  }

  console.log('\n结果: ' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  cdp.close();
  chrome.kill();
  server.close();
  process.exit(fail ? 1 : 0);
})();
