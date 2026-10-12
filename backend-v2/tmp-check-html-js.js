// tmp-check-html-js.js — 一次性：抽取 HTML 内联 script 块（无 src）做语法解析（new Function 只解析不执行）
'use strict';
const fs = require('fs');
let fail = 0;
for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m, i = 0, bad = 0;
  while ((m = re.exec(src))) {
    i++;
    try { new Function(m[1]); }
    catch (e) { bad++; fail++; console.log('❌ ' + file + ' block#' + i + ': ' + e.message); }
  }
  console.log((bad ? '❌ ' : '✅ ') + file + ' 内联块 ' + i + ' 个' + (bad ? '，坏 ' + bad : ''));
}
process.exit(fail ? 1 : 0);
