// tmp-sed-635.js — 只扫 tmp-battery-*.js：带引号版本串 49.1 → 49.2（FC 49.2 圆形折叠按钮轮）
// EXCLUDE=空（paneltoggle 电池 S1 版本赋值锚一并翻转；其 S2 裸 49.1 锚/rev 锚改前缀由手工修）；复核裸 changelog 头锚（// v10.28.49.1 = /49.0 = ）原样幸存
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const EXCLUDE = [];
const PAIRS = [
  ["'v10.28.49.1'", "'v10.28.49.2'"]
];
let swaps = 0, files = 0;
const list = fs.readdirSync(DIR).filter(f => /^tmp-battery-.*\.js$/.test(f) && EXCLUDE.indexOf(f) === -1);
for (const f of list) {
  const p = path.join(DIR, f);
  let src = fs.readFileSync(p, 'utf8');
  let changed = false;
  for (const [a, b] of PAIRS) {
    const n = src.split(a).length - 1;
    if (n > 0) { src = src.split(a).join(b); swaps += n; changed = true; }
  }
  if (changed) { fs.writeFileSync(p, src); files++; }
}
console.log('sed 635: ' + swaps + ' swaps / ' + files + ' files');
// 复核：裸 changelog 头锚 49.1/49.0 必须原样幸存（49.1 头本轮仍留在 site-config 只是被降级）
let bare49_1 = 0, bare49_0 = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!/^tmp-battery-.*\.js$/.test(f)) continue;
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  bare49_1 += (src.match(/\/\/ v10\.28\.49\.1 = /g) || []).length;
  bare49_0 += (src.match(/\/\/ v10\.28\.49\.0 = /g) || []).length;
}
console.log('复核 裸 changelog 头锚残留（49.1/49.0）:', bare49_1 + '/' + bare49_0);
// 复核：电池里已无带引号旧版本串
let left = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!/^tmp-battery-.*\.js$/.test(f) || EXCLUDE.indexOf(f) !== -1) continue;
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  for (const [a] of PAIRS) left += src.split(a).length - 1;
}
console.log('复核 带引号 49.1 残留（应为 0）:', left);
