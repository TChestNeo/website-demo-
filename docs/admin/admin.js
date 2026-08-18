/**
 * 管理后台（独立站点 admin.<域名>）：/api/admin/* 全端点前端。
 * 访问控制：自带邮箱验证码登录页（/auth/email-code + /auth/verify），登录后再经 /auth/me 确认
 * role==='admin'，否则显示无权限面板（服务端 requireAdmin 双重强制）。
 * 所有写操作由后端落 admin_audit_log。内联中文文案（未走 i18n 机制——与计划偏差，见 commit）。
 * 后端不可达 / 会话失效 → 登录页或提示，不进入 demo（管理端无离线回退）。
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var state = {
    modFilter: 'open',
    tkFilter: 'queued',
    tkList: [],
    ticket: null,
    tkTpl: null,
    tplSel: null,
    tplLang: 'zh',
    selUserId: null,
    usage: null,
    budgets: {}
  };

  // ── 工具 ──
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString('zh-CN', { hour12: false });
  }
  function fmtYuan(micro, dp) {
    var n = Number(micro) || 0;
    return '¥' + (n / 1e6).toFixed(dp == null ? 2 : dp);
  }
  function fmtLimit(yuan) { // 预算额度已是元（非微元），不能走 fmtYuan
    return '¥' + (Number(yuan) || 0).toFixed(2);
  }
  var toastTimer;
  function toast(msg) {
    var el = $('admToast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.display = 'none'; }, 2600);
  }
  function chip(text, cls) {
    return '<span class="chip ' + (cls || 'neutral') + '">' + esc(text) + '</span>';
  }
  var STATUS_ZH = {
    l0_hold: 'L0 拦截', queued: '排队中', ai_approved: 'AI 通过', ai_rejected: 'AI 拒绝',
    needs_human: '需人工', human_approved: '人工通过', human_rejected: '人工拒绝',
    in_progress: '已回复', closed: '已关闭', active: '正常', banned: '已封禁',
    pending: '待上线', visible: '可见', hidden: '已下架'
  };
  function statusChip(s) {
    var cls = 'neutral';
    if (s === 'high' || s === 'urgent' || s === 'banned' || s === 'ai_rejected') cls = 'high';
    if (s === 'human_approved' || s === 'active' || s === 'visible') cls = 'ok';
    if (s === 'needs_human' || s === 'l0_hold' || s === 'in_progress') cls = 'warn';
    return chip(STATUS_ZH[s] || s, cls);
  }

  // ── 登录页 / 门禁 / 面板三态切换 ──
  function hideAll() {
    $('adminLogin').style.display = 'none';
    $('adminGate').style.display = 'none';
    $('adminRoot').style.display = 'none';
  }
  function showLogin() {
    hideAll();
    $('adminLogin').style.display = 'block';
    $('logoutBtn').style.display = 'none';
    $('admWho').style.display = 'none';
    restoreLogin();
  }
  function showGate(title, msg, withLogout) {
    hideAll();
    $('gateTitle').textContent = title;
    $('gateMsg').textContent = msg;
    $('gateActions').style.display = withLogout ? 'flex' : 'none';
    $('adminGate').style.display = 'block';
    $('logoutBtn').style.display = withLogout ? '' : 'none';
    $('admWho').style.display = 'none';
  }
  function showPanel(u) {
    hideAll();
    $('admWho').textContent = u.email;
    $('admWho').style.display = '';
    $('logoutBtn').style.display = '';
    $('adminRoot').style.display = 'block';
  }

  function setLoginMsg(msg, err) {
    var el = $('loginMsg');
    el.textContent = msg;
    el.classList.toggle('err', !!err);
  }
  var loginTimer;
  function countdown(s) {
    var btn = $('sendCodeBtn');
    btn.disabled = true;
    var left = s;
    btn.textContent = '重新发送（' + left + 's）';
    clearInterval(loginTimer);
    loginTimer = setInterval(function () {
      left--;
      if (left <= 0) {
        clearInterval(loginTimer);
        btn.disabled = false;
        btn.textContent = '发送验证码';
        return;
      }
      btn.textContent = '重新发送（' + left + 's）';
    }, 1000);
  }

  // 请求成功后把邮箱+发送时间记进 sessionStorage：刷新页面直接恢复验证码输入框，
  // 且 60s 冷却未过时继续倒计时（避免页面重载后重发撞 429）。
  function saveCodeState(email) {
    try { sessionStorage.setItem('mnAdmCode', JSON.stringify({ email: email, sentAt: Date.now() })); } catch (e) {}
  }
  function restoreLogin() {
    var raw = null;
    try { raw = sessionStorage.getItem('mnAdmCode'); } catch (e) {}
    if (!raw) return;
    var st = null;
    try { st = JSON.parse(raw); } catch (e) {}
    if (!st || !st.email) return;
    var elapsed = Date.now() - st.sentAt;
    if (elapsed > 10 * 60 * 1000) { try { sessionStorage.removeItem('mnAdmCode'); } catch (e) {} return; }
    $('loginEmail').value = st.email;
    $('codeRow').style.display = 'flex';
    if (elapsed < 60 * 1000) countdown(60 - Math.floor(elapsed / 1000));
  }
  $('sendCodeBtn').addEventListener('click', function () {
    var email = $('loginEmail').value.trim();
    if (!email) { setLoginMsg('请输入管理员邮箱', true); return; }
    MN_API.post('/auth/email-code', { email: email }).then(function (r) {
      if (r.ok) {
        $('codeRow').style.display = 'flex';
        setLoginMsg('验证码已发送至 ' + email + '，10 分钟内有效');
        countdown(60);
        saveCodeState(email);
      } else if (r.status === 429) {
        setLoginMsg('请求过于频繁，请 60 秒后再试', true);
      } else {
        setLoginMsg('发送失败：' + (r.data && r.data.error && r.data.error.message || r.status), true);
      }
    });
  });
  $('loginBtn').addEventListener('click', function () {
    var email = $('loginEmail').value.trim();
    var code = $('loginCode').value.trim();
    if (!email || !code) { setLoginMsg('请输入邮箱和验证码', true); return; }
    MN_API.post('/auth/verify', { email: email, code: code }).then(function (r) {
      if (!r.ok) {
        setLoginMsg(r.status === 401 ? '验证码错误或已过期' : '登录失败，请重试', true);
        return;
      }
      setLoginMsg('登录成功，正在进入…');
      try { sessionStorage.removeItem('mnAdmCode'); } catch (e) {}
      boot(); // 重新走 /auth/me 门禁（非管理员账号 → 无权限面板）
    });
  });
  $('loginCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('loginBtn').click(); });

  function logout() {
    MN_API.post('/auth/logout', {}).then(function () { location.reload(); });
  }
  $('logoutBtn').addEventListener('click', logout);
  $('gateLogoutBtn').addEventListener('click', logout);

  function boot() {
    MN_API.get('/auth/me').then(function (r) {
      if (r.networkError) {
        showGate('后端不可达', '无法连接后端服务。请确认后端已启动或稍后重试。');
        return;
      }
      if (r.status === 401 || !r.ok) {
        showLogin();
        return;
      }
      var u = r.data && r.data.user;
      if (!u || u.role !== 'admin') {
        showGate('无访问权限', '当前账号（' + (u && u.email ? u.email : '未知') + '）不是管理员。如需权限请联系平台管理员（ADMIN_EMAIL 配置）。', true);
        return;
      }
      showPanel(u);
      refreshStats();
      loadModList();
      loadUsage(); // 横幅 + 成本看板数据（横幅供审核 tab 展示降级状态）
      // 深链恢复：刷新后回到工单专属回复页（#ticket:MN-…）
      if (location.hash.indexOf('#ticket:') === 0) {
        loaded.ticket = true; // 防 switchTab 懒加载重复拉取
        switchTab('ticket');
        loadTickets(function () { openTicket(location.hash.slice(8)); });
      }
    });
  }

  // ── 总览（管理首页）：统计卡 + 队列快照 + 预算条 + 最近动态 ──
  function refreshStats() {
    MN_API.get('/admin/stats').then(function (r) {
      if (!r.ok || !r.data) return;
      var d = r.data;
      $('dUsers').textContent = d.users;
      $('dUsersSub').textContent = '7 天 +' + d.users7d + ' · 24h 活跃 ' + d.usersActive24h;
      $('dPosts').textContent = d.posts;
      $('dPostsSub').textContent = '24h +' + d.posts24h;
      $('dNations').textContent = d.nations;
      $('dTopics').textContent = d.topics;
      $('dArticles').textContent = d.articles;
      var m = d.moderationItems || {};
      var modTotal = (m.l0_hold || 0) + (m.queued || 0) + (m.needs_human || 0) + (m.ai_rejected || 0);
      $('dMod').textContent = modTotal;
      $('dModSub').textContent = 'L0 ' + (m.l0_hold || 0) + ' · 排队 ' + (m.queued || 0) +
        ' · 人工 ' + (m.needs_human || 0) + ' · AI拒 ' + (m.ai_rejected || 0);
      $('dTickets').textContent = d.openTickets;
      $('dReports').textContent = d.openReports;
      $('dBadges').textContent = d.badgeActive;
      $('dSessions').textContent = d.sessionsActive;
      $('dCost').textContent = fmtYuan(d.monthCostMicro);
      var b = $('dBudget');
      b.textContent = d.budgetState === 'ok' ? '正常' : d.budgetState === 'warn' ? '≥80%' : '已耗尽';
      b.style.color = d.budgetState === 'ok' ? '#16a34a' : d.budgetState === 'warn' ? '#b45309' : '#dc2626';
      renderDashQueue(m);
      renderDashBudget(d.budget);
      renderDashFeed(d.activity);
    });
  }
  function renderDashQueue(m) {
    var rows = [['l0_hold', 'L0 拦截', 'warn'], ['queued', '排队中', 'neutral'],
      ['needs_human', '需人工', 'high'], ['ai_rejected', 'AI 拒绝', 'high']];
    $('dashQueue').innerHTML = rows.map(function (r) {
      return '<div class="feed-item cursor-row" data-dash-filter="' + r[0] + '" style="display:flex;justify-content:space-between;align-items:center">' +
        '<span>' + chip(r[1], r[2]) + '</span><strong style="font-size:16px">' + ((m && m[r[0]]) || 0) + '</strong></div>';
    }).join('');
  }
  function renderDashBudget(bg) {
    if (!bg) return;
    var rows = ['moderation_text', 'chat', 'moderation_image', 'total'].map(function (f) {
      var s = f === 'total' ? bg.total : (bg.features || {})[f];
      if (!s) return '';
      var pct = Math.min(100, Math.round(s.ratio * 100));
      var cls = s.state === 'exhausted' ? 'bad' : s.state === 'warn' ? 'warn' : '';
      return '<div style="margin-bottom:10px"><div class="row" style="justify-content:space-between;margin-bottom:4px">' +
        '<span style="font-size:13px">' + FEATURE_ZH[f] + '</span>' +
        '<span class="adm-meta">' + fmtYuan(s.spent) + ' / ' + fmtLimit(s.limit) + '（' + pct + '%）</span></div>' +
        '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%"></div></div></div>';
    });
    $('dashBudget').innerHTML = rows.join('');
  }
  var FEED_CHIP = { user: ['新用户', 'ok'], post: ['新帖', 'neutral'], ticket: ['工单', 'warn'],
    report: ['举报', 'high'], audit: ['管理', 'neutral'] };
  function renderDashFeed(act) {
    $('dashFeed').innerHTML = (act || []).map(function (a) {
      var c = FEED_CHIP[a.type] || [a.type, 'neutral'];
      return '<div class="feed-item"><div class="row" style="justify-content:space-between;margin-bottom:2px">' +
        chip(c[0], c[1]) + '<span class="adm-meta">' + fmtTime(a.at) + '</span></div>' +
        '<span style="font-size:13.5px">' + esc(a.text) + '</span></div>';
    }).join('') || '<p class="adm-meta">暂无动态</p>';
  }
  // 队列快照点击 → 跳审核 tab 并切到对应筛选
  $('dashQueue').addEventListener('click', function (e) {
    var row = e.target.closest('[data-dash-filter]');
    if (!row) return;
    switchTab('mod');
    state.modFilter = row.dataset.dashFilter;
    loadModList();
  });
  $('dashGoMod').addEventListener('click', function () { switchTab('mod'); });
  $('dashGoUsage').addEventListener('click', function () { switchTab('usage'); });

  // ── Tab 切换（懒加载） ──
  var loaded = { ticket: false, badge: false, user: false };
  var PANES = ['dash', 'mod', 'ticket', 'badge', 'user', 'usage'];
  function switchTab(tab) {
    document.querySelectorAll('#admTabs [data-tab]').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    PANES.forEach(function (t) { $('pane-' + t).style.display = t === tab ? 'block' : 'none'; });
    if (tab === 'ticket' && !loaded.ticket) { loaded.ticket = true; loadTickets(); }
    if (tab === 'badge' && !loaded.badge) { loaded.badge = true; loadBadges(); }
    if (tab === 'user' && !loaded.user) { loaded.user = true; loadUsers(); }
    if (tab === 'usage') loadUsage();
  }
  $('admTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-tab]');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });

  // ── 审核队列 ──
  var MOD_FILTER_ZH = { open: 'open（待处理）', l0_hold: 'L0 拦截', queued: '排队', needs_human: '需人工', ai_rejected: 'AI 拒绝', all: '全部' };
  $('pane-mod').addEventListener('click', function (e) {
    var f = e.target.closest('[data-mod-filter]');
    if (f) { state.modFilter = f.dataset.modFilter; loadModList(); return; }
    var d = e.target.closest('[data-mod-decide]');
    if (d) { modDecide(d); }
  });

  function ruleHitChips(hits) {
    if (!hits || !hits.length) return '';
    return '<div class="row" style="margin-bottom:var(--space-xs)">' + hits.map(function (h) {
      return chip((h.rule || h.category || '') + (h.severity ? ' · ' + h.severity : ''), 'high');
    }).join('') + '</div>';
  }
  function aiChips(ai) {
    if (!ai) return '';
    var verdict = ai.verdict || (ai.results && ai.results[0] && ai.results[0].verdict) || '';
    var conf = ai.confidence != null ? ai.confidence : (ai.results && ai.results[0] && ai.results[0].confidence);
    return '<div class="row" style="margin-bottom:var(--space-xs)">' +
      chip('AI: ' + verdict + (conf != null ? ' ' + Number(conf).toFixed(2) : ''), verdict === 'reject' ? 'high' : 'neutral') + '</div>';
  }

  function loadModList() {
    $('modFilterLabel').textContent = MOD_FILTER_ZH[state.modFilter] || state.modFilter;
    MN_API.get('/admin/moderation/queue?status=' + encodeURIComponent(state.modFilter)).then(function (r) {
      var box = $('modList');
      if (!r.ok || !r.data) { box.innerHTML = '<p class="adm-meta">加载失败（' + (r.status || '网络错误') + '）</p>'; return; }
      var items = r.data.items || [];
      if (!items.length) { box.innerHTML = '<p class="adm-meta">该队列为空 🎉</p>'; return; }
      box.innerHTML = items.map(function (it) {
        var row = '<div class="row"><span class="mono">' + esc(it.id) + '</span>';
        row += chip(it.kind === 'image' ? '图像' : '文字', 'neutral');
        row += chip(it.targetType + ' · ' + esc(it.targetId), 'neutral');
        row += statusChip(it.status);
        if (it.priority === 'high') row += chip('高优先级', 'high');
        row += '<span class="adm-meta">' + fmtTime(it.createdAt) + '</span></div>';
        row += ruleHitChips(it.ruleHits) + aiChips(it.aiResult);
        row += '<div class="preview">' + esc(it.preview || '（无预览）') + '</div>';
        row += '<div class="actions">' +
          '<button class="btn btn-primary" data-mod-decide="approve" data-mid="' + esc(it.id) + '">通过</button>' +
          '<select class="adm-select" data-mod-action="' + esc(it.id) + '">' +
          '<option value="remove_content">仅下架（默认）</option>' +
          '<option value="warn">警告</option>' +
          '<option value="rate_limit">限发 24h</option>' +
          '<option value="mute">禁言 72h</option>' +
          '<option value="ban">封禁</option></select>' +
          '<input class="adm-input" data-mod-reason="' + esc(it.id) + '" placeholder="原因码（可选）" style="width:150px">' +
          '<button class="btn" data-mod-decide="reject" data-mid="' + esc(it.id) + '" style="border-color:#dc2626;color:#dc2626">拒绝</button>' +
          '</div>';
        return '<div class="adm-card">' + row + '</div>';
      }).join('');
    });
  }

  function modDecide(btn) {
    var mid = btn.dataset.mid;
    var verdict = btn.dataset.modDecide;
    var body = { verdict: verdict };
    var card = btn.closest('.adm-card');
    if (verdict === 'reject') {
      var sel = card && card.querySelector('[data-mod-action]');
      var reason = card && card.querySelector('[data-mod-reason]');
      body.action = sel ? sel.value : 'remove_content';
      if (reason && reason.value.trim()) body.reasonCode = reason.value.trim();
      if (!confirm('确认拒绝并执行「' + (sel ? sel.options[sel.selectedIndex].text : '仅下架') + '」？')) return;
    }
    MN_API.post('/admin/moderation/' + encodeURIComponent(mid) + '/decide', body).then(function (r) {
      if (r.ok) { toast('已处理 ' + mid); loadModList(); refreshStats(); }
      else toast('操作失败：' + (r.data && r.data.error && r.data.error.message || r.status));
    });
  }

  // ── 工单 ──
  var TK_FILTER_ZH = { queued: '待处理', in_progress: '已回复', closed: '已关闭', all: '全部' };
  $('pane-ticket').addEventListener('click', function (e) {
    var open = e.target.closest('[data-tk-open]');
    if (open) { openTicket(open.dataset.tkOpen); return; }
    var f = e.target.closest('[data-tk-filter]');
    if (f) { state.tkFilter = f.dataset.tkFilter; loadTickets(); return; }
    if (e.target.closest('#tkSendBtn')) { tkReply('reply'); return; }
    if (e.target.closest('#tkCloseBtn')) { tkReply('close'); }
  });

  function slaBadge(t) {
    if (t.status === 'closed') return '';
    var age = Date.now() - new Date(t.submittedAt).getTime();
    if (age > 3 * 24 * 3600e3) return '<span class="adm-sla">⚠ 已超 3 天 SLA</span>';
    return '';
  }

  function loadTickets(cb) {
    $('tkFilterLabel').textContent = TK_FILTER_ZH[state.tkFilter] || state.tkFilter;
    MN_API.get('/admin/tickets?status=' + encodeURIComponent(state.tkFilter)).then(function (r) {
      var box = $('ticketList');
      if (!r.ok || !r.data) { box.innerHTML = '<p class="adm-meta">加载失败（' + (r.status || '网络错误') + '）</p>'; if (cb) cb(); return; }
      var list = r.data.tickets || [];
      state.tkList = list;
      if (!list.length) { box.innerHTML = '<p class="adm-meta">该队列为空 🎉</p>'; if (cb) cb(); return; }
      // 卡片三行：标签与状态 / 标题 / 详细信息；点击整卡进入专属回复页
      box.innerHTML = list.map(function (t) {
        return '<div class="adm-card cursor-row" data-tk-open="' + esc(t.id) + '">' +
          '<div class="row">' +
          (t.priority === 'urgent' ? chip('紧急', 'high') : '') +
          chip((t.category || '') + '/' + (t.type || '—'), 'neutral') +
          statusChip(t.status) + slaBadge(t) + '</div>' +
          '<div style="font-weight:700;font-size:15px;margin:var(--space-xs) 0">' + esc(t.subject) + '</div>' +
          '<div class="row" style="gap:var(--space-md)"><span class="adm-meta mono">' + esc(t.id) + '</span>' +
          '<span class="adm-meta">' + esc(t.contact || '—') + '</span>' +
          '<span class="adm-meta">' + fmtTime(t.submittedAt) + '</span></div>' +
          '<div class="adm-meta" style="margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          esc(t.description) + '</div>' +
          '</div>';
      }).join('');
      if (cb) cb();
    });
  }

  // ── 专属回复页（列表 ⇄ 详情；#ticket:<id> 深链刷新可恢复） ──
  function openTicket(id) {
    var t = state.tkList.find(function (x) { return x.id === id; });
    if (!t) return;
    state.ticket = t;
    $('ticketListWrap').style.display = 'none';
    $('ticketDetail').style.display = 'block';
    renderTicketDetail(t);
    if (location.hash !== '#ticket:' + id) location.hash = 'ticket:' + id;
  }
  function closeTicketDetail() {
    $('ticketDetail').style.display = 'none';
    $('ticketListWrap').style.display = 'block';
    state.ticket = null;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  $('tkBackBtn').addEventListener('click', closeTicketDetail);

  // ── 回复模板弹窗：左侧模板菜单（左上角 + 添加）→ 右侧所选模板预览（语言切换）→ 使用填入回复框 ──
  // 内置 6 条三语模板 + 自定义模板（localStorage slati_admin_templates，admin 浏览器本地）；
  // 预览语言默认跟随工单提交语言；插入时先撤下上一次插入的模板文本再填新的
  var BUILTIN_TPLS = [
    { id: 'ack', name: '已收到工单', builtin: true,
      zh: '您好，我们已收到您的工单，正在为您核实处理中。处理进展会在此工单中同步，请耐心等待。',
      en: 'Hello, we have received your ticket and are currently looking into it. We will keep you updated in this thread — thank you for your patience.',
      ms: 'Hai, kami telah menerima tiket anda dan sedang menyiasatnya. Kami akan mengemas kini perkembangan dalam tiket ini — terima kasih atas kesabaran anda.' },
    { id: 'more', name: '需要更多信息', builtin: true,
      zh: '感谢您的耐心等待。为了更快地为您处理，请您补充以下信息：账号 / 邮箱、问题发生时间、相关截图。收到后我们会尽快跟进。',
      en: 'Thank you for your patience. To resolve this faster, please provide more details: account / email, when the issue occurred, and any relevant screenshots. We will follow up as soon as we receive them.',
      ms: 'Terima kasih atas kesabaran anda. Untuk menyelesaikan ini dengan lebih cepat, sila berikan maklumat lanjut: akaun / e-mel, masa isu berlaku, dan tangkapan skrin berkaitan. Kami akan susuli sebaik sahaja menerimanya.' },
    { id: 'resolved', name: '问题已解决', builtin: true,
      zh: '您好，您反馈的问题我们已处理完成。如仍有疑问，欢迎随时通过工单联系我们。感谢您对 M.NationWorld 的支持！',
      en: 'Hello, the issue you reported has been resolved. If you have any further questions, feel free to reach out via a new ticket. Thank you for supporting M.NationWorld!',
      ms: 'Hai, isu yang anda laporkan telah diselesaikan. Jika ada sebarang soalan lanjut, sila hubungi kami melalui tiket. Terima kasih kerana menyokong M.NationWorld!' },
    { id: 'escalated', name: '已转交相关部门', builtin: true,
      zh: '您好，您的问题已转交相关部门优先处理，我们会在有进展后第一时间通过本工单通知您。',
      en: 'Hello, your issue has been escalated to the relevant team for priority handling. We will notify you in this thread as soon as there is progress.',
      ms: 'Hai, isu anda telah diserahkan kepada pasukan berkaitan untuk diproses secara keutamaan. Kami akan memaklumkan anda dalam tiket ini sebaik sahaja terdapat perkembangan.' },
    { id: 'rules', name: '社区规则处理', builtin: true,
      zh: '经核实，您的内容 / 账号因违反《社区规则》已被相应处理。如对处理有异议，可提交工单说明情况申请复核。',
      en: 'After review, your content / account has been penalized for violating the Community Rules. If you disagree with this decision, you may submit a ticket explaining the situation to request a review.',
      ms: 'Selepas semakan, kandungan / akaun anda telah dikenakan tindakan kerana melanggar Peraturan Komuniti. Jika anda tidak bersetuju, anda boleh menghantar tiket menerangkan situasi untuk memohon semakan.' },
    { id: 'refund', name: '退款政策', builtin: true,
      zh: '很抱歉，根据平台政策，虚拟内容 / 服务一经开通不支持退款。如为重复扣费，请提供支付凭证，我们会优先为您核查处理。',
      en: 'We are sorry — per platform policy, virtual content / services are non-refundable once activated. If you were charged twice, please attach your payment receipt and we will prioritize the check for you.',
      ms: 'Maaf — mengikut polisi platform, kandungan / perkhidmatan maya tidak boleh dikembalikan selepas diaktifkan. Jika anda dicaj dua kali, sila lampirkan resit pembayaran dan kami akan utamakan semakan untuk anda.' }
  ];
  var TPL_KEY = 'slati_admin_templates';
  // 支持语言：联合国六种工作语言 + 马来文 / 印尼文 / 泰文 / 越南文
  var TPL_LANGS = [
    { id: 'zh', name: '中文' }, { id: 'en', name: 'English' }, { id: 'ar', name: 'العربية' },
    { id: 'fr', name: 'Français' }, { id: 'ru', name: 'Русский' }, { id: 'es', name: 'Español' },
    { id: 'ms', name: 'Bahasa Melayu' }, { id: 'id', name: 'Bahasa Indonesia' },
    { id: 'th', name: 'ไทย' }, { id: 'vi', name: 'Tiếng Việt' }
  ];
  function getCustomTpls() {
    try { return JSON.parse(localStorage.getItem(TPL_KEY) || '[]'); } catch (e) { return []; }
  }
  function allTpls() { return getCustomTpls().concat(BUILTIN_TPLS); } // 自定义在上
  function ticketLang() {
    var t = state.ticket;
    return (t && t.locale && TPL_LANGS.some(function (l) { return l.id === t.locale; })) ? t.locale : 'zh';
  }
  // 语言无内容 → 回退中文（无中文 → 首个非空语言）；fb 供预览提示
  function tplText(tpl, lang) {
    if (tpl && tpl[lang]) return { text: tpl[lang], fb: false };
    if (tpl) {
      var ids = TPL_LANGS.map(function (l) { return l.id; });
      var text = tpl.zh || ids.map(function (l) { return tpl[l]; }).find(function (x) { return x; }) || '';
      return { text: text, fb: true };
    }
    return { text: '', fb: false };
  }
  function renderTplMenu() {
    var box = $('tkTplMenu');
    box.innerHTML = allTpls().map(function (tpl) {
      return '<div class="tk-menu-item' + (state.tplSel === tpl.id ? ' active' : '') + '" data-tpl-id="' + esc(tpl.id) + '">' +
        '<span>' + esc(tpl.name) + '</span>' +
        (tpl.builtin ? '' : '<span class="tk-del" data-tpl-del="' + esc(tpl.id) + '" title="删除">✕</span>') +
        '</div>';
    }).join('') || '<p class="adm-meta">暂无模板，点左上角 + 添加</p>';
  }
  function renderTplPreview() {
    var tpl = allTpls().find(function (x) { return x.id === state.tplSel; });
    $('tkTplPreviewName').textContent = tpl ? tpl.name : '—';
    if (tpl) {
      var r = tplText(tpl, state.tplLang);
      $('tkTplPreviewText').textContent = (r.text || '（无内容）') +
        (r.fb ? '\n\n（该语言暂无内容，已回退显示其他语言版本）' : '');
    } else {
      $('tkTplPreviewText').textContent = '从左侧选择一个模板';
    }
    $('tkTplLangSel').value = state.tplLang;
  }
  function selectTpl(id) {
    state.tplSel = id;
    renderTplMenu();
    renderTplPreview();
  }
  function openTplModal() {
    state.tplLang = ticketLang(); // 预览语言默认 = 工单提交语言
    renderTplMenu();
    renderTplPreview();
    $('tkTplModal').style.display = 'flex';
  }
  function closeTplModal() { $('tkTplModal').style.display = 'none'; }
  function closeTplAdd() { $('tkTplAddModal').style.display = 'none'; }
  function insertTpl(text) {
    var ta = $('tkInput');
    if (!ta || !text) return;
    // 先撤下上一次插入的模板文本（仍在末尾则精确移除）
    if (state.tkTpl && ta.value.slice(-state.tkTpl.text.length) === state.tkTpl.text) {
      ta.value = ta.value.slice(0, ta.value.length - state.tkTpl.text.length).replace(/\n$/, '');
    }
    if (ta.value && ta.value.charAt(ta.value.length - 1) !== '\n') ta.value += '\n';
    ta.value += text;
    state.tkTpl = { text: text };
  }
  $('tkTplMenu').addEventListener('click', function (e) {
    var del = e.target.closest('[data-tpl-del]');
    if (del) {
      if (!confirm('删除模板？')) return;
      localStorage.setItem(TPL_KEY, JSON.stringify(getCustomTpls().filter(function (x) { return x.id !== del.dataset.tplDel; })));
      if (state.tplSel === del.dataset.tplDel) state.tplSel = null;
      renderTplMenu(); renderTplPreview();
      return;
    }
    var item = e.target.closest('[data-tpl-id]');
    if (item) selectTpl(item.dataset.tplId);
  });
  // 语言下拉（静态选项，只在预览时同步选中值）+ 添加表单十语 textarea（动态生成）
  $('tkTplLangSel').innerHTML = TPL_LANGS.map(function (l) {
    return '<option value="' + l.id + '">' + esc(l.name) + '</option>';
  }).join('');
  $('tkTplLangSel').addEventListener('change', function () { state.tplLang = this.value; renderTplPreview(); });
  $('tkTplAddLangs').innerHTML = TPL_LANGS.map(function (l) {
    return '<label class="adm-meta">' + esc(l.name) +
      '<textarea class="adm-textarea" data-tpl-add-lang="' + l.id + '" placeholder="' + esc(l.name) +
      ' 内容" style="min-height:44px;margin-top:2px"></textarea></label>';
  }).join('');
  $('tkTplCloseBtn').addEventListener('click', closeTplModal);
  $('tkTplModal').addEventListener('click', function (e) { if (e.target === this) closeTplModal(); });
  $('tkTplUseBtn').addEventListener('click', function () {
    var tpl = allTpls().find(function (x) { return x.id === state.tplSel; });
    if (!tpl) { toast('请先选择一个模板'); return; }
    insertTpl(tplText(tpl, state.tplLang).text);
    closeTplModal();
  });
  $('tkTplAddBtn').addEventListener('click', function () { $('tkTplAddModal').style.display = 'flex'; });
  $('tkTplAddCancel').addEventListener('click', closeTplAdd);
  $('tkTplAddCloseBtn').addEventListener('click', closeTplAdd);
  $('tkTplAddModal').addEventListener('click', function (e) { if (e.target === this) closeTplAdd(); });
  $('tkTplAddSave').addEventListener('click', function () {
    var name = $('tkTplAddName').value.trim();
    if (!name) { toast('模板名称必填'); return; }
    var tpl = { id: 'tpl_' + Date.now(), name: name };
    var filled = 0;
    TPL_LANGS.forEach(function (l) {
      var v = document.querySelector('[data-tpl-add-lang="' + l.id + '"]').value.trim();
      tpl[l.id] = v;
      if (v) filled++;
    });
    if (!filled) { toast('至少填写一种语言的内容'); return; }
    var customs = getCustomTpls();
    customs.unshift(tpl);
    localStorage.setItem(TPL_KEY, JSON.stringify(customs));
    $('tkTplAddName').value = '';
    document.querySelectorAll('[data-tpl-add-lang]').forEach(function (el) { el.value = ''; });
    closeTplAdd();
    state.tplLang = ticketLang();
    selectTpl(tpl.id); // 新模板选中并预览
    toast('模板已添加');
  });

  function renderTicketDetail(t) {
    var h = '<div class="row">' +
      (t.priority === 'urgent' ? chip('紧急', 'high') : '') +
      chip((t.category || '') + '/' + (t.type || '—'), 'neutral') +
      statusChip(t.status) + slaBadge(t) + '</div>' +
      '<h3 class="tk-title headline-md" style="margin:var(--space-sm) 0 var(--space-xs)">' + esc(t.subject) + '</h3>' +
      '<div class="adm-meta row" style="gap:var(--space-md)"><span class="mono">' + esc(t.id) + '</span>' +
      '<span>联系方式：' + esc(t.contact || '—') + '</span><span>提交于 ' + fmtTime(t.submittedAt) + '</span></div>' +
      '<div class="adm-card"><h3 class="headline-sm" style="margin-bottom:var(--space-sm)">详细信息</h3>' +
      '<div class="preview">' + esc(t.description) + '</div></div>';
    if (t.replies && t.replies.length) {
      h += '<div class="adm-card"><h3 class="headline-sm" style="margin-bottom:var(--space-xs)">回复记录（' + t.replies.length + '）</h3>' +
        t.replies.map(function (rp) {
          return '<div class="timeline-item">' + chip(rp.authorType === 'admin' ? '官方回复' : '用户', rp.authorType === 'admin' ? 'ok' : 'neutral') +
            ' ' + esc(rp.body) + ' <span class="adm-meta">' + fmtTime(rp.createdAt) + '</span></div>';
        }).join('') + '</div>';
    }
    if (t.status !== 'closed') {
      h += '<div class="adm-card"><h3 class="headline-sm" style="margin-bottom:var(--space-sm)">回复此工单</h3>' +
        '<div class="row" style="margin-bottom:var(--space-sm)">' +
        '<button class="btn" id="tkTplBtn" title="选择回复模板"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">description</span> 模板</button></div>' +
        '<textarea class="adm-textarea" id="tkInput" placeholder="回复内容（1-4000 字）" style="min-height:180px"></textarea>' +
        '<div class="actions"><button class="btn btn-primary" id="tkSendBtn">发送回复</button>' +
        '<button class="btn" id="tkCloseBtn" style="border-color:#dc2626;color:#dc2626">关闭工单</button></div></div>';
    }
    $('ticketDetailBody').innerHTML = h;
    state.tkTpl = null;
    if (t.status !== 'closed') $('tkTplBtn').addEventListener('click', openTplModal);
  }

  // 回复/关闭后重拉详情（status=all 兜底：关闭后的工单可能不在当前筛选）
  function reloadTicket() {
    var id = state.ticket && state.ticket.id;
    if (!id) return;
    MN_API.get('/admin/tickets?status=all').then(function (r) {
      if (!r.ok || !r.data) return;
      var t = (r.data.tickets || []).find(function (x) { return x.id === id; });
      if (t) { state.ticket = t; renderTicketDetail(t); }
      loadTickets();
      refreshStats();
    });
  }

  function tkReply(mode) {
    var id = state.ticket && state.ticket.id;
    if (!id) return;
    if (mode === 'reply') {
      var content = $('tkInput').value.trim();
      if (!content) { toast('回复内容不能为空'); return; }
      $('tkReplyModal').style.display = 'flex'; // 弹窗选择回复后状态（等待下一步 / 已完成）
    } else {
      if (!confirm('确认关闭工单 ' + id + ' ？')) return;
      MN_API.post('/admin/tickets/' + encodeURIComponent(id) + '/close', {}).then(function (r) {
        if (r.ok) { toast('已关闭'); reloadTicket(); }
        else toast('关闭失败：' + (r.data && r.data.error && r.data.error.message || r.status));
      });
    }
  }

  // 发送回复 + 可选关闭：wait → 回复后进「已回复」队列等待用户；done → 回复并关闭
  function sendReply(done) {
    var id = state.ticket && state.ticket.id;
    var content = $('tkInput').value.trim();
    if (!id || !content) return;
    $('tkReplyModal').style.display = 'none';
    MN_API.post('/admin/tickets/' + encodeURIComponent(id) + '/reply', { content: content }).then(function (r) {
      if (!r.ok) { toast('回复失败：' + (r.data && r.data.error && r.data.error.message || r.status)); return; }
      if (!done) { toast('已回复，工单进入「已回复」队列'); reloadTicket(); return; }
      MN_API.post('/admin/tickets/' + encodeURIComponent(id) + '/close', {}).then(function (r2) {
        toast(r2.ok ? '已回复并完成' : '回复成功但关闭失败：' + (r2.data && r2.data.error && r2.data.error.message || r2.status));
        reloadTicket();
      });
    });
  }
  $('tkReplyWait').addEventListener('click', function () { sendReply(false); });
  $('tkReplyDone').addEventListener('click', function () { sendReply(true); });
  $('tkReplyCancel').addEventListener('click', function () { $('tkReplyModal').style.display = 'none'; });
  $('tkReplyCloseBtn').addEventListener('click', function () { $('tkReplyModal').style.display = 'none'; });
  $('tkReplyModal').addEventListener('click', function (e) { if (e.target === this) this.style.display = 'none'; });

  // ── 徽章码 ──
  $('bgIssueBtn').addEventListener('click', function () {
    var alias = $('bgAlias').value.trim();
    var role = $('bgRole').value.trim();
    var duties = $('bgDuties').value.trim();
    var ttl = Number($('bgTtl').value) || 12;
    if (!alias || !role || !duties) { toast('化名 / 职位 / 负责事项均必填'); return; }
    MN_API.post('/admin/badge/issue', { alias: alias, role: role, duties: duties, ttlHours: ttl }).then(function (r) {
      if (!r.ok) { toast('签发失败：' + (r.data && r.data.error && r.data.error.message || r.status)); return; }
      $('bgCode').textContent = r.data.code;
      $('bgExpires').textContent = '有效期至 ' + fmtTime(r.data.expiresAt) + '（' + (ttl) + 'h）';
      $('bgIssued').style.display = 'block';
      loadBadges();
      toast('已签发（只显示这一次）');
    });
  });
  $('bgCopyBtn').addEventListener('click', function () {
    var code = $('bgCode').textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () { toast('已复制到剪贴板'); });
    } else {
      var sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents($('bgCode')); sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('copy');
      toast('已复制到剪贴板');
    }
  });

  function loadBadges() {
    MN_API.get('/admin/badge/list').then(function (r) {
      var box = $('badgeList');
      if (!r.ok || !r.data) { box.innerHTML = '<p class="adm-meta">加载失败</p>'; return; }
      var list = r.data.badges || [];
      if (!list.length) { box.innerHTML = '<p class="adm-meta">暂无有效验证码</p>'; return; }
      box.innerHTML = '<div style="overflow-x:auto"><table class="adm-table"><thead><tr>' +
        '<th>验证码</th><th>化名</th><th>职位</th><th>负责事项</th><th>签发</th><th>过期</th><th></th></tr></thead><tbody>' +
        list.map(function (b) {
          return '<tr><td class="mono">' + esc(b.code) + '</td><td>' + esc(b.alias) + '</td><td>' + esc(b.role) +
            '</td><td>' + esc(b.duties) + '</td><td class="adm-meta">' + fmtTime(b.issuedAt) + '</td><td class="adm-meta">' +
            fmtTime(b.expiresAt) + '</td><td><button class="btn" data-bg-revoke="' + esc(b.code) + '" style="border-color:#dc2626;color:#dc2626;font-size:12px;padding:4px 10px">吊销</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    });
  }
  $('badgeList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bg-revoke]');
    if (!b) return;
    var code = b.dataset.bgRevoke;
    if (!confirm('确认吊销验证码 ' + code + ' ？吊销后立即失效。')) return;
    MN_API.post('/admin/badge/' + encodeURIComponent(code) + '/revoke', {}).then(function (r) {
      if (r.ok) { toast('已吊销 ' + code); loadBadges(); }
      else toast('吊销失败：' + (r.data && r.data.error && r.data.error.message || r.status));
    });
  });

  // ── 用户 ──
  $('usrSearchBtn').addEventListener('click', loadUsers);
  $('usrQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') loadUsers(); });

  function loadUsers() {
    var q = $('usrQ').value.trim();
    MN_API.get('/admin/users?q=' + encodeURIComponent(q)).then(function (r) {
      if (!r.ok || !r.data) { $('usrRows').innerHTML = '<tr><td colspan="6" class="adm-meta">加载失败</td></tr>'; return; }
      var list = r.data.users || [];
      $('usrRows').innerHTML = list.map(function (u) {
        var t = '<tr class="cursor-row" data-uid="' + esc(u.id) + '">' +
          '<td>' + esc(u.displayName || '—') + ' <span class="adm-meta mono">' + esc(u.citizenId || '') + '</span></td>' +
          '<td>' + esc(u.email) + '</td>' +
          '<td>' + chip(u.tier, u.tier === 'basic' ? 'neutral' : 'ok') + '</td>' +
          '<td>' + statusChip(u.status) + (u.mutedUntil ? ' <span class="adm-sla">禁言中</span>' : '') + '</td>' +
          '<td>' + (u.warningCount || 0) + '</td>' +
          '<td class="adm-meta">' + fmtTime(u.createdAt) + '</td></tr>';
        if (u.role === 'admin') t = t.replace('<td>' + esc(u.displayName || '—'), '<td>' + esc(u.displayName || '—') + ' ' + chip('管理员', 'ok'));
        return t;
      }).join('') || '<tr><td colspan="6" class="adm-meta">无结果</td></tr>';
    });
  }
  $('usrRows').addEventListener('click', function (e) {
    var tr = e.target.closest('[data-uid]');
    if (!tr) return;
    state.selUserId = tr.dataset.uid;
    document.querySelectorAll('#usrRows tr').forEach(function (r) { r.style.background = ''; });
    tr.style.background = 'var(--color-surface-variant, rgba(128,128,128,0.1))';
    loadUserDetail(state.selUserId);
  });

  function loadUserDetail(id) {
    MN_API.get('/admin/users/' + encodeURIComponent(id)).then(function (r) {
      if (!r.ok || !r.data) { toast('详情加载失败'); return; }
      var u = r.data.user;
      $('udId').textContent = u.id;
      $('udTier').value = u.tier;
      $('udTierNote').textContent = u.email + ' · 警告 ' + u.warningCount + ' · ' + (u.mutedUntil ? '禁言至 ' + fmtTime(u.mutedUntil) : '未禁言');
      $('udTimeline').innerHTML = (r.data.decisions || []).map(function (d) {
        return '<div class="timeline-item">' + chip(d.action, d.action === 'restore' ? 'ok' : d.action === 'warn' ? 'warn' : 'high') +
          ' <span class="adm-meta">' + esc(d.actor || '') + '</span>' +
          (d.reasonCode ? ' <span class="mono">' + esc(d.reasonCode) + '</span>' : '') +
          (d.notes ? ' <span class="adm-meta">' + esc(d.notes) + '</span>' : '') +
          ' <span class="adm-meta">' + fmtTime(d.createdAt) + '</span></div>';
      }).join('') || '<p class="adm-meta">无处罚记录</p>';
      $('userDetail').style.display = 'block';
    });
  }
  $('udTierBtn').addEventListener('click', function () {
    if (!state.selUserId) return;
    var tier = $('udTier').value;
    MN_API.patch('/admin/users/' + encodeURIComponent(state.selUserId), { tier: tier }).then(function (r) {
      if (r.ok) { toast('tier → ' + tier); loadUsers(); loadUserDetail(state.selUserId); }
      else toast('失败：' + (r.data && r.data.error && r.data.error.message || r.status));
    });
  });
  $('udPenBtn').addEventListener('click', function () {
    if (!state.selUserId) return;
    var action = $('udPenAction').value;
    var reason = $('udPenReason').value.trim();
    if (!confirm('确认对 ' + state.selUserId + ' 执行 ' + action + ' ？')) return;
    MN_API.post('/admin/penalties', { userId: state.selUserId, action: action, reasonCode: reason || null }).then(function (r) {
      if (r.ok) { toast('已执行 ' + action); loadUsers(); loadUserDetail(state.selUserId); refreshStats(); }
      else toast('失败：' + (r.data && r.data.error && r.data.error.message || r.status));
    });
  });

  // ── 成本看板 ──
  var FEATURE_ZH = { moderation_text: '文字审核', chat: 'AI 客服', moderation_image: '图像审核', total: '总预算' };
  function loadUsage() {
    MN_API.get('/admin/usage').then(function (r) {
      if (!r.ok || !r.data) return;
      state.usage = r.data;
      renderUsageBars(r.data);
      renderUsageRows(r.data);
      renderBudget(r.data);
      renderBanner(r.data);
    });
  }
  function renderBanner(d) {
    var b = $('admBanner');
    if (!d.total || d.total.state === 'ok') { b.style.display = 'none'; return; }
    b.style.display = 'block';
    b.style.background = d.total.state === 'exhausted' ? 'rgba(220,38,38,0.12)' : 'rgba(234,179,8,0.15)';
    b.style.borderColor = d.total.state === 'exhausted' ? 'rgba(220,38,38,0.4)' : 'rgba(234,179,8,0.4)';
    b.style.color = d.total.state === 'exhausted' ? '#dc2626' : '#b45309';
    b.textContent = d.total.state === 'exhausted'
      ? '⚠ 本月预算已耗尽：AI 审核 / 客服已降级为规则 + 人工（登录、发帖、私讯不受影响）。'
      : '⚠ 本月预算消耗 ≥80%：AI 功能可能随时降级，请关注成本看板。';
  }
  function renderUsageBars(d) {
    var rows = ['moderation_text', 'chat', 'moderation_image', 'total'].map(function (f) {
      var s = f === 'total' ? d.total : d.byFeature[f];
      if (!s) return '';
      var pct = Math.min(100, Math.round(s.ratio * 100));
      var cls = s.state === 'exhausted' ? 'bad' : s.state === 'warn' ? 'warn' : '';
      return '<div class="adm-card" style="margin-bottom:var(--space-sm)"><div class="row" style="justify-content:space-between;margin-bottom:6px">' +
        '<strong>' + FEATURE_ZH[f] + '</strong>' +
        '<span class="adm-meta">' + fmtYuan(s.spent) + ' / ' + fmtLimit(s.limit) + '（' + pct + '%）</span></div>' +
        '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%"></div></div></div>';
    });
    $('usageBars').innerHTML = rows.join('');
  }
  function renderUsageRows(d) {
    $('usageRows').innerHTML = (d.recent || []).map(function (u) {
      return '<tr><td class="adm-meta">' + fmtTime(u.createdAt) + '</td><td>' + esc(u.feature) + '</td>' +
        '<td>' + (u.tokensIn || 0) + '</td><td>' + (u.tokensOut || 0) + '</td><td>' + (u.tokensCached || 0) + '</td>' +
        '<td class="mono">' + fmtYuan(u.costMicro, 4) + '</td><td class="adm-meta">' + esc(u.batchId || '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="adm-meta">本月暂无用量记录</td></tr>';
  }
  function renderBudget(d) {
    // 显示当前额度（usage 无 limits 时回退 GET /admin/budget）
    if (d.byFeature && d.byFeature.chat && d.byFeature.chat.limit != null) {
      state.budgets = {
        moderation_text: d.byFeature.moderation_text.limit,
        chat: d.byFeature.chat.limit,
        moderation_image: d.byFeature.moderation_image.limit,
        total: d.total.limit
      };
      fillBudgetInputs();
    } else {
      MN_API.get('/admin/budget').then(function (r) {
        if (r.ok && r.data) { state.budgets = r.data.limits || {}; fillBudgetInputs(); }
      });
    }
  }
  function fillBudgetInputs() {
    $('bgText').value = state.budgets.moderation_text;
    $('bgChat').value = state.budgets.chat;
    $('bgImage').value = state.budgets.moderation_image;
    $('bgTotal').value = state.budgets.total;
  }
  $('budgetSaveBtn').addEventListener('click', function () {
    var pairs = [
      ['moderation_text', $('bgText').value],
      ['chat', $('bgChat').value],
      ['moderation_image', $('bgImage').value],
      ['total', $('bgTotal').value]
    ];
    var pending = pairs.filter(function (p) {
      var v = Number(p[1]);
      return Number.isFinite(v) && v >= 0 && v !== Number(state.budgets[p[0]]);
    });
    if (!pending.length) { toast('没有变化'); return; }
    var i = 0;
    function next() {
      if (i >= pending.length) { toast('预算已保存'); loadUsage(); return; }
      var p = pending[i++];
      MN_API.request('/admin/budget', { method: 'PUT', body: { feature: p[0], yuan: Number(p[1]) } }).then(function (r) {
        if (r.ok) next();
        else toast('保存 ' + p[0] + ' 失败：' + (r.data && r.data.error && r.data.error.message || r.status));
      });
    }
    next();
  });

  // ── 启动 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
