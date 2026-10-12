// tmp-verify-599.js — rev 00299 镜像内容验证：新锚在位 + 旧赋值零残留（docker run sh -c 读 /app/docs）
'use strict';
const { spawnSync } = require('child_process');
const ed = '/app/docs/pages/fluidcanvas-editor.html';
const sc = '/app/docs/assets/js/site-config.js';
const cmds = [
  ['新桥 export 1', `grep -c 'window.currentTabItems = currentTabItems' ${ed}`, '1'],
  ['新桥 export 2', `grep -c 'window.esc = esc' ${ed}`, '1'],
  ['ttFilterBtn id', `grep -c 'id="ttFilterBtn"' ${ed}`, '1'],
  ['ttFilterMenu id', `grep -c 'id="ttFilterMenu"' ${ed}`, '1'],
  ['ttTagManageBtn id', `grep -c 'id="ttTagManageBtn"' ${ed}`, '1'],
  ['钩子 __ttOnTagsChanged ≥5', `grep -o 'window.__ttOnTagsChanged' ${ed} | wc -l`, '10'],
  ['TT_FILTER_TAG_IDS 状态', `grep -c 'TT_FILTER_TAG_IDS' ${ed}`, '13'],
  ['47.0 赋值在位', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.47.0';" ${sc}`, '1'],
  ['rev 00299- 占位在位', `grep -c '00299-' ${sc}`, '1'],
  ['46.0 赋值零残留(应 0)', `grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.46.0';" ${sc}`, '0'],
  ['同步图库 changelog', `grep -c '同步图库' ${sc}`, '1'],
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
