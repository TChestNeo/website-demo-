// tmp-verify-633.js — FC v10.28.49.0 平板 4:3 视口+旋转按钮+逐设备布局镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 49.0 赋值 ×1/48.2 赋值零残留/双 changelog 头/rev 00350-XXX ×1+00351-??? ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00350-真值 ×1+00350-XXX 零残留；00351-??? 仍占位 ×1；
//   编辑器 49.0 新件（rotateWrap/rotateBtn/screen_rotation/rotateTablet/tabletOrientation/autoFlowCards/clampPresetEntry/
//     markPresetCustom 导出/PRESETS cols rows 四值/p.cols/'tablet-p' ×13/fc-rotate-wrap ×3/fc-rot-l ×3/fc-rot-p ×3/
//     i18n 锚 fc.viewport.tablet43 等四键各 ×1/return 115 零残留）；
//   article.html（'tablet-p': 20/pickReaderLayout/autoFlowEntries/orientation portrait ×3/spanPx/LAYOUT_COLS ×5/
//     STAGE_COLS = LAYOUT_COLS/STAGE_BASE_ROWS = LAYOUT_ROWS/__slatiForceLayout ×3）；
//   i18n 4 新键 ×12+旧 tablet 键 ×12+__ZH_HANT_AUTO__ ×2；
//   fluidcanvas.html 零改动回归（v10.28.49.0 ×0/FC_OVERVIEW ×41/48.2K ×1 注释）；
//   计数全部=tmp-measure-633.js 实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义零双引号进 argv）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV50 = process.argv[3] || '00350-XXX';
const cmds = [
  // ══ site-config 49.0 新件 ══
  ["sc FLUIDCANVAS 49.0 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.49.0'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 48.2 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.48.2'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.26 赋值 ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.26'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 49.0 头 ×1", `grep -cF '// v10.28.49.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 48.2 头(回归) ×1", `grep -cF '// v10.28.48.2 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.26 头(回归) ×1", `grep -cF '// v0.2.58.26 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00350 ×1", `grep -cF '${REV50}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00351-??? ×1", `grep -cF '00351-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00348-t8b(回归) ×2", `grep -cF '00348-t8b' /app/docs/assets/js/site-config.js`, "2"],
  ["sc rev 00349-hgc(回归) ×2", `grep -cF '00349-hgc' /app/docs/assets/js/site-config.js`, "2"],
  ["sc rev 00347-skv(回归) ×2", `grep -cF '00347-skv' /app/docs/assets/js/site-config.js`, "2"],
  ["sc 词 平板 4:3 ×1", `grep -cF '平板 4:3' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 词 旋转按钮 ×4", `grep -cF '旋转按钮' /app/docs/assets/js/site-config.js`, "4"],
  ["sc 词 autoFlowCards ×1", `grep -cF 'autoFlowCards' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 词 pickReaderLayout ×1", `grep -cF 'pickReaderLayout' /app/docs/assets/js/site-config.js`, "1"],
  // ══ fluidcanvas-editor.html 49.0 新件 ══
  ["ed id=rotateWrap ×1", `grep -cF 'id="rotateWrap"' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed id=rotateBtn ×1", `grep -cF 'id="rotateBtn"' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed screen_rotation ×1", `grep -cF 'screen_rotation' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed function rotateTablet ×1", `grep -cF 'function rotateTablet(' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed window.rotateTablet ×1", `grep -cF 'window.rotateTablet' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed var tabletOrientation ×1", `grep -cF 'var tabletOrientation' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed tabletOrientation: ×1", `grep -cF 'tabletOrientation:' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed function autoFlowCards ×1", `grep -cF 'function autoFlowCards(' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed function clampPresetEntry ×1", `grep -cF 'function clampPresetEntry(' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed function markPresetCustom ×1", `grep -cF 'function markPresetCustom(' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed window.markPresetCustom ×1", `grep -cF 'window.markPresetCustom' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed cols: 110 ×1", `grep -cF 'cols: 110' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed cols: 77 ×1", `grep -cF 'cols: 77' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed cols: 58 ×1", `grep -cF 'cols: 58' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed rows: 77 ×1", `grep -cF 'rows: 77' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed rows: 110 ×1", `grep -cF 'rows: 110' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed p.cols ×1", `grep -cF 'p.cols' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 'tablet-p' ×13", `grep -cF ''\\''tablet-p'\\''' /app/docs/pages/fluidcanvas-editor.html`, "13"],
  ["ed fc-rotate-wrap ×3", `grep -cF 'fc-rotate-wrap' /app/docs/pages/fluidcanvas-editor.html`, "3"],
  ["ed fc-rot-l ×3", `grep -cF 'fc-rot-l' /app/docs/pages/fluidcanvas-editor.html`, "3"],
  ["ed fc-rot-p ×3", `grep -cF 'fc-rot-p' /app/docs/pages/fluidcanvas-editor.html`, "3"],
  ["ed fc.viewport.tablet43 ×1", `grep -cF 'fc.viewport.tablet43' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fc.viewport.rotate ×1", `grep -cF 'fc.viewport.rotate' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fc.viewport.landscape ×1", `grep -cF 'fc.viewport.landscape' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fc.viewport.portrait ×1", `grep -cF 'fc.viewport.portrait' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 旧 return 115 零残留 ×0", `grep -cF 'return 115;' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed v10.28.49.0 注释 ×16", `grep -cF 'v10.28.49.0' /app/docs/pages/fluidcanvas-editor.html`, "16"],
  // ══ article.html 49.0 新件 ══
  ["art 'tablet-p': 20 ×1", `grep -cF ''\\''tablet-p'\\'': 20' /app/docs/pages/article.html`, "1"],
  ["art function pickReaderLayout ×1", `grep -cF 'function pickReaderLayout(' /app/docs/pages/article.html`, "1"],
  ["art function autoFlowEntries ×1", `grep -cF 'function autoFlowEntries(' /app/docs/pages/article.html`, "1"],
  ["art orientation portrait ×3", `grep -cF '(orientation: portrait)' /app/docs/pages/article.html`, "3"],
  ["art function spanPx ×1", `grep -cF 'function spanPx(' /app/docs/pages/article.html`, "1"],
  ["art LAYOUT_COLS ×5", `grep -cF 'LAYOUT_COLS' /app/docs/pages/article.html`, "5"],
  ["art STAGE_COLS = LAYOUT_COLS ×1", `grep -cF 'var STAGE_COLS = LAYOUT_COLS[layout] || 115;' /app/docs/pages/article.html`, "1"],
  ["art STAGE_BASE_ROWS = LAYOUT_ROWS ×1", `grep -cF 'var STAGE_BASE_ROWS = LAYOUT_ROWS[layout] || 70;' /app/docs/pages/article.html`, "1"],
  ["art __slatiForceLayout ×3", `grep -cF '__slatiForceLayout' /app/docs/pages/article.html`, "3"],
  ["art v10.28.49.0 注释 ×10", `grep -cF 'v10.28.49.0' /app/docs/pages/article.html`, "10"],
  // ══ i18n 4 新键 ×12 + 旧键保留 ══
  ["i18n \"fc.viewport.tablet43\" ×12", `grep -cF '"fc.viewport.tablet43"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n \"fc.viewport.rotate\" ×12", `grep -cF '"fc.viewport.rotate"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n \"fc.viewport.landscape\" ×12", `grep -cF '"fc.viewport.landscape"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n \"fc.viewport.portrait\" ×12", `grep -cF '"fc.viewport.portrait"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n \"fc.viewport.tablet\" 旧键 ×12", `grep -cF '"fc.viewport.tablet"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n __ZH_HANT_AUTO__ ×2", `grep -cF '__ZH_HANT_AUTO__' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "2"],
  // ══ fluidcanvas.html 零改动回归 ══
  ["fcPage v10.28.49.0 零 ×0", `grep -cF 'v10.28.49.0' /app/docs/pages/fluidcanvas.html`, "0"],
  ["fcPage FC_OVERVIEW(回归) ×41", `grep -cF 'FC_OVERVIEW' /app/docs/pages/fluidcanvas.html`, "41"],
  ["fcPage 48.2K(回归注释) ×1", `grep -cF '48.2K' /app/docs/pages/fluidcanvas.html`, "1"],
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
if (MODE === 2) {
  const sc = fs.readFileSync(path.join(HERE, '..', 'docs', 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const left = sc.split('\n').filter((l) => l.indexOf('00350-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00350-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
