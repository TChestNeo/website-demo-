// tmp-battery-admin-grant.js — admin 面板订阅发放（用户「为什么我无法手动更改用户的订阅等级？我要给我自己免费开通订阅」→ 钦定 admin 面板加发放功能）
// 静态锚电池：pages-users.js 详情页发放区块（等级/月数/按钮/权限门/刷新）+ admin.i18n.js 8 新键 ×12 语言 + zh 值与页面兜底逐字节一致 + zh-Hant OpenCC 重生成
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

  // ── S pages-users.js 发放区块 ──
  ok('S1 发放区块在位（grantTitle 键 + 兜底文案「订阅发放」）',
    users.indexOf("T('admin.users.grantTitle') || '订阅发放'") !== -1);
  ok('S2 权限门 subscriptions.manage（无权限角色只见提示文案，§28 同支付区块口径）',
    users.indexOf("SC.can('subscriptions.manage')") !== -1 &&
    users.indexOf("T('admin.users.grantNoPerm') || '当前角色无订阅发放权限") !== -1);
  ok('S3 发放请求 POST /staff/subscriptions/grant（email/tierKey/months 三字段）',
    users.indexOf("SC.post('/staff/subscriptions/grant', { email: u.email, tierKey: tierSel.value, months: parseInt(monthsSel.value, 10) })") !== -1);
  ok('S4 等级三档 basic/premium/ultra（值为后端 TIER_OF 键，不译）',
    users.indexOf("[['basic', 'Basic'], ['premium', 'Premium'], ['ultra', 'Ultra']]") !== -1);
  ok('S5 月数四档 1/3/6/12（后端钳制 1..12）',
    users.indexOf('[1, 3, 6, 12].map((m) => h(\'option\', { value: String(m), text: String(m) }))') !== -1);
  ok('S6 成功 → toast + renderDetail 刷新（chip 层级随刷新更新，同 flagEvent 口径）',
    users.indexOf("toast((T('admin.users.grantDone') || '已发放订阅（写操作已审计）'))") !== -1 &&
    users.indexOf('renderDetail(SC.pages.users._root)') !== -1);
  ok('S7 卡片顺序：支付记录 → 订阅发放 → 安全档案',
    users.indexOf('box.replaceChildren(header, infoCard, statsStrip, paymentsCard, grantCard, securityCard);') !== -1);
  ok('S8 请求期间按钮禁用防连点（btn.disabled 双写：点击前置 true / 回执置 false）',
    users.indexOf('btn.disabled = true;') !== -1 && users.indexOf('btn.disabled = false;') !== -1);

  // ── S admin.i18n.js 8 新键 ×12 语言 ──
  const KEYS = ['grantTitle', 'grantSub', 'grantTier', 'grantMonths', 'grantBtn', 'grantDone', 'grantFail', 'grantNoPerm'];
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
  ok('S9 8 新键 ×12 语言块全在位（zh-Hant 由 OpenCC 重生成）', missing.length === 0, missing.slice(0, 6).join(','));
  ok('S10 i18n 文件可执行（链式 add ×12 语言，键数统一 292）',
    (function () {
      try {
        const MN = { dicts: [], add: function (k, d) { MN.dicts.push([k, d]); return MN; } };
        new Function('window', 'localStorage', i18n)({ MN_I18N: MN }, { getItem: function () { return null; }, setItem: function () {} });
        return MN.dicts.length === 12 && MN.dicts.every(([, d]) => Object.keys(d).length === 292);
      } catch (e) { return false; }
    })());

  // zh 值与页面兜底串逐字节一致（smoke-admin 中文断言安全：线上中文包 = 页面兜底）
  const ZH_EXPECT = {
    grantTitle: '订阅发放',
    grantSub: 'Grant · 免费发放',
    grantTier: '等级',
    grantMonths: '月数',
    grantBtn: '发放订阅',
    grantDone: '已发放订阅（写操作已审计）',
    grantFail: '发放失败：',
    grantNoPerm: '当前角色无订阅发放权限（subscriptions.manage）。'
  };
  const zhSeg = blockOf('zh');
  const zhBad = [];
  Object.keys(ZH_EXPECT).forEach((k) => {
    const m = zhSeg.match(new RegExp("'admin\\.users\\." + k + "': '([^']*)'"));
    if (!m || m[1] !== ZH_EXPECT[k]) zhBad.push(k + (m ? '→「' + m[1] + '」' : '缺失'));
  });
  ok('S11 zh 8 值与页面兜底串逐字节一致', zhBad.length === 0, zhBad.slice(0, 4).join(','));
  ok('S12 zh-Hant 段含 OpenCC 哨兵 + 发放键（重生成后不丢）',
    i18n.indexOf('__ZH_HANT_AUTO__') !== -1 &&
    blockOf('zh-Hant').indexOf('admin.users.grantTitle') !== -1);

  console.log('');
  console.log('╭──────────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (admin-grant)        │');
  console.log('╰──────────────────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
} catch (e) {
  console.error('💥 电池异常: ' + (e && e.stack || e));
  process.exit(1);
}
