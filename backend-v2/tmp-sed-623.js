// tmp-sed-623.js — 58.17 舰队版本锚更新：站点 v0.2.58.16→v0.2.58.17 + rev 00327-→00329- / rev 00328-→00330-
//   只扫 tmp-battery-*.js / tmp-probe-*.js（site-config 手工已改、runner/sed/historical 脚本不扫）。
//   单趟版本替换+两趟 rev token 互异（不会互相腐化）：00327-→00329- 与 00328-→00330- 分属不同 token。
//   排除：tmp-battery-following.js（本轮新电池已是 58.17/00329/00330 口径）、
//   tmp-probe-following.js（本轮新探针）、
//   tmp-probe-activity.js（58.16 轮档案：烘焙 rev 00327-n5s 首部署文本+00328-c67 终态注记须保持）、
//   tmp-probe-620-lvpill.js（58.14 轮档案：烘焙 rev 00323-qsz 首部署文本+终态注记须保持）、
//   tmp-probe-609-lvwater.js（58.6 时代孤儿存档不再复跑）、
//   tmp-probe-610-lvwater.js（S1 烘焙 rev 00310-pbk 历史文本恒 1 处不扫）、
//   tmp-probe-613-lvpill.js（58.8 轮存档：烘焙 rev 00312-2n7 终态文本+滞后注记须保持）、
//   tmp-probe-614-lvpill.js（58.9 轮存档：烘焙 rev 00313-xjs 首部署文本+终态注记须保持）、
//   tmp-probe-616-lvpill.js（58.10 轮存档：烘焙 rev 00315-bm6 首部署文本+终态注记须保持）、
//   tmp-probe-617-lvpill.js（58.11 轮存档：烘焙 rev 00317-ht9 首部署文本+终态注记须保持）、
//   tmp-probe-618-lvpill.js（58.12 轮存档：烘焙 rev 00319-mw5 首部署文本+终态注记须保持）、
//   tmp-probe-619-lvpill.js（58.13 轮存档：烘焙 rev 00321-jbh 首部署文本+终态注记须保持）。
//   tmp-probe-621-lvpill.js 不排除：其 S1 前缀容断言（rev 00327-/00328-）随扫变 00329-/00330- 新入口口径
//   自洽、历史链锚（00323-qsz/00324-xr2/00321-jbh…）不经本 token 不受影响；tmp-battery-activity.js 照扫
//   （其 F1 断言随版本自洽——58.17 在位+58.16 零残留+rev 00329-/00330- 新入口；跑前 spot-run 其 F1）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-following.js', 'tmp-probe-following.js', 'tmp-probe-activity.js', 'tmp-probe-620-lvpill.js', 'tmp-probe-609-lvwater.js', 'tmp-probe-610-lvwater.js', 'tmp-probe-613-lvpill.js', 'tmp-probe-614-lvpill.js', 'tmp-probe-616-lvpill.js', 'tmp-probe-617-lvpill.js', 'tmp-probe-618-lvpill.js', 'tmp-probe-619-lvpill.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r1 = 0, r2 = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v0.2.58.16').length - 1;
  const b = s.split('00327-').length - 1;
  const c2 = s.split('00328-').length - 1;
  if (!a && !b && !c2) continue;
  s = s.split('v0.2.58.16').join('v0.2.58.17');
  s = s.split('00327-').join('00329-');
  s = s.split('00328-').join('00330-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r1 += b; r2 += c2;
  console.log(`  ${f}: 58.16×${a} 00327×${b} 00328×${c2}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev1×${r1} rev2×${r2}`);
// 零残留复查（活跃电池/探针内 58.16/00327-/00328- 不复存在——排除文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v0.2.58.16').length - 1) + (s.split('00327-').length - 1) + (s.split('00328-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
