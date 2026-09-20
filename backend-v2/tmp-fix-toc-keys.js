// tmp-fix-toc-keys.js — v0.2.57.0: 修复 tmp-add-toc-keys.js 漏逗号（favorite 是原末键无尾逗号，
// 插入后需补逗号才合法；模式 11 块一致：值引号 + 空行 + 区块注释）
const fs = require('fs');
const p = 'docs/assets/i18n/article.i18n.js';
let s = fs.readFileSync(p, 'utf8');
const before = s;
s = s.replace(/'\n\n    \/\/ ── v0\.2\.57\.0 标签条 \+ 目录 ──/g, "',\n    // ── v0.2.57.0 标签条 + 目录 ──");
if (s === before) { console.error('pattern not found'); process.exit(1); }
fs.writeFileSync(p, s);
console.log('comma fixed, blocks:', (s.match(/v0\.2\.57\.0 标签条/g) || []).length);
