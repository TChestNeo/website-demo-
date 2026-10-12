// tmp-verify-637.js — FC v10.28.51.0 团队频道镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 51.0 赋值 ×1/50.0 赋值零残留 ×0/58.26 赋值 ×1/changelog 头 51.0+50.0 各 ×1/
//     rev 00359-XXX ×1+00360-??? ×1（回归 00357-sh8/00356-djq 各 ×1）/词 把团队频道体系做出来 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00359-真值 ×1+00359-XXX 零残留（工作树）；00360-??? 仍占位 ×1；
//   fluidcanvas.html 新件（fcTeamWizard ×5/fcTwStepper ×2/openTeamWizard ×2/teamWizardSubmit ×2/loadTeamsFromApi ×3/
//     no-teams-cta ×2/v10.28.51.0 ×5）；
//   messages.html 新件（mergeCloudGroups ×4/groupFriendPick ×3/cloudGroups ×4/v10.28.51.0 ×7）；
//   premium.html 新件（premium.addon.slots8/slots26/slotsUnl 各 ×1/data-addon-cta= ×4/v10.28.51.0 ×2）；
//   零改动回归（fluidcanvas-editor.html 51.0 ×0+50.0 注释 ×25/article.html 51.0 ×0+50.0 注释 ×3）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义零双引号进 argv）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV59 = process.argv[3] || '00359-XXX';
const cmds = [
  // ══ site-config 51.0 新件 ══
  ["sc FLUIDCANVAS 51.0 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.51.0'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 50.0 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.50.0'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.26 赋值(回归) ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.26'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 51.0 头 ×1", `grep -cF '// v10.28.51.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 50.0 头(回归) ×1", `grep -cF '// v10.28.50.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00359 ×1", `grep -cF '${REV59}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00360-??? 占位 ×1", `grep -cF '00360-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00357-sh8(回归) ×1", `grep -cF '00357-sh8' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00356-djq(回归) ×1", `grep -cF '00356-djq' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 词 把团队频道体系做出来 ×1", `grep -cF '把团队频道体系做出来' /app/docs/assets/js/site-config.js`, "1"],
  // ══ fluidcanvas.html 51.0 新件 ══
  ["fc fcTeamWizard ×5", `grep -cF 'fcTeamWizard' /app/docs/pages/fluidcanvas.html`, "5"],
  ["fc fcTwStepper ×2", `grep -cF 'fcTwStepper' /app/docs/pages/fluidcanvas.html`, "2"],
  ["fc openTeamWizard ×2", `grep -cF 'openTeamWizard' /app/docs/pages/fluidcanvas.html`, "2"],
  ["fc teamWizardSubmit ×2", `grep -cF 'teamWizardSubmit' /app/docs/pages/fluidcanvas.html`, "2"],
  ["fc loadTeamsFromApi ×3", `grep -cF 'loadTeamsFromApi' /app/docs/pages/fluidcanvas.html`, "3"],
  ["fc no-teams-cta ×2", `grep -cF 'no-teams-cta' /app/docs/pages/fluidcanvas.html`, "2"],
  ["fc v10.28.51.0 ×5", `grep -cF 'v10.28.51.0' /app/docs/pages/fluidcanvas.html`, "5"],
  // ══ messages.html 51.0 新件 ══
  ["msg mergeCloudGroups ×4", `grep -cF 'mergeCloudGroups' /app/docs/pages/messages.html`, "4"],
  ["msg groupFriendPick ×3", `grep -cF 'groupFriendPick' /app/docs/pages/messages.html`, "3"],
  ["msg cloudGroups ×4", `grep -cF 'cloudGroups' /app/docs/pages/messages.html`, "4"],
  ["msg v10.28.51.0 ×7", `grep -cF 'v10.28.51.0' /app/docs/pages/messages.html`, "7"],
  // ══ premium.html 51.0 新件 ══
  ["pm slots8 ×1", `grep -cF 'premium.addon.slots8' /app/docs/pages/premium.html`, "1"],
  ["pm slots26 ×1", `grep -cF 'premium.addon.slots26' /app/docs/pages/premium.html`, "1"],
  ["pm slotsUnl ×1", `grep -cF 'premium.addon.slotsUnl' /app/docs/pages/premium.html`, "1"],
  ["pm data-addon-cta= ×4", `grep -cF 'data-addon-cta=' /app/docs/pages/premium.html`, "4"],
  ["pm v10.28.51.0 ×2", `grep -cF 'v10.28.51.0' /app/docs/pages/premium.html`, "2"],
  // ══ 零改动回归 ══
  ["ed v10.28.51.0 零改动 ×0", `grep -cF 'v10.28.51.0' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["art v10.28.51.0 零改动 ×0", `grep -cF 'v10.28.51.0' /app/docs/pages/article.html`, "0"],
  ["ed v10.28.50.0 注释(回归) ×25", `grep -cF 'v10.28.50.0' /app/docs/pages/fluidcanvas-editor.html`, "25"],
  ["art v10.28.50.0 注释(回归) ×3", `grep -cF 'v10.28.50.0' /app/docs/pages/article.html`, "3"],
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
if (MODE === 2) {
  const sc = fs.readFileSync(path.join(HERE, '..', 'docs', 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const left = sc.split('\n').filter((l) => l.indexOf('00359-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00359-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
