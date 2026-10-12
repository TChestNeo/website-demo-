// tmp-verify-608.js — rev 00308 镜像内容验证：折叠侧栏等级水杯改药丸形+波浪加大锚在位 + 旧正圆/旧 12×8
//   赋值零残留（docker run sh -c 读 /app/docs；grep -c 按行计——mask-size 双写同行=1 行，
//   行数以本地 Grep 同口径校准为准）
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
  ['ethereal 药丸 28×48 规则在位', `grep -cF 'width: 28px; height: 48px; border-radius: 999px;' ${ec}`, '1'],
  ['ethereal 水杯药丸 24×32 胶囊在位', `grep -cF 'width: 24px; height: 32px; border-radius: 999px;' ${ec}`, '1'],
  ['ethereal 旧正圆 24×24 50% 零残留(应 0)', `grep -cF 'width: 24px; height: 24px; border-radius: 50%;' ${ec}`, '0'],
  ['ethereal 浅层 color-mix 在位', `grep -cF -- '--mn-lv-light: color-mix(in srgb, var(--color-primary) 55%, #ffffff);' ${ec}`, '1'],
  ['ethereal 正弦水面 mask-image ×2（webkit+标准）', `grep -cF 'mask-image: url(' ${ec}`, '2'],
  ['ethereal 新正弦 viewBox 16×12 ×2', `grep -cF "viewBox='0 0 16 12'" ${ec}`, '2'],
  ['ethereal 旧正弦 viewBox 12×8 零残留(应 0)', `grep -cF "viewBox='0 0 12 8'" ${ec}`, '0'],
  ['ethereal mask-size 16px 12px ×1（双写同行）', `grep -cF 'mask-size: 16px 12px' ${ec}`, '1'],
  ['ethereal 旧 mask-size 12px 8px 零残留(应 0)', `grep -cF 'mask-size: 12px 8px' ${ec}`, '0'],
  ['ethereal 波形带加大 300% strip + 12px 高在位', `grep -cF 'position: absolute; left: -100%; width: 300%; height: 12px;' ${ec}`, '1'],
  ['ethereal 波形背景色 var(--mn-lv-wave-c) 在位', `grep -cF 'background-color: var(--mn-lv-wave-c);' ${ec}`, '1'],
  ['ethereal 波形平移一个波长 translateX(-16px) 在位', `grep -cF 'translateX(-16px)' ${ec}`, '1'],
  ['ethereal 旧平移 translateX(-12px) 零残留(应 0)', `grep -cF 'translateX(-12px)' ${ec}`, '0'],
  ['ethereal 深波 top calc(40% - 6px) 在位', `grep -cF 'top: calc(40% - 6px);' ${ec}`, '1'],
  ['ethereal 旧深波 top calc(40% - 4px) 零残留(应 0)', `grep -cF 'top: calc(40% - 4px);' ${ec}`, '0'],
  ['ethereal 浅波 top -6px 在位', `grep -cF 'top: -6px;' ${ec}`, '1'],
  ['ethereal 旧浅波 top -4px 零残留(应 0)', `grep -cF 'top: -4px;' ${ec}`, '0'],
  ['ethereal 深波动画 1.6s 在位', `grep -cF 'animation: mn-lv-wave 1.6s linear infinite;' ${ec}`, '1'],
  ['ethereal 浅波动画 2.2s 在位', `grep -cF 'animation: mn-lv-wave 2.2s linear infinite;' ${ec}`, '1'],
  ['ethereal keyframes mn-lv-wave 在位', `grep -cF '@keyframes mn-lv-wave' ${ec}`, '1'],
  ['ethereal 新轮注释：药丸形不是圆形（用户原话）', `grep -c '药丸形不是圆形' ${ec}`, '1'],
  ['ethereal 新轮注释：波浪能不能大一些（用户原话）', `grep -c '波浪能不能大一些' ${ec}`, '1'],
  ['ethereal 58.4 注释：波纹不是动画 保留', `grep -c '波纹不是动画' ${ec}`, '1'],
  ['ethereal 58.3 注释：像时间一样的 保留', `grep -c '像时间一样的' ${ec}`, '1'],
  ['ethereal 头像注释挤压到了恒 1 处', `grep -c '挤压到了' ${ec}`, '1'],
  ['ethereal 旧花边 radial 规则零残留(应 0)', `grep -cF 'background: radial-gradient(circle at 50% 0' ${ec}`, '0'],
  ['ethereal 旧 background-size: 7px 7px 零残留(应 0)', `grep -cF 'background-size: 7px 7px' ${ec}`, '0'],
  ['ethereal 旧 conic-gradient 零残留(应 0)', `grep -c 'conic-gradient' ${ec}`, '0'],
  ['ethereal 旧 mn-lv-pill-core 零残留(应 0)', `grep -c 'mn-lv-pill-core' ${ec}`, '0'],
  ['sidebar.js 水杯环容器在位', `grep -cF 'class="mn-lv-ring"' ${sj}`, '1'],
  ['sidebar.js fillPct 在位', `grep -cF 'var fillPct =' ${sj}`, '1'],
  ['sidebar.js 水位内联样式拼装在位', `grep -cF 'class="mn-lv-fill" style="height:' ${sj}`, '1'],
  ['sidebar.js 展开视图包装 .mn-lv-normal 在位', `grep -cF 'class="mn-lv-normal"' ${sj}`, '1'],
  ['index.html 内联块药丸规则同步', `grep -cF '.mn-lv-badge .mn-lv-pill { display: none; }' ${ix}`, '1'],
  ['index.html 内联块动画同步 ×2', `grep -cF 'mn-lv-pill-in' ${ix}`, '2'],
  ['index.html 内联块深波规则同步', `grep -cF '.mn-lv-wdeepwave {' ${ix}`, '1'],
  ['index.html 内联块水杯药丸 24×32 同步', `grep -cF 'width: 24px; height: 32px; border-radius: 999px;' ${ix}`, '1'],
  ['index.html 内联块 mask-image 同步 ×2', `grep -cF 'mask-image: url(' ${ix}`, '2'],
  ['index.html 内联块 mask-size 16px 12px 同步 ×1', `grep -cF 'mask-size: 16px 12px' ${ix}`, '1'],
  ['index.html 内联块 300% strip 同步 ×1', `grep -cF 'left: -100%; width: 300%' ${ix}`, '1'],
  ['index.html 内联块 keyframes 同步', `grep -cF '@keyframes mn-lv-wave' ${ix}`, '1'],
  ['index.html 内联块两速动画同步 ×2', `grep -cF 'animation: mn-lv-wave ' ${ix}`, '2'],
  ['编辑器页手工同步（药丸动画 ×2）', `grep -cF 'mn-lv-pill-in' ${ed}`, '2'],
  ['编辑器页手工同步（深波规则）', `grep -cF '.mn-lv-wdeepwave {' ${ed}`, '1'],
  ['编辑器页手工同步（水杯药丸 24×32）', `grep -cF 'width: 24px; height: 32px; border-radius: 999px;' ${ed}`, '1'],
  ['编辑器页手工同步（mask-image ×2）', `grep -cF 'mask-image: url(' ${ed}`, '2'],
  ['编辑器页手工同步（mask-size 16px 12px ×1）', `grep -cF 'mask-size: 16px 12px' ${ed}`, '1'],
  ['编辑器页手工同步（300% strip ×1）', `grep -cF 'left: -100%; width: 300%' ${ed}`, '1'],
  ['编辑器页手工同步（keyframes）', `grep -cF '@keyframes mn-lv-wave' ${ed}`, '1'],
  ['编辑器页手工同步（两速动画 ×2）', `grep -cF 'animation: mn-lv-wave ' ${ed}`, '2'],
  ['FC 编辑器零触碰（fc-pill-fold 计数不变 14）', `grep -cF 'fc-pill-fold' ${ed}`, '14'],
  ['58.5 赋值在位', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.5';" ${sc}`, '1'],
  ['58.4 赋值零残留(应 0)', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.4';" ${sc}`, '0'],
  ['changelog 58.5 条目标题在位', `grep -c 'v0.2.58.5 = 折叠侧栏等级水杯改药丸形+波浪加大' ${sc}`, '1'],
  ['changelog 58.4 历史条目保留', `grep -c 'v0.2.58.4 = 折叠侧栏等级水位环波纹改正弦水面' ${sc}`, '1'],
  ['changelog 58.3 历史条目保留', `grep -c 'v0.2.58.3 = 折叠侧栏等级水位环+双层水波' ${sc}`, '1'],
  ['changelog 58.2 历史条目保留', `grep -c 'v0.2.58.2 = 折叠侧栏等级纵向药丸+经验环' ${sc}`, '1'],
  ['changelog 58.1 历史条目保留', `grep -c 'v0.2.58.1 = 左侧菜单底部不透明背景完全删除' ${sc}`, '1'],
  ['changelog 58.0 历史条目保留', `grep -c 'v0.2.58.0 = 完整格子画布镜像' ${sc}`, '1'],
  ['rev 00308- 占位在位', `grep -c '00308-' ${sc}`, '1'],
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
