/* SlatiControl 壳（v2）：boot（/staff/auth/me 三态）→ staff 登录（W6：密码 + email-code 双因素）
   → 导航壳（§30 十二组）→ #hash 深链路由 → 页面渲染。
   登录态三态：adminLogin（登录）/ adminGate（无权限或后端不可达）/ adminRoot（面板）；
   W6 附属：adminSetPassword（旧 staff 首登设密引导）/ adminResetPassword（忘记密码两步重置）。
   W2 只交付 Dashboard/Analytics/Users/Security 四页；其余导航组渲染「建设中」占位。
   v0.2.54.0 i18n：全部 UI 字符串渲染处取 T()（字典在 app.js 前加载）；zh 值逐字节=现有文案。 */
(function () {
  'use strict';
  const { h, esc, toast } = UI;

  // v0.2.54.0 i18n：T(key) 取当前语言；回落原文
  const T = (k) => (window.MN_I18N && window.MN_I18N.t(k)) || null;

  const ROLE_ZH = { project_director: '项目总监', customer_support: '客服', finance: '财务', moderation: '审核', security: '安全', technical: '技术', management: '管理' };
  const ROLE_KEY = { project_director: 'admin.role.director', customer_support: 'admin.role.cs', finance: 'admin.role.finance', moderation: 'admin.role.moderation', security: 'admin.role.security', technical: 'admin.role.technical', management: 'admin.role.management' };

  // §30 十二顶级导航组：英文菜单 + 中文副标题；W2 外条目 → #/todo/<id>（建设中占位）
  // kEn/kZh=组名 i18n 键；条目 k=条目名 i18n 键（缺省用组 kEn）
  const NAV = [
    { en: 'Dashboard', zh: '总览', kEn: 'admin.nav.dashboard.en', kZh: 'admin.nav.dashboard.zh', icon: 'dashboard', item: { label: 'Dashboard', route: 'dashboard' } },
    { en: 'Analytics', zh: '分析', kEn: 'admin.nav.analytics.en', kZh: 'admin.nav.analytics.zh', icon: 'insights', item: { label: 'Analytics', route: 'analytics' } },
    { en: 'Users', zh: '用户', kEn: 'admin.nav.users.en', kZh: 'admin.nav.users.zh', icon: 'group', item: { label: 'Users', route: 'users' } },
    { en: 'Content', zh: '内容', kEn: 'admin.nav.content.en', kZh: 'admin.nav.content.zh', icon: 'article', item: { label: 'Content', todo: 'content', wave: 5 } },
    { en: 'Community', zh: '社区', kEn: 'admin.nav.community.en', kZh: 'admin.nav.community.zh', icon: 'forum', item: { label: 'Community', todo: 'community', wave: 5 } },
    { en: 'Finance', zh: '财务', kEn: 'admin.nav.finance.en', kZh: 'admin.nav.finance.zh', icon: 'payments', items: [
      { label: 'Overview', k: 'admin.nav.item.overview', todo: 'finance.overview', wave: 4 }, { label: 'Revenue', k: 'admin.nav.item.revenue', todo: 'finance.revenue', wave: 4 },
      { label: 'Subscriptions', k: 'admin.nav.item.subscriptions', todo: 'finance.subscriptions', wave: 4 }, { label: 'ARPU / ARPPU', k: 'admin.nav.item.arpu', todo: 'finance.arpu', wave: 4 },
      { label: 'Refunds', k: 'admin.nav.item.refunds', todo: 'finance.refunds', wave: 4 }, { label: 'Costs', k: 'admin.nav.item.costs', todo: 'finance.costs', wave: 4 },
      { label: 'Payroll', k: 'admin.nav.item.payroll', todo: 'finance.payroll', wave: 4 }, { label: 'Donations', k: 'admin.nav.item.donations', todo: 'finance.donations', wave: 4 }
    ] },
    { en: 'Customer Service', zh: '客服', kEn: 'admin.nav.cs.en', kZh: 'admin.nav.cs.zh', icon: 'support_agent', item: { label: 'Tickets', k: 'admin.nav.item.tickets', todo: 'cs.tickets', wave: 3 } },
    { en: 'AI Assistant', zh: 'AI 辅助', kEn: 'admin.nav.ai.en', kZh: 'admin.nav.ai.zh', icon: 'smart_toy', item: { label: 'Copilot', k: 'admin.nav.item.copilot', todo: 'ai.copilot', wave: 3 } },
    { en: 'Security', zh: '安全', kEn: 'admin.nav.security.en', kZh: 'admin.nav.security.zh', icon: 'security', item: { label: 'Security', route: 'security' } },
    { en: 'Staff', zh: '工作人员', kEn: 'admin.nav.staff.en', kZh: 'admin.nav.staff.zh', icon: 'badge', items: [
      { label: 'Staff', k: 'admin.nav.item.staff', todo: 'staff.list', wave: 4 }, { label: 'Roles', k: 'admin.nav.item.roles', todo: 'staff.roles', wave: 4 },
      { label: 'Permissions', k: 'admin.nav.item.permissions', todo: 'staff.permissions', wave: 4 }, { label: 'Availability', k: 'admin.nav.item.availability', todo: 'staff.availability', wave: 5 },
      { label: 'Payroll', k: 'admin.nav.item.payroll', todo: 'staff.payroll', wave: 4 }
    ] },
    { en: 'Platform', zh: '平台', kEn: 'admin.nav.platform.en', kZh: 'admin.nav.platform.zh', icon: 'settings', item: { label: 'Platform', k: 'admin.nav.item.platform', todo: 'platform.settings', wave: 5 } },
    { en: 'Audit Logs', zh: '审计日志', kEn: 'admin.nav.audit.en', kZh: 'admin.nav.audit.zh', icon: 'receipt_long', item: { label: 'Audit Logs', k: 'admin.nav.item.auditLogs', todo: 'audit', wave: 5 } }
  ];
  const TODO = {}; // todoId → {g, it, wave}（渲染处取 T() 组名/条目名）
  NAV.forEach((g) => (g.items || [g.item]).forEach((it) => {
    if (it.todo) TODO[it.todo] = { g, it, wave: it.wave };
  }));

  const ROUTES = { dashboard: SC.pages.dashboard, analytics: SC.pages.analytics, users: SC.pages.users, security: SC.pages.security };

  const $ = (id) => document.getElementById(id);
  let cdTimer = null;
  let authed = false; // 会话有效标志：route() 仅在登录态渲染——logout 的 hash 复位不再发死会话请求

  // ── 三态切换（W6 附属块同收同放）──
  function hideAll() {
    ['adminLogin', 'adminGate', 'adminRoot', 'adminSetPassword', 'adminResetPassword']
      .forEach((id) => { $(id).style.display = 'none'; });
  }
  function showLogin() {
    authed = false;
    hideAll();
    clearInterval(cdTimer);
    const btn = $('sendCodeBtn');
    btn.disabled = false; btn.textContent = (T('admin.login.sendCode') || '发送验证码');
    // 登录按钮复位：verify 成功路径不重置（boot 后表单隐藏），退出再登录时否则永远卡「登录中…」
    const lb = $('loginBtn');
    lb.disabled = false; lb.textContent = (T('admin.login.submit') || '登录');
    $('codeRow').style.display = 'none';
    $('loginMsg').textContent = '';
    $('loginMsg').className = 'adm-meta';
    $('adminLogin').style.display = 'block';
    $('loginEmail').focus();
  }
  function showGate(title, msg, mode) {
    authed = false;
    hideAll();
    $('gateTitle').textContent = title;
    $('gateMsg').textContent = msg;
    const actions = $('gateActions');
    actions.style.display = mode ? 'flex' : 'none';
    const btn = $('gateLogoutBtn');
    btn.textContent = mode === 'retry' ? (T('admin.gate.retry') || '重试') : (T('admin.logout') || '退出登录');
    btn.onclick = mode === 'retry' ? boot : () => { SC.logout().then(showLogin); };
    $('adminGate').style.display = 'block';
  }
  function showPanel() {
    authed = true;
    hideAll();
    // 页面模块状态复位（新页面加载口径）：A 退出 → B 登录后不残留 A 最后看的详情/选项卡
    Object.values(SC.pages).forEach((p) => { if (p && typeof p.reset === 'function') p.reset(); });
    $('admWho').textContent = [SC.staff.displayName || SC.staff.alias, SC.staff.position].filter(Boolean).join(' · ');
    $('admWho').style.display = 'block';
    $('admRoles').textContent = SC.roles.map((r) => (T(ROLE_KEY[r]) || ROLE_ZH[r] || r)).join(' · ') || (T('admin.roles.none') || '无角色');
    $('admRoles').style.display = 'block';
    $('logoutBtn').style.display = 'block';
    renderNav();
    $('adminRoot').style.display = 'block';
  }

  // ── boot：会话探测三态 ──
  async function boot() {
    const r = await SC.me();
    if (r.networkError) return showGate((T('admin.gate.networkTitle') || '无法连接后端'), (T('admin.gate.networkMsg') || '请确认后端服务已启动（本地开发：node scripts/dev-serve.js）。后端恢复后点击重试；已登录会话自动续用。'), 'retry');
    if (r.status === 401) return showLogin();
    if (!r.ok) return showGate((T('admin.gate.badStateTitle') || '登录状态异常'), (r.data && r.data.error && r.data.error.message) || (T('admin.gate.badStateMsg') || '会话校验失败'), 'logout');
    SC.staff = r.data.staff; SC.roles = r.data.roles || []; SC.perms = r.data.permissions || [];
    showPanel();
    checkBanner();
    route();
  }

  // ── 登录（W6 双因素：密码 + email-code → verify；防枚举：发码恒 ok，成败在 verify）──
  function setLoginMsg(text, isErr) {
    const m = $('loginMsg');
    m.textContent = text;
    m.className = 'adm-meta' + (isErr ? ' err' : '');
  }
  function setPwMsg(text, isErr) {
    const m = $('setPwMsg');
    m.textContent = text;
    m.className = 'adm-meta' + (isErr ? ' err' : '');
  }
  function setResetMsg(text, isErr) {
    const m = $('resetMsg');
    m.textContent = text;
    m.className = 'adm-meta' + (isErr ? ' err' : '');
  }
  function startCountdown(secs = 60, btnId = 'sendCodeBtn', idleLabel = (T('admin.login.resend') || '重新发送')) {
    const btn = $(btnId);
    clearInterval(cdTimer);
    btn.disabled = true;
    const tick = () => {
      btn.textContent = `${idleLabel}（${secs}s）`;
      if (--secs < 0) { clearInterval(cdTimer); btn.disabled = false; btn.textContent = idleLabel; }
    };
    tick();
    cdTimer = setInterval(tick, 1000);
  }
  $('sendCodeBtn').addEventListener('click', () => {
    const email = $('loginEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setLoginMsg((T('admin.login.errEmail') || '请输入有效邮箱'), true);
    // W6：发码前先过密码策略（8-72），避免等 60s 重发窗口才发现密码不合格
    const pw = $('loginPassword').value;
    if (!pw || pw.length < 8 || pw.length > 72) return setLoginMsg((T('admin.login.errPassword') || '请输入密码（8-72 字符）'), true);
    const btn = $('sendCodeBtn');
    btn.disabled = true; btn.textContent = (T('admin.login.sending') || '发送中…');
    SC.sendCode(email).then((r) => {
      if (r.networkError) {
        btn.disabled = false; btn.textContent = (T('admin.login.sendCode') || '发送验证码');
        return setLoginMsg((T('admin.login.errNetwork') || '无法连接后端，请稍后重试'), true);
      }
      if (!r.ok) {
        btn.disabled = false; btn.textContent = (T('admin.login.sendCode') || '发送验证码');
        return setLoginMsg((r.data && r.data.error && r.data.error.message) || (T('admin.login.errSend') || '发送失败'), true);
      }
      setLoginMsg((T('admin.login.codeSent') || '验证码已发送（若该邮箱是工作人员账号，将收到 6 位验证码）。'), false);
      $('codeRow').style.display = 'flex';
      $('loginCode').focus();
      startCountdown(60);
    });
  });
  $('loginBtn').addEventListener('click', () => {
    const email = $('loginEmail').value.trim();
    const code = $('loginCode').value.trim();
    const password = $('loginPassword').value;
    if (!/^\d{6}$/.test(code)) return setLoginMsg((T('admin.login.errCode') || '请输入 6 位数字验证码'), true);
    const btn = $('loginBtn');
    btn.disabled = true; btn.textContent = (T('admin.login.signingIn') || '登录中…');
    SC.verify(email, code, password).then((r) => {
      if (r.ok) {
        setLoginMsg('', false);
        // W6：旧 staff（无密码）仅码登录 → 引导设密（会话已建立，设完直达面板）
        if (r.data && r.data.passwordSetupRequired) { showSetPassword(); return; }
        boot();
        return;
      }
      btn.disabled = false; btn.textContent = (T('admin.login.submit') || '登录');
      if (r.networkError) return setLoginMsg((T('admin.login.errNetwork') || '无法连接后端，请稍后重试'), true);
      setLoginMsg((r.data && r.data.error && r.data.error.message) || (T('admin.login.errVerify') || '登录失败，请重试'), true);
    });
  });
  $('loginEmail').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('sendCodeBtn').click(); });
  $('loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('sendCodeBtn').click(); });
  $('loginCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
  $('forgotAdminPw').addEventListener('click', showReset);
  $('logoutBtn').addEventListener('click', () => { SC.logout().then(() => { showLogin(); location.hash = ''; }); }); // showLogin 先置 authed=false → hash 复位触发的 route() 早退

  // ── W6 首登设密（旧 staff 验证码登录后引导；会话无缝保留 → 设完 boot 直入面板）──
  function showSetPassword() {
    authed = false;
    hideAll();
    clearInterval(cdTimer);
    const btn = $('setPwBtn');
    btn.disabled = false; btn.textContent = (T('admin.setpw.submit') || '设置密码并进入');
    $('setPassword').value = '';
    $('setPwMsg').textContent = '';
    $('setPwMsg').className = 'adm-meta';
    $('adminSetPassword').style.display = 'block';
    $('setPassword').focus();
  }
  $('setPwBtn').addEventListener('click', () => {
    const pw = $('setPassword').value;
    if (!pw || pw.length < 8 || pw.length > 72) return setPwMsg((T('admin.setpw.errPassword') || '密码需 8-72 字符'), true);
    const btn = $('setPwBtn');
    btn.disabled = true; btn.textContent = (T('admin.setpw.saving') || '设置中…');
    SC.setPassword(pw).then((r) => {
      if (r.ok) { boot(); return; }
      btn.disabled = false; btn.textContent = (T('admin.setpw.submit') || '设置密码并进入');
      if (r.networkError) return setPwMsg((T('admin.login.errNetwork') || '无法连接后端，请稍后重试'), true);
      setPwMsg((r.data && r.data.error && r.data.error.message) || (T('admin.setpw.errSave') || '设置失败，请重试'), true);
    });
  });
  $('setPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('setPwBtn').click(); });

  // ── W6 忘记密码（两步：发码 → 码 + 新密码重置；成功后回登录预填邮箱）──
  function showReset() {
    authed = false;
    hideAll();
    clearInterval(cdTimer);
    const btn = $('resetSendBtn');
    btn.disabled = false; btn.textContent = (T('admin.login.sendCode') || '发送验证码');
    $('resetEmail').value = $('loginEmail').value.trim();
    $('resetCode').value = '';
    $('resetPassword').value = '';
    $('resetMsg').textContent = '';
    $('resetMsg').className = 'adm-meta';
    $('adminResetPassword').style.display = 'block';
    $('resetEmail').focus();
  }
  $('resetSendBtn').addEventListener('click', () => {
    const email = $('resetEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setResetMsg((T('admin.login.errEmail') || '请输入有效邮箱'), true);
    const btn = $('resetSendBtn');
    btn.disabled = true; btn.textContent = (T('admin.login.sending') || '发送中…');
    SC.sendCode(email).then((r) => {
      if (r.networkError) {
        btn.disabled = false; btn.textContent = (T('admin.login.sendCode') || '发送验证码');
        return setResetMsg((T('admin.login.errNetwork') || '无法连接后端，请稍后重试'), true);
      }
      if (!r.ok) {
        btn.disabled = false; btn.textContent = (T('admin.login.sendCode') || '发送验证码');
        return setResetMsg((r.data && r.data.error && r.data.error.message) || (T('admin.login.errSend') || '发送失败'), true);
      }
      setResetMsg((T('admin.login.codeSent') || '验证码已发送（若该邮箱是工作人员账号，将收到 6 位验证码）。'), false);
      startCountdown(60, 'resetSendBtn', (T('admin.login.resend') || '重新发送'));
    });
  });
  $('resetBtn').addEventListener('click', () => {
    const email = $('resetEmail').value.trim();
    const code = $('resetCode').value.trim();
    const pw = $('resetPassword').value;
    if (!pw || pw.length < 8 || pw.length > 72) return setResetMsg((T('admin.setpw.errPassword') || '密码需 8-72 字符'), true);
    if (!/^\d{6}$/.test(code)) return setResetMsg((T('admin.login.errCode') || '请输入 6 位数字验证码'), true);
    const btn = $('resetBtn');
    btn.disabled = true; btn.textContent = (T('admin.reset.saving') || '重置中…');
    SC.resetPassword(email, code, pw).then((r) => {
      btn.disabled = false; btn.textContent = (T('admin.reset.submit') || '重置密码');
      if (r.networkError) return setResetMsg((T('admin.login.errNetwork') || '无法连接后端，请稍后重试'), true);
      if (!r.ok) return setResetMsg((r.data && r.data.error && r.data.error.message) || (T('admin.reset.errReset') || '重置失败，请重试'), true);
      // 重置成功：回登录页，预填邮箱 + 提示用新密码登录（旧密码已失效）
      showLogin();
      $('loginEmail').value = email;
      setLoginMsg((T('admin.reset.done') || '密码已重置——请用新密码 + 验证码登录'), false);
    });
  });
  $('resetCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('resetBtn').click(); });
  $('resetPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('resetBtn').click(); });
  $('resetBackBtn').addEventListener('click', showLogin);

  // 会话过期（任意请求 401 派发 mn:unauthorized）→ 回登录
  window.addEventListener('mn:unauthorized', () => {
    if (authed) {
      toast((T('admin.session.expired') || '登录已过期，请重新登录'));
      showLogin();
    }
  });

  // ── 导航 ──
  function renderNav() {
    const box = $('navGroups');
    // 单卡导航：一层卡片 + 分类标题 + 图标条目（无 W 徽章、无组间分隔线）；
    // 分类口径：Analytics/Users/Content/Community 并入「Dashboard 总览」（各条目保留原图标），其余组各成一个分类
    const sections = [
      { g: NAV[0], subs: NAV.slice(0, 5) },
      ...NAV.slice(5).map((g) => ({ g, subs: [g] }))
    ];
    box.replaceChildren(h('div', { class: 'sidebar-module nav-card' }, ...sections.flatMap(({ g, subs }) => {
      const title = h('div', { class: 'nav-group-title' },
        h('span', { text: (T(g.kEn) || g.en) }),
        h('span', { class: 'zh', text: (T(g.kZh) || g.zh) })
      );
      const items = subs.flatMap((sg) => (sg.items || [sg.item]).map((it) => h('a', {
        class: 'nav-item',
        href: it.route ? '#/' + it.route : '#/todo/' + it.todo
      },
        h('span', { class: 'material-symbols-outlined', text: sg.icon }),
        h('span', { text: (T(it.k || sg.kEn) || it.label) })
      )));
      return [title, ...items];
    })));
  }

  // ── 路由（#hash 深链）──
  function route() {
    if (!authed) return; // 未登录不渲染页面（登录前/登出后的 hashchange 一律早退）
    const hash = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [kind, arg] = hash.split('/');
    document.querySelectorAll('.pane').forEach((p) => { p.style.display = 'none'; });
    document.querySelectorAll('.nav-item').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === location.hash || (location.hash === '' && a.getAttribute('href') === '#/dashboard'));
    });
    const page = ROUTES[kind];
    if (page) {
      const pane = $('pane-' + kind);
      pane.style.display = 'block';
      page.render(pane);
    } else showTodo(arg || kind);
  }
  function showTodo(id) {
    const td = TODO[id];
    const pane = $('pane-todo');
    pane.style.display = 'block';
    const title = td ? ((T(td.g.kEn) || td.g.en) + ' · ' + (T(td.it.k || td.g.kEn) || td.it.label)) : id;
    const sub = td ? (T(td.g.kZh) || td.g.zh) : '';
    pane.replaceChildren(
      h('div', { class: 'page-head' }, h('h2', { text: title }), h('div', { class: 'page-sub', text: sub || (T('admin.todo.building') || '建设中') })),
      h('div', { class: 'adm-card' },
        h('span', { class: 'material-symbols-outlined adm-meta', text: 'construction', style: 'font-size:32px' }),
        h('h3', { text: (T('admin.todo.title') || '建设中 🚧'), style: 'margin-top:8px' }),
        h('p', { class: 'adm-meta', style: 'margin-top:6px', text: (T('admin.todo.msgPrefix') || '此模块将在后端 v2 第 W') + (td ? td.wave : 5) + (T('admin.todo.msgSuffix') || ' 波次交付。目前可用：Dashboard / Analytics / Users / Security。') })));
  }
  window.addEventListener('hashchange', route);

  // ── 预算/AI 配置 banner（W3 端点；未上线时 404 → 静默隐藏）──
  function checkBanner() {
    SC.get('/staff/ai/budget').then((r) => {
      const b = $('admBanner');
      if (!r.ok || !r.data) return;
      const d = r.data;
      let text = '';
      if (d.status === 'unconfigured') text = (T('admin.banner.unconfigured') || '⚠ AI 未配置：Copilot / 智能回复暂不可用（FAQ 检索不受影响）。');
      else if (d.status === 'exhausted') text = (T('admin.banner.exhausted') || '⚠ AI 预算已耗尽：AI 功能进入降级模式（永不硬停机）。');
      else if (typeof d.ratio === 'number' && d.ratio >= 0.8) text = (T('admin.banner.over80') || '⚠ AI 预算使用已超过 80%：请留意成本红线。');
      if (text) { b.textContent = text; b.style.display = 'block'; }
    });
  }

  boot();
})();
