// v0.2.54.0 i18n：惰性 T(key)——本 script 先于 i18n.js（body 尾部）执行，必须运行时取值
function T(k) { return (window.MN_I18N && window.MN_I18N.t(k)) || null; }
(function() {
  'use strict';

  // ═══════════════════════════════════════════
  // v0.2.58.17 关注页真实数据接入
  // 零假数据：页面只认 API 响应；失败 → 离线卡；未登录 → 登录引导卡（可看发现区真数据）。
  // 数据源：GET /api/social/feed（关注用户帖+关注话题帖）、/api/social/following/detail（关注三类明细）、
  //   /api/social/nations、/api/social/topics、/api/public/users（发现·用户 + 推荐关注共用）。
  // 关注/取关：nation/topic → SlatiDB.saveFollowing（本地持久 + 触发 PUT 全量镜像，500ms 后重拉真相）；
  //   user → POST/DELETE /api/social/users/:id/follow 成功后 localStorage 直写（绝不 saveFollowing 防双重写）。
  // 渲染器全纯（只读 state 零 fetch）→ 切语零重拉；每次渲后 SlatiTilt.init。
  // ═══════════════════════════════════════════

  var LOGIN_URL = "../signup-and-login.html";

  // -- State --
  var state = {
    tab: 'feed',
    filter: 'all',
    search: '',
    auth: false,
    feed: [], feedFailed: false,
    detail: { nations: [], topics: [], users: [] }, detailFailed: false,
    followingIds: { nations: [], topics: [], users: [] },
    discNations: [], discNationsFailed: false,
    discTopics: [], discTopicsFailed: false,
    discUsers: [], discUsersFailed: false
  };

  // 双门 auth：slati_session 登录 + 用户 id 以 USR- 开头（演示用户「登录但无服务端 cookie」→ 视同未登录）
  function isAuthed() {
    var u = SlatiDB.getUser();
    return !!SlatiDB.isLoggedIn() && !!u && String(u.id || '').indexOf('USR-') === 0;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function isFollowing(type, id) {
    return (state.followingIds[type] || []).indexOf(id) !== -1;
  }

  function ownId() {
    var u = SlatiDB.getUser();
    return (u && u.id) || '';
  }

  function sMatch(texts) {
    var q = state.search.trim().toLowerCase();
    if (!q) return true;
    for (var i = 0; i < texts.length; i++) {
      if (String(texts[i] || '').toLowerCase().indexOf(q) !== -1) return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════
  // Data loading
  // ═══════════════════════════════════════════
  function loadFeed() {
    MN_API.get('/social/feed').then(function (r) {
      if (r.ok && r.data) { state.feed = r.data.posts || []; state.feedFailed = false; }
      else { state.feedFailed = true; }
      renderAll();
    });
  }

  function loadFollowingDetail() {
    MN_API.get('/social/following/detail').then(function (r) {
      if (r.ok && r.data) {
        state.detail = { nations: r.data.nations || [], topics: r.data.topics || [], users: r.data.users || [] };
        // 服务端真相 → 关注集合（按钮态/推荐区过滤的权威来源）
        state.followingIds = {
          nations: state.detail.nations.map(function (n) { return n.id; }),
          topics: state.detail.topics.map(function (t) { return t.id; }),
          users: state.detail.users.map(function (u) { return u.id; })
        };
        state.detailFailed = false;
      } else { state.detailFailed = true; }
      renderAll();
    });
  }

  function loadDiscover() {
    MN_API.get('/social/nations').then(function (r) {
      state.discNations = (r.ok && r.data && r.data.nations) ? r.data.nations : [];
      state.discNationsFailed = !(r.ok && r.data);
      renderAll();
    });
    MN_API.get('/social/topics').then(function (r) {
      state.discTopics = (r.ok && r.data && r.data.topics) ? r.data.topics : [];
      state.discTopicsFailed = !(r.ok && r.data);
      renderAll();
    });
    MN_API.get('/public/users').then(function (r) {
      state.discUsers = (r.ok && r.data && r.data.users) ? r.data.users : [];
      state.discUsersFailed = !(r.ok && r.data);
      renderAll();
    });
  }

  // ═══════════════════════════════════════════
  // 关注/取关
  // ═══════════════════════════════════════════
  function applyLocalToggle(type, id, isNow) {
    var arr = (state.followingIds[type] || []).slice();
    var idx = arr.indexOf(id);
    if (isNow && idx < 0) arr.push(id);
    if (!isNow && idx >= 0) arr.splice(idx, 1);
    state.followingIds[type] = arr;
  }

  function setLocalFollowingRaw(data) {
    try { localStorage.setItem('slati_following', JSON.stringify(data)); } catch (e) {}
  }

  function toggleFollow(type, id) {
    if (!state.auth) { window.location.href = LOGIN_URL; return; }
    var isNow = !isFollowing(type, id);
    if (type === 'users') {
      MN_API.request('/social/users/' + encodeURIComponent(id) + '/follow', { method: isNow ? 'POST' : 'DELETE' })
        .then(function (r) {
          if (r.ok && r.data) {
            applyLocalToggle(type, id, isNow);
            // 本地直写（绝不 saveFollowing——POST 后又 PUT = 双重写服务端）
            var local = SlatiDB.getFollowing();
            local.users = state.followingIds.users.slice();
            setLocalFollowingRaw(local);
          }
          // 服务端真相重拉（失败 = 回滚到真相）
          loadFollowingDetail();
        });
      return;
    }
    // nation/topic：乐观翻转 + 本地持久（saveFollowing 触发 PUT 全量镜像）
    applyLocalToggle(type, id, isNow);
    var local = SlatiDB.getFollowing();
    local[type] = state.followingIds[type].slice();
    SlatiDB.saveFollowing(local);
    // 500ms 宽限等 PUT 镜像落库再重拉真相（防镜像 PUT 与 detail GET 乱序回滚按钮）
    setTimeout(loadFollowingDetail, 500);
  }

  // ═══════════════════════════════════════════
  // 渲染（全纯：只读 state，零 fetch）
  // ═══════════════════════════════════════════
  function relTime(iso) {
    var t = Date.parse(iso);
    if (!t || isNaN(t)) return "";
    var d = Date.now() - t;
    if (d < 0) d = 0;
    if (d < 86400000) return T('following.feed.time.today') || 'Today';
    var days = Math.floor(d / 86400000);
    return (T('following.feed.time.daysAgo') || '{n} days ago').replace('{n}', String(days));
  }

  function mediaHtml(media) {
    var list = (media || []).filter(function (m) { return typeof m === "string" && /^(\/|https?:)/i.test(m); });
    if (!list.length) return '';
    return '<div class="folg-media">' + list.slice(0, 4).map(function (m) {
      return '<img src="' + esc(m) + '" alt="" loading="lazy">';
    }).join('') + '</div>';
  }

  function avatarHtml(name, url, color, size) {
    if (url) return '<img style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;flex-shrink:0" src="' + esc(url) + '" alt="">';
    var initials = String(name || '').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase() || '?';
    return '<div style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.36) + 'px;background:linear-gradient(135deg,' + (color || '#ea580c') + ',' + (color || '#ea580c') + 'dd);flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:50%;color:white;font-weight:700">' + esc(initials) + '</div>';
  }

  function offlineInner() {
    return '<span class="material-symbols-outlined" style="font-size:40px;color:var(--color-outline);opacity:0.5">wifi_off</span>' +
      '<p style="font-weight:600;margin-top:var(--space-sm);color:var(--color-on-surface)">' + (T('following.offline.title') || 'Data temporarily unavailable') + '</p>' +
      '<p class="label-sm" style="color:var(--color-outline);margin-top:4px">' + (T('following.offline.desc') || 'Please check your connection and try again.') + '</p>';
  }
  function offlineCard() { return '<div class="card folg-offline">' + offlineInner() + '</div>'; }

  function loginCtaCard() {
    return '<div class="card folg-cta">' +
      '<span class="material-symbols-outlined" style="font-size:40px;color:var(--color-primary)">lock</span>' +
      '<p style="font-weight:600;margin-top:var(--space-sm);color:var(--color-on-surface)">' + (T('following.loginCta.title') || 'Log in to see your feed') + '</p>' +
      '<p class="label-sm" style="color:var(--color-outline);margin-top:4px;max-width:420px;margin-left:auto;margin-right:auto">' + (T('following.loginCta.desc') || 'Sign in to follow nations, topics, and citizens — their updates appear here.') + '</p>' +
      '<button class="btn btn-primary btn-sm" style="margin-top:var(--space-sm)" onclick="window.location.href=\'' + LOGIN_URL + '\'">' + (T('following.loginCta.btn') || 'Go to Login') + '</button>' +
    '</div>';
  }

  function emptyCard(icon, text) {
    return '<div class="card folg-empty">' +
      '<span class="material-symbols-outlined" style="font-size:40px;color:var(--color-outline);opacity:0.4">' + icon + '</span>' +
      '<p style="color:var(--color-outline);margin-top:var(--space-sm)">' + text + '</p>' +
    '</div>';
  }

  function followBtnHtml(type, id, following) {
    return '<button class="btn btn-outline btn-sm follow-btn" style="width:100%;font-size:11px" data-type="' + type + '" data-id="' + esc(id) + '">' +
      (following ? '<span class="material-symbols-outlined" style="font-size:14px;margin-right:3px">favorite</span>' + (T('following.discover.followingBtn') || 'Following')
                 : '<span class="material-symbols-outlined" style="font-size:14px;margin-right:3px">add</span>' + (T('following.discover.followBtn') || 'Follow')) +
    '</button>';
  }

  // ═══════════════════════════════════════════
  // 1. Feed Tab
  // ═══════════════════════════════════════════
  function renderFeed() {
    var panel = document.getElementById('feedPanel');
    if (!state.auth) { panel.innerHTML = loginCtaCard(); return; }
    if (state.feedFailed) { panel.innerHTML = offlineCard(); return; }
    var posts = state.feed.filter(function (p) {
      return sMatch([p.authorName, p.content]);
    });
    if (!posts.length) {
      panel.innerHTML = '<div style="text-align:center;padding:var(--space-xl) 0">' +
        '<span class="material-symbols-outlined" style="font-size:48px;color:var(--color-outline);opacity:0.4">inbox</span>' +
        '<p style="color:var(--color-outline);margin-top:var(--space-sm)">' + (T('following.feed.empty') || 'No recent activity from followed entities.<br>Follow nations, topics, or users to see updates here.') + '</p></div>';
      return;
    }
    panel.innerHTML = posts.map(function (p) {
      var name = esc(p.authorName || "");
      var authorLink = p.authorId
        ? '<a href="community-profile.html?id=' + encodeURIComponent(p.authorId) + '" style="color:var(--color-on-surface);text-decoration:none;font-weight:600">' + name + '</a>'
        : '<span style="font-weight:600">' + name + '</span>';
      return '<div class="card card-hover tilt-container" style="padding:var(--space-md)">' +
        '<div class="flex-center gap-sm" style="justify-content:flex-start;margin-bottom:8px">' +
          avatarHtml(p.authorName, p.avatarUrl, "#4648d4", 32) +
          '<div style="min-width:0">' +
            '<div style="font-size:var(--fs-label-md);color:var(--color-on-surface)">' + authorLink + '</div>' +
            '<div class="label-sm" style="color:var(--color-outline)">' + esc(relTime(p.createdAt)) + '</div>' +
          '</div>' +
        '</div>' +
        '<p style="color:var(--color-on-surface-variant);font-size:var(--fs-label-md);white-space:pre-wrap;word-break:break-word">' + esc(p.content || '') + '</p>' +
        mediaHtml(p.media) +
        '<div style="display:flex;gap:14px;margin-top:8px">' +
          '<span class="flex-center" style="gap:3px;font-size:12px;color:var(--color-outline)"><span class="material-symbols-outlined" style="font-size:14px">favorite</span>' + (p.likeCount || 0) + '</span>' +
          '<span class="flex-center" style="gap:3px;font-size:12px;color:var(--color-outline)"><span class="material-symbols-outlined" style="font-size:14px">comment</span>' + (p.commentCount || 0) + '</span>' +
          '<span class="flex-center" style="gap:3px;font-size:12px;color:var(--color-outline)"><span class="material-symbols-outlined" style="font-size:14px">visibility</span>' + (p.viewCount || 0) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ═══════════════════════════════════════════
  // 2. Following Tab
  // ═══════════════════════════════════════════
  function renderFollowingList() {
    var filterRow = document.getElementById('followingFilter');
    var list = document.getElementById('followingList');
    var empty = document.getElementById('followingEmpty');
    if (!state.auth) {
      filterRow.style.display = 'none';
      empty.style.display = 'none';
      list.style.display = '';
      list.innerHTML = loginCtaCard();
      return;
    }
    filterRow.style.display = '';
    if (state.detailFailed) {
      list.style.display = '';
      empty.style.display = 'none';
      list.innerHTML = offlineCard();
      return;
    }
    var items = [];
    if (state.filter === 'all' || state.filter === 'nations') {
      state.detail.nations.forEach(function (n) {
        if (sMatch([n.name, n.classification, n.moniker])) {
          items.push({ type: 'nations', id: n.id, title: n.name, sub: n.classification || '', abbr: (n.moniker || n.name || 'N').charAt(0).toUpperCase(), color: '#4648d4' });
        }
      });
    }
    if (state.filter === 'all' || state.filter === 'topics') {
      state.detail.topics.forEach(function (t) {
        if (sMatch([t.name, t.description])) {
          items.push({ type: 'topics', id: t.id, title: t.name, sub: (t.memberCount || 0).toLocaleString() + (T('following.suffix.members') || ' members'), icon: t.icon || 'forum', color: '#16a34a' });
        }
      });
    }
    if (state.filter === 'all' || state.filter === 'users') {
      state.detail.users.forEach(function (u) {
        if (sMatch([u.displayName, u.citizenId])) {
          items.push({ type: 'users', id: u.id, title: u.displayName, sub: u.citizenId || '', avatarUrl: u.avatarUrl || null, color: '#ea580c' });
        }
      });
    }
    if (!items.length) {
      list.style.display = 'none';
      empty.style.display = '';
      return;
    }
    list.style.display = '';
    empty.style.display = 'none';
    list.innerHTML = items.map(function (item) {
      var avatarHtmlRow;
      if (item.type === 'users') {
        avatarHtmlRow = avatarHtml(item.title, item.avatarUrl, item.color, 36);
      } else if (item.type === 'nations') {
        avatarHtmlRow = '<div style="width:48px;height:32px;background:' + (item.color || '#4648d4') + ';border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center">' +
          '<span style="font-weight:700;font-size:11px;color:rgba(255,255,255,0.9);letter-spacing:0.05em">' + esc(item.abbr || '') + '</span></div>';
      } else {
        avatarHtmlRow = '<div style="width:36px;height:36px;border-radius:10px;background:rgba(22,163,74,0.1);flex-shrink:0;display:flex;align-items:center;justify-content:center">' +
          '<span class="material-symbols-outlined" style="font-size:20px;color:' + (item.color || '#16a34a') + '">' + esc(item.icon || 'forum') + '</span></div>';
      }
      return '<div class="card card-hover" style="display:flex;align-items:center;gap:12px;padding:var(--space-sm) var(--space-md)">' +
        avatarHtmlRow +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600;font-size:var(--fs-label-md);color:var(--color-on-surface)">' + esc(item.title || '') + '</div>' +
          '<div class="label-sm" style="color:var(--color-outline)">' + esc(item.sub || '') + '</div>' +
        '</div>' +
        '<button class="btn btn-outline btn-sm unfollow-btn" data-type="' + item.type + '" data-id="' + esc(item.id) + '" style="flex-shrink:0;font-size:11px">' + (T('following.list.followingBtn') || 'Following') + '</button>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.unfollow-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleFollow(btn.dataset.type, btn.dataset.id);
      });
    });
  }

  // ═══════════════════════════════════════════
  // 3. Discover Tab
  // ═══════════════════════════════════════════
  function renderDiscoverGrids() {
    // Nations（无 emoji/无假粉丝数：abbr=moniker 首两字、副行=classification、lore≤120 字）
    var nBox = document.getElementById('discoverNations');
    if (state.discNationsFailed) { nBox.innerHTML = offlineCard(); }
    else {
      var nRows = state.discNations.filter(function (n) { return sMatch([n.name, n.classification, n.moniker]); });
      if (!nRows.length) { nBox.innerHTML = emptyCard('public', T('following.empty.nations') || 'No nations yet.'); }
      else {
        nBox.innerHTML = nRows.map(function (n) {
          var following = isFollowing("nations", n.id);
          return '<div class="card tilt-container" style="padding:var(--space-md);text-align:center">' +
            '<div style="width:100%;height:56px;background:#4648d4;border-radius:6px;margin-bottom:10px;display:flex;align-items:center;justify-content:center">' +
              '<span style="font-weight:800;font-size:18px;color:rgba(255,255,255,0.9);letter-spacing:0.08em">' + esc((n.moniker || n.name || 'N').slice(0, 2).toUpperCase()) + '</span>' +
            '</div>' +
            '<div style="font-weight:600;font-size:var(--fs-label-md);margin-bottom:2px;color:var(--color-on-surface)">' + esc(n.name || '') + '</div>' +
            '<p style="font-size:11px;color:var(--color-on-surface-variant);margin-bottom:8px;line-height:1.3">' + esc(String(n.lore || n.classification || '').slice(0, 120)) + '</p>' +
            followBtnHtml("nations", n.id, following) +
          '</div>';
        }).join('');
      }
    }

    // Topics
    var tBox = document.getElementById('discoverTopics');
    if (state.discTopicsFailed) { tBox.innerHTML = offlineCard(); }
    else {
      var tRows = state.discTopics.filter(function (t) { return sMatch([t.name, t.description]); });
      if (!tRows.length) { tBox.innerHTML = emptyCard('forum', T('following.empty.topics') || 'No topics yet.'); }
      else {
        tBox.innerHTML = tRows.map(function (t) {
          var following = isFollowing("topics", t.id);
          return '<div class="card tilt-container" style="padding:var(--space-md)">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
              '<span class="material-symbols-outlined" style="font-size:24px;color:var(--color-primary)">' + esc(t.icon || 'forum') + '</span>' +
              '<div><div style="font-weight:600;font-size:var(--fs-label-md);color:var(--color-on-surface)">' + esc(t.name || '') + '</div>' +
              '<div class="label-sm" style="color:var(--color-outline)">' + (t.memberCount || 0).toLocaleString() + (T('following.suffix.members') || ' members') + '</div></div>' +
            '</div>' +
            '<p style="font-size:11px;color:var(--color-on-surface-variant);margin-bottom:8px">' + esc(String(t.description || '').slice(0, 120)) + '</p>' +
            followBtnHtml("topics", t.id, following) +
          '</div>';
        }).join('');
      }
    }

    // Users（= 公开用户端点；登出自身不显示）
    var uBox = document.getElementById('discoverUsers');
    if (state.discUsersFailed) { uBox.innerHTML = offlineCard(); }
    else {
      var me = ownId();
      var uRows = state.discUsers.filter(function (u) {
        return u.id !== me && sMatch([u.displayName, u.citizenId]);
      });
      if (!uRows.length) { uBox.innerHTML = emptyCard('person', T('following.empty.users') || 'No citizens yet.'); }
      else {
        uBox.innerHTML = uRows.map(function (u) {
          var following = isFollowing("users", u.id);
          return '<div class="card tilt-container" style="padding:var(--space-md);text-align:center">' +
            avatarHtml(u.displayName, u.avatarUrl, "#ea580c", 44) +
            '<div style="font-weight:600;font-size:var(--fs-label-md);margin:8px 0 2px;color:var(--color-on-surface)">' + esc(u.displayName || '') + '</div>' +
            '<div class="label-sm" style="color:var(--color-outline);margin-bottom:8px">' + esc(u.citizenId || '') + '</div>' +
            followBtnHtml("users", u.id, following) +
          '</div>';
        }).join('');
      }
    }
  }

  // ═══════════════════════════════════════════
  // 4. Right Sidebar
  // ═══════════════════════════════════════════
  function renderSidebar() {
    var slot = document.getElementById('rightSidebarSlot');
    if (state.tab === 'following') {
      // Stats（detail 三数组计数 = 服务端真相）
      slot.innerHTML = '<div class="card">' +
        '<h3 class="label-md" style="margin-bottom:var(--space-sm);display:flex;align-items:center;gap:6px">' +
          '<span class="material-symbols-outlined" style="font-size:18px;color:var(--color-primary)">monitoring</span> ' + (T('following.stats.title') || 'Following Stats') +
        '</h3>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(118,117,134,0.06)">' +
            '<span style="display:flex;align-items:center;gap:6px;font-size:var(--fs-label-md)"><span class="material-symbols-outlined" style="font-size:16px;color:#4648d4">public</span> ' + (T('following.filter.nations') || 'Nations') + '</span>' +
            '<span style="font-weight:700;font-size:var(--fs-body-lg);color:#4648d4">' + state.detail.nations.length + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(118,117,134,0.06)">' +
            '<span style="display:flex;align-items:center;gap:6px;font-size:var(--fs-label-md)"><span class="material-symbols-outlined" style="font-size:16px;color:#16a34a">forum</span> ' + (T('following.filter.topics') || 'Topics') + '</span>' +
            '<span style="font-weight:700;font-size:var(--fs-body-lg);color:#16a34a">' + state.detail.topics.length + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">' +
            '<span style="display:flex;align-items:center;gap:6px;font-size:var(--fs-label-md)"><span class="material-symbols-outlined" style="font-size:16px;color:#ea580c">person</span> ' + (T('following.filter.users') || 'Users') + '</span>' +
            '<span style="font-weight:700;font-size:var(--fs-body-lg);color:#ea580c">' + state.detail.users.length + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
      return;
    }
    // Who to Follow（= 公开用户端点 减已关注 减自身，≤5）
    if (state.discUsersFailed) { slot.innerHTML = '<div class="card">' + offlineInner() + '</div>'; return; }
    var me = ownId();
    var rows = state.discUsers.filter(function (u) {
      return u.id !== me && !isFollowing("users", u.id);
    }).slice(0, 5);
    if (!rows.length) {
      slot.innerHTML = '<div class="card">' +
        '<h3 class="label-md" style="margin-bottom:var(--space-sm);display:flex;align-items:center;gap:6px">' +
          '<span class="material-symbols-outlined" style="font-size:18px;color:#eab308">auto_awesome</span> ' + (T('following.rec.title') || 'Who to Follow') +
        '</h3>' +
        '<p class="label-sm" style="color:var(--color-outline);text-align:center;padding:var(--space-sm) 0">' + (T('following.rec.empty') || 'No suggestions right now.') + '</p>' +
      '</div>';
      return;
    }
    slot.innerHTML = '<div class="card">' +
      '<h3 class="label-md" style="margin-bottom:var(--space-sm);display:flex;align-items:center;gap:6px">' +
        '<span class="material-symbols-outlined" style="font-size:18px;color:#eab308">auto_awesome</span> ' + (T('following.rec.title') || 'Who to Follow') +
      '</h3>' +
      rows.map(function (u) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(118,117,134,0.06)">' +
          avatarHtml(u.displayName, u.avatarUrl, "#ea580c", 28) +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:600;font-size:var(--fs-label-md);color:var(--color-on-surface)">' + esc(u.displayName || '') + '</div>' +
            '<div class="label-sm" style="color:var(--color-outline)">' + (u.followerCount || 0).toLocaleString() + (T('following.suffix.followers') || ' followers') + '</div>' +
          '</div>' +
          '<button class="btn btn-ghost btn-sm follow-btn" style="padding:2px 8px;font-size:11px;color:var(--color-primary)" data-type="users" data-id="' + esc(u.id) + '">' + (T('following.rec.followBtn') || '+ Follow') + '</button>' +
        '</div>';
      }).join('') +
      '<a href="#" class="label-sm" id="gotoDiscover" style="display:block;text-align:center;margin-top:var(--space-sm);color:var(--color-primary);text-decoration:none">' + (T('following.rec.viewMore') || 'View more in Discover →') + '</a>' +
    '</div>';
  }

  // ═══════════════════════════════════════════
  // Tab Switching / 事件
  // ═══════════════════════════════════════════
  function switchTab(tab) {
    state.tab = tab;
    document.getElementById('feedPanel').style.display = tab === 'feed' ? '' : 'none';
    document.getElementById('followingPanel').style.display = tab === 'following' ? '' : 'none';
    document.getElementById('discoverPanel').style.display = tab === 'discover' ? '' : 'none';
    renderAll();
  }

  function renderAll() {
    renderFeed();
    renderFollowingList();
    renderDiscoverGrids();
    renderSidebar();
    if (window.SlatiTilt) SlatiTilt.init(document.querySelectorAll('.tilt-container'));
  }

  document.getElementById('mainTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.subnav-pill');
    if (!btn || btn.dataset.tab === state.tab) return;
    switchTab(btn.dataset.tab);
  });

  document.getElementById('followingFilter').addEventListener('click', function (e) {
    var btn = e.target.closest('.subnav-pill');
    if (!btn || btn.dataset.filter === state.filter) return;
    state.filter = btn.dataset.filter;
    renderFollowingList();
  });

  // Discover 区 +Follow（事件委托：渲染替换 innerHTML 后无需重绑）
  document.getElementById('discoverPanel').addEventListener('click', function (e) {
    var btn = e.target.closest('.follow-btn');
    if (!btn) return;
    toggleFollow(btn.dataset.type, btn.dataset.id);
  });

  // 右栏：推荐关注 +Follow / 「在发现中查看更多」（手动 .active 切换——subnav.js MutationObserver 驱动滑块，安全）
  document.getElementById('rightSidebarSlot').addEventListener('click', function (e) {
    var fb = e.target.closest('.follow-btn');
    if (fb) { toggleFollow(fb.dataset.type, fb.dataset.id); return; }
    if (e.target.id === 'gotoDiscover') {
      e.preventDefault();
      switchTab('discover');
      document.querySelectorAll('#mainTabs .subnav-pill').forEach(function (p) { p.classList.remove('active'); });
      var discPill = document.querySelector('#mainTabs [data-tab="discover"]');
      if (discPill) discPill.classList.add('active');
    }
  });

  // 搜索：input → state.search → 重渲当前标签（feed 按作者名+内容、following/discover 按名），无防抖
  var searchInput = document.getElementById('followingSearch');
  searchInput.addEventListener('input', function () {
    state.search = searchInput.value;
    renderAll();
  });

  // 401 → storage.js 已清会话 → 页面退登录引导态
  window.addEventListener('mn:unauthorized', function () {
    state.auth = false;
    state.feed = []; state.feedFailed = false;
    state.detail = { nations: [], topics: [], users: [] };
    state.followingIds = { nations: [], topics: [], users: [] };
    renderAll();
  });

  // v0.2.54.0 i18n：重渲钩子——body 尾部三件套 apply（及语言切换）后整刷。
  // v0.2.58.17 链式挂载：不踩其他页（58.16 activity 等已挂 __mnI18nRerender）。
  var __mnPrevRerender = window.__mnI18nRerender || function () {};
  window.__mnI18nRerender = function () {
    __mnPrevRerender();
    renderAll();
  };

  // ═══════════════════════════════════════════
  // Boot
  // ═══════════════════════════════════════════
  state.auth = isAuthed();
  if (state.auth) {
    loadFeed();
    loadFollowingDetail();
  }
  loadDiscover(); // 恒拉（公开端点）：发现区 + 推荐关注
  switchTab("feed");

})();