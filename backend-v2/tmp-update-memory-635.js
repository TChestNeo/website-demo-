// tmp-update-memory-635.js — FC v10.28.49.2 折叠按钮改圆形记忆仪式：
//   ① backend-build-state.md 头旋转（00355-j7g 新 head；00353-8d2 降前身）
//   ② site-versioning-scheme.md 追加 FC 49.2 条目+当前指针（站点号恒 58.26）
//   ③ MEMORY.md 新行+两处「当前」指针更新
//   ④ 新记忆文件 2026-10-02-fc-v1028492-panelcircle.md
'use strict';
const REV1 = '00354-z2g';   // deploy#1 瞬态真 rev
const REV2 = '00355-j7g';   // deploy#2 终态真 rev
const DIGEST = 'sha256:7132a833c87b7323fd32bd7998e9412c577c6a7c8227fb656ffceed3a3dd7d7a'; // 二次烘焙 push digest（=当前线上）
const FLEETLINE = process.argv[2] || '舰队 635 共 54 项全绿（grep exit=1|💥 复核零命中）';
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
  const headAnchor = '**当前线上 rev 00353-8d2（';
  const demote = '**前身 rev 00353-8d2（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-10-02 FC v10.28.49.2 折叠按钮改圆形（补丁位 49.1→49.2；站点恒 v0.2.58.26）——用户「那个折叠按钮能不能是一个圆形的」；' +
    '真身=49.1 的折叠按钮是 22×44 门帘形（宽高不等 radius 6px 补左边线）——用户要正圆；' +
    '修法=.asset-panel-toggle 32×32 正圆 border-radius: 50% 双态恒同+border-left:none 撤除改四边完整 1px 边框；49.1 :has 折叠态规则保留但收窄为只改 left: 6px（圆形无需补左边线/覆写圆角）；left 滑动过渡 0.25s 与 49.1 同款；' +
    'site-config FLUIDCANVAS_VERSION \'v10.28.49.1\'→\'v10.28.49.2\'+49.2 changelog 条目插 49.1 上方（rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态）；站点恒 58.26；后端零改动 npm test 366/366；i18n 零新键；ethereal.css/transitions.js/心跳零触碰；' +
    '电池 tmp-battery-fc-paneltoggle 原位改锚 9/9（S1 site-config 49.2 在位+49.1 零残留+changelog 头 49.2/49.1/49.0 各 ×1+rev 前缀锚 00352-/00353-/00354-/00355- 各 ×1（前缀口径填真值后恒真）；S2 编辑器 12 锚（:has 收窄 { left: 6px; } ×1/旧圆角方块+旧基态+死规则零残留/32×32 正圆/49.2+49.1 注释）；B1 展开态 266px 正圆 32×32+◂+260px；B2a 过渡中段采样；B2b 折叠 6px 仍正圆+▸+0px；B3 展开回 266px；B4/B4b 功能完好；E 零异常）；' +
    'sed-635 56 swaps/43 files（带引号版本串 49.1→49.2 全量；裸 changelog 头锚 49.1/49.0 残留 2/4=全有效；带引号 49.1 残留 0）；' + FLEETLINE + '；' +
    '镜像内容验证两次构建各验一次先验后推 0 mismatch（verify#1 MODE 1 占位 00354-XXX ×1+00355-??? ×1；verify#2 MODE 2 终态 ' + REV1 + ' 真值 ×1+00354-XXX 零残留）；线上探针 fc-panelcircle 635 7/7（S1a site-config live 58.26+49.2 双赋值+49.1 零残留+S1b rev live 口径 ' + REV1 + ' ×1+00355-??? 占位 ×1+S1c 编辑器 12 锚+P1a-c CDP 展开 266px 正圆→折叠 6px 仍正圆+▸+0px→展开回 266px/E1 零异常）；' +
    'digest ' + DIGEST + '（二次烘焙镜像=当前线上）；commit 未 push）**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00353-8d2（') !== -1 && read(f).indexOf('**当前线上 rev 00353-8d2（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.26；FC 当前 v10.28.49.1**。';
  step('versioning 58.26/49.1 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**FC v10.28.49.2（2026-10-02；站点号恒 v0.2.58.26 同轮）**：折叠按钮改圆形——用户「那个折叠按钮能不能是一个圆形的」；' +
    '真身=49.1 的折叠按钮 22×44 门帘形（宽高不等 radius 6px 补左边线）；' +
    '修法=.asset-panel-toggle 32×32 正圆 border-radius: 50% 双态恒同+四边完整 1px 边框；49.1 :has 折叠态规则保留但收窄为只改 left: 6px；left 滑动过渡与 49.1 同款零改动；' +
    'site-config FLUIDCANVAS_VERSION 49.1→49.2+49.2 changelog 条目；后端零改动 npm test 366/366；i18n 零新键；ethereal.css/transitions.js/心跳零触碰；' +
    '电池 fc-paneltoggle 原位改锚 9/9+sed-635 56 swaps/43 files+舰队 635 共 54 项全绿（首跑 1 红=micro-v056 B5 活动流首卡 href=null 与 FC CSS 无关——独立复跑 26/26 销账；grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；验证 ×2 先验后推 0 mismatch；线上探针 fc-panelcircle 635 7/7；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.26；FC 当前 v10.28.49.2**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning FC 49.2 条目+新尾指针在位', read(f).indexOf('FC v10.28.49.2（2026-10-02') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.26；FC 当前 v10.28.49.2**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+两处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  const anchor49 = '](2026-10-02-fc-v1028491-paneltoggle.md)\n';
  step('MEMORY.md 49.1 行在位', s.indexOf(anchor49) !== -1);
  const newLine =
    '- [2026-10-02 — FC v10.28.49.2 折叠按钮改圆形（rev ' + REV1 + '→' + REV2 + ' commit 未 push；站点恒 58.26）：32×32 正圆双态恒同、:has 折叠态规则收窄只改 left；电池 9/9+舰队 54 项+探针 7/7](2026-10-02-fc-v1028492-panelcircle.md)\n';
  s = s.replace(anchor49, anchor49 + newLine);
  const bbAnchor = '**当前线上 rev 00353-8d2（FC v10.28.49.1 折叠按钮随菜单一起移动；站点恒 v0.2.58.26；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（FC v10.28.49.2 折叠按钮改圆形；站点恒 v0.2.58.26；commit 未 push）；详见 [[backend-build-state]]**');
  const svAnchor = 'FC v10.28.49.1（49.1 折叠按钮随菜单一起移动同轮；rev 00353-8d2；commit 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, 'FC v10.28.49.2（49.2 折叠按钮改圆形同轮；rev ' + REV2 + '；commit 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-10-02-fc-v1028492-panelcircle.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（FC v10.28.49.2') !== -1 && s2.indexOf('FC v10.28.49.2（49.2 折叠按钮改圆形同轮') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-10-02-fc-v1028492-panelcircle.md';
  const body =
    '---\n' +
    'name: 2026-10-02-fc-v1028492-panelcircle\n' +
    'description: FC v10.28.49.2 折叠按钮改圆形轮（rev ' + REV1 + '→' + REV2 + ' 未 push；站点恒 v0.2.58.26）——32×32 正圆 border-radius 50% 双态恒同、:has 折叠态规则收窄只改 left；电池 9/9+舰队 54 项+探针 7/7；rev 前缀锚口径与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# FC v10.28.49.2 — 折叠按钮改圆形（2026-10-02）\n\n' +
    '用户「那个折叠按钮能不能是一个圆形的」（49.1 折叠随动轮的直接后续）。\n\n' +
    '**真身**：49.1 的 .asset-panel-toggle 是 22×44 门帘形（宽高不等、border-radius: 6px 圆角方块、border-left: none 展开态补边线）——用户要正圆。\n\n' +
    '**修法**：基态规则改 `width: 32px; height: 32px; border-radius: 50%;`（双态恒同）+ 四边完整 1px 边框（border-left: none 撤除）；49.1 的 :has 折叠态规则保留但收窄为只改 `{ left: 6px; }`（圆形无需补左边线/覆写圆角）；left 滑动过渡 0.25s 与 49.1 同款零改动；DOM 序零改动；toggleAssetPanel() JS 零改动。\n\n' +
    '**配套**：site-config FLUIDCANVAS_VERSION \'v10.28.49.1\'→\'v10.28.49.2\'+49.2 changelog 条目插 49.1 上方；站点恒 v0.2.58.26；后端零改动 npm test 366/366；i18n 零新键；ethereal.css/transitions.js/心跳零触碰；CSS 编辑器页内 <style> 块不进 inliner。\n\n' +
    '**验证全链**：电池 tmp-battery-fc-paneltoggle 原位改锚 9/9（S1 site-config 49.2 在位+49.1 赋值零残留+changelog 头 49.2/49.1/49.0 各 ×1+rev 前缀锚 00352-/00353-/00354-/00355- 各 ×1；S2 编辑器 12 锚：:has 收窄 { left: 6px; } ×1/旧圆角方块规则+旧 border-left:none 基态+死相邻兄弟规则零残留/32×32 正圆锚/展开态口径锚/49.2+49.1 注释；B1 展开态 266px 正圆 32×32+◂+260px；B2a 过渡中段 120ms 采样；B2b 折叠 6px 仍正圆 32×32+▸+面板 0px；B3 展开回 266px 零漂移；B4/B4b 功能完好；E 零异常）→sed-635 56 swaps/43 files（裸 changelog 头 49.1/49.0 残留 2/4=全有效；带引号 49.1 残留 0）→舰队 635 共 54 项全绿（首跑 1 红=micro-v056 B5/B5b/B5c 活动流首卡 href=null——dashboard 罐头云 seed 与 FC 编辑器 CSS 无关，独立复跑 26/26 销账；grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34+npm test 366/366｜镜像验证两次构建各验一次先验后推 0 mismatch（verify#1 MODE 1 占位 00354-XXX ×1+00355-??? ×1；verify#2 MODE 2 终态 ' + REV1 + ' 真值 ×1+00354-XXX 零残留）｜线上探针 fc-panelcircle 635 7/7（S1a site-config live 58.26+49.2 双赋值+49.1 零残留+changelog 头 49.2/49.1/49.0 各 ×1/S1b rev live 口径 ' + REV1 + ' ×1+00355-??? 占位 ×1+' + REV2 + ' 零残留/S1c 编辑器 12 锚/P1a-c CDP 展开 266px 正圆→折叠 6px 仍正圆+▸+面板 0px→展开回 266px 零漂移/E1 零异常）。\n' +
    'digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 滞后一部署=惯例）。\n\n' +
    '**新坑**：\n' +
    '1. rev 占位锚在记忆仪式填真值后恒假（48/49 轮连证）——本轮起电池 rev 锚改**前缀口径**（sc(\'rev 00354-\')===1）：填真值后计数不变恒真，杀此坑于形；fc-rotate S3 旧真值锚 00350-6vv/00351-5mm 永不变化不受影响。\n' +
    '2. sed 会把电池标签文本里的裸 49.x 一并翻掉（fc-rotate S3 标签 49.1→49.2、micro-v056 B6b 标签 39.0 保留但断言语义随 sed 走）——标签与断言的一致性以 sed 后实测为准。\n' +
    '3. Dockerfile 在仓库根不在 backend-v2/（58.9 老坑再证）——docker build 经 PowerShell 从仓库根用默认 context . 无 -f。\n' +
    '4. 容器注册表认证过期推不动（58.17 老坑再证）——gcloud auth configure-docker 重配即复活（credHelpers 已注册仍须重跑）。\n' +
    '5. MEMORY.md 超 24.4KB 限制（71 行载入 68）——新索引行保持 <200 字。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-10-02-fc-v1028491-paneltoggle]]、[[2026-10-02-fc-v1028490-viewport-rotate]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('FC v10.28.49.2 — 折叠按钮改圆形') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
