// tmp-sed-618.js — 58.12 舰队版本锚更新：站点 v0.2.58.11→v0.2.58.12 + rev 00317-→00319-
//   只扫 tmp-battery-*.js / tmp-probe-*.js（site-config 手工已改、runner/sed/historical 脚本不扫）。
//   排除：tmp-battery-605-lvpill.js（本轮手工重写已是 58.12/00319 口径，其 58.11 历史标题锚+赋值零残留锚须保持）、
//   tmp-probe-609-lvwater.js（58.6 时代孤儿存档不再复跑）、
//   tmp-probe-610-lvwater.js（S1 烘焙 rev 00310-pbk 历史文本恒 1 处不扫）、
//   tmp-probe-613-lvpill.js（58.8 轮存档：烘焙 rev 00312-2n7 终态文本+滞后注记须保持）、
//   tmp-probe-614-lvpill.js（58.9 轮存档：烘焙 rev 00313-xjs 首部署文本+终态注记须保持）、
//   tmp-probe-616-lvpill.js（58.10 轮存档：烘焙 rev 00315-bm6 首部署文本+终态注记须保持）、
//   tmp-probe-617-lvpill.js（58.11 轮存档：烘焙 rev 00317-ht9 首部署文本+终态注记须保持——被 probe-618 取代）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-605-lvpill.js', 'tmp-probe-609-lvwater.js', 'tmp-probe-610-lvwater.js', 'tmp-probe-613-lvpill.js', 'tmp-probe-614-lvpill.js', 'tmp-probe-616-lvpill.js', 'tmp-probe-617-lvpill.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v0.2.58.11').length - 1;
  const b = s.split('00317-').length - 1;
  if (!a && !b) continue;
  s = s.split('v0.2.58.11').join('v0.2.58.12');
  s = s.split('00317-').join('00319-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b;
  console.log(`  ${f}: 58.11×${a} 00317×${b}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r}`);
// 零残留复查（活跃电池/探针内 58.11/00317- 不复存在——排除文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v0.2.58.11').length - 1) + (s.split('00317-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
