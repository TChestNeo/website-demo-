/* SlatiControl 后端封装（v2）：基于共享 MN_API（同源 cookie / 401 事件 / 网络失败永不 reject）。
   staff 端点全部 /api/staff/*（D3）；会话状态：SC.staff/roles/perms（GET /staff/auth/me 形状）。
   can(perm)：project_director 后端返回 ['*'] → 一律放行。 */
(function (global) {
  'use strict';

  const SC = {
    pages: {},          // 页面模块注册表（pages-*.js 自注册，app.js 按 #hash 调用 render）
    staff: null,        // publicStaff 形状（displayName/alias/position/timezone/...；无 email/real_name）
    roles: [],          // 角色 id 列表（project_director 等）
    perms: [],          // 权限键列表；director = ['*']
    can(perm) { return this.perms.includes('*') || this.perms.includes(perm); },

    // 查询串构造（空值跳过）
    qs(obj) {
      return Object.entries(obj)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    },

    // staff 认证（v2 契约：email-code 防枚举恒 ok；verify 落 sc_session cookie）
    // W6：verify 带 password（有密码 staff = 密码+码）；setPassword/resetPassword = 首登设密 / 忘记密码
    me: () => MN_API.get('/staff/auth/me'),
    sendCode: (email) => MN_API.post('/staff/auth/email-code', { email }),
    verify: (email, code, password) => MN_API.post('/staff/auth/verify', { email, code, password }),
    setPassword: (newPassword) => MN_API.post('/staff/auth/password', { newPassword }),
    resetPassword: (email, code, newPassword) => MN_API.post('/staff/auth/password-reset', { email, code, newPassword }),
    logout: () => MN_API.post('/staff/auth/logout', {}),

    get: (p) => MN_API.get(p),
    post: (p, body) => MN_API.post(p, body)
  };

  global.SC = SC;
})(window);
