// tmp-build-fc-i18n.js — 组装 docs/assets/i18n/fluidcanvas.i18n.js
// zh = 提取当前渲染文本（键覆盖 tmp-fc-dict-zh-ascii.json 的中文翻译）
// en = ASCII 原文逐字 + tmp-fc-dict-en-zh.json 的英文翻译
// 其余 9 语言读 tmp-fc-dict-{lang}.json（全部 501 键，由翻译轮产出）
// 覆盖检查：缺键/多键/占位符损坏都会报错退出。zh-Hant 由 tmp-i18n-hant.js 另跑。
'use strict';
const fs = require('fs');
const path = require('path');
const here = __dirname;

const extracted = require(path.join(here, 'tmp-fc-i18n-keys2.json'));
const zhAscii = JSON.parse(fs.readFileSync(path.join(here, 'tmp-fc-dict-zh-ascii.json'), 'utf8'));
const enZh = JSON.parse(fs.readFileSync(path.join(here, 'tmp-fc-dict-en-zh.json'), 'utf8'));

const LANGS = ['de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt'];
const keys = Object.keys(extracted).sort();

// ── 占位符检查：翻译必须保留原占位符集合（%s/%d 等，按首现顺序去重对比）
function phSet(s) { return (s.match(/%[a-z]/g) || []).sort().join(','); }
function checkPh(key, ref, val) {
  if (phSet(ref) !== phSet(val)) {
    console.error('❌ 占位符损坏 ' + key + ': ref[' + phSet(ref) + '] got[' + phSet(val) + ']');
    process.exitCode = 1;
  }
}

// ── zh / en 构建 + 覆盖检查
const zh = {}, en = {};
for (const k of keys) {
  const cur = extracted[k].zh;
  if (cur == null) { console.error('❌ 提取缺失:', k); process.exitCode = 1; continue; }
  zh[k] = (k in zhAscii) ? zhAscii[k] : cur;
  en[k] = /^[\x20-\x7E　]*$/.test(cur) ? cur : enZh[k];
  if (en[k] === undefined) { console.error('❌ en 缺失:', k); process.exitCode = 1; }
  checkPh(k, cur, zh[k]); checkPh(k, cur, en[k]);
}
for (const k of Object.keys(zhAscii)) if (!extracted[k]) { console.error('❌ zh-ascii 多键:', k); process.exitCode = 1; }
for (const k of Object.keys(enZh)) if (!extracted[k]) { console.error('❌ en-zh 多键:', k); process.exitCode = 1; }
// 反向覆盖：英文原文键必须都有 zh 中文翻译（ASCII 或含排版符号的英文串）
const EN_RE = /^[\x20-\x7E　·–—→↑…]*$/;
for (const k of keys) {
  if (EN_RE.test(extracted[k].zh) && !(k in zhAscii)) { console.error('❌ zh-ascii 缺键:', k); process.exitCode = 1; }
}

// ── 其余 9 语言
const others = {};
for (const l of LANGS) {
  const f = path.join(here, 'tmp-fc-dict-' + l + '.json');
  if (!fs.existsSync(f)) { console.error('❌ 缺语言文件:', f); process.exitCode = 1; continue; }
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const k of keys) {
    if (d[k] === undefined) { console.error('❌ ' + l + ' 缺键:', k); process.exitCode = 1; }
    else { checkPh(k, en[k], d[k]); others[l] = others[l] || {}; others[l][k] = d[k]; }
  }
  for (const k of Object.keys(d)) if (!extracted[k]) { console.error('❌ ' + l + ' 多键:', k); process.exitCode = 1; }
}
if (process.exitCode) process.exit(1);

// ── 组装 JS
const q = JSON.stringify;
const block = (lang, dict) =>
  "window.MN_I18N.add('" + lang + "', {\n  " + keys.map(k => q(k) + ': ' + q(dict[k])).join(',\n  ') + '\n});';

const header = `/**
 * M.NationWorld i18n — FluidCanvas 两页共享字典（fluidcanvas.html + fluidcanvas-editor.html）。
 *
 * v10.28.45.1（rev 00296-XXX）：FC 两页接入全站 12 语言。zh 块值 = 当前已渲染文本
 * （英文 chrome 按用户钦定换中文）；en 块值 = 英文原文/译文逐字；其余语言为翻译。
 * zh-Hant 由 tmp-i18n-hant.js OpenCC cn→tw 自动生成（文件尾 __ZH_HANT_AUTO__ 段，勿手改）。
 * 卡片类型名显示层本地化：草稿存储的 dataset.label 英文规范名不动。
 */
(function () {
  'use strict';
  if (!window.MN_I18N) return;
`;

const out = header + '\n  // ── zh 简体（默认） ──\n  ' + block('zh', zh) + '\n\n  // ── en 英语 ──\n  ' + block('en', en) +
  '\n' + LANGS.map(l => '\n  // ── ' + l + ' ──\n  ' + block(l, others[l])).join('') +
  '\n})();\n';
const dest = path.join(here, '..', 'docs', 'assets', 'i18n', 'fluidcanvas.i18n.js');
fs.writeFileSync(dest, out, 'utf8');
console.log('✅ fluidcanvas.i18n.js ' + keys.length + ' 键 × ' + (LANGS.length + 2) + ' 语言');
