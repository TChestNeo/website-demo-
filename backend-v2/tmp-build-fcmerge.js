/**
 * tmp-build-fcmerge.js — v0.2.45.0 FC 三页合一（Douyin 式 URL 视图切换）
 *
 * 把 fluidcanvas-analytics.html / fluidcanvas-articles.html 的内容列 DOM + 页面 CSS + 主脚本
 * 拼进 fluidcanvas.html，成为 ?view=analytics / ?view=articles 两个新视图；
 * 首页既有三视图（dashboard/upload/content）同步 URL 化（pushState/popstate + 旧 hash 兼容）。
 * 编辑器页不动。
 *
 * 注意：本脚本从两源页读取代码 —— 必须先于「源页重写为重定向 stub」执行！
 * 每个锚点断言恰好出现一次，漂移即抛错；写完后重读输出自检。
 * 用法：repo 根目录 `node backend-v2/tmp-build-fcmerge.js`
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAIN = path.join(ROOT, 'docs', 'pages', 'fluidcanvas.html');
const ANA = path.join(ROOT, 'docs', 'pages', 'fluidcanvas-analytics.html');
const ART = path.join(ROOT, 'docs', 'pages', 'fluidcanvas-articles.html');

// 行尾统一 LF：git autocrlf 检出可能是 CRLF（源页/主页不一致），多行锚点与合并输出都以 LF 为准
let main = fs.readFileSync(MAIN, 'utf8').replace(/\r\n/g, '\n');
const ana = fs.readFileSync(ANA, 'utf8').replace(/\r\n/g, '\n');
const art = fs.readFileSync(ART, 'utf8').replace(/\r\n/g, '\n');

// ── 工具 ──
function count(s, needle) {
  let n = 0, i = 0;
  while ((i = s.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}
function sliceBetween(src, startMark, endMark, label) {
  if (count(src, startMark) !== 1) throw new Error('[build] start anchor not unique: ' + label + ' :: ' + JSON.stringify(startMark.slice(0, 60)));
  if (count(src, endMark) !== 1) throw new Error('[build] end anchor not unique: ' + label + ' :: ' + JSON.stringify(endMark.slice(0, 60)));
  const a = src.indexOf(startMark);
  const b = src.indexOf(endMark, a + startMark.length);
  if (b === -1) throw new Error('[build] end anchor after start not found: ' + label);
  return src.slice(a, b);
}
function replaceOnce(src, from, to, label) {
  if (count(src, from) !== 1) throw new Error('[build] replace anchor not unique (' + label + ', count=' + count(src, from) + '): ' + JSON.stringify(from.slice(0, 80)));
  return src.replace(from, to);
}

console.log('== A1: view visibility CSS ==');
main = replaceOnce(main,
  `.upload-view, .content-lib-view { display: none; }\n    .upload-view.active, .content-lib-view.active { display: block; }`,
  `.upload-view, .content-lib-view, .analytics-view, .articles-view { display: none; }\n    .upload-view.active, .content-lib-view.active, .analytics-view.active, .articles-view.active { display: block; }`,
  'A1');

console.log('== A2+A3: analytics/articles CSS inserts ==');
const ANA_CSS = `    /* ── Analytics View (merged from fluidcanvas-analytics.html — v0.2.45.0) ── */
    #analyticsView .mini-stat { min-width: 70px; }   /* 冲突修：主页 .mini-stat 64px 是 dashboard 表格专用 */
    @media (max-width: 600px) { #periodTabs { flex-wrap: wrap; } }  /* 窄屏 pill 换行：390px 电池实证三粒一行顶到 813 超既有最坏 655 */
    .sparkline { display:flex;align-items:flex-end;gap:2px;height:28px; }
    .sparkline-bar { width:5px;border-radius:1px;min-height:3px;background:var(--color-primary);opacity:0.5;transition:opacity 0.2s; }
    .sparkline-bar:last-child { opacity:1; }
    /* Comparison bar */
    .compare-bar { display:flex;align-items:center;gap:6px; }
    .compare-bar-fill { height:6px;border-radius:3px;transition:width 0.5s ease; }

`;
const ART_CSS_SRC = sliceBetween(art,
  '    /* Article table rows */',
  '    .art-empty-icon { font-size: 48px; margin-bottom: 12px; display: block; opacity: 0.5; }',
  'A3 articles css');
const ART_CSS = '    /* ── Articles View (merged from fluidcanvas-articles.html — v0.2.45.0) ── */\n' +
  ART_CSS_SRC.replace(/@keyframes fadeInDown [^}]*}\s*/g, '').replace(/\n\n/, '\n') + // 去 fadeInDown（主页 L2225 已有，逐字节相同）
  '\n';
// 锚点：`    .upload-zone {` 裸行（`.upload-zone:hover` 等不匹配整行串）
if (count(main, '\n    .upload-zone {') !== 1) throw new Error('[build] A2 anchor not unique');
main = main.replace('\n    .upload-zone {', '\n' + ANA_CSS + ART_CSS + '    .upload-zone {');

console.log('== A4: two new view divs ==');
const ANA_DOM = sliceBetween(ana, '  <!-- Period selector -->', '  </div><!-- end right -->', 'A4 analytics dom');
const ART_DOM = sliceBetween(art, '    <!-- Header -->', '  </div><!-- end right column -->', 'A4 articles dom');
const newViews =
  '\n' +
  '  <!-- ═══════════════════════════════════════════\n' +
  '       Analytics View (merged from fluidcanvas-analytics.html — v0.2.45.0)\n' +
  '       ═══════════════════════════════════════════ -->\n' +
  '  <div class="analytics-view" id="analyticsView">\n' +
  ANA_DOM +
  '\n  </div><!-- end analyticsView -->\n' +
  '\n' +
  '  <!-- ═══════════════════════════════════════════\n' +
  '       Articles View (merged from fluidcanvas-articles.html — v0.2.45.0)\n' +
  '       ═══════════════════════════════════════════ -->\n' +
  '  <div class="articles-view" id="articlesView">\n' +
  ART_DOM +
  '\n  </div><!-- end articlesView -->\n';
main = replaceOnce(main, '  </div><!-- end uploadView -->', '  </div><!-- end uploadView -->' + newViews, 'A4');

console.log('== A5: sidebar nav (5 items, ?view= hrefs) ==');
const NAV_OLD = [
  '      <a href="fluidcanvas.html" class="nav-item active" style="border-radius:var(--radius-md)" data-view="dashboard"><span class="material-symbols-outlined">dashboard</span> Dashboard</a>',
  '      <a href="fluidcanvas-analytics.html" class="nav-item" style="border-radius:var(--radius-md)"><span class="material-symbols-outlined">analytics</span> Analytics</a>',
  '      <a href="fluidcanvas.html#content" class="nav-item" style="border-radius:var(--radius-md)" data-view="content"><span class="material-symbols-outlined">article</span> Content</a>',
  '      <a href="fluidcanvas.html" class="nav-item" style="border-radius:var(--radius-md)" data-view="upload"><span class="material-symbols-outlined">cloud_upload</span> Upload</a>',
  '      <a href="fluidcanvas-articles.html" class="nav-item" style="border-radius:var(--radius-md)"><span class="material-symbols-outlined">edit_note</span> Articles</a>'
].join('\n');
const NAV_NEW = [
  '      <a href="fluidcanvas.html" class="nav-item active" style="border-radius:var(--radius-md)" data-view="dashboard"><span class="material-symbols-outlined">dashboard</span> Dashboard</a>',
  '      <a href="fluidcanvas.html?view=analytics" class="nav-item" style="border-radius:var(--radius-md)" data-view="analytics"><span class="material-symbols-outlined">analytics</span> Analytics</a>',
  '      <a href="fluidcanvas.html?view=content" class="nav-item" style="border-radius:var(--radius-md)" data-view="content"><span class="material-symbols-outlined">article</span> Content</a>',
  '      <a href="fluidcanvas.html?view=upload" class="nav-item" style="border-radius:var(--radius-md)" data-view="upload"><span class="material-symbols-outlined">cloud_upload</span> Upload</a>',
  '      <a href="fluidcanvas.html?view=articles" class="nav-item" style="border-radius:var(--radius-md)" data-view="articles"><span class="material-symbols-outlined">edit_note</span> Articles</a>'
].join('\n');
main = replaceOnce(main, NAV_OLD, NAV_NEW, 'A5');

console.log('== A6: nav binding (modifier-click passthrough + pushState) ==');
const NAVBIND_OLD = [
  '  // --- Left nav view switching ---',
  '  var currentView = \'dashboard\';',
  '  document.querySelectorAll(\'.tilt-container .nav-item[data-view]\').forEach(function(item) {',
  '    item.addEventListener(\'click\', function(e) {',
  '      e.preventDefault();',
  '      var view = this.dataset.view;',
  '      if (view === currentView) return;',
  '      // Update active state',
  '      document.querySelectorAll(\'.tilt-container .nav-item[data-view]\').forEach(function(n) { n.classList.remove(\'active\'); });',
  '      this.classList.add(\'active\');',
  '      // Switch view',
  '      switchView(view);',
  '    });',
  '  });'
].join('\n');
const NAVBIND_NEW = [
  '  // --- Left nav view switching (Douyin-style: URL is the state) ---',
  '  var currentView = \'dashboard\';',
  '  document.querySelectorAll(\'.tilt-container .nav-item[data-view]\').forEach(function(item) {',
  '    item.addEventListener(\'click\', function(e) {',
  '      // middle/ctrl/shift/alt-click → let the browser open the real href (new tab etc.)',
  '      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;',
  '      e.preventDefault();',
  '      var view = this.dataset.view;',
  '      syncNavActive(view);',
  '      if (view === currentView) { restoreSubState(view); return; }',
  '      if (switchView(view)) {',
  '        try { history.pushState(null, \'\', buildURL(view)); } catch (err) {}',
  '      }',
  '    });',
  '  });'
].join('\n');
main = replaceOnce(main, NAVBIND_OLD, NAVBIND_NEW, 'A6');

console.log('== A7: contentTabs → setContentTab(tab, push) ==');
const CONTENTTABS_OLD = [
  '  // --- Tab switching ---',
  '  var currentPanel = 0;',
  '  document.getElementById(\'contentTabs\').addEventListener(\'click\', function(e) {',
  '    if (!e.target.classList.contains(\'subnav-pill\')) return;',
  '    this.querySelectorAll(\'.subnav-pill\').forEach(function(b) { b.classList.remove(\'active\'); });',
  '    e.target.classList.add(\'active\');',
  '    var targetPanel = e.target.dataset.tab === \'articles\' ? 0 : 1;',
  '    if (targetPanel === currentPanel) return;',
  '    var track = document.getElementById(\'slideTrack\');',
  '    var panels = track.querySelectorAll(\'.card\');',
  '    panels[currentPanel].style.opacity = \'0.3\';',
  '    panels[targetPanel].style.opacity = \'1\';',
  '    currentPanel = targetPanel;',
  '    track.style.transform = \'translateX(\' + (-targetPanel * 100) + \'%)\';',
  '  });'
].join('\n');
const CONTENTTABS_NEW = [
  '  // --- Dashboard content sub-tabs (tab state lives in URL) ---',
  '  var currentPanel = 0;',
  '  function setContentTab(tab, push) {',
  '    if (tab !== \'articles\' && tab !== \'media\') tab = \'articles\';',
  '    var pills = document.getElementById(\'contentTabs\').querySelectorAll(\'.subnav-pill\');',
  '    for (var i = 0; i < pills.length; i++) pills[i].classList.toggle(\'active\', pills[i].dataset.tab === tab);',
  '    var targetPanel = tab === \'articles\' ? 0 : 1;',
  '    var track = document.getElementById(\'slideTrack\');',
  '    var panels = track.querySelectorAll(\'.card\');',
  '    if (targetPanel !== currentPanel && panels.length) {',
  '      panels[currentPanel].style.opacity = \'0.3\';',
  '      panels[targetPanel].style.opacity = \'1\';',
  '      currentPanel = targetPanel;',
  '      track.style.transform = \'translateX(\' + (-targetPanel * 100) + \'%)\';',
  '    }',
  '    viewState.tab = tab;',
  '    if (push) window.FC_URL.push();',
  '  }',
  '  document.getElementById(\'contentTabs\').addEventListener(\'click\', function(e) {',
  '    if (!e.target.classList.contains(\'subnav-pill\')) return;',
  '    setContentTab(e.target.dataset.tab, true);',
  '  });'
].join('\n');
main = replaceOnce(main, CONTENTTABS_OLD, CONTENTTABS_NEW, 'A7');

console.log('== A9: switchView five-way + lock guard fix ==');
const SWITCHVIEW_OLD = sliceBetween(main, '  // Prevent overlapping switches', '  // Check URL hash for initial view', 'A9 switchView');
const SWITCHVIEW_NEW = [
  '  // Prevent overlapping switches (instant switches bypass the lock to take over crossfades)',
  '  var _switchLock = false;',
  '  var _switchTimer = null;',
  '',
  '  function switchView(view, instant) {',
  '    if (_switchLock && !instant) return false;',
  '    var VIEW_EL = {',
  '      dashboard: document.getElementById(\'dashboardView\'),',
  '      upload: document.getElementById(\'uploadView\'),',
  '      content: document.getElementById(\'contentView\'),',
  '      analytics: document.getElementById(\'analyticsView\'),',
  '      articles: document.getElementById(\'articlesView\')',
  '    };',
  '    var oldViewName = currentView;',
  '    if (oldViewName === view) return false;',
  '    var oldEl = VIEW_EL[oldViewName] || VIEW_EL.dashboard;',
  '    var newEl = VIEW_EL[view] || VIEW_EL.dashboard;',
  '',
  '    function resetInline(el) {',
  '      if (el.style.opacity === \'0\') el.style.opacity = \'\';',
  '      if (el.style.transform && (el.style.transform.indexOf(\'translateY(0\') !== -1 || el.style.transform.indexOf(\'translateY(6\') !== -1)) el.style.transform = \'\';',
  '    }',
  '',
  '    function initNewView() {',
  '      if (view === \'upload\') {',
  '        try { if (!window._uploadInitialized) { initUpload(); window._uploadInitialized = true; } } catch(e) {}',
  '      } else if (view === \'content\') {',
  '        try { if (!window._contentLibInitialized) { initContentLib(); window._contentLibInitialized = true; } else { renderCLStats(); renderCLList(); } } catch(e) {}',
  '      } else if (view === \'analytics\') {',
  '        try { window.FC_ANALYTICS.render(); } catch(e) {}      // re-render every entry → account switches propagate',
  '      } else if (view === \'articles\') {',
  '        try { window.FC_ARTICLES.init(); } catch(e) {}          // renders always',
  '      }',
  '    }',
  '',
  '    function finish() {',
  '      oldEl.style.display = \'none\';',
  '      oldEl.classList.remove(\'active\');',
  '      oldEl.style.transition = \'\';',
  '      oldEl.style.opacity = \'\';',
  '      oldEl.style.transform = \'\';',
  '      currentView = view;',
  '      _switchLock = false;',
  '    }',
  '',
  '    if (instant) {',
  '      if (_switchTimer) { clearTimeout(_switchTimer); _switchTimer = null; }  // cancel in-flight crossfade cleanup',
  '      _switchLock = false;',
  '      oldEl.style.display = \'none\';',
  '      oldEl.classList.remove(\'active\');',
  '      oldEl.style.transition = \'\';',
  '      oldEl.style.opacity = \'\';',
  '      oldEl.style.transform = \'\';',
  '      newEl.style.display = \'block\';',
  '      newEl.style.transition = \'none\';',
  '      newEl.style.opacity = \'1\';',
  '      newEl.style.transform = \'translateY(0)\';',
  '      resetInline(newEl);',
  '      var ikids = newEl.querySelectorAll(\'[style]\');',
  '      for (var ik = 0; ik < ikids.length; ik++) resetInline(ikids[ik]);',
  '      newEl.classList.add(\'active\');',
  '      initNewView();',
  '      currentView = view;',
  '      return true;',
  '    }',
  '',
  '    _switchLock = true;',
  '',
  '    // ── Overlapping crossfade ──',
  '    // Show new view BEHIND old view immediately at opacity:0',
  '    newEl.style.display = \'block\';',
  '    newEl.style.opacity = \'0\';',
  '    newEl.style.transform = \'translateY(8px)\';',
  '    newEl.style.transition = \'none\';',
  '    resetInline(newEl);',
  '    var kids = newEl.querySelectorAll(\'[style]\');',
  '    for (var k = 0; k < kids.length; k++) resetInline(kids[k]);',
  '    newEl.offsetHeight; // force reflow',
  '',
  '    // Fade out old view',
  '    oldEl.style.transition = \'opacity 0.15s ease\';',
  '    oldEl.style.opacity = \'0\';',
  '',
  '    // Fade in new view simultaneously (starts behind old, revealed as old fades)',
  '    newEl.style.transition = \'opacity 0.2s ease, transform 0.25s ease\';',
  '    newEl.style.opacity = \'1\';',
  '    newEl.style.transform = \'translateY(0)\';',
  '    newEl.classList.add(\'active\');',
  '    initNewView();',
  '',
  '    // After old fully hidden, clean up',
  '    _switchTimer = setTimeout(finish, 200);',
  '    return true;',
  '  }'
].join('\n');
main = replaceOnce(main, SWITCHVIEW_OLD, SWITCHVIEW_NEW, 'A9');

console.log('== A8: legacy hash block removed (initURLSync takes over) ==');
const HASH_OLD = sliceBetween(main, '  // Check URL hash for initial view', '  // Upload Module', 'A8 hash block');
main = replaceOnce(main, HASH_OLD, '  // (initial view now bootstrapped by initURLSync() at script end — legacy #hash also handled there)\n', 'A8');

console.log('== A10: analytics/articles IIFE extraction + transforms ==');

// ── analytics：逐字提取 makeSparkline + renderAnalyticsContent + renderDetailPanels，定点改写 ──
const ANA_JS_SLICE = sliceBetween(ana, '  // --- Sparkline helper ---', '  // --- Period switching with horizontal slide ---', 'A10 analytics slice');
let anaJS = ANA_JS_SLICE;
anaJS = replaceOnce(anaJS, 'function renderContent() {', 'function renderAnalyticsContent() {', 'A10 rename decl');
anaJS = replaceOnce(anaJS,
  '    // Detail panels\n    renderDetailPanels();',
  '    if (window.LG) LG.scan(document); // v0.2.45.0：动态 metric-card 挂液态玻璃（对齐主页 L2729/L3126 模式）\n    // Detail panels\n    renderDetailPanels();',
  'A10 LG.scan');

const FC_ANALYTICS = `  window.FC_ANALYTICS = (function() {
    'use strict';
    var currentPeriod = '28d';
    var detailPanel = 0;

${anaJS}
  var periodOrder = ['7d', '28d', 'month'];

  // --- Period switching with horizontal slide (period state lives in URL) ---
  // 7d → 28d → month: forward (exit LEFT, enter from RIGHT)
  // month → 28d → 7d: backward (exit RIGHT, enter from LEFT)
  function setPeriod(newPeriod, push) {
    if (newPeriod === currentPeriod) return;

    var oldIdx = periodOrder.indexOf(currentPeriod);
    var newIdx = periodOrder.indexOf(newPeriod);
    var forward = newIdx > oldIdx;
    var exitX = forward ? '-30px' : '30px';
    var enterX = forward ? '30px' : '-30px';

    // Update tab immediately so re-render reads correct period
    document.getElementById('periodTabs').querySelectorAll('.subnav-pill').forEach(function(b){b.classList.remove('active');});
    document.querySelector('.subnav-pill[data-period="' + newPeriod + '"]').classList.add('active');
    currentPeriod = newPeriod;

    var cards = document.querySelectorAll('#overviewCards, #channelSummary, #detailTabs, #detailSlide');
    cards.forEach(function(el, i) {
      el.style.transition = 'opacity 0.2s ease, transform 0.25s cubic-bezier(0.25,0.1,0.25,1)';
      el.style.transitionDelay = (i*0.03)+'s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(' + exitX + ')';
    });

    setTimeout(function() {
      renderAnalyticsContent();
      var nc = document.querySelectorAll('#overviewCards, #channelSummary, #detailTabs, #detailSlide');
      nc.forEach(function(el) { el.style.opacity='0'; el.style.transform='translateX('+enterX+')'; el.style.transition='none'; });
      requestAnimationFrame(function() {
        nc.forEach(function(el, i) {
          el.style.transition = 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.25,0.1,0.25,1)';
          el.style.transitionDelay = (i*0.04)+'s';
          el.style.opacity = '1';
          el.style.transform = 'translateX(0)';
        });
      });
    }, 250);

    viewState.period = newPeriod;
    if (push) window.FC_URL.push();
  }

  function setDetailTab(tab, push) {
    var pills = document.getElementById('detailTabs').querySelectorAll('.subnav-pill');
    for (var i = 0; i < pills.length; i++) pills[i].classList.toggle('active', pills[i].dataset.tab === tab);
    var tgt = tab === 'articles' ? 0 : 1;
    var track = document.getElementById('detailSlide');
    var panels = track.querySelectorAll('.card');
    if (tgt !== detailPanel && panels.length) {
      panels[detailPanel].style.opacity = '0.3';
      panels[tgt].style.opacity = '1';
      detailPanel = tgt;
      track.style.transform = 'translateX(' + (-tgt * 100) + '%)';
    }
    viewState.tab = tab;
    if (push) window.FC_URL.push();
  }

  function applyState(period, tab) {
    // programmatic restore (init/back/forward) — no choreography, no push
    if (period && periodOrder.indexOf(period) !== -1) currentPeriod = period;
    document.getElementById('periodTabs').querySelectorAll('.subnav-pill').forEach(function(b) { b.classList.toggle('active', b.dataset.period === currentPeriod); });
    renderAnalyticsContent();
    setDetailTab(tab === 'media' ? 'media' : 'articles', false);
  }

  document.getElementById('periodTabs').addEventListener('click', function(e) {
    if (!e.target.classList.contains('subnav-pill')) return;
    setPeriod(e.target.dataset.period, true);
  });
  document.getElementById('detailTabs').addEventListener('click', function(e) {
    if (!e.target.classList.contains('subnav-pill')) return;
    setDetailTab(e.target.dataset.tab, true);
  });

  return { render: renderAnalyticsContent, applyState: applyState, setDetailTab: setDetailTab };
  })();
`;

// ── articles：整 IIFE 内体逐字提取 + 定点改写（inline onclick 全拆 → 事件委托） ──
const ART_JS_SLICE = sliceBetween(art, '  // ═══════════════════════════════════════════\n  // Seed Data', '\n})();', 'A10 articles slice');
let artJS = ART_JS_SLICE;

artJS = replaceOnce(artJS,
  String.raw`" data-id="' + a.id + '" onclick="event.stopPropagation();toggleSelect(\'' + a.id + '\')"></div>'`,
  String.raw`" data-id="' + a.id + '"></div>'`,
  'A10 checkbox onclick');
// title onclick 与 edit 按钮 onclick 两处相同串（单反斜杠）→ 全部移除（事件委托接管）
const NAV_ONCLICK = String.raw` onclick="window.location.href=\'fluidcanvas-editor.html\'"`;
if (count(artJS, NAV_ONCLICK) !== 2) throw new Error('[build] A10 editor onclick count != 2: ' + count(artJS, NAV_ONCLICK));
artJS = artJS.split(NAV_ONCLICK).join('');
artJS = replaceOnce(artJS,
  String.raw` onclick="deleteArticle(\'' + a.id + '\')"`,
  '',
  'A10 delete onclick');

// 筛选/排序写入 URL 状态
artJS = replaceOnce(artJS,
  '    artFilter = btn.dataset.filter;\n    selectedIds = {};\n    renderArtList();',
  '    artFilter = btn.dataset.filter;\n    selectedIds = {};\n    renderArtList();\n    viewState.filter = artFilter;\n    window.FC_URL.push();',
  'A10 filter→URL');
artJS = replaceOnce(artJS,
  '    artSort = this.value;\n    renderArtList();',
  '    artSort = this.value;\n    renderArtList();\n    viewState.sort = artSort;\n    window.FC_URL.push();',
  'A10 sort→URL');
// 批量发布补 toast（原无任何反馈）
artJS = replaceOnce(artJS,
  '      if (selectedIds[a.id] && a.status !== \'published\') a.status = \'published\';\n    });\n    selectedIds = {};\n    renderArtStats();\n    renderArtList();',
  '      if (selectedIds[a.id] && a.status !== \'published\') a.status = \'published\';\n    });\n    selectedIds = {};\n    renderArtStats();\n    renderArtList();\n    showToast(\'Published \' + ids.length + \' article(s)\', \'publish\');',
  'A10 bulk publish toast');
// 行点击委托（替换旧的 title-only 监听）
const ART_DELEG_OLD = sliceBetween(artJS, '  // Row click for selection (clicking checkbox area or holding Ctrl)', '  // ═══════════════════════════════════════════\n  // Init', 'A10 old row listener');
const ART_DELEG_NEW = `  // Row delegation: checkbox / title+edit / delete (inline onclick removed — v0.2.45.0 bugfix)
  document.getElementById('artList').addEventListener('click', function(e) {
    var row = e.target.closest('.art-row');
    if (!row) return;
    var id = row.dataset.id;
    if (e.target.closest('.art-checkbox')) { toggleSelect(id); return; }
    if (e.target.closest('.art-action-btn.danger')) { deleteArticle(id); return; }
    if (e.target.closest('.art-title') || e.target.closest('.art-action-btn[title="Edit"]')) { window.location.href = 'fluidcanvas-editor.html'; return; }
  });

`;
artJS = replaceOnce(artJS, ART_DELEG_OLD, ART_DELEG_NEW, 'A10 delegation');
// Init 块 → applyState + expose
artJS = replaceOnce(artJS,
  '  // ═══════════════════════════════════════════\n  // Init\n  // ═══════════════════════════════════════════\n  renderArtStats();\n  renderArtList();\n  if (window.SlatiTilt) SlatiTilt.init(document.querySelectorAll(\'.tilt-container\'));',
  `  function applyState(filter, sort) {
    // programmatic restore (init/back/forward) — no push
    if (filter && (filter === 'all' || filter === 'published' || filter === 'draft' || filter === 'review')) {
      artFilter = filter;
      document.getElementById('artFilterPills').querySelectorAll('.subnav-pill').forEach(function(b) { b.classList.toggle('active', b.dataset.filter === filter); });
    }
    if (sort) { artSort = sort; document.getElementById('artSort').value = sort; }
    selectedIds = {};
    renderArtList();
  }`,
  'A10 applyState');
const FC_ARTICLES = `  window.FC_ARTICLES = (function() {
    'use strict';

${artJS}
  return { init: function() { renderArtStats(); renderArtList(); }, applyState: applyState };
  })();
`;

// ── URL 同步层 ──
const URL_SYNC = `  // ═══════════════════════════════════════════════════════════
  // Douyin-style URL view switching — one page, state in query params
  // ?view=dashboard|upload|content|analytics|articles (+ &tab=&period=&filter=&sort=)
  // ═══════════════════════════════════════════════════════════
  var VIEW_KEYS = ['dashboard', 'upload', 'content', 'analytics', 'articles'];
  var viewState = { tab: 'articles', period: '28d', filter: 'all', sort: 'newest' };
  var _suppressPush = false;

  function viewSubParams(view) {
    if (view === 'content') return ['tab'];
    if (view === 'analytics') return ['tab', 'period'];
    if (view === 'articles') return ['filter', 'sort'];
    return [];
  }
  function buildURL(view) {
    var q = [];
    if (view && view !== 'dashboard') q.push('view=' + view);
    viewSubParams(view).forEach(function(k) { q.push(k + '=' + encodeURIComponent(viewState[k])); });
    return window.location.pathname + (q.length ? '?' + q.join('&') : '');
  }
  window.FC_URL = {
    push: function() { if (_suppressPush) return; try { history.pushState(null, '', buildURL(currentView)); } catch (e) {} }
  };
  function parseViewFromURL() {
    var q = {};
    window.location.search.replace(/^\\?/, '').split('&').forEach(function(pair) {
      if (!pair) return;
      var kv = pair.split('=');
      q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    var view = q.view;
    var legacy = { '#upload': 'upload', '#content': 'content', '#analytics': 'analytics', '#articles': 'articles' }[window.location.hash];
    if ((!view || VIEW_KEYS.indexOf(view) === -1) && legacy) view = legacy;
    if (!view || VIEW_KEYS.indexOf(view) === -1) view = 'dashboard';
    if (view === 'content' && (q.tab === 'articles' || q.tab === 'media')) viewState.tab = q.tab;
    if (view === 'analytics') {
      if (q.tab === 'articles' || q.tab === 'media') viewState.tab = q.tab;
      if (q.period === '7d' || q.period === '28d' || q.period === 'month') viewState.period = q.period;
    }
    if (view === 'articles') {
      if (q.filter === 'all' || q.filter === 'published' || q.filter === 'draft' || q.filter === 'review') viewState.filter = q.filter;
      if (q.sort === 'newest' || q.sort === 'oldest' || q.sort === 'views' || q.sort === 'bookmarks' || q.sort === 'title') viewState.sort = q.sort;
    }
    return view;
  }
  function syncNavActive(view) {
    document.querySelectorAll('.tilt-container .nav-item[data-view]').forEach(function(n) { n.classList.toggle('active', n.dataset.view === view); });
  }
  function restoreSubState(view) {
    if (view === 'content') setContentTab(viewState.tab, false);
    else if (view === 'analytics') window.FC_ANALYTICS.applyState(viewState.period, viewState.tab);
    else if (view === 'articles') window.FC_ARTICLES.applyState(viewState.filter, viewState.sort);
  }
  function initURLSync() {
    var view = parseViewFromURL();
    if (window.location.hash) history.replaceState(null, '', buildURL(view));  // legacy #hash → canonical query, exactly once (replaceState fires no popstate)
    if (view !== currentView) { syncNavActive(view); switchView(view, true); }
    restoreSubState(view);
    window.addEventListener('popstate', function() {
      _suppressPush = true;
      var v = parseViewFromURL();
      if (v !== currentView) { syncNavActive(v); switchView(v, true); }
      restoreSubState(v);
      _suppressPush = false;
    });
  }

${FC_ANALYTICS}
${FC_ARTICLES}
  initURLSync();
`;

console.log('== A10: append URL sync layer + both IIFEs before </script> ==');
main = replaceOnce(main,
  '  renderTeamSection();\n  renderContent();\n</script>',
  '  renderTeamSection();\n  renderContent();\n' + URL_SYNC + '</script>',
  'A10 append');

console.log('== A11: dark-mode tilt-card white top line kill (v0.2.45.1) ==');
// 2026-09-15 用户「FC 首页左侧菜单上方有一个白白的东西？深色模式下才看得见」——真身=3D 菜单卡
// 顶部 inline box-shadow inset 0 1px 0 rgba(255,255,255,0.8) 白高光线；暗色灭顶线，亮色零触碰
main = replaceOnce(main,
  ':root[data-theme="dark"] .app-sidebar .lg-backdrop {\n  filter: none;\n  backdrop-filter: none;\n}',
  ':root[data-theme="dark"] .app-sidebar .lg-backdrop {\n  filter: none;\n  backdrop-filter: none;\n}\n' +
  '/* 2026-09-15 用户「FC 首页左侧菜单上方有一个白白的东西？在深色模式下才看得见」——真身=3D 菜单卡\n' +
  '   顶部 inline box-shadow 白高光线 inset 0 1px 0 rgba(255,255,255,0.8)（hover 内联更亮到 0.9；\n' +
  '   扫描探针+像素分析实证：左列唯一非文字亮块 72×1px 峰值亮度≈230，亮色卡白线隐形、暗色卡上独亮）。\n' +
  '   暗色灭顶线（外侧深投影保留），!important 压过内联 rest/hover 两态，亮色零触碰 */\n' +
  ':root[data-theme="dark"] .tilt-container:not(.card) {\n' +
  '  box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.12), 0 4px 16px -4px rgba(0, 0, 0, 0.06) !important;\n' +
  '}',
  'A11');

// ── 输出自检 ──
console.log('== self-check ==');
const mustHave = [
  'id="analyticsView"', 'id="articlesView"', 'window.FC_ANALYTICS', 'window.FC_ARTICLES', 'initURLSync();',
  'fluidcanvas.html?view=analytics', 'fluidcanvas.html?view=articles', 'fluidcanvas.html?view=content', 'fluidcanvas.html?view=upload',
  'renderAnalyticsContent()', '#analyticsView .mini-stat', 'showToast(\'Published \' + ids.length',
  '.tilt-container:not(.card)'
];
for (const m of mustHave) {
  if (main.indexOf(m) === -1) throw new Error('[build] output missing: ' + m);
}
const mustNotHave = ['href="fluidcanvas-analytics.html', 'href="fluidcanvas-articles.html', 'href="fluidcanvas.html#',
  'onclick="toggleSelect', 'onclick="deleteArticle'];
for (const m of mustNotHave) {
  if (main.indexOf(m) !== -1) {
    const ci = main.indexOf(m);
    console.log('[dbg] offending context:', JSON.stringify(main.slice(Math.max(0, ci - 150), ci + 80)));
    throw new Error('[build] output must not contain: ' + m);
  }
}
// 完整性：末尾结构与开头哨兵
if (main.indexOf('</body>\n</html>') === -1) throw new Error('[build] output truncated');

fs.writeFileSync(MAIN, main, 'utf8');
console.log('OK — fluidcanvas.html rewritten: ' + main.length + ' chars (' + main.split('\n').length + ' lines)');
console.log('Reminder: next step overwrites the two source pages with redirect stubs — run this script BEFORE that.');
