// tmp-check-syntax.js — 提取 HTML 内联 <script> 块做纯语法 parse（vm.Script）
// 跑法：从仓库根 `node backend-v2/tmp-check-syntax.js [html文件...]`（默认 fluidcanvas-editor.html）
'use strict';
const fs = require('fs');
const vm = require('vm');
const files = process.argv.slice(2);
if (!files.length) files.push('docs/pages/fluidcanvas-editor.html');
let bad = 0, total = 0, fBad = 0;
for (const p of files) {
  const s = fs.readFileSync(p, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m, i = 0, b0 = bad;
  while ((m = re.exec(s))) {
    i++; total++;
    try { new vm.Script(m[1], { filename: p + '#script' + i }); }
    catch (e) { bad++; console.log('❌ ' + p + ' block ' + i + ': ' + e.message); }
  }
  if (bad === b0) console.log('✅ ' + p + '（' + i + ' 个内联块全部通过）');
  else fBad++;
}
console.log((bad ? '❌ ' : '✅ ') + '共 ' + total + ' 个内联 script 块，' + (bad ? bad + ' 个语法错误' : '全部通过'));
process.exit(bad ? 1 : 0);
