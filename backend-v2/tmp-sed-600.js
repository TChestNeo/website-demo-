// tmp-sed-600.js — rev 00300 舰队版本锚更新：v10.28.47.0→v10.28.47.1 + 00299-→00300-
// 排除：tmp-battery-fc-tags.js / tmp-probe-fc-tags.js / tmp-battery-fc-ttlib.js / tmp-probe-fc-ttlib.js
// （手工——changelog 锚/零残留断言已手改）、tmp-battery-fc-ttwide.js / tmp-probe-fc-ttwide.js（本轮新写已 47.1）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-fc-tags.js', 'tmp-probe-fc-tags.js',
  'tmp-battery-fc-ttlib.js', 'tmp-probe-fc-ttlib.js',
  'tmp-battery-fc-ttwide.js', 'tmp-probe-fc-ttwide.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v10.28.47.0').length - 1;
  const b = s.split('00299-').length - 1;
  if (!a && !b) continue;
  s = s.split('v10.28.47.0').join('v10.28.47.1');
  s = s.split('00299-').join('00300-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b;
  console.log(`  ${f}: 47.0×${a} 00299×${b}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r}`);
// 零残留复查（活跃电池/探针内 47.0/00299 不复存在——手工文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v10.28.47.0').length - 1) + (s.split('00299-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
