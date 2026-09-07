// tmp-memory-update-v0203.js — v0.2.20.3 记忆文件更新（rev 00096-8p8 → 00097-n8v）
'use strict';
const fs = require('fs');
const DIR = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const R203_HEAD = '**当前线上 rev 00097-n8v（2026-09-06 v0.2.20.3 Community 星+分享再靠拢 8px：用户「让他更近8px」——星钮 margin-right:-10px→-18px：星↔分享间隙 6px→-2px（按钮盒重叠 2px、图标更贴；margin-left:auto 保留星组仍贴行右缘、分享右缘=行右缘不动；hub 真卡+演示卡+帖页 tail 三处同改+重建 106340 chars）；零后端零共享文件；电池 59/59 本地（A7 g5 断言改重叠区间 -4~2px——g5=-2 实测、g1-g4 仍 16、rightEdge=0 不变）+19/19 线上（L1 版本 v0.2.20.3+rightEdge=0+帖页浏览量 8→9 真实+1）+冒烟 49/49+curl 六连（三处 -18px+匿名收藏 401）+health 58，rev 00097-n8v commit d7ec861（未 push））；';
const R202_OLD = '**当前线上 rev 00096-8p8（2026-09-06 v0.2.20.2 Community 星+分享间距靠拢：用户';

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
rep('MEMORY.md', R202_OLD, R203_HEAD + '前身 rev 00096-8p8（2026-09-06 v0.2.20.2 Community 星+分享间距靠拢：用户', '行9 backend hook');

// 2) MEMORY.md 行11 site-versioning hook
rep('MEMORY.md',
  '站点号当前 **v0.2.20.2**（2026-09-06 Community 星+分享间距靠拢轮——用户「这个收藏和分享两个按钮的间距可以靠近些吗」：',
  '站点号当前 **v0.2.20.3**（2026-09-06 Community 星+分享再靠拢 8px 轮——用户「让他更近8px」：星钮 margin-right:-10px→-18px——星↔分享间隙 6px→-2px（按钮盒重叠 2px；margin-left:auto 保留、分享仍贴行右缘；真/演示卡+帖页三处同改+重建 106340 chars）；零后端零共享文件；测试 233/233+电池 59/59 本地（A7 g5 断言改重叠区间 -4~2px，g5=-2 实测）+19/19 线上（帖页浏览量 8→9 真实+1）+冒烟 49/49+curl 六连+health 58，rev 00097-n8v commit d7ec861（未 push））；前身 v0.2.20.2（2026-09-06 Community 星+分享间距靠拢轮——用户「这个收藏和分享两个按钮的间距可以靠近些吗」：',
  '行11 site-versioning hook');

// 3) backend-build-state.md（—— 链）
rep('backend-build-state.md',
  '**当前线上 rev 00096-8p8（2026-09-06 v0.2.20.2 Community 星+分享间距靠拢——用户',
  '**当前线上 rev 00097-n8v（2026-09-06 v0.2.20.3 Community 星+分享再靠拢 8px——用户「让他更近8px」：星钮 margin-right:-10px→-18px——星↔分享间隙 6px→-2px（按钮盒重叠 2px、图标更贴；margin-left:auto 保留、分享仍贴行右缘；hub 真卡+演示卡+帖页 tail 三处同改+重建 106340 chars）；零后端零共享文件；测试 233/233+电池 59/59 本地（A7 g5 断言改重叠区间 -4~2px——g5=-2 实测）+19/19 线上+冒烟 49/49+curl 六连+health 58；部署 00097-n8v 100% 流量一次成功；commit d7ec861（未 push））——前身 rev 00096-8p8（2026-09-06 v0.2.20.2 Community 星+分享间距靠拢——用户',
  '当前线上 rev');

// 4) site-versioning-scheme.md 链头注入
rep('site-versioning-scheme.md',
  '（未 push））；2026-09-06 v0.2.20.2 = Community 星+分享间距靠拢（补丁位 1→2',
  '（未 push））；2026-09-06 v0.2.20.3 = Community 星+分享再靠拢 8px（补丁位 2→3 观感微调轮——用户「让他更近8px」：星钮 margin-right:-10px→-18px——星↔分享间隙 6px→-2px（按钮盒重叠 2px、图标更贴；margin-left:auto 保留、分享仍贴行右缘；真/演示卡+帖页三处同改+重建 106340 chars）；零后端零共享文件；测试 233/233+电池 59/59 本地（A7 g5 断言改重叠区间 -4~2px——g5=-2 实测）+19/19 线上+冒烟 49/49+curl 六连+health 58，rev 00097-n8v commit d7ec861（未 push））；2026-09-06 v0.2.20.2 = Community 星+分享间距靠拢（补丁位 1→2',
  '版本链注入');

console.log(changed + ' 处替换完成');
