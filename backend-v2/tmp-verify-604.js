// tmp-verify-604.js — rev 00304 镜像内容验证：侧栏铺底规则零残留+新轮锚在位 + 旧 58.0 赋值零残留
// （docker run sh -c 读 /app/docs；grep -c 按行计——行数以此前本地同口径统计为准）
'use strict';
const { spawnSync } = require('child_process');
const ec = '/app/docs/assets/css/ethereal.css';
const sc = '/app/docs/assets/js/site-config.js';
const ix = '/app/docs/index.html';
const ad = '/app/docs/admin/index.html';
const sj = '/app/docs/assets/js/sidebar.js';
const ed = '/app/docs/pages/fluidcanvas-editor.html';
const cmds = [
  ['ethereal 暗色侧栏铺底规则零残留(应 0)', `grep -cF ':root[data-theme="dark"] .app-sidebar {' ${ec}`, '0'],
  ['ethereal 亮色侧栏铺底规则零残留(应 0)', `grep -cF ':root:not([data-theme="dark"]) .app-sidebar {' ${ec}`, '0'],
  ['ethereal 暗色玻璃注入层灭滤镜规则在位', `grep -cF ':root[data-theme="dark"] .app-sidebar .lg-backdrop {' ${ec}`, '1'],
  ['ethereal 亮色玻璃注入层灭滤镜规则在位', `grep -cF ':root:not([data-theme="dark"]) .app-sidebar .lg-backdrop {' ${ec}`, '1'],
  ['ethereal 新轮注释：我要完全的删除它', `grep -c '我要完全的删除它' ${ec}`, '1'],
  ['ethereal 新轮注释：不是我的卡片', `grep -c '不是我的卡片' ${ec}`, '1'],
  ['ethereal --sidebar-bg 用法恒 2 处（dropdown+全站卡片）', `grep -cF 'background: var(--sidebar-bg);' ${ec}`, '2'],
  ['ethereal 三张卡零触碰（.sidebar-module 玻璃卡）', `grep -cF 'backdrop-filter: blur(20px);' ${ec}`, '7'],
  ['index.html 内联块已刷新（新轮注释）', `grep -c '我要完全的删除它' ${ix}`, '1'],
  ['index.html 内联块铺底规则零残留(应 0)', `grep -cF ':root[data-theme="dark"] .app-sidebar {' ${ix}`, '0'],
  ['admin/index.html 内联块已刷新（新轮注释）', `grep -c '我要完全的删除它' ${ad}`, '1'],
  ['sidebar.js 53.3 历史注释保留', `grep -c '那个左侧菜单的底部背景能不能去掉' ${sj}`, '1'],
  ['58.1 赋值在位', `grep -c "window.MN_SITE_VERSION = 'v0.2.58.1';" ${sc}`, '1'],
  ['58.0 赋值零残留(应 0)', `grep -c "window.MN_SITE_VERSION = 'v0.2.58.0';" ${sc}`, '0'],
  ['changelog 58.1 条目标题在位', `grep -c 'v0.2.58.1 = 左侧菜单底部不透明背景完全删除' ${sc}`, '1'],
  ['changelog 58.0 历史条目保留', `grep -c 'v0.2.58.0 = 完整格子画布镜像' ${sc}`, '1'],
  ['rev 00304- 占位在位', `grep -c '00304-' ${sc}`, '1'],
  ['FC 47.4 赋值在位（FC 零改动）', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';" ${sc}`, '1'],
  ['FC 47.3 赋值零残留(应 0)', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.3';" ${sc}`, '0'],
  ['FC 编辑器零触碰（fc-pill-fold 计数不变）', `grep -c 'fc-pill-fold' ${ed}`, '14'],
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
