// tmp-count-629.js — Round 43 写锚前实测计数（transitions.js + site-config.js）
'use strict';
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.resolve(__dirname, '..', 'docs/assets/js/transitions.js'), 'utf8');
const sc = fs.readFileSync(path.resolve(__dirname, '..', 'docs/assets/js/site-config.js'), 'utf8');
const c = (src, t) => src.split(t).length - 1;
const toks = [
  "l.rel = 'prefetch'", "l.as = 'document'", 'function prefetchPage', 'prefetchDone',
  'clearTimeout(prefetchTimer)', 'prefetchTimer', '(hover: hover)', 'saveData',
  'isSamePage(href)', ', 65)', '{ once: true }', 'isInternal(href)',
  "addEventListener('mouseover'", "addEventListener('click'"
];
for (const t of toks) console.log('tr  ' + JSON.stringify(t) + ' => ' + c(s, t));
const scToks = [
  "window.MN_SITE_VERSION = 'v0.2.58.23'", "window.MN_SITE_VERSION = 'v0.2.58.22'",
  '// v0.2.58.23 = ', '00342-', '00343-', '00340-', '00341-',
  "window.FLUIDCANVAS_VERSION = 'v10.28.48.0'", '// v0.2.58.22 = '
];
for (const t of scToks) console.log('sc  ' + JSON.stringify(t) + ' => ' + c(sc, t));
