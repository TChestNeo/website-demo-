// tmp-verify-643.js — FC v10.28.52.2 折叠按钮+顶部菜单纯白不透明镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 52.2 赋值 ×1/52.1 赋值零残留 ×0/站点 58.28 赋值(回归) ×1/
//     changelog 头 52.2+52.1+52.0+58.28 各 ×1/rev 00371-XXX ×1+00372-??? ×1（回归 00369-gmh/00370-8g7 各 ×1）/原话 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00371-真值 ×1+00371-XXX 零残留（工作树）；00372-??? 仍占位 ×1；
//   编辑器 8 锚（toggle lowest/header lowest/暗色还原 ×2/编辑器注释原话/旧头栏行零残留/:has 折叠规则回归/32×32 正圆回归）；
//   零改动回归（ethereal/transitions/subnav/fluidcanvas/messages/premium/article 52.2 词全 ×0+CSS_MARK 页 ×41）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV71 = process.argv[3] || '00371-XXX';
const cmds = [
  // ══ site-config 52.2 新件 ══
  ["sc FLUIDCANVAS 52.2 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.2'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 52.1 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.1'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.28 赋值(回归) ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.28'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.2 头 ×1", `grep -cF '// v10.28.52.2 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.1 头(回归) ×1", `grep -cF '// v10.28.52.1 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.0 头(回归) ×1", `grep -cF '// v10.28.52.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.28 头(回归) ×1", `grep -cF '// v0.2.58.28 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00371 ×1", `grep -cF '${REV71}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00372-??? 占位 ×1", `grep -cF '00372-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00369-gmh(回归) ×1", `grep -cF '00369-gmh' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00370-8g7(回归) ×1", `grep -cF '00370-8g7' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 原话 折叠按钮的背景能不能改成纯白不透明 ×1", `grep -cF '折叠按钮的背景能不能改成纯白不透明' /app/docs/assets/js/site-config.js`, "1"],
  // ══ 编辑器 52.2 新件（8 锚） ══
  ["ed toggle lowest 纯白锚 ×1", `grep -cF 'background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed header lowest 纯白锚 ×1", `grep -cF 'background: var(--color-surface-container-lowest); /* 42.1 全不透明+52.2 纯白' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 暗色还原选择器行1 ×1", `grep -cF ':root[data-theme="dark"] .asset-panel-toggle,' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 暗色还原选择器行2 ×1", `grep -cF ':root[data-theme="dark"] .editor-header { background: var(--color-surface-container); }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 注释原话 ×1", `grep -cF '那个FC编辑器的左侧菜单的折叠按钮的背景能不能改成' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 旧头栏 surface-container 行零残留 ×0", `grep -cF 'background: var(--color-surface-container); /* 42.1 全不透明：头栏铺不透明底+摘 16px 模糊 */' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed :has 折叠规则(49.1 回归) ×1", `grep -cF '.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 32×32 正圆(49.2 回归) ×1", `grep -cF 'width: 32px; height: 32px;' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  // ══ 零改动回归 ══
  ["eth v10.28.52.2 零触碰 ×0", `grep -cF 'v10.28.52.2' /app/docs/assets/css/ethereal.css`, "0"],
  ["tr v10.28.52.2 零触碰 ×0", `grep -cF 'v10.28.52.2' /app/docs/assets/js/transitions.js`, "0"],
  ["sn v10.28.52.2 零触碰 ×0", `grep -cF 'v10.28.52.2' /app/docs/assets/js/subnav.js`, "0"],
  ["fch v10.28.52.2 零改动 ×0", `grep -cF 'v10.28.52.2' /app/docs/pages/fluidcanvas.html`, "0"],
  ["msg v10.28.52.2 零改动 ×0", `grep -cF 'v10.28.52.2' /app/docs/pages/messages.html`, "0"],
  ["pm v10.28.52.2 零改动 ×0", `grep -cF 'v10.28.52.2' /app/docs/pages/premium.html`, "0"],
  ["art v10.28.52.2 零改动 ×0", `grep -cF 'v10.28.52.2' /app/docs/pages/article.html`, "0"],
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
  const left = sc.split('\n').filter((l) => l.indexOf('00371-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00371-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
