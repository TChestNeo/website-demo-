// tmp-measure-634.js — FC 49.1 轮镜像锚实测（docker run sh -c grep -cF 按行计）
'use strict';
const { spawnSync } = require('child_process');
const C = [
  ['sc FLUIDCANVAS 49.1 赋值', `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.49.1'\\'';' /app/docs/assets/js/site-config.js`],
  ['sc FLUIDCANVAS 49.0 赋值', `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.49.0'\\'';' /app/docs/assets/js/site-config.js`],
  ['sc SITE 58.26 赋值', `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.26'\\'';' /app/docs/assets/js/site-config.js`],
  ['sc changelog 49.1 头', `grep -cF '// v10.28.49.1 = ' /app/docs/assets/js/site-config.js`],
  ['sc changelog 49.0 头', `grep -cF '// v10.28.49.0 = ' /app/docs/assets/js/site-config.js`],
  ['sc changelog 48.2 头', `grep -cF '// v10.28.48.2 = ' /app/docs/assets/js/site-config.js`],
  ['sc rev 00352-XXX', `grep -cF '00352-XXX' /app/docs/assets/js/site-config.js`],
  ['sc rev 00353-???', `grep -cF '00353-???' /app/docs/assets/js/site-config.js`],
  ['sc rev 00350-6vv(回归)', `grep -cF '00350-6vv' /app/docs/assets/js/site-config.js`],
  ['sc rev 00351-5mm(回归)', `grep -cF '00351-5mm' /app/docs/assets/js/site-config.js`],
  ['sc 词 折叠按钮随菜单一起移动', `grep -cF '折叠按钮随菜单一起移动' /app/docs/assets/js/site-config.js`],
  ['ed :has 折叠态规则', `grep -cF '.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle' /app/docs/pages/fluidcanvas-editor.html`],
  ['ed 旧相邻兄弟死规则', `grep -cF '.asset-panel.collapsed + .asset-panel-toggle {' /app/docs/pages/fluidcanvas-editor.html`],
  ['ed 展开态 left 锚', `grep -cF 'left: calc(var(--asset-panel-w) + 6px)' /app/docs/pages/fluidcanvas-editor.html`],
  ['ed 折叠态 left 锚', `grep -cF 'left: 6px; border-left: 1px solid var(--divider-line-strong); border-radius: 6px;' /app/docs/pages/fluidcanvas-editor.html`],
  ['ed 面板宽单旋钮', `grep -cF '--asset-panel-w: 260px' /app/docs/pages/fluidcanvas-editor.html`],
  ['ed 面板折叠规则', `grep -cF '.asset-panel.collapsed {' /app/docs/pages/fluidcanvas-editor.html`],
  ['ed left 过渡', `grep -cF 'transition: left 0.25s;' /app/docs/pages/fluidcanvas-editor.html`],
  ['ed v10.28.49.1', `grep -cF 'v10.28.49.1' /app/docs/pages/fluidcanvas-editor.html`],
  ['ed v10.28.49.0(回归)', `grep -cF 'v10.28.49.0' /app/docs/pages/fluidcanvas-editor.html`],
  ['fcPage v10.28.49.1 零改动', `grep -cF 'v10.28.49.1' /app/docs/pages/fluidcanvas.html`],
  ['fcPage FC_OVERVIEW(回归)', `grep -cF 'FC_OVERVIEW' /app/docs/pages/fluidcanvas.html`],
  ['fcPage 48.2K(回归)', `grep -cF '48.2K' /app/docs/pages/fluidcanvas.html`],
  ['art v10.28.49.1 零改动', `grep -cF 'v10.28.49.1' /app/docs/pages/article.html`],
];
let bad = 0;
for (const [name, c] of C) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  console.log(out + '  ' + name);
  if (!/^\d+$/.test(out)) bad++;
}
console.log(bad === 0 ? 'measure ok' : 'measure FAIL ' + bad);
