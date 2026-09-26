// tmp-sed-605.js — rev 00305 舰队版本锚更新：站点 v0.2.58.1→v0.2.58.2 + 00304-→00305-
//   + 现役 changelog 标题锚换新（旧「v0.2.58.2 = 左侧菜单底部不透明背景完全删除」是 58.1 的旧标题
//   被盲换版本后的错值 → 手工订正为 58.2 新标题）。FC 47.4 锚零触碰（FC 本轮零改动）。
// 排除：tmp-battery-605-lvpill.js（本轮新写，已是 58.2/00305 口径）。
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
  const a = s.split('v0.2.58.1').length - 1;
  const b = s.split('00304-').length - 1;
  const c = s.split('v0.2.58.2 = 左侧菜单底部不透明背景完全删除').length - 1;
  if (!a && !b && !c) continue;
  s = s.split('v0.2.58.1').join('v0.2.58.2');
  s = s.split('00304-').join('00305-');
  s = s.split('v0.2.58.2 = 左侧菜单底部不透明背景完全删除').join('v0.2.58.2 = 折叠侧栏等级纵向药丸+经验环');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b; t += c;
  console.log(`  ${f}: 58.1×${a} 00304×${b} 标题×${c}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r} 标题×${t}`);
// 零残留复查（活跃电池/探针内 58.1/00304- 不复存在——手工文件除外）
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v0.2.58.1').length - 1) + (s.split('00304-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
