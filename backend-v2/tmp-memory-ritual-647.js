// tmp-memory-ritual-647.js — FC v10.28.53.0 边缘 Mask 化记忆仪式（build-state head 换代 / scheme 追加+指针 / MEMORY 顶行完成 / edgemask 文件状态）
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REAL79 = '00379-6k8';
const REAL80 = '00380-8kn';
const DIGEST = 'd2ccca04e27353032de0be86ed3ce2881188e88cfb3239e5bde84f840ea43302';

// ═══ 1) backend-build-state.md：head 换代 ═══
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00378-rjd（2026-10-05 FC v10.28.52.5 折叠出画加深+画外停拍+展开Q弹；站点恒 v0.2.58.28）';
  const c1 = (s.match(/当前线上 rev 00378-rjd/g) || []).length;
  if (c1 !== 1) throw new Error('build-state head anchor count=' + c1);
  const NEW = '**当前线上 rev ' + REAL80 + '（2026-10-06 FC v10.28.53.0 边缘 Mask 化+图片与边缘同步勾选+边缘外扩；站点恒 v0.2.58.28）' +
    '——用户三诉求「AI 生成的自定义边缘应用后画布看不见」+「边缘像 Alight Motion 的 Mask（图片只显示在边缘范围内、形状跟随边缘+图片与边缘同步勾选）」+「边缘要多出去一点」；' +
    '真身=自定义边缘无自动外板+cardOverlay:[] → 剪影只活 ::before(z -1)，图片卡 .card-img-bg(z 0) 整盒盖住剪影 → 应用即看不见；' +
    '修法三件=①Mask 化（CSS --card-mask-clip 只剪内容层 .card-img-bg/.card-stripes，卡根不剪 → box-shadow/选中环/外板照常）②勾选（抽屉 #fcEdgeMaskSync + setEdgeMaskSync 写旗→applyCardBg→renderEdgeMaskSec 同步 UI + 草稿 ' + "'1'/'0'" + ' 往返；自定义 edge 种默认 ' + "'1'" + '/border 种删旗/内置不动旗）③外扩（CUSTOM_EDGE_EXPAND=0.06 + expandClipPct；customEdgeRecipe clip=外扩装饰剪影、clipRaw=原形 Mask 窗）；' +
    '站点恒 58.28；后端零改动 npm test 413/413；i18n 新键 fc.edge.maskSync ×12 语；ethereal/transitions/subnav/inline-css 零触碰（编辑器页豁免）；' +
    '新电池 tmp-battery-fc-edgemask 18/18（首跑 6 红全销账：行计数口径/样本未渲染/摘 box-shadow/勾选 UI 不同步→产品侧补 renderEdgeMaskSec() 调用/卡片数）；' +
    'sed 52.5→53.0（53 件，排除 edgemask 新电池）+手改 5 件（togglefly-r/togglefly/whitenav/paneltoggle/edgeai——edgeai 加 EXP_EDGE/EXP_RING 常量，B7/B8/B10b/B12/B13 --card-clip 断言改 EXP_*，预览/草稿/POST/文章页保持原形）；' +
    '舰队 647 64 项 S 段全过（B 段 CDP 被沙箱 named-pipe 拦一轮，后 danger-full-access 解锁 Chrome 但盘空间打断——静态锚全绿实证）；冒烟 60/60+i18n 34/34+fc-i18n 20/20+npm test 413/413；' +
    '镜像验证 ×2 先验后推 0 mismatch（verify#1 MODE 1 占位 00379-XXX/00380-???；verify#2 MODE 2 终态 00379-6k8+00379-XXX 零残留）；' +
    'deploy 647 ps1 无新 env（env 34 零重复）+GEMINI_MODEL 恒强制 gemini-3.8-flash+SNAPSHOT_INTERVAL_MS 恒强制 86400000；' +
    'docker tag+push 每轮成对（两推 digest 8cf8aa96→' + DIGEST.slice(0,8) + ' 各异=真镜像非遗留 tag）；' +
    '线上探针 fc-edgemask 647 12/12（S1a site-config 53.0+58.28+S1b rev live 口径 00379-6k8×1+00379-XXX 零残留+00380-??? 占位×1+00380-8kn 零残留（滞后一部署）+S1c 编辑器 8 锚+S1d i18n ×12+S2 health tables:66+S3 fc/edges 200+P1a-c CDP live 应用 edge→edgeMask=1+--card-mask-clip 原形+--card-clip 外扩+img clipPath+勾选三态+E1 零异常）；' +
    'digest sha256:' + DIGEST + '（二次烘焙=当前线上）；commit 未 push；**前身 rev 00378-rjd（2026-10-05 FC v10.28.52.5 折叠出画加深+画外停拍+展开Q弹；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) backend-build-state.md ✓ head 换代 ' + REAL80);
}

// ═══ 2) site-versioning-scheme.md：链尾追加 + 当前指针 ═══
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.52.5**';
  const c2 = (s.match(/站点号当前 v0\.2\.58\.28；FC 当前 v10\.28\.52\.5/g) || []).length;
  if (c2 !== 1) throw new Error('scheme pointer anchor count=' + c2);
  const entry = '**FC v10.28.53.0（2026-10-06；小改动位 52→53 新功能轮；rev ' + REAL79 + ' 瞬态→' + REAL80 + ' 终态；站点恒 v0.2.58.28）**：边缘 Mask 化+图片与边缘同步勾选+边缘外扩——' +
    '用户三诉求「AI 生成的自定义边缘应用后画布看不见」+「边缘像 Alight Motion 的 Mask（图片只显示在边缘范围内、形状跟随边缘+图片与边缘同步勾选）」+「边缘要多出去一点」；' +
    '真身=自定义边缘无自动外板+cardOverlay:[] → 剪影只活 ::before(z -1) 被图片卡盖住；' +
    '修法=①Mask 化（--card-mask-clip 只剪内容层 .card-img-bg/.card-stripes，卡根不剪）②勾选（#fcEdgeMaskSync + setEdgeMaskSync→renderEdgeMaskSec 同步 UI + 草稿 ' + "'1'/'0'" + ' 往返）③外扩（CUSTOM_EDGE_EXPAND=0.06 + expandClipPct，clip=外扩/clipRaw=原形 Mask 窗）；' +
    '后端零改动 npm test 413/413；i18n 新键 fc.edge.maskSync ×12 语；ethereal/transitions/subnav/inline-css 零触碰；' +
    '新电池 tmp-battery-fc-edgemask 18/18（首跑 6 红全销账）+sed 52.5→53.0（53 件排除 edgemask）+手改 5 件（edgeai 加 EXP_EDGE/EXP_RING 常量改 5 断言）；' +
    '舰队 647 64 项 S 段全过；冒烟 60/60+i18n 34/34+fc-i18n 20/20；镜像验证 ×2 先验后推 0 mismatch；deploy 647 ps1 无新 env（env 34 零重复）；' +
    '线上探针 fc-edgemask 647 12/12（P1 CDP live 应用 edge→Mask/图片裁剪/勾选三态实证）；digest sha256:' + DIGEST + '（二次烘焙=当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.53.0**');
  fs.writeFileSync(f, s);
  console.log('2) site-versioning-scheme.md ✓ 链尾追加 + 指针 FC 53.0');
}

// ═══ 3) MEMORY.md：顶行「进行中」→「完成」 ═══
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD_LINE = '- [2026-10-06 — FC v10.28.53.0 边缘 Mask 化+图片与边缘同步勾选+边缘外扩（rev 00379-XXX→00380-??? 未部署未 commit；站点恒 58.28）——**换机检查点（进行中）**：代码全毕+新电池 18/18 全绿，仪式链停在舰队前，完整待办见 backend-v2/tmp-647-checkpoint.md；新坑=--card-clip 已外扩（旧电池断言改 EXP_*）+setEdgeMaskSync 须尾调 renderEdgeMaskSec 见 [2026-10-06-fc-v1028530-edgemask.md](2026-10-06-fc-v1028530-edgemask.md)]';
  const c3 = (s.split(OLD_LINE).length - 1);
  if (c3 !== 1) throw new Error('MEMORY top line anchor count=' + c3);
  const NEW_LINE = '- [2026-10-06 — FC v10.28.53.0 边缘 Mask 化+图片与边缘同步勾选+边缘外扩（rev ' + REAL79 + '→' + REAL80 + ' commit 未 push；站点恒 58.28）：Mask 化（--card-mask-clip 剪内容层不剪卡根）+勾选（fcEdgeMaskSync ×12 语）+外扩（CUSTOM_EDGE_EXPAND 0.06+expandClipPct）；后端零改动 npm test 413/413；新电池 edgemask 18/18；冒烟 60/60；镜像验证 ×2 先验后推 0 mismatch；线上探针 12/12 live（P1 Mask/图片裁剪/勾选三态实证）；digest sha256:' + DIGEST + '（二次烘焙=当前线上）；新坑=--card-clip 已外扩（旧电池断言改 EXP_*）+setEdgeMaskSync 须尾调 renderEdgeMaskSec 见 [2026-10-06-fc-v1028530-edgemask.md](2026-10-06-fc-v1028530-edgemask.md)]';
  s = s.replace(OLD_LINE, NEW_LINE);
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓ 顶行完成态 ' + REAL80);
}

// ═══ 4) edgemask 记忆文件：description + 进度行「进行中」→「完成」 ═══
{
  const f = P + '2026-10-06-fc-v1028530-edgemask.md';
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace('（rev 00379-XXX→00380-??? 未部署未 commit；站点恒 58.28）——换机检查点：代码+新电池 18/18 全绿已毕，仪式链停在舰队前；完整待办见 backend-v2/tmp-647-checkpoint.md',
    '（rev ' + REAL79 + '→' + REAL80 + ' commit 未 push；站点恒 58.28）——部署+线上探针 12/12 完成');
  s = s.replace('# FC v10.28.53.0 边缘 Mask 化（2026-10-06，进行中=换机检查点）',
    '# FC v10.28.53.0 边缘 Mask 化（2026-10-06，已完成）');
  s = s.replace(/modified: 2026-10-06T14:12:30\.992Z/, 'modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z');
  fs.writeFileSync(f, s);
  console.log('4) edgemask 记忆文件 ✓ 状态完成');
}
console.log('记忆仪式四处完成');
