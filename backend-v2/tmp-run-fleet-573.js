// tmp-run-fleet-573.js — v0.2.57.1 舰队剩余电池顺序驱动器（版本锚回归 + smoke）
// 判定口径：输出体 ✅/❌（🎉/💔）行，exit code 仅旁证；每套输出落盘 tmp-batt-573-<name>.txt 供红时细查
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = path.dirname(process.argv[1]);
const files = [
  'tmp-battery-all-opaque.js',
  'tmp-battery-bannerfixed.js',
  'tmp-battery-cit2usr.js',
  'tmp-battery-community-profile.js',
  'tmp-battery-fadefix.js',
  'tmp-battery-home-bg.js',
  'tmp-battery-i18n.js',
  'tmp-battery-identity.js',
  'tmp-battery-mono-flash.js',
  'tmp-battery-monodark-v0422.js',
  'tmp-battery-msglink.js',
  'tmp-battery-notif-home.js',
  'tmp-battery-pageswitch.js',
  'tmp-battery-sidebar-bottom.js',
  'tmp-battery-sidebar-light.js',
  'scripts/smoke-admin.js',
];
let allBad = 0;
for (const f of files) {
  const t0 = Date.now();
  const full = path.join(HERE, f);
  let r;
  try {
    r = spawnSync(process.execPath, [full], { encoding: 'utf8', timeout: 480000 });
  } catch (e) { console.log(`[${f}] SPAWN-ERR ${e.message}`); continue; }
  const out = (r.stdout || '') + '\n' + (r.stderr || '');
  fs.writeFileSync(path.join(HERE, 'tmp-batt-573-' + path.basename(f).replace(/\.js$/, '') + '.txt'), out);
  const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
  const bad = (out.match(/❌|💔/g) || []).length;
  const okn = (out.match(/✅|🎉/g) || []).length;
  allBad += bad;
  const tail = lines.slice(-4).join(' | ');
  console.log(`[${f}] ✅${okn} ❌${bad} exit=${r.status} tail: ${tail}  (${((Date.now() - t0) / 1000) | 0}s)`);
}
console.log(allBad ? `\nFLEET RED: ${allBad} ❌ total` : '\nFLEET ALL GREEN');
