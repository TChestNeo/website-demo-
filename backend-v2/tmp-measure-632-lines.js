// tmp-measure-632-lines.js — verify-632 锚按「行计数」（grep -cF 同口径）实测
// 教训：tmp-measure-632.js 用 split 出现计数 ≠ docker grep -cF 行计数（不透明 50 出现/43 行、MN_CropDialog 4/3、avatarCrop 12/8）
'use strict';
const fs = require('fs');
const L = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const lines = (p, n) => L(p).split('\n').filter((l) => l.indexOf(n) !== -1).length;
const sconf = '../docs/assets/js/site-config.js';
const fc = '../docs/pages/fluidcanvas.html';
const fcOv = 'src/routes/public/fc-overview.js';
const serverJs = 'src/server.js';
const fi = '../docs/assets/i18n/fluidcanvas.i18n.js';
const A = (label, p, n) => console.log(label.padEnd(52) + lines(p, n));
console.log('═ site-config');
A("sc 58.26 赋值", sconf, "window.MN_SITE_VERSION = 'v0.2.58.26';");
A("sc 58.25 赋值零残留", sconf, "window.MN_SITE_VERSION = 'v0.2.58.25';");
A("sc FC 48.2 赋值", sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.48.2';");
A("sc FC 48.1 赋值零残留", sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.48.1';");
A("sc changelog 58.26 头", sconf, '// v0.2.58.26 = ');
A("sc changelog FC 48.2 头", sconf, '// v10.28.48.2 = ');
A("sc changelog 58.25 历史", sconf, '// v0.2.58.25 = ');
A("sc changelog FC 48.1 历史", sconf, '// v10.28.48.1 = ');
A("sc rev 00348-XXX", sconf, '00348-XXX');
A("sc rev 00349-???", sconf, '00349-???');
A("sc rev 00347-skv", sconf, '00347-skv');
A("sc rev 00346-rn2", sconf, '00346-rn2');
A("sc rev 00344-ntt", sconf, '00344-ntt');
A("sc rev 00345-vhw", sconf, '00345-vhw');
A("sc rev 00346-XXX 零残留", sconf, '00346-XXX');
A("sc rev 00347-??? 零残留", sconf, '00347-???');
A("sc 词 FC_OVERVIEW", sconf, 'FC_OVERVIEW');
A("sc 词 fc/overview", sconf, 'fc/overview');
A("sc 词 48.2K", sconf, '48.2K');
A("sc 词 不透明", sconf, '不透明');
A("sc 词 假数据", sconf, '假数据');
console.log('═ fluidcanvas');
A("fc var FC_OVERVIEW = null", fc, 'var FC_OVERVIEW = null;');
A("fc function loadFcOverview", fc, 'function loadFcOverview(');
A("fc boot loadFcOverview()", fc, '  loadFcOverview();');
A("fc loadFcOverview(true)", fc, 'loadFcOverview(true)');
A("fc function fcNum", fc, 'function fcNum(');
A("fc function fcCompact", fc, 'function fcCompact(');
A("fc function fcOverviewStats", fc, 'function fcOverviewStats(');
A("fc function fcOverviewWindow", fc, 'function fcOverviewWindow(');
A("fc 48.2", fc, 'v10.28.48.2');
A("fc 48.1 历史", fc, 'v10.28.48.1');
A("fc 48.0 历史", fc, 'v10.28.48.0');
A("fc var SIMULATED_FILES 零", fc, 'var SIMULATED_FILES');
A("fc function simulateFilePick 零", fc, 'function simulateFilePick');
A("fc '48.2K' 可执行零", fc, "'48.2K'");
A("fc slati_demo_article_content 零", fc, 'slati_demo_article_content');
A("fc 不透明 .card 规则", fc, 'body.fc-page .card:not(.profile-header) { background: var(--sidebar-bg); }');
A("fc 不透明 .lg-backdrop 规则", fc, 'body.fc-page .card:not(.profile-header) > .lg-backdrop { filter: none; backdrop-filter: none; }');
A("fc 访客 head 挂类", fc, "document.documentElement.classList.add('fc-guest')");
A("fc fc-locked-hero", fc, 'fc-locked-hero');
A("fc html.fc-guest", fc, 'html.fc-guest');
A("fc 登录引导卡", fc, '登录引导卡');
A("fc /social/uploads?ext=.", fc, "'/social/uploads?ext=.'");
A("fc fileInput.type", fc, 'fileInput.type = ');
A("fc FT noData", fc, "FT('fc.analytics.noData')");
A("fc FT needLogin", fc, "FT('fc.upload.needLogin')");
A("fc fc-ch-avatar-crop(回归)", fc, 'fc-ch-avatar-crop');
A("fc MN_CropDialog(回归)", fc, 'MN_CropDialog');
A("fc avatarCrop(回归)", fc, 'avatarCrop');
A("fc applyCrop(回归)", fc, 'applyCrop');
A("fc bannerUrl 零(回归)", fc, 'bannerUrl');
console.log('═ backend');
A("fcOv '/api/fc/overview'", fcOv, "'/api/fc/overview'");
A("fcOv requireSession", fcOv, 'requireSession');
A("fcOv wordCount", fcOv, 'wordCount');
A("fcOv rateLimit", fcOv, 'rateLimit');
A("serverJs require fc-overview", serverJs, "require('./routes/public/fc-overview')");
A("serverJs registerFcOverview", serverJs, 'registerFcOverview');
console.log('═ i18n');
const KEYS = ['fc.analytics.date', 'fc.analytics.interactions', 'fc.analytics.newArticles',
  'fc.analytics.newFollowers', 'fc.analytics.newPosts', 'fc.analytics.noData', 'fc.analytics.noDataHint',
  'fc.analytics.windowText', 'fc.articles.thisWeek', 'fc.articles.toastPublishInEditor',
  'fc.landing.changeAvatar', 'fc.landing.emptyArticles', 'fc.landing.emptyArticlesHint',
  'fc.landing.emptyMedia', 'fc.landing.emptyMediaHint', 'fc.landing.myStudio', 'fc.landing.recentMedia',
  'fc.landing.untitled', 'fc.metrics.size', 'fc.toast.avatarFailed', 'fc.toast.avatarUpdated',
  'fc.toast.gifLocked', 'fc.toast.imgOnly', 'fc.upload.emptyHint', 'fc.upload.emptyTitle',
  'fc.upload.needLogin', 'fc.upload.statusUploaded', 'fc.upload.toastNoFile', 'fc.upload.toastUploadFail',
  'fc.upload.toastUploaded'];
for (const k of KEYS) A("i18n " + k, fi, '"' + k + '"');
A("i18n __ZH_HANT_AUTO__", fi, '__ZH_HANT_AUTO__');
