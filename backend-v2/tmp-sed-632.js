// tmp-sed-632.js — Round 46（v0.2.58.26 + FC v10.28.48.2）：舰队电池版本锚整体换位
// 范围=只扫 backend-v2/tmp-battery-*.js（631 惯例：探针/verify/记忆仪式/memory 工具文件一律冻结不动）；
// PAIRS 四组机械替换：站点版本、FC 版本、双 rev 前缀。占位真值（00348-XXX/00349-???）不进 PAIRS——
// 电池对 site-config 的计数锚（cnt(siteSrc,'00346-')===2 族）换位后语义指向本轮 rev 行，恰与工作树
// 00348-XXX×2/00349-???×2 同数（deploy-proof 恒 2 惯例继承 631）。
// 陈旧计数锚（版本字面量出现次数随新 changelog 条目变化）换位后可能错配——金丝雀首跑实测计数家规修。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const PAIRS = [
  ['v0.2.58.25', 'v0.2.58.26'],
  ['v10.28.48.1', 'v10.28.48.2'],
  ['00346-', '00348-'],
  ['00347-', '00349-'],
];
const EXCLUDE = new Set(['tmp-battery-fc-632.js', 'tmp-sed-632.js']);

const files = fs.readdirSync(HERE).filter((f) => /^tmp-battery-.*\.js$/.test(f) && !EXCLUDE.has(f));
let totalSwaps = 0;
let changedFiles = 0;
for (const f of files) {
  const p = path.join(HERE, f);
  let src = fs.readFileSync(p, 'utf8');
  let swaps = 0;
  for (const [from, to] of PAIRS) {
    const n = src.split(from).length - 1;
    if (n > 0) { src = src.split(from).join(to); swaps += n; }
  }
  if (swaps > 0) {
    fs.writeFileSync(p, src);
    changedFiles++;
    totalSwaps += swaps;
    console.log(f + ': ' + swaps + ' swaps');
  }
}
console.log('sed 632 done: ' + totalSwaps + ' swaps / ' + changedFiles + ' files (scope=' + files.length + ' batteries)');
