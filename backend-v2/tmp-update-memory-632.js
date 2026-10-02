// tmp-update-memory-632.js — v0.2.58.26 记忆仪式：
//   ① backend-build-state.md 头旋转（00349-hgc 新 head；00347-skv 降前身）
//   ② site-versioning-scheme.md 追加 58.26 条目+当前指针
//   ③ MEMORY.md 新行+三处「当前」指针更新
//   ④ 新记忆文件 2026-10-02-v025826-fc-overview-opaque.md
'use strict';
const REV1 = '00348-t8b';   // 部署#1 瞬态真 rev
const REV2 = '00349-hgc';   // 部署#2 终态真 rev
const DIGEST = 'sha256:2fe10591ccf169ba6f610fc64a3a4dcdb2320454cf8cb335981e15a4d4556619'; // 二次烘焙 push digest（=当前线上）
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
  const headAnchor = '**当前线上 rev 00347-skv（';
  const demote = '**前身 rev 00347-skv（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-10-02 v0.2.58.26 FC 首页真数据+不透明卡片+FC 48.2 同轮——用户「能不能顺便把FC的所有并非用户手动创建的测试信息都去除掉，还有把所有FC的首页卡片从玻璃变成不透明的卡片？」+「那个备份能不能一天备份一次不要每次一改就备份？」；' +
    '三项钦定（①只清页面硬编码假数据——演示账号与后端库不动 ②假数字区块接真实数据+空态——后端新聚合端点 GET /api/fc/overview；匿名=登录引导卡 58.24 hub 先例 ③玻璃→不透明=只首页卡片——按钮/搜索胶囊保持玻璃）；备份=Cloud Run 快照 SNAPSHOT_INTERVAL_MS 60000→86400000 一天一次（boot/SIGTERM 保底快照保留；tmp-deploy-632.ps1 describe+override 模式；若用户指 git 提交节奏另行确认——已告知）；' +
    '修法=fluidcanvas.html FC_OVERVIEW 数据层（cloudMode=SlatiDB.isLoggedIn()&&USR- 前缀；var FC_OVERVIEW=null；loadFcOverview(force,cb)；boot 调用；fcNum/fcCompact/fcOverviewStats/fcOverviewWindow）+不透明 CSS body.fc-page .card:not(.profile-header){background:var(--sidebar-bg)}+.lg-backdrop{filter:none;backdrop-filter:none}（computed light rgba(255,255,255,0.95)/dark rgb(26,26,46)/mono-dark rgb(16,16,19)）+假数据全撤（SIMULATED_FILES/simulateFilePick/48.2K/slati_demo_article_content 可执行体零残留）+空态链 FT(fc.analytics.noData)+访客门禁 head 同步挂 fc-guest 类（.fc-locked-hero flex/.studio-main none/#accountBar none/零数据 API）；' +
    '后端 routes/public/fc-overview.js GET /api/fc/overview requireSession+rateLimit 30/min；bare object stats 15 keys+windows 7d/28d/month+articles/media/posts；npm test 366/366；i18n fluidcanvas 30 新键×12 语（zh-Hant 只 OpenCC；__ZH_HANT_AUTO__ ×2）；site-config 58.26+48.2 双 changelog；CSS 页面专属块跳过 inliner；' +
    '电池 tmp-battery-fc-632 31/31（F 静态+B 访客零 API+C 罐头云+L live）+舰队 52 套全绿（首跑两真红非 flake：monodark M1d 卡片计算态 rgba(21,21,25,0.55)→rgb(16,16,19)、community-nodemo F1 计数 4→3——各自改锚独立复跑 29/29+30/30 销账）+冒烟 60/60+i18n 34/34；' +
    '镜像内容验证两次构建各验一次先验后推 0 mismatch（verify#1 占位 ' + REV1.slice(0, 6) + '-XXX ×2+00349-??? ×2；verify#2 终态 ' + REV1 + ' 真值 ×2+' + REV1.slice(0, 6) + '-XXX 零残留）；线上探针 fc 632 8/8（S1a-d 静态+S2 /api/fc/overview 匿名 401+health 200/P1 CDP 访客锁屏 locked-hero flex+零数据 API（除全站 pageview 信标）/E1 零异常）；' +
    'digest ' + DIGEST + '（二次烘焙镜像=当前线上）；commit 未 push；rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 文本滞后一部署=惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00347-skv（') !== -1 && read(f).indexOf('**当前线上 rev 00347-skv（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.25；FC 当前 v10.28.48.1**。';
  step('versioning 58.25 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.26（补丁位 25→26·新功能轮；2026-10-02；FC v10.28.48.1→48.2 同轮）**：FC 首页真数据+不透明卡片+备份一天一次——用户「能不能顺便把FC的所有并非用户手动创建的测试信息都去除掉，还有把所有FC的首页卡片从玻璃变成不透明的卡片？」+「那个备份能不能一天备份一次不要每次一改就备份？」；' +
    '三项钦定（只清页面硬编码假数据演示账号与后端库不动/假数字区块接真数据+空态后端新端点 GET /api/fc/overview 匿名=登录引导卡 58.24 先例/玻璃→不透明只首页卡片按钮搜索胶囊保持玻璃）+备份=快照 SNAPSHOT_INTERVAL_MS 60000→86400000 一天一次（boot/SIGTERM 保底保留）；' +
    '修法=FC_OVERVIEW 数据层（cloudMode 登录+USR- 前缀/loadFcOverview/fcNum/fcCompact/fcOverviewStats/fcOverviewWindow）+不透明 CSS .card:not(.profile-header) var(--sidebar-bg)+.lg-backdrop 摘 blur+假数据可执行体零残留+访客 head 挂 fc-guest 锁屏零数据 API+后端 fc-overview.js requireSession+rateLimit 30/min stats 15 键+windows+articles/media/posts；' +
    'i18n 30 新键×12 语（zh-Hant 只 OpenCC）；npm test 366/366；电池 fc-632 31/31+舰队 52 全绿（monodark M1d 计算态改锚+nodemo F1 计数改锚）；验证 ×2 先验后推 0 mismatch；线上探针 fc 632 8/8；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.26；FC 当前 v10.28.48.2**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.26 条目+新尾指针在位', read(f).indexOf('v0.2.58.26（补丁位 25→26·新功能轮；2026-10-02') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.26；FC 当前 v10.28.48.2**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+三处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  const anchor25 = '](2026-10-01-v025825-crop-dialog.md)\n';
  step('MEMORY.md 58.25 行在位', s.indexOf(anchor25) !== -1);
  const newLine =
    '- [2026-10-02 — v0.2.58.26 FC 首页真数据+不透明卡片+FC 48.2（rev ' + REV1 + '→' + REV2 + ' commit 未 push）：「能不能顺便把FC的所有并非用户手动创建的测试信息都去除掉，还有把所有FC的首页卡片从玻璃变成不透明的卡片？」+「那个备份能不能一天备份一次不要每次一改就备份？」——' +
    '三项钦定（①只清页面硬编码假数据——演示账号与后端库不动 ②假数字区块接真数据+空态——后端新聚合端点 GET /api/fc/overview；匿名=登录引导卡 58.24 hub 先例 ③玻璃→不透明=只首页卡片——按钮/搜索胶囊保持玻璃）；备份=Cloud Run 快照 SNAPSHOT_INTERVAL_MS 60000→86400000 一天一次（boot/SIGTERM 保底快照保留；若用户指 git 提交节奏另行确认）；' +
    '修法=fluidcanvas FC_OVERVIEW 数据层（cloudMode 登录+USR- 前缀/loadFcOverview/fcNum+fcCompact+fcOverviewStats+fcOverviewWindow）+不透明 CSS .card:not(.profile-header) var(--sidebar-bg)+.lg-backdrop filter/backdrop-filter none（mono-dark 计算态 rgb(16,16,19)）+假数据可执行体零残留+访客 head 挂 fc-guest 锁屏（locked-hero flex/studio-main+accountBar 隐/零数据 API）+后端 routes/public/fc-overview.js requireSession+rateLimit 30/min stats 15 键+windows 7d/28d/month+articles/media/posts npm test 366/366+i18n 30 新键×12 语；' +
    '电池 tmp-battery-fc-632 31/31+舰队 52 全绿（首跑两真红非 flake：monodark M1d 计算态改锚 rgb(16,16,19)、nodemo F1 计数 4→3；各自独立复跑销账）+冒烟 60/60+i18n 34/34+验证 ×2 先验后推 0 mismatch+探针 fc 632 8/8；' +
    '新坑：verify wt 循环死代码（631 克隆 c===null 分支不可达工作树锚从未验证→wt 循环移到 cmds 之后）、grep -cF 行计数 vs split 出现计数两套口径再证（measure-lines 行计数实测改锚：不透明 43/MN_CropDialog 3/avatarCrop 8）、head-gate 锚少括号（classList.add\'fc-guest\'≠classList.add(\'fc-guest\') 零命中即坏锚——写锚前 grep 实测）、访客零 API 两套口径（本地电池零 /api=localhost analytics 跳过 vs live 有全站 /api/analytics/pageview 信标——探针按除信标外零+FC 数据 API 零断言）、Docker Desktop npipe 老坑再证](2026-10-02-v025826-fc-overview-opaque.md)\n';
  s = s.replace(anchor25, anchor25 + newLine);
  const bbAnchor = '**当前线上 rev 00347-skv（v0.2.58.25 裁切弹窗+横幅增高+视频横幅+FC 48.1；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（v0.2.58.26 FC 首页真数据+不透明卡片+FC 48.2；备份一天一次；commit 未 push）；详见 [[backend-build-state]]**');
  const svAnchor = '**当前：站点号 v0.2.58.25（58.25 裁切弹窗+横幅增高+视频横幅+FC 48.1 同轮；rev 00347-skv；commit 未 push）、FC v10.28.48.1（48.1 频道卡头像个人裁切+换头像链走裁切弹窗同轮；rev 00347-skv；commit 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.26（58.26 FC 首页真数据+不透明卡片+FC 48.2 同轮；rev ' + REV2 + '；commit 未 push）、FC v10.28.48.2（48.2 FC 首页真数据+不透明卡片同轮；rev ' + REV2 + '；commit 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-10-02-v025826-fc-overview-opaque.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（v0.2.58.26') !== -1 && s2.indexOf('站点号 v0.2.58.26（58.26 FC 首页真数据') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-10-02-v025826-fc-overview-opaque.md';
  const body =
    '---\n' +
    'name: 2026-10-02-v025826-fc-overview-opaque\n' +
    'description: v0.2.58.26 FC 首页真数据+不透明卡片+FC 48.2 同轮（rev ' + REV1 + '→' + REV2 + ' 未 push）——FC 假数据全撤接 GET /api/fc/overview 真聚合端点+首页卡片玻璃→不透明+备份一天一次（SNAPSHOT_INTERVAL_MS 86400000）；三项钦定全文；电池 31/31+舰队 52+探针 8/8；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.26 — FC 首页真数据+不透明卡片（2026-10-02）\n\n' +
    '用户「能不能顺便把FC的所有并非用户手动创建的测试信息都去除掉，还有把所有FC的首页卡片从玻璃变成不透明的卡片？」+「那个备份能不能一天备份一次不要每次一改就备份？」。\n\n' +
    '**真身**：fluidcanvas 首页硬编码假数据（SIMULATED_FILES 演示文件族/48.2K 假统计/假分析数据/演示草稿）+首页卡片玻璃效果（lg-backdrop blur）。\n\n' +
    '**三项钦定**（AskUserQuestion）：①清除范围=只页面硬编码假数据（演示账号与后端库不动）②假数字区块=接真实数据+空态——后端加真实聚合端点 GET /api/fc/overview；匿名=登录引导卡（58.24 hub 先例）③玻璃→不透明=只首页卡片（按钮/搜索胶囊保持玻璃）。\n\n' +
    '**备份一天一次**（2026-10-02 轮中用户补报）：Cloud Run 快照 SNAPSHOT_INTERVAL_MS 60000→86400000（boot/SIGTERM 保底快照保留）；tmp-deploy-632.ps1 describe+override 模式（env 全从 describe，只覆盖该键）。若用户原话「备份」指 git 提交节奏——另行确认（已告知用户）。\n\n' +
    '**修法**：\n' +
    '- fluidcanvas.html FC_OVERVIEW 数据层：cloudMode=SlatiDB.isLoggedIn()&&!!user&&String(user.id).indexOf(\'USR-\')===0；var FC_OVERVIEW=null；loadFcOverview(force,cb)；boot 调用；fcNum/fcCompact/fcOverviewStats/fcOverviewWindow 四视图（统计卡/紧凑条/分析区/窗口趋势）。\n' +
    '- 不透明 CSS：body.fc-page .card:not(.profile-header){background:var(--sidebar-bg)} + .lg-backdrop{filter:none;backdrop-filter:none}——computed light rgba(255,255,255,0.95)/dark rgb(26,26,46)/mono-dark rgb(16,16,19)（旧玻璃 rgba(21,21,25,0.55) 撤）。\n' +
    '- 假数据全撤：SIMULATED_FILES/simulateFilePick/\'48.2K\'/slati_demo_article_content 可执行体零残留+空态链 FT(\'fc.analytics.noData\')。\n' +
    '- 访客门禁：head 同步挂 fc-guest 类（未登录）→ .fc-locked-hero flex/.studio-main none/#accountBar none/零数据 API（全站 pageview 信标除外）。\n' +
    '- 后端：routes/public/fc-overview.js GET /api/fc/overview requireSession+rateLimit 30/min；bare object stats 15 keys+windows {\'7d\'|\'28d\'|\'month\'：{from,to,newFollowers,...}} +articles/media/posts；npm test 366/366。\n' +
    '- i18n：fluidcanvas 30 新键×12 语（zh-Hant 只 OpenCC；__ZH_HANT_AUTO__ ×2）；CSS 页面专属块跳过 inline-css.js；site-config 58.26+48.2 双 changelog。\n\n' +
    '**验证全链**：tmp-battery-fc-632 新 31/31（F 静态+B 访客零 API 锁屏+C 罐头云 15 键+L live）→舰队 52 套全绿（首跑两真红非 flake：monodark M1d 卡片计算态 rgba(21,21,25,0.55)→rgb(16,16,19)、community-nodemo F1 计数 4→3——各自改锚独立复跑 29/29+30/30 销账）+冒烟 60/60+i18n 34/34+npm test 366/366｜镜像验证两次构建各验一次先验后推 0 mismatch（verify#1 占位 00348-XXX ×2+00349-??? ×2；verify#2 终态 ' + REV1 + ' 真值 ×2+00348-XXX 零残留）｜线上探针 fc 632 8/8（S1a site-config 58.26/48.2+58.25/48.1 赋值零残留+changelog 头各 ×1/S1b rev live 口径 ' + REV1 + ' ×2+00348-XXX 零残留+00349-??? 占位 ×2+00349-hgc 零残留/S1c fluidcanvas 15 锚行计数/S1d i18n 3 样键 ×12+__ZH_HANT_AUTO__ ×2/S2 /api/fc/overview 匿名 401+health 200/P1 CDP 访客锁屏 locked-hero flex+studio-main+accountBar 隐+除 pageview 信标外零 /api/E1 零异常）。\n' +
    'digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态。\n\n' +
    '**新坑**：\n' +
    '1. verify wt 循环死代码：631 克隆的 c===null 分支（工作树锚）不可达——wt 循环移到 cmds 循环之后才真正验证工作树锚。\n' +
    '2. grep -cF 行计数 vs split 出现计数两套口径再证：tmp-measure-632.js 出现口径测 50/4/12 但 docker grep -cF 行口径 43/3/8——新 tmp-measure-632-lines.js 行计数实测后改锚（家规：测量口径必须与验证口径一致）。\n' +
    '3. head-gate 锚少括号：classList.add\'fc-guest\'（无括号）≠ 实际 classList.add(\'fc-guest\')——grep 实测零命中即坏锚，写锚前必须 grep 核实（58.21 探针选择器先例再证）。\n' +
    '4. 访客零 API 两套口径：本地电池零 /api 请求（analytics 在 localhost 跳过）vs live 有全站 /api/analytics/pageview 信标——探针按「除信标外零 + FC 数据 API（/api/social|fc|tags|uploads|users|auth|topics|media/）零」断言。\n' +
    '5. Docker Desktop 未运行 npipe 连不上（老坑再证）：Start-Process+轮询 docker info 直到 up 再 build。\n' +
    '6. 备份一天一次=env 覆盖模式：SNAPSHOT_INTERVAL_MS 不在代码而在 deploy describe+override（代码仍读 env——重启后设置保持）。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-10-01-v025825-crop-dialog]]、[[2026-09-30-v025824-hub-nodemo]]、[[2026-09-23-fc-v102842-opaque]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.26 — FC 首页真数据+不透明卡片') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
