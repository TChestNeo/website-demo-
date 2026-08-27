/* SlatiControl 页面：Dashboard 总览（§1）——GET /api/staff/dashboard 六组统计卡单次聚合。
   纯读零审计；金额字段微元 → fmtMicro（D1 双平面）。 */
(function (global) {
  'use strict';
  const { h, fmtMicro, fmtDateTime, pageHead, empty, denied } = UI;

  const GROUPS = [
    { key: 'users', en: 'Users', zh: '用户', icon: 'group', stats: [['total', '用户总数'], ['new7d', '新增 · 近 7 天'], ['active24h', '活跃 · 24 小时'], ['banned', '已封禁']] },
    { key: 'content', en: 'Content', zh: '内容', icon: 'article', stats: [['posts', '帖子'], ['pendingModeration', '待审核'], ['hidden', '已下架'], ['openReports', '待处理举报']] },
    { key: 'community', en: 'Community', zh: '社区', icon: 'forum', stats: [['nations', '国家'], ['teams', '团队'], ['conversations', '私信会话'], ['following', '关注关系']] },
    { key: 'finance', en: 'Finance', zh: '财务', icon: 'payments', stats: [['revenueMonthMicro', '本月收入', 'rm'], ['mrrMicro', 'MRR', 'rm'], ['aiCostMonthMicro', 'AI 成本 · 本月', 'rm'], ['payingUsers', '付费用户']] },
    { key: 'tickets', en: 'Customer Service', zh: '客服', icon: 'support_agent', stats: [['open', '待处理工单'], ['unassigned', '未分配'], ['escalated', '升级中'], ['resolved30d', '30 天内已解决']] },
    { key: 'platform', en: 'Platform', zh: '平台', icon: 'monitoring', stats: [['signups24h', '注册 · 24h'], ['logins24h', '登录 · 24h'], ['failedLogins24h', '失败登录 · 24h'], ['riskHigh', '高风险用户']] }
  ];

  function render(root) {
    SC.get('/staff/dashboard').then((r) => {
      if (r.networkError) return empty(root, '无法连接后端');
      if (!r.ok) return denied(root, r.status, r.data);
      const d = r.data;
      root.replaceChildren(
        pageHead('Dashboard', '平台总览', `数据生成于 ${fmtDateTime(d.generatedAt)} · 每 60 秒刷新`),
        h('div', { class: 'dash-grid' },
          ...GROUPS.map((g) => {
            const data = d.groups[g.key];
            if (!data) return null;
            return h('section', { class: 'adm-card' },
              h('div', { class: 'adm-card-title' },
                h('div', {},
                  h('h3', { text: g.en }),
                  h('div', { class: 'sub', text: g.zh })),
                h('span', { class: 'material-symbols-outlined adm-meta', text: g.icon })
              ),
              h('div', { class: 'stat-strip' },
                ...g.stats.map(([k, label, fmt]) => h('div', { class: 'stat-card' },
                  h('div', { class: 'stat-num', text: fmt === 'rm' ? fmtMicro(data[k]) : String(data[k] ?? 0) }),
                  h('div', { class: 'stat-label', text: label })))));
          })
        )
      );
    });
  }

  SC.pages.dashboard = { render };
})(window);
