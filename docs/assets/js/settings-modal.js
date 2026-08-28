/**
 * Settings Modal — main platform
 * Uses existing modal + toggle-switch classes from ethereal.css
 */
(function () {
  'use strict';

  var DEFAULT_SETTINGS = {
    theme: 'light',   // 'light' | 'dark' | 'auto' | 'system'
    fontSize: 'medium',
    emailNotif: true,
    pushNotif: true,
    inAppNotif: true,
    profilePublic: true,
    showActivity: true,
    showNations: true,
    language: 'en',
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
    } catch (e) {}
  }

  var settings = getSettings();

  // ── Apply font size to <html> (runs on load & on change) ──
  function applyFontSize(fs) {
    var size = fs || settings.fontSize;
    document.documentElement.setAttribute('data-font-size', size);
  }
  applyFontSize(); // page-load init

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

  // ── Build modal ──
  function buildModal() {
    var s = settings;
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
          '<img src="' + user.avatarUrl + '" alt="" style="width:64px;height:64px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.08)">' +
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

    // ── Assemble sections ──
    var sections = [profileSection, appearSection, notifSection, privSection, langSection, accountSection];
    var body = el('div', '', null, sections.map(function(sec, i) {
      return el('div', '', { style: { marginBottom: i < sections.length - 1 ? 'var(--space-lg)' : '0', paddingBottom: i < sections.length - 1 ? 'var(--space-md)' : '0', borderBottom: i < sections.length - 1 ? '1px solid rgba(118,117,134,0.1)' : 'none' } }, [sec]);
    }));

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
        window.location.href = '../signin-and-login';
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
          window.location.href = '../signin-and-login';
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
