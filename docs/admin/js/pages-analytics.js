/* SlatiControl 页面：Analytics 分析（§2）——GET /api/staff/analytics/:domain?range=
   五域（users/content/community/traffic/finance）× 六档时间窗；全部读时聚合（D9）。
   声明式域配置：stats 支持嵌套路径（retention.day1）与格式化（rm/pct）。
   v0.2.54.0 i18n：配置元组带 i18n 键，渲染处取 T()；zh 值逐字节=现有文案。 */
(function (global) {
  'use strict';
  const { h, fmtMicro, fmtPct, pageHead, empty, denied, seg } = UI;

  // v0.2.54.0 i18n：T(key) 取当前语言；回落原文
  const T = (k) => (window.MN_I18N && window.MN_I18N.t(k)) || null;

  const RANGES = [
    { key: 'today', label: '今日', ik: 'admin.range.today' }, { key: '7d', label: '近 7 天', ik: 'admin.range.7d' }, { key: '30d', label: '近 30 天', ik: 'admin.range.30d' },
    { key: '90d', label: '近 90 天', ik: 'admin.range.90d' }, { key: '1y', label: '近 1 年', ik: 'admin.range.1y' }, { key: 'custom', label: '自定义', ik: 'admin.range.custom' }
  ];

  const DOMAINS = {
    users: {
      zh: '用户', kZh: 'admin.nav.users.zh',
      stats: [['total', '用户总数', null, 'admin.stat.usersTotal'], ['newCount', '窗口内新增', null, 'admin.stat.windowNew'], ['active', '活跃用户', null, 'admin.stat.activeUsers'], ['retention.day1', 'D1 留存', 'pct', 'admin.stat.retentionD1'], ['retention.day7', 'D7 留存', 'pct', 'admin.stat.retentionD7'], ['retention.day30', 'D30 留存', 'pct', 'admin.stat.retentionD30']],
      donuts: [{ title: '套餐分布', k: 'admin.analytics.tierDist', field: 'byTier', key: 'tier' }, { title: '状态分布', k: 'admin.analytics.statusDist', field: 'byStatus', key: 'status' }, { title: '风险分布', k: 'admin.analytics.riskDist', field: 'byRisk', key: 'risk' }],
      tables: [{ title: '国家/地区 TOP10', k: 'admin.analytics.countryTop', field: 'byCountry', key: 'country' }],
      dailyTitle: '注册与活跃', kDaily: 'admin.analytics.dailySignups', daily: [{ k: 'signups', label: '注册', ik: 'admin.stat.signups' }, { k: 'active', label: '活跃', ik: 'admin.stat.active' }]
    },
    content: {
      zh: '内容', kZh: 'admin.nav.content.zh',
      stats: [['posts', '窗口内帖子', null, 'admin.stat.windowPosts'], ['pendingModeration', '待审核', null, 'admin.stat.pendingModeration'], ['openReports', '待处理举报', null, 'admin.stat.openReports'], ['articles', '窗口内文章', null, 'admin.stat.windowArticles']],
      tables: [{ title: '帖子状态分布', k: 'admin.analytics.postStatusDist', field: 'byStatus', key: 'status' }, { title: '审核决定', k: 'admin.analytics.moderationDecisions', field: 'decisions', key: 'action' }],
      dailyTitle: '帖子 · 移除 · 举报', kDaily: 'admin.analytics.dailyPosts', daily: [{ k: 'posts', label: '帖子', ik: 'admin.stat.posts' }, { k: 'removed', label: '移除', ik: 'admin.stat.removed' }, { k: 'reports', label: '举报', ik: 'admin.stat.reports' }]
    },
    community: {
      zh: '社区', kZh: 'admin.nav.community.zh',
      stats: [['nations', '国家', null, 'admin.stat.nations'], ['teams', '团队', null, 'admin.stat.teams'], ['topics', '话题', null, 'admin.stat.topics'], ['conversations', '私信会话', null, 'admin.stat.conversations'], ['following', '关注关系', null, 'admin.stat.following'], ['comments', '窗口内评论', null, 'admin.stat.windowComments'], ['likes', '帖子点赞', null, 'admin.stat.postLikes'], ['messages', '窗口内消息', null, 'admin.stat.windowMessages']],
      dailyTitle: '消息 · 评论 · 点赞', kDaily: 'admin.analytics.dailyMessages', daily: [{ k: 'messages', label: '消息', ik: 'admin.stat.messages' }, { k: 'comments', label: '评论', ik: 'admin.stat.comments' }, { k: 'likes', label: '点赞', ik: 'admin.stat.likes' }]
    },
    traffic: {
      zh: '访问', kZh: 'admin.analytics.domainTraffic',
      stats: [['views', '访问量', null, 'admin.stat.views'], ['clients', '独立访客', null, 'admin.stat.clients']],
      tables: [
        { title: '热门路径 TOP10', k: 'admin.analytics.pathTop', field: 'byPath', key: 'path', bars: true },
        { title: '国家/地区 TOP10', k: 'admin.analytics.countryTop', field: 'byCountry', key: 'country', bars: true },
        { title: '设备 TOP10', k: 'admin.analytics.deviceTop', field: 'byDevice', key: 'device', bars: true },
        { title: '浏览器 TOP10', k: 'admin.analytics.browserTop', field: 'byBrowser', key: 'browser', bars: true },
        { title: '语言 TOP10', k: 'admin.analytics.languageTop', field: 'byLanguage', key: 'language', bars: true }
      ],
      dailyTitle: '访问量', kDaily: 'admin.stat.views', daily: [{ k: 'views', label: '访问量', ik: 'admin.stat.views' }]
    },
    finance: {
      zh: '财务', kZh: 'admin.nav.finance.zh',
      stats: [['revenueMicro', '窗口收入', 'rm', 'admin.stat.windowRevenue'], ['mrrMicro', 'MRR', 'rm', null], ['activeSubs', '活跃订阅', null, 'admin.stat.activeSubs'], ['payingUsers', '付费用户', null, 'admin.stat.payingUsers'], ['aiCostMicro', 'AI 成本', 'rm', 'admin.stat.aiCost'], ['ledgerIncomeMicro', '流水收入', 'rm', 'admin.stat.ledgerIncome'], ['ledgerExpenseMicro', '流水支出', 'rm', 'admin.stat.ledgerExpense']],
      dailyTitle: '每日收入', kDaily: 'admin.analytics.dailyRevenue', daily: [{ k: 'revenueMicro', label: '收入', ik: 'admin.stat.revenue' }], yFmt: (v) => 'RM ' + Math.round(v / 1e6)
    }
  };

  const state = { domain: 'users', range: '30d', from: '', to: '' };

  function statValue(ov, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), ov);
  }
  function statText(ov, path, fmt) {
    const v = statValue(ov, path);
    if (v == null) return '—';
    if (fmt === 'rm') return fmtMicro(v);
    if (fmt === 'pct') return fmtPct(v);
    return Number(v).toLocaleString('zh-CN');
  }

  function legend(items, total) {
    return h('div', { style: 'margin-top:6px' },
      ...items.map((it, i) => h('div', { class: 'kv' },
        h('span', { class: 'k' },
          h('span', { style: `display:inline-block;width:9px;height:9px;border-radius:50%;background:${it.color || Charts.palette[i % Charts.palette.length]};margin-right:6px` }),
          h('span', { text: it.label })),
        h('span', { class: 'v', text: `${it.n} · ${total ? fmtPct(Number(it.n) / total) : '0%'}` }))));
  }

  function buildBody(container, d, cfg) {
    const ov = d.overview;

    // 概览统计条
    container.replaceChildren(h('div', { class: 'stat-strip' },
      ...cfg.stats.map(([path, label, fmt, ik]) => h('div', { class: 'stat-card' },
        h('div', { class: 'stat-num', text: statText(ov, path, fmt) }),
        h('div', { class: 'stat-label', text: (ik ? (T(ik) || label) : label) })))));

    // 环形图（并列卡片）——canvas 挂 DOM 后取尺寸再画
    if (cfg.donuts && cfg.donuts.length) {
      const grid = h('div', { class: 'dash-grid' },
        ...cfg.donuts.map((dn) => {
          const rows = (ov[dn.field] || []).map((r) => ({ label: String(r[dn.key] ?? '?'), n: r.n }));
          const total = rows.reduce((s, r) => s + r.n, 0);
          return h('section', { class: 'adm-card' },
            h('div', { class: 'adm-card-title' }, h('h3', { text: (T(dn.k) || dn.title) })),
            h('div', { class: 'chart-box' }, h('canvas', { dataset: { donut: dn.field }, style: 'height:170px' })),
            legend(rows, total));
        }));
      container.appendChild(grid);
      grid.querySelectorAll('canvas[data-donut]').forEach((cv) => {
        const dn = cfg.donuts.find((x) => x.field === cv.dataset.donut);
        const rows = (ov[dn.field] || []).map((r) => ({ label: String(r[dn.key] ?? '?'), n: r.n }));
        const total = rows.reduce((s, r) => s + r.n, 0);
        Charts.donut(cv, rows, total.toLocaleString('zh-CN'));
      });
    }

    // 折线图
    if (cfg.daily && d.daily && d.daily.length) {
      const chartCard = h('section', { class: 'adm-card' },
        h('div', { class: 'adm-card-title' }, h('h3', { text: (T(cfg.kDaily) || cfg.dailyTitle) })),
        h('div', { class: 'chart-box' }, h('canvas')));
      container.appendChild(chartCard);
      Charts.line(chartCard.querySelector('canvas'),
        cfg.daily.map((dk) => ({ label: (T(dk.ik) || dk.label), values: d.daily.map((row) => row[dk.k]) })),
        d.daily.map((row) => row.date),
        { yFmt: cfg.yFmt });
    }

    // 明细表 / 条形排行
    if (cfg.tables && cfg.tables.length) {
      const grid = h('div', { class: 'dash-grid' });
      container.appendChild(grid);
      cfg.tables.forEach((tb) => {
        const rows = ov[tb.field] || [];
        const card = h('section', { class: 'adm-card' },
          h('div', { class: 'adm-card-title' }, h('h3', { text: (T(tb.k) || tb.title) })),
          tb.bars
            ? h('div', { class: 'chart-box' }, h('canvas', { dataset: { bars: tb.field } }))
            : (rows.length
              ? h('table', { class: 'adm-table' },
                h('thead', {}, h('tr', {}, h('th', { text: tb.key }), h('th', { text: (T('admin.analytics.count') || '数量'), style: 'text-align:right' }))),
                h('tbody', {}, ...rows.map((r) => h('tr', {},
                  h('td', { text: String(r[tb.key] ?? '?') }), h('td', { text: String(r.n), style: 'text-align:right' })))))
              : h('div', { class: 'empty', text: (T('admin.empty.noData') || '暂无数据') })));
        grid.appendChild(card);
        if (tb.bars) {
          const cv = card.querySelector('canvas');
          Charts.hbars(cv, rows.map((r) => ({ name: String(r[tb.key] ?? '?'), n: r.n })));
        }
      });
    }
  }

  function fetchData(root, controls, body) {
    SC.get('/staff/analytics/' + state.domain + '?' + SC.qs({ range: state.range, from: state.from, to: state.to }))
      .then((r) => {
        if (r.networkError) return empty(body, (T('admin.network.unreachable') || '无法连接后端'));
        if (!r.ok) return denied(body, r.status, r.data);
        const cfg = DOMAINS[state.domain];
        // 每次重建 body（canvas 重画）；controls 保持
        body.replaceChildren();
        buildBody(body, r.data, cfg);
        controls.querySelector('#anMeta').textContent =
          (T(cfg.kZh) || cfg.zh) + ' · ' + r.data.from + ' ~ ' + r.data.to + (T('admin.analytics.metaTail') || ' · 共 ') + r.data.daily.length + (T('admin.analytics.metaDays') || ' 天');
        // 自定义输入框与状态同步（输入框仅在 custom 档存在）
        if (state.range === 'custom') {
          controls.querySelector('#anFrom').value = r.data.from;
          controls.querySelector('#anTo').value = r.data.to;
        }
      });
  }

  function render(root) {
    const controls = h('div', { class: 'adm-card' },
      h('div', { class: 'row', style: 'justify-content:space-between' },
        seg(Object.entries(DOMAINS).map(([k, v]) => ({ key: k, label: (T(v.kZh) || v.zh) })), state.domain,
          (k) => { state.domain = k; fetchData(root, controls, body); }),
        h('span', { class: 'adm-meta', id: 'anMeta', text: (T('admin.loading') || '加载中…') })),
      h('div', { class: 'row', style: 'margin-top:8px' },
        seg(RANGES.map((r) => ({ key: r.key, label: (T(r.ik) || r.label) })), state.range, (k) => { state.range = k; fetchData(root, controls, body); }),
        state.range === 'custom' ? h('div', { class: 'row' },
          h('input', { class: 'adm-input', id: 'anFrom', type: 'date' }),
          h('span', { class: 'adm-meta', text: '~' }),
          h('input', { class: 'adm-input', id: 'anTo', type: 'date' }),
          h('button', { class: 'btn', text: (T('admin.apply') || '应用'), onclick: () => {
            state.from = controls.querySelector('#anFrom').value;
            state.to = controls.querySelector('#anTo').value;
            fetchData(root, controls, body);
          } })) : null));
    const body = h('div', {});
    root.replaceChildren(pageHead((T('admin.nav.analytics.en') || 'Analytics'), (T('admin.analytics.subtitle') || '数据分析'), (T('admin.analytics.headMeta') || '全部实时聚合 · 零缓存（D9）')), controls, body);
    fetchData(root, controls, body);
  }

  // 重新登录（app.js showPanel）时按「新页面加载」清零（同 pages-users）
  function reset() { state.domain = 'users'; state.range = '30d'; state.from = ''; state.to = ''; }

  SC.pages.analytics = { render, reset };
})(window);
