
  // --- Data ---
  var user = SlatiDB.getUser() || { displayName: 'Alex Rivera', citizenId: 'CIT-8842', avatarUrl: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=4648d4&color=fff&size=80' };
  var teams = SlatiDB.getTeams();
  var activeAccount = SlatiDB.getActiveAccount();
  var hasTeams = teams.length > 0;
  var activeTeam = (activeAccount !== 'personal') ? teams.find(function(t) { return t.id === activeAccount; }) : null;

  // --- Account selector ---
  document.getElementById('personalAvatar').src = user.avatarUrl || 'https://ui-avatars.com/api/?name=S&background=4648d4&color=fff&size=80';
  document.getElementById('personalName').textContent = user.displayName || 'Sovereign';
  document.getElementById('personalId').textContent = user.citizenId || 'CIT-0000';

  function renderTeamSection() {
    var teamWrap = document.getElementById('teamAccount');
    var teamContent = document.getElementById('teamContent');

    if (!hasTeams) {
      teamWrap.classList.remove('has-teams');
      document.getElementById('snapDots').style.display = 'none';
      teamContent.innerHTML =
        '<div class="no-teams-cta">' +
          '<span class="material-symbols-outlined" style="font-size:28px">group_add</span>' +
          '<span class="label-sm">Create Team</span>' +
        '</div>';
    } else {
      teamWrap.classList.add('has-teams');
      teamWrap.onclick = null;
      var selectedId = (activeAccount !== 'personal') ? activeAccount : teams[0].id;

      var cardsHTML = teams.map(function(t) {
        var sel = t.id === selectedId ? ' selected' : '';
        return '<div class="team-card-item' + sel + '" data-team-id="' + t.id + '" onclick="event.stopPropagation();selectAccount(\'' + t.id + '\')">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:' + t.color + ';color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0">' + t.avatar + '</div>' +
          '<div style="min-width:0;flex:1"><div style="font-weight:600;font-size:var(--fs-label-md);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + t.name + '</div><div class="label-sm" style="color:var(--color-outline)">' + t.role + ' · ' + t.members + ' members</div></div>' +
          '<span class="check-icon" style="margin-left:auto;flex-shrink:0">' + (t.id === selectedId ? '<span class="material-symbols-outlined" style="font-size:20px;color:var(--color-primary)">check_circle</span>' : '') + '</span>' +
        '</div>';
      }).join('');

      teamContent.innerHTML = '<div class="team-scroll" id="teamScroll" onscroll="updateSnapDots()">' + cardsHTML + '</div>';

      var dotsHTML = teams.map(function(t) {
        return '<span class="snap-dot' + (t.id === selectedId ? ' active-dot' : '') + '" data-dot-id="' + t.id + '"></span>';
      }).join('');
      var dotsEl = document.getElementById('snapDots');
      dotsEl.innerHTML = dotsHTML;
      dotsEl.style.display = 'flex';

      setTimeout(function() {
        var scrollEl = document.getElementById('teamScroll');
        var sel = scrollEl.querySelector('.team-card-item.selected');
        if (sel) scrollEl.scrollTop = sel.offsetTop - scrollEl.offsetTop;
        setupWheelHandler();
      }, 100);
    }
    updateAccountSizes();
  }

  // --- Custom wheel: scroll exactly one card per tick ---
  function setupWheelHandler() {
    var scrollEl = document.getElementById('teamScroll');
    if (!scrollEl) return;
    var ticking = false;
    scrollEl.addEventListener('wheel', function(e) {
      e.preventDefault();
      if (ticking) return;
      ticking = true;
      var cardHeight = scrollEl.offsetHeight;
      var dir = e.deltaY > 0 ? 1 : -1;
      var currentSnap = Math.round(scrollEl.scrollTop / cardHeight);
      var target = currentSnap + dir;
      target = Math.max(0, Math.min(target, teams.length - 1));
      scrollEl.scrollTo({ top: target * cardHeight, behavior: 'smooth' });
      setTimeout(function() { ticking = false; }, 400);
    }, { passive: false });
  }

  function updateSnapDots() {
    var scrollEl = document.getElementById('teamScroll');
    if (!scrollEl) return;
    var cards = scrollEl.querySelectorAll('.team-card-item');
    var mid = scrollEl.scrollTop + scrollEl.offsetHeight / 2;
    var closest = null, closestDist = Infinity;
    cards.forEach(function(c) {
      var d = Math.abs((c.offsetTop + c.offsetHeight / 2) - mid);
      if (d < closestDist) { closestDist = d; closest = c; }
    });
    if (closest) {
      var id = closest.dataset.teamId;
      document.querySelectorAll('#snapDots .snap-dot').forEach(function(d) { d.classList.toggle('active-dot', d.dataset.dotId === id); });
    }
  }

  function handleTeamGroupClick() {
    if (!hasTeams) toggleTeamSize();
  }

  function toggleTeamSize() {
    var personalEl = document.getElementById('personalAccount');
    var teamGroup = document.getElementById('teamGroup');
    var teamWrap = document.getElementById('teamAccount');
    var curFlex = parseInt(teamGroup.style.flex) || parseInt(teamWrap.style.flex) || 1;
    if (curFlex <= 1) { teamGroup.style.flex = '3'; teamWrap.style.flex = '1'; personalEl.style.flex = '1'; }
    else { teamGroup.style.flex = '1'; teamWrap.style.flex = '1'; personalEl.style.flex = '3'; }
  }

  function updateAccountSizes() {
    var personalEl = document.getElementById('personalAccount');
    var teamGroup = document.getElementById('teamGroup');
    var teamWrap = document.getElementById('teamAccount');
    if (activeAccount === 'personal') { personalEl.style.flex = '3'; teamGroup.style.flex = '1'; teamWrap.style.flex = '1'; }
    else { personalEl.style.flex = '1'; teamGroup.style.flex = '3'; teamWrap.style.flex = '1'; }
    personalEl.classList.toggle('active', activeAccount === 'personal');
    teamWrap.classList.toggle('active', activeAccount !== 'personal');
  }

  var prevAccount = 'personal';

  function selectAccount(id) {
    if (id === activeAccount) return;
    prevAccount = activeAccount;

    if (id !== 'personal') {
      activeTeam = teams.find(function(t) { return t.id === id; });
    } else { activeTeam = null; }
    activeAccount = id;
    SlatiDB.setActiveAccount(id);
    updateAccountSizes();

    // Update checkmarks inline without rebuilding scroll
    document.querySelectorAll('.team-card-item').forEach(function(card) {
      var tid = card.dataset.teamId;
      var checkEl = card.querySelector('.check-icon');
      if (tid === id) {
        card.classList.add('selected');
        if (checkEl) checkEl.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;color:var(--color-primary)">check_circle</span>';
      } else {
        card.classList.remove('selected');
        if (checkEl) checkEl.innerHTML = '';
      }
    });

    // Update snap dots
    document.querySelectorAll('#snapDots .snap-dot').forEach(function(d) {
      d.classList.toggle('active-dot', d.dataset.dotId === id);
    });

    // Direction: personal↔team = horizontal, team↔team = vertical by order
    var isPersonalSwitch = (prevAccount === 'personal' || id === 'personal');
    var exitVal, enterVal, axis;

    if (isPersonalSwitch) {
      // Horizontal: personal→team = left, team→personal = right
      var toTeam = (prevAccount === 'personal');
      exitVal = toTeam ? '-30px' : '30px';
      enterVal = toTeam ? '30px' : '-30px';
      axis = 'X';
    } else {
      // Vertical by team order: down the list → up, up the list → down
      var prevIdx = teams.findIndex(function(t) { return t.id === prevAccount; });
      var newIdx = teams.findIndex(function(t) { return t.id === id; });
      exitVal = newIdx > prevIdx ? '-24px' : '24px';
      enterVal = newIdx > prevIdx ? '24px' : '-24px';
      axis = 'Y';
    }

    var contentCards = document.querySelectorAll('#channelOverview, #quickStats, #contentTabs, #slideTrack');

    contentCards.forEach(function(el, i) {
      el.style.transition = 'opacity 0.2s ease, transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)';
      el.style.transitionDelay = (i * 0.03) + 's';
      el.style.opacity = '0';
      el.style.transform = 'translate' + axis + '(' + exitVal + ')';
    });

    setTimeout(function() {
      renderContent();
      var newCards = document.querySelectorAll('#channelOverview, #quickStats, #contentTabs, #slideTrack');
      newCards.forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translate' + axis + '(' + enterVal + ')';
        el.style.transition = 'none';
      });
      requestAnimationFrame(function() {
        newCards.forEach(function(el, i) {
          el.style.transition = 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)';
          el.style.transitionDelay = (i * 0.04) + 's';
          el.style.opacity = '1';
          el.style.transform = 'translateX(0) translateY(0)';
        });
      });
    }, 250);
  }

  // --- Content renderers ---
  function makeChannelCard(label, avatar, subtitle, stats, btnHtml) {
    return '<div class="flex-center gap-md" style="flex-wrap:wrap">' +
      '<div class="channel-avatar" style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:28px;flex-shrink:0">' + avatar + '</div>' +
      '<div style="flex:1;min-width:200px"><h1 class="headline-lg" style="margin-bottom:2px">' + label + '</h1><p class="body-md" style="color:var(--color-on-surface-variant)">' + subtitle + '</p>' +
        '<div style="display:flex;gap:16px;margin-top:8px;font-size:var(--fs-label-md);color:var(--color-on-surface-variant)">' + stats + '</div></div>' + btnHtml + '</div>';
  }

  function renderContent() {
    var isPersonal = activeAccount === 'personal';

    // Channel overview
    var label, avatar, subtitle, stats, btnHtml;
    if (isPersonal) {
      label = user.displayName || 'Sovereign';
      avatar = (user.displayName || 'S').charAt(0);
      subtitle = '@' + (user.displayName || 'Sovereign').replace(/\s+/g, '') + ' · Personal Studio · 6 articles · 12 media';
      stats = '<span><strong style="color:var(--color-on-surface)">2.4K</strong> Followers</span><span><strong style="color:var(--color-on-surface)">48.2K</strong> Total Views</span><span><strong style="color:var(--color-on-surface)">1.8K</strong> Interactions</span>';
      btnHtml = '<a href="fluidcanvas-editor.html" class="btn btn-outline btn-lg"><span class="material-symbols-outlined">add</span> New Article</a>';
    } else if (activeTeam) {
      label = activeTeam.name;
      avatar = activeTeam.avatar;
      subtitle = '@' + activeTeam.name.replace(/\s+/g, '') + ' · ' + activeTeam.role + ' · ' + activeTeam.members + ' members';
      stats = '<span><strong style="color:var(--color-on-surface)">' + (activeTeam.members * 320) + '</strong> Followers</span><span><strong style="color:var(--color-on-surface)">' + (activeTeam.members * 6200) + '</strong> Total Views</span><span><strong style="color:var(--color-on-surface)">' + (activeTeam.members * 240) + '</strong> Interactions</span>';
      btnHtml = '<a href="fluidcanvas-editor.html" class="btn btn-outline btn-lg"><span class="material-symbols-outlined">add</span> Team Article</a>';
    } else {
      label = 'FluidCanvas Studio'; avatar = 'FC'; subtitle = 'No team selected';
      stats = ''; btnHtml = '';
    }
    document.getElementById('channelOverview').innerHTML = makeChannelCard(label, avatar, subtitle, stats, btnHtml);

    // Stats row
    document.getElementById('quickStats').innerHTML =
      '<div class="card metric-card"><div class="metric-value" style="color:var(--color-primary)">' + (isPersonal ? '48.2K' : (activeTeam ? (activeTeam.members * 6.2).toFixed(1) + 'K' : '0')) + '</div><div class="metric-label">Total Views</div><div class="metric-change" style="color:#22c55e">↑ ' + (isPersonal ? '12.4' : (activeTeam ? '8.7' : '0')) + '%</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:var(--color-secondary)">' + (isPersonal ? '3,842' : (activeTeam ? activeTeam.members * 510 : '0')) + '</div><div class="metric-label">Bookmarks</div><div class="metric-change" style="color:#22c55e">↑ ' + (isPersonal ? '8.1' : '5.2') + '%</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:#16a34a">' + (isPersonal ? '1,256' : (activeTeam ? activeTeam.members * 170 : '0')) + '</div><div class="metric-label">Shares</div><div class="metric-change" style="color:#22c55e">↑ 21.7%</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:#ea580c">' + (isPersonal ? '892' : (activeTeam ? activeTeam.members * 120 : '0')) + '</div><div class="metric-label">New Followers</div><div class="metric-change" style="color:#dc2626">↓ 3.2%</div></div>';
    if (window.LG) LG.scan(document); // v0.2.9.0：动态 metric-card 挂液态玻璃

    // Content lists
    renderContentTables();
  }

  function renderContentTables() {
    var isPersonal = activeAccount === 'personal';
    var aLabel = isPersonal ? 'Your' : (activeTeam ? activeTeam.name : 'Team');
    var track = document.getElementById('slideTrack');

    var articleRows = [
      { name: 'The Founding Charter of Etheria', views: '12,420', bookmarks: '1,204', shares: '486', trend: '🥇 Top', trendClass: 'badge-warning' },
      { name: 'Aether Prime: A Smart Sovereign City', views: '15,630', bookmarks: '2,108', shares: '742', trend: 'Rising', trendClass: 'badge-success' },
      { name: 'Digital Rights & Citizenship Act', views: '8,920', bookmarks: '853', shares: '312', trend: 'Stable', trendClass: 'badge-primary' },
      { name: 'Economic Policy Whitepaper', views: '4,280', bookmarks: '645', shares: '198', trend: 'Stable', trendClass: 'badge-primary' },
    ];
    var mediaRows = [
      { name: 'Aether Prime — Drone Tour 4K', type: '🎬', views: '45.1K', likes: '8,920', bookmarks: '4,105', shares: '2,830' },
      { name: 'Etheria — Official Flag Reveal', type: '🖼️', views: '22.8K', likes: '3,421', bookmarks: '1,892', shares: '1,204' },
      { name: 'Governance Summit — Highlights', type: '🎬', views: '18.4K', likes: '4,210', bookmarks: '2,340', shares: '982' },
      { name: 'National Anthem — Recording', type: '🎵', views: '9,620', likes: '5,340', bookmarks: '3,210', shares: '1,540' },
    ];

    function makeArticlePanel(rows) {
      var hdr = '<div class="content-row" style="color:var(--color-outline);font-size:var(--fs-label-sm);font-weight:600;text-transform:uppercase;letter-spacing:0.03em"><span style="width:36px;text-align:center">#</span><span style="flex:1;min-width:140px">Article</span><span class="mini-stat">Views</span><span class="mini-stat">Bookmarks</span><span class="mini-stat">Shares</span><span class="mini-stat" style="width:80px">Trend</span></div>';
      var body = rows.map(function(r, i) {
        var rankColors = ['var(--color-primary)', 'var(--color-outline)', '#ea580c', 'var(--color-outline)'];
        return '<div class="content-row"><span style="width:36px;text-align:center;font-weight:800;font-size:var(--fs-body-md);color:' + rankColors[i] + '">' + (i + 1) + '</span><span style="flex:1;min-width:140px;font-weight:600">' + r.name + '</span><span class="mini-stat"><span style="font-weight:600">' + r.views + '</span><br><span style="font-size:11px;color:#22c55e">↑ ' + (Math.floor(Math.random() * 40 + 5)) + '%</span></span><span class="mini-stat"><span style="font-weight:600">' + r.bookmarks + '</span><br><span style="font-size:11px;color:#22c55e">↑ ' + (Math.floor(Math.random() * 30 + 3)) + '%</span></span><span class="mini-stat"><span style="font-weight:600">' + r.shares + '</span><br><span style="font-size:11px;color:#22c55e">↑ ' + (Math.floor(Math.random() * 50 + 5)) + '%</span></span><span class="mini-stat" style="width:80px"><span class="badge ' + r.trendClass + '">' + r.trend + '</span></span></div>';
      }).join('');
      return '<div class="card" style="padding:var(--space-md);width:100%;flex-shrink:0"><div class="flex-between" style="margin-bottom:var(--space-sm)"><h3 class="headline-md">Top Articles — ' + aLabel + '</h3><span class="label-sm" style="color:var(--color-outline)">Last 28 days</span></div>' + hdr + body + '</div>';
    }

    function makeMediaPanel(rows) {
      var hdr = '<div class="content-row" style="color:var(--color-outline);font-size:var(--fs-label-sm);font-weight:600;text-transform:uppercase;letter-spacing:0.03em"><span style="width:36px;text-align:center">#</span><span style="flex:1;min-width:160px">Media</span><span style="width:44px;text-align:center">Type</span><span class="mini-stat">Views</span><span class="mini-stat">Likes</span><span class="mini-stat">Bookmarks</span><span class="mini-stat">Shares</span></div>';
      var body = rows.map(function(r, i) {
        var rankColors = ['var(--color-primary)', 'var(--color-outline)', '#ea580c', 'var(--color-outline)'];
        return '<div class="content-row"><span style="width:36px;text-align:center;font-weight:800;font-size:var(--fs-body-md);color:' + rankColors[i] + '">' + (i + 1) + '</span><span style="flex:1;min-width:160px;font-weight:600">' + r.name + '</span><span style="width:44px;text-align:center">' + r.type + '</span><span class="mini-stat"><span style="font-weight:600">' + r.views + '</span><br><span style="font-size:11px;color:#22c55e">↑ ' + (Math.floor(Math.random() * 60 + 5)) + '%</span></span><span class="mini-stat"><span style="font-weight:600">' + r.likes + '</span><br><span style="font-size:11px;color:#22c55e">↑ ' + (Math.floor(Math.random() * 50 + 5)) + '%</span></span><span class="mini-stat"><span style="font-weight:600">' + r.bookmarks + '</span><br><span style="font-size:11px;color:#22c55e">↑ ' + (Math.floor(Math.random() * 35 + 3)) + '%</span></span><span class="mini-stat"><span style="font-weight:600">' + r.shares + '</span><br><span style="font-size:11px;color:#22c55e">↑ ' + (Math.floor(Math.random() * 70 + 5)) + '%</span></span></div>';
      }).join('');
      return '<div class="card" style="padding:var(--space-md);width:100%;flex-shrink:0"><div class="flex-between" style="margin-bottom:var(--space-sm)"><h3 class="headline-md">Top Media — ' + aLabel + '</h3><span class="label-sm" style="color:var(--color-outline)">Last 28 days</span></div>' + hdr + body + '</div>';
    }

    track.innerHTML = makeArticlePanel(articleRows) + makeMediaPanel(mediaRows);

    // Reset opacity + slide state
    var panels = track.querySelectorAll('.card');
    panels.forEach(function(p, i) { p.style.opacity = i === 0 ? '1' : '0.3'; p.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)'; });
    track.style.transform = 'translateX(0)';

    if (window.SlatiTilt) SlatiTilt.init(document.querySelectorAll('.tilt-container'));
    if (window.LG) LG.scan(document); // v0.2.9.0：动态面板卡挂液态玻璃
  }

  // --- Dashboard content sub-tabs (tab state lives in URL) ---
  var currentPanel = 0;
  function setContentTab(tab, push) {
    if (tab !== 'articles' && tab !== 'media') tab = 'articles';
    var pills = document.getElementById('contentTabs').querySelectorAll('.subnav-pill');
    for (var i = 0; i < pills.length; i++) pills[i].classList.toggle('active', pills[i].dataset.tab === tab);
    var targetPanel = tab === 'articles' ? 0 : 1;
    var track = document.getElementById('slideTrack');
    var panels = track.querySelectorAll('.card');
    if (targetPanel !== currentPanel && panels.length) {
      panels[currentPanel].style.opacity = '0.3';
      panels[targetPanel].style.opacity = '1';
      currentPanel = targetPanel;
      track.style.transform = 'translateX(' + (-targetPanel * 100) + '%)';
    }
    viewState.tab = tab;
    if (push) window.FC_URL.push();
  }
  document.getElementById('contentTabs').addEventListener('click', function(e) {
    if (!e.target.classList.contains('subnav-pill')) return;
    setContentTab(e.target.dataset.tab, true);
  });

  // --- Left nav view switching (Douyin-style: URL is the state) ---
  var currentView = 'dashboard';
  document.querySelectorAll('.tilt-container .nav-item[data-view]').forEach(function(item) {
    item.addEventListener('click', function(e) {
      // middle/ctrl/shift/alt-click → let the browser open the real href (new tab etc.)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      var view = this.dataset.view;
      syncNavActive(view);
      if (view === currentView) { restoreSubState(view); return; }
      if (switchView(view)) {
        try { history.pushState(null, '', buildURL(view)); } catch (err) {}
      }
    });
  });

  // Prevent overlapping switches (instant switches bypass the lock to take over crossfades)
  var _switchLock = false;
  var _switchTimer = null;

  function switchView(view, instant) {
    if (_switchLock && !instant) return false;
    var VIEW_EL = {
      dashboard: document.getElementById('dashboardView'),
      upload: document.getElementById('uploadView'),
      content: document.getElementById('contentView'),
      analytics: document.getElementById('analyticsView'),
      articles: document.getElementById('articlesView')
    };
    var oldViewName = currentView;
    if (oldViewName === view) return false;
    var oldEl = VIEW_EL[oldViewName] || VIEW_EL.dashboard;
    var newEl = VIEW_EL[view] || VIEW_EL.dashboard;

    function resetInline(el) {
      if (el.style.opacity === '0') el.style.opacity = '';
      if (el.style.transform && (el.style.transform.indexOf('translateY(0') !== -1 || el.style.transform.indexOf('translateY(6') !== -1)) el.style.transform = '';
    }

    function initNewView() {
      if (view === 'upload') {
        try { if (!window._uploadInitialized) { initUpload(); window._uploadInitialized = true; } } catch(e) {}
      } else if (view === 'content') {
        try { if (!window._contentLibInitialized) { initContentLib(); window._contentLibInitialized = true; } else { renderCLStats(); renderCLList(); } } catch(e) {}
      } else if (view === 'analytics') {
        try { window.FC_ANALYTICS.render(); } catch(e) {}      // re-render every entry → account switches propagate
      } else if (view === 'articles') {
        try { window.FC_ARTICLES.init(); } catch(e) {}          // renders always
      }
    }

    function finish() {
      oldEl.style.display = 'none';
      oldEl.classList.remove('active');
      oldEl.style.transition = '';
      oldEl.style.opacity = '';
      oldEl.style.transform = '';
      currentView = view;
      _switchLock = false;
    }

    if (instant) {
      if (_switchTimer) { clearTimeout(_switchTimer); _switchTimer = null; }  // cancel in-flight crossfade cleanup
      _switchLock = false;
      oldEl.style.display = 'none';
      oldEl.classList.remove('active');
      oldEl.style.transition = '';
      oldEl.style.opacity = '';
      oldEl.style.transform = '';
      newEl.style.display = 'block';
      newEl.style.transition = 'none';
      newEl.style.opacity = '1';
      newEl.style.transform = 'translateY(0)';
      resetInline(newEl);
      var ikids = newEl.querySelectorAll('[style]');
      for (var ik = 0; ik < ikids.length; ik++) resetInline(ikids[ik]);
      newEl.classList.add('active');
      initNewView();
      currentView = view;
      return true;
    }

    _switchLock = true;

    // ── Overlapping crossfade ──
    // Show new view BEHIND old view immediately at opacity:0
    newEl.style.display = 'block';
    newEl.style.opacity = '0';
    newEl.style.transform = 'translateY(8px)';
    newEl.style.transition = 'none';
    resetInline(newEl);
    var kids = newEl.querySelectorAll('[style]');
    for (var k = 0; k < kids.length; k++) resetInline(kids[k]);
    newEl.offsetHeight; // force reflow

    // Fade out old view
    oldEl.style.transition = 'opacity 0.15s ease';
    oldEl.style.opacity = '0';

    // Fade in new view simultaneously (starts behind old, revealed as old fades)
    newEl.style.transition = 'opacity 0.2s ease, transform 0.25s ease';
    newEl.style.opacity = '1';
    newEl.style.transform = 'translateY(0)';
    newEl.classList.add('active');
    initNewView();

    // After old fully hidden, clean up
    _switchTimer = setTimeout(finish, 200);
    return true;
  }  // (initial view now bootstrapped by initURLSync() at script end — legacy #hash also handled there)
  // Upload Module
  // ═══════════════════════════════════════════
  var PUBLISH_TARGETS = [
    { id: 'article',   icon: 'article',        title: 'Article',        desc: 'Public-facing content visible to all citizens' },
    { id: 'sovereign', icon: 'edit_note',      title: 'Sovereign Log',  desc: 'Internal nation records and official documentation' },
    { id: 'community', icon: 'forum',          title: 'Community Post', desc: 'Appears in the Community Hub feed' }
  ];

  var FILE_ICONS = {
    '.png':'image','.jpg':'image','.jpeg':'image','.gif':'image','.svg':'image','.webp':'image',
    '.pdf':'picture_as_pdf','.doc':'description','.docx':'description','.txt':'description','.md':'description',
    '.zip':'folder_zip','.rar':'folder_zip','.7z':'folder_zip','.mp4':'movie','.mp3':'headphones','.mov':'movie'
  };

  var SIMULATED_FILES = [
    'micronation_constitution_v3.pdf','national_flag_design_final.png','trade_agreement_draft.docx',
    'sovereign_decree_0042.txt','community_announcement_template.md','territory_map_2026.jpg',
    'diplomatic_correspondence.zip','wiki_knowledge_base_export.json'
  ];

  var recentUploads = [
    { file:'Etheria_Annual_Report_2025.pdf',        target:'article',   targetLabel:'Article',        time:'2 hours ago', status:'Published' },
    { file:'Aethelgard_Treaty_Protocol_v2.docx',    target:'article',   targetLabel:'Article',        time:'5 hours ago', status:'Published' },
    { file:'National_Crest_Final.svg',              target:'community', targetLabel:'Community Post',  time:'1 day ago',   status:'Published' },
    { file:'Neo_Venice_Infrastructure_Plan.pdf',     target:'wiki',      targetLabel:'Wiki Entry',     time:'2 days ago',  status:'Published' },
    { file:'Governance_Policy_Update_2026.txt',      target:'sovereign', targetLabel:'Sovereign Log',  time:'3 days ago',  status:'Published' },
  ];

  var currentFile = null;
  var currentTarget = null;

  function getExtension(filename) {
    var dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.substring(dot).toLowerCase() : '';
  }
  function getFileIcon(filename) { return FILE_ICONS[getExtension(filename)] || 'insert_drive_file'; }
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function simulateFilePick() {
    var name = SIMULATED_FILES[Math.floor(Math.random() * SIMULATED_FILES.length)];
    setFile({ name: name, size: Math.floor(Math.random() * 8000000) + 24000 });
  }

  function setFile(file) {
    currentFile = file;
    var bar = document.getElementById('fileInfoBar');
    bar.style.display = 'flex';
    bar.style.animation = 'none'; bar.offsetHeight; bar.style.animation = 'fadeInDown 0.25s ease';
    document.getElementById('fileInfoIcon').textContent = getFileIcon(file.name);
    document.getElementById('fileInfoName').textContent = file.name;
    document.getElementById('fileInfoSize').textContent = formatSize(file.size);
    updatePublishButton();
  }

  function removeFile() {
    currentFile = null;
    document.getElementById('fileInfoBar').style.display = 'none';
    updatePublishButton();
  }

  function renderTargets() {
    document.getElementById('targetGrid').innerHTML = PUBLISH_TARGETS.map(function(t) {
      return '<div class="target-card" data-target="' + t.id + '">' +
        '<span class="material-symbols-outlined target-icon">' + t.icon + '</span>' +
        '<div class="target-title">' + t.title + '</div>' +
        '<div class="target-desc">' + t.desc + '</div></div>';
    }).join('');
  }

  function selectTarget(id) {
    currentTarget = id;
    document.querySelectorAll('#uploadView .target-card').forEach(function(c) {
      c.classList.toggle('selected', c.dataset.target === id);
    });
    updatePublishButton();
  }

  function updatePublishButton() {
    var btn = document.getElementById('publishBtn');
    if (btn) btn.disabled = !(currentFile && currentTarget);
  }

  var toastTimer = null;
  function showToast(msg, icon) {
    var el = document.getElementById('toast');
    el.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">' + (icon || 'check_circle') + '</span>' + msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { el.classList.remove('show'); }, 2800);
  }

  function renderRecentUploads() {
    var list = document.getElementById('recentList');
    if (!list) return;
    list.innerHTML = recentUploads.map(function(item) {
      var icon = getFileIcon(item.file);
      return '<div class="recent-item">' +
        '<span class="material-symbols-outlined recent-file-icon">' + icon + '</span>' +
        '<span class="recent-file-name" title="' + item.file + '">' + item.file + '</span>' +
        '<span class="recent-target-badge">' + item.targetLabel + '</span>' +
        '<span class="recent-time">' + item.time + '</span>' +
        '<span class="recent-status">' + item.status + '</span></div>';
    }).join('');
  }

  function addToRecent(file, targetId) {
    var info = PUBLISH_TARGETS.find(function(t) { return t.id === targetId; });
    recentUploads.unshift({
      file: file.name, target: targetId, targetLabel: info ? info.title : targetId,
      time: 'Just now', status: 'Published'
    });
    if (recentUploads.length > 15) recentUploads.pop();
    renderRecentUploads();
  }

  function publish() {
    if (!currentFile || !currentTarget) return;
    var info = PUBLISH_TARGETS.find(function(t) { return t.id === currentTarget; });
    addToRecent(currentFile, currentTarget);
    showToast('Published to ' + (info ? info.title : currentTarget) + '!', 'check_circle');
    removeFile();
    currentTarget = null;
    document.querySelectorAll('#uploadView .target-card').forEach(function(c) { c.classList.remove('selected'); });
    updatePublishButton();
  }

  function initUpload() {
    renderTargets();
    renderRecentUploads();

    document.getElementById('uploadZone').addEventListener('click', simulateFilePick);
    var zone = document.getElementById('uploadZone');
    zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', function(e) { e.preventDefault(); zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', function(e) {
      e.preventDefault(); zone.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        var f = e.dataTransfer.files[0];
        setFile({ name: f.name, size: f.size });
      } else { simulateFilePick(); }
    });

    document.getElementById('fileRemoveBtn').addEventListener('click', removeFile);

    document.getElementById('targetGrid').addEventListener('click', function(e) {
      var card = e.target.closest('.target-card');
      if (!card) return;
      selectTarget(card.dataset.target);
    });

    document.getElementById('publishBtn').addEventListener('click', publish);

    document.getElementById('uploadView').addEventListener('click', function(e) {
      if (e.target.closest('.target-card')) return;
    });
  }

  // ═══════════════════════════════════════════
  // Content Library Module
  // ═══════════════════════════════════════════
  var contentLibrary = [
    { id:'CL-001', title:'The Founding Charter of Etheria',         type:'article',   author:'Alex Rivera',             date:'2026-08-05', views:12420, bookmarks:1204, status:'Published' },
    { id:'CL-002', title:'Aether Prime: A Smart Sovereign City',    type:'article',   author:'Alex Rivera',             date:'2026-08-02', views:15630, bookmarks:2108, status:'Published' },
    { id:'CL-003', title:'Digital Rights & Citizenship Act',        type:'article',   author:'Alex Rivera',             date:'2026-07-28', views:8920,  bookmarks:853,  status:'Published' },
    { id:'CL-004', title:'Economic Policy Whitepaper v2',           type:'article',   author:'Alex Rivera',             date:'2026-07-20', views:4280,  bookmarks:645,  status:'Draft' },
    { id:'CL-005', title:'Etheria Annual Report 2025',              type:'article',   author:'Alex Rivera',             date:'2026-08-07', views:3200,  bookmarks:410,  status:'Published' },
    { id:'CL-006', title:'Aethelgard Treaty Protocol v2',           type:'article',   author:'Etheria Editorial Board',  date:'2026-08-07', views:1800,  bookmarks:230,  status:'Published' },
    { id:'CL-007', title:'Sovereign Decree No. 0042 — Trade Routes',type:'sovereign', author:'Alex Rivera',             date:'2026-08-06', views:890,   bookmarks:120,  status:'Published' },
    { id:'CL-008', title:'Governance Policy Update 2026',           type:'sovereign', author:'Alex Rivera',             date:'2026-08-04', views:1560,  bookmarks:340,  status:'Published' },
    { id:'CL-009', title:'Cabinet Meeting Minutes — August',        type:'sovereign', author:'Alex Rivera',             date:'2026-08-03', views:430,   bookmarks:56,   status:'Draft' },
    { id:'CL-010', title:'National Crest Vector Assets',            type:'community', subtype:'images', author:'Alex Rivera',             date:'2026-08-06', views:2100,  bookmarks:560,  status:'Published' },
    { id:'CL-011', title:'Citizenship Application Guide',           type:'community', subtype:'post',   author:'Cartography Guild',       date:'2026-08-01', views:3400,  bookmarks:890,  status:'Published' },
    { id:'CL-012', title:'Community Event: Founding Day Festival',  type:'community', subtype:'post',   author:'Alex Rivera',             date:'2026-07-30', views:5600,  bookmarks:1200, status:'Published' },
    { id:'CL-013', title:'Aether Prime — Drone Tour 4K',            type:'community', subtype:'video',  author:'Alex Rivera',             date:'2026-08-04', views:45100, bookmarks:4105, status:'Published' },
    { id:'CL-014', title:'Etheria — Official Flag Reveal',          type:'community', subtype:'images', author:'Alex Rivera',             date:'2026-08-03', views:22800, bookmarks:1892, status:'Published' },
    { id:'CL-015', title:'Governance Summit — Highlights Reel',     type:'community', subtype:'video',  author:'Cartography Guild',       date:'2026-07-28', views:18400, bookmarks:2340, status:'Published' },
    { id:'CL-016', title:'National Anthem — Studio Recording',      type:'community', subtype:'video',  author:'Alex Rivera',             date:'2026-07-25', views:9620,  bookmarks:3210, status:'Published' },
    { id:'CL-017', title:'Territory Map — High Resolution',         type:'community', subtype:'images', author:'Cartography Guild',       date:'2026-07-20', views:8700,  bookmarks:1540, status:'Published' },
    { id:'CL-018', title:'Weekly Community Digest #42',             type:'community', subtype:'post',   author:'Alex Rivera',             date:'2026-08-07', views:1200,  bookmarks:180,  status:'Published' },
  ];

  var TYPE_META = {
    article:   { icon:'article',   color:'var(--color-primary)', bg:'color-mix(in srgb, var(--color-primary) 8%, transparent)',   label:'Article' },
    sovereign: { icon:'edit_note', color:'#ea580c', bg:'rgba(234,88,12,0.08)',   label:'Sovereign Log' },
    community: { icon:'forum',     color:'#16a34a', bg:'rgba(22,163,74,0.08)',   label:'Community Post' },
  };

  var SUBTYPE_META = {
    post:   { icon:'forum',     label:'Post' },
    images: { icon:'image',     label:'Images' },
    video:  { icon:'smart_display', label:'Video' },
  };

  var clFilter = 'all';
  var clSubFilter = 'all';
  var clSearchTerm = '';

  function renderCLStats() {
    var total = contentLibrary.length;
    var articles = contentLibrary.filter(function(c){ return c.type==='article'; }).length;
    var sovereigns = contentLibrary.filter(function(c){ return c.type==='sovereign'; }).length;
    var communities = contentLibrary.filter(function(c){ return c.type==='community'; }).length;
    var posts = contentLibrary.filter(function(c){ return c.subtype==='post'; }).length;
    var images = contentLibrary.filter(function(c){ return c.subtype==='images'; }).length;
    var videos = contentLibrary.filter(function(c){ return c.subtype==='video'; }).length;
    document.getElementById('clStats').innerHTML =
      '<div class="card metric-card"><div class="metric-value" style="color:var(--color-primary)">' + total + '</div><div class="metric-label">Total Items</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:var(--color-primary)">' + articles + '</div><div class="metric-label">Articles</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:#ea580c">' + sovereigns + '</div><div class="metric-label">Sovereign Logs</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:#16a34a">' + communities + '</div><div class="metric-label">Community Posts</div></div>';
    if (window.LG) LG.scan(document); // v0.2.9.0：动态 metric-card 挂液态玻璃
  }

  function renderCLList() {
    var list = document.getElementById('clList');
    // Filter
    var items = contentLibrary;
    if (clFilter !== 'all') {
      items = items.filter(function(c){ return c.type === clFilter; });
    }
    // Sub-filter for community posts
    if (clFilter === 'community' && clSubFilter !== 'all') {
      items = items.filter(function(c){ return c.subtype === clSubFilter; });
    }
    if (clSearchTerm) {
      var term = clSearchTerm.toLowerCase();
      items = items.filter(function(c){ return c.title.toLowerCase().indexOf(term) !== -1 || c.author.toLowerCase().indexOf(term) !== -1; });
    }

    if (items.length === 0) {
      list.innerHTML = '<div class="cl-empty"><span class="material-symbols-outlined cl-empty-icon">inventory_2</span><p style="font-weight:600;margin-bottom:4px">No content found</p><p style="font-size:12px">Try adjusting your filters or create new content</p></div>';
      return;
    }

    list.innerHTML = items.map(function(c) {
      var meta = TYPE_META[c.type] || TYPE_META.article;
      var statusClass = c.status === 'Draft' ? 'style="background:rgba(234,179,8,0.1);color:#b45309"' : 'style="background:rgba(22,163,74,0.08);color:#16a34a"';
      var subtypeHTML = '';
      if (c.type === 'community' && c.subtype) {
        var sub = SUBTYPE_META[c.subtype];
        if (sub) subtypeHTML = '<span class="cl-badge" style="background:' + meta.bg + ';color:' + meta.color + ';margin-right:4px"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle">' + sub.icon + '</span> ' + sub.label + '</span>';
      }
      return '<div class="content-lib-card">' +
        '<div class="cl-type-icon" style="background:' + meta.bg + ';color:' + meta.color + '">' +
          '<span class="material-symbols-outlined" style="font-size:20px">' + meta.icon + '</span>' +
        '</div>' +
        '<div class="cl-info">' +
          '<div class="cl-title">' + c.title + '</div>' +
          '<div class="cl-meta">' +
            '<span>' + c.author + '</span>' +
            '<span>' + c.date + '</span>' +
            '<span>' + c.views.toLocaleString() + ' views</span>' +
            '<span>' + c.bookmarks.toLocaleString() + ' bookmarks</span>' +
          '</div>' +
        '</div>' +
        subtypeHTML +
        '<span class="cl-badge ' + c.type + '">' + meta.label + '</span>' +
        '<span class="cl-badge" ' + statusClass + '>' + c.status + '</span>' +
        '<div class="cl-actions">' +
          '<button class="cl-action-btn" title="Edit"><span class="material-symbols-outlined" style="font-size:16px">edit</span></button>' +
          '<button class="cl-action-btn" title="View"><span class="material-symbols-outlined" style="font-size:16px">visibility</span></button>' +
          '<button class="cl-action-btn danger" title="Delete"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function initContentLib() {
    renderCLStats();
    renderCLList();

    // Primary filter pills
    document.getElementById('clFilterPills').addEventListener('click', function(e) {
      var btn = e.target.closest('.subnav-pill');
      if (!btn) return;
      clFilter = btn.dataset.filter;
      clSubFilter = 'all';
      // Show/hide secondary subnav for community posts
      var subFilter = document.getElementById('clSubFilter');
      if (clFilter === 'community') {
        subFilter.style.opacity = '1';
        subFilter.style.pointerEvents = 'auto';
        subFilter.querySelectorAll('.subnav-pill').forEach(function(p) { p.classList.remove('active'); });
        subFilter.querySelector('[data-subfilter="all"]').classList.add('active');
        // Trigger slider recalculation after layout
        setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 50);
      } else {
        subFilter.style.opacity = '0.4';
        subFilter.style.pointerEvents = 'none';
      }
      renderCLList();
    });

    // Secondary sub-filter (community subtypes)
    document.getElementById('clSubFilter').addEventListener('click', function(e) {
      var btn = e.target.closest('.subnav-pill');
      if (!btn) return;
      clSubFilter = btn.dataset.subfilter;
      renderCLList();
    });

    // Search
    var searchTimer;
    document.getElementById('clSearch').addEventListener('input', function() {
      clearTimeout(searchTimer);
      var self = this;
      searchTimer = setTimeout(function() {
        clSearchTerm = self.value.trim();
        renderCLList();
      }, 250);
    });
  }

  // --- Hook publish to also add to content library ---
  var _origPublish = publish;
  publish = function() {
    if (!currentFile || !currentTarget) return;
    var info = PUBLISH_TARGETS.find(function(t) { return t.id === currentTarget; });
    // Also add to content library
    contentLibrary.unshift({
      id: 'CL-' + Date.now(),
      title: currentFile.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/\b\w/g, function(l){ return l.toUpperCase(); }),
      type: currentTarget,
      author: (activeAccount === 'personal' ? (user.displayName || 'Alex Rivera') : (activeTeam ? activeTeam.name : 'Unknown')),
      date: new Date().toISOString().split('T')[0],
      views: 0, bookmarks: 0,
      status: 'Published'
    });
    if (currentView === 'content') { renderCLStats(); renderCLList(); }
    _origPublish();
  };

  // --- Init ---
  renderTeamSection();
  renderContent();
  // ═══════════════════════════════════════════════════════════
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
    window.location.search.replace(/^\?/, '').split('&').forEach(function(pair) {
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

  window.FC_ANALYTICS = (function() {
    'use strict';
    var currentPeriod = '28d';
    var detailPanel = 0;

  // --- Sparkline helper ---
  function makeSparkline(values, color) {
    var max = Math.max.apply(null, values);
    return '<div class="sparkline">' + values.map(function(v) { return '<div class="sparkline-bar" style="height:' + Math.max(3, (v/max)*100) + '%;background:' + (color||'var(--color-primary)') + '"></div>'; }).join('') + '</div>';
  }

  // --- Content render ---
  function renderAnalyticsContent() {
    var isPersonal = activeAccount === 'personal';
    var aLabel = isPersonal ? (user.displayName || 'Personal') : (activeTeam ? activeTeam.name : 'Team');
    var mult = isPersonal ? 1 : (activeTeam ? activeTeam.members : 1);

    document.getElementById('analyticsTitle').textContent = aLabel + ' — Content Analytics';

    // Overview cards — data differs per period
    var pData = {
      '7d':  { views: 12.4, bm: 1240, shares: 420, readMin: 3.8, viewsPct: 5.2, bmPct: 3.1, sharesPct: 8.4, readPct: -1.2 },
      '28d': { views: 48.2, bm: 3842, shares: 1256, readMin: 4.2, viewsPct: 12.4, bmPct: 8.1, sharesPct: 21.7, readPct: -3.2 },
      'month':{ views: 195.0, bm: 15200, shares: 5100, readMin: 4.5, viewsPct: 14.3, bmPct: 9.8, sharesPct: 18.2, readPct: -1.8 },
    };
    var pd = pData[currentPeriod] || pData['28d'];
    var periodLabel = currentPeriod === '7d' ? 'Last 7 days' : currentPeriod === '28d' ? 'Last 28 days' : 'vs Last Month';
    var vc = pd.viewsPct >= 0 ? '↑ ' : '↓ ';
    var rc = pd.readPct >= 0 ? '↑ ' : '↓ ';
    document.getElementById('overviewCards').innerHTML =
      '<div class="card metric-card"><div class="metric-value" style="color:var(--color-primary)">' + (pd.views * mult).toFixed(1) + 'K</div><div class="metric-label">Total Views</div><div class="metric-change" style="color:' + (pd.viewsPct>=0?'#22c55e':'#dc2626') + '">' + vc + Math.abs(pd.viewsPct).toFixed(1) + '% ' + periodLabel + '</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:var(--color-secondary)">' + Math.round(pd.bm * mult).toLocaleString() + '</div><div class="metric-label">Total Bookmarks</div><div class="metric-change" style="color:' + (pd.bmPct>=0?'#22c55e':'#dc2626') + '">' + (pd.bmPct>=0?'↑ ':'↓ ') + Math.abs(pd.bmPct).toFixed(1) + '% ' + periodLabel + '</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:#16a34a">' + Math.round(pd.shares * mult).toLocaleString() + '</div><div class="metric-label">Total Shares</div><div class="metric-change" style="color:' + (pd.sharesPct>=0?'#22c55e':'#dc2626') + '">' + (pd.sharesPct>=0?'↑ ':'↓ ') + Math.abs(pd.sharesPct).toFixed(1) + '% ' + periodLabel + '</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:#ea580c">' + (pd.readMin * mult).toFixed(1) + ' min</div><div class="metric-label">Avg. Read Time</div><div class="metric-change" style="color:' + (pd.readPct>=0?'#22c55e':'#dc2626') + '">' + rc + Math.abs(pd.readPct).toFixed(1) + '% ' + periodLabel + '</div></div>';

    // Channel summary — data per period
    var sData = {
      '7d':  { reach: 12.4, pct:'+5.2%', viewsMax:18, bm:1.2, bmMax:2, shares:0.42, sharesMax:0.8, trend:[3,5,4,7,6,9,8,12], prev:[2,4,3,6,5,8,7,10] },
      '28d': { reach: 52, pct:'+14.3%', viewsMax:70, bm:3.8, bmMax:5, shares:1.3, sharesMax:2, trend:[12,18,15,22,19,28,35,30,38,42,36,48,45,52], prev:[8,14,12,20,16,24,32,26,34,40,32,44,42,48] },
      'month':{ reach: 195, pct:'+11.8%', viewsMax:260, bm:15.2, bmMax:20, shares:5.1, sharesMax:7, trend:[45,52,48,58,55,62,68,72,65,78,82,88,92,95], prev:[40,46,42,52,50,56,60,64,58,70,74,78,80,85] },
    };
    var sd = sData[currentPeriod] || sData['28d'];
    document.getElementById('channelSummary').innerHTML =
      '<div style="display:flex;align-items:center;gap:var(--space-lg);flex-wrap:wrap">' +
        '<div style="flex:1;min-width:240px">' +
          '<span class="badge badge-primary" style="margin-bottom:8px">' + periodLabel + '</span>' +
          '<h2 class="headline-md" style="margin-bottom:4px">Performance Overview</h2>' +
          '<p class="body-md" style="color:var(--color-on-surface-variant);margin-bottom:12px">' +
            'Total content reach: <strong style="color:var(--color-on-surface)">' + (sd.reach * mult).toFixed(1) + 'K</strong> views · ' +
            '<strong style="color:#22c55e">' + sd.pct + '</strong> vs previous period' +
          '</p>' +
          '<div class="compare-bar" style="margin-bottom:4px"><span class="label-sm" style="width:60px">Views</span><div style="flex:1;background:rgba(118,117,134,0.1);border-radius:3px;height:6px"><div class="compare-bar-fill" style="width:' + (sd.reach/sd.viewsMax*100) + '%;background:var(--color-primary)"></div></div><span class="label-sm" style="width:40px;text-align:right">' + (sd.reach*mult).toFixed(1) + 'K</span></div>' +
          '<div class="compare-bar" style="margin-bottom:4px"><span class="label-sm" style="width:60px">Bookmarks</span><div style="flex:1;background:rgba(118,117,134,0.1);border-radius:3px;height:6px"><div class="compare-bar-fill" style="width:' + (sd.bm/sd.bmMax*100) + '%;background:var(--color-secondary)"></div></div><span class="label-sm" style="width:40px;text-align:right">' + (sd.bm*mult).toFixed(1) + 'K</span></div>' +
          '<div class="compare-bar"><span class="label-sm" style="width:60px">Shares</span><div style="flex:1;background:rgba(118,117,134,0.1);border-radius:3px;height:6px"><div class="compare-bar-fill" style="width:' + (sd.shares/sd.sharesMax*100) + '%;background:#16a34a"></div></div><span class="label-sm" style="width:40px;text-align:right">' + (sd.shares*mult).toFixed(1) + 'K</span></div>' +
        '</div>' +
        '<div style="text-align:center;min-width:160px">' +
          '<div style="margin-bottom:4px" class="label-sm">View Trend (' + (currentPeriod==='7d'?'7':'14') + ' days)</div>' +
          makeSparkline(sd.trend.map(function(v){return v*mult;}), 'var(--color-primary)') +
          '<div style="margin-top:8px" class="label-sm">Previous period</div>' +
          '<div style="margin-top:4px">' + makeSparkline(sd.prev.map(function(v){return v*mult;}), 'var(--color-outline-variant)') + '</div>' +
        '</div>' +
      '</div>';

    if (window.LG) LG.scan(document); // v0.2.45.0：动态 metric-card 挂液态玻璃（对齐主页 L2729/L3126 模式）
    // Detail panels
    renderDetailPanels();
  }

  function renderDetailPanels() {
    var isPersonal = activeAccount === 'personal';
    var aLabel = isPersonal ? (user.displayName || 'Personal') : (activeTeam ? activeTeam.name : 'Team');
    var track = document.getElementById('detailSlide');

    // Article analytics with week-over-week and month-over-month comparison
    var articles = [
      { name:'The Founding Charter of Etheria', viewsNow:12420, viewsPrev:10520, bmNow:1204, bmPrev:1080, sharesNow:486, sharesPrev:392, readMin:8.2, readPrev:7.8, trend:[8,10,9,14,12,18,15,20] },
      { name:'Aether Prime: Smart Sovereign City', viewsNow:15630, viewsPrev:11840, bmNow:2108, bmPrev:1650, sharesNow:742, sharesPrev:530, readMin:12.5, readPrev:11.2, trend:[12,15,13,18,16,22,20,28] },
      { name:'Digital Rights & Citizenship Act', viewsNow:8920, viewsPrev:8340, bmNow:853, bmPrev:810, sharesNow:312, sharesPrev:322, readMin:5.8, readPrev:6.1, trend:[7,8,7,9,10,9,8,10] },
      { name:'Economic Policy Whitepaper', viewsNow:4280, viewsPrev:3920, bmNow:645, bmPrev:550, sharesNow:198, sharesPrev:210, readMin:3.4, readPrev:3.8, trend:[5,4,5,6,5,7,6,5] },
    ];

    function pct(a,b) { var p=((a-b)/b*100); return (p>=0?'↑ ':'↓ ')+Math.abs(p).toFixed(1)+'%'; }
    function color(a,b) { return a>=b?'#22c55e':'#dc2626'; }

    var articleHTML = '<div class="card" style="padding:var(--space-md);width:100%;flex-shrink:0"><div class="flex-between" style="margin-bottom:var(--space-sm)"><h3 class="headline-md">Article Performance — ' + aLabel + '</h3><span class="label-sm" style="color:var(--color-outline)">Current vs Last Month</span></div>' +
      '<div class="content-row" style="color:var(--color-outline);font-size:var(--fs-label-sm);font-weight:600;text-transform:uppercase"><span style="flex:1;min-width:160px">Article</span><span class="mini-stat">Views</span><span class="mini-stat">vs Prev</span><span class="mini-stat">Bookmarks</span><span class="mini-stat">vs Prev</span><span class="mini-stat">Shares</span><span class="mini-stat">Read Time</span><span style="width:80px">Trend</span></div>' +
      articles.map(function(a,i) { return '<div class="content-row"><span style="flex:1;min-width:160px;font-weight:600">'+a.name+'</span>' +
        '<span class="mini-stat"><span style="font-weight:600">'+a.viewsNow.toLocaleString()+'</span></span>' +
        '<span class="mini-stat"><span style="font-size:11px;color:'+color(a.viewsNow,a.viewsPrev)+'">'+pct(a.viewsNow,a.viewsPrev)+'</span></span>' +
        '<span class="mini-stat"><span style="font-weight:600">'+a.bmNow.toLocaleString()+'</span></span>' +
        '<span class="mini-stat"><span style="font-size:11px;color:'+color(a.bmNow,a.bmPrev)+'">'+pct(a.bmNow,a.bmPrev)+'</span></span>' +
        '<span class="mini-stat"><span style="font-weight:600">'+a.sharesNow.toLocaleString()+'</span></span>' +
        '<span class="mini-stat"><span style="font-weight:600">'+a.readMin+' min</span></span>' +
        '<span style="width:80px">'+makeSparkline(a.trend, i===1?'#ea580c':'var(--color-primary)')+'</span>' +
      '</div>'; }).join('') + '</div>';

    // Media analytics
    var media = [
      { name:'Aether Prime — Drone Tour 4K', type:'🎬', viewsNow:45100, viewsPrev:28900, likesNow:8920, likesPrev:6020, bmNow:4105, bmPrev:3110, sharesNow:2830, sharesPrev:1690 },
      { name:'Etheria — Official Flag Reveal', type:'🖼️', viewsNow:22800, viewsPrev:17000, likesNow:3421, likesPrev:2800, bmNow:1892, bmPrev:1600, sharesNow:1204, sharesPrev:850 },
      { name:'Governance Summit — Highlights', type:'🎬', viewsNow:18400, viewsPrev:16000, likesNow:4210, likesPrev:3900, bmNow:2340, bmPrev:2440, sharesNow:982, sharesPrev:890 },
      { name:'National Anthem — Recording', type:'🎵', viewsNow:9620, viewsPrev:9080, likesNow:5340, likesPrev:4760, bmNow:3210, bmPrev:2700, sharesNow:1540, sharesPrev:1570 },
    ];

    var mediaHTML = '<div class="card" style="padding:var(--space-md);width:100%;flex-shrink:0"><div class="flex-between" style="margin-bottom:var(--space-sm)"><h3 class="headline-md">Media Performance — ' + aLabel + '</h3><span class="label-sm" style="color:var(--color-outline)">Current vs Last Month</span></div>' +
      '<div class="content-row" style="color:var(--color-outline);font-size:var(--fs-label-sm);font-weight:600;text-transform:uppercase"><span style="flex:1;min-width:160px">Media</span><span style="width:44px;text-align:center">Type</span><span class="mini-stat">Views</span><span class="mini-stat">vs Prev</span><span class="mini-stat">Likes</span><span class="mini-stat">vs Prev</span><span class="mini-stat">Bookmarks</span><span class="mini-stat">Shares</span></div>' +
      media.map(function(m,i) { return '<div class="content-row"><span style="flex:1;min-width:160px;font-weight:600">'+m.name+'</span><span style="width:44px;text-align:center">'+m.type+'</span>' +
        '<span class="mini-stat"><span style="font-weight:600">'+(m.viewsNow/1000).toFixed(1)+'K</span></span>' +
        '<span class="mini-stat"><span style="font-size:11px;color:'+color(m.viewsNow,m.viewsPrev)+'">'+pct(m.viewsNow,m.viewsPrev)+'</span></span>' +
        '<span class="mini-stat"><span style="font-weight:600">'+m.likesNow.toLocaleString()+'</span></span>' +
        '<span class="mini-stat"><span style="font-size:11px;color:'+color(m.likesNow,m.likesPrev)+'">'+pct(m.likesNow,m.likesPrev)+'</span></span>' +
        '<span class="mini-stat"><span style="font-weight:600">'+m.bmNow.toLocaleString()+'</span></span>' +
        '<span class="mini-stat"><span style="font-weight:600">'+m.sharesNow.toLocaleString()+'</span></span>' +
      '</div>'; }).join('') + '</div>';

    track.innerHTML = articleHTML + mediaHTML;
    var panels = track.querySelectorAll('.card');
    panels.forEach(function(p,i) { p.style.opacity = i===0 ? '1' : '0.3'; p.style.transition = 'opacity 0.6s cubic-bezier(0.25,0.1,0.25,1)'; });
    track.style.transform = 'translateX(0)';
    detailPanel = 0;

    if (window.SlatiTilt) SlatiTilt.init(document.querySelectorAll('.tilt-container'));
  }


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

  window.FC_ARTICLES = (function() {
    'use strict';

  // ═══════════════════════════════════════════
  // Seed Data
  // ═══════════════════════════════════════════
  var articles = [
    { id:'ART-001', title:'The Founding Charter of Etheria',       author:'Alex Rivera',            date:'2026-08-05', views:12420, bookmarks:1204, words:3240, status:'published' },
    { id:'ART-002', title:'Aether Prime: A Smart Sovereign City',  author:'Alex Rivera',            date:'2026-08-02', views:15630, bookmarks:2108, words:4820, status:'published' },
    { id:'ART-003', title:'Digital Rights & Citizenship Act',      author:'Alex Rivera',            date:'2026-07-28', views:8920,  bookmarks:853,  words:2150, status:'published' },
    { id:'ART-004', title:'Economic Policy Whitepaper v2',         author:'Alex Rivera',            date:'2026-07-20', views:4280,  bookmarks:645,  words:5600, status:'draft' },
    { id:'ART-005', title:'Etheria Annual Report 2025',            author:'Alex Rivera',            date:'2026-08-07', views:3200,  bookmarks:410,  words:7800, status:'published' },
    { id:'ART-006', title:'Aethelgard Treaty Protocol v2',         author:'Etheria Editorial Board', date:'2026-08-07', views:1800,  bookmarks:230,  words:3100, status:'published' },
    { id:'ART-007', title:'Constitutional Amendment No. 14',       author:'Alex Rivera',            date:'2026-08-06', views:650,   bookmarks:89,   words:4200, status:'review' },
    { id:'ART-008', title:'Diplomatic Relations Framework',        author:'Alex Rivera',            date:'2026-07-15', views:12050, bookmarks:980,  words:6400, status:'published' },
    { id:'ART-009', title:'Territorial Expansion Proposal',        author:'Cartography Guild',      date:'2026-08-01', views:3400,  bookmarks:520,  words:2900, status:'review' },
    { id:'ART-010', title:'Cultural Heritage Preservation Act',    author:'Alex Rivera',            date:'2026-07-10', views:7800,  bookmarks:670,  words:3700, status:'published' },
    { id:'ART-011', title:'Renewable Energy Initiative 2026',      author:'Alex Rivera',            date:'2026-06-28', views:5600,  bookmarks:430,  words:5100, status:'published' },
    { id:'ART-012', title:'National Defense Strategy Overview',    author:'Etheria Editorial Board', date:'2026-07-05', views:9100,  bookmarks:780,  words:8200, status:'draft' },
    { id:'ART-013', title:'Citizenship by Investment Program',     author:'Alex Rivera',            date:'2026-06-15', views:14300, bookmarks:1120, words:4500, status:'published' },
    { id:'ART-014', title:'Digital Infrastructure Roadmap',        author:'Alex Rivera',            date:'2026-08-04', views:2100,  bookmarks:310,  words:3800, status:'draft' },
    { id:'ART-015', title:'Inter-Micronation Trade Agreement',     author:'Cartography Guild',      date:'2026-08-08', views:890,   bookmarks:145,  words:2600, status:'published' },
  ];

  // ═══════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════
  var artFilter = 'all';
  var artSort = 'newest';
  var artSearchTerm = '';
  var selectedIds = {};

  // ═══════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════
  function renderArtStats() {
    var total = articles.length;
    var published = articles.filter(function(a){ return a.status==='published'; }).length;
    var drafts = articles.filter(function(a){ return a.status==='draft'; }).length;
    var totalViews = articles.reduce(function(s, a){ return s + a.views; }, 0);
    document.getElementById('artStats').innerHTML =
      '<div class="card metric-card"><div class="metric-value" style="color:var(--color-primary)">' + total + '</div><div class="metric-label">Total Articles</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:#16a34a">' + published + '</div><div class="metric-label">Published</div><div class="metric-change" style="color:#22c55e">↑ 3 this week</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:#ea580c">' + drafts + '</div><div class="metric-label">Drafts</div></div>' +
      '<div class="card metric-card"><div class="metric-value" style="color:#8127cf">' + (totalViews/1000).toFixed(1) + 'K</div><div class="metric-label">Total Views</div><div class="metric-change" style="color:#22c55e">↑ 18.4%</div></div>';
  }

  // ═══════════════════════════════════════════
  // List
  // ═══════════════════════════════════════════
  function getFilteredArticles() {
    var result = articles.slice();
    if (artFilter !== 'all') {
      result = result.filter(function(a){ return a.status === artFilter; });
    }
    if (artSearchTerm) {
      var term = artSearchTerm.toLowerCase();
      result = result.filter(function(a){ return a.title.toLowerCase().indexOf(term) !== -1 || a.author.toLowerCase().indexOf(term) !== -1; });
    }
    // Sort
    switch (artSort) {
      case 'oldest':   result.sort(function(a,b){ return a.date.localeCompare(b.date); }); break;
      case 'views':    result.sort(function(a,b){ return b.views - a.views; }); break;
      case 'bookmarks':result.sort(function(a,b){ return b.bookmarks - a.bookmarks; }); break;
      case 'title':    result.sort(function(a,b){ return a.title.localeCompare(b.title); }); break;
      default:         result.sort(function(a,b){ return b.date.localeCompare(a.date); }); break;
    }
    return result;
  }

  function renderArtList() {
    var items = getFilteredArticles();
    var list = document.getElementById('artList');

    if (items.length === 0) {
      list.innerHTML = '<div class="art-empty"><span class="material-symbols-outlined art-empty-icon">article</span><p style="font-weight:600;margin-bottom:4px">No articles found</p><p style="font-size:12px">Try adjusting filters or create a new article</p></div>';
      return;
    }

    list.innerHTML = items.map(function(a) {
      var checked = !!selectedIds[a.id];
      var statusLabel = { published:'Published', draft:'Draft', review:'In Review' };
      return '<div class="art-row' + (checked ? ' selected' : '') + '" data-id="' + a.id + '">' +
        '<div class="art-checkbox' + (checked ? ' checked' : '') + '" data-id="' + a.id + '"></div>' +
        '<span class="art-title" title="Edit: ' + a.title + '">' + a.title + '</span>' +
        '<span class="art-col" style="min-width:100px;text-align:left">' + a.author + '</span>' +
        '<span class="art-col">' + a.date + '</span>' +
        '<span class="art-col"><strong>' + (a.views >= 1000 ? (a.views/1000).toFixed(1)+'K' : a.views) + '</strong> views</span>' +
        '<span class="art-col"><strong>' + (a.bookmarks >= 1000 ? (a.bookmarks/1000).toFixed(1)+'K' : a.bookmarks) + '</strong> saves</span>' +
        '<span class="art-col" style="min-width:56px">' + (a.words >= 1000 ? (a.words/1000).toFixed(1)+'K' : a.words) + ' words</span>' +
        '<span class="art-badge ' + a.status + '">' + (statusLabel[a.status] || a.status) + '</span>' +
        '<div class="art-actions">' +
          '<button class="art-action-btn" title="Edit"><span class="material-symbols-outlined" style="font-size:16px">edit</span></button>' +
          '<button class="art-action-btn" title="View"><span class="material-symbols-outlined" style="font-size:16px">visibility</span></button>' +
          '<button class="art-action-btn danger" title="Delete"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button>' +
        '</div>' +
      '</div>';
    }).join('');

    updateBulkBar();
  }

  // ═══════════════════════════════════════════
  // Selection
  // ═══════════════════════════════════════════
  function toggleSelect(id) {
    if (selectedIds[id]) {
      delete selectedIds[id];
    } else {
      selectedIds[id] = true;
    }
    // Update UI inline for responsiveness
    var row = document.querySelector('.art-row[data-id="' + id + '"]');
    var cb = document.querySelector('.art-checkbox[data-id="' + id + '"]');
    if (row) row.classList.toggle('selected', !!selectedIds[id]);
    if (cb) cb.classList.toggle('checked', !!selectedIds[id]);
    updateBulkBar();
  }

  function updateBulkBar() {
    var bar = document.getElementById('bulkBar');
    var count = Object.keys(selectedIds).length;
    if (count > 0) {
      bar.style.display = 'flex';
      document.getElementById('bulkCount').textContent = count + ' selected';
    } else {
      bar.style.display = 'none';
    }
  }

  function deleteArticle(id) {
    if (!confirm('Delete this article? This action cannot be undone.')) return;
    articles = articles.filter(function(a){ return a.id !== id; });
    delete selectedIds[id];
    renderArtStats();
    renderArtList();
  }

  // ═══════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════

  // Filter pills (subnav.js handles active/slider; we just track filter)
  document.getElementById('artFilterPills').addEventListener('click', function(e) {
    var btn = e.target.closest('.subnav-pill');
    if (!btn) return;
    artFilter = btn.dataset.filter;
    selectedIds = {};
    renderArtList();
    viewState.filter = artFilter;
    window.FC_URL.push();
  });

  // Sort
  document.getElementById('artSort').addEventListener('change', function() {
    artSort = this.value;
    renderArtList();
    viewState.sort = artSort;
    window.FC_URL.push();
  });

  // Search
  var searchTimer;
  document.getElementById('artSearch').addEventListener('input', function() {
    clearTimeout(searchTimer);
    var self = this;
    searchTimer = setTimeout(function() {
      artSearchTerm = self.value.trim();
      renderArtList();
    }, 250);
  });

  // Bulk select all
  document.getElementById('bulkSelectAll').addEventListener('click', function() {
    var visible = getFilteredArticles();
    var allSelected = visible.every(function(a){ return !!selectedIds[a.id]; });
    visible.forEach(function(a) {
      if (allSelected) { delete selectedIds[a.id]; }
      else { selectedIds[a.id] = true; }
    });
    renderArtList();
  });

  // Bulk publish
  document.getElementById('bulkPublish').addEventListener('click', function() {
    var ids = Object.keys(selectedIds);
    articles.forEach(function(a) {
      if (selectedIds[a.id] && a.status !== 'published') a.status = 'published';
    });
    selectedIds = {};
    renderArtStats();
    renderArtList();
    showToast('Published ' + ids.length + ' article(s)', 'publish');
  });

  // Bulk delete
  document.getElementById('bulkDelete').addEventListener('click', function() {
    var ids = Object.keys(selectedIds);
    if (ids.length === 0) return;
    if (!confirm('Delete ' + ids.length + ' article(s)? This cannot be undone.')) return;
    articles = articles.filter(function(a){ return !selectedIds[a.id]; });
    selectedIds = {};
    renderArtStats();
    renderArtList();
  });

  // Row delegation: checkbox / title+edit / delete (inline onclick removed — v0.2.45.0 bugfix)
  document.getElementById('artList').addEventListener('click', function(e) {
    var row = e.target.closest('.art-row');
    if (!row) return;
    var id = row.dataset.id;
    if (e.target.closest('.art-checkbox')) { toggleSelect(id); return; }
    if (e.target.closest('.art-action-btn.danger')) { deleteArticle(id); return; }
    if (e.target.closest('.art-title') || e.target.closest('.art-action-btn[title="Edit"]')) { window.location.href = 'fluidcanvas-editor.html'; return; }
  });

  function applyState(filter, sort) {
    // programmatic restore (init/back/forward) — no push
    if (filter && (filter === 'all' || filter === 'published' || filter === 'draft' || filter === 'review')) {
      artFilter = filter;
      document.getElementById('artFilterPills').querySelectorAll('.subnav-pill').forEach(function(b) { b.classList.toggle('active', b.dataset.filter === filter); });
    }
    if (sort) { artSort = sort; document.getElementById('artSort').value = sort; }
    selectedIds = {};
    renderArtList();
  }

  return { init: function() { renderArtStats(); renderArtList(); }, applyState: applyState };
  })();

  initURLSync();
