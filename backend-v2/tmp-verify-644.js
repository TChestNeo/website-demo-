// tmp-verify-644.js — FC v10.28.52.3 折叠按钮搬搜索菜单左侧+折叠出画回弹镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 52.3 赋值 ×1/52.2 赋值零残留 ×0/站点 58.28 赋值(回归) ×1/
//     changelog 头 52.3+52.2+52.1+58.28 各 ×1/rev 00373-XXX ×1+00374-??? ×1（回归 00371-zvn/00372-svk 各 ×1）/原话 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00373-真值 ×1+00373-XXX 零残留（工作树）；00374-??? 仍占位 ×1；
//   编辑器 12 锚（52.3 注释头/fine 左缘 6px top 16px/胶囊让位 calc/胶囊 width:100% 基态/动画挂接/关键帧/出画 -40px/
//     内联让位后/旧内联 width:100% 零残留/49.1 :has 折叠规则回归/52.2 纯白锚回归/暗色还原规则回归）；
//   零改动回归（ethereal/transitions/subnav/fluidcanvas/messages/premium/article 52.3 词全 ×0+CSS_MARK 页 ×41）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV73 = process.argv[3] || '00373-XXX';
const cmds = [
  // ══ site-config 52.3 新件 ══
  ["sc FLUIDCANVAS 52.3 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.3'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 52.2 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.2'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.28 赋值(回归) ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.28'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.3 头 ×1", `grep -cF '// v10.28.52.3 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.2 头(回归) ×1", `grep -cF '// v10.28.52.2 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.1 头(回归) ×1", `grep -cF '// v10.28.52.1 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.28 头(回归) ×1", `grep -cF '// v0.2.58.28 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00373 ×1", `grep -cF '${REV73}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00374-??? 占位 ×1", `grep -cF '00374-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00371-zvn(回归) ×1", `grep -cF '00371-zvn' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00372-svk(回归) ×1", `grep -cF '00372-svk' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 原话 变成是放在搜索菜单左侧那边再多出一个圆形 ×1", `grep -cF '变成是放在搜索菜单左侧那边再多出一个圆形' /app/docs/assets/js/site-config.js`, "1"],
  // ══ 编辑器 52.3 新件（12 锚） ══
  ["ed 52.3 注释头 ×1", `grep -cF 'v10.28.52.3: 折叠按钮搬搜索菜单左侧' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fine 左缘 6px top 16px ×1", `grep -cF '.asset-panel-toggle { left: 6px; top: 16px; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 胶囊让位 calc ×1", `grep -cF 'width: calc(100% - 38px); margin-left: 38px;' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 胶囊 width:100% 基态 ×1", `grep -cF '.asset-panel .search-capsule { width: 100%; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 动画挂接 ×1", `grep -cF 'animation: fcToggleOutSpring 0.9s;' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 关键帧头 ×1", `grep -cF '@keyframes fcToggleOutSpring {' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 出画 -40px+过冲曲线 ×1", `grep -cF '30%  { left: -40px; animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 内联让位后 ×1", `grep -cF 'search-capsule" style="margin-bottom:var(--space-sm)"' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 旧内联 width:100% 零残留 ×0", `grep -cF 'style="width:100%;margin-bottom:var(--space-sm)"' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed :has 折叠规则(49.1 回归) ×1", `grep -cF '.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 52.2 纯白锚(回归) ×1", `grep -cF 'background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 暗色还原规则(回归) ×1", `grep -cF ':root[data-theme="dark"] .asset-panel-toggle,' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  // ══ 零改动回归 ══
  ["eth v10.28.52.3 零触碰 ×0", `grep -cF 'v10.28.52.3' /app/docs/assets/css/ethereal.css`, "0"],
  ["tr v10.28.52.3 零触碰 ×0", `grep -cF 'v10.28.52.3' /app/docs/assets/js/transitions.js`, "0"],
  ["sn v10.28.52.3 零触碰 ×0", `grep -cF 'v10.28.52.3' /app/docs/assets/js/subnav.js`, "0"],
  ["fch v10.28.52.3 零改动 ×0", `grep -cF 'v10.28.52.3' /app/docs/pages/fluidcanvas.html`, "0"],
  ["msg v10.28.52.3 零改动 ×0", `grep -cF 'v10.28.52.3' /app/docs/pages/messages.html`, "0"],
  ["pm v10.28.52.3 零改动 ×0", `grep -cF 'v10.28.52.3' /app/docs/pages/premium.html`, "0"],
  ["art v10.28.52.3 零改动 ×0", `grep -cF 'v10.28.52.3' /app/docs/pages/article.html`, "0"],
  ["img CSS_MARK 页 ×41（本轮零 inline 重跑）", `grep -rlF 'ethereal.css 内联（切页闪修复 08-28' /app/docs --include='*.html' | wc -l`, "41"]
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
if (MODE === 2) {
  const sc = fs.readFileSync(path.join(HERE, '..', 'docs', 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const left = sc.split('\n').filter((l) => l.indexOf('00373-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00373-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
