// tmp-sed-603.js — rev 00303 舰队版本锚更新：v10.28.47.3→v10.28.47.4 + 00302-→00303-
// 排除（手工已改，零残留断言/版本锚自相矛盾）：tmp-battery-fc-pilltop.js / tmp-battery-fc-pillmenu.js /
//   tmp-probe-fc-pillmenu.js（本轮手改 47.4+零残留 47.3）、tmp-battery-fc-tags.js / tmp-probe-fc-tags.js
//   （changelog 锚 46.0 保持+零残留 47.3 手改）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-fc-pilltop.js', 'tmp-battery-fc-pillmenu.js',
  'tmp-probe-fc-pillmenu.js', 'tmp-battery-fc-tags.js', 'tmp-probe-fc-tags.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v10.28.47.3').length - 1;
  const b = s.split('00302-').length - 1;
  if (!a && !b) continue;
  s = s.split('v10.28.47.3').join('v10.28.47.4');
  s = s.split('00302-').join('00303-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b;
  console.log(`  ${f}: 47.3×${a} 00302×${b}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r}`);
// 零残留复查（活跃电池/探针内 47.3/00302 不复存在——手工文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v10.28.47.3').length - 1) + (s.split('00302-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
