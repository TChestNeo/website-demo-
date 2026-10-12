// tmp-verify-646.js — FC v10.28.52.5 折叠出画加深+画外停拍+展开Q弹镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 52.5 赋值 ×1/52.4 赋值零残留 ×0/站点 58.28 赋值(回归) ×1/
//     changelog 头 52.5+52.4+52.3+58.28 各 ×1/rev 00377-XXX ×1+00378-??? ×1（回归 00375-nlm/00376-8qx 各 ×1）/原话 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00377-真值 ×1+00377-XXX 零残留（工作树）；00378-??? 仍占位 ×1；
//   编辑器 52.5 新件（52.5 注释头/fine 右缘 214px top 12px 带展开 Q弹/胶囊让位 46px/胶囊 width:100% 基态/双动画挂接/
//     位移关键帧头/Q弹关键帧头/28% 深出画 -80px linear/50% 画外停拍 -80px+过冲曲线/Q弹 70% 拉长/展开 Q弹关键帧头/
//     45% 展开拉长）+ 回归锚（40×40 同高 /* 52.4/49.1 :has 折叠规则/52.2 纯白锚/暗色还原规则）；
//   52.4 旧件零残留 5 锚（30% 浅出画 -40px/58% 拉长站/fine 无动画行/左缘 6px top 16px/38px 让位 margin-left）+
//   52.3 旧件零残留 3 锚（单动画挂接/32×32 尺寸/右缘 -38px 旧式）×0；
//   零改动回归（ethereal/transitions/subnav/fluidcanvas/messages/premium/article 52.5 词全 ×0+CSS_MARK 页 ×41）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV77 = process.argv[3] || '00377-XXX';
const cmds = [
  // ══ site-config 52.5 新件 ══
  ["sc FLUIDCANVAS 52.5 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.5'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 52.4 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.4'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.28 赋值(回归) ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.28'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.5 头 ×1", `grep -cF '// v10.28.52.5 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.4 头(回归) ×1", `grep -cF '// v10.28.52.4 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.3 头(回归) ×1", `grep -cF '// v10.28.52.3 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.28 头(回归) ×1", `grep -cF '// v0.2.58.28 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00377 ×1", `grep -cF '${REV77}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00378-??? 占位 ×1", `grep -cF '00378-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00375-nlm(回归) ×1", `grep -cF '00375-nlm' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00376-8qx(回归) ×1", `grep -cF '00376-8qx' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 原话 为什么他没有短暂的滑出画面外 ×1", `grep -cF '为什么他没有短暂的滑出画面外' /app/docs/assets/js/site-config.js`, "1"],
  // ══ 编辑器 52.5 新件 ══
  ["ed 52.5 注释头 ×1", `grep -cF 'v10.28.52.5: 折叠出画加深+画外停一拍+展开加 Q弹' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fine 右缘 214px top 12px 带展开 Q弹 ×1", `grep -cF '.asset-panel-toggle { left: calc(var(--asset-panel-w) - 46px); top: 12px; animation: fcToggleInQSquash 0.28s; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 胶囊让位 46px ×1", `grep -cF '.asset-panel .search-capsule { width: calc(100% - 46px); }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 胶囊 width:100% 基态 ×1", `grep -cF '.asset-panel .search-capsule { width: 100%; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 双动画挂接 ×1", `grep -cF 'animation: fcToggleOutSpring 0.9s, fcToggleQSquash 0.9s;' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 位移关键帧头 ×1", `grep -cF '@keyframes fcToggleOutSpring {' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed Q弹关键帧头 ×1", `grep -cF '@keyframes fcToggleQSquash {' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 28% 深出画 -80px linear ×1", `grep -cF '28%  { left: -80px; animation-timing-function: linear; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 50% 画外停拍 -80px+过冲曲线 ×1", `grep -cF '50%  { left: -80px; animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed Q弹 70% 拉长 ×1", `grep -cF '70%  { transform: scale(1.35, 0.65); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 展开 Q弹关键帧头 ×1", `grep -cF '@keyframes fcToggleInQSquash {' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 45% 展开拉长 ×1", `grep -cF '45%  { transform: scale(1.3, 0.7); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 40×40 同高(52.4 回归) ×1", `grep -cF 'width: 40px; height: 40px; /* 52.4' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed :has 折叠规则(49.1 回归) ×1", `grep -cF '.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 52.2 纯白锚(回归) ×1", `grep -cF 'background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 暗色还原规则(回归) ×1", `grep -cF ':root[data-theme="dark"] .asset-panel-toggle,' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  // ══ 52.4 旧件零残留 ══
  ["ed 旧 30% 浅出画 -40px 零残留 ×0", `grep -cF '30%  { left: -40px' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧 Q弹 58% 拉长站 零残留 ×0", `grep -cF '58%  { transform: scale(1.35, 0.65)' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧 fine 无动画行 零残留 ×0", `grep -cF '.asset-panel-toggle { left: calc(var(--asset-panel-w) - 46px); top: 12px; }' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧左缘 6px top 16px 零残留 ×0", `grep -cF '.asset-panel-toggle { left: 6px; top: 16px; }' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧胶囊让位 38px margin-left 零残留 ×0", `grep -cF 'width: calc(100% - 38px); margin-left: 38px;' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧单动画挂接 零残留 ×0", `grep -cF 'animation: fcToggleOutSpring 0.9s;' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧 32×32 尺寸 零残留 ×0", `grep -cF 'width: 32px; height: 32px;' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧右缘 -38px 式 零残留 ×0", `grep -cF '.asset-panel-toggle { left: calc(var(--asset-panel-w) - 38px); top: 16px; }' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  // ══ 零改动回归 ══
  ["eth v10.28.52.5 零触碰 ×0", `grep -cF 'v10.28.52.5' /app/docs/assets/css/ethereal.css`, "0"],
  ["tr v10.28.52.5 零触碰 ×0", `grep -cF 'v10.28.52.5' /app/docs/assets/js/transitions.js`, "0"],
  ["sn v10.28.52.5 零触碰 ×0", `grep -cF 'v10.28.52.5' /app/docs/assets/js/subnav.js`, "0"],
  ["fch v10.28.52.5 零改动 ×0", `grep -cF 'v10.28.52.5' /app/docs/pages/fluidcanvas.html`, "0"],
  ["msg v10.28.52.5 零改动 ×0", `grep -cF 'v10.28.52.5' /app/docs/pages/messages.html`, "0"],
  ["pm v10.28.52.5 零改动 ×0", `grep -cF 'v10.28.52.5' /app/docs/pages/premium.html`, "0"],
  ["art v10.28.52.5 零改动 ×0", `grep -cF 'v10.28.52.5' /app/docs/pages/article.html`, "0"],
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
  const left = sc.split('\n').filter((l) => l.indexOf('00377-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00377-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
