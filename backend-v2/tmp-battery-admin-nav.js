// tmp-battery-admin-nav.js — admin 左侧菜单条目名修复（用户「为什么后端左侧菜单Dashboard标题内的选项全部名称都是dashboard??」）
// 真身：renderNav 合并分组（v0.2.49.7 钦定：Analytics/Users/Content/Community 并入「Dashboard 总览」）在 v0.2.54.0
//      i18n 轮把条目名查键写成 T(it.k || g.kEn)——g 是节标题组（恒 Dashboard），合并进总览的 5 条目全部落
//      admin.nav.dashboard.en → 全显示「Dashboard」；图标用 sg.icon 无碍故只有名字错。修复：g.kEn → sg.kEn。
// 静态锚电池：app.js 修复锚 + NAV 数据五组键各自独立 + showTodo/标题行口径不误伤 + 12 语言词典 nav 键值执行体验证。
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
  const app = fs.readFileSync(path.join(REPO, 'docs/admin/js/app.js'), 'utf8');
  const smoke = fs.readFileSync(path.join(REPO, 'backend-v2/scripts/smoke-admin.js'), 'utf8');

  // ── S app.js 修复锚 ──
  ok('S1 条目名查键用 sg.kEn（子组自身键；修复在位）',
    app.indexOf("h('span', { text: (T(it.k || sg.kEn) || it.label) })") !== -1);
  ok('S2 旧错误写法零在场（g.kEn 不再出现在条目名查键）',
    app.indexOf('T(it.k || g.kEn)') === -1);
  ok('S3 NAV 五合并组 kEn 键各自独立（dashboard/analytics/users/content/community 不共用一键）',
    ["'admin.nav.dashboard.en'", "'admin.nav.analytics.en'", "'admin.nav.users.en'", "'admin.nav.content.en'", "'admin.nav.community.en'"]
      .every((k) => app.indexOf(k) !== -1));
  ok('S4 节标题行仍用节 g.kEn（「Dashboard 总览」标题口径不动）',
    app.indexOf("h('span', { text: (T(g.kEn) || g.en) })") !== -1);
  ok('S5 showTodo 用 td.g.kEn（条目录属组自身键——建设页标题口径不受影响）',
    app.indexOf('T(td.it.k || td.g.kEn)') !== -1);

  // ── S 12 语言词典执行体验证（总览 5 条目在各语言下键值在场、users.en 非 dashboard.en 串值）──
  {
    const src = fs.readFileSync(path.join(REPO, 'docs/assets/i18n/admin.i18n.js'), 'utf8');
    const dicts = {};
    const MN = { add: (l, d) => { (dicts[l] = dicts[l] || {}); Object.assign(dicts[l], d); return MN; } };
    new Function('window', 'localStorage', src)({ MN_I18N: MN }, { getItem: () => null, setItem: () => {} });
    const langs = Object.keys(dicts);
    const groups = ['dashboard', 'analytics', 'users', 'content', 'community'];
    const bad = [];
    langs.forEach((lang) => {
      const d = dicts[lang];
      groups.forEach((k) => {
        if (d['admin.nav.' + k + '.en'] === undefined) bad.push(lang + ':缺 admin.nav.' + k + '.en');
      });
    });
    // 非 en/zh-Hant 语言的 users.en 应已本地化（≠ 'Users'）——防词典值错位把总览条目译成 dashboard
    const notLocalized = ['de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt']
      .filter((l) => dicts[l]['admin.nav.users.en'] === 'Users');
    ok('S6 12 语言词典：总览 5 组 en 键全在场（12 语言 × 5 键零缺失）', langs.length === 12 && bad.length === 0,
      'langs=' + langs.length + ' bad=' + bad.join(';'));
    ok('S7 非英/繁语言 users.en 已本地化（≠ zh 英文原串——词典值错位哨兵）', notLocalized.length === 0,
      'notLocalized=' + notLocalized.join(','));
  }

  // ── S smoke-admin 条目名断言（此前只数条目不查名，回归漏网——本轮补上）──
  ok('S8 smoke-admin 条目名断言在位（总览 5 条目逐一比对）',
    smoke.indexOf("JSON.stringify(['Dashboard', 'Analytics', 'Users', 'Content', 'Community'])") !== -1);

  console.log('');
  console.log('╭──────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (admin-nav)  │');
  console.log('╰──────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
} catch (e) {
  console.error('💥 电池异常: ' + (e && e.stack || e));
  process.exit(1);
}
