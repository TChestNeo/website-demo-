// tmp-run-fleet-593.js — v10.28.46.0 舰队顺序驱动器（25 套 + fc-tablet + fc-pillmenu + 新 fc-mergefix/fc-touch-uploads + smoke）
// 判定口径：输出体 ✅/❌（🎉/💔）行，exit code 仅旁证；每套输出落盘 tmp-batt-593-<name>.txt 供红时细查
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = path.dirname(process.argv[1]);
const files = [
  'tmp-battery-fc-opaque.js',
  'tmp-battery-fc-publish-log.js',
  'tmp-battery-fc-sne-canvas.js',
  'tmp-battery-fc-viewport.js',
  'tmp-battery-fc-tablet.js',
  'tmp-battery-fc-pillmenu.js',
  'tmp-battery-fc-mergefix.js',
  'tmp-battery-fc-touch-uploads.js',
  'tmp-battery-fc-present.js',
  'tmp-battery-micro-v056.js',
  'tmp-battery-article-frontend.js',
  'tmp-battery-article-present.js',
  'tmp-battery-article-view.js',
  'tmp-battery-article-1to1.js',
  'tmp-battery-notif-home.js',
  'tmp-battery-home-bg.js',
  'tmp-battery-sidebar-light.js',
  'tmp-battery-pageswitch.js',
  'tmp-battery-msglink.js',
  'tmp-battery-monodark-v0422.js',
  'tmp-battery-mono-flash.js',
  'tmp-battery-fadefix.js',
  'tmp-battery-bannerfixed.js',
  'tmp-battery-all-opaque.js',
  'tmp-battery-identity.js',
  'tmp-battery-cit2usr.js',
  'tmp-battery-i18n.js',
  'tmp-battery-xp-social.js',
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
  fs.writeFileSync(path.join(HERE, 'tmp-batt-593-' + path.basename(f).replace(/\.js$/, '') + '.txt'), out);
  const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
  // 断言失败行 = 行首 '  ❌ '（两空格前缀）；总结行 '🎉 N ✅ / M ❌' 与 '💔' 摘要不按行前缀计数
  const bad = (out.match(/^  ❌ /gm) || []).length + (out.match(/💔/g) || []).length;
  const okn = (out.match(/✅|🎉/g) || []).length;
  allBad += bad;
  const tail = lines.slice(-4).join(' | ');
  console.log(`[${f}] ✅${okn} ❌${bad} exit=${r.status} tail: ${tail}  (${((Date.now() - t0) / 1000) | 0}s)`);
}
console.log(allBad ? `\nFLEET RED: ${allBad} ❌ total` : '\nFLEET ALL GREEN');
