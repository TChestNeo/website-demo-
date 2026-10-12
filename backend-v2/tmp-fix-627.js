// 临时修复：fr imgTooBig10 元素尾缺闭合双引号——'Mo\", ],' → 'Mo\"", ],'
'use strict';
const fs = require('fs');
const p = __dirname + '/tmp-i18n-627.js';
let s = fs.readFileSync(p, 'utf8');
const before = 'Mo\\", ],';
const after = 'Mo\\"", ],';
const n = s.split(before).length - 1;
if (n !== 1) { console.log('match ' + n); process.exit(1); }
s = s.replace(before, after);
fs.writeFileSync(p, s);
console.log('fixed');
