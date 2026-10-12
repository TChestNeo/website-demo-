// tmp-verify-605.js — rev 00305 镜像内容验证：折叠侧栏等级纵向药丸+经验环锚在位 + 58.1 赋值零残留
// （docker run sh -c 读 /app/docs；grep -c 按行计——行数以此前本地同口径统计为准）
'use strict';
const { spawnSync } = require('child_process');
const ec = '/app/docs/assets/css/ethereal.css';
const sc = '/app/docs/assets/js/site-config.js';
const ix = '/app/docs/index.html';
const sj = '/app/docs/assets/js/sidebar.js';
const ed = '/app/docs/pages/fluidcanvas-editor.html';
const cmds = [
  ['ethereal 药丸默认隐藏规则在位', `grep -cF '.mn-lv-badge .mn-lv-pill { display: none; }' ${ec}`, '1'],
  ['ethereal 药丸动画 mn-lv-pill-in ×2', `grep -cF 'mn-lv-pill-in' ${ec}`, '2'],
  ['ethereal 锚内首子 margin 归零规则在位', `grep -cF '.app-sidebar.collapsed .user-info-bar > a:first-child > div:first-child {' ${ec}`, '1'],
  ['ethereal 药丸环 28×48 规则在位', `grep -cF 'width: 28px; height: 48px; padding: 3px; border-radius: 999px;' ${ec}`, '1'],
  ['ethereal 新轮注释：挤压到了（用户原话 1301+修法注释 1336 两处）', `grep -c '挤压到了' ${ec}`, '2'],
  ['ethereal 新轮注释：药丸中间显示等级', `grep -c '药丸中间显示等级' ${ec}`, '1'],
  ['ethereal --sidebar-bg 用法恒 2 处（58.1 锚仍真）', `grep -cF 'background: var(--sidebar-bg);' ${ec}`, '2'],
  ['sidebar.js 药丸环四件套在位', `grep -cF 'class="mn-lv-ring"' ${sj}`, '1'],
  ['sidebar.js ringPct 在位', `grep -cF 'var ringPct =' ${sj}`, '1'],
  ['sidebar.js 展开视图包装 .mn-lv-normal 在位', `grep -cF 'class="mn-lv-normal"' ${sj}`, '1'],
  ['index.html 内联块药丸规则同步', `grep -cF '.mn-lv-badge .mn-lv-pill { display: none; }' ${ix}`, '1'],
  ['index.html 内联块动画同步 ×2', `grep -cF 'mn-lv-pill-in' ${ix}`, '2'],
  ['编辑器页手工同步（药丸动画 ×2）', `grep -cF 'mn-lv-pill-in' ${ed}`, '2'],
  ['FC 编辑器零触碰（fc-pill-fold 计数不变 14）', `grep -cF 'fc-pill-fold' ${ed}`, '14'],
  ['58.2 赋值在位', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.2';" ${sc}`, '1'],
  ['58.1 赋值零残留(应 0)', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.1';" ${sc}`, '0'],
  ['changelog 58.2 条目标题在位', `grep -c 'v0.2.58.2 = 折叠侧栏等级纵向药丸+经验环' ${sc}`, '1'],
  ['changelog 58.1 历史条目保留', `grep -c 'v0.2.58.1 = 左侧菜单底部不透明背景完全删除' ${sc}`, '1'],
  ['changelog 58.0 历史条目保留', `grep -c 'v0.2.58.0 = 完整格子画布镜像' ${sc}`, '1'],
  ['rev 00305- 占位在位', `grep -c '00305-' ${sc}`, '1'],
  ['FC 47.4 赋值在位（FC 零改动）', `grep -cF "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';" ${sc}`, '1'],
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
