'use strict';
// 登录历史与本地风险信号（§5 Security + D10）：
//   recordLogin() 写 login_history；风险信号全部本地计算：
//     new_prefix：该 actor 成功登录史中未见此 IP 前两段
//     new_device：该 actor 成功登录史中未见此设备指纹
//     off_hours：UTC 深夜/凌晨登录（无时区数据，仅弱信号）
//   风险映射：≥2 信号 → high，1 个 → medium，0 → low。
//   用户行写回 risk_level/risk_reasons/last_login_at/login_count；
//   高风险/新设备落 security_events。
// IP 只作风险信号、不单独判盗号；GEOIP 为可选增强（country 列，D10，W1 接入）。

const { pad6 } = require('./ids');
const { ipOf } = require('./middleware/ratelimit');

function deviceFingerprint(req) {
  const ua = req.headers['user-agent'] || '';
  const parts = [];
  if (/Android|iPhone|iPad|iPod/i.test(ua)) parts.push('mobile');
  else if (/Windows|Macintosh|Linux/i.test(ua)) parts.push('desktop');
  else parts.push('other');
  if (/Edg\//i.test(ua)) parts.push('edge');
  else if (/Chrome\//i.test(ua)) parts.push('chrome');
  else if (/Firefox\//i.test(ua)) parts.push('firefox');
  else if (/Safari\//i.test(ua)) parts.push('safari');
  else parts.push('other');
  return parts.join('-');
}

function deviceInfo(req) {
  const ua = req.headers['user-agent'] || '';
  return {
    device: /iPad/i.test(ua) ? 'Tablet' : /Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop',
    browser: /Edg\//i.test(ua) ? 'Edge' : /Chrome\//i.test(ua) ? 'Chrome' : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) ? 'Safari' : ua.slice(0, 60),
    os: /Windows/i.test(ua) ? 'Windows' : /Macintosh/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : ''
  };
}

// 本地风险信号（对比该 actor 近 20 条成功登录）
function riskSignals(db, actorType, actorId, ip, device, now) {
  const flags = [];
  const prev = db.prepare(`
    SELECT ip, device FROM login_history
    WHERE actor_type = ? AND actor_id = ? AND result = 'success' AND created_at < ?
    ORDER BY seq DESC LIMIT 20
  `).all(actorType, actorId, now.toISOString());
  const prefixes = new Set();
  const devices = new Set();
  for (const p of prev) {
    const pfx = String(p.ip || '').split('.').slice(0, 2).join('.');
    if (pfx && pfx !== '..') prefixes.add(pfx);
    if (p.device) devices.add(p.device);
  }
  const prefix = String(ip || '').split('.').slice(0, 2).join('.');
  if (prev.length > 0 && prefix && !prefixes.has(prefix)) flags.push('new_prefix');
  if (prev.length > 0 && device && !devices.has(device)) flags.push('new_device');
  if (now.getUTCHours() < 5) flags.push('off_hours');
  return flags;
}

function insertSecurityEvent(db, actorType, actorId, eventType, detail, ip, riskLevel) {
  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO security_events (actor_type, actor_id, event_type, detail, ip, risk_level, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(actorType, actorId, eventType, detail ? JSON.stringify(detail) : null, ip, riskLevel, now);
  const seq = Number(info.lastInsertRowid);
  db.prepare('UPDATE security_events SET id = ? WHERE seq = ?').run('SEC-' + pad6(seq), seq);
}

// 写登录历史（+ 用户行风险回写 + 安全事件）。opts: { actorType, actorId, email, result, sessionId }
function recordLogin(db, req, { actorType, actorId, email, result, sessionId }) {
  const now = new Date();
  const ip = ipOf(req);
  const { device, browser, os } = deviceInfo(req);
  let flags = [];
  let riskLevel = 'low';
  if (result === 'success') {
    flags = riskSignals(db, actorType, actorId, ip, deviceFingerprint(req), now);
    riskLevel = flags.length >= 2 ? 'high' : flags.length === 1 ? 'medium' : 'low';
  }
  const info = db.prepare(`
    INSERT INTO login_history (actor_type, actor_id, email, ip, country, device, browser, os, result, risk_flags, session_id, created_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
  `).run(actorType, actorId, email, ip, device, browser, os, result,
    flags.length ? JSON.stringify(flags) : null, sessionId || null, now.toISOString());
  const seq = Number(info.lastInsertRowid);
  const id = 'LGH-' + pad6(seq);
  db.prepare('UPDATE login_history SET id = ? WHERE seq = ?').run(id, seq);

  if (result === 'success' && actorType === 'user') {
    db.prepare(`
      UPDATE users SET risk_level = ?, risk_reasons = ?, last_login_at = ?, login_count = login_count + 1, updated_at = ?
      WHERE id = ?
    `).run(riskLevel, flags.length ? JSON.stringify(flags) : null, now.toISOString(), now.toISOString(), actorId);
    if (flags.includes('new_device'))
      insertSecurityEvent(db, actorType, actorId, 'new_device', { device: deviceFingerprint(req) }, ip, 'low');
    if (riskLevel === 'high')
      insertSecurityEvent(db, actorType, actorId, 'suspicious_login', { flags }, ip, 'high');
  }
  return { id, riskLevel, flags };
}

module.exports = { deviceFingerprint, deviceInfo, riskSignals, insertSecurityEvent, recordLogin };
