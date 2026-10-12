// tmp-measure-633.js — 633 轮镜像内容验证锚计数实测（写锚前实测家规；行计数 grep -cF 口径）
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const ROOT = path.join(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const lines = (s, pat) => s.split('\n').filter(l => l.indexOf(pat) !== -1).length;

const sc = read('docs/assets/js/site-config.js');
const ed = read('docs/pages/fluidcanvas-editor.html');
const art = read('docs/pages/article.html');
const i18n = read('docs/assets/i18n/fluidcanvas.i18n.js');
const fcPage = read('docs/pages/fluidcanvas.html');

const siteConfigAnchors = [
  "sc FLUIDCANVAS 49.0 赋值", "window.FLUIDCANVAS_VERSION = 'v10.28.49.0';",
  "sc FLUIDCANVAS 48.2 赋值零残留", "window.FLUIDCANVAS_VERSION = 'v10.28.48.2';",
  "sc SITE 58.26 赋值", "window.MN_SITE_VERSION = 'v0.2.58.26';",
  "sc changelog 49.0 头", "// v10.28.49.0 = ",
  "sc changelog 48.2 头", "// v10.28.48.2 = ",
  "sc changelog 58.26 头", "// v0.2.58.26 = ",
  "sc rev 00350-XXX", "00350-XXX",
  "sc rev 00351-???", "00351-???",
  "sc rev 00348-t8b 历史", "00348-t8b",
  "sc rev 00349-hgc 历史", "00349-hgc",
  "sc rev 00347-skv 历史", "00347-skv",
  "sc 词 平板 4:3", "平板 4:3",
  "sc 词 旋转按钮", "旋转按钮",
  "sc 词 autoFlowCards", "autoFlowCards",
  "sc 词 pickReaderLayout", "pickReaderLayout",
  "sc 词 逐设备", "逐设备",
  "sc 词 58.25", "58.25",
];
const editorAnchors = [
  "ed id=rotateWrap", 'id="rotateWrap"',
  "ed id=rotateBtn", 'id="rotateBtn"',
  "ed screen_rotation", "screen_rotation",
  "ed function rotateTablet", "function rotateTablet(",
  "ed window.rotateTablet", "window.rotateTablet",
  "ed var tabletOrientation", "var tabletOrientation",
  "ed tabletOrientation:", "tabletOrientation:",
  "ed function autoFlowCards", "function autoFlowCards(",
  "ed function clampPresetEntry", "function clampPresetEntry(",
  "ed function markPresetCustom", "function markPresetCustom(",
  "ed window.markPresetCustom", "window.markPresetCustom",
  "ed cols: 110", "cols: 110",
  "ed cols: 77", "cols: 77",
  "ed cols: 58", "cols: 58",
  "ed rows: 77", "rows: 77",
  "ed rows: 110", "rows: 110",
  "ed p.cols", "p.cols",
  "ed 'tablet-p'", "'tablet-p'",
  "ed fc-rotate-wrap", "fc-rotate-wrap",
  "ed fc-rot-l", "fc-rot-l",
  "ed fc-rot-p", "fc-rot-p",
  "ed fc.viewport.tablet43", "fc.viewport.tablet43",
  "ed fc.viewport.rotate", "fc.viewport.rotate",
  "ed fc.viewport.landscape", "fc.viewport.landscape",
  "ed fc.viewport.portrait", "fc.viewport.portrait",
  "ed computeCols 新函数", "function computeCols()",
  "ed v10.28.49.0 注释", "v10.28.49.0",
  "ed 旧 return 115 零残留", "return 115;",
];
const articleAnchors = [
  "art 'tablet-p': 20", "'tablet-p': 20",
  "art function pickReaderLayout", "function pickReaderLayout(",
  "art function autoFlowEntries", "function autoFlowEntries(",
  "art orientation portrait", "(orientation: portrait)",
  "art function spanPx", "function spanPx(",
  "art LAYOUT_COLS", "LAYOUT_COLS",
  "art STAGE_COLS = LAYOUT_COLS", "STAGE_COLS = LAYOUT_COLS[layout] || 115;",
  "art STAGE_BASE_ROWS = LAYOUT_ROWS", "STAGE_BASE_ROWS = LAYOUT_ROWS[layout] || 70;",
  "art __slatiForceLayout", "__slatiForceLayout",
  "art v10.28.49.0 注释", "v10.28.49.0",
];
const i18nAnchors = [
  'i18n "fc.viewport.tablet43"', '"fc.viewport.tablet43"',
  'i18n "fc.viewport.rotate"', '"fc.viewport.rotate"',
  'i18n "fc.viewport.landscape"', '"fc.viewport.landscape"',
  'i18n "fc.viewport.portrait"', '"fc.viewport.portrait"',
  'i18n "fc.viewport.tablet" 旧键', '"fc.viewport.tablet"',
  "i18n __ZH_HANT_AUTO__", "__ZH_HANT_AUTO__",
];
const fcPageAnchors = [
  "fcPage v10.28.49.0", "v10.28.49.0",
  "fcPage FC_OVERVIEW 回归", "FC_OVERVIEW",
  "fcPage 48.2K 零残留", "48.2K",
];

console.log('═══ site-config ═══');
for (let i = 0; i < siteConfigAnchors.length; i += 2) {
  console.log(siteConfigAnchors[i] + ' = ' + lines(sc, siteConfigAnchors[i + 1]));
}
console.log('═══ fluidcanvas-editor.html ═══');
for (let i = 0; i < editorAnchors.length; i += 2) {
  console.log(editorAnchors[i] + ' = ' + lines(ed, editorAnchors[i + 1]));
}
console.log('═══ article.html ═══');
for (let i = 0; i < articleAnchors.length; i += 2) {
  console.log(articleAnchors[i] + ' = ' + lines(art, articleAnchors[i + 1]));
}
console.log('═══ fluidcanvas.i18n.js ═══');
for (let i = 0; i < i18nAnchors.length; i += 2) {
  console.log(i18nAnchors[i] + ' = ' + lines(i18n, i18nAnchors[i + 1]));
}
console.log('═══ fluidcanvas.html 回归 ═══');
for (let i = 0; i < fcPageAnchors.length; i += 2) {
  console.log(fcPageAnchors[i] + ' = ' + lines(fcPage, fcPageAnchors[i + 1]));
}
