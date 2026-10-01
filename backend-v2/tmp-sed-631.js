// tmp-sed-631.js — v0.2.58.25 轮次 token 扫描（先扫后改电池家规）：
//   v0.2.58.24→v0.2.58.25、00344-→00346-、00345-→00347-（1:1 换文本不改计数语义）
//   范围=tmp-battery-*.js+tmp-probe-*.js；EXCLUDE=新电池/新探针（未写先预留防重跑误伤）
//   community-nodemo 不再 EXCLUDE（58.24 轮次后已回常规轮转）
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-crop.js', 'tmp-probe-crop-631.js']);
const PAIRS = [['v0.2.58.24', 'v0.2.58.25'], ['00344-', '00346-'], ['00345-', '00347-']];
const files = fs.readdirSync(HERE).filter((f) => (f.startsWith('tmp-battery-') || f.startsWith('tmp-probe-')) && f.endsWith('.js') && !EXCLUDE.has(f));
let total = 0, filesTouched = 0;
for (const f of files) {
  let s = fs.readFileSync(path.join(HERE, f), 'utf8');
  let n = 0;
  for (const [from, to] of PAIRS) {
    const c = s.split(from).length - 1;
    if (c) { s = s.split(from).join(to); n += c; }
  }
  if (n) { fs.writeFileSync(path.join(HERE, f), s); total += n; filesTouched++; console.log('  ✅ ' + f + ' ' + n + ' 处'); }
}
console.log('\nsed-631 完成：' + filesTouched + ' 文件 / ' + total + ' 处替换');
// 扫后复核：范围内 v0.2.58.24 应为 0（新电池/新探针除外）
let left = 0;
for (const f of files) { left += fs.readFileSync(path.join(HERE, f), 'utf8').split('v0.2.58.24').length - 1; }
console.log(left === 0 ? '复核：v0.2.58.24 零残留' : '❌ 复核：仍残留 ' + left + ' 处');
if (left !== 0) process.exitCode = 1;
