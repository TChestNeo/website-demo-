// tmp-update-memory-628.js — v0.2.58.22 记忆仪式：
//   ① backend-build-state.md 头旋转（REV2 新 head；00339-m4j 降前身）
//   ② site-versioning-scheme.md 追加 58.22 条目+当前指针
//   ③ MEMORY.md 新行+三处「当前」指针更新
//   ④ 新记忆文件 2026-09-30-v025822-banner-tier-gold.md
'use strict';
const REV1 = '00340-wgj';   // 部署#1 瞬态真 rev（部署后填真值）
const REV2 = '00341-hbw';   // 部署#2 终态真 rev（部署后填真值）
const DIGEST = 'sha256:f0c4b97ec724a61c59f7badb60c3d23ef9d71480d6aa138e80ca18ca09862bb3'; // 二次烘焙 push digest（=当前线上，push 后填真值）
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
  const headAnchor = '**当前线上 rev 00339-m4j（';
  const demote = '**前身 rev 00339-m4j（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-09-30 v0.2.58.22 横幅订阅三层门禁+金罩+预设扩展——用户「那个横幅的从图库中选择和上传图片的能不能改成只限于基础订阅项 然后 如果要使用动图就要高级订阅，然后没有订阅的就只能调整横幅的单色和渐变颜色，就是例如黑白中间有渐变的那种效果，还有图库按钮点击后的弹窗能不能大有点？还有我希望那个按钮是在没有订阅的用户目前是被特别的金色罩子盖住的而不是点击后才出现提示反馈」；' +
    '四项钦定（①两处一起改 ②免费层=扩展预设色卡 6 玻璃+6 单色/黑白系共 13 格点选即存 cardBg 落库 ③金罩=所有被锁按钮且相邻按钮共用一个罩 ④头像保持现状）；' +
    '三层门禁 tier 矩阵：free=横幅只预设色卡（上传/图库金罩锁）+头像静态上传 OK；basic=横幅静态图+图库 OK，gif 锁（premGifUpgrade 双行）；premium/ultra=全部含 gif；祖父=已有 bannerUrl 继续显示+移除永可用；' +
    '修法=资料页 canGif=sub&&(u.tier===\'premium\'||u.tier===\'ultra\') 读服务端 tier+blockGif !sub→!canGif+横幅上传 click 门+change 门双保险（直喂文件零上传）+avatarUpText/bannerUpText tier 矩阵+金罩 .gold-lock-group 相邻共罩（伪元素 pointer-events:none 点击穿透到按钮 toast 保留）+.gold-locked 圆钮+预设网格 data-bg+保存 diff editCardBg!==(u.cardBg||null)+FC 图库弹窗 560→680px+缩略 64→80px；' +
    'settings-modal stCanImg()/stCanGif()/ST_BG_KEYS/ST_BG_DEFS 13 预设（#settingsCard 前缀防 40+ 页碰撞）+settingsBgGrid 点选即 PATCH {cardBg} + stRawMergeUser 合并+横幅 upload+lib 恒包 span（付费零类——el() 不摊平嵌套数组 appendChild 非 Node 崩）+stUpgradeLink tier 矩阵（canGif 返回 \'\' 字符串走 insertAdjacentHTML 安全）+弹窗 300→400px 4 列+max-width calc 防溢出；' +
    '后端 CARD_BG_KEYS 白名单六键（auth.js+social.js 同款数组）npm test 359/359；' +
    'i18n common 5 新键+prof 3 新键×12 语（zh-Hant OpenCC 重生成）；CSS 全进页面/settings 专属块→跳过 inline-css.js；site-config 58.22 单 changelog（FC 恒 48.0 零条目）rev 前缀 ×1；' +
    '新电池 settings-profilecust 28/28（S10 free 金罩+门禁/S11 预设点选 PATCH {cardBg}/S12 basic 三段）+profile-subtier 28/28（D6 free 预设+basic 双行 premGifUpgrade/D7 订阅全解锁/D8 祖父）+金丝雀 community-profile 100/100+i18n 34/34+冒烟 60/60+舰队 48 套全绿（grep exit=1|💥 复核零命中；tier-gating F2c 订阅计数 5→9 锚改后独立复跑 29/29 销账）；' +
    '镜像内容验证两次构建各验一次先验后推（二次锚改终态口径 ' + REV1 + ' 真值在位+00340-XXX 占位零残留）；线上探针 usercard 628（S1 静态八面+S1f rev 终态口径 00340- 真值+00340-XXX 零残留+00341-??? 占位/P1 侧栏弹窗/P2 free 金罩+13 swatch+点罩内上传钮零崩溃/E1 零异常）；' +
    'digest ' + DIGEST + '（二次烘焙镜像=当前线上）；commit 未 push；rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 文本滞后一部署=惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00339-m4j（') !== -1 && read(f).indexOf('**当前线上 rev 00339-m4j（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.21；FC 当前 v10.28.48.0**。';
  step('versioning 58.21 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.22（补丁位 21→22·新功能轮；2026-09-30；FC 恒 v10.28.48.0）**：横幅订阅三层门禁+金罩+预设扩展——用户「那个横幅的从图库中选择和上传图片的能不能改成只限于基础订阅项…没有订阅的就只能调整横幅的单色和渐变颜色…按钮是被特别的金色罩子盖住的而不是点击后才出现提示反馈」；' +
    '四项钦定：①两处一起改（设置弹窗+资料页编辑弹窗同口径）②免费层=扩展预设色卡 13 格（6 玻璃+墨黑/纯白/石板灰/黑白渐变/银灰渐变/炭黑渐变）点选即存 cardBg 落库 ③金罩=所有被锁按钮+相邻按钮共用一个罩 ④头像保持现状；' +
    '三层：free=横幅只预设（上传/图库金罩锁）+头像静态上传 OK；basic=静态图+图库，gif 锁；premium/ultra=全部；祖父+移除永可用；' +
    '修法=资料页 canGif 谓词读服务端 tier+上传 click/change 双门+金罩相邻共罩（pointer-events:none 点击穿透 toast 保留）+FC 图库弹窗 680px；settings-modal stCanImg/stCanGif+13 预设网格点选即存+弹窗 400px 4 列；' +
    '后端 CARD_BG_KEYS 白名单六键；i18n 8 新键×12 语；ethereal 零改动→跳过 inliner；' +
    '电池 settings-profilecust 28/28+profile-subtier 28/28+金丝雀 community-profile 100/100+i18n 34/34+冒烟 60/60+舰队 48 套全绿（tier-gating F2c 锚改独立复跑销账）；镜像验证 ×2（两次构建各验一次先验后推）；线上探针 usercard 628；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.22；FC 当前 v10.28.48.0**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.22 条目+新尾指针在位', read(f).indexOf('v0.2.58.22（补丁位 21→22·新功能轮；2026-09-30') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.22；FC 当前 v10.28.48.0**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+三处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  const anchor21 = '](2026-09-30-v025821-sidebar-pop-settings.md)\n';
  step('MEMORY.md 58.21 行在位', s.indexOf(anchor21) !== -1);
  const newLine =
    '- [2026-09-30 — v0.2.58.22 横幅订阅三层门禁+金罩+预设扩展（rev ' + REV1 + '→' + REV2 + ' commit 未 push）：「那个横幅的从图库中选择和上传图片的能不能改成只限于基础订阅项…没有订阅的就只能调整横幅的单色和渐变颜色…按钮是被特别的金色罩子盖住的而不是点击后才出现提示反馈」——' +
    '四项钦定（两处一起改/免费层 13 预设色卡点选即存 cardBg/金罩相邻共罩/头像保持现状）；三层门禁 free=只预设（上传图库金罩锁）/basic=静态图+gif 锁/premium=全含 gif；' +
    '修法=资料页 canGif 读服务端 u.tier+上传 click/change 双门+金罩 pointer-events:none 点击穿透 toast 保留+FC 弹窗 680px；settings-modal stCanImg/stCanGif+ST_BG_DEFS 13 预设+弹窗 400px 4 列；后端白名单六键 npm test 359/359；' +
    '电池 28/28+28/28+金丝雀 community-profile 100/100+舰队 48 全绿（tier-gating F2c 锚改复跑销账）+冒烟 60/60+i18n 34/34+验证 ×2 先验后推+探针 628 14/14 全绿；' +
    '新坑：el() 不摊平嵌套数组（[up,lib] 直接进 children appendChild 非 Node 崩——恒包 span）、textContent 含 icon ligature 字形名（settings 升级链接精确串断言要带 workspace_premium 前缀、页面链接无图标不带）、canGif 读页载时 profileUser.tier（电池切 tier 必 Page.reload 后重开弹窗）、community-profile 金丝雀 S2 是 58.21 遗留旧交互（侧栏锚真导航→改弹窗两段式）](2026-09-30-v025822-banner-tier-gold.md)\n';
  s = s.replace(anchor21, anchor21 + newLine);
  const bbAnchor = '**当前线上 rev 00339-m4j（v0.2.58.21 侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义；FC 恒 v10.28.48.0；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（v0.2.58.22 横幅订阅三层门禁+金罩+预设扩展；FC 恒 v10.28.48.0；commit 未 push）；详见 [[backend-build-state]]**');
  const svAnchor = '**当前：站点号 v0.2.58.21（58.21 侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义；rev 00339-m4j；commit 未 push）、FC v10.28.48.0（48.0 频道卡头像图+点击换头像同轮；rev 00337-wxl；commit 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.22（58.22 横幅订阅三层门禁+金罩+预设扩展；rev ' + REV2 + '；commit 未 push）、FC v10.28.48.0（48.0 频道卡头像图+点击换头像同轮；rev 00337-wxl；commit 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-09-30-v025822-banner-tier-gold.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（v0.2.58.22') !== -1 && s2.indexOf('站点号 v0.2.58.22（58.22 横幅订阅三层门禁') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-09-30-v025822-banner-tier-gold.md';
  const body =
    '---\n' +
    'name: 2026-09-30-v025822-banner-tier-gold\n' +
    'description: v0.2.58.22 横幅订阅三层门禁+金罩+预设扩展轮（rev ' + REV1 + '→' + REV2 + ' 未 push）——free 只预设色卡/basic 静态图/premium 含 gif 三层门禁；金罩相邻共罩 pointer-events:none 点击穿透；13 预设点选即存 cardBg；FC 图库弹窗加大；settings 弹窗 400px 4 列；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.22 — 横幅订阅三层门禁+金罩+预设扩展（2026-09-30）\n\n' +
    '用户「那个横幅的从图库中选择和上传图片的能不能改成只限于基础订阅项 然后 如果要使用动图就要高级订阅，然后没有订阅的就只能调整横幅的单色和渐变颜色，就是例如黑白中间有渐变的那种效果，还有图库按钮点击后的弹窗能不能大有点？还有我希望那个按钮是在没有订阅的用户目前是被特别的金色罩子盖住的而不是点击后才出现提示反馈」。\n\n' +
    '**四项钦定**：①两处一起改（设置弹窗+资料页编辑弹窗同口径）②免费层=扩展预设色卡（6 玻璃渐变+6 单色/黑白系=13 格点选即存，复用 cardBg 落库）③金罩=所有被锁按钮，**相邻按钮共用一个罩子**（不两个）④头像保持现状（免费仍可传静态头像，仅图库钮锁）。\n\n' +
    '**三层门禁 tier 矩阵**：free=横幅**只预设色卡**（上传/图库金罩锁）+头像静态上传 OK；basic=横幅静态图+图库 OK，gif 锁（premGifUpgrade 双行链接）；premium/ultra=全部含 gif。祖父=free 已有 bannerUrl 继续显示，移除按钮永可用。\n\n' +
    '**修法**（docs/pages/community-profile.html + docs/assets/js/settings-modal.js + 后端白名单）：\n' +
    '- 资料页：canGif=sub&&(u.tier===\'premium\'||u.tier===\'ultra\') **读服务端 u.tier**（GET 响应，非本地）+blockGif !sub→!canGif（basic 的 gif 也被拦）+横幅上传 click 门+change 门双保险（free 直喂文件零上传）+avatarUpText/bannerUpText tier 矩阵（free=旧键 gifUpgrade/imgUpgrade；basic=premGifUpgrade 双行）+金罩 .gold-lock-group span 包相邻钮（::after 金渐变+::before lock 字形，全 pointer-events:none 点击穿透到按钮→toast 反馈保留）+头像图库圆钮 .gold-locked+预设网格 data-bg 点选改 editCardBg+保存 diff editCardBg!==(u.cardBg||null) 才入 body+FC 图库弹窗 maxWidth 560→680px+缩略 64→80px。\n' +
    '- settings-modal：stCanImg()（tier&&tier!==\'free\'）/stCanGif()（premium/ultra）/ST_BG_KEYS（12 键）/ST_BG_DEFS 13 预设（**#settingsCard 前缀作用域防 40+ 页类名碰撞**）+settingsBgGrid 点选即 PATCH {cardBg}+stRawMergeUser 合并写+横幅 upload+lib **恒包 span（付费也包零类——el() 不摊平嵌套数组，直接 [up,lib] 进 children 被 appendChild 当非 Node 抛 TypeError）**+stUpgradeLink tier 矩阵（canGif 返回 \'\' 字符串走 insertAdjacentHTML 分支安全，绝不返回 null/undefined）+stUpload gif 判定 !stCanGif()+弹窗 width 300→400px+repeat(4,1fr)+max-width calc(100% - 32px) 防溢出。\n' +
    '- 后端：CARD_BG_KEYS 白名单六键（\'solid-black\',\'solid-white\',\'solid-gray\',\'mono-bw\',\'mono-silver\',\'mono-charcoal\'）auth.js+social.js 同款数组——漏一=新预设 PATCH 400。npm test 359/359。\n' +
    '- i18n：common 5 新键+prof 3 新键×12 语（zh-Hant OpenCC 重生成；en 值=兜底串逐字节一致）。CSS 全进页面/settings 专属块→跳过 inline-css.js。site-config 58.22 单 changelog 条目（FC 恒 48.0）rev 前缀 ×1。\n\n' +
    '**验证全链**：新电池 settings-profilecust 28/28（S10 free 金罩结构+门禁 toast+零上传/S11 预设点选 PATCH 恰 {cardBg} /S12 basic 零金罩+静态放行+gif 锁三段）+profile-subtier 28/28（D6 free 预设+basic 双行 premGifUpgrade/D7 订阅全解锁+D6 重载同步 tier/D8 祖父）｜金丝雀 community-profile 100/100（S2 改弹窗两段式+1）+i18n 34/34+冒烟 60/60｜舰队 48 套全绿（grep exit=1|💥 复核零命中；tier-gating F2c 订阅计数 5→9 锚改后独立复跑 29/29 销账）｜镜像验证两次构建各验一次先验后推｜线上探针 usercard 628（S1 静态八面/S1f rev 终态口径/P1 侧栏弹窗/P2 free 金罩+13 swatch+点罩内上传钮零崩溃/E1 零异常）。\n' +
    'digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态。\n\n' +
    '**新坑**：\n' +
    '1. el() 助手不摊平嵌套数组：children.forEach 遇数组走 else 分支 appendChild(array) → TypeError: parameter 1 is not of type \'Node\'——付费分支 return [up, lib] 直接崩（电池 S5 premium 抓出）。修法=恒包 span（免费金罩类/付费零类）。\n' +
    '2. 升级链接 textContent 含 icon ligature 字形名：settings 链接带 workspace_premium 图标 → textContent=\'workspace_premium订阅后解锁横幅图片与 GIF 动图\'，精确串断言要带字形名前缀；页面链接无图标（纯文本）——两处口径不同逐处实测。\n' +
    '3. canGif 谓词读 profileUser.tier（页载 GET 响应）——电池切换 tier 只改 localStorage 不够，必须 Page.reload 让 GET 罐头按新 localStorage 同步 tier 再开弹窗（真后端读 DB 同义）。\n' +
    '4. community-profile 金丝雀 S2 是 58.21 遗留旧交互：侧栏锚真导航已改弹窗拦截——本电池 58.21 不在舰队从未被扫到，本轮金丝雀 FATAL 暴露；改两段式（弹窗断言+点 #userPopViewBtn 导航）新断言 +1 变 100/100。\n' +
    '5. sed 扫后手改锚漂移：avatarUpText 修复追加 canGif ×1+premGifUpgrade ×1——D0/verify 计数锚必须修复后重测（实测先行家规覆盖：改完先 grep -oF 再改锚）。\n' +
    '6. sidebar-userpop 电池零 site-config/rev 锚（只有 sidebar.js/i18n 计数）——sed 扫到它只改头注释无害；但每轮 sed 后必须逐个 grep 审计 EXCLUDE 外的漏网电池。\n' +
    '7. tier-gating F2c 订阅计数锚随 58.22 新兜底串漂移：cnt(smSrc,\'订阅\') 5→9（stCanImg/stCanGif 注释 ×2+升级链接兜底 ×3+bannerLocked 兜底+订阅谓词注释改文）——与 58.21 同款先例，锚改后独立复跑 29/29 销账。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-09-30-v025821-sidebar-pop-settings]]、[[2026-09-30-v025819-profile-subtier]]、[[2026-09-30-v025820-avatar-sync]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.22 — 横幅订阅三层门禁+金罩+预设扩展') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
