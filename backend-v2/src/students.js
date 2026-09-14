'use strict';
// 学生认证共享助手（v0.2.44.0）：域名白名单判定 + 用户行学生态形状 + 过期惰性清除。
// 口径：认证有效期 365 天（config.student.ttlMs）；过期不主动清理 cron——读取路径惰性清除
// （同 tier 惰性降级口径）；studentShape 纯函数保证 publicUser/status 各路径输出一致。

// 内置默认 edu 白名单（env STUDENT_EMAIL_DOMAINS 未配时生效；配置后整表替换）。
// 匹配语义 = 标签边界后缀：条目规范成 '.suffix'，域名 === 去点条目 或 以 '.suffix' 结尾
// ——example.com 不会被 '.com' 误配（.com 本就不在表内）、myedu.com 不会被 '.edu' 误配。
const DEFAULT_DOMAINS = ['.edu', '.edu.my', '.ac.my', '.edu.sg', '.edu.au', '.ac.uk', '.edu.cn',
  '.edu.tw', '.edu.hk', '.ac.jp', '.edu.kr', '.edu.in', '.edu.pk', '.edu.bd', '.ac.nz',
  '.edu.ph', '.edu.th', '.edu.vn', '.edu.id'];

// 规范化 env 传入的条目：去首点、小写、非空补回 '.' 前缀；纯 '.'/空条目丢弃。
function normalizeDomains(list) {
  return (list || []).map((s) => String(s).trim().toLowerCase().replace(/^\.+/, ''))
    .filter((s) => s.length > 1)   // 丢弃空与残余 '.'（'edu' 之类裸词允许——后缀可无点）
    .map((s) => '.' + s);
}

function domainAllowed(email, domains) {
  const dom = String(email || '').split('@')[1] || '';
  if (!dom) return false;
  const list = normalizeDomains(domains && domains.length ? domains : DEFAULT_DOMAINS);
  return list.some((e) => dom === e.slice(1) || dom.endsWith(e));
}

// 用户行 → 学生态嵌套对象（四列齐全且未过期才有效；否则 null）。纯函数不落库。
function studentShape(row) {
  if (!row || !row.student_email || !row.student_verified_at || !row.student_expires_at) return null;
  if (row.student_expires_at <= new Date().toISOString()) return null;
  return {
    email: row.student_email,
    verifiedAt: row.student_verified_at,
    expiresAt: row.student_expires_at,
    source: row.student_source || 'email_code'
  };
}

// 过期惰性清除：有学生邮箱但无/已过有效期 → 清四列落库并返回新行；否则原样返回。
function studentRefresh(db, user) {
  if (!user || !user.student_email) return user;
  const now = new Date().toISOString();
  if (!user.student_expires_at || user.student_expires_at <= now) {
    db.prepare('UPDATE users SET student_email = NULL, student_verified_at = NULL, '
      + 'student_expires_at = NULL, student_source = NULL, updated_at = ? WHERE id = ?')
      .run(now, user.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }
  return user;
}

module.exports = { DEFAULT_DOMAINS, normalizeDomains, domainAllowed, studentShape, studentRefresh };
