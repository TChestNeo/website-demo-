// tmp-sed-604.js — rev 00304 舰队版本锚更新：站点 v0.2.58.0→v0.2.58.1 + 00303-→00304-
// 排除（手工已改）：tmp-battery-sidebar-light.js（本轮整体重写）、tmp-battery-micro-v056.js
//   （B6 版本断言+标签手工改）。FC 47.4 锚零触碰（FC 本轮零改动）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-sidebar-light.js', 'tmp-battery-micro-v056.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v0.2.58.0').length - 1;
  const b = s.split('00303-').length - 1;
  if (!a && !b) continue;
  s = s.split('v0.2.58.0').join('v0.2.58.1');
  s = s.split('00303-').join('00304-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b;
  console.log(`  ${f}: 58.0×${a} 00303×${b}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r}`);
// 零残留复查（活跃电池/探针内 58.0/00303- 不复存在——手工文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v0.2.58.0').length - 1) + (s.split('00303-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
