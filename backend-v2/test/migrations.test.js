'use strict';
// 迁移 001-033：版本推进、幂等、重复版本号拒绝、append-only 触发器、种子完整性。

const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { openDb: _openDb, migrate } = require('../src/db');
const openDbs = [];
function openDb(p) { const db = _openDb(p); openDbs.push(db); return db; }

const createdMigDirs = [];
function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mn2-mig-'));
  createdMigDirs.push(d);
  return d;
}
after(() => { for (const db of openDbs) { try { db.close(); } catch (e) {} } for (const d of createdMigDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} } });

test('迁移：user_version=34、69 表、角色/权限/平台种子齐整', () => {
  const db = openDb(path.join(tmpDir(), 'a.sqlite'));
  assert.strictEqual(db.pragma('user_version', { simple: true }), 34);
  // 表数：001 七 + 002 六 + 003 一 + 004 两 + 005 十四 + 006 四 + 007 四 + 008 六 + 009 十一 + 010 两 + 014 一 + 025 一 + 028 一 + 031 一 + 033 五 + 034 三 = 69（触发器不算表）
  const n = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n;
  assert.strictEqual(n, 69);
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
  // 024 订阅开放开关种子（默认开放）
  const so = db.prepare("SELECT value, type FROM platform_settings WHERE key = 'subscriptions.open'").get();
  assert.strictEqual(so.value, 'true');
  assert.strictEqual(so.type, 'boolean');
  // users.role 只允许 'user'（D4）
  assert.throws(() => db.prepare("INSERT INTO users (email, role, created_at, updated_at) VALUES ('x@y.z', 'admin', 't', 't')").run(), /CHECK/);
});

test('迁移：重复打开同库幂等（版本不再推进、无重复执行）', () => {
  const p = path.join(tmpDir(), 'b.sqlite');
  openDb(p);
  const db = openDb(p);
  assert.strictEqual(db.pragma('user_version', { simple: true }), 34);
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
  assert.deepStrictEqual(cols, ['seq', 'id', 'owner_id', 'ext', 'mime', 'bytes', 'created_at', 'team_id', 'copy_of']); // 032 追加团队归属+出处两列
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

  migrate(db, srcDir); // 补跑 017-033

  assert.strictEqual(db.pragma('user_version', { simple: true }), 34);
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

test('迁移 022：遗留 pending 文章一律转 published（v0.2.46.1 直接发布；无新表 → health 58 不变）', () => {
  const srcDir = path.join(__dirname, '..', 'migrations');
  // 先只迁到 021（同 017 口径：临时目录拷前 21 个文件），插遗留 pending 数据，再补跑 022 验证数据迁移
  const preDir = tmpDir();
  for (const f of fs.readdirSync(srcDir)) {
    if (/^\d+_.*\.sql$/.test(f) && Number.parseInt(f, 10) <= 21) fs.copyFileSync(path.join(srcDir, f), path.join(preDir, f));
  }
  const p = path.join(tmpDir(), 'p.sqlite');
  const db = new Database(p);
  db.pragma('foreign_keys = ON');
  migrate(db, preDir);
  assert.strictEqual(db.pragma('user_version', { simple: true }), 21);

  const iso = new Date().toISOString();
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('u022', 'u022@x.com', 'user', ?, ?)").run(iso, iso);
  db.prepare("INSERT INTO articles (id, author_id, title, content_json, status, created_at, updated_at) VALUES ('ART-000001', 'u022', 'Legacy Pending', '{}', 'pending', ?, ?)").run(iso, iso);
  db.prepare("INSERT INTO articles (id, author_id, title, content_json, status, created_at, updated_at) VALUES ('ART-000002', 'u022', 'Already Published', '{}', 'published', ?, ?)").run(iso, iso);
  db.prepare("INSERT INTO articles (id, author_id, title, content_json, status, created_at, updated_at) VALUES ('ART-000003', 'u022', 'Legacy Hidden', '{}', 'hidden', ?, ?)").run(iso, iso);

  migrate(db, srcDir); // 补跑 022-033

  assert.strictEqual(db.pragma('user_version', { simple: true }), 34);
  assert.strictEqual(db.prepare("SELECT status FROM articles WHERE id = 'ART-000001'").get().status, 'published', '遗留 pending → published');
  assert.strictEqual(db.prepare("SELECT status FROM articles WHERE id = 'ART-000002'").get().status, 'published', '已发布不动');
  assert.strictEqual(db.prepare("SELECT status FROM articles WHERE id = 'ART-000003'").get().status, 'hidden', 'hidden/removed 不动（非发布态不该复活）');
  assert.strictEqual(db.prepare("SELECT updated_at FROM articles WHERE id = 'ART-000001'").get().updated_at, iso, '数据迁移不虚报编辑时间');
  db.close();
});

test('迁移 023：users.xp_gained 加列（v0.2.49.0 社交获得类经验；默认 0，无新表 → health 58 不变）', () => {
  const db = openDb(path.join(tmpDir(), 'q.sqlite'));
  const col = db.prepare('PRAGMA table_info(users)').all().find(x => x.name === 'xp_gained');
  assert.ok(col, '023 列缺');
  assert.strictEqual(Number(col.dflt_value), 0); // 老用户默认 0 经验（PRAGMA dflt_value 为 TEXT '0'）
  const iso = new Date().toISOString();
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('u023', 'u023@x.com', 'user', ?, ?)").run(iso, iso);
  assert.strictEqual(db.prepare('SELECT xp_gained FROM users WHERE id = ?').get('u023').xp_gained, 0);
  // 可累加（路由层 gainXp 用的同款 UPDATE）
  db.prepare('UPDATE users SET xp_gained = xp_gained + 15 WHERE id = ?').run('u023');
  assert.strictEqual(db.prepare('SELECT xp_gained FROM users WHERE id = ?').get('u023').xp_gained, 15);
  db.close();
});

test('迁移 025：friend_requests 表就位（v0.2.51.0 好友请求；+1 表 → health 59）', () => {
  const db = openDb(path.join(tmpDir(), 'r.sqlite'));
  const cols = db.prepare('PRAGMA table_info(friend_requests)').all().map((x) => x.name);
  assert.deepStrictEqual(cols, ['seq', 'id', 'sender_id', 'recipient_id', 'status', 'created_at', 'responded_at']);
  const st = db.prepare('PRAGMA table_info(friend_requests)').all().find((x) => x.name === 'status');
  assert.strictEqual(st.dflt_value, "'pending'");
  assert.ok(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_friend_requests_recipient'").get().n === 1);
  assert.ok(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_friend_requests_pair'").get().n === 1);
  // CHECK 枚举 + FK 级联删除
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('f1', 'f1@x.com', 'user', 't', 't')").run();
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('f2', 'f2@x.com', 'user', 't', 't')").run();
  db.prepare("INSERT INTO friend_requests (id, sender_id, recipient_id, status, created_at) VALUES ('FR-000001', 'f1', 'f2', 'pending', 't')").run();
  assert.throws(() => db.prepare("INSERT INTO friend_requests (id, sender_id, recipient_id, status, created_at) VALUES ('FR-000002', 'f1', 'f2', 'nope', 't')").run(), /CHECK/);
  db.prepare("DELETE FROM users WHERE id = 'f1'").run();
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM friend_requests').get().n, 0);
  db.close();
});

test('迁移 026：citizen_id 统一 USR- 口径（v0.2.51.1 CIT→USR；无新表 → health 59 不变）', () => {
  const srcDir = path.join(__dirname, '..', 'migrations');
  // 先只迁到 025（同 017 口径），插旧口径数据（CIT-/NULL/已一致三种），再补跑 026 验证数据迁移
  const preDir = tmpDir();
  for (const f of fs.readdirSync(srcDir)) {
    if (/^\d+_.*\.sql$/.test(f) && Number.parseInt(f, 10) <= 25) fs.copyFileSync(path.join(srcDir, f), path.join(preDir, f));
  }
  const p = path.join(tmpDir(), 's.sqlite');
  const db = new Database(p);
  db.pragma('foreign_keys = ON');
  migrate(db, preDir);
  assert.strictEqual(db.pragma('user_version', { simple: true }), 25);

  const iso = new Date().toISOString();
  db.prepare("INSERT INTO users (id, email, display_name, status, role, citizen_id, created_at, updated_at) VALUES ('USR-000001', 'a@x.com', 'Citizen A', 'active', 'user', 'CIT-000001', ?, ?)").run(iso, iso);
  db.prepare("INSERT INTO users (id, email, display_name, status, role, citizen_id, created_at, updated_at) VALUES ('USR-000002', 'b@x.com', 'Citizen B', 'active', 'user', NULL, ?, ?)").run(iso, iso);
  db.prepare("INSERT INTO users (id, email, display_name, status, role, citizen_id, created_at, updated_at) VALUES ('USR-000003', 'c@x.com', 'Citizen C', 'active', 'user', 'USR-000003', ?, ?)").run(iso, iso);

  migrate(db, srcDir); // 补跑 026-033

  assert.strictEqual(db.pragma('user_version', { simple: true }), 34);
  assert.strictEqual(db.prepare("SELECT citizen_id FROM users WHERE id = 'USR-000001'").get().citizen_id, 'USR-000001', '旧 CIT- 存量改写为 id');
  assert.strictEqual(db.prepare("SELECT citizen_id FROM users WHERE id = 'USR-000002'").get().citizen_id, 'USR-000002', 'NULL 补齐为 id');
  assert.strictEqual(db.prepare("SELECT citizen_id FROM users WHERE id = 'USR-000003'").get().citizen_id, 'USR-000003', '已一致不动');
  db.close();
});

test('迁移 027：users.card_edge 加列（v0.2.53.0 卡片边缘主题；默认 NULL，无新表 → health 59 不变）', () => {
  const db = openDb(path.join(tmpDir(), 't.sqlite'));
  const col = db.prepare("PRAGMA table_info(users)").all().find(x => x.name === 'card_edge');
  assert.ok(col, '027 列缺');
  assert.strictEqual(col.dflt_value, null); // NULL = 默认圆角卡
  // 旧用户默认 NULL + 可写入白名单键（FC 14 键代表款）
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('u027', 'u027@x.com', 'user', 't', 't')").run();
  assert.strictEqual(db.prepare('SELECT card_edge FROM users WHERE id = ?').get('u027').card_edge, null);
  db.prepare('UPDATE users SET card_edge = ? WHERE id = ?').run('paper', 'u027');
  assert.strictEqual(db.prepare('SELECT card_edge FROM users WHERE id = ?').get('u027').card_edge, 'paper');
  db.prepare('UPDATE users SET card_edge = ? WHERE id = ?').run('paint5', 'u027');
  assert.strictEqual(db.prepare('SELECT card_edge FROM users WHERE id = ?').get('u027').card_edge, 'paint5');
});

test('迁移 029：users.banner_url 加列（v0.2.58.18 个人资料横幅；默认 NULL，无新表 → health 60 不变）', () => {
  const db = openDb(path.join(tmpDir(), 'u.sqlite'));
  const col = db.prepare("PRAGMA table_info(users)").all().find(x => x.name === 'banner_url');
  assert.ok(col, '029 列缺');
  assert.strictEqual(col.dflt_value, null); // NULL = 默认预设渐变横幅
  // 旧用户默认 NULL + 可写入本站上传路径
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('u029', 'u029@x.com', 'user', 't', 't')").run();
  assert.strictEqual(db.prepare('SELECT banner_url FROM users WHERE id = ?').get('u029').banner_url, null);
  db.prepare('UPDATE users SET banner_url = ? WHERE id = ?').run('/uploads/UPL-X0001.jpg', 'u029');
  assert.strictEqual(db.prepare('SELECT banner_url FROM users WHERE id = ?').get('u029').banner_url, '/uploads/UPL-X0001.jpg');
  db.prepare('UPDATE users SET banner_url = ? WHERE id = ?').run(null, 'u029');
  assert.strictEqual(db.prepare('SELECT banner_url FROM users WHERE id = ?').get('u029').banner_url, null);
});

test('迁移 030：users.avatar_crop/banner_crop 加列（v0.2.58.25 显示范围裁切元数据；默认 NULL，无新表 → health 60 不变）', () => {
  const db = openDb(path.join(tmpDir(), 'v.sqlite'));
  // 两列就位、默认 NULL（NULL = 默认 {0,0,1,1} 整图 cover = 爷爷辈零回归）
  for (const c of ['avatar_crop', 'banner_crop']) {
    const col = db.prepare('PRAGMA table_info(users)').all().find(x => x.name === c);
    assert.ok(col, '030 列缺: ' + c);
    assert.strictEqual(col.dflt_value, null);
  }
  // 旧用户默认 NULL + 可写入归一化矩形 JSON
  const iso = new Date().toISOString();
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('u030', 'u030@x.com', 'user', ?, ?)").run(iso, iso);
  assert.strictEqual(db.prepare('SELECT avatar_crop FROM users WHERE id = ?').get('u030').avatar_crop, null);
  db.prepare('UPDATE users SET avatar_crop = ? WHERE id = ?').run('{"x":0.1,"y":0.2,"w":0.5,"h":0.6}', 'u030');
  assert.strictEqual(db.prepare('SELECT avatar_crop FROM users WHERE id = ?').get('u030').avatar_crop, '{"x":0.1,"y":0.2,"w":0.5,"h":0.6}');
  db.prepare('UPDATE users SET banner_crop = ? WHERE id = ?').run('{"x":0,"y":0,"w":1,"h":1}', 'u030');
  assert.strictEqual(db.prepare('SELECT banner_crop FROM users WHERE id = ?').get('u030').banner_crop, '{"x":0,"y":0,"w":1,"h":1}');
  // 与 029 banner_url 独立存储（各写各的不互相影响）
  db.prepare('UPDATE users SET banner_url = ? WHERE id = ?').run('/uploads/UPL-X0001.jpg', 'u030');
  assert.strictEqual(db.prepare('SELECT banner_crop FROM users WHERE id = ?').get('u030').banner_crop, '{"x":0,"y":0,"w":1,"h":1}');
});

test('迁移 031：fc_edges 表就位（FC v10.28.50.0 自定义边缘仓库；+1 表 → health 61）', () => {
  const db = openDb(path.join(tmpDir(), 'w.sqlite'));
  const cols = db.prepare('PRAGMA table_info(fc_edges)').all().map((x) => x.name);
  assert.deepStrictEqual(cols, ['seq', 'id', 'owner_id', 'name', 'kind', 'clip', 'visibility', 'created_at']);
  // CHECK 枚举（kind 两值 / visibility 四值）+ 默认 private
  const vis = db.prepare('PRAGMA table_info(fc_edges)').all().find((x) => x.name === 'visibility');
  assert.strictEqual(vis.dflt_value, "'private'");
  const iso = new Date().toISOString();
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('u031', 'u031@x.com', 'user', ?, ?)").run(iso, iso);
  db.prepare("INSERT INTO fc_edges (id, owner_id, name, kind, clip, visibility, created_at) VALUES ('EDG-000001', 'u031', '撕边', 'edge', 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', 'private', ?)").run(iso);
  assert.throws(() => db.prepare("INSERT INTO fc_edges (id, owner_id, name, kind, clip, visibility, created_at) VALUES ('EDG-000002', 'u031', 'x', 'nope', 'p', 'private', ?)").run(iso), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO fc_edges (id, owner_id, name, kind, clip, visibility, created_at) VALUES ('EDG-000003', 'u031', 'x', 'edge', 'p', 'nope', ?)").run(iso), /CHECK/);
  // 索引 + FK 级联删除
  assert.ok(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name = 'idx_fc_edges_owner'").get().n === 1);
  assert.ok(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name = 'idx_fc_edges_visibility'").get().n === 1);
  db.prepare("DELETE FROM users WHERE id = 'u031'").run();
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM fc_edges').get().n, 0);
  // usage_log 重建扩 feature：历史行拷贝保留 + edgeGen 可插 + 旧枚举仍拒
  db.prepare("INSERT INTO usage_log (feature, price_snapshot, cost_micro, provider, created_at) VALUES ('chat', '{}', 1, 'deepseek', ?)").run(iso);
  db.prepare("INSERT INTO usage_log (feature, price_snapshot, cost_micro, provider, created_at) VALUES ('edgeGen', '{}', 1, 'gemini', ?)").run(iso);
  assert.strictEqual(db.prepare("SELECT count(*) AS n FROM usage_log WHERE feature = 'chat'").get().n, 1, '历史行拷贝保留');
  assert.strictEqual(db.prepare("SELECT count(*) AS n FROM usage_log WHERE feature = 'edgeGen'").get().n, 1);
  assert.throws(() => db.prepare("INSERT INTO usage_log (feature, price_snapshot, cost_micro, created_at) VALUES ('nope', '{}', 1, ?)").run(iso), /CHECK/);
  db.close();
});

test('迁移 032：团队频道加列+扩容 SKU（FC v10.28.51.0 三步向导；列级迁移无新表 → health 61 不变）', () => {
  const db = openDb(path.join(tmpDir(), 'x.sqlite'));
  // 七列就位（群名/扩容两列/贴文-动态-上传归属/上传出处）
  for (const [table, col] of [
    ['conversations', 'name'], ['users', 'team_cap_addon'], ['users', 'team_cap_expires_at'],
    ['posts', 'team_id'], ['articles', 'team_id'], ['uploads', 'team_id'], ['uploads', 'copy_of']
  ]) {
    const c = db.prepare('PRAGMA table_info(' + table + ')').all().find((x) => x.name === col);
    assert.ok(c, '032 列缺: ' + table + '.' + col);
  }
  // 默认值口径：群名/扩容列空串；归属/出处 NULL
  assert.strictEqual(db.prepare('PRAGMA table_info(conversations)').all().find((x) => x.name === 'name').dflt_value, "''");
  assert.strictEqual(db.prepare('PRAGMA table_info(users)').all().find((x) => x.name === 'team_cap_addon').dflt_value, "''");
  assert.strictEqual(db.prepare('PRAGMA table_info(posts)').all().find((x) => x.name === 'team_id').dflt_value, null);
  assert.strictEqual(db.prepare('PRAGMA table_info(uploads)').all().find((x) => x.name === 'copy_of').dflt_value, null);
  // 4 个扩容 SKU 就位（口径 8/16/26/∞；INSERT OR IGNORE 幂等）
  const skus = db.prepare("SELECT plan_key FROM pricing_plans WHERE plan_key LIKE 'slots-%' ORDER BY plan_key").all().map((r) => r.plan_key);
  assert.deepStrictEqual(skus, ['slots-basic', 'slots-plus', 'slots-premium', 'slots-ultra']);
  // 三枚归属索引
  for (const ix of ['idx_posts_team', 'idx_articles_team', 'idx_uploads_team']) {
    assert.ok(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name = ?").get(ix).n === 1, '缺索引 ' + ix);
  }
  db.close();
});

test('迁移 033：等级奖励五表+XP 列（FC v10.28.52.0；+5 表 → health 66）', () => {
  const db = openDb(path.join(tmpDir(), 'y.sqlite'));
  // teams.xp_gained + users.avatar_frame/title 三列就位
  const xpCol = db.prepare('PRAGMA table_info(teams)').all().find((x) => x.name === 'xp_gained');
  assert.ok(xpCol, '033 列缺: teams.xp_gained');
  assert.strictEqual(Number(xpCol.dflt_value), 0);
  for (const c of ['avatar_frame', 'title']) {
    const col = db.prepare('PRAGMA table_info(users)').all().find((x) => x.name === c);
    assert.ok(col, '033 列缺: users.' + c);
    assert.strictEqual(col.dflt_value, null);
  }
  // 五表就位 + CHECK 枚举
  const has = (name) => db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name = ?").get(name).n === 1;
  for (const t of ['achievements', 'user_achievements', 'team_achievements', 'user_badges', 'user_cosmetics']) {
    assert.ok(has(t), '缺表 ' + t);
  }
  const iso = new Date().toISOString();
  assert.throws(() => db.prepare("INSERT INTO achievements (id, scope, name, description, level, created_at) VALUES ('ACH-x', 'nope', 'n', 'd', 1, ?)").run(iso), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO user_cosmetics (user_id, kind, value, owned_at) VALUES ('u', 'nope', 'v', ?)").run(iso), /CHECK/);
  // 8 条成就种子（个人/团队 2/6/9/12）
  const seeds = db.prepare('SELECT id, scope, level, name FROM achievements ORDER BY scope, level').all();
  // ORDER BY scope：'team' < 'user' 字典序在前
  assert.deepStrictEqual(seeds.map((r) => r.id), ['ACH-team-2', 'ACH-team-6', 'ACH-team-9', 'ACH-team-12', 'ACH-user-2', 'ACH-user-6', 'ACH-user-9', 'ACH-user-12']);
  // 名称=用户原文逐字
  const byId = Object.fromEntries(seeds.map((r) => [r.id, r.name]));
  assert.strictEqual(byId['ACH-user-2'], '官方对你的认可');
  assert.strictEqual(byId['ACH-user-6'], '恭喜你成为老玩家');
  assert.strictEqual(byId['ACH-user-9'], '我是五星上将！');
  assert.strictEqual(byId['ACH-user-12'], '我是冠军！');
  assert.strictEqual(byId['ACH-team-2'], '新国崛起！');
  assert.strictEqual(byId['ACH-team-6'], '老了');
  assert.strictEqual(byId['ACH-team-9'], '鼎世春秋');
  assert.strictEqual(byId['ACH-team-12'], '我是一个空气');
  // 团队 XP 可累加（team-xp.js 用的同款 UPDATE）+ MAX(0) 不穿负
  db.prepare("INSERT INTO teams (id, data, created_at) VALUES ('TEAM-X1', '{}', ?)").run(iso);
  db.prepare('UPDATE teams SET xp_gained = xp_gained + 24 WHERE id = ?').run('TEAM-X1');
  assert.strictEqual(db.prepare('SELECT xp_gained FROM teams WHERE id = ?').get('TEAM-X1').xp_gained, 24);
  db.prepare('UPDATE teams SET xp_gained = MAX(0, xp_gained - 36) WHERE id = ?').run('TEAM-X1');
  assert.strictEqual(db.prepare('SELECT xp_gained FROM teams WHERE id = ?').get('TEAM-X1').xp_gained, 0);
  // FK 级联：用户删除连带清成就/徽章/装饰品
  db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('u033', 'u033@x.com', 'user', ?, ?)").run(iso, iso);
  db.prepare("INSERT INTO user_achievements (user_id, ach_id, unlocked_at) VALUES ('u033', 'ACH-user-2', ?)").run(iso);
  db.prepare("INSERT INTO user_badges (user_id, badge_id, owned_at) VALUES ('u033', 'BADGE-user-2', ?)").run(iso);
  db.prepare("INSERT INTO user_cosmetics (user_id, kind, value, owned_at) VALUES ('u033', 'frame', 'rookie-frame', ?)").run(iso);
  db.prepare("DELETE FROM users WHERE id = 'u033'").run();
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM user_achievements').get().n, 0);
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM user_badges').get().n, 0);
  assert.strictEqual(db.prepare('SELECT count(*) AS n FROM user_cosmetics').get().n, 0);
  db.close();
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
