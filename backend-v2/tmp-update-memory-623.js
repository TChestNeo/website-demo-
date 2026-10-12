// tmp-update-memory-623.js — v0.2.58.17 记忆仪式：
//   ① backend-build-state.md 头旋转（00330-gcs 新 head；00328-c67 降前身）
//   ② site-versioning-scheme.md 追加 58.17 条目+当前指针
//   ③ MEMORY.md 新行+两处「当前」指针更新
//   ④ 新记忆文件 2026-09-29-v025817-following-real.md
'use strict';
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
  const headAnchor = '**当前线上 rev 00328-c67（';
  const demote = '**前身 rev 00328-c67（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev 00330-gcs（2026-09-29 v0.2.58.17 关注页真实数据接入——用户「那么关注页面的也做一下」；' +
    '真身=docs/pages/following.html 全站最假的一页（零 fetch 零 api.js、5 组种子数组、搜索胶囊死输入、「+关注」按钮无 handler、' +
    '唯一数据源 localStorage 演示种子连镜像都失败）；修法=后端 social.js 三新端点零迁移（GET /api/social/feed requireSession 关注用户帖∪话题帖 ' +
    'seq DESC LIMIT 100、GET /api/social/following/detail 三类明细解析已删目标静默丢弃 teams 忽略 nation followerCount 现算、' +
    'GET /api/public/users 匿名公开限流 pu:ip: 30/min active only followerCount DESC·seq ASC 平局 LIMIT 20 viewer 随行 followedByMe、' +
    'PII 口径与公开主页对齐绝不 email/bio/gender）+前端 IIFE 整体重写（渲染器全纯零重拉、搜索实时过滤三区、' +
    'auth 双门 isLoggedIn+USR- 前缀、未登录=页面可看发现给真实公开数据动态/关注给登录引导卡不跳转、离线=离线卡绝不回退假数据 5 组种子全删、' +
    'nation/topic 切换走 SlatiDB.saveFollowing 触发 PUT 镜像、user 切换走 POST/DELETE+localStorage 直写绝不 saveFollowing 防双重写、' +
    '链式 __mnI18nRerender 不踩 activity 页）+i18n 37 死键整体删除+11 新键×11 语手写（zh-Hant OpenCC 重生成）；' +
    'FC 恒 v10.28.47.4；npm test 356/356+电池 following 25/25+舰队 43 套全绿（grep exit=1|💥 复核零命中；home-bg Chrome 未起 flake 独立复跑 26/26 销账）+' +
    '冒烟 60/60+i18n 34/34；镜像内容验证 57/57+57/57（两次构建各验一次、先验后推）；线上探针 following 14/14（S1 静态锚+种子零残留+' +
    'S2 端点形状 health 60 表/public users 200 全形状+nations/topics 200+feed/detail 匿名 401+S3 PII 零暴露+P1 CDP 匿名渲染登录 CTA+E1 零异常）；' +
    'digest sha256:ba7bef22edeff676823445092b66681f98d8613a3546dae38e69fc285e8fba87（二次烘焙镜像=当前线上）；' +
    'commit 未 push；新坑：线上 /api/health 真端点返回 {status:"ok",db:"ok",tables:60} 无 ok 键——电池静态 stub {"ok":true} 形状不同' +
    '（api.js probe 只看 res.ok 两种都过，探针断言必须按真端点形状）、verify 「ORDER BY seq DESC LIMIT 100」是共享 SQL 模式实测 3 处期望非 1、' +
    'docker push 认证过期→gcloud auth configure-docker 重配即复活（无需重新 login）；' +
    'rev 00329-6nq 瞬态→00330-gcs 终态（live 文本 00329-6nq 烘焙、00330-gcs 真值注记随 commit 滞后一部署=58.16 同款惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev 00330-gcs（') !== -1 && read(f).indexOf('**前身 rev 00328-c67（') !== -1 && read(f).indexOf('**当前线上 rev 00328-c67（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.16；FC 当前 v10.28.47.4**。';
  step('versioning 58.16 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.17（补丁位 16→17·新功能轮；2026-09-29）**：关注页真实数据接入——用户「那么关注页面的也做一下」；' +
    '真身=following.html 全站最假（零 fetch 零 api.js、5 组种子数组、死搜索、无 handler +Follow）；' +
    '修法=后端 social.js 三新端点零迁移（/api/social/feed 关注帖∪话题帖、/api/social/following/detail 三类明细、/api/public/users 匿名公开限流+' +
    'PII 与公开主页对齐）+前端 IIFE 整体重写（渲染器全纯零重拉、搜索实时过滤、auth 双门、未登录=可看+登录引导卡、离线=离线卡绝不回退假数据）+' +
    'i18n 37 死键删除+11 新键×11 语（zh-Hant OpenCC）；FC 恒 v10.28.47.4；' +
    'npm test 356/356+电池 following 25/25+舰队 43 套全绿（home-bg flake 复跑 26/26 销账）+冒烟 60/60+i18n 34/34；' +
    '镜像内容验证 57/57+57/57（两次构建各验一次、先验后推）；线上探针 following 14/14；digest sha256:ba7bef22…；' +
    'commit 未 push，rev 00329-6nq→00330-gcs（首部署瞬态 00329-6nq、二次烘焙重部署终态 00330-gcs——live 文本 00329-6nq 滞后一部署=58.16 同款惯例））。' +
    '**站点号当前 v0.2.58.17；FC 当前 v10.28.47.4**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.17 条目+新尾指针在位', read(f).indexOf('v0.2.58.17（补丁位 16→17·新功能轮；2026-09-29）') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.17；FC 当前 v10.28.47.4**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+两处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  // 新行插在 58.16 行之后
  const anchor16 = '](2026-09-29-v025816-activity-real.md)\n';
  step('MEMORY.md 58.16 行在位', s.indexOf(anchor16) !== -1);
  const newLine =
    '- [2026-09-29 — v0.2.58.17 关注页真实数据接入（rev 00329-6nq→00330-gcs commit 未 push）：「那么关注页面的也做一下」——' +
    'following.html 全站最假页重写（零 fetch 零 api.js/5 组种子全删/死搜索/无 handler +Follow）接后端 3 新端点（feed 关注帖∪话题帖/following detail 三类明细/' +
    'public users PII 与公开主页对齐）+未登录=可看+登录引导卡+离线=离线卡绝不回退假数据+搜索实时过滤+渲染器全纯零重拉；' +
    'npm test 356/356+电池 25/25+舰队 43 全绿（home-bg Chrome 未起 flake 复跑 26/26 销账）+冒烟 60/60+i18n 34/34+验证 57/57×2+探针 14/14；' +
    '新坑：真 /api/health 无 ok 键（stub {"ok":true}≠真端点形状，probe 只看 res.ok 两种都过）、verify 共享 SQL 模式锚期望 3 非 1、' +
    'docker push 认证过期 configure-docker 重配即复活](2026-09-29-v025817-following-real.md)\n';
  s = s.replace(anchor16, anchor16 + newLine);
  // backend-build-state 行「当前线上」指针
  const bbAnchor = '**当前线上 rev 00328-c67（v0.2.58.16 动态页真实数据接入；FC 恒 v10.28.47.4；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev 00330-gcs（v0.2.58.17 关注页真实数据接入；FC 恒 v10.28.47.4；commit 未 push）；详见 [[backend-build-state]]**');
  // site-versioning 行「当前」指针
  const svAnchor = '**当前：站点号 v0.2.58.16（58.16 动态页真实数据接入；rev 00328-c67；commit 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.17（58.17 关注页真实数据接入；rev 00330-gcs；commit 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-09-29-v025817-following-real.md') !== -1 && s2.indexOf('当前线上 rev 00330-gcs（v0.2.58.17') !== -1 && s2.indexOf('站点号 v0.2.58.17（58.17 关注页真实数据接入') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-09-29-v025817-following-real.md';
  const body =
    '---\n' +
    'name: 2026-09-29-v025817-following-real\n' +
    'description: v0.2.58.17 关注页真实数据接入轮（rev 00329-6nq→00330-gcs 未 push）——following.html 假数据全撤接 3 新端点（feed/following detail/public users）、登录引导卡+离线卡+搜索过滤；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.17 — 关注页全部真实数据接入（2026-09-29）\n\n' +
    '用户「那么关注页面的也做一下」（58.16 动态页同款处理）。真身：following.html 全站最假——零 fetch 零 api.js、5 组种子数组、' +
    '搜索胶囊死输入、「+关注」按钮无 handler、唯一数据源是 localStorage 演示种子（显示名种子连后端 PUT 只收 USR- 格式镜像都失败）。\n\n' +
    '**修法**（计划四问钦定：动态=用户帖+话题帖／未登录=可看+登录引导／离线=离线卡绝不回退假数据／发现用户=新建公开用户端点）：\n' +
    '- 后端 social.js 三新端点零迁移：GET /api/social/feed（requireSession；关注用户帖∪关注话题帖、seq DESC LIMIT 100、postRow 复用）、' +
    'GET /api/social/following/detail（三类明细解析、已删目标静默丢弃、teams 忽略、nation followerCount 现算）、' +
    'GET /api/public/users（匿名公开+限流 pu:ip: 30/min、active only+followerCount DESC·seq ASC 平局+LIMIT 20、viewer 随行 followedByMe、' +
    'PII 口径与公开主页对齐：id/displayName/avatarUrl/citizenId/followerCount，绝无 email/bio/gender）。\n' +
    '- 前端 IIFE 整体重写：渲染器全纯（只读 state 零 fetch 切语零重拉）、搜索实时过滤三区、auth 双门 isLoggedIn+USR- 前缀（演示用户「登录但无 cookie」防 401 连环）、' +
    'mn:unauthorized 退登录引导态、nation/topic 切换走 SlatiDB.saveFollowing 触发 PUT 镜像、user 切换走 POST/DELETE+localStorage 直写绝不 saveFollowing 防双重写、' +
    '链式 __mnI18nRerender 不踩 activity 页。\n' +
    '- i18n：54.2 demo 文案 37 死键整体删除、11 新键×11 语手写、zh-Hant OpenCC 重生成；en 值=页面兜底串逐字节一致。\n\n' +
    '**验证全链**：npm test 356/356｜电池 following 25/25｜舰队 43 套全绿（grep exit=1|💥 零命中；home-bg Chrome 未起 flake 独立复跑 26/26 销账）｜' +
    '冒烟 60/60｜i18n 34/34｜镜像验证 57/57+57/57（两次构建各验一次、先验后推）｜线上探针 14/14。\n' +
    'digest sha256:ba7bef22edeff676823445092b66681f98d8613a3546dae38e69fc285e8fba87（二次烘焙=当前线上）。rev 00329-6nq 瞬态→00330-gcs 终态。\n\n' +
    '**新坑**：\n' +
    '1. 线上 /api/health 真端点返回 {status:"ok",db:"ok",tables:60} 无 ok 键——电池静态服务器 stub {"ok":true} 与真端点形状不同；' +
    'api.js probe 只看 res.ok 所以两种形状客户端都过，但探针断言必须按真端点形状（stub 形状≠真形状）。\n' +
    '2. verify 锚「ORDER BY seq DESC LIMIT 100」是共享 SQL 模式（既有端点同款 3 处）——期望 3 非 1（电池 F1-5 同口径）。\n' +
    '3. docker push 认证过期（error from registry: authentication failed）→ gcloud auth configure-docker asia-southeast1-docker.pkg.dev 重配即复活，无需重新 login。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-09-29-v025816-activity-real]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.17 — 关注页全部真实数据接入') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
