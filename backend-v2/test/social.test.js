'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// 登录用户返回 cookie；未传 opts 的 request 默认匿名
async function sessionCookie(t, email) {
  const { cookie } = t.loginAs(email);
  return cookie;
}

test('nations：空列表 → POST 生成 NAT- id 并覆盖本地 id/createdAt → GET 全站可见', async () => {
  const t = await testApp();
  try {
    const empty = await t.request('GET', '/api/social/nations');
    assert.strictEqual(empty.status, 200);
    assert.deepStrictEqual((await empty.json()).nations, []);

    const { cookie } = t.loginAs('a@x.com');
    // 前端 submitNation 会带本地临时 id/createdAt/status——服务端必须全部覆盖
    const res = await t.request('POST', '/api/social/nations', {
      id: 'NAT-1753000000000', name: '共和国示例', moniker: 'EXAMPLE', classification: 'Constitutional monarchy',
      capital: '首都', established: '2026-08-01', lore: '一段介绍', sectors: ['Culture'],
      demographics: { population: 100 }, createdAt: '2020-01-01T00:00:00.000Z', status: 'local'
    }, { cookie });
    assert.strictEqual(res.status, 200);
    const nation = (await res.json()).nation;
    assert.match(nation.id, /^NAT-\d{6}$/);
    assert.notStrictEqual(nation.createdAt, '2020-01-01T00:00:00.000Z'); // 服务端时间覆盖
    assert.strictEqual(nation.status, 'active');
    assert.strictEqual(nation.name, '共和国示例'); // verbatim 字段保留

    // 另一个用户也能看到（公开列表）
    const list = await t.request('GET', '/api/social/nations');
    const nations = (await list.json()).nations;
    assert.strictEqual(nations.length, 1);
    assert.strictEqual(nations[0].id, nation.id);
    assert.strictEqual(nations[0].lore, '一段介绍');
  } finally { await t.close(); }
});

test('nations：无 name → 400 VALIDATION；未登录 POST → 401', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('b@x.com');
    const noName = await t.request('POST', '/api/social/nations', { lore: 'x' }, { cookie });
    assert.strictEqual(noName.status, 400);
    assert.strictEqual((await noName.json()).error.code, 'VALIDATION');
    const anon = await t.request('POST', '/api/social/nations', { name: 'N' });
    assert.strictEqual(anon.status, 401);
  } finally { await t.close(); }
});

test('topics：POST 生成 TOP- id、memberCount=1；GET 回读', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('c@x.com');
    const res = await t.request('POST', '/api/social/topics', {
      id: 'TOP-1753000000000', name: 'Cartography', description: 'Maps of our worlds',
      category: 'Culture', memberCount: 99, createdAt: '2020-01-01T00:00:00.000Z'
    }, { cookie });
    assert.strictEqual(res.status, 200);
    const topic = (await res.json()).topic;
    assert.match(topic.id, /^TOP-\d{6}$/);
    assert.strictEqual(topic.memberCount, 1); // 服务端覆盖
    assert.strictEqual(topic.name, 'Cartography');

    const list = (await (await t.request('GET', '/api/social/topics')).json()).topics;
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, topic.id);
  } finally { await t.close(); }
});

test('teams：首次 GET 播种 3 队（与本地种子同数据）；重复 GET 幂等', async () => {
  const t = await testApp();
  try {
    const first = await t.request('GET', '/api/social/teams');
    const teams = (await first.json()).teams;
    assert.strictEqual(teams.length, 3);
    assert.deepStrictEqual(teams.map(x => x.id), ['team-1', 'team-2', 'team-3']);
    assert.ok(teams.every(x => x.name && x.avatar && x.color && Array.isArray(x.nations)));

    const second = (await (await t.request('GET', '/api/social/teams')).json()).teams;
    assert.strictEqual(second.length, 3); // 不重复播种
  } finally { await t.close(); }
});

test('following：PUT 整对象 → GET 回读一致；再次 PUT 全量替换（旧项删除）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('d@x.com');
    // v0.2.21.0：users 为 id 引用（017 迁移）——遗留显示名被服务端静默过滤
    const target = t.seedUser({ email: 'target@x.com', displayName: 'Marcus Vane' });
    const put1 = await t.request('PUT', '/api/social/following',
      { nations: ['NAT-000001', 'NAT-000002'], topics: ['TOP-000001'], users: [target.id, 'Marcus Vane'] }, { cookie });
    assert.strictEqual(put1.status, 200);
    assert.strictEqual((await put1.json()).nations.length, 2);

    const get1 = await t.request('GET', '/api/social/following', undefined, { cookie });
    assert.deepStrictEqual(await get1.json(), { nations: ['NAT-000001', 'NAT-000002'], topics: ['TOP-000001'], users: [target.id] });

    const put2 = await t.request('PUT', '/api/social/following', { nations: ['NAT-000003'] }, { cookie });
    assert.strictEqual(put2.status, 200);
    const get2 = await t.request('GET', '/api/social/following', undefined, { cookie });
    assert.deepStrictEqual(await get2.json(), { nations: ['NAT-000003'], topics: [], users: [] });
    // 各用户相互隔离
    const { cookie: cookie2 } = t.loginAs('e@x.com');
    assert.deepStrictEqual(await (await t.request('GET', '/api/social/following', undefined, { cookie: cookie2 })).json(),
      { nations: [], topics: [], users: [] });
  } finally { await t.close(); }
});

test('写限流：默认 30/min/用户（覆盖 socialWrite 为 2 → 第 3 次 429）', async () => {
  const t = await testApp({ config: { rateLimits: { socialWrite: { max: 2, windowMs: 60000 } } } });
  try {
    const { cookie } = t.loginAs('f@x.com');
    assert.strictEqual((await t.request('POST', '/api/social/nations', { name: 'N1' }, { cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/social/nations', { name: 'N2' }, { cookie })).status, 200);
    const third = await t.request('POST', '/api/social/nations', { name: 'N3' }, { cookie });
    assert.strictEqual(third.status, 429);
    assert.strictEqual((await third.json()).error.code, 'RATE_LIMITED');
    // 读操作不受写限流影响
    assert.strictEqual((await t.request('GET', '/api/social/nations')).status, 200);
  } finally { await t.close(); }
});
