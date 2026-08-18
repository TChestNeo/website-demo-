/**
 * 官方人员身份验证组件 (Staff Verification)
 *
 * 用于 badge.html 与 help.html「验证官方人员身份」区块：
 * 官方人员在特殊情况下私信用户时，出示一枚 12 小时内有效的官方验证码；
 * 用户输入验证码后，页面显示验证码的创建时间、该工作人员的化名（官方人员
 * 不使用真实姓名）、职位与负责事项，用于核实对方身份。
 *
 * 双模式设计：
 *   mode: 'offline'（当前）— 演示模式：示例验证码 A7K2Q9 通过，其余一律无效。
 *   mode: 'api'    （后端上线后）— POST {apiBase}/badge/verify
 *
 * 切换方式：在页面的 window.MN_BADGE_CONFIG 中设置
 *   { mode: 'api', apiBase: 'https://api.example.com' }
 * 无需改动本模块。
 *
 * ── 后端 API 约定（后端请按此实现）──
 * POST {apiBase}/badge/verify
 *   请求头: Content-Type: application/json
 *   请求体: { "code": "A7K2Q9" }   // string, 用户输入的验证码
 *   成功响应 (HTTP 200):
 *     {
 *       "status":    "valid",                     // string, "valid"
 *       "alias":     "云雀",                       // string, 工作人员化名/网民名（不出现真实姓名）
 *       "role":      "客服专员",                   // string, 职位
 *       "duties":    "账号安全核查与订单异常处理",   // string, 负责事项
 *       "issuedAt":  "2026-08-13T06:30:00Z",      // string, ISO 8601 验证码创建时间
 *       "expiresAt": "2026-08-14T06:30:00Z"       // string, ISO 8601 失效时间（12 小时）
 *     }
 *   无效/过期: HTTP 404（或 200 + status:"invalid"）→ 前端显示“无效的验证码”。
 *
 * 后端签发要求：验证码有效期为 12 小时，过期与无效一律返回无效；
 * 每枚验证码与当次私信事由绑定记录，验证码数据过期后不再保留可反查内容。
 */
(function (global) {
  'use strict';

  var DEFAULT_CONFIG = { mode: 'offline', apiBase: '' };
  var DEMO_CODE = 'A7K2Q9';   // 演示验证码（离线模式）
  var TICK_MS = 1000;         // 倒计时刷新间隔
  var timer = null;

  function getConfig() {
    var c = global.MN_BADGE_CONFIG || {};
    return {
      mode: c.mode || DEFAULT_CONFIG.mode,
      apiBase: (c.apiBase || '').replace(/\/+$/, '')
    };
  }

  function isOnline() {
    var cfg = getConfig();
    return cfg.mode === 'api' && !!cfg.apiBase;
  }

  // 取当前语言文案；MN_I18N 未加载或键缺失时使用中文回退文本
  function T(key, fallback) {
    if (global.MN_I18N) {
      var v = global.MN_I18N.t(key);
      if (v != null) return v;
    }
    return fallback;
  }

  function getEl(id) { return document.getElementById(id); }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmtTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // 剩余有效期：1 小时以上显示 H:MM:SS，否则 MM:SS
  function fmtRemain(ms) {
    if (ms <= 0) return '00:00';
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (h > 0) return h + ':' + pad2(m) + ':' + pad2(sec);
    return pad2(m) + ':' + pad2(sec);
  }

  function showResult() {
    stopTimer();
    getEl('badgeResult').style.display = 'block';
    getEl('badgeError').style.display = 'none';
  }

  function showInvalid(text) {
    stopTimer();
    getEl('badgeResult').style.display = 'none';
    var err = getEl('badgeError');
    err.style.display = 'block';
    getEl('errText').textContent = text;
  }

  function setStatus(valid) {
    var el = getEl('badgeStatus');
    el.textContent = valid
      ? T('verify.status.valid', '验证通过，确认为官方人员')
      : T('verify.status.expired', '验证码已过期');
    el.className = 'badge-status ' + (valid ? 'ok' : 'bad');
  }

  function render(data, demo) {
    getEl('bAlias').textContent = data.alias;
    getEl('bRole').textContent = data.role;
    getEl('bDuties').textContent = data.duties;
    getEl('bIssued').textContent = fmtTime(new Date(data.issuedAt).getTime());
    getEl('bExpires').textContent = fmtTime(new Date(data.expiresAt).getTime());
    getEl('badgeDemo').style.display = demo ? '' : 'none';
    setStatus(true);
    showResult();

    var expiresMs = new Date(data.expiresAt).getTime();
    function tick() {
      var remain = expiresMs - Date.now();
      if (remain <= 0) {
        showInvalid(T('verify.status.expired', '验证码已过期') + '。' + T('verify.invalidGuide', ''));
        return;
      }
      getEl('bCount').textContent = fmtRemain(remain);
    }
    tick();
    timer = setInterval(tick, TICK_MS);
  }

  function demoData() {
    // 演示数据：验证码 5 分钟前创建、11 小时 55 分钟后失效（与“12 小时有效”一致）
    var now = Date.now();
    return {
      alias: '云雀',
      role: '客服专员',
      duties: '账号安全核查与订单异常处理',
      issuedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      expiresAt: new Date(now + (12 * 60 - 5) * 60 * 1000).toISOString()
    };
  }

  function verify(code) {
    var c = (code || '').trim().toUpperCase();
    if (!c) {
      showInvalid(T('verify.err.empty', '请输入验证码'));
      return;
    }

    if (!isOnline()) {
      // 离线演示模式：仅示例验证码通过
      if (c === DEMO_CODE) render(demoData(), true);
      else showInvalid(T('verify.invalid', '无效的验证码') + '。' + T('verify.invalidGuide', ''));
      return;
    }

    var cfg = getConfig();
    fetch(cfg.apiBase + '/badge/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: c })
    }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json().then(function (data) {
        if (!data || data.status !== 'valid' || !data.alias) throw new Error('invalid');
        return data;
      });
    }).then(function (data) {
      render(data, false);
    }).catch(function () {
      showInvalid(T('verify.invalid', '无效的验证码') + '。' + T('verify.invalidGuide', ''));
    });
  }

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  // 自动初始化：页面存在验证输入框时绑定事件
  function init() {
    var btn = getEl('badgeVerifyBtn');
    var input = getEl('badgeCode');
    if (!btn || !input) return;
    btn.addEventListener('click', function () { verify(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); verify(input.value); }
    });
  }

  global.MN_Badge = { init: init, verify: verify };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
