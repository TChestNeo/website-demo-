// tmp-verify-600.js — rev 00300 镜像内容验证：新几何锚在位 + 旧几何零残留（docker run sh -c 读 /app/docs）
'use strict';
const { spawnSync } = require('child_process');
const ed = '/app/docs/pages/fluidcanvas-editor.html';
const sc = '/app/docs/assets/js/site-config.js';
const cmds = [
  ['弹层 440px 宽+小屏收窄', `grep -c 'width: 440px; max-width: calc(100vw - 16px); padding: 12px;' ${ed}`, '1'],
  ['3 列轨计数(源码=5)', `grep -o 'repeat(3, 1fr)' ${ed} | wc -l`, '5'],
  ['网格 380px 滚动', `grep -c 'max-height: 380px; overflow-y: auto;' ${ed}`, '1'],
  ['缩略图 60×60', `grep -c 'width: 60px; height: 60px; flex: none; border-radius: 6px;' ${ed}`, '1'],
  ['图名 11px 两行截断', `grep -c 'font-size: 11px; line-height: 1.35;' ${ed}`, '1'],
  ['旧 280px 弹层规则零残留(应 0)', `grep -c 'width: 280px; padding: 10px;' ${ed}`, '0'],
  ['旧 2 列库格规则零残留(应 0)', `grep -c '.tim-grid.tt-lib-mode { grid-template-columns: repeat(2, 1fr); }' ${ed}`, '0'],
  ['旧 2 列搜索规则零残留(应 0)', `grep -c '.tim-grid.tim-search-mode { grid-template-columns: repeat(2, 1fr); }' ${ed}`, '0'],
  ['47.1 赋值在位', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.1';" ${sc}`, '1'],
  ['rev 00300- 占位在位', `grep -c '00300-' ${sc}`, '1'],
  ['47.0 赋值零残留(应 0)', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.0';" ${sc}`, '0'],
  ['做大些 changelog', `grep -c '做大些' ${sc}`, '1'],
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
