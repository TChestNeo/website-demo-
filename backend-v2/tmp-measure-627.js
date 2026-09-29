// tmp-measure-627.js — 58.21 新锚本地实测（行计数=verify grep -cF 口径 + 出现计数=探针 split 口径）
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = path.dirname(process.argv[1]);
const ROOT = path.join(HERE, '..');
function lines(f) {
  return fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n').split('\n');
}
function measure(label, file, pats) {
  const L = lines(file);
  console.log('── ' + label);
  for (const p of pats) {
    const lc = L.filter((l) => l.indexOf(p) !== -1).length;
    const oc = L.join('\n').split(p).length - 1;
    console.log('  [' + p + '] 行=' + lc + ' 出现=' + oc);
  }
}
measure('settings-modal.js', 'docs/assets/js/settings-modal.js', [
  'settingsAvatarBtn', 'settingsAvatarPreview', 'settingsAvatarLibBtn',
  'settingsBannerPreview', 'settingsBannerUploadBtn', 'settingsBannerLibBtn', 'settingsBannerRemoveBtn',
  'sub-locked', 'function stUpload', 'function stRawMergeUser', 'bannerUrl: null',
  'slati_avatar_sync', 'settingsProfileToast', 'function makeToggle', 'function stApiBase',
  'window.SlatiSettings = ', 'MN_API.patch', 'settingsAvatarGifUpgradeLink', 'settingsBannerGifUpgradeLink'
]);
measure('sidebar.js', 'docs/assets/js/sidebar.js', [
  'function openUserPop', 'slati-user-pop-style', 'preventDefault', 'e.stopPropagation()',
  '.user-info-bar a', 'initUserPopWiring', 'SlatiSettings.open', 'e.button !== 0',
  'function closeUserPop', 'function stEsc', 'openUserPop()'
]);
measure('site-config.js', 'docs/assets/js/site-config.js', [
  "window.MN_SITE_VERSION = 'v0.2.58.21';", "window.MN_SITE_VERSION = 'v0.2.58.20';",
  "window.FLUIDCANVAS_VERSION = 'v10.28.48.0';", "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';",
  '// v0.2.58.21 = ', '// v10.28.48.0 = ',
  '能不能点击左侧用户卡片', '三项钦定', '完整信息卡', '打开设置弹窗', 'stopPropagation', '不跳页',
  'rev 00338-XXX', 'rev 00339-???', 'rev 00334-tz6', 'rev 00335-fmn', 'rev 00336-7gr', 'rev 00337-wxl'
]);
const i18nKeys = [
  'sidebar.pop.editProfile', 'sidebar.pop.viewProfile', 'sidebar.pop.following',
  'sidebar.pop.followers', 'sidebar.pop.posts', 'sidebar.pop.joined',
  'settings.profile.banner', 'settings.profile.bannerUpload', 'settings.profile.bannerGallery',
  'settings.profile.bannerRemove', 'settings.profile.avatarGallery', 'settings.profile.avatarSync',
  'settings.profile.gifUpgrade', 'settings.profile.toast.avatarUpdated', 'settings.profile.toast.bannerUpdated',
  'settings.profile.toast.bannerRemoved', 'settings.profile.toast.failed', 'settings.profile.toast.gifLocked',
  'settings.profile.toast.libLocked', 'settings.profile.toast.imgOnly', 'settings.profile.toast.imgTooBig10'
];
const L = lines('docs/assets/i18n/common.i18n.js');
console.log('── common.i18n.js 21 键（sq=单引号行数 dq=双引号行数 all=出现数）');
for (const k of i18nKeys) {
  const sq = L.filter((l) => l.indexOf("'" + k + "'") !== -1).length;
  const dq = L.filter((l) => l.indexOf('"' + k + '"') !== -1).length;
  const all = L.join('\n').split(k).length - 1;
  console.log('  [' + k + '] sq=' + sq + ' dq=' + dq + ' all=' + all);
}
console.log('  [__ZH_HANT_AUTO__] 行=' + L.filter((l) => l.indexOf('__ZH_HANT_AUTO__') !== -1).length);
