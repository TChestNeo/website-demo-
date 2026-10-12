// tmp-verify-603.js — rev 00303 镜像内容验证：47.4 平滑折叠+白底锚在位 + 旧一体化/旧版本锚零残留
// （docker run sh -c 读 /app/docs；grep -c 按行计——行数以此前本地同口径统计为准）
'use strict';
const { spawnSync } = require('child_process');
const ed = '/app/docs/pages/fluidcanvas-editor.html';
const sc = '/app/docs/assets/js/site-config.js';
const cmds = [
  ['placeCtxPillDots(panel) 药丸卡挂载', `grep -c 'placeCtxPillDots(panel)' ${ed}`, '2'],
  ['fc-pill-fold 折叠门控+prep 全族', `grep -c 'fc-pill-fold' ${ed}`, '14'],
  ['fc-pill-fold-prep 收起视觉态', `grep -c 'fc-pill-fold-prep' ${ed}`, '6'],
  ['ctxPillRise 从下向上滑入动画', `grep -c '@keyframes ctxPillRise' ${ed}`, '1'],
  ['translateY(110%) 从下向上起点（Rise+Fall 两处）', `grep -c 'translateY(110%)' ${ed}`, '2'],
  ['ctxPillFade 药丸渐现+淡出动画', `grep -c '@keyframes ctxPillFade' ${ed}`, '2'],
  ['@keyframes ctxPillFall 关窗退出动画', `grep -c '@keyframes ctxPillFall' ${ed}`, '1'],
  ['@keyframes ctxPillFadeOut 药丸淡出动画', `grep -c '@keyframes ctxPillFadeOut' ${ed}`, '1'],
  ['ctx-pill-exit 退出动画类', `grep -c 'ctx-pill-exit' ${ed}`, '5'],
  ['__pillCloseTimer 收尾计时器', `grep -c '__pillCloseTimer' ${ed}`, '4'],
  ['__foldTimer 门控计时器', `grep -c '__foldTimer' ${ed}`, '4'],
  ['function finishHideContextMenu() 收尾拆分', `grep -c 'function finishHideContextMenu()' ${ed}`, '1'],
  ['translateY(-56px) 收起位移', `grep -c 'translateY(-56px)' ${ed}`, '1'],
  ['background: #ffffff; 白底列表', `grep -c 'background: #ffffff;' ${ed}`, '1'],
  ['.asset-panel > .ctx-pill-dots 面板直接子级现身规则', `grep -c '.asset-panel > .ctx-pill-dots' ${ed}`, '4'],
  ['旧 ctxPillIn 顶滑入零残留(应 0)', `grep -c '@keyframes ctxPillIn' ${ed}`, '0'],
  ['旧 translateY(-110%) 零残留(应 0)', `grep -c 'translateY(-110%)' ${ed}`, '0'],
  ['旧 ctx-collapsed 折叠口径零残留(应 0)', `grep -c 'ctx-collapsed' ${ed}`, '0'],
  ['flex-shrink 禁压锚', `grep -c 'flex-shrink: 0;' ${ed}`, '37'],
  ['margin-bottom 8px 锚', `grep -c 'margin-bottom: 8px;' ${ed}`, '5'],
  ['菜单首子挂载 insertBefore', `grep -c 'insertBefore(contextMenu, panel.firstChild)' ${ed}`, '1'],
  ['47.4 赋值在位', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';" ${sc}`, '1'],
  ['47.3 赋值零残留(应 0)', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.3';" ${sc}`, '0'],
  ['rev 00303- 占位在位', `grep -c '00303-' ${sc}`, '1'],
  ['折叠的过渡动画不顺畅 changelog', `grep -c '折叠的过渡动画不顺畅' ${sc}`, '1'],
  ['列表的背景能不能是白色的 changelog', `grep -c '列表的背景能不能是白色的' ${sc}`, '1'],
  ['三粒点独立一个 changelog 保持', `grep -c '三粒点独立一个' ${sc}`, '1'],
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
