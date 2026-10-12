// tmp-i18n-remove-masksync.js — 移除 fc.edge.maskSync ×12 语
'use strict';
const fs = require('fs');
const f = 'docs/assets/i18n/fluidcanvas.i18n.js';
let s = fs.readFileSync(f, 'utf8');
const before = (s.match(/"fc\.edge\.maskSync"/g) || []).length;
s = s.replace(/[ \t]*"fc\.edge\.maskSync": "[^"]*",\r?\n/g, '');
fs.writeFileSync(f, s);
const after = (s.match(/"fc\.edge\.maskSync"/g) || []).length;
console.log('maskSync 移除: ' + before + ' -> ' + after);
