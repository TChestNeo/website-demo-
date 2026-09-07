/* tmp-sweep-liquid-glass-tag.js — v0.2.9.0 液态玻璃脚本标签全站清扫（一次性）
   规则：跳过 demo 三页；已有标签先移除（index/fluidcanvas 旧 v0.2.8.0 挂载）；
   锚点优先级 settings-modal.js → site-config.js → transitions.js（编辑器特例
   api.js——主 IIFE 前）；均无 → </body> 前；路径根页 assets/、pages/admin ../assets/。 */
'use strict';
const fs = require('fs');
const path = require('path');

const dirs = ['docs', 'docs/pages', 'docs/admin'];
const SKIP = /demo/i;
const TAG = 'liquid-glass';
const ANCHORS = ['settings-modal.js', 'site-config.js', 'transitions.js'];

let changed = [];
let noneAnchor = [];

function removeExisting(s) {
  // 移除既有 liquid-glass 脚本标签行（连同行首空白）
  const re = new RegExp("[ \\t]*<script[^>]*src=\"[^\"]*liquid-glass\\.js\"[^>]*></script>\\r?\\n", 'g');
  return s.replace(re, '');
}

function insert(s, file) {
  const prefix = (file.startsWith('docs' + path.sep + 'pages') || file.startsWith('docs' + path.sep + 'admin'))
    ? '../assets/js/' : 'assets/js/';
  // 编辑器特例：插在 api.js 之后（主 IIFE 前，同计划批准位）
  if (file.endsWith('fluidcanvas-editor.html')) {
    const m = s.match(/([ \t]*<script[^>]*src="[^"]*api\.js"[^>]*><\/script>)/);
    if (m) {
      const indent = m[1].match(/^[ \t]*/)[0];
      return s.replace(m[1], m[1] + '\n' + indent + '<script src="' + prefix + 'liquid-glass.js"></script>');
    }
  }
  for (const a of ANCHORS) {
    const re = new RegExp("([ \\t]*<script[^>]*src=\"[^\"]*" + a.replace('.', '\\.') + "\"[^>]*></script>)");
    const m = s.match(re);
    if (m) {
      const indent = m[1].match(/^[ \t]*/)[0];
      return s.replace(re, m[1] + '\n' + indent + '<script src="' + prefix + 'liquid-glass.js"></script>');
    }
  }
  noneAnchor.push(file);
  const i = s.lastIndexOf('</body>');
  if (i === -1) { console.log('NO </body>:', file); return s; }
  return s.slice(0, i) + '<script src="' + prefix + 'liquid-glass.js"></script>\n' + s.slice(i);
}

for (const d of dirs) {
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith('.html') || SKIP.test(f)) continue;
    const p = path.join(d, f);
    let s = fs.readFileSync(p, 'utf8');
    const had = new RegExp('script[^>]*src="[^"]*liquid-glass\\.js"').test(s);
    s = removeExisting(s);
    s = insert(s, p);
    fs.writeFileSync(p, s);
    changed.push(p + (had ? ' (moved)' : ''));
  }
}
console.log(changed.join('\n'));
console.log('noneAnchor:', noneAnchor.join(', ') || '（无）');
console.log('total:', changed.length);
