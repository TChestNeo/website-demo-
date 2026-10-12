// tmp-sed-634.js — 只扫 tmp-battery-*.js：带引号版本串 49.0 → 49.1（FC 49.1 补丁轮）
// EXCLUDE=本轮新电池（49.1 口径已写入）；复核 fc-rotate 裸 changelog 头锚（// v10.28.49.0 = ）原样幸存
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const EXCLUDE = ['tmp-battery-fc-paneltoggle.js'];
const PAIRS = [
  ["'v10.28.49.0'", "'v10.28.49.1'"]
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
console.log('sed 634: ' + swaps + ' swaps / ' + files + ' files');
// 复核：fc-rotate 裸 changelog 头锚（// v10.28.49.0 = ）必须原样幸存
let bare = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!/^tmp-battery-.*\.js$/.test(f)) continue;
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  bare += (src.match(/\/\/ v10\.28\.49\.0 = /g) || []).length;
}
console.log('复核 裸 changelog 头锚 49.0 残留（fc-rotate 应为 1）:', bare);
// 复核：电池里已无带引号旧版本串（新电池除外）
let left = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!/^tmp-battery-.*\.js$/.test(f) || EXCLUDE.indexOf(f) !== -1) continue;
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  for (const [a] of PAIRS) left += src.split(a).length - 1;
}
console.log('复核 带引号 49.0 残留（应为 0）:', left);
