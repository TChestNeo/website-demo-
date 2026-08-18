/**
 * MN_Report — 举报组件（P7，community-rules 第 5 节承诺落地）。
 * MN_Report.mount(triggerEl, { targetType, targetId }) 绑定触发元素（重复 mount 幂等）：
 * 点击 → 弹层（理由单选 + 描述 ≤2000 字）→ POST /api/reports → toast 回执。
 * 弹层页面级单例；主题走 ethereal CSS 变量（深浅色自适应）。
 * 复用全局 window.showToast（存在时），否则自绘简易 toast（MN_Report.toast 亦对外可用）。
 */
(function (global) {
  'use strict';

  var REASONS = [
    { value: 'spam', label: 'Spam / 广告刷屏' },
    { value: 'abuse', label: 'Abuse / 辱骂攻击' },
    { value: 'hate', label: 'Hate speech / 仇恨言论' },
    { value: 'sexual', label: 'Sexual content / 色情内容' },
    { value: 'scam', label: 'Scam / 诈骗' },
    { value: 'impersonation', label: 'Impersonation / 冒充他人' },
    { value: 'other', label: 'Other / 其他' }
  ];

  var overlayEl = null;
  var toastEl = null;

  function toast(msg, isError) {
    if (typeof global.showToast === 'function') { global.showToast(msg); return; }
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.textContent = msg;
    toastEl.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10001;'
      + 'background:var(--color-surface,#fff);color:var(--color-on-surface,#111);border:1px solid var(--color-outline,#ddd);'
      + 'border-radius:12px;padding:10px 18px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.18);'
      + (isError ? 'border-left:4px solid var(--color-error,#d33);' : '');
    document.body.appendChild(toastEl);
    setTimeout(function () { if (toastEl) { toastEl.remove(); toastEl = null; } }, 3500);
  }

  function closeModal() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    document.removeEventListener('keydown', onEsc);
  }

  function onEsc(e) { if (e.key === 'Escape') closeModal(); }

  function openModal(target) {
    if (overlayEl) closeModal();
    overlayEl = document.createElement('div');
    overlayEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;'
      + 'display:flex;align-items:center;justify-content:center;padding:16px';
    overlayEl.innerHTML =
      '<div style="background:var(--color-surface,#fff);color:var(--color-on-surface,#111);border-radius:16px;'
      + 'padding:20px;width:min(420px,100%);box-shadow:0 16px 48px rgba(0,0,0,.3)">' +
        '<h3 style="margin:0 0 4px;font-size:16px;font-weight:700">Report content</h3>' +
        '<p style="margin:0 0 12px;font-size:12px;color:var(--color-on-surface-variant,#555)">举报会立即生成高优先级审核项。恶意举报可能导致账号受限。</p>' +
        '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Reason</label>' +
        '<select id="mnReportReason" style="width:100%;padding:8px;border-radius:10px;border:1px solid var(--color-outline,#ddd);' +
        'background:transparent;color:inherit;margin-bottom:12px">' +
          REASONS.map(function (r) { return '<option value="' + r.value + '">' + r.label + '</option>'; }).join('') +
        '</select>' +
        '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Details (optional)</label>' +
        '<textarea id="mnReportDesc" rows="3" maxlength="2000" placeholder="补充说明…" style="width:100%;padding:8px;' +
        'border-radius:10px;border:1px solid var(--color-outline,#ddd);background:transparent;color:inherit;' +
        'font:inherit;resize:vertical;margin-bottom:14px"></textarea>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px">' +
          '<button class="btn btn-ghost btn-sm" id="mnReportCancel">Cancel</button>' +
          '<button class="btn btn-primary btn-sm" id="mnReportSubmit">Submit report</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlayEl);
    document.addEventListener('keydown', onEsc);
    overlayEl.addEventListener('click', function (e) { if (e.target === overlayEl) closeModal(); });
    overlayEl.querySelector('#mnReportCancel').addEventListener('click', closeModal);
    overlayEl.querySelector('#mnReportSubmit').addEventListener('click', function () {
      var btn = overlayEl.querySelector('#mnReportSubmit');
      var reason = overlayEl.querySelector('#mnReportReason').value;
      var description = overlayEl.querySelector('#mnReportDesc').value.trim();
      btn.disabled = true;
      MN_API.post('/reports', { targetType: target.targetType, targetId: target.targetId, reason: reason, description: description })
        .then(function (r) {
          btn.disabled = false;
          if (r.ok) { toast('举报已提交，感谢你的反馈'); closeModal(); return; }
          if (r.status === 401) toast('请先登录后再举报', true);
          else if (r.status === 429) toast('举报过于频繁，请稍后再试', true);
          else toast((r.data && r.data.error && r.data.error.message) || '举报失败，请稍后再试', true);
        });
    });
  }

  function mount(triggerEl, target) {
    if (!triggerEl || triggerEl.__mnReport) return;
    triggerEl.__mnReport = true;
    triggerEl.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openModal(target);
    });
  }

  global.MN_Report = { mount: mount, toast: toast, REASONS: REASONS };
})(window);
