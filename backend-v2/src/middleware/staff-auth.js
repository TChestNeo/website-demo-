'use strict';
// Staff 会话鉴权（D2/D4）：cookie sc_session → staff_sessions → staff 表。
//   requireStaff：仅登录（is_active 停用即拒）
//   requirePerm(perm)：登录 + 每请求现查角色矩阵；拒绝 403 + 审计 denied（§24）
// project_director = 全键（代码层判定，role_permissions 无行，§4）。
// publicStaff()：real_name 结构上永不序列化（§17 硬性要求）。

const crypto = require('node:crypto');
const { HttpError } = require('../http');
const { hashToken, readToken } = require('./auth');
const { auditDenied } = require('../audit');

function authenticateStaff(db, req, res, ctx) {
  const token = readToken(req, ctx.config.staffCookie);
  if (!token) throw new HttpError('UNAUTHORIZED', '未登录');
  const row = db.prepare(`
    SELECT s.* FROM staff_sessions ss JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token_hash = ? AND ss.expires_at > ?
  `).get(hashToken(token), new Date().toISOString());
  if (!row) throw new HttpError('UNAUTHORIZED', '会话已过期');
  if (!row.is_active) throw new HttpError('FORBIDDEN', '账号已停用');
  ctx.staff = row;
  return row;
}

function requireStaff(handler) {
  return (req, res, ctx) => {
    authenticateStaff(ctx.db, req, res, ctx);
    return handler(req, res, ctx);
  };
}

function staffRoles(db, staffId) {
  return db.prepare(`
    SELECT r.id FROM roles r JOIN staff_roles sr ON sr.role_id = r.id WHERE sr.staff_id = ?
  `).all(staffId).map((r) => r.id);
}

// staff 权限清单；project_director 返回 ['*']（全键）
function staffPermissions(db, staffId) {
  const roles = staffRoles(db, staffId);
  if (roles.includes('project_director')) return ['*'];
  if (!roles.length) return [];
  const placeholders = roles.map(() => '?').join(', ');
  return db.prepare(`
    SELECT DISTINCT rp.permission_id AS id FROM role_permissions rp WHERE rp.role_id IN (${placeholders})
  `).all(...roles).map((r) => r.id);
}

// 权限包装器：无权限 → 审计 denied（actor = 已认证 staff）+ 403
function requirePerm(perm) {
  return (handler) => (req, res, ctx) => {
    authenticateStaff(ctx.db, req, res, ctx);
    const perms = staffPermissions(ctx.db, ctx.staff.id);
    if (!perms.includes('*') && !perms.includes(perm)) {
      auditDenied(ctx.db, req, ctx, {
        action: 'perm_denied',
        targetType: 'endpoint',
        targetId: `${req.method} ${(req.url || '/').split('?')[0]}`,
        reason: `缺少权限 ${perm}`
      });
      throw new HttpError('FORBIDDEN', '权限不足');
    }
    return handler(req, res, ctx);
  };
}

// staff 行 → 公开形状（camel；real_name 永不出现）
function publicStaff(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    alias: row.alias,
    position: row.position,
    timezone: row.timezone,
    workingHours: row.working_hours ? JSON.parse(row.working_hours) : null,
    nationality: row.nationality || null,
    languages: row.languages ? JSON.parse(row.languages) : []
  };
}

function createStaffSession(db, staffId, ttlMs, now = new Date()) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO staff_sessions (token_hash, staff_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), staffId, now.toISOString(), new Date(now.getTime() + ttlMs).toISOString());
  return token;
}

function destroyStaffSession(db, token) {
  if (token) db.prepare('DELETE FROM staff_sessions WHERE token_hash = ?').run(hashToken(token));
}

function staffCookie(token, cfg, maxAgeSec) {
  const parts = [`${cfg.staffCookie}=${token}`, 'HttpOnly', 'Path=/', `Max-Age=${maxAgeSec}`, 'SameSite=Lax'];
  if (cfg.nodeEnv === 'production') parts.push('Secure');
  if (cfg.cookieDomain) parts.push(`Domain=${cfg.cookieDomain}`);
  return parts.join('; ');
}

// createStaff（seed 与测试共用）：返回完整 staff 行
const { pad6, insertWithId } = require('../ids');

function createStaff(db, { email, displayName, alias = null, position = '', timezone = 'UTC+8', workingHours = '{"start":"09:00","end":"18:00"}', nationality = null, languages = '["zh"]', realName = null }) {
  const iso = new Date().toISOString();
  const { id } = insertWithId(
    db, 'staff',
    ['email', 'display_name', 'alias', 'position', 'timezone', 'working_hours', 'nationality', 'languages', 'real_name', 'created_at', 'updated_at'],
    [String(email).trim().toLowerCase(), displayName, alias, position, timezone, workingHours, nationality, languages, realName, iso, iso],
    (s) => 'STAFF-' + pad6(s)
  );
  return db.prepare('SELECT * FROM staff WHERE id = ?').get(id);
}

function assignRole(db, staffId, roleId) {
  db.prepare('INSERT OR IGNORE INTO staff_roles (staff_id, role_id) VALUES (?, ?)').run(staffId, roleId);
}

module.exports = {
  authenticateStaff, requireStaff, requirePerm,
  staffRoles, staffPermissions, publicStaff,
  createStaffSession, destroyStaffSession, staffCookie,
  createStaff, assignRole
};
