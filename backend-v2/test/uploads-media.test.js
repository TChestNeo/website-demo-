'use strict';
// v0.2.16.0 媒体附件测试：/api/social/uploads（二进制上传：白名单/魔数/大小/限流/401）+ 媒体帖三态
// （IMS 未配置 → visible 先发后审；IMS 已配置且首图为图片 → pending 即时审核；首图为视频 → visible）。
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { testApp } = require('./helpers');

// 真实魔数的小文件（checkMagic 要求 ≥12 字节）
const JPEG = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(64, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(64, 2)]);
const WEBM = Buffer.concat([Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), Buffer.alloc(64, 3)]);

const createdUploadDirs = [];
function tempUploadDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mn2-up-'));
  createdUploadDirs.push(d);
  return d;
}
after(() => { for (const d of createdUploadDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} } });

// IMS 桩：解析调用、统一返 Pass
const imsPassStub = (calls) => async () => {
  calls.n++;
  return { ok: true, json: async () => ({ Response: { Suggestion: 'Pass', Label: 'Normal', SubLabel: '' } }) };
};

test('uploads：happy path → UPL- id + 文件逐字节落盘 + 行落库', async () => {
  const dir = tempUploadDir();
  const t = await testApp({ config: { uploadDir: dir } });
  try {
    const alice = t.loginAs('alice@x.com');
    const r = await t.upload('/api/social/uploads?ext=.jpg', JPEG, { cookie: alice.cookie });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    const m = body.url.match(/^\/uploads\/(UPL-\d{6})\.jpg$/);
    assert.ok(m, `URL 形状不符: ${body.url}`);
    const file = path.join(dir, m[1] + '.jpg');
    assert.deepStrictEqual(fs.readFileSync(file), JPEG); // 逐字节一致
    const row = t.db.prepare('SELECT * FROM uploads WHERE id = ?').get(m[1]);
    assert.strictEqual(row.owner_id, alice.user.id);
    assert.strictEqual(row.ext, 'jpg');
    assert.strictEqual(row.mime, 'image/jpeg');
    assert.strictEqual(row.bytes, JPEG.length);
  } finally { await t.close(); }
});

test('uploads：ext 白名单/缺失 → 400；魔数不符 → 400；空体 → 400', async () => {
  const t = await testApp({ config: { uploadDir: tempUploadDir() } });
  try {
    const alice = t.loginAs('alice@x.com');
    assert.strictEqual((await t.upload('/api/social/uploads?ext=.exe', JPEG, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.upload('/api/social/uploads', JPEG, { cookie: alice.cookie })).status, 400);
    const magic = await t.upload('/api/social/uploads?ext=.jpg', PNG, { cookie: alice.cookie }); // PNG 字节装 jpg
    assert.strictEqual(magic.status, 400);
    assert.strictEqual((await magic.json()).error.code, 'VALIDATION');
    assert.strictEqual((await t.upload('/api/social/uploads?ext=.jpg', Buffer.alloc(0), { cookie: alice.cookie })).status, 400);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM uploads').get().n, 0); // 全拒，零残留
  } finally { await t.close(); }
});

test('uploads：超限 → 400 请求体过大；匿名 → 401；限流 → 429', async () => {
  const t = await testApp({ config: { uploadDir: tempUploadDir(), rateLimits: { uploads: { max: 2, windowMs: 600000 } } } });
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com'); // 超限用独立用户——限流按检查时记账，失败请求也占槽
    // 图片扩展名（jpg/png/gif/webp）同属地图上传白名单（MAP_EXTS，30MB 上限）——
    // 图片超限以地图口径 30MB 为准，30MB+1 才触发 400 请求体过大
    const big = Buffer.alloc(30 * 1024 * 1024 + 1, 0);
    big.set(JPEG.subarray(0, 4), 0);
    const over = await t.upload('/api/social/uploads?ext=.jpg', big, { cookie: bob.cookie });
    assert.strictEqual(over.status, 400);
    assert.strictEqual((await over.json()).error.message, '请求体过大');
    assert.strictEqual((await t.upload('/api/social/uploads?ext=.png', PNG)).status, 401); // 无 cookie
    assert.strictEqual((await t.upload('/api/social/uploads?ext=.png', PNG, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.upload('/api/social/uploads?ext=.png', PNG, { cookie: alice.cookie })).status, 200);
    const third = await t.upload('/api/social/uploads?ext=.png', PNG, { cookie: alice.cookie });
    assert.strictEqual(third.status, 429);
    assert.strictEqual((await third.json()).error.code, 'RATE_LIMITED');
  } finally { await t.close(); }
});

test('posts：媒体 URL 校验（外部 URL / 穿越串 → 400）', async () => {
  const t = await testApp({ config: { uploadDir: tempUploadDir() } });
  try {
    const alice = t.loginAs('alice@x.com');
    const ext = await t.request('POST', '/api/social/posts', { content: '外部图', media: ['https://evil.example/x.jpg'] }, { cookie: alice.cookie });
    assert.strictEqual(ext.status, 400);
    const trav = await t.request('POST', '/api/social/posts', { content: '穿越', media: ['/uploads/UPL-000001.jpg/../../x'] }, { cookie: alice.cookie });
    assert.strictEqual(trav.status, 400);
    assert.strictEqual((await trav.json()).error.code, 'VALIDATION');
  } finally { await t.close(); }
});

test('posts：媒体帖 IMS 未配置 → visible 先发后审 + queued + GET 返回 media', async () => {
  const dir = tempUploadDir();
  const t = await testApp({ config: { uploadDir: dir } });
  try {
    const alice = t.loginAs('alice@x.com');
    const up = await t.upload('/api/social/uploads?ext=.png', PNG, { cookie: alice.cookie });
    const url = (await up.json()).url;
    const r = await t.request('POST', '/api/social/posts', { content: '带图成立公告', media: [url] }, { cookie: alice.cookie });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.post.status, 'visible');
    assert.deepStrictEqual(body.post.media, [url]);
    const item = t.db.prepare("SELECT * FROM moderation_items WHERE target_id = ? AND kind = 'image'").get(body.post.id);
    assert.strictEqual(item.status, 'queued');
    // GET 列表可见且带 media
    const list = (await (await t.request('GET', '/api/social/posts')).json()).posts;
    assert.strictEqual(list.length, 1);
    assert.deepStrictEqual(list[0].media, [url]);
  } finally { await t.close(); }
});

test('posts：IMS 已配置 + 首图为图片 → pending → 即时审核 Pass → visible + ai_approved（本地文件分支端到端）', async () => {
  const dir = tempUploadDir();
  const calls = { n: 0 };
  const t = await testApp({ config: { tencent: { secretId: 't', secretKey: 't' }, uploadDir: dir }, fetchImpl: imsPassStub(calls) });
  try {
    const alice = t.loginAs('alice@x.com');
    const up = await t.upload('/api/social/uploads?ext=.jpg', JPEG, { cookie: alice.cookie });
    const url = (await up.json()).url;
    const r = await t.request('POST', '/api/social/posts', { content: '需审图帖', media: [url] }, { cookie: alice.cookie });
    const body = await r.json();
    assert.strictEqual(body.post.status, 'visible'); // 内联 IMS Pass → 已翻 visible
    assert.strictEqual(calls.n, 1); // 真调了一次 IMS
    const item = t.db.prepare("SELECT * FROM moderation_items WHERE target_id = ? AND kind = 'image'").get(body.post.id);
    assert.strictEqual(item.status, 'ai_approved');
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM usage_log WHERE feature = 'moderation_image'").get().n, 1);
  } finally { await t.close(); }
});

test('posts：IMS 已配置 + 首图为视频 → visible + queued（不调 IMS，视频 base64 会超限不能走图片审核）', async () => {
  const t = await testApp({ config: { tencent: { secretId: 't', secretKey: 't' }, uploadDir: tempUploadDir() } }); // fetchImpl 默认抛错桩
  try {
    const alice = t.loginAs('alice@x.com');
    const r = await t.request('POST', '/api/social/posts', { content: '视频帖', media: ['/uploads/UPL-000001.webm'] }, { cookie: alice.cookie });
    const body = await r.json();
    assert.strictEqual(body.post.status, 'visible'); // 视频首图不先审后发
    const item = t.db.prepare("SELECT * FROM moderation_items WHERE target_id = ? AND kind = 'image'").get(body.post.id);
    assert.strictEqual(item.status, 'queued');
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM usage_log WHERE feature = 'moderation_image'").get().n, 0);
  } finally { await t.close(); }
});

test('uploads：webm 魔数 + 视频大小上限 30MB 生效', async () => {
  const dir = tempUploadDir();
  const t = await testApp({ config: { uploadDir: dir } });
  try {
    const alice = t.loginAs('alice@x.com');
    const ok = await t.upload('/api/social/uploads?ext=.webm', WEBM, { cookie: alice.cookie });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual((await ok.json()).url.includes('.webm'), true);
    const big = Buffer.alloc(30 * 1024 * 1024 + 1, 0);
    big.set(WEBM.subarray(0, 4), 0);
    const over = await t.upload('/api/social/uploads?ext=.webm', big, { cookie: alice.cookie });
    assert.strictEqual(over.status, 400);
  } finally { await t.close(); }
});
