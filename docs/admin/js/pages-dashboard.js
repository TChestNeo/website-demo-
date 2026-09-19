/* SlatiControl 页面：Dashboard 总览（§1）——GET /api/staff/dashboard 六组统计卡单次聚合。
   纯读零审计；金额字段微元 → fmtMicro（D1 双平面）。 */
(function (global) {
  'use strict';
  const { h, fmtMicro, fmtDateTime, pageHead, empty, denied } = UI;

  // v0.2.54.0 i18n：T(key) 取当前语言；回落原文（zh 值逐字节=现有文案）
  const T = (k) => (window.MN_I18N && window.MN_I18N.t(k)) || null;

  // 每组：kEn/kZh=组名 i18n 键；stats 元组第 4 位=标签 i18n 键（渲染处取 T()）
  const GROUPS = [
    { key: 'users', en: 'Users', zh: '用户', kEn: 'admin.nav.users.en', kZh: 'admin.nav.users.zh', icon: 'group', stats: [['total', '用户总数', null, 'admin.stat.usersTotal'], ['new7d', '新增 · 近 7 天', null, 'admin.stat.new7d'], ['active24h', '活跃 · 24 小时', null, 'admin.stat.active24h'], ['banned', '已封禁', null, 'admin.status.banned']] },
    { key: 'content', en: 'Content', zh: '内容', kEn: 'admin.nav.content.en', kZh: 'admin.nav.content.zh', icon: 'article', stats: [['posts', '帖子', null, 'admin.stat.posts'], ['pendingModeration', '待审核', null, 'admin.stat.pendingModeration'], ['hidden', '已下架', null, 'admin.stat.hidden'], ['openReports', '待处理举报', null, 'admin.stat.openReports']] },
    { key: 'community', en: 'Community', zh: '社区', kEn: 'admin.nav.community.en', kZh: 'admin.nav.community.zh', icon: 'forum', stats: [['nations', '国家', null, 'admin.stat.nations'], ['teams', '团队', null, 'admin.stat.teams'], ['conversations', '私信会话', null, 'admin.stat.conversations'], ['following', '关注关系', null, 'admin.stat.following']] },
    { key: 'finance', en: 'Finance', zh: '财务', kEn: 'admin.nav.finance.en', kZh: 'admin.nav.finance.zh', icon: 'payments', stats: [['revenueMonthMicro', '本月收入', 'rm', 'admin.stat.revenueMonth'], ['mrrMicro', 'MRR', 'rm', null], ['aiCostMonthMicro', 'AI 成本 · 本月', 'rm', 'admin.stat.aiCostMonth'], ['payingUsers', '付费用户', null, 'admin.stat.payingUsers']] },
    { key: 'tickets', en: 'Customer Service', zh: '客服', kEn: 'admin.nav.cs.en', kZh: 'admin.nav.cs.zh', icon: 'support_agent', stats: [['open', '待处理工单', null, 'admin.stat.openTickets'], ['unassigned', '未分配', null, 'admin.stat.unassigned'], ['escalated', '升级中', null, 'admin.stat.escalated'], ['resolved30d', '30 天内已解决', null, 'admin.stat.resolved30d']] },
    { key: 'platform', en: 'Platform', zh: '平台', kEn: 'admin.nav.platform.en', kZh: 'admin.nav.platform.zh', icon: 'monitoring', stats: [['signups24h', '注册 · 24h', null, 'admin.stat.signups24h'], ['logins24h', '登录 · 24h', null, 'admin.stat.logins24h'], ['failedLogins24h', '失败登录 · 24h', null, 'admin.stat.failedLogins24h'], ['riskHigh', '高风险用户', null, 'admin.stat.riskHigh']] }
  ];

  function render(root) {
    SC.get('/staff/dashboard').then((r) => {
      if (r.networkError) return empty(root, (T('admin.network.unreachable') || '无法连接后端'));
      if (!r.ok) return denied(root, r.status, r.data);
      const d = r.data;
      root.replaceChildren(
        pageHead((T('admin.nav.dashboard.en') || 'Dashboard'), (T('admin.dash.subtitle') || '平台总览'), (T('admin.dash.metaPrefix') || '数据生成于 ') + fmtDateTime(d.generatedAt) + (T('admin.dash.metaSuffix') || ' · 每 60 秒刷新')),
        h('div', { class: 'dash-grid' },
          ...GROUPS.map((g) => {
            const data = d.groups[g.key];
            if (!data) return null;
            return h('section', { class: 'adm-card' },
              h('div', { class: 'adm-card-title' },
                h('div', {},
                  h('h3', { text: (T(g.kEn) || g.en) }),
                  h('div', { class: 'sub', text: (T(g.kZh) || g.zh) })),
                h('span', { class: 'material-symbols-outlined adm-meta', text: g.icon })
              ),
              h('div', { class: 'stat-strip' },
                ...g.stats.map(([k, label, fmt, ik]) => h('div', { class: 'stat-card' },
                  h('div', { class: 'stat-num', text: fmt === 'rm' ? fmtMicro(data[k]) : String(data[k] ?? 0) }),
                  h('div', { class: 'stat-label', text: (ik ? (T(ik) || label) : label) })))));
          })
        )
      );
    });
  }

  SC.pages.dashboard = { render };
})(window);
