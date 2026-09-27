// tmp-run-fleet-620.js — v0.2.58.14 折叠侧栏等级水杯慢浪改浅色舰队顺序驱动器（40 套 + smoke）
// 判定口径：输出体 ✅/❌（🎉/💔）行，exit code 仅旁证；每套输出落盘 tmp-batt-620-<name>.txt 供红时细查
// 复核纪律（45.1 教训）：runner 💥 崩溃行不计红数——跑完全量后必须 grep exit=1|💥 再定罪。
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
  'tmp-battery-605-lvpill.js',
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
  'tmp-battery-fc-i18n.js',
  'tmp-battery-fc-headershrink.js',
  'tmp-battery-fc-uploadsave.js',
  'tmp-battery-fc-tags.js',
  'tmp-battery-fc-ttlib.js',
  'tmp-battery-fc-ttwide.js',
  'tmp-battery-fc-pilltop.js',
  'tmp-battery-xp-social.js',
  'tmp-battery-tier-gating.js',
  'tmp-battery-xp-rebalance.js',
  'tmp-battery-admin-grant.js',
  'tmp-battery-admin-grantrec.js',
  'scripts/smoke-admin.js',
];
let allBad = 0;
let crashRows = [];
for (const f of files) {
  const t0 = Date.now();
  const full = path.join(HERE, f);
  let r;
  try {
    r = spawnSync(process.execPath, [full], { encoding: 'utf8', timeout: 480000 });
  } catch (e) { console.log(`[${f}] SPAWN-ERR ${e.message}`); continue; }
  const out = (r.stdout || '') + '\n' + (r.stderr || '');
  fs.writeFileSync(path.join(HERE, 'tmp-batt-620-' + path.basename(f).replace(/\.js$/, '') + '.txt'), out);
  const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
  // 断言失败行 = 行首 '  ❌ '（两空格前缀）；总结行 '🎉 N ✅ / M ❌' 与 '💔' 摘要不按行前缀计数
  const bad = (out.match(/^  ❌ /gm) || []).length + (out.match(/💔/g) || []).length;
  const okn = (out.match(/✅|🎉/g) || []).length;
  allBad += bad;
  if (r.status !== 0) crashRows.push(f + '(exit=' + r.status + ')');
  const tail = lines.slice(-4).join(' | ');
  console.log(`[${f}] ✅${okn} ❌${bad} exit=${r.status} tail: ${tail}  (${((Date.now() - t0) / 1000) | 0}s)`);
}
console.log(crashRows.length ? '\nCRASH/EXIT-NONZERO: ' + crashRows.join(', ') : '');
console.log(allBad ? `\nFLEET RED: ${allBad} ❌ total` : '\nFLEET ALL GREEN');
