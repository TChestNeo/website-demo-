// tmp-sed-613.js — 58.8 舰队版本锚更新：站点 v0.2.58.7→v0.2.58.8 + rev 00310-→00311-
//   只扫 tmp-battery-*.js / tmp-probe-*.js（site-config 手工已改、runner/sed/historical 脚本不扫）。
//   排除：tmp-battery-605-lvpill.js（本轮手工重写已是 58.8/00311 口径，其 58.7 历史标题锚+赋值零残留锚须保持）、
//   tmp-probe-610-lvwater.js（S1 手工改：58.8 赋值+58.7 历史标题+烘焙 rev 00310-pbk 文本）、
//   tmp-probe-609-lvwater.js（58.6 时代孤儿存档不再复跑）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-605-lvpill.js', 'tmp-probe-609-lvwater.js', 'tmp-probe-610-lvwater.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v0.2.58.7').length - 1;
  const b = s.split('00310-').length - 1;
  if (!a && !b) continue;
  s = s.split('v0.2.58.7').join('v0.2.58.8');
  s = s.split('00310-').join('00311-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b;
  console.log(`  ${f}: 58.7×${a} 00310×${b}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r}`);
// 零残留复查（活跃电池/探针内 58.7/00310- 不复存在——排除文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v0.2.58.7').length - 1) + (s.split('00310-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
