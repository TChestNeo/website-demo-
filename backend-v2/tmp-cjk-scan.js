// tmp-cjk-scan.js — 一次性：统计每页 zh 字典值含中文比例（用后即删）
const fs = require('fs');
const path = 'docs/assets/i18n/';
const files = fs.readdirSync(path).filter((f) => f.endsWith('.i18n.js') && f !== 'common.i18n.js');
let totalZh = 0, totalCjk = 0;
for (const f of files) {
  const src = fs.readFileSync(path + f, 'utf8');
  const m = src.match(/add\('zh',\s*\{([\s\S]*?)\n\s*\}\)/);
  if (!m) { console.log(f + ': 无 zh 段'); continue; }
  const pairs = [...m[1].matchAll(/'([a-zA-Z0-9_.]+)'\s*:\s*'((?:[^'\\]|\\.)*)'/g)];
  const cjk = pairs.filter(([, , v]) => /[一-鿿]/.test(v)).length;
  totalZh += pairs.length; totalCjk += cjk;
  const pct = pairs.length ? Math.round((cjk / pairs.length) * 100) : 0;
  console.log(f.padEnd(32) + ' zh 键 ' + String(pairs.length).padStart(4) + ' 中文值 ' + String(cjk).padStart(4) + ' (' + pct + '%)');
}
console.log('── 合计 zh 键 ' + totalZh + ' 中文值 ' + totalCjk + ' (' + Math.round((totalCjk / totalZh) * 100) + '%)');
