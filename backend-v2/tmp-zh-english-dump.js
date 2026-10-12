// tmp-zh-english-dump.js — 一次性：dump 全部 zh 字典英文残留键（值无 CJK 且含 [a-z] 的键）
const fs = require('fs');
const path = 'docs/assets/i18n/';
const files = fs.readdirSync(path).filter((f) => f.endsWith('.i18n.js'));
const isEng = (v) => /[a-zA-Z]/.test(v) && !/[一-鿿]/.test(v);
for (const f of files) {
  const src = fs.readFileSync(path + f, 'utf8');
  const m = src.match(/add\('zh',\s*\{([\s\S]*?)\n\s*\}\)/);
  if (!m) continue;
  const pairs = [...m[1].matchAll(/'([a-zA-Z0-9_.]+)'\s*:\s*'((?:[^'\\]|\\.)*)'/g)];
  const eng = pairs.filter(([, , v]) => isEng(v));
  if (eng.length) {
    console.log('═══ ' + f + ' — ' + eng.length + ' 个英文键 ═══');
    for (const [, k, v] of eng) console.log("  '" + k + "': '" + v + "'");
  }
}
