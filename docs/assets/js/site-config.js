/**
 * site-config — 站点运行时配置（前后端分离部署时生效）。
 * 本地/同域部署默认空对象：MN_API 走同源 '/api'，行为与历史版本完全一致。
 * 部署到 COS/CDN 时按 deploy/cos-deploy.md 把 apiBase 改为后端绝对地址，例如：
 *   window.MN_SITE = { apiBase: 'https://api.mn.world/api' };
 * 必须在 api.js 之前加载（各页已在 storage.js 之前引入本文件）。
 */
window.MN_SITE = window.MN_SITE || {};
