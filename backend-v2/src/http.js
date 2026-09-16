'use strict';
// HTTP 工具：JSON 读写、统一错误形状 {"error":{"code","message"}}。

const CODES = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  ACCOUNT_BANNED: 403,
  RESTRICTED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYMENTS_DISABLED: 409,
  STUDENT_EMAIL_DOMAIN: 400,  // 学生认证邮箱域名不在白名单（前端显示人工审核指引）
  STUDENT_REQUIRED: 403,      // checkout 学生旗但认证缺失/已过期（前端走重新认证弹窗）
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503
};

class HttpError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.status = CODES[code] || 500;
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, err) {
  if (err instanceof HttpError) {
    return sendJson(res, err.status, { error: { code: err.code, message: err.message } });
  }
  console.error(err); // 未知错误打日志，不向客户端泄露细节
  sendJson(res, 500, { error: { code: 'INTERNAL', message: 'Internal server error' } });
}

// 读取并解析 JSON 请求体；空体返回 {}；超限/坏 JSON 抛 VALIDATION
async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError('VALIDATION', '请求体过大');
    chunks.push(c);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError('VALIDATION', 'JSON 解析失败');
  }
}

// 读取原始请求体字节（Stripe webhook 验签需要未经解析的原文）；超限抛 VALIDATION
async function readRaw(req, limit = 512 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError('VALIDATION', '请求体过大');
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// 二进制版 readRaw（v0.2.16.0 帖子媒体上传）：返回 Buffer 原字节，空体返回空 Buffer（调用方自查长度）
async function readRawBuffer(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError('VALIDATION', '请求体过大');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

module.exports = { CODES, HttpError, sendJson, sendError, readJson, readRaw, readRawBuffer };
