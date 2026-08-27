'use strict';
// 公网分析事件（加法端点，站点不调也安全）：POST /api/analytics/pageview → page_views（PGV-）。
// D10：country 由 GEOIP_URL 模板（如 https://ipinfo.io/{ip}/json）可选解析——2s 超时、失败跳过（IP 只作信号）。
// 轻限流（防刷流水表）；匿名，无会话。

const { sendJson, HttpError, readJson } = require('../../http');
const { insertWithId, pad6 } = require('../../ids');
const { ipOf } = require('../../middleware/ratelimit');

async function geoCountry(fetchImpl, urlTemplate, ip) {
  if (!urlTemplate) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  try {
    const res = await fetchImpl(urlTemplate.replace('{ip}', ip), { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    return String(j.country || j.country_name || '').slice(0, 64) || null;
  } catch {
    return null; // GEO 失败跳过（D10 可选）
  } finally {
    clearTimeout(timer);
  }
}

function register(router, ctx) {
  const cfg = ctx.config;

  router.add('POST', '/api/analytics/pageview', async (req, res) => {
    const w = (cfg.rateLimits || {}).pageview || { max: 60, windowMs: 60000 };
    if (!ctx.limiter('pv:ip:' + ipOf(req), w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '请求过于频繁');
    const body = await readJson(req, 4096);
    const path = String(body.path || '/').slice(0, 256);
    if (!path.startsWith('/')) throw new HttpError('VALIDATION', 'path 非法');
    const country = await geoCountry(ctx.moderation.fetchImpl, cfg.geoIpUrl, ipOf(req));
    const { id } = insertWithId(ctx.db, 'page_views',
      ['client_id', 'path', 'referer', 'country', 'language', 'device', 'browser', 'os', 'created_at'],
      [String(body.clientId || '').slice(0, 64) || null, path,
        String(body.referer || '').slice(0, 512) || null, country,
        String(body.language || '').slice(0, 16) || null, String(body.device || '').slice(0, 32) || null,
        String(body.browser || '').slice(0, 32) || null, String(body.os || '').slice(0, 32) || null,
        new Date().toISOString()],
      (s) => 'PGV-' + pad6(s));
    sendJson(res, 200, { ok: true, id });
  });
}

module.exports = { register };
