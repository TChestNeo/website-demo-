// tmp-sed-607.js — rev 00307 舰队版本锚更新：站点 v0.2.58.3→v0.2.58.4 + 00306-→00307-
//   + 现役历史标题锚回位（盲换会把 58.3 历史标题「v0.2.58.3 = 折叠侧栏等级水位环+双层水波」错抬成
//   58.4 → 订正回 58.3）。FC 47.4 锚零触碰（FC 本轮零改动）。
// 排除：tmp-battery-605-lvpill.js（本轮手工重写，已是 58.4/00307 口径）、tmp-probe-607-*.js（本轮新写）。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-605-lvpill.js']);
const files = fs.readdirSync(HERE).filter(f =>
  (/^tmp-battery-.+\.js$/.test(f) || /^tmp-probe-.+\.js$/.test(f)) && !EXCLUDE.has(f));
let v = 0, r = 0, t = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v0.2.58.3').length - 1;
  const b = s.split('00306-').length - 1;
  const c = s.split('v0.2.58.3 = 折叠侧栏等级水位环+双层水波').length - 1;
  if (!a && !b && !c) continue;
  s = s.split('v0.2.58.3').join('v0.2.58.4');
  s = s.split('00306-').join('00307-');
  s = s.split('v0.2.58.4 = 折叠侧栏等级水位环+双层水波').join('v0.2.58.3 = 折叠侧栏等级水位环+双层水波');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b; t += c;
  console.log(`  ${f}: 58.3×${a} 00306×${b} 标题×${c}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r} 标题×${t}`);
// 零残留复查（活跃电池/探针内 58.3/00306- 不复存在——手工文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v0.2.58.3').length - 1) + (s.split('00306-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
