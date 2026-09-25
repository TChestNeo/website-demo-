// tmp-battery-admin-grantrec.js — admin 订阅发放记录（用户「订阅发放的后端记录可以查看是否生效（排列方式：生效 · 高级），
//   然后下方显示发放记录（显示发放时间什么时候开始什么时候结束，总共发放了几次」→ 钦定：用户详情内 + 每用户当前订阅状态）
// 静态锚电池：pages-users.js 记录卡（生效 · 高级状态条 + 发放记录表）+ admin.i18n.js 15 新键 ×12 语言 + zh 值逐字节一致 +
//   后端 GET /staff/subscriptions/grants/:userId + 发放审计 prev/next 携带到期窗口 + smoke-admin 新断言。
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
  const users = fs.readFileSync(path.join(REPO, 'docs/admin/js/pages-users.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(REPO, 'docs/assets/i18n/admin.i18n.js'), 'utf8');
  const route = fs.readFileSync(path.join(REPO, 'backend-v2/src/routes/staff/subscriptions.js'), 'utf8');
  const testF = fs.readFileSync(path.join(REPO, 'backend-v2/test/staff-subscriptions.test.js'), 'utf8');
  const smoke = fs.readFileSync(path.join(REPO, 'backend-v2/scripts/smoke-admin.js'), 'utf8');

  // ── S pages-users.js 记录卡 ──
  ok('S1 记录卡在位（recTitle 键 + 兜底文案「订阅发放记录」+ 卡序 payments → grant → rec → security）',
    users.indexOf("T('admin.users.recTitle') || '订阅发放记录'") !== -1 &&
    users.indexOf('box.replaceChildren(header, infoCard, statsStrip, paymentsCard, grantCard, recCard, securityCard);') !== -1);
  ok('S2 记录取数：GET /staff/subscriptions/grants/ + subscriptions.manage 门控（无权限不请求防 403 审计噪音）',
    users.indexOf("SC.can('subscriptions.manage') ? SC.get('/staff/subscriptions/grants/' + state.userId) : Promise.resolve(null)") !== -1);
  ok('S3 生效 · 高级 状态条：SUB_STATUS 四态（无订阅/生效中/已过期/永久）+ tier chip 跟随',
    users.indexOf("none: ['无订阅', 'admin.users.recStNone', 'neutral']") !== -1 &&
    users.indexOf("active: ['生效中', 'admin.users.recStActive', 'ok']") !== -1 &&
    users.indexOf("expired: ['已过期', 'admin.users.recStExpired', 'neutral']") !== -1 &&
    users.indexOf("forever: ['永久', 'admin.users.recStForever', 'warn']") !== -1);
  ok('S4 发放记录表五列：发放时间/等级/开始时间/结束时间/是否生效 + 总数「总共发放了 {n} 次」',
    users.indexOf("T('admin.users.recGrantedAt') || '发放时间'") !== -1 &&
    users.indexOf("T('admin.users.recStart') || '开始时间'") !== -1 &&
    users.indexOf("T('admin.users.recEnd') || '结束时间'") !== -1 &&
    users.indexOf("T('admin.users.recEffect') || '是否生效'") !== -1 &&
    users.indexOf("T('admin.users.recTotal') || '总共发放了 {n} 次'") !== -1);
  ok('S5 生效/无变化双 chip + 结束单元格永久复用 recStForever + 旧形状行 — 兜底 + 空态文案',
    users.indexOf("T('admin.users.recEffectApplied') || '生效'") !== -1 &&
    users.indexOf("T('admin.users.recEffectNoop') || '无变化'") !== -1 &&
    users.indexOf("g.end === null ? (T('admin.users.recStForever') || '永久') : '—'") !== -1 &&
    users.indexOf("T('admin.users.recEmpty') || '暂无发放记录'") !== -1);
  ok('S6 无权限角色整卡不渲染（recCard = null）+ 加载失败兜底文案',
    users.indexOf('const recCard = SC.can(\'subscriptions.manage\')') !== -1 &&
    users.indexOf(': null;') !== -1 &&
    users.indexOf("T('admin.users.recLoadFail') || '发放记录加载失败或无权限。'") !== -1);

  // ── S admin.i18n.js 15 新键 ×12 语言 ──
  const KEYS = ['recTitle', 'recSub', 'recStNone', 'recStActive', 'recStExpired', 'recStForever', 'recTotal', 'recGrantedAt', 'recStart', 'recEnd', 'recEffect', 'recEffectApplied', 'recEffectNoop', 'recEmpty', 'recLoadFail'];
  const LANGS = ['zh', 'en', 'de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt', 'zh-Hant'];
  const blockOf = (lang) => {
    const start = i18n.indexOf("add('" + lang + "',");
    if (start === -1) return '';
    const next = i18n.indexOf("add('", start + 5);
    return next === -1 ? i18n.slice(start) : i18n.slice(start, next);
  };
  const missing = [];
  LANGS.forEach((lang) => {
    const seg = blockOf(lang);
    KEYS.forEach((k) => {
      // zh-Hant 自动段键名双引号（OpenCC 生成口径），其余块单引号——两种都认
      if (seg.indexOf("'admin.users." + k + "'") === -1 && seg.indexOf('"admin.users.' + k + '"') === -1) missing.push(lang + '.' + k);
    });
  });
  ok('S7 15 新键 ×12 语言块全在位（zh-Hant 由 OpenCC 重生成）', missing.length === 0, missing.slice(0, 6).join(','));
  ok('S8 i18n 文件可执行（链式 add ×12 语言，键数统一 307）',
    (function () {
      try {
        const MN = { dicts: [], add: function (k, d) { MN.dicts.push([k, d]); return MN; } };
        new Function('window', 'localStorage', i18n)({ MN_I18N: MN }, { getItem: function () { return null; }, setItem: function () {} });
        return MN.dicts.length === 12 && MN.dicts.every(([, d]) => Object.keys(d).length === 307);
      } catch (e) { return false; }
    })());

  // zh 值与页面兜底串逐字节一致（smoke-admin 中文断言安全：线上中文包 = 页面兜底）
  const ZH_EXPECT = {
    recTitle: '订阅发放记录',
    recSub: 'Grants · 生效状态与发放历史',
    recStNone: '无订阅',
    recStActive: '生效中',
    recStExpired: '已过期',
    recStForever: '永久',
    recTotal: '总共发放了 {n} 次',
    recGrantedAt: '发放时间',
    recStart: '开始时间',
    recEnd: '结束时间',
    recEffect: '是否生效',
    recEffectApplied: '生效',
    recEffectNoop: '无变化',
    recEmpty: '暂无发放记录',
    recLoadFail: '发放记录加载失败或无权限。'
  };
  const zhSeg = blockOf('zh');
  const zhBad = [];
  Object.keys(ZH_EXPECT).forEach((k) => {
    const m = zhSeg.match(new RegExp("'admin\\.users\\." + k + "': '([^']*)'"));
    if (!m || m[1] !== ZH_EXPECT[k]) zhBad.push(k + (m ? '→「' + m[1] + '」' : '缺失'));
  });
  ok('S9 zh 15 值与页面兜底串逐字节一致', zhBad.length === 0, zhBad.slice(0, 4).join(','));
  ok('S10 zh-Hant 段含 OpenCC 哨兵 + 记录键（重生成后不丢）',
    i18n.indexOf('__ZH_HANT_AUTO__') !== -1 &&
    blockOf('zh-Hant').indexOf('admin.users.recTitle') !== -1);

  // ── S 后端 ──
  ok('S11 后端 GET /api/staff/subscriptions/grants/:userId（subscriptions.manage 门控 + 404 + 排序 生效 · 高级）',
    route.indexOf("router.add('GET', '/api/staff/subscriptions/grants/:userId'") !== -1 &&
    route.indexOf("requirePerm('subscriptions.manage')") !== -1 &&
    route.indexOf("throw new HttpError('NOT_FOUND', '用户不存在')") !== -1 &&
    route.indexOf("rank[y.tier] - rank[x.tier]") !== -1);
  ok('S12 发放审计 prev/next 携带到期窗口+月数（记录卡开始/结束的数据源）',
    route.indexOf('prev: { from: user.tier, prevExpiry: user.tier_expires_at, via: \'staff_test_grant\' }') !== -1 &&
    route.indexOf('next: { to: newTier, nextExpiry: expiry, months }') !== -1);
  ok('S13 测试：记录 GET 两新用例（生效 · 高级排列 + 旧形状容忍 + RBAC/404/401）',
    testF.indexOf('grant 记录 GET：发放时间/开始/结束/生效') !== -1 &&
    testF.indexOf("'AUD-LEGACY-1'") !== -1 &&
    testF.indexOf('grant 记录 GET RBAC') !== -1);
  ok('S14 smoke-admin 新断言（director 记录卡 4 项 + cs 无卡）',
    smoke.indexOf('订阅发放记录卡（director 可见 + 总数 1 次）') !== -1 &&
    smoke.indexOf('生效 · 高级 状态条') !== -1 &&
    smoke.indexOf('cs 详情：无订阅发放记录卡') !== -1);

  console.log('');
  console.log('╭──────────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (admin-grantrec)     │');
  console.log('╰──────────────────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
} catch (e) {
  console.error('💥 电池异常: ' + (e && e.stack || e));
  process.exit(1);
}
