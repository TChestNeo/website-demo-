/* SlatiControl 壳（v2）：boot（/staff/auth/me 三态）→ staff 登录（email-code → verify 两段式）
   → 导航壳（§30 十二组）→ #hash 深链路由 → 页面渲染。
   登录态三态：adminLogin（登录）/ adminGate（无权限或后端不可达）/ adminRoot（面板）。
   W2 只交付 Dashboard/Analytics/Users/Security 四页；其余导航组渲染「建设中」占位。 */
(function () {
  'use strict';
  const { h, esc, toast } = UI;

  const ROLE_ZH = { project_director: '项目总监', customer_support: '客服', finance: '财务', moderation: '审核', security: '安全', technical: '技术', management: '管理' };

  // §30 十二顶级导航组：英文菜单 + 中文副标题；W2 外条目 → #/todo/<id>（建设中占位）
  const NAV = [
    { en: 'Dashboard', zh: '总览', icon: 'dashboard', item: { label: 'Dashboard', route: 'dashboard' } },
    { en: 'Analytics', zh: '分析', icon: 'insights', item: { label: 'Analytics', route: 'analytics' } },
    { en: 'Users', zh: '用户', icon: 'group', item: { label: 'Users', route: 'users' } },
    { en: 'Content', zh: '内容', icon: 'article', item: { label: 'Content', todo: 'content', wave: 5 } },
    { en: 'Community', zh: '社区', icon: 'forum', item: { label: 'Community', todo: 'community', wave: 5 } },
    { en: 'Finance', zh: '财务', icon: 'payments', items: [
      { label: 'Overview', todo: 'finance.overview', wave: 4 }, { label: 'Revenue', todo: 'finance.revenue', wave: 4 },
      { label: 'Subscriptions', todo: 'finance.subscriptions', wave: 4 }, { label: 'ARPU / ARPPU', todo: 'finance.arpu', wave: 4 },
      { label: 'Refunds', todo: 'finance.refunds', wave: 4 }, { label: 'Costs', todo: 'finance.costs', wave: 4 },
      { label: 'Payroll', todo: 'finance.payroll', wave: 4 }, { label: 'Donations', todo: 'finance.donations', wave: 4 }
    ] },
    { en: 'Customer Service', zh: '客服', icon: 'support_agent', item: { label: 'Tickets', todo: 'cs.tickets', wave: 3 } },
    { en: 'AI Assistant', zh: 'AI 辅助', icon: 'smart_toy', item: { label: 'Copilot', todo: 'ai.copilot', wave: 3 } },
    { en: 'Security', zh: '安全', icon: 'security', item: { label: 'Security', route: 'security' } },
    { en: 'Staff', zh: '工作人员', icon: 'badge', items: [
      { label: 'Staff', todo: 'staff.list', wave: 4 }, { label: 'Roles', todo: 'staff.roles', wave: 4 },
      { label: 'Permissions', todo: 'staff.permissions', wave: 4 }, { label: 'Availability', todo: 'staff.availability', wave: 5 },
      { label: 'Payroll', todo: 'staff.payroll', wave: 4 }
    ] },
    { en: 'Platform', zh: '平台', icon: 'settings', item: { label: 'Platform', todo: 'platform.settings', wave: 5 } },
    { en: 'Audit Logs', zh: '审计日志', icon: 'receipt_long', item: { label: 'Audit Logs', todo: 'audit', wave: 5 } }
  ];
  const TODO = {}; // todoId → {title, sub, wave}
  NAV.forEach((g) => (g.items || [g.item]).forEach((it) => {
    if (it.todo) TODO[it.todo] = { title: g.en + ' · ' + it.label, sub: g.zh, wave: it.wave };
  }));

  const ROUTES = { dashboard: SC.pages.dashboard, analytics: SC.pages.analytics, users: SC.pages.users, security: SC.pages.security };

  const $ = (id) => document.getElementById(id);
  let cdTimer = null;
  let authed = false; // 会话有效标志：route() 仅在登录态渲染——logout 的 hash 复位不再发死会话请求

  // ── 三态切换 ──
  function hideAll() { $('adminLogin').style.display = 'none'; $('adminGate').style.display = 'none'; $('adminRoot').style.display = 'none'; }
  function showLogin() {
    authed = false;
    hideAll();
    clearInterval(cdTimer);
    const btn = $('sendCodeBtn');
    btn.disabled = false; btn.textContent = '发送验证码';
    // 登录按钮复位：verify 成功路径不重置（boot 后表单隐藏），退出再登录时否则永远卡「登录中…」
    const lb = $('loginBtn');
    lb.disabled = false; lb.textContent = '登录';
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
    btn.textContent = mode === 'retry' ? '重试' : '退出登录';
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
    $('admRoles').textContent = SC.roles.map((r) => ROLE_ZH[r] || r).join(' · ') || '无角色';
    $('admRoles').style.display = 'block';
    $('logoutBtn').style.display = 'block';
    renderNav();
    $('adminRoot').style.display = 'block';
  }

  // ── boot：会话探测三态 ──
  async function boot() {
    const r = await SC.me();
    if (r.networkError) return showGate('无法连接后端', '请确认后端服务已启动（本地开发：node scripts/dev-serve.js）。后端恢复后点击重试；已登录会话自动续用。', 'retry');
    if (r.status === 401) return showLogin();
    if (!r.ok) return showGate('登录状态异常', (r.data && r.data.error && r.data.error.message) || '会话校验失败', 'logout');
    SC.staff = r.data.staff; SC.roles = r.data.roles || []; SC.perms = r.data.permissions || [];
    showPanel();
    checkBanner();
    route();
  }

  // ── 登录两段式（email-code → verify；防枚举：发码恒 ok，成败在 verify）──
  function setLoginMsg(text, isErr) {
    const m = $('loginMsg');
    m.textContent = text;
    m.className = 'adm-meta' + (isErr ? ' err' : '');
  }
  function startCountdown(secs = 60) {
    const btn = $('sendCodeBtn');
    clearInterval(cdTimer);
    btn.disabled = true;
    const tick = () => {
      btn.textContent = `重新发送（${secs}s）`;
      if (--secs < 0) { clearInterval(cdTimer); btn.disabled = false; btn.textContent = '重新发送'; }
    };
    tick();
    cdTimer = setInterval(tick, 1000);
  }
  $('sendCodeBtn').addEventListener('click', () => {
    const email = $('loginEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setLoginMsg('请输入有效邮箱', true);
    const btn = $('sendCodeBtn');
    btn.disabled = true; btn.textContent = '发送中…';
    SC.sendCode(email).then((r) => {
      if (r.networkError) {
        btn.disabled = false; btn.textContent = '发送验证码';
        return setLoginMsg('无法连接后端，请稍后重试', true);
      }
      if (!r.ok) {
        btn.disabled = false; btn.textContent = '发送验证码';
        return setLoginMsg((r.data && r.data.error && r.data.error.message) || '发送失败', true);
      }
      setLoginMsg('验证码已发送（若该邮箱是工作人员账号，将收到 6 位验证码）。', false);
      $('codeRow').style.display = 'flex';
      $('loginCode').focus();
      startCountdown(60);
    });
  });
  $('loginBtn').addEventListener('click', () => {
    const email = $('loginEmail').value.trim();
    const code = $('loginCode').value.trim();
    if (!/^\d{6}$/.test(code)) return setLoginMsg('请输入 6 位数字验证码', true);
    const btn = $('loginBtn');
    btn.disabled = true; btn.textContent = '登录中…';
    SC.verify(email, code).then((r) => {
      if (r.ok) { setLoginMsg('', false); boot(); return; }
      btn.disabled = false; btn.textContent = '登录';
      if (r.networkError) return setLoginMsg('无法连接后端，请稍后重试', true);
      setLoginMsg((r.data && r.data.error && r.data.error.message) || '登录失败，请重试', true);
    });
  });
  $('loginEmail').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('sendCodeBtn').click(); });
  $('loginCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
  $('logoutBtn').addEventListener('click', () => { SC.logout().then(() => { showLogin(); location.hash = ''; }); }); // showLogin 先置 authed=false → hash 复位触发的 route() 早退

  // 会话过期（任意请求 401 派发 mn:unauthorized）→ 回登录
  window.addEventListener('mn:unauthorized', () => {
    if (authed) {
      toast('登录已过期，请重新登录');
      showLogin();
    }
  });

  // ── 导航 ──
  function renderNav() {
    const box = $('navGroups');
    box.replaceChildren(...NAV.map((g) => {
      const items = g.items || [g.item];
      return h('div', { class: 'sidebar-module' },
        h('div', { class: 'nav-group-title' },
          h('span', { text: g.en }),
          h('span', { class: 'zh', text: g.zh })
        ),
        h('div', { class: 'nav-group-items' },
          ...items.map((it) => h('a', {
            class: 'nav-item',
            href: it.route ? '#/' + it.route : '#/todo/' + it.todo
          },
            g.items ? null : h('span', { class: 'material-symbols-outlined', text: g.icon }),
            h('span', { text: it.label }),
            it.wave ? h('span', { class: 'soon', text: 'W' + it.wave }) : null
          ))
        )
      );
    }));
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
    const todo = TODO[id] || { title: id, sub: '', wave: 5 };
    const pane = $('pane-todo');
    pane.style.display = 'block';
    pane.replaceChildren(
      h('div', { class: 'page-head' }, h('h2', { text: todo.title }), h('div', { class: 'page-sub', text: todo.sub || '建设中' })),
      h('div', { class: 'adm-card' },
        h('span', { class: 'material-symbols-outlined adm-meta', text: 'construction', style: 'font-size:32px' }),
        h('h3', { text: '建设中 🚧', style: 'margin-top:8px' }),
        h('p', { class: 'adm-meta', style: 'margin-top:6px', text: `此模块将在后端 v2 第 W${todo.wave} 波次交付。目前可用：Dashboard / Analytics / Users / Security。` })));
  }
  window.addEventListener('hashchange', route);

  // ── 预算/AI 配置 banner（W3 端点；未上线时 404 → 静默隐藏）──
  function checkBanner() {
    SC.get('/staff/ai/budget').then((r) => {
      const b = $('admBanner');
      if (!r.ok || !r.data) return;
      const d = r.data;
      let text = '';
      if (d.status === 'unconfigured') text = '⚠ AI 未配置：Copilot / 智能回复暂不可用（FAQ 检索不受影响）。';
      else if (d.status === 'exhausted') text = '⚠ AI 预算已耗尽：AI 功能进入降级模式（永不硬停机）。';
      else if (typeof d.ratio === 'number' && d.ratio >= 0.8) text = '⚠ AI 预算使用已超过 80%：请留意成本红线。';
      if (text) { b.textContent = text; b.style.display = 'block'; }
    });
  }

  boot();
})();
