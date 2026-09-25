/* SlatiControl 页面：Users 用户（§3/§4）——GET /api/staff/users 列表 + /:id 详情。
   掩码矩阵（§28）：字段按角色到达即所见（cs 无支付/内部字段，后端已剥）；前端不二次推断。
   详情联动 GET /staff/users/:id/security（users.view：cs 只见近 10 条 + IP 前两段）。
   v0.2.54.0 i18n：选项元组带 i18n 键（值不译、标签渲染处取 T()）；zh 值逐字节=现有文案。 */
(function (global) {
  'use strict';
  const { h, esc, fmtDateTime, fmtMicro, fmtDate, chip, pageHead, empty, denied, pager, kvList, toast } = UI;

  // v0.2.54.0 i18n：T(key) 取当前语言；回落原文
  const T = (k) => (window.MN_I18N && window.MN_I18N.t(k)) || null;

  // 三元组 [值, 标签, i18n 键]：值为后端 mode 键（不译）；标签渲染处取 T()
  const FILTERS = [['all', '全部', 'admin.users.filterAll'], ['active', '正常', 'admin.status.active'], ['banned', '已封禁', 'admin.status.banned'], ['delete_pending', '待删除', 'admin.status.deletePending'], ['risk', '有风险', 'admin.users.filterRisk']];
  const SORTS = [['created_desc', '注册时间（新 → 旧）', 'admin.users.sortNewFirst'], ['created_asc', '注册时间（旧 → 新）', 'admin.users.sortOldFirst'], ['last_active_desc', '最后活跃', 'admin.users.sortLastActive'], ['risk_desc', '风险优先', 'admin.users.sortRiskFirst']];
  const RESULT_LABEL = { success: ['成功', 'ok', 'admin.result.success'], failed: ['失败', 'high', 'admin.result.failed'], banned: ['封禁', 'high', 'admin.result.banned'], deleted: ['已删除', 'neutral', 'admin.result.deleted'], no_user: ['无此用户', 'neutral', 'admin.result.noUser'] };
  const EVENT_ZH = { suspicious_login: '可疑登录', password_change: '密码修改', email_change: '邮箱修改', '2fa_change': '两步验证变更', new_device: '新设备', new_session: '新会话', account_recovery: '账号找回', security_settings_change: '安全设置变更' };
  const EVENT_KEY = { suspicious_login: 'admin.event.suspiciousLogin', password_change: 'admin.event.passwordChange', email_change: 'admin.event.emailChange', '2fa_change': 'admin.event.twoFaChange', new_device: 'admin.event.newDevice', new_session: 'admin.event.newSession', account_recovery: 'admin.event.accountRecovery', security_settings_change: 'admin.event.securitySettingsChange' };
  const RISK_ZH = { high: '高危', medium: '中危', low: '低危' };
  // 订阅生效状态（用户详情「订阅发放记录」卡上方）：[原文, i18n 键, chip 类]
  const SUB_STATUS = {
    none: ['无订阅', 'admin.users.recStNone', 'neutral'],
    active: ['生效中', 'admin.users.recStActive', 'ok'],
    expired: ['已过期', 'admin.users.recStExpired', 'neutral'],
    forever: ['永久', 'admin.users.recStForever', 'warn']
  };

  const state = { q: '', filter: 'all', sort: 'created_desc', page: 1, view: 'list', userId: null };

  function select(entries, value, onPick) {
    return h('select', { class: 'adm-select', onchange: (e) => onPick(e.target.value) },
      ...entries.map(([k, label, ik]) => h('option', { value: k, selected: k === value, text: (ik ? (T(ik) || label) : label) })));
  }

  function renderList(root) {
    const tableBox = h('div', {});
    const pageBox = h('div', { class: 'pager' });
    let timer = null;
    const qInput = h('input', { class: 'adm-input', placeholder: (T('admin.users.searchPh') || '搜索邮箱 / 昵称 / 公民号 / ID'), value: state.q, style: 'flex:1;min-width:220px',
      oninput: (e) => {
        state.q = e.target.value.trim();
        clearTimeout(timer);
        timer = setTimeout(() => { state.page = 1; load(); }, 400);
      } });

    function load() {
      SC.get('/staff/users?' + SC.qs({ q: state.q, filter: state.filter, sort: state.sort, page: state.page })).then((r) => {
        if (r.networkError) return empty(tableBox, (T('admin.network.unreachable') || '无法连接后端'));
        if (!r.ok) return denied(tableBox, r.status, r.data);
        const rows = r.data.users;
        if (!rows.length) return empty(tableBox, (T('admin.users.noMatch') || '没有符合条件的用户'));
        tableBox.replaceChildren(h('table', { class: 'adm-table' },
          h('thead', {}, h('tr', {},
            h('th', { text: (T('admin.users.thUser') || '用户') }), h('th', { text: (T('admin.users.thName') || '昵称 / 公民号') }), h('th', { text: (T('admin.users.thTier') || '层级') }),
            h('th', { text: (T('admin.users.thStatus') || '状态') }), h('th', { text: (T('admin.users.thRisk') || '风险') }), h('th', { text: (T('admin.users.thRegistered') || '注册时间') }), h('th', { text: (T('admin.users.thLastActive') || '最后活跃') })
          )),
          h('tbody', {},
            ...rows.map((u) => h('tr', { class: 'cursor-row', onclick: () => openDetail(u.id) },
              h('td', {}, h('div', { text: u.email || '—' }), h('code', { text: u.id })),
              h('td', {}, h('div', { text: u.displayName || '—' }), h('span', { class: 'adm-meta mono', text: u.citizenId || '' })),
              h('td', {}, chip('tier', u.tier)),
              h('td', {}, chip('status', u.status)),
              h('td', {}, chip('risk', u.riskLevel)),
              h('td', { text: fmtDateTime(u.createdAt) }),
              h('td', { text: fmtDateTime(u.lastActiveAt) })
            ))
          )
        ));
        pager(pageBox, r.data, (p) => { state.page = p; load(); });
      });
    }

    root.replaceChildren(
      pageHead((T('admin.nav.users.en') || 'Users'), (T('admin.users.subtitle') || '用户管理'), (T('admin.users.headMeta') || '点击行查看详情 · 数据按角色权限自动掩码（§28）')),
      h('div', { class: 'adm-card' },
        h('div', { class: 'adm-form', style: 'margin-bottom:0' },
          qInput,
          select(FILTERS, state.filter, (v) => { state.filter = v; state.page = 1; load(); }),
          select(SORTS, state.sort, (v) => { state.sort = v; state.page = 1; load(); }))),
      tableBox, pageBox);
    load();
  }

  function openDetail(userId) {
    state.view = 'detail'; state.userId = userId;
    render(SC.pages.users._root);
  }

  function renderDetail(root) {
    const box = h('div', {});
    root.replaceChildren(box);
    Promise.all([
      SC.get('/staff/users/' + state.userId),
      SC.get('/staff/users/' + state.userId + '/security'),
      // 无权限不请求发放记录：GET 403 会写 perm_denied 审计行（噪音）；有权限再取
      SC.can('subscriptions.manage') ? SC.get('/staff/subscriptions/grants/' + state.userId) : Promise.resolve(null)
    ]).then(([ru, rs, rg]) => {
      if (ru.networkError) return empty(box, (T('admin.network.unreachable') || '无法连接后端'));
      if (!ru.ok) { box.replaceChildren(deniedEl(ru.status, ru.data), h('button', { class: 'btn', text: (T('admin.users.backToList') || '← 返回列表'), onclick: () => { state.view = 'list'; renderList(root); } })); return; }
      const u = ru.data.user;
      const st = ru.data.stats;
      const sec = rs.ok ? rs.data : null;
      const rec = rg && rg.ok ? rg.data : null;

      const header = h('div', { class: 'row', style: 'margin-bottom:var(--space-md)' },
        h('button', { class: 'btn', text: (T('admin.users.backToList') || '← 返回列表'), onclick: () => { state.view = 'list'; renderList(root); } }),
        h('h2', { style: 'margin:0;font-size:20px;font-weight:800', text: u.email || u.id }),
        chip('tier', u.tier), chip('status', u.status), chip('risk', u.riskLevel),
        h('code', { text: u.id }));

      const infoCard = h('div', { class: 'adm-card' },
        h('div', { class: 'adm-card-title' },
          h('div', {},
            h('h3', { text: (T('admin.users.basicInfo') || '基本信息') }),
            h('div', { class: 'sub', text: (T('admin.users.basicInfoEn') || 'Basic Info') }))),
        kvList([
          [(T('admin.users.fNickname') || '昵称'), u.displayName], [(T('admin.users.fCitizenId') || '公民号'), u.citizenId], [(T('admin.users.fCountry') || '国家/地区'), u.country], [(T('admin.users.fLanguage') || '语言'), u.language],
          [(T('admin.users.fGender') || '性别'), u.gender], [(T('admin.users.fBio') || '个人简介'), u.bio], [(T('admin.users.fTierExpires') || '层级到期'), fmtDateTime(u.tierExpiresAt)], [(T('admin.users.thRegistered') || '注册时间'), fmtDateTime(u.createdAt)],
          [(T('admin.users.thLastActive') || '最后活跃'), fmtDateTime(u.lastActiveAt)], [(T('admin.users.fLastLogin') || '最后登录'), fmtDateTime(u.lastLoginAt)],
          [(T('admin.users.fRiskReasons') || '风险理由'), Array.isArray(u.riskReasons) && u.riskReasons.length ? u.riskReasons.join('、') : null],
          [(T('admin.users.fWarnings') || '警告次数'), u.warningCount], [(T('admin.users.fMutedUntil') || '禁言至'), fmtDateTime(u.mutedUntil)], [(T('admin.users.fDob') || '出生日期'), u.dob ? fmtDate(u.dob) : null]
        ]));

      const statsStrip = h('div', { class: 'stat-strip' },
        ...[['posts', '帖子', 'admin.stat.posts'], ['comments', '评论', 'admin.stat.comments'], ['following', '关注', 'admin.users.stFollowing'], ['conversations', '私信会话', 'admin.stat.conversations'], ['tickets', '工单', 'admin.users.stTickets'], ['loginCount', '登录次数', 'admin.users.stLogins']]
          .map(([k, label, ik]) => h('div', { class: 'stat-card' },
            h('div', { class: 'stat-num', text: String(st[k] ?? 0) }),
            h('div', { class: 'stat-label', text: (T(ik) || label) }))));

      // 支付摘要：无 payments 能力 → 后端 null → 显示无权限（§28 区块级掩码）
      let paymentsBody;
      if (ru.data.payments === null) {
        paymentsBody = h('p', { class: 'adm-meta', text: (T('admin.users.paymentsNoPerm') || '当前角色无支付数据查看权限（finance / management / director 可见）。') });
      } else if (ru.data.payments.length) {
        paymentsBody = h('table', { class: 'adm-table' },
          h('thead', {}, h('tr', {},
            h('th', { text: (T('admin.users.payOrder') || '订单') }), h('th', { text: (T('admin.users.payTier') || '套餐') }), h('th', { text: (T('admin.users.payAmount') || '金额') }), h('th', { text: (T('admin.users.thStatus') || '状态') }), h('th', { text: (T('admin.users.payTime') || '支付时间') }))),
          h('tbody', {},
            ...ru.data.payments.map((p) => h('tr', {},
              h('td', {}, h('code', { text: p.id })),
              h('td', { text: p.tier_key || '—' }),
              h('td', { text: fmtMicro(p.amount_micro) }),
              h('td', { text: p.status }),
              h('td', { text: fmtDateTime(p.paid_at) })))));
      } else {
        paymentsBody = h('div', { class: 'empty', text: (T('admin.users.noPayments') || '暂无支付记录') });
      }
      const paymentsCard = h('section', { class: 'adm-card' },
        h('div', { class: 'adm-card-title' },
          h('div', {},
            h('h3', { text: (T('admin.users.paymentsTitle') || '支付记录') }),
            h('div', { class: 'sub', text: (T('admin.users.paymentsSub') || 'Payments · 近 20 笔') }))),
        paymentsBody);

      // 订阅发放（subscriptions.manage：finance / director）——免费发放测试通道：不经 Stripe、不扣款、
      // 不记 payments；后端提升/顺延口径 max 不降级，审计 reason=staff_test_grant；无权限角色只见提示文案
      const grantCard = h('section', { class: 'adm-card' },
        h('div', { class: 'adm-card-title' },
          h('div', {},
            h('h3', { text: (T('admin.users.grantTitle') || '订阅发放') }),
            h('div', { class: 'sub', text: (T('admin.users.grantSub') || 'Grant · 免费发放') }))),
        SC.can('subscriptions.manage')
          ? (() => {
              const tierSel = h('select', { class: 'adm-select' },
                ...[['basic', 'Basic'], ['premium', 'Premium'], ['ultra', 'Ultra']]
                  .map(([k, label]) => h('option', { value: k, text: label })));
              const monthsSel = h('select', { class: 'adm-select' },
                ...[1, 3, 6, 12].map((m) => h('option', { value: String(m), text: String(m) })));
              const btn = h('button', { class: 'btn', text: (T('admin.users.grantBtn') || '发放订阅'), onclick: () => {
                btn.disabled = true;
                SC.post('/staff/subscriptions/grant', { email: u.email, tierKey: tierSel.value, months: parseInt(monthsSel.value, 10) })
                  .then((r) => {
                    btn.disabled = false;
                    if (r.ok) { toast((T('admin.users.grantDone') || '已发放订阅（写操作已审计）')); renderDetail(SC.pages.users._root); }
                    else toast((T('admin.users.grantFail') || '发放失败：') + ((r.data && r.data.error && r.data.error.message) || r.status));
                  });
              } });
              return h('div', { class: 'adm-form' },
                h('span', { class: 'adm-meta', text: (T('admin.users.grantTier') || '等级') }), tierSel,
                h('span', { class: 'adm-meta', text: (T('admin.users.grantMonths') || '月数') }), monthsSel,
                btn);
            })()
          : h('p', { class: 'adm-meta', text: (T('admin.users.grantNoPerm') || '当前角色无订阅发放权限（subscriptions.manage）。') }));

      // 订阅发放记录（subscriptions.manage）：上方当前订阅状态（排列方式：生效 · 高级），下方发放记录
      // （发放时间/开始/结束 + 总共发放了几次）；后端从审计链 staff_test_grant 读、按 生效·高级 排好序
      let recBody;
      if (!rec) {
        recBody = h('p', { class: 'adm-meta', text: (T('admin.users.recLoadFail') || '发放记录加载失败或无权限。') });
      } else {
        const nowMs = Date.now();
        let subStatus = 'none';
        if (u.tier !== 'free') {
          if (!u.tierExpiresAt) subStatus = 'forever';
          else if (Date.parse(u.tierExpiresAt) <= nowMs) subStatus = 'expired';
          else subStatus = 'active';
        }
        const rows = rec.grants || [];
        recBody = h('div', {},
          h('div', { class: 'row', style: 'margin-bottom:var(--space-sm)' },
            h('span', { class: 'chip ' + SUB_STATUS[subStatus][2], text: (T(SUB_STATUS[subStatus][1]) || SUB_STATUS[subStatus][0]) }),
            h('span', { class: 'adm-meta', text: '·' }),
            chip('tier', u.tier),
            h('span', { class: 'adm-meta', text: (T('admin.users.fTierExpires') || '层级到期') + '：' + fmtDateTime(u.tierExpiresAt) })),
          h('div', { class: 'adm-meta', style: 'margin-bottom:var(--space-sm)', text: (T('admin.users.recTotal') || '总共发放了 {n} 次').replace('{n}', String(rows.length)) }),
          rows.length
            ? h('table', { class: 'adm-table' },
              h('thead', {}, h('tr', {},
                h('th', { text: (T('admin.users.recGrantedAt') || '发放时间') }), h('th', { text: (T('admin.users.thTier') || '等级') }), h('th', { text: (T('admin.users.recStart') || '开始时间') }), h('th', { text: (T('admin.users.recEnd') || '结束时间') }), h('th', { text: (T('admin.users.recEffect') || '是否生效') }))),
              h('tbody', {},
                ...rows.map((g) => h('tr', {},
                  h('td', { text: fmtDateTime(g.grantedAt) }),
                  h('td', {}, chip('tier', g.tier)),
                  h('td', { text: fmtDateTime(g.start) }),
                  h('td', { text: g.end ? fmtDateTime(g.end) : (g.end === null ? (T('admin.users.recStForever') || '永久') : '—') }),
                  h('td', {}, g.effect === 'applied'
                    ? h('span', { class: 'chip ok', text: (T('admin.users.recEffectApplied') || '生效') })
                    : h('span', { class: 'chip neutral', text: (T('admin.users.recEffectNoop') || '无变化') }))))))
            : h('div', { class: 'empty', text: (T('admin.users.recEmpty') || '暂无发放记录') }));
      }
      const recCard = SC.can('subscriptions.manage')
        ? h('section', { class: 'adm-card' },
            h('div', { class: 'adm-card-title' },
              h('div', {},
                h('h3', { text: (T('admin.users.recTitle') || '订阅发放记录') }),
                h('div', { class: 'sub', text: (T('admin.users.recSub') || 'Grants · 生效状态与发放历史') }))),
            recBody)
        : null;

      // 安全档案（users.view 可达：cs 掩码近 10 条；security 全量）
      let securityBody;
      if (!sec) {
        securityBody = h('p', { class: 'adm-meta', text: (T('admin.users.securityNoPerm') || '安全档案加载失败或无权限。') });
      } else {
        const loginsBody = sec.loginHistory.length
          ? h('table', { class: 'adm-table' },
            h('thead', {}, h('tr', {},
              h('th', { text: 'IP' }), h('th', { text: (T('admin.users.thDeviceBrowser') || '设备 / 浏览器') }), h('th', { text: (T('admin.users.thResult') || '结果') }), h('th', { text: (T('admin.users.thRiskFlags') || '风险信号') }), h('th', { text: (T('admin.users.thTime') || '时间') }))),
            h('tbody', {},
              ...sec.loginHistory.map((l) => h('tr', {},
                h('td', {}, h('code', { text: l.ip || '—' })),
                h('td', { text: [l.device, l.browser, l.os].filter(Boolean).join(' / ') || '—' }),
                h('td', {}, RESULT_LABEL[l.result]
                  ? h('span', { class: 'chip ' + RESULT_LABEL[l.result][1], text: (T(RESULT_LABEL[l.result][2]) || RESULT_LABEL[l.result][0]) })
                  : h('span', { text: l.result })),
                h('td', { text: l.risk_flags || '—' }),
                h('td', { text: fmtDateTime(l.created_at) })))))
          : h('div', { class: 'empty', text: (T('admin.users.noLogins') || '暂无登录记录') });
        const eventsBody = sec.events.length
          ? h('table', { class: 'adm-table' },
            h('thead', {}, h('tr', {},
              h('th', { text: (T('admin.users.thEvent') || '事件') }), h('th', { text: (T('admin.users.thRisk') || '风险') }), h('th', { text: (T('admin.users.thDetail') || '详情') }), h('th', { text: (T('admin.users.thFlag') || '标记') }), h('th', { text: (T('admin.users.thTime') || '时间') }))),
            h('tbody', {},
              ...sec.events.map((e) => h('tr', {},
                h('td', { text: (EVENT_KEY[e.event_type] ? (T(EVENT_KEY[e.event_type]) || EVENT_ZH[e.event_type]) : EVENT_ZH[e.event_type]) || e.event_type }),
                h('td', {}, chip('risk', e.risk_level || 'low')),
                h('td', { text: (e.detail || '').slice(0, 60) || '—' }),
                h('td', {}, e.flagged
                  ? h('span', { class: 'chip ok', text: (T('admin.users.flagged') || '已标记') })
                  : (SC.can('security.manage')
                    ? h('button', { class: 'btn', text: (T('admin.users.thFlag') || '标记'), onclick: () => flagEvent(e.id, box) })
                    : h('span', { class: 'adm-meta', text: '—' }))),
                h('td', { text: fmtDateTime(e.created_at) })))))
          : h('div', { class: 'empty', text: (T('admin.users.noEvents') || '暂无安全事件') });
        securityBody = h('div', {}, loginsBody, eventsBody);
      }
      const securityCard = h('section', { class: 'adm-card' },
        h('div', { class: 'adm-card-title' },
          h('div', {},
            h('h3', { text: (T('admin.users.securityTitle') || '安全档案') }),
            h('div', { class: 'sub', text: (T('admin.users.securitySub') || 'Security · 登录史与安全事件') })),
          sec ? h('div', { class: 'row' },
            h('span', { class: 'chip ' + (sec.flagged ? 'high' : 'ok'), text: sec.flagged + (T('admin.users.flagCountSuffix') || ' 个事件已标记') }),
            sec.loginHistory.length === 10
              ? h('span', { class: 'adm-meta', text: (T('admin.users.masked10') || '当前角色仅显示近 10 条登录（§28 掩码）') })
              : null)
            : null),
        securityBody);

      box.replaceChildren(header, infoCard, statsStrip, paymentsCard, grantCard, recCard, securityCard);
    });
  }

  function flagEvent(eventId, box) {
    const note = (global.prompt((T('admin.users.flagPrompt') || '跟进备注（可留空，最多 500 字）：')) || '').trim();
    SC.post('/staff/security/events/' + eventId + '/flag', { note }).then((r) => {
      if (r.ok) { toast((T('admin.users.flagDone') || '已标记事件（写操作已审计）')); renderDetail(SC.pages.users._root); }
      else toast((T('admin.users.flagFail') || '标记失败：') + ((r.data && r.data.error && r.data.error.message) || r.status));
    });
  }

  function deniedEl(status, data) {
    const d = h('div', {});
    denied(d, status, data);
    return d.firstChild;
  }

  function render(root) {
    SC.pages.users._root = root;
    if (state.view === 'detail' && state.userId) renderDetail(root);
    else renderList(root);
  }

  // 重新登录（app.js showPanel）时按「新页面加载」清零：A 退出 → B 登录后不残留 A 最后看的详情
  function reset() {
    state.view = 'list'; state.userId = null; state.page = 1;
    state.q = ''; state.filter = 'all'; state.sort = 'created_desc';
  }

  SC.pages.users = { render, reset };
})(window);
