'use strict';
// 插件商店（站点 v0.2.59.0）：列表 / 详情（含版本历史）/ 我的安装 / 安装 / 卸载。
// 订阅门槛：TIER_RANK[user.tier] >= TIER_RANK[plugin.min_tier]；「下放订阅等级」= 官方改 plugins.min_tier（后续 staff 端点）。
const { HttpError, sendJson } = require('../../http');
const { requireSession } = require('../../middleware/auth');

const TIER_RANK = { free: 0, basic: 1, premium: 2, ultra: 3 };

function shape(row) {
  return {
    id: row.id,
    name: row.name,
    authorId: row.author_id,
    authorName: row.author_name,
    description: row.description,
    icon: row.icon,
    preview: row.preview,
    category: row.category,
    minTier: row.min_tier,
    installCount: row.install_count,
    usageCount: row.usage_count,
    version: row.version || null,
    github: row.github || null,
    authorAvatar: row.author_avatar || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function register(router, ctx) {
  const db = ctx.db;

  // 我的安装（必须先于 /:id 注册——/me 会被 :id 正则吃掉）
  router.add('GET', '/api/plugins/me', requireSession((req, res, c) => {
    const rows = db.prepare('SELECT plugin_id FROM plugin_installs WHERE user_id = ?').all(c.user.id);
    sendJson(res, 200, { installed: rows.map((r) => r.plugin_id) });
  }));

  // 商店列表（已上架；?q= 搜索名字/简介，?category= 分类）
  router.add('GET', '/api/plugins', (req, res) => {
    const q = String(req.query.q || '').trim();
    const cat = String(req.query.category || '').trim();
    let sql = `SELECT p.*, (SELECT v.version FROM plugin_versions v WHERE v.plugin_id = p.id ORDER BY v.created_at DESC LIMIT 1) AS version
      FROM plugins p WHERE p.status = 'approved'`;
    const args = [];
    if (q) { sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; args.push('%' + q + '%', '%' + q + '%'); }
    if (cat) { sql += ' AND p.category = ?'; args.push(cat); }
    sql += ' ORDER BY p.install_count DESC, p.updated_at DESC';
    sendJson(res, 200, { plugins: db.prepare(sql).all(...args).map(shape) });
  });

  // 插件详情（含版本历史）
  router.add('GET', '/api/plugins/:id', (req, res) => {
    const p = db.prepare("SELECT * FROM plugins WHERE id = ? AND status = 'approved'").get(req.params.id);
    if (!p) throw new HttpError('NOT_FOUND', '插件不存在');
    const versions = db.prepare('SELECT version, changelog, created_at FROM plugin_versions WHERE plugin_id = ? ORDER BY created_at DESC').all(p.id);
    sendJson(res, 200, {
      plugin: shape(p),
      versions: versions.map((v) => ({ version: v.version, changelog: v.changelog, createdAt: v.created_at })),
    });
  });

  // 安装（订阅门槛；幂等）
  router.add('POST', '/api/plugins/:id/install', requireSession((req, res, c) => {
    const p = db.prepare('SELECT * FROM plugins WHERE id = ?').get(req.params.id);
    if (!p || p.status !== 'approved') throw new HttpError('NOT_FOUND', '插件不存在');
    if (TIER_RANK[c.user.tier] < TIER_RANK[p.min_tier]) {
      throw new HttpError('FORBIDDEN', 'PLUGIN_TIER_LOCKED');
    }
    const iso = new Date().toISOString();
    const existing = db.prepare('SELECT 1 FROM plugin_installs WHERE user_id = ? AND plugin_id = ?').get(c.user.id, p.id);
    if (!existing) {
      db.transaction(() => {
        db.prepare('INSERT INTO plugin_installs (user_id, plugin_id, enabled, installed_at) VALUES (?, ?, 1, ?)').run(c.user.id, p.id, iso);
        db.prepare('UPDATE plugins SET install_count = install_count + 1, updated_at = ? WHERE id = ?').run(iso, p.id);
      })();
    }
    sendJson(res, 200, { installed: true, pluginId: p.id });
  }));

  // 卸载
  router.add('POST', '/api/plugins/:id/uninstall', requireSession((req, res, c) => {
    const p = db.prepare('SELECT * FROM plugins WHERE id = ?').get(req.params.id);
    if (!p) throw new HttpError('NOT_FOUND', '插件不存在');
    const iso = new Date().toISOString();
    const removed = db.transaction(() => {
      const r = db.prepare('DELETE FROM plugin_installs WHERE user_id = ? AND plugin_id = ?').run(c.user.id, p.id);
      if (r.changes > 0) db.prepare('UPDATE plugins SET install_count = MAX(0, install_count - 1), updated_at = ? WHERE id = ?').run(iso, p.id);
      return r.changes;
    })();
    sendJson(res, 200, { installed: false, pluginId: p.id, removed: removed > 0 });
  }));
}

module.exports = { register, TIER_RANK };
