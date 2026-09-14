'use strict';
// 迁移 001-019：版本推进、幂等、重复版本号拒绝、append-only 触发器、种子完整性。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { openDb, migrate } = require('../src/db');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mn2-mig-'));
}

test('迁移：user_version=21、58 表、角色/权限/平台种子齐整', () => {
  const db = openDb(path.join(tmpDir(), 'a.sqlite'));
  assert.strictEqual(db.pragma('user_version', { simple: true }), 21);
  // 表数：001 七 + 002 六 + 003 一 + 004 两 + 005 十四 + 006 四 + 007 四 + 008 六 + 009 十一 + 010 两 + 014 一 = 58（触发器不算表）
  const n = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n;
  assert.strictEqual(n, 58);
  // 角色 7、权限 42、矩阵基线（每角色授权数逐一断言 = 设计契约锁定）
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM roles').get().n, 7);
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM permissions').get().n, 42);
  const count = (role) => db.prepare('SELECT count(*) AS n FROM role_permissions WHERE role_id = ?').get(role).n;
  assert.deepStrictEqual(
    { cs: count('customer_support'), finance: count('finance'), moderation: count('moderation'),
      security: count('security'), technical: count('technical'), management: count('management') },
    { cs: 17, finance: 15, moderation: 12, security: 10, technical: 9, management: 14 }
  );
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM role_permissions').get().n, 77);
  // project_director 无矩阵行（全键走代码层，§4）
  assert.strictEqual(db.prepare("SELECT count(*) AS n FROM role_permissions WHERE role_id = 'project_director'").get().n, 0);
  // 平台设置种子（D8 预算红线默认值）
  assert.strictEqual(db.prepare("SELECT value FROM platform_settings WHERE key = 'budget.total'").get().value, '60');
  assert.strictEqual(db.prepare("SELECT value FROM platform_settings WHERE key = 'budget.copilot'").get().value, '10');
  // users.role 只允许 'user'（D4）
  assert.throws(() => db.prepare("INSERT INTO users (email, role, created_at, updated_at) VALUES ('x@y.z', 'admin', 't', 't')").run(), /CHECK/);
});

test('迁移：重复打开同库幂等（版本不再推进、无重复执行）', () => {
  const p = path.join(tmpDir(), 'b.sqlite');
  openDb(p);
  const db = openDb(p);
  assert.strictEqual(db.pragma('user_version', { simple: true }), 21);
});

test('迁移 005-009：社交/工单/知识库/审核/财务关键表与扩展列就位（D5/D6 口径）', () => {
  const db = openDb(path.join(tmpDir(), 'd.sqlite'));
  const has = (name) => db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name = ?").get(name).n === 1;
  for (const t of ['comments', 'wikis', 'content_likes', 'favorites', 'shares',
    'tickets', 'ticket_replies', 'ticket_escalations', 'ticket_feedback',
    'kb_categories', 'kb_articles', 'chat_logs',
    'refunds', 'subscriptions', 'donations', 'pricing_plans', 'pricing_regions', 'promos', 'checkout_events', 'payroll', 'staff_rates']) {
    assert.ok(has(t), '缺表 ' + t);
  }
  const col = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c);
  // D5：chat_logs 记问答内容；conversations 加 support 通道；消息/成员多态
  assert.ok(col('chat_logs', 'question') && col('chat_logs', 'answer') && col('chat_logs', 'answer_source'));
  assert.ok(col('conversations', 'kind') && col('conversations', 'ticket_id'));
  assert.ok(col('conversation_members', 'actor_type') && col('messages', 'sender_type'));
  // D4/D6：staff 只在 staff 表；audit 哈希链列
  assert.ok(col('staff', 'alias') && col('staff', 'real_name'));
  assert.ok(col('audit_log', 'prev_hash') && col('audit_log', 'hash'));
});

test('迁移 010：activity_daily/page_views 就位 + security_events 标记列（§2/§5）', () => {
  const db = openDb(path.join(tmpDir(), 'e.sqlite'));
  const has = (name) => db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name = ?").get(name).n === 1;
  assert.ok(has('activity_daily') && has('page_views'), '010 表缺');
  const col = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c);
  // activity_daily 复合主键（user_id, date）——DAU/留存聚合源（D9）
  const pk = db.prepare("SELECT count(*) AS n FROM pragma_table_info('activity_daily') WHERE pk > 0").get().n;
  assert.strictEqual(pk, 2);
  assert.ok(col('page_views', 'client_id') && col('page_views', 'path') && col('page_views', 'country'));
  // §5 事件标记（flag 写操作在 010 ALTER——001 已应用到旧库）
  assert.ok(col('security_events', 'flagged') && col('security_events', 'flagged_by') && col('security_events', 'flagged_at'));
});

test('迁移 011：users/staff password_hash 加列（W6 密码双因素；旧账号默认 NULL）', () => {
  const db = openDb(path.join(tmpDir(), 'f.sqlite'));
  const col = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c);
  assert.ok(col('users', 'password_hash') && col('staff', 'password_hash'), '011 列缺');
  const dflt = (t) => db.prepare(`PRAGMA table_info(${t})`).all().find(x => x.name === 'password_hash').dflt_value;
  assert.strictEqual(dflt('users'), null);
  assert.strictEqual(dflt('staff'), null);
});

test('迁移 013：users.gender 加列（v0.2.11.0 用户性别记录；旧用户默认 NULL）', () => {
  const db = openDb(path.join(tmpDir(), 'g.sqlite'));
  const col = db.prepare("PRAGMA table_info(users)").all().find(x => x.name === 'gender');
  assert.ok(col, '013 列缺');
  assert.strictEqual(col.dflt_value, null);
});

test('迁移 014：uploads 表就位（v0.2.16.0 帖子媒体附件元数据）', () => {
  const db = openDb(path.join(tmpDir(), 'h.sqlite'));
  const has = (name) => db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name = ?").get(name).n === 1;
  assert.ok(has('uploads'), '014 表缺');
  const cols = db.prepare("PRAGMA table_info(uploads)").all().map(x => x.name);
  assert.deepStrictEqual(cols, ['seq', 'id', 'owner_id', 'ext', 'mime', 'bytes', 'created_at']);
  assert.ok(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name = 'idx_uploads_owner'").get().n === 1);
});

test('迁移 015：posts.repost_of 加列 + 转发索引（v0.2.18.0 真转发——转发即发帖，无新表）', () => {
  const db = openDb(path.join(tmpDir(), 'i.sqlite'));
  const col = db.prepare("PRAGMA table_info(posts)").all().find(x => x.name === 'repost_of');
  assert.ok(col, '015 列缺');
  assert.strictEqual(col.dflt_value, null); // 普通帖 NULL = 非转发
  assert.ok(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name = 'idx_posts_repost_of'").get().n === 1);
});

test('迁移 016：posts.view_count 加列（v0.2.20.0 浏览量；默认 0，无新表 → health 58 不变）', () => {
  const db = openDb(path.join(tmpDir(), 'j.sqlite'));
  const col = db.prepare("PRAGMA table_info(posts)").all().find(x => x.name === 'view_count');
  assert.ok(col, '016 列缺');
  assert.strictEqual(col.dflt_value, '0'); // PRAGMA dflt_value 恒为字符串
  assert.strictEqual(col.notnull, 1);
  // 旧帖默认 0
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('u016', 'u016@x.com', 'user', 't', 't')").run();
  db.prepare("INSERT INTO posts (id, author_id, content, status, created_at, updated_at) VALUES ('P016', 'u016', 'hi', 'visible', 't', 't')").run();
  assert.strictEqual(db.prepare('SELECT view_count FROM posts WHERE id = ?').get('P016').view_count, 0);
});

test('迁移 017：following.users 显示名→id 引用 + 粉丝索引（v0.2.21.0 用户主页+关注）', () => {
  const srcDir = path.join(__dirname, '..', 'migrations');
  // 先只迁到 016（临时目录拷前 16 个文件），插一期显示名数据，再补跑 017 验证数据迁移
  const preDir = tmpDir();
  for (const f of fs.readdirSync(srcDir)) {
    if (/^\d+_.*\.sql$/.test(f) && Number.parseInt(f, 10) <= 16) fs.copyFileSync(path.join(srcDir, f), path.join(preDir, f));
  }
  const p = path.join(tmpDir(), 'k.sqlite');
  const db = new Database(p);
  db.pragma('foreign_keys = ON');
  migrate(db, preDir);
  assert.strictEqual(db.pragma('user_version', { simple: true }), 16);

  const iso = new Date().toISOString();
  db.prepare("INSERT INTO users (id, email, display_name, status, created_at, updated_at) VALUES ('F1', 'f1@x.com', 'Follower One', 'active', ?, ?)").run(iso, iso); // following.user_id 有 FK，关注者必须真实存在
  db.prepare("INSERT INTO users (id, email, display_name, status, created_at, updated_at) VALUES ('U1', 'u1@x.com', 'Marcus Vane', 'active', ?, ?)").run(iso, iso);
  db.prepare("INSERT INTO users (id, email, display_name, status, created_at, updated_at) VALUES ('U2', 'u2@x.com', 'Marcus Vane', 'active', ?, ?)").run(iso, iso); // 同名：取最早 seq
  db.prepare("INSERT INTO users (id, email, display_name, status, created_at, updated_at) VALUES ('U3', 'u3@x.com', 'Gone User', 'banned', ?, ?)").run(iso, iso);
  db.prepare("INSERT INTO following (user_id, target_type, target_id, created_at) VALUES ('F1', 'user', 'Marcus Vane', ?)").run(iso);
  db.prepare("INSERT INTO following (user_id, target_type, target_id, created_at) VALUES ('F1', 'user', 'Gone User', ?)").run(iso); // banned → 无 active 映射 → 删
  db.prepare("INSERT INTO following (user_id, target_type, target_id, created_at) VALUES ('F1', 'user', 'No Such Name', ?)").run(iso); // 不存在 → 删
  db.prepare("INSERT INTO following (user_id, target_type, target_id, created_at) VALUES ('F1', 'nation', 'NAT-000001', ?)").run(iso); // 其他类型不动

  migrate(db, srcDir); // 补跑 017-021

  assert.strictEqual(db.pragma('user_version', { simple: true }), 21);
  const rows = db.prepare('SELECT target_id FROM following WHERE user_id = ? ORDER BY target_type, target_id').all('F1');
  assert.deepStrictEqual(rows.map((r) => r.target_id), ['NAT-000001', 'U1'], '显示名→最早注册的 id；映射不到的行已删；nation 不动');
  assert.ok(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name = 'idx_following_target'").get().n === 1, '粉丝反查索引就位');
  db.close();
});

test('迁移 018：users.card_bg 加列（v0.2.23.0 卡片背景自定义；默认 NULL，无新表 → health 58 不变）', () => {
  const db = openDb(path.join(tmpDir(), 'l.sqlite'));
  const col = db.prepare("PRAGMA table_info(users)").all().find(x => x.name === 'card_bg');
  assert.ok(col, '018 列缺');
  assert.strictEqual(col.dflt_value, null); // NULL = 默认品牌横幅
  // 旧用户默认 NULL + 可写入白名单键
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('u018', 'u018@x.com', 'user', 't', 't')").run();
  assert.strictEqual(db.prepare('SELECT card_bg FROM users WHERE id = ?').get('u018').card_bg, null);
  db.prepare('UPDATE users SET card_bg = ? WHERE id = ?').run('glass-ocean', 'u018');
  assert.strictEqual(db.prepare('SELECT card_bg FROM users WHERE id = ?').get('u018').card_bg, 'glass-ocean');
});

test('迁移 019：users.card_plate 加列（v0.2.24.0 独立卡片背景；默认 NULL，无新表 → health 58 不变）', () => {
  const db = openDb(path.join(tmpDir(), 'm.sqlite'));
  const col = db.prepare("PRAGMA table_info(users)").all().find(x => x.name === 'card_plate');
  assert.ok(col, '019 列缺');
  assert.strictEqual(col.dflt_value, null); // NULL = 无背景层（普通卡）
  // 旧用户默认 NULL + 与 card_bg 独立存储（各写各的不互相影响）
  db.prepare("INSERT INTO users (id, email, role, card_bg, created_at, updated_at) VALUES ('u019', 'u019@x.com', 'user', 'glass-ocean', 't', 't')").run();
  assert.strictEqual(db.prepare('SELECT card_plate FROM users WHERE id = ?').get('u019').card_plate, null);
  db.prepare('UPDATE users SET card_plate = ? WHERE id = ?').run('glass-rose', 'u019');
  assert.strictEqual(db.prepare('SELECT card_plate FROM users WHERE id = ?').get('u019').card_plate, 'glass-rose');
  assert.strictEqual(db.prepare('SELECT card_bg FROM users WHERE id = ?').get('u019').card_bg, 'glass-ocean'); // 互不干扰
});

test('迁移 020：users.page_bg_image 加列（v0.2.25.0 主页整页背景图片；默认 NULL，无新表 → health 58 不变）', () => {
  const db = openDb(path.join(tmpDir(), 'n.sqlite'));
  const col = db.prepare("PRAGMA table_info(users)").all().find(x => x.name === 'page_bg_image');
  assert.ok(col, '020 列缺');
  assert.strictEqual(col.dflt_value, null); // NULL = 无整页背景
  // 旧用户默认 NULL + 可写入上传路径/外链
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('u020', 'u020@x.com', 'user', 't', 't')").run();
  assert.strictEqual(db.prepare('SELECT page_bg_image FROM users WHERE id = ?').get('u020').page_bg_image, null);
  db.prepare('UPDATE users SET page_bg_image = ? WHERE id = ?').run('/uploads/UPL-X0001.jpg', 'u020');
  assert.strictEqual(db.prepare('SELECT page_bg_image FROM users WHERE id = ?').get('u020').page_bg_image, '/uploads/UPL-X0001.jpg');
});

test('迁移 021：users 学生认证四列 + email_codes 重建扩 purpose（v0.2.44.0 学生价；无新表 → health 58 不变）', () => {
  const db = openDb(path.join(tmpDir(), 'o.sqlite'));
  // 四列就位、默认 NULL
  for (const c of ['student_email', 'student_verified_at', 'student_expires_at', 'student_source']) {
    const col = db.prepare('PRAGMA table_info(users)').all().find(x => x.name === c);
    assert.ok(col, '021 列缺: ' + c);
    assert.strictEqual(col.dflt_value, null);
  }
  // email_codes 重建后：历史行拷贝保留 + 新枚举可插
  const iso = new Date().toISOString();
  db.prepare("INSERT INTO email_codes (code_hash, email, purpose, actor_type, created_at, expires_at) VALUES ('h000', 'old@x.com', 'login', 'user', ?, ?)").run(iso, iso);
  db.prepare("INSERT INTO email_codes (code_hash, email, purpose, actor_type, created_at, expires_at) VALUES ('h001', 's@school.edu.my', 'student_verify', 'user', ?, ?)").run(iso, iso);
  assert.strictEqual(db.prepare("SELECT count(*) AS n FROM email_codes").get().n, 2);
  assert.strictEqual(db.prepare("SELECT count(*) AS n FROM email_codes WHERE purpose = 'login'").get().n, 1, '012 历史行拷贝保留');
  // 旧枚举仍被拒（CHECK 收紧在 student_verify 之外零变化）
  assert.throws(() => db.prepare("INSERT INTO email_codes (code_hash, email, purpose, actor_type, created_at, expires_at) VALUES ('h002', 'x@x.com', 'nope', 'user', ?, ?)").run(iso, iso), /CHECK/);
  // 索引就位
  assert.ok(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name = 'idx_users_student'").get().n === 1, '学生邮箱索引就位');
});

test('迁移：重复版本号启动即报错（防静默跳过）', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE x_a (id TEXT);');
  fs.writeFileSync(path.join(dir, '001_b.sql'), 'CREATE TABLE x_b (id TEXT);');
  const db = new Database(':memory:');
  assert.throws(() => migrate(db, dir), /版本号重复/);
});

test('审计表 append-only：UPDATE/DELETE 一律触发器拒绝（D12）', () => {
  const db = openDb(path.join(tmpDir(), 'c.sqlite'));
  db.prepare("INSERT INTO audit_log (actor_type, actor_id, action, created_at, hash) VALUES ('system', 's', 'x', ?, 'h')")
    .run(new Date().toISOString());
  assert.throws(() => db.prepare('UPDATE audit_log SET action = ? WHERE seq = 1').run('y'), /append-only/);
  assert.throws(() => db.prepare('DELETE FROM audit_log WHERE seq = 1').run(), /append-only/);
});
