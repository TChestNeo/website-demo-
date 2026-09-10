// tmp-hub-composer-probe.js — Community 三页 composer 样式恢复验证（2026-09-10 v0.2.28.7 起，v0.2.28.8 加 S11/S12 Post 白钮）
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
//   S11 亮色：Post 钮白底黑字（v0.2.28.8 用户「能不能把那个Post按钮改成白色的」）；
//   S12 深色：Post 钮仍白底黑字（亮/暗主题一致）；
//   S13 气泡延迟 0.8s（v0.2.28.9 用户「滑鼠停留的时常从1.5s改成 0.8s」——强制 :hover 计算值 0.8s/0.8s，基础态淡出 0.15s 保持）；
//   S14 亮色：侧栏 user-banner 保持亮靛蓝渐变（v0.2.28.10 只动深色）；
//   S15 深色：banner 改极暗白 4%（v0.2.28.10 用户「深色模式左侧菜单内亮色长方形」——蓝主题漏网，真身=横幅）；
//   S16 深色 mono：settings-modal 注入的暗族渐变仍赢（html[data-accent=mono][data-theme=dark] 特异性更高）；
//   S17 深色：访客「注册 / 登录」按钮改深靛蓝低调渐变+灭光晕（v0.2.28.11 真身——「还是一样」的亮块）；
//   S18 深色 mono：访客按钮 mono 暗族渐变仍赢（同特异性、settings 注入在后）；
//   S19 深色：侧栏容器铺满不透明深底 rgb(26,26,46)（v0.2.28.12 亮块真身=容器全透明透亮）；
//   S20 深色：侧栏全部 .lg-backdrop 注入层 filter/backdrop-filter 双灭（SVG 折射/磨砂伪影杜绝）；
//   S21 深色：active 菜单项高亮逻辑完好（白 8% 底+白 5% 边+白字+灭动画——修复不碰高亮）；
//   S22 亮色：侧栏容器仍透明 + 注入层滤镜/磨砂原样（v0.2.28.12 只动深色零触碰亮色）；
//   F5 文件级：sidebar.js/transitions.js 换链 + editor.html 已删 + fluidcanvas-editor 标题/头部已改（v0.2.28.13）；
//   S23 侧栏渲染：Editor 项 href=fluidcanvas-editor.html 且旧 editor.html 链接不存在（v0.2.28.13）；
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
    const whiteIdx = t.indexOf('background: #ffffff !important;');
    const hoverIdx = t.indexOf('#postSubmit:hover {');
    ok('F ' + pg + '：.composer-tool { 规则在 + 位于 v0.2.16.0 无标记本地段之后（防再洗）', toolIdx !== -1 && anchorIdx !== -1 && toolIdx > anchorIdx);
    ok('F ' + pg + '：Post 白底黑字 + hover 规则在（v0.2.28.8）', whiteIdx !== -1 && hoverIdx !== -1 && whiteIdx > anchorIdx && hoverIdx > whiteIdx);
    const delay08Idx = t.indexOf('opacity 0.15s ease 0.8s');
    const delay5Idx = t.indexOf('ease 5s');
    ok('F ' + pg + '：气泡延迟 0.8s 规则在 + 旧 5s 已除（v0.2.28.9）', delay08Idx !== -1 && delay08Idx > anchorIdx && delay5Idx === -1);
    const bannerIdx = t.indexOf(':root[data-theme="dark"] .user-banner');
    ok('F ' + pg + '：暗色横幅白 4% 规则在（v0.2.28.10 深色侧边栏块）', bannerIdx !== -1 && t.indexOf('rgba(255, 255, 255, 0.04) !important', bannerIdx) !== -1);
    const guestBtnIdx = t.indexOf('html[data-theme="dark"] .guest-module .btn-primary');
    ok('F ' + pg + '：暗色访客按钮低调渐变+灭光晕规则在（v0.2.28.11 深色侧边栏块）', guestBtnIdx !== -1 && guestBtnIdx > bannerIdx &&
      t.indexOf('#23233a', guestBtnIdx) !== -1 && t.indexOf('box-shadow: none', guestBtnIdx) !== -1);
    const sbIdx = t.indexOf(':root[data-theme="dark"] .app-sidebar {');
    const lbIdx = t.indexOf(':root[data-theme="dark"] .app-sidebar .lg-backdrop');
    const nxt = lbIdx !== -1 ? t.slice(lbIdx, lbIdx + 260) : '';
    ok('F ' + pg + '：暗色侧栏铺深底 + 注入层灭滤镜磨砂规则在（v0.2.28.12 深色侧边栏块）', sbIdx !== -1 && sbIdx > guestBtnIdx &&
      t.indexOf('background: var(--sidebar-bg)', sbIdx) !== -1 && lbIdx !== -1 && lbIdx > sbIdx &&
      nxt.indexOf('filter: none') !== -1 && nxt.indexOf('backdrop-filter: none') !== -1);
  }

  // —— F5 v0.2.28.13：Editor 直入 FC 编辑器 + 旧页删除（文件级静态断言）——
  const sideJs = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'sidebar.js'), 'utf8');
  const transJs = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'transitions.js'), 'utf8');
  const fcEd = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F5 sidebar.js：Editor href 指向 fluidcanvas-editor.html + 旧 editor.html 链接已除（v0.2.28.13）',
    sideJs.indexOf("href: '../pages/fluidcanvas-editor.html'") !== -1 && sideJs.indexOf("'../pages/editor.html'") === -1);
  ok('F5 transitions.js：NAV_ORDER 键 fluidcanvas-editor.html: 5 + 旧 editor.html 键已除（v0.2.28.13）',
    transJs.indexOf("'fluidcanvas-editor.html': 5") !== -1 && transJs.indexOf("'editor.html'") === -1);
  ok('F5 旧页 editor.html 已删除（v0.2.28.13）', !fs.existsSync(path.join(DOCS, 'pages', 'editor.html')));
  ok('F5 fluidcanvas-editor.html：标签标题 + 头部残留文案已改 FluidCanvas Editor（v0.2.28.13）',
    fcEd.indexOf('<title>FluidCanvas Editor | M.NationWorld</title>') !== -1 &&
    fcEd.indexOf('>Article Editor</span>') === -1 && fcEd.indexOf('>FluidCanvas Editor</span>') !== -1);

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

    ok('S11 亮色：Post 钮白底黑字（v0.2.28.8 白底黑字配方）', await cdp.evalJs(`(() => {
      var b = document.getElementById('postSubmit');
      var cs = getComputedStyle(b);
      return cs.backgroundColor === 'rgb(255, 255, 255)' && cs.color === 'rgb(0, 0, 0)';
    })()`));

    await waitFor(cdp, "document.querySelector('#slati-sidebar .user-banner')", 5000, '侧栏横幅就绪');
    ok('S14 亮色：侧栏 user-banner 保持亮靛蓝渐变（v0.2.28.10 只动深色）', await cdp.evalJs(`(() => {
      var cs = getComputedStyle(document.querySelector('#slati-sidebar .user-banner'));
      return cs.backgroundImage.indexOf('linear-gradient(135deg, rgb(70, 72, 212), rgb(59, 61, 196))') !== -1 &&
        cs.backgroundColor === 'rgba(0, 0, 0, 0)';
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
    ok('S12 深色：Post 钮仍白底黑字（亮/暗主题一致）', await cdp.evalJs(`(() => {
      var b = document.getElementById('postSubmit');
      var cs = getComputedStyle(b);
      return cs.backgroundColor === 'rgb(255, 255, 255)' && cs.color === 'rgb(0, 0, 0)';
    })()`));
    ok('S15 深色：侧栏 banner 改极暗白 4%（v0.2.28.10 蓝主题漏网横幅视觉消失）', await cdp.evalJs(`(() => {
      var cs = getComputedStyle(document.querySelector('#slati-sidebar .user-banner'));
      return cs.backgroundColor === 'rgba(255, 255, 255, 0.04)' && cs.backgroundImage === 'none';
    })()`));
    ok('S16 深色 mono：settings-modal 注入的暗族渐变仍赢（特异性更高）', await cdp.evalJs(`(async () => {
      document.documentElement.setAttribute('data-accent', 'mono');
      await new Promise(function (r) { setTimeout(r, 120); });
      var cs = getComputedStyle(document.querySelector('#slati-sidebar .user-banner'));
      var monoWin = cs.backgroundImage.indexOf('linear-gradient(135deg, rgb(30, 30, 45), rgb(50, 50, 74))') !== -1;
      document.documentElement.removeAttribute('data-accent');
      return monoWin;
    })()`));
    ok('S17 深色：访客「注册 / 登录」按钮深靛蓝低调渐变+白字+灭光晕（v0.2.28.11 真身）', await cdp.evalJs(`(() => {
      var b = document.querySelector('#slati-sidebar .guest-module .btn-primary');
      if (!b) return false;
      var cs = getComputedStyle(b);
      return cs.backgroundImage.indexOf('linear-gradient(135deg, rgb(35, 35, 58), rgb(52, 52, 79))') !== -1 &&
        cs.backgroundImage.indexOf('70, 72, 212') === -1 &&
        cs.color === 'rgb(255, 255, 255)' &&
        cs.boxShadow === 'none';
    })()`));
    ok('S18 深色 mono：访客按钮 mono 暗族渐变仍赢（同特异性、settings 注入在后）', await cdp.evalJs(`(async () => {
      document.documentElement.setAttribute('data-accent', 'mono');
      await new Promise(function (r) { setTimeout(r, 120); });
      var cs = getComputedStyle(document.querySelector('#slati-sidebar .guest-module .btn-primary'));
      var monoWin = cs.backgroundImage.indexOf('linear-gradient(135deg, rgb(30, 30, 45), rgb(50, 50, 74))') !== -1;
      document.documentElement.removeAttribute('data-accent');
      return monoWin;
    })()`));
    await waitFor(cdp, "document.querySelector('#slati-sidebar .lg-backdrop')", 5000, '侧栏玻璃注入层就绪');
    ok('S19 深色：侧栏容器铺满不透明深底 rgb(26,26,46)（v0.2.28.12 亮块无孔可入）', await cdp.evalJs(`(() => {
      var sb = document.getElementById('slati-sidebar');
      if (!sb) return false;
      return getComputedStyle(sb).backgroundColor === 'rgb(26, 26, 46)';
    })()`));
    ok('S20 深色：侧栏全部 .lg-backdrop 注入层 filter/backdrop 双灭（SVG 折射/磨砂伪影杜绝）', await cdp.evalJs(`(() => {
      var ls = document.querySelectorAll('#slati-sidebar .lg-backdrop');
      if (ls.length === 0) return false;
      var allOff = true;
      ls.forEach(function (l) {
        var cs = getComputedStyle(l);
        if (cs.filter !== 'none' || cs.backdropFilter !== 'none') allOff = false;
      });
      return allOff;
    })()`));
    ok('S21 深色：active 菜单项高亮逻辑完好（白 8% 底 + 白 5% 边 + 白字 + 灭动画）', await cdp.evalJs(`(() => {
      var a = document.querySelector('#slati-sidebar .nav-item.active');
      if (!a) return false;
      var cs = getComputedStyle(a);
      return cs.backgroundColor === 'rgba(255, 255, 255, 0.08)' &&
        cs.borderTopColor === 'rgba(255, 255, 255, 0.05)' &&
        cs.color === 'rgb(255, 255, 255)' && cs.animationName === 'none';
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

    ok('S22 亮色：侧栏容器仍透明 + 注入层滤镜/磨砂原样（v0.2.28.12 零触碰亮色）', await cdp.evalJs(`(() => {
      var sb = document.getElementById('slati-sidebar');
      if (!sb) return false;
      var ls = document.querySelectorAll('#slati-sidebar .lg-backdrop');
      if (ls.length === 0) return false;
      var keep = true;
      ls.forEach(function (l) {
        var cs = getComputedStyle(l);
        if (cs.filter.indexOf('lg-glass-filter') === -1 || cs.backdropFilter.indexOf('blur(14px)') === -1) keep = false;
      });
      return getComputedStyle(sb).backgroundColor === 'rgba(0, 0, 0, 0)' && keep;
    })()`));

    // —— S23 侧栏渲染链接：Editor 项直入 FC 编辑器 + 旧 editor.html 链接不存在（v0.2.28.13）——
    ok('S23 侧栏渲染：Editor 项 href=fluidcanvas-editor.html + 旧 editor.html 链接不存在（v0.2.28.13）', await cdp.evalJs(`(() => {
      var links = document.querySelectorAll('#slati-sidebar a');
      if (links.length === 0) return false;
      var hasFc = false;
      var bad = false;
      links.forEach(function (a) {
        var h = a.getAttribute('href') || '';
        if (h.slice(-'fluidcanvas-editor.html'.length) === 'fluidcanvas-editor.html') hasFc = true;
        else if (h.indexOf('editor.html') !== -1) bad = true;
      });
      return hasFc && !bad;
    })()`));

    // —— S13 强制 :hover（CSS.forcePseudoState）验气泡延迟 0.8s ——
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const doc13 = await cdp.send('DOM.getDocument', { depth: -1 });
    const tool13 = await cdp.send('DOM.querySelector', { nodeId: doc13.root.nodeId, selector: '.composer-tool' });
    const baseDelay13 = await cdp.evalJs("getComputedStyle(document.querySelector('.composer-tool'), '::after').transitionDelay");
    await cdp.send('CSS.forcePseudoState', { nodeId: tool13.nodeId, forcedPseudoClasses: ['hover'] });
    const hoverDelay13 = await cdp.evalJs("getComputedStyle(document.querySelector('.composer-tool'), '::after').transitionDelay");
    await cdp.send('CSS.forcePseudoState', { nodeId: tool13.nodeId, forcedPseudoClasses: [] });
    ok('S13 气泡延迟 0.8s（强制 :hover 计算值 0.8s/0.8s；基础态淡出 0.15s 保持）', (() => {
      const hv = hoverDelay13.split(',').map(function (s) { return parseFloat(s); });
      return hv.length === 2 && hv[0] === 0.8 && hv[1] === 0.8 &&
        baseDelay13.indexOf('0.15s') !== -1 && baseDelay13.indexOf('0.8s') === -1;
    })());

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
