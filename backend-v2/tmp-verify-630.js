// tmp-verify-630.js — v0.2.58.24 社区页演示样本全移除镜像内容验证（两次构建各验一次、先验后推）
//   新件：hub 页 23 项（18 恰 1/4 恰 2/loginCta 恰 3）+ 演示零残留 16 锚全 0；hub i18n 11 新键各 SQ×11+DQ×1
//   +删键族 5 全 0+hub.emptyFeed 保留 ×12+__ZH_HANT_AUTO__ ×1；site-config 58.24 赋值 ×1+58.23 赋值零残留+
//   58.24 changelog 头 ×1+58.23 历史条目保留+rev 00344-XXX/00345-??? 占位 ×1 各+00343-gxb 真值 ×1+00343-??? 零残留+
//   新词锚（社区页演示样本全移除 ×1/三 tab 全接真数据 ×2/假频道 ×1）；后端三路由 '/api/social/posts' ×2、
//   '/api/social/feed' ×1、'/api/social/topics' ×2；
//   回归件保留：58.23 预取块 16 锚、58.22 全部（白名单 12/设置弹窗/资料页/i18n 8 键）、58.18-58.21 全部、
//   58.16/58.17 activity/following 各 1；
//   （docker run sh -c 读 /app；grep -cF 按行计；计数全部=本文件写入前实测口径——hub 锚 grep -cF 与电池 split 一致）
//   测试文件五锚 test/ 被 dockerignore 排除不进镜像——改查本地工作树（npm test 359/359 已跑，后端零改动不重跑）。
//   二次烘焙口径：deploy#1 后工作树填真 rev → 本文件 'rev 00344-XXX' 锚改真值 'rev 00344-<真>' 并加 00344-XXX 零残留锚。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mig = '/app/migrations/029_user_banner.sql';
const au = '/app/src/routes/public/auth.js';
const so = '/app/src/routes/public/social.js';
const sc = '/app/docs/assets/js/site-config.js';
const tr = '/app/docs/assets/js/transitions.js';
const sm = '/app/docs/assets/js/settings-modal.js';
const sb = '/app/docs/assets/js/sidebar.js';
const ci = '/app/docs/assets/i18n/common.i18n.js';
const page = '/app/docs/pages/community-profile.html';
const i18n = '/app/docs/assets/i18n/community-profile.i18n.js';
const fol = '/app/docs/pages/following.html';
const act = '/app/docs/pages/activity.html';
const fc = '/app/docs/pages/fluidcanvas.html';
const fci = '/app/docs/assets/i18n/fluidcanvas.i18n.js';
const hub = '/app/docs/pages/community-hub.html';
const hubi = '/app/docs/assets/i18n/community-hub.i18n.js';
const HERE = __dirname;
const cmds = [
  // ── hub 页 58.24 新件锚（18 项恰 1——grep -cF 按行计实测） ──
  ['hub function isHubAuthed ×1', `grep -cF 'function isHubAuthed' ${hub}`, '1'],
  ['hub cloudMode = isHubAuthed() ×1', `grep -cF 'cloudMode = isHubAuthed()' ${hub}`, '1'],
  ['hub id="hubLoginCard" ×1', `grep -cF 'id="hubLoginCard"' ${hub}`, '1'],
  ['hub id="hubOfflineCard" ×1', `grep -cF 'id="hubOfflineCard"' ${hub}`, '1'],
  ['hub function hubOfflineCardHtml ×1', `grep -cF 'function hubOfflineCardHtml' ${hub}`, '1'],
  ['hub mn:unauthorized 监听 ×1', `grep -cF "addEventListener('mn:unauthorized'" ${hub}`, '1'],
  ['hub GET /social/posts ×1', `grep -cF "MN_API.get('/social/posts'" ${hub}`, '1'],
  ['hub GET /social/feed ×1', `grep -cF "MN_API.get('/social/feed'" ${hub}`, '1'],
  ['hub GET /social/topics ×1', `grep -cF "MN_API.get('/social/topics'" ${hub}`, '1'],
  ['hub create-topic-step-1.html ×1', `grep -cF 'create-topic-step-1.html' ${hub}`, '1'],
  ['hub T(hub.emptyFeed) ×1', `grep -cF "T('hub.emptyFeed')" ${hub}`, '1'],
  ['hub T(hub.topic.members) ×1', `grep -cF "T('hub.topic.members')" ${hub}`, '1'],
  ['hub T(hub.discovery.channelsEmpty) ×1', `grep -cF "T('hub.discovery.channelsEmpty')" ${hub}`, '1'],
  ['hub T(hub.feedEmptyFollowing) ×1', `grep -cF "T('hub.feedEmptyFollowing')" ${hub}`, '1'],
  ['hub T(hub.feedEmptyTopic) ×1', `grep -cF "T('hub.feedEmptyTopic')" ${hub}`, '1'],
  ['hub T(hub.offline) ×1', `grep -cF "T('hub.offline')" ${hub}`, '1'],
  ['hub function topicCardHtml ×1', `grep -cF 'function topicCardHtml' ${hub}`, '1'],
  ['hub function feedEmptyHtml ×1', `grep -cF 'function feedEmptyHtml' ${hub}`, '1'],
  // ── hub 页 4 项恰 2 + loginCta 恰 3 ──
  ['hub T(hub.discovery.guest) ×2', `grep -cF "T('hub.discovery.guest')" ${hub}`, '2'],
  ['hub T(hub.discovery.emptyTopics) ×2', `grep -cF "T('hub.discovery.emptyTopics')" ${hub}`, '2'],
  ['hub hubLoginCardHtml ×2', `grep -cF 'hubLoginCardHtml' ${hub}`, '2'],
  ['hub hubOfflineCardHtml ×2', `grep -cF 'hubOfflineCardHtml' ${hub}`, '2'],
  ['hub T(hub.loginCta.) ×3', `grep -cF "T('hub.loginCta." ${hub}`, '3'],
  // ── hub 页演示零残留 16 锚全 0 ──
  ['hub var feedData 零(应 0)', `grep -cF 'var feedData' ${hub}`, '0'],
  ['hub Marcus Vane 零(应 0)', `grep -cF 'Marcus Vane' ${hub}`, '0'],
  ['hub Sovereign Council 零(应 0)', `grep -cF 'Sovereign Council' ${hub}`, '0'],
  ['hub Cartography Guild 零(应 0)', `grep -cF 'Cartography Guild' ${hub}`, '0'],
  ['hub Neural Architects 零(应 0)', `grep -cF 'Neural Architects' ${hub}`, '0'],
  ['hub SlatiDB.getTopics 零(应 0)', `grep -cF 'SlatiDB.getTopics' ${hub}`, '0'],
  ['hub data-guest- 零(应 0)', `grep -cF 'data-guest-' ${hub}`, '0'],
  ['hub hub.toast.likeLogin 零(应 0)', `grep -cF 'hub.toast.likeLogin' ${hub}`, '0'],
  ['hub hub.toast.repostLogin 零(应 0)', `grep -cF 'hub.toast.repostLogin' ${hub}`, '0'],
  ['hub hub.toast.favLogin 零(应 0)', `grep -cF 'hub.toast.favLogin' ${hub}`, '0'],
  ['hub hub.share.communityTitle 零(应 0)', `grep -cF 'hub.share.communityTitle' ${hub}`, '0'],
  ['hub communityHub.feed. 零(应 0)', `grep -cF 'communityHub.feed.' ${hub}`, '0'],
  ['hub badgeKey 零(应 0)', `grep -cF 'badgeKey' ${hub}`, '0'],
  ['hub timeKey 零(应 0)', `grep -cF 'timeKey' ${hub}`, '0'],
  ['hub titleKey 零(应 0)', `grep -cF 'titleKey' ${hub}`, '0'],
  ['hub descKey 零(应 0)', `grep -cF 'descKey' ${hub}`, '0'],
  // ── hub i18n 58.24：删键族 5 全 0 + hub.emptyFeed 保留 ×12 ──
  ['hub i18n communityHub.feed. 零(应 0)', `grep -cF 'communityHub.feed.' ${hubi}`, '0'],
  ['hub i18n hub.toast.likeLogin 零(应 0)', `grep -cF 'hub.toast.likeLogin' ${hubi}`, '0'],
  ['hub i18n hub.toast.repostLogin 零(应 0)', `grep -cF 'hub.toast.repostLogin' ${hubi}`, '0'],
  ['hub i18n hub.toast.favLogin 零(应 0)', `grep -cF 'hub.toast.favLogin' ${hubi}`, '0'],
  ['hub i18n hub.share.communityTitle 零(应 0)', `grep -cF 'hub.share.communityTitle' ${hubi}`, '0'],
  ['hub i18n hub.emptyFeed ×12', `grep -cF 'hub.emptyFeed' ${hubi}`, '12'],
  // ── hub i18n 11 新键各 ×11 单引号 + ×1 zh-Hant 双引号 ──
  ['hub i18n hub.loginCta.title ×11', `grep -cF "'hub.loginCta.title'" ${hubi}`, '11'],
  ['hub i18n hub.loginCta.desc ×11', `grep -cF "'hub.loginCta.desc'" ${hubi}`, '11'],
  ['hub i18n hub.loginCta.btn ×11', `grep -cF "'hub.loginCta.btn'" ${hubi}`, '11'],
  ['hub i18n hub.offline ×11', `grep -cF "'hub.offline'" ${hubi}`, '11'],
  ['hub i18n hub.feedEmptyFollowing ×11', `grep -cF "'hub.feedEmptyFollowing'" ${hubi}`, '11'],
  ['hub i18n hub.feedEmptyTopic ×11', `grep -cF "'hub.feedEmptyTopic'" ${hubi}`, '11'],
  ['hub i18n hub.feedEmptyTopicCta ×11', `grep -cF "'hub.feedEmptyTopicCta'" ${hubi}`, '11'],
  ['hub i18n hub.discovery.guest ×11', `grep -cF "'hub.discovery.guest'" ${hubi}`, '11'],
  ['hub i18n hub.discovery.emptyTopics ×11', `grep -cF "'hub.discovery.emptyTopics'" ${hubi}`, '11'],
  ['hub i18n hub.discovery.channelsEmpty ×11', `grep -cF "'hub.discovery.channelsEmpty'" ${hubi}`, '11'],
  ['hub i18n hub.topic.members ×11', `grep -cF "'hub.topic.members'" ${hubi}`, '11'],
  ['hub i18n zh-Hant 自动块 hub.offline ×1（双引号）', `grep -cF '"hub.offline"' ${hubi}`, '1'],
  ['hub i18n zh-Hant 自动块 hub.topic.members ×1（双引号）', `grep -cF '"hub.topic.members"' ${hubi}`, '1'],
  ['hub i18n zh-Hant 自动生成标记 ×1', `grep -cF '__ZH_HANT_AUTO__' ${hubi}`, '1'],
  // ── 后端三路由（hub 三 tab 数据源） ──
  ['social.js /api/social/posts 路由 ×2（GET+POST）', `grep -cF "'/api/social/posts'" ${so}`, '2'],
  ['social.js /api/social/feed 路由 ×1', `grep -cF "'/api/social/feed'" ${so}`, '1'],
  ['social.js /api/social/topics 路由 ×2（GET+POST）', `grep -cF "'/api/social/topics'" ${so}`, '2'],
  // ── transitions.js 58.23 预取块件（回归保留） ──
  ['transitions.js l.rel = prefetch ×1', `grep -cF "l.rel = 'prefetch'" ${tr}`, '1'],
  ['transitions.js l.as = document ×1', `grep -cF "l.as = 'document'" ${tr}`, '1'],
  ['transitions.js function prefetchPage ×1', `grep -cF 'function prefetchPage' ${tr}`, '1'],
  ['transitions.js prefetchDone ×2', `grep -cF 'prefetchDone' ${tr}`, '2'],
  ['transitions.js clearTimeout(prefetchTimer) ×2', `grep -cF 'clearTimeout(prefetchTimer)' ${tr}`, '2'],
  ['transitions.js prefetchTimer ×4', `grep -cF 'prefetchTimer' ${tr}`, '4'],
  ['transitions.js (hover: hover) ×1', `grep -cF '(hover: hover)' ${tr}`, '1'],
  ['transitions.js saveData ×1', `grep -cF 'saveData' ${tr}`, '1'],
  ['transitions.js ", 65)" ×1', `grep -cF ', 65)' ${tr}`, '1'],
  ['transitions.js { once: true } ×1', `grep -cF '{ once: true }' ${tr}`, '1'],
  ['transitions.js mouseover 监听 ×1', `grep -cF "addEventListener('mouseover'" ${tr}`, '1'],
  ['transitions.js click 劫持监听保留 ×1', `grep -cF "addEventListener('click'" ${tr}`, '1'],
  ['transitions.js STAGGER_DELAY = 60 ×1', `grep -cF 'STAGGER_DELAY = 60' ${tr}`, '1'],
  ['transitions.js LIGHT_STAGGER_DELAY = 40 ×1', `grep -cF 'LIGHT_STAGGER_DELAY = 40' ${tr}`, '1'],
  ['transitions.js STAGGER_CAP = 8 ×1', `grep -cF 'STAGGER_CAP = 8' ${tr}`, '1'],
  // ── 后端 58.22 白名单六键（auth.js+social.js 同款数组=12 锚） ──
  ['auth.js CARD_BG_KEYS solid-black ×1', `grep -cF "'solid-black'" ${au}`, '1'],
  ['auth.js CARD_BG_KEYS solid-white ×1', `grep -cF "'solid-white'" ${au}`, '1'],
  ['auth.js CARD_BG_KEYS solid-gray ×1', `grep -cF "'solid-gray'" ${au}`, '1'],
  ['auth.js CARD_BG_KEYS mono-bw ×1', `grep -cF "'mono-bw'" ${au}`, '1'],
  ['auth.js CARD_BG_KEYS mono-silver ×1', `grep -cF "'mono-silver'" ${au}`, '1'],
  ['auth.js CARD_BG_KEYS mono-charcoal ×1', `grep -cF "'mono-charcoal'" ${au}`, '1'],
  ['social.js CARD_BG_KEYS solid-black ×1', `grep -cF "'solid-black'" ${so}`, '1'],
  ['social.js CARD_BG_KEYS solid-white ×1', `grep -cF "'solid-white'" ${so}`, '1'],
  ['social.js CARD_BG_KEYS solid-gray ×1', `grep -cF "'solid-gray'" ${so}`, '1'],
  ['social.js CARD_BG_KEYS mono-bw ×1', `grep -cF "'mono-bw'" ${so}`, '1'],
  ['social.js CARD_BG_KEYS mono-silver ×1', `grep -cF "'mono-silver'" ${so}`, '1'],
  ['social.js CARD_BG_KEYS mono-charcoal ×1', `grep -cF "'mono-charcoal'" ${so}`, '1'],
  // ── 后端 58.18 锚回归 ──
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
  ['site-config 58.24 赋值在位', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.24';" ${sc}`, '1'],
  ['site-config 58.23 赋值零残留(应 0)', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.23';" ${sc}`, '0'],
  ['site-config FC 48.0 赋值在位', `grep -cF "window.FLUIDCANVAS_VERSION = 'v10.28.48.0';" ${sc}`, '1'],
  ['site-config FC 47.4 赋值零残留(应 0)', `grep -cF "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';" ${sc}`, '0'],
  ['changelog 58.24 条目标题在位', `grep -cF '// v0.2.58.24 = ' ${sc}`, '1'],
  ['changelog 58.23 条目标题保留（历史条目）', `grep -cF '// v0.2.58.23 = ' ${sc}`, '1'],
  ['changelog 58.22 条目标题保留（历史条目）', `grep -cF '// v0.2.58.22 = ' ${sc}`, '1'],
  ['changelog FC 48.0 条目标题在位', `grep -cF '// v10.28.48.0 = ' ${sc}`, '1'],
  ['changelog 58.24 新词 社区页演示样本全移除 ×1', `grep -cF '社区页演示样本全移除' ${sc}`, '1'],
  ['changelog 58.24 新词 三 tab 全接真数据 ×2', `grep -cF '三 tab 全接真数据' ${sc}`, '2'],
  ['changelog 58.24 新词 假频道 ×1', `grep -cF '假频道' ${sc}`, '1'],
  ['changelog 58.23 词 预先加载 ×1', `grep -cF '预先加载' ${sc}`, '1'],
  ['changelog 58.23 词 悬停预加载 ×2', `grep -cF '悬停预加载' ${sc}`, '2'],
  ['changelog 58.23 词 rel="prefetch" ×1', `grep -cF 'rel="prefetch"' ${sc}`, '1'],
  ['changelog 58.23 词 多页应用 ×1', `grep -cF '多页应用' ${sc}`, '1'],
  ['changelog 58.23 词 单页应用长串 ×1', `grep -cF '是单页应用（壳常驻内容 JS 换' ${sc}`, '1'],
  ['changelog rev 00344-ntt 真值 ×1', `grep -cF 'rev 00344-ntt' ${sc}`, '1'],
  ['changelog rev 00344-XXX 占位零残留(应 0)', `grep -cF 'rev 00344-XXX' ${sc}`, '0'],
  ['changelog rev 00345-??? 终态占位注记 ×1', `grep -cF 'rev 00345-???' ${sc}`, '1'],
  ['changelog rev 00343-gxb 真值 ×1（58.23 条）', `grep -cF 'rev 00343-gxb' ${sc}`, '1'],
  ['changelog rev 00343-??? 占位零残留(应 0)', `grep -cF 'rev 00343-???' ${sc}`, '0'],
  ['changelog rev 00342-zsw 真值 ×1（58.23 条）', `grep -cF 'rev 00342-zsw' ${sc}`, '1'],
  ['changelog 58.22 条目 00340-wgj 保留', `grep -cF 'rev 00340-wgj' ${sc}`, '1'],
  ['changelog 58.22 条目 00341-hbw 保留', `grep -cF 'rev 00341-hbw' ${sc}`, '1'],
  ['changelog 58.21 条目 00338-tj5 保留', `grep -cF 'rev 00338-tj5' ${sc}`, '1'],
  ['changelog 58.21 条目 00339-m4j 保留', `grep -cF 'rev 00339-m4j' ${sc}`, '1'],
  ['changelog 58.19 条目 00334-tz6 保留', `grep -cF 'rev 00334-tz6' ${sc}`, '1'],
  ['changelog 58.19 条目 00335-fmn 保留', `grep -cF 'rev 00335-fmn' ${sc}`, '1'],
  ['changelog 58.20 条目 00336-7gr 保留', `grep -cF 'rev 00336-7gr' ${sc}`, '2'],
  ['changelog 58.20 条目 00337-wxl 保留', `grep -cF 'rev 00337-wxl' ${sc}`, '2'],
  // ── settings-modal.js 58.22 新件 ──
  ['settings-modal settingsBgGrid ×2', `grep -cF 'settingsBgGrid' ${sm}`, '2'],
  ['settings-modal settings-bg-grid ×2', `grep -cF 'settings-bg-grid' ${sm}`, '2'],
  ['settings-modal settings-bg-swatch ×6', `grep -cF 'settings-bg-swatch' ${sm}`, '6'],
  ['settings-modal var ST_BG_DEFS ×1', `grep -cF 'var ST_BG_DEFS' ${sm}`, '1'],
  ['settings-modal var ST_BG_KEYS ×1', `grep -cF 'var ST_BG_KEYS' ${sm}`, '1'],
  ['settings-modal function stCanGif ×1', `grep -cF 'function stCanGif' ${sm}`, '1'],
  ['settings-modal function stCanImg ×1', `grep -cF 'function stCanImg' ${sm}`, '1'],
  ['settings-modal gold-lock-group ×5', `grep -cF 'gold-lock-group' ${sm}`, '5'],
  ['settings-modal gold-locked ×2', `grep -cF 'gold-locked' ${sm}`, '2'],
  ['settings-modal goldShimmer ×3', `grep -cF 'goldShimmer' ${sm}`, '3'],
  ['settings-modal mono-bw ×3', `grep -cF 'mono-bw' ${sm}`, '3'],
  ['settings-modal bg-default ×2', `grep -cF 'bg-default' ${sm}`, '2'],
  ['settings-modal bannerColor 引用 ×1', `grep -cF 'settings.profile.bannerColor' ${sm}`, '1'],
  ['settings-modal imgUpgrade 引用 ×1', `grep -cF 'settings.profile.imgUpgrade' ${sm}`, '1'],
  ['settings-modal premGifUpgrade 引用 ×1', `grep -cF 'settings.profile.premGifUpgrade' ${sm}`, '1'],
  ['settings-modal toast.bannerLocked 引用 ×1', `grep -cF 'settings.profile.toast.bannerLocked' ${sm}`, '1'],
  ['settings-modal toast.bgUpdated 引用 ×1', `grep -cF 'settings.profile.toast.bgUpdated' ${sm}`, '1'],
  ['settings-modal 弹窗 width: 400px ×1', `grep -cF 'width: 400px' ${sm}`, '1'],
  ['settings-modal 网格 repeat(4, 1fr) ×1', `grep -cF 'repeat(4, 1fr)' ${sm}`, '1'],
  ['settings-modal max-width calc 防溢出 ×1', `grep -cF 'max-width: calc(100% - 32px)' ${sm}`, '1'],
  ['settings-modal .settings-lib-pop ×1', `grep -cF '.settings-lib-pop' ${sm}`, '1'],
  // ── settings-modal.js 58.21 回归件 ──
  ['settings-modal settingsAvatarBtn ×2', `grep -cF 'settingsAvatarBtn' ${sm}`, '2'],
  ['settings-modal settingsAvatarPreview ×2', `grep -cF 'settingsAvatarPreview' ${sm}`, '2'],
  ['settings-modal settingsAvatarLibBtn ×2', `grep -cF 'settingsAvatarLibBtn' ${sm}`, '2'],
  ['settings-modal settingsBannerPreview ×4', `grep -cF 'settingsBannerPreview' ${sm}`, '4'],
  ['settings-modal settingsBannerUploadBtn ×2', `grep -cF 'settingsBannerUploadBtn' ${sm}`, '2'],
  ['settings-modal settingsBannerLibBtn ×2', `grep -cF 'settingsBannerLibBtn' ${sm}`, '2'],
  ['settings-modal settingsBannerRemoveBtn ×4', `grep -cF 'settingsBannerRemoveBtn' ${sm}`, '4'],
  ['settings-modal settingsBannerGifUpgradeLink ×4', `grep -cF 'settingsBannerGifUpgradeLink' ${sm}`, '4'],
  ['settings-modal sub-locked ×4', `grep -cF 'sub-locked' ${sm}`, '4'],
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
  // ── common.i18n 58.22 五新键 ×11 单引号 + zh-Hant 双引号 ──
  ['i18n settings.profile.bannerColor ×11', `grep -cF "'settings.profile.bannerColor'" ${ci}`, '11'],
  ['i18n settings.profile.imgUpgrade ×11', `grep -cF "'settings.profile.imgUpgrade'" ${ci}`, '11'],
  ['i18n settings.profile.premGifUpgrade ×11', `grep -cF "'settings.profile.premGifUpgrade'" ${ci}`, '11'],
  ['i18n settings.profile.toast.bannerLocked ×11', `grep -cF "'settings.profile.toast.bannerLocked'" ${ci}`, '11'],
  ['i18n settings.profile.toast.bgUpdated ×11', `grep -cF "'settings.profile.toast.bgUpdated'" ${ci}`, '11'],
  ['i18n zh-Hant 自动块 bannerColor ×1（双引号）', `grep -cF '"settings.profile.bannerColor"' ${ci}`, '1'],
  ['i18n zh-Hant 自动生成标记 ×1', `grep -cF '__ZH_HANT_AUTO__' ${ci}`, '1'],
  // ── common.i18n 58.21 21 键回归 ──
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
  // ── community-profile.html 58.22 新件 ──
  ['页面 gold-lock-group ×4', `grep -cF 'gold-lock-group' ${page}`, '4'],
  ['页面 gold-locked ×3', `grep -cF 'gold-locked' ${page}`, '3'],
  ['页面 goldShimmer ×3', `grep -cF 'goldShimmer' ${page}`, '3'],
  ['页面 canGif ×7', `grep -cF 'canGif' ${page}`, '7'],
  ['页面 canGif 谓词行 ×1', `grep -cF 'canGif = sub' ${page}`, '1'],
  ['页面 prof.toast.bannerLocked ×2（双保险门+文案）', `grep -cF 'prof.toast.bannerLocked' ${page}`, '2'],
  ['页面 prof.edit.imgUpgrade ×1', `grep -cF 'prof.edit.imgUpgrade' ${page}`, '1'],
  ['页面 prof.edit.premGifUpgrade ×2（双行文案）', `grep -cF 'prof.edit.premGifUpgrade' ${page}`, '2'],
  ['页面 FC 图库弹窗 680px ×1', `grep -cF "maxWidth = '680px'" ${page}`, '1'],
  ['页面 缩略图 height: 80px ×1', `grep -cF 'height: 80px' ${page}`, '1'],
  ['页面 mono-charcoal ×3（键+CSS+DEFS）', `grep -cF 'mono-charcoal' ${page}`, '3'],
  ['页面 .solid-black CSS ×1', `grep -cF '.solid-black' ${page}`, '1'],
  ['页面 var CARD_BG_KEYS ×1', `grep -cF 'var CARD_BG_KEYS' ${page}`, '1'],
  ['页面 var CARD_BG_DEFS ×1', `grep -cF 'var CARD_BG_DEFS' ${page}`, '1'],
  ['页面 预设网格 data-bg ×1', `grep -cF 'data-bg=' ${page}`, '1'],
  ['页面 保存 diff cardBg ×1', `grep -cF 'editCardBg !== (u.cardBg || null)' ${page}`, '1'],
  // ── community-profile.html 58.18-58.21 回归件 ──
  ['页面 editAvatarSyncToggle ×4', `grep -cF 'editAvatarSyncToggle' ${page}`, '4'],
  ['页面 slati_avatar_sync ×2', `grep -cF 'slati_avatar_sync' ${page}`, '2'],
  ['页面 sub-locked ×4（渲染 ×3+CSS ×1）', `grep -cF 'sub-locked' ${page}`, '4'],
  ['页面 function blockGif ×1', `grep -cF 'function blockGif' ${page}`, '1'],
  ['页面 id avatarGifUpgradeLink ×1', `grep -cF 'avatarGifUpgradeLink' ${page}`, '1'],
  ['页面 id bannerGifUpgradeLink ×2', `grep -cF 'bannerGifUpgradeLink' ${page}`, '2'],
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
  // ── community-profile.i18n 58.22 三新键 ──
  ['i18n prof.toast.bannerLocked ×11（手工单引号块）', `grep -cF "'prof.toast.bannerLocked'" ${i18n}`, '11'],
  ['i18n prof.edit.imgUpgrade ×11（手工单引号块）', `grep -cF "'prof.edit.imgUpgrade'" ${i18n}`, '11'],
  ['i18n prof.edit.premGifUpgrade ×11（手工单引号块）', `grep -cF "'prof.edit.premGifUpgrade'" ${i18n}`, '11'],
  ['i18n prof.toast.bannerLocked zh-Hant 自动块 ×1（双引号）', `grep -cF '"prof.toast.bannerLocked"' ${i18n}`, '1'],
  ['i18n zh-Hant 自动生成标记 ×1', `grep -cF '__ZH_HANT_AUTO__' ${i18n}`, '1'],
  // ── i18n 58.19/58.20 键回归 ──
  ['i18n prof.edit.avatarSync ×11', `grep -cF "'prof.edit.avatarSync'" ${i18n}`, '11'],
  ['i18n prof.edit.avatarSync zh-Hant 自动块 ×1（双引号）', `grep -cF '"prof.edit.avatarSync"' ${i18n}`, '1'],
  ['i18n prof.toast.gifLocked ×11', `grep -cF "'prof.toast.gifLocked'" ${i18n}`, '11'],
  ['i18n prof.toast.libLocked ×11', `grep -cF "'prof.toast.libLocked'" ${i18n}`, '11'],
  ['i18n prof.edit.gifUpgrade ×11', `grep -cF "'prof.edit.gifUpgrade'" ${i18n}`, '11'],
  // ── fluidcanvas.html 58.20 头像同步件回归 ──
  ['fc-avatar-editable ×6', `grep -cF 'fc-avatar-editable' ${fc}`, '6'],
  ['fcAvatarFile ×16 行', `grep -cF 'fcAvatarFile' ${fc}`, '16'],
  ['fcEnsureApi ×2', `grep -cF 'fcEnsureApi' ${fc}`, '2'],
  ['slati_avatar_sync ×1（fcAvatarSyncOn 谓词）', `grep -cF 'slati_avatar_sync' ${fc}`, '1'],
  ['PATCH 体纯度 avatarUrl: data.url ×1', `grep -cF 'avatarUrl: data.url' ${fc}`, '1'],
  ['bio ×2 行', `grep -cF 'bio' ${fc}`, '2'],
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
// 工作树五锚（test/ 不进镜像）：按行数 = 628 同口径
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
