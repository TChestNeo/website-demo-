// tmp-sed-601.js — rev 00301 舰队版本锚更新：v10.28.47.1→v10.28.47.2 + 00300-→00301-
// 排除：tmp-battery-fc-tags.js / tmp-probe-fc-tags.js / tmp-battery-fc-ttlib.js / tmp-probe-fc-ttlib.js /
//   tmp-battery-fc-ttwide.js / tmp-probe-fc-ttwide.js / tmp-battery-fc-pillmenu.js / tmp-probe-fc-pillmenu.js
// （手工——changelog 锚/零残留断言已手改）、tmp-battery-fc-pilltop.js（本轮新写已 47.2）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-fc-tags.js', 'tmp-probe-fc-tags.js',
  'tmp-battery-fc-ttlib.js', 'tmp-probe-fc-ttlib.js',
  'tmp-battery-fc-ttwide.js', 'tmp-probe-fc-ttwide.js',
  'tmp-battery-fc-pillmenu.js', 'tmp-probe-fc-pillmenu.js',
  'tmp-battery-fc-pilltop.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v10.28.47.1').length - 1;
  const b = s.split('00300-').length - 1;
  if (!a && !b) continue;
  s = s.split('v10.28.47.1').join('v10.28.47.2');
  s = s.split('00300-').join('00301-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b;
  console.log(`  ${f}: 47.1×${a} 00300×${b}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r}`);
// 零残留复查（活跃电池/探针内 47.1/00300 不复存在——手工文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v10.28.47.1').length - 1) + (s.split('00300-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
