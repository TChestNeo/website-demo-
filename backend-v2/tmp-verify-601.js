// tmp-verify-601.js — rev 00301 镜像内容验证：顶部停靠锚在位 + 旧底停靠锚零残留（docker run sh -c 读 /app/docs）
'use strict';
const { spawnSync } = require('child_process');
const ed = '/app/docs/pages/fluidcanvas-editor.html';
const sc = '/app/docs/assets/js/site-config.js';
const cmds = [
  ['insertBefore 首子顶部停靠', `grep -c 'panel.insertBefore(contextMenu, panel.firstChild)' ${ed}`, '1'],
  ['旧 appendChild 底停靠零残留(应 0)', `grep -c 'panel.appendChild(contextMenu)' ${ed}`, '0'],
  ['ctxPillIn 顶滑入动画', `grep -c '@keyframes ctxPillIn' ${ed}`, '1'],
  ['旧 ctxPillUp 零残留(应 0)', `grep -c '@keyframes ctxPillUp' ${ed}`, '0'],
  ['translateY(-110%) 顶滑入', `grep -c 'translateY(-110%)' ${ed}`, '1'],
  ['旧 translateY(110%) 零残留(应 0)', `grep -c 'translateY(110%)' ${ed}`, '0'],
  ['flex-shrink 禁压锚', `grep -c 'flex-shrink: 0;' ${ed}`, '36'],
  ['margin-bottom 8px 锚', `grep -c 'margin-bottom: 8px;' ${ed}`, '4'],
  ['47.2 赋值在位', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.2';" ${sc}`, '1'],
  ['47.1 赋值零残留(应 0)', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.1';" ${sc}`, '0'],
  ['rev 00301- 占位在位', `grep -c '00301-' ${sc}`, '1'],
  ['左侧菜单最顶部 changelog', `grep -c '左侧菜单最顶部' ${sc}`, '1'],
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
