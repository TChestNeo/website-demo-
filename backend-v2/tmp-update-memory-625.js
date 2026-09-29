// tmp-update-memory-625.js — v0.2.58.19 记忆仪式：
//   ① backend-build-state.md 头旋转（00335-??? 新 head；00333-kkx 降前身）
//   ② site-versioning-scheme.md 追加 58.19 条目+当前指针
//   ③ MEMORY.md 新行+两处「当前」指针更新
//   ④ 新记忆文件 2026-09-29-v025819-profile-subtier.md
//   部署后 Edit 三常量填真值再跑：REV1=部署#1 真 rev 后缀、REV2=部署#2 真 rev 后缀、DIGEST=最终 push digest。
'use strict';
const REV1 = '00334-tz6';   // ← 部署#1 真 rev
const REV2 = '00335-fmn';   // ← 部署#2 真 rev
const DIGEST = 'sha256:d8d9116f9c62976e2d32cf82e56eb255ff7309d3a4bea18c569ce7f7f7d33a69'; // ← 二次烘焙 push digest（=当前线上）
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
  const headAnchor = '**当前线上 rev 00333-kkx（';
  const demote = '**前身 rev 00333-kkx（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-09-30 v0.2.58.19 个人资料横幅/头像订阅分层——用户「能不能在个人资料设置内也添加这个功能类似discord那种分成基本和付费，还有这个和用户的频道主页的横幅是不互通的」；' +
    '三项钦定：分层=免费（静态图 jpg/png/webp 上传）vs 付费（gif 动图+FC 图库来源，tier∈{basic,premium,ultra}=订阅，free/无 tier=受限）/' +
    '纯前端门禁（同「边缘主题」组先例：锁 UI+点击 toast 不生效+premium.html 升级链接，后端零改动）/FC 频道主页（fluidcanvas.html #channelOverview）零改动天然不互通；' +
    '修法=community-profile.html 渲染 sub-locked 类+两升级链接（avatarGifUpgradeLink/bannerGifUpgradeLink）+blockGif 助手三入口（横幅文件/图库统一漏斗 uploadBannerBlob 首行+' +
    '头像文件 change+头像图库 conv 后）+图库 click 双拦截（选择器绝不打开零 DOM 零上传零 PATCH）+CSS .sub-locked 独立类（不复用 .edge-locked——其选择器只命中 swatch）；' +
    '祖父=免费已有 gif 继续显示（渲染无 tier 检查）+移除永可用+pageBg 组故意不对称（不在本轮范围，changelog 注明）；i18n 3 新键×12 语；CSS 全进页面专属块→跳过 inline-css.js；' +
    'FC 恒 v10.28.47.4；后端零改动 npm test 359/359 不重跑+新电池 profile-subtier 21/21+旧电池 profile-banner 122/122（B 组 seedUser 加 tier:\'premium\' 注入修正）+' +
    '舰队 45 套全绿（grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；镜像内容验证 38/38+39/39（两次构建各验一次、先验后推——二次验证锚改终态口径 00334-tz6 真值在位+占位零残留）；' +
    '线上探针 profile-subtier 12/12（S1 页面订阅件+58.19+rev 前缀/S2 端点形状 health 60 表+public users+真 id 主页 bannerUrl 键/S3 PII 零 bannerUrl/' +
    'S4 FC 不互通铁证 fluidcanvas 零 bannerUrl/P1 CDP 匿名渲染/E1 零异常）；digest ' + DIGEST + '（二次烘焙镜像=当前线上）；' +
    'commit 未 push；rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 文本滞后一部署=惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00333-kkx（') !== -1 && read(f).indexOf('**当前线上 rev 00333-kkx（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.18；FC 当前 v10.28.47.4**。';
  step('versioning 58.18 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.19（补丁位 18→19·新功能轮；2026-09-30）**：个人资料横幅/头像订阅分层——用户「能不能在个人资料设置内也添加这个功能类似discord那种分成基本和付费，还有这个和用户的频道主页的横幅是不互通的」；' +
    '三项钦定：免费=静态图 jpg/png/webp 上传 vs 付费=gif 动图+FC 图库（tier∈{basic,premium,ultra}）／纯前端门禁（锁 UI+点击 toast+premium.html 升级链接，后端零改动）／FC 频道主页零改动不互通；' +
    '修法=sub-locked 渲染类+两升级链接+blockGif 三入口（横幅文件/图库统一漏斗+头像文件+头像图库）+图库 click 双拦截（选择器绝不打开）+CSS .sub-locked 独立类；' +
    '祖父：免费已有 gif 继续显示、移除永可用；pageBg 组故意不对称（不在本轮范围）；i18n 3 新键×12 语；CSS 全进页面专属块→跳过 inliner；FC 恒 v10.28.47.4；' +
    '后端零改动 npm test 359/359 不重跑；新电池 profile-subtier 21/21+旧电池 profile-banner 122/122（tier 注入修正）+舰队 45 套全绿+冒烟 60/60+i18n 34/34；' +
    '镜像验证 38/38+39/39（两次构建各验一次、先验后推）；线上探针 profile-subtier 12/12；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.19；FC 当前 v10.28.47.4**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.19 条目+新尾指针在位', read(f).indexOf('v0.2.58.19（补丁位 18→19·新功能轮；2026-09-30）') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.19；FC 当前 v10.28.47.4**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+两处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  // 新行插在 58.18 行之后
  const anchor18 = '](2026-09-29-v025818-profile-banner.md)\n';
  step('MEMORY.md 58.18 行在位', s.indexOf(anchor18) !== -1);
  const newLine =
    '- [2026-09-30 — v0.2.58.19 个人资料横幅/头像订阅分层（rev ' + REV1 + '→' + REV2 + ' commit 未 push）：「能不能在个人资料设置内也添加这个功能类似discord那种分成基本和付费，还有这个和用户的频道主页的横幅是不互通的」——' +
    '三项钦定（免费=静态图/付费=gif+FC 图库、纯前端门禁后端零改动、FC 频道主页零改动不互通）；修法=sub-locked 渲染+blockGif 三入口+图库 click 双拦截+两升级链接+CSS .sub-locked 独立类；' +
    '祖父=已有 gif 继续显示+移除永可用+pageBg 故意不对称；新电池 21/21+旧电池 122/122（B 组 tier 注入）+舰队 45 全绿+冒烟 60/60+i18n 34/34+验证 38/38+39/39+探针 12/12；' +
    '新坑：sed token 计划 00333-→00335- 实为 00332-→00335- 误写（实测计数先行抓到）、新电池 about:blank localStorage SecurityError（先 nav 到 http origin 再 clear+seed+reload）、' +
    '订阅态 bannerLibBtn 无图标无徽标（sub 分支整体不渲染）、zh-Hant 块键双引号→verify 单引号锚计数 11 非 12、' +
    'cit2usr.js:62 5 文件版本锚随 sed 同扫（计划注记与舰队全绿门槛冲突按门槛执行）、verify 00334-XXX 锚在二次烘焙前被填真值→二次验证 1 红改终态口径（真值在位+占位零残留）](2026-09-30-v025819-profile-subtier.md)\n';
  s = s.replace(anchor18, anchor18 + newLine);
  // backend-build-state 行「当前线上」指针
  const bbAnchor = '**当前线上 rev 00333-kkx（v0.2.58.18 个人资料自定义横幅/头像；FC 恒 v10.28.47.4；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（v0.2.58.19 个人资料横幅/头像订阅分层；FC 恒 v10.28.47.4；commit 未 push）；详见 [[backend-build-state]]**');
  // site-versioning 行「当前」指针
  const svAnchor = '**当前：站点号 v0.2.58.18（58.18 个人资料自定义横幅/头像；rev 00333-kkx；commit 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.19（58.19 个人资料横幅/头像订阅分层；rev ' + REV2 + '；commit 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-09-30-v025819-profile-subtier.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（v0.2.58.19') !== -1 && s2.indexOf('站点号 v0.2.58.19（58.19 个人资料横幅/头像订阅分层') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-09-30-v025819-profile-subtier.md';
  const body =
    '---\n' +
    'name: 2026-09-30-v025819-profile-subtier\n' +
    'description: v0.2.58.19 个人资料横幅/头像订阅分层轮（rev ' + REV1 + '→' + REV2 + ' 未 push）——纯前端门禁免费=静态图/付费=gif+FC 图库；sub-locked+blockGif 三入口+图库双拦截+两升级链接；FC 频道主页零改动不互通；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.19 — 个人资料横幅/头像订阅分层（2026-09-30）\n\n' +
    '用户「能不能在个人资料设置内也添加这个功能类似discord那种分成基本和付费，还有这个和用户的频道主页的横幅是不互通的」。' +
    '真身：58.18 刚给编辑弹窗加了横幅/头像功能（上传+FC 图库双来源、gif 全家放行）但无任何分层。\n\n' +
    '**三项钦定**（全按推荐）：①分层=免费（静态图 jpg/png/webp 上传，横幅+头像）vs 付费（gif 动图+FC 图库来源；判定 isSubscriberUser()，tier∈{basic,premium,ultra}=订阅，free/无 tier=受限）' +
    '②纯前端门禁（同「边缘主题」组先例：锁 UI+点击 toast 不生效+premium.html 升级链接；后端零改动）' +
    '③FC 频道主页（fluidcanvas.html #channelOverview）零改动——资料横幅与其天然不互通（FC 卡不读 users.banner_url）。\n\n' +
    '**修法**（docs/pages/community-profile.html，后端零改动）：\n' +
    '- 渲染：#editAvatarLibBtn/#editBannerLibBtn 非订阅加 .sub-locked 类+title=prof.edit.subLocked+lock 图标（横幅钮 sub 分支无图标无徽标——`(sub?\'\':\'<span>lock</span>\')` 整体不渲染）+「订阅」徽标；' +
    '两升级链接 #avatarGifUpgradeLink/#bannerGifUpgradeLink（display 随 sub 切、href=premium.html、T(\'prof.edit.gifUpgrade\')）。\n' +
    '- blockGif(ext) 助手三入口：uploadBannerBlob 首行（横幅文件/图库统一漏斗——上传与图库双来源同链）+头像文件 change 算 ext 后+头像图库 conv 后；' +
    'toast T(\'prof.toast.gifLocked\') 后 return（fetch 前拦截→editBannerUrl 永不赋值→不进保存 body）。\n' +
    '- 图库 click 双拦截（横幅/头像）：非订阅 toast T(\'prof.toast.libLocked\') 后 return——openFcLibraryPicker 之前，选择器绝不打开（零 DOM 零 POST /uploads 零 PATCH）。\n' +
    '- CSS .sub-locked { opacity: 0.55; cursor: not-allowed; } 独立类（不复用 .edge-locked——其选择器只命中 swatch；按钮是 .btn）全进页面专属块→跳过 inline-css.js。\n' +
    '- i18n 3 新键×12 语（prof.toast.gifLocked/prof.toast.libLocked/prof.edit.gifUpgrade；zh-Hant OpenCC 重生成、en 值=页面兜底串逐字节一致）；复用 prof.edit.subLocked/subBadge。\n\n' +
    '**边界**：祖父=免费已有 gif 横幅/头像继续显示（渲染无 tier 检查）+预览预填原图+移除按钮永可用（保存发 bannerUrl:null）+换静态图正常覆盖；' +
    'pageBg 页面背景组故意不对称（不在本轮范围，免费仍可传 gif 页背景——changelog 注明）；imgOnly 文案仍列 gif（blockGif 先触发且文案已说明专属性）。\n\n' +
    '**验证全链**：后端零改动 npm test 359/359 不重跑｜新电池 profile-subtier 21/21（D0 静态锚/D1 免费锁 UI/D2-D3 图库拦截三零/D4-D5 gif 拦截/D6 静态放行 PATCH 精确/D7 订阅全解锁/D8 祖父/D9 FC 锚/D10 零 error；' +
    '不 stub isSubscriberUser——localStorage 种/不种 tier:\'premium\' 驱动）｜旧电池 profile-banner 122/122（B 组 seedUser 加 tier 注入修正）｜' +
    '舰队 45 套全绿（grep exit=1|💥 复核零命中）｜冒烟 60/60｜i18n 34/34｜镜像验证 38/38+39/39（两次构建各验一次、先验后推）｜线上探针 profile-subtier 12/12。\n' +
    'digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态。\n\n' +
    '**新坑**：\n' +
    '1. sed token 计划「00333-→00335-」实为 00332-→00335- 误写——activity/following 断言占位对是 \'rev 00331-XXX\'/\'rev 00332-???\'；实测计数先行（家规）抓到。\n' +
    '2. 新电池首跑 about:blank 透明 origin 读 localStorage SecurityError——必须先 nav 到 http origin 再 clear+seed+Page.reload；' +
    '崩溃清理加 module 级 T0/CHROME0 引用在 catch 里 close/kill 再 exit(1)（否则 Windows UV assert 噪音+exit code 9 非 1，舰队 grep 漏抓）。\n' +
    '3. 订阅态 editBannerLibBtn 无 .material-symbols-outlined（sub 分支整体不渲染图标徽标）——断言 bIconEl===null&&bBadge===null（头像钮 icon 恒渲染=photo_library）。\n' +
    '4. zh-Hant 块键用双引号（`"prof.toast.gifLocked"`）——verify 单引号锚 `\'prof.toast.gifLocked\'` 计数 11 非 12。\n' +
    '5. cit2usr.js:62「5 文件含 58.18」断言随版本 token 同扫成「含 58.19」——计划注记（那 5 文件不碰）与舰队全绿门槛冲突，按门槛执行（同 624 先例全族同扫）。\n' +
    '6. verify 锚 00334-XXX 在二次烘焙前被填真值 00334-tz6→二次验证 1 红——锚改终态口径（真值在位 ×1+占位零残留 ×0）后 39/39（两次验证项数不同=惯例）。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-09-29-v025818-profile-banner]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.19 — 个人资料横幅/头像订阅分层') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
