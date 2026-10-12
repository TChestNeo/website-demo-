// tmp-build-micronationary.js — 三页合一（overview+explore+guidelines → micronationary.html）
// 用户口径：MicroNationary 整个变成一个页面，标签结构用 /micronationary?showTab=overview|explore|guidelines
// 规则：主视图 = 各页 <main> 内容（subnav 药丸 href 改写为 /micronationary?showTab=...）；
//       样式 = 三页全部 <style> 块按序并入（后定义覆盖先定义，同值重复无害）；
//       脚本 = 共享 <script src> 只挂一份 + 三页内联逻辑块按序并入（跳过 MN_I18N.apply 与 pre-stagger 兜底块）；
//       尾部自写：showTab 控制器 + pre-stagger 兜底 + i18n 三词典 apply + subnav 克隆同步。
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PAGES = path.join(REPO, 'docs', 'pages');
const OUT = path.join(PAGES, 'micronationary.html');

const read = (f) => fs.readFileSync(path.join(PAGES, f), 'utf8');
const ov = read('overview.html');
const ex = read('explore.html');
const gl = read('guidelines.html');

// ── 1. 提取各页 <main class="app-main"> 内容 ──
function mainOf(html) {
  const m = /<main class="app-main">([\s\S]*?)<\/main>/.exec(html);
  if (!m) throw new Error('main 未匹配');
  return m[1];
}
// 药丸/页内互链改写：旧三页 href → 单页 showTab 结构（绝对路径，base 不影响）
function rewriteLinks(s) {
  return s
    .replace(/href="overview\.html"/g, 'href="/micronationary?showTab=overview"')
    .replace(/href="explore\.html"/g, 'href="/micronationary?showTab=explore"')
    .replace(/href="guidelines\.html"/g, 'href="/micronationary?showTab=guidelines"');
}
// v0.2.59.33 顶部导航参考社区页（单一标签行 + 右侧搜索胶囊）：
// 各视图自带的 Sub nav 行整块摘除——标签挪到三视图上方的共享顶部导航
function stripSubnav(s) {
  return s.replace(/<!-- Sub nav -->\s*<div[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*/, '');
}
const ovMain = rewriteLinks(stripSubnav(mainOf(ov)));
const exMain = rewriteLinks(stripSubnav(mainOf(ex)));
const glMain = rewriteLinks(stripSubnav(mainOf(gl)));

// ── 2. 样式：三页全部 <style> 块 ──
function stylesOf(html) {
  const out = [];
  const re = /<style>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[0]);
  return out;
}
const allStyles = [].concat(stylesOf(ov), stylesOf(ex), stylesOf(gl)).join('\n');

// ── 3. head 内联脚本（取 explore：防主题白闪 + 会话 guest 门） ──
function headScriptsOf(html) {
  const head = /<head>([\s\S]*?)<\/head>/.exec(html);
  if (!head) return '';
  const out = [];
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(head[1]))) out.push(m[0]);
  return out.join('\n');
}
const headScripts = headScriptsOf(ex);

// ── 4. body 内联逻辑块（跳过 i18n apply 与 pre-stagger 兜底） ──
function bodyInlineScriptsOf(html) {
  const i = html.indexOf('<body');
  const body = html.slice(i);
  const out = [];
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(body))) {
    const inner = m[1];
    if (inner.indexOf('MN_I18N.apply') !== -1) continue;
    if (inner.indexOf('pre-stagger') !== -1) continue;
    out.push(m[0]);
  }
  return out.join('\n');
}
const logicScripts = [bodyInlineScriptsOf(ov), bodyInlineScriptsOf(ex), bodyInlineScriptsOf(gl)].join('\n');

// ── 5. 组装 ──
const SHARED = [
  'tilt.js', 'site-config.js', 'storage.js', 'api.js', 'sidebar.js', 'settings-modal.js',
  'liquid-glass.js', 'pricing.js', 'subnav.js', 'transitions.js', 'i18n.js',
  'common.i18n.js', 'overview.i18n.js', 'explore.i18n.js', 'guidelines.i18n.js'
].map((f) => {
  const dir = f.endsWith('.i18n.js') ? 'i18n' : 'js';
  return '<script src="../assets/' + dir + '/' + f + '"></script>';
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="icon" type="image/png" href="../assets/image/M.NationWorld logo circle_.png">
  <!-- v0.2.59.26 单页合并：/micronationary 根路径服务时，相对链仍解析回 /pages/（article.html、create-world.html…） -->
  <base href="/pages/">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MicroNationary | M.NationWorld</title>
${headScripts}
${allStyles}
  <style>
/* v0.2.59.26 三视图切换（视图节默认块级；隐藏节零尺寸） */
.mn-view { display: block; }
.mn-view[hidden-view] { display: none !important; }
</style>
</head>
<body class="pre-stagger">

<div class="app-layout">
  <aside class="app-sidebar" id="slati-sidebar"></aside>
  <main class="app-main">

    <!-- v0.2.59.33 顶部导航（社区页结构：左侧标签药丸 + 右侧搜索胶囊，三视图共享一条） -->
    <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-md);flex-wrap:wrap">
      <div class="subnav" data-slider id="mnTopSubnav">
        <a href="/micronationary?showTab=overview" class="subnav-pill" data-i18n="ov.nav.overview">Overview</a>
        <a href="/micronationary?showTab=explore" class="subnav-pill" data-i18n="ov.nav.explore">Explore</a>
        <a href="/micronationary?showTab=guidelines" class="subnav-pill" data-i18n="ov.nav.guidelines">Guidelines</a>
      </div>
      <div class="search-capsule" style="margin-left:auto" id="mnTopSearchCapsule">
        <span class="material-symbols-outlined">search</span>
        <input type="text" id="mnTopSearchInput" placeholder="Search worlds, articles..." data-i18n-placeholder="ex.ph.search" autocomplete="off">
      </div>
    </div>

    <!-- 一页三视图：/micronationary?showTab=overview|explore|guidelines（顶部标签即切换，切页不刷新） -->
    <section class="mn-view" id="view-overview">
${ovMain}
    </section>

    <section class="mn-view" id="view-explore" hidden-view>
${exMain}
    </section>

    <section class="mn-view" id="view-guidelines" hidden-view>
${glMain}
    </section>

  </main>
</div>

${SHARED}
${logicScripts}
<script>
/* v0.2.59.26 showTab 控制器（v0.2.59.33 顶部单标签行）：读参数显视图、切标签 replaceState 不刷新（href 保留供中键/新标签） */
(function () {
  var TABS = ['overview', 'explore', 'guidelines'];
  var TOP = document.getElementById('mnTopSubnav');
  function show(tab) {
    if (TABS.indexOf(tab) === -1) tab = 'overview';
    // v0.2.59.32 先记下旧激活 pill 位置（切换后再取就变成新位置了）
    var prevPill = TOP ? TOP.querySelector('.subnav-pill.active') : null;
    var prevLeft = prevPill ? prevPill.offsetLeft : null;
    var prevWidth = prevPill ? prevPill.offsetWidth : null;
    TABS.forEach(function (t) {
      var v = document.getElementById('view-' + t);
      if (v) v.toggleAttribute('hidden-view', t !== tab);
    });
    if (TOP) TOP.querySelectorAll('.subnav-pill').forEach(function (p) {
      var h = p.getAttribute('href') || '';
      p.classList.toggle('active', h.indexOf('showTab=' + tab) !== -1);
    });
    try { history.replaceState(null, '', '/micronationary?showTab=' + tab); } catch (e) {}
    // v0.2.59.32 滑动高亮动画：单标签行内从旧 pill 位置滑到新 pill
    if (TOP && TOP._animateTo) TOP._animateTo(prevLeft, prevWidth);
  }
  window.mnShowTab = show;
  var m = /[?&]showTab=([a-z]+)/.exec(location.search);
  show(m ? m[1] : 'overview');
  // capture 层拦截：先于 transitions.js 冒泡层锚点击接管，实现无刷新切标签
  document.addEventListener('click', function (e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('.subnav-pill') : null;
    if (!a) return;
    var h = a.getAttribute('href') || '';
    var mm = /showTab=([a-z]+)/.exec(h);
    if (mm && h.indexOf('/micronationary') !== -1) {
      e.preventDefault();
      e.stopPropagation();
      show(mm[1]);
    }
  }, true);
  // v0.2.59.33 顶部搜索胶囊（社区页同款）：回车 → 切到探索视图并跑搜索；点胶囊 → 切到探索并聚焦大搜索栏
  var TSI = document.getElementById('mnTopSearchInput');
  if (TSI) {
    TSI.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = TSI.value.trim();
      if (!q) return;
      show('explore');
      setTimeout(function () {
        var big = document.getElementById('exSearchInput');
        if (big) {
          big.value = q;
          if (typeof filterNations === 'function') filterNations(q);
          if (typeof exDoSearch === 'function') exDoSearch(q);
        }
      }, 80);
    });
    var cap = document.getElementById('mnTopSearchCapsule');
    if (cap) cap.addEventListener('click', function (e) {
      if (e.target === TSI) return;
      show('explore');
      setTimeout(function () { var big = document.getElementById('exSearchInput'); if (big) big.focus(); }, 80);
    });
  }
})();
</script>
<script>/* pre-stagger 兜底（切页闪修复 08-28）：transitions.js 未执行时 1.6s 解除隐藏防永久空白 */
setTimeout(function () { var b = document.body; if (b) b.classList.remove('pre-stagger'); }, 1600);
</script>
<script>
/* v0.2.59.26 i18n：三页词典统一 apply + 语言切换重应用 + subnav 克隆文字同步 */
MN_I18N.apply();
if (window.MN_I18N && MN_I18N.onChange) {
  MN_I18N.onChange(function () {
    MN_I18N.apply();
    var clones = document.querySelectorAll('.subnav-highlight-clone');
    var pills = document.querySelectorAll('.subnav-pill');
    for (var i = 0; i < clones.length && i < pills.length; i++) {
      clones[i].textContent = pills[i].textContent;
    }
  });
}
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log('已写出:', OUT, html.length, '字符');
console.log('视图长度: ov=' + ovMain.length + ' ex=' + exMain.length + ' gl=' + glMain.length);
console.log('样式块数: ov=' + stylesOf(ov).length + ' ex=' + stylesOf(ex).length + ' gl=' + stylesOf(gl).length);
