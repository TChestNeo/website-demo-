// tmp-memory-40.js — 40.0 轮记忆仪式：site-versioning-scheme 尾 + backend-build-state 头
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

// ── 1) site-versioning-scheme.md：39.1 尾锚后追加 40.0 轮 + 尾标更新 ──
const vs = fs.readFileSync(M + 'site-versioning-scheme.md', 'utf8');
const vsAnchor = 'commit 03d1501 未 push。**站点号当前 v0.2.58.0；FC 当前 v10.28.39.1**。';
if ((vs.split(vsAnchor).length - 1) !== 1) { console.error('vs anchor count=' + (vs.split(vsAnchor).length - 1)); process.exit(1); }
const vsEntry = 'commit 03d1501 未 push。**v10.28.40.0（2026-09-21 小更新位 39→40·新功能轮·补丁归零）**= SNE 格底随卡色+画布边缘淡淡阴影——用户「SNE Index Card 的二级显示分数的卡片颜色根据卡片本身的颜色自动变化背景颜色融入背景主题；整个画布格子的边缘加淡淡阴影」：①SNE 3×2 指标格背景改 CSS color-mix(in srgb, var(--sne-cell-tint, var(--color-surface-container)) 62%, var(--color-surface-container))——tint 写点两处（applyCardBg 统一写 rgba+setCardBgColor 无 label 分支直写 hexToRgba——SNE 卡无 .card-label 电池首轮 S3/S5 tint=\'\' 实证 applyCardBg 永不到达 v10.28.6/8 口径；清色 resetCardBg→applyCardBg(color=\'\') 移除）；两输入全是 CSS var 主题切换自动正确（JS 烤色会过期）；无选色混色恒等默认零变化 ②画布整盒 box-shadow 0 0 0 1px var(--divider-line-strong), var(--shadow-md)，查看模式显式 none（38.0 起 #fcViewScaler 承担）；站点版本恒 v0.2.58.0；后端零改动 325/325、零草稿字段、ethereal 零改动、i18n 零新键；电池 fc-sne-canvas 12/12（新）+fc-viewport 29/29+fc-present 9/9+micro-v056 21/21+article-frontend 48/48+article-present 29/29+article-view 45/45+article-1to1 20/20+notif-home 23/23+home-bg 26/26+8 套小型舰队全绿+identity 38/38+cit2usr 21/21+i18n 34/34+冒烟 48/48（版本锚 15 文件 sed 39.1→40.0）；线上实机探针 43/43（新 S10 三项：画布盒 box-shadow 与本地逐字节同串+默认格底=卡面 surface 恒等+tint 写入混色 rgb(221,128,128)——建卡读删一个 IIFE 内零草稿污染）；部署 rev 00279-lk7 digest c715f99f env 30 零新键 curl 全绿；commit 8559908 未 push。**站点号当前 v0.2.58.0；FC 当前 v10.28.40.0**。';
fs.writeFileSync(M + 'site-versioning-scheme.md', vs.replace(vsAnchor, vsEntry), 'utf8');
console.log('site-versioning-scheme.md ✓');

// ── 2) backend-build-state.md：链头换 00279-lk7 ──
const bs = fs.readFileSync(M + 'backend-build-state.md', 'utf8');
const bsAnchor = '**当前线上 rev 00278-xpx';
if ((bs.split(bsAnchor).length - 1) !== 1) { console.error('bs anchor count=' + (bs.split(bsAnchor).length - 1)); process.exit(1); }
const bsHead = '**当前线上 rev 00279-lk7（2026-09-21 FC v10.28.40.0 SNE 格底随卡色+画布边缘淡淡阴影——用户「然后那个SNE Index Card 的二级显示分数的卡片颜色能不能根据卡片本身的颜色然后自动变化背景颜色融入背景主题，然后整个画布格子的边缘能不能加上一个淡淡的阴影因为现在边缘有点不明显」（真身：①SNE 卡 3×2 指标格背景固定 surface-container 不随卡色，选色后格子区与卡面脱节 ②画布整盒无阴影描边边缘不明显）；修法：格底改 CSS color-mix(in srgb, var(--sne-cell-tint, var(--color-surface-container)) 62%, var(--color-surface-container))——tint 写点两处：applyCardBg 统一写 rgba+setCardBgColor 无 label 分支直写 hexToRgba（SNE 卡无 .card-label——电池首轮 S3/S5 tint=\'\' 实证 applyCardBg 永不到达；清色 resetCardBg→applyCardBg(color=\'\') 移除）；混色两输入全是 CSS var 深浅主题切换自动正确；无选色混色恒等默认零变化；画布整盒 box-shadow 0 0 0 1px var(--divider-line-strong), var(--shadow-md)+查看模式显式 none（38.0 起 #fcViewScaler 承担）；站点版本恒 v0.2.58.0；后端零改动 325/325、零草稿字段、ethereal 零改动、i18n 零新键；电池 fc-sne-canvas 12/12（新）+fc-viewport 29/29+fc-present 9/9+micro-v056 21/21+article-frontend 48/48+article-present 29/29+article-view 45/45+article-1to1 20/20+notif-home 23/23+home-bg 26/26+8 套小型舰队全绿+identity 38/38+cit2usr 21/21+i18n 34/34+冒烟 48/48（版本锚 15 文件 sed 39.1→40.0）；线上实机探针 43/43（新 S10 三项：画布盒 box-shadow 与本地逐字节同串、默认格底=卡面 surface 恒等、tint 写入混色 rgb(221,128,128)——建卡读删全在一个 IIFE 内 createSneCard 不触发 onContentChange 实机草稿零污染）；digest c715f99f；commit 8559908 未 push；详见 [[2026-09-21-fc-v102840-sne-canvas-shadow]]）——前身 rev 00278-xpx';
fs.writeFileSync(M + 'backend-build-state.md', bs.replace(bsAnchor, bsHead), 'utf8');
console.log('backend-build-state.md ✓');
