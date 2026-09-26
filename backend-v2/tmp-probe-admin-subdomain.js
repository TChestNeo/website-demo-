// tmp-probe-admin-subdomain.js — admin.mnationworld.com 子域上线实机探针（用户「把后端的admin改成 admin.mnationworld.com」）
// 全 Node 内置模块：https/http/tls——无 Chrome 无 curl 依赖。域名映射+DNS CNAME 已建、证书签发后运行。
// 断言：子域根直出 admin 登录页、子域 /api 同源 200、子域隔离（主站页面 404）、主域 /admin/ 双入口照旧、
//       主站 58.0 照旧、story 子域回归、TLS 证书 SAN 含 admin.mnationworld.com、http→https 重定向。
'use strict';
const https = require('https');
const http = require('http');
const tls = require('tls');
const PASS = { n: 0 }, FAIL = { n: 0 }, errors = [];
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (mod, url, headers) => new Promise((resolve) => {
  const req = mod.get(url, Object.assign({ headers: headers || {}, timeout: 20000 }, (mod === https ? {} : {})), (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 300000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
});

(async () => {
  const ADMIN = 'https://admin.mnationworld.com';
  const MAIN = 'https://mnationworld.com';
  const STORY = 'https://story.mnationworld.com';

  // S1 子域根直出 admin 登录页
  const r1 = await get(https, ADMIN + '/');
  ok('S1 子域根 200 + admin 应用在场（js/ui.js + admin.i18n.js + site-config.js 相对引用）',
    r1.status === 200 && r1.body.indexOf('js/ui.js') !== -1 &&
    r1.body.indexOf('admin.i18n.js') !== -1 && r1.body.indexOf('site-config.js') !== -1,
    'status=' + r1.status + ' err=' + r1.error);

  // S2 子域 /api/health 同源直达（反代先于 Host 路由）
  const r2 = await get(https, ADMIN + '/api/health');
  ok('S2 子域 /api/health 200 + 60 表 v2.0.0', r2.status === 200 &&
    r2.body.indexOf('"tables":60') !== -1 && r2.body.indexOf('"version":"2.0.0"') !== -1,
    'status=' + r2.status + ' body=' + String(r2.body || r2.error || '').slice(0, 120));

  // S3 子域隔离：主站专属页面 404
  const r3 = await get(https, ADMIN + '/pages/explore.html');
  ok('S3 子域隔离：主站页面 /pages/explore.html → 404', r3.status === 404, 'status=' + r3.status);

  // S4 子域隔离：admin 应用 js 可加载
  const r4 = await get(https, ADMIN + '/js/app.js');
  ok('S4 子域 admin app.js 200 可加载', r4.status === 200 && r4.body.indexOf('location.hash') !== -1, 'status=' + r4.status);

  // S5 主域 /admin/ 搬家：302 跳子域根（双入口退役——用户「把旧的全部搬到新的内」）
  const r5 = await get(https, MAIN + '/admin/');
  ok('S5 主域 /admin/ → 302 跳 https://admin.mnationworld.com/（搬家，旧书签自动指路）',
    r5.status === 302 && String(r5.headers.location || '') === 'https://admin.mnationworld.com/',
    'status=' + r5.status + ' loc=' + r5.headers.location);

  // S5b /admin 无斜杠同跳根
  const r5b = await get(https, MAIN + '/admin');
  ok('S5b 主域 /admin（无斜杠）→ 302 跳子域根', r5b.status === 302 &&
    String(r5b.headers.location || '') === 'https://admin.mnationworld.com/',
    'status=' + r5b.status + ' loc=' + r5b.headers.location);

  // S5c 路径映射：/admin/js/app.js → /js/app.js
  const r5c = await get(https, MAIN + '/admin/js/app.js');
  ok('S5c 路径映射：/admin/js/app.js → 302 跳子域 /js/app.js（去 /admin 前缀）', r5c.status === 302 &&
    String(r5c.headers.location || '') === 'https://admin.mnationworld.com/js/app.js',
    'status=' + r5c.status + ' loc=' + r5c.headers.location);

  // S5d query 原样带上
  const r5d = await get(https, MAIN + '/admin/?from=main');
  ok('S5d query 保留：/admin/?from=main → Location 带 ?from=main', r5d.status === 302 &&
    String(r5d.headers.location || '') === 'https://admin.mnationworld.com/?from=main',
    'status=' + r5d.status + ' loc=' + r5d.headers.location);

  // S6 主站照旧
  const r6 = await get(https, MAIN + '/');
  ok('S6 主站照旧 200 + v0.2.58.2 在场', r6.status === 200 && r6.body.indexOf('v0.2.58.2') !== -1, 'status=' + r6.status);

  // S7 story 子域回归
  const r7 = await get(https, STORY + '/');
  ok('S7 story.mnationworld.com 回归 200（故事站标题在场）',
    r7.status === 200 && (r7.body.indexOf('M.NationWorld') !== -1), 'status=' + r7.status + ' err=' + r7.error);

  // S8 TLS 证书 SAN 覆盖 admin.mnationworld.com
  const cert = await new Promise((resolve) => {
    const s = tls.connect({ host: 'admin.mnationworld.com', port: 443, servername: 'admin.mnationworld.com', timeout: 15000 },
      () => { const c = s.getPeerCertificate(); s.end(); resolve(c); });
    s.on('error', (e) => { resolve(null); errors.push('TLS: ' + e.message); });
    s.on('timeout', () => { s.destroy(); resolve(null); });
  });
  ok('S8 TLS 证书签发成功且 SAN 含 admin.mnationworld.com',
    !!cert && !!cert.subjectaltname && cert.subjectaltname.indexOf('admin.mnationworld.com') !== -1 &&
    (cert.valid_to ? new Date(cert.valid_to) > new Date() : true),
    cert ? 'SAN=' + cert.subjectaltname : 'no cert');

  // S9 http → https 重定向（Google 前端用 302）
  const r9 = await get(http, 'http://admin.mnationworld.com/');
  ok('S9 http://admin.mnationworld.com → 302 跳 https', (r9.status === 301 || r9.status === 302 || r9.status === 307 || r9.status === 308) &&
    String(r9.headers.location || '').indexOf('https://admin.mnationworld.com') !== -1,
    'status=' + r9.status + ' loc=' + r9.headers.location);

  console.log('');
  console.log('╭──────────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (admin-subdomain)  │');
  console.log('╰──────────────────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
})().catch((e) => { console.error('💥 探针异常: ' + (e && e.stack || e)); process.exit(1); });
