'use strict';
// 数据权限掩码（§28，纯函数，序列化层应用）。
// capabilities(roles) → { fullIp, partialIp, payments, internal, dm, director }
//   普通客服（仅 customer_support 且无扩权角色）：
//     基础档案 ✅ 订阅状态 ✅ 完整 IP 🟡(前两段+近10条) 支付数据 ❌ 内部数据 ❌ 私信 ❌
//   security/finance/management/director 按角色扩大（见 capabilities）。
// 调用方先解析一次 capabilities，序列化时逐行应用掩码函数。

function capabilities(roles) {
  const has = (r) => roles.includes(r);
  if (has('project_director'))
    return { fullIp: true, partialIp: false, payments: true, internal: true, dm: true, director: true };
  return {
    fullIp: has('security') || has('management'),
    partialIp: has('customer_support'),
    payments: has('finance') || has('management'),
    internal: has('moderation') || has('security') || has('technical') || has('management'),
    dm: has('security') || has('management'),
    director: false
  };
}

// IP 掩码：完整 / 前两段 + *.* / 隐藏（null）
function maskIp(c, ip) {
  if (!ip) return ip;
  if (c.fullIp) return ip;
  if (c.partialIp) {
    const parts = String(ip).split('.');
    if (parts.length === 4) return parts[0] + '.' + parts[1] + '.*.*';
    return String(ip).slice(0, Math.max(2, Math.floor(String(ip).length / 3))) + '…';
  }
  return null;
}

// 用户档案掩码（§4/§28）：risk_reasons 等内部字段仅 internal；riskLevel 永见（安全标记）
function maskUserRow(c, u) {
  const base = {
    id: u.id,
    displayName: u.display_name,
    email: u.email,
    citizenId: u.citizen_id,
    avatarUrl: u.avatar_url,
    language: u.language,
    country: u.country,
    bio: u.bio,
    tier: u.tier,
    tierExpiresAt: u.tier_expires_at,
    status: u.status,
    createdAt: u.created_at,
    lastActiveAt: u.last_active_at,
    lastLoginAt: u.last_login_at,
    riskLevel: u.risk_level
  };
  if (c.internal) {
    base.riskReasons = u.risk_reasons ? JSON.parse(u.risk_reasons) : [];
    base.warningCount = u.warning_count;
    base.mutedUntil = u.muted_until;
    base.dob = u.dob;
  }
  return base;
}

// 登录历史掩码：partialIp（无 fullIp）→ 仅近 10 条 + IP 前两段；无任何 IP 权限 → ip=null
// 调用方一律按 created_at DESC（最新在前）传行——slice(0,10) 取最新 10 条
// （曾误写 slice(-10) 取最旧 10 条，把客服眼前的最新登录藏掉了；W0 mask.test 断言
//   只断 '175.143.*.*'，掩码抹掉了区分度，方向错误全绿漏过——顺序断言要看 seq 而不是掩码后的 ip）
function maskLoginHistory(c, rows) {
  let out = rows;
  if (c.partialIp && !c.fullIp) out = rows.slice(0, 10);
  return out.map((r) => ({ ...r, ip: maskIp(c, r.ip) }));
}

// 支付数据：无 payments 能力 → null（调用方据此隐藏区块，而非空数组）
function maskPayments(c, payments) {
  return c.payments ? payments : null;
}

module.exports = { capabilities, maskIp, maskUserRow, maskLoginHistory, maskPayments };
