// tmp-verify-640.js — v0.2.58.27 侧栏菜单背景卡片改不透明镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 58.27 赋值 ×1/58.26 赋值零残留 ×0/FC 52.0 赋值(回归) ×1/
//     changelog 头 58.27+58.26+52.0 各 ×1/rev 00365-XXX ×1+00366-??? ×1（回归 00363-ksq/00364-wdg 各 ×1）/原话 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00365-真值 ×1+00365-XXX 零残留（工作树）；00366-??? 仍占位 ×1；
//   ethereal：sbg ×3+原话 ×1+旧 58.1 注释 ×1+暗色铺底零残留+灭滤镜在位+新注释后即卡面规则（-A14 邻接）；
//   内联页：CSS_MARK 页=41+新轮注释页=40（编辑器豁免页除外）+community-profile sbg ×3+原话 ×1+index 原话 ×1+编辑器原话 ×0；
//   零改动回归（fluidcanvas/编辑器/messages/premium/article/transitions 58.27 词全 ×0）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV65 = process.argv[3] || '00365-XXX';
const cmds = [
  // ══ site-config 58.27 新件 ══
  ["sc SITE 58.27 赋值 ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.27'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc SITE 58.26 赋值零残留 ×0", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.26'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc FLUIDCANVAS 52.0 赋值(回归) ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.0'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.27 头 ×1", `grep -cF '// v0.2.58.27 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.26 头(回归) ×1", `grep -cF '// v0.2.58.26 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.0 头(回归) ×1", `grep -cF '// v10.28.52.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00365 ×1", `grep -cF '${REV65}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00366-??? 占位 ×1", `grep -cF '00366-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00363-ksq(回归) ×1", `grep -cF '00363-ksq' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00364-wdg(回归) ×1", `grep -cF '00364-wdg' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 原话 那个在个人主页 ×1", `grep -cF '那个在个人主页' /app/docs/assets/js/site-config.js`, "1"],
  // ══ ethereal.css 58.27 新件 ══
  ["eth background: var(--sidebar-bg); ×3", `grep -cF 'background: var(--sidebar-bg);' /app/docs/assets/css/ethereal.css`, "3"],
  ["eth 原话 ×1", `grep -cF '那个在个人主页' /app/docs/assets/css/ethereal.css`, "1"],
  ["eth 旧 58.1 注释保留 ×1", `grep -cF '我要完全的删除它' /app/docs/assets/css/ethereal.css`, "1"],
  ["eth 暗色铺底规则零残留 ×0", `grep -cF ':root[data-theme="dark"] .app-sidebar {' /app/docs/assets/css/ethereal.css`, "0"],
  ["eth 暗色灭滤镜规则在位 ×1", `grep -cF ':root[data-theme="dark"] .app-sidebar .lg-backdrop {' /app/docs/assets/css/ethereal.css`, "1"],
  ["eth 新注释后即卡面规则(-A14 邻接 sbg) ×1", `grep -A14 -F '2026-10-05 用户' /app/docs/assets/css/ethereal.css | grep -cF 'background: var(--sidebar-bg);'`, "1"],
  // ══ 内联页 ══
  ["img CSS_MARK 页 ×41", `grep -rlF 'ethereal.css 内联（切页闪修复 08-28' /app/docs --include='*.html' | wc -l`, "41"],
  ["img 新轮注释页 ×40（编辑器豁免页除外）", `grep -rlF '那个在个人主页' /app/docs --include='*.html' | wc -l`, "40"],
  ["cp 内联 sbg ×3", `grep -cF 'background: var(--sidebar-bg);' /app/docs/pages/community-profile.html`, "3"],
  ["cp 内联 原话 ×1", `grep -cF '那个在个人主页' /app/docs/pages/community-profile.html`, "1"],
  ["idx 内联 原话 ×1", `grep -cF '那个在个人主页' /app/docs/index.html`, "1"],
  ["ed 编辑器豁免 原话 ×0", `grep -cF '那个在个人主页' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  // ══ 零改动回归 ══
  ["fch v0.2.58.27 零改动 ×0", `grep -cF 'v0.2.58.27' /app/docs/pages/fluidcanvas.html`, "0"],
  ["ed v0.2.58.27 零改动 ×0", `grep -cF 'v0.2.58.27' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["msg v0.2.58.27 零改动 ×0", `grep -cF 'v0.2.58.27' /app/docs/pages/messages.html`, "0"],
  ["pm v0.2.58.27 零改动 ×0", `grep -cF 'v0.2.58.27' /app/docs/pages/premium.html`, "0"],
  ["art v0.2.58.27 零改动 ×0", `grep -cF 'v0.2.58.27' /app/docs/pages/article.html`, "0"],
  ["tr v0.2.58.27 零触碰 ×0", `grep -cF 'v0.2.58.27' /app/docs/assets/js/transitions.js`, "0"]
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
if (MODE === 2) {
  const sc = fs.readFileSync(path.join(HERE, '..', 'docs', 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const left = sc.split('\n').filter((l) => l.indexOf('00365-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00365-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
