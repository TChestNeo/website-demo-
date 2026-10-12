// tmp-sed-633.js — 只扫 tmp-battery-*.js：带引号版本串 48.x → 49.0（FC 49.0 轮）
// EXCLUDE=本轮新电池（49.0 口径已写入）；复核 48.2K/48.2M 零误伤（只碰带引号全版本串）
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const EXCLUDE = ['tmp-battery-fc-rotate.js'];
const PAIRS = [
  ["'v10.28.48.0'", "'v10.28.49.0'"],
  ["'v10.28.48.1'", "'v10.28.49.0'"],
  ["'v10.28.48.2'", "'v10.28.49.0'"]
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
console.log('sed 633: ' + swaps + ' swaps / ' + files + ' files');
// 复核：48.xK/48.xM（如 fc-632 的 '48.2K'/'48.2M' 锚）必须原样幸存
let k = 0, m = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!/^tmp-battery-.*\.js$/.test(f)) continue;
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  k += (src.match(/48\.2K/g) || []).length;
  m += (src.match(/48\.2M/g) || []).length;
}
console.log('复核 48.2K 残留（应>0 原样）:', k, '/ 48.2M:', m);
// 复核：电池里已无带引号旧版本串（rotate 除外）
let left = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!/^tmp-battery-.*\.js$/.test(f) || EXCLUDE.indexOf(f) !== -1) continue;
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  for (const [a] of PAIRS) left += src.split(a).length - 1;
}
console.log('复核 带引号 48.x 残留（应为 0）:', left);
