// tmp-run-recheck-611.js — sed-611 回扫后复跑受影响的 13 套（605 手工改 + 12 套被回扫的电池）
// 判定口径：输出体 ✅/❌ 行；每套输出落盘 tmp-rechk-611-<name>.txt 供红时细查。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = path.dirname(process.argv[1]);
const files = [
  'tmp-battery-605-lvpill.js',
  'tmp-battery-sidebar-light.js',
  'tmp-battery-fc-i18n.js',
  'tmp-battery-fc-headershrink.js',
  'tmp-battery-fc-pilltop.js',
  'tmp-battery-fc-pillmenu.js',
  'tmp-battery-fc-publish-log.js',
  'tmp-battery-fc-tags.js',
  'tmp-battery-fc-ttlib.js',
  'tmp-battery-fc-ttwide.js',
  'tmp-battery-fc-uploadsave.js',
  'tmp-battery-fc-viewport.js',
  'tmp-battery-i18n.js',
];
let allBad = 0;
let crashRows = [];
for (const f of files) {
  const full = path.join(HERE, f);
  let r;
  try {
    r = spawnSync(process.execPath, [full], { encoding: 'utf8', timeout: 480000 });
  } catch (e) { console.log(`[${f}] SPAWN-ERR ${e.message}`); continue; }
  const out = (r.stdout || '') + '\n' + (r.stderr || '');
  fs.writeFileSync(path.join(HERE, 'tmp-rechk-611-' + path.basename(f).replace(/\.js$/, '') + '.txt'), out);
  const bad = (out.match(/^  ❌ /gm) || []).length + (out.match(/💔/g) || []).length;
  const okn = (out.match(/✅|🎉/g) || []).length;
  allBad += bad;
  if (r.status !== 0) crashRows.push(f + '(exit=' + r.status + ')');
  console.log(`[${f}] ✅${okn} ❌${bad} exit=${r.status}`);
}
console.log(crashRows.length ? '\nCRASH/EXIT-NONZERO: ' + crashRows.join(', ') : '');
console.log(allBad ? `\nRECHECK RED: ${allBad} ❌ total` : '\nRECHECK ALL GREEN');
