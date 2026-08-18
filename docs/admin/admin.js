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
    in_progress: '处理中', closed: '已关闭', active: '正常', banned: '已封禁',
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

  $('sendCodeBtn').addEventListener('click', function () {
    var email = $('loginEmail').value.trim();
    if (!email) { setLoginMsg('请输入管理员邮箱', true); return; }
    MN_API.post('/auth/email-code', { email: email }).then(function (r) {
      if (r.ok) {
        $('codeRow').style.display = 'flex';
        setLoginMsg('验证码已发送至 ' + email + '，10 分钟内有效');
        countdown(60);
      } else if (r.status === 429) {
        setLoginMsg('请求过于频繁，请稍后再试', true);
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
    });
  }

  // ── 总览 ──
  function refreshStats() {
    MN_API.get('/admin/stats').then(function (r) {
      if (!r.ok || !r.data) return;
      var d = r.data;
      $('stUsers').textContent = d.users;
      $('stPosts').textContent = d.posts;
      var m = d.moderationItems || {};
      var modTotal = (m.l0_hold || 0) + (m.queued || 0) + (m.needs_human || 0) + (m.ai_rejected || 0);
      $('stMod').textContent = modTotal;
      $('stModLabel').title = 'l0_hold ' + (m.l0_hold || 0) + ' · queued ' + (m.queued || 0) +
        ' · needs_human ' + (m.needs_human || 0) + ' · ai_rejected ' + (m.ai_rejected || 0);
      $('stTickets').textContent = d.openTickets;
      $('stCost').textContent = fmtYuan(d.monthCostMicro);
      var b = $('stBudget');
      b.textContent = d.budgetState === 'ok' ? '正常' : d.budgetState === 'warn' ? '≥80%' : '已耗尽';
      b.style.color = d.budgetState === 'ok' ? '#16a34a' : d.budgetState === 'warn' ? '#b45309' : '#dc2626';
    });
  }

  // ── Tab 切换（懒加载） ──
  var loaded = { ticket: false, badge: false, user: false };
  $('admTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-tab]');
    if (!btn) return;
    var tab = btn.dataset.tab;
    document.querySelectorAll('.adm-tab').forEach(function (b) { b.classList.toggle('active', b === btn); });
    ['mod', 'ticket', 'badge', 'user', 'usage'].forEach(function (t) {
      $('pane-' + t).style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'ticket' && !loaded.ticket) { loaded.ticket = true; loadTickets(); }
    if (tab === 'badge' && !loaded.badge) { loaded.badge = true; loadBadges(); }
    if (tab === 'user' && !loaded.user) { loaded.user = true; loadUsers(); }
    if (tab === 'usage') loadUsage();
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
  var TK_FILTER_ZH = { queued: '待处理', in_progress: '处理中', closed: '已关闭', all: '全部' };
  $('pane-ticket').addEventListener('click', function (e) {
    var f = e.target.closest('[data-tk-filter]');
    if (f) { state.tkFilter = f.dataset.tkFilter; loadTickets(); return; }
    var send = e.target.closest('[data-tk-send]');
    if (send) { tkReply(send.dataset.tkSend, 'reply'); return; }
    var close = e.target.closest('[data-tk-close]');
    if (close) { tkReply(close.dataset.tkClose, 'close'); }
  });

  function slaBadge(t) {
    if (t.status === 'closed') return '';
    var age = Date.now() - new Date(t.submittedAt).getTime();
    if (age > 3 * 24 * 3600e3) return '<span class="adm-sla">⚠ 已超 3 天 SLA</span>';
    return '';
  }

  function loadTickets() {
    $('tkFilterLabel').textContent = TK_FILTER_ZH[state.tkFilter] || state.tkFilter;
    MN_API.get('/admin/tickets?status=' + encodeURIComponent(state.tkFilter)).then(function (r) {
      var box = $('ticketList');
      if (!r.ok || !r.data) { box.innerHTML = '<p class="adm-meta">加载失败（' + (r.status || '网络错误') + '）</p>'; return; }
      var list = r.data.tickets || [];
      if (!list.length) { box.innerHTML = '<p class="adm-meta">该队列为空 🎉</p>'; return; }
      box.innerHTML = list.map(function (t) {
        var row = '<div class="row"><span class="mono">' + esc(t.id) + '</span>';
        if (t.priority === 'urgent') row += chip('紧急', 'high');
        row += chip((t.category || '') + '/' + (t.type || '—'), 'neutral');
        row += statusChip(t.status);
        row += '<span class="adm-meta">联系方式：' + esc(t.contact || '—') + '</span>';
        row += '<span class="adm-meta">提交于 ' + fmtTime(t.submittedAt) + '</span>';
        row += slaBadge(t) + '</div>';
        row += '<div style="font-weight:700;margin:var(--space-xs) 0">' + esc(t.subject) + '</div>';
        row += '<div class="preview">' + esc(t.description) + '</div>';
        if (t.replies && t.replies.length) {
          row += '<div style="margin-top:var(--space-xs)">' + t.replies.map(function (rp) {
            return '<div class="timeline-item">' + chip(rp.authorType === 'admin' ? '官方回复' : '用户', rp.authorType === 'admin' ? 'ok' : 'neutral') +
              ' ' + esc(rp.body) + ' <span class="adm-meta">' + fmtTime(rp.createdAt) + '</span></div>';
          }).join('') + '</div>';
        }
        if (t.status !== 'closed') {
          row += '<div class="actions">' +
            '<textarea class="adm-textarea" data-tk-input="' + esc(t.id) + '" placeholder="回复内容（1-4000 字）"></textarea>' +
            '<button class="btn btn-primary" data-tk-send="' + esc(t.id) + '">回复</button>' +
            '<button class="btn" data-tk-close="' + esc(t.id) + '">关闭工单</button></div>';
        }
        return '<div class="adm-card">' + row + '</div>';
      }).join('');
    });
  }

  function tkReply(id, mode) {
    var card = document.querySelector('[data-tk-send="' + id + '"]') || document.querySelector('[data-tk-close="' + id + '"]');
    card = card && card.closest('.adm-card');
    if (mode === 'reply') {
      var ta = card && card.querySelector('[data-tk-input]');
      var content = ta ? ta.value.trim() : '';
      if (!content) { toast('回复内容不能为空'); return; }
      MN_API.post('/admin/tickets/' + encodeURIComponent(id) + '/reply', { content: content }).then(function (r) {
        if (r.ok) { toast('已回复'); loadTickets(); refreshStats(); }
        else toast('回复失败：' + (r.data && r.data.error && r.data.error.message || r.status));
      });
    } else {
      if (!confirm('确认关闭工单 ' + id + ' ？')) return;
      MN_API.post('/admin/tickets/' + encodeURIComponent(id) + '/close', {}).then(function (r) {
        if (r.ok) { toast('已关闭'); loadTickets(); refreshStats(); }
        else toast('关闭失败：' + (r.data && r.data.error && r.data.error.message || r.status));
      });
    }
  }

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
        '<span class="adm-meta">' + fmtYuan(s.spent) + ' / ' + fmtYuan(s.limit) + '（' + pct + '%）</span></div>' +
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
