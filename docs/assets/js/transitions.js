/**
 * Staggered Card Entrance + Directional Page Transitions
 *
 * Exit direction depends on nav order relative to target.
 * Entrance direction is stored in sessionStorage so the next page
 * knows which way to animate cards in.
 */
(function () {
  'use strict';

  var STAGGER_DELAY = 60;
  // h1 + p = hero 副标题（如 guidelines 的 Standards and protocols…）：跟大标题一起淡入，不再原地呆住
  var CARD_SELECTOR = '.card, .app-main h1, .app-main h1 + p, .app-main h2, .app-main .search-capsule, .app-main header, .auth-card';

  var NAV_ORDER = {
    'index.html': 0,
    'overview.html': 1, 'explore.html': 1, 'guidelines.html': 1,
    'community-hub.html': 2,
    'construction.html': 3, 'create-topic-step-1.html': 3, 'create-topic-step-2.html': 3, 'create-topic-step-3.html': 3,
    'create-world.html': 3, 'world-wizard.html': 3, 'world-created.html': -1,
    'messages.html': 4,
    'editor.html': 5,
    'workspace.html': 8,
    'help.html': 9,
    'signup-and-login.html': -1, 'signup-and-login': -1,
    'onboarding-identity.html': -1, 'onboarding-complete.html': -1,
    'transitioning.html': -1, 'sovereignty-ratified.html': -1,
  };

  var TAB_ORDER = {
    'overview.html': 0, 'explore.html': 1, 'guidelines.html': 2,
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

    cards.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = startTransform;
    });

    cards.forEach(function (el, i) {
      setTimeout(function () {
        el.style.transition = 'opacity 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0) translateX(0)';
      }, i * STAGGER_DELAY);
    });
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
        card.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        card.style.transitionDelay = (i * 0.025) + 's';
        card.style.opacity = '0';
        card.style.transform = exitTransform;
      });

      try { sessionStorage.setItem('slati_entrance_dir', entranceDir); } catch (e) {}

      setTimeout(function () { window.location.href = href; }, 280);

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

      mainV.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      mainV.style.opacity = '0';
      mainV.style.transform = exitTransform;

      setTimeout(function () { window.location.href = href; }, 240);
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
