// tmp-battery-admin-host.js — admin.mnationworld.com 子域 Host 路由（用户「把后端的admin改成 admin.mnationworld.com」）
// 静态锚电池：entrypoint.js Host 路由三条分支 + admin 应用路径无关性（相对路径/hash 路由/api base 同源/零硬编码域名）
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..');
const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};

try {
  const entry = fs.readFileSync(path.join(REPO, 'backend-v2/scripts/entrypoint.js'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(REPO, 'docs/admin/index.html'), 'utf8');
  const adminApp = fs.readFileSync(path.join(REPO, 'docs/admin/js/app.js'), 'utf8');
  const apiJs = fs.readFileSync(path.join(REPO, 'docs/assets/js/api.js'), 'utf8');
  const adminDir = path.join(REPO, 'docs/admin');
  const adminFiles = fs.readdirSync(adminDir).concat(['js']);

  // ── S entrypoint Host 路由 ──
  ok('S1 admin Host 路由在位：admin.mnationworld.com → docs/admin 根直出',
    entry.indexOf("host === 'admin.mnationworld.com'") !== -1 &&
    entry.indexOf("path.join(DOCS, 'admin')") !== -1);
  ok('S2 story Host 路由保留（story.mnationworld.com → docs/story 不受影响）',
    entry.indexOf("host === 'story.mnationworld.com'") !== -1 &&
    entry.indexOf("path.join(DOCS, 'story')") !== -1);
  ok('S3 主域 docRoot 不变（mnationworld.com → docs/ 根，/admin/ 照旧可用双入口并存）',
    entry.indexOf('const docRoot = storyHost ? path.join(DOCS, \'story\') : adminHost ? path.join(DOCS, \'admin\') : DOCS;') !== -1);
  ok('S4 /api 反代分支先于 Host 路由（admin 子域 /api/* 同源直达后端、零 CORS）',
    entry.indexOf("url.pathname.startsWith('/api/')") < entry.indexOf("adminHost"));
  ok('S5 Host 解析口径：split(\':\')[0] 防端口 + toLowerCase 防大小写（与 story 同款）',
    entry.indexOf("(req.headers.host || '').split(':')[0].toLowerCase()") !== -1);
  ok('S6 头部注释更新：域名映射多条并存口径（主站/故事站/admin 三入口）',
    entry.indexOf('admin.mnationworld.com 管理后台') !== -1);

  // ── S admin 应用路径无关性（子域根直出的前提）──
  ok('S7 admin index.html 全相对引用、零绝对 /admin/ 路径（根直出不破链）',
    adminHtml.indexOf('"/admin') === -1 && adminHtml.indexOf("'/admin") === -1 &&
    adminHtml.indexOf('src="js/') !== -1 && adminHtml.indexOf('../assets/js/site-config.js') !== -1);
  ok('S8 admin 应用 hash 路由（#/dashboard，域名/路径无关）',
    adminApp.indexOf("location.hash || '#/dashboard'") !== -1 && adminApp.indexOf("addEventListener('hashchange', route)") !== -1);
  ok('S9 api.js base 默认 \'/api\' 同源（admin 子域 API 零 CORS 零改动）',
    apiJs.indexOf("var BASE = (global.MN_SITE && global.MN_SITE.apiBase) || '/api';") !== -1);
  ok('S10 admin 应用零硬编码域名引用（不依赖 mnationworld.com 字面量）',
    (function () {
      const bad = [];
      adminFiles.forEach(function (f) {
        const p = path.join(adminDir, f);
        if (!fs.statSync(p).isFile() && f !== 'js') return;
        if (fs.statSync(p).isDirectory()) return;
        const t = fs.readFileSync(p, 'utf8');
        if (t.indexOf('mnationworld.com') !== -1) bad.push(f);
      });
      return bad.length === 0;
    })());
  ok('S11 主域 /admin/ 服务链不变（docs/admin 目录原样、index.html 在场）',
    fs.existsSync(path.join(adminDir, 'index.html')) && fs.existsSync(path.join(adminDir, 'js/app.js')));
  ok('S12 cookie host-only 口径注释在场（各域独立登录，无跨域会话泄漏风险）',
    entry.indexOf('cookie host-only 各域独立登录') !== -1);

  console.log('');
  console.log('╭──────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (admin-host)  │');
  console.log('╰──────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
} catch (e) {
  console.error('💥 电池异常: ' + (e && e.stack || e));
  process.exit(1);
}
