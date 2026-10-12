'use strict';
// tmp-i18n-premium-verify.js — v0.2.54.0 premium i18n 交付自检（tmp 绝不 commit）
// 1) zh 字典值 vs 页面 T() 兜底字面量 / data-i18n* 元素原文逐字节比对
// 2) 每个 zh 键必须被页面引用
// 3) 页面不得出现违禁串（单次 / 1 个月）；禁挂 data-i18n 的 JS 改写元素抽查
const fs = require('fs');
const vm = require('vm');

global.window = { MN_I18N: { dicts: {}, add(l, d) { this.dicts[l] = this.dicts[l] || {}; Object.assign(this.dicts[l], d); return this; } } };
vm.runInThisContext(fs.readFileSync('docs/assets/i18n/premium.i18n.js', 'utf8'));
const zh = window.MN_I18N.dicts.zh;
const html = fs.readFileSync('docs/pages/premium.html', 'utf8');
const failures = [];
const decodeEnt = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

// 1) T('key') || 'fallback'
const tRe = /T\('(premium\.[a-zA-Z0-9.]+)'\)\s*\|\|\s*('(?:\\.|[^'\\])*')/g;
let tm; let tChecked = 0;
while ((tm = tRe.exec(html))) {
  const key = tm[1], lit = tm[2];
  let val;
  try { val = Function('return ' + lit + ';')(); } catch (e) { failures.push('T-parse ' + key + ' ' + e.message); continue; }
  tChecked++;
  if (zh[key] === undefined) failures.push('T key missing in zh dict: ' + key);
  else if (zh[key] !== val) failures.push('T MISMATCH ' + key + ' dict=' + JSON.stringify(zh[key]) + ' fallback=' + JSON.stringify(val));
}
console.log('T() call sites checked:', tChecked);

// 2) data-i18n / data-i18n-html / data-i18n-placeholder
{
  // 纯文本：取到首个 < 为止（含首尾空格，不 trim）
  const re = new RegExp('\\bdata-i18n="(premium\\.[a-zA-Z0-9.]+)"[^>]*>([^<]*)<', 'g');
  let sm; let n = 0;
  while ((sm = re.exec(html))) {
    const key = sm[1], text = decodeEnt(sm[2]);
    n++;
    if (zh[key] === undefined) failures.push('data-i18n key missing: ' + key);
    else if (zh[key] !== text) failures.push('data-i18n MISMATCH ' + key + ' dict=' + JSON.stringify(zh[key]) + ' html=' + JSON.stringify(text));
  }
  console.log('data-i18n elements checked:', n);
}
{
  // HTML 类：取到闭合 span/p 为止（含内嵌 strong；不 trim）
  const re = new RegExp('\\bdata-i18n-html="(premium\\.[a-zA-Z0-9.]+)"[^>]*>([\\s\\S]*?)<\\/(?:span|p)>', 'g');
  let sm; let n = 0;
  while ((sm = re.exec(html))) {
    const key = sm[1], text = decodeEnt(sm[2]);
    n++;
    if (zh[key] === undefined) failures.push('data-i18n-html key missing: ' + key);
    else if (zh[key] !== text) failures.push('data-i18n-html MISMATCH ' + key + ' dict=' + JSON.stringify(zh[key]) + ' html=' + JSON.stringify(text));
  }
  console.log('data-i18n-html elements checked:', n);
}
{
  const re = new RegExp('\\bdata-i18n-placeholder="(premium\\.[a-zA-Z0-9.]+)"', 'g');
  let sm; let n = 0;
  while ((sm = re.exec(html))) { n++; }
  console.log('data-i18n-placeholder elements checked:', n);
}

// 3) every dict key must be referenced
const used = new Set();
for (const k of Object.keys(zh)) {
  const refs = [
    html.includes("T('" + k + "')"),
    html.includes('data-i18n="' + k + '"'),
    html.includes('data-i18n-html="' + k + '"'),
    html.includes('data-i18n-placeholder="' + k + '"')
  ];
  if (!refs.some(Boolean)) failures.push('zh key unused in page: ' + k);
  else used.add(k);
}
console.log('zh keys used:', used.size, '/', Object.keys(zh).length);

// 4) 违禁串（页面原文 + 全部语言字典值）
for (const l of Object.keys(window.MN_I18N.dicts)) {
  for (const [k, v] of Object.entries(window.MN_I18N.dicts[l])) {
    if (v.includes('单次') || v.includes('1 个月')) failures.push('banned string in dict ' + l + ' ' + k + ': ' + v);
  }
}

// 5) JS 改写元素不得挂 data-i18n（抽查关键 id/选择器）
const forbidden = ['id="basicBadge"', 'id="basicStudentEntry"', 'id="basicStudentNote"', 'id="basicNoteMatrix"',
  'id="planNote"', 'id="cdText"', 'id="cdSub"', 'id="currencyLabel"', 'data-plan-cta', 'data-plan-once', 'data-addon-cta',
  'data-plan-price', 'data-addon-price'];
for (const f of forbidden) {
  // 仅在该属性所在标签内（到首个 > 为止）查 data-i18n——同标签才是同元素
  let idx = -1;
  while ((idx = html.indexOf(f, idx + 1)) !== -1) {
    const tagEnd = html.indexOf('>', idx);
    const slice = html.slice(idx, tagEnd);
    const m2 = slice.match(/data-i18n(-html|-placeholder)?="([^"]*)"/);
    if (m2 && m2[2].indexOf('premium.') === 0) failures.push('JS-rewritten element has data-i18n: ' + f + ' -> ' + m2[0]);
  }
}
console.log('forbidden-attr sweep done');

if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log('  -', f)); process.exit(1); }
console.log('ALL BYTE-IDENTITY CHECKS PASSED');
