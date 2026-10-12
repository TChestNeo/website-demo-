// 临时检查：common.i18n.js 21 键落点计数（首链 11 手工块各 1）
'use strict';
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/../docs/assets/i18n/common.i18n.js', 'utf8').replace(/\r\n/g, '\n');
const c = (x) => s.split(x).length - 1;
const keys = [
  'sidebar.pop.editProfile', 'sidebar.pop.viewProfile', 'sidebar.pop.following',
  'sidebar.pop.followers', 'sidebar.pop.posts', 'sidebar.pop.joined',
  'settings.profile.banner', 'settings.profile.bannerUpload', 'settings.profile.bannerGallery',
  'settings.profile.bannerRemove', 'settings.profile.avatarGallery', 'settings.profile.avatarSync',
  'settings.profile.gifUpgrade', 'settings.profile.toast.avatarUpdated', 'settings.profile.toast.bannerUpdated',
  'settings.profile.toast.bannerRemoved', 'settings.profile.toast.failed', 'settings.profile.toast.gifLocked',
  'settings.profile.toast.libLocked', 'settings.profile.toast.imgOnly', 'settings.profile.toast.imgTooBig10',
];
let bad = 0;
for (const k of keys) {
  const n = c("'" + k + "'");
  if (n !== 11) { bad++; console.log('❌', k, n); }
}
console.log(bad === 0 ? '✅ 21 键 × 11 块全部在位' : '❌ ' + bad + ' 键异常');
// 抽查 en 值 = 兜底串
const enBanner = s.indexOf("'settings.profile.banner': 'Banner',") > -1;
const enFailed = s.indexOf("'settings.profile.toast.failed': 'Update failed, please try again later',") > -1;
const enEdit = s.indexOf("'sidebar.pop.editProfile': 'Edit profile',") > -1;
console.log('en 值抽查', enBanner && enFailed && enEdit ? '✅' : '❌');
