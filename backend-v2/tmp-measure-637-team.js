// tmp-measure-637-team.js — fc-team 电池 S 静态锚实测（行计数口径 grep -cF 同款）
'use strict';
const fs = require('fs');
const path = require('path');
const DOCS = path.join(__dirname, '..', 'docs');
const norm = (t) => t.replace(/\r\n/g, '\n');
const cnt = (file, a) => norm(fs.readFileSync(path.join(DOCS, file), 'utf8')).split('\n').filter((l) => l.includes(a)).length;

const FC = [
  'id="fcTeamWizard"', 'id="fcTwStepper"', 'function openTeamWizard', 'function closeTeamWizard',
  'function teamWizardSubmit', 'function loadTeamsFromApi', 'function fcEnsureApi', 'no-teams-cta',
  'copyItems: cur.all', 'body.chat = { name: chatName', "MN_API.post('/teams', body)", "MN_API.get('/friends')",
  'selectAccount(res.data.team.id)', 'fc-ch-avatar-crop', "TEAM_ITEM_KEYS = ['posts'", "'has-teams'"
];
FC.forEach((a) => console.log('fc | ' + a + ' = ' + cnt('pages/fluidcanvas.html', a)));

const MSG = [
  'var cloudGroups = {}', 'function mergeCloudGroups', "kind !== 'group'", 'id="groupFriendPick"',
  'function loadGroupFriendPick', 'function groupFriendToggle', "MN_API.get('/friends')",
  "MN_API.post('/conversations', { kind: 'group'", "MN_API.get('/conversations/' + id + '/messages')",
  'function renderGroupMessages', "MN_API.post('/conversations/' + activeGroup + '/messages'",
  'messages.toast.groupNoFile'
];
MSG.forEach((a) => console.log('msg | ' + a + ' = ' + cnt('pages/messages.html', a)));

const PM = [
  'data-i18n-html="premium.addon.slots8"', 'data-i18n-html="premium.addon.slots16"',
  'data-i18n-html="premium.addon.slots26"', 'data-i18n-html="premium.addon.slotsUnl"',
  'data-addon-cta="slots-basic"', 'data-addon-cta="slots-plus"',
  'data-addon-cta="slots-premium"', 'data-addon-cta="slots-ultra"',
  "startCheckout(ab, ab.dataset.addonCta, 'once')", '<strong>8</strong>', '<strong>16</strong>',
  '<strong>26</strong>', '<strong>Unlimited</strong>'
];
PM.forEach((a) => console.log('pm | ' + a + ' = ' + cnt('pages/premium.html', a)));

const BE = (p) => norm(fs.readFileSync(path.join(__dirname, p), 'utf8'));
const bc = (src) => (a) => src.split('\n').filter((l) => l.includes(a)).length;
const teams = BE('src/routes/public/teams.js');
const msgRt = BE('src/routes/public/messages.js');
const srv = BE('src/server.js');
const mig32 = BE('migrations/032_team_channels.sql');
const health = BE('test/health.test.js');
const migTest = BE('test/migrations.test.js');
const subs = BE('src/routes/public/subscriptions.js');
[
  ['teams SLOT_CAP', bc(teams)('SLOT_CAP')], ['teams TEAM_FULL', bc(teams)('TEAM_FULL')],
  ['teams copyItems', bc(teams)('copyItems')], ['teams copyIdentity', bc(teams)('copyIdentity')],
  ['teams /api/friends', bc(teams)('GET', )], ['teams acceptedFriends', bc(teams)('acceptedFriends')],
  ['teams chat.name', bc(teams)('chat.name')], ['teams kind group', bc(teams)("'group'")],
  ['messages kind=group', bc(msgRt)("kind === 'group'")], ['messages name 1-60', bc(msgRt)('1-60')],
  ['server registerTeams', bc(srv)('registerTeams')],
  ['032 conversations.name', bc(mig32)('conversations ADD COLUMN name')],
  ['032 slots-basic', bc(mig32)('slots-basic')], ['032 slots-plus', bc(mig32)('slots-plus')],
  ['032 slots-premium', bc(mig32)('slots-premium')], ['032 slots-ultra', bc(mig32)('slots-ultra')],
  ['health 61', bc(health)('61')], ['migTest 32', bc(migTest)('32')],
  ['subs slots-', bc(subs)('slots-')]
].forEach(([n, v]) => console.log('be | ' + n + ' = ' + v));

// 补充实测
const subs2 = BE('src/routes/public/subscriptions.js');
const migTest2 = BE('test/migrations.test.js');
const teams2 = BE('src/routes/public/teams.js');
const bc2 = (src) => (a) => src.split('\n').filter((l) => l.includes(a)).length;
console.log('be2 | teams /api/friends route =', bc2(teams2)("'/api/friends'"));
console.log('be2 | teams capOf =', bc2(teams2)('capOf'));
console.log('be2 | teams MAX_CHAT_NAME =', bc2(teams2)('MAX_CHAT_NAME'));
console.log('be2 | teams BASE_CAP =', bc2(teams2)('BASE_CAP'));
console.log('be2 | subs slots-basic =', bc2(subs2)('slots-basic'));
console.log('be2 | subs slots- =', bc2(subs2)('slots-'));
console.log('be2 | subs mode once =', bc2(subs2)("'once'"));
console.log('be2 | subs team_cap_addon =', bc2(subs2)('team_cap_addon'));
console.log('be2 | migTest user_version =', bc2(migTest2)('user_version'));
migTest2.split('\n').forEach((l, i) => { if (l.includes('32') && l.includes('assert')) console.log('be2 | migTest L' + (i + 1) + ': ' + l.trim().slice(0, 90)); });
