// tmp-update-memory-611.js — v0.2.58.7 轮记忆仪式：
// ① backend-build-state.md 头旋转（00308-6xx 降前身、00310-pbk 新 head）② site-versioning-scheme.md 链条
// 追加 58.7 条目+当前标记更新 ③ MEMORY.md 新索引行+两条线内「当前」更新 ④ 新记忆文件 2026-09-26-v02587-pillwave2x.md
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

// ---------- ① backend-build-state.md ----------
let p = MEM + 'backend-build-state.md';
let lines = fs.readFileSync(p, 'utf8').split('\n');
const HEAD = `**当前线上 rev 00310-pbk（2026-09-26 v0.2.58.7 折叠侧栏等级药丸与水波全翻倍——用户「那个波浪能不能大2倍啊？」+「还有那个药丸能不能大1倍啊」（两问钦定：波浪全翻倍 ×2·药丸长宽都 ×2）；真身=58.6 药丸/水杯再放大——药丸 32×58、水杯胶囊 28×42、波浪 viewBox 20×16 波长 20px 振幅 8px；修法：药丸 32×58→64×116、水杯胶囊 28×42→56×84（border-radius:999px 不变、LV 号码居中不变、杯内宽 24→52，LV 标签 7→14px、LV 号码 14→28px 同步放大；药丸 64 宽 > 用户卡内容 46px——折叠 72px 列与最窄 floating 64px 列均溢出用户卡各 4px/边、仍收在侧栏列内零越界=用户钦定取舍）；波浪全翻倍——mask SVG viewBox 20×16→40×32（波长 20→40+振幅 8→16 双翻倍）、波浪带高 16px→32px、两波顶线随半高同步（calc(40% - 8px)→-16px / -8px→-16px）、无缝循环 translateX 20px→40px 恰好一个波长、strip 恒 300%（左右余量=杯内宽 52px ≥ 40px 波长，循环末帧不露缺口）；两层结构/两速 1.6s/2.2s 相位漂移/水位从底往上灌/0.5s 过渡全保持；40 页内联块全量刷新+编辑器页手工同款（inliner SKIP_CSS_REFRESH 豁免）；FC 恒 v10.28.47.4、后端零改动、i18n 零新键；电池 fc-lvpill 14/14（重写为 58.7 全翻倍口径）+舰队 41 套全绿（grep exit=1|💥 复核零命中；micro-v056 flake 独立复跑 21/21 销账）+冒烟 60/60+i18n 34/34；镜像内容验证 105/105（推送前先验后推）；线上探针 lvwater 10/10（S1 58.7+rev 00309-jbl live 文本滞后注记/S2 药丸水杯全翻倍件套在位旧 32×58/28×42/20×16/16px 波形/平移 20px/-8px 零残留/S3 index 内联同步/P1 折叠 mask 40px 32px+32px 波形+156px strip+两速/P2 几何 64×116+56×84+头像 32×32 零挤压+inMod false=钦定取舍/P3 满级 100%+LV12/P4 floating 零越界/E 零异常）；digest sha256:28558db34d3a604b842f3a5f808e4b99aa0571d9d8a1fd2f8209e49e10d0ee6e；commit 未 push；**新坑：rev 编号撞车**——58.6 轮从未部署（revisions 无 00309）致 sed-610 编号预估错位，58.7 轮首部署瞬态 00309-jbl 随即同轮重部署终态 00310-pbk（live changelog 文本滞后一部署仍示 00309-jbl、repo 已记 00310-pbk 下轮烘焙）；sed EXCLUDE 正斜杠路径 vs path.relative 反斜杠失配→三 sed 脚本被自扫头部错乱已手工重写）**`;
const i12 = lines.findIndex((l) => l.startsWith('**当前线上 rev 00308-6xx'));
if (i12 < 0) throw new Error('backend-build-state head line not found');
lines[i12] = lines[i12].replace('**当前线上 rev 00308-6xx', '**前身 rev 00308-6xx');
lines.splice(i12, 0, HEAD);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('modified: 2026-09-26T15:50:00.000Z')) { lines[i] = lines[i].replace('modified: 2026-09-26T15:50:00.000Z', 'modified: 2026-09-26T16:20:00.000Z'); break; }
}
fs.writeFileSync(p, lines.join('\n'));
console.log('① backend-build-state.md 头旋转完成');

// ---------- ② site-versioning-scheme.md ----------
p = MEM + 'site-versioning-scheme.md';
let s = fs.readFileSync(p, 'utf8');
const MARKER = '**站点号当前 v0.2.58.5；FC 当前 v10.28.47.4**。';
if (s.indexOf(MARKER) < 0) throw new Error('site-versioning marker not found');
const ENTRY = `2026-09-26 v0.2.58.7 = 折叠侧栏等级药丸与水波全翻倍（补丁位 6→7·调整轮——用户「那个波浪能不能大2倍啊？」+「还有那个药丸能不能大1倍啊」（两问钦定：波浪全翻倍 ×2·药丸长宽都 ×2）；58.6 药丸/水杯再放大——药丸 32×58→64×116、水杯胶囊 28×42→56×84（border-radius:999px 不变、LV 号码居中不变、杯内宽 24→52，LV 标签 7→14px、LV 号码 14→28px 同步放大；药丸 64 宽 > 用户卡内容 46px——折叠 72px 列与最窄 floating 64px 列均溢出用户卡各 4px/边、仍收在侧栏列内零越界=用户钦定取舍）；波浪全翻倍——mask SVG viewBox 20×16→40×32（波长 20→40+振幅 8→16 双翻倍）、波浪带高 16px→32px、两波顶线随半高同步（calc(40% - 8px)→-16px / -8px→-16px）、无缝循环 translateX 20px→40px 恰好一个波长、strip 恒 300%（左右余量=杯内宽 52px ≥ 40px 波长，循环末帧不露缺口）；两层结构/两速 1.6s/2.2s 相位漂移/水位从底往上灌/0.5s 过渡全保持；40 页内联块全量刷新+编辑器页手工同款；FC 恒 v10.28.47.4、后端零改动、i18n 零新键；电池 fc-lvpill 14/14+舰队 41 套全绿（micro-v056 flake 独立复跑 21/21 销账）+冒烟 60/60+i18n 34/34；镜像内容验证 105/105；线上探针 lvwater 10/10；digest sha256:28558db3…；commit 未 push，rev 00310-pbk（同轮首部署瞬态 00309-jbl 已取代——58.6 未上线致编号预估错位））。`;
s = s.replace(MARKER, ENTRY + '**站点号当前 v0.2.58.7；FC 当前 v10.28.47.4**。');
s = s.replace('modified: 2026-09-26T10:16:16.240Z', 'modified: 2026-09-26T16:20:00.000Z');
fs.writeFileSync(p, s);
console.log('② site-versioning-scheme.md 58.7 条目+当前标记完成');

// ---------- ③ MEMORY.md ----------
p = MEM + 'MEMORY.md';
s = fs.readFileSync(p, 'utf8');
const NEW_LINE = `- [2026-09-26 — v0.2.58.7 折叠侧栏等级药丸与水波全翻倍（rev 00310-pbk commit 未 push；digest 28558db3）：用户「那个波浪能不能大2倍啊？还有那个药丸能不能大1倍啊」——两问钦定波浪全翻倍 ×2（viewBox 20×16→40×32 波长 20→40+振幅 8→16+波带高 16→32px）+药丸长宽都 ×2（药丸 32×58→64×116、水杯胶囊 28×42→56×84、LV 标签 7→14px、号码 14→28px）；药丸 64 宽>用户卡内容 46px 溢出各 4px/边仍收在侧栏列内=钦定取舍；电池 fc-lvpill 14/14+舰队 41 套全绿（micro-v056 flake 复跑 21/21 销账）+冒烟 60/60+i18n 34/34；镜像验证 105/105（先验后推）；线上探针 lvwater 10/10；**新坑：rev 编号撞车（58.6 从未部署→sed-610 误扫 00309-→00310-→首部署瞬态 00309-jbl→同轮重部署终态 00310-pbk，live 文本滞后一部署下轮烘焙；sed EXCLUDE 正斜杠 vs path.relative 反斜杠失配→三脚本被自扫已手工重写）**](2026-09-26-v02587-pillwave2x.md)`;
const ANCHOR = '](2026-09-26-v02585-pillcup.md)';
const pos = s.indexOf(ANCHOR);
if (pos < 0) throw new Error('MEMORY.md 58.5 anchor not found');
const after = s.indexOf('\n', pos);
s = s.slice(0, after + 1) + NEW_LINE + '\n' + s.slice(after + 1);
// backend-build-state 索引行内当前更新
const B1 = '**当前线上 rev 00308-6xx（v0.2.58.5 折叠侧栏等级水杯改药丸形+波浪加大；FC 恒 v10.28.47.4；commit ab74c2f 未 push）';
if (s.indexOf(B1) < 0) throw new Error('MEMORY.md backend-build-state 当前 anchor not found');
s = s.replace(B1, '**当前线上 rev 00310-pbk（v0.2.58.7 折叠侧栏等级药丸与水波全翻倍；FC 恒 v10.28.47.4；commit 未 push）');
// site-versioning 索引行内当前更新
const B2 = '**当前：站点号 v0.2.58.5（折叠侧栏等级水杯改药丸形+波浪加大；rev 00308-6xx；commit ab74c2f 未 push）';
if (s.indexOf(B2) < 0) throw new Error('MEMORY.md site-versioning 当前 anchor not found');
s = s.replace(B2, '**当前：站点号 v0.2.58.7（折叠侧栏等级药丸与水波全翻倍；rev 00310-pbk；commit 未 push）');
fs.writeFileSync(p, s);
console.log('③ MEMORY.md 新索引行+两处当前更新完成');

// ---------- ④ 新记忆文件 ----------
const NEWMEM = `---
name: 2026-09-26-v02587-pillwave2x
description: v0.2.58.7 折叠侧栏等级药丸与水波全翻倍（用户「那个波浪能不能大2倍啊？还有那个药丸能不能大1倍啊」——波浪全翻倍 ×2+药丸长宽都 ×2；rev 00310-pbk；新坑：rev 编号撞车+sed EXCLUDE 路径失配）
metadata:
  type: project
---

# v0.2.58.7 折叠侧栏等级药丸与水波全翻倍（rev 00310-pbk；commit 未 push；digest sha256:28558db3）

用户「那个波浪能不能大2倍啊？还有那个药丸能不能大1倍啊」——一问钦定两答：**波浪全翻倍 ×2**、**药丸长宽都 ×2**。

## 修法（纯 CSS 零 JS，sidebar.js 零改动）

- 药丸 32×58→**64×116**、水杯胶囊 28×42→**56×84**（border-radius:999px 不变、LV 号码居中不变、杯内宽 24→52；LV 标签 7→14px、LV 号码 14→28px 同步放大）。
- **钦定取舍**：药丸 64 宽 > 用户卡内容 46px——折叠 72px 列与最窄 floating 64px 列均溢出用户卡各 4px/边、仍收在侧栏列内零越界（代码注释+changelog+电池+探针四处口径一致；电池 S3/S6 断言 inMod false + inSidebar true）。
- 波浪全翻倍：mask SVG viewBox 20×16→40×32（波长 20→40+振幅 8→16 双翻倍）、波浪带高 16px→32px、两波顶线随半高同步（calc(40% - 8px)→-16px / -8px→-16px）、无缝循环 translateX 20px→40px 恰好一个波长、strip 恒 300%（左右余量=杯内宽 52px ≥ 40px 波长，循环末帧不露缺口）。
- 两层结构/两速 1.6s/2.2s 相位漂移/水位从底往上灌/0.5s 过渡全保持；40 页内联块全量刷新+编辑器页手工同款（inliner SKIP_CSS_REFRESH 豁免）；FC 恒 v10.28.47.4、后端零改动、i18n 零新键。

## 验证链

电池 fc-lvpill 14/14（重写 58.7 全翻倍口径）+舰队 41 套全绿（grep exit=1|💥 复核零命中；micro-v056 flake 独立复跑 21/21 销账）+冒烟 60/60+i18n 34/34；镜像内容验证 105/105（推送前先验后推）；线上探针 lvwater 10/10。

## 新坑两连（本轮主坑：rev 编号撞车）

1. **rev 编号撞车**：58.6 轮（sed-609/probe-609 文件族）从未部署（revisions list 无 00309）——sed-610 按「58.6 已上线」误估扫 00309-→00310-；实部署首发瞬态 rev=00309-jbl，随即同轮重部署终态 rev=**00310-pbk**。repo 全量回扫 00310-、site-config 填 00310-pbk（58.6 changelog 改「未独立上线，随 58.7 合并上线 rev 00310-pbk」）；live changelog 文本滞后一部署仍示 00309-jbl（探针 S1 按 live 实况断言+注记，下轮部署自动烘焙 00310-pbk）。教训：sed 扫 rev 锚前先 \`gcloud run revisions list\` 核对编号归属；每轮部署可能产生多个 revision，以终态服务 revision 为准。
2. **sed EXCLUDE 路径失配**：EXCLUDE 用正斜杠字符串 vs path.relative 返回反斜杠——全部失效，sed 脚本被自扫（头部/规则文字错乱）→sed-610/611/612 三脚本已手工重写修正；排除路径必须 path.join 生成。
3. （顺带）git show --stat 管 Select-Object -First 15 截断——查提交文件清单用 \`git show --name-only\`；上轮 commit ab74c2f 文件口径=docs/**+tmp-battery-*+tmp-probe-*+run-fleet+sed（不含 deploy/verify/memory 脚本与 batt txt）。

## 相关

[[site-versioning-scheme]] [[backend-build-state]] [[2026-09-26-v02586-pillwave2x-orphan]]（58.6 轮文件族未提交未上线档案）
`;
fs.writeFileSync(MEM + '2026-09-26-v02587-pillwave2x.md', NEWMEM);
console.log('④ 新记忆文件 2026-09-26-v02587-pillwave2x.md 完成');
console.log('记忆仪式全完成');
