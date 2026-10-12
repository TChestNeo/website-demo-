(function() {
  'use strict';

  // v0.2.58.16 真实数据接入：GET /api/public/activity 聚合（KPI/趋势/内容类型/热力图/榜/里程碑）。
  // 惰性翻译 T() 保留；失败/空态绝不回退假数据；subnav .active 类名归 subnav.js 管（本页零触碰）
  function T(k) { return (window.MN_I18N && window.MN_I18N.t(k)) || null; }

  var state = { range: '30d', metric: 'users', cache: {}, search: '', failed: false };

  function fmt(n) {
    n = n || 0;
    return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toLocaleString();
  }

  // 相对时间：<1 天 → today；否则 daysAgo 插 {n}（后端 at 为 UTC ISO）
  function relTime(at) {
    var t = Date.parse(at || '');
    if (isNaN(t)) return '';
    var days = Math.floor((Date.now() - t) / 86400e3);
    if (days < 1) return T('activity.ms.time.today') || 'Today';
    return (T('activity.ms.time.daysAgo') || '{n} days ago').replace('{n}', String(days));
  }

  // deltaPct null（前窗无基准）→ 平趋势 '—'
  function trendHtml(deltaPct) {
    if (deltaPct === null || deltaPct === undefined) return '<div class="kpi-trend flat">—</div>';
    var isUp = deltaPct >= 0;
    return '<div class="kpi-trend ' + (isUp ? 'up' : 'down') + '">' +
      '<span class="material-symbols-outlined" style="font-size:14px">' + (isUp ? 'trending_up' : 'trending_down') + '</span> ' +
      (isUp ? '+' : '') + Math.abs(deltaPct).toFixed(1) + '% ' + (T('activity.kpi.period') || 'this period') +
    '</div>';
  }

  function emptyHtml(key, enFallback) {
    return '<div class="act-empty">' + (T(key) || enFallback || 'Nothing here yet') + '</div>';
  }

  // ═══════════════════════════════════════════
  // 1. KPI Row（5 卡：国家/公民/文章/动态/新公民——第 5 卡=新公民，原条约签署无表已撤）
  // ═══════════════════════════════════════════
  function renderKPI(data) {
    var kpi = (data && data.kpi) || {};
    var items = [
      { icon: 'public',     labelKey: 'activity.kpi.activeNations',     labelEn: 'Active Nations',     value: kpi.nations,     accent: '#16a34a' },
      { icon: 'group',      labelKey: 'activity.kpi.totalCitizens',     labelEn: 'Total Citizens',     value: kpi.citizens,    accent: '#ea580c' },
      { icon: 'article',    labelKey: 'activity.kpi.articlesPublished', labelEn: 'Articles Published', value: kpi.articles,    accent: '#4648d4' },
      { icon: 'bolt',       labelKey: 'activity.kpi.dailyActivity',     labelEn: 'Daily Activity',     value: kpi.activity,    accent: '#8127cf' },
      { icon: 'person_add', labelKey: 'activity.kpi.newCitizens',       labelEn: 'New Citizens',       value: kpi.newCitizens, accent: '#eab308' }
    ];
    document.getElementById('kpiRow').innerHTML = items.map(function(item) {
      var v = item.value || { value: 0, deltaPct: null };
      return '<div class="card kpi-card tilt-container" style="--kpi-accent:' + item.accent + '">' +
        '<span class="material-symbols-outlined kpi-icon" style="color:' + item.accent + '">' + item.icon + '</span>' +
        '<div class="kpi-value">' + fmt(v.value) + '</div>' +
        '<div class="kpi-label">' + (T(item.labelKey) || item.labelEn) + '</div>' +
        trendHtml(v.deltaPct) +
      '</div>';
    }).join('');
  }

  // ═══════════════════════════════════════════
  // 2. 30-Day Growth Trend Chart (SVG)——恒最近 30 天日序列（后端 trends 固定口径）
  // ═══════════════════════════════════════════
  var activityTooltip = null;

  function ensureTooltip() {
    if (activityTooltip) return;
    activityTooltip = document.createElement('div');
    activityTooltip.id = 'actTooltip';
    activityTooltip.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;background:var(--card-bg);color:var(--color-on-surface);padding:8px 14px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.1),0 1px 3px rgba(0,0,0,0.06);font-size:13px;font-weight:600;white-space:nowrap;opacity:0;transform:translate(-50%,-120%);transition:opacity 0.12s ease;line-height:1.4';
    activityTooltip.innerHTML = '<span id="ttDay"></span><br><span style="font-weight:400;color:#767586;font-size:11px" id="ttVal"></span>';
    document.body.appendChild(activityTooltip);
  }

  function attachTooltips() {
    ensureTooltip();
    var bars = document.querySelectorAll('.trend-bar');
    var ttDay = document.getElementById('ttDay');
    var ttVal = document.getElementById('ttVal');
    bars.forEach(function(bar) {
      bar.addEventListener('mouseenter', function() {
        var val = parseInt(bar.dataset.val, 10);
        var date = bar.dataset.date ? new Date(bar.dataset.date + 'T00:00:00') : new Date();
        ttDay.textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        ttVal.textContent = val.toLocaleString() + ' ' + (T('activity.metric.' + state.metric) || state.metric);
        var rect = bar.getBoundingClientRect();
        activityTooltip.style.left = (rect.left + rect.width / 2) + 'px';
        activityTooltip.style.top = (rect.top - 8) + 'px';
        activityTooltip.style.opacity = '1';
        bar.style.opacity = '0.6';
      });
      bar.addEventListener('mouseleave', function() {
        activityTooltip.style.opacity = '0';
        bar.style.opacity = '1';
      });
    });
  }

  function renderTrendChart(data) {
    var all = (data && data.trends) || {};
    var series = all[state.metric] || [];
    var barCount = series.length;
    if (!barCount) { document.getElementById('trendChart').innerHTML = ''; return; }
    var todayIdx = barCount - 1;

    var svgW = 620, svgH = 210;
    var pad = { top: 18, right: 12, bottom: 28, left: 54 };
    var chartW = svgW - pad.left - pad.right;
    var chartH = svgH - pad.top - pad.bottom;

    var values = series.map(function(r) { return r.value; });
    var maxVal = Math.max.apply(null, values);
    var minVal = Math.min.apply(null, values);
    var range = maxVal - minVal || 1;
    var barGap = 3;
    var barW = (chartW - barGap * (barCount - 1)) / barCount;

    var yTicks = [minVal, Math.round((minVal + maxVal) / 2), maxVal];

    // Bars（日期直接来自后端 data.date，不从 idx 反推）
    var barsSvg = series.map(function(r, i) {
      var h = Math.max(2, ((r.value - minVal) / range) * chartH);
      var x = pad.left + i * (barW + barGap);
      var y = pad.top + chartH - h;
      var isToday = i === todayIdx;
      var fill = isToday ? '#4648d4' : 'rgba(70,72,212,0.35)';
      var rx = Math.min(barW / 2, 2.5);
      return '<rect class="trend-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
        '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) +
        '" rx="' + rx + '" fill="' + fill + '" data-idx="' + i + '" data-val="' + r.value + '" data-date="' + r.date + '"/>';
    }).join('');

    // X-axis day labels
    var xLabels = '';
    for (var d = 0; d < barCount; d++) {
      if (d % 5 === 0 || d === todayIdx) {
        var label = new Date(series[d].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        var lx = pad.left + d * (barW + barGap) + barW / 2;
        xLabels += '<text x="' + lx.toFixed(1) + '" y="' + (svgH - 5) +
          '" font-size="9" fill="#767586" text-anchor="middle">' + label + '</text>';
      }
    }

    var svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" style="width:100%;height:210px;display:block;overflow:visible">' +
      yTicks.map(function(yt) {
        var yy = pad.top + chartH - ((yt - minVal) / range) * chartH;
        return '<line x1="' + pad.left + '" y1="' + yy.toFixed(1) + '" x2="' + (pad.left + chartW) + '" y2="' + yy.toFixed(1) +
          '" stroke="rgba(118,117,134,0.1)" stroke-dasharray="3,3"/>' +
          '<text x="' + (pad.left - 8) + '" y="' + (yy + 4).toFixed(1) +
          '" font-size="10" fill="#767586" text-anchor="end">' + (yt >= 1000 ? (yt/1000).toFixed(0)+'K' : yt) + '</text>';
      }).join('') +
      barsSvg +
      xLabels +
      '<line x1="' + (pad.left + todayIdx * (barW + barGap) + barW/2).toFixed(1) +
      '" y1="' + pad.top + '" x2="' + (pad.left + todayIdx * (barW + barGap) + barW/2).toFixed(1) +
      '" y2="' + (pad.top + chartH) + '" stroke="#4648d4" stroke-width="1" stroke-dasharray="4,3" opacity="0.35"/>' +
      '</svg>';

    document.getElementById('trendChart').innerHTML = svg;
    attachTooltips();
  }

  // ═══════════════════════════════════════════
  // 3. Content Types (Horizontal Bars)——真实四类型，取代旧分类假数据
  // ═══════════════════════════════════════════
  var CT_META = [
    { key: 'articles', color: '#4648d4', labelEn: 'Articles' },
    { key: 'posts',    color: '#16a34a', labelEn: 'Posts' },
    { key: 'comments', color: '#8127cf', labelEn: 'Comments' },
    { key: 'likes',    color: '#eab308', labelEn: 'Likes' }
  ];

  function renderContentTypes(data) {
    var ct = (data && data.contentTypes) || {};
    var total = CT_META.reduce(function(s, m) { return s + (ct[m.key] || 0); }, 0);
    if (!total) { document.getElementById('categoryChart').innerHTML = emptyHtml('activity.empty.section'); return; }
    document.getElementById('categoryChart').innerHTML = CT_META.map(function(m) {
      var count = ct[m.key] || 0;
      var pct = ((count / total) * 100).toFixed(1);
      return '<div class="hbar-row">' +
        '<span class="hbar-label">' + (T('activity.ct.' + m.key) || m.labelEn) + '</span>' +
        '<div style="flex:1;height:8px;background:rgba(118,117,134,0.08);border-radius:4px;overflow:hidden">' +
          '<div class="hbar-bar" style="width:' + pct + '%;background:' + m.color + '"></div>' +
        '</div>' +
        '<span class="hbar-count">' + count.toLocaleString() + '</span>' +
        '<span class="hbar-pct" style="color:' + m.color + ';font-weight:600">' + pct + '%</span>' +
      '</div>';
    }).join('');
  }

  // ═══════════════════════════════════════════
  // 4. Weekly Activity Heatmap（6 时段 × 7 天；空表期友好空态，形状保持）
  // ═══════════════════════════════════════════
  function renderHeatmap(data) {
    var hm = (data && data.heatmap) || null;
    if (!hm || !hm.maxCell) {
      document.getElementById('heatmapContainer').innerHTML = emptyHtml('activity.empty.heatmap', 'Visit data is still accumulating — check back soon');
      return;
    }
    var maxCell = hm.maxCell;
    var cells = '';

    for (var row = 0; row < hm.timeBlocks.length; row++) {
      cells += '<div class="heatmap-label">' + hm.timeBlocks[row] + '</div>';
      for (var col = 0; col < hm.days.length; col++) {
        var val = hm.days[col].cells[row];
        var intensity = val / maxCell;
        var alpha = 0.06 + intensity * 0.9;
        var dayKey = hm.days[col].key;
        cells += '<div class="heatmap-cell" style="background:rgba(70,72,212,' + alpha.toFixed(2) + ')" title="' + (T('activity.heatmap.day.' + dayKey) || dayKey) + ' ' + hm.timeBlocks[row] + ': ' + val.toLocaleString() + ' ' + (T('activity.heatmap.events') || 'events') + '"></div>';
      }
    }

    var headers = '<div></div>' + hm.days.map(function(d) {
      return '<div class="heatmap-header">' + (T('activity.heatmap.day.' + d.key) || d.key) + '</div>';
    }).join('');

    var totals = '<div></div>' + hm.days.map(function(d) {
      return '<div class="heatmap-total">' + d.total.toLocaleString() + '</div>';
    }).join('');

    document.getElementById('heatmapContainer').innerHTML =
      '<div class="heatmap-grid">' + headers + cells + totals + '</div>';
  }

  // ═══════════════════════════════════════════
  // 5. Leaderboard（搜索过滤；零分已由后端排除）
  // ═══════════════════════════════════════════
  function renderLeaderboard(data) {
    var list = (data && data.leaderboard) || [];
    var q = state.search;
    var rows = list.filter(function(n) { return !q || (n.name || '').toLowerCase().indexOf(q) !== -1; });
    var el = document.getElementById('leaderboardList');
    if (!rows.length) { el.innerHTML = emptyHtml('activity.empty.section'); return; }
    var rankClass = { 1: 'gold', 2: 'silver', 3: 'bronze' };
    var maxScore = rows[0].score || 1;
    el.innerHTML = rows.map(function(n) {
      var barW = (n.score / maxScore * 100).toFixed(0);
      return '<div class="lb-row">' +
        '<div class="lb-rank' + (rankClass[n.rank] ? ' ' + rankClass[n.rank] : '') + '"' + (!rankClass[n.rank] ? ' style="background:rgba(118,117,134,0.12);color:var(--color-outline)"' : '') + '>' + n.rank + '</div>' +
        '<span class="lb-flag">' + (n.flag || '🏳️') + '</span>' +
        '<span class="lb-name">' + n.name + '</span>' +
        '<div class="lb-score-bar"><div class="lb-score-fill" style="width:' + barW + '%"></div></div>' +
        '<span class="lb-score-num">' + n.score.toLocaleString() + '</span>' +
      '</div>';
    }).join('');
  }

  // ═══════════════════════════════════════════
  // 6. Milestones（三类型映射；公民 title 匿名——后端 PII 禁令恒 null）
  // ═══════════════════════════════════════════
  var MS_META = {
    nation:  { icon: 'flag',       color: '#16a34a', descKey: 'nationFounded',    descEn: 'Nation founded' },
    article: { icon: 'article',    color: '#4648d4', descKey: 'articlePublished', descEn: 'Article published' },
    citizen: { icon: 'person_add', color: '#eab308', descKey: 'citizenJoined',    descEn: 'New citizen joined' }
  };

  function renderMilestones(data) {
    var list = (data && data.milestones) || [];
    var q = state.search;
    var rows = list.map(function(m) {
      var meta = MS_META[m.type] || MS_META.citizen;
      var title = m.type === 'citizen' ? (T('activity.ms.title.citizen') || 'A new citizen') : (m.title || '');
      var desc = T('activity.ms.desc.' + meta.descKey) || meta.descEn;
      return { m: m, meta: meta, title: title, desc: desc };
    }).filter(function(r) {
      return !q || r.title.toLowerCase().indexOf(q) !== -1 || r.desc.toLowerCase().indexOf(q) !== -1;
    });
    var el = document.getElementById('milestonesList');
    if (!rows.length) { el.innerHTML = emptyHtml('activity.empty.section'); return; }
    el.innerHTML = rows.map(function(r) {
      return '<div class="milestone">' +
        '<div class="milestone-dot" style="background:' + r.meta.color + '"></div>' +
        '<div class="milestone-content">' +
          '<div class="milestone-title">' + r.title + '</div>' +
          '<div style="font-size:11px;color:var(--color-on-surface-variant)">' + r.desc + '</div>' +
          '<div class="milestone-date">' + relTime(r.m.at) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ═══════════════════════════════════════════
  // 离线态：一张提示卡 + 五容器清空——绝不渲染假数据
  // ═══════════════════════════════════════════
  function renderOffline() {
    var title = T('activity.offline.title') || 'Data temporarily unavailable';
    var desc = T('activity.offline.desc') || 'Please check your connection and try again.';
    document.getElementById('kpiRow').innerHTML = '<div class="card act-offline"><b>' + title + '</b><div style="font-size:12px;color:var(--color-outline)">' + desc + '</div></div>';
    ['trendChart', 'categoryChart', 'heatmapContainer', 'leaderboardList', 'milestonesList'].forEach(function(id) {
      document.getElementById(id).innerHTML = '';
    });
  }

  function renderAll(data) {
    renderKPI(data);
    renderTrendChart(data);
    renderContentTypes(data);
    renderHeatmap(data);
    renderLeaderboard(data);
    renderMilestones(data);
    if (window.SlatiTilt) SlatiTilt.init(document.querySelectorAll('.tilt-container'));
  }

  function loadData(range) {
    if (state.cache[range]) { renderAll(state.cache[range]); return; }
    if (!window.MN_API || !window.MN_API.get) { renderOffline(); return; }
    window.MN_API.get('/public/activity?range=' + encodeURIComponent(range)).then(function(res) {
      if (state.range !== range) return; // 陈旧守卫：切走后再回的不渲染
      if (!res || !res.ok || !res.data) { state.failed = true; renderOffline(); return; }
      state.failed = false;
      state.cache[range] = res.data;
      renderAll(res.data);
    }).catch(function() {
      if (state.range === range) { state.failed = true; renderOffline(); }
    });
  }

  // ═══════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════

  // Time range pills（.active/滑块归 subnav.js——本页只负责拉数据）
  document.getElementById('timeRangePills').addEventListener('click', function(e) {
    var btn = e.target.closest('.subnav-pill');
    if (!btn || btn.dataset.range === state.range) return;
    state.range = btn.dataset.range;
    loadData(state.range);
  });

  // Trend metric toggle（只重渲染不重拉）
  document.getElementById('trendTabs').addEventListener('click', function(e) {
    var btn = e.target.closest('.subnav-pill');
    if (!btn || btn.dataset.metric === state.metric) return;
    state.metric = btn.dataset.metric;
    renderTrendChart(state.cache[state.range] || null);
  });

  // 搜索：排行榜名字 + 里程碑标题/描述实时过滤
  document.getElementById('activitySearch').addEventListener('input', function(e) {
    state.search = (e.target.value || '').toLowerCase();
    renderLeaderboard(state.cache[state.range] || null);
    renderMilestones(state.cache[state.range] || null);
  });

  // ═══════════════════════════════════════════
  // Initial Load（默认 30d=页面默认激活药丸）
  // ═══════════════════════════════════════════
  loadData('30d');

  // v0.2.58.16：语言切换重渲钩子（链式，照旧模式；缓存命中才重渲——保真实数据不回落假数据）
  var __mnPrevRerender = window.__mnI18nRerender || function () {};
  window.__mnI18nRerender = function () {
    __mnPrevRerender();
    if (state.cache[state.range]) renderAll(state.cache[state.range]);
  };

})();
