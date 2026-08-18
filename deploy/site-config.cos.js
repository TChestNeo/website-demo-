/**
 * site-config — COS/CDN 部署覆盖版（deploy/cos-deploy.md 步骤 5 使用）。
 * 仓库内 docs/assets/js/site-config.js 保持空对象（本地/同域开发零配置）；
 * 上传 COS 时用本文件覆盖 assets/js/site-config.js，apiBase 指向后端子域。
 * 把 api.<你的域名> 换成真实 API 域名后覆盖上传，勿提交真实域名到仓库。
 */
window.MN_SITE = { apiBase: 'https://api.<你的域名>/api' };
