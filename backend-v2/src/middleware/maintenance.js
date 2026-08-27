'use strict';
// 维护模式（platform_settings maintenance）：开启时公网 API 拒绝 503，
// /api/staff/* 与 /api/health 放行（后台必须能关掉它）。

const { HttpError } = require('../http');

function maintenanceGuard(db) {
  return function (req, res, next) {
    const path = (req.url || '/').split('?')[0];
    if (path.startsWith('/api/staff/') || path === '/api/health') return next();
    try {
      const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'maintenance'").get();
      if (row) {
        const m = JSON.parse(row.value);
        if (m && m.enabled) {
          throw new HttpError('SERVICE_UNAVAILABLE', m.message || '平台维护中，请稍后再来');
        }
      }
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // JSON 解析失败按未开启处理
    }
    return next();
  };
}

module.exports = { maintenanceGuard };
