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
  }

  function getUser() {
    return get(KEYS.USER);
  }

  function isLoggedIn() {
    var s = get(KEYS.SESSION);
    return !!(s && s.loggedIn);
  }

  function logout() {
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
    remove(KEYS.NATION);
    remove(KEYS.REGISTRY_STEP);
    return nation;
  }

  function getNations() {
    return get(KEYS.NATIONS) || [];
  }

  // --- Topics ---
  function saveTopic(topic) {
    var topics = get(KEYS.TOPICS) || [];
    topic.id = 'TOP-' + Date.now();
    topic.createdAt = new Date().toISOString();
    topic.memberCount = 1;
    topics.push(topic);
    set(KEYS.TOPICS, topics);
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

  // --- Init ---
  seedIfEmpty();
  seedTeams();
  seedFollowing();

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
