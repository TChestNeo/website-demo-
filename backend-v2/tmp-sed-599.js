// tmp-sed-599.js — rev 00299 舰队版本锚更新：v10.28.46.0→v10.28.47.0 + 00298-→00299-
// 排除：tmp-battery-fc-tags.js / tmp-probe-fc-tags.js（手工——changelog/editorHtml 源码注释锚保持）、
// tmp-battery-fc-ttlib.js（本轮新写，S1 零残留断言含旧串）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-fc-tags.js', 'tmp-probe-fc-tags.js', 'tmp-battery-fc-ttlib.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v10.28.46.0').length - 1;
  const b = s.split('00298-').length - 1;
  if (!a && !b) continue;
  s = s.split('v10.28.46.0').join('v10.28.47.0');
  s = s.split('00298-').join('00299-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b;
  console.log(`  ${f}: 46.0×${a} 00298×${b}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r}`);
// 零残留复查
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v10.28.46.0').length - 1) + (s.split('00298-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
