// tmp-sed-610.js — rev 00310 舰队版本锚更新：站点 v0.2.58.6→v0.2.58.7 + 00309-→00310-
//   【事后修正（真实时间线）：58.6 轮从未上线（revisions 无 00309）——本脚本按「58.6 已上线」误估扫
//   00309-→00310-；实部署首发瞬态 rev=00309-jbl，随即同轮重部署终态 rev=00310-pbk；由
//   tmp-sed-611.js（回扫 00309-）与 tmp-sed-612.js（再扫回 00310-+site-config 填 00310-pbk）修正。】
//   FC 47.4 锚零触碰（FC 本轮零改动）。
// 排除：tmp-battery-605-lvpill.js（本轮手工重写，已是 58.7/00310 口径）、tmp-probe-609-lvwater.js（58.6 时代存档不再复跑）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-605-lvpill.js', 'tmp-probe-609-lvwater.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v0.2.58.6').length - 1;
  const b = s.split('00309-').length - 1;
  if (!a && !b) continue;
  s = s.split('v0.2.58.6').join('v0.2.58.7');
  s = s.split('00309-').join('00310-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b;
  console.log(`  ${f}: 58.6×${a} 00309×${b}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r}`);
// 零残留复查（活跃电池/探针内 58.6/00309- 不复存在——排除文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v0.2.58.6').length - 1) + (s.split('00309-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
