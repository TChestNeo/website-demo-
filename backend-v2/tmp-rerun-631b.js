// tmp-rerun-631b.js — 631 补钉后独立复跑 26 套红电池
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const HERE = __dirname;
const LIST = [
  'tmp-battery-fc-opaque.js', 'tmp-battery-fc-tablet.js', 'tmp-battery-fc-pillmenu.js',
  'tmp-battery-fc-mergefix.js', 'tmp-battery-fc-touch-uploads.js', 'tmp-battery-micro-v056.js',
  'tmp-battery-article-frontend.js', 'tmp-battery-article-present.js', 'tmp-battery-article-view.js',
  'tmp-battery-notif-home.js', 'tmp-battery-home-bg.js', 'tmp-battery-sidebar-light.js',
  'tmp-battery-605-lvpill.js', 'tmp-battery-activity.js', 'tmp-battery-following.js',
  'tmp-battery-pageswitch.js', 'tmp-battery-prefetch.js', 'tmp-battery-msglink.js',
  'tmp-battery-monodark-v0422.js', 'tmp-battery-mono-flash.js', 'tmp-battery-fadefix.js',
  'tmp-battery-all-opaque.js', 'tmp-battery-fc-tags.js', 'tmp-battery-fc-pilltop.js',
  'tmp-battery-tier-gating.js', 'tmp-battery-community-nodemo.js',
];
let red = 0;
for (const f of LIST) {
  const full = path.join(HERE, f);
  const r = spawnSync(process.execPath, [full], { encoding: 'utf8', timeout: 480000 });
  const out = (r.stdout || '') + '\n' + (r.stderr || '');
  const lines = out.split('\n').filter(Boolean);
  const tail = lines.slice(-14).join(' | ');
  const bad = (out.match(/^  ❌ /gm) || []).length + (out.match(/💔/g) || []).length;
  const summary = bad > 0 ? '🔴 ' + bad + ' bad' : '🟢 green';
  console.log('[' + f + '] exit=' + r.status + ' ' + summary);
  console.log('   tail: ' + tail.slice(0, 420));
  if (bad > 0) red += bad;
}
console.log('═══ RERUN DONE — red marks: ' + red + ' ═══');
