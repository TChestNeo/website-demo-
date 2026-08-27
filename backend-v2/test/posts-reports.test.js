'use strict';
// P7 端点测试：/api/social/posts（L0 先发后审 + 频控/去重/处罚生效）+ /api/reports（即时通道）。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// DeepSeek 桩：解析请求体中的 items，统一判定回包（含 usage 供记账），计数防误调用
function deepseekStub(verdictForAll, calls = { n: 0 }) {
  return async (url, opts) => {
    calls.n++;
    const req = JSON.parse(opts.body);
    const items = JSON.parse(req.messages[1].content).items;
    return {
      ok: true,
      text: async () => JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              results: items.map(it => ({ id: it.id, verdict: verdictForAll, severity: 0, reason_code: 'none', labels: [], confidence: 0.95 }))
            })
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 50 }
      })
    };
  };
}

const CLEAN = '我的新国家正式成立，欢迎各位外交官来访交流';

test('posts：pass → visible + PST- id + 夜间批处理入队（先发后审）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const r = await t.request('POST', '/api/social/posts', { content: CLEAN }, { cookie: alice.cookie });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.match(body.post.id, /^PST-\d{6}$/);
    assert.strictEqual(body.post.status, 'visible');
    assert.strictEqual(body.post.authorName, 'Alice');
    assert.strictEqual(body.moderation.verdict, 'pass');
    const item = t.db.prepare("SELECT * FROM moderation_items WHERE target_id = ?").get(body.post.id);
    assert.strictEqual(item.kind, 'text');
    assert.strictEqual(item.status, 'queued'); // 夜间批处理才审
  } finally { await t.close(); }
});

test('posts：零容忍 → removed + 直接封号（跳过阶梯）+ 决策/通知落库 + 会话清除', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const r = await t.request('POST', '/api/social/posts', { content: '我这里可以代开发票，欢迎联系' }, { cookie: alice.cookie });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.post.status, 'removed');
    assert.strictEqual(body.moderation.reasonCode, 'zero_tolerance');
    // 用户被封 + 会话清除
    assert.strictEqual(t.db.prepare('SELECT status FROM users WHERE id = ?').get(alice.user.id).status, 'banned');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM user_sessions WHERE user_id = ?').get(alice.user.id).n, 0);
    const d = t.db.prepare('SELECT * FROM moderation_decisions').get();
    assert.strictEqual(d.action, 'ban');
    assert.strictEqual(d.actor_type, 'system'); // v2：actor 自由文本 → actor_type 枚举（D4 口径）
    assert.ok(t.db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id = ?').get(alice.user.id).n > 0);
    // 会话已清 → 后续请求 401
    assert.strictEqual((await t.request('GET', '/api/social/following', undefined, { cookie: alice.cookie })).status, 401);
    // 列表不出现 removed
    assert.strictEqual((await (await t.request('GET', '/api/social/posts')).json()).posts.length, 0);
  } finally { await t.close(); }
});

test('posts：warning 词 → 先发后审 visible + l0_hold 人工', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const r = await t.request('POST', '/api/social/posts', { content: '你真是个傻逼' }, { cookie: alice.cookie });
    const body = await r.json();
    assert.strictEqual(body.post.status, 'visible'); // 先发后审：可见但挂人工
    assert.strictEqual(body.moderation.verdict, 'hold');
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(body.post.id);
    assert.strictEqual(item.status, 'l0_hold');
  } finally { await t.close(); }
});

test('posts：外链刷屏 → spam hold；媒体帖 → pending + 图像 IMS 未配置 → needs_human（默认不上线）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const s = await t.request('POST', '/api/social/posts', { content: '看 http://a.com http://b.co http://c.org' }, { cookie: alice.cookie });
    assert.strictEqual((await s.json()).moderation.reasonCode, 'spam');
    const m = await t.request('POST', '/api/social/posts', { content: '国旗发布！', media: ['data:image/png;base64,AAAA'] }, { cookie: alice.cookie });
    const mb = await m.json();
    assert.strictEqual(mb.post.status, 'pending'); // 图像不先发后审
    const item = t.db.prepare("SELECT * FROM moderation_items WHERE target_id = ? AND kind = 'image'").get(mb.post.id);
    assert.strictEqual(item.status, 'needs_human'); // 未配置 IMS → 人工兜底
    // usage_log 有降级记录但零成本（未真正调用 IMS）
    const usage = t.db.prepare("SELECT * FROM usage_log WHERE feature = 'moderation_image'").get();
    assert.strictEqual(usage.cost_micro, 0);
  } finally { await t.close(); }
});

test('posts：新号频控 24h ≤N 帖 → 403 RESTRICTED', async () => {
  const t = await testApp({ config: { moderation: { newAccountDailyPosts: 2 } } });
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    assert.strictEqual((await t.request('POST', '/api/social/posts', { content: '第一条' }, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/social/posts', { content: '第二条' }, { cookie: alice.cookie })).status, 200);
    const third = await t.request('POST', '/api/social/posts', { content: '第三条' }, { cookie: alice.cookie });
    assert.strictEqual(third.status, 403);
    assert.strictEqual((await third.json()).error.code, 'RESTRICTED');
  } finally { await t.close(); }
});

test('posts：sha1 精确去重（24h 同作者同内容）→ 403；禁言用户 → 403', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    assert.strictEqual((await t.request('POST', '/api/social/posts', { content: CLEAN }, { cookie: alice.cookie })).status, 200);
    const dup = await t.request('POST', '/api/social/posts', { content: '  ' + CLEAN }, { cookie: alice.cookie });
    assert.strictEqual(dup.status, 403);
    // 禁言
    t.db.prepare('UPDATE users SET muted_until = ? WHERE id = ?')
      .run(new Date(Date.now() + 3600e3).toISOString(), alice.user.id);
    const muted = await t.request('POST', '/api/social/posts', { content: '别的内容' }, { cookie: alice.cookie });
    assert.strictEqual(muted.status, 403);
  } finally { await t.close(); }
});

test('posts：校验 400（空/超长）+ 匿名 401 + GET 只回 visible', async () => {
  const t = await testApp({ config: { rateLimits: { postsWrite: { max: 20, windowMs: 600000 } } } });
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    assert.strictEqual((await t.request('POST', '/api/social/posts', { content: '   ' }, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/social/posts', { content: 'x'.repeat(2001) }, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/social/posts', { content: 'anon' })).status, 401);
    // 直接造 hidden 帖 → GET 排除
    t.db.prepare('INSERT INTO posts (id, author_id, content, media, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('PST-999999', alice.user.id, 'hidden post', '[]', 'hidden', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z');
    const list = (await (await t.request('GET', '/api/social/posts')).json()).posts;
    assert.strictEqual(list.length, 0);
  } finally { await t.close(); }
});

test('reports：举报建 RPT- + 高优先级审核项 + 即时 AI pass → ai_approved + 记账', async () => {
  const calls = { n: 0 };
  const t = await testApp({ fetchImpl: deepseekStub('pass', calls) });
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = (await (await t.request('POST', '/api/social/posts', { content: CLEAN }, { cookie: alice.cookie })).json()).post;
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const r = await t.request('POST', '/api/reports', { targetType: 'post', targetId: post.id, reason: 'spam', description: '可疑' }, { cookie: bob.cookie });
    assert.strictEqual(r.status, 200);
    const rep = (await r.json()).report;
    assert.match(rep.id, /^RPT-\d{6}$/);
    assert.strictEqual(rep.status, 'open');
    const item = t.db.prepare("SELECT * FROM moderation_items WHERE target_id = ? AND priority = 'high'").get(post.id);
    assert.strictEqual(item.status, 'ai_approved'); // 即时通道判定完成
    assert.strictEqual(calls.n, 1);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM usage_log WHERE feature = 'moderation_text'").get().n, 1);
  } finally { await t.close(); }
});

test('reports：即时 AI reject → 帖子下架 + remove_content 决策 + 通知', async () => {
  const t = await testApp({ fetchImpl: deepseekStub('reject') });
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = (await (await t.request('POST', '/api/social/posts', { content: CLEAN }, { cookie: alice.cookie })).json()).post;
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    await t.request('POST', '/api/reports', { targetType: 'post', targetId: post.id, reason: 'hate' }, { cookie: bob.cookie });
    assert.strictEqual(t.db.prepare('SELECT status FROM posts WHERE id = ?').get(post.id).status, 'hidden');
    assert.strictEqual(t.db.prepare('SELECT action FROM moderation_decisions').get().action, 'remove_content');
    assert.ok(t.db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id = ?').get(alice.user.id).n > 0);
  } finally { await t.close(); }
});

test('reports：无正文目标（user）→ 直接人工，零 AI 调用；校验 400；匿名 401', async () => {
  const calls = { n: 0 };
  const t = await testApp({ fetchImpl: deepseekStub('pass', calls) });
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const r = await t.request('POST', '/api/reports', { targetType: 'user', targetId: alice.user.id, reason: 'impersonation' }, { cookie: bob.cookie });
    assert.strictEqual(r.status, 200);
    const item = t.db.prepare("SELECT * FROM moderation_items WHERE target_id = ? AND priority = 'high'").get(alice.user.id);
    assert.strictEqual(item.status, 'needs_human');
    assert.strictEqual(calls.n, 0); // 无正文不调 AI
    assert.strictEqual((await t.request('POST', '/api/reports', { targetType: 'post', targetId: 'x', reason: 'bogus' }, { cookie: bob.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/reports', { targetType: 'post', targetId: 'x', reason: 'spam' })).status, 401);
  } finally { await t.close(); }
});
