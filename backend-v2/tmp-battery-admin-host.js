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
  ok('S3 主域 docRoot 不变（mnationworld.com → docs/ 根；/admin/* 已搬家为 302 跳子域，见 S13-S16）',
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

  // ── S admin 搬家重定向（用户「把旧的全部搬到新的内」）──
  ok('S13 重定向分支在位：/admin 与 /admin/* 命中（非 adminHost）',
    entry.indexOf("!adminHost && (url.pathname === '/admin' || url.pathname.startsWith('/admin/'))") !== -1);
  ok('S14 adminHost 自身豁免防自跳死循环（!adminHost 门控）',
    entry.indexOf("if (!adminHost && (url.pathname === '/admin'") !== -1);
  ok('S15 路径映射：/admin → / 根、/admin/xxx → /xxx 去前缀 + query 原样带上',
    entry.indexOf("url.pathname === '/admin' ? '/' : url.pathname.slice('/admin'.length)") !== -1 &&
    entry.indexOf("'https://admin.mnationworld.com' + target + (url.search || '')") !== -1);
  ok('S16 302 非 301（浏览器不缓存，回退路径不被锁死）',
    entry.indexOf("res.writeHead(302, { Location: 'https://admin.mnationworld.com'") !== -1);
  ok('S17 重定向分支先于路径解析（/admin 旧文件不会被直接出，全部转跳）',
    entry.indexOf('const target = url.pathname') < entry.indexOf('let p;'));
  ok('S18 头部注释口径更新：管理后台唯一入口 = 子域、双入口退役',
    entry.indexOf('管理后台唯一入口 = 子域') !== -1);

  // ── S admin 子域 /assets/ 回退（探针 S2 404 实证：../assets/* 在子域根解析为 /assets/*，docRoot docs/admin 下无 assets）──
  ok('S19 /assets/ 回退分支在位（adminHost 且 /assets/ 前缀 → 主 DOCS 取共享资源）',
    entry.indexOf("adminHost && p.startsWith('/assets/') ? DOCS : docRoot") !== -1);
  ok('S20 回退仅 /assets/ 前缀（serveRoot 其余路径仍 docRoot——/pages 隔离保持、403 守卫口径同款）',
    entry.indexOf('const serveRoot = adminHost') !== -1 &&
    entry.indexOf("path.join(serveRoot, p)") !== -1 &&
    entry.indexOf("!file.startsWith(serveRoot + path.sep)") !== -1 &&
    entry.indexOf('子域隔离保持') !== -1);

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
