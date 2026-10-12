/**
 * 插件商店（站点 v0.2.59.0）
 * 列表 / 搜索 / 分类筛选 / 插件信息弹窗（预览图+简介 + 版本历史 + 底部安装按钮）/ 安装·卸载（订阅门槛）。
 * 数据走 /api/plugins*（后端 034 迁移 + routes/public/plugins.js）。
 */
(function () {
  'use strict';

  var state = { plugins: [], installed: [], q: '', category: '' };
  var current = null; // { plugin, versions }

  var TIER_LABEL = { premium: '高级订阅', basic: '基础订阅', free: '免费', ultra: '顶级订阅' };

  var GITHUB_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-label="GitHub"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

  function isDeveloperMode() {
    try {
      var raw = localStorage.getItem('slati_settings');
      if (!raw) return false;
      return !!JSON.parse(raw).developerMode;
    } catch (e) { return false; }
  }

  function authorAvatar(p, large) {
    if (p.authorAvatar) {
      return '<img src="' + p.authorAvatar + '" alt="" class="plugin-author-avatar' + (large ? ' plugin-author-avatar-lg' : '') + '">';
    }
    var ini = (p.authorName || '?').trim().charAt(0).toUpperCase();
    return '<span class="plugin-author-avatar' + (large ? ' plugin-author-avatar-lg' : '') + ' plugin-author-avatar-fallback">' + ini + '</span>';
  }

  function toast(msg) {
    var el = document.getElementById('pluginToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pluginToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;' +
        'background:var(--color-inverse-surface,#1c1c22);color:var(--color-inverse-on-surface,#fff);' +
        'padding:10px 22px;border-radius:999px;font-size:14px;font-weight:500;opacity:0;transition:opacity .3s;pointer-events:none;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:80vw;text-align:center;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = '0'; }, 2400);
  }

  function load() {
    Promise.all([MN_API.get('/plugins'), MN_API.get('/plugins/me')]).then(function (rs) {
      state.plugins = (rs[0].ok && rs[0].data && rs[0].data.plugins) || [];
      state.installed = (rs[1].ok && rs[1].data && rs[1].data.installed) || [];
      render();
    });
  }

  function visible() {
    var q = state.q.trim().toLowerCase();
    return state.plugins.filter(function (p) {
      if (state.category && p.category !== state.category) return false;
      if (q) {
        var hay = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function tierBadge(tier) {
    return '<span class="plugin-tier plugin-tier-' + (tier || 'free') + '">' + (TIER_LABEL[tier] || tier) + '</span>';
  }

  function cardHTML(p) {
    var inst = state.installed.indexOf(p.id) >= 0;
    var bg = (p.preview && p.preview.indexOf('gradient') >= 0) ? p.preview : 'linear-gradient(135deg,#4648d4,#7b7ff0)';
    return '<div class="plugin-card" data-id="' + p.id + '" role="button" tabindex="0">' +
      '<div class="plugin-card-preview" style="background:' + bg + '">' +
        '<span class="plugin-card-icon">' + (p.icon || '🧩') + '</span>' +
      '</div>' +
      '<div class="plugin-card-body">' +
        '<div class="plugin-card-title">' + p.name +
          (p.github ? '<span class="plugin-gh" title="GitHub">' + GITHUB_SVG + '</span>' : '') +
          (inst ? '<span class="plugin-installed-tag">已安装</span>' : '') + '</div>' +
        '<div class="plugin-card-desc">' + (p.description || '') + '</div>' +
        '<div class="plugin-card-meta">' +
          '<span class="plugin-card-count">' + (p.installCount || 0) + ' 安装</span>' +
        '</div>' +
        '<div class="plugin-card-foot">' + tierBadge(p.minTier) +
          '<span class="plugin-card-version">v' + (p.version || '1.0.0') + '</span></div>' +
        '<div class="plugin-card-author" data-id="' + p.id + '">' +
          authorAvatar(p) +
          '<span class="plugin-card-author-name">' + (p.authorName || '未知作者') + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function render() {
    var grid = document.getElementById('pluginGrid');
    var list = visible();
    if (!list.length) {
      grid.innerHTML = '<div class="plugins-empty">没有匹配的插件</div>';
      return;
    }
    grid.innerHTML = list.map(cardHTML).join('');
    grid.querySelectorAll('.plugin-card').forEach(function (el) {
      el.addEventListener('click', function () { openModal(el.dataset.id); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(el.dataset.id); } });
    });
    grid.querySelectorAll('.plugin-card-author').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var p = state.plugins.find(function (x) { return x.id === el.dataset.id; });
        if (p) openAuthorModal(p);
      });
    });
  }

  // ── 弹窗 ──
  function openModal(id) {
    MN_API.get('/plugins/' + encodeURIComponent(id)).then(function (r) {
      if (!r.ok || !r.data || !r.data.plugin) { toast('插件信息加载失败'); return; }
      current = { plugin: r.data.plugin, versions: r.data.versions || [] };
      renderModal();
      document.getElementById('pluginModal').style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  }

  function closeModal() {
    document.getElementById('pluginModal').style.display = 'none';
    document.body.style.overflow = '';
    current = null;
  }

  function switchTab(tab) {
    document.getElementById('pluginInfoPage').style.display = (tab === 'info' ? '' : 'none');
    document.getElementById('pluginVersionsPage').style.display = (tab === 'versions' ? '' : 'none');
    document.querySelectorAll('.plugin-modal-tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
  }

  function renderModal() {
    var p = current.plugin;
    var bg = (p.preview && p.preview.indexOf('gradient') >= 0) ? p.preview : 'linear-gradient(135deg,#4648d4,#7b7ff0)';
    document.getElementById('pluginPreview').style.background = bg;
    document.getElementById('pluginPreviewIcon').textContent = p.icon || '🧩';
    document.getElementById('pluginName').textContent = p.name;
    document.getElementById('pluginAuthor').textContent = '作者：' + (p.authorName || '未知');
    document.getElementById('pluginDesc').textContent = p.description || '';
    document.getElementById('pluginCategoryTag').textContent = p.category || 'general';
    document.getElementById('pluginInstallCount').textContent = '· ' + (p.installCount || 0) + ' 安装';

    document.getElementById('pluginVersions').innerHTML = current.versions.map(function (v) {
      var d = (v.createdAt || '').slice(0, 10);
      return '<div class="plugin-version">' +
        '<div class="plugin-version-head"><span class="plugin-version-num">v' + v.version + '</span>' +
        '<span class="plugin-version-date">' + d + '</span></div>' +
        '<div class="plugin-version-log">' + (v.changelog || '（无更新说明）') + '</div>' +
      '</div>';
    }).join('') || '<div class="plugins-empty">暂无版本记录</div>';

    updateInstallBtn();
    switchTab('info');
  }

  function updateInstallBtn() {
    var p = current.plugin;
    var inst = state.installed.indexOf(p.id) >= 0;
    var btn = document.getElementById('pluginInstallBtn');
    btn.textContent = inst ? '卸载' : '安装';
    btn.className = inst ? 'btn btn-ghost' : 'btn btn-primary';
  }

  function install() {
    if (!current) return;
    var p = current.plugin;
    var inst = state.installed.indexOf(p.id) >= 0;
    var action = inst ? 'uninstall' : 'install';
    MN_API.post('/plugins/' + encodeURIComponent(p.id) + '/' + action, {}).then(function (r) {
      if (r.ok) {
        if (action === 'install') { if (state.installed.indexOf(p.id) < 0) state.installed.push(p.id); }
        else { state.installed = state.installed.filter(function (x) { return x !== p.id; }); }
        updateInstallBtn();
        render();
        toast((action === 'install' ? '已安装：' : '已卸载：') + p.name);
      } else if (r.status === 401) {
        toast('请先登录后再安装插件');
      } else if (r.status === 403 && r.data && r.data.error && r.data.error.message === 'PLUGIN_TIER_LOCKED') {
        toast('需要「' + (TIER_LABEL[p.minTier] || p.minTier) + '」才能安装，可前往升级');
      } else {
        toast('操作失败，请稍后再试');
      }
    });
  }

  // ── 上传弹窗（开发者模式）──
  function openUploadModal() {
    document.getElementById('uploadModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeUploadModal() {
    document.getElementById('uploadModal').style.display = 'none';
    document.body.style.overflow = '';
  }
  function toggleUploadPane(which) {
    document.getElementById('uploadFilesPane').style.display = (which === 'files' ? '' : 'none');
    document.getElementById('uploadGithubPane').style.display = (which === 'github' ? '' : 'none');
  }

  // ── 作者名片 ──
  function openAuthorModal(p) {
    var av = document.getElementById('authorModalAvatar');
    av.innerHTML = p.authorAvatar
      ? '<img src="' + p.authorAvatar + '" alt="">'
      : (p.authorName || '?').trim().charAt(0).toUpperCase();
    document.getElementById('authorModalName').textContent = p.authorName || '未知作者';
    document.getElementById('authorModalId').textContent = p.authorId || '';
    document.getElementById('authorModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeAuthorModal() {
    document.getElementById('authorModal').style.display = 'none';
    document.body.style.overflow = '';
  }

  function init() {
    var search = document.getElementById('pluginSearch');
    var cat = document.getElementById('pluginCategory');
    if (search) search.addEventListener('input', function (e) { state.q = e.target.value; render(); });
    if (cat) cat.addEventListener('change', function (e) { state.category = e.target.value; render(); });
    document.querySelectorAll('.plugin-modal-tabs button').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });
    var close = document.getElementById('pluginModalClose');
    if (close) close.addEventListener('click', closeModal);
    var modal = document.getElementById('pluginModal');
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    var installBtn = document.getElementById('pluginInstallBtn');
    if (installBtn) installBtn.addEventListener('click', install);

    // 开发者模式：显示上传按钮 + 上传弹窗
    var upBtn = document.getElementById('pluginUploadBtn');
    if (upBtn && isDeveloperMode()) upBtn.style.display = '';
    if (upBtn) upBtn.addEventListener('click', openUploadModal);
    var upClose = document.getElementById('uploadModalClose');
    if (upClose) upClose.addEventListener('click', closeUploadModal);
    var upModal = document.getElementById('uploadModal');
    if (upModal) upModal.addEventListener('click', function (e) { if (e.target === upModal) closeUploadModal(); });
    var upFiles = document.getElementById('uploadOptFiles');
    if (upFiles) upFiles.addEventListener('click', function () { toggleUploadPane('files'); });
    var upGh = document.getElementById('uploadOptGithub');
    if (upGh) upGh.addEventListener('click', function () { toggleUploadPane('github'); });

    // 作者名片
    var aClose = document.getElementById('authorModalClose');
    if (aClose) aClose.addEventListener('click', closeAuthorModal);
    var aModal = document.getElementById('authorModal');
    if (aModal) aModal.addEventListener('click', function (e) { if (e.target === aModal) closeAuthorModal(); });

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeUploadModal(); closeAuthorModal(); } });
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
