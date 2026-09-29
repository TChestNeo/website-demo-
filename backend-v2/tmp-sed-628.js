// tmp-sed-628.js — v0.2.58.22 版本/rev token 族扫描（rev 00340-XXX 瞬态 → 00341-??? 终态）
// 替换：'v0.2.58.21'→'v0.2.58.22'、'00338-'→'00340-'、'00339-'→'00341-'（占位后缀同语义直映）
// 范围：tmp-battery-*.js + tmp-probe-*.js
// EXCLUDE：tmp-battery-profile-subtier.js、tmp-battery-settings-profilecust.js、tmp-battery-profile-banner.js
//   （三电池=终态口径手写：零残留/真值串会被污染）+ tmp-probe-usercard-628.js（手写终态）
// （tmp-verify-* 历史档案/  site-config/docs 不在 glob 范围）
// 家规：实测计数先行——先报每文件每 token 计数，替换后再报变化；rev 计数锚 ×2→×1 需手改（本脚本不碰）
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const PAIRS = [
  ['v0.2.58.21', 'v0.2.58.22'],
  ['00338-', '00340-'],
  ['00339-', '00341-']
];
const EXCLUDE = new Set(['tmp-battery-profile-subtier.js', 'tmp-battery-settings-profilecust.js', 'tmp-battery-profile-banner.js', 'tmp-probe-usercard-628.js']);
const files = [];
for (const f of fs.readdirSync(DIR)) {
  if ((f.startsWith('tmp-battery-') || f.startsWith('tmp-probe-')) && f.endsWith('.js') && !EXCLUDE.has(f)) files.push(f);
}
const cnt = (s, t) => s.split(t).length - 1;
let total = 0;
for (const f of files.sort()) {
  const p = path.join(DIR, f);
  let src = fs.readFileSync(p, 'utf8');
  const before = PAIRS.map(([a]) => cnt(src, a)).join('/');
  let changed = false;
  for (const [a, b] of PAIRS) {
    if (src.indexOf(a) !== -1) { src = src.split(a).join(b); changed = true; }
  }
  if (changed) {
    fs.writeFileSync(p, src);
    const after = PAIRS.map(([, b]) => cnt(src, b)).join('/');
    const realBefore = before.split('/').map(Number).reduce((x, y) => x + y, 0);
    console.log(f + '  [' + before + '] → [' + after + ']');
    total += realBefore;
  } else {
    console.log(f + '  零命中');
  }
}
console.log('总替换 ' + total + ' 处');
