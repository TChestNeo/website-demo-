// tmp-probe-admin-grant.js — admin 面板订阅发放上线实机探针（用户「为什么我无法手动更改用户的订阅等级？」→ 面板加发放功能）
// 全 Node 内置模块：https/http——无 Chrome 无 curl 依赖。断言：子域已服务新版 pages-users.js（发放区块锚）、
//       admin.i18n.js 12 语言发放键、未登录 POST /staff/subscriptions/grant 被 401 拦截（发放只对 staff 会话）、
//       主站 58.0 照旧、/admin/ 搬家 302 回归、子域 API 60 表回归。
'use strict';
const https = require('https');
const http = require('http');
const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (mod, url, opts) => new Promise((resolve) => {
  opts = opts || {};
  const req = mod.request(url, Object.assign({ method: opts.method || 'GET', headers: Object.assign({}, opts.headers), timeout: 20000 }), (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 300000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });
  if (opts.body) req.write(opts.body);
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
});

(async () => {
  const ADMIN = 'https://admin.mnationworld.com';
  const MAIN = 'https://mnationworld.com';

  // S1 子域已服务新版 pages-users.js：发放区块锚在场
  const r1 = await get(https, ADMIN + '/js/pages-users.js');
  ok('S1 子域 pages-users.js 新版：发放区块在场（grantTitle 键 + grant 端点 + 权限门）',
    r1.status === 200 &&
    r1.body.indexOf("SC.post('/staff/subscriptions/grant'") !== -1 &&
    r1.body.indexOf("T('admin.users.grantTitle')") !== -1 &&
    r1.body.indexOf("SC.can('subscriptions.manage')") !== -1,
    'status=' + r1.status + ' err=' + r1.error);

  // S2 admin.i18n.js 新版：发放键 ×12 语言（zh 原文 + zh-Hant OpenCC 版）
  const r2 = await get(https, ADMIN + '/assets/i18n/admin.i18n.js');
  const zhCount = (r2.body.match(/'admin\.users\.grantTitle'/g) || []).length;
  const hantOk = r2.body.indexOf('"admin.users.grantTitle": "訂閱發放"') !== -1;
  ok('S2 子域 admin.i18n.js 新版：zh 发放键 ×11 非繁体块 + zh-Hant「訂閱發放」在位',
    r2.status === 200 && zhCount === 11 && hantOk,
    'status=' + r2.status + ' zhCount=' + zhCount + ' hant=' + hantOk);

  // S3 未登录 POST /api/staff/subscriptions/grant → 401（发放只对 staff 会话，无匿名通道）
  const r3 = await get(https, ADMIN + '/api/staff/subscriptions/grant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.com', tierKey: 'ultra', months: 1 })
  });
  ok('S3 匿名 POST grant → 401 拦截（无匿名发放通道）',
    r3.status === 401, 'status=' + r3.status + ' body=' + String(r3.body || r3.error || '').slice(0, 120));

  // S4 主站照旧
  const r4 = await get(https, MAIN + '/');
  ok('S4 主站照旧 200 + v0.2.58.4 在场', r4.status === 200 && r4.body.indexOf('v0.2.58.4') !== -1, 'status=' + r4.status);

  // S5 主域 /admin/ 搬家 302 回归（上轮功能不回归）
  const r5 = await get(https, MAIN + '/admin/');
  ok('S5 主域 /admin/ → 302 跳子域（搬家回归）', r5.status === 302 &&
    String(r5.headers.location || '') === 'https://admin.mnationworld.com/',
    'status=' + r5.status + ' loc=' + r5.headers.location);

  // S6 子域 /api/health 同源回归
  const r6 = await get(https, ADMIN + '/api/health');
  ok('S6 子域 /api/health 200 + 60 表 v2.0.0', r6.status === 200 &&
    r6.body.indexOf('"tables":60') !== -1 && r6.body.indexOf('"version":"2.0.0"') !== -1,
    'status=' + r6.status + ' body=' + String(r6.body || r6.error || '').slice(0, 120));

  // S7 admin 应用 ../assets/* 共享资源回退可加载（子域根解析为 /assets/*，回主 DOCS 取——登录链路 api.js 必须通）
  const r7 = await get(https, ADMIN + '/assets/js/api.js');
  ok('S7 子域 /assets/js/api.js 200（../assets 回退——admin 登录链路通）',
    r7.status === 200 && r7.body.indexOf("var BASE = (global.MN_SITE && global.MN_SITE.apiBase) || '/api';") !== -1,
    'status=' + r7.status + ' err=' + r7.error);

  // S8 回退不泄漏主站页面（/assets/ 之外仍走 docs/admin——子域隔离保持）
  const r8 = await get(https, ADMIN + '/pages/explore.html');
  ok('S8 子域隔离保持：/pages/explore.html 仍 404（/assets/ 回退不泄漏主站页面）',
    r8.status === 404, 'status=' + r8.status);

  console.log('');
  console.log('╭──────────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (admin-grant-live)   │');
  console.log('╰──────────────────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
})().catch((e) => { console.error('💥 探针异常: ' + (e && e.stack || e)); process.exit(1); });
