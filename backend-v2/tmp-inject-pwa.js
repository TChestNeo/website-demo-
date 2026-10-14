// tmp-inject-pwa.js — 批量给全站 HTML 注入 PWA 头标签（apple-touch-icon / manifest / theme-color）
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

let count = 0, skipped = 0;
for (const f of files) {
  let text = fs.readFileSync(f, 'utf8');
  if (text.includes('apple-touch-icon')) { skipped++; continue; }
  const iconMatch = text.match(/<link rel="icon"[^>]*>/);
  if (!iconMatch) continue;
  const rel = path.dirname(path.relative(DOCS, f));
  const prefix = rel === '.' ? '' : rel.split(path.sep).map(() => '..').join('/') + '/';
  const inject = [
    '<link rel="apple-touch-icon" href="' + prefix + 'assets/image/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    '<meta name="apple-mobile-web-app-title" content="M.NationWorld">',
    '<meta name="theme-color" content="#4648d4">',
  ].join('\n  ');
  text = text.replace(iconMatch[0], iconMatch[0] + '\n  ' + inject);
  fs.writeFileSync(f, text, 'utf8');
  count++;
}
console.log('注入页面: ' + count + '，已存在跳过: ' + skipped + '，无 icon 跳过: ' + (files.length - count - skipped));
