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
    XP: 'slati_xp',
    XP_LAST_LOGIN: 'slati_xp_last_login',
    XP_GAINED: 'slati_xp_gained',               // 获得类 XP（后端实时记，登录/刷新同步）
    XP_TOPIC_PENDING: 'slati_xp_topic_pending', // 话题 30 天待结算队列 [{id, created}]
    ARTICLE_PUBLISHED: 'slati_article_published', // 文章草稿已发布旗（新 +120 / 更新 +5 判定）
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
    if (user && user.xpGained != null) syncXPGained(user.xpGained); // 获得类经验同步（后端实时记）
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
    // 登出清获得类经验与待结算队列：换号后旧账号的获得经验不得混入新账号徽章
    remove(KEYS.XP_GAINED);
    remove(KEYS.XP_TOPIC_PENDING);
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
    addXP('submit_nation', 150);
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
    var now = new Date().toISOString();
    var local = {};
    Object.keys(record || {}).forEach(function (key) { local[key] = record[key]; });
    local.id = 'WLD-LOCAL-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    local.clientKey = local.clientKey || ('world-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
    local.createdAt = now;
    local.updatedAt = now;
    local.status = 'active';
    local.cloudSync = hasCloudUser() ? 'pending' : 'local';
    delete local.cloudSyncError;
    worlds.push(local);
    set(KEYS.WORLDS, worlds);
    remove(KEYS.WORLD);
    // 本地先落盘、界面立即完成；云端账号随后以 clientKey 幂等镜像。
    // 网络/API 失败会回写 failed，由完成页明确提示并允许重试。
    if (hasCloudUser()) mirrorWorld(local);
    addXP('submit_world', 150);
    return local;
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
    // v0.2.49.0 话题经验改 30 天结算：无立即奖励（旧 +5 移除），创建日入待结算队列，
    // 平台连续 30 个活跃日 + 话题满 30 天 → +25（settlePendingTopics 结算）。
    // 仅云端账号入队：demo 用户无后端活动数据可查，且防队列无限增长。
    if (hasCloudUser()) {
      var pending = get(KEYS.XP_TOPIC_PENDING) || [];
      pending.push({ id: topic.id, created: new Date().toISOString().slice(0, 10) });
      set(KEYS.XP_TOPIC_PENDING, pending);
    }
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
    var prev = get(KEYS.ONBOARDING_STEP) || 0;
    set(KEYS.ONBOARDING_STEP, step);
    if (prev < 3 && step >= 3) addXP('onboarding_done', 10); // 引导完成（step≥3 跨越）一次性 +10（v0.2.48.0 重平衡 50→10）
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

  // --- 用户等级（活跃 XP）──────────────────────────────────────────
  // 等级靠活跃、会员靠订阅——两套并行系统（本模块只管 XP 等级，tier 由订阅状态机管）。
  // v0.2.49.0 双轨：动作类 XP 仍走本地 addXP（既有体系）；获得类 XP（粉丝/赞/评论/收藏）
  // 后端实时记 users.xp_gained（迁移 023），登录/刷新经 syncXPGained 带回，
  // getLevelState 内部用合计判定——等级表/徽章/进度条公式零改动。
  // v0.2.48.0 重平衡（用户新数值表）：12 级、need 累计阈值 0/1200/2400/4800/9600/19200/38400/76800/153600/307200/614400/1228800；
  // 0 经验即 Lv1（问询钦定）；Lv11 皇帝/Lv12 传奇为新称号（前 10 沿用）。
  var LEVELS = [
    { lv: 1, name: '旅行者', need: 0 },
    { lv: 2, name: '拓荒者', need: 1200 },
    { lv: 3, name: '公民', need: 2400 },
    { lv: 4, name: '建城者', need: 4800 },
    { lv: 5, name: '镇长', need: 9600 },
    { lv: 6, name: '总督', need: 19200 },
    { lv: 7, name: '外交官', need: 38400 },
    { lv: 8, name: '首相', need: 76800 },
    { lv: 9, name: '元首', need: 153600 },
    { lv: 10, name: '君主', need: 307200 },
    { lv: 11, name: '皇帝', need: 614400 },
    { lv: 12, name: '传奇', need: 1228800 },
  ];

  function getXP() {
    var v = get(KEYS.XP);
    return (typeof v === 'number' && v >= 0) ? v : 0;
  }

  // 获得类 XP（后端实时记，登录/刷新同步）：坏值按 0（同 getXP 口径）
  function getXPGained() {
    var v = get(KEYS.XP_GAINED);
    return (typeof v === 'number' && v >= 0) ? v : 0;
  }

  // { xp, lv, name, need, nextNeed, progress, isMax }（max 级 nextNeed=need、progress=1）
  // v0.2.49.0：total = 本地动作 XP + 获得 XP（同步静默、异步回填——sidebar 每次渲染都取最新合计）
  function getLevelState() {
    var xp = getXP() + getXPGained();
    var lv = 1;
    for (var i = 0; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i].need) lv = LEVELS[i].lv;
    }
    var cur = LEVELS[lv - 1];
    var isMax = lv === LEVELS.length;
    var nextNeed = isMax ? cur.need : LEVELS[lv].need;
    return {
      xp: xp,
      lv: lv,
      name: cur.name,
      need: cur.need,
      nextNeed: nextNeed,
      progress: isMax ? 1 : Math.min(1, (xp - cur.need) / (nextNeed - cur.need)),
      isMax: isMax,
    };
  }

  // v10.28.52.0 团队等级（等级奖励）：阈值=个人 ×1.5（用户钦定「团队 12 级×1.5」）。
  // 团队 XP 全记后端 teams.xp_gained（上传24/赞16/粉丝32/收藏36/分享20，少一个同额收走），
  // 前端只做纯函数换算显示——getTeamLevelState(xp) 供 fluidcanvas 团队频道页/奖励清单用。
  var TEAM_LEVELS = [0, 1800, 3600, 7200, 14400, 28800, 57600, 115200, 230400, 460800, 921600, 1843200];
  function getTeamLevelState(xp) {
    xp = Math.max(0, parseInt(xp, 10) || 0);
    var lv = 1;
    for (var i = 0; i < TEAM_LEVELS.length; i++) {
      if (xp >= TEAM_LEVELS[i]) lv = i + 1;
    }
    var isMax = lv === TEAM_LEVELS.length;
    var nextNeed = isMax ? TEAM_LEVELS[lv - 1] : TEAM_LEVELS[lv];
    return {
      xp: xp,
      lv: lv,
      need: TEAM_LEVELS[lv - 1],
      nextNeed: nextNeed,
      progress: isMax ? 1 : Math.min(1, (xp - TEAM_LEVELS[lv - 1]) / (nextNeed - TEAM_LEVELS[lv - 1])),
      isMax: isMax,
    };
  }

  // 活跃事件加 XP：登录守卫（访客不计）、写失败静默返回 null（与 set 同口径）；
  // 广播 mn:xp-changed；跨级时补发 mn:level-up（携带升级前后等级）。
  function addXP(source, amount) {
    if (!isLoggedIn()) return null;
    amount = Math.max(0, parseInt(amount, 10) || 0);
    if (!amount) return null;
    var before = getLevelState();
    if (!set(KEYS.XP, getXP() + amount)) return null;
    var state = getLevelState();
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('mn:xp-changed', { detail: { source: source, amount: amount, state: state } }));
      if (state.lv > before.lv) {
        window.dispatchEvent(new CustomEvent('mn:level-up', { detail: { state: state, from: before } }));
      }
    }
    return state;
  }

  // 获得类 XP 同步（v0.2.49.0）：后端 xpGained 数值带回——与存量不同才写 + 广播，
  // 跨级照发 mn:level-up（detail 形状同 addXP，sidebar toast 读 state.lv）。
  function syncXPGained(n) {
    n = Math.max(0, parseInt(n, 10) || 0);
    var prev = getXPGained();
    if (prev === n) return null;
    var before = getLevelState();
    if (!set(KEYS.XP_GAINED, n)) return null;
    var state = getLevelState();
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('mn:xp-changed', { detail: { source: 'gained', amount: n - prev, state: state } }));
      if (state.lv > before.lv) {
        window.dispatchEvent(new CustomEvent('mn:level-up', { detail: { state: state, from: before } }));
      }
    }
    return state;
  }

  // 话题 30 天结算（v0.2.49.0 用户钦定）：平台连续 30 个活跃日 + 话题创建满 30 天 → 每话题 +25。
  // 活跃日定义（用户自定）：当天 ≥10 个不同用户各发至少一帖（平台热度门禁，days[].active 由后端判）。
  // 连续窗口结尾取「今天 active 则到今天，否则到昨天」——早上访问当天还没满 10 人发帖，
  // 硬以今天结尾会把 29 天连击清零；断档只延迟（不清零，滑动窗口）。日期全 UTC 串同域比对。
  function settlePendingTopics(days) {
    if (!Array.isArray(days) || !days.length) return;
    var pending = get(KEYS.XP_TOPIC_PENDING) || [];
    if (!pending.length) return;
    var todayUtc = new Date().toISOString().slice(0, 10);
    var lastIdx = days.length - 1;
    var endIdx = (days[lastIdx].date === todayUtc && days[lastIdx].active) ? lastIdx : lastIdx - 1;
    var streak = 0;
    for (var i = endIdx; i >= 0 && days[i].active; i--) streak += 1;
    if (streak < 30) return; // 连续活跃不足 30 天：队列原样保留，下次刷新再查
    var endDate = days[endIdx].date;
    var left = [];
    for (var j = 0; j < pending.length; j++) {
      var p = pending[j];
      // 话题满 30 天（以连续窗口结尾日起算）才发；没满的继续等
      if (Date.parse(endDate) - Date.parse(p.created) >= 30 * 86400 * 1000) {
        addXP('topic_sustained', 25);
      } else {
        left.push(p);
      }
    }
    set(KEYS.XP_TOPIC_PENDING, left);
  }

  // 每日登录奖励 +5（v0.2.48.0 重平衡 20→5；日期键防重复：当天只发一次）
  function grantDailyLoginBonus() {
    if (!isLoggedIn()) return null;
    var t = new Date();
    var key = t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
    if (get(KEYS.XP_LAST_LOGIN) === key) return null;
    set(KEYS.XP_LAST_LOGIN, key);
    return addXP('daily_login', 5);
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
  // 写 = 先同步写本地再 fire-and-forget 云端（worlds 会显式记录 pending/failed/synced）；
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
  function ensureApi(cb, onError) {
    if (window.MN_API) { cb(window.MN_API); return; }
    if (!window.document) { if (onError) onError(); return; }
    var tag = window.document.querySelector('script[src$="api.js"]');
    if (tag) {
      tag.addEventListener('load', function () {
        if (window.MN_API) cb(window.MN_API);
        else if (onError) onError();
      });
      if (onError) tag.addEventListener('error', onError);
      return;
    }
    var s = window.document.createElement('script');
    s.src = apiScriptSrc();
    s.onload = function () {
      if (window.MN_API) cb(window.MN_API);
      else if (onError) onError();
    };
    if (onError) s.onerror = onError;
    window.document.head.appendChild(s);
  }

  // 世界提交不能像普通旁路镜像那样静默失败：完成页需要一个确定的同步结果。
  function worldApi() {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error('API_LOAD_TIMEOUT'));
      }, 4000);
      function done(api) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (api && api.post) resolve(api);
        else reject(new Error('API_UNAVAILABLE'));
      }
      function fail() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error('API_UNAVAILABLE'));
      }
      ensureApi(done, fail);
    });
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

  function mergeWorldLists(remote, local) {
    var localByClient = {};
    var localById = {};
    var used = {};
    var out = [];
    (local || []).forEach(function (item, index) {
      if (!item) return;
      if (item.clientKey) localByClient[item.clientKey] = { item: item, index: index };
      if (item.id) localById[item.id] = { item: item, index: index };
    });
    (remote || []).forEach(function (serverWorld) {
      if (!serverWorld) return;
      var match = (serverWorld.clientKey && localByClient[serverWorld.clientKey]) ||
        (serverWorld.id && localById[serverWorld.id]);
      var merged = {};
      if (match) {
        Object.keys(match.item).forEach(function (key) { merged[key] = match.item[key]; });
      }
      // 旧版本/中断重试可能留下同 clientKey 的多个本地副本；云端一条应吞并全部副本。
      (local || []).forEach(function (item, index) {
        if (!item) return;
        if ((serverWorld.clientKey && item.clientKey === serverWorld.clientKey) ||
            (serverWorld.id && item.id === serverWorld.id)) used[index] = true;
      });
      Object.keys(serverWorld).forEach(function (key) { merged[key] = serverWorld[key]; });
      merged.cloudSync = 'synced';
      delete merged.cloudSyncError;
      out.push(merged);
    });
    (local || []).forEach(function (item, index) {
      if (item && !used[index]) out.push(item);
    });
    out.sort(function (a, b) {
      return String(a && a.createdAt || '').localeCompare(String(b && b.createdAt || ''));
    });
    return out;
  }

  function worldMetadata(record) {
    var reserved = {
      id: true, ownerId: true, type: true, name: true, description: true, lore: true,
      metadata: true, clientKey: true, status: true, createdAt: true, updatedAt: true,
      cloudSync: true, cloudSyncError: true
    };
    var meta = {};
    if (record && record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)) {
      Object.keys(record.metadata).forEach(function (key) { meta[key] = record.metadata[key]; });
    }
    Object.keys(record || {}).forEach(function (key) {
      if (!reserved[key]) meta[key] = record[key];
    });
    return meta;
  }

  function worldPayload(record) {
    return {
      type: record.type,
      name: record.name,
      description: record.description != null ? record.description : (record.lore || ''),
      clientKey: record.clientKey,
      metadata: worldMetadata(record)
    };
  }

  function findWorld(idOrClientKey) {
    var list = get(KEYS.WORLDS) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && (list[i].id === idOrClientKey || list[i].clientKey === idOrClientKey)) return list[i];
    }
    return null;
  }

  function updateWorldSync(target, patch) {
    var list = get(KEYS.WORLDS) || [];
    var updated = null;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item) continue;
      var matches = (target.clientKey && item.clientKey === target.clientKey) || item.id === target.id;
      if (!matches) continue;
      updated = {};
      Object.keys(item).forEach(function (key) { updated[key] = item[key]; });
      Object.keys(patch || {}).forEach(function (key) {
        if (patch[key] === undefined) delete updated[key];
        else updated[key] = patch[key];
      });
      list[i] = updated;
      break;
    }
    if (!updated) return null;
    set(KEYS.WORLDS, list);
    if (window.dispatchEvent && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('mn:world-sync', { detail: { world: updated } }));
    }
    return updated;
  }

  function worldSyncError(response) {
    if (response && response.data && response.data.error && response.data.error.message) {
      return String(response.data.error.message);
    }
    if (response && response.status === 401) return '登录已过期，请重新登录后重试';
    if (response && response.status === 429) return '操作过于频繁，请稍后重试';
    return '暂时无法连接云端，世界已安全保存在此设备';
  }

  function markWorldSyncFailed(target, message) {
    // GET 合并可能已确认同一 clientKey 在云端存在；较晚返回的旧 POST 网络错误不得把 synced 降级。
    var current = findWorld(target.clientKey || target.id);
    if (current && current.cloudSync === 'synced') return current;
    return updateWorldSync(target, {
      cloudSync: 'failed',
      cloudSyncError: message,
      updatedAt: new Date().toISOString()
    }) || target;
  }

  function mirrorWorld(record, apiOverride) {
    if (!record) return Promise.resolve(null);
    if (!hasCloudUser()) {
      return Promise.resolve(updateWorldSync(record, { cloudSync: 'local', cloudSyncError: undefined }) || record);
    }
    var pending = updateWorldSync(record, { cloudSync: 'pending', cloudSyncError: undefined }) || record;
    var apiPromise = apiOverride ? Promise.resolve(apiOverride) : worldApi();
    return apiPromise.then(function (api) {
      return api.post('/social/worlds', worldPayload(pending));
    }).then(function (response) {
      if (!response || !response.ok || !response.data || !response.data.world) {
        return markWorldSyncFailed(pending, worldSyncError(response));
      }
      var serverWorld = response.data.world;
      var patch = {};
      Object.keys(serverWorld).forEach(function (key) { patch[key] = serverWorld[key]; });
      patch.cloudSync = 'synced';
      patch.cloudSyncError = undefined;
      return updateWorldSync(pending, patch) || serverWorld;
    }).catch(function () {
      return markWorldSyncFailed(pending, '暂时无法连接云端，世界已安全保存在此设备');
    });
  }

  function retryWorldSync(idOrClientKey) {
    var world = findWorld(idOrClientKey);
    if (!world) return Promise.resolve(null);
    return mirrorWorld(world);
  }

  function syncPendingWorlds(api) {
    if (!hasCloudUser()) return;
    (get(KEYS.WORLDS) || []).forEach(function (world) {
      if (world && world.cloudSync === 'pending') mirrorWorld(world, api);
    });
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

  function mergeWorlds(api) {
    api.get('/social/worlds').then(function (r) {
      if (r.ok && r.data && Array.isArray(r.data.worlds)) {
        set(KEYS.WORLDS, mergeWorldLists(r.data.worlds, get(KEYS.WORLDS) || []));
      }
      syncPendingWorlds(api);
    }).catch(function () { syncPendingWorlds(api); });
  }

  // 模块加载：后台 GET 合并 nations/topics/teams/following；/me 权威覆盖本地用户
  //（服务端 401 由 api.js 派发 mn:unauthorized → bindAuthEvents 清本地会话）。
  function cloudMerge() {
    if (!hasCloudUser()) return;
    whenUp(function (api) {
      mergeInto(api, KEYS.NATIONS, '/social/nations', 'nations');
      mergeInto(api, KEYS.TOPICS, '/social/topics', 'topics');
      mergeInto(api, KEYS.TEAMS, '/social/teams', 'teams');
      mergeWorlds(api);
      mergeFollowing(api);
      api.get('/auth/me').then(function (r) {
        if (!r.ok || !r.data || !r.data.user) return;
        set(KEYS.USER, r.data.user); // 权威覆盖本地用户
        if (r.data.user.xpGained != null) syncXPGained(r.data.user.xpGained); // 获得类 XP 同步（后端实时记）
      });
      // 话题 30 天结算（活跃日数据源；失败静默，离线自然降级）
      api.get('/social/activity').then(function (r) {
        if (r.ok && r.data && Array.isArray(r.data.days)) settlePendingTopics(r.data.days);
      });
    });
  }

  function mirrorProfile(user) {
    if (!hasCloudUser()) return;
    whenUp(function (api) {
      var body = {};
      ['displayName', 'avatarUrl', 'language', 'country', 'dob', 'bio', 'gender'].forEach(function (k) {
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
      if (hasCloudUser()) {
        remove(KEYS.SESSION);
        remove(KEYS.XP_GAINED);        // 换号防陈旧获得经验混入新账号（同 logout 口径）
        remove(KEYS.XP_TOPIC_PENDING);
      }
    });
  }

  // --- Init ---
  seedIfEmpty();
  seedTeams();
  seedFollowing();
  bindAuthEvents();
  cloudMerge();
  // 页面跳转可能中断上一页的 POST；新页启动时主动续传 pending 世界。
  if (hasCloudUser()) syncPendingWorlds();
  grantDailyLoginBonus();

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
    retryWorldSync: retryWorldSync,
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
    LEVELS: LEVELS,
    getLevelState: getLevelState,
    TEAM_LEVELS: TEAM_LEVELS,
    getTeamLevelState: getTeamLevelState,
    addXP: addXP,
    grantDailyLoginBonus: grantDailyLoginBonus,
  };
})();
