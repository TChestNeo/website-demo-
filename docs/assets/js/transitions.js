/**
 * Staggered Card Entrance + Directional Page Transitions
 *
 * Exit direction depends on nav order relative to target.
 * Entrance direction is stored in sessionStorage so the next page
 * knows which way to animate cards in.
 *
 * 2026-09-17 v0.2.50.1 观感恢复：进出场动画观感是用户钦定设计（原样保留）；只含两个
 * 不改变观感的隐形修复——动画结束 transitionend/cancel 回收 inline transition（0.4s
 * 橡皮筋不再污染 hover/tilt，如 Messages 公告卡 box-shadow-only 过渡）+ 隐藏卡
 * （display:none 不渲染、transitionend 永不触发）600ms 兜底定时强制清理。
 * 2026-09-17 v0.2.50.2 Messages 页专属轻量模式（用户钦定）：49.9 轻量修法
 * （transform-only 不渐隐 / 波浪头前 STAGGER_CAP 张 / 40ms / 退出 220-240ms）只保留给
 * 进入/离开 messages.html（全卡渐隐波浪在 63 张卡的 Messages 上 ~4s 才落定）——
 * 其余页面切页保持原样观感。
 * 2026-09-17 v0.2.50.3 进场帧健康隐形修复（用户钦定「不可以取舍任何限制拥有的所有过渡
 * 动画」——所有动画一个不少，观感零变化，三刀全隐形）：① rAF 批量波浪替换逐卡 setTimeout
 * （起播帧对齐、渲染负载下波浪不再参差；节奏 60/40ms、时长、缓动、LIGHT cap 8 逐字不动）
 * ② 动画期间写 inline will-change 层提升（磨砂卡背景只采样一次、opacity/transform 走
 * 合成器；cleanup 还原原值，退出路径页面即销毁无需清理）③ 双动画守卫（元素已有覆盖
 * opacity/transform 的关键帧动画时不写任何内联——关键帧照常淡入，如 dashboard 欢迎卡
 * animate-fade-in-up）；另加 rAF 挂起兜底定时（后台标签打开时强制起播剩余卡，防
 * opacity:0 卡死回归）。
 * 2026-09-17 v0.2.50.4 守卫收窄修复（用户报告部分页面切页上下淡出淡入动画「不见或
 * 乱透了」——50.3 守卫回归）：getAnimations() 也会返回运行中的 CSS 过渡——boot 解除
 * pre-stagger 的同一 tick 里守卫强制刷样式，.card 基类 transition: all 0.2s（覆盖
 * opacity）当场起 0→1 过渡，真实浏览器 phase=active 被误判为「关键帧动画」→ 整页卡片
 * 被跳过波浪（headless 151 无 phase 键、flush 瞬间 progress 为 null 才没被电池抓到）。
 * 收窄为只认 CSS 关键帧动画（构造器/transitionProperty 双重过滤 CSSTransition）；欢迎卡
 * animate-fade-in-up 是 CSSAnimation 照常正确跳过——纯 bug 修复，所有动画一个不少，
 * 节奏/时长/缓动/双模式逐字不动。
 * 2026-09-30 v0.2.58.23 悬停预加载（用户「为什么我在切换页面的时候会闪一下 然而我在抖音或者
 * Youtube切换页面的时候并不会闪烁一下是不是没有做预先加载？」）：悬停站内链接 65ms 后
 * <link rel="prefetch" as="document"> 预下载目标页消除切页白闪（多页应用跳页冷下载→预取后
 * 点击命中缓存）；纯隐形性能层——切页动画/点击劫持/节奏时长缓动逐字零改动。
 */
(function () {
  'use strict';

  var STAGGER_DELAY = 60;        // 原样观感节奏（除 Messages 外全站）
  var LIGHT_STAGGER_DELAY = 40;  // Messages 页轻量入场节奏（49.9 口径）
  var STAGGER_CAP = 8;           // Messages 页轻量入场波浪头上限
  // Messages 页专属轻量模式（2026-09-17 v0.2.50.2 用户钦定）：49.9 修法只作用于进入/离开
  // messages.html；其余页面保持原样观感（钦定设计）。LIGHT 在脚本加载时按当前页判定
  var LIGHT = getFilename(window.location.pathname) === 'messages.html';
  // h1 + p = hero 副标题（如 guidelines 的 Standards and protocols…）：跟大标题一起淡入，不再原地呆住
  var CARD_SELECTOR = '.card, .app-main h1, .app-main h1 + p, .app-main h2, .app-main .search-capsule, .app-main header, .auth-card';

  var NAV_ORDER = {
    'index.html': 0,
    'overview.html': 1, 'explore.html': 1, 'guidelines.html': 1, 'micronationary': 1,
    'community-hub.html': 2,
    'construction.html': 3, 'create-topic-step-1.html': 3, 'create-topic-step-2.html': 3, 'create-topic-step-3.html': 3,
    'create-world.html': 3, 'world-wizard.html': 3, 'world-created.html': -1,
    'messages.html': 4,
    'fluidcanvas-editor.html': 5,
    'workspace.html': 8,
    'help.html': 9,
    'signup-and-login.html': -1, 'signup-and-login': -1,
    'onboarding-identity.html': -1, 'onboarding-complete.html': -1,
    'transitioning.html': -1, 'sovereignty-ratified.html': -1,
  };

  var TAB_ORDER = {
    'overview.html': 0, 'explore.html': 1, 'guidelines.html': 2, 'micronationary': 1,
  };

  function getFilename(path) {
    var parts = path.split('/');
    return parts[parts.length - 1] || 'index.html';
  }
  function getNavIndex(path) {
    var f = getFilename(path);
    if (NAV_ORDER.hasOwnProperty(f)) return NAV_ORDER[f];
    if (f.includes('registry')) return 0;
    return -1;
  }
  function getTabIndex(path) {
    var f = getFilename(path);
    if (TAB_ORDER.hasOwnProperty(f)) return TAB_ORDER[f];
    return -1;
  }
  // 双动画守卫（v0.2.50.3 隐形修复）：元素已有「正在生效」且覆盖 opacity/transform 的
  // CSS 关键帧动画（如 dashboard 欢迎卡 animate-fade-in-up）时判定为真——该卡淡入由
  // 关键帧自管（CSS 动画本就压过 inline 过渡，与今日生效观感逐帧相同），JS 不再写任何
  // 内联，避免两套动画互搏 + inline 污染。
  // v0.2.50.4 收窄：只认 CSS 关键帧动画。getAnimations() 也会返回运行中的 CSS 过渡——
  // boot 解除 pre-stagger 的同一 tick 里，守卫的 getAnimations() 强制刷样式会让 .card
  // 基类 transition: all 0.2s（覆盖 opacity）当场起一个 0→1 过渡；真实浏览器该过渡
  // phase=active 被误判为「关键帧动画」→ 整页卡片跳过波浪（headless 151 无 phase 键、
  // flush 瞬间 progress 为 null 才没误判——电池全绿但用户浏览器部分页面动画不见/乱透）
  function hasActiveOpacityAnim(el) {
    if (!el.getAnimations) return false;
    var anims = el.getAnimations();
    for (var i = 0; i < anims.length; i++) {
      var a = anims[i];
      // CSS 过渡不参与判定（v0.2.50.4）：pre-stagger 解除瞬间卡片天然有一条 opacity 过渡
      // 在跑，它永远不能作为「已有关键帧动画自管淡入」的证据
      var ctorName = '';
      try { ctorName = a.constructor && a.constructor.name ? a.constructor.name : ''; } catch (e) {}
      if (ctorName === 'CSSTransition' || a.transitionProperty !== undefined) continue;
      var ct = null;
      try { ct = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null; } catch (e) {}
      if (!ct) continue;
      // 动画「当前是否覆盖样式」判定：phase 字段在部分 Chrome 版本缺失（实测 headless 151
      // getComputedTiming() 无 phase 键）——主用 fill/progress 兜底，phase 存在时并判
      var applies = ct.fill === 'forwards' || ct.fill === 'both' ||
        (ct.progress !== null && ct.progress !== undefined && ct.progress < 1) ||
        ct.phase === 'active' ||
        (ct.phase === 'after' && (ct.fill === 'forwards' || ct.fill === 'both')) ||
        (ct.phase === 'before' && (ct.fill === 'backwards' || ct.fill === 'both'));
      if (!applies) continue;
      var kfs = null;
      try { kfs = a.effect.getKeyframes(); } catch (e) {}
      if (!kfs) continue;
      for (var j = 0; j < kfs.length; j++) {
        if (kfs[j].opacity !== undefined || kfs[j].transform !== undefined) return true;
      }
    }
    return false;
  }

  // --- Staggered card entrance with direction ---
  function initStagger() {
    // 切页防双重绘制（08-28）：解除 CSS 预隐藏——同 tick 内下面即写内联 opacity，中间无绘制帧
    if (document.body) document.body.classList.remove('pre-stagger');
    var cards = document.querySelectorAll(CARD_SELECTOR);
    if (cards.length === 0) return;

    // Read entrance direction from sessionStorage (set by previous page's exit)
    var dir = 'bottom'; // default: from below (most common)
    try {
      var stored = sessionStorage.getItem('slati_entrance_dir');
      if (stored) dir = stored;
      sessionStorage.removeItem('slati_entrance_dir');
    } catch (e) {}

    // Map direction to initial transform
    var startTransform;
    switch (dir) {
      case 'top':    startTransform = 'translateY(-18px)'; break;
      case 'bottom': startTransform = 'translateY(18px)';  break;
      case 'left':   startTransform = 'translateX(-24px)'; break;
      case 'right':  startTransform = 'translateX(24px)';  break;
      default:       startTransform = 'translateY(18px)';  break;
    }

    var delay = LIGHT ? LIGHT_STAGGER_DELAY : STAGGER_DELAY;
    // 轻量模式（Messages 专属）：只动画前 STAGGER_CAP 个元素、不 fade opacity——
    // opacity<1 让磨砂卡逐帧重采样背景，是全页入场掉帧主因；原样观感=全卡渐隐波浪
    var animated = [];
    var n = LIGHT ? Math.min(cards.length, STAGGER_CAP) : cards.length;
    for (var i = 0; i < n; i++) animated.push(cards[i]);

    // 写前先记下每张卡原有的 inline opacity（原样观感回收时还原；轻量模式不动 opacity）；
    // 双动画守卫：已有覆盖 opacity/transform 的关键帧动画的卡（如欢迎卡）跳过一切内联
    // 写入——关键帧照常淡入，观感与今日逐帧相同（CSS 动画本就压过 inline 过渡）
    var prevOpacities = [];
    var skip = [];
    animated.forEach(function (el, i) {
      skip[i] = hasActiveOpacityAnim(el);
      if (skip[i]) return;
      if (!LIGHT) {
        prevOpacities[i] = el.style.opacity;
        el.style.opacity = '0';
      }
      el.style.transform = startTransform;
    });

    // rAF 批量波浪（v0.2.50.3 隐形修复）：单 rAF 循环按 slot 到点起播、同一帧到点的卡
    // 一次 style 批量写入——起播帧对齐（渲染负载下波浪不再参差）；节奏/时长/缓动/cap
    // 与逐卡 setTimeout 版本逐字相同，起播时刻量化 ≤1 帧，观感不可辨
    var nextIdx = 0;
    var t0 = null;
    function startCard(el, i) {
      if (skip[i]) return;
      var prevOpacity = prevOpacities[i];
      var prevTransition = el.style.transition;
      var prevDelay = el.style.transitionDelay;
      var prevWillChange = el.style.willChange;
      // 动画期间层提升：磨砂卡各得合成层、背景只采样一次、opacity/transform 走合成器
      // （opacity<1 的玻璃逐帧重采样背景 = 全页入场掉帧主因）；cleanup 还原原值
      el.style.willChange = LIGHT ? 'transform' : 'opacity, transform';
      el.style.transition = LIGHT
        ? 'transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)'
        : 'opacity 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)';
      if (!LIGHT) el.style.opacity = '1';
      el.style.transform = 'translateY(0) translateX(0)';
      // 观感零改变的隐形修复：动画结束即回收 inline transition/opacity/will-change（恢复
      // 卡片自带的 内联/类过渡与样式表 will-change）——否则 0.4s 橡皮筋永久污染
      // hover/tilt（如 Messages 公告卡 box-shadow-only 过渡会被盖掉）
      var done = false;
      function cleanup(ev) {
        if (ev && (ev.target !== el || ev.propertyName !== 'transform')) return;
        if (done) return;
        done = true;
        el.removeEventListener('transitionend', cleanup);
        el.removeEventListener('transitioncancel', cleanup);
        el.style.transition = prevTransition;
        el.style.transitionDelay = prevDelay;
        el.style.willChange = prevWillChange;
        if (!LIGHT) el.style.opacity = prevOpacity;
        el.style.transform = '';
      }
      el.addEventListener('transitionend', cleanup);
      el.addEventListener('transitioncancel', cleanup);
      // 兜底定时回收：display:none 容器里的卡（如设置弹窗内 .card）不渲染、
      // transitionend 永不触发——到点强制清理，保证零残留
      setTimeout(cleanup, 400 + i * delay + 200);
    }
    function waveTick(now) {
      if (t0 === null) t0 = now;
      while (nextIdx < animated.length && now - t0 >= nextIdx * delay) {
        startCard(animated[nextIdx], nextIdx);
        nextIdx++;
      }
      if (nextIdx < animated.length) requestAnimationFrame(waveTick);
    }
    requestAnimationFrame(waveTick);
    // rAF 挂起兜底（隐形回归防线）：后台标签打开时 rAF 可停——到点强制起播剩余卡，
    // 防非 LIGHT 卡永远停在 opacity:0 的可见回归
    setTimeout(function () {
      if (nextIdx >= animated.length) return;
      while (nextIdx < animated.length) {
        startCard(animated[nextIdx], nextIdx);
        nextIdx++;
      }
    }, animated.length * delay + 600);
  }

  // --- Helpers ---
  function isInternal(href) {
    if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return false;
    return true;
  }

  // Same page (only hash differs) — skip transition
  function isSamePage(href) {
    try {
      var a = document.createElement('a');
      a.href = href;
      var targetPath = a.pathname.replace(/\/+$/, '');
      var currentPath = window.location.pathname.replace(/\/+$/, '');
      // 根页双形态归一（08-29 URL 重构：/ 与 /index.html 是同一页）
      if (targetPath === '/index.html') targetPath = '/';
      if (currentPath === '/index.html') currentPath = '/';
      if (!targetPath) targetPath = currentPath;
      return targetPath === currentPath;
    } catch(e) { return false; }
  }

  // --- Hover prefetch（v0.2.58.23）---
  // 悬停站内链接 65ms 后 <link rel="prefetch" as="document"> 预下载目标页——切页白闪真身是
  // 多页应用每页独立 HTML，跳页销毁旧文档冷下载新文档；抖音/YouTube 单页壳不重建所以不闪。
  // 本站此前零预加载（仅视频 preload 属性）。预取后点击导航命中缓存（HTML/JS/CSS no-cache+ETag
  // 也走 304 重校验、正文零传输）→ 白闪消。纯隐形性能层：不碰切页动画/点击劫持、失败静默。
  // 触屏（无 hover 能力）与省流量模式自动关闭；鼠标移开取消计时器=快速扫过零预取。
  var prefetchTimer = null;
  function prefetchPage(href) {
    try {
      var l = document.createElement('link');
      l.rel = 'prefetch';
      l.as = 'document';
      l.href = href;
      document.head.appendChild(l);
    } catch (e) { /* 预取失败静默——绝不影响导航 */ }
  }
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches &&
      !(navigator.connection && navigator.connection.saveData)) {
    document.addEventListener('mouseover', function (e) {
      var link = e.target.closest('a');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || !isInternal(href) || isSamePage(href)) return;
      if (link.dataset.prefetchDone) return;
      clearTimeout(prefetchTimer); // 快速扫过只预取最后悬停的那个
      prefetchTimer = setTimeout(function () {
        link.dataset.prefetchDone = '1';
        prefetchPage(href);
      }, 65);
      link.addEventListener('mouseleave', function () {
        clearTimeout(prefetchTimer);
      }, { once: true });
    });
  }

  function getMainEl() {
    return document.querySelector('.app-main') || document.querySelector('.auth-layout') || document.querySelector('main') || document.body;
  }

  // --- Click-to-navigate ---
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!isInternal(href)) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (link.target === '_blank') return;

    // Skip same-page hash navigation (e.g. fluidcanvas.html#content)
    if (isSamePage(href)) return;

    var targetFile = getFilename(href);
    var currentFile = getFilename(window.location.pathname);
    if (targetFile === currentFile) return;

    e.preventDefault();

    // 手机底部 Tab：由 sidebar.js 在同一次点击中记录方向。页面与选中胶囊沿同一
    // 水平方向交接，避免常规垂直导航在底部标签栏场景里显得跳跃。
    var mobileTabDirection = '';
    try {
      mobileTabDirection = sessionStorage.getItem('slati_mbn_direction') || '';
      sessionStorage.removeItem('slati_mbn_direction');
    } catch (e) {}
    if (mobileTabDirection === 'forward' || mobileTabDirection === 'back') {
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) {
        window.location.href = href;
        return;
      }
      var mobileMain = getMainEl();
      var forward = mobileTabDirection === 'forward';
      mobileMain.style.transition = 'opacity 200ms cubic-bezier(0.23, 1, 0.32, 1), transform 200ms cubic-bezier(0.23, 1, 0.32, 1)';
      mobileMain.style.opacity = '0';
      mobileMain.style.transform = forward ? 'translateX(-18px)' : 'translateX(18px)';
      mobileMain.style.willChange = 'opacity, transform';
      try { sessionStorage.setItem('slati_entrance_dir', forward ? 'right' : 'left'); } catch (e) {}
      setTimeout(function () { window.location.href = href; }, 200);
      return;
    }

    var currentIdx = getNavIndex(window.location.pathname);
    var targetIdx = getNavIndex(href);

    // Both unknown → FluidCanvas pages, navigate without body-fade
    if (currentIdx === -1 && targetIdx === -1) {
      window.location.href = href;
      return;
    }

    var isHorizontal = (currentIdx === targetIdx && currentIdx >= 0);

    // --- Determine exit direction + entrance direction for next page ---
    var exitTransform, entranceDir;

    if (isHorizontal) {
      var currentTab = getTabIndex(window.location.pathname);
      var targetTab = getTabIndex(href);

      if (targetTab > currentTab) {
        // Forward → exit LEFT, enter from RIGHT
        exitTransform = 'translateX(-24px)';
        entranceDir = 'right';
      } else {
        // Backward → exit RIGHT, enter from LEFT
        exitTransform = 'translateX(24px)';
        entranceDir = 'left';
      }

      // Animate cards individually, skip subnav
      var mainH = getMainEl();
      var cards = mainH.querySelectorAll('.card, h1, h1 + p, h2, .search-capsule, header, .upload-zone, table, #statsRow > *, #featuredNation, #recentContribs');
      cards.forEach(function (card, i) {
        if (LIGHT) {
          // Messages 专属轻量退出（49.9 口径）：只动 transform 不 fade
          card.style.transition = 'transform 0.22s ease';
        } else {
          card.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
          card.style.opacity = '0';
        }
        card.style.transitionDelay = (i * 0.025) + 's';
        card.style.transform = exitTransform;
        // 动画期间层提升（同入场口径；页面 280/240ms 后即销毁，无需清理）
        card.style.willChange = LIGHT ? 'transform' : 'opacity, transform';
      });

      try { sessionStorage.setItem('slati_entrance_dir', entranceDir); } catch (e) {}

      setTimeout(function () { window.location.href = href; }, LIGHT ? 240 : 280);

    } else {
      var mainV = getMainEl();

      if (targetIdx > currentIdx) {
        // Going down nav → exit UP, enter from TOP
        exitTransform = 'translateY(-12px)';
        entranceDir = 'top';
      } else if (targetIdx < currentIdx) {
        // Going up nav → exit DOWN, enter from BOTTOM
        exitTransform = 'translateY(12px)';
        entranceDir = 'bottom';
      } else {
        // Unknown → simple fade
        exitTransform = 'translateY(0)';
        entranceDir = 'bottom';
      }

      try { sessionStorage.setItem('slati_entrance_dir', entranceDir); } catch (e) {}

      if (LIGHT) {
        // Messages 专属轻量退出（49.9 口径）：只动 transform 不 fade opacity（.app-main
        // 整页磨砂卡族，渐隐=全页逐帧重采样背景）
        mainV.style.transition = 'transform 0.22s ease';
      } else {
        mainV.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        mainV.style.opacity = '0';
      }
      mainV.style.transform = exitTransform;
      // 动画期间层提升（同入场口径；页面 240/220ms 后即销毁，无需清理）
      mainV.style.willChange = LIGHT ? 'transform' : 'opacity, transform';

      setTimeout(function () { window.location.href = href; }, LIGHT ? 220 : 240);
    }
  });

  // --- Prevent browser scroll restoration on reload ---
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // --- Init ---
  function boot() {
    window.scrollTo(0, 0);
    initStagger();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
