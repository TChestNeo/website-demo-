// tmp-update-memory-630.js — v0.2.58.24 记忆仪式：
//   ① backend-build-state.md 头旋转（REV2 新 head；00343-gxb 降前身）
//   ② site-versioning-scheme.md 追加 58.24 条目+当前指针
//   ③ MEMORY.md 新行+三处「当前」指针更新
//   ④ 新记忆文件 2026-09-30-v025824-hub-nodemo.md
'use strict';
const REV1 = '00344-ntt';   // 部署#1 瞬态真 rev（部署后填真值）
const REV2 = '00345-vhw';   // 部署#2 终态真 rev（部署后填真值）
const DIGEST = 'sha256:e59e7f487eb6b792d8ca8b019c39a34fdb5d5a760e9ac2d7489ed54b4ad319c6'; // 二次烘焙 push digest（=当前线上，push 后填真值）
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
  const headAnchor = '**当前线上 rev 00343-gxb（';
  const demote = '**前身 rev 00343-gxb（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-09-30 v0.2.58.24 社区页演示样本全移除+三 tab 全接真数据——用户「能不能把社区页面的所有测试使用的样本信息都去除掉」；' +
    '真身=community-hub.html feedData 8 张硬编码演示卡（3 推荐/2 关注/3 话题，Marcus Vane、Sovereign Council、Cartography Guild、Neural Architects 假名假数）+' +
    '4 个 data-guest-* 静态按钮+访客 toast 链+发现中心 3 硬编码假频道+SlatiDB.getTopics() 本地演示话题；云模式下也只有 recommend tab 接真数据——following/topic 登录用户仍看假卡；' +
    '四项钦定（①只删页面假样本——后端库数据不动真帖保留 ②匿名访客=登录引导卡 58.17 following 先例 ③三 tab 全接真数据：recommend=/api/social/posts 已在位、following=/api/social/feed、topic=/api/social/topics ④发现中心一并清理接真数据——Topics/Trending 真话题+空态、Channels 保留 tab 空态、访客引导）；' +
    '修法=hub sync-gate 架构（cloudMode = isHubAuthed() boot 同步门：SlatiDB.isLoggedIn()&&u&&String(u.id).indexOf(\'USR-\')===0——demo 账号零 API；访客零 API 连 probe 都不发；authed+backend-down→离线卡 NOT 登录卡——renderFeed bug 修复 backendDown 分支在 !cloudMode 分支内不可达；' +
    'refreshCloudFeed 三端点并行（posts/feed/topics）currentTab 门控 renderFeed+topics 恒 renderDiscovery+renderTrending；mn:unauthorized 监听清态→引导卡；renderFeed 短路 return 在 SlatiTilt/绑定之前=访客零 composer 绑定；' +
    'topicCardHtml/feedEmptyHtml 空态链——following 空态/topic 空态+CTA create-topic-step-1.html；搜索胶囊/Premium 卡/composer/点赞转发收藏/分享弹窗/灯箱/举报全保留）；' +
    'i18n 删 32 键×12 语（communityHub.feed.* 28+hub.toast.likeLogin/repostLogin/favLogin+hub.share.communityTitle）+新增 11 键×12 语（zh-Hant 只 OpenCC 重跑本文件）；' +
    '后端零改动 npm test 359/359 不重跑、CSS 零改动→跳过 inline-css.js、FC 恒 v10.28.48.0；' +
    '新电池 community-nodemo（F 静态+B 访客零 API+C 罐头云 8 项+L live）+4 套社区电池重写（like-anim/action-row G+L 段、media boot、post A1）+冒烟 60/60+i18n 34/34+舰队 50 套全绿（grep exit=1|💥 复核零命中；首跑 all-opaque Chrome 未起 flake 34/34 销账、终态复跑 profile-subtier 💥 TypeError: fetch failed flake 独立复跑 27/27 销账）；' +
    '镜像内容验证两次构建各验一次先验后推（二次锚改终态口径 ' + REV1 + ' 真值在位+00344-XXX 占位零残留）；线上探针 hub 630 15/15（S1 静态锚+演示零残留 16 锚全 0+S1d rev live 口径/S2 端点形状 posts 200+数组/feed 401/topics 200+数组/S3 PII 扫描/P1 CDP 匿名渲染引导卡+三 tab+发现双引导行+四假名零残留/E1 零异常）；' +
    'digest ' + DIGEST + '（二次烘焙镜像=当前线上）；commit 未 push；rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 文本滞后一部署=惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00343-gxb（') !== -1 && read(f).indexOf('**当前线上 rev 00343-gxb（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.23；FC 当前 v10.28.48.0**。';
  step('versioning 58.23 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.24（补丁位 23→24·新功能轮；2026-09-30；FC 恒 v10.28.48.0）**：社区页演示样本全移除+三 tab 全接真数据——用户「能不能把社区页面的所有测试使用的样本信息都去除掉」；' +
    '真身=community-hub.html 8 张硬编码演示卡（Marcus Vane 等假名假数）+4 个 data-guest-* 静态钮+发现中心 3 假频道+SlatiDB.getTopics()（云模式也只 recommend tab 接真数据）；' +
    '四项钦定（只删页面假样本/匿名访客=登录引导卡/三 tab 全接真数据/发现中心一并清理接真数据）；' +
    '修法=hub sync-gate 架构（cloudMode=isHubAuthed() 同步门+访客零 API 连 probe 不发+authed+backend-down→离线卡+三端点并行 currentTab 门控+mn:unauthorized 清态→引导卡+空态链+短路 return 在绑定前）；' +
    'i18n 删 32 键+新增 11 键×12 语（zh-Hant 只 OpenCC）；' +
    '后端零改动、CSS 零改动→跳过 inliner；' +
    '电池 community-nodemo 新+4 套重写+冒烟 60/60+i18n 34/34+舰队 50 套全绿；镜像验证 ×2（两次构建各验一次先验后推）；线上探针 hub 630 15/15；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.24；FC 当前 v10.28.48.0**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.24 条目+新尾指针在位', read(f).indexOf('v0.2.58.24（补丁位 23→24·新功能轮；2026-09-30') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.24；FC 当前 v10.28.48.0**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+三处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  const anchor23 = '](2026-09-30-v025823-hover-prefetch.md)\n';
  step('MEMORY.md 58.23 行在位', s.indexOf(anchor23) !== -1);
  const newLine =
    '- [2026-09-30 — v0.2.58.24 社区页演示样本全移除+三 tab 全接真数据（rev ' + REV1 + '→' + REV2 + ' commit 未 push）：「能不能把社区页面的所有测试使用的样本信息都去除掉」——' +
    '四项钦定（只删页面假样本/匿名访客=登录引导卡/三 tab 全接真数据/发现中心一并清理）；真身=feedData 8 张硬编码演示卡（Marcus Vane 等假名假数）+4 个 data-guest-* 静态钮+发现中心 3 假频道+SlatiDB.getTopics()（云模式也只 recommend 接真数据——following/topic 登录用户仍看假卡）；' +
    '修法=hub sync-gate 架构（cloudMode=isHubAuthed() 同步门：isLoggedIn+USR- id 前缀+访客零 API 连 probe 不发+authed+backend-down→离线卡 NOT 登录卡（renderFeed bug 修复 backendDown 分支不可达）+三端点并行 currentTab 门控+mn:unauthorized 清态→引导卡+空态链+短路 return 在 SlatiTilt/绑定前=访客零 composer 绑定）；' +
    'i18n 删 32 键×12 语+新增 11 键×12 语（zh-Hant 只 OpenCC 重跑本文件）；后端零改动 npm test 359/359 不重跑/CSS 零改动跳过 inliner/FC 恒 48.0；' +
    '电池 community-nodemo 新（F 静态+B 访客零 API+C 罐头云 8 项+L live）+4 套重写（like-anim/action-row/media/post）+冒烟 60/60+i18n 34/34+舰队 50 全绿（all-opaque Chrome 未起 flake 34/34+profile-subtier fetch failed flake 27/27 销账）+验证 ×2 先验后推+探针 hub 630 15/15（CDP 匿名引导卡+四假名零残留+三 tab+发现双引导行）；' +
    '新坑：deploy ps1 零重定向真经再证（deploy#2 两次假红=管道/文件重定向把 gcloud stderr 进度行包成 NativeCommandError，ErrorActionPreference=Stop 下终止错误杀 gcloud 中途死零 revision exit 1；deploy#1 带管道纯运气活下来；裸跑 exit 0）、__ZH_HANT_AUTO__ 裸锚无引号（注释行；引号模式 0）、live 文本滞后一部署惯例再证（live 00344-ntt+00345-??? 占位 vs 工作树 00345-vhw——探针按 live 实况断言）、旧探针占位锚历史冻结不动（avatarsync/prefetch/usercard 命中 00344-XXX grep 不误伤——只有 3 套舰队电池做 mini-sed 真值）](2026-09-30-v025824-hub-nodemo.md)\n';
  s = s.replace(anchor23, anchor23 + newLine);
  const bbAnchor = '**当前线上 rev 00343-gxb（v0.2.58.23 悬停预加载消除切页白闪；FC 恒 v10.28.48.0；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（v0.2.58.24 社区页演示样本全移除+三 tab 全接真数据；FC 恒 v10.28.48.0；commit 未 push）；详见 [[backend-build-state]]**');
  const svAnchor = '**当前：站点号 v0.2.58.23（58.23 悬停预加载消除切页白闪；rev 00343-gxb；commit 未 push）、FC v10.28.48.0（48.0 频道卡头像图+点击换头像同轮；rev 00337-wxl；commit 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.24（58.24 社区页演示样本全移除+三 tab 全接真数据；rev ' + REV2 + '；commit 未 push）、FC v10.28.48.0（48.0 频道卡头像图+点击换头像同轮；rev 00337-wxl；commit 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-09-30-v025824-hub-nodemo.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（v0.2.58.24') !== -1 && s2.indexOf('站点号 v0.2.58.24（58.24 社区页演示样本') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-09-30-v025824-hub-nodemo.md';
  const body =
    '---\n' +
    'name: 2026-09-30-v025824-hub-nodemo\n' +
    'description: v0.2.58.24 社区页演示样本全移除+三 tab 全接真数据轮（rev ' + REV1 + '→' + REV2 + ' 未 push）——feedData 8 张硬编码演示卡全删；hub sync-gate 架构（isHubAuthed 同步门+访客零 API+离线卡 NOT 登录卡）；i18n 删 32 键+新增 11 键；探针 15/15；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.24 — 社区页演示样本全移除+三 tab 全接真数据（2026-09-30）\n\n' +
    '用户「能不能把社区页面的所有测试使用的样本信息都去除掉」。\n\n' +
    '**真身**：community-hub.html 的 feedData 8 张硬编码演示卡（3 推荐/2 关注/3 话题——Marcus Vane、Sovereign Council、Cartography Guild、Neural Architects 假名假数）+4 个 data-guest-* 静态按钮+访客 toast 链（likeLogin/repostLogin/favLogin）+发现中心 3 个硬编码假频道+SlatiDB.getTopics() 本地演示话题。云模式下也只有 recommend tab 接真数据——following/topic 两 tab 登录用户仍看假卡。\n\n' +
    '**四项钦定**（AskUserQuestion，用户全选推荐）：①只删页面假样本——后端库数据不动、真帖保留 ②匿名访客=登录引导卡（58.17 following 先例）③三 tab 全接真数据（recommend=/api/social/posts 已在位；following=/api/social/feed；topic=/api/social/topics）④发现中心一并清理接真数据（Topics/Trending 真话题+空态；Channels 无数据源保留 tab 显空态；访客看引导）。\n\n' +
    '**修法**（hub sync-gate 架构）：\n' +
    '- `cloudMode = isHubAuthed()` boot 同步门：`SlatiDB.isLoggedIn() && u && String(u.id||\'\').indexOf(\'USR-\')===0`——demo 账号零 API 原则的同步版；\n' +
    '- 访客零 API：连 probe 都不发（`!cloudMode` 直接 return）；authed+backend-down→**离线卡 NOT 登录卡**（renderFeed bug 修复——backendDown 分支原先嵌在 !cloudMode 分支内永不可达；不给登录用户看「去登录」=58.17 离线卡纪律）；\n' +
    '- `refreshCloudFeed()` 三端点并行（posts/feed/topics）各到达按 currentTab 门控 renderFeed；topics 到达恒 renderDiscovery+renderTrending；\n' +
    '- `renderFeed()` 短路 return 在 SlatiTilt/绑定之前——访客零 composer 绑定；空态链 feedEmptyHtml()（following 空态/topic 空态+CTA create-topic-step-1.html）；topicCardHtml(tp) forum icon+escapeHtml 双保险；\n' +
    '- `mn:unauthorized` 监听清态→引导卡（401 会话失效整流）；卡片构造器删全部演示分支（badgeKey/timeKey/titleKey/descKey 三元与 data-guest-* 四静态钮）；\n' +
    '- 搜索胶囊/Premium 卡/composer/点赞转发收藏/分享弹窗/灯箱/举报全保留；.hub-cta 样式页面专属块不进 inliner。\n\n' +
    '**i18n**：删 32 键×12 语（communityHub.feed.* 28+hub.toast.likeLogin/repostLogin/favLogin+hub.share.communityTitle）；新增 11 键×12 语（loginCta.title/desc/btn、offline、feedEmptyFollowing、feedEmptyTopic、feedEmptyTopicCta、discovery.guest、discovery.emptyTopics、discovery.channelsEmpty、topic.members）；hub.emptyFeed 保留；zh-Hant 只 OpenCC（tmp-i18n-hant.js 重跑本文件）。\n\n' +
    '**验证全链**：5 套社区金丝雀（4 重写：like-anim/action-row G+L 段、media boot、post A1+新电池 community-nodemo F 静态/B 访客零 API/C 罐头云 8 项/L live）→舰队 50 套全绿（grep exit=1|💥 复核零命中；首跑 all-opaque Chrome 未起 flake 34/34 销账、终态复跑 profile-subtier 💥 TypeError: fetch failed flake 独立复跑 27/27 销账）+冒烟 60/60+i18n 34/34｜镜像验证两次构建各验一次先验后推（二次锚改终态口径 ' + REV1 + ' 真值在位+00344-XXX 占位零残留）｜线上探针 hub 630 15/15（S1 静态锚+演示零残留 16 锚全 0+S1d rev live 口径/S2 端点形状/S3 PII 扫描/P1 CDP 匿名渲染引导卡+三 tab+发现双引导行+四假名零残留/E1 零异常）。\n' +
    '后端零改动 npm test 359/359 不重跑；CSS 零改动→跳过 inline-css.js；FC 恒 v10.28.48.0；site-config 58.24 单 changelog。digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态。\n\n' +
    '**新坑**：\n' +
    '1. deploy ps1 零重定向真经再证：deploy#2 两次假红（exit 1 零 revision）——管道 `2>&1 | Select-Object -Last 6` 与 `> tmp-deploy-out.txt 2>&1` 都把 gcloud stderr 进度行（"Deploying container..."）包成 NativeCommandError，`$ErrorActionPreference=\'Stop\'` 下变终止错误杀 gcloud 进程中途死；deploy#1 带管道纯运气活下来（58.18 00298 教训再犯）；**裸跑零重定向是铁律**，exit 0。\n' +
    '2. `__ZH_HANT_AUTO__` 锚必须裸模式无引号：在 i18n 注释行（"由 OpenCC cn→tw 自动生成"注释），带引号模式计数 0——写锚前实测计数家规再证。\n' +
    '3. live 文本滞后一部署惯例再证：live 显示 00344-ntt ×1+00345-??? 占位 ×1，工作树已填 00345-vhw 真值——探针 S1d 按 live 实况断言（00344-ntt 真值+00344-XXX 零残留+00345-??? 占位各 ×1）。\n' +
    '4. 旧探针占位锚历史冻结不动：avatarsync/prefetch-629/usercard-627/628 内 grep 命中 00344-XXX/00345-???——历史冻结工件非本轮产出，只有 3 套舰队电池（activity/following/nodemo）做 rev mini-sed 真值。\n' +
    '5. 401 整流后 live 序列必须重 seed+reload（mn:unauthorized 清态变引导卡——like-anim L5/action-row L2c/post L3 三处边界）。\n' +
    '6. C3t trending 行作用域断言：textContent 含 icon ligature 字形名（\'tag\' 在行文本开头）——精确串断言必须按 tr.children[i] 逐列取。\n' +
    '7. probe/verify 路径坑：cwd=backend-v2 时裸 `node tmp-probe-hub-630.js`（带前缀 DirectoryNotFoundException）；verify 从仓库根跑 `node backend-v2/tmp-verify-630.js`（MODULE_NOT_FOUND）。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-09-30-v025823-hover-prefetch]]、[[2026-09-29-v025817-following-real]]、[[2026-09-29-v025816-activity-real]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.24 — 社区页演示样本全移除') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
