// tmp-sed-598.js — rev 00298 舰队版本锚更新：v10.28.45.2→v10.28.46.0 + 00297-→00298-
// 只动活跃电池/探针；tmp-battery-fc-tags.js（本轮新写，S1 零残留断言含旧串）与历史 runner/build 助手不动。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;

const files = fs.readdirSync(HERE).filter(f =>
  /^tmp-battery-.+\.js$/.test(f) && f !== 'tmp-battery-fc-tags.js' || /^tmp-probe-.+\.js$/.test(f));
let v = 0, r = 0;
for (const f of files) {
  const full = path.join(HERE, f);
  let s = fs.readFileSync(full, 'utf8');
  const a = s.split('v10.28.45.2').length - 1;
  const b = s.split('00297-').length - 1;
  if (!a && !b) continue;
  s = s.split('v10.28.45.2').join('v10.28.46.0');
  s = s.split('00297-').join('00298-');
  fs.writeFileSync(full, s, 'utf8');
  v += a; r += b;
  console.log(`  ${f}: 45.2×${a} 00297×${b}`);
}
console.log(`合计 ${files.length} 文件扫描、v×${v} rev×${r}`);
// 零残留复查
let left = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(HERE, f), 'utf8');
  left += (s.split('v10.28.45.2').length - 1) + (s.split('00297-').length - 1);
}
console.log(left === 0 ? '✅ 活跃电池/探针零残留' : '❌ 残留 ' + left);
