/* SlatiControl 页面：Users 用户（§3/§4）——GET /api/staff/users 列表 + /:id 详情。
   掩码矩阵（§28）：字段按角色到达即所见（cs 无支付/内部字段，后端已剥）；前端不二次推断。
   详情联动 GET /staff/users/:id/security（users.view：cs 只见近 10 条 + IP 前两段）。 */
(function (global) {
  'use strict';
  const { h, esc, fmtDateTime, fmtMicro, fmtDate, chip, pageHead, empty, denied, pager, kvList, toast } = UI;

  const FILTERS = [['all', '全部'], ['active', '正常'], ['banned', '已封禁'], ['delete_pending', '待删除'], ['risk', '有风险']];
  const SORTS = [['created_desc', '注册时间（新 → 旧）'], ['created_asc', '注册时间（旧 → 新）'], ['last_active_desc', '最后活跃'], ['risk_desc', '风险优先']];
  const RESULT_LABEL = { success: ['成功', 'ok'], failed: ['失败', 'high'], banned: ['封禁', 'high'], deleted: ['已删除', 'neutral'], no_user: ['无此用户', 'neutral'] };
  const EVENT_ZH = { suspicious_login: '可疑登录', password_change: '密码修改', email_change: '邮箱修改', '2fa_change': '两步验证变更', new_device: '新设备', new_session: '新会话', account_recovery: '账号找回', security_settings_change: '安全设置变更' };
  const RISK_ZH = { high: '高危', medium: '中危', low: '低危' };

  const state = { q: '', filter: 'all', sort: 'created_desc', page: 1, view: 'list', userId: null };

  function select(entries, value, onPick) {
    return h('select', { class: 'adm-select', onchange: (e) => onPick(e.target.value) },
      ...entries.map(([k, label]) => h('option', { value: k, selected: k === value, text: label })));
  }

  function renderList(root) {
    const tableBox = h('div', {});
    const pageBox = h('div', { class: 'pager' });
    let timer = null;
    const qInput = h('input', { class: 'adm-input', placeholder: '搜索邮箱 / 昵称 / 公民号 / ID', value: state.q, style: 'flex:1;min-width:220px',
      oninput: (e) => {
        state.q = e.target.value.trim();
        clearTimeout(timer);
        timer = setTimeout(() => { state.page = 1; load(); }, 400);
      } });

    function load() {
      SC.get('/staff/users?' + SC.qs({ q: state.q, filter: state.filter, sort: state.sort, page: state.page })).then((r) => {
        if (r.networkError) return empty(tableBox, '无法连接后端');
        if (!r.ok) return denied(tableBox, r.status, r.data);
        const rows = r.data.users;
        if (!rows.length) return empty(tableBox, '没有符合条件的用户');
        tableBox.replaceChildren(h('table', { class: 'adm-table' },
          h('thead', {}, h('tr', {},
            h('th', { text: '用户' }), h('th', { text: '昵称 / 公民号' }), h('th', { text: '层级' }),
            h('th', { text: '状态' }), h('th', { text: '风险' }), h('th', { text: '注册时间' }), h('th', { text: '最后活跃' })
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
      pageHead('Users', '用户管理', '点击行查看详情 · 数据按角色权限自动掩码（§28）'),
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
      SC.get('/staff/users/' + state.userId + '/security')
    ]).then(([ru, rs]) => {
      if (ru.networkError) return empty(box, '无法连接后端');
      if (!ru.ok) { box.replaceChildren(deniedEl(ru.status, ru.data), h('button', { class: 'btn', text: '← 返回列表', onclick: () => { state.view = 'list'; renderList(root); } })); return; }
      const u = ru.data.user;
      const st = ru.data.stats;
      const sec = rs.ok ? rs.data : null;

      const header = h('div', { class: 'row', style: 'margin-bottom:var(--space-md)' },
        h('button', { class: 'btn', text: '← 返回列表', onclick: () => { state.view = 'list'; renderList(root); } }),
        h('h2', { style: 'margin:0;font-size:20px;font-weight:800', text: u.email || u.id }),
        chip('tier', u.tier), chip('status', u.status), chip('risk', u.riskLevel),
        h('code', { text: u.id }));

      const infoCard = h('div', { class: 'adm-card' },
        h('div', { class: 'adm-card-title' },
          h('div', {},
            h('h3', { text: '基本信息' }),
            h('div', { class: 'sub', text: 'Basic Info' }))),
        kvList([
          ['昵称', u.displayName], ['公民号', u.citizenId], ['国家/地区', u.country], ['语言', u.language],
          ['性别', u.gender], ['个人简介', u.bio], ['层级到期', fmtDateTime(u.tierExpiresAt)], ['注册时间', fmtDateTime(u.createdAt)],
          ['最后活跃', fmtDateTime(u.lastActiveAt)], ['最后登录', fmtDateTime(u.lastLoginAt)],
          ['风险理由', Array.isArray(u.riskReasons) && u.riskReasons.length ? u.riskReasons.join('、') : null],
          ['警告次数', u.warningCount], ['禁言至', fmtDateTime(u.mutedUntil)], ['出生日期', u.dob ? fmtDate(u.dob) : null]
        ]));

      const statsStrip = h('div', { class: 'stat-strip' },
        ...[['posts', '帖子'], ['comments', '评论'], ['following', '关注'], ['conversations', '私信会话'], ['tickets', '工单'], ['loginCount', '登录次数']]
          .map(([k, label]) => h('div', { class: 'stat-card' },
            h('div', { class: 'stat-num', text: String(st[k] ?? 0) }),
            h('div', { class: 'stat-label', text: label }))));

      // 支付摘要：无 payments 能力 → 后端 null → 显示无权限（§28 区块级掩码）
      let paymentsBody;
      if (ru.data.payments === null) {
        paymentsBody = h('p', { class: 'adm-meta', text: '当前角色无支付数据查看权限（finance / management / director 可见）。' });
      } else if (ru.data.payments.length) {
        paymentsBody = h('table', { class: 'adm-table' },
          h('thead', {}, h('tr', {},
            h('th', { text: '订单' }), h('th', { text: '套餐' }), h('th', { text: '金额' }), h('th', { text: '状态' }), h('th', { text: '支付时间' }))),
          h('tbody', {},
            ...ru.data.payments.map((p) => h('tr', {},
              h('td', {}, h('code', { text: p.id })),
              h('td', { text: p.tier_key || '—' }),
              h('td', { text: fmtMicro(p.amount_micro) }),
              h('td', { text: p.status }),
              h('td', { text: fmtDateTime(p.paid_at) })))));
      } else {
        paymentsBody = h('div', { class: 'empty', text: '暂无支付记录' });
      }
      const paymentsCard = h('section', { class: 'adm-card' },
        h('div', { class: 'adm-card-title' },
          h('div', {},
            h('h3', { text: '支付记录' }),
            h('div', { class: 'sub', text: 'Payments · 近 20 笔' }))),
        paymentsBody);

      // 安全档案（users.view 可达：cs 掩码近 10 条；security 全量）
      let securityBody;
      if (!sec) {
        securityBody = h('p', { class: 'adm-meta', text: '安全档案加载失败或无权限。' });
      } else {
        const loginsBody = sec.loginHistory.length
          ? h('table', { class: 'adm-table' },
            h('thead', {}, h('tr', {},
              h('th', { text: 'IP' }), h('th', { text: '设备 / 浏览器' }), h('th', { text: '结果' }), h('th', { text: '风险信号' }), h('th', { text: '时间' }))),
            h('tbody', {},
              ...sec.loginHistory.map((l) => h('tr', {},
                h('td', {}, h('code', { text: l.ip || '—' })),
                h('td', { text: [l.device, l.browser, l.os].filter(Boolean).join(' / ') || '—' }),
                h('td', {}, RESULT_LABEL[l.result]
                  ? h('span', { class: 'chip ' + RESULT_LABEL[l.result][1], text: RESULT_LABEL[l.result][0] })
                  : h('span', { text: l.result })),
                h('td', { text: l.risk_flags || '—' }),
                h('td', { text: fmtDateTime(l.created_at) })))))
          : h('div', { class: 'empty', text: '暂无登录记录' });
        const eventsBody = sec.events.length
          ? h('table', { class: 'adm-table' },
            h('thead', {}, h('tr', {},
              h('th', { text: '事件' }), h('th', { text: '风险' }), h('th', { text: '详情' }), h('th', { text: '标记' }), h('th', { text: '时间' }))),
            h('tbody', {},
              ...sec.events.map((e) => h('tr', {},
                h('td', { text: EVENT_ZH[e.event_type] || e.event_type }),
                h('td', {}, chip('risk', e.risk_level || 'low')),
                h('td', { text: (e.detail || '').slice(0, 60) || '—' }),
                h('td', {}, e.flagged
                  ? h('span', { class: 'chip ok', text: '已标记' })
                  : (SC.can('security.manage')
                    ? h('button', { class: 'btn', text: '标记', onclick: () => flagEvent(e.id, box) })
                    : h('span', { class: 'adm-meta', text: '—' }))),
                h('td', { text: fmtDateTime(e.created_at) })))))
          : h('div', { class: 'empty', text: '暂无安全事件' });
        securityBody = h('div', {}, loginsBody, eventsBody);
      }
      const securityCard = h('section', { class: 'adm-card' },
        h('div', { class: 'adm-card-title' },
          h('div', {},
            h('h3', { text: '安全档案' }),
            h('div', { class: 'sub', text: 'Security · 登录史与安全事件' })),
          sec ? h('div', { class: 'row' },
            h('span', { class: 'chip ' + (sec.flagged ? 'high' : 'ok'), text: `${sec.flagged} 个事件已标记` }),
            sec.loginHistory.length === 10
              ? h('span', { class: 'adm-meta', text: '当前角色仅显示近 10 条登录（§28 掩码）' })
              : null)
            : null),
        securityBody);

      box.replaceChildren(header, infoCard, statsStrip, paymentsCard, securityCard);
    });
  }

  function flagEvent(eventId, box) {
    const note = (global.prompt('跟进备注（可留空，最多 500 字）：') || '').trim();
    SC.post('/staff/security/events/' + eventId + '/flag', { note }).then((r) => {
      if (r.ok) { toast('已标记事件（写操作已审计）'); renderDetail(SC.pages.users._root); }
      else toast('标记失败：' + ((r.data && r.data.error && r.data.error.message) || r.status));
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
