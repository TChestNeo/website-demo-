// tmp-verify-602.js — rev 00302 镜像内容验证：两卡锚在位 + 旧一体化锚零残留（docker run sh -c 读 /app/docs）
'use strict';
const { spawnSync } = require('child_process');
const ed = '/app/docs/pages/fluidcanvas-editor.html';
const sc = '/app/docs/assets/js/site-config.js';
const cmds = [
  ['placeCtxPillDots(panel) 药丸卡挂载', `grep -c 'placeCtxPillDots(panel)' ${ed}`, '2'],
  ['fc-pill-fold 折叠门控', `grep -c 'fc-pill-fold' ${ed}`, '5'],
  ['ctxPillRise 从下向上滑入动画', `grep -c '@keyframes ctxPillRise' ${ed}`, '1'],
  ['translateY(110%) 从下向上起点', `grep -c 'translateY(110%)' ${ed}`, '1'],
  ['ctxPillFade 药丸渐现动画', `grep -c '@keyframes ctxPillFade' ${ed}`, '1'],
  ['.asset-panel > .ctx-pill-dots 面板直接子级现身规则', `grep -c '.asset-panel > .ctx-pill-dots' ${ed}`, '2'],
  ['旧 ctxPillIn 顶滑入零残留(应 0)', `grep -c '@keyframes ctxPillIn' ${ed}`, '0'],
  ['旧 translateY(-110%) 零残留(应 0)', `grep -c 'translateY(-110%)' ${ed}`, '0'],
  ['旧 ctx-collapsed 折叠口径零残留(应 0)', `grep -c 'ctx-collapsed' ${ed}`, '0'],
  ['flex-shrink 禁压锚', `grep -c 'flex-shrink: 0;' ${ed}`, '37'],
  ['margin-bottom 8px 锚', `grep -c 'margin-bottom: 8px;' ${ed}`, '5'],
  ['菜单首子挂载 insertBefore', `grep -c 'insertBefore(contextMenu, panel.firstChild)' ${ed}`, '1'],
  ['47.3 赋值在位', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.3';" ${sc}`, '1'],
  ['47.2 赋值零残留(应 0)', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.2';" ${sc}`, '0'],
  ['rev 00302- 占位在位', `grep -c '00302-' ${sc}`, '1'],
  ['三粒点独立一个 changelog', `grep -c '三粒点独立一个' ${sc}`, '1'],
  ['从下向上滑出 changelog', `grep -c '从下向上滑出' ${sc}`, '2'],
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  console.log(`[${name}] → ${out}`);
  if (out !== want) bad++;
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
