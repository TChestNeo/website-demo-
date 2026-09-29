// tmp-sed-625.js — 58.19 舰队版本锚更新：站点 v0.2.58.18→v0.2.58.19 + rev 00331-→00334- / rev 00332-→00335-
//   只扫 tmp-battery-*.js / tmp-probe-*.js（site-config 手工已改、runner/sed/historical 脚本不扫）。
//   三趟 token 互异（不会互相腐化）：00331-→00334- 与 00332-→00335- 分属不同 token。
//   实测复核（写前，家规）：
//   ① 完整烘焙 rev 字面量（00331-g9b/00333-kkx/00332-kzj）全族仅 tmp-probe-profile-banner.js 一处 → 排除（58.18 档案探针，烘焙真 rev 须保持）；
//   ② '00333-' 非排除文件零命中（计划 token「00333-→00335-」实为 00332-→00335- 之误写——activity/following 断言对
//      'rev 00331-XXX'/'rev 00332-???' 占位对，须随扫成新占位对 'rev 00334-XXX'/'rev 00335-???' 与 site-config 1208 行新条目对齐）；
//   ③ cit2usr.js:62「5 文件含 58.18」断言随版本 token 扫成「含 58.19」——那 5 文件（msglink/mono-flash/monodark/fadefix/pageswitch）
//      的版本锚必须同扫（否则对 58.19 site-config 全红）——计划注记与舰队全绿门槛冲突，按门槛执行（同 624 先例全族同扫）。
//   排除：tmp-battery-profile-subtier.js（本轮新电池已是 58.19/00334 口径）、
//   tmp-battery-profile-banner.js（58.18 轮电池已手改 58.19/00334 口径，B 组断言可能含 00333-kkx 烘焙注记须保持）、
//   tmp-probe-profile-banner.js（58.18 档案：烘焙 rev 00331-g9b 真值+00333- 前缀注记须保持）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-profile-subtier.js', 'tmp-battery-profile-banner.js', 'tmp-probe-profile-banner.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r1 = 0, r2 = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v0.2.58.18').length - 1;
  const b = s.split('00331-').length - 1;
  const c2 = s.split('00332-').length - 1;
  if (!a && !b && !c2) continue;
  s = s.split('v0.2.58.18').join('v0.2.58.19');
  s = s.split('00331-').join('00334-');
  s = s.split('00332-').join('00335-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r1 += b; r2 += c2;
  console.log(`  ${f}: 58.18×${a} 00331×${b} 00332×${c2}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev1×${r1} rev2×${r2}`);
// 零残留复查（活跃电池/探针内 58.18/00331-/00332- 不复存在——排除文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v0.2.58.18').length - 1) + (s.split('00331-').length - 1) + (s.split('00332-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
