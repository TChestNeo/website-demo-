// tmp-verify-632.js — v0.2.58.26 FC 首页真数据+不透明卡片镜像内容验证（两次构建各验一次、先验后推）
//   新件：site-config 58.26 赋值 ×1/58.25 赋值零残留/FC 48.2 赋值 ×1/48.1 赋值零残留/双 changelog 头/rev 00348-XXX+00349-??? 各 ×2
//   （二次烘焙口径：deploy#1 实得 rev 已填入 changelog——'00348-xxx' 真值 ×2+'00348-XXX' 零残留；00349-??? 仍占位 ×2，deploy#2 后工作树再填终值）；
//   fluidcanvas FC_OVERVIEW 数据层（null 声明/loadFcOverview/boot 调用/true 刷新 ×2/fcNum/fcCompact/fcOverviewStats/fcOverviewWindow）/
//   假数据可执行体零残留（var SIMULATED_FILES/function simulateFilePick/'48.2K'/slati_demo_article_content/bannerUrl）/不透明 CSS 两规则/
//   访客门禁（head 挂 fc-guest/fc-locked-hero/登录引导卡）/上传链（/social/uploads?ext=. ×2/fileInput.type）/i18n 30 新键 DQ×12 各；
//   后端 fc-overview.js（'/api/fc/overview' ×1/requireSession ×3/wordCount ×3/rateLimit ×1）+ server.js（require ×1/register ×2）；
//   回归件保留（58.25 crop：fc-ch-avatar-crop ×4/MN_CropDialog ×4/avatarCrop ×12/applyCrop ×2；site-config 58.25/58.24/58.23 词）；
//   （docker run sh -c 读 /app；grep -cF 按行计；计数全部=tmp-measure-632.js 实测口径）
//   测试文件锚 test/ 被 dockerignore 排除不进镜像——改查本地工作树（npm test 366/366 全绿已跑）。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const cmds = [
  // ══ site-config 58.26 新件 ══
  ["sc 58.26 赋值 ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.26'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 58.25 赋值零残留 ×0", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.25'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc FC 48.2 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.48.2'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FC 48.1 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.48.1'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc changelog 58.26 头 ×1", `grep -cF '// v0.2.58.26 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog FC 48.2 头 ×1", `grep -cF '// v10.28.48.2 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.25 历史 ×1", `grep -cF '// v0.2.58.25 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog FC 48.1 历史 ×1", `grep -cF '// v10.28.48.1 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00348-t8b ×2", `grep -cF 'rev 00348-t8b' /app/docs/assets/js/site-config.js`, "2"],
  ["sc rev 00348-XXX 零残留 ×0", `grep -cF '00348-XXX' /app/docs/assets/js/site-config.js`, "0"],
  ["sc rev 00349-??? ×2", `grep -cF '00349-???' /app/docs/assets/js/site-config.js`, "2"],
  ["sc rev 00347-skv(历史) ×2", `grep -cF '00347-skv' /app/docs/assets/js/site-config.js`, "2"],
  ["sc rev 00346-rn2(历史) ×2", `grep -cF '00346-rn2' /app/docs/assets/js/site-config.js`, "2"],
  ["sc rev 00344-ntt(历史) ×1", `grep -cF '00344-ntt' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00345-vhw(历史) ×1", `grep -cF '00345-vhw' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00346-XXX 零残留 ×0", `grep -cF '00346-XXX' /app/docs/assets/js/site-config.js`, "0"],
  ["sc rev 00347-??? 零残留 ×0", `grep -cF '00347-???' /app/docs/assets/js/site-config.js`, "0"],
  ["sc 词 FC_OVERVIEW ×3", `grep -cF 'FC_OVERVIEW' /app/docs/assets/js/site-config.js`, "3"],
  ["sc 词 fc/overview ×2", `grep -cF 'fc/overview' /app/docs/assets/js/site-config.js`, "2"],
  ["sc 词 48.2K ×2", `grep -cF '48.2K' /app/docs/assets/js/site-config.js`, "2"],
  ["sc 词 不透明 ×43", `grep -cF '不透明' /app/docs/assets/js/site-config.js`, "43"],
  ["sc 词 假数据 ×18", `grep -cF '假数据' /app/docs/assets/js/site-config.js`, "18"],
  // ══ fluidcanvas.html 58.26 新件 ══
  ["fc var FC_OVERVIEW = null ×1", `grep -cF 'var FC_OVERVIEW = null;' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc function loadFcOverview ×1", `grep -cF 'function loadFcOverview(' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc boot loadFcOverview() ×1", `grep -cF '  loadFcOverview();' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc loadFcOverview(true) ×2", `grep -cF 'loadFcOverview(true)' /app/docs/pages/fluidcanvas.html`, "2"],
  ["fc function fcNum ×1", `grep -cF 'function fcNum(' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc function fcCompact ×1", `grep -cF 'function fcCompact(' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc function fcOverviewStats ×1", `grep -cF 'function fcOverviewStats(' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc function fcOverviewWindow ×1", `grep -cF 'function fcOverviewWindow(' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc 48.2 注释 ×3", `grep -cF 'v10.28.48.2' /app/docs/pages/fluidcanvas.html`, "3"],
  ["fc 48.1 注释历史 ×4", `grep -cF 'v10.28.48.1' /app/docs/pages/fluidcanvas.html`, "4"],
  ["fc 48.0 注释历史 ×2", `grep -cF 'v10.28.48.0' /app/docs/pages/fluidcanvas.html`, "2"],
  ["fc 假数据可执行体零残留：var SIMULATED_FILES", `grep -cF 'var SIMULATED_FILES' /app/docs/pages/fluidcanvas.html`, "0"],
  ["fc 假数据可执行体零残留：function simulateFilePick", `grep -cF 'function simulateFilePick' /app/docs/pages/fluidcanvas.html`, "0"],
  ["fc 假数据可执行体零残留：'48.2K'", `grep -cF ''\\''48.2K'\\''' /app/docs/pages/fluidcanvas.html`, "0"],
  ["fc 假数据零残留：slati_demo_article_content", `grep -cF 'slati_demo_article_content' /app/docs/pages/fluidcanvas.html`, "0"],
  ["fc 不透明 .card 规则 ×1", `grep -cF 'body.fc-page .card:not(.profile-header) { background: var(--sidebar-bg); }' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc 不透明 .lg-backdrop 规则 ×1", `grep -cF 'body.fc-page .card:not(.profile-header) > .lg-backdrop { filter: none; backdrop-filter: none; }' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc 访客 head 挂类 ×1", `grep -cF 'document.documentElement.classList.add('\\''fc-guest'\\'')' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc fc-locked-hero ×3", `grep -cF 'fc-locked-hero' /app/docs/pages/fluidcanvas.html`, "3"],
  ["fc html.fc-guest ×6", `grep -cF 'html.fc-guest' /app/docs/pages/fluidcanvas.html`, "6"],
  ["fc 词 登录引导卡 ×3", `grep -cF '登录引导卡' /app/docs/pages/fluidcanvas.html`, "3"],
  ["fc 上传链 /social/uploads?ext=. ×2", `grep -cF ''\\''/social/uploads?ext=.'\\''' /app/docs/pages/fluidcanvas.html`, "2"],
  ["fc 上传链 fileInput.type ×1", `grep -cF 'fileInput.type = ' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc FT fc.analytics.noData ×1", `grep -cF 'FT('\\''fc.analytics.noData'\\'')' /app/docs/pages/fluidcanvas.html`, "1"],
  ["fc FT fc.upload.needLogin ×1", `grep -cF 'FT('\\''fc.upload.needLogin'\\'')' /app/docs/pages/fluidcanvas.html`, "1"],
  // ══ fluidcanvas 58.25 回归（crop 件）══
  ["fc fc-ch-avatar-crop(回归) ×4", `grep -cF 'fc-ch-avatar-crop' /app/docs/pages/fluidcanvas.html`, "4"],
  ["fc MN_CropDialog(回归) ×3", `grep -cF 'MN_CropDialog' /app/docs/pages/fluidcanvas.html`, "3"],
  ["fc avatarCrop(回归) ×8", `grep -cF 'avatarCrop' /app/docs/pages/fluidcanvas.html`, "8"],
  ["fc applyCrop(回归) ×2", `grep -cF 'applyCrop' /app/docs/pages/fluidcanvas.html`, "2"],
  ["fc bannerUrl 零(回归) ×0", `grep -cF 'bannerUrl' /app/docs/pages/fluidcanvas.html`, "0"],
  // ══ 后端 fc-overview ══
  ["fcOv '/api/fc/overview' ×1", `grep -cF ''\\''/api/fc/overview'\\''' /app/src/routes/public/fc-overview.js`, "1"],
  ["fcOv requireSession ×3", `grep -cF 'requireSession' /app/src/routes/public/fc-overview.js`, "3"],
  ["fcOv wordCount ×3", `grep -cF 'wordCount' /app/src/routes/public/fc-overview.js`, "3"],
  ["fcOv rateLimit ×1", `grep -cF 'rateLimit' /app/src/routes/public/fc-overview.js`, "1"],
  ["server require fc-overview ×1", `grep -cF 'require('\\''./routes/public/fc-overview'\\'')' /app/src/server.js`, "1"],
  ["server registerFcOverview ×2", `grep -cF 'registerFcOverview' /app/src/server.js`, "2"],
  // ══ i18n 30 新键 DQ×12 各 ══
  ["i18n fc.analytics.date ×12", `grep -cF '"fc.analytics.date"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.analytics.interactions ×12", `grep -cF '"fc.analytics.interactions"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.analytics.newArticles ×12", `grep -cF '"fc.analytics.newArticles"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.analytics.newFollowers ×12", `grep -cF '"fc.analytics.newFollowers"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.analytics.newPosts ×12", `grep -cF '"fc.analytics.newPosts"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.analytics.noData ×12", `grep -cF '"fc.analytics.noData"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.analytics.noDataHint ×12", `grep -cF '"fc.analytics.noDataHint"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.analytics.windowText ×12", `grep -cF '"fc.analytics.windowText"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.articles.thisWeek ×12", `grep -cF '"fc.articles.thisWeek"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.articles.toastPublishInEditor ×12", `grep -cF '"fc.articles.toastPublishInEditor"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.landing.changeAvatar ×12", `grep -cF '"fc.landing.changeAvatar"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.landing.emptyArticles ×12", `grep -cF '"fc.landing.emptyArticles"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.landing.emptyArticlesHint ×12", `grep -cF '"fc.landing.emptyArticlesHint"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.landing.emptyMedia ×12", `grep -cF '"fc.landing.emptyMedia"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.landing.emptyMediaHint ×12", `grep -cF '"fc.landing.emptyMediaHint"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.landing.myStudio ×12", `grep -cF '"fc.landing.myStudio"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.landing.recentMedia ×12", `grep -cF '"fc.landing.recentMedia"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.landing.untitled ×12", `grep -cF '"fc.landing.untitled"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.metrics.size ×12", `grep -cF '"fc.metrics.size"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.toast.avatarFailed ×12", `grep -cF '"fc.toast.avatarFailed"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.toast.avatarUpdated ×12", `grep -cF '"fc.toast.avatarUpdated"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.toast.gifLocked ×12", `grep -cF '"fc.toast.gifLocked"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.toast.imgOnly ×12", `grep -cF '"fc.toast.imgOnly"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.upload.emptyHint ×12", `grep -cF '"fc.upload.emptyHint"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.upload.emptyTitle ×12", `grep -cF '"fc.upload.emptyTitle"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.upload.needLogin ×12", `grep -cF '"fc.upload.needLogin"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.upload.statusUploaded ×12", `grep -cF '"fc.upload.statusUploaded"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.upload.toastNoFile ×12", `grep -cF '"fc.upload.toastNoFile"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.upload.toastUploadFail ×12", `grep -cF '"fc.upload.toastUploadFail"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.upload.toastUploaded ×12", `grep -cF '"fc.upload.toastUploaded"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc __ZH_HANT_AUTO__ ×2", `grep -cF '__ZH_HANT_AUTO__' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "2"],
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
// 工作树锚（test/ 不进镜像）：按行数
const wt = [
  ["test fc-overview 案标题", "test/fc-overview.test.js", "fc-overview：", "5"],
  ["test fc-overview GET 路由", "test/fc-overview.test.js", "GET /api/fc/overview", "1"],
  ["test health 030 注释(回归)", "test/health.test.js", "030_user_crop", "1"],
  ["test health 029 注释(回归)", "test/health.test.js", "029_user_banner", "0"],
  ["test migrations 030 案标题(回归)", "test/migrations.test.js", "030", "14"],
  ["test migrations 029 案标题(回归)", "test/migrations.test.js", "029", "9"],
  ["test notifications 030 注释(回归)", "test/notifications.test.js", "030", "1"],
  ["test notifications 030_user_crop 零", "test/notifications.test.js", "030_user_crop", "0"],
];
for (const [label, f, pat, want] of wt) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8').replace(/\r\n/g, '\n');
  const out = String(s.split('\n').filter((l) => l.indexOf(pat) !== -1).length);
  if (out !== want) { console.log(`❌ [${label}] got=${out} want=${want}`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
