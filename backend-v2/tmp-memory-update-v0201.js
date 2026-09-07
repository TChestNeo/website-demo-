// tmp-memory-update-v0201.js — v0.2.20.0 + v0.2.20.1 记忆文件更新（rev 00094-nj9 → 00095-x9x）
'use strict';
const fs = require('fs');
const DIR = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

// 三个文件共用的两个轮条目（backend-build-state 用 —— 链、site-versioning 用「轮」号链）
const R200_BACKEND = '前身 rev 00094-nj9（2026-09-06 v0.2.20.0 Community 操作行浏览量+收藏星：用户「能不能把分享按钮的位置换成浏览量然后 把分享按钮放到最右边然后它的左侧再放一个星星作为收藏按钮 两个都不需要显示号码」——行序重排 [赞][评][转][浏览][☆收藏][⇧分享]、浏览量替代旧分享位、星+分享置最右不显号码；后端迁移 016 posts.view_count 列+GET /posts/:id 每开一次+1+POST/DELETE /posts/:id/favorite 真开关（005 已有 favorites 表 target_type=\'post\' 零新表，health 58 不变）；postRow 随行 viewCount+favoritedByMe；测试 227→233/233（social-favorites 5 测+migrations/health user_version 15→16 五处同步）+电池 56/56 本地（F1-F4 星收藏矩阵/A7 六件行几何/无号码/行序）+18/18 线上（401 回滚+帖页浏览量 0→1 真实+1 实测）+冒烟 49/49+curl 八连+health 58，rev 00094-nj9 commit a7da3d9（未 push））';
const R201_HEAD = '**当前线上 rev 00095-x9x（2026-09-06 v0.2.20.1 Community 星+分享顶到行最右缘：用户「我是说放到最右边不是这样」——v0.2.20.0 星/分享虽在行尾但左对齐挤在浏览量旁不合格：星钮加 margin-left:auto 把星+分享推贴卡片行右缘（hub 真卡+演示卡+帖页 tail 三处同改+重建 106321 chars；行序不变 [赞][评][转][浏览]...[☆][⇧分享]）；零后端零共享文件；测试 233/233+电池 56→59 本地（+A7/P1b/G1 分享右缘=行右缘 ≤1px 几何断言，rightEdge=0 实测）+19/19 线上（L1 rightEdge=0+版本 v0.2.20.1）+冒烟 49/49+curl 八连（浏览量 5→6 真实+1+匿名收藏 POST/DELETE 401+404+帖页 margin-left:auto×2）+health 58，rev 00095-x9x commit cf3d9d1（未 push）——踩坑：电池只断言行序（lastElementChild）会放过左对齐布局，「顶到最右」必须加 getBoundingClientRect 右缘几何断言）；';

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

// 1) MEMORY.md 行9 backend hook：当前线上 rev 00093-m2g → 00095-x9x + 前身 00094-nj9 注入
rep('MEMORY.md',
  '**当前线上 rev 00093-m2g（2026-09-06 v0.2.19.3 Community 操作行四钮放大+间距拉开：用户',
  R201_HEAD + R200_BACKEND + '；前身 rev 00093-m2g（2026-09-06 v0.2.19.3 Community 操作行四钮放大+间距拉开：用户',
  '行9 backend hook');

// 2) MEMORY.md 行11 site-versioning hook：站点号当前 v0.2.19.3 → v0.2.20.1 + 前身 v0.2.20.0 注入
rep('MEMORY.md',
  '站点号当前 **v0.2.19.3**（2026-09-06 Community 操作行四钮放大+间距拉开轮——用户「能不能把那四个按钮的间距拉开些然后他们的大小放大些方便被点击」：',
  '站点号当前 **v0.2.20.1**（2026-09-06 Community 星+分享顶到行最右缘轮——用户「我是说放到最右边不是这样」：v0.2.20.0 星/分享虽在行尾但左对齐挤在浏览量旁——星钮 margin-left:auto 把星+分享推贴卡片行右缘（hub 真/演示卡+帖页 tail 三处同改+重建 106321 chars；行序不变）；零后端零共享文件；测试 233/233+电池 56→59 本地（+A7/P1b/G1 分享右缘=行右缘 ≤1px 几何断言，rightEdge=0 实测）+19/19 线上（L1 rightEdge=0+版本 v0.2.20.1）+冒烟 49/49+curl 八连+health 58，rev 00095-x9x commit cf3d9d1（未 push）——踩坑：电池行序断言会放过左对齐布局，「顶到最右」必须加右缘几何断言）；前身 v0.2.20.0（2026-09-06 Community 操作行浏览量+收藏星轮——用户「能不能把分享按钮的位置换成浏览量然后 把分享按钮放到最右边然后它的左侧再放一个星星作为收藏按钮 两个都不需要显示号码」：行序重排 [赞][评][转][浏览][☆收藏][⇧分享]；后端迁移 016 posts.view_count+GET /posts/:id 每开一次+1+POST/DELETE /posts/:id/favorite 真开关（005 favorites 表零新表）；postRow 随行 viewCount+favoritedByMe；测试 227→233/233+电池 56/56 本地+18/18 线上（帖页浏览量 0→1 真实+1 实测）+冒烟 49/49+curl 八连+health 58，rev 00094-nj9 commit a7da3d9（未 push））；前身 v0.2.19.3（2026-09-06 Community 操作行四钮放大+间距拉开轮——用户「能不能把那四个按钮的间距拉开些然后他们的大小放大些方便被点击」：',
  '行11 site-versioning hook');

// 3) backend-build-state.md：当前线上 rev 00093-m2g → 00095-x9x（—— 链）
rep('backend-build-state.md',
  '**当前线上 rev 00093-m2g（2026-09-06 v0.2.19.3 Community 操作行四钮放大+间距拉开——用户',
  R201_HEAD + R200_BACKEND + '——前身 rev 00093-m2g（2026-09-06 v0.2.19.3 Community 操作行四钮放大+间距拉开——用户',
  '当前线上 rev');

// 4) site-versioning-scheme.md：链头 2026-09-06 v0.2.19.3 = 前注入 v0.2.20.1 + v0.2.20.0 两条
rep('site-versioning-scheme.md',
  '（未 push））；2026-09-06 v0.2.19.3 = Community 操作行四钮放大+间距拉开（补丁位 2→3',
  '（未 push））；2026-09-06 v0.2.20.1 = Community 星+分享顶到行最右缘（补丁位 0→1 口径修正轮——用户「我是说放到最右边不是这样」：v0.2.20.0 星/分享虽在行尾但左对齐挤在浏览量旁不合格——星钮加 margin-left:auto 把星+分享推贴卡片行右缘（hub 真卡+演示卡+帖页 tail 三处同改+重建 106321 chars；行序不变 [赞][评][转][浏览]...[☆][⇧分享]）；零后端零共享文件；测试 233/233+电池 56→59 本地（+A7/P1b/G1 分享右缘=行右缘 ≤1px 几何断言——rightEdge=0 实测）+19/19 线上+冒烟 49/49+curl 八连+health 58，rev 00095-x9x commit cf3d9d1（未 push））；2026-09-06 v0.2.20.0 = Community 操作行浏览量+收藏星（小改动位 19→20 新功能轮·补丁清零——用户「能不能把分享按钮的位置换成浏览量然后 把分享按钮放到最右边然后它的左侧再放一个星星作为收藏按钮 两个都不需要显示号码」：行序重排 [赞][评][转][浏览][☆收藏][⇧分享]——浏览量替代旧分享位、星收藏+分享置最右、两个都不显示号码；后端迁移 016 posts.view_count 列+GET /posts/:id 每开一次+1；POST/DELETE /posts/:id/favorite 真开关（favorites 表 005 已有零新表）；postRow 随行 viewCount+favoritedByMe；前端 visibility 图标静态展示+星钮 star↔star_border 切换+金色 #eab308+FILL 轴实心（乐观更新+失败回滚+访客 toast「登录后才能收藏」）；测试 227→233/233+电池 56/56 本地+18/18 线上+冒烟 49/49+curl 八连+health 58，rev 00094-nj9 commit a7da3d9（未 push））；2026-09-06 v0.2.19.3 = Community 操作行四钮放大+间距拉开（补丁位 2→3',
  '版本链注入');

console.log(changed + ' 处替换完成');
