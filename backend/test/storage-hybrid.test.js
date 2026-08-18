'use strict';
// storage.js 混合模式单测：在 vm 沙箱内加载真实浏览器 IIFE（localStorage/window/MN_API 桩），
// 断言「本地为主 + 异步镜像」语义：同步函数面不变、demo 用户零 API、云端写回、合并规则、401 清会话。
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'assets', 'js', 'storage.js'), 'utf8');
const flush = () => new Promise((r) => setImmediate(r));

// 假 MN_API：记录全部调用，响应由 results 表驱动
function makeApi(results) {
  const calls = [];
  const respond = (method, p) => results[`${method} ${p}`] || { ok: false, status: 404, data: null };
  return {
    calls,
    probe: () => Promise.resolve(true),
    get: (p) => { calls.push(['GET', p]); return Promise.resolve(respond('GET', p)); },
    post: (p, b) => { calls.push(['POST', p, b]); return Promise.resolve(respond('POST', p)); },
    patch: (p, b) => { calls.push(['PATCH', p, b]); return Promise.resolve(respond('PATCH', p)); },
    request: (p, o) => { calls.push([o.method, p, o.body]); return Promise.resolve(respond(o.method, p)); },
  };
}

// 加载 storage.js（预置 localStorage 内容 → 沙箱全局）
function loadStorage(seed = {}, api) {
  const store = new Map(Object.entries(seed));
  const listeners = {};
  const windowStub = {
    MN_API: api,
    document: { querySelector: () => null, createElement: () => ({}), head: { appendChild() {} } },
    location: { pathname: '/index.html' },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const sandbox = {
    window: windowStub,
    document: windowStub.document,
    location: windowStub.location,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, v); },
      removeItem: (k) => { store.delete(k); },
    },
    console: { warn() {}, log() {} },
  };
  vm.runInNewContext(SRC, sandbox, { filename: 'storage.js' });
  return {
    DB: sandbox.SlatiDB,
    store,
    dispatch: (type) => listeners[type] && listeners[type](),
    calls: api ? api.calls : [],
  };
}

const CLOUD_USER = { id: 'USR-000001', displayName: 'Ada', email: 'ada@x.com', citizenId: 'CIT-000042', avatarUrl: 'https://ui-avatars.com/api/?name=Ada' };

test('demo 用户（无 USR- id）：saveUser/saveTopic 零 API 调用；401 不清本地会话', async () => {
  const api = makeApi({});
  const t = loadStorage({}, api);
  t.DB.saveUser({ displayName: 'Demo', email: 'd@x.com', citizenId: 'CIT-1234' });
  t.DB.saveTopic({ name: 'Demo Topic' });
  await flush();
  assert.strictEqual(t.calls.length, 0, 'demo 用户不发任何镜像请求');
  t.dispatch('mn:unauthorized');
  assert.strictEqual(t.DB.isLoggedIn(), true, 'demo 会话不受服务端 401 影响');
});

test('submitNation：同步返回本地临时 id；POST 后服务端 id 回写（公开语义不变）', async () => {
  const api = makeApi({
    'GET /social/nations': { ok: true, status: 200, data: { nations: [] } },
    'GET /social/topics': { ok: true, status: 200, data: { topics: [] } },
    'GET /social/teams': { ok: true, status: 200, data: { teams: [] } },
    'GET /social/following': { ok: true, status: 200, data: { nations: [], topics: [], users: [] } },
    'GET /auth/me': { ok: true, status: 200, data: { user: CLOUD_USER } },
    'POST /social/nations': { ok: true, status: 200, data: { nation: { id: 'NAT-000042', name: 'Testland', createdAt: '2026-08-18T12:00:00.000Z', status: 'active' } } },
  });
  const t = loadStorage({ slati_user: JSON.stringify(CLOUD_USER) }, api);
  await flush(); // 模块加载合并完成

  t.DB.saveNationDraft(1, { name: 'Testland', moniker: 'TL' });
  const nation = t.DB.submitNation(); // 同步返回
  assert.match(nation.id, /^NAT-\d{13}$/, '同步返回本地临时 id（语义不变）');
  await flush();
  const post = t.calls.find((c) => c[0] === 'POST' && c[1] === '/social/nations');
  assert.ok(post, '发起云端 POST');
  assert.strictEqual(post[2].name, 'Testland');
  const list = t.DB.getNations();
  assert.ok(list.some((n) => n.id === 'NAT-000042'), '服务端 id 已回写替换本地临时 id');
  assert.ok(!list.some((n) => n.id === nation.id), '本地临时 id 不再存在');
  assert.ok(list.some((n) => n.id === 'NAT-demo-1'), '种子保留为离线兜底');
});

test('镜像失败静默：POST 非 ok → 本地列表原样、无异常', async () => {
  const api = makeApi({
    'GET /social/nations': { ok: true, status: 200, data: { nations: [] } },
    'POST /social/nations': { ok: false, status: 401, data: null },
  });
  const t = loadStorage({ slati_user: JSON.stringify(CLOUD_USER) }, api);
  await flush();
  t.DB.saveNationDraft(1, { name: 'OfflineLand' });
  const nation = t.DB.submitNation();
  await flush();
  const list = t.DB.getNations();
  assert.ok(list.some((n) => n.id === nation.id), '401 时本地条目保留（离线降级）');
  assert.strictEqual(list.filter((n) => n.name === 'OfflineLand').length, 1);
});

test('saveTopic：POST 携带本地内容，回写 memberCount=1 服务端对象', async () => {
  const api = makeApi({
    'POST /social/topics': { ok: true, status: 200, data: { topic: { id: 'TOP-000007', name: 'Maps', description: 'd', category: 'Culture', memberCount: 1, createdAt: '2026-08-18T12:00:00.000Z' } } },
  });
  const t = loadStorage({ slati_user: JSON.stringify(CLOUD_USER) }, api);
  await flush();
  const topic = t.DB.saveTopic({ name: 'Maps', description: 'd', category: 'Culture' });
  assert.match(topic.id, /^TOP-\d{13}$/, '同步语义：本地 TOP-+Date.now() 即返');
  await flush();
  assert.ok(t.DB.getTopics().some((x) => x.id === 'TOP-000007'));
});

test('saveUser：PATCH /auth/me 只携带存在的字段', async () => {
  const api = makeApi({});
  const t = loadStorage({ slati_user: JSON.stringify(CLOUD_USER) }, api);
  await flush();
  t.DB.saveUser({ id: 'USR-000001', displayName: 'Ada Prime', avatarUrl: CLOUD_USER.avatarUrl });
  await flush();
  const patch = t.calls.find((c) => c[0] === 'PATCH' && c[1] === '/auth/me');
  assert.ok(patch, '发起云端 PATCH');
  assert.deepEqual(patch[2], { displayName: 'Ada Prime', avatarUrl: CLOUD_USER.avatarUrl }); // vm 跨 realm：深比较不看原型
});

test('logout：本地清会话 + POST /auth/logout；401 事件也清云用户本地会话', async () => {
  const api = makeApi({});
  const t = loadStorage({ slati_user: JSON.stringify(CLOUD_USER), slati_session: JSON.stringify({ loggedIn: true }) }, api);
  assert.strictEqual(t.DB.isLoggedIn(), true);
  t.DB.logout();
  await flush();
  assert.strictEqual(t.DB.isLoggedIn(), false);
  assert.ok(t.calls.some((c) => c[0] === 'POST' && c[1] === '/auth/logout'));

  t.DB.set(t.DB.KEYS.SESSION, { loggedIn: true, at: new Date().toISOString() });
  t.dispatch('mn:unauthorized');
  assert.strictEqual(t.DB.isLoggedIn(), false, '云用户会话被服务端 401 清除');
});

test('加载合并：云端优先、本地未同步保留；/me 权威覆盖本地用户', async () => {
  const api = makeApi({
    'GET /social/nations': { ok: true, status: 200, data: { nations: [{ id: 'NAT-local-1', name: '云端版' }, { id: 'NAT-cloud-1', name: '新云端' }] } },
    'GET /social/topics': { ok: true, status: 200, data: { topics: [] } },
    'GET /social/teams': { ok: true, status: 200, data: { teams: [{ id: 'team-1', name: '服务端种子版' }] } },
    'GET /social/following': { ok: true, status: 200, data: { nations: ['NAT-000001'], topics: ['TOP-000001'], users: ['云端某人'] } },
    'GET /auth/me': { ok: true, status: 200, data: { user: { ...CLOUD_USER, displayName: '服务端新名' } } },
  });
  const t = loadStorage({
    slati_user: JSON.stringify(CLOUD_USER),
    slati_nations: JSON.stringify([{ id: 'NAT-local-1', name: '旧名' }, { id: 'NAT-only-local', name: '本地未同步' }]),
    slati_following: JSON.stringify({ nations: ['NAT-000001', 'NAT-demo-1'], topics: [], users: ['Marcus Vane'] }),
  }, api);
  await flush();

  const nations = t.DB.getNations();
  const byId = Object.fromEntries(nations.map((n) => [n.id, n]));
  assert.strictEqual(byId['NAT-local-1'].name, '云端版', '冲突时云端优先');
  assert.ok(byId['NAT-cloud-1'], '云端新条目合并进来');
  assert.ok(byId['NAT-only-local'], '本地未同步条目保留');

  const teams = t.DB.getTeams();
  assert.strictEqual(teams.find((x) => x.id === 'team-1').name, '服务端种子版');

  const f = t.DB.getFollowing();
  assert.deepEqual(f.nations.slice().sort(), ['NAT-000001', 'NAT-demo-1'].sort(), 'following 并集');
  assert.deepEqual(f.users.slice().sort(), ['Marcus Vane', '云端某人'].sort());

  assert.strictEqual(t.DB.getUser().displayName, '服务端新名', '/me 权威覆盖本地');
});

test('saveFollowing：整对象 PUT 云端', async () => {
  const api = makeApi({});
  const t = loadStorage({ slati_user: JSON.stringify(CLOUD_USER) }, api);
  await flush();
  const data = { nations: ['NAT-000001'], topics: [], users: [] };
  t.DB.saveFollowing(data);
  await flush();
  const put = t.calls.find((c) => c[0] === 'PUT' && c[1] === '/social/following');
  assert.ok(put, '发起云端 PUT');
  assert.deepEqual(put[2], data);
});

test('公开函数面不变（计划静态断言：38 页依赖不可破坏）', () => {
  const t = loadStorage({});
  const surface = Object.keys(t.DB).sort();
  assert.deepStrictEqual(surface, [
    'KEYS', 'get', 'getActiveAccount', 'getFollowing', 'getNationDraft', 'getNations',
    'getOnboardingStep', 'getRegistryStep', 'getTeams', 'getTopics', 'getUser',
    'isLoggedIn', 'logout', 'remove', 'saveFollowing', 'saveNationDraft', 'saveTopic',
    'saveUser', 'set', 'setActiveAccount', 'setOnboardingStep', 'setRegistryStep',
    'submitNation',
  ].sort(), 'storage.js 公开导出与 P2 基线完全一致');
});
