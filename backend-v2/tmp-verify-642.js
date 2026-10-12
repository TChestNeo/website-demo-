// tmp-verify-642.js — FC v10.28.52.1 边缘抽屉滑动胶囊镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 52.1 赋值 ×1/52.0 赋值零残留 ×0/站点 58.28 赋值(回归) ×1/
//     changelog 头 52.1+52.0+58.28 各 ×1/rev 00369-XXX ×1+00370-??? ×1（回归 00367-4wl/00368-gmw 各 ×1）/原话 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00369-真值 ×1+00369-XXX 零残留（工作树）；00370-??? 仍占位 ×1；
//   编辑器 10 锚（subnav data-slider/双钮/兜底我/subnav.js 引入/两条 flex 规则/旧抽屉 segmented 零残留/edgeNavResync 定义+调用）；
//   i18n：fc.edge.tabMy ×12+我 ×2+My ×1；零改动回归（ethereal/transitions/fluidcanvas/messages/premium/article/subnav 52.1 词全 ×0+CSS_MARK 页 ×41）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV69 = process.argv[3] || '00369-XXX';
const cmds = [
  // ══ site-config 52.1 新件 ══
  ["sc FLUIDCANVAS 52.1 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.1'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 52.0 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.52.0'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.28 赋值(回归) ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.28'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.1 头 ×1", `grep -cF '// v10.28.52.1 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 52.0 头(回归) ×1", `grep -cF '// v10.28.52.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 58.28 头(回归) ×1", `grep -cF '// v0.2.58.28 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00369 ×1", `grep -cF '${REV69}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00370-??? 占位 ×1", `grep -cF '00370-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00367-4wl(回归) ×1", `grep -cF '00367-4wl' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00368-gmw(回归) ×1", `grep -cF '00368-gmw' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 原话 界面什么语言就什么语言不要参其他语言 ×1", `grep -cF '界面什么语言就什么语言不要参其他语言' /app/docs/assets/js/site-config.js`, "1"],
  // ══ 编辑器 52.1 新件（10 锚） ══
  ["ed subnav data-slider ×1", `grep -cF 'class="subnav" data-slider id="fcEdgeTabNav"' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed subnav-pill 全部钮 ×1", `grep -cF 'subnav-pill active" id="fcEdgeTabAll"' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed subnav-pill 我钮 ×1", `grep -cF 'subnav-pill" id="fcEdgeTabMy"' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed tabMy 兜底我 ×1", `grep -cF 'data-i18n="fc.edge.tabMy">我</button>' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed subnav.js 引入 ×1", `grep -cF 'src="../assets/js/subnav.js"' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fc-edge-nav .subnav flex ×1", `grep -cF 'fc-edge-nav .subnav { flex: 1; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fc-edge-nav .subnav-pill flex ×1", `grep -cF 'fc-edge-nav .subnav-pill { flex: 1; }' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed 旧抽屉 segmented 规则零残留 ×0", `grep -cF '.fc-edge-nav .segmented-control' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed edgeNavResync 定义 ×1", `grep -cF 'function edgeNavResync()' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed edgeNavResync 调用 ×1", `grep -cF 'setTimeout(edgeNavResync, 320)' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  // ══ i18n 52.1 新件 ══
  ["i18n fc.edge.tabMy 键 ×12", `grep -cF '"fc.edge.tabMy":' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n fc.edge.tabMy 我值 ×2", `grep -cF '"fc.edge.tabMy": "我"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "2"],
  ["i18n fc.edge.tabMy My值 ×1", `grep -cF '"fc.edge.tabMy": "My"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "1"],
  // ══ 零改动回归 ══
  ["eth v10.28.52.1 零触碰 ×0", `grep -cF 'v10.28.52.1' /app/docs/assets/css/ethereal.css`, "0"],
  ["tr v10.28.52.1 零触碰 ×0", `grep -cF 'v10.28.52.1' /app/docs/assets/js/transitions.js`, "0"],
  ["sn v10.28.52.1 零触碰 ×0", `grep -cF 'v10.28.52.1' /app/docs/assets/js/subnav.js`, "0"],
  ["fch v10.28.52.1 零改动 ×0", `grep -cF 'v10.28.52.1' /app/docs/pages/fluidcanvas.html`, "0"],
  ["msg v10.28.52.1 零改动 ×0", `grep -cF 'v10.28.52.1' /app/docs/pages/messages.html`, "0"],
  ["pm v10.28.52.1 零改动 ×0", `grep -cF 'v10.28.52.1' /app/docs/pages/premium.html`, "0"],
  ["art v10.28.52.1 零改动 ×0", `grep -cF 'v10.28.52.1' /app/docs/pages/article.html`, "0"],
  ["img CSS_MARK 页 ×41（本轮零 inline 重跑）", `grep -rlF 'ethereal.css 内联（切页闪修复 08-28' /app/docs --include='*.html' | wc -l`, "41"]
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
if (MODE === 2) {
  const sc = fs.readFileSync(path.join(HERE, '..', 'docs', 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const left = sc.split('\n').filter((l) => l.indexOf('00369-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00369-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
