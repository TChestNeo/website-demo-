// tmp-probe-admin-nav.js — admin 左侧菜单条目名修复上线实机探针（用户「为什么后端左侧菜单Dashboard标题内的选项全部名称都是dashboard??」）
// 全 Node 内置模块：https——无 Chrome 无 curl 依赖。断言：子域已服务修复版 app.js（sg.kEn 锚、旧错写法零在场）、
//       admin.i18n.js 12 语言 nav 键值执行体验证（总览 5 组 en 键全在场、各语言 users.en 已本地化）、
//       主站 58.0 照旧、/admin/ 搬家 302 回归、子域 API 60 表回归、/assets/ 回退与隔离回归。
'use strict';
const https = require('https');
const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (url) => new Promise((resolve) => {
  const req = https.request(url, { headers: {}, timeout: 20000 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 400000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
});

(async () => {
  const ADMIN = 'https://admin.mnationworld.com';
  const MAIN = 'https://mnationworld.com';

  // S1 子域已服务修复版 app.js：条目名查键 sg.kEn、旧错写法零在场
  const r1 = await get(ADMIN + '/js/app.js');
  ok('S1 子域 app.js 修复版：sg.kEn 条目查键在场 + 旧 g.kEn 条目查键零在场',
    r1.status === 200 &&
    r1.body.indexOf("T(it.k || sg.kEn) || it.label") !== -1 &&
    r1.body.indexOf('T(it.k || g.kEn)') === -1,
    'status=' + r1.status + ' err=' + r1.error);

  // S2 admin.i18n.js 12 语言 nav 键值执行体验证（总览 5 组 en 键全在场、各语言各自值——词典位错哨兵）
  const r2 = await get(ADMIN + '/assets/i18n/admin.i18n.js');
  if (r2.status === 200) {
    try {
      const dicts = {};
      const MN = { add: (l, d) => { (dicts[l] = dicts[l] || {}); Object.assign(dicts[l], d); return MN; } };
      new Function('window', 'localStorage', r2.body)({ MN_I18N: MN }, { getItem: () => null, setItem: () => {} });
      const groups = ['dashboard', 'analytics', 'users', 'content', 'community'];
      const missing = [];
      Object.keys(dicts).forEach((lang) => {
        groups.forEach((k) => {
          if (dicts[lang]['admin.nav.' + k + '.en'] === undefined) missing.push(lang + '.' + k);
        });
      });
      const notLocalized = ['de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt']
        .filter((l) => dicts[l] && dicts[l]['admin.nav.users.en'] === 'Users');
      ok('S2 子域 admin.i18n.js：12 语言 × 总览 5 组 en 键全在场 + 非英/繁语言已本地化',
        Object.keys(dicts).length === 12 && missing.length === 0 && notLocalized.length === 0,
        'langs=' + Object.keys(dicts).length + ' missing=' + missing.join(';') + ' notLocalized=' + notLocalized.join(','));
    } catch (e) {
      ok('S2 子域 admin.i18n.js：12 语言 × 总览 5 组 en 键全在场 + 非英/繁语言已本地化', false, 'eval 异常: ' + e.message);
    }
  } else {
    ok('S2 子域 admin.i18n.js：12 语言 × 总览 5 组 en 键全在场 + 非英/繁语言已本地化', false, 'status=' + r2.status);
  }

  // S3 主域 /admin/ 搬家 302 回归
  const r3 = await get(MAIN + '/admin/');
  ok('S3 主域 /admin/ → 302 跳子域（搬家回归）', r3.status === 302, 'status=' + r3.status);
  // 302 响应体恒空，Location 用单独头探（无 redirect 跟随的 https.request 默认不跟）
  const r3h = await new Promise((resolve) => {
    const req = https.request(MAIN + '/admin/', { timeout: 20000 }, (res) => {
      res.resume(); res.on('end', () => resolve(String(res.headers.location || '')));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.end();
  });
  ok('S3b 302 Location 精确 = 子域根', r3h === 'https://admin.mnationworld.com/', 'loc=' + r3h);

  // S4 主站照旧
  const r4 = await get(MAIN + '/');
  ok('S4 主站照旧 200 + v0.2.58.16 在场', r4.status === 200 && r4.body.indexOf('v0.2.58.16') !== -1, 'status=' + r4.status);

  // S5 子域 /api/health 同源回归
  const r5 = await get(ADMIN + '/api/health');
  ok('S5 子域 /api/health 200 + 60 表 v2.0.0', r5.status === 200 &&
    r5.body.indexOf('"tables":60') !== -1 && r5.body.indexOf('"version":"2.0.0"') !== -1,
    'status=' + r5.status);

  // S6 ../assets 回退回归（admin 登录链路 api.js 必须通）
  const r6 = await get(ADMIN + '/assets/js/api.js');
  ok('S6 子域 /assets/js/api.js 200（../assets 回退——登录链路回归）',
    r6.status === 200 && r6.body.indexOf("|| '/api';") !== -1,
    'status=' + r6.status);

  // S7 回退不泄漏主站页面（隔离保持回归）
  const r7 = await get(ADMIN + '/pages/explore.html');
  ok('S7 子域隔离保持：/pages/explore.html 仍 404', r7.status === 404, 'status=' + r7.status);

  console.log('');
  console.log('╭─────────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (admin-nav-live)   │');
  console.log('╰─────────────────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
})().catch((e) => { console.error('💥 探针异常: ' + (e && e.stack || e)); process.exit(1); });
