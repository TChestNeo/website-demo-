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

  // 兜底头像（2026-09-01）：真实账号未传头像时 img src 曾是 undefined
  // → /undefined 404 每次刷新一条 console error；内联 SVG 人形零网络零 404
  window._slatiFallbackAvatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><circle cx='40' cy='40' r='40' fill='#4648d4'/><circle cx='40' cy='31' r='14' fill='#fff'/><path d='M13 74c4-16 14-24 27-24s23 8 27 24z' fill='#fff'/></svg>"
  );

  var NAV_ITEMS = [
    { id: 'home', icon: 'home', label: 'Home', href: '../index.html' },
    { id: 'micronationary', icon: 'language', label: 'MicroNationary', href: '../pages/overview.html' },
    { id: 'community', icon: 'groups', label: 'Community', href: '../pages/community-hub.html' },
    // Creation 根页 = construction.html（未来放 3D 模型）；Create World 选型页入口在 dashboard 主 CTA
    { id: 'creation', icon: 'edit_note', label: 'Creation', href: '../pages/construction.html' },
    { id: 'messages', icon: 'chat', label: 'Messages', href: '../pages/messages.html' },
    { id: 'activity', icon: 'analytics', label: 'Activity', href: '../pages/activity.html' },
    // v0.2.28.13 用户「为什么Editor按钮连接的不是 fluidcanvas-editor」——旧文章编辑器 editor.html 已删，
    // Editor 直入 FC 编辑器（getActiveId 的 editor 判断本就先于 fluidcanvas，高亮自动正确）
    { id: 'editor', icon: 'article', label: 'Editor', href: '../pages/fluidcanvas-editor.html' },
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
    if (path === '/' || path.endsWith('/index.html') || path.includes('dashboard')) return 'home';
    if (path.includes('explore') || path.includes('overview') || path.includes('guidelines')) return 'micronationary';
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
    var loggedIn = !!(window.SlatiDB && SlatiDB.isLoggedIn());
    var user = (window.SlatiDB && SlatiDB.getUser()) || {
      displayName: 'Alex Rivera',
      citizenId: 'USR-8842',
      avatarUrl: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=4648d4&color=fff&size=80',
    };

    // 未登录门禁（2026-08-31 用户「平台左侧的用户卡片直接变成一个注册/登录的按钮」）：
    // 访客不显示假用户卡片（Alex Rivera 只兜 loggedIn 但无用户记录的边缘情况），
    // 用户模块换成「注册 / 登录」CTA（../ 前缀是侧栏全站惯例，根页/子页均可解析；无设置齿轮，
    // settings-modal.js 的齿轮轮询找不到元素空转无害）。
    // v0.2.21.0 个人主页入口：真用户（USR- id）头像+名字+公民号包锚 → 自己主页（../pages 前缀全站惯例；
    // 设置齿轮留在锚外；访客/演示账号不包）
    var isRealUser = loggedIn && user && String(user.id || '').indexOf('USR-') === 0;

    // 用户等级徽章（活跃 XP；与订阅 tier 并行）。loggedIn 守卫 + try/catch——访客/异常零影响
    var levelBadgeHTML = '';
    if (loggedIn) {
      try {
        var st = window.SlatiDB.getLevelState();
        levelBadgeHTML =
          '<div class="mn-lv-badge" style="margin-top:8px">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
              '<span style="font-weight:600;font-size:11px;color:var(--color-on-surface)">Lv.' + st.lv + ' · ' + st.name + '</span>' +
              '<span style="font-size:10px;color:var(--color-outline)">' + (st.isMax ? (st.xp + ' XP') : (st.xp + ' / ' + st.nextNeed + ' XP')) + '</span>' +
            '</div>' +
            (st.isMax ? '' :
              '<div style="height:5px;border-radius:999px;background:rgba(128,128,140,0.25);overflow:hidden">' +
                '<div style="width:' + Math.round(st.progress * 100) + '%;height:100%;background:var(--color-primary);border-radius:999px;transition:width 0.4s ease"></div>' +
              '</div>') +
          '</div>';
      } catch (e) { levelBadgeHTML = ''; }
    }
    var userModuleHTML = loggedIn
      ? '<!-- User Module -->' +
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
            (isRealUser ? '<a href="../pages/community-profile.html?id=' + encodeURIComponent(user.id) + '" title="查看我的主页" style="display:block;text-decoration:none;color:inherit">' : '') +
            '<div style="position:relative;margin-top:-20px;margin-bottom:8px">' +
              '<img src="' + (user.avatarUrl || window._slatiFallbackAvatar) + '" alt="" class="avatar" style="width:40px;height:40px;border:3px solid white" />' +
              '<span class="status-dot status-dot-green" style="position:absolute;bottom:2px;right:-2px;border:2px solid white"></span>' +
            '</div>' +
            '<div class="user-name" style="font-weight:700;font-size:var(--fs-label-md);color:var(--color-on-surface)">' + user.displayName + '</div>' +
            '<div class="user-citizen-id label-sm" style="color:var(--color-outline)">' + user.citizenId + '</div>' +
            (isRealUser ? '</a>' : '') +
            levelBadgeHTML +
            '<button class="settings-btn-collapsed" style="display:none" title="Settings">' +
              '<span class="material-symbols-outlined" style="font-size:18px">settings</span>' +
            '</button>' +
          '</div>' +
        '</div>'
      : '<!-- Guest Module（未登录） -->' +
        '<div class="sidebar-module user-module guest-module" style="padding:0;overflow:hidden">' +
          '<div class="user-banner" style="height:60px;background:linear-gradient(135deg,' +
            'var(--color-primary),#3b3dc4);position:relative;display:flex;align-items:center;justify-content:center">' +
            '<span class="material-symbols-outlined" style="font-size:22px;color:rgba(255,255,255,0.9)">rocket_launch</span>' +
          '</div>' +
          '<div class="user-info-bar" style="padding:var(--space-md);display:flex;flex-direction:column;gap:6px">' +
            '<div class="user-name" style="font-weight:700;font-size:var(--fs-label-md);color:var(--color-on-surface)">加入 M.NationWorld</div>' +
            '<div class="label-sm" style="color:var(--color-outline)">创建属于你的架空国家</div>' +
            '<a href="../signup-and-login" class="btn btn-primary" style="width:100%;justify-content:center">注册 / 登录</a>' +
          '</div>' +
        '</div>';

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
          '<a href="../index.html" style="display:contents;text-decoration:none">' +
            '<img src="../assets/image/M.NationWorld logo.png" alt="" class="brand-logo" style="height:34px;width:auto">' +
            '<div style="display:flex;flex-direction:column;gap:0;min-width:0">' +
              '<span class="brand-text" style="font-weight:700;font-size:13px;color:var(--color-on-surface);line-height:1.2">M.NationWorld<sup style="font-size:9px;font-weight:600;color:#4648d4;background:rgba(70,72,212,0.1);padding:1px 5px;border-radius:var(--radius-full);margin-left:3px;letter-spacing:0.03em">BETA</sup></span>' +
              '<span style="font-size:10px;color:var(--color-outline);opacity:0.45;letter-spacing:0.03em;line-height:1.2">' + (window.MN_SITE_VERSION || 'v0.2.0.0') + '</span>' +
            '</div>' +
          '</a>' +
          '<button class="sidebar-collapse-btn" id="collapseBtn" onclick="window._slatiToggleSidebar()" title="Toggle sidebar">' +
            '<img src="' + window._slatiSidebarIcon('left_panel_close') + '" id="collapseIcon" style="width:20px;height:20px" alt="">' +
          '</button>' +
        '</div>' +
      '</div>' +

      userModuleHTML +

      '<!-- Nav Module -->' +
      // v0.2.53.3 用户「那个左侧菜单的底部背景能不能去掉？」（问询钦定「去掉空白面板」）：
      // 菜单卡不再 flex:1 拉伸到屏幕底部（1080p 下菜单项下面空出一大块空白卡片背景），
      // 高度收为内容高——侧栏只剩 logo/用户/菜单三张卡，下方留纯色侧栏底
      '<div class="sidebar-module nav-module custom-scrollbar" style="overflow-y:auto;padding:var(--space-sm)">' +
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

  // 用户等级（活跃 XP）：XP 变动实时刷新徽章；升级底部居中 toast 3.5s 自灭
  window.addEventListener('mn:xp-changed', function() {
    try { renderSidebar(); } catch (e) {}
  });
  window.addEventListener('mn:level-up', function(e) {
    try {
      var st = (e && e.detail && e.detail.state) || null;
      if (!st) return;
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:9999;' +
        'background:var(--color-primary,#4648d4);color:#fff;padding:10px 18px;border-radius:999px;' +
        'font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.25);pointer-events:none';
      el.textContent = '等级提升！Lv.' + st.lv + ' · ' + st.name;
      document.body.appendChild(el);
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 3500);
    } catch (err) {}
  });

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSidebar);
  } else {
    renderSidebar();
  }

})();
