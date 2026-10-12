// tmp-verify-636.js — FC v10.28.50.0 边缘抽屉+AI 生成+本地库+边缘仓库镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 50.0 赋值 ×1/49.2 赋值零残留 ×0/58.26 赋值 ×1/changelog 头 50.0+49.2 各 ×1/
//     rev 00356-XXX ×1+00357-??? ×1（回归 00355-j7g/00354-z2g 各 ×1）/词 二级窗口改成左侧弹窗 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00356-真值 ×1+00356-XXX 零残留；00357-??? 仍占位 ×1；
//   编辑器 50.0 新件（v10.28.50.0 ×25/fc-edge-drawer ×3/card-edge-custom ×8/fcEdgeCustomAddBtn ×1/sanitizeClipEdge ×5/
//     slati_custom_edges ×1/unavailable 先于 ×1/fcEdgeScopeBall ×2；回归 v10.28.49.2 ×1/v10.28.49.1 ×1）；
//   article.html 新件（art-card-custom-frame ×2/sanitizeClipEd ×2/customEdges ×2/v10.28.50.0 ×3）；
//   fluidcanvas.html 零改动回归（50.0 ×0/FC_OVERVIEW ×41）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义零双引号进 argv）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV56 = process.argv[3] || '00356-XXX';
const cmds = [
  // ══ site-config 50.0 新件 ══
  ["sc FLUIDCANVAS 50.0 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.50.0'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 49.2 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.49.2'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.26 赋值(回归) ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.26'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 50.0 头 ×1", `grep -cF '// v10.28.50.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 49.2 头(回归) ×1", `grep -cF '// v10.28.49.2 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00356 ×1", `grep -cF '${REV56}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00357-sh8 ×1", `grep -cF '00357-sh8' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00355-j7g(回归) ×1", `grep -cF '00355-j7g' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00354-z2g(回归) ×1", `grep -cF '00354-z2g' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 词 二级窗口改成左侧弹窗 ×1", `grep -cF '二级窗口改成左侧弹窗' /app/docs/assets/js/site-config.js`, "1"],
  // ══ fluidcanvas-editor.html 50.0 新件 ══
  ["ed v10.28.50.0 ×25", `grep -cF 'v10.28.50.0' /app/docs/pages/fluidcanvas-editor.html`, "25"],
  ["ed fc-edge-drawer ×3", `grep -cF 'fc-edge-drawer' /app/docs/pages/fluidcanvas-editor.html`, "3"],
  ["ed card-edge-custom ×8", `grep -cF 'card-edge-custom' /app/docs/pages/fluidcanvas-editor.html`, "8"],
  ["ed fcEdgeCustomAddBtn ×1", `grep -cF 'fcEdgeCustomAddBtn' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed sanitizeClipEdge ×5", `grep -cF 'sanitizeClipEdge' /app/docs/pages/fluidcanvas-editor.html`, "5"],
  ["ed slati_custom_edges ×1", `grep -cF 'slati_custom_edges' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed unavailable 先于 ×1", `grep -cF 'unavailable 先于' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fcEdgeScopeBall ×2", `grep -cF 'fcEdgeScopeBall' /app/docs/pages/fluidcanvas-editor.html`, "2"],
  ["ed v10.28.49.2 注释(回归) ×1", `grep -cF 'v10.28.49.2' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed v10.28.49.1 注释(回归) ×1", `grep -cF 'v10.28.49.1' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  // ══ article.html 新件 ══
  ["art art-card-custom-frame ×2", `grep -cF 'art-card-custom-frame' /app/docs/pages/article.html`, "2"],
  ["art sanitizeClipEd ×2", `grep -cF 'sanitizeClipEd' /app/docs/pages/article.html`, "2"],
  ["art customEdges ×2", `grep -cF 'customEdges' /app/docs/pages/article.html`, "2"],
  ["art v10.28.50.0 ×3", `grep -cF 'v10.28.50.0' /app/docs/pages/article.html`, "3"],
  // ══ 零改动回归 ══
  ["fcPage v10.28.50.0 零改动 ×0", `grep -cF 'v10.28.50.0' /app/docs/pages/fluidcanvas.html`, "0"],
  ["fcPage FC_OVERVIEW(回归) ×41", `grep -cF 'FC_OVERVIEW' /app/docs/pages/fluidcanvas.html`, "41"],
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
if (MODE === 2) {
  const sc = fs.readFileSync(path.join(HERE, '..', 'docs', 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const left = sc.split('\n').filter((l) => l.indexOf('00356-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00356-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
