// tmp-update-memory-634.js — FC v10.28.49.1 记忆仪式：
//   ① backend-build-state.md 头旋转（00353-终态 新 head；00351-5mm 降前身）
//   ② site-versioning-scheme.md 追加 FC 49.1 条目+当前指针（站点号恒 58.26）
//   ③ MEMORY.md 新行+两处「当前」指针更新
//   ④ 新记忆文件 2026-10-02-fc-v1028491-paneltoggle.md
//   运行前把 REV1/REV2/DIGEST 填真（deploy#1 瞬态 rev / deploy#2 终态 rev / 二次烘焙 push digest）
'use strict';
const REV1 = '00352-sdl';   // deploy#1 瞬态真 rev
const REV2 = '00353-8d2';   // deploy#2 终态真 rev
const DIGEST = 'sha256:655f0ecdec2fbeccf767e397ca97aeeef4f18ace94d16d7fdfa70de553a24566'; // 二次烘焙 push digest（=当前线上）
const fs = require('fs');
const path = require('path');
const MEM = 'C:\\Users\\USER\\.claude\\projects\\c--Users-USER-Downloads-stitch-slatiworld-micronation-interface\\memory';
const read = (f) => fs.readFileSync(path.join(MEM, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(MEM, f), s, 'utf8');
let steps = 0;
const step = (n, cond) => { steps++; console.log((cond ? '  ✅ ' : '  ❌ ') + n); if (!cond) process.exitCode = 1; };

// ═══ ① backend-build-state.md 头旋转 ═══
{
  const f = 'backend-build-state.md';
  let s = read(f);
  const headAnchor = '**当前线上 rev 00351-5mm（';
  const demote = '**前身 rev 00351-5mm（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-10-02 FC v10.28.49.1 折叠按钮随菜单一起移动（补丁位 49.0→49.1；站点恒 v0.2.58.26）——用户「还有那个FC编辑页左侧菜单的折叠按钮不会在菜单折叠后一起移动」；' +
    '真身=DOM 序按钮是 .canvas-body 首子、面板次子——旧相邻兄弟规则 .asset-panel.collapsed + .asset-panel-toggle 永不匹配（死规则）→折叠后按钮滞留 266px；' +
    '修法=.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; border-left: 1px solid var(--divider-line-strong); border-radius: 6px; }（:has 祖先匹配替代死规则；DOM 序零改动；展开态口径逐字节不变——left calc(var(--asset-panel-w)+6px)=266px/圆角 0 6 6 0/无左边线/◂/面板 260px；toggleAssetPanel() JS 零改动）；' +
    'site-config FLUIDCANVAS_VERSION \'v10.28.49.0\'→\'v10.28.49.1\'+49.1 changelog 条目插 49.0 上方（rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态）；站点恒 58.26；后端零改动 npm test 366/366；i18n 零新键；ethereal.css/transitions.js/心跳零触碰；' +
    '新电池 tmp-battery-fc-paneltoggle 9/9（S1 site-config 6 锚：49.1 赋值 ×1/49.0 赋值零残留/changelog 头 49.1+49.0 各 ×1/rev 占位各 ×1；S2 编辑器 9 锚；B1 展开态 266px+◂+面板 260px；B2a 过渡中段 120ms 采样 left∈(10,250)；B2b 折叠 6px+圆角方块 6px+左边线 1px+▸+面板 0px；B3 展开回 266px 零漂移；B4 折叠态建卡 T1+搜索框+gridCanvas 完好；B4b 再折叠卡不受影响按钮仍 6px；E 零异常）；' +
    'sed-634 52 swaps/42 files（带引号版本串 49.0→49.1 全量；EXCLUDE 新电池；裸 changelog 头残留 4=全有效 ===1 锚零伤害；带引号 49.0 残留 0）；舰队 634 共 54 项全绿（首跑 1 红=fc-rotate S3 rev 占位锚陈旧——47 轮记忆仪式已把真 rev 00350-6vv/00351-5mm 填进工作树，改真值锚独立复跑 36/36 销账；grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；' +
    '镜像内容验证两次构建各验一次先验后推 0 mismatch（verify#1 MODE 1 占位口径 00352-XXX ×1+00353-??? ×1；verify#2 MODE 2 终态 ' + REV1 + ' 真值 ×1+00352-XXX 零残留）；线上探针 fc-paneltoggle 634 7/7（S1a site-config live 58.26+49.1 双赋值+49.0 零残留+S1b rev live 口径 ' + REV1 + ' ×1+00353-??? 占位 ×1+S1c 编辑器 8 锚+P1a-c CDP 展开 266px→折叠 6px+▸+0px→展开回 266px/E1 零异常）；' +
    'digest ' + DIGEST + '（二次烘焙镜像=当前线上）；commit 未 push）**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00351-5mm（') !== -1 && read(f).indexOf('**当前线上 rev 00351-5mm（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.26；FC 当前 v10.28.49.0**。';
  step('versioning 58.26/49.0 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**FC v10.28.49.1（2026-10-02；站点号恒 v0.2.58.26 同轮）**：折叠按钮随菜单一起移动——用户「还有那个FC编辑页左侧菜单的折叠按钮不会在菜单折叠后一起移动」；' +
    '真身=DOM 序按钮在 .canvas-body 首、面板在次——旧相邻兄弟规则 .asset-panel.collapsed + .asset-panel-toggle 永不匹配（死规则）→折叠后按钮滞留 266px；' +
    '修法=.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; border-left: 1px solid var(--divider-line-strong); border-radius: 6px; }（:has 祖先匹配；DOM 序零改动；展开态口径逐字节不变；toggleAssetPanel() JS 零改动）；' +
    'site-config FLUIDCANVAS_VERSION 49.0→49.1+49.1 changelog 条目；后端零改动 npm test 366/366；i18n 零新键；ethereal.css/transitions.js/心跳零触碰；' +
    '电池 fc-paneltoggle 9/9+舰队 634 共 54 项全绿（1 红=fc-rotate S3 rev 占位锚陈旧改真值锚复跑销账）+冒烟 60/60+i18n 34/34；验证 ×2 先验后推 0 mismatch；线上探针 fc-paneltoggle 634 7/7；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.26；FC 当前 v10.28.49.1**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning FC 49.1 条目+新尾指针在位', read(f).indexOf('FC v10.28.49.1（2026-10-02') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.26；FC 当前 v10.28.49.1**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+两处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  const anchor49 = '](2026-10-02-fc-v1028490-viewport-rotate.md)\n';
  step('MEMORY.md 49.0 行在位', s.indexOf(anchor49) !== -1);
  const newLine =
    '- [2026-10-02 — FC v10.28.49.1 折叠按钮随菜单一起移动（rev ' + REV1 + '→' + REV2 + ' commit 未 push；站点恒 58.26）：「还有那个FC编辑页左侧菜单的折叠按钮不会在菜单折叠后一起移动」——:has 祖先匹配替代死相邻兄弟规则（按钮 DOM 首子）；电池 9/9+舰队 54 项+探针 7/7；新坑见 [2026-10-02-fc-v1028491-paneltoggle.md](2026-10-02-fc-v1028491-paneltoggle.md)\n';
  s = s.replace(anchor49, anchor49 + newLine);
  const bbAnchor = '**当前线上 rev 00351-5mm（FC v10.28.49.0 平板 4:3 视口+旋转按钮+逐设备布局；站点恒 v0.2.58.26；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（FC v10.28.49.1 折叠按钮随菜单一起移动；站点恒 v0.2.58.26；commit 未 push）；详见 [[backend-build-state]]**');
  const svAnchor = 'FC v10.28.49.0（49.0 平板 4:3 视口+旋转按钮+逐设备布局同轮；rev 00351-5mm；commit 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, 'FC v10.28.49.1（49.1 折叠按钮随菜单一起移动同轮；rev ' + REV2 + '；commit 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-10-02-fc-v1028491-paneltoggle.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（FC v10.28.49.1') !== -1 && s2.indexOf('FC v10.28.49.1（49.1 折叠按钮随菜单一起移动同轮') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-10-02-fc-v1028491-paneltoggle.md';
  const body =
    '---\n' +
    'name: 2026-10-02-fc-v1028491-paneltoggle\n' +
    'description: FC v10.28.49.1 折叠按钮随菜单一起移动轮（rev ' + REV1 + '→' + REV2 + ' 未 push；站点恒 v0.2.58.26）——:has 祖先匹配替代死相邻兄弟规则、展开态口径逐字节不变；电池 9/9+舰队 54 项+探针 7/7；DOM 序与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# FC v10.28.49.1 — 折叠按钮随菜单一起移动（2026-10-02）\n\n' +
    '用户「还有那个FC编辑页左侧菜单的折叠按钮不会在菜单折叠后一起移动」。\n\n' +
    '**真身**：fluidcanvas-editor.html 的 DOM 序=按钮 .asset-panel-toggle 是 .canvas-body 首子、面板 .asset-panel 是次子——旧规则 `.asset-panel.collapsed + .asset-panel-toggle`（相邻兄弟选择器）永不匹配（死规则）→折叠后按钮滞留 266px（left: calc(var(--asset-panel-w) + 6px)），面板却缩到 0。\n\n' +
    '**修法**：CSS 新规则 `.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; border-left: 1px solid var(--divider-line-strong); border-radius: 6px; }`——:has() 祖先匹配替代死规则；DOM 序零改动；展开态口径逐字节不变（left 266px/圆角 0 6 6 0/无左边线/◂/面板 260px）；toggleAssetPanel() JS 零改动（classList.toggle + 内文 ◂/▸ + setTimeout refitColumns 全保留）；transition: left 0.25s 已有→滑动动画免费获得。\n\n' +
    '**配套**：site-config FLUIDCANVAS_VERSION \'v10.28.49.0\'→\'v10.28.49.1\'+49.1 changelog 条目插 49.0 上方（真身+修法+站点恒 58.26+后端零改动+rev 占位）；站点恒 v0.2.58.26；后端零改动 npm test 366/366；i18n 零新键；ethereal.css/transitions.js/心跳零触碰；CSS 编辑器页内 <style> 块（页面专属）不进 inliner。\n\n' +
    '**验证全链**：新电池 tmp-battery-fc-paneltoggle 9/9（S1 site-config 6 锚/S2 编辑器 9 锚/B1 展开态 266px+◂+260px/B2a 过渡中段 120ms 采样 left∈(10,250)/B2b 折叠 6px+圆角方块 6px+左边线 1px+▸+面板 0px/B3 展开回 266px 零漂移/B4 折叠态建卡 T1+搜索框+gridCanvas 完好/B4b 再折叠卡不受影响按钮仍 6px/E 零异常）→sed-634 52 swaps/42 files（裸 changelog 头残留 4=全有效 ===1 锚；带引号 49.0 残留 0）→舰队 634 共 54 项全绿（首跑 1 红=fc-rotate S3 rev 占位锚陈旧——47 轮记忆仪式已把真 rev 00350-6vv/00351-5mm 填进工作树，占位断言恒假；改真值锚独立复跑 36/36 销账；grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34+npm test 366/366｜镜像验证两次构建各验一次先验后推 0 mismatch（verify#1 MODE 1 占位 00352-XXX ×1+00353-??? ×1；verify#2 MODE 2 终态 ' + REV1 + ' 真值 ×1+00352-XXX 零残留）｜线上探针 fc-paneltoggle 634 7/7（S1a site-config live 58.26+49.1 双赋值+49.0 零残留+changelog 头各 ×1/S1b rev live 口径 ' + REV1 + ' ×1+00353-??? 占位 ×1+REAL53 零残留/S1c 编辑器 8 锚/P1a-c CDP 展开 266px→折叠 6px+▸+面板 0px→展开回 266px 零漂移/E1 零异常）。\n' +
    'digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 滞后一部署=惯例）。\n\n' +
    '**新坑**：\n' +
    '1. 上轮记忆仪式把真 rev 填进工作树 → 下一轮舰队里 rev 占位锚（r50=0/q51=0）变陈旧恒假——每轮写 rev 断言前 grep 实测占位锚族现状（本轮 fc-rotate S3 改真值锚 00350-6vv/00351-5mm 各 ×1）。\n' +
    '2. grep -cF 模式以 -- 开头被当选项（`--asset-panel-w: 260px` 空输出）——必加 -e（58.10 老坑再证）。\n' +
    '3. 舰队输出文件名=tmp-batt-<轮>-tmp-battery-<名>.txt（runner 把 basename 逐字拼前缀）——grep 复核用完整名（先 grep -l 实测）。\n' +
    '4. grep -cF 零命中 exit 1 断 && 链（测量循环中途停）——循环体用 ; 分隔。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-10-02-fc-v1028490-viewport-rotate]]、[[2026-10-02-v025826-fc-overview-opaque]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('FC v10.28.49.1 — 折叠按钮随菜单一起移动') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
