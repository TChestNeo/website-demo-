// tmp-memory-update-v0202.js — v0.2.20.2 记忆文件更新（rev 00095-x9x → 00096-8p8）
'use strict';
const fs = require('fs');
const DIR = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const R202_HEAD = '**当前线上 rev 00096-8p8（2026-09-06 v0.2.20.2 Community 星+分享间距靠拢：用户「这个收藏和分享两个按钮的间距可以靠近些吗」——星钮 margin-right:-10px：星↔分享间隙从容器 gap 16px 收到 6px（margin-left:auto 保留，星组仍贴行右缘、分享右缘=行右缘不动；hub 真卡+演示卡+帖页 tail 三处同改+重建 106340 chars）；零后端零共享文件；电池 59/59 本地（A7 g5 断言改 4~10px 靠拢区间——g5=6 实测、g1-g4 仍 16、rightEdge=0 不变）+19/19 线上（L1 版本 v0.2.20.2+rightEdge=0）+冒烟 49/49+curl 六连（浏览量 7→8 真实+1+匿名收藏 401×2+三处 margin-right:-10px）+health 58，rev 00096-8p8 commit 4c5d3ff（未 push））；';
const R201_OLD = '**当前线上 rev 00095-x9x（2026-09-06 v0.2.20.1 Community 星+分享顶到行最右缘：用户';

let changed = 0;
function rep(f, oldS, newS, label) {
  const p = DIR + f;
  const s = fs.readFileSync(p, 'utf8');
  if (s.indexOf(oldS) === -1) { console.error('❌ ' + f + ' 锚点缺失: ' + label); process.exitCode = 1; return; }
  if (s.split(oldS).length - 1 !== 1) { console.error('❌ ' + f + ' 锚点不唯一(x' + (s.split(oldS).length - 1) + '): ' + label); process.exitCode = 1; return; }
  fs.writeFileSync(p, s.replace(oldS, newS));
  console.log('✅ ' + f + ' ' + label);
  changed++;
}

// 1) MEMORY.md 行9 backend hook
rep('MEMORY.md', R201_OLD, R202_HEAD + '前身 rev 00095-x9x（2026-09-06 v0.2.20.1 Community 星+分享顶到行最右缘：用户', '行9 backend hook');

// 2) MEMORY.md 行11 site-versioning hook
rep('MEMORY.md',
  '站点号当前 **v0.2.20.1**（2026-09-06 Community 星+分享顶到行最右缘轮——用户「我是说放到最右边不是这样」：',
  '站点号当前 **v0.2.20.2**（2026-09-06 Community 星+分享间距靠拢轮——用户「这个收藏和分享两个按钮的间距可以靠近些吗」：星钮 margin-right:-10px——星↔分享间隙 16px→6px（margin-left:auto 保留、分享仍贴行右缘；真/演示卡+帖页三处同改+重建 106340 chars）；零后端零共享文件；测试 233/233+电池 59/59 本地（A7 g5 断言改 4~10px 靠拢区间，g5=6 实测）+19/19 线上+冒烟 49/49+curl 六连+health 58，rev 00096-8p8 commit 4c5d3ff（未 push））；前身 v0.2.20.1（2026-09-06 Community 星+分享顶到行最右缘轮——用户「我是说放到最右边不是这样」：',
  '行11 site-versioning hook');

// 3) backend-build-state.md（—— 链）
rep('backend-build-state.md', R201_OLD,
  '**当前线上 rev 00096-8p8（2026-09-06 v0.2.20.2 Community 星+分享间距靠拢——用户「这个收藏和分享两个按钮的间距可以靠近些吗」：星钮 margin-right:-10px——星↔分享间隙从容器 gap 16px 收到 6px（margin-left:auto 保留、分享仍贴行右缘；hub 真卡+演示卡+帖页 tail 三处同改+重建 106340 chars）；零后端零共享文件；测试 233/233+电池 59/59 本地（A7 g5 断言改 4~10px 靠拢区间——g5=6 实测）+19/19 线上+冒烟 49/49+curl 六连+health 58；部署 00096-8p8 100% 流量一次成功；commit 4c5d3ff（未 push））——前身 rev 00095-x9x（2026-09-06 v0.2.20.1 Community 星+分享顶到行最右缘：用户',
  '当前线上 rev');

// 4) site-versioning-scheme.md 链头注入
rep('site-versioning-scheme.md',
  '（未 push））；2026-09-06 v0.2.20.1 = Community 星+分享顶到行最右缘（补丁位 0→1',
  '（未 push））；2026-09-06 v0.2.20.2 = Community 星+分享间距靠拢（补丁位 1→2 观感微调轮——用户「这个收藏和分享两个按钮的间距可以靠近些吗」：星钮 margin-right:-10px——星↔分享间隙从容器 gap 16px 收到 6px（margin-left:auto 保留、分享仍贴行右缘；真/演示卡+帖页三处同改+重建 106340 chars）；零后端零共享文件；测试 233/233+电池 59/59 本地（A7 g5 断言改 4~10px 靠拢区间——g5=6 实测）+19/19 线上+冒烟 49/49+curl 六连+health 58，rev 00096-8p8 commit 4c5d3ff（未 push））；2026-09-06 v0.2.20.1 = Community 星+分享顶到行最右缘（补丁位 0→1',
  '版本链注入');

console.log(changed + ' 处替换完成');
