'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const STORAGE_SOURCE = fs.readFileSync(path.join(__dirname, '../../docs/assets/js/storage.js'), 'utf8');

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function storageHarness(options = {}) {
  const values = new Map();
  const user = options.cloud === false
    ? { id: 'demo-user', displayName: 'Demo' }
    : { id: 'USR-000001', displayName: 'Cloud User' };
  values.set('slati_user', JSON.stringify(user));
  values.set('slati_session', JSON.stringify({ loggedIn: true }));
  if (options.worlds) values.set('slati_worlds', JSON.stringify(options.worlds));

  const calls = [];
  let postHandler = options.post || (() => ({ ok: false, status: 0, data: null, networkError: true }));
  const listeners = {};
  class FakeCustomEvent {
    constructor(type, init) { this.type = type; this.detail = init && init.detail; }
  }
  const api = {
    probe: () => Promise.resolve(true),
    get: (requestPath) => {
      calls.push({ method: 'GET', path: requestPath });
      if (requestPath === '/social/worlds') return Promise.resolve({ ok: true, data: { worlds: options.remoteWorlds || [] } });
      if (requestPath === '/social/nations') return Promise.resolve({ ok: true, data: { nations: [] } });
      if (requestPath === '/social/topics') return Promise.resolve({ ok: true, data: { topics: [] } });
      if (requestPath === '/social/teams') return Promise.resolve({ ok: true, data: { teams: [] } });
      if (requestPath === '/social/following') return Promise.resolve({ ok: true, data: { nations: [], topics: [], users: [] } });
      if (requestPath === '/social/activity') return Promise.resolve({ ok: true, data: { days: [] } });
      if (requestPath === '/auth/me') return Promise.resolve({ ok: true, data: { user } });
      return Promise.resolve({ ok: false, status: 404, data: null });
    },
    post: (requestPath, body) => {
      calls.push({ method: 'POST', path: requestPath, body });
      return Promise.resolve(postHandler(requestPath, body));
    },
    patch: () => Promise.resolve({ ok: true, data: {} }),
    request: () => Promise.resolve({ ok: true, data: {} })
  };
  const sandbox = {
    console,
    Promise,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    parseInt,
    setTimeout,
    clearTimeout,
    CustomEvent: FakeCustomEvent,
    localStorage: {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key)
    },
    location: { pathname: '/pages/world-created.html' },
    MN_API: api,
    addEventListener: (type, listener) => {
      (listeners[type] || (listeners[type] = [])).push(listener);
    },
    dispatchEvent: (event) => {
      (listeners[event.type] || []).forEach((listener) => listener(event));
      return true;
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(STORAGE_SOURCE, sandbox, { filename: 'storage.js' });
  await tick();
  await tick();
  return {
    db: sandbox.SlatiDB,
    calls,
    setPostHandler: (handler) => { postHandler = handler; }
  };
}

test('storage submitWorld: 游客同步本地保存，不请求 worlds API', async () => {
  const h = await storageHarness({ cloud: false });
  const saved = h.db.submitWorld({ type: 'fantasy', name: '本地世界', lore: '离线可用' });
  assert.match(saved.id, /^WLD-LOCAL-/);
  assert.match(saved.clientKey, /^world-/);
  assert.strictEqual(saved.cloudSync, 'local');
  assert.strictEqual(h.db.getWorlds().at(-1).name, '本地世界');
  assert.strictEqual(h.calls.filter((call) => call.path === '/social/worlds').length, 0);
});

test('storage submitWorld: 云账号先返回 pending，成功后回写服务端 id', async () => {
  const h = await storageHarness({
    post: (requestPath, body) => ({
      ok: true,
      data: {
        world: {
          ...body.metadata,
          id: 'WLD-000321', type: body.type, name: body.name,
          description: body.description, lore: body.description,
          clientKey: body.clientKey, status: 'active',
          createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z'
        }
      }
    })
  });
  const saved = h.db.submitWorld({ type: 'scifi', typeLabel: '科幻世界', emoji: '🚀', name: '轨道城', lore: '云端同步' });
  assert.strictEqual(saved.cloudSync, 'pending');
  assert.match(saved.id, /^WLD-LOCAL-/);
  await tick();
  await tick();
  const synced = h.db.getWorlds().at(-1);
  assert.strictEqual(synced.id, 'WLD-000321');
  assert.strictEqual(synced.cloudSync, 'synced');
  assert.strictEqual(synced.typeLabel, '科幻世界');
  const request = h.calls.find((call) => call.method === 'POST' && call.path === '/social/worlds');
  assert.strictEqual(request.body.metadata.emoji, '🚀');
  assert.strictEqual(request.body.clientKey, saved.clientKey);
});

test('storage retryWorldSync: 失败保留本地记录，重试成功再替换 id', async () => {
  const h = await storageHarness();
  const saved = h.db.submitWorld({ type: 'utopia', name: '重试世界', lore: '先离线' });
  await tick();
  await tick();
  const failed = h.db.getWorlds().at(-1);
  assert.strictEqual(failed.id, saved.id);
  assert.strictEqual(failed.cloudSync, 'failed');
  assert.match(failed.cloudSyncError, /保存在此设备/);

  h.setPostHandler((requestPath, body) => ({
    ok: true,
    data: { world: { id: 'WLD-000654', type: body.type, name: body.name, lore: body.description,
      description: body.description, clientKey: body.clientKey, status: 'active',
      createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z' } }
  }));
  await h.db.retryWorldSync(saved.clientKey);
  const synced = h.db.getWorlds().at(-1);
  assert.strictEqual(synced.id, 'WLD-000654');
  assert.strictEqual(synced.cloudSync, 'synced');
  assert.strictEqual(synced.cloudSyncError, undefined);
});

test('storage cloud merge: 相同 clientKey 的云端与本地世界只保留一份', async () => {
  const local = {
    id: 'WLD-LOCAL-1', clientKey: 'world-dedupe-0001', type: 'fantasy', name: '同一世界',
    typeLabel: '奇幻世界', createdAt: '2026-10-13T00:00:00.000Z', cloudSync: 'pending'
  };
  const remote = {
    id: 'WLD-000777', clientKey: local.clientKey, type: 'fantasy', name: '同一世界',
    typeLabel: '奇幻世界', createdAt: '2026-10-13T00:00:00.000Z', status: 'active'
  };
  const duplicate = { ...local, id: 'WLD-LOCAL-2' };
  const h = await storageHarness({ worlds: [local, duplicate], remoteWorlds: [remote] });
  assert.strictEqual(h.db.getWorlds().length, 1);
  assert.strictEqual(h.db.getWorlds()[0].id, 'WLD-000777');
  assert.strictEqual(h.db.getWorlds()[0].cloudSync, 'synced');
});
