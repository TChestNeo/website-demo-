'use strict';
// tmp-i18n-orphan-check.js — 检查 premium.html 内联脚本中所有 CJK 字符串字面量都处于 T() 兜底位（|| 之后）
const fs = require('fs');
const html = fs.readFileSync('docs/pages/premium.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, i = 0, orphans = [];
const strRe = /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g;
while ((m = re.exec(html))) {
  i++;
  const code = m[1].replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = code.split('\n');
  lines.forEach((line, ln) => {
    let s;
    strRe.lastIndex = 0;
    while ((s = strRe.exec(line))) {
      if (!/[\u4e00-\u9fff]/.test(s[1])) continue;
      const before = line.slice(Math.max(0, s.index - 40), s.index);
      if (!before.includes('||')) {
        orphans.push('script#' + i + ' line:' + (ln + 1) + ' ctx=' + JSON.stringify(before.slice(-30)) + ' lit=' + JSON.stringify(s[1].slice(0, 40)));
      }
    }
  });
}
if (orphans.length) {
  console.log('ORPHAN CJK LITERALS (not T() fallbacks):');
  orphans.forEach(o => console.log('  -', o));
  process.exit(1);
}
console.log('no orphan CJK literals — every CJK literal is a T() fallback');
