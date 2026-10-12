// tmp-verify-641.js — v0.2.58.28 折叠侧栏用户卡不透明补丁镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 58.28 赋值 ×1/58.27 赋值零残留 ×0/FC 52.0 赋值(回归) ×1/
//     changelog 头 58.28+58.27+58.26+52.0 各 ×1/rev 00367-XXX ×1+00368-??? ×1（回归 00365-6zb/00366-2jw 各 ×1）/原话 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00367-真值 ×1+00367-XXX 零残留（工作树）；00368-??? 仍占位 ×1；
//   ethereal：折叠选择器 ×2+原话 ×1+新注释后即卡面规则（-A14 邻接 sbg）+sbg ×4+cardbg ×3（回归）+旧 58.1 注释 ×1+暗色铺底零残留+灭滤镜在位；
//   内联页：CSS_MARK 页=41+新轮注释页=40（编辑器豁免页除外）+cp/index 折叠选择器 ×2+原话 ×1+编辑器原话 ×0；
//   零改动回归（fluidcanvas/编辑器/messages/premium/article/transitions 58.28 词全 ×0）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV67 = process.argv[3] || '00367-XXX';
const cmds = [
  // ══ site-config 58.28 新件 ══
  ["sc SITE 58.28 赋值 ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.28'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc SITE 58.27 赋值零残留 ×0", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.27'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc FLUIDCANVAS 52.0 赋值(回归) ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.0'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.28 头 ×1", `grep -cF '// v0.2.58.28 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.27 头(回归) ×1", `grep -cF '// v0.2.58.27 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.26 头(回归) ×1", `grep -cF '// v0.2.58.26 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.0 头(回归) ×1", `grep -cF '// v10.28.52.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00367 ×1", `grep -cF '${REV67}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00368-??? 占位 ×1", `grep -cF '00368-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00365-6zb(回归) ×1", `grep -cF '00365-6zb' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00366-2jw(回归) ×1", `grep -cF '00366-2jw' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 原话 折叠起来的时候还是一样是半透明的 ×1", `grep -cF '折叠起来的时候还是一样是半透明的' /app/docs/assets/js/site-config.js`, "1"],
  // ══ ethereal.css 58.28 新件 ══
  ["eth 折叠选择器 ×2", `grep -cF '.app-sidebar.collapsed .user-module' /app/docs/assets/css/ethereal.css`, "2"],
  ["eth 原话 ×1", `grep -cF '折叠起来的时候还是一样是半透明的' /app/docs/assets/css/ethereal.css`, "1"],
  ["eth 新注释后即卡面规则(-A14 邻接 sbg) ×1", `grep -A14 -F '58.28 补' /app/docs/assets/css/ethereal.css | grep -cF 'background: var(--sidebar-bg);'`, "1"],
  ["eth background: var(--sidebar-bg); ×4", `grep -cF 'background: var(--sidebar-bg);' /app/docs/assets/css/ethereal.css`, "4"],
  ["eth background: var(--card-bg); ×3(回归)", `grep -cF 'background: var(--card-bg);' /app/docs/assets/css/ethereal.css`, "3"],
  ["eth 旧 58.1 注释保留 ×1", `grep -cF '我要完全的删除它' /app/docs/assets/css/ethereal.css`, "1"],
  ["eth 暗色铺底规则零残留 ×0", `grep -cF ':root[data-theme="dark"] .app-sidebar {' /app/docs/assets/css/ethereal.css`, "0"],
  ["eth 暗色灭滤镜规则在位 ×1", `grep -cF ':root[data-theme="dark"] .app-sidebar .lg-backdrop {' /app/docs/assets/css/ethereal.css`, "1"],
  // ══ 内联页 ══
  ["img CSS_MARK 页 ×41", `grep -rlF 'ethereal.css 内联（切页闪修复 08-28' /app/docs --include='*.html' | wc -l`, "41"],
  ["img 新轮注释页 ×40（编辑器豁免页除外）", `grep -rlF '折叠起来的时候还是一样是半透明的' /app/docs --include='*.html' | wc -l`, "40"],
  ["cp 内联 折叠选择器 ×2", `grep -cF '.app-sidebar.collapsed .user-module' /app/docs/pages/community-profile.html`, "2"],
  ["cp 内联 原话 ×1", `grep -cF '折叠起来的时候还是一样是半透明的' /app/docs/pages/community-profile.html`, "1"],
  ["idx 内联 折叠选择器 ×2", `grep -cF '.app-sidebar.collapsed .user-module' /app/docs/index.html`, "2"],
  ["idx 内联 原话 ×1", `grep -cF '折叠起来的时候还是一样是半透明的' /app/docs/index.html`, "1"],
  ["ed 编辑器豁免 原话 ×0", `grep -cF '折叠起来的时候还是一样是半透明的' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  // ══ 零改动回归 ══
  ["fch v0.2.58.28 零改动 ×0", `grep -cF 'v0.2.58.28' /app/docs/pages/fluidcanvas.html`, "0"],
  ["ed v0.2.58.28 零改动 ×0", `grep -cF 'v0.2.58.28' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["msg v0.2.58.28 零改动 ×0", `grep -cF 'v0.2.58.28' /app/docs/pages/messages.html`, "0"],
  ["pm v0.2.58.28 零改动 ×0", `grep -cF 'v0.2.58.28' /app/docs/pages/premium.html`, "0"],
  ["art v0.2.58.28 零改动 ×0", `grep -cF 'v0.2.58.28' /app/docs/pages/article.html`, "0"],
  ["tr v0.2.58.28 零触碰 ×0", `grep -cF 'v0.2.58.28' /app/docs/assets/js/transitions.js`, "0"]
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
if (MODE === 2) {
  const sc = fs.readFileSync(path.join(HERE, '..', 'docs', 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const left = sc.split('\n').filter((l) => l.indexOf('00367-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00367-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
