// tmp-settings-menu-probe.js — Settings 弹窗左侧菜单 CDP 断言（2026-09-10 v3）
// 用户口径：「能不能在设置的窗口左侧添加一个菜单」——六区块从长滚动页改成左菜单+右内容区；
// 同晚追加「覆盖整个页面但是一样是弹窗类似discord的那种大小」——卡片 Discord 式全屏（无圆角无边框）；
// 再追加「我要有边缘的」——近全屏大弹窗带 24px 边缘（四周露底、圆角/边框恢复）；
// 再追加「主题色分成黑白和蓝白两种 + 按钮上下两部分（上半部配色下半部名称）」——Accent Color 区块；
// 再追加「深色模式下按钮和卡片不要变白 除了文字」——深色 mono 适配（S4e）。
// S1 菜单 6 项（Profile/Appearance/Notifications/Privacy/Language/Account）顺序正确；
// S2 默认态：Profile 可见、其余 5 个隐藏、菜单第 1 项 active；
// S3 卡片近全屏带 24px 边缘（宽=布局视口-48、高=innerHeight-48、圆角/边框恢复）；
// S4 点 Appearance → 区块切换 + active 跟随 + 4 主题 pill；
// S4b Accent Color 区块（Font Size 下方、2 chip 上 swatch 下名称、默认 Blue active）；
// S4c 点 Mono → data-accent=mono + 持久化 + 主色真翻黑白（变数级+实际元素双重断言）+ 主按钮渐变去蓝；
// S4d 点回 Blue → data-accent 移除 + 主色回蓝（恢复路径）；
// S4e 深色 Mono → 文字级主色近白 #ececf2 + 主按钮纯黑族 #1e1e2d 底白字 + 开关黑族；
// S4f 深色侧边栏 → 选中项暗底白字 + navGlow 禁用 + 模块边框/分割线 0.05 + banner/FAB 黑族渐变；
// S4g 深色 Blue 侧边栏 → ethereal 暗色规则 accent 无关（两种主题色同款暗色选中态）；
// S4h 深色 → .lg-specular 白光层全灭（用户「卡片中间的那个白光」真身=镜面高光层 display:none）；
// S4i 切回亮色 → specular 高光恢复（亮色保留 rdev 配方）；
// S4j 深色 Mono → Create World CTA 白底黑字（用户「在深色模式下你把他改成白底黑字的」，压过 mono 黑族）；
// S4j2 深色 Blue → CTA 同样白底黑字（规则只按 data-theme，accent 无关）；
// S4k 亮色 → CTA 保持亮蓝紫渐变（深色白底口径不影响亮色）；
// S5 点 Account → 区块切换 + Logout/Delete 按钮在场；
// S6 窄视口（390px）菜单退化为横向行（flex-direction row）；
// S7 平台首页 index.html → Create World CTA 带 create-world-cta 类 + 亮色亮蓝紫渐变（v0.2.28.6 用户「我是指平台首页的那个Create World」）；
// S8 平台首页深色 → CTA 白底黑字（同 v0.2.28.5 配方搬到 index，直设 data-theme + localStorage 同步 = pill 等价）；
// Z 全程零 console error。跑法：node tmp-settings-menu-probe.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3910 + Math.floor(Math.random() * 400);
const CDP_PORT = 4910 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-setmenu-' + Date.now());

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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.errs.push(m.params.exceptionDetails.text || 'exception');
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + r.exceptionDetails.text);
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
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
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
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/overview.html' });
    await waitFor(cdp, "window.SlatiSettings", 10000, 'SlatiSettings 就绪');
    await cdp.evalJs("window.SlatiSettings.open(); true");
    await waitFor(cdp, "document.getElementById('settingsMenu')", 5000, '设置菜单出现');

    ok('S1 菜单 6 项顺序正确', await cdp.evalJs(`(() => {
      var want = ['Profile','Appearance','Notifications','Privacy','Language','Account'];
      // textContent 会连 icon 连字文本（personProfile）——只取最后文字 span
      var items = Array.from(document.querySelectorAll('#settingsMenu .settings-menu-item'))
        .map(function(b){ return b.querySelector('span:last-child').textContent.trim(); });
      return items.length === 6 && want.every(function(w,i){ return items[i] === w; });
    })()`));
    ok('S2 默认态 Profile 可见 + 其余隐藏 + 第 1 项 active', await cdp.evalJs(`(() => {
      var secs = Array.from(document.querySelectorAll('#settingsCard .settings-sec'));
      var items = document.querySelectorAll('#settingsMenu .settings-menu-item');
      return secs.length === 6 && !secs[0].classList.contains('settings-sec-hidden') &&
        secs.slice(1).every(function(s){ return s.classList.contains('settings-sec-hidden'); }) &&
        items[0].classList.contains('active') && !items[1].classList.contains('active');
    })()`));
    ok('S3 卡片近全屏带 24px 边缘（宽=布局视口-48、高=innerHeight-48、圆角+边框恢复）', await cdp.evalJs(`(() => {
      var c = document.getElementById('settingsCard');
      var cs = getComputedStyle(c);
      // fixed inset:0 的含块 = 布局视口（文档可视区 clientWidth，不含 15px 滚动条槽——innerWidth 多 15px 必挂）；
      // 「我要有边缘的」口径：四周 24px 空隙 + 圆角/边框回来（不再是 0 圆角无边框铺满）
      return Math.abs(c.clientWidth - (document.documentElement.clientWidth - 48)) <= 2 &&
        Math.abs(c.clientHeight - (window.innerHeight - 48)) <= 2 &&
        parseFloat(cs.borderTopLeftRadius) > 0 && cs.maxWidth === 'none' && cs.borderTopStyle !== 'none';
    })()`));

    // 点 Appearance → 区块切换 + active 跟随 + 主题 pill 内容在场
    await cdp.evalJs("document.querySelectorAll('#settingsMenu .settings-menu-item')[1].click(); true");
    await sleep(200);
    ok('S4 点 Appearance：区块切换 + active 跟随 + 4 主题 pill', await cdp.evalJs(`(() => {
      var secs = Array.from(document.querySelectorAll('#settingsCard .settings-sec'));
      var items = document.querySelectorAll('#settingsMenu .settings-menu-item');
      return secs[0].classList.contains('settings-sec-hidden') && !secs[1].classList.contains('settings-sec-hidden') &&
        secs.slice(2).every(function(s){ return s.classList.contains('settings-sec-hidden'); }) &&
        items[1].classList.contains('active') && !items[0].classList.contains('active') &&
        document.querySelectorAll('#themeSubnav .subnav-pill').length === 4;
    })()`));

    // 主题色（用户「主题色分成黑白和蓝白两种 + 按钮上下两部分」）：Accent Color 区块在 Font Size 下方、
    // 两个 chip 各是「上半部 swatch + 下半部名称」，默认 Blue active
    ok('S4b Accent Color 区块：位于 Font Size 下方 + 2 chip（上 swatch 下名称）+ 默认 Blue active', await cdp.evalJs(`(() => {
      var fs = document.getElementById('fontSizeSubnav');
      var ac = document.getElementById('accentSubnav');
      if (!fs || !ac) return false;
      var chips = Array.from(ac.querySelectorAll('.accent-chip'));
      var pos = !!(fs.compareDocumentPosition(ac) & 4); // fs.compareDocumentPosition(ac) 的 FOLLOWING 位 = ac 在 fs 之后
      var struct = chips.length === 2 && chips.every(function (c) {
        return c.firstElementChild && c.firstElementChild.classList.contains('accent-swatch') &&
          c.lastElementChild && c.lastElementChild.classList.contains('accent-name');
      });
      var labels = chips.map(function (c) { return c.querySelector('.accent-name').textContent.trim(); });
      // 坑：style.background 读回被 Chrome 规范化成 rgb() 而非 #hex——去空格后比
      var sw = chips[0].querySelector('.accent-swatch').style.background.replace(/\\s+/g, '');
      var swMono = getComputedStyle(chips[1].querySelector('.accent-swatch')).backgroundImage;
      return pos && struct && labels[0] === 'Blue' && labels[1] === 'Mono' &&
        sw === 'rgb(70,72,212)' && swMono.indexOf('linear-gradient') !== -1 && chips[0].classList.contains('active');
    })()`));

    // 点 Mono → html[data-accent=mono] + active 跟随 + 持久化 + 主色真翻黑白（变数级 + 实际元素双重断言；
    // 主按钮渐变同时去蓝——硬编码 #5b5de0 伴色必须被 mono 覆盖）
    await cdp.evalJs("document.querySelectorAll('#accentSubnav .accent-chip')[1].click(); true");
    await sleep(200);
    ok('S4c 点 Mono：data-accent=mono + active 跟随 + 持久化 + 主色翻黑白 + 主按钮渐变去蓝', await cdp.evalJs(`(() => {
      var chips = document.querySelectorAll('#accentSubnav .accent-chip');
      var saved = JSON.parse(localStorage.getItem('slati_settings') || '{}').accent;
      var pv = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
      var t = document.createElement('span'); t.style.color = 'var(--color-primary)';
      document.body.appendChild(t);
      var used = getComputedStyle(t).color.replace(/\\s+/g, '');
      t.remove();
      var b = document.createElement('button'); b.className = 'btn-primary';
      document.body.appendChild(b);
      var bbg = getComputedStyle(b).backgroundImage.replace(/\\s+/g, '');
      b.remove();
      return document.documentElement.getAttribute('data-accent') === 'mono' &&
        chips[1].classList.contains('active') && !chips[0].classList.contains('active') &&
        saved === 'mono' && pv === '#1c1c22' && used === 'rgb(28,28,34)' &&
        bbg.indexOf('rgb(28,28,34)') !== -1 && bbg.indexOf('rgb(91,93,224)') === -1;
    })()`));

    // 点回 Blue → data-accent 移除 + 主色回蓝（恢复路径，防止残留状态）
    await cdp.evalJs("document.querySelectorAll('#accentSubnav .accent-chip')[0].click(); true");
    await sleep(200);
    ok('S4d 点回 Blue：data-accent 移除 + active 跟随 + 主色回蓝', await cdp.evalJs(`(() => {
      var chips = document.querySelectorAll('#accentSubnav .accent-chip');
      var pv = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
      var t = document.createElement('span'); t.style.color = 'var(--color-primary)';
      document.body.appendChild(t);
      var used = getComputedStyle(t).color.replace(/\\s+/g, '');
      t.remove();
      return !document.documentElement.hasAttribute('data-accent') &&
        chips[0].classList.contains('active') && !chips[1].classList.contains('active') &&
        pv === '#4648d4' && used === 'rgb(70,72,212)';
    })()`));

    // 深色 mono 适配（用户「深色模式下按钮和卡片不要变白 除了文字」+「按钮怎么变成灰色的了」）：
    // 切 Dark + Mono → 文字级主色仍近白 #ececf2，主按钮翻纯黑族 #1e1e2d（不再是灰 #3a3a44）
    // + 显式白字（--color-on-primary 深色 mono 是近黑，不翻白字会黑字压黑底），开关同黑族，菜单 active tint 中性灰
    await cdp.evalJs("document.querySelector('#themeSubnav .subnav-pill[data-theme=dark]').click(); true");
    await sleep(150);
    await cdp.evalJs("document.querySelectorAll('#accentSubnav .accent-chip')[1].click(); true");
    await sleep(500); // 开关 background 有 0.2s 过渡——不等到过渡结束会读到插值（transition 竞态）
    ok('S4e 深色 Mono：文字近白 + 主按钮纯黑族底白字 + 开关黑族不白化', await cdp.evalJs(`(() => {
      var pv = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
      var b = document.createElement('button'); b.className = 'btn-primary';
      document.body.appendChild(b);
      var cs = getComputedStyle(b);
      var bbg = cs.backgroundImage.replace(/\\s+/g, '');
      var bcol = cs.color.replace(/\\s+/g, '');
      b.remove();
      var tog = document.querySelector('#settingsCard .toggle-switch');
      var togBg = tog ? getComputedStyle(tog).backgroundColor.replace(/\\s+/g, '') : null;
      var menuActive = getComputedStyle(document.querySelector('#settingsMenu .settings-menu-item.active')).backgroundColor.replace(/\\s+/g, '');
      return document.documentElement.getAttribute('data-theme') === 'dark' &&
        document.documentElement.getAttribute('data-accent') === 'mono' &&
        pv === '#ececf2' &&
        bbg.indexOf('rgb(30,30,45)') !== -1 && bbg.indexOf('rgb(236,236,242)') === -1 && bcol === 'rgb(255,255,255)' &&
        togBg === 'rgb(30,30,45)' &&
        menuActive === 'rgba(118,117,134,0.1)';
    })()`));

    // 深色侧边栏（用户「选中态改暗色深色调 + 清除容器白边框/阴影/分割线」）：
    // 弹窗底下的页面侧边栏——nav 选中项暗底白字 + navGlow 禁用（forwards 填充会盖过规则）、
    // 模块卡片边框/分割线降为 rgba(255,255,255,0.05)、banner/AI 悬浮球白渐变翻黑族
    ok('S4f 深色侧边栏：选中项暗底白字无辉光 + 模块边框/分割线 0.05 + banner/FAB 黑族渐变', await cdp.evalJs(`(() => {
      var nv = document.querySelector('#slati-sidebar .nav-item.active');
      var nvCs = nv ? getComputedStyle(nv) : null;
      var mod = document.querySelector('#slati-sidebar .sidebar-module');
      var modBorder = mod ? getComputedStyle(mod).borderTopColor.replace(/\\s+/g, '') : null;
      var div = document.querySelector('#slati-sidebar .sidebar-divider');
      var divBg = div ? getComputedStyle(div).backgroundColor.replace(/\\s+/g, '') : 'none';
      var bn = document.querySelector('#slati-sidebar .user-banner');
      var bnBg = bn ? getComputedStyle(bn).backgroundImage.replace(/\\s+/g, '') : '';
      var fav = document.querySelector('.featured-nation-avatar');
      var favBg = fav ? getComputedStyle(fav).backgroundImage.replace(/\\s+/g, '') : '';
      return nvCs !== null &&
        nvCs.backgroundColor.replace(/\\s+/g, '') === 'rgba(255,255,255,0.08)' &&
        nvCs.color.replace(/\\s+/g, '') === 'rgb(255,255,255)' &&
        nvCs.animationName === 'none' &&
        modBorder === 'rgba(255,255,255,0.05)' &&
        divBg === 'rgba(255,255,255,0.05)' &&
        bnBg.indexOf('rgb(30,30,45)') !== -1 && bnBg.indexOf('rgb(236,236,242)') === -1 &&
        favBg.indexOf('rgb(30,30,45)') !== -1 && favBg.indexOf('rgb(236,236,242)') === -1;
    })()`));
    // Create World CTA 深色口径（用户「在深色模式下你把他改成白底黑字的」）：白底黑字+白色辉光，
    // !important 压过 mono 黑族 btn-primary——弹窗背后页面 DOM 照常可读
    ok('S4j 深色 Mono：Create World CTA 白底黑字', await cdp.evalJs(`(() => {
      var b = document.querySelector('.btn.create-world-cta');
      if (!b) return false;
      var cs = getComputedStyle(b);
      return cs.backgroundColor.replace(/\\s+/g, '') === 'rgb(255,255,255)' &&
        cs.color.replace(/\\s+/g, '') === 'rgb(0,0,0)';
    })()`));
    // 深色蓝主题下侧边栏同样走 ethereal 暗色规则（accent 无关）——切 Blue 断言再切回 Mono
    await cdp.evalJs("document.querySelectorAll('#accentSubnav .accent-chip')[0].click(); true");
    await sleep(200);
    ok('S4g 深色 Blue 侧边栏：选中项同样暗底白字无辉光（ethereal 统一规则）', await cdp.evalJs(`(() => {
      var nv = document.querySelector('#slati-sidebar .nav-item.active');
      var nvCs = nv ? getComputedStyle(nv) : null;
      return nvCs !== null &&
        nvCs.backgroundColor.replace(/\\s+/g, '') === 'rgba(255,255,255,0.08)' &&
        nvCs.color.replace(/\\s+/g, '') === 'rgb(255,255,255)' &&
        nvCs.animationName === 'none';
    })()`));
    ok('S4j2 深色 Blue：Create World CTA 白底黑字（规则只按 data-theme，accent 无关）', await cdp.evalJs(`(() => {
      var b = document.querySelector('.btn.create-world-cta');
      if (!b) return false;
      var cs = getComputedStyle(b);
      return cs.backgroundColor.replace(/\\s+/g, '') === 'rgb(255,255,255)' &&
        cs.color.replace(/\\s+/g, '') === 'rgb(0,0,0)';
    })()`));
    await cdp.evalJs("document.querySelectorAll('#accentSubnav .accent-chip')[1].click(); true");
    await sleep(200);
    // 深色白光（用户「卡片中间的那个白光」真身）：.lg-specular 镜面高光层 display:none 全灭
    // （弹窗卡 + 侧栏 3 模块 + 页面各卡；亮色保留 rdev 高光由 S4i 验证恢复）
    ok('S4h 深色：.lg-specular 白光层全灭（弹窗卡+侧栏+页面卡 无一处可见）', await cdp.evalJs(`(() => {
      var specs = Array.from(document.querySelectorAll('.lg-specular'));
      if (specs.length === 0) return false;
      var sc = document.getElementById('settingsCard');
      var scSpec = sc ? sc.querySelector(':scope > .lg-specular') : null;
      return specs.every(function (s) { return getComputedStyle(s).display === 'none'; }) &&
        scSpec !== null && getComputedStyle(scSpec).display === 'none';
    })()`));
    // 恢复 Blue + Light，防污染后续断言
    await cdp.evalJs("document.querySelectorAll('#accentSubnav .accent-chip')[0].click(); true");
    await cdp.evalJs("document.querySelector('#themeSubnav .subnav-pill[data-theme=light]').click(); true");
    await sleep(200);
    // 亮色恢复：specular 高光回场（暗色规则只在 data-theme=dark 下生效）
    ok('S4i 切回亮色：specular 高光恢复 display≠none（rdev 配方保留）', await cdp.evalJs(`(() => {
      var sc = document.getElementById('settingsCard');
      var scSpec = sc ? sc.querySelector(':scope > .lg-specular') : null;
      return scSpec !== null && getComputedStyle(scSpec).display !== 'none';
    })()`));
    // 亮色下 CTA 依然亮蓝紫（四主题一致高亮，非只暗色特殊）
    ok('S4k 亮色：Create World CTA 依然亮蓝紫渐变', await cdp.evalJs(`(() => {
      var b = document.querySelector('.btn.create-world-cta');
      if (!b) return false;
      var bg = getComputedStyle(b).backgroundImage.replace(/\\s+/g, '');
      return bg.indexOf('rgb(106,108,255)') !== -1 && bg.indexOf('rgb(177,77,255)') !== -1;
    })()`));

    // 点 Account → 区块切换 + Logout/Delete 在场
    await cdp.evalJs("document.querySelectorAll('#settingsMenu .settings-menu-item')[5].click(); true");
    await sleep(200);
    ok('S5 点 Account：区块切换 + Logout/Delete 按钮在场', await cdp.evalJs(`(() => {
      var secs = Array.from(document.querySelectorAll('#settingsCard .settings-sec'));
      var items = document.querySelectorAll('#settingsMenu .settings-menu-item');
      return !secs[5].classList.contains('settings-sec-hidden') && secs[0].classList.contains('settings-sec-hidden') &&
        items[5].classList.contains('active') && !!document.getElementById('setLogoutBtn') && !!document.getElementById('setDeleteBtn');
    })()`));

    // 窄视口：菜单退化为横向行
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(300);
    ok('S6 390px 窄视口菜单横向行 (flex-direction row)', await cdp.evalJs("getComputedStyle(document.getElementById('settingsMenu')).flexDirection === 'row'"));
    await cdp.send('Emulation.clearDeviceMetricsOverride');

    // —— 平台首页 index.html CTA（v0.2.28.6；用户「我是指平台首页的那个Create World」）——
    // 前置 S4i 已恢复 Blue + Light 并持久化；index 内联 theme-init 同步读 localStorage → 亮色落地
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/index.html' });
    await waitFor(cdp, "document.querySelector('.btn.create-world-cta')", 10000, '平台首页 CTA 就绪');
    ok('S7 平台首页：Create World CTA 带 create-world-cta 类 + 亮色亮蓝紫渐变', await cdp.evalJs(`(() => {
      var b = document.querySelector('.btn.create-world-cta');
      if (!b) return false;
      if (b.getAttribute('href') !== 'pages/create-world.html') return false;
      var bg = getComputedStyle(b).backgroundImage.replace(/\\s+/g, '');
      return bg.indexOf('rgb(106,108,255)') !== -1 && bg.indexOf('rgb(177,77,255)') !== -1 &&
        getComputedStyle(b).color.replace(/\\s+/g, '') === 'rgb(255,255,255)';
    })()`));
    // 深色：直设 data-theme + localStorage 同步（= 主题 pill 点击等价；index 页加载时 applyTheme() 回读 localStorage
    // 不打架）；0.2s 切换过渡竞态 → 等 500ms
    await cdp.evalJs(`(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      var s = JSON.parse(localStorage.getItem('slati_settings') || '{}');
      s.theme = 'dark';
      localStorage.setItem('slati_settings', JSON.stringify(s));
      return true;
    })()`);
    await sleep(500);
    ok('S8 平台首页深色：CTA 白底黑字', await cdp.evalJs(`(() => {
      var cs = getComputedStyle(document.querySelector('.btn.create-world-cta'));
      return cs.backgroundColor.replace(/\\s+/g, '') === 'rgb(255,255,255)' &&
        cs.color.replace(/\\s+/g, '') === 'rgb(0,0,0)';
    })()`));
    // 恢复亮色 + localStorage（收尾状态干净）
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
