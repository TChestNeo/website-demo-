// tmp-verify-647.js — FC v10.28.53.0 边缘 Mask 化镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 53.0 赋值 ×1/52.5 赋值零残留 ×0/站点 58.28 赋值(回归) ×1/
//     changelog 头 53.0+52.5+52.4+58.28 各 ×1/rev 00379-XXX ×1+00380-??? ×1（回归 00377-628/00378-rjd 各 ×1）/原话 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00379-真值 ×1+00379-XXX 零残留（工作树）；00380-??? 仍占位 ×1；
//   编辑器 53.0 新件（53.0 注释头/Mask 规则/CUSTOM_EDGE_EXPAND/expandClipPct/setEdgeMaskSync/renderEdgeMaskSec/clipRaw/setProperty/勾选框）
//     + 52.5 回归锚（52.5 注释头/fine 右缘 214px/40×40 同高/:has 折叠/52.2 纯白/暗色还原）；
//   52.4 旧件零残留 6 锚（30% 浅出画 -40px/58% 拉长站/左缘 6px top 16px/38px 让位 margin-left/单动画/32×32）×0；
//   零改动回归（ethereal/transitions/subnav/fluidcanvas/messages/premium/article 53.0 词全 ×0+CSS_MARK 页 ×41）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV79 = process.argv[3] || '00379-XXX';
const cmds = [
  // ══ site-config 53.0 新件 ══
  ["sc FLUIDCANVAS 53.0 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.53.0'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 52.5 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.5'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.28 赋值(回归) ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.28'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 53.0 头 ×1", `grep -cF '// v10.28.53.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.5 头(回归) ×1", `grep -cF '// v10.28.52.5 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.4 头(回归) ×1", `grep -cF '// v10.28.52.4 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.28 头(回归) ×1", `grep -cF '// v0.2.58.28 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00379 ×1", `grep -cF '${REV79}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00380-??? 占位 ×1", `grep -cF '00380-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00377-628(回归) ×1", `grep -cF '00377-628' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00378-rjd(回归) ×1", `grep -cF '00378-rjd' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 原话 把边缘改成像Alight Motion 里的Mask一样 ×1", `grep -cF '把边缘改成像Alight Motion 里的Mask一样' /app/docs/assets/js/site-config.js`, "1"],
  // ══ 编辑器 53.0 新件 ══
  ["ed 53.0 注释头 ×1", `grep -cF 'v10.28.53.0 — 边缘 Mask（用户：边缘像 Alight Motion 的 Mask 一样' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed Mask 规则 card-stripes ×1", `grep -cF '.grid-card .card-stripes { clip-path: var(--card-mask-clip, none); }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed CUSTOM_EDGE_EXPAND ×1", `grep -cF 'var CUSTOM_EDGE_EXPAND = 0.06;' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed expandClipPct 函数头 ×1", `grep -cF 'function expandClipPct(clip, f) {' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed window.expandClipPct 暴露 ×1", `grep -cF 'window.expandClipPct = expandClipPct;' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed setEdgeMaskSync 函数头 ×1", `grep -cF 'function setEdgeMaskSync(on) {' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed renderEdgeMaskSec 函数头 ×1", `grep -cF 'function renderEdgeMaskSec() {' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed clipRaw: e.clip ×1", `grep -cF 'clipRaw: e.clip,' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed --card-mask-clip setProperty ×1", `grep -cF 'card.style.setProperty('\\''--card-mask-clip'\\'', edge.clipRaw || edge.clip);' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fcEdgeMaskSync 勾选框 ×1", `grep -cF '<input type="checkbox" id="fcEdgeMaskSync"' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed clip expandClipPct(e.clip, CUSTOM_EDGE_EXPAND) ×1", `grep -cF 'clip: expandClipPct(e.clip, CUSTOM_EDGE_EXPAND),' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  // ══ 编辑器 52.5 回归 ══
  ["ed 52.5 注释头(回归) ×1", `grep -cF 'v10.28.52.5: 折叠出画加深+画外停一拍+展开加 Q弹' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fine 右缘 214px(回归) ×1", `grep -cF '.asset-panel-toggle { left: calc(var(--asset-panel-w) - 46px); top: 12px; animation: fcToggleInQSquash 0.28s; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 40×40 同高(52.4 回归) ×1", `grep -cF 'width: 40px; height: 40px; /* 52.4' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed :has 折叠规则(49.1 回归) ×1", `grep -cF '.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 52.2 纯白锚(回归) ×1", `grep -cF 'background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 暗色还原规则(回归) ×1", `grep -cF ':root[data-theme="dark"] .asset-panel-toggle,' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  // ══ 52.4 旧件零残留 ══
  ["ed 旧 30% 浅出画 -40px 零残留 ×0", `grep -cF '30%  { left: -40px' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧 Q弹 58% 拉长站 零残留 ×0", `grep -cF '58%  { transform: scale(1.35, 0.65)' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧左缘 6px top 16px 零残留 ×0", `grep -cF '.asset-panel-toggle { left: 6px; top: 16px; }' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧胶囊让位 38px margin-left 零残留 ×0", `grep -cF 'width: calc(100% - 38px); margin-left: 38px;' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧单动画挂接 零残留 ×0", `grep -cF 'animation: fcToggleOutSpring 0.9s;' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed 旧 32×32 尺寸 零残留 ×0", `grep -cF 'width: 32px; height: 32px;' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  // ══ 零改动回归 ══
  ["eth v10.28.53.0 零触碰 ×0", `grep -cF 'v10.28.53.0' /app/docs/assets/css/ethereal.css`, "0"],
  ["tr v10.28.53.0 零触碰 ×0", `grep -cF 'v10.28.53.0' /app/docs/assets/js/transitions.js`, "0"],
  ["sn v10.28.53.0 零触碰 ×0", `grep -cF 'v10.28.53.0' /app/docs/assets/js/subnav.js`, "0"],
  ["fch v10.28.53.0 零改动 ×0", `grep -cF 'v10.28.53.0' /app/docs/pages/fluidcanvas.html`, "0"],
  ["msg v10.28.53.0 零改动 ×0", `grep -cF 'v10.28.53.0' /app/docs/pages/messages.html`, "0"],
  ["pm v10.28.53.0 零改动 ×0", `grep -cF 'v10.28.53.0' /app/docs/pages/premium.html`, "0"],
  ["art v10.28.53.0 零改动 ×0", `grep -cF 'v10.28.53.0' /app/docs/pages/article.html`, "0"],
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
  const left = sc.split('\n').filter((l) => l.indexOf('00379-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00379-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
