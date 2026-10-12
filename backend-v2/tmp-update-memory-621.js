// tmp-update-memory-621.js — v0.2.58.15 轮记忆仪式：
// ① backend-build-state.md 头旋转（00324-xr2 降前身、00326-j6m 新 head）② site-versioning-scheme.md 链条
// 追加 58.15 条目+当前标记更新 ③ MEMORY.md 新索引行+两条线内「当前」更新 ④ 新记忆文件 2026-09-28-v025815-lvpill-hover.md
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

// ---------- ① backend-build-state.md ----------
let p = MEM + 'backend-build-state.md';
let lines = fs.readFileSync(p, 'utf8').split('\n');
const HEAD = `**当前线上 rev 00326-j6m（2026-09-28 v0.2.58.15 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡——用户「那么能不能添加一个功能就是当滑鼠靠近那个折叠的药丸时药丸会变大然后 向右滑出 一个卡片完整的显示等级信息和经验条」；真身=折叠态侧栏（72px）等级徽章只有 48×116 药丸（LV 标签+水杯+号码），等级/称号/经验条在展开态 .mn-lv-normal——折叠时想看必须展开侧栏（3 步）；修法：药丸悬停 scale(1.12)+右侧滑出 .mn-lv-hovercard（position:fixed 挂 body 逃侧栏 overflow-x:hidden+用户卡 overflow:hidden 双裁剪、z-index 150、内容=每次 show 从活的 .mn-lv-normal clone 最新 innerHTML 零陈旧、200ms 宽限防 10px 缝隙闪烁、右溢翻左+上下钳制、触屏门控 matchMedia(hover+fine)+CSS @media 同款双保险触屏/平板零行为）；展开态原徽章可见零卡片；sidebar.js 新 initLevelHover（renderSidebar 尾部每轮重挂监听+scroll/setCollapsed/resize 收卡）；药丸/水杯/水位/两浪 58.14 全零改动；40 页内联块全量刷新+编辑器页手工同款（inliner SKIP_CSS_REFRESH 豁免）；FC 恒 v10.28.47.4、后端零改动、i18n 零新键；电池 lvpill 22/22（重写 58.15 口径：F1 rev 00325- 前缀+终态注记 00326-j6m+F3 半角分号锚+S8 悬停开卡 cardLeft===pillURight+10（getBoundingClientRect 同步返回未缩放 rect 需按 transform 外扩反算）/scale 1.12/S9 驻留/S10 收卡/S11 重渲染新鲜（Chrome 静止指针下 DOM 替换合成 mouseenter 自动重开卡→新鲜度守卫）/S12 折叠切换收卡/S13 floating/S14 展开零卡+E 零异常）+舰队 41 套全绿（grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；镜像内容验证 265/265（两次构建各验一次、推送前先验后推）；线上探针 lvpill 14/14（S1 58.15+rev 00325-555 烘焙文本×2+00326-XXX 占位滞后注记+S2/S3 悬停卡块+P5 悬停开卡+P6 驻留+P7 收卡+P8 重渲染新鲜+P9 展开零卡+触屏门控+E 零异常）；digest sha256:06ce8c0619f9dea3fa7e9eeaf4659a31b5f779030c44ced76e3a1468e47175e6（二次烘焙镜像=当前线上）；commit a5125be 未 push；新坑：Docker Desktop 未运行 npipe 连不上（先启引擎+轮询命名管道 Test-Path）、grep -l 管道复核 $? 读的是 head 非 grep（改 grep -c 计数）、CDP 悬停必须先 move(5,5) 再移目标中心否则 mouseenter 不触发、Chrome 静止指针下 DOM 替换合成 mouseenter 自动重开卡（S11/P8 新鲜度守卫口径））**`;
const i12 = lines.findIndex((l) => l.startsWith('**当前线上 rev 00324-xr2'));
if (i12 < 0) throw new Error('backend-build-state head line not found');
lines[i12] = lines[i12].replace('**当前线上 rev 00324-xr2', '**前身 rev 00324-xr2');
lines.splice(i12, 0, HEAD);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('modified: 2026-09-28T00:00:00.000Z')) { lines[i] = lines[i].replace('modified: 2026-09-28T00:00:00.000Z', 'modified: 2026-09-28T12:00:00.000Z'); break; }
}
fs.writeFileSync(p, lines.join('\n'));
console.log('① backend-build-state.md 头旋转完成');

// ---------- ② site-versioning-scheme.md ----------
p = MEM + 'site-versioning-scheme.md';
let s = fs.readFileSync(p, 'utf8');
const MARKER = '**站点号当前 v0.2.58.14；FC 当前 v10.28.47.4**';
if (s.indexOf(MARKER) < 0) throw new Error('site-versioning marker not found');
const ENTRY = `2026-09-28 v0.2.58.15 = 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡（补丁位 14→15·调整轮——用户「那么能不能添加一个功能就是当滑鼠靠近那个折叠的药丸时药丸会变大然后 向右滑出 一个卡片完整的显示等级信息和经验条」；真身=折叠态侧栏（72px）等级徽章只有 48×116 药丸，等级/称号/经验条在展开态 .mn-lv-normal——折叠时想看必须展开侧栏（3 步）；修法：药丸悬停 scale(1.12)+右侧滑出 .mn-lv-hovercard（position:fixed 挂 body 逃侧栏 overflow-x:hidden+用户卡 overflow:hidden 双裁剪、z-index 150、内容=每次 show 从活的 .mn-lv-normal clone 最新 innerHTML 零陈旧、200ms 宽限防 10px 缝隙闪烁、右溢翻左+上下钳制、触屏门控 matchMedia(hover+fine)+CSS @media 同款双保险触屏/平板零行为）；展开态原徽章可见零卡片；sidebar.js 新 initLevelHover（renderSidebar 尾部每轮重挂监听+scroll/setCollapsed/resize 收卡）；药丸/水杯/水位/两浪 58.14 全零改动；40 页内联块全量刷新+编辑器页手工同款（inliner SKIP_CSS_REFRESH 豁免）；FC 恒 v10.28.47.4、后端零改动、i18n 零新键；电池 lvpill 22/22+舰队 41 套全绿（grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；镜像内容验证 265/265（两次构建各验一次、推送前先验后推）；线上探针 lvpill 14/14；digest sha256:06ce8c06…；commit a5125be 未 push，rev 00325-555→00326-j6m（首部署瞬态 00325-555、二次烘焙重部署终态 00326-j6m——live 文本 00325-555 滞后一部署=58.14 同款下轮烘焙））。`;
s = s.replace(MARKER, ENTRY + '**站点号当前 v0.2.58.15；FC 当前 v10.28.47.4**');
s = s.replace('modified: 2026-09-27T17:15:00.048Z', 'modified: 2026-09-28T12:00:00.000Z');
fs.writeFileSync(p, s);
console.log('② site-versioning-scheme.md 58.15 条目+当前标记完成');

// ---------- ③ MEMORY.md ----------
p = MEM + 'MEMORY.md';
s = fs.readFileSync(p, 'utf8');
const NEW_LINE = `- [2026-09-28 — v0.2.58.15 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡（rev 00325-555→00326-j6m commit a5125be 未 push）：「那么能不能添加一个功能就是当滑鼠靠近那个折叠的药丸时药丸会变大然后 向右滑出 一个卡片完整的显示等级信息和经验条」——hover 药丸 scale(1.12)+fixed 挂 body 悬停卡 z150 每次 show 克隆最新 innerHTML+200ms 宽限+matchMedia(hover+fine)+CSS @media 双门控触屏零行为+展开态零卡片；电池 22/22+舰队 41+冒烟 60/60+i18n 34/34+verify 265/265+探针 14/14；新坑：CDP 悬停必先 move(5,5) 再移目标中心否则 mouseenter 不触发、Chrome 静止指针下 DOM 替换合成 mouseenter 自动重开卡（S11/P8 新鲜度守卫）、Docker Desktop 未运行 npipe 连不上（先启引擎+轮询命名管道）、grep -l 复核 $? 读的是 head 非 grep](2026-09-28-v025815-lvpill-hover.md)`;
const ANCHOR = '](2026-09-28-v025814-lightwave.md)';
const pos = s.indexOf(ANCHOR);
if (pos < 0) throw new Error('MEMORY.md 58.14 anchor not found');
const after = s.indexOf('\n', pos);
s = s.slice(0, after + 1) + NEW_LINE + '\n' + s.slice(after + 1);
// backend-build-state 索引行内当前更新
const B1 = '**当前线上 rev 00324-xr2（v0.2.58.14 等级水杯慢浪改浅色；FC 恒 v10.28.47.4；commit 95be585 未 push）';
if (s.indexOf(B1) < 0) throw new Error('MEMORY.md backend-build-state 当前 anchor not found');
s = s.replace(B1, '**当前线上 rev 00326-j6m（v0.2.58.15 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡；FC 恒 v10.28.47.4；commit a5125be 未 push）');
// site-versioning 索引行内当前更新
const B2 = '**当前：站点号 v0.2.58.14（58.14 慢浪改浅色；rev 00324-xr2；commit 95be585 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**';
if (s.indexOf(B2) < 0) throw new Error('MEMORY.md site-versioning 当前 anchor not found');
s = s.replace(B2, '**当前：站点号 v0.2.58.15（58.15 药丸悬停放大+右侧滑出等级信息卡；rev 00326-j6m；commit a5125be 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**');
fs.writeFileSync(p, s);
console.log('③ MEMORY.md 新索引行+两处当前更新完成');

// ---------- ④ 新记忆文件 ----------
const NEWMEM = `---
name: 2026-09-28-v025815-lvpill-hover
description: v0.2.58.15 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡（用户「当滑鼠靠近那个折叠的药丸时药丸会变大然后 向右滑出 一个卡片完整的显示等级信息和经验条」；rev 00325-555→00326-j6m commit a5125be 未 push；新坑：CDP 悬停先 move(5,5)、合成 mouseenter 重开卡、Docker 引擎未运行）
metadata:
  type: project
---

# v0.2.58.15 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡（rev 00325-555→00326-j6m；commit a5125be 未 push；digest sha256:06ce8c06）

用户「那么能不能添加一个功能就是当滑鼠靠近那个折叠的药丸时药丸会变大然后 向右滑出 一个卡片完整的显示等级信息和经验条」——鼠标悬停折叠态药丸 → 药丸 scale(1.12) + 右侧滑出等级信息卡（Lv.x · 称号 + XP 文本 + 经验条 = 展开徽章 .mn-lv-normal 同款内容），移开收卡；触屏/平板零行为；展开态零卡片。

## 修法

- **卡片必须 position:fixed 挂 body**：侧栏 overflow-x:hidden + 用户卡 overflow:hidden 双裁剪祖先会吃掉任何定位后代；z-index 150（侧栏 50/55 之上、tooltip 200 之下）。
- **内容新鲜**：每次 show 从活的 .mn-lv-normal 读 innerHTML 克隆（renderSidebar 每次 mn:xp-changed/i18n 重渲染会替换徽章节点）；initLevelHover 在 renderSidebar 尾部每轮重挂监听；renderSidebar/setCollapsed/resize/侧栏 scroll 都先收卡。
- **防缝隙闪烁**：badge 与卡片间 10px 缝隙——mouseleave 后 200ms 宽限调度收卡，卡片自身 mouseenter 取消调度。
- **定位**：left = 药丸右缘 + 10；右溢翻左 max(16, pillLeft - cw - 10)；top 垂直居中后钳 [8, vpH - ch - 8]；**先设 left/top 再加 .active**（opacity+translateX 过渡滑出）；测量用 offsetWidth/offsetHeight（transform 免疫）。
- **触屏双门控**：JS matchMedia('(hover: hover) and (pointer: fine)') 缓存（false → 不挂监听）+ CSS @media 包裹全部悬停规则——触屏/平板零行为。
- 药丸/水杯/水位/两浪 58.14 全零改动；FC 恒 v10.28.47.4、后端零改动、i18n 零新键（克隆既有 DOM 文本）。

## 验证链

电池 lvpill 22/22（F1/F2/F3 静态 + S8-S14 悬停全链：开卡几何 cardLeft===pillURight+10、scale 1.12、驻留、收卡、重渲染新鲜、折叠切换收卡、floating、展开零卡 + E 零异常）+舰队 41 套全绿（grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；镜像内容验证 265/265（两次构建各验一次、推送前先验后推）；线上探针 lvpill 14/14。

## 新坑四连

1. **CDP 悬停必须先 move(5,5) 再移目标中心**：直接 mouseMoved 到元素中心不触发 mouseenter——先移开（5,5）再移入，每次移动后 sleep(80)。
2. **Chrome 静止指针下 DOM 替换会合成 mouseenter**：addXP 后 renderSidebar 替换徽章节点，鼠标仍在徽章上 → 浏览器自动重开悬停卡。断言口径改为新鲜度守卫：若开则内容必新鲜（新 XP/百分比），陈旧即真红（S11/P8）。
3. **getBoundingClientRect 同步返回未缩放 rect**：scale 类刚加时 rect 不反映 transform；悬停中 rect 含缩放（每边外扩 (1.12-1)×48/2 ≈ 2.88px）——电池按 transform 矩阵反算未缩放右缘 pillURight 再断言 cardLeft = pillURight + 10。
4. **Docker Desktop 未运行 npipe 连不上**：\`docker build\` 报 failed to connect to npipe——先 Start-Process Docker Desktop.exe（AppData\\Local\\Programs\\DockerDesktop），再轮询 Test-Path '\\\\.\\pipe\\dockerDesktopLinuxEngine'（60×5s 内就绪）。
5. （顺带）grep -l 管道复核：\`grep -l pat files | head; echo $?\` 读的是 head 的退出码不是 grep——复核用 \`grep -c\` 计数输出。

## 相关

[[site-versioning-scheme]] [[backend-build-state]] [[2026-09-28-v025814-lightwave]] [[2026-09-28-v025813-dualwave]]
`;
fs.writeFileSync(MEM + '2026-09-28-v025815-lvpill-hover.md', NEWMEM);
console.log('④ 新记忆文件 2026-09-28-v025815-lvpill-hover.md 完成');
console.log('记忆仪式全完成');
