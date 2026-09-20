// tmp-battery-cit2usr.js — v0.2.51.1 CIT→USR 全栈统一静态巡检电池（纯文件 grep，无浏览器）
// 断言：前端五文件真实代码区零 CIT- 字面量 / site-config 版本与 changelog 条目 / 后端生成口径 citizenId=id
// + 零 'CIT-' + pad6 / 026 迁移在位 / 测试钉 26 + USR- 口径 / 五锚电池版本同步
'use strict';
const fs = require('fs');
const path = require('path');

const DOCS = path.resolve(__dirname, '..', 'docs');
const BE = __dirname; // 本电池就在 backend-v2 内
const read = (p) => fs.readFileSync(p, 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

// 1. 前端五文件真实代码区零 'CIT-'（demo/兜底字面量已全部 USR- 化）
for (const f of ['signup-and-login.html', 'assets/js/sidebar.js', 'assets/js/settings-modal.js',
                 'pages/fluidcanvas.html', 'pages/onboarding-identity.html']) {
  ok('前端零 CIT-：' + f, read(path.join(DOCS, f)).indexOf('CIT-') === -1);
}

// 2. site-config 版本锚 + changelog 新条目（changelog 注释里的 CIT- 历史说明是文档，不断言零）
{
  const s = read(path.join(DOCS, 'assets/js/site-config.js'));
  ok('site-config 版本 = v0.2.54.0', s.indexOf("window.MN_SITE_VERSION = 'v0.2.56.2';") !== -1);
  ok('site-config changelog 含 v0.2.51.1 条目 + 用户原话',
    s.indexOf('v0.2.51.1 = 公民号前缀 CIT- → USR- 全栈统一') !== -1 && s.indexOf('能不能把CIT改成') !== -1);
}

// 3. 后端生成口径：auth.js 不再用 CIT- 前缀生成、citizenId 恒等于 id
{
  const a = read(path.join(BE, 'src/routes/public/auth.js'));
  ok("auth.js 无 'CIT-' + pad6 生成表达式", a.indexOf("'CIT-' + pad6") === -1);
  ok('auth.js 含 const citizenId = id;', a.indexOf('const citizenId = id;') !== -1);
}

// 4. 026 迁移在位且是 UPDATE 归位口径（NULL 补齐 + 异值改写）
{
  const m = read(path.join(BE, 'migrations/026_citizen_id_to_usr.sql'));
  ok('026 迁移 UPDATE citizen_id = id（NULL 补齐 + 异值改写）',
    m.indexOf('UPDATE users SET citizen_id = id') !== -1 && m.indexOf('IS NULL OR citizen_id != id') !== -1);
}

// 5. 测试钉：health/migrations 版本 28 + auth/social-profile/mask 的 USR- 口径
{
  const h = read(path.join(BE, 'test/health.test.js'));
  ok('health.test user_version 28 + 标题 001-028', h.indexOf('{ simple: true }), 28)') !== -1 && h.indexOf('迁移 001-028') !== -1);
  const g = read(path.join(BE, 'test/migrations.test.js'));
  ok('migrations.test user_version 28（主+幂等+017/022 补跑同步）', g.indexOf('{ simple: true }), 28)') !== -1);
  ok('migrations.test 新 026 测试在位（三态断言）',
    g.indexOf('迁移 026：citizen_id 统一 USR- 口径') !== -1 && g.indexOf("'USR-000001', '旧 CIT- 存量改写为 id'") !== -1);
  ok('auth.test USR- 前缀断言', read(path.join(BE, 'test/auth.test.js')).indexOf("startsWith('USR-')") !== -1);
  ok('social-profile.test USR 正则', read(path.join(BE, 'test/social-profile.test.js')).indexOf('/^USR-\\d{6}$/') !== -1);
  ok('mask.test USR-1 fixture', read(path.join(BE, 'test/mask.test.js')).indexOf("citizen_id: 'USR-1'") !== -1);
}

// 6. 五锚电池版本同步 v0.2.54.0
for (const f of ['tmp-battery-msglink.js', 'tmp-battery-mono-flash.js', 'tmp-battery-monodark-v0422.js',
                 'tmp-battery-fadefix.js', 'tmp-battery-pageswitch.js']) {
  ok('电池锚 v0.2.54.0：' + f, read(path.join(BE, f)).indexOf('v0.2.56.2') !== -1);
}

console.log('\ncit2usr 巡检：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
