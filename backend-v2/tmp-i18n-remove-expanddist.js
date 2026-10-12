// tmp-i18n-remove-expanddist.js — 移除 fc.edge.expandDist ×12 语
'use strict';
const fs = require('fs');
const f = 'docs/assets/i18n/fluidcanvas.i18n.js';
let s = fs.readFileSync(f, 'utf8');
const before = (s.match(/"fc\.edge\.expandDist"/g) || []).length;
s = s.replace(/[ \t]*"fc\.edge\.expandDist": "[^"]*",\r?\n/g, '');
fs.writeFileSync(f, s);
const after = (s.match(/"fc\.edge\.expandDist"/g) || []).length;
console.log('expandDist 移除: ' + before + ' -> ' + after);
