/**
 * MN_API — 后端 API 封装（baseURL 默认 '/api' 同源零 CORS）。
 * 前后端分离部署时由 site-config.js 提前设置 window.MN_SITE.apiBase = 'https://api.<域名>/api'，
 * 跨域请求带 credentials（cookie 登录态，后端 CORS 白名单 + Domain 放大配合）。
 * probe() 探测后端可达性（各页据此切换 api/demo 双模式，首次探测后缓存）；
 * request() 统一 JSON 往返：401 触发 mn:unauthorized 事件（storage.js 监听清会话）、
 * 429 暴露 retryAfter、网络失败永不 reject（返回 {ok:false,status:0,networkError:true}，
 * 调用方直接走本地降级分支）。
 */
(function (global) {
  'use strict';

  var BASE = (global.MN_SITE && global.MN_SITE.apiBase) || '/api';
  var PROBE_TIMEOUT_MS = 2500;
  var backendUp = null; // null=未知 true/false=探测结果

  function probe() {
    if (backendUp !== null) return Promise.resolve(backendUp);
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, PROBE_TIMEOUT_MS) : null;
    return fetch(BASE + '/health', { signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { backendUp = res.ok; return backendUp; })
      .catch(function () { backendUp = false; return false; })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  function request(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (opts.body != null && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    opts.credentials = opts.credentials || 'include'; // 跨域携带会话 cookie；同域时无副作用
    return fetch(BASE + path, opts).then(function (res) {
      if (res.status === 401) {
        global.dispatchEvent(new CustomEvent('mn:unauthorized'));
      }
      return res.json().catch(function () { return null; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data, retryAfter: res.headers.get('Retry-After') };
      });
    }).catch(function () {
      return { ok: false, status: 0, data: null, networkError: true };
    });
  }

  global.MN_API = {
    BASE: BASE,
    probe: probe,
    isBackend: function () { return backendUp === true; },
    request: request,
    get: function (p) { return request(p, { method: 'GET' }); },
    post: function (p, body) { return request(p, { method: 'POST', body: body }); },
    patch: function (p, body) { return request(p, { method: 'PATCH', body: body }); },
    del: function (p) { return request(p, { method: 'DELETE' }); }
  };
})(window);
