'use strict';
// 系统更新（P9）：客户端版本检查 + 下载分发。
// 版本单一来源：config.appVersions（Cloud Run env 可覆写）。
// 发新版流程：①覆盖 docs/downloads/MNationWorld.apk ②改 APP_VERSION_CODE/NAME ③部署——客户端自动提示更新。
const { sendJson } = require('../../http');

function register(router, ctx) {
  router.add('GET', '/api/app/latest', (req, res) => {
    const v = ctx.config.appVersions || {};
    sendJson(res, 200, {
      android: {
        versionCode: Number(v.androidVersionCode || 1),
        versionName: String(v.androidVersionName || '1.0.0'),
        url: String(v.androidUrl || '/downloads/MNationWorld.apk'),
        sizeMb: Number(v.androidSizeMb || 10.4),
        minSdk: String(v.androidMinSdk || 'Android 7.0+'),
        note: String(v.androidNote || ''),
      },
      ios: {
        status: String(v.iosStatus || 'preparing'), // preparing | testflight | appstore
        note: String(v.iosNote || 'iOS 版正在准备上架'),
        url: String(v.iosUrl || ''),
      },
    });
  });
}

module.exports = { register };
