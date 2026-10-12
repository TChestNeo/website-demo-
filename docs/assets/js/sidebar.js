/**
 * Unified Sidebar Component
 * Collapsible + responsive: auto-collapses on small windows,
 * floats over content in overlay mode.
 */
(function () {
  'use strict';

  // v0.2.54.0 i18n：T(key) 取当前语言；未接入 i18n 的页面（如 FC）回落原文。
  // 惰性取 window.MN_I18N——i18n.js 在 body 尾部、本脚本之后加载，IIFE 执行时尚不存在。
  // 注意：renderSidebar 内禁用 MN_I18N.apply()——apply 会触发 onChange 监听器再调 renderSidebar，形成递归。
  function T(k) { return (window.MN_I18N && window.MN_I18N.t(k)) || null; }

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
    { id: 'micronationary', icon: 'language', label: 'MicroNationary', href: '/micronationary' },
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
    { id: 'plugins', icon: 'extension', label: 'Plugins', href: '../pages/plugins.html' },
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
    if (path.includes('micronationary') || path.includes('explore') || path.includes('overview') || path.includes('guidelines')) return 'micronationary';
    if (path.includes('community')) return 'community';
    if (path.includes('create-topic') || path.includes('construction')) return 'creation';
    if (path.includes('create-world') || path.includes('world-wizard') || path.includes('world-created')) return 'creation';
    if (path.includes('messages')) return 'messages';
    if (path.includes('activity')) return 'activity';
    if (path.includes('editor')) return 'editor';
    if (path.includes('following')) return 'following';
    if (path.includes('workspace') || path.includes('fluidcanvas')) return 'studio';
    if (path.includes('plugins')) return 'plugins';
    if (path.includes('help')) return 'help';
    return 'home';
  }

  function renderSidebar() {
    // v0.2.54.0 i18n：语言切换后重渲染侧栏（DOM 结构零改动，仅文案取值变化）。
    // 首次渲染时注册监听——此时 i18n.js（body 尾部）已执行；重复调用幂等。
    if (!renderSidebar._i18nWired && window.MN_I18N) {
      renderSidebar._i18nWired = true;
      try { MN_I18N.onChange(function () { try { renderSidebar(); } catch (e) {} }); } catch (e) {}
    }

    // v0.2.58.15 悬停卡：重渲染（mn:xp-changed / i18n）时徽章节点被替换 → 先收卡防陈旧
    lvHoverHide();

    var loggedIn = !!(window.SlatiDB && SlatiDB.isLoggedIn());
    var user = (window.SlatiDB && SlatiDB.getUser()) || {
      displayName: 'Alex Rivera',
      citizenId: 'USR-8842',
      avatarUrl: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=4648d4&color=fff&size=80',
    };

    // v0.2.59.41 真实档案同步（用户「显示成我的账户名称」）：注册时后端 displayName 兜底=邮箱前缀
    // （账户名），用户之后在引导/设置改的显示名只在服务端 → 本地记录陈旧，侧栏一直显示账户名。
    // 登录态每次渲染拉 GET /auth/me 覆盖本地：显示名/头像等以服务端为准；在飞守卫防重入，
    // 拉取失败静默（离线保旧值）。
    if (loggedIn && window.MN_API && window.MN_API.get && !renderSidebar._meFetching) {
      renderSidebar._meFetching = true;
      window.MN_API.get('/auth/me').then(function (r) {
        renderSidebar._meFetching = false;
        var remote = r && r.ok && r.data && r.data.user;
        if (remote) {
          var local = (window.SlatiDB && SlatiDB.getUser()) || null;
          if (!local
            || (remote.displayName || '') !== (local.displayName || '')
            || (remote.avatarUrl || '') !== (local.avatarUrl || '')) {
            try { SlatiDB.saveUser(remote); } catch (e) {}
            try { renderSidebar(); } catch (e) {}
          }
        }
      }).catch(function () { renderSidebar._meFetching = false; });
    }

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
        var fillPct = Math.round(st.progress * 100);
        // v0.2.58.3 用户「呃那个等级的进度条能不能是一个环围着中间的等级号码而不是这种像时间一样的」
        //   +「从底部上灌的时候我希望你添加一个水的飘动动效分成两层这样」+「就是一层主要颜色另一层用一个
        //   浅有点的颜色增加层次感」（折叠侧栏等级水位环+双层水波）：
        //   58.2 的 conic 进度环从 12 点顺时针扫像时钟指针——废弃；环改成正圆「水杯」只围等级号码
        //   （LV 小字移到杯上方）；经验进度=水位从杯底往上灌（.mn-lv-fill 内联 height 百分比）；
        //   水单层——主色水 .mn-lv-wdeep + 杯顶一道浅色浪 .mn-lv-wlightwave（v0.2.58.10 用户「为什么是四层
        //   颜色？能不能只有两层？」一问钦定「只有主色水+一道浅浪」——删浅水层与深浪，纯 CSS 动画零 JS）；
        //   v0.2.58.13 水与浪两色统一深蓝+新慢浪 .mn-lv-wlightwave2 与快浪同几何置 z 轴 -1 层（2.5s 慢
        //   0.3s）——两浪同色相位漂移，慢浪浪峰周期性从快浪浪谷透明区透出；
        //   展开态视图 .mn-lv-normal 原徽章原样不变。
        levelBadgeHTML =
          '<div class="mn-lv-badge" style="margin-top:8px">' +
            '<div class="mn-lv-normal">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
                '<span style="font-weight:600;font-size:11px;color:var(--color-on-surface)">Lv.' + st.lv + ' · ' + st.name + '</span>' +
                '<span style="font-size:10px;color:var(--color-outline)">' + (st.isMax ? (st.xp + ' XP') : (st.xp + ' / ' + st.nextNeed + ' XP')) + '</span>' +
              '</div>' +
              (st.isMax ? '' :
                '<div style="height:5px;border-radius:999px;background:rgba(128,128,140,0.25);overflow:hidden">' +
                  '<div style="width:' + Math.round(st.progress * 100) + '%;height:100%;background:var(--color-primary);border-radius:999px;transition:width 0.4s ease"></div>' +
                '</div>') +
            '</div>' +
            '<div class="mn-lv-pill">' +
              '<span class="mn-lv-pill-tag">LV</span>' +
              '<div class="mn-lv-ring">' +
                '<div class="mn-lv-cup">' +
                  '<div class="mn-lv-fill" style="height:' + fillPct + '%">' +
                    '<div class="mn-lv-wdeep"></div>' +
                    '<div class="mn-lv-wlightwave2"></div>' +
                    '<div class="mn-lv-wlightwave"></div>' +
                  '</div>' +
                '</div>' +
                '<span class="mn-lv-pill-num">' + st.lv + '</span>' +
              '</div>' +
            '</div>' +
          '</div>';
      } catch (e) { levelBadgeHTML = ''; }
    }
    var userModuleHTML = loggedIn
      ? '<!-- User Module -->' +
        '<div class="sidebar-module user-module" style="padding:0;overflow:hidden">' +
          '<!-- Banner -->' +
          '<div class="user-banner" style="height:60px;background:linear-gradient(135deg,' +
            '#4648d4,#3b3dc4);position:relative">' +
            '<button class="btn btn-ghost btn-icon btn-sm" style="position:absolute;top:4px;right:4px;color:rgba(255,255,255,0.7)" title="' + (T('sidebar.settingsTitle') || 'Settings') + '">' +
              '<span class="material-symbols-outlined" style="font-size:16px">settings</span>' +
            '</button>' +
          '</div>' +
          '<!-- User info -->' +
          '<div class="user-info-bar" style="padding:0 var(--space-md) var(--space-sm);position:relative">' +
            (isRealUser ? '<a href="../pages/community-profile.html?id=' + encodeURIComponent(user.id) + '" title="' + (T('sidebar.profileTitle') || '查看我的主页') + '" style="display:block;text-decoration:none;color:inherit">' : '') +
            '<div style="position:relative;margin-top:-20px;margin-bottom:8px">' +
              '<img src="' + (user.avatarUrl || window._slatiFallbackAvatar) + '" alt="" class="avatar" style="width:40px;height:40px;border:3px solid white" />' +
              '<span class="status-dot status-dot-green" style="position:absolute;bottom:2px;right:-2px;border:2px solid white"></span>' +
            '</div>' +
            '<div class="user-name" style="font-weight:700;font-size:var(--fs-label-md);color:var(--color-on-surface)">' + user.displayName + '</div>' +
            '<div class="user-citizen-id label-sm" style="color:var(--color-outline)">' + user.citizenId + '</div>' +
            (isRealUser ? '</a>' : '') +
            levelBadgeHTML +
            '<button class="settings-btn-collapsed" style="display:none" title="' + (T('sidebar.settingsTitle') || 'Settings') + '">' +
              '<span class="material-symbols-outlined" style="font-size:18px">settings</span>' +
            '</button>' +
          '</div>' +
        '</div>'
      : '<!-- Guest Module（未登录） -->' +
        '<div class="sidebar-module user-module guest-module" style="padding:0;overflow:hidden">' +
          '<div class="user-banner" style="height:60px;background:linear-gradient(135deg,' +
            '#4648d4,#3b3dc4);position:relative;display:flex;align-items:center;justify-content:center">' +
            '<span class="material-symbols-outlined" style="font-size:22px;color:rgba(255,255,255,0.9)">rocket_launch</span>' +
          '</div>' +
          '<div class="user-info-bar" style="padding:var(--space-md);display:flex;flex-direction:column;gap:6px">' +
            '<div class="user-name" style="font-weight:700;font-size:var(--fs-label-md);color:var(--color-on-surface)">' + (T('sidebar.guest.title') || '加入 M.NationWorld') + '</div>' +
            '<div class="label-sm" style="color:var(--color-outline)">' + (T('sidebar.guest.sub') || '创建属于你的架空国家') + '</div>' +
            '<a href="../signup-and-login" class="btn btn-primary" style="width:100%;justify-content:center">' + (T('sidebar.guest.cta') || '注册 / 登录') + '</a>' +
          '</div>' +
        '</div>';

    var activeId = getActiveId();

    // 管理后台已独立为 admin.<域名> 子域（自带登录页），公网站点不再提供 Admin 入口
    var navTop = NAV_ITEMS.slice(0, 5);
    var navBottom = NAV_ITEMS.slice(5);

    function navHTML(items) {
      return items.map(function (item) {
        var isActive = item.id === activeId;
        var label = (T('sidebar.nav.' + item.id) || item.label);
        return '<a href="' + item.href + '" class="nav-item' + (isActive ? ' active' : '') + '" title="' + label + '">' +
          '<span class="material-symbols-outlined nav-icon">' + item.icon + '</span>' +
          '<span class="nav-label">' + label + '</span>' +
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
          '<button class="sidebar-collapse-btn" id="collapseBtn" onclick="window._slatiToggleSidebar()" title="' + (T('sidebar.toggleTitle') || 'Toggle sidebar') + '">' +
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

    // v0.2.58.15 悬停卡：徽章节点每轮重渲染被替换 → 监听重挂（旧节点随旧监听一起丢弃，无泄漏）
    initLevelHover();
    initUserPopWiring();
    injectMobileBottomNav(); // v0.2.59.x 手机底部导航
  }

  function setCollapsed(collapse, animate) {
    isCollapsed = collapse;
    lvHoverHide(); // v0.2.58.15 折叠切换即收悬停卡（展开态零卡片）

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
    lvHoverHide(); // v0.2.58.15 resize 即收卡（fixed 坐标失配）
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
      el.textContent = (T('sidebar.levelup') || '等级提升！Lv.') + st.lv + ' · ' + st.name;
      document.body.appendChild(el);
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 3500);
      // v10.28.52.0 等级奖励：升到奖励级（2/6/9/12）→ POST /api/rewards/claim 自动领奖
      // （幂等；服务端信任客户端 lv=装饰性奖励）；成功 toast+广播 mn:rewards-changed 供资料页刷新。
      if (window.MN_API && window.MN_API.post && {2:1, 6:1, 9:1, 12:1}[st.lv]) {
        window.MN_API.post('/rewards/claim', { scope: 'user', lv: st.lv }).then(function(res) {
          if (res && res.ok) {
            var t2 = document.createElement('div');
            t2.style.cssText = 'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:9999;' +
              'background:var(--color-primary,#4648d4);color:#fff;padding:10px 18px;border-radius:999px;' +
              'font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.25);pointer-events:none';
            t2.textContent = (T('rewards.claimOk') || '奖励已领取！去个人资料页查看成就与徽章');
            document.body.appendChild(t2);
            setTimeout(function() { if (t2.parentNode) t2.parentNode.removeChild(t2); }, 3500);
            if (window.dispatchEvent) window.dispatchEvent(new CustomEvent('mn:rewards-changed'));
          }
        }).catch(function() {});
      }
    } catch (err) {}
  });

  // v0.2.58.15 用户「那么能不能添加一个功能就是当滑鼠靠近那个折叠的药丸时药丸会变大然后 向右滑出
  //   一个卡片完整的显示等级信息和经验条」：折叠态药丸悬停（.mn-lv-badge 整块=悬停区，贴近即触发）
  //   药丸 scale(1.12)（CSS .mn-lv-hover 类驱动）+ 右侧滑出 .mn-lv-hovercard（position:fixed 挂
  //   document.body——侧栏 overflow-x:hidden + 用户卡 overflow:hidden 双裁剪，卡片必须逃出 DOM；
  //   z-index 150=侧栏 50/55 之上 tooltip 200 之下）；内容=每次 show 从活的 .mn-lv-normal 克隆最新
  //   innerHTML（isMax 时天然无经验条）——重渲染/XP 变动零陈旧；触屏门控 matchMedia(hover+fine)
  //   false 直接不挂监听（CSS 侧 @media 同款门控双保险）；收卡触发器：badge/卡片 mouseleave 200ms
  //   宽限（卡片 mouseenter 取消——防悬停区缝隙闪烁）+ 侧栏滚动 + 折叠切换 + 重渲染 + resize；
  //   i18n 零新键（克隆既有 DOM 文本）。
  var lvHoverCard = null;
  var lvHoverTimer = null;
  var lvHoverEnabled = null;
  var lvHoverScrollWired = false;

  function lvHoverHide() {
    if (lvHoverTimer) { clearTimeout(lvHoverTimer); lvHoverTimer = null; }
    if (!lvHoverCard) return;
    lvHoverCard.classList.remove('active');
    var badge = document.querySelector('#slati-sidebar .mn-lv-badge');
    if (badge) badge.classList.remove('mn-lv-hover');
  }

  function lvHoverShow() {
    var sidebar = document.getElementById('slati-sidebar');
    var badge = document.querySelector('#slati-sidebar .mn-lv-badge');
    var pill = badge ? badge.querySelector('.mn-lv-pill') : null;
    var normal = badge ? badge.querySelector('.mn-lv-normal') : null;
    if (!sidebar || !badge || !pill || !normal) return;
    if (!sidebar.classList.contains('collapsed')) return; // 展开态原徽章已可见，零卡片
    if (getComputedStyle(pill).display === 'none') return;
    if (!lvHoverCard) {
      lvHoverCard = document.createElement('div');
      lvHoverCard.className = 'mn-lv-hovercard';
      document.body.appendChild(lvHoverCard);
      lvHoverCard.addEventListener('mouseenter', function () {
        if (lvHoverTimer) { clearTimeout(lvHoverTimer); lvHoverTimer = null; }
      });
      lvHoverCard.addEventListener('mouseleave', lvHoverScheduleHide);
    }
    lvHoverCard.innerHTML = normal.innerHTML; // 每次 show 克隆最新（isMax 时天然无条）
    badge.classList.add('mn-lv-hover');
    var pr = pill.getBoundingClientRect();
    // offsetWidth/offsetHeight 忽略 transform（inactive 态 translateX/scale 不污染测量）
    var cw = lvHoverCard.offsetWidth, ch = lvHoverCard.offsetHeight;
    var left = pr.right + 10;
    if (left + cw + 16 > window.innerWidth) {
      left = Math.max(16, pr.left - cw - 10); // 右侧溢出 → 翻到药丸左侧
    }
    var top = pr.top + (pr.height - ch) / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - ch - 8));
    lvHoverCard.style.left = Math.round(left) + 'px';
    lvHoverCard.style.top = Math.round(top) + 'px';
    lvHoverCard.classList.add('active'); // 定位后再 active——opacity/translateX 过渡滑出
  }

  function lvHoverScheduleHide() {
    if (lvHoverTimer) clearTimeout(lvHoverTimer);
    lvHoverTimer = setTimeout(lvHoverHide, 200);
  }

  function initLevelHover() {
    if (!lvHoverScrollWired) {
      lvHoverScrollWired = true;
      var sb = document.getElementById('slati-sidebar');
      if (sb) sb.addEventListener('scroll', lvHoverHide); // 侧栏滚动即收卡（fixed 坐标失配）
    }
    var badge = document.querySelector('#slati-sidebar .mn-lv-badge');
    if (!badge) return;
    if (lvHoverEnabled === null) {
      lvHoverEnabled = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    }
    if (!lvHoverEnabled) return;
    badge.addEventListener('mouseenter', function () {
      if (lvHoverTimer) { clearTimeout(lvHoverTimer); lvHoverTimer = null; }
      lvHoverShow();
    });
    badge.addEventListener('mouseleave', lvHoverScheduleHide);
  }

  // ── v0.2.58.21 侧栏用户卡片信息弹窗 ──
  // 用户「点击左侧用户卡片或头像时是弹出用户完整信息弹窗而不是跳转到主页」：原包锚整页跳转
  // 自己主页 → 左键点击改为弹出完整信息卡（横幅+头像+名字+公民号+订阅+性别+bio+关注/粉丝/
  // 帖子统计+加入时间+「编辑资料」「查看主页」按钮；编辑资料=就地开设置弹窗 SlatiSettings.open，
  // 不跳页）；锚 href 保留——中键/ctrl/新标签仍走原生跳转；齿轮/等级徽章在锚外零影响。
  // 数据两段式：本地 slati_user 即时渲染 + 异步 GET /api/social/users/:id 回填服务器真值
  // （stats/createdAt/gender/bio/bannerUrl），回填只写仍开着的弹窗（新鲜度守卫）；失败/离线=
  // 本地数据+统计 '—'，零回退假数据。

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function ensureUserPopStyle() {
    if (document.getElementById('slati-user-pop-style')) return;
    var st = document.createElement('style');
    st.id = 'slati-user-pop-style';
    st.textContent = [
      '.slati-user-pop-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 900; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s ease; }',
      '.slati-user-pop-backdrop.active { opacity: 1; }',
      '.slati-user-pop-card { width: 380px; max-width: calc(100vw - 32px); background: var(--color-surface, #fff); border-radius: var(--radius-lg); overflow: hidden; position: relative; transform: translateY(12px); transition: transform 0.22s ease; box-shadow: 0 24px 64px rgba(0,0,0,0.3); }',
      '.slati-user-pop-backdrop.active .slati-user-pop-card { transform: none; }',
      '.slati-user-pop-close { position: absolute; top: 10px; right: 10px; z-index: 2; width: 32px; height: 32px; border-radius: 50%; border: none; background: rgba(0,0,0,0.35); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }',
      '.slati-user-pop-banner { height: 96px; background: linear-gradient(135deg, var(--color-primary, #4648d4), #3b3dc4); background-size: cover; background-position: center; }',
      '.slati-user-pop-body { padding: 0 var(--space-lg) var(--space-md); text-align: center; position: relative; }',
      '.slati-user-pop-avatar { width: 72px; height: 72px; border-radius: 50%; border: 4px solid var(--color-surface, #fff); background: var(--color-surface, #fff); margin-top: -36px; display: inline-block; object-fit: cover; }',
      '.slati-user-pop-name { font-weight: 700; font-size: 16px; color: var(--color-on-surface); margin-top: 8px; }',
      '.slati-user-pop-cid { font-size: 12px; color: var(--color-outline); margin-top: 2px; }',
      '.slati-user-pop-tier { display: inline-block; margin-top: 8px; padding: 3px 12px; border-radius: 999px; background: var(--color-primary, #4648d4); color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: capitalize; }',
      '.slati-user-pop-bio { font-size: 13px; color: var(--color-on-surface-variant); margin-top: 10px; line-height: 1.5; }',
      '.slati-user-pop-gender { font-size: 12px; color: var(--color-outline); margin-top: 4px; }',
      '.slati-user-pop-stats { display: flex; justify-content: center; margin-top: 14px; border-top: 1px solid rgba(118,117,134,0.12); padding-top: 12px; }',
      '.slati-user-pop-stat { flex: 1; }',
      '.slati-user-pop-stat .num { display: block; font-weight: 700; font-size: 15px; color: var(--color-on-surface); }',
      '.slati-user-pop-stat .lbl { display: block; font-size: 11px; color: var(--color-outline); margin-top: 2px; }',
      '.slati-user-pop-joined { font-size: 11px; color: var(--color-outline); margin-top: 10px; display: none; }',
      '.slati-user-pop-actions { display: flex; gap: 8px; padding: 0 var(--space-lg) var(--space-lg); }',
      '.slati-user-pop-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; padding: 9px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant, rgba(118,117,134,0.35)); background: transparent; color: var(--color-on-surface); font-size: 13px; font-weight: 600; font-family: var(--font-family); text-decoration: none; cursor: pointer; }',
      '.slati-user-pop-btn.primary { background: var(--color-primary, #4648d4); border-color: var(--color-primary, #4648d4); color: #fff; }',
      '.slati-user-pop-btn:hover { opacity: 0.9; }'
    ].join('\n');
    document.head.appendChild(st);
  }

  var userPopEls = null;

  function closeUserPop(instant) {
    if (!userPopEls) return;
    var els = userPopEls;
    userPopEls = null;
    if (els._escHandler) document.removeEventListener('keydown', els._escHandler);
    els.bd.classList.remove('active');
    if (document.body.style.overflow === 'hidden') document.body.style.overflow = els._prevOverflow || '';
    var finish = function () {
      if (els.bd.parentNode) els.bd.parentNode.removeChild(els.bd);
    };
    if (instant) finish(); else setTimeout(finish, 250);
  }

  function openUserPop() {
    closeUserPop(true);
    ensureUserPopStyle();
    var user = (window.SlatiDB && SlatiDB.getUser()) || {};
    if (!user.id) return;
    var ownHref = '../pages/community-profile.html?id=' + encodeURIComponent(user.id);
    var tier = user.tier && user.tier !== 'free' ? user.tier : null;
    var genderLabel = T('settings.profile.gender') || 'Gender';
    var bd = document.createElement('div');
    bd.className = 'slati-user-pop-backdrop';
    var card = document.createElement('div');
    card.className = 'slati-user-pop-card';
    card.setAttribute('role', 'dialog');
    card.innerHTML =
      '<button class="slati-user-pop-close" type="button" aria-label="Close"><span class="material-symbols-outlined" style="font-size:18px">close</span></button>' +
      '<div class="slati-user-pop-banner" id="userPopBanner"' + (user.bannerUrl ? ' style="background-image:url(\'' + escHtml(user.bannerUrl) + '\')"' : '') + '></div>' +
      '<div class="slati-user-pop-body">' +
        '<img class="slati-user-pop-avatar" id="userPopAvatar" src="' + escHtml(user.avatarUrl || window._slatiFallbackAvatar) + '" alt="">' +
        '<div class="slati-user-pop-name" id="userPopName">' + escHtml(user.displayName || '') + '</div>' +
        '<div class="slati-user-pop-cid" id="userPopCid">' + escHtml(user.citizenId || '') + '</div>' +
        (tier ? '<span class="slati-user-pop-tier">' + escHtml(tier) + '</span>' : '') +
        '<div class="slati-user-pop-bio" id="userPopBio"' + (user.bio ? '' : ' style="display:none"') + '>' + escHtml(user.bio || '') + '</div>' +
        '<div class="slati-user-pop-gender" id="userPopGender"' + (user.gender ? '' : ' style="display:none"') + '>' +
          (user.gender ? genderLabel + ': ' + escHtml(user.gender) : '') + '</div>' +
        '<div class="slati-user-pop-stats">' +
          '<div class="slati-user-pop-stat"><span class="num" id="userPopFollowing">—</span><span class="lbl">' + (T('sidebar.pop.following') || '关注') + '</span></div>' +
          '<div class="slati-user-pop-stat"><span class="num" id="userPopFollowers">—</span><span class="lbl">' + (T('sidebar.pop.followers') || '粉丝') + '</span></div>' +
          '<div class="slati-user-pop-stat"><span class="num" id="userPopPosts">—</span><span class="lbl">' + (T('sidebar.pop.posts') || '帖子') + '</span></div>' +
        '</div>' +
        '<div class="slati-user-pop-joined" id="userPopJoined"></div>' +
      '</div>' +
      '<div class="slati-user-pop-actions">' +
        '<button class="slati-user-pop-btn primary" id="userPopEditBtn" type="button">' + (T('sidebar.pop.editProfile') || '编辑资料') + '</button>' +
        '<a class="slati-user-pop-btn" id="userPopViewBtn" href="' + ownHref + '">' + (T('sidebar.pop.viewProfile') || '查看主页') + '</a>' +
      '</div>';
    bd.appendChild(card);
    document.body.appendChild(bd);
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    var escHandler = function (e) { if (e.key === 'Escape') closeUserPop(false); };
    document.addEventListener('keydown', escHandler);
    userPopEls = { bd: bd, _escHandler: escHandler, _prevOverflow: prevOverflow };
    requestAnimationFrame(function () {
      if (userPopEls && userPopEls.bd === bd) bd.classList.add('active');
    });

    card.querySelector('.slati-user-pop-close').addEventListener('click', function () { closeUserPop(false); });
    bd.addEventListener('click', function (e) { if (e.target === bd) closeUserPop(false); });
    var editBtn = card.querySelector('#userPopEditBtn');
    editBtn.addEventListener('click', function () {
      if (window.SlatiSettings && window.SlatiSettings.open) {
        closeUserPop(true);
        window.SlatiSettings.open();
      } else {
        window.location.href = ownHref; // 设置弹窗未载（异常页）兜底跳资料页
      }
    });

    // 两段式回填：服务器真值（stats/createdAt/gender/bio/bannerUrl/avatar）
    var popSet = function (id, text) {
      if (!userPopEls || userPopEls.bd !== bd) return; // 弹窗已关——新鲜度守卫
      var n = bd.querySelector('#' + id);
      if (n) n.textContent = text;
    };
    var popShow = function (id) {
      if (!userPopEls || userPopEls.bd !== bd) return;
      var n = bd.querySelector('#' + id);
      // 显式 block：.slati-user-pop-joined 基态 display:none（有值才显示），'' 会回落基态仍然不可见
      if (n) n.style.display = 'block';
    };
    var getter;
    if (window.MN_API && window.MN_API.get) {
      getter = window.MN_API.get('/social/users/' + encodeURIComponent(user.id));
    } else {
      var base = (window.MN_API && window.MN_API.BASE) || (window.MN_SITE && window.MN_SITE.apiBase) || '/api';
      getter = fetch(base + '/social/users/' + encodeURIComponent(user.id), { credentials: 'include' })
        .then(function (r) { return r.json().catch(function () { return null; }); })
        .then(function (d) { return { ok: !!(d && d.user), status: 0, data: d }; })
        .catch(function () { return { ok: false, status: 0, data: null, networkError: true }; });
    }
    getter.then(function (res) {
      if (!userPopEls || userPopEls.bd !== bd) return;
      if (!res.ok || !res.data || !res.data.user) return; // 失败/离线：本地数据+统计 '—'
      var u = res.data.user;
      if (u.displayName) popSet('userPopName', u.displayName);
      if (u.citizenId) popSet('userPopCid', u.citizenId);
      if (u.bio) { popSet('userPopBio', u.bio); popShow('userPopBio'); }
      if (u.gender) { popSet('userPopGender', genderLabel + ': ' + u.gender); popShow('userPopGender'); }
      if (typeof u.followingCount === 'number') popSet('userPopFollowing', String(u.followingCount));
      if (typeof u.followerCount === 'number') popSet('userPopFollowers', String(u.followerCount));
      if (u.stats && typeof u.stats.postCount === 'number') popSet('userPopPosts', String(u.stats.postCount));
      if (u.bannerUrl) {
        var bn = bd.querySelector('#userPopBanner');
        if (bn) bn.style.backgroundImage = 'url(' + u.bannerUrl + ')';
      }
      if (u.avatarUrl) {
        var av = bd.querySelector('#userPopAvatar');
        if (av) av.src = u.avatarUrl;
      }
      if (u.createdAt) {
        var d = new Date(u.createdAt);
        if (!isNaN(d.getTime())) {
          popSet('userPopJoined', (T('sidebar.pop.joined') || '加入时间') + ' ' +
            d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2));
          popShow('userPopJoined');
        }
      }
    });
  }

  function initUserPopWiring() {
    // 重渲染（i18n/XP 变动）后锚节点被替换 → 监听重挂（旧节点随旧监听一起丢弃，无泄漏）
    var anchor = document.querySelector('#slati-sidebar .user-module .user-info-bar a');
    if (!anchor || anchor._userPopWired) return;
    anchor._userPopWired = true;
    anchor.addEventListener('click', function (e) {
      // 普通左键=弹信息卡；中键/ctrl/cmd/shift/alt 仍走原生 href（锚保留）
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // 拦截冒泡：transitions.js 在 document 层拦锚点击做程序化导航（location.href 赋值），
      // preventDefault 拦不住程序化导航——stopPropagation 让事件到不了 document 层
      e.stopPropagation();
      openUserPop();
    });
  }

  // v0.2.59.x 手机底部导航（5 tab：首页/百科/社区/消息/我的；「我的」=完整设置中心）
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function escAttr(s) { return escHtml(s); }

  function mbnRow(o) {
    var inner = '<span class="material-symbols-outlined mbn-ico">' + o.icon + '</span>'
      + '<span class="mbn-row-label">' + escHtml(o.label) + '</span>';
    if (o.toggle) {
      inner += '<span class="mbn-switch" data-on="0"><span class="mbn-knob"></span></span>';
      return '<div class="mbn-row mbn-toggle-row" data-mbn-toggle="' + o.id + '">' + inner + '</div>';
    }
    inner += '<span class="material-symbols-outlined mbn-chev">chevron_right</span>';
    if (o.onclick) {
      return '<button type="button" class="mbn-row' + (o.cls ? ' ' + o.cls : '') + '" onclick="' + o.onclick + '">' + inner + '</button>';
    }
    var voidOn = '';
    if (o.sub) voidOn = ' onclick="window._slatiOpenSub(\'' + o.sub + '\');return false;"';
    else if (!o.href) voidOn = ' onclick="window._slatiMeSoon(\'' + escAttr(o.label) + '\');return false;"';
    return '<a class="mbn-row' + (o.cls ? ' ' + o.cls : '') + '" href="' + escAttr(o.href || 'javascript:void(0)') + '"' + voidOn + '>' + inner + '</a>';
  }

  function injectMobileBottomNav() {
    if (document.querySelector('.mobile-bottom-nav')) return;
    var act = getActiveId();
    var meActive = ['activity', 'following', 'plugins', 'editor', 'studio', 'help'].indexOf(act) !== -1;
    var items = [
      { id: 'home', icon: 'home', label: T('sidebar.nav.home') || '首页', href: '../index.html' },
      { id: 'micronationary', icon: 'language', label: T('sidebar.nav.micronationary') || '百科', href: '/micronationary' },
      { id: 'community', icon: 'groups', label: T('sidebar.nav.community') || '社区', href: '../pages/community-hub.html' },
      { id: 'messages', icon: 'chat', label: T('sidebar.nav.messages') || '消息', href: '../pages/messages.html' },
      { id: 'me', icon: 'person', label: T('sidebar.nav.me') || '我的', href: 'javascript:void(0)' }
    ];
    var navHtml = items.map(function (it) {
      var isMe = it.id === 'me';
      var isActive = (it.id === act) || (isMe && meActive);
      var onclick = isMe ? ' onclick="window._slatiOpenMeSheet();return false;"' : '';
      return '<a href="' + it.href + '" class="mbn-item' + (isActive ? ' active' : '') + '"' + onclick + '>'
        + '<span class="material-symbols-outlined">' + it.icon + '</span>'
        + '<span>' + it.label + '</span></a>';
    }).join('');
    var nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.innerHTML = navHtml;

    // v0.2.59.x JS 兜底：底部菜单核心样式随 JS 注入（不依赖本页内联 ethereal.css——
    // 手机缓存旧 HTML 导致内联 CSS 缺失时，底部菜单依然可见可用；!important 压过一切旧规则）
    if (!document.getElementById('slati-mbn-style')) {
      var st = document.createElement('style');
      st.id = 'slati-mbn-style';
      st.textContent = [
        '.mobile-bottom-nav{display:none}',
        '.mbn-backdrop{display:none}',
        '.mbn-sheet{display:none}',
        '.mbn-subsheet{display:none}',
        '@media (max-width:768px){',
        '.app-sidebar{display:none !important}',
        '#statsRow,.kpi-grid,#kpiRow,#categoryGrid{grid-template-columns:repeat(2,1fr) !important}',
        '[style*="grid-template-columns:repeat(4,"],[style*="grid-template-columns: repeat(4,"],[style*="grid-template-columns:repeat(5,"],[style*="grid-template-columns: repeat(5,"],[style*="grid-template-columns:repeat(6,"],[style*="grid-template-columns: repeat(6,"],[style*="grid-template-columns:repeat(7,"],[style*="grid-template-columns: repeat(7,"]{grid-template-columns:repeat(2,1fr) !important}',
        '[style*="grid-template-columns:1fr 340px"],[style*="grid-template-columns: 1fr 340px"],[style*="grid-template-columns:1fr 320px"],[style*="grid-template-columns: 1fr 320px"],[style*="grid-template-columns:1fr 300px"],[style*="grid-template-columns: 1fr 300px"]{grid-template-columns:1fr !important}',
        '.mobile-bottom-nav{display:flex !important;position:fixed;left:50% !important;right:auto !important;transform:translateX(-50%) !important;bottom:calc(12px + env(safe-area-inset-bottom)) !important;height:56px !important;z-index:9999;width:auto;min-width:264px;max-width:calc(100% - 28px);border-radius:999px;padding:0 6px;background:rgba(255,255,255,0.72);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);box-shadow:0 10px 36px rgba(20,20,40,0.18),inset 0 0.5px 0 rgba(255,255,255,0.65)}',
        ':root[data-theme="dark"] .mobile-bottom-nav{background:rgba(24,24,38,0.72) !important;box-shadow:0 10px 36px rgba(0,0,0,0.42),inset 0 0.5px 0 rgba(255,255,255,0.14)}',
        '.mobile-bottom-nav .mbn-item{flex:1;min-width:48px;max-width:78px;padding:0 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;text-decoration:none;color:var(--color-outline,#6f6e7b);font-size:10px;font-weight:500;border-radius:999px;transition:background .2s ease,color .2s ease}',
        '.mobile-bottom-nav .mbn-item .material-symbols-outlined{font-size:22px}',
        '.mobile-bottom-nav .mbn-item.active{color:var(--color-primary,#4648d4) !important;background:rgba(70,72,212,0.10)}',
        ':root[data-theme="dark"] .mobile-bottom-nav .mbn-item.active{background:rgba(122,126,255,0.18)}',
        '.mbn-backdrop{display:block;position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.32);opacity:0;pointer-events:none;transition:opacity .25s ease}',
        '.mbn-backdrop.open{opacity:1;pointer-events:auto}',
        '.mbn-sheet{display:block;position:fixed;left:0;right:0;bottom:0;z-index:9999;background:var(--color-surface-container-lowest,#fff);border-radius:20px 20px 0 0;transform:translateY(105%);transition:transform .32s cubic-bezier(.22,1,.36,1);padding:16px 20px 86px;box-shadow:0 -12px 40px rgba(0,0,0,.14);max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch}',
        '.mbn-sheet.open{transform:translateY(0)}',
        '.mbn-user-card{display:flex;align-items:center;gap:12px;padding:4px 0 14px;text-decoration:none;color:var(--color-on-surface,#1a1a2e);border-bottom:1px solid rgba(118,117,134,0.12)}',
        '.mbn-avatar{width:48px;height:48px;border-radius:50%;background:var(--color-primary,#4648d4);object-fit:cover;flex-shrink:0}',
        '.mbn-user-meta{min-width:0;flex:1}',
        '.mbn-user-name{font-weight:700;font-size:16px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.mbn-user-cid{font-size:12px;color:var(--color-outline,#6f6e7b);margin-top:2px}',
        '.mbn-row{display:flex;align-items:center;gap:12px;width:100%;padding:13px 0;background:none;border:none;cursor:pointer;text-align:left;text-decoration:none;color:var(--color-on-surface,#1a1a2e);font-size:14px;font-family:inherit;border-bottom:1px solid rgba(118,117,134,0.1)}',
        '.mbn-ico{color:var(--color-outline,#6f6e7b);font-size:22px;flex-shrink:0}',
        '.mbn-row-label{flex:1;min-width:0}',
        '.mbn-chev{color:var(--color-outline,#6f6e7b);opacity:.5;font-size:20px}',
        '.mbn-row.mbn-danger{color:#d23b3b}',
        '.mbn-row.mbn-danger .mbn-ico{color:#d23b3b}',
        '.mbn-group-title{font-weight:700;font-size:13px;color:var(--color-outline,#6f6e7b);letter-spacing:.03em;margin:14px 0 6px;text-transform:uppercase}',
        '.mbn-group-name{font-size:12px;color:var(--color-outline,#6f6e7b);padding:10px 0 2px}',
        '.mbn-switch{width:44px;height:26px;border-radius:999px;flex-shrink:0;background:#c8c7d4;position:relative;transition:background .18s ease}',
        '.mbn-switch .mbn-knob{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s ease}',
        '.mbn-switch[data-on="1"]{background:var(--color-primary,#4648d4)}',
        '.mbn-switch[data-on="1"] .mbn-knob{transform:translateX(18px)}',
        '.mbn-subsheet{display:block;position:fixed;left:0;right:0;bottom:0;z-index:10000;background:var(--color-surface-container-lowest,#fff);border-radius:20px 20px 0 0;transform:translateY(105%);transition:transform .3s cubic-bezier(.22,1,.36,1);padding:16px 20px 86px;box-shadow:0 -12px 40px rgba(0,0,0,.16);max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch}',
        '.mbn-subsheet.open{transform:translateY(0)}',
        '.mbn-sub-head{display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1px solid rgba(118,117,134,0.12)}',
        '.mbn-sub-back{width:36px;height:36px;border-radius:50%;border:none;background:none;color:var(--color-on-surface,#1a1a2e);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}',
        '.mbn-sub-title{font-weight:700;font-size:16px}',
        '.mbn-sub-row{display:flex;align-items:center;gap:12px;width:100%;padding:13px 0;background:none;border:none;cursor:pointer;text-align:left;font-size:14px;color:var(--color-on-surface,#1a1a2e);font-family:inherit;border-bottom:1px solid rgba(118,117,134,0.1)}',
        '.mbn-sub-row>span:first-child{flex:1;min-width:0}',
        '.mbn-sub-row.on{color:var(--color-primary,#4648d4);font-weight:600}',
        '.mbn-sub-check{color:var(--color-outline,#6f6e7b);opacity:.6;font-size:20px;flex-shrink:0}',
        '.mbn-sub-row.on .mbn-sub-check{color:var(--color-primary,#4648d4);opacity:1}',
        '.mbn-sub-sec{font-size:12px;color:var(--color-outline,#6f6e7b);text-transform:uppercase;letter-spacing:.03em;padding:14px 0 4px}',
        '.mbn-sub-note{font-size:13px;color:var(--color-outline,#6f6e7b);padding:14px 0;line-height:1.5}',
        '.mbn-list-item{padding:12px 0;border-bottom:1px solid rgba(118,117,134,0.1)}',
        '.mbn-list-head{display:flex;align-items:center;justify-content:space-between;gap:10px}',
        '.mbn-list-author{font-weight:600;font-size:14px}',
        '.mbn-list-time{font-size:11px;color:var(--color-outline,#6f6e7b)}',
        '.mbn-list-body{font-size:13px;color:var(--color-outline,#6f6e7b);margin-top:4px;line-height:1.5;word-break:break-word}',
        '.mbn-unblock{border:1px solid rgba(118,117,134,0.3);background:none;color:var(--color-on-surface,#1a1a2e);border-radius:999px;padding:4px 12px;font-size:12px;cursor:pointer;flex-shrink:0}',
        '.mbn-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:rgba(24,24,32,.9);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;z-index:10001;opacity:0;pointer-events:none;transition:opacity .22s ease;max-width:86vw;text-align:center}',
        '.mbn-toast.show{opacity:1}',
        '.mn-dl-btn{display:inline-flex !important;position:fixed;top:calc(12px + env(safe-area-inset-top));right:14px;z-index:9990;align-items:center;gap:4px;height:34px;padding:0 14px;border-radius:999px;background:var(--color-primary,#4648d4);color:#fff;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.01em;box-shadow:0 4px 14px rgba(70,72,212,0.35)}',
        '.mn-dl-btn .material-symbols-outlined{font-size:16px}',
        '.app-main{padding-bottom:74px}',
        '}'
      ].join('\n');
      document.head.appendChild(st);
    }

    var u = null;
    try { u = (window.SlatiDB && window.SlatiDB.getUser) ? window.SlatiDB.getUser() : null; } catch (e) {}

    // ① 顶部用户卡片
    var cardHtml;
    if (u && u.id) {
      var pid = encodeURIComponent(u.id);
      cardHtml = '<a class="mbn-user-card" href="../pages/community-profile.html?id=' + pid + '">'
        + '<img class="mbn-avatar" src="' + escAttr(u.avatarUrl || '') + '" alt="" onerror="this.style.display=\'none\'">'
        + '<div class="mbn-user-meta"><div class="mbn-user-name">' + escHtml(u.displayName || u.citizenId || '') + '</div>'
        + '<div class="mbn-user-cid">' + escHtml(u.citizenId || '') + (u.tier && u.tier !== 'free' ? ' · ' + escHtml(u.tier) : '') + '</div></div>'
        + '<span class="material-symbols-outlined mbn-chev">chevron_right</span></a>';
    } else {
      cardHtml = '<a class="mbn-user-card" href="../signup-and-login">'
        + '<span class="material-symbols-outlined mbn-ico" style="color:var(--color-primary)">account_circle</span>'
        + '<div class="mbn-user-meta"><div class="mbn-user-name">' + (T('sidebar.guest.cta') || '注册 / 登录') + '</div>'
        + '<div class="mbn-user-cid">' + (T('sidebar.guest.hint') || '登录后同步你的国家与动态') + '</div></div>'
        + '<span class="material-symbols-outlined mbn-chev">chevron_right</span></a>';
    }

    // ② 关注 / 插件
    var quick = mbnRow({ icon: 'favorite', label: T('sidebar.nav.following') || '关注', href: '../pages/following.html' })
      + mbnRow({ icon: 'extension', label: T('sidebar.nav.plugins') || '插件', href: '../pages/plugins.html' });

    // ③ 设置与隐私（5 分类）
    var prof = '../pages/community-profile.html' + (u && u.id ? '?id=' + encodeURIComponent(u.id) : '');
    var groups = [
      { title: '活动', rows: [
        mbnRow({ icon: 'tune', label: '内容偏好', sub: 'content_pref' }),
        mbnRow({ icon: 'notifications', label: '通知', toggle: 1, id: 'notify' })
      ]},
      { title: '账户', rows: [
        mbnRow({ icon: 'account_circle', label: '个人账户', href: prof }),
        mbnRow({ icon: 'shield', label: '隐私与安全', sub: 'privacy' })
      ]},
      { title: '可见性', rows: [
        mbnRow({ icon: 'lock', label: '私密账号', toggle: 1, id: 'private_acct' }),
        mbnRow({ icon: 'block', label: '屏蔽账号', sub: 'blocked' })
      ]},
      { title: '互动', rows: [
        mbnRow({ icon: 'comment', label: '评论', toggle: 1, id: 'allow_comments' }),
        mbnRow({ icon: 'alternate_email', label: '提及', toggle: 1, id: 'allow_mentions' }),
        mbnRow({ icon: 'mail', label: '私信', toggle: 1, id: 'allow_dm' }),
        mbnRow({ icon: 'content_copy', label: '二次创作内容', toggle: 1, id: 'allow_derivative' }),
        mbnRow({ icon: 'favorite', label: '关注列表', href: '../pages/following.html' }),
        mbnRow({ icon: 'thumb_up', label: '赞过的视频', sub: 'liked' })
      ]},
      { title: '偏好设置', rows: [
        mbnRow({ icon: 'translate', label: '语言', sub: 'lang' }),
        mbnRow({ icon: 'groups', label: '观众控制', sub: 'audience' }),
        mbnRow({ icon: 'visibility', label: '显示', sub: 'display' }),
        mbnRow({ icon: 'accessibility', label: '辅助功能', sub: 'accessibility' })
      ]}
    ];
    var groupsHtml = '<div class="mbn-group-title">' + (T('sidebar.me.settings') || '设置与隐私') + '</div>'
      + groups.map(function (g) {
          return '<div class="mbn-group"><div class="mbn-group-name">' + escHtml(g.title) + '</div>' + g.rows.join('') + '</div>';
        }).join('');

    // ④ 帮助与支持
    var help = mbnRow({ icon: 'help', label: T('sidebar.nav.help') || '帮助与支持', href: '../pages/help.html' });

    // ⑤ 账户操作
    var account;
    if (u && u.id) {
      account = '<button type="button" class="mbn-row" onclick="window._slatiMeLogout()"><span class="material-symbols-outlined mbn-ico">logout</span><span class="mbn-row-label">' + (T('sidebar.me.logout') || '登出') + '</span><span class="material-symbols-outlined mbn-chev">chevron_right</span></button>'
        + '<button type="button" class="mbn-row" onclick="window._slatiMeSwitch()"><span class="material-symbols-outlined mbn-ico">swap_horiz</span><span class="mbn-row-label">' + (T('sidebar.me.switch') || '切换账户') + '</span><span class="material-symbols-outlined mbn-chev">chevron_right</span></button>'
        + '<button type="button" class="mbn-row mbn-danger" onclick="window._slatiMeDelete()"><span class="material-symbols-outlined mbn-ico">delete_forever</span><span class="mbn-row-label">' + (T('sidebar.me.delete') || '删除账户') + '</span><span class="material-symbols-outlined mbn-chev">chevron_right</span></button>';
    } else {
      account = mbnRow({ icon: 'login', label: T('sidebar.me.login') || '登录', href: '../signup-and-login' });
    }

    var sheetHtml = cardHtml + quick + groupsHtml + help + account;

    var sheet = document.createElement('div');
    sheet.className = 'mbn-sheet';
    sheet.id = 'mbnMeSheet';
    sheet.innerHTML = sheetHtml;

    var backdrop = document.createElement('div');
    backdrop.className = 'mbn-backdrop';
    backdrop.id = 'mbnBackdrop';
    backdrop.onclick = function () { window._slatiCloseMeSheet(); };

    document.body.appendChild(nav);
    document.body.appendChild(sheet);
    document.body.appendChild(backdrop);

    // 开关状态：localStorage 持久化 + 点击切换
    sheet.querySelectorAll('[data-mbn-toggle]').forEach(function (row) {
      var id = row.getAttribute('data-mbn-toggle');
      var sw = row.querySelector('.mbn-switch');
      var on = '0';
      try { on = localStorage.getItem('slati_meset_' + id) || '0'; } catch (e) {}
      if (on === '1') sw.setAttribute('data-on', '1');
      row.addEventListener('click', function () {
        var cur = sw.getAttribute('data-on') === '1' ? '0' : '1';
        sw.setAttribute('data-on', cur);
        try { localStorage.setItem('slati_meset_' + id, cur); } catch (e) {}
      });
    });
  }

  window._slatiOpenMeSheet = function () {
    var s = document.getElementById('mbnMeSheet');
    var b = document.getElementById('mbnBackdrop');
    if (s) s.classList.add('open');
    if (b) b.classList.add('open');
  };
  window._slatiCloseMeSheet = function () {
    var s = document.getElementById('mbnMeSheet');
    var b = document.getElementById('mbnBackdrop');
    if (s) s.classList.remove('open');
    if (b) b.classList.remove('open');
  };

  // 「我的」sheet 账户操作 + 轻提示
  window._slatiMeToast = function (msg) {
    var t = document.getElementById('mbnToast');
    if (!t) { t = document.createElement('div'); t.id = 'mbnToast'; t.className = 'mbn-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._mbnToastT);
    window._mbnToastT = setTimeout(function () { t.classList.remove('show'); }, 2200);
  };
  window._slatiMeSoon = function (label) { window._slatiMeToast((label || '该设置') + '：即将上线'); };
  window._slatiMeLogout = function () {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () {}).finally(function () {
      try { localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user'); } catch (e) {}
      window.location.reload();
    });
  };
  window._slatiMeSwitch = function () {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () {}).finally(function () {
      try { localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user'); } catch (e) {}
      window.location.href = '../signup-and-login';
    });
  };
  window._slatiMeDelete = function () {
    if (!window.confirm((T && T('sidebar.me.deleteConfirm')) || '删除账户后 30 天内重新登录可恢复；30 天后所有数据将被彻底删除且不可恢复。确定继续？')) return;
    fetch('/api/auth/email-code', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'delete_confirm' }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { window.alert(d.error || '发送验证码失败，请重试'); return; }
        var code = window.prompt((T && T('sidebar.me.deleteCode')) || '验证码已发送到你的邮箱，请输入 6 位验证码确认删除：');
        if (!code) return;
        return fetch('/api/auth/delete', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: String(code).trim() }) })
          .then(function (r) { return r.json(); })
          .then(function (dd) {
            if (dd.ok && dd.restoreBy) {
              window.alert('已申请删除。最终删除时间：' + dd.restoreBy + '。在此期间重新登录即可恢复。');
              try { localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user'); } catch (e) {}
              window.location.reload();
            } else if (dd.error) {
              window.alert(dd.error || '删除失败，请重试');
            }
          });
      })
      .catch(function () { window.alert('删除失败，请检查网络后重试'); });
  };

  // 「我的」二级子 sheet（语言/显示/辅助功能/内容偏好/观众控制/隐私与安全/屏蔽账号/赞过的视频）
  function mbnSubShell(title, inner) {
    return '<div class="mbn-sub-head"><button type="button" class="mbn-sub-back" onclick="window._slatiCloseSub()" aria-label="返回"><span class="material-symbols-outlined">arrow_back</span></button><span class="mbn-sub-title">' + escHtml(title) + '</span></div><div class="mbn-sub-body">' + inner + '</div>';
  }
  function mbnSubRadio(items, cur, onPick) {
    return items.map(function (it) {
      var on = it.val === cur;
      return '<button type="button" class="mbn-sub-row' + (on ? ' on' : '') + '" onclick="' + onPick + '(\'' + escAttr(it.val) + '\')">'
        + '<span>' + escHtml(it.label) + '</span>'
        + '<span class="material-symbols-outlined mbn-sub-check">' + (on ? 'radio_button_checked' : 'radio_button_unchecked') + '</span></button>';
    }).join('');
  }
  function mbnSubToggle(id, label, defOn) {
    var on = '0';
    try { on = localStorage.getItem('slati_meset_' + id) || (defOn ? '1' : '0'); } catch (e) {}
    return '<button type="button" class="mbn-sub-row" data-mbn-subtoggle="' + id + '">'
      + '<span>' + escHtml(label) + '</span>'
      + '<span class="mbn-switch" data-on="' + on + '"><span class="mbn-knob"></span></span></button>';
  }

  window._slatiCloseSub = function () {
    var el = document.getElementById('mbnSubSheet');
    if (el) el.remove();
  };
  window._slatiSetLang = function (code) {
    try { localStorage.setItem('slati_lang', code); } catch (e) {}
    if (window.MN_I18N && window.MN_I18N.setLang) window.MN_I18N.setLang(code);
    window._slatiCloseSub();
  };
  window._slatiSetTheme = function (t) {
    var resolved = t;
    if (t === 'system') {
      var m = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      resolved = (m && m.matches) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    try {
      var s = JSON.parse(localStorage.getItem('slati_settings') || '{}');
      s.theme = t; localStorage.setItem('slati_settings', JSON.stringify(s));
    } catch (e) {}
    window._slatiCloseSub();
  };
  window._slatiSetAccent = function (a) {
    if (a === 'mono') document.documentElement.setAttribute('data-accent', 'mono');
    else document.documentElement.removeAttribute('data-accent');
    try {
      var s = JSON.parse(localStorage.getItem('slati_settings') || '{}');
      s.accent = a; localStorage.setItem('slati_settings', JSON.stringify(s));
    } catch (e) {}
    window._slatiCloseSub();
  };
  window._slatiSetAudience = function (v) {
    try { localStorage.setItem('slati_meset_audience', v); } catch (e) {}
    window._slatiCloseSub();
  };
  window._slatiChangePassword = function () {
    var pw = window.prompt('请输入新密码（至少 8 位）：');
    if (!pw) return;
    if (pw.length < 8) { window.alert('密码至少 8 位'); return; }
    fetch('/api/auth/password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: pw }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { window.alert(d.ok ? '密码已更新' : (d.error || '修改失败')); });
  };

  function subContent(key) {
    if (key === 'lang') {
      var langs = (window.MN_I18N && window.MN_I18N.LANGS) || [{ code: 'zh', name: '中文' }, { code: 'en', name: 'English' }];
      var cur = (window.MN_I18N && window.MN_I18N.getLang()) || 'zh';
      var items = langs.map(function (l) { return { val: l.code, label: l.name }; });
      return mbnSubShell('语言', mbnSubRadio(items, cur, 'window._slatiSetLang'));
    }
    if (key === 'display') {
      var th = document.documentElement.getAttribute('data-theme') || 'light';
      var acc = document.documentElement.getAttribute('data-accent') || 'blue';
      var themeHtml = mbnSubRadio([{ val: 'light', label: '浅色' }, { val: 'dark', label: '深色' }, { val: 'system', label: '跟随系统' }], th, 'window._slatiSetTheme');
      var accentHtml = mbnSubRadio([{ val: 'blue', label: '品牌蓝' }, { val: 'mono', label: '黑白' }], acc, 'window._slatiSetAccent');
      return mbnSubShell('显示', '<div class="mbn-sub-sec">主题</div>' + themeHtml + '<div class="mbn-sub-sec">主题色</div>' + accentHtml);
    }
    if (key === 'accessibility') {
      return mbnSubShell('辅助功能', mbnSubToggle('reduce_motion', '减少动画'));
    }
    if (key === 'content_pref') {
      var topics = ['政治', '经济', '文化', '科技', '军事', '体育', '娱乐', '生活'];
      var html = topics.map(function (t) { return mbnSubToggle('topic_' + t, t); }).join('');
      return mbnSubShell('内容偏好', html);
    }
    if (key === 'audience') {
      var cur2 = 'public';
      try { cur2 = localStorage.getItem('slati_meset_audience') || 'public'; } catch (e) {}
      var items2 = [{ val: 'public', label: '公开（所有人可见）' }, { val: 'followers', label: '仅关注者可见' }, { val: 'private', label: '仅自己可见' }];
      return mbnSubShell('观众控制', mbnSubRadio(items2, cur2, 'window._slatiSetAudience'));
    }
    if (key === 'privacy') {
      var pwRow = '<button type="button" class="mbn-sub-row" onclick="window._slatiChangePassword()"><span>修改密码</span><span class="material-symbols-outlined mbn-sub-check">chevron_right</span></button>';
      var note = '<p class="mbn-sub-note">两步验证、登录设备管理将在后续版本上线。</p>';
      return mbnSubShell('隐私与安全', pwRow + note);
    }
    if (key === 'blocked') {
      return mbnSubShell('屏蔽账号', '<div class="mbn-sub-list" id="mbnSubList">加载中…</div>');
    }
    if (key === 'liked') {
      return mbnSubShell('赞过的视频', '<div class="mbn-sub-list" id="mbnSubList">加载中…</div>');
    }
    return mbnSubShell('设置', '');
  }

  function loadList(key) {
    var el = document.getElementById('mbnSubList');
    if (!el) return;
    var u = null;
    try { u = (window.SlatiDB && window.SlatiDB.getUser) ? window.SlatiDB.getUser() : null; } catch (e) {}
    var uid = (u && u.id) ? u.id : '';
    if (key === 'liked') {
      if (!uid) { el.innerHTML = '<p class="mbn-sub-note">登录后查看赞过的内容</p>'; return; }
      fetch('/api/social/users/' + encodeURIComponent(uid) + '/posts?tab=likes', { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var posts = (d && d.posts) || [];
          if (!posts.length) { el.innerHTML = '<p class="mbn-sub-note">暂无赞过的内容</p>'; return; }
          el.innerHTML = posts.map(function (p) {
            return '<div class="mbn-list-item"><div class="mbn-list-head"><span class="mbn-list-author">' + escHtml(p.authorName || '') + '</span><span class="mbn-list-time">' + (p.createdAt ? String(p.createdAt).slice(0, 10) : '') + '</span></div><div class="mbn-list-body">' + escHtml(p.content || '') + '</div></div>';
          }).join('');
        })
        .catch(function () { el.innerHTML = '<p class="mbn-sub-note">加载失败，请重试</p>'; });
    } else if (key === 'blocked') {
      fetch('/api/social/blocked', { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var list = (d && d.users) || [];
          if (!list.length) { el.innerHTML = '<p class="mbn-sub-note">暂无屏蔽账号</p>'; return; }
          el.innerHTML = list.map(function (x) {
            return '<div class="mbn-list-item"><div class="mbn-list-head"><span class="mbn-list-author">' + escHtml(x.displayName || '') + '</span><button type="button" class="mbn-unblock" onclick="window._slatiUnblock(\'' + escAttr(x.id) + '\')">解除屏蔽</button></div></div>';
          }).join('');
        })
        .catch(function () { el.innerHTML = '<p class="mbn-sub-note">加载失败，请重试</p>'; });
    }
  }

  window._slatiUnblock = function (id) {
    fetch('/api/social/users/' + encodeURIComponent(id) + '/block', { method: 'DELETE', credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function () { window._slatiOpenSub('blocked'); })
      .catch(function () {});
  };

  window._slatiOpenSub = function (key) {
    window._slatiCloseSub();
    var el = document.createElement('div');
    el.id = 'mbnSubSheet';
    el.className = 'mbn-subsheet open';
    el.innerHTML = subContent(key);
    document.body.appendChild(el);
    el.querySelectorAll('[data-mbn-subtoggle]').forEach(function (row) {
      var id = row.getAttribute('data-mbn-subtoggle');
      var sw = row.querySelector('.mbn-switch');
      row.addEventListener('click', function () {
        var cur = sw.getAttribute('data-on') === '1' ? '0' : '1';
        sw.setAttribute('data-on', cur);
        try { localStorage.setItem('slati_meset_' + id, cur); } catch (e) {}
        if (id === 'reduce_motion') document.documentElement.classList.toggle('reduce-motion', cur === '1');
      });
    });
    if (key === 'liked' || key === 'blocked') loadList(key);
  };

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSidebar);
  } else {
    renderSidebar();
  }

})();
