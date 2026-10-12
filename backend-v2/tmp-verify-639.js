// tmp-verify-639.js — FC v10.28.52.0 等级奖励镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 52.0 赋值 ×1/51.1 赋值零残留 ×0/58.26 赋值 ×1/changelog 头 52.0+51.1 各 ×1/
//     rev 00363-XXX ×1+00364-??? ×1（回归 00361-7vk/00362-fdj 各 ×1）/词 少一个就收走 就给了24px少了一个就减24 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00363-真值 ×1+00363-XXX 零残留（工作树）；00364-??? 仍占位 ×1；
//   资料页 52.0 新件（' has-frame ' 发射 ×1/rookie-frame CSS ×1/champion-frame CSS ×1/has-frame::after ×3/frame-rookie 旧残 ×0/
//     loadRewardsMe ×4/REWARDS_ME ×14/pr-cosm-chip ×8/edgeFree ×4/hasCosmetic ×7/renderRewardsSectionHtml ×2/profile-rewards ×4）；
//   sidebar /rewards/claim ×2+mn:rewards-changed ×2；storage TEAM_LEVELS ×8+getTeamLevelState ×3；
//   fluidcanvas fc-team-lv-badge ×3/fc-team-ach-strip ×2/fcToggleTeamFollow ×3/loadTeamRewards ×4/v10.28.52.0 注释 ×6；
//   编辑器 getFcTeamPublishId ×2/body.teamId ×1/v10.28.52.0 ×1/v10.28.51.1 注释(回归) ×3；
//   i18n common rewards 5 键 ×12 + fluidcanvas fc.rewards 3 键(双引号) ×12；
//   后端 config teamGained ×1/team-xp gain+lose fn 各 ×1+MAX(0 ×2/auth FRAME_KEYS ×2+TITLE_KEYS ×2+user_cosmetics ×6/
//     social gainTeamXp ×7+loseTeamXp ×6/server registerRewards ×2/rewards INSERT OR IGNORE ×6+edgeUnlocked ×1/
//     migrations 033 user_cosmetics ×2+avatar_frame ×3；
//   零改动回归（messages/premium/article/ethereal/transitions 52.0 词全 ×0）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV63 = process.argv[3] || '00363-XXX';
const cmds = [
  // ══ site-config 52.0 新件 ══
  ["sc FLUIDCANVAS 52.0 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.0'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 51.1 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.51.1'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.26 赋值(回归) ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.26'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.0 头 ×1", `grep -cF '// v10.28.52.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 51.1 头(回归) ×1", `grep -cF '// v10.28.51.1 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00363 ×1", `grep -cF '${REV63}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00364-??? 占位 ×1", `grep -cF '00364-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00361-7vk(回归) ×1", `grep -cF '00361-7vk' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00362-fdj(回归) ×1", `grep -cF '00362-fdj' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 词 少一个就收走 就给了24px少了一个就减24 ×1", `grep -cF '少一个就收走 就给了24px少了一个就减24' /app/docs/assets/js/site-config.js`, "1"],
  // ══ community-profile.html 52.0 新件（含相框类发射修复） ══
  ["pf ' has-frame ' 发射 ×1", `grep -cF "' has-frame '" /app/docs/pages/community-profile.html`, "1"],
  ["pf rookie-frame CSS ×1", `grep -cF '.profile-avatar.rookie-frame::after' /app/docs/pages/community-profile.html`, "1"],
  ["pf champion-frame CSS ×1", `grep -cF '.profile-avatar.champion-frame::after' /app/docs/pages/community-profile.html`, "1"],
  ["pf has-frame::after CSS ×3", `grep -cF 'profile-avatar.has-frame' /app/docs/pages/community-profile.html`, "3"],
  ["pf frame-rookie 旧残零残留 ×0", `grep -cF 'frame-rookie' /app/docs/pages/community-profile.html`, "0"],
  ["pf loadRewardsMe ×4", `grep -cF 'loadRewardsMe' /app/docs/pages/community-profile.html`, "4"],
  ["pf REWARDS_ME ×14", `grep -cF 'REWARDS_ME' /app/docs/pages/community-profile.html`, "14"],
  ["pf pr-cosm-chip ×8", `grep -cF 'pr-cosm-chip' /app/docs/pages/community-profile.html`, "8"],
  ["pf edgeFree ×4", `grep -cF 'edgeFree' /app/docs/pages/community-profile.html`, "4"],
  ["pf hasCosmetic ×7", `grep -cF 'hasCosmetic' /app/docs/pages/community-profile.html`, "7"],
  ["pf renderRewardsSectionHtml ×2", `grep -cF 'renderRewardsSectionHtml' /app/docs/pages/community-profile.html`, "2"],
  ["pf profile-rewards ×4", `grep -cF 'profile-rewards' /app/docs/pages/community-profile.html`, "4"],
  // ══ sidebar/storage ══
  ["sb /rewards/claim ×2", `grep -cF '/rewards/claim' /app/docs/assets/js/sidebar.js`, "2"],
  ["sb mn:rewards-changed ×2", `grep -cF 'mn:rewards-changed' /app/docs/assets/js/sidebar.js`, "2"],
  ["st TEAM_LEVELS ×8", `grep -cF 'TEAM_LEVELS' /app/docs/assets/js/storage.js`, "8"],
  ["st getTeamLevelState ×3", `grep -cF 'getTeamLevelState' /app/docs/assets/js/storage.js`, "3"],
  // ══ fluidcanvas.html ══
  ["fc fc-team-lv-badge ×3", `grep -cF 'fc-team-lv-badge' /app/docs/pages/fluidcanvas.html`, "3"],
  ["fc fc-team-ach-strip ×2", `grep -cF 'fc-team-ach-strip' /app/docs/pages/fluidcanvas.html`, "2"],
  ["fc fcToggleTeamFollow ×3", `grep -cF 'fcToggleTeamFollow' /app/docs/pages/fluidcanvas.html`, "3"],
  ["fc loadTeamRewards ×4", `grep -cF 'loadTeamRewards' /app/docs/pages/fluidcanvas.html`, "4"],
  ["fc v10.28.52.0 注释 ×6", `grep -cF 'v10.28.52.0' /app/docs/pages/fluidcanvas.html`, "6"],
  // ══ fluidcanvas-editor.html ══
  ["ed getFcTeamPublishId ×2", `grep -cF 'getFcTeamPublishId' /app/docs/pages/fluidcanvas-editor.html`, "2"],
  ["ed body.teamId ×1", `grep -cF 'body.teamId' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed v10.28.52.0 ×1", `grep -cF 'v10.28.52.0' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed v10.28.51.1 注释(回归) ×3", `grep -cF 'v10.28.51.1' /app/docs/pages/fluidcanvas-editor.html`, "3"],
  // ══ i18n ══
  ["i18n rewards.claimOk ×12", `grep -cF 'rewards.claimOk' /app/docs/assets/i18n/common.i18n.js`, "12"],
  ["i18n rewards.badge.user2 ×12", `grep -cF 'rewards.badge.user2' /app/docs/assets/i18n/common.i18n.js`, "12"],
  ["i18n rewards.title.veteran ×12", `grep -cF 'rewards.title.veteran' /app/docs/assets/i18n/common.i18n.js`, "12"],
  ["i18n rewards.frame.rookie ×12", `grep -cF 'rewards.frame.rookie' /app/docs/assets/i18n/common.i18n.js`, "12"],
  ["i18n rewards.toast.locked ×12", `grep -cF 'rewards.toast.locked' /app/docs/assets/i18n/common.i18n.js`, "12"],
  ["i18n fc.rewards.teamXp ×12", `grep -cF '"fc.rewards.teamXp"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.rewards.follow ×12", `grep -cF '"fc.rewards.follow"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.rewards.teamAchEmpty ×12", `grep -cF '"fc.rewards.teamAchEmpty"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  // ══ 后端 ══
  ["cfg teamGained ×1", `grep -cF 'teamGained' /app/src/config.js`, "1"],
  ["txp function gainTeamXp ×1", `grep -cF 'function gainTeamXp' /app/src/routes/public/team-xp.js`, "1"],
  ["txp function loseTeamXp ×1", `grep -cF 'function loseTeamXp' /app/src/routes/public/team-xp.js`, "1"],
  ["txp MAX(0 ×2", `grep -cF 'MAX(0' /app/src/routes/public/team-xp.js`, "2"],
  ["ath FRAME_KEYS ×2", `grep -cF 'FRAME_KEYS' /app/src/routes/public/auth.js`, "2"],
  ["ath TITLE_KEYS ×2", `grep -cF 'TITLE_KEYS' /app/src/routes/public/auth.js`, "2"],
  ["ath user_cosmetics ×6", `grep -cF 'user_cosmetics' /app/src/routes/public/auth.js`, "6"],
  ["soc gainTeamXp ×7", `grep -cF 'gainTeamXp' /app/src/routes/public/social.js`, "7"],
  ["soc loseTeamXp ×6", `grep -cF 'loseTeamXp' /app/src/routes/public/social.js`, "6"],
  ["srv registerRewards ×2", `grep -cF 'registerRewards' /app/src/server.js`, "2"],
  ["rwd INSERT OR IGNORE ×6", `grep -cF 'INSERT OR IGNORE' /app/src/routes/public/rewards.js`, "6"],
  ["rwd edgeUnlocked ×1", `grep -cF 'edgeUnlocked' /app/src/routes/public/rewards.js`, "1"],
  ["mig 033 user_cosmetics ×2", `grep -cF 'user_cosmetics' /app/migrations/033_rewards.sql`, "2"],
  ["mig 033 avatar_frame ×3", `grep -cF 'avatar_frame' /app/migrations/033_rewards.sql`, "3"],
  // ══ 零改动回归 ══
  ["msg v10.28.52.0 零改动 ×0", `grep -cF 'v10.28.52.0' /app/docs/pages/messages.html`, "0"],
  ["pm v10.28.52.0 零改动 ×0", `grep -cF 'v10.28.52.0' /app/docs/pages/premium.html`, "0"],
  ["art v10.28.52.0 零改动 ×0", `grep -cF 'v10.28.52.0' /app/docs/pages/article.html`, "0"],
  ["eth v10.28.52.0 零触碰 ×0", `grep -cF 'v10.28.52.0' /app/docs/assets/css/ethereal.css`, "0"],
  ["tr v10.28.52.0 零触碰 ×0", `grep -cF 'v10.28.52.0' /app/docs/assets/js/transitions.js`, "0"]
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
if (MODE === 2) {
  const sc = fs.readFileSync(path.join(HERE, '..', 'docs', 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const left = sc.split('\n').filter((l) => l.indexOf('00363-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00363-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
