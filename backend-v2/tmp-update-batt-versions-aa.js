// tmp-update-batt-versions-aa.js — v0.2.42.1/v10.28.32.1 轮：批量升电池版本钉
// （v0.2.42.0→v0.2.42.1、v10.28.32.0→v10.28.32.1；一次性脚本，不暂存；历史串 v0.2.41.0 不动）
'use strict';
const fs = require('fs');
const files = [
  'tmp-battery-autosave-interval.js',
  'tmp-battery-caredge-dark.js',
  'tmp-battery-fc-undo.js',
  'tmp-battery-group-resize.js',
  'tmp-battery-group-shapes.js',
  'tmp-battery-img-library.js',
  'tmp-battery-imglib-v2.js',
  'tmp-battery-merge-dir.js',
  'tmp-battery-merge-far.js',
  'tmp-battery-migrate-btn.js',
  'tmp-battery-page-bg.js',
  'tmp-battery-pbg-meta.js',
  'tmp-battery-tier-gating.js'
];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const n1 = (s.match(/v0\.2\.42\.0/g) || []).length;
  const n2 = (s.match(/v10\.28\.32\.0/g) || []).length;
  const s2 = s.replace(/v0\.2\.42\.0/g, 'v0.2.42.1').replace(/v10\.28\.32\.0/g, 'v10.28.32.1');
  fs.writeFileSync(f, s2);
  console.log('✅ ' + f + ' 站点钉×' + n1 + ' FC钉×' + n2);
}
