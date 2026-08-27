'use strict';
// 密码哈希（W6 密码+邮箱码双因素）：node:crypto 原生 scrypt，零新依赖（node >= 24）。
// 存储格式单列 'hexSalt:hexHash'（16 字节盐 + 64 字节派生）。
// 长度策略（8-72）不在此模块——那是 HTTP 契约，由路由层统一校验。
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
// 参数显式固化（跨 Node 版本结果稳定）；async 版避免 scryptSync 阻塞事件循环
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(String(password), salt, KEYLEN, PARAMS);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

async function verifyPassword(password, stored) {
  try {
    const [saltHex, hashHex] = String(stored || '').split(':');
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    // keylen 取存储串里的哈希长度（未来调参兼容）
    const actual = await scrypt(String(password), salt, expected.length, PARAMS);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false; // 畸形存储串不抛，恒 false
  }
}

module.exports = { hashPassword, verifyPassword };
