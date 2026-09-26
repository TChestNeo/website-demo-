// tmp-sed-614.js — 58.8 终态 rev 00312-2n7：舰队 rev 锚 00311-→00312-（二次烘焙后终态真值）
//   只扫 tmp-battery-*.js / tmp-probe-*.js（site-config 手工已改、runner/sed/historical 脚本不扫）。
//   排除：tmp-battery-605-lvpill.js（本轮手工已改 00312-+瞬态注记）、
//   tmp-probe-610-lvwater.js（烘焙 rev 00310-pbk 历史文本恒 1 处不扫）、
//   tmp-probe-609-lvwater.js（58.6 时代孤儿存档不再复跑）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-605-lvpill.js', 'tmp-probe-609-lvwater.js', 'tmp-probe-610-lvwater.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('00311-').length - 1;
  if (!a) continue;
  s = s.split('00311-').join('00312-');
  fs.writeFileSync(full, s, 'utf8');
  v += a;
  console.log(`  ${f}: 00311×${a}`);
}
console.log(`合计 ${files.length} 文件扫描、rev×${v}`);
// 零残留复查（活跃电池/探针内 00311- 不复存在——排除文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('00311-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针 00311- 零残留' : '❌ 残留 ' + left);
