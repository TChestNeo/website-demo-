// tmp-b2-accept.js — B2 验收（一次性）：CJK 叶残检 = 页面每个含中文的静态叶子必须被本页字典值覆盖
// 用法: node tmp-b2-accept.js <html> <dict.js>
'use strict';
const fs = require('fs');
const RE = /<([a-zA-Z][a-zA-Z0-9-]*)([^<>]*?)>([^<>]*?)<\/\1>/;

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); });
}
const norm = s => decodeEntities(s).replace(/\s+/g, ' ').trim();
const hasCJK = s => /[一-鿿]/.test(s);

const [htmlFile, dictFile] = process.argv.slice(2);
let body = fs.readFileSync(htmlFile, 'utf8');
body = body.slice(body.indexOf('<body'))
  .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '<$1></$1>');
const leaves = [];
let guard = 0;
while (guard++ < 600) {
  let count = 0;
  body = body.replace(RE, function (full, tag, attrs, text) {
    count++;
    const t = norm(text);
    if (t && hasCJK(t)) leaves.push(t);
    return '<' + tag + attrs + ' />';
  });
  if (!count) break;
}

const dict = {};
const stub = { MN_I18N: { add: (l, d) => { if (l === 'zh') Object.assign(dict, d); return stub.MN_I18N; } } };
new Function('window', fs.readFileSync(dictFile, 'utf8'))(stub);
const vals = Object.values(dict).map(norm);

let bad = 0;
for (const t of leaves) {
  if (!vals.some(v => v.indexOf(t) !== -1)) { bad++; console.log('❌ 未被覆盖:', JSON.stringify(t)); }
}
console.log('CJK 叶:', leaves.length, '| 字典键:', vals.length, '| 未覆盖:', bad);
process.exit(bad ? 1 : 0);
