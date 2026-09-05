'use strict';
// 腾讯云 IMS 图片审核（国际站 ap-singapore）：TC3-HMAC-SHA256 签名自实现（crypto 内置，零依赖，~80 行）。
// 判定映射：Suggestion Pass → approve / Block → reject / Review → needs_human。
// 安全默认：未配置密钥 / 5xx / 网络错误 / 超时 → needs_human（图像不先发后审，默认不上线标人工）。
// 媒体格式：https URL → FileUrl；data: URL → FileContent(base64) + FileType；
//   /uploads/ 本站路径（v0.2.16.0）→ 从 uploadDir 读文件转 base64 FileContent（腾讯无法访问站内相对路径）；>10MB 直接 needs_human。

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SERVICE = 'ims';
const VERSION = '2020-12-29';
const ACTION = 'ImageModeration';
const HOST = 'ims.tencentcloudapi.com';
const MAX_BYTES = 10 * 1024 * 1024; // IMS base64 上限 10MB

function hmac(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}
function sha256Hex(msg) {
  return crypto.createHash('sha256').update(msg).digest('hex');
}

// TC3-HMAC-SHA256：签名 v3 标准四步（见腾讯云 API 文档「签名方法 v3」）
function tc3Headers(secretId, secretKey, region, payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalRequest = [
    'POST', '/', '',
    `content-type:application/json; charset=utf-8\nhost:${HOST}\nx-tc-action:${ACTION.toLowerCase()}\n`,
    'content-type;host;x-tc-action',
    sha256Hex(payload)
  ].join('\n');
  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256', String(timestamp), credentialScope, sha256Hex(canonicalRequest)
  ].join('\n');
  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, SERVICE);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');
  return {
    Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`,
    'Content-Type': 'application/json; charset=utf-8',
    Host: HOST,
    'X-TC-Action': ACTION,
    'X-TC-Version': VERSION,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Region': region
  };
}

const FILE_TYPE = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', gif: 'gif', webp: 'webp' };

function buildPayload(mediaUrl, uploadDir) {
  if (typeof mediaUrl !== 'string' || !mediaUrl) throw new Error('空媒体地址');
  if (/^https?:\/\//i.test(mediaUrl)) return { FileUrl: mediaUrl };
  if (/^\/uploads\//i.test(mediaUrl)) {
    // v0.2.16.0：本站上传文件——basename 天然防穿越，读盘转 base64 送 IMS
    const name = path.basename(mediaUrl);
    const ext = path.extname(name).slice(1).toLowerCase();
    if (!FILE_TYPE[ext]) throw new Error('IMS 只审图片附件');
    const buf = fs.readFileSync(path.join(uploadDir || '/mnt/data/uploads', name));
    if (buf.length > MAX_BYTES) throw new Error('图片超过 10MB');
    return { FileContent: buf.toString('base64'), FileType: FILE_TYPE[ext] };
  }
  const m = mediaUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!m) throw new Error('仅支持 http(s) URL、/uploads/ 本站文件或 data: base64');
  if (m[2].length * 3 / 4 > MAX_BYTES) throw new Error('图片超过 10MB');
  return { FileContent: m[2], FileType: m[1].split('/')[1] || 'png' };
}

// mediaUrl: https URL 或 data: base64。
// 返回 { verdict: 'approve'|'reject'|'needs_human', reasonCode, labels, raw }
async function moderateImage(cfg, mediaUrl, fetchImpl = global.fetch) {
  const t = (cfg.tencent || {});
  if (!t.secretId || !t.secretKey) {
    return { verdict: 'needs_human', reasonCode: 'unconfigured', labels: [], raw: null };
  }
  let payload;
  try {
    payload = buildPayload(mediaUrl, cfg.uploadDir);
  } catch (err) {
    return { verdict: 'needs_human', reasonCode: err.message, labels: [], raw: null };
  }
  const body = JSON.stringify(payload);
  try {
    const res = await fetchImpl(`https://${HOST}`, {
      method: 'POST',
      headers: tc3Headers(t.secretId, t.secretKey, t.imsRegion || 'ap-singapore', body),
      body,
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const resp = (data && data.Response) || {};
    const suggestion = String(resp.Suggestion || '');
    const labels = [resp.Label, resp.SubLabel].filter(Boolean);
    if (suggestion === 'Pass') return { verdict: 'approve', reasonCode: 'pass', labels, raw: resp };
    if (suggestion === 'Block') return { verdict: 'reject', reasonCode: 'ims_block', labels, raw: resp };
    return { verdict: 'needs_human', reasonCode: 'ims_review', labels, raw: resp };
  } catch (err) {
    // 5xx/网络/超时 → 默认不上线标人工（安全默认）
    return { verdict: 'needs_human', reasonCode: `ims_error:${err.message}`.slice(0, 60), labels: [], raw: null };
  }
}

module.exports = { moderateImage, tc3Headers, buildPayload, HOST, ACTION, VERSION };
