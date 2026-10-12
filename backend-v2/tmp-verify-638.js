// tmp-verify-638.js — FC v10.28.51.1 边缘样本配色+抽屉导航+应用链修复镜像内容验证（两次构建各验一次、先验后推）
//   MODE 1（先验占位口径）：site-config 51.1 赋值 ×1/51.0 赋值零残留 ×0/58.26 赋值 ×1/changelog 头 51.1+51.0 各 ×1/
//     rev 00361-XXX ×1+00362-??? ×1（回归 00359-nfc/00360-bk7 各 ×1）/词 点击后什么都没有 ×1；
//   MODE 2（二次烘焙终态口径）：deploy#1 实得 rev 已填 changelog——00361-真值 ×1+00361-XXX 零残留（工作树）；00362-??? 仍占位 ×1；
//   编辑器 51.1 新件（edgeMiniHtml bg 参数 ×1/cardLayers join ×1/fc-edge-nav .segmented-control ×1/fc.edge.cardUnsupported ×1/
//     v10.28.51.1 ×1/fc-edge-nav ×3/fc-edge-tab 零残留 ×0）；
//   零改动回归（编辑器 v10.28.51.0 ×0+v10.28.50.0 注释 ×25；fluidcanvas/messages/premium/article/ethereal/transitions 51.1 词全 ×0；
//     fluidcanvas 51.0 ×5/messages 51.0 ×7/premium 51.0 ×2）；
//   计数全部=工作树实测口径（grep -cF 按行计）。
//   （docker run sh -c 读 /app；Windows argv 家规：sh 单引号包裹+内单引号 '\'' 转义零双引号进 argv）
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const MODE = Number(process.argv[2] || '1');
const REV61 = process.argv[3] || '00361-XXX';
const cmds = [
  // ══ site-config 51.1 新件 ══
  ["sc FLUIDCANVAS 51.1 赋值 ×1", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.51.1'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc FLUIDCANVAS 51.0 赋值零残留 ×0", `grep -cF 'window.FLUIDCANVAS_VERSION = '\\''v10.28.51.0'\\'';' /app/docs/assets/js/site-config.js`, "0"],
  ["sc SITE 58.26 赋值(回归) ×1", `grep -cF 'window.MN_SITE_VERSION = '\\''v0.2.58.26'\\'';' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 51.1 头 ×1", `grep -cF '// v10.28.51.1 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc changelog 51.0 头(回归) ×1", `grep -cF '// v10.28.51.0 = ' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00361 ×1", `grep -cF '${REV61}' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00362-??? 占位 ×1", `grep -cF '00362-???' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00359-nfc(回归) ×1", `grep -cF '00359-nfc' /app/docs/assets/js/site-config.js`, "1"],
  ["sc rev 00360-bk7(回归) ×1", `grep -cF '00360-bk7' /app/docs/assets/js/site-config.js`, "1"],
  ["sc 词 点击后什么都没有 ×1", `grep -cF '点击后什么都没有' /app/docs/assets/js/site-config.js`, "1"],
  // ══ fluidcanvas-editor.html 51.1 新件 ══
  ["ed edgeMiniHtml bg 参数 ×1", `grep -cF 'function edgeMiniHtml(clip, cls, bg)' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed cardLayers join ×1", `grep -cF "st.cardLayers.join(', ')" /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed fc-edge-nav .segmented-control ×1", `grep -cF 'fc-edge-nav .segmented-control' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed cardUnsupported ×1", `grep -cF 'fc.edge.cardUnsupported' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["ed v10.28.51.1 ×3", `grep -cF 'v10.28.51.1' /app/docs/pages/fluidcanvas-editor.html`, "3"],
  ["ed fc-edge-nav ×3", `grep -cF 'fc-edge-nav' /app/docs/pages/fluidcanvas-editor.html`, "3"],
  ["ed fc-edge-tab 零残留 ×0", `grep -cF 'fc-edge-tab' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  // ══ 51.1 追加：边框裸值放宽 + AI 弹窗正向反馈 ══
  ["ed fc-gen-lamp ×6", `grep -cF 'fc-gen-lamp' /app/docs/pages/fluidcanvas-editor.html`, "6"],
  ["ed fc-gen-dots ×6", `grep -cF 'fc-gen-dots' /app/docs/pages/fluidcanvas-editor.html`, "6"],
  ["ed edgeGenSetStatus ×6", `grep -cF 'edgeGenSetStatus' /app/docs/pages/fluidcanvas-editor.html`, "6"],
  ["ed 裸值放宽(客户端) ×1", `grep -cF 'v < -100 || v > 100' /app/docs/pages/fluidcanvas-editor.html`, "1"],
  ["i18n genIdle ×12", `grep -cF '"fc.edge.genIdle"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n genThinking ×12", `grep -cF '"fc.edge.genThinking"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n genOk ×12", `grep -cF '"fc.edge.genOk"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n genFail ×12", `grep -cF '"fc.edge.genFail"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["i18n genThinkingHint ×12", `grep -cF '"fc.edge.genThinkingHint"' /app/docs/assets/i18n/fluidcanvas.i18n.js`, "12"],
  ["bck sanitizeClip 裸值放宽 ×1", `grep -cF 'v < -100 || v > 100' /app/src/routes/public/fc-edgegen.js`, "1"],
  // ══ 零改动回归 ══
  ["ed v10.28.51.0 零改动 ×0", `grep -cF 'v10.28.51.0' /app/docs/pages/fluidcanvas-editor.html`, "0"],
  ["ed v10.28.50.0 注释(回归) ×25", `grep -cF 'v10.28.50.0' /app/docs/pages/fluidcanvas-editor.html`, "25"],
  ["fc v10.28.51.1 零改动 ×0", `grep -cF 'v10.28.51.1' /app/docs/pages/fluidcanvas.html`, "0"],
  ["fc v10.28.51.0(回归) ×5", `grep -cF 'v10.28.51.0' /app/docs/pages/fluidcanvas.html`, "5"],
  ["msg v10.28.51.1 零改动 ×0", `grep -cF 'v10.28.51.1' /app/docs/pages/messages.html`, "0"],
  ["msg v10.28.51.0(回归) ×7", `grep -cF 'v10.28.51.0' /app/docs/pages/messages.html`, "7"],
  ["pm v10.28.51.1 零改动 ×0", `grep -cF 'v10.28.51.1' /app/docs/pages/premium.html`, "0"],
  ["pm v10.28.51.0(回归) ×2", `grep -cF 'v10.28.51.0' /app/docs/pages/premium.html`, "2"],
  ["art v10.28.51.1 零改动 ×0", `grep -cF 'v10.28.51.1' /app/docs/pages/article.html`, "0"],
  ["eth v10.28.51.1 零触碰 ×0", `grep -cF 'v10.28.51.1' /app/docs/assets/css/ethereal.css`, "0"],
  ["tr v10.28.51.1 零触碰 ×0", `grep -cF 'v10.28.51.1' /app/docs/assets/js/transitions.js`, "0"]
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out !== want) { console.log(`❌ [${name}] got=${out} want=${want}`); bad++; }
}
if (MODE === 2) {
  const sc = fs.readFileSync(path.join(HERE, '..', 'docs', 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const left = sc.split('\n').filter((l) => l.indexOf('00361-XXX') !== -1).length;
  if (left !== 0) { console.log(`❌ [sc rev 00361-XXX 零残留] got=${left} want=0`); bad++; }
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
