/* SlatiControl 通用 UI 助手（v2）：DOM 构造 / 转义 / 格式化 / 徽章 / toast / 分页 / 无权限卡。
   动态字符串一律经 {text:} 或 esc() 进入 DOM（v1 admin.js 拼 innerHTML 的教训：中文+引号易碎）。 */
(function (global) {
  'use strict';

  // v0.2.54.0 i18n：T(key) 取当前语言；回落原文（zh 值逐字节=现有文案，smoke-admin 中文断言安全）
  function T(k) { return (window.MN_I18N && window.MN_I18N.t(k)) || null; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // h('div', {class:'x', text:'hi', onclick:fn, dataset:{id:'1'}}, childEl, ...) → Element
  // attrs：class/text/html(仅静态可信串)/dataset/on* 事件；null/false 跳过
  function h(tag, attrs) {
    const el = document.createElement(tag);
    attrs = attrs || {};
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  // ISO → 本地 'YYYY-MM-DD HH:mm'；空/非法 → '—'
  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function fmtDate(iso) { return iso ? String(iso).slice(0, 10) : '—'; }
  // 微元 → 'RM 1,234.56'（D1 机器事件平面；finance.fx 为 RM）
  function fmtMicro(micro) {
    const n = Number(micro) || 0;
    return 'RM ' + (n / 1e6).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // 0-1 比例 → '42%'
  function fmtPct(x) {
    if (x == null || Number.isNaN(Number(x))) return '—';
    return Math.round(Number(x) * 10000) / 100 + '%';
  }

  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('admToast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2600);
  }

  // 三元组 [原文, 类名, i18n 键]：值按后端 mode 键查表（不译），标签在渲染处取 T()
  const RISK_LABEL = { high: ['高危', 'high', 'admin.risk.high'], medium: ['中危', 'warn', 'admin.risk.medium'], low: ['低危', 'ok', 'admin.risk.low'] };
  const STATUS_LABEL = { active: ['正常', 'ok', 'admin.status.active'], banned: ['已封禁', 'high', 'admin.status.banned'], delete_pending: ['待删除', 'warn', 'admin.status.deletePending'] };
  const TIER_LABEL = { free: ['免费', 'neutral', 'admin.tier.free'], basic: ['基础', 'ok', 'admin.tier.basic'], premium: ['高级', 'warn', 'admin.tier.premium'], ultra: ['旗舰', 'warn', 'admin.tier.ultra'] };
  function chip(kind, value) {
    if (value == null || value === '') return h('span', { class: 'adm-meta', text: '—' });
    const map = kind === 'risk' ? RISK_LABEL : kind === 'tier' ? TIER_LABEL : STATUS_LABEL;
    const [raw, cls, key] = map[value] || [value, 'neutral'];
    return h('span', { class: 'chip ' + cls, text: (key ? (T(key) || raw) : raw) });
  }

  // 分段胶囊（页面内 tabs / 域切换 / 时间范围共用）
  function seg(items, active, onPick) {
    return h('div', { class: 'seg' },
      ...items.map((it) => h('button', {
        class: 'seg-btn' + (it.key === active ? ' active' : ''),
        text: it.label,
        onclick: () => { if (it.key !== active) onPick(it.key); }
      })));
  }

  function pageHead(en, zh, meta) {
    return h('div', { class: 'page-head' },
      h('h2', { text: en }),
      h('div', { class: 'page-sub', text: zh }),
      meta ? h('div', { class: 'adm-meta', text: meta }) : null);
  }

  function empty(root, msg) {
    root.replaceChildren(h('div', { class: 'empty', text: msg || (T('admin.empty.noData') || '暂无数据') }));
  }

  // 非 2xx：403 → 无权限卡；其余 → 错误卡。msg 取后端中文 error.message
  function denied(root, status, data) {
    const msg = (data && data.error && data.error.message) || (status === 403 ? (T('admin.denied.forbidden') || '权限不足') : (T('admin.denied.failed') || '请求失败'));
    const title = status === 403 ? (T('admin.denied.noPerm') || '无权限') : status === 404 ? (T('admin.denied.notFound') || '不存在') : (T('admin.denied.failed') || '请求失败');
    root.replaceChildren(h('div', { class: 'adm-card' },
      h('h3', { text: '🔒 ' + title }),
      h('p', { class: 'adm-meta', style: 'margin-top:4px', text: msg }),
      h('p', { class: 'adm-meta', style: 'margin-top:6px', text: (T('admin.denied.hint') || '如需此访问权限，请联系项目总监在 Staff → Roles 中调整。') })));
  }

  // 分页：{total,page,pageSize} + onGo(page)
  function pager(root, info, onGo) {
    const pages = Math.max(1, Math.ceil(info.total / info.pageSize));
    root.replaceChildren(
      h('button', { class: 'btn', disabled: info.page <= 1, onclick: () => onGo(info.page - 1), text: (T('admin.pager.prev') || '上一页') }),
      h('span', { class: 'adm-meta', text: (T('admin.pager.prefix') || '第 ') + info.page + (T('admin.pager.mid') || ' / ') + pages + (T('admin.pager.tail') || ' 页 · 共 ') + info.total + (T('admin.pager.unit') || ' 条') }),
      h('button', { class: 'btn', disabled: info.page >= pages, onclick: () => onGo(info.page + 1), text: (T('admin.pager.next') || '下一页') })
    );
  }

  // 键值列表（值已格式化好的安全串；空值条目自动跳过）
  function kvList(entries) {
    return h('div', { class: 'kv-list' },
      ...entries.filter(([, v]) => v != null && v !== '').map(([k, v]) =>
        h('div', { class: 'kv' }, h('span', { class: 'k', text: k }), h('span', { class: 'v', text: v }))));
  }

  global.UI = { esc, h, pad2, fmtDateTime, fmtDate, fmtMicro, fmtPct, toast, chip, seg, pageHead, empty, denied, pager, kvList };
})(window);
