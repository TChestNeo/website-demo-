// tmp-fix-manifest-link.js — 全站替换 /site.webmanifest → /manifest.json
'use strict';
const fs = require('fs');
const path = require('path');
const DOCS = path.join(__dirname, '..', 'docs');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) files.push(p);
  }
})(DOCS);
let n = 0;
for (const f of files) {
  let t = fs.readFileSync(f, 'utf8');
  if (t.includes('/site.webmanifest')) {
    t = t.split('/site.webmanifest').join('/manifest.json');
    fs.writeFileSync(f, t, 'utf8');
    n++;
  }
}
console.log('替换页面: ' + n);
