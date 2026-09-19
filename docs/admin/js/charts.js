/* SlatiControl 图表（v2）：原生 Canvas 折线 / 环形 / 横向条形（v1 admin 折线移植 + 新增两型）。
   颜色取 CSS 变量（随主题），DPR 高清；数据全部来自后端读时聚合（D9），前端零计算。 */
(function (global) {
  'use strict';

  // v0.2.54.0 i18n：T(key) 取当前语言；回落原文
  function T(k) { return (window.MN_I18N && window.MN_I18N.t(k)) || null; }

  const PALETTE = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#a855f7'];

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function theme() {
    return {
      text: cssVar('--color-on-surface-variant', '#64748b'),
      grid: cssVar('--color-outline-variant', '#e2e8f0'),
      strong: cssVar('--color-on-surface', '#0f172a'),
      primary: cssVar('--color-primary', '#3b82f6')
    };
  }
  function setup(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = global.devicePixelRatio || 1;
    canvas.width = Math.max(50, Math.round(rect.width * dpr));
    canvas.height = Math.max(50, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [ctx, rect.width, rect.height];
  }

  // 折线图：series [{label, values:[...]}]，labels 与 values 等长；opts.yFmt 格式化 y 轴刻度
  function line(canvas, series, labels, opts = {}) {
    const [ctx, W, H] = setup(canvas);
    const t = theme();
    const pad = { l: 38, r: 12, top: 18, bottom: 22 };
    const iw = W - pad.l - pad.r, ih = H - pad.top - pad.bottom;
    if (iw <= 10 || ih <= 10) return;
    let max = 1;
    for (const s of series) for (const v of s.values) max = Math.max(max, Number(v) || 0);
    const n = Math.max(1, labels.length);
    const x = (i) => pad.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
    const y = (v) => pad.top + ih - (Number(v) / max) * ih;

    ctx.font = '10px Inter, sans-serif';
    // 网格 + y 刻度（4 等分）
    ctx.strokeStyle = t.grid; ctx.fillStyle = t.text; ctx.lineWidth = 1;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let g = 0; g <= 4; g++) {
      const gy = pad.top + (ih * g) / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
      ctx.fillText(opts.yFmt ? opts.yFmt(max * (1 - g / 4)) : String(Math.round(max * (1 - g / 4))), pad.l - 5, gy);
    }
    // x 标签（抽稀，显示 MM-DD）
    const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 46))));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 0; i < n; i += step) {
      ctx.fillText(String(labels[i]).slice(5) || labels[i], x(i), pad.top + ih + 5);
    }
    // 序列
    series.forEach((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      s.values.forEach((v, i) => { const px = x(i), py = y(v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
      ctx.fillStyle = color;
      s.values.forEach((v, i) => { ctx.beginPath(); ctx.arc(x(i), y(v), 2.5, 0, Math.PI * 2); ctx.fill(); });
    });
    // 图例（顶部一行）
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let lx = pad.l;
    for (let si = 0; si < series.length; si++) {
      const color = series[si].color || PALETTE[si % PALETTE.length];
      ctx.fillStyle = color; ctx.fillRect(lx, 3, 10, 10);
      ctx.fillStyle = t.text; ctx.fillText(series[si].label, lx + 14, 8);
      lx += 14 + ctx.measureText(series[si].label).width + 14;
    }
  }

  // 环形图：items [{label, n}]；中心 = 合计
  function donut(canvas, items, centerLabel = '') {
    const [ctx, W, H] = setup(canvas);
    const t = theme();
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) / 2 - 8;
    const total = items.reduce((s, it) => s + (Number(it.n) || 0), 0);
    if (total <= 0) {
      ctx.fillStyle = t.text; ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((T('admin.empty.noData') || '暂无数据'), cx, cy);
      return;
    }
    let a0 = -Math.PI / 2;
    items.forEach((it, i) => {
      const a1 = a0 + ((Number(it.n) || 0) / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.arc(cx, cy, r * 0.62, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = it.color || PALETTE[i % PALETTE.length];
      ctx.fill();
      a0 = a1;
    });
    ctx.fillStyle = t.strong; ctx.font = '700 15px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(centerLabel, cx, cy);
  }

  // 横向条形：items [{name, n}]（TOP10 类排行）
  function hbars(canvas, items) {
    const [ctx, W, H] = setup(canvas);
    const t = theme();
    if (!items.length) {
      ctx.fillStyle = t.text; ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((T('admin.empty.noData') || '暂无数据'), W / 2, H / 2);
      return;
    }
    const rowH = Math.max(16, Math.min(28, (H - 6) / items.length));
    const max = Math.max(1, ...items.map((it) => Number(it.n) || 0));
    ctx.font = '11px Inter, sans-serif';
    items.forEach((it, i) => {
      const y = 3 + i * rowH;
      const v = Number(it.n) || 0;
      ctx.fillStyle = t.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(String(it.name || '').slice(0, 20), 4, y + rowH / 2);
      const bw = Math.max(v > 0 ? 3 : 0, (v / max) * (W - 150));
      const bx = 110, by = y + rowH / 2 - 6;
      ctx.fillStyle = it.color || PALETTE[i % PALETTE.length];
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, 12, 6); else ctx.rect(bx, by, bw, 12);
      ctx.fill();
      ctx.fillStyle = t.strong;
      ctx.fillText(String(v), bx + bw + 6, y + rowH / 2);
    });
  }

  global.Charts = { line, donut, hbars, palette: PALETTE };
})(window);
