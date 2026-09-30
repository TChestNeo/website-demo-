// tmp-sed-630.js — v0.2.58.24 轮次 token 扫描（先扫后改电池家规）：
//   v0.2.58.23→v0.2.58.24、00342-→00344-、00343-→00345-（1:1 换文本不改计数语义）
//   范围=tmp-battery-*.js+tmp-probe-*.js；EXCLUDE=新电池/新探针（未写先预留防重跑误伤）
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const EXCLUDE = new Set(['tmp-battery-community-nodemo.js', 'tmp-probe-hub-630.js']);
const PAIRS = [['v0.2.58.23', 'v0.2.58.24'], ['00342-', '00344-'], ['00343-', '00345-']];
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
console.log('\nsed-630 完成：' + filesTouched + ' 文件 / ' + total + ' 处替换');
// 扫后复核：范围内 v0.2.58.23 应为 0（新电池/新探针除外）
let left = 0;
for (const f of files) { left += fs.readFileSync(path.join(HERE, f), 'utf8').split('v0.2.58.23').length - 1; }
console.log(left === 0 ? '复核：v0.2.58.23 零残留' : '❌ 复核：仍残留 ' + left + ' 处');
if (left !== 0) process.exitCode = 1;
