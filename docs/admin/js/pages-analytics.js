/* SlatiControl 页面：Analytics 分析（§2）——GET /api/staff/analytics/:domain?range=
   五域（users/content/community/traffic/finance）× 六档时间窗；全部读时聚合（D9）。
   声明式域配置：stats 支持嵌套路径（retention.day1）与格式化（rm/pct）。 */
(function (global) {
  'use strict';
  const { h, fmtMicro, fmtPct, pageHead, empty, denied, seg } = UI;

  const RANGES = [
    { key: 'today', label: '今日' }, { key: '7d', label: '近 7 天' }, { key: '30d', label: '近 30 天' },
    { key: '90d', label: '近 90 天' }, { key: '1y', label: '近 1 年' }, { key: 'custom', label: '自定义' }
  ];

  const DOMAINS = {
    users: {
      zh: '用户',
      stats: [['total', '用户总数'], ['newCount', '窗口内新增'], ['active', '活跃用户'], ['retention.day1', 'D1 留存', 'pct'], ['retention.day7', 'D7 留存', 'pct'], ['retention.day30', 'D30 留存', 'pct']],
      donuts: [{ title: '套餐分布', field: 'byTier', key: 'tier' }, { title: '状态分布', field: 'byStatus', key: 'status' }, { title: '风险分布', field: 'byRisk', key: 'risk' }],
      tables: [{ title: '国家/地区 TOP10', field: 'byCountry', key: 'country' }],
      dailyTitle: '注册与活跃', daily: [{ k: 'signups', label: '注册' }, { k: 'active', label: '活跃' }]
    },
    content: {
      zh: '内容',
      stats: [['posts', '窗口内帖子'], ['pendingModeration', '待审核'], ['openReports', '待处理举报'], ['articles', '窗口内文章']],
      tables: [{ title: '帖子状态分布', field: 'byStatus', key: 'status' }, { title: '审核决定', field: 'decisions', key: 'action' }],
      dailyTitle: '帖子 · 移除 · 举报', daily: [{ k: 'posts', label: '帖子' }, { k: 'removed', label: '移除' }, { k: 'reports', label: '举报' }]
    },
    community: {
      zh: '社区',
      stats: [['nations', '国家'], ['teams', '团队'], ['topics', '话题'], ['conversations', '私信会话'], ['following', '关注关系'], ['comments', '窗口内评论'], ['likes', '帖子点赞'], ['messages', '窗口内消息']],
      dailyTitle: '消息 · 评论 · 点赞', daily: [{ k: 'messages', label: '消息' }, { k: 'comments', label: '评论' }, { k: 'likes', label: '点赞' }]
    },
    traffic: {
      zh: '访问',
      stats: [['views', '访问量'], ['clients', '独立访客']],
      tables: [
        { title: '热门路径 TOP10', field: 'byPath', key: 'path', bars: true },
        { title: '国家/地区 TOP10', field: 'byCountry', key: 'country', bars: true },
        { title: '设备 TOP10', field: 'byDevice', key: 'device', bars: true },
        { title: '浏览器 TOP10', field: 'byBrowser', key: 'browser', bars: true },
        { title: '语言 TOP10', field: 'byLanguage', key: 'language', bars: true }
      ],
      dailyTitle: '访问量', daily: [{ k: 'views', label: '访问量' }]
    },
    finance: {
      zh: '财务',
      stats: [['revenueMicro', '窗口收入', 'rm'], ['mrrMicro', 'MRR', 'rm'], ['activeSubs', '活跃订阅'], ['payingUsers', '付费用户'], ['aiCostMicro', 'AI 成本', 'rm'], ['ledgerIncomeMicro', '流水收入', 'rm'], ['ledgerExpenseMicro', '流水支出', 'rm']],
      dailyTitle: '每日收入', daily: [{ k: 'revenueMicro', label: '收入' }], yFmt: (v) => 'RM ' + Math.round(v / 1e6)
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
      ...cfg.stats.map(([path, label, fmt]) => h('div', { class: 'stat-card' },
        h('div', { class: 'stat-num', text: statText(ov, path, fmt) }),
        h('div', { class: 'stat-label', text: label })))));

    // 环形图（并列卡片）——canvas 挂 DOM 后取尺寸再画
    if (cfg.donuts && cfg.donuts.length) {
      const grid = h('div', { class: 'dash-grid' },
        ...cfg.donuts.map((dn) => {
          const rows = (ov[dn.field] || []).map((r) => ({ label: String(r[dn.key] ?? '?'), n: r.n }));
          const total = rows.reduce((s, r) => s + r.n, 0);
          return h('section', { class: 'adm-card' },
            h('div', { class: 'adm-card-title' }, h('h3', { text: dn.title })),
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
        h('div', { class: 'adm-card-title' }, h('h3', { text: cfg.dailyTitle })),
        h('div', { class: 'chart-box' }, h('canvas')));
      container.appendChild(chartCard);
      Charts.line(chartCard.querySelector('canvas'),
        cfg.daily.map((dk) => ({ label: dk.label, values: d.daily.map((row) => row[dk.k]) })),
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
          h('div', { class: 'adm-card-title' }, h('h3', { text: tb.title })),
          tb.bars
            ? h('div', { class: 'chart-box' }, h('canvas', { dataset: { bars: tb.field } }))
            : (rows.length
              ? h('table', { class: 'adm-table' },
                h('thead', {}, h('tr', {}, h('th', { text: tb.key }), h('th', { text: '数量', style: 'text-align:right' }))),
                h('tbody', {}, ...rows.map((r) => h('tr', {},
                  h('td', { text: String(r[tb.key] ?? '?') }), h('td', { text: String(r.n), style: 'text-align:right' })))))
              : h('div', { class: 'empty', text: '暂无数据' })));
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
        if (r.networkError) return empty(body, '无法连接后端');
        if (!r.ok) return denied(body, r.status, r.data);
        const cfg = DOMAINS[state.domain];
        // 每次重建 body（canvas 重画）；controls 保持
        body.replaceChildren();
        buildBody(body, r.data, cfg);
        controls.querySelector('#anMeta').textContent =
          `${cfg.zh} · ${r.data.from} ~ ${r.data.to} · 共 ${r.data.daily.length} 天`;
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
        seg(Object.entries(DOMAINS).map(([k, v]) => ({ key: k, label: v.zh })), state.domain,
          (k) => { state.domain = k; fetchData(root, controls, body); }),
        h('span', { class: 'adm-meta', id: 'anMeta', text: '加载中…' })),
      h('div', { class: 'row', style: 'margin-top:8px' },
        seg(RANGES, state.range, (k) => { state.range = k; fetchData(root, controls, body); }),
        state.range === 'custom' ? h('div', { class: 'row' },
          h('input', { class: 'adm-input', id: 'anFrom', type: 'date' }),
          h('span', { class: 'adm-meta', text: '~' }),
          h('input', { class: 'adm-input', id: 'anTo', type: 'date' }),
          h('button', { class: 'btn', text: '应用', onclick: () => {
            state.from = controls.querySelector('#anFrom').value;
            state.to = controls.querySelector('#anTo').value;
            fetchData(root, controls, body);
          } })) : null));
    const body = h('div', {});
    root.replaceChildren(pageHead('Analytics', '数据分析', '全部实时聚合 · 零缓存（D9）'), controls, body);
    fetchData(root, controls, body);
  }

  // 重新登录（app.js showPanel）时按「新页面加载」清零（同 pages-users）
  function reset() { state.domain = 'users'; state.range = '30d'; state.from = ''; state.to = ''; }

  SC.pages.analytics = { render, reset };
})(window);
