// tmp-update-memory-626.js — v0.2.58.20 记忆仪式：
//   ① backend-build-state.md 头旋转（REV2 新 head；00335-fmn 降前身）
//   ② site-versioning-scheme.md 追加 58.20 条目+当前指针
//   ③ MEMORY.md 新行+三处「当前」指针更新
//   ④ 新记忆文件 2026-09-30-v025820-avatar-sync.md
//   部署后 Edit 三常量填真值再跑：REV1=部署#1 真 rev 后缀、REV2=部署#2 真 rev 后缀、DIGEST=最终 push digest。
'use strict';
const REV1 = '00336-7gr';   // ← 部署#1 真 rev
const REV2 = '00337-wxl';   // ← 部署#2 真 rev
const DIGEST = 'sha256:5b8a7d8cc4a65ba0bcf82cfceaf33b2b3d80b150ef13154e40cf5643f69c80cb'; // ← 二次烘焙 push digest（=当前线上）
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
  const headAnchor = '**当前线上 rev 00335-fmn（';
  const demote = '**前身 rev 00335-fmn（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-09-30 v0.2.58.20 个人资料头像↔FC 频道主页头像双向同步+FC v10.28.48.0 同轮——用户「还有个人资料设置里的头像你没有做更换头像是和频道主页同步的当然用户可以勾选是否要同步」+' +
    '边界「还有用户个人资料的自我介绍和频道主页的bio是不互通的」；' +
    '三项钦定：默认勾选（键 slati_avatar_sync 缺失/脏值=ON，谓词 !==\'0\' 两页同款）/双向同步·资料页权威（勾选框只活在资料编辑弹窗；FC 侧频道卡点头像直接换走同一上传+PATCH 链）/bio 不互通（FC PATCH 只发 avatarUrl 绝不 bio，资料页 bio 保存流零改动）；' +
    '修法=community-profile.html 编辑弹窗同步勾选（toggle-switch 复用内联 CSS 零新样式+即时写旗标不经保存事务+保存成功 body.avatarUrl 分支读弹窗 DOM 态 ON 则 raw setItem 合并写 slati_user——' +
    '绝不 SlatiDB.saveUser=storage.js mirrorProfile 双 PATCH 坑）+fluidcanvas.html 频道卡头像（F6 图片卡/F7 editable 类+title 每渲染重打/F8 CSS 相机徽章 hover）+F5 段（fcAvatarSyncOn/fcIsSubscriber tier!==\'free\'/fcEsc/' +
    'fcAvatarFile 隐藏 input 恒挂 body 逃 innerHTML 整换/fcEnsureApi 动态注入 api.js/一次性委托五守卫（closest+editable 类+busy+isLoggedIn+USR- id+旗标）/change 链=gif 非订阅 toast 锁→白名单→10MB→fetch upload→' +
    'MN_API.patch /auth/me 只 {avatarUrl:data.url}→r.ok 才改 UI+raw setItem+#personalAvatar+renderContent）；i18n 1+6 新键×12 语（zh-Hant OpenCC 重生成）；CSS 全进页面专属块→跳过 inline-css.js；' +
    'site-config 双 changelog（站点+FC 同轮）rev 前缀各 ×2；后端零改动 npm test 359/359 不重跑+新电池 profile-avatarsync 25/25+金丝雀（profile-banner 122/122、profile-subtier 21/21、' +
    'community-profile 99/99 三处 58.18 遗留陈旧断言修新口径、fc-i18n 20/20、fc-publish-log 19/19）+舰队 46 套全绿（grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；' +
    '镜像内容验证 61/61×2（两次构建各验一次、先验后推）；线上探针 profile-avatarsync 9/9（S1 页面锚+双 changelog+rev 真值×2 占位零残留/S2 两词典新键/P1 CDP 匿名 FC 客人英雄/E1 零异常；写路径需登录不可探→电池覆盖）；' +
    'digest ' + DIGEST + '（二次烘焙镜像=当前线上）；' +
    'commit 未 push；rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 文本滞后一部署=惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00335-fmn（') !== -1 && read(f).indexOf('**当前线上 rev 00335-fmn（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.19；FC 当前 v10.28.47.4**。';
  step('versioning 58.19 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.20（补丁位 19→20·新功能轮；2026-09-30；FC v10.28.48.0 同轮）**：个人资料头像↔FC 频道主页头像双向同步——用户「还有个人资料设置里的头像你没有做更换头像是和频道主页同步的当然用户可以勾选是否要同步」+' +
    '边界「个人资料的自我介绍和频道主页的bio是不互通的」；' +
    '三项钦定：默认勾选（slati_avatar_sync 缺失=ON）／双向同步·资料页权威（勾选框只活在资料编辑弹窗；FC 频道卡点头像直接换走同一上传+PATCH 链）／bio 不互通（FC PATCH 只发 avatarUrl 绝不 bio）；' +
    '修法=资料页弹窗同步勾选（toggle-switch 复用内联 CSS+即时写旗标+保存成功 raw setItem 合并写 slati_user——绝不 SlatiDB.saveUser 双 PATCH 坑）+FC 频道卡头像图（fcAvatarSyncOn 谓词/F5 段五守卫委托/图片卡+相机徽章+点击换头像）；' +
    'i18n 1+6 新键×12 语；CSS 全进页面专属块→跳过 inliner；后端零改动 npm test 359/359 不重跑；' +
    '新电池 profile-avatarsync 25/25+金丝雀 profile-banner 122/122、profile-subtier 21/21、community-profile 99/99（三处 58.18 遗留陈旧断言修新口径）、fc-i18n 20/20、fc-publish-log 19/19+' +
    '舰队 46 套全绿+冒烟 60/60+i18n 34/34；镜像验证 61/61×2（两次构建各验一次、先验后推）；线上探针 profile-avatarsync 9/9；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.20；FC 当前 v10.28.48.0**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.20 条目+新尾指针在位', read(f).indexOf('v0.2.58.20（补丁位 19→20·新功能轮；2026-09-30') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.20；FC 当前 v10.28.48.0**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+三处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  // 新行插在 58.19 行之后
  const anchor19 = '](2026-09-30-v025819-profile-subtier.md)\n';
  step('MEMORY.md 58.19 行在位', s.indexOf(anchor19) !== -1);
  const newLine =
    '- [2026-09-30 — v0.2.58.20 个人资料头像↔FC 频道主页头像双向同步+FC v10.28.48.0 同轮（rev ' + REV1 + '→' + REV2 + ' commit 未 push）：「还有个人资料设置里的头像你没有做更换头像是和频道主页同步的当然用户可以勾选是否要同步」——' +
    '三项钦定（默认勾选=键缺失 ON、双向同步·资料页权威、bio 不互通 FC PATCH 只发 avatarUrl）；修法=资料页弹窗同步勾选+保存 raw setItem 合并写 slati_user（绝不 SlatiDB.saveUser 双 PATCH 坑）+FC 频道卡头像图/相机徽章/点击换头像五守卫；' +
    '新电池 25/25+金丝雀 122/122+21/21+99/99（三处 58.18 遗留陈旧断言修新口径）+20/20+19/19+舰队 46 全绿+冒烟 60/60+i18n 34/34+验证 61/61×2+探针 9/9；' +
    '新坑：舰队 625 本无 community-profile 电池（金丝雀首跑 3 红全 58.18 遗留）、双版本同轮 rev 前缀计数 ×2（sed 换文本不改计数语义）、storage.js get()=JSON.parse 种子 slati_active_account 必须 JSON.stringify(\'team-1\')、' +
    'localStorage 跨 Page.navigate 持久 guest 分支必 removeItem、profile 页无 #toast 断言用 MN_Report.toast recorder 每次 openModal 重挂、行计数（verify grep -cF 16/2）vs 出现计数（电池 split 18/3）两套口径、FC i18n __ZH_HANT_AUTO__ ×2≠profile ×1](2026-09-30-v025820-avatar-sync.md)\n';
  s = s.replace(anchor19, anchor19 + newLine);
  // backend-build-state 行「当前线上」指针
  const bbAnchor = '**当前线上 rev 00335-fmn（v0.2.58.19 个人资料横幅/头像订阅分层；FC 恒 v10.28.47.4；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（v0.2.58.20 个人资料头像↔FC 频道主页头像双向同步；FC v10.28.48.0；commit 未 push）；详见 [[backend-build-state]]**');
  // site-versioning 行「当前」指针
  const svAnchor = '**当前：站点号 v0.2.58.19（58.19 个人资料横幅/头像订阅分层；rev 00335-fmn；commit 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.20（58.20 个人资料头像↔FC 频道主页头像双向同步；rev ' + REV2 + '；commit 未 push）、FC v10.28.48.0（48.0 频道卡头像图+点击换头像同轮；rev ' + REV2 + '；commit 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-09-30-v025820-avatar-sync.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（v0.2.58.20') !== -1 && s2.indexOf('站点号 v0.2.58.20（58.20 个人资料头像↔FC') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-09-30-v025820-avatar-sync.md';
  const body =
    '---\n' +
    'name: 2026-09-30-v025820-avatar-sync\n' +
    'description: v0.2.58.20 个人资料头像↔FC 频道主页头像双向同步轮（rev ' + REV1 + '→' + REV2 + ' 未 push）+FC v10.28.48.0 同轮——默认勾选（键缺失=ON）/双向·资料页权威/bio 不互通三项钦定；资料页弹窗同步勾选+raw setItem 合并写 slati_user；FC 频道卡头像图+相机徽章+点击换头像；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.20 — 个人资料头像↔FC 频道主页头像双向同步（2026-09-30）\n\n' +
    '用户「还有个人资料设置里的头像你没有做更换头像是和频道主页同步的当然用户可以勾选是否要同步」；边界「还有用户个人资料的自我介绍和频道主页的bio是不互通的」。' +
    '真身：58.18 已给资料编辑弹窗加头像上传+图库，但头像只落在资料页——FC 频道主页频道卡头像恒为首字母，从不读 user.avatarUrl。\n\n' +
    '**三项钦定**：①勾选框默认勾选（键 slati_avatar_sync 缺失/脏值=ON，谓词 !==\'0\' 两页同款）②双向同步·资料页权威（勾选框只活在资料编辑弹窗；FC 侧也可点击频道卡头像直接换，走同一上传+PATCH 链）' +
    '③bio 不互通——FC PATCH 只发 avatarUrl 绝不发 bio，资料页 bio 保存流零改动（FC 页本身零 bio）。纯前端，后端零改动。\n\n' +
    '**修法**（docs/pages/community-profile.html + docs/pages/fluidcanvas.html）：\n' +
    '- 资料页：F1 syncOn 谓词（try/catch localStorage.getItem）→F2 编辑弹窗 form-group 行+span.toggle-switch（CSS 已内联零新样式）→F3 toggle click 即时 setItem \'1\'/\'0\'（权威设置不经保存事务）→' +
    'F4 保存成功 body.avatarUrl 分支：读弹窗 toggle DOM 态（缺键默认 ON）→ON 则 raw localStorage.setItem(\'slati_user\', JSON.stringify(合并))——**绝不 SlatiDB.saveUser**（storage.js 54-59 saveUser→mirrorProfile 525-534 二次 PATCH 双写坑）；OFF 零写入（FC 读旗标显示字母）。\n' +
    '- FC 页：F5 段 fcAvatarSyncOn（同谓词）/fcIsSubscriber（tier!==\'free\'）/fcEsc（escapeHtml 5 替换同款）/fcAvatarBusy/fcAvatarFile 隐藏 input **恒挂 body**（卡内会被 innerHTML 整换吞掉）/fcEnsureApi（window.MN_API 动态注入 ../assets/js/api.js 同 loadCloudArticles 口径）/' +
    '一次性委托 channelOverview.addEventListener（closest(\'.channel-avatar\')+fc-avatar-editable 类+fcAvatarBusy+isLoggedIn+USR- id+fcAvatarSyncOn 五守卫→file.click()）/' +
    'change 链：ext→gif 非订阅 toast fc.toast.gifLocked→白名单 fc.toast.imgOnly→10MB fc.toast.imgTooBig10→busy→fcEnsureApi→fetch POST MN_API.BASE+\'/social/uploads?ext=.\'+ext（credentials:include）→' +
    'MN_API.patch(\'/auth/me\',{avatarUrl:data.url}) **只 avatarUrl 绝不 bio**→r.ok 才改 UI（user.avatarUrl 更新+raw setItem+#personalAvatar.src+renderContent()+toast avatarUpdated；全失败路径 avatarFailed+busy 释放+value=\'\' 清空）。\n' +
    '- F6 个人分支 useAvatarImg=旗标&&!!user.avatarUrl→img.fc-ch-avatar-img（fcEsc src）否则首字母；F7 innerHTML 后 isPersonal&&useAvatarImg→querySelector(\'.channel-avatar\') 加 editable 类+title FT(\'fc.landing.changeAvatar\')（每渲染重打=切语言/切账号不丢）；' +
    'F8 CSS 相机徽章 ::after（26px 圆底主色 hover opacity 0→1）——页面专属块绝不进 ethereal 内联块。\n' +
    '- i18n：profile 1 新键 prof.edit.avatarSync×12 语+FC 6 新键（fc.landing.changeAvatar/fc.toast.avatarUpdated/avatarFailed/gifLocked/imgOnly/imgTooBig10）×12 语；zh-Hant 两词典 OpenCC 重生成；en 值=页面兜底串逐字节一致。\n' +
    '- site-config：MN_SITE_VERSION v0.2.58.20+FLUIDCANVAS_VERSION v10.28.48.0 **双 changelog 条目**（站点+FC 同轮交叉引用）→ rev 前缀各 ×2。\n\n' +
    '**边界**：关同步→FC 每渲染读旗标→字母卡+无编辑入口；团队卡永不受影响（无类无入口）；客人 CSS 隐藏 studio-main+委托内双守卫；上传/PATCH 失败=toast only（UI 只在 PATCH ok 后变）；' +
    '旗标脏值 !==\'0\' 两侧同谓词；绝不碰 slati_session；FC 页跨标签页同开不实时刷新（无 storage 事件监听，不在本轮范围）；演示用户无 id 编辑门禁拒绝（图片分支仍显示）。\n\n' +
    '**验证全链**：后端零改动 npm test 359/359 不重跑｜新电池 profile-avatarsync 25/25（P 组资料页 8 项：P0 静态锚/P1 缺键默认 ON/P2 取消勾选保存 PATCH 成功但 slati_user 零写入+旗标 0+PATCH 恰 1/P3 默认 ON raw 合并+字段保留/P4 重载持久化；F 组 FC 页 8 项：F1 图片卡+title 更换头像/F2 旗标 0 字母卡零上传/F3 点击换头像 PATCH 体恰 {avatarUrl} 无 bio/F4 gif+free 锁/F5 gif+premium 放行/F6 团队卡零动作/F7 guest 英雄；E1/E2 零异常）｜' +
    '金丝雀：profile-banner 122/122、profile-subtier 21/21、community-profile 99/99（三处 58.18 遗留陈旧断言修新口径）、fc-i18n 20/20、fc-publish-log 19/19｜' +
    '舰队 46 套全绿（grep exit=1|💥 复核零命中）｜冒烟 60/60｜i18n 34/34｜镜像验证 61/61×2（两次构建各验一次、先验后推）｜线上探针 profile-avatarsync 9/9。\n' +
    'digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态。\n\n' +
    '**新坑**：\n' +
    '1. 舰队 625 列表本无 community-profile 电池（58.18/58.19 舰队都未含）——本轮金丝雀首跑 3 红全是 58.18 遗留陈旧断言：G2 头像叠横幅后「头像在横幅下方」/「名字与头像垂直同带」失效、E6 编辑弹窗四组→五组（58.18 新「横幅图片」组）。按 58.18 新口径修断言（头像叠横幅 30-42px 带+名字在头像底缘下+五组标签），与本轮改动无关。\n' +
    '2. 双版本同轮（站点+FC 双 changelog）→ rev 前缀计数 ×2 非 ×1——sed 只换文本不改计数语义，旧电池 profile-subtier D0 rev 锚 ×1→×2（58.19 轮 FC 未升版所以是 ×1）。\n' +
    '3. storage.js get()=JSON.parse(localStorage.getItem(key)) try/catch→null——种子 slati_active_account 必须写 JSON.stringify(\'team-1\')（=\'"team-1"\'），裸串 parse 失败静默回退 personal（tmp-debug-seed.js 诊断：eval 里 accNow=\'personal\' 而 localStorage 里 account=\'team-1\'）。\n' +
    '4. localStorage 跨 Page.navigate 持久（同 user-data-dir）——guest 种子分支必须 removeItem slati_session/slati_user，否则旧登录态残留（F7 客人英雄不触发）。\n' +
    '5. profile 页无 #toast 元素（toastMsg→MN_Report.toast）——断言用 __toasts recorder（patch MN_Report.toast）且每次 openModal 重挂（Page.navigate 抹 document 级 patch）。\n' +
    '6. 行计数 vs 出现计数两套口径：verify docker grep -cF 按行（fcAvatarFile 16 行/bio 2 行）vs 电池 split 按出现（18/3——3859/3872 行双出现）——各自实测各自锚。\n' +
    '7. FC i18n __ZH_HANT_AUTO__ ×2（文件头注释+块标记）≠profile 词典 ×1——探针/verify 锚按实测。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-09-30-v025819-profile-subtier]]、[[2026-09-29-v025818-profile-banner]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.20 — 个人资料头像↔FC 频道主页头像双向同步') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
