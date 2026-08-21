/**
 * Unified Sidebar Component
 * Collapsible + responsive: auto-collapses on small windows,
 * floats over content in overlay mode.
 */
(function () {
  'use strict';

  // Theme-aware icon helper — shared with settings-modal
  window._slatiSidebarIcon = function(name) {
    var resolved = document.documentElement.getAttribute('data-theme') || 'light';
    var color = resolved === 'dark' ? '666666' : 'B7B7B7';
    return '../assets/image/' + name + '_24dp_' + color + '_FILL0_wght400_GRAD0_opsz24.svg';
  };

  var NAV_ITEMS = [
    { id: 'home', icon: 'home', label: 'Home', href: '../pages/dashboard.html' },
    { id: 'omnarium', icon: 'language', label: 'Omnarium', href: '../pages/overview.html' },
    { id: 'community', icon: 'groups', label: 'Community', href: '../pages/community-hub.html' },
    { id: 'creation', icon: 'edit_note', label: 'Creation', href: '../pages/create-world.html' },
    { id: 'messages', icon: 'chat', label: 'Messages', href: '../pages/messages.html' },
    { id: 'activity', icon: 'analytics', label: 'Activity', href: '../pages/activity.html' },
    { id: 'editor', icon: 'article', label: 'Editor', href: '../pages/editor.html' },
    { id: 'following', icon: 'favorite', label: 'Following', href: '../pages/following.html' },
    { id: 'upload', icon: 'cloud_upload', label: 'Upload', href: '../pages/fluidcanvas.html#upload' },
    { id: 'studio', icon: 'draw', label: 'FluidCanvas', href: '../pages/fluidcanvas.html' },
  ];

  var BOTTOM_NAV = [
    { id: 'help', icon: 'help', label: 'Help & Support', href: '../pages/help.html' },
  ];

  var COLLAPSE_BREAKPOINT = 1024; // px — auto-collapse below this
  var isCollapsed = false;
  var isFloating = false;

  function getActiveId() {
    var path = window.location.pathname;
    if (path.includes('dashboard')) return 'home';
    if (path.includes('explore') || path.includes('overview') || path.includes('guidelines')) return 'omnarium';
    if (path.includes('community')) return 'community';
    if (path.includes('create-topic') || path.includes('construction')) return 'creation';
    if (path.includes('create-world') || path.includes('world-wizard') || path.includes('world-created')) return 'creation';
    if (path.includes('messages')) return 'messages';
    if (path.includes('activity')) return 'activity';
    if (path.includes('editor')) return 'editor';
    if (path.includes('following')) return 'following';
    if (path.includes('workspace') || path.includes('fluidcanvas')) return 'studio';
    if (path.includes('help')) return 'help';
    return 'home';
  }

  function renderSidebar() {
    var user = (window.SlatiDB && SlatiDB.getUser()) || {
      displayName: 'Alex Rivera',
      citizenId: 'CIT-8842',
      avatarUrl: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=4648d4&color=fff&size=80',
    };

    var activeId = getActiveId();

    // 管理后台已独立为 admin.<域名> 子域（自带登录页），公网站点不再提供 Admin 入口
    var navTop = NAV_ITEMS.slice(0, 5);
    var navBottom = NAV_ITEMS.slice(5);

    function navHTML(items) {
      return items.map(function (item) {
        var isActive = item.id === activeId;
        return '<a href="' + item.href + '" class="nav-item' + (isActive ? ' active' : '') + '" title="' + item.label + '">' +
          '<span class="material-symbols-outlined nav-icon">' + item.icon + '</span>' +
          '<span class="nav-label">' + item.label + '</span>' +
        '</a>';
      }).join('');
    }

    var html =
      '<!-- Brand Module -->' +
      '<div class="sidebar-module brand-module" style="padding:10px var(--space-sm)">' +
        '<div class="brand-inner">' +
          '<a href="../pages/dashboard.html" style="display:contents;text-decoration:none">' +
            '<img src="../assets/image/M.LoreWorld logo.png" alt="" class="brand-logo" style="height:34px;width:auto">' +
            '<div style="display:flex;flex-direction:column;gap:0;min-width:0">' +
              '<span class="brand-text" style="font-weight:700;font-size:13px;color:var(--color-on-surface);line-height:1.2">M.LoreWorld<sup style="font-size:9px;font-weight:600;color:#4648d4;background:rgba(70,72,212,0.1);padding:1px 5px;border-radius:var(--radius-full);margin-left:3px;letter-spacing:0.03em">BETA</sup></span>' +
              '<span style="font-size:10px;color:var(--color-outline);opacity:0.45;letter-spacing:0.03em;line-height:1.2">v0.1.6.5</span>' +
            '</div>' +
          '</a>' +
          '<button class="sidebar-collapse-btn" id="collapseBtn" onclick="window._slatiToggleSidebar()" title="Toggle sidebar">' +
            '<img src="' + window._slatiSidebarIcon('left_panel_close') + '" id="collapseIcon" style="width:20px;height:20px" alt="">' +
          '</button>' +
        '</div>' +
      '</div>' +

      '<!-- User Module -->' +
      '<div class="sidebar-module user-module" style="padding:0;overflow:hidden">' +
        '<!-- Banner -->' +
        '<div class="user-banner" style="height:60px;background:linear-gradient(135deg,' +
          'var(--color-primary),#3b3dc4);position:relative">' +
          '<button class="btn btn-ghost btn-icon btn-sm" style="position:absolute;top:4px;right:4px;color:rgba(255,255,255,0.7)" title="Settings">' +
            '<span class="material-symbols-outlined" style="font-size:16px">settings</span>' +
          '</button>' +
        '</div>' +
        '<!-- User info -->' +
        '<div class="user-info-bar" style="padding:0 var(--space-md) var(--space-sm);position:relative">' +
          '<div style="position:relative;margin-top:-20px;margin-bottom:8px">' +
            '<img src="' + user.avatarUrl + '" alt="" class="avatar" style="width:40px;height:40px;border:3px solid white" />' +
            '<span class="status-dot status-dot-green" style="position:absolute;bottom:2px;right:-2px;border:2px solid white"></span>' +
          '</div>' +
          '<div class="user-name" style="font-weight:700;font-size:var(--fs-label-md);color:var(--color-on-surface)">' + user.displayName + '</div>' +
          '<div class="user-citizen-id label-sm" style="color:var(--color-outline)">' + user.citizenId + '</div>' +
          '<button class="settings-btn-collapsed" style="display:none" title="Settings">' +
            '<span class="material-symbols-outlined" style="font-size:18px">settings</span>' +
          '</button>' +
        '</div>' +
      '</div>' +

      '<!-- Nav Module -->' +
      '<div class="sidebar-module nav-module custom-scrollbar" style="flex:1;overflow-y:auto;padding:var(--space-sm)">' +
        '<nav class="sidebar-nav">' +
          navHTML(navTop) +
          '<div class="divider sidebar-divider"></div>' +
          navHTML(navBottom) +
          '<div class="divider sidebar-divider"></div>' +
          navHTML(BOTTOM_NAV) +
        '</nav>' +
      '</div>';

    var container = document.getElementById('slati-sidebar');
    if (container) {
      // Apply collapsed state BEFORE rendering to avoid flash
      try {
        var saved = localStorage.getItem('slati_sidebar_collapsed');
        if (saved === '1') {
          container.classList.add('collapsed');
          isCollapsed = true;
          var main = document.querySelector('.app-main');
          if (main && !isFloating) main.style.marginLeft = '72px';
        }
      } catch(e) {}
      container.innerHTML = html;

      // Fix icon if pre-collapsed
      if (isCollapsed) {
        var icon = document.getElementById('collapseIcon');
        if (icon) icon.src = window._slatiSidebarIcon('left_panel_open');
        // Disable transition during initial load to avoid flash
        container.style.transition = 'none';
        var main = document.querySelector('.app-main');
        if (main) main.style.transition = 'none';
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            container.style.transition = '';
            if (main) main.style.transition = '';
          });
        });
      }
    }

    // Check initial window size
    checkResponsive();
  }

  function setCollapsed(collapse, animate) {
    isCollapsed = collapse;
    var sidebar = document.getElementById('slati-sidebar');
    var main = document.querySelector('.app-main');
    var icon = document.getElementById('collapseIcon');
    var backdrop = document.getElementById('sidebarBackdrop');

    if (!sidebar) return;

    if (collapse) {
      sidebar.classList.add('collapsed');
      if (icon) icon.src = window._slatiSidebarIcon('left_panel_open');
    } else {
      sidebar.classList.remove('collapsed');
      if (icon) icon.src = window._slatiSidebarIcon('left_panel_close');
    }

    // Adjust main margin
    if (main) {
      if (isFloating) {
        main.style.marginLeft = '0';
      } else if (collapse) {
        main.style.marginLeft = '72px';
      } else {
        main.style.marginLeft = '';
      }
    }

    // Floating backdrop
    if (isFloating && !collapse && !backdrop) {
      var bd = document.createElement('div');
      bd.id = 'sidebarBackdrop';
      bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.15);z-index:45;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)';
      bd.onclick = function() { setCollapsed(true, true); };
      document.body.appendChild(bd);
    } else if ((!isFloating || collapse) && backdrop) {
      backdrop.remove();
    }

    try { localStorage.setItem('slati_sidebar_collapsed', collapse ? '1' : '0'); } catch(e) {}
  }

  function checkResponsive() {
    var wasFloating = isFloating;
    isFloating = window.innerWidth < COLLAPSE_BREAKPOINT;
    var sidebar = document.getElementById('slati-sidebar');

    if (sidebar) {
      if (isFloating) {
        sidebar.classList.add('floating');
        if (!wasFloating) setCollapsed(true, false);
      } else {
        sidebar.classList.remove('floating');
        // Don't auto-expand — respect user's stored preference
      }
    }

    // Update main margin for floating
    var main = document.querySelector('.app-main');
    if (main) {
      if (isFloating) {
        main.style.marginLeft = '0';
      } else if (isCollapsed) {
        main.style.marginLeft = '72px';
      } else {
        main.style.marginLeft = '';
      }
    }
  }

  // Expose toggle globally
  window._slatiToggleSidebar = function() {
    setCollapsed(!isCollapsed, true);
  };

  // Responsive listener
  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(checkResponsive, 150);
  });

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSidebar);
  } else {
    renderSidebar();
  }

})();
