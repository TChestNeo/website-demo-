// tmp-verify-627.js — v0.2.58.21 侧栏用户卡片弹窗+设置弹窗头像/横幅完整自定义镜像内容验证（两次构建各验一次、先验后推）
//   锚在位：site-config 58.21/48.0+58.21 单 changelog+rev 00338-XXX/00339-??? 占位×1+三项钦定关键词+stopPropagation×3、
//   settings-modal 六 id+sub-locked+stUpload/stRawMergeUser/bannerUrl: null/slati_avatar_sync+makeToggle 复用+stApiBase+SlatiSettings 导出、
//   sidebar.js openUserPop/slati-user-pop-style/preventDefault ×2/e.stopPropagation()/.user-info-bar a/SlatiSettings.open、
//   common.i18n 21 键 ×11 单引号+zh-Hant 双引号 ×1+生成标记；
//   回归：资料页 58.20（editAvatarSyncToggle/slati_avatar_sync）+58.19（sub-locked/blockGif）+58.18（横幅组六件）件、
//   FC 页 58.20 头像同步件+FC 不互通 bannerUrl 零、fc i18n 六键×12、58.16/58.17 在位、后端三端点锚（零改动仍须在位）；
//   零残留：58.20/47.4 赋值。
//   （docker run sh -c 读 /app；grep -cF 按行计；计数全部=本文件写入前实测口径）
//   测试文件五锚 test/ 被 dockerignore 排除不进镜像——改查本地工作树（npm test 359/359 不重跑，后端零改动）。
//   二次烘焙口径：deploy#1 后工作树填真 rev → 本文件 'rev 00338-XXX' 锚改真值 'rev 00338-<真>'（00338-XXX 零残留+真值 ×1）。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mig = '/app/migrations/029_user_banner.sql';
const au = '/app/src/routes/public/auth.js';
const so = '/app/src/routes/public/social.js';
const sc = '/app/docs/assets/js/site-config.js';
const sm = '/app/docs/assets/js/settings-modal.js';
const sb = '/app/docs/assets/js/sidebar.js';
const ci = '/app/docs/assets/i18n/common.i18n.js';
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
  ['site-config 58.21 赋值在位', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.21';" ${sc}`, '1'],
  ['site-config 58.20 赋值零残留(应 0)', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.20';" ${sc}`, '0'],
  ['site-config FC 48.0 赋值在位', `grep -cF "window.FLUIDCANVAS_VERSION = 'v10.28.48.0';" ${sc}`, '1'],
  ['site-config FC 47.4 赋值零残留(应 0)', `grep -cF "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';" ${sc}`, '0'],
  ['changelog 58.21 条目标题在位', `grep -cF '// v0.2.58.21 = ' ${sc}`, '1'],
  ['changelog FC 48.0 条目标题在位', `grep -cF '// v10.28.48.0 = ' ${sc}`, '1'],
  ['changelog 用户原话片断 ×1', `grep -cF '能不能点击左侧用户卡片' ${sc}`, '1'],
  ['changelog 三项钦定 ×2', `grep -cF '三项钦定' ${sc}`, '2'],
  ['changelog 完整信息卡 ×1', `grep -cF '完整信息卡' ${sc}`, '1'],
  ['changelog 打开设置弹窗 ×1', `grep -cF '打开设置弹窗' ${sc}`, '1'],
  ['changelog 不跳页 ×2', `grep -cF '不跳页' ${sc}`, '2'],
  ['changelog stopPropagation ×3', `grep -cF 'stopPropagation' ${sc}`, '3'],
  ['changelog rev 00338-tj5 真值注记 ×1（二次烘焙口径）', `grep -cF 'rev 00338-tj5' ${sc}`, '1'],
  ['changelog rev 00338-XXX 占位零残留(应 0)', `grep -cF 'rev 00338-XXX' ${sc}`, '0'],
  ['changelog rev 00339-??? 终态占位注记 ×1', `grep -cF 'rev 00339-???' ${sc}`, '1'],
  ['changelog 58.19 条目 00334-tz6 保留', `grep -cF 'rev 00334-tz6' ${sc}`, '1'],
  ['changelog 58.19 条目 00335-fmn 保留', `grep -cF 'rev 00335-fmn' ${sc}`, '1'],
  ['changelog 58.20 条目 00336-7gr 保留', `grep -cF 'rev 00336-7gr' ${sc}`, '2'],
  ['changelog 58.20 条目 00337-wxl 保留', `grep -cF 'rev 00337-wxl' ${sc}`, '2'],
  // ── settings-modal.js 58.21 头像/横幅控件件 ──
  ['settings-modal settingsAvatarBtn ×2', `grep -cF 'settingsAvatarBtn' ${sm}`, '2'],
  ['settings-modal settingsAvatarPreview ×2', `grep -cF 'settingsAvatarPreview' ${sm}`, '2'],
  ['settings-modal settingsAvatarLibBtn ×2', `grep -cF 'settingsAvatarLibBtn' ${sm}`, '2'],
  ['settings-modal settingsBannerPreview ×3', `grep -cF 'settingsBannerPreview' ${sm}`, '3'],
  ['settings-modal settingsBannerUploadBtn ×2', `grep -cF 'settingsBannerUploadBtn' ${sm}`, '2'],
  ['settings-modal settingsBannerLibBtn ×2', `grep -cF 'settingsBannerLibBtn' ${sm}`, '2'],
  ['settings-modal settingsBannerRemoveBtn ×4', `grep -cF 'settingsBannerRemoveBtn' ${sm}`, '4'],
  ['settings-modal sub-locked ×3', `grep -cF 'sub-locked' ${sm}`, '3'],
  ['settings-modal function stUpload ×1', `grep -cF 'function stUpload' ${sm}`, '1'],
  ['settings-modal function stRawMergeUser ×1', `grep -cF 'function stRawMergeUser' ${sm}`, '1'],
  ['settings-modal bannerUrl: null ×2（移除语义）', `grep -cF 'bannerUrl: null' ${sm}`, '2'],
  ['settings-modal slati_avatar_sync ×4', `grep -cF 'slati_avatar_sync' ${sm}`, '4'],
  ['settings-modal settingsProfileToast ×2', `grep -cF 'settingsProfileToast' ${sm}`, '2'],
  ['settings-modal function makeToggle ×1（复用）', `grep -cF 'function makeToggle' ${sm}`, '1'],
  ['settings-modal function stApiBase ×1', `grep -cF 'function stApiBase' ${sm}`, '1'],
  ['settings-modal MN_API.patch ×2', `grep -cF 'MN_API.patch' ${sm}`, '2'],
  ['settings-modal window.SlatiSettings 导出 ×1', `grep -cF 'window.SlatiSettings = ' ${sm}`, '1'],
  // ── sidebar.js 58.21 弹窗件 ──
  ['sidebar.js function openUserPop ×1', `grep -cF 'function openUserPop' ${sb}`, '1'],
  ['sidebar.js slati-user-pop-style ×2', `grep -cF 'slati-user-pop-style' ${sb}`, '2'],
  ['sidebar.js preventDefault ×2（代码+注释）', `grep -cF 'preventDefault' ${sb}`, '2'],
  ['sidebar.js e.stopPropagation() ×1', `grep -cF 'e.stopPropagation()' ${sb}`, '1'],
  ['sidebar.js .user-info-bar a ×1', `grep -cF '.user-info-bar a' ${sb}`, '1'],
  ['sidebar.js initUserPopWiring ×2', `grep -cF 'initUserPopWiring' ${sb}`, '2'],
  ['sidebar.js SlatiSettings.open ×3', `grep -cF 'SlatiSettings.open' ${sb}`, '3'],
  ['sidebar.js e.button !== 0 ×1', `grep -cF 'e.button !== 0' ${sb}`, '1'],
  // ── common.i18n 21 新键 ×11 单引号 + zh-Hant 双引号 + 生成标记 ──
  ['i18n sidebar.pop.editProfile ×11', `grep -cF "'sidebar.pop.editProfile'" ${ci}`, '11'],
  ['i18n sidebar.pop.viewProfile ×11', `grep -cF "'sidebar.pop.viewProfile'" ${ci}`, '11'],
  ['i18n sidebar.pop.following ×11', `grep -cF "'sidebar.pop.following'" ${ci}`, '11'],
  ['i18n sidebar.pop.followers ×11', `grep -cF "'sidebar.pop.followers'" ${ci}`, '11'],
  ['i18n sidebar.pop.posts ×11', `grep -cF "'sidebar.pop.posts'" ${ci}`, '11'],
  ['i18n sidebar.pop.joined ×11', `grep -cF "'sidebar.pop.joined'" ${ci}`, '11'],
  ['i18n settings.profile.banner ×11', `grep -cF "'settings.profile.banner'" ${ci}`, '11'],
  ['i18n settings.profile.bannerUpload ×11', `grep -cF "'settings.profile.bannerUpload'" ${ci}`, '11'],
  ['i18n settings.profile.bannerGallery ×11', `grep -cF "'settings.profile.bannerGallery'" ${ci}`, '11'],
  ['i18n settings.profile.bannerRemove ×11', `grep -cF "'settings.profile.bannerRemove'" ${ci}`, '11'],
  ['i18n settings.profile.avatarGallery ×11', `grep -cF "'settings.profile.avatarGallery'" ${ci}`, '11'],
  ['i18n settings.profile.avatarSync ×11', `grep -cF "'settings.profile.avatarSync'" ${ci}`, '11'],
  ['i18n settings.profile.gifUpgrade ×11', `grep -cF "'settings.profile.gifUpgrade'" ${ci}`, '11'],
  ['i18n settings.profile.toast.avatarUpdated ×11', `grep -cF "'settings.profile.toast.avatarUpdated'" ${ci}`, '11'],
  ['i18n settings.profile.toast.bannerUpdated ×11', `grep -cF "'settings.profile.toast.bannerUpdated'" ${ci}`, '11'],
  ['i18n settings.profile.toast.bannerRemoved ×11', `grep -cF "'settings.profile.toast.bannerRemoved'" ${ci}`, '11'],
  ['i18n settings.profile.toast.failed ×11', `grep -cF "'settings.profile.toast.failed'" ${ci}`, '11'],
  ['i18n settings.profile.toast.gifLocked ×11', `grep -cF "'settings.profile.toast.gifLocked'" ${ci}`, '11'],
  ['i18n settings.profile.toast.libLocked ×11', `grep -cF "'settings.profile.toast.libLocked'" ${ci}`, '11'],
  ['i18n settings.profile.toast.imgOnly ×11', `grep -cF "'settings.profile.toast.imgOnly'" ${ci}`, '11'],
  ['i18n settings.profile.toast.imgTooBig10 ×11', `grep -cF "'settings.profile.toast.imgTooBig10'" ${ci}`, '11'],
  ['i18n zh-Hant 自动块 sidebar.pop.editProfile ×1（双引号）', `grep -cF '"sidebar.pop.editProfile"' ${ci}`, '1'],
  ['i18n zh-Hant 自动生成标记 ×1', `grep -cF '__ZH_HANT_AUTO__' ${ci}`, '1'],
  // ── community-profile.html 58.20 头像同步件回归 ──
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
  // ── i18n 58.20 新键回归 ──
  ['i18n prof.edit.avatarSync ×11（手工单引号块）', `grep -cF "'prof.edit.avatarSync'" ${i18n}`, '11'],
  ['i18n prof.edit.avatarSync zh-Hant 自动块 ×1（双引号）', `grep -cF '"prof.edit.avatarSync"' ${i18n}`, '1'],
  ['i18n zh-Hant 自动生成标记 ×1', `grep -cF '__ZH_HANT_AUTO__' ${i18n}`, '1'],
  // ── i18n 58.19 三键回归 ──
  ['i18n prof.toast.gifLocked ×11', `grep -cF "'prof.toast.gifLocked'" ${i18n}`, '11'],
  ['i18n prof.toast.libLocked ×11', `grep -cF "'prof.toast.libLocked'" ${i18n}`, '11'],
  ['i18n prof.edit.gifUpgrade ×11', `grep -cF "'prof.edit.gifUpgrade'" ${i18n}`, '11'],
  // ── fluidcanvas.html 58.20 头像同步件回归 ──
  ['fc-avatar-editable ×6（CSS×2+JS 渲染×2+委托×1+注释×1）', `grep -cF 'fc-avatar-editable' ${fc}`, '6'],
  ['fcAvatarFile ×16 行（3859 行双出现→电池按出现次数 ×18）', `grep -cF 'fcAvatarFile' ${fc}`, '16'],
  ['fcEnsureApi ×2', `grep -cF 'fcEnsureApi' ${fc}`, '2'],
  ['slati_avatar_sync ×1（fcAvatarSyncOn 谓词）', `grep -cF 'slati_avatar_sync' ${fc}`, '1'],
  ['PATCH 体纯度 avatarUrl: data.url ×1', `grep -cF 'avatarUrl: data.url' ${fc}`, '1'],
  ['bio ×2 行（3872 行双出现→电池按出现次数 ×3；均为新段注释）', `grep -cF 'bio' ${fc}`, '2'],
  // ── FC 不互通（钦定：FC 频道主页零 banner 件） ──
  ['fluidcanvas.html bannerUrl 零(应 0)', `grep -cF 'bannerUrl' ${fc}`, '0'],
  ['fluidcanvas.html banner_url 零(应 0)', `grep -cF 'banner_url' ${fc}`, '0'],
  // ── fluidcanvas.i18n.js 六新键 ×12 语回归 ──
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
// 工作树五锚（test/ 不进镜像）：按行数 = 626 同口径
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
