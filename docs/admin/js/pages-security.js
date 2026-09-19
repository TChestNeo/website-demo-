/* SlatiControl 页面：Security 安全中心（§5）——全局登录史/安全事件（security.view_all）。
   事件标记（security.manage）= 唯一写操作 → 后端审计 security_event_flag。
   moderation 有 view_all 但无 IP 能力 → 后端 ip=null；cs 无 view_all → 本页 403（单用户档案走 Users 页）。
   v0.2.54.0 i18n：选项元组带 i18n 键（值不译、标签渲染处取 T()）；zh 值逐字节=现有文案。 */
(function (global) {
  'use strict';
  const { h, esc, fmtDateTime, chip, pageHead, empty, denied, pager, seg, toast } = UI;

  // v0.2.54.0 i18n：T(key) 取当前语言；回落原文
  const T = (k) => (window.MN_I18N && window.MN_I18N.t(k)) || null;

  const RESULT_LABEL = { success: ['成功', 'ok', 'admin.result.success'], failed: ['失败', 'high', 'admin.result.failed'], banned: ['封禁', 'high', 'admin.result.banned'], deleted: ['已删除', 'neutral', 'admin.result.deleted'], no_user: ['无此用户', 'neutral', 'admin.result.noUser'] };
  const EVENT_ZH = { suspicious_login: '可疑登录', password_change: '密码修改', email_change: '邮箱修改', '2fa_change': '两步验证变更', new_device: '新设备', new_session: '新会话', account_recovery: '账号找回', security_settings_change: '安全设置变更' };
  const EVENT_KEY = { suspicious_login: 'admin.event.suspiciousLogin', password_change: 'admin.event.passwordChange', email_change: 'admin.event.emailChange', '2fa_change': 'admin.event.twoFaChange', new_device: 'admin.event.newDevice', new_session: 'admin.event.newSession', account_recovery: 'admin.event.accountRecovery', security_settings_change: 'admin.event.securitySettingsChange' };

  const state = { tab: 'logins', userId: '', result: '', eventType: '', page: 1 };

  function render(root) {
    const tableBox = h('div', {});
    const pageBox = h('div', { class: 'pager' });
    let timer = null;
    const userInput = h('input', { class: 'adm-input', placeholder: (T('admin.security.userIdPh') || '按用户 ID 筛选'), value: state.userId, style: 'width:220px',
      oninput: (e) => {
        state.userId = e.target.value.trim();
        clearTimeout(timer);
        timer = setTimeout(() => { state.page = 1; load(); }, 400);
      } });

    function buildControls() {
      return h('div', { class: 'adm-card' },
        h('div', { class: 'row', style: 'justify-content:space-between' },
          seg([{ key: 'logins', label: (T('admin.security.tabLogins') || '登录史') }, { key: 'events', label: (T('admin.security.tabEvents') || '安全事件') }], state.tab,
            (k) => { state.tab = k; state.page = 1; render(root); }),
          h('span', { class: 'adm-meta', text: (T('admin.security.globalViewMeta') || '全局视图（security.view_all）· 数据已按角色掩码（§28）') })),
        h('div', { class: 'row', style: 'margin-top:8px;margin-bottom:0' }, userInput,
          state.tab === 'logins'
            ? h('select', { class: 'adm-select', onchange: (e) => { state.result = e.target.value; state.page = 1; load(); } },
              ...[['', '全部结果', 'admin.security.allResults'], ['success', '成功', 'admin.result.success'], ['failed', '失败', 'admin.result.failed'], ['banned', '封禁', 'admin.result.banned'], ['deleted', '已删除', 'admin.result.deleted'], ['no_user', '无此用户', 'admin.result.noUser']]
                .map(([k, label, ik]) => h('option', { value: k, selected: k === state.result, text: (T(ik) || label) })))
            : h('select', { class: 'adm-select', onchange: (e) => { state.eventType = e.target.value; state.page = 1; load(); } },
              ...[['', '全部事件类型', 'admin.security.allEventTypes']].concat(Object.entries(EVENT_ZH).map(([k, label]) => [k, label, EVENT_KEY[k]]))
                .map(([k, label, ik]) => h('option', { value: k, selected: k === state.eventType, text: (T(ik) || label) })))));
    }

    function load() {
      const q = SC.qs(state.tab === 'logins'
        ? { userId: state.userId, result: state.result, page: state.page }
        : { userId: state.userId, eventType: state.eventType, page: state.page });
      SC.get('/staff/security/' + (state.tab === 'logins' ? 'logins' : 'events') + '?' + q).then((r) => {
        pageBox.replaceChildren();
        if (r.networkError) return empty(tableBox, (T('admin.network.unreachable') || '无法连接后端'));
        if (!r.ok) {
          const d = h('div', {});
          denied(d, r.status, r.data);
          const hint = r.status === 403
            ? h('p', { class: 'adm-meta', style: 'padding:0 var(--space-md);margin-top:8px',
              text: (T('admin.security.noGlobalHint') || '提示：无全局视图权限的角色，仍可在 Users 页查看单个用户的安全档案（按 users.view 掩码）。') })
            : null;
          return tableBox.replaceChildren(d.firstChild, hint);
        }
        const rows = state.tab === 'logins' ? r.data.logins : r.data.events;
        if (!rows.length) return empty(tableBox, (T('admin.security.noMatch') || '没有符合条件的数据'));
        tableBox.replaceChildren(state.tab === 'logins' ? loginsTable(rows) : eventsTable(rows));
        pager(pageBox, r.data, (p) => { state.page = p; load(); });
      });
    }

    function loginsTable(rows) {
      return h('table', { class: 'adm-table' },
        h('thead', {}, h('tr', {},
          h('th', { text: (T('admin.users.thUser') || '用户') }), h('th', { text: 'IP' }), h('th', { text: (T('admin.users.thDeviceBrowser') || '设备 / 浏览器') }),
          h('th', { text: (T('admin.users.thResult') || '结果') }), h('th', { text: (T('admin.users.thRiskFlags') || '风险信号') }), h('th', { text: (T('admin.users.thTime') || '时间') }))),
        h('tbody', {}, ...rows.map((l) => h('tr', {},
          h('td', {}, h('div', { text: l.email || '—' }), h('code', { text: l.actor_id })),
          h('td', {}, h('code', { text: l.ip || '—' })),
          h('td', { text: [l.device, l.browser, l.os].filter(Boolean).join(' / ') || '—' }),
          h('td', {}, (RESULT_LABEL[l.result]
            ? h('span', { class: 'chip ' + RESULT_LABEL[l.result][1], text: (T(RESULT_LABEL[l.result][2]) || RESULT_LABEL[l.result][0]) })
            : h('span', { text: l.result }))),
          h('td', { text: l.risk_flags || '—' }),
          h('td', { text: fmtDateTime(l.created_at) })))));
    }

    function eventsTable(rows) {
      return h('table', { class: 'adm-table' },
        h('thead', {}, h('tr', {},
          h('th', { text: (T('admin.users.thEvent') || '事件') }), h('th', { text: (T('admin.users.thUser') || '用户') }), h('th', { text: 'IP' }), h('th', { text: (T('admin.users.thRisk') || '风险') }),
          h('th', { text: (T('admin.users.thDetail') || '详情') }), h('th', { text: (T('admin.security.thFollowUp') || '跟进') }), h('th', { text: (T('admin.users.thTime') || '时间') }))),
        h('tbody', {}, ...rows.map((e) => h('tr', {},
          h('td', { text: (EVENT_KEY[e.event_type] ? (T(EVENT_KEY[e.event_type]) || EVENT_ZH[e.event_type]) : EVENT_ZH[e.event_type]) || e.event_type }),
          h('td', {}, h('code', { text: e.actor_id || '—' })),
          h('td', {}, h('code', { text: e.ip || '—' })),
          h('td', {}, chip('risk', e.risk_level || 'low')),
          h('td', { text: (e.detail || '').slice(0, 60) || '—' }),
          h('td', {}, e.flagged
            ? h('span', { class: 'chip ok', text: (T('admin.users.flagged') || '已标记') })
            : (SC.can('security.manage')
              ? h('button', { class: 'btn', text: (T('admin.security.flagFollowUp') || '标记跟进'), onclick: () => flagEvent(e.id) })
              : h('span', { class: 'adm-meta', text: '—' }))),
          h('td', { text: fmtDateTime(e.created_at) })))));
    }

    function flagEvent(eventId) {
      const note = (global.prompt((T('admin.users.flagPrompt') || '跟进备注（可留空，最多 500 字）：')) || '').trim();
      SC.post('/staff/security/events/' + eventId + '/flag', { note }).then((r) => {
        if (r.ok) { toast((T('admin.users.flagDone') || '已标记事件（写操作已审计）')); load(); }
        else toast((T('admin.users.flagFail') || '标记失败：') + ((r.data && r.data.error && r.data.error.message) || r.status));
      });
    }

    root.replaceChildren(pageHead((T('admin.nav.security.en') || 'Security'), (T('admin.security.subtitle') || '安全中心'), (T('admin.security.headMeta') || '登录史与安全事件 · 标记写操作全程审计（§25）')), buildControls(), tableBox, pageBox);
    load();
  }

  // 重新登录（app.js showPanel）时按「新页面加载」清零（同 pages-users）
  function reset() {
    state.tab = 'logins'; state.userId = ''; state.result = ''; state.eventType = ''; state.page = 1;
  }

  SC.pages.security = { render, reset };
})(window);
