// 临时计数：v0.2.58.21 两新电池静态锚实测（写锚前行）
'use strict';
const fs = require('fs');
const read = (p) => fs.readFileSync(__dirname + '/../' + p, 'utf8').replace(/\r\n/g, '\n');
const cnt = (s, t) => s.split(t).length - 1;

const sidebar = read('docs/assets/js/sidebar.js');
const settings = read('docs/assets/js/settings-modal.js');
const i18n = read('docs/assets/i18n/common.i18n.js');
const sc = read('docs/assets/js/site-config.js');

const out = [];
const m = (label, v) => out.push(label + ' = ' + v);

m('sidebar openUserPop', cnt(sidebar, 'openUserPop'));
m('sidebar function openUserPop', cnt(sidebar, 'function openUserPop'));
m('sidebar closeUserPop', cnt(sidebar, 'closeUserPop'));
m('sidebar slati-user-pop-style', cnt(sidebar, 'slati-user-pop-style'));
m('sidebar ensureUserPopStyle', cnt(sidebar, 'ensureUserPopStyle'));
m('sidebar initUserPopWiring', cnt(sidebar, 'initUserPopWiring'));
m('sidebar preventDefault', cnt(sidebar, 'preventDefault'));
m('sidebar user-info-bar a', cnt(sidebar, '.user-info-bar a'));
m('sidebar SlatiSettings.open', cnt(sidebar, 'SlatiSettings.open'));
m('sidebar e.button !== 0', cnt(sidebar, 'e.button !== 0'));

m('settings settingsAvatarBtn', cnt(settings, 'settingsAvatarBtn'));
m('settings settingsAvatarPreview', cnt(settings, 'settingsAvatarPreview'));
m('settings settingsAvatarLibBtn', cnt(settings, 'settingsAvatarLibBtn'));
m('settings settingsBannerPreview', cnt(settings, 'settingsBannerPreview'));
m('settings settingsBannerUploadBtn', cnt(settings, 'settingsBannerUploadBtn'));
m('settings settingsBannerLibBtn', cnt(settings, 'settingsBannerLibBtn'));
m('settings settingsBannerRemoveBtn', cnt(settings, 'settingsBannerRemoveBtn'));
m('settings settingsAvatarFile', cnt(settings, 'settingsAvatarFile'));
m('settings settingsBannerFile', cnt(settings, 'settingsBannerFile'));
m('settings settingsAvatarGifUpgradeLink', cnt(settings, 'settingsAvatarGifUpgradeLink'));
m('settings settingsBannerGifUpgradeLink', cnt(settings, 'settingsBannerGifUpgradeLink'));
m('settings sub-locked', cnt(settings, 'sub-locked'));
m('settings stUpload', cnt(settings, 'stUpload'));
m('settings stPickFromLibrary', cnt(settings, 'stPickFromLibrary'));
m('settings stRawMergeUser', cnt(settings, 'stRawMergeUser'));
m('settings bannerUrl: null', cnt(settings, 'bannerUrl: null'));
m('settings slati_avatar_sync', cnt(settings, 'slati_avatar_sync'));
m('settings settingsProfileToast', cnt(settings, 'settingsProfileToast'));
m('settings settings-lib-pop', cnt(settings, 'settings-lib-pop'));

m('i18n sidebar.pop.editProfile sq', cnt(i18n, "'sidebar.pop.editProfile'"));
m('i18n settings.profile.banner sq', cnt(i18n, "'settings.profile.banner'"));
m('i18n sidebar.pop.editProfile dq', cnt(i18n, '"sidebar.pop.editProfile"'));
m('i18n settings.profile.banner dq', cnt(i18n, '"settings.profile.banner"'));
m('i18n __ZH_HANT_AUTO__', cnt(i18n, '__ZH_HANT_AUTO__'));

m('sc 58.21', cnt(sc, "window.MN_SITE_VERSION = 'v0.2.58.21'"));
m('sc 58.20 assign', cnt(sc, "window.MN_SITE_VERSION = 'v0.2.58.20'"));
m('sc 00338-', cnt(sc, '00338-'));
m('sc 00339-', cnt(sc, '00339-'));
m('sc cl title 58.21', cnt(sc, '// v0.2.58.21 = '));
m('sc cl title 58.20', cnt(sc, '// v0.2.58.20 = '));
m('sc 48.0', cnt(sc, "window.FLUIDCANVAS_VERSION = 'v10.28.48.0'"));

console.log(out.join('\n'));
