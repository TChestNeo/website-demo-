/**
 * site-config — 站点运行时配置（前后端分离部署时生效）。
 * 本地/同域部署默认空对象：MN_API 走同源 '/api'，行为与历史版本完全一致。
 * 部署到 COS/CDN 时按 deploy/cos-deploy.md 把 apiBase 改为后端绝对地址，例如：
 *   window.MN_SITE = { apiBase: 'https://api.mn.world/api' };
 * 必须在 api.js 之前加载（各页已在 storage.js 之前引入本文件）。
 */
window.MN_SITE = window.MN_SITE || {};

// 站点版本号唯一来源（口径：大版本.小版本.小改动.补丁）——侧栏品牌模块显示
window.MN_SITE_VERSION = 'v0.2.1.1';

// FluidCanvas 自身版本号（FC 独立版本线，口径：大版本.小版本.小更新.补丁；与站点号无关）——FC 首页头部 + 编辑器 badge/ready log 显示
window.FLUIDCANVAS_VERSION = 'v10.28.8.2';
