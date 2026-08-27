'use strict';
// 审计助手（§25 + D12 哈希链）：
//   audit() 追加一行 audit_log；hash = sha256(prev_hash ‖ canonical_row_json)
//   canonical_row_json = 固定字段序数组 JSON（确定性，无键排序歧义）
//   append-only 由 003 触发器兜底；verifyChain() 整链重算校验
// 调用约定：所有 /api/staff/* 状态变更与敏感读、stripe webhook（actor=stripe）、cron、
//   公网关键变更（PATCH /auth/me、账号删除、tier 惰性降级）必须 audit()。
//   权限拒绝尝试由 requirePerm → auditDenied() 记录 result='denied'（§24）。
// AI 永不以任何主体调用本模块的写路径（§29：AI 无认证主体、无直接管理权）。

const crypto = require('node:crypto');
const { pad6 } = require('./ids');
const { ipOf } = require('./middleware/ratelimit');

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// 稳定 JSON：对象键深排序（prev/next 序列化确定性，财报审计重放依赖）
function canonical(v) {
  if (v === undefined || v === null) return null;
  const seen = new WeakSet();
  const sort = (x) => {
    if (x === null || typeof x !== 'object') return x;
    if (seen.has(x)) return '[circular]';
    seen.add(x);
    if (Array.isArray(x)) return x.map(sort);
    const out = {};
    for (const k of Object.keys(x).sort()) out[k] = sort(x[k]);
    return out;
  };
  return JSON.stringify(sort(v));
}

// 追加审计行。req 可为 null（cron/无请求上下文）；ctx.staff 存在时 actor 默认取之。
function audit(db, req, ctx, opts) {
  const actorType = opts.actorType || 'staff';
  let actorId = opts.actorId;
  if (!actorId) {
    if (ctx && ctx.staff) actorId = ctx.staff.id;
    else if (ctx && ctx.user && opts.actorType === 'system') actorId = ctx.user.id;
    else actorId = 'system';
  }
  const created = opts.createdAt || new Date().toISOString();
  const row = {
    actor_type: actorType,
    actor_id: actorId,
    action: opts.action,
    target_type: opts.targetType || null,
    target_id: opts.targetId || null,
    prev_value: canonical(opts.prev),
    new_value: canonical(opts.next),
    reason: opts.reason || null,
    ip: opts.ip !== undefined ? opts.ip : (req ? ipOf(req) : ''),
    result: opts.result || 'success',
    created_at: created
  };
  const prev = db.prepare('SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1').get();
  const prevHash = prev ? prev.hash : null;
  const rowJson = JSON.stringify([
    row.actor_type, row.actor_id, row.action, row.target_type, row.target_id,
    row.prev_value, row.new_value, row.reason, row.ip, row.result, row.created_at
  ]);
  const hash = sha256((prevHash || '') + rowJson);
  const info = db.prepare(`
    INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id,
      prev_value, new_value, reason, ip, result, created_at, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.actor_type, row.actor_id, row.action, row.target_type, row.target_id,
    row.prev_value, row.new_value, row.reason, row.ip, row.result, row.created_at,
    prevHash, hash
  );
  const seq = Number(info.lastInsertRowid);
  const id = 'AUD-' + pad6(seq);
  db.prepare('UPDATE audit_log SET id = ? WHERE seq = ?').run(id, seq);
  return { seq, id, hash };
}

// 权限拒绝审计（requirePerm 403 时调用）：actor = 已认证但缺权限的 staff
function auditDenied(db, req, ctx, opts) {
  return audit(db, req, ctx, { ...opts, result: 'denied' });
}

// 整链校验：按 seq 重算 hash，返回 { ok, count } 或 { ok:false, brokenAt, expected, actual }
function verifyChain(db) {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY seq ASC').all();
  let prev = null;
  for (const r of rows) {
    const rowJson = JSON.stringify([
      r.actor_type, r.actor_id, r.action, r.target_type, r.target_id,
      r.prev_value, r.new_value, r.reason, r.ip, r.result, r.created_at
    ]);
    const expect = sha256((prev || '') + rowJson);
    if (expect !== r.hash) return { ok: false, brokenAt: r.seq, expected: expect, actual: r.hash };
    prev = r.hash;
  }
  return { ok: true, count: rows.length };
}

module.exports = { canonical, audit, auditDenied, verifyChain };
