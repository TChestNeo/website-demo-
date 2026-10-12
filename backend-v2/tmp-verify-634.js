// tmp-verify-634.js — FC v10.28.49.1 折叠按钮随菜单移动镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 49.1 赋值 ×1/49.0 赋值零残留/58.26 赋值 ×1/changelog 头 49.1+49.0+48.2 各 ×1/
//     rev 00352-XXX ×1+00353-??? ×1（回归 00350-6vv/00351-5mm 各 ×1）/词 折叠按钮随菜单一起移动 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00352-真值 ×1+00352-XXX 零残留；00353-??? 仍占位 ×1；
//   编辑器 49.1 新件（:has 折叠态规则 ×1/旧相邻兄弟死规则零残留/展开态 left 锚 ×1/折叠态 left 锚 ×1/
//     面板宽单旋钮 ×1/面板折叠规则 ×1/left 过渡 ×1/v10.28.49.1 ×1；回归 v10.28.49.0 ×16）；
//   fluidcanvas.html 零改动回归（49.1 ×0/FC_OVERVIEW ×41/48.2K ×1）+ article.html 零改动（49.1 ×0）；
//   计数全部=tmp-measure-634.js 实测口径（grep -cF 按行计；-- 前缀锚用 -e）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义零双引号进 argv）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV52 = process.argv[3] || '00352-XXX';
const cmds = [
  // ══ site-config 49.1 新件 ══
  ["sc FLUIDCANVAS 49.1 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.49.1'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 49.0 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.49.0'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.26 赋值(回归) ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.26'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 49.1 头 ×1", `grep -cF '// v10.28.49.1 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 49.0 头(回归) ×1", `grep -cF '// v10.28.49.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 48.2 头(回归) ×1", `grep -cF '// v10.28.48.2 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00352 ×1", `grep -cF '${REV52}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00353-??? ×1", `grep -cF '00353-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00350-6vv(回归) ×1", `grep -cF '00350-6vv' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00351-5mm(回归) ×1", `grep -cF '00351-5mm' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 词 折叠按钮随菜单一起移动 ×1", `grep -cF '折叠按钮随菜单一起移动' /app/docs/assets/js/site-config.js`, "1"],
  // ══ fluidcanvas-editor.html 49.1 新件 ══
  ["ed :has 折叠态规则 ×1", `grep -cF '.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 旧相邻兄弟死规则零残留 ×0", `grep -cF '.asset-panel.collapsed + .asset-panel-toggle {' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 展开态 left 锚 ×1", `grep -cF 'left: calc(var(--asset-panel-w) + 6px)' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 折叠态 left 锚 ×1", `grep -cF 'left: 6px; border-left: 1px solid var(--divider-line-strong); border-radius: 6px;' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 面板宽单旋钮 ×1", `grep -cF -e '--asset-panel-w: 260px' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 面板折叠规则 ×1", `grep -cF '.asset-panel.collapsed {' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed left 过渡 ×1", `grep -cF 'transition: left 0.25s;' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed v10.28.49.1 ×1", `grep -cF 'v10.28.49.1' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed v10.28.49.0 注释(回归) ×16", `grep -cF 'v10.28.49.0' /app/docs/pages/fluidcanvas-editor.html`, "16"],
  // ══ 零改动回归 ══
  ["fcPage v10.28.49.1 零改动 ×0", `grep -cF 'v10.28.49.1' /app/docs/pages/fluidcanvas.html`, "0"],
  ["fcPage FC_OVERVIEW(回归) ×41", `grep -cF 'FC_OVERVIEW' /app/docs/pages/fluidcanvas.html`, "41"],
  ["fcPage 48.2K(回归注释) ×1", `grep -cF '48.2K' /app/docs/pages/fluidcanvas.html`, "1"],
  ["art v10.28.49.1 零改动 ×0", `grep -cF 'v10.28.49.1' /app/docs/pages/article.html`, "0"],
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
if (MODE === 2) {
  const sc = fs.readFileSync(path.join(HERE, '..', 'docs', 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const left = sc.split('\n').filter((l) => l.indexOf('00352-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00352-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
