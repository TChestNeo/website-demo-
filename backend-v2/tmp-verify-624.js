// tmp-verify-624.js — v0.2.58.18 个人资料自定义横幅/头像镜像内容验证（两次构建各验一次、先验后推）
//   锚在位：029 迁移、auth.js PATCH bannerUrl+avatarUrl 加固+审计、social.js GET 守卫行、两测试文件新案、
//   site-config 版本+changelog、页面五 id+关键件、i18n 11 新键×11 语；
//   零残留：58.17 赋值。
//   （docker run sh -c 读 /app；grep -c 按行计；-F 字面量；计数全部=电池 tmp-battery-profile-banner.js B1 区实测口径）
//   测试文件五锚 test/ 被 dockerignore 排除不进镜像——改查本地工作树（npm test 359/359 已覆盖行为）。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mig = '/app/migrations/029_user_banner.sql';
const au = '/app/src/routes/public/auth.js';
const so = '/app/src/routes/public/social.js';
const sc = '/app/docs/assets/js/site-config.js';
const page = '/app/docs/pages/community-profile.html';
const i18n = '/app/docs/assets/i18n/community-profile.i18n.js';
const fol = '/app/docs/pages/following.html';
const act = '/app/docs/pages/activity.html';
const HERE = __dirname;
const cmds = [
  // ── 后端 029 迁移 + auth.js PATCH + social.js GET ──
  ['029 迁移 ADD COLUMN banner_url ×1', `grep -cF 'ADD COLUMN banner_url' ${mig}`, '1'],
  ['auth.js PATCH banner_url = ? 分支 ×1', `grep -cF 'banner_url = ?' ${au}`, '1'],
  ['auth.js 审计 bannerUrl: next.banner_url ×1', `grep -cF 'bannerUrl: next.banner_url' ${au}`, '1'],
  ['auth.js 横幅校验报错文案 ×1', `grep -c '横幅需为' ${au}`, '1'],
  ['auth.js 头像校验报错文案 ×1', `grep -c '头像需为' ${au}`, '1'],
  ['social.js GET bannerUrl 守卫行 ×1', `grep -cF 'bannerUrl: (typeof row.banner_url' ${so}`, '1'],
  // ── 测试文件新案（工作树；test/ 不进镜像） ──
  ['social-profile.test.js 横幅案标题 ×1（工作树）', null, '1'],
  ['social-profile.test.js 头像加固案标题 ×1（工作树）', null, '1'],
  ['migrations.test.js 029 案标题 ×1（工作树）', null, '1'],
  ['notifications.test.js 029 旁证注释 ×1（工作树）', null, '1'],
  ['health.test.js 029_user_banner 注释 ×1（工作树）', null, '1'],
  // ── site-config 版本+changelog ──
  ['site-config 58.18 赋值在位', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.18';" ${sc}`, '1'],
  ['site-config 58.17 赋值零残留(应 0)', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.17';" ${sc}`, '0'],
  ['site-config FC 47.4 恒（零改动）', `grep -cF "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';" ${sc}`, '1'],
  ['changelog 58.18 条目标题在位', `grep -cF '// v0.2.58.18 = ' ${sc}`, '1'],
  ['changelog 58.18 用户原话片断', `grep -c '能不能把个人资料的自定义' ${sc}`, '1'],
  ['changelog rev 00331-g9b 真瞬态注记', `grep -cF 'rev 00331-g9b' ${sc}`, '1'],
  ['changelog rev 00331-XXX 占位零残留(应 0)', `grep -cF 'rev 00331-XXX' ${sc}`, '0'],
  ['changelog rev 00333-??? 终态占位注记', `grep -cF 'rev 00333-???' ${sc}`, '1'],
  ['changelog i18n 11 新键×11 语注记', `grep -cF 'i18n 11 新键×11 语' ${sc}`, '1'],
  // ── community-profile.html 关键件 ──
  ['页面 id editBannerUploadBtn ×1', `grep -cF 'id="editBannerUploadBtn"' ${page}`, '1'],
  ['页面 id editBannerLibBtn ×1', `grep -cF 'id="editBannerLibBtn"' ${page}`, '1'],
  ['页面 id editBannerRemoveBtn ×1', `grep -cF 'id="editBannerRemoveBtn"' ${page}`, '1'],
  ['页面 id editBannerFile ×1（JS 动态赋 id）', `grep -cF "id = 'editBannerFile'" ${page}`, '1'],
  ['页面 id editAvatarLibBtn ×1', `grep -cF 'id="editAvatarLibBtn"' ${page}`, '1'],
  ['页面 has-img CSS 规则 ×1', `grep -cF '.profile-banner.has-img' ${page}`, '1'],
  ['页面 function openFcLibraryPicker ×1', `grep -cF 'function openFcLibraryPicker' ${page}`, '1'],
  ['页面 function fcDataUrlToBlob ×1', `grep -cF 'function fcDataUrlToBlob' ${page}`, '1'],
  ['页面 保存 diff body.bannerUrl = editBannerUrl ×1', `grep -cF 'body.bannerUrl = editBannerUrl' ${page}`, '1'],
  ['页面 var editBannerUrl ×1', `grep -cF 'var editBannerUrl' ${page}`, '1'],
  // ── i18n 11 新键 ×11 语 ──
  ['i18n bannerImg ×11', `grep -cF "'prof.edit.bannerImg'" ${i18n}`, '11'],
  ['i18n bannerUpload ×11', `grep -cF "'prof.edit.bannerUpload'" ${i18n}`, '11'],
  ['i18n bannerLib ×11', `grep -cF "'prof.edit.bannerLib'" ${i18n}`, '11'],
  ['i18n bannerRemove ×11', `grep -cF "'prof.edit.bannerRemove'" ${i18n}`, '11'],
  ['i18n bannerReady ×11', `grep -cF "'prof.edit.bannerReady'" ${i18n}`, '11'],
  ['i18n bannerUploading ×11', `grep -cF "'prof.edit.bannerUploading'" ${i18n}`, '11'],
  ['i18n bannerUploadFail ×11', `grep -cF "'prof.edit.bannerUploadFail'" ${i18n}`, '11'],
  ['i18n bannerHint ×11', `grep -cF "'prof.edit.bannerHint'" ${i18n}`, '11'],
  ['i18n avatarLib ×11', `grep -cF "'prof.edit.avatarLib'" ${i18n}`, '11'],
  ['i18n libTitle ×11', `grep -cF "'prof.edit.libTitle'" ${i18n}`, '11'],
  ['i18n libEmpty ×11', `grep -cF "'prof.edit.libEmpty'" ${i18n}`, '11'],
  ['i18n zh-Hant 自动生成标记 ×1', `grep -cF '__ZH_HANT_AUTO__' ${i18n}`, '1'],
  // ── 58.16/58.17 在位回归 ──
  ['activity.html 搜索框 id ×1（58.16 回归）', `grep -cF 'id="activitySearch"' ${act}`, '1'],
  ['following.html api.js 引入 ×1（58.17 回归）', `grep -cF 'assets/js/api.js' ${fol}`, '1'],
];
let bad = 0;
// 工作树五锚（test/ 不进镜像）：按行数 = 电池 B1 实测口径
const wt = [
  ['social-profile.test.js 横幅案标题 ×1', 'test/social-profile.test.js', '横幅：bannerUrl 落库', '1'],
  ['social-profile.test.js 头像加固案标题 ×1', 'test/social-profile.test.js', '头像加固：avatarUrl 非法', '1'],
  ['migrations.test.js 029 案标题 ×1', 'test/migrations.test.js', '迁移 029：users.banner_url 加列', '1'],
  ['notifications.test.js 029 旁证注释 ×1', 'test/notifications.test.js', '029 只加 users.banner_url 列', '1'],
  ['health.test.js 029_user_banner 注释 ×1', 'test/health.test.js', '029_user_banner', '1'],
];
let wtIdx = 0;
for (const [name, c, want] of cmds) {
  let out;
  if (c === null) {
    const [label, f, pat] = wt[wtIdx++];
    const s = fs.readFileSync(path.join(HERE, f), 'utf8').replace(/\r\n/g, '\n');
    out = String(s.split('\n').filter((l) => l.indexOf(pat) !== -1).length);
    console.log(`[${label}] → ${out}`);
  } else {
    const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
    out = (r.stdout || '').trim();
    console.log(`[${name}] → ${out}`);
  }
  if (out !== want) bad++;
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
