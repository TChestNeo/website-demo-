/**
 * Settings Modal — main platform
 * Uses existing modal + toggle-switch classes from ethereal.css
 */
(function () {
  'use strict';

  // v0.2.54.0 i18n：惰性 T(key)——本脚本可能先于 i18n.js（body 尾部）执行。
  // 弹窗静态文案挂 data-i18n 由 MN_I18N.apply() 翻译；此处 T 供 JS 运行时文案（confirm 等）使用。
  // fallback 文本保持英文（FC 页无字典=现状逐字节）；'编辑器'区 fallback 保持中文（autosave 电池断言）。
  function T(k) { return (window.MN_I18N && window.MN_I18N.t(k)) || null; }

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
    developerMode: false,  // 开发者模式：设置里开，打开后展示版本/账号/API 等调试信息（v0.2.59.9）
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
      else children.forEach(function(c) {
        // v0.2.54.0 修复：icon() 返回 HTML 字符串，数组混字符串成员时走 insertAdjacentHTML（appendChild 对字符串抛 TypeError）
        if (typeof c === 'string') e.insertAdjacentHTML('beforeend', c);
        else e.appendChild(c);
      });
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
    { id: 'activity',      icon: 'analytics',       label: '活动' },
    { id: 'account',       icon: 'manage_accounts', label: '账户' },
    { id: 'visibility',    icon: 'visibility',      label: '可见性' },
    { id: 'interactions',  icon: 'forum',           label: '互动' },
    { id: 'preferences',   icon: 'tune',            label: '偏好设置' },
    { id: 'developer',     icon: 'code',            label: '开发者' },
  ];

  function ensureStyle() {
    if (document.getElementById('slati-settings-menu-style')) return;
    var st = document.createElement('style');
    st.id = 'slati-settings-menu-style';
    st.textContent = [
      // 2026-09-10 用户口径两连：「设置弹窗能不能覆盖整个页面…类似discord的那种大小」→「我要有边缘的」：
      // 近全屏大弹窗带 24px 边缘（背后页面露一圈，backdrop 点击关闭随之复活）+ 圆角/边框恢复；
      // 玻璃模糊+缩放入场保留——依然是弹窗不是跳页；X/ESC 关闭
      '#settingsCard { position: relative; width: calc(100% - 48px); height: calc(100% - 48px); max-width: none; max-height: none; border-radius: var(--radius-lg); }',
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
      // ── v0.2.58.21 资料区头像/横幅自定义控件 ──
      // v0.2.58.22 横幅预览吃 --lg-bg（cardBg 预设色即时生效；无预设回落品牌渐变）
      // v0.2.58.25 横幅增高 1.5 倍 96→144px + 预览改内嵌 <img> 走裁切渲染（position/overflow 供绝对定位 img）
      '.settings-banner-preview { position: relative; overflow: hidden; height: 144px; border-radius: var(--radius-md); background: var(--lg-bg, linear-gradient(135deg,#4648d4,#3b3dc4)); background-size: cover; background-position: center; margin-bottom: 4px; }',
      '.settings-banner-preview .settings-banner-img { position: absolute; display: block; }',
      // v0.2.58.25 视频横幅：预览 <video> 与 img 同几何（applyCrop 数学复用）
      '.settings-banner-preview .settings-banner-video { position: absolute; display: block; }',
      // v0.2.58.25 头像预览外包盒（64px 圆 overflow:hidden）——img 绝对定位由 applyCrop 写几何
      '.settings-avatar-preview { position: relative; overflow: hidden; }',
      '.settings-avatar-preview img { position: absolute; display: block; }',
      // v0.2.58.22 预设色卡 13 类（6 玻璃+3 单色+3 黑白渐变+默认；--lg-bg 玻璃值自资料页逐字节照抄丢 --lg-tint；
      // #settingsCard 前缀防 40+ 页类名碰撞）+ 网格（7 列）
      '#settingsCard .bg-default { --lg-bg: linear-gradient(135deg, rgba(70,72,212,0.9), rgba(124,92,224,0.55) 45%, rgba(70,72,212,0.92)), radial-gradient(circle at 22% 28%, rgba(255,255,255,0.2), transparent 46%), radial-gradient(circle at 80% 72%, rgba(255,255,255,0.12), transparent 40%), #e6e8ea; }',
      '#settingsCard .glass-frost { --lg-bg: linear-gradient(135deg, rgba(255,255,255,0.38), rgba(255,255,255,0.10) 45%, rgba(255,255,255,0.30)), linear-gradient(135deg, rgba(96,100,230,0.50), rgba(150,120,245,0.35) 50%, rgba(96,100,230,0.50)), radial-gradient(circle at 22% 28%, rgba(255,255,255,0.20), transparent 46%), radial-gradient(circle at 80% 72%, rgba(255,255,255,0.12), transparent 40%), #e6e8ea; }',
      '#settingsCard .glass-ocean { --lg-bg: linear-gradient(135deg, rgba(255,255,255,0.30), rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.22)), linear-gradient(135deg, rgba(30,90,200,0.55), rgba(40,140,190,0.40) 50%, rgba(30,90,200,0.55)), radial-gradient(circle at 22% 28%, rgba(255,255,255,0.20), transparent 46%), radial-gradient(circle at 80% 72%, rgba(255,255,255,0.12), transparent 40%), #e6e8ea; }',
      '#settingsCard .glass-violet { --lg-bg: linear-gradient(135deg, rgba(255,255,255,0.30), rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.22)), linear-gradient(135deg, rgba(124,92,224,0.55), rgba(190,120,240,0.40) 50%, rgba(124,92,224,0.55)), radial-gradient(circle at 22% 28%, rgba(255,255,255,0.20), transparent 46%), radial-gradient(circle at 80% 72%, rgba(255,255,255,0.12), transparent 40%), #e6e8ea; }',
      '#settingsCard .glass-rose { --lg-bg: linear-gradient(135deg, rgba(255,255,255,0.30), rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.22)), linear-gradient(135deg, rgba(232,110,160,0.55), rgba(240,150,190,0.40) 50%, rgba(232,110,160,0.55)), radial-gradient(circle at 22% 28%, rgba(255,255,255,0.20), transparent 46%), radial-gradient(circle at 80% 72%, rgba(255,255,255,0.12), transparent 40%), #e6e8ea; }',
      '#settingsCard .glass-mint { --lg-bg: linear-gradient(135deg, rgba(255,255,255,0.30), rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.22)), linear-gradient(135deg, rgba(40,180,150,0.55), rgba(90,200,170,0.40) 50%, rgba(40,180,150,0.55)), radial-gradient(circle at 22% 28%, rgba(255,255,255,0.20), transparent 46%), radial-gradient(circle at 80% 72%, rgba(255,255,255,0.12), transparent 40%), #e6e8ea; }',
      '#settingsCard .glass-sunset { --lg-bg: linear-gradient(135deg, rgba(255,255,255,0.30), rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.22)), linear-gradient(135deg, rgba(240,130,60,0.55), rgba(240,80,120,0.40) 50%, rgba(240,130,60,0.55)), radial-gradient(circle at 22% 28%, rgba(255,255,255,0.20), transparent 46%), radial-gradient(circle at 80% 72%, rgba(255,255,255,0.12), transparent 40%), #e6e8ea; }',
      '#settingsCard .glass-clear { --lg-bg: linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.10)), radial-gradient(circle at 22% 28%, rgba(255,255,255,0.10), transparent 46%), radial-gradient(circle at 80% 72%, rgba(255,255,255,0.06), transparent 40%); }',
      '#settingsCard .solid-black { --lg-bg: #1b1b20; }',
      '#settingsCard .solid-white { --lg-bg: #f4f4f6; }',
      '#settingsCard .solid-gray { --lg-bg: #75787f; }',
      '#settingsCard .mono-bw { --lg-bg: linear-gradient(135deg, #18181b, #f5f5f7); }',
      '#settingsCard .mono-silver { --lg-bg: linear-gradient(135deg, #9ca3af, #e5e7eb); }',
      '#settingsCard .mono-charcoal { --lg-bg: linear-gradient(135deg, #27272a, #71717a); }',
      '.settings-bg-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin: 8px 0; }',
      '.settings-bg-swatch { aspect-ratio: 16/9; border-radius: var(--radius-sm); border: 2px solid transparent; background: var(--lg-bg, #e6e8ea); cursor: pointer; padding: 0; }',
      '.settings-bg-swatch:hover { border-color: var(--color-outline); }',
      '.settings-bg-swatch.active { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-fixed); }',
      // v0.2.58.22 金色罩子：免费层被锁按钮主动盖罩；相邻共罩（span 包 upload+lib）；伪元素 pointer-events:none 点击穿透保 toast 反馈
      '.gold-lock-group { position: relative; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--radius-md, 8px); }',
      '.gold-lock-group::after { content: \'\'; position: absolute; inset: -1px; border-radius: inherit; border: 1px solid rgba(212,175,55,0.85); background: linear-gradient(135deg, rgba(255,215,0,0.32), rgba(212,175,55,0.22) 45%, rgba(255,225,120,0.36)); box-shadow: 0 0 8px rgba(255,200,60,0.35), inset 0 0 4px rgba(255,255,255,0.3); pointer-events: none; animation: goldShimmer 2.4s ease-in-out infinite; }',
      '.gold-lock-group::before { content: \'lock\'; font-family: \'Material Symbols Outlined\'; font-size: 14px; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #8a6d1a; z-index: 1; pointer-events: none; }',
      '.gold-locked { position: relative; }',
      '.gold-locked::after { content: \'\'; position: absolute; inset: -2px; border-radius: 50%; border: 1px solid rgba(212,175,55,0.85); background: linear-gradient(135deg, rgba(255,215,0,0.3), rgba(212,175,55,0.2)); box-shadow: 0 0 6px rgba(255,200,60,0.35); pointer-events: none; animation: goldShimmer 2.4s ease-in-out infinite; }',
      '@keyframes goldShimmer { 0%, 100% { opacity: 0.85; } 50% { opacity: 0.5; } }',
      '.sub-locked { opacity: 0.55; cursor: not-allowed; }',
      '.settings-lib-pop { position: absolute; right: var(--space-lg); top: 60px; width: 400px; max-width: calc(100% - 32px); max-height: 400px; overflow-y: auto; background: var(--color-surface, #fff); border: 1px solid var(--color-outline-variant, rgba(118,117,134,0.25)); border-radius: var(--radius-md); box-shadow: 0 12px 32px rgba(0,0,0,0.2); padding: 10px; z-index: 60; }',
      '.settings-lib-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }',
      '.settings-lib-cell { aspect-ratio: 1; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid transparent; }',
      '.settings-lib-cell:hover { border-color: var(--color-primary); }',
      '.settings-lib-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }',
      '.settings-profile-toast { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%) translateY(8px); padding: 10px 18px; border-radius: 999px; color: #fff; font-size: 13px; font-weight: 600; opacity: 0; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease; z-index: 70; }',
      '.settings-profile-toast.active { opacity: 1; transform: translateX(-50%) translateY(0); }',
    ].join('\n');
    document.head.appendChild(st);
  }

  // ── v0.2.58.25 裁切弹窗组件（window.MN_CropDialog）──
  // 用户「横幅和头像在上传后能不能先弹出一个选择裁切范围的弹窗调整裁切范围」：
  // 裁切=显示范围裁切——绝不 canvas 重编码，原文件原样上传（GIF 保持动画）；弹窗只产归一化矩形
  // {x,y,w,h}（0..1，x+w≤1、y+h≤1）交给调用方随上传/PATCH 落库。
  // 渲染数学=中心锚定 cover 的严格推广（w=h=1、x=y=0 时与 background-size:cover+center 逐像素等价=爷爷辈零回归）：
  //   s = max(W/(w·Nw), H/(h·Nh))；img 宽 Nw·s 高 Nh·s；left = W/2−(x+w/2)·Nw·s；top = H/2−(y+h/2)·Nh·s
  // 固定比例框（钦定②「固定比例框+图片缩放」）：头像 1:1、横幅 3:1——kind 驱动，无 frameRatio 参数。
  // 交互：pointer 拖拽平移（rect 恒居 stage 中心）、滚轮缩放 ×1.15/档钳 [sFull, 3·sFull]、双指捏合 best-effort、
  // rAF 节流；Esc keydown 捕获相+stopPropagation（防连锁关下层设置/编辑弹窗——它们的 Esc 都是冒泡相）；
  // 遮罩点击/X/取消钮=取消；Blob 入参 objectURL 四出口统一 revoke、URL 字符串零处理；img onerror→toast+关闭。
  // v0.2.58.25 视频横幅：src 为视频（blob.type video/ 前缀或 URL 尾 .mp4/.webm/.mov）→ stage 用
  // <video autoplay muted loop playsinline>，loadedmetadata 后同几何（拖拽/缩放/钳制/confirm 数学零改动）。
  // 缩放语义=视窗模型（Discord 换头像式）：rect 恒等于 stage 视窗内可见的归一化区域——滚轮/捏合改变 s 后
  // 围绕旧 rect 中心重算视窗（w=W/(Nw·s)、h=H/(Nh·s) 钳 ≤1 贴边）；sFull=整图 cover 适配的最小缩放下限
  // （重裁时可缩回到整图；s0=initial rect 适配=打开即恰好显示存量 rect）；不拖不滚 confirm → rect 恒原值
  // （新上传恒 {0,0,1,1} 且恒写入 PATCH 体=电池断言确定性来源）；确认时四值 round(v*10000)/10000。
  // 确认不交互 → rect 恒 {0,0,1,1} 且恒写入 PATCH 体（电池断言确定性来源）；确认时四值 round(v*10000)/10000。
  var cropState = null;

  function ensureCropStyle() {
    if (document.getElementById('slati-crop-dialog-style')) return;
    var st = document.createElement('style');
    st.id = 'slati-crop-dialog-style';
    st.textContent = [
      '.mn-crop-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9999; display: flex; align-items: center; justify-content: center; }',
      '.mn-crop-card { background: var(--color-surface, #fff); border-radius: var(--radius-lg, 16px); box-shadow: 0 16px 48px rgba(0,0,0,0.35); padding: 16px 20px 18px; max-width: calc(100vw - 32px); }',
      '.mn-crop-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }',
      '.mn-crop-title { font-size: 15px; font-weight: 600; color: var(--color-on-surface, #1c1c22); }',
      '.mn-crop-x { border: none; background: transparent; cursor: pointer; color: var(--color-on-surface-variant, #75787f); padding: 2px; display: flex; }',
      '.mn-crop-stage { position: relative; overflow: hidden; margin: 0 auto; background: #0e0e13; cursor: grab; touch-action: none; }',
      '.mn-crop-stage.dragging { cursor: grabbing; }',
      '.mn-crop-stage img, .mn-crop-stage video { position: absolute; display: block; user-select: none; -webkit-user-drag: none; }',
      '.mn-crop-hint { margin-top: 8px; font-size: 12px; color: var(--color-on-surface-variant, #75787f); text-align: center; }',
      '.mn-crop-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }',
    ].join('\n');
    document.head.appendChild(st);
    // 视口缩放时重算所有已落地裁切图（一次性 debounce 120ms 监听；data-crop 标记由 applyCrop 写）
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(cropRescaleAll, 120);
    });
  }

  function cropNorm(raw) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      var x = Number(raw.x), y = Number(raw.y), w = Number(raw.w), h = Number(raw.h);
      if ([x, y, w, h].every(function (n) { return Number.isFinite(n); }) &&
        x >= 0 && y >= 0 && x <= 1 && y <= 1 && w > 0 && h > 0 && w <= 1 && h <= 1 &&
        x + w <= 1 + 1e-6 && y + h <= 1 + 1e-6) {
        return { x: x, y: y, w: w, h: h };
      }
    }
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  function cropApplyCrop(img, crop, box) {
    // 中心锚定 cover 渲染（见组件头注释）；naturalWidth=0 时挂 onload 自补；box 缺省 img.parentElement；写 data-crop 标记供 rescaleAll
    // v0.2.58.25 视频横幅：video 元素走 videoWidth/videoHeight + loadedmetadata 自补（几何数学零改动）
    if (!img || !img.parentNode) return;
    var bx = box || img.parentElement;
    if (!bx) return;
    var rect = cropNorm(crop);
    function apply() {
      var nw = img.naturalWidth || img.videoWidth, nh = img.naturalHeight || img.videoHeight;
      var W = bx.clientWidth, H = bx.clientHeight;
      if (!nw || !nh || !W || !H) return;
      var s = Math.max(W / (rect.w * nw), H / (rect.h * nh));
      img.style.width = (nw * s) + 'px';
      img.style.height = (nh * s) + 'px';
      img.style.left = (W / 2 - (rect.x + rect.w / 2) * nw * s) + 'px';
      img.style.top = (H / 2 - (rect.y + rect.h / 2) * nh * s) + 'px';
      img.dataset.crop = JSON.stringify(rect);
    }
    var ready = img.naturalWidth && img.naturalHeight;
    if (ready) apply();
    else {
      var evName = img.tagName === 'VIDEO' ? 'loadedmetadata' : 'load';
      img.addEventListener(evName, function onl() { img.removeEventListener(evName, onl); apply(); });
    }
  }

  function cropRescaleAll() {
    var imgs = document.querySelectorAll('[data-crop]');
    for (var i = 0; i < imgs.length; i++) {
      try { cropApplyCrop(imgs[i], JSON.parse(imgs[i].dataset.crop), imgs[i].parentElement); } catch (e) {}
    }
  }

  function cropOpen(opts) {
    if (cropState || !opts || !opts.src) return;
    ensureCropStyle();
    var kind = opts.kind === 'banner' ? 'banner' : 'avatar';
    var isBlob = (typeof Blob !== 'undefined') && (opts.src instanceof Blob);
    var isVideo = isBlob ? (String(opts.src.type || '').indexOf('video/') === 0)
      : /\.(mp4|webm|mov)([?#]|$)/i.test(String(opts.src));
    var url = isBlob ? URL.createObjectURL(opts.src) : String(opts.src);
    // 固定比例框尺寸：横幅 3:1（宽 min(720,80vw)）、头像 1:1（边长 min(64vh,80vw)）
    var W = kind === 'banner' ? Math.min(720, Math.round(window.innerWidth * 0.8))
      : Math.floor(Math.min(window.innerHeight * 0.64, window.innerWidth * 0.8));
    var H = kind === 'banner' ? Math.round(W / 3) : W;

    var overlay = document.createElement('div');
    overlay.className = 'mn-crop-overlay';
    var card = document.createElement('div');
    card.className = 'mn-crop-card';
    var head = document.createElement('div');
    head.className = 'mn-crop-head';
    var title = document.createElement('span');
    title.className = 'mn-crop-title';
    title.textContent = T(kind === 'avatar' ? 'crop.titleAvatar' : 'crop.titleBanner') || (kind === 'avatar' ? 'Crop avatar' : 'Crop banner');
    var xBtn = document.createElement('button');
    xBtn.type = 'button';
    xBtn.className = 'mn-crop-x';
    xBtn.innerHTML = icon('close', 20);
    head.appendChild(title);
    head.appendChild(xBtn);
    var stage = document.createElement('div');
    stage.className = 'mn-crop-stage';
    stage.style.width = W + 'px';
    stage.style.height = H + 'px';
    var media = isVideo ? document.createElement('video') : document.createElement('img');
    if (isVideo) { media.autoplay = true; media.muted = true; media.loop = true; media.playsInline = true; }
    else media.alt = '';
    stage.appendChild(media);
    var hint = document.createElement('div');
    hint.className = 'mn-crop-hint';
    hint.textContent = T('crop.hint') || 'Drag to move · scroll to zoom';
    var actions = document.createElement('div');
    actions.className = 'mn-crop-actions';
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-ghost mn-crop-cancel';
    cancelBtn.textContent = T('crop.cancel') || 'Cancel';
    var confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-primary mn-crop-confirm';
    confirmBtn.textContent = T('crop.confirm') || 'Apply';
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    card.appendChild(head);
    card.appendChild(stage);
    card.appendChild(hint);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    var rect = cropNorm(opts.initial);
    var nw = 0, nh = 0, s0 = 1, s = 1, sFull = 1;
    var rafPending = false;
    var closed = false;

    // 视窗模型核心：s 变化后围绕旧 rect 中心重算 rect=当前可见窗口（w/h 钳 ≤1 贴边）——
    // 保证「弹窗所见=confirm 所得=applyCrop 渲染」三处逐像素一致
    function windowFromZoom() {
      if (!nw || !nh) return;
      var cw = W / (nw * s), ch = H / (nh * s);
      var w2 = Math.min(1, cw), h2 = Math.min(1, ch);
      var cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      rect.x = Math.max(0, Math.min(1 - w2, cx - w2 / 2));
      rect.y = Math.max(0, Math.min(1 - h2, cy - h2 / 2));
      rect.w = w2;
      rect.h = h2;
    }
    function render() {
      if (!nw || !nh) return;
      media.style.width = (nw * s) + 'px';
      media.style.height = (nh * s) + 'px';
      media.style.left = (W / 2 - (rect.x + rect.w / 2) * nw * s) + 'px';
      media.style.top = (H / 2 - (rect.y + rect.h / 2) * nh * s) + 'px';
    }
    function scheduleRender() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () { rafPending = false; render(); });
    }
    function doClose(reason) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', escHandler, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (isBlob) URL.revokeObjectURL(url);
      cropState = null;
      if (reason === 'confirm') {
        rect.x = Math.round(rect.x * 10000) / 10000;
        rect.y = Math.round(rect.y * 10000) / 10000;
        rect.w = Math.round(rect.w * 10000) / 10000;
        rect.h = Math.round(rect.h * 10000) / 10000;
        if (opts.onConfirm) opts.onConfirm({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
      } else if (opts.onCancel) {
        opts.onCancel();
      }
    }
    var escHandler = function (e) {
      if (e.key !== 'Escape') return;
      // 捕获相 + stopPropagation：设置弹窗/资料页编辑弹窗的 Esc 监听都在冒泡相——拦截后不连锁关下层
      e.stopPropagation();
      e.preventDefault();
      doClose('cancel');
    };
    document.addEventListener('keydown', escHandler, true);
    xBtn.addEventListener('click', function () { doClose('cancel'); });
    cancelBtn.addEventListener('click', function () { doClose('cancel'); });
    confirmBtn.addEventListener('click', function () { doClose('confirm'); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) doClose('cancel'); });

    media.addEventListener(isVideo ? 'loadedmetadata' : 'load', function () {
      if (closed) return;
      nw = media.naturalWidth || media.videoWidth;
      nh = media.naturalHeight || media.videoHeight;
      if (!nw || !nh) return;
      sFull = Math.max(W / nw, H / nh); // 整图 cover 适配=缩放下限（重裁可缩回整图）
      s0 = Math.max(W / (rect.w * nw), H / (rect.h * nh)); // initial rect 适配=打开即显示存量 rect
      s = s0;
      render();
    });
    media.addEventListener('error', function () {
      if (closed) return;
      stToast(T('crop.loadFail') || 'Failed to load image, please try again', true);
      doClose('cancel');
    });

    // 拖拽平移：dx>0 图像右移 → rect 左移（x -= dx/(Nw·s) 跟手）；钳 [0,1-w]×[0,1-h]
    var pointers = {};
    var pinchDist = 0, pinchS = s;
    stage.addEventListener('pointerdown', function (e) {
      if (closed) return;
      e.preventDefault();
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      stage.classList.add('dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var p0 = pointers[ids[0]], p1 = pointers[ids[1]];
        pinchDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        pinchS = s;
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (closed || !pointers[e.pointerId]) return;
      var p = pointers[e.pointerId];
      var dx = e.clientX - p.x;
      var dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        // 双指捏合 best-effort：距离比 → 缩放（rect 恒居 stage 中心，缩放自动围绕中心→视窗重算）
        var p0 = pointers[ids[0]], p1 = pointers[ids[1]];
        var d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        if (pinchDist > 0) {
          s = Math.max(sFull, Math.min(3 * sFull, pinchS * (d / pinchDist)));
          windowFromZoom();
        }
        scheduleRender();
        return;
      }
      rect.x = Math.max(0, Math.min(1 - rect.w, rect.x - dx / (nw * s)));
      rect.y = Math.max(0, Math.min(1 - rect.h, rect.y - dy / (nh * s)));
      scheduleRender();
    });
    function pointerEnd(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length === 0) stage.classList.remove('dragging');
    }
    stage.addEventListener('pointerup', pointerEnd);
    stage.addEventListener('pointercancel', pointerEnd);
    stage.addEventListener('wheel', function (e) {
      if (closed) return;
      e.preventDefault();
      s = Math.max(sFull, Math.min(3 * sFull, s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      windowFromZoom(); // 视窗模型：缩放必重算 rect（所见即所得）
      scheduleRender();
    }, { passive: false });

    cropState = { overlay: overlay, rect: rect };
    media.src = url;
  }

  window.MN_CropDialog = {
    open: cropOpen,
    isOpen: function () { return !!cropState; },
    applyCrop: cropApplyCrop,
    rescaleAll: cropRescaleAll,
  };

  // ── v0.2.58.25 视频横幅（钦定补报：只横幅/浏览器压缩/超 60s 自动截取前 60 秒/GIF 同门）──
  // 压缩=canvas.captureStream+MediaRecorder（宽 1280 上限等比缩、30fps、1.2Mbps、静音无音轨——横幅天然静音）；
  // 输出恒 webm（≤30MB 后端视频上限天然合规）；输入任意大——跳过 10MB 图片预检=平台自己压缩。
  // MN_VideoCap=截取窗口纯函数（电池直测）；失败（MediaRecorder 缺失/解码失败/播放失败）reject 由调用方 toast。
  function stIsVideoUrl(u) {
    return /\.(mp4|webm|mov)([?#]|$)/i.test(String(u || ''));
  }
  function mnVideoCap(d) {
    return Math.min((d > 0 && isFinite(d)) ? d : 60, 60);
  }
  function mnCompressVideo(blob) {
    return new Promise(function (resolve, reject) {
      if (typeof MediaRecorder === 'undefined') { reject(new Error('unsupported')); return; }
      var url = null, video = null, canvas = null, rec = null, stopped = false;
      function cleanup() {
        try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (e) {}
        try { if (video) video.pause(); } catch (e) {}
        try { if (url) URL.revokeObjectURL(url); url = null; } catch (e) {}
      }
      function fail(err) {
        if (stopped) return;
        stopped = true;
        cleanup();
        reject(err);
      }
      try {
        url = URL.createObjectURL(blob);
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = url;
        video.addEventListener('error', function () { fail(new Error('decode-fail')); });
        video.addEventListener('loadedmetadata', function () {
          var capT = mnVideoCap(video.duration);
          var vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
          var scale = Math.min(1, 1280 / vw);
          canvas = document.createElement('canvas');
          canvas.width = Math.max(2, Math.round(vw * scale));
          canvas.height = Math.max(2, Math.round(vh * scale));
          var ctx = canvas.getContext('2d');
          var stream = null;
          try { stream = canvas.captureStream(30); } catch (e) { fail(new Error('capture-fail')); return; }
          var mime = 'video/webm;codecs=vp9';
          if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8';
          if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
          if (!MediaRecorder.isTypeSupported(mime)) { fail(new Error('unsupported')); return; }
          try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1200000 }); }
          catch (e) { fail(new Error('recorder-fail')); return; }
          var chunks = [];
          rec.addEventListener('dataavailable', function (e) { if (e.data && e.data.size) chunks.push(e.data); });
          rec.addEventListener('stop', function () {
            if (stopped) return;
            stopped = true;
            cleanup();
            try {
              resolve({ blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: 'webm' });
            } catch (err) { reject(err); }
          });
          var t0 = Date.now();
          video.addEventListener('ended', function () { // 短视频自然结束→早停（onended 早停路径）
            if (stopped) return;
            try { rec.stop(); } catch (e) {}
          });
          rec.start(500);
          function tick() {
            if (stopped) return;
            if (Date.now() - t0 >= capT * 1000) { try { rec.stop(); } catch (e) {} return; } // 60s 满自动 stop=截取
            try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); } catch (e) {}
            requestAnimationFrame(tick);
          }
          var playP = video.play();
          if (playP && playP.then) playP.then(tick, function () { fail(new Error('play-fail')); });
          else tick();
        });
      } catch (err) { fail(err); }
    });
  }
  window.MN_VideoCap = mnVideoCap;
  window.MN_CompressVideo = mnCompressVideo;

  // ── v0.2.58.21 资料区头像/横幅自定义链（与资料页编辑弹窗 58.18-58.20 同契约）──
  // 上传契约 fetch POST /social/uploads?ext= → PATCH /auth/me 只 {avatarUrl} 或 {bannerUrl} 或
  // {bannerUrl:null}（移除语义）→ PATCH ok 才改 UI；绝不 SlatiDB.saveUser（storage.js mirrorProfile
  // 双 PATCH 坑）——raw setItem 合并写 slati_user。API 走派生（本脚本所在页未必都载 api.js）。
  function stEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function stApiBase() {
    return (window.MN_API && window.MN_API.BASE) || (window.MN_SITE && window.MN_SITE.apiBase) || '/api';
  }
  function stSyncOn() {
    try { return localStorage.getItem('slati_avatar_sync') !== '0'; } catch (e) { return true; }
  }
  function stRawMergeUser(patch) {
    // 合并写 slati_user（不删其它字段）；try/catch 零异常面
    try {
      var cur = JSON.parse(localStorage.getItem('slati_user') || 'null') || {};
      for (var k in patch) { if (patch[k] !== undefined) cur[k] = patch[k]; }
      localStorage.setItem('slati_user', JSON.stringify(cur));
    } catch (e) {}
  }
  var stToastTimer = null;
  function stToast(msg, isErr) {
    var host = document.getElementById('settingsCard');
    if (!host) return;
    var t = document.getElementById('settingsProfileToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'settingsProfileToast';
      t.className = 'settings-profile-toast';
      host.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = isErr ? '#c62828' : 'var(--color-primary, #4648d4)';
    t.classList.add('active');
    if (stToastTimer) clearTimeout(stToastTimer);
    stToastTimer = setTimeout(function () { t.classList.remove('active'); }, 2500);
  }
  function stPatchMe(body) {
    // MN_API.patch 在则用（request 永不 reject）；否则 raw fetch——credentials 带会话
    if (window.MN_API && window.MN_API.patch) return window.MN_API.patch('/auth/me', body);
    return fetch(stApiBase() + '/auth/me', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), credentials: 'include'
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        return { ok: r.ok, status: r.status, data: d };
      });
    }).catch(function () { return { ok: false, status: 0, data: null, networkError: true }; });
  }
  // v0.2.58.22 三层门禁谓词 + 预设色卡表（13 条=默认+6 玻璃+3 单色+3 黑白渐变；玻璃含 glass-clear 供预览类渲染但
  // 不出现在网格——12 键；与资料页 CARD_BG_DEFS 同源，中文名硬编码同玻璃预设先例）
  var ST_BG_KEYS = ['glass-frost', 'glass-ocean', 'glass-violet', 'glass-rose', 'glass-mint', 'glass-sunset', 'solid-black', 'solid-white', 'solid-gray', 'mono-bw', 'mono-silver', 'mono-charcoal'];
  var ST_BG_DEFS = [['', '默认'], ['glass-frost', '磨砂'], ['glass-ocean', '深海'], ['glass-violet', '薰衣草'], ['glass-rose', '樱花'], ['glass-mint', '薄荷'], ['glass-sunset', '落日'], ['solid-black', '墨黑'], ['solid-white', '纯白'], ['solid-gray', '石板灰'], ['mono-bw', '黑白渐变'], ['mono-silver', '银灰渐变'], ['mono-charcoal', '炭黑渐变']];
  function stCanImg() { // 基础订阅及以上：横幅静态图/图库（free=仅预设色卡）
    return !!(stUser() && stUser().tier && stUser().tier !== 'free');
  }
  function stCanGif() { // 高级订阅（premium/ultra）：GIF 动图
    var t = stUser() && stUser().tier;
    return t === 'premium' || t === 'ultra';
  }
  function stDoUpload(file, ext, kind, rect) {
    // 上传+落库链（58.25 裁切：rect 恒写入 PATCH 体）；视频分支传 ext='webm'（压缩成片）
    fetch(stApiBase() + '/social/uploads?ext=.' + ext, { method: 'POST', body: file, credentials: 'include' })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (data) {
        if (!data || !data.url) { stToast(T('settings.profile.toast.failed') || '更新失败，请稍后再试', true); return; }
        var body = kind === 'avatar' ? { avatarUrl: data.url, avatarCrop: rect } : { bannerUrl: data.url, bannerCrop: rect };
        stPatchMe(body).then(function (res) {
          if (!res.ok) { stToast(T('settings.profile.toast.failed') || '更新失败，请稍后再试', true); return; }
          if (kind === 'avatar') {
            // 同步旗标 ON 才写 slati_user（OFF 时 PATCH 照发但本地零写——FC 页读旗标显示字母）
            if (stSyncOn()) stRawMergeUser({ avatarUrl: data.url, avatarCrop: rect });
            var pv = document.getElementById('settingsAvatarPreview');
            if (pv) { pv.src = data.url; cropApplyCrop(pv, rect, pv.parentElement); }
            var sbAv = document.querySelector('#slati-sidebar .user-module img.avatar');
            if (sbAv) sbAv.src = data.url;
            stToast(T('settings.profile.toast.avatarUpdated') || '头像已更新');
          } else {
            stRawMergeUser({ bannerUrl: data.url, bannerCrop: rect }); // bannerUrl 无旗标恒写（58.20 口径）
            var bp = document.getElementById('settingsBannerPreview');
            if (bp) {
              bp.classList.add('has-img');
              // v0.2.58.25 视频横幅：webm 走 <video> 预览（同 applyCrop 几何）；图片保留背景图加载兜底
              var isVid = ext === 'webm';
              bp.style.backgroundImage = isVid ? '' : 'url(' + data.url + ')';
              var oldM = bp.querySelector('.settings-banner-img, .settings-banner-video');
              if (oldM) oldM.remove();
              var m = isVid ? document.createElement('video') : document.createElement('img');
              m.className = isVid ? 'settings-banner-video' : 'settings-banner-img';
              if (isVid) { m.autoplay = true; m.muted = true; m.loop = true; m.playsInline = true; }
              else m.alt = '';
              bp.appendChild(m);
              m.src = data.url;
              cropApplyCrop(m, rect, bp);
            }
            var rm = document.getElementById('settingsBannerRemoveBtn');
            if (rm) rm.style.display = '';
            stToast(T('settings.profile.toast.bannerUpdated') || '横幅已更新');
          }
        });
      })
      .catch(function () { stToast(T('settings.profile.toast.failed') || '更新失败，请稍后再试', true); });
  }
  function stUpload(file, kind) {
    // kind: 'avatar' | 'banner'——统一链：gif 高级锁→视频分支（只横幅）→白名单→≤10MB→裁切弹窗→stDoUpload
    if (!file) return;
    var dot = String(file.name || '').lastIndexOf('.');
    var ext = dot >= 0 ? String(file.name).slice(dot + 1).toLowerCase() : '';
    var upgradeId = kind === 'avatar' ? 'settingsAvatarGifUpgradeLink' : 'settingsBannerGifUpgradeLink';
    function showUpgrade() {
      var lk = document.getElementById(upgradeId);
      if (lk) lk.style.display = 'inline-flex';
    }
    if (ext === 'gif' && !stCanGif()) {
      stToast(T('settings.profile.toast.gifLocked') || 'GIF 动图为订阅用户专属功能', true);
      showUpgrade();
      return;
    }
    // v0.2.58.25 视频横幅（钦定：只横幅——头像链视频拒绝；GIF 同门=premium/ultra；
    // 跳过 10MB 预检=输入任意大平台自己压缩；压缩成片走同裁切弹窗→stDoUpload）
    if (['mp4', 'webm', 'mov'].indexOf(ext) !== -1) {
      if (kind === 'avatar') {
        stToast(T('settings.profile.avatarNoVideo') || 'Avatar supports images only', true);
        return;
      }
      if (!stCanGif()) {
        stToast(T('settings.profile.videoLocked') || 'Video banners are a premium feature', true);
        showUpgrade();
        return;
      }
      stToast(T('settings.profile.videoCompressing') || 'Compressing banner video… (up to 1 minute)', false);
      mnCompressVideo(file).then(function (out) {
        MN_CropDialog.open({
          kind: 'banner',
          src: out.blob,
          initial: null,
          onConfirm: function (rect) { stDoUpload(out.blob, 'webm', kind, rect); }
        });
      }, function () {
        stToast(T('settings.profile.videoFail') || 'Video processing failed, please try another video', true);
      });
      return;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].indexOf(ext) === -1) {
      stToast(T('settings.profile.toast.imgOnly') || '只支持 jpg / png / gif / webp 图片', true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      stToast(T('settings.profile.toast.imgTooBig10') || '图片不能超过 10MB', true);
      return;
    }
    // v0.2.58.25 裁切弹窗（图库也走此链）：确认才上传（原文件原样 fetch，GIF 保动画），取消=零上传零 PATCH；
    // 确认不交互 rect 恒 {0,0,1,1} 且恒写入 PATCH 体
    MN_CropDialog.open({
      kind: kind,
      src: file,
      initial: null,
      onConfirm: function (rect) { stDoUpload(file, ext, kind, rect); }
    });
  }
  function stRemoveBanner() {
    stPatchMe({ bannerUrl: null }).then(function (res) {
      if (!res.ok) { stToast(T('settings.profile.toast.failed') || '更新失败，请稍后再试', true); return; }
      stRawMergeUser({ bannerUrl: null, bannerCrop: null }); // 连带清（58.25 后端 url null 自动清 crop）
      var bp = document.getElementById('settingsBannerPreview');
      if (bp) {
        bp.classList.remove('has-img');
        bp.style.backgroundImage = '';
        var bim = bp.querySelector('.settings-banner-img, .settings-banner-video');
        if (bim) bim.remove();
      }
      var rm = document.getElementById('settingsBannerRemoveBtn');
      if (rm) rm.style.display = 'none';
      stToast(T('settings.profile.toast.bannerRemoved') || '横幅已移除');
    });
  }
  function stUser() { return (window.SlatiDB && window.SlatiDB.getUser()) || {}; }
  var stLibPop = null;
  function stPickFromLibrary(kind) {
    // 免费层 → libLocked toast 锁（零 DOM）；basic+ → slati_img_library 只收 data: 条目
    //（http(s) 后门 58.18 钦定禁止）→ settingsCard 内 4 列小图库网格浮层 → 点格转 Blob 走 stUpload 同链
    var sub = stCanImg();
    if (!sub) {
      stToast(T('settings.profile.toast.libLocked') || '图库为订阅用户专属功能', true);
      var lk = document.getElementById(kind === 'avatar' ? 'settingsAvatarGifUpgradeLink' : 'settingsBannerGifUpgradeLink');
      if (lk) lk.style.display = 'inline-flex';
      return;
    }
    var items = [];
    try {
      var raw = JSON.parse(localStorage.getItem('slati_img_library') || '[]');
      items = (Array.isArray(raw) ? raw : []).filter(function (it) {
        return it && typeof it.src === 'string' && it.src.indexOf('data:') === 0;
      });
    } catch (e) {}
    if (!items.length) {
      stToast(T('settings.profile.toast.failed') || '图库为空，请先在编辑器中上传图片', true);
      return;
    }
    if (stLibPop) stLibPop.remove();
    var host = document.getElementById('settingsCard');
    if (!host) return;
    var pop = document.createElement('div');
    pop.className = 'settings-lib-pop';
    var grid = document.createElement('div');
    grid.className = 'settings-lib-grid';
    items.forEach(function (it) {
      var cell = document.createElement('div');
      cell.className = 'settings-lib-cell';
      var img = document.createElement('img');
      img.src = it.src; img.alt = '';
      cell.appendChild(img);
      cell.addEventListener('click', function () {
        stLibPop = null;
        pop.remove();
        try {
          fetch(it.src).then(function (r) { return r.blob(); }).then(function (blob) {
            stUpload(new File([blob], 'lib.' + (blob.type === 'image/gif' ? 'gif' : 'png'), { type: blob.type }), kind);
          }).catch(function () {});
        } catch (e) {}
      });
      grid.appendChild(cell);
    });
    pop.appendChild(grid);
    host.appendChild(pop);
    stLibPop = pop;
    setTimeout(function () {
      function docClose(e) {
        if (!stLibPop) { document.removeEventListener('click', docClose); return; } // 浮层已关（点格关闭）→ 监听器自清
        if (!stLibPop.contains(e.target)) {
          stLibPop.remove();
          stLibPop = null;
          document.removeEventListener('click', docClose);
        }
      }
      document.addEventListener('click', docClose);
    }, 0);
  }

  // ── Build modal ──
  function buildModal() {
    ensureStyle();
    var s = settings;
    // v0.2.40.0 — 编辑器区仅编辑器页出现（该页打开弹窗默认落此区）
    var isEditor = (location.pathname || '').indexOf('fluidcanvas-editor') !== -1;
    var user = (window.SlatiDB && SlatiDB.getUser()) || {
      displayName: 'Alex Rivera',
      citizenId: 'USR-8842',
      avatarUrl: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=4648d4&color=fff&size=80',
      bio: '',
    };

    // ── Section: Profile ──
    // v0.2.58.21 用户「你根本就没有在设置里完成我要的用户头像和横幅的自定义功能 >:(」：
    // 资料区直放完整控件（头像：预览+上传+FC 图库；横幅：预览+上传+图库+移除；同步勾选；
    // 免费/付费 gif 门禁同资料页编辑弹窗 58.19/58.20 口径）——改完即时生效不跳页。
    // 守卫：SlatiDB.getUser() 无 USR- id 或未登录（演示/游客）→ 上传/图库/移除控件不渲染，只读展示。
    var stReal = !!(user && user.id && String(user.id).indexOf('USR-') === 0);
    var stSub = stCanImg(); // 订阅谓词（v0.2.58.22 三层：basic+ 可静态图/图库；premium/ultra 再加 gif；free 只预设色卡）
    var stSyncOn = true;
    try { stSyncOn = localStorage.getItem('slati_avatar_sync') !== '0'; } catch (e) {} // 缺失/脏值=ON（58.20 同款谓词）
    var stUpgradeLink = function (id, mode) {
      // 58.22 tier 矩阵：canGif=不渲染；free：横幅→imgUpgrade、头像→gifUpgrade；basic：双行都→premGifUpgrade
      if (stCanGif()) return '';
      var isFree = !stSub;
      var key = isFree ? (mode === 'banner' ? 'settings.profile.imgUpgrade' : 'settings.profile.gifUpgrade') : 'settings.profile.premGifUpgrade';
      var fb = isFree ? (mode === 'banner' ? '订阅后解锁横幅图片与 GIF 动图' : '订阅后可上传 GIF 动图') : '升级到高级订阅可上传 GIF 动图';
      return '<a id="' + id + '" href="../pages/premium.html" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--color-primary);text-decoration:none;margin-top:6px">' +
        '<span class="material-symbols-outlined" style="font-size:14px">workspace_premium</span>' +
        (T(key) || fb) + '</a>';
    };
    var profChildren = [
      el('h4', '', { style: { margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-on-surface)' } }, '个人账户'),
      el('div', '', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' } }, [
        el('div', '', { style: { position: 'relative', flexShrink: '0' } },
          // v0.2.58.25 头像预览外包盒（64px 圆 overflow:hidden；border/圆角移盒上）——img 走 applyCrop 裁切渲染
          '<div class="settings-avatar-preview" style="width:64px;height:64px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.08)">' +
            '<img id="settingsAvatarPreview" src="' + (user.avatarUrl || window._slatiFallbackAvatar) + '" alt="" style="width:100%;height:100%">' +
          '</div>' +
          (stReal ?
            '<button id="settingsAvatarBtn" class="btn btn-ghost btn-icon btn-sm" type="button" style="position:absolute;bottom:-4px;right:-4px;width:28px;height:28px;border-radius:50%;background:var(--color-primary);color:white" title="' + (T('settings.profile.changeAvatar') || 'Change avatar') + '">' +
              '<span class="material-symbols-outlined" style="font-size:14px">photo_camera</span>' +
            '</button>' : '')
        ),
        el('div', '', { style: { flex: '1', minWidth: '0' } }, [
          el('label', 'form-label', { dataset: { i18n: 'settings.profile.displayName' } }, 'Display Name'),
          el('input', 'input-glass', { type: 'text', id: 'setDisplayName', value: user.displayName, style: { marginBottom: '8px' } }),
        ]),
      ]),
    ];
    if (stReal) {
      profChildren.push(
        el('div', '', { style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '-6px 0 12px 88px' } }, [
          // v0.2.58.22 免费层头像图库钮金色罩子（头像上传保持可用——钦定④头像口径现状）
          (function () {
            var b = el('button', 'btn btn-ghost btn-sm' + (stSub ? '' : ' sub-locked'), { type: 'button', id: 'settingsAvatarLibBtn', style: { padding: '4px 10px' }, title: (T('settings.profile.avatarGallery') || 'Choose from library') },
              icon('photo_library', 16) + '<span style="font-size:12px">' + (T('settings.profile.avatarGallery') || 'Choose from library') + '</span>');
            if (stSub) return b;
            var w = document.createElement('span');
            w.className = 'gold-lock-group';
            w.appendChild(b);
            return w;
          })(),
          // v0.2.58.25 重新裁切（钦定⑥）：仅已有头像时渲染；无订阅门禁（重裁=显示调整零上传）
          user.avatarUrl ? el('button', 'btn btn-ghost btn-sm', { type: 'button', id: 'settingsAvatarReCropBtn', style: { padding: '4px 10px' }, title: (T('settings.profile.reCropAvatar') || 'Re-crop avatar') },
            icon('crop', 16) + '<span style="font-size:12px">' + (T('settings.profile.reCropAvatar') || 'Re-crop avatar') + '</span>') : '',
        ]),
        stUpgradeLink('settingsAvatarGifUpgradeLink', 'avatar'),
        // ── 横幅组（58.18 口径：预览条+上传/图库/移除三按钮+升级链接；移除=PATCH {bannerUrl:null} 恢复预设渐变）──
        // v0.2.58.22：预览条挂 cardBg 预设类即时吃色；新预设色卡网格（免费层唯一横幅自定义入口——点击即存落库）
        el('div', 'form-group', {}, [
          el('label', 'form-label', { dataset: { i18n: 'settings.profile.banner' } }, 'Banner'),
          el('div', 'settings-banner-preview' + (user.bannerUrl ? ' has-img' : '') + (user.cardBg ? ' ' + user.cardBg : ''), { id: 'settingsBannerPreview',
            style: user.bannerUrl && !stIsVideoUrl(user.bannerUrl) ? { backgroundImage: 'url(' + user.bannerUrl + ')' } : {} },
            // v0.2.58.25 内嵌媒体走 applyCrop 裁切渲染（div 背景图留作图片加载兜底；视频横幅走 <video>）
            user.bannerUrl ? (stIsVideoUrl(user.bannerUrl)
              ? '<video class="settings-banner-video" autoplay muted loop playsinline src="' + user.bannerUrl + '"></video>'
              : '<img class="settings-banner-img" src="' + user.bannerUrl + '" alt="">') : ''),
          el('div', '', {}, [
            el('span', 'label-sm', { style: { display: 'block', marginBottom: '4px', color: 'var(--color-outline)' }, dataset: { i18n: 'settings.profile.bannerColor' } }, 'Banner color'),
            el('div', 'settings-bg-grid', { id: 'settingsBgGrid' }, ST_BG_DEFS.map(function (b) {
              return '<button type="button" class="settings-bg-swatch' + (b[0] ? ' ' + b[0] : ' bg-default') + ((user.cardBg || '') === b[0] ? ' active' : '') + '" data-bg="' + b[0] + '" title="' + b[1] + '"></button>';
            }).join('')),
          ]),
          el('div', '', { style: { display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' } }, [
            // v0.2.58.22 免费层：upload+lib 包进同一金色罩子（相邻共罩）；移除钮永远在罩外
            (function () {
              var up = el('button', 'btn btn-ghost btn-sm' + (stSub ? '' : ' sub-locked'), { type: 'button', id: 'settingsBannerUploadBtn', title: (T('settings.profile.bannerUpload') || 'Upload banner') }, icon('upload', 16));
              var lib = el('button', 'btn btn-ghost btn-sm' + (stSub ? '' : ' sub-locked'), { type: 'button', id: 'settingsBannerLibBtn', title: (T('settings.profile.bannerGallery') || 'Choose banner from library') }, icon('photo_library', 16));
              // 恒包 span（付费也包零类）：el() 不摊平嵌套数组，直接 [up,lib] 会被 appendChild 当非 Node 抛 TypeError
              var w = document.createElement('span');
              if (!stSub) w.className = 'gold-lock-group';
              w.appendChild(up);
              w.appendChild(lib);
              return w;
            })(),
            el('button', 'btn btn-ghost btn-sm', { type: 'button', id: 'settingsBannerRemoveBtn', style: user.bannerUrl ? {} : { display: 'none' }, title: (T('settings.profile.bannerRemove') || 'Remove banner') }, icon('delete', 16)),
            // v0.2.58.25 重新裁切（钦定⑥）：仅已有横幅时渲染；移除钮旁罩外；无订阅门禁
            user.bannerUrl ? el('button', 'btn btn-ghost btn-sm', { type: 'button', id: 'settingsBannerReCropBtn', title: (T('settings.profile.reCropBanner') || 'Re-crop banner') },
              icon('crop', 16) + '<span style="font-size:12px">' + (T('settings.profile.reCropBanner') || 'Re-crop banner') + '</span>') : '',
          ]),
          stUpgradeLink('settingsBannerGifUpgradeLink', 'banner'),
        ]),
        // ── 同步组（58.20 旗标 slati_avatar_sync：OFF 时 PATCH 照发但 slati_user 零写——FC 页读旗标显示字母）──
        el('div', '', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(118,117,134,0.08)', marginTop: '4px' } }, [
          el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)' }, dataset: { i18n: 'settings.profile.avatarSync' } }, 'Sync to channel homepage'),
          makeToggle(stSyncOn, function (on) {
            try { localStorage.setItem('slati_avatar_sync', on ? '1' : '0'); } catch (e) {}
          }),
        ])
      );
    }
    profChildren.push(
      el('div', 'form-group', {}, [
        el('label', 'form-label', { dataset: { i18n: 'settings.profile.bio' } }, 'Bio'),
        el('textarea', 'input-glass', { id: 'setBio', rows: '2', placeholder: 'A short bio about yourself…', dataset: { i18nPlaceholder: 'settings.profile.bioPh' } }, user.bio || ''),
      ]),
      el('div', 'form-group', {}, [
        el('label', 'form-label', { dataset: { i18n: 'settings.profile.citizenId' } }, 'Citizen ID'),
        el('input', 'input-glass', { type: 'text', value: user.citizenId, readonly: '', style: { opacity: '0.6', cursor: 'not-allowed' } }),
      ]),
      // 2026-09-03 用户「在后端做一下用户性别的记录，然后在用户资料里也单独显示」：Profile 区单独一行展示
      //（注册第二页下拉填写的值，镜像到后端 /me 后权威回读；未填写显示 —）
      el('div', 'form-group', {}, [
        el('label', 'form-label', { dataset: { i18n: 'settings.profile.gender' } }, 'Gender'),
        el('input', 'input-glass', { type: 'text', value: user.gender || '—', readonly: '', style: { opacity: '0.6', cursor: 'not-allowed' } }),
      ]),
      // v0.2.58.21 隐藏 file input（挂在 settingsCard 容器内——弹窗不整换，change 后清 value 可重选同文件）
      el('input', '', { type: 'file', id: 'settingsAvatarFile', accept: '.jpg,.jpeg,.png,.gif,.webp', style: { display: 'none' } }),
      // v0.2.58.25 视频横幅：横幅文件框收 mp4/webm/mov（头像框不收——头像链视频走 toast 拒绝）
      el('input', '', { type: 'file', id: 'settingsBannerFile', accept: '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov', style: { display: 'none' } }),
    );
    var profileSection = el('div', '', null, profChildren);

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
        '<span class="material-symbols-outlined" style="font-size:18px' + extra + '">' + th.icon + '</span>' +
        '<span data-i18n="settings.appearance.' + th.id + '">' + th.label + '</span></button>';
    }).join('');

    var fontSizeOpts = ['small', 'medium', 'large'];
    var fontSizeHTML = fontSizeOpts.map(function(fs) {
      return '<button class="subnav-pill' + (s.fontSize === fs ? ' active' : '') + '" data-fs="' + fs + '" data-i18n="settings.appearance.size.' + fs + '">' + fs.charAt(0).toUpperCase() + fs.slice(1) + '</button>';
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
        '<span class="accent-name" data-i18n="settings.appearance.accent.' + a.id + '">' + a.label + '</span></button>';
    }).join('');

    var appearSection = el('div', '', null, [
      el('h4', '', { style: { margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-on-surface)' } }, '显示'),
      el('div', '', { style: { paddingBottom: '12px', borderBottom: '1px solid rgba(118,117,134,0.08)' } }, [
        el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block', marginBottom: '8px' }, dataset: { i18n: 'settings.appearance.theme' } }, 'Theme'),
        el('div', 'subnav', { id: 'themeSubnav', style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } }, themeHTML),
      ]),
      el('div', '', { style: { padding: '12px 0' } }, [
        el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block', marginBottom: '8px' }, dataset: { i18n: 'settings.appearance.fontSize' } }, 'Font Size'),
        el('div', 'subnav', { id: 'fontSizeSubnav', style: { display: 'inline-flex' } }, fontSizeHTML),
      ]),
      el('div', '', { style: { paddingTop: '12px' } }, [
        el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block', marginBottom: '8px' }, dataset: { i18n: 'settings.appearance.accentColor' } }, 'Accent Color'),
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
        el('div', '', null, [
          el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block' }, dataset: { i18n: 'settings.notif.' + key } }, label),
          el('span', 'label-sm', { style: { color: 'var(--color-outline)' }, dataset: { i18n: 'settings.notif.' + key + 'Desc' } }, desc)]),
        tog,
      ]);
    }

    var notifSection = el('div', '', null, [
      el('h4', '', { style: { margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-on-surface)' } }, '通知'),
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
        el('div', '', null, [
          el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block' }, dataset: { i18n: 'settings.privacy.' + key } }, label),
          el('span', 'label-sm', { style: { color: 'var(--color-outline)' }, dataset: { i18n: 'settings.privacy.' + key + 'Desc' } }, desc)]),
        tog,
      ]);
    }

    var privSection = el('div', '', null, [
      el('h4', '', { style: { margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-on-surface)' } }, '私密账号'),
      privRow('Public Profile', 'Allow others to view your profile', 'profilePublic'),
      privRow('Activity Status', 'Show when you are online', 'showActivity'),
      privRow('Nation Affiliations', 'Display nations you belong to', 'showNations'),
    ]);

    // ── Section: Language（v0.2.54.0 全站 12 语言：读 MN_I18N.LANGS；FC 页无 i18n 用本地兜底清单）──
    // 语言名是固有名称（中文/Deutsch/Русский…）不翻译；active 读 i18n 当前语言优先，兼顾双键旧值
    var langs = (window.MN_I18N && window.MN_I18N.LANGS) || [
      { code: 'zh', name: '中文' },
      { code: 'zh-Hant', name: '繁體中文' },
      { code: 'en', name: 'English' },
      { code: 'de', name: 'Deutsch' },
      { code: 'ru', name: 'Русский' },
      { code: 'ms', name: 'Bahasa Melayu' },
      { code: 'th', name: 'ไทย' },
      { code: 'vi', name: 'Tiếng Việt' },
      { code: 'id', name: 'Bahasa Indonesia' },
      { code: 'fr', name: 'Français' },
      { code: 'es', name: 'Español' },
      { code: 'pt', name: 'Português' }
    ];
    var curLang = (window.MN_I18N && window.MN_I18N.getLang()) || localStorage.getItem('slati_lang') || s.language;
    var langHTML = langs.map(function(l) {
      return '<button class="subnav-pill' + (curLang === l.code ? ' active' : '') + '" data-lang="' + l.code + '">' + l.name + '</button>';
    }).join('');

    var langSection = el('div', '', null, [
      el('h4', '', { style: { margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-on-surface)' } }, '语言'),
      el('div', 'subnav', { id: 'langSubnav', style: { display: 'inline-flex', flexWrap: 'wrap' } }, langHTML),
    ]);

    // ── Section: Account / Danger Zone ──
    var accountSection = el('div', '', null, [
      el('h4', '', { style: { margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-on-surface)' } }, '账户操作'),
      el('div', '', { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' } }, [
        el('button', 'btn btn-outline', { id: 'setLogoutBtn', style: { color: '#dc2626', borderColor: 'rgba(220,38,38,0.2)' } },
          [icon('logout', 18), el('span', '', { dataset: { i18n: 'settings.account.logout' } }, 'Logout')]),
        el('button', 'btn btn-ghost', { id: 'setDeleteBtn', style: { color: '#dc2626' } },
          [icon('delete_forever', 18), el('span', '', { dataset: { i18n: 'settings.account.delete' } }, 'Delete Account')]),
      ]),
      el('div', '', { style: { marginTop: 'var(--space-md)', fontSize: '12px', display: 'flex', gap: '14px' } }, [
        el('a', '', { href: '../pages/terms.html', target: '_blank', style: { color: 'var(--color-on-surface-variant)', textDecoration: 'underline' }, dataset: { i18n: 'settings.account.terms' } }, '服务条款'),
        el('a', '', { href: '../pages/financial-terms.html', target: '_blank', style: { color: 'var(--color-on-surface-variant)', textDecoration: 'underline' }, dataset: { i18n: 'settings.account.fin' } }, '财务与支付'),
        el('a', '', { href: '../pages/platform-responsibility.html', target: '_blank', style: { color: 'var(--color-on-surface-variant)', textDecoration: 'underline' }, dataset: { i18n: 'settings.account.resp' } }, '平台责任'),
        el('a', '', { href: '../pages/community-rules.html', target: '_blank', style: { color: 'var(--color-on-surface-variant)', textDecoration: 'underline' }, dataset: { i18n: 'settings.account.rules' } }, '社区规则'),
        el('a', '', { href: '../pages/privacy.html', target: '_blank', style: { color: 'var(--color-on-surface-variant)', textDecoration: 'underline' }, dataset: { i18n: 'settings.account.privacy' } }, '隐私政策'),
      ]),
    ]);

    // ── Section: Developer（v0.2.59.9 开发者开关；打开展示版本/账号/API 调试信息）──
    function devInfoRows() {
      var u = (window.SlatiDB && window.SlatiDB.getUser()) || {};
      var rows = [
        ['站点版本', window.MN_SITE_VERSION || '—'],
        ['FC 版本', window.FLUIDCANVAS_VERSION || '—'],
        ['用户', (u.displayName || u.id) ? (u.displayName || '') + (u.id ? ' · ' + u.id : '') : '未登录'],
        ['订阅等级', u.tier || 'free'],
        ['语言', (window.MN_I18N && window.MN_I18N.getLang()) || settings.language || 'en'],
        ['主题', settings.theme || 'light'],
        ['主色', settings.accent || 'blue'],
        ['API 地址', (window.MN_API && window.MN_API.BASE) || '/api'],
      ];
      return rows.map(function (row) {
        return '<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid rgba(118,117,134,0.08)">' +
          '<span style="color:var(--color-outline);font-size:13px;flex-shrink:0">' + row[0] + '</span>' +
          '<span style="font-family:monospace;font-size:12px;color:var(--color-on-surface);text-align:right;word-break:break-all">' + row[1] + '</span></div>';
      }).join('');
    }
    var devToggle = makeToggle(s.developerMode, function (on) {
      settings.developerMode = on;
      saveSettings(settings);
      var infoEl = document.getElementById('devInfoBlock');
      if (infoEl) infoEl.style.display = on ? '' : 'none';
      if (on) {
        console.log('[dev] 开发者模式已开启', {
          siteVersion: window.MN_SITE_VERSION, fcVersion: window.FLUIDCANVAS_VERSION,
          user: (window.SlatiDB && window.SlatiDB.getUser()) || {}, api: (window.MN_API && window.MN_API.BASE) || '/api'
        });
      }
    });
    var developerSection = el('div', '', null, [
      el('h3', 'label-lg', { style: { marginBottom: '12px', color: 'var(--color-on-surface)' } }, '开发者'),
      el('div', '', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(118,117,134,0.08)' } }, [
        el('div', '', null, [
          el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block' } }, '开发者模式'),
          el('span', 'label-sm', { style: { color: 'var(--color-outline)' } }, '开启后显示版本、账号、API 等调试信息')]),
        devToggle,
      ]),
      el('div', '', { id: 'devInfoBlock', style: { marginTop: '12px', display: s.developerMode ? '' : 'none' } }, devInfoRows()),
    ]);

    // ── Section: Editor（v0.2.40.0 仅编辑器页；自动保存频率 5/10/15/30/60 分钟）──
    var editorSection = null;
    if (isEditor) {
      var fcOpts = [5, 10, 15, 30, 60];
      var fcHTML = fcOpts.map(function (m) {
        return '<button type="button" class="subnav-pill' + (Number(s.fcAutoSave) === m ? ' active' : '') + '" data-min="' + m + '">' + m + ' <span data-i18n="settings.editor.minutes">分钟</span></button>';
      }).join('');
      editorSection = el('div', '', null, [
        el('h3', 'label-lg', { style: { marginBottom: '12px', color: 'var(--color-on-surface)' }, dataset: { i18n: 'settings.editor.title' } }, '编辑器'),
        el('div', 'form-group', {}, [
          el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block', marginBottom: '8px' }, dataset: { i18n: 'settings.editor.autosave' } }, '自动保存频率'),
          el('div', 'subnav', { id: 'fcAutoSubnav', style: { display: 'inline-flex', flexWrap: 'wrap' } }, fcHTML),
          el('span', 'label-sm', { style: { display: 'block', marginTop: '8px', color: 'var(--color-outline)' }, dataset: { i18n: 'settings.editor.autosaveDesc' } }, '平台每 N 分钟自动保存一次草稿。默认 10 分钟，最快 5 分钟；Ctrl+S 或「Save Draft」可立即保存。'),
        ]),
      ]);
    }

    // ── v0.2.59.x 手机「我的」5 分类同步到电脑：新增 内容偏好/隐私与安全/屏蔽/互动/观众控制/辅助功能 ──
    function secGroup(title) {
      return el('h4', '', { style: { margin: '18px 0 2px', fontSize: '12px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-outline)' } }, title);
    }
    function mkLocalToggle(key, label, desc) {
      var on = '0';
      try { on = localStorage.getItem('slati_meset_' + key) || '0'; } catch (e) {}
      var sw = makeToggle(on === '1', function (v) {
        try { localStorage.setItem('slati_meset_' + key, v ? '1' : '0'); } catch (e) {}
      });
      return el('div', '', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(118,117,134,0.08)' } }, [
        el('div', '', null, [
          el('span', '', { style: { fontWeight: '600', fontSize: 'var(--fs-label-md)', display: 'block' } }, label),
          desc ? el('span', 'label-sm', { style: { color: 'var(--color-outline)' } }, desc) : '',
        ]),
        sw,
      ]);
    }

    var contentPrefSection = el('div', '', null, [secGroup('内容偏好')].concat(
      ['政治', '经济', '文化', '科技', '军事', '体育', '娱乐', '生活'].map(function (t) { return mkLocalToggle('topic_' + t, t); })
    ));

    var privacySecuritySection = el('div', '', null, [
      secGroup('隐私与安全'),
      el('button', 'btn btn-outline', { id: 'setChangePwBtn', type: 'button', style: { color: '#4648d4', borderColor: 'rgba(70,72,212,0.3)' } },
        [icon('password', 18), '<span>修改密码</span>']),
      el('div', 'label-sm', { style: { color: 'var(--color-outline)', marginTop: '8px' } }, '两步验证、登录设备管理将在后续版本上线。'),
    ]);

    var blockedSection = el('div', '', null, [
      secGroup('屏蔽账号'),
      el('div', '', { id: 'setBlockedList', style: { fontSize: '13px', color: 'var(--color-outline)' } }, '加载中…'),
    ]);

    var interactionsSection = el('div', '', null, [
      secGroup('互动许可'),
      mkLocalToggle('allow_comments', '评论', '允许他人评论我的内容'),
      mkLocalToggle('allow_mentions', '提及', '允许他人 @ 我'),
      mkLocalToggle('allow_dm', '私信', '允许他人给我发私信'),
      mkLocalToggle('allow_derivative', '二次创作内容', '允许他人基于我的内容创作'),
      secGroup('列表'),
      el('a', '', { href: '../pages/following.html', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', textDecoration: 'none', color: 'var(--color-on-surface)', borderBottom: '1px solid rgba(118,117,134,0.08)' } },
        ['<span style="font-weight:600;font-size:var(--fs-label-md)">关注列表</span>', icon('chevron_right', 18)]),
      el('div', '', { id: 'setLikedList', style: { fontSize: '13px', color: 'var(--color-outline)', paddingTop: '10px' } }, '加载中…'),
    ]);

    var audienceSection = el('div', '', null, [
      secGroup('观众控制'),
      (function () {
        var cur = 'public';
        try { cur = localStorage.getItem('slati_meset_audience') || 'public'; } catch (e) {}
        var opts = [{ v: 'public', l: '公开' }, { v: 'followers', l: '仅关注者' }, { v: 'private', l: '仅自己' }];
        var pills = opts.map(function (o) {
          return '<button type="button" class="subnav-pill' + (o.v === cur ? ' active' : '') + '" data-audience="' + o.v + '">' + o.l + '</button>';
        }).join('');
        return el('div', 'subnav', { id: 'audienceSubnav', style: { display: 'inline-flex', flexWrap: 'wrap' } }, pills);
      })(),
    ]);

    var accessibilitySection = el('div', '', null, [
      secGroup('辅助功能'),
      mkLocalToggle('reduce_motion', '减少动画', '减少界面动效与过渡'),
    ]);

    // ── Assemble：左菜单 + 右内容区（2026-09-10 用户左侧菜单口径）──
    var secList = [
      { id: 'activity',     el: el('div', '', null, [contentPrefSection, notifSection]) },
      { id: 'account',      el: el('div', '', null, [profileSection, privacySecuritySection, accountSection]) },
      { id: 'visibility',   el: el('div', '', null, [privSection, blockedSection]) },
      { id: 'interactions', el: interactionsSection },
      { id: 'preferences',  el: el('div', '', null, [langSection, appearSection, audienceSection, accessibilitySection]) },
      { id: 'developer',    el: developerSection },
    ];
    // v0.2.40.0 — 编辑器区仅编辑器页出现（该页打开弹窗默认落此区）；MENU 母数组不动，局部 slice 拼装
    var defSec = 'activity';
    var menuItems = MENU.slice();
    if (isEditor && editorSection) {
      defSec = 'editor';
      secList.unshift({ id: 'editor', el: editorSection });
      menuItems.unshift({ id: 'editor', icon: 'edit_note', label: '编辑器' });
    }
    var menu = el('div', 'settings-menu', { id: 'settingsMenu' }, menuItems.map(function (m) {
      return el('button', 'settings-menu-item' + (m.id === defSec ? ' active' : ''), { type: 'button', dataset: { sec: m.id } },
        icon(m.icon, 18) + '<span data-i18n="settings.menu.' + m.id + '">' + m.label + '</span>');
    }));
    var pane = el('div', 'settings-pane', null, secList.map(function (s) {
      return el('div', 'settings-sec' + (s.id === defSec ? '' : ' settings-sec-hidden'), { dataset: { sec: s.id } }, [s.el]);
    }));
    var body = el('div', 'settings-layout', null, [menu, pane]);

    // ── Header ──
    var header = el('div', '', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' } }, [
      el('div', '', null, [
        el('h2', 'headline-md', { style: { margin: '0' } },
          [icon('settings', 24), el('span', '', { dataset: { i18n: 'settings.title' } }, 'Settings')]),
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
    // v0.2.54.0 i18n：弹窗每次打开重建，建完扫一遍 data-i18n（无 i18n 的页面如 FC 为 no-op）
    if (window.MN_I18N) MN_I18N.apply();

    // Animate in
    requestAnimationFrame(function () {
      modalEls.backdrop.classList.add('active');
      modalEls.container.querySelector('.modal-card').classList.add('active');
      // v0.2.58.25 预览裁切渲染（append 后才有 clientWidth，故在此落地）
      var u2 = (window.SlatiDB && SlatiDB.getUser()) || {};
      var avP = document.getElementById('settingsAvatarPreview');
      if (avP) cropApplyCrop(avP, u2.avatarCrop, avP.parentElement);
      var bp2 = document.getElementById('settingsBannerPreview');
      var bim2 = bp2 && bp2.querySelector('.settings-banner-img, .settings-banner-video');
      if (bp2 && bim2) cropApplyCrop(bim2, u2.bannerCrop, bp2);
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

    // Language pills（v0.2.54.0 双键统一：settings.language + slati_lang 同写——
    // 修复「刷新后 active 态与实际语言不一致」；FC 页无 i18n 时直写 localStorage 仍让全站记住选择）
    var langSubnav = document.getElementById('langSubnav');
    if (langSubnav) {
      langSubnav.addEventListener('click', function (e) {
        var btn = e.target.closest('.subnav-pill');
        if (!btn) return;
        langSubnav.querySelectorAll('.subnav-pill').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var lang = btn.dataset.lang;
        settings.language = lang;
        saveSettings(settings);
        try { localStorage.setItem('slati_lang', lang); } catch (err) {}
        if (window.MN_I18N) window.MN_I18N.setLang(lang);
      });
    }

    // 观众控制（v0.2.59.x 手机「我的」同步）
    var audienceSubnav = document.getElementById('audienceSubnav');
    if (audienceSubnav) {
      audienceSubnav.addEventListener('click', function (e) {
        var btn = e.target.closest('.subnav-pill');
        if (!btn) return;
        audienceSubnav.querySelectorAll('.subnav-pill').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        try { localStorage.setItem('slati_meset_audience', btn.dataset.audience); } catch (err) {}
      });
    }

    // 修改密码（账户 · 隐私与安全）
    var changePwBtn = document.getElementById('setChangePwBtn');
    if (changePwBtn) {
      changePwBtn.addEventListener('click', function () {
        var pw = window.prompt('请输入新密码（至少 8 位）：');
        if (!pw) return;
        if (pw.length < 8) { window.alert('密码至少 8 位'); return; }
        fetch('/api/auth/password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: pw }) })
          .then(function (r) { return r.json(); })
          .then(function (d) { window.alert(d.ok ? '密码已更新' : (d.error || '修改失败')); });
      });
    }

    // 屏蔽账号列表（可见性分类）
    function blockedRow(x) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(118,117,134,0.08)">'
        + '<span style="font-weight:600;font-size:13px">' + (x.displayName || '') + '</span>'
        + '<button type="button" class="btn btn-ghost btn-sm" data-unblock="' + x.id + '" style="color:#dc2626">解除屏蔽</button></div>';
    }
    function renderBlocked() {
      var el = document.getElementById('setBlockedList');
      if (!el) return;
      fetch('/api/social/blocked', { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var list = (d && d.users) || [];
          el.innerHTML = list.length ? list.map(blockedRow).join('') : '暂无屏蔽账号';
        })
        .catch(function () { el.textContent = '加载失败'; });
    }
    renderBlocked();
    var blockedWrap = document.getElementById('setBlockedList');
    if (blockedWrap) {
      blockedWrap.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-unblock]');
        if (!btn) return;
        fetch('/api/social/users/' + encodeURIComponent(btn.dataset.unblock) + '/block', { method: 'DELETE', credentials: 'include' })
          .then(function () { renderBlocked(); });
      });
    }

    // 赞过的视频列表（互动分类）
    (function () {
      var el = document.getElementById('setLikedList');
      if (!el) return;
      var uid = ((window.SlatiDB && SlatiDB.getUser()) || {}).id || '';
      if (!uid) { el.textContent = '登录后查看'; return; }
      fetch('/api/social/users/' + encodeURIComponent(uid) + '/posts?tab=likes', { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var posts = (d && d.posts) || [];
          if (!posts.length) { el.textContent = '暂无赞过的内容'; return; }
          el.innerHTML = posts.map(function (p) {
            return '<div style="padding:8px 0;border-bottom:1px solid rgba(118,117,134,0.08)">'
              + '<div style="font-size:12px;color:var(--color-outline)">' + (p.authorName || '') + ' · ' + (p.createdAt ? String(p.createdAt).slice(0, 10) : '') + '</div>'
              + '<div style="font-size:13px;margin-top:2px;word-break:break-word">' + (p.content || '') + '</div></div>';
          }).join('');
        })
        .catch(function () { el.textContent = '加载失败'; });
    })();

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

    // ── v0.2.58.21 头像/横幅自定义控件 wiring（每次 open 重建弹窗=每次重挂，无残留监听）──
    var avBtn = document.getElementById('settingsAvatarBtn');
    var avFile = document.getElementById('settingsAvatarFile');
    if (avBtn && avFile) {
      avBtn.addEventListener('click', function () { avFile.click(); });
      avFile.addEventListener('change', function () {
        stUpload(avFile.files && avFile.files[0], 'avatar');
        avFile.value = ''; // 清空可重选同文件
      });
    }
    var avLib = document.getElementById('settingsAvatarLibBtn');
    if (avLib) avLib.addEventListener('click', function () { stPickFromLibrary('avatar'); });
    var bnUp = document.getElementById('settingsBannerUploadBtn');
    var bnFile = document.getElementById('settingsBannerFile');
    if (bnUp && bnFile) {
      bnUp.addEventListener('click', function () {
        // v0.2.58.22 免费层横幅上传锁：toast+升级链接显，文件选择器绝不打开（金罩点击穿透到此给反馈）
        if (!stCanImg()) {
          stToast(T('settings.profile.toast.bannerLocked') || '横幅图片为订阅用户专属功能', true);
          var upL = document.getElementById('settingsBannerGifUpgradeLink');
          if (upL) upL.style.display = 'inline-flex';
          return;
        }
        bnFile.click();
      });
      bnFile.addEventListener('change', function () {
        stUpload(bnFile.files && bnFile.files[0], 'banner');
        bnFile.value = '';
      });
    }
    var bnLib = document.getElementById('settingsBannerLibBtn');
    if (bnLib) bnLib.addEventListener('click', function () { stPickFromLibrary('banner'); });
    var bnRm = document.getElementById('settingsBannerRemoveBtn');
    if (bnRm) bnRm.addEventListener('click', stRemoveBanner);
    // ── v0.2.58.25 重新裁切（钦定⑥）：src=当前 URL 字符串（零 blob 处理）、initial=当前 crop；
    // confirm → PATCH 只 {avatarCrop|bannerCrop}（无 url——后端不动图不动连带清）→ ok 才本地合并写+预览重渲染 ──
    var avRe = document.getElementById('settingsAvatarReCropBtn');
    if (avRe) avRe.addEventListener('click', function () {
      var u = (window.SlatiDB && SlatiDB.getUser()) || {};
      if (!u.avatarUrl) return;
      MN_CropDialog.open({
        kind: 'avatar',
        src: u.avatarUrl,
        initial: u.avatarCrop || null,
        onConfirm: function (rect) {
          stPatchMe({ avatarCrop: rect }).then(function (res) {
            if (!res.ok) { stToast(T('settings.profile.toast.failed') || '更新失败，请稍后再试', true); return; }
            if (stSyncOn()) stRawMergeUser({ avatarCrop: rect }); // 58.20 口径：同步 OFF 时 PATCH 照发本地零写
            var pv = document.getElementById('settingsAvatarPreview');
            if (pv) cropApplyCrop(pv, rect, pv.parentElement);
            stToast(T('settings.profile.toast.avatarUpdated') || '头像已更新');
          });
        }
      });
    });
    var bnRe = document.getElementById('settingsBannerReCropBtn');
    if (bnRe) bnRe.addEventListener('click', function () {
      var u = (window.SlatiDB && SlatiDB.getUser()) || {};
      if (!u.bannerUrl) return;
      MN_CropDialog.open({
        kind: 'banner',
        src: u.bannerUrl,
        initial: u.bannerCrop || null,
        onConfirm: function (rect) {
          stPatchMe({ bannerCrop: rect }).then(function (res) {
            if (!res.ok) { stToast(T('settings.profile.toast.failed') || '更新失败，请稍后再试', true); return; }
            stRawMergeUser({ bannerCrop: rect }); // banner 无旗标恒写（58.20 口径）
            var bp = document.getElementById('settingsBannerPreview');
            var bim = bp && bp.querySelector('.settings-banner-img, .settings-banner-video');
            if (bp && bim) cropApplyCrop(bim, rect, bp);
            stToast(T('settings.profile.toast.bannerUpdated') || '横幅已更新');
          });
        }
      });
    });
    // v0.2.58.22 预设色卡（免费层唯一横幅自定义入口）：点击即存——PATCH {cardBg:key} ok 才落本地+
    // active 换位+预览即时吃色（失败 toast 零状态回滚；has-img 内联 backgroundImage 不受 className 整换影响）
    var bgGrid = document.getElementById('settingsBgGrid');
    if (bgGrid) {
      bgGrid.addEventListener('click', function (e) {
        var sw = e.target.closest('.settings-bg-swatch');
        if (!sw) return;
        var key = sw.dataset.bg || '';
        stPatchMe({ cardBg: key }).then(function (res) {
          if (!res.ok) { stToast(T('settings.profile.toast.failed') || '更新失败，请稍后再试', true); return; }
          stRawMergeUser({ cardBg: key });
          bgGrid.querySelectorAll('.settings-bg-swatch').forEach(function (s) { s.classList.toggle('active', s === sw); });
          var bp = document.getElementById('settingsBannerPreview');
          if (bp) {
            var hasImg = bp.classList.contains('has-img');
            bp.className = 'settings-banner-preview' + (hasImg ? ' has-img' : '') + (key ? ' ' + key : '');
          }
          stToast(T('settings.profile.toast.bgUpdated') || '横幅颜色已更新');
        });
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
        if (confirm(T('settings.account.deleteConfirm') || 'Are you sure you want to delete your account? This action cannot be undone.')) {
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
