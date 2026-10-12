// tmp-verify-626.js — v0.2.58.20 个人资料头像 ↔ FC 频道主页头像双向同步镜像内容验证（两次构建各验一次、先验后推）
//   锚在位：site-config 58.20/48.0+双 changelog+00336-/00337- 占位×2、资料页 toggle+slati_avatar_sync+bio 边界（58.19 锚回归）、
//   FC 页 fc-avatar-editable/fcAvatarFile/fcEnsureApi/avatarUrl: data.url/bannerUrl 零、i18n 新键（profile ×11+zh-Hant 双引号×1、FC 六键×12）；
//   后端本轮零改动 → 只保留 58.18 锚回归（029 迁移/auth.js/social.js）；
//   零残留：58.19/47.4 赋值。
//   （docker run sh -c 读 /app；grep -cF 按行计；计数全部=本文件写入前实测口径——
//   fcAvatarFile ×16 行（电池 P0 按出现次数 ×18：3859 行双出现）、bio ×2 行（电池 ×3 同因）——行语义与出现语义不同为已知差异）
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
const fc = '/app/docs/pages/fluidcanvas.html';
const fci = '/app/docs/assets/i18n/fluidcanvas.i18n.js';
const HERE = __dirname;
const cmds = [
  // ── 后端 58.18 锚回归（本轮零改动仍须在位） ──
  ['029 迁移 ADD COLUMN banner_url ×1', `grep -cF 'ADD COLUMN banner_url' ${mig}`, '1'],
  ['auth.js PATCH banner_url = ? 分支 ×1', `grep -cF 'banner_url = ?' ${au}`, '1'],
  ['social.js GET bannerUrl 守卫行 ×1', `grep -cF 'bannerUrl: (typeof row.banner_url' ${so}`, '1'],
  // ── 测试文件五锚（工作树；test/ 不进镜像） ──
  ['social-profile.test.js 横幅案标题 ×1（工作树）', null, '1'],
  ['social-profile.test.js 头像加固案标题 ×1（工作树）', null, '1'],
  ['migrations.test.js 029 案标题 ×1（工作树）', null, '1'],
  ['notifications.test.js 029 旁证注释 ×1（工作树）', null, '1'],
  ['health.test.js 029_user_banner 注释 ×1（工作树）', null, '1'],
  // ── site-config 版本+changelog ──
  ['site-config 58.20 赋值在位', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.20';" ${sc}`, '1'],
  ['site-config 58.19 赋值零残留(应 0)', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.19';" ${sc}`, '0'],
  ['site-config FC 48.0 赋值在位', `grep -cF "window.FLUIDCANVAS_VERSION = 'v10.28.48.0';" ${sc}`, '1'],
  ['site-config FC 47.4 赋值零残留(应 0)', `grep -cF "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';" ${sc}`, '0'],
  ['changelog 58.20 条目标题在位', `grep -cF '// v0.2.58.20 = ' ${sc}`, '1'],
  ['changelog FC 48.0 条目标题在位', `grep -cF '// v10.28.48.0 = ' ${sc}`, '1'],
  ['changelog rev 00336-7gr 真值注记 ×2（二次烘焙口径）', `grep -cF 'rev 00336-7gr' ${sc}`, '2'],
  ['changelog rev 00336-XXX 占位零残留(应 0)', `grep -cF 'rev 00336-XXX' ${sc}`, '0'],
  ['changelog rev 00337-??? 终态占位注记 ×2', `grep -cF 'rev 00337-???' ${sc}`, '2'],
  ['changelog 58.19 条目 00334-tz6 保留', `grep -cF 'rev 00334-tz6' ${sc}`, '1'],
  ['changelog 58.19 条目 00335-fmn 保留', `grep -cF 'rev 00335-fmn' ${sc}`, '1'],
  ['changelog 用户原话片断 ×2（站点+FC 条目）', `grep -cF '头像你没有做更换头像' ${sc}`, '2'],
  ['changelog 默认勾选 ×3', `grep -cF '默认勾选' ${sc}`, '3'],
  ['changelog 双向同步 ×4', `grep -cF '双向同步' ${sc}`, '4'],
  ['changelog 不互通 ×3（bio 边界）', `grep -cF '不互通' ${sc}`, '3'],
  // ── community-profile.html 58.20 头像同步件 ──
  ['页面 editAvatarSyncToggle ×4（id=+F3 getElementById+F4 querySelector+aria 注释）', `grep -cF 'editAvatarSyncToggle' ${page}`, '4'],
  ['页面 slati_avatar_sync ×2（F1 读+F3 写）', `grep -cF 'slati_avatar_sync' ${page}`, '2'],
  // ── community-profile.html 58.19 订阅分层件回归 ──
  ['页面 sub-locked ×3（渲染 ×2+CSS ×1）', `grep -cF 'sub-locked' ${page}`, '3'],
  ['页面 function blockGif ×1', `grep -cF 'function blockGif' ${page}`, '1'],
  ['页面 id avatarGifUpgradeLink ×1', `grep -cF 'avatarGifUpgradeLink' ${page}`, '1'],
  ['页面 id bannerGifUpgradeLink ×1', `grep -cF 'bannerGifUpgradeLink' ${page}`, '1'],
  // ── community-profile.html 58.18 关键件回归 ──
  ['页面 id editBannerUploadBtn ×1', `grep -cF 'id="editBannerUploadBtn"' ${page}`, '1'],
  ['页面 id editBannerLibBtn ×1', `grep -cF 'id="editBannerLibBtn"' ${page}`, '1'],
  ['页面 id editBannerRemoveBtn ×1', `grep -cF 'id="editBannerRemoveBtn"' ${page}`, '1'],
  ['页面 id editBannerFile ×1（JS 动态赋 id）', `grep -cF "id = 'editBannerFile'" ${page}`, '1'],
  ['页面 id editAvatarFile ×1（JS 动态赋 id）', `grep -cF "id = 'editAvatarFile'" ${page}`, '1'],
  ['页面 id editAvatarLibBtn ×1', `grep -cF 'id="editAvatarLibBtn"' ${page}`, '1'],
  ['页面 has-img CSS 规则 ×1', `grep -cF '.profile-banner.has-img' ${page}`, '1'],
  ['页面 function openFcLibraryPicker ×1', `grep -cF 'function openFcLibraryPicker' ${page}`, '1'],
  ['页面 function fcDataUrlToBlob ×1', `grep -cF 'function fcDataUrlToBlob' ${page}`, '1'],
  ['页面 保存 diff body.bannerUrl = editBannerUrl ×1', `grep -cF 'body.bannerUrl = editBannerUrl' ${page}`, '1'],
  // ── i18n 58.20 新键（zh-Hant 自动块双引号单独锚；另断生成标记） ──
  ['i18n prof.edit.avatarSync ×11（手工单引号块）', `grep -cF "'prof.edit.avatarSync'" ${i18n}`, '11'],
  ['i18n prof.edit.avatarSync zh-Hant 自动块 ×1（双引号）', `grep -cF '"prof.edit.avatarSync"' ${i18n}`, '1'],
  ['i18n zh-Hant 自动生成标记 ×1', `grep -cF '__ZH_HANT_AUTO__' ${i18n}`, '1'],
  // ── i18n 58.19 三键回归 ──
  ['i18n prof.toast.gifLocked ×11', `grep -cF "'prof.toast.gifLocked'" ${i18n}`, '11'],
  ['i18n prof.toast.libLocked ×11', `grep -cF "'prof.toast.libLocked'" ${i18n}`, '11'],
  ['i18n prof.edit.gifUpgrade ×11', `grep -cF "'prof.edit.gifUpgrade'" ${i18n}`, '11'],
  // ── fluidcanvas.html 58.20 头像同步件 ──
  ['fc-avatar-editable ×6（CSS×2+JS 渲染×2+委托×1+注释×1）', `grep -cF 'fc-avatar-editable' ${fc}`, '6'],
  ['fcAvatarFile ×16 行（3859 行双出现→电池按出现次数 ×18）', `grep -cF 'fcAvatarFile' ${fc}`, '16'],
  ['fcEnsureApi ×2', `grep -cF 'fcEnsureApi' ${fc}`, '2'],
  ['slati_avatar_sync ×1（fcAvatarSyncOn 谓词）', `grep -cF 'slati_avatar_sync' ${fc}`, '1'],
  ['PATCH 体纯度 avatarUrl: data.url ×1', `grep -cF 'avatarUrl: data.url' ${fc}`, '1'],
  ['bio ×2 行（3872 行双出现→电池按出现次数 ×3；均为新段注释）', `grep -cF 'bio' ${fc}`, '2'],
  // ── FC 不互通（钦定：FC 频道主页零 banner 件） ──
  ['fluidcanvas.html bannerUrl 零(应 0)', `grep -cF 'bannerUrl' ${fc}`, '0'],
  ['fluidcanvas.html banner_url 零(应 0)', `grep -cF 'banner_url' ${fc}`, '0'],
  // ── fluidcanvas.i18n.js 六新键 ×12 语（zh-Hant 自动块同双引号计入） ──
  ['fc i18n fc.landing.changeAvatar ×12', `grep -cF '"fc.landing.changeAvatar"' ${fci}`, '12'],
  ['fc i18n fc.toast.avatarUpdated ×12', `grep -cF '"fc.toast.avatarUpdated"' ${fci}`, '12'],
  ['fc i18n fc.toast.avatarFailed ×12', `grep -cF '"fc.toast.avatarFailed"' ${fci}`, '12'],
  ['fc i18n fc.toast.gifLocked ×12', `grep -cF '"fc.toast.gifLocked"' ${fci}`, '12'],
  ['fc i18n fc.toast.imgOnly ×12', `grep -cF '"fc.toast.imgOnly"' ${fci}`, '12'],
  ['fc i18n fc.toast.imgTooBig10 ×12', `grep -cF '"fc.toast.imgTooBig10"' ${fci}`, '12'],
  ['fc i18n zh-Hant 自动生成标记 ×2（头注释+块标记）', `grep -cF '__ZH_HANT_AUTO__' ${fci}`, '2'],
  // ── 58.16/58.17 在位回归 ──
  ['activity.html 搜索框 id ×1（58.16 回归）', `grep -cF 'id="activitySearch"' ${act}`, '1'],
  ['following.html api.js 引入 ×1（58.17 回归）', `grep -cF 'assets/js/api.js' ${fol}`, '1'],
];
let bad = 0;
// 工作树五锚（test/ 不进镜像）：按行数 = 625 同口径
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
