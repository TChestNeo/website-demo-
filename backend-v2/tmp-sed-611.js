// tmp-sed-611.js — rev 编号纠错中间扫（已被 sed-612 回扫覆盖，保留只作文档）：误以为终态=首部署 00309-jbl，
// 把 00310- 锚回扫 00309-；终态实为 00310-pbk（58.7 轮同轮重部署——首部署瞬态 00309-jbl 因编号预估错位）。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const files = [
  'docs/assets/js/site-config.js',
  'backend-v2/tmp-battery-605-lvpill.js',
  'backend-v2/tmp-battery-sidebar-light.js',
  'backend-v2/tmp-battery-fc-i18n.js',
  'backend-v2/tmp-battery-fc-headershrink.js',
  'backend-v2/tmp-battery-fc-pilltop.js',
  'backend-v2/tmp-battery-fc-pillmenu.js',
  'backend-v2/tmp-battery-fc-publish-log.js',
  'backend-v2/tmp-battery-fc-tags.js',
  'backend-v2/tmp-battery-fc-ttlib.js',
  'backend-v2/tmp-battery-fc-ttwide.js',
  'backend-v2/tmp-battery-fc-uploadsave.js',
  'backend-v2/tmp-battery-fc-viewport.js',
  'backend-v2/tmp-probe-610-lvwater.js',
  'backend-v2/tmp-probe-sidebar-clear.js',
  'backend-v2/tmp-probe-fc-uploadsave.js',
  'backend-v2/tmp-probe-fc-ttlib.js',
  'backend-v2/tmp-probe-fc-ttwide.js',
  'backend-v2/tmp-probe-fc-tags.js',
  'backend-v2/tmp-probe-fc-headershrink.js',
  'backend-v2/tmp-probe-fc-i18n.js',
  'backend-v2/tmp-probe-fc-pillmenu.js',
  'backend-v2/tmp-probe-605-lvpill.js',
  'backend-v2/tmp-probe-606-lvwater.js',
  'backend-v2/tmp-probe-607-lvwater.js',
  'backend-v2/tmp-deploy-610.ps1',
];
// batt 输出 txt 一并回扫（不进 commit，保持零残留 grep 干净）
for (const f of fs.readdirSync(path.join(ROOT, 'backend-v2'))) {
  if (f.startsWith('tmp-batt-610-') && f.endsWith('.txt')) files.push('backend-v2/' + f);
}
let total = 0;
for (const rel of files) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  const n = s.split('00310-').length - 1;
  if (n === 0) continue;
  s = s.split('00310-').join('00309-');
  fs.writeFileSync(p, s);
  total += n;
  console.log(`${rel}: ${n}`);
}
// 零残留复查（排除 sed-610/verify-610 后 00310- 不复存在）
let left = 0;
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (f !== 'node_modules' && f !== '.git') walk(p); continue; }
    if (!/\.(js|html|css|ps1|txt|md|json)$/.test(f)) continue;
    if (/tmp-(sed|verify)-610/.test(f)) continue;
    let s = fs.readFileSync(p, 'utf8');
    const n = s.split('00310-').length - 1;
    if (n) { console.log('RESIDUE ' + p + ': ' + n); left += n; }
  }
}
walk(ROOT);
console.log(left ? `❌ 00310- 残留 ${left}` : '✅ 00310- 零残留（排除 sed-610/verify-610）');
console.log(`swept ${total} 处`);
