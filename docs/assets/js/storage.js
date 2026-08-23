/**
 * M.NationWorld localStorage data layer.
 * Simulates a backend for the static demo.
 */
var SlatiDB = (function () {
  'use strict';

  var KEYS = {
    USER: 'slati_user',
    SESSION: 'slati_session',
    NATION: 'slati_nation_draft',
    NATIONS: 'slati_nations',
    WORLD: 'slati_world_draft',
    WORLDS: 'slati_worlds',
    TOPICS: 'slati_topics',
    POSTS: 'slati_posts',
    TEAMS: 'slati_teams',
    ACTIVE_ACCOUNT: 'slati_active_account',
    MESSAGES: 'slati_messages',
    ONBOARDING_STEP: 'slati_onboarding_step',
    REGISTRY_STEP: 'slati_registry_step',
    FOLLOWING: 'slati_following',
  };

  function get(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('SlatiDB: failed to write', key, e);
      return false;
    }
  }

  function remove(key) {
    localStorage.removeItem(key);
  }

  // --- User ---
  function saveUser(user) {
    set(KEYS.USER, user);
    set(KEYS.SESSION, { loggedIn: true, at: new Date().toISOString() });
    mirrorProfile(user); // 云端镜像 PATCH /me（demo 用户自动跳过）
  }

  function getUser() {
    return get(KEYS.USER);
  }

  function isLoggedIn() {
    var s = get(KEYS.SESSION);
    return !!(s && s.loggedIn);
  }

  function logout() {
    mirrorLogout(); // 云端会话一并失效（demo 用户自动跳过）
    remove(KEYS.SESSION);
  }

  // --- Nation Draft (multi-step form) ---
  function saveNationDraft(step, data) {
    var draft = get(KEYS.NATION) || { steps: {} };
    draft.steps[step] = data;
    draft.currentStep = step;
    draft.updatedAt = new Date().toISOString();
    set(KEYS.NATION, draft);
  }

  function getNationDraft() {
    return get(KEYS.NATION);
  }

  function submitNation() {
    var draft = get(KEYS.NATION);
    if (!draft) return null;
    var nations = get(KEYS.NATIONS) || [];
    var nation = {
      id: 'NAT-' + Date.now(),
      name: draft.steps[1] ? draft.steps[1].name : 'Unnamed Nation',
      moniker: draft.steps[1] ? draft.steps[1].moniker : '',
      classification: draft.steps[1] ? draft.steps[1].classification : 'Sovereign Nation',
      capital: draft.steps[2] ? draft.steps[2].capital : '',
      established: draft.steps[2] ? draft.steps[2].established : '',
      lore: draft.steps[2] ? draft.steps[2].lore : '',
      sectors: draft.steps[3] ? draft.steps[3].sectors : {},
      demographics: draft.steps[3] ? draft.steps[3].demographics : {},
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    nations.push(nation);
    set(KEYS.NATIONS, nations);
    mirrorNation(nation); // 云端镜像：服务端 id 回写（demo 用户自动跳过）
    remove(KEYS.NATION);
    remove(KEYS.REGISTRY_STEP);
    return nation;
  }

  function getNations() {
    return get(KEYS.NATIONS) || [];
  }

  // --- World Draft (multi-step, per-type) ---
  // 22 种世界类型共用一个草稿位：换类型即覆盖（一次只创建一界）
  function saveWorldDraft(typeKey, step, data) {
    var draft = get(KEYS.WORLD) || { steps: {} };
    draft.typeKey = typeKey;
    draft.steps[step] = data;
    draft.currentStep = step;
    draft.updatedAt = new Date().toISOString();
    set(KEYS.WORLD, draft);
  }

  function getWorldDraft() {
    return get(KEYS.WORLD);
  }

  function submitWorld(record) {
    var worlds = get(KEYS.WORLDS) || [];
    record.id = 'WLD-' + Date.now();
    record.createdAt = new Date().toISOString();
    record.status = 'active';
    worlds.push(record);
    set(KEYS.WORLDS, worlds);
    remove(KEYS.WORLD);
    // 无云端镜像：后端 /social/worlds 端点未建（与 mirrorNation 同理，待后端批次）
    return record;
  }

  function getWorlds() {
    return get(KEYS.WORLDS) || [];
  }

  // --- Topics ---
  function saveTopic(topic) {
    var topics = get(KEYS.TOPICS) || [];
    topic.id = 'TOP-' + Date.now();
    topic.createdAt = new Date().toISOString();
    topic.memberCount = 1;
    topics.push(topic);
    set(KEYS.TOPICS, topics);
    mirrorTopic(topic); // 云端镜像：服务端 id 回写（demo 用户自动跳过）
    return topic;
  }

  function getTopics() {
    return get(KEYS.TOPICS) || [];
  }

  // --- Onboarding / Registry step tracking ---
  function getOnboardingStep() {
    return get(KEYS.ONBOARDING_STEP) || 0;
  }
  function setOnboardingStep(step) {
    set(KEYS.ONBOARDING_STEP, step);
  }
  function getRegistryStep() {
    return get(KEYS.REGISTRY_STEP) || 1;
  }
  function setRegistryStep(step) {
    set(KEYS.REGISTRY_STEP, step);
  }

  // --- Teams ---
  function getTeams() { return get(KEYS.TEAMS) || []; }
  function getActiveAccount() { return get(KEYS.ACTIVE_ACCOUNT) || 'personal'; }
  function setActiveAccount(id) { set(KEYS.ACTIVE_ACCOUNT, id); }

  // --- Seed demo data if empty ---
  function seedIfEmpty() {
    if (!get(KEYS.NATIONS)) {
      set(KEYS.NATIONS, [
        {
          id: 'NAT-demo-1',
          name: 'Republic of Etheria',
          moniker: 'Etheria',
          classification: 'Sovereign Nation',
          capital: 'Aether Prime',
          established: '2024-03-15',
          lore: 'A digital-first sovereign entity founded on principles of transparent governance and technological innovation.',
          sectors: { industrial: 25, agricultural: 10, technological: 35, tourism: 10, resourceExport: 10, financial: 10 },
          demographics: { population: '12,400,000', military: '85,000', territory: '427,000', gdp: '892,000,000,000' },
          createdAt: '2024-03-15T00:00:00Z',
          status: 'active',
        },
        {
          id: 'NAT-demo-2',
          name: 'Kingdom of Aethelgard',
          moniker: 'Aethelgard',
          classification: 'Sovereign Nation',
          capital: 'Thornhaven',
          established: '2024-01-08',
          lore: 'A constitutional monarchy blending medieval traditions with cutting-edge renewable energy research.',
          sectors: { industrial: 30, agricultural: 25, technological: 15, tourism: 15, resourceExport: 5, financial: 10 },
          demographics: { population: '8,900,000', military: '120,000', territory: '312,000', gdp: '567,000,000,000' },
          createdAt: '2024-01-08T00:00:00Z',
          status: 'active',
        },
        {
          id: 'NAT-demo-3',
          name: 'Neo-Venice Collective',
          moniker: 'Neo-Venice',
          classification: 'Sovereign Nation',
          capital: 'Aqua Centro',
          established: '2024-06-22',
          lore: 'A floating-city federation in the Adriatic, pioneering marine sustainability and aquatic urbanism.',
          sectors: { industrial: 10, agricultural: 5, technological: 30, tourism: 35, resourceExport: 5, financial: 15 },
          demographics: { population: '5,200,000', military: '45,000', territory: '89,000', gdp: '445,000,000,000' },
          createdAt: '2024-06-22T00:00:00Z',
          status: 'active',
        },
      ]);
    }
    if (!get(KEYS.TOPICS)) {
      set(KEYS.TOPICS, [
        { id: 'TOP-demo-1', name: 'Digital Sovereignty Protocols', description: 'Standards and frameworks for digital-first micronations', category: 'Governance', memberCount: 1240, createdAt: '2024-02-01T00:00:00Z' },
        { id: 'TOP-demo-2', name: 'Lore Manifest', description: 'Collaborative worldbuilding narratives and shared universes', category: 'Art', memberCount: 856, createdAt: '2024-02-15T00:00:00Z' },
        { id: 'TOP-demo-3', name: 'Neo-Venice Updates', description: 'Official updates from the Neo-Venice Collective', category: 'Social', memberCount: 2100, createdAt: '2024-03-01T00:00:00Z' },
        { id: 'TOP-demo-4', name: 'Governance Design Lab', description: 'Experimenting with novel political systems and constitutions', category: 'Governance', memberCount: 3400, createdAt: '2024-01-10T00:00:00Z' },
      ]);
    }
  }

  // --- Following ---
  function getFollowing() {
    return get(KEYS.FOLLOWING) || { nations: [], topics: [], users: [] };
  }
  function saveFollowing(data) {
    set(KEYS.FOLLOWING, data);
    mirrorFollowing(data); // 云端镜像：整对象 PUT（demo 用户自动跳过）
  }

  function seedFollowing() {
    if (!get(KEYS.FOLLOWING)) {
      set(KEYS.FOLLOWING, {
        nations: ['NAT-demo-1', 'NAT-demo-2', 'NAT-demo-3'],
        topics: ['TOP-demo-1', 'TOP-demo-4'],
        users: ['Marcus Vane', 'Lena Hartmann', 'Kai Zhang'],
      });
    }
  }

  // --- Seed teams ---
  function seedTeams() {
    if (!get(KEYS.TEAMS)) {
      set(KEYS.TEAMS, [
        {
          id: 'team-1',
          name: 'Etheria Editorial Board',
          avatar: 'EE',
          color: '#4648d4',
          role: 'Admin',
          members: 8,
          nations: ['Republic of Etheria'],
        },
        {
          id: 'team-2',
          name: 'Cartography Guild',
          avatar: 'CG',
          color: '#8127cf',
          role: 'Editor',
          members: 15,
          nations: ['Kingdom of Aethelgard'],
        },
        {
          id: 'team-3',
          name: 'Lore Keepers',
          avatar: 'LK',
          color: '#16a34a',
          role: 'Contributor',
          members: 6,
          nations: ['Neo-Venice Collective'],
        },
      ]);
    }
  }

  // ── 云端镜像（P3 混合模式）──────────────────────────────────────────
  // 原则：localStorage 仍是运行时唯一事实来源，HTTP 仅旁路镜像——
  // 写 = 先同步写本地再 fire-and-forget 云端（失败静默，离线自然降级）；
  // 读 = 模块加载时后台 GET 按 id 合并（云端优先，本地未同步保留）。
  // 仅当本地用户是云端账号（id 以 USR- 开头）且后端可达时才发请求：
  // demo 用户零 API 调用，杜绝服务端 401 误清本地演示会话。
  function hasCloudUser() {
    var u = get(KEYS.USER);
    return !!(u && u.id && String(u.id).indexOf('USR-') === 0);
  }

  function apiScriptSrc() {
    return (window.location.pathname.indexOf('/pages/') >= 0 ? '../' : '') + 'assets/js/api.js';
  }

  // 确保 MN_API 可用后回调：已加载直接用；页面有 api.js 标签但未执行完 → 挂 load；
  // 都没有 → 动态注入（storage.js 被 38 页引用，api.js 仅首页静态引入）。
  function ensureApi(cb) {
    if (window.MN_API) { cb(window.MN_API); return; }
    if (!window.document) return;
    var tag = window.document.querySelector('script[src$="api.js"]');
    if (tag) { tag.addEventListener('load', function () { cb(window.MN_API); }); return; }
    var s = window.document.createElement('script');
    s.src = apiScriptSrc();
    s.onload = function () { cb(window.MN_API); };
    window.document.head.appendChild(s);
  }

  function whenUp(cb) {
    ensureApi(function (api) {
      api.probe().then(function (up) { if (up) cb(api); });
    });
  }

  function mergeById(remote, local) {
    var map = {};
    (remote || []).forEach(function (x) { if (x && x.id) map[x.id] = x; });           // 云端优先
    (local || []).forEach(function (x) { if (x && x.id && !map[x.id]) map[x.id] = x; }); // 本地未同步保留
    var out = [];
    for (var k in map) out.push(map[k]);
    return out;
  }

  function unionStrings(a, b) {
    var seen = {};
    (a || []).concat(b || []).forEach(function (x) { if (x) seen[x] = true; });
    return Object.keys(seen);
  }

  function mergeInto(api, key, path, field) {
    api.get(path).then(function (r) {
      if (!r.ok || !r.data || !Array.isArray(r.data[field])) return;
      set(key, mergeById(r.data[field], get(key) || []));
    });
  }

  function mergeFollowing(api) {
    api.get('/social/following').then(function (r) {
      if (!r.ok || !r.data) return;
      var local = getFollowing();
      set(KEYS.FOLLOWING, {
        nations: unionStrings(r.data.nations, local.nations),
        topics: unionStrings(r.data.topics, local.topics),
        users: unionStrings(r.data.users, local.users),
      });
    });
  }

  // 模块加载：后台 GET 合并 nations/topics/teams/following；/me 权威覆盖本地用户
  //（服务端 401 由 api.js 派发 mn:unauthorized → bindAuthEvents 清本地会话）。
  function cloudMerge() {
    if (!hasCloudUser()) return;
    whenUp(function (api) {
      mergeInto(api, KEYS.NATIONS, '/social/nations', 'nations');
      mergeInto(api, KEYS.TOPICS, '/social/topics', 'topics');
      mergeInto(api, KEYS.TEAMS, '/social/teams', 'teams');
      mergeFollowing(api);
      api.get('/auth/me').then(function (r) {
        if (r.ok && r.data && r.data.user) set(KEYS.USER, r.data.user);
      });
    });
  }

  function mirrorProfile(user) {
    if (!hasCloudUser()) return;
    whenUp(function (api) {
      var body = {};
      ['displayName', 'avatarUrl', 'language', 'country', 'dob', 'bio'].forEach(function (k) {
        if (user[k] != null) body[k] = user[k];
      });
      api.patch('/auth/me', body);
    });
  }

  // 服务端 id 回写：按本地临时 id（NAT-+Date.now()）定位并整体替换
  function mirrorNation(nation) {
    if (!hasCloudUser()) return;
    whenUp(function (api) {
      api.post('/social/nations', nation).then(function (r) {
        if (!r.ok || !r.data || !r.data.nation) return;
        var list = get(KEYS.NATIONS) || [];
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].id === nation.id) list[i] = r.data.nation;
        }
        set(KEYS.NATIONS, list);
      });
    });
  }

  function mirrorTopic(topic) {
    if (!hasCloudUser()) return;
    whenUp(function (api) {
      api.post('/social/topics', topic).then(function (r) {
        if (!r.ok || !r.data || !r.data.topic) return;
        var list = get(KEYS.TOPICS) || [];
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].id === topic.id) list[i] = r.data.topic;
        }
        set(KEYS.TOPICS, list);
      });
    });
  }

  function mirrorFollowing(data) {
    if (!hasCloudUser()) return;
    whenUp(function (api) { api.request('/social/following', { method: 'PUT', body: data }); });
  }

  function mirrorLogout() {
    if (!hasCloudUser()) return;
    whenUp(function (api) { api.post('/auth/logout'); });
  }

  // 服务端会话失效 → 清本地会话；demo 用户（无 USR- id）不受影响
  function bindAuthEvents() {
    if (!window.addEventListener) return;
    window.addEventListener('mn:unauthorized', function () {
      if (hasCloudUser()) remove(KEYS.SESSION);
    });
  }

  // --- Init ---
  seedIfEmpty();
  seedTeams();
  seedFollowing();
  bindAuthEvents();
  cloudMerge();

  return {
    KEYS: KEYS,
    get: get,
    set: set,
    remove: remove,
    saveUser: saveUser,
    getUser: getUser,
    isLoggedIn: isLoggedIn,
    logout: logout,
    saveNationDraft: saveNationDraft,
    getNationDraft: getNationDraft,
    submitNation: submitNation,
    getNations: getNations,
    saveWorldDraft: saveWorldDraft,
    getWorldDraft: getWorldDraft,
    submitWorld: submitWorld,
    getWorlds: getWorlds,
    saveTopic: saveTopic,
    getTopics: getTopics,
    getTeams: getTeams,
    getActiveAccount: getActiveAccount,
    setActiveAccount: setActiveAccount,
    getOnboardingStep: getOnboardingStep,
    setOnboardingStep: setOnboardingStep,
    getRegistryStep: getRegistryStep,
    setRegistryStep: setRegistryStep,
    getFollowing: getFollowing,
    saveFollowing: saveFollowing,
  };
})();
