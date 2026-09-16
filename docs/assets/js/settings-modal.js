/**
 * Settings Modal — main platform
 * Uses existing modal + toggle-switch classes from ethereal.css
 */
(function () {
  'use strict';

  var DEFAULT_SETTINGS = {
    theme: 'light',   // 'light' | 'dark' | 'auto' | 'system'
    fontSize: 'medium',
    accent: 'blue',   // 'blue' 蓝白 | 'mono' 黑白
    emailNotif: true,
    pushNotif: true,
    inAppNotif: true,
    profilePublic: true,
    showActivity: true,
    showNations: true,
    language: 'en',
    fcAutoSave: 10,   // 编辑器自动保存频率（分钟；仅 fluidcanvas-editor 页读；v0.2.40.0）
  };

  function getSettings() {
    try {
      var raw = localStorage.getItem('slati_settings');
      if (raw) {
        var parsed = JSON.parse(raw);
        // Merge with defaults to fill any missing keys
        for (var k in DEFAULT_SETTINGS) {
          if (!(k in parsed)) parsed[k] = DEFAULT_SETTINGS[k];
        }
        return parsed;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  function saveSettings(s) {
    try {
      localStorage.setItem('slati_settings', JSON.stringify(s));
      // v0.2.40.0 — 广播设置变更（编辑器页监听重启自动保存节拍；无监听页面零影响，dispatchEvent 缺监听不抛）
      window.dispatchEvent(new CustomEvent('slati-settings-changed', { detail: s }));
    } catch (e) {}
  }

  var settings = getSettings();

  // ── Apply font size to <html> (runs on load & on change) ──
  function applyFontSize(fs) {
    var size = fs || settings.fontSize;
    document.documentElement.setAttribute('data-font-size', size);
  }
  applyFontSize(); // page-load init

  // ── Apply accent color（主题色：blue 蓝白 / mono 黑白；2026-09-10 用户「主题色分成黑白和现在这个蓝白两种」）──
  // 2026-09-16：mono 规则迁入 ethereal.css 随内联首帧生效、head 内联 theme-init 先落属性（本函数仍负责弹窗实时切换+兜底）
  function applyAccent(accent) {
    var a = accent || settings.accent;
    if (a === 'mono') document.documentElement.setAttribute('data-accent', 'mono');
    else document.documentElement.removeAttribute('data-accent');
  }
  applyAccent(); // page-load init（head 内联 theme-init 已先落同值——此处兜底；弹窗实时切换仍走它）
  ensureStyle(); // 弹窗 UI 样式常驻注入（mono 规则已迁 ethereal.css 首帧生效，此处仅弹窗自身样式）

  // ── Theme resolution & application ──
  var _themeTimer = null;
  var _themeMql = null;

  function resolveTheme(theme) {
    if (theme === 'auto') {
      var h = new Date().getHours();
      return (h >= 20 || h < 5) ? 'dark' : 'light';
    }
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'light';
    }
    return theme; // 'light' or 'dark'
  }

  function updateSidebarIcon() {
    var icon = document.getElementById('collapseIcon');
    if (!icon) return;
    var src = icon.src;
    if (src.indexOf('left_panel_close') !== -1) {
      icon.src = window._slatiSidebarIcon('left_panel_close');
    } else {
      icon.src = window._slatiSidebarIcon('left_panel_open');
    }
  }

  function applyTheme(theme) {
    var t = theme || settings.theme;
    var resolved = resolveTheme(t);
    document.documentElement.setAttribute('data-theme', resolved);
    updateSidebarIcon();

    // Clear old listeners
    if (_themeTimer) { clearInterval(_themeTimer); _themeTimer = null; }
    if (_themeMql) { _themeMql.removeListener(onSystemThemeChange); _themeMql = null; }

    if (t === 'auto') {
      // Check every 60s for day/night boundary
      _themeTimer = setInterval(function () {
        document.documentElement.setAttribute('data-theme', resolveTheme('auto'));
        updateSidebarIcon();
      }, 60000);
    } else if (t === 'system') {
      _themeMql = window.matchMedia('(prefers-color-scheme: dark)');
      if (_themeMql.addEventListener) {
        _themeMql.addEventListener('change', onSystemThemeChange);
      } else {
        _themeMql.addListener(onSystemThemeChange);
      }
    }
  }

  function onSystemThemeChange() {
    document.documentElement.setAttribute('data-theme', resolveTheme('system'));
    updateSidebarIcon();
  }

  applyTheme(); // page-load init

  // ── Helpers ──
  function el(tag, cls, attrs, children) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) {
      for (var k in attrs) {
        if (k === 'style') { for (var sk in attrs.style) e.style[sk] = attrs.style[sk]; }
        else if (k === 'dataset') { for (var dk in attrs.dataset) e.dataset[dk] = attrs.dataset[dk]; }
        else if (k.startsWith('on')) { e[k] = attrs[k]; }
        else { e.setAttribute(k, attrs[k]); }
      }
    }
    if (children) {
      if (typeof children === 'string') e.innerHTML = children;
      else children.forEach(function(c) { e.appendChild(c); });
    }
    return e;
  }

  function icon(name, size) {
    return '<span class="material-symbols-outlined" style="font-size:' + (size || 20) + 'px">' + name + '</span>';
  }

  // ── Toggle switch ──
  function makeToggle(checked, onChange) {
    var sw = el('div', 'toggle-switch' + (checked ? ' active' : ''));
    sw.onclick = function () {
      var isActive = sw.classList.toggle('active');
      if (onChange) onChange(isActive);
    };
    return sw;
  }

  // ── 左侧菜单（2026-09-10 用户「能不能在设置的窗口左侧添加一个菜单」）──
  // 六个区块从一条长滚动页改成「左菜单 + 右内容区」经典设置布局：点菜单项切换右侧区块，
  // 菜单 sticky 随滚动、≤640px 视口退化为顶部横向滚动条（卡片 90vw 放不下 190px 侧栏）。
  var MENU = [
    { id: 'profile',       icon: 'person',          label: 'Profile' },
    { id: 'appearance',    icon: 'palette',         label: 'Appearance' },
    { id: 'notifications', icon: 'notifications',   label: 'Notifications' },
    { id: 'privacy',       icon: 'lock',            label: 'Privacy' },
    { id: 'language',      icon: 'translate',       label: 'Language' },
    { id: 'account',       icon: 'manage_accounts', label: 'Account' },
  ];

  function ensureStyle() {
    if (document.getElementById('slati-settings-menu-style')) return;
    var st = document.createElement('style');
    st.id = 'slati-settings-menu-style';
    st.textContent = [
      // 2026-09-10 用户口径两连：「设置弹窗能不能覆盖整个页面…类似discord的那种大小」→「我要有边缘的」：
      // 近全屏大弹窗带 24px 边缘（背后页面露一圈，backdrop 点击关闭随之复活）+ 圆角/边框恢复；
      // 玻璃模糊+缩放入场保留——依然是弹窗不是跳页；X/ESC 关闭
      '#settingsCard { width: calc(100% - 48px); height: calc(100% - 48px); max-width: none; max-height: none; border-radius: var(--radius-lg); }',
      '#settingsCard .modal-card-body { max-height: calc(100vh - 48px - 2 * var(--space-lg)); }',
      '@media (max-width: 640px) { #settingsCard { width: calc(100% - 16px); height: calc(100% - 16px); } }',
      // ── 2026-09-16 切页闪修复（用户「黑白主题在切换页面时会先显示默认主题的颜色再转变成黑白主题的颜色」）：
      // mono 主题色规则整体迁入 ethereal.css（随内联 CSS 首帧生效），data-accent 由 head 内联 theme-init 同步落——
      // 本注入样式只剩弹窗 UI 规则；弹窗实时切换主题色仍走 applyAccent 开关 html 属性，mono 族即时响应 ──
      // ── 主题色选择按钮：上下两部分——上半部配色 swatch、下半部名称 ──
      '.accent-subnav { display: flex; gap: 8px; }',
      '.accent-chip { width: 88px; padding: 0; border: 1px solid var(--color-outline-variant); border-radius: var(--radius-md); background: var(--color-surface-container-low, transparent); overflow: hidden; cursor: pointer; display: flex; flex-direction: column; font-family: var(--font-family); transition: border-color 0.15s ease, box-shadow 0.15s ease; }',
      '.accent-chip .accent-swatch { height: 28px; display: block; }',
      '.accent-chip .accent-name { padding: 6px 0 7px; font-size: 12px; font-weight: 600; color: var(--color-on-surface-variant); }',
      '.accent-chip.active { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-fixed); }',
      '.accent-chip.active .accent-name { color: var(--color-on-surface); }',
      '.settings-layout { display: flex; gap: var(--space-lg); align-items: flex-start; }',
      '.settings-menu { width: 190px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px; padding-right: var(--space-md); border-right: 1px solid rgba(118,117,134,0.12); position: sticky; top: 0; }',
      '.settings-menu-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 12px; border: none; border-radius: var(--radius-md); background: transparent; color: var(--color-on-surface-variant); font-family: var(--font-family); font-size: var(--fs-label-md); font-weight: 500; cursor: pointer; text-align: left; transition: background-color 0.15s ease, color 0.15s ease; }',
      '.settings-menu-item:hover { background: rgba(118,117,134,0.08); color: var(--color-on-surface); }',
      '.settings-menu-item.active { background: rgba(70,72,212,0.08); color: var(--color-primary); font-weight: 600; }',
      '.settings-pane { flex: 1; min-width: 0; }',
      '.settings-sec-hidden { display: none; }',
      '@media (max-width: 640px) { .settings-layout { flex-direction: column; } .settings-menu { width: 100%; flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid rgba(118,117,134,0.12); padding-right: 0; padding-bottom: var(--space-sm); position: static; } .settings-menu-item { width: auto; flex-shrink: 0; } }',
    ].join('\n');
    document.head.appendChild(st);
  }

  // ── Build modal ──
  function buildModal() {
    ensureStyle();
    var s = settings;
    // v0.2.40.0 — 编辑器区仅编辑器页出现（该页打开弹窗默认落此区）
    var isEditor = (location.pathname || '').indexOf('fluidcanvas-editor') !== -1;
    var user = (window.SlatiDB && SlatiDB.getUser()) || {
      displayName: 'Alex Rivera',
      citizenId: 'CIT-8842',
      avatarUrl: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=4648d4&color=fff&size=80',
      bio: '',
    };

    // ── Section: Profile ──
    var profileSection = el('div', '', null, [
      el('h3', 'label-lg', { style: { marginBottom: '12px', color: 'var(--color-on-surface)' } }, 'Profile'),
      el('div', '', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' } }, [
        el('div', '', { style: { position: 'relative', flexShrink: '0' } },
          '<img src="' + (user.avatarUrl || window._slatiFallbackAvatar) + '" alt="" style="width:64px;height:64px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.08)">' +
          '<button class="btn btn-ghost btn-icon btn-sm" style="position:absolute;bottom:-4px;right:-4px;width:28px;height:28px;border-radius:50%;background:var(--color-primary);color:white" title="Change avatar">' +
            '<span class="material-symbols-outlined" style="font-size:14px">photo_camera</span>' +
          '</button>'
        ),
        el('div', '', { style: { flex: '1', minWidth: '0' } }, [
          el('label', 'form-label', {}, 'Display Name'),
          el('input', 'input-glass', { type: 'text', id: 'setDisplayName', value: user.displayName, style: { marginBottom: '8px' } }),
        ]),
      ]),
      el('div', 'form-group', {}, [
        el('label', 'form-label', {}, 'Bio'),
        el('textarea', 'input-glass', { id: 'setBio', rows: '2', placeholder: 'A short bio about yourself…' }, user.bio || ''),
      ]),
      el('div', 'form-group', {}, [
        el('label', 'form-label', {}, 'Citizen ID'),
        el('input', 'input-glass', { type: 'text', value: user.citizenId, readonly: '', style: { opacity: '0.6', cursor: 'not-allowed' } }),
      ]),
      // 2026-09-03 用户「在后端做一下用户性别的记录，然后在用户资料里也单独显示」：Profile 区单独一行展示
      //（注册第二页下拉填写的值，镜像到后端 /me 后权威回读；未填写显示 —）
      el('div', 'form-group', {}, [
        el('label', 'form-label', {}, 'Gender'),
        el('input', 'input-glass', { type: 'text', value: user.gender || '—', readonly: '', style: { opacity: '0.6', cursor: 'not-allowed' } }),
      ]),
    ]);

    // ── Section: Appearance ──
    var themes = [
      { id: 'light',  icon: 'light_mode',      label: 'Light',   desc: 'Always light' },
      { id: 'dark',   icon: 'dark_mode',       label: 'Dark',    desc: 'Always dark' },
      { id: 'auto',   icon: 'schedule',        label: 'Auto',    desc: 'Dark 8 PM – 5 AM, light otherwise' },
      { id: 'system', icon: 'settings_suggest', label: 'System',  desc: 'Follow your device setting' },
    ];
    var themeHTML = themes.map(function(th) {
      var extra = th.id === 'system' ? ';color:#06b6d4' : '';
      return '<button class="subnav-pill' + (s.theme === th.id ? ' active' : '') + '" data-theme="' + th.id + '" style="display:flex;align-items:center;gap:6px">' +
        '<span class="material-symbols-outlined" style="font-size:18px' + extra + '">' + th.icon + '</span>' + th.label + '</button>';
    }).join('');

    var fontSizeOpts = ['small', 'medium', 'large'];
    var fontSizeHTML = fontSizeOpts.map(function(fs) {
      return '<button class="subnav-pill' + (s.fontSize === fs ? ' active' : '') + '" data-fs="' + fs + '">' + fs.charAt(0).toUpperCase() + fs.slice(1) + '</button>';
    }).join('');

    // 主题色（用户「主题色分成黑白和现在这个蓝白两种」+「按钮分成上下两个部分 上半部显示主题配色 下半部就是名称」）：
    // swatch 上半部直接是配色本身——蓝白=纯蓝块、黑白=左黑右白对半分
    var accentOpts = [
      { id: 'blue', label: 'Blue', sw: '#4648d4' },
      { id: 'mono', label: 'Mono', sw: 'linear-gradient(90deg, #1c1c22 0 50%, #f2f2f5 50% 100%)' },
    ];
    var accentHTML = accentOpts.map(function (a) {
      return '<button type="button" class="accent-chip' + (s.accent === a.id ? ' active' : '') + '" data-accent="' + a.id + '">' +
        '<span class="accent-swatch" style="background:' + a.sw + '"></span>' +
        '<span class="accent-name">' + a.label + '</span></button>';
    }).join('');

    var appearSection = el('div', '', null, [
      el('h3', 'label-lg', { style: { marginBottom: '12px', color: 'var(--color-on-surface)' } }, 'Appearance'),
      el('div', '', { style: { paddingBottom: '12px', borderBottom: '1px solid rgba(118,117,134,0.08)' } }, [
        el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block', marginBottom: '8px' } }, 'Theme'),
        el('div', 'subnav', { id: 'themeSubnav', style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } }, themeHTML),
      ]),
      el('div', '', { style: { padding: '12px 0' } }, [
        el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block', marginBottom: '8px' } }, 'Font Size'),
        el('div', 'subnav', { id: 'fontSizeSubnav', style: { display: 'inline-flex' } }, fontSizeHTML),
      ]),
      el('div', '', { style: { paddingTop: '12px' } }, [
        el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block', marginBottom: '8px' } }, 'Accent Color'),
        el('div', 'accent-subnav', { id: 'accentSubnav', style: { display: 'flex', gap: '8px' } }, accentHTML),
      ]),
    ]);

    // ── Section: Notifications ──
    function notifRow(label, desc, key) {
      var tog = makeToggle(s[key], function (on) {
        settings[key] = on;
        saveSettings(settings);
      });
      return el('div', '', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(118,117,134,0.08)' } }, [
        el('div', '', null, [el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block' } }, label), el('span', 'label-sm', { style: { color: 'var(--color-outline)' } }, desc)]),
        tog,
      ]);
    }

    var notifSection = el('div', '', null, [
      el('h3', 'label-lg', { style: { marginBottom: '12px', color: 'var(--color-on-surface)' } }, 'Notifications'),
      notifRow('Email Notifications', 'Receive updates via email', 'emailNotif'),
      notifRow('Push Notifications', 'Browser push notifications', 'pushNotif'),
      notifRow('In-App Notifications', 'Alerts within the platform', 'inAppNotif'),
    ]);

    // ── Section: Privacy ──
    function privRow(label, desc, key) {
      var tog = makeToggle(s[key], function (on) {
        settings[key] = on;
        saveSettings(settings);
      });
      return el('div', '', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(118,117,134,0.08)' } }, [
        el('div', '', null, [el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block' } }, label), el('span', 'label-sm', { style: { color: 'var(--color-outline)' } }, desc)]),
        tog,
      ]);
    }

    var privSection = el('div', '', null, [
      el('h3', 'label-lg', { style: { marginBottom: '12px', color: 'var(--color-on-surface)' } }, 'Privacy'),
      privRow('Public Profile', 'Allow others to view your profile', 'profilePublic'),
      privRow('Activity Status', 'Show when you are online', 'showActivity'),
      privRow('Nation Affiliations', 'Display nations you belong to', 'showNations'),
    ]);

    // ── Section: Language ──
    var langs = [
      { code: 'en', label: 'English' },
      { code: 'zh', label: '中文' },
      { code: 'es', label: 'Español' },
      { code: 'fr', label: 'Français' },
    ];
    var langHTML = langs.map(function(l) {
      return '<button class="subnav-pill' + (s.language === l.code ? ' active' : '') + '" data-lang="' + l.code + '">' + l.label + '</button>';
    }).join('');

    var langSection = el('div', '', null, [
      el('h3', 'label-lg', { style: { marginBottom: '12px', color: 'var(--color-on-surface)' } }, 'Language'),
      el('div', 'subnav', { id: 'langSubnav', style: { display: 'inline-flex', flexWrap: 'wrap' } }, langHTML),
    ]);

    // ── Section: Account / Danger Zone ──
    var accountSection = el('div', '', null, [
      el('h3', 'label-lg', { style: { marginBottom: '12px', color: 'var(--color-on-surface)' } }, 'Account'),
      el('div', '', { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' } }, [
        el('button', 'btn btn-outline', { id: 'setLogoutBtn', style: { color: '#dc2626', borderColor: 'rgba(220,38,38,0.2)' } },
          icon('logout', 18) + ' Logout'),
        el('button', 'btn btn-ghost', { id: 'setDeleteBtn', style: { color: '#dc2626' } },
          icon('delete_forever', 18) + ' Delete Account'),
      ]),
      el('div', '', { style: { marginTop: 'var(--space-md)', fontSize: '12px', display: 'flex', gap: '14px' } }, [
        el('a', '', { href: '../pages/terms.html', target: '_blank', style: { color: 'var(--color-on-surface-variant)', textDecoration: 'underline' } }, '服务条款'),
        el('a', '', { href: '../pages/financial-terms.html', target: '_blank', style: { color: 'var(--color-on-surface-variant)', textDecoration: 'underline' } }, '财务与支付'),
        el('a', '', { href: '../pages/platform-responsibility.html', target: '_blank', style: { color: 'var(--color-on-surface-variant)', textDecoration: 'underline' } }, '平台责任'),
        el('a', '', { href: '../pages/community-rules.html', target: '_blank', style: { color: 'var(--color-on-surface-variant)', textDecoration: 'underline' } }, '社区规则'),
        el('a', '', { href: '../pages/privacy.html', target: '_blank', style: { color: 'var(--color-on-surface-variant)', textDecoration: 'underline' } }, '隐私政策'),
      ]),
    ]);

    // ── Section: Editor（v0.2.40.0 仅编辑器页；自动保存频率 5/10/15/30/60 分钟）──
    var editorSection = null;
    if (isEditor) {
      var fcOpts = [5, 10, 15, 30, 60];
      var fcHTML = fcOpts.map(function (m) {
        return '<button type="button" class="subnav-pill' + (Number(s.fcAutoSave) === m ? ' active' : '') + '" data-min="' + m + '">' + m + ' 分钟</button>';
      }).join('');
      editorSection = el('div', '', null, [
        el('h3', 'label-lg', { style: { marginBottom: '12px', color: 'var(--color-on-surface)' } }, '编辑器'),
        el('div', 'form-group', {}, [
          el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block', marginBottom: '8px' } }, '自动保存频率'),
          el('div', 'subnav', { id: 'fcAutoSubnav', style: { display: 'inline-flex', flexWrap: 'wrap' } }, fcHTML),
          el('span', 'label-sm', { style: { display: 'block', marginTop: '8px', color: 'var(--color-outline)' } }, '平台每 N 分钟自动保存一次草稿。默认 10 分钟，最快 5 分钟；Ctrl+S 或「Save Draft」可立即保存。'),
        ]),
      ]);
    }

    // ── Assemble：左菜单 + 右内容区（2026-09-10 用户左侧菜单口径）──
    var secList = [
      { id: 'profile', el: profileSection },
      { id: 'appearance', el: appearSection },
      { id: 'notifications', el: notifSection },
      { id: 'privacy', el: privSection },
      { id: 'language', el: langSection },
      { id: 'account', el: accountSection },
    ];
    // v0.2.40.0 — 编辑器区仅编辑器页出现（该页打开弹窗默认落此区）；MENU 母数组不动，局部 slice 拼装
    var defSec = 'profile';
    var menuItems = MENU.slice();
    if (isEditor && editorSection) {
      defSec = 'editor';
      secList.unshift({ id: 'editor', el: editorSection });
      menuItems.unshift({ id: 'editor', icon: 'edit_note', label: '编辑器' });
    }
    var menu = el('div', 'settings-menu', { id: 'settingsMenu' }, menuItems.map(function (m) {
      return el('button', 'settings-menu-item' + (m.id === defSec ? ' active' : ''), { type: 'button', dataset: { sec: m.id } },
        icon(m.icon, 18) + '<span>' + m.label + '</span>');
    }));
    var pane = el('div', 'settings-pane', null, secList.map(function (s) {
      return el('div', 'settings-sec' + (s.id === defSec ? '' : ' settings-sec-hidden'), { dataset: { sec: s.id } }, [s.el]);
    }));
    var body = el('div', 'settings-layout', null, [menu, pane]);

    // ── Header ──
    var header = el('div', '', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' } }, [
      el('div', '', null, [
        el('h2', 'headline-md', { style: { margin: '0' } }, icon('settings', 24) + ' Settings'),
      ]),
      el('button', 'btn btn-ghost btn-icon btn-sm', { id: 'settingsCloseBtn', title: 'Close' },
        '<span class="material-symbols-outlined" style="font-size:20px">close</span>'),
    ]);

    // ── Backdrop + Card (outer clips corners, inner scrolls) ──
    var backdrop = el('div', 'modal-backdrop', { id: 'settingsBackdrop' });
    var container = el('div', 'modal-container', { id: 'settingsContainer' });
    var card = el('div', 'modal-card', { id: 'settingsCard' });
    var cardBody = el('div', 'modal-card-body', {});
    cardBody.appendChild(header);
    cardBody.appendChild(body);
    card.appendChild(cardBody);
    container.appendChild(card);

    // 液态玻璃 v0.2.9.0：弹窗是 open() 时动态 build，初始 scan 扫不到 → 建完即挂静态面
    if (window.LG) LG.apply(card, { mode: 'static' });

    return { backdrop: backdrop, container: container };
  }

  // ── Open / Close ──
  var modalEls = null;

  function open() {
    if (modalEls) close(true);

    // Re-read settings & user each time modal opens
    settings = getSettings();
    modalEls = buildModal();
    document.body.appendChild(modalEls.backdrop);
    document.body.appendChild(modalEls.container);

    // Animate in
    requestAnimationFrame(function () {
      modalEls.backdrop.classList.add('active');
      modalEls.container.querySelector('.modal-card').classList.add('active');
    });

    // ── Wire events ──

    // Close buttons
    function doClose() { close(false); }
    modalEls.backdrop.addEventListener('click', doClose);
    var closeBtn = document.getElementById('settingsCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', doClose);

    // ESC key
    var escHandler = function (e) { if (e.key === 'Escape') doClose(); };
    document.addEventListener('keydown', escHandler);
    modalEls._escHandler = escHandler;

    // Theme pills
    var themeSubnav = document.getElementById('themeSubnav');
    if (themeSubnav) {
      themeSubnav.addEventListener('click', function (e) {
        var btn = e.target.closest('.subnav-pill');
        if (!btn) return;
        themeSubnav.querySelectorAll('.subnav-pill').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        settings.theme = btn.dataset.theme;
        applyTheme(btn.dataset.theme);
        saveSettings(settings);
      });
    }

    // Font size pills
    var fsSubnav = document.getElementById('fontSizeSubnav');
    if (fsSubnav) {
      fsSubnav.addEventListener('click', function (e) {
        var btn = e.target.closest('.subnav-pill');
        if (!btn) return;
        fsSubnav.querySelectorAll('.subnav-pill').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        settings.fontSize = btn.dataset.fs;
        applyFontSize(btn.dataset.fs);
        saveSettings(settings);
      });
    }

    // Accent color chips（主题色：蓝白 Blue / 黑白 Mono）
    var accentSubnav = document.getElementById('accentSubnav');
    if (accentSubnav) {
      accentSubnav.addEventListener('click', function (e) {
        var btn = e.target.closest('.accent-chip');
        if (!btn) return;
        accentSubnav.querySelectorAll('.accent-chip').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        settings.accent = btn.dataset.accent;
        applyAccent(btn.dataset.accent);
        saveSettings(settings);
      });
    }

    // Language pills
    var langSubnav = document.getElementById('langSubnav');
    if (langSubnav) {
      langSubnav.addEventListener('click', function (e) {
        var btn = e.target.closest('.subnav-pill');
        if (!btn) return;
        langSubnav.querySelectorAll('.subnav-pill').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        settings.language = btn.dataset.lang;
        saveSettings(settings);
        // Apply to pages using the i18n module (no-op where it isn't loaded)
        if (window.MN_I18N) window.MN_I18N.setLang(btn.dataset.lang);
      });
    }

    // Editor autosave interval pills（v0.2.40.0 仅编辑器页构建）
    var fcSubnav = document.getElementById('fcAutoSubnav');
    if (fcSubnav) {
      fcSubnav.addEventListener('click', function (e) {
        var btn = e.target.closest('.subnav-pill');
        if (!btn) return;
        fcSubnav.querySelectorAll('.subnav-pill').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        settings.fcAutoSave = Number(btn.dataset.min);
        saveSettings(settings); // → slati-settings-changed → 编辑器心跳按新频率重排
      });
    }

    // Left menu switching（2026-09-10 左侧菜单口径：点菜单项换右侧区块，active 高亮同步）
    var menuEl = document.getElementById('settingsMenu');
    if (menuEl) {
      menuEl.addEventListener('click', function (e) {
        var btn = e.target.closest('.settings-menu-item');
        if (!btn) return;
        var cardEl = modalEls.container.querySelector('#settingsCard');
        cardEl.querySelectorAll('.settings-menu-item').forEach(function (b) {
          b.classList.toggle('active', b.dataset.sec === btn.dataset.sec);
        });
        cardEl.querySelectorAll('.settings-sec').forEach(function (s) {
          s.classList.toggle('settings-sec-hidden', s.dataset.sec !== btn.dataset.sec);
        });
      });
    }

    // Save display name on change
    var nameInput = document.getElementById('setDisplayName');
    if (nameInput) {
      nameInput.addEventListener('change', function () {
        var u = (window.SlatiDB && SlatiDB.getUser()) || {};
        u.displayName = this.value;
        if (window.SlatiDB) SlatiDB.saveUser(u);
      });
    }

    // Save bio on change
    var bioInput = document.getElementById('setBio');
    if (bioInput) {
      bioInput.addEventListener('change', function () {
        var u = (window.SlatiDB && SlatiDB.getUser()) || {};
        u.bio = this.value;
        if (window.SlatiDB) SlatiDB.saveUser(u);
      });
    }

    // Logout
    var logoutBtn = document.getElementById('setLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        if (window.SlatiDB) SlatiDB.logout();
        window.location.href = '../signup-and-login';
      });
    }

    // Delete account
    var deleteBtn = document.getElementById('setDeleteBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
          if (window.SlatiDB) {
            SlatiDB.remove('slati_user');
            SlatiDB.remove('slati_session');
          }
          window.location.href = '../signup-and-login';
        }
      });
    }
  }

  function close(instant) {
    if (!modalEls) return;
    var card = modalEls.container.querySelector('.modal-card');
    if (card) card.classList.remove('active');
    modalEls.backdrop.classList.remove('active');

    if (instant) {
      removeEls();
    } else {
      setTimeout(removeEls, 250);
    }

    function removeEls() {
      if (modalEls._escHandler) document.removeEventListener('keydown', modalEls._escHandler);
      if (modalEls.backdrop.parentNode) modalEls.backdrop.parentNode.removeChild(modalEls.backdrop);
      if (modalEls.container.parentNode) modalEls.container.parentNode.removeChild(modalEls.container);
      modalEls = null;
    }
  }

  // ── Expose globally ──
  window.SlatiSettings = {
    open: open,
    close: close,
    getSettings: getSettings,
  };

  // ── Auto-wire sidebar settings buttons ──
  function wireSidebarBtns() {
    var wired = false;
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;

      // 1) Expanded sidebar — gear icon in user banner
      var bannerBtn = document.querySelector('#slati-sidebar .user-banner .btn-ghost.btn-icon');
      if (bannerBtn && !bannerBtn._settingsWired) {
        bannerBtn._settingsWired = true;
        bannerBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          open();
        });
        wired = true;
      }

      // 2) Collapsed sidebar — settings button below avatar
      var collapsedBtn = document.querySelector('#slati-sidebar .settings-btn-collapsed');
      if (collapsedBtn && !collapsedBtn._settingsWired) {
        collapsedBtn._settingsWired = true;
        collapsedBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          open();
        });
        wired = true;
      }

      if ((wired && attempts >= 5) || attempts >= 20) clearInterval(timer);
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireSidebarBtns);
  } else {
    wireSidebarBtns();
  }
})();
