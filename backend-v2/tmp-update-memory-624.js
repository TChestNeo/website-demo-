// tmp-update-memory-624.js — v0.2.58.18 记忆仪式：
//   ① backend-build-state.md 头旋转（00333-kkx 新 head；00330-gcs 降前身）
//   ② site-versioning-scheme.md 追加 58.18 条目+当前指针
//   ③ MEMORY.md 新行+两处「当前」指针更新
//   ④ 新记忆文件 2026-09-29-v025818-profile-banner.md
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
  const headAnchor = '**当前线上 rev 00330-gcs（';
  const demote = '**前身 rev 00330-gcs（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev 00333-kkx（2026-09-29 v0.2.58.18 个人资料自定义横幅/头像——用户「能不能把个人资料的自定义横幅/头像做一下」；' +
    '六项钦定：编辑权限仅本人/本地上传+FC 图库双来源无 URL 输入/自动适配零裁剪（服务端限大小格式、页面居中裁切）/≤10MB 含 gif/' +
    '头像本轮也加图库入口/横幅资料页顶部头像叠其上 36px 半身；修法=029 迁移 users.banner_url 加列（user_version 28→29）+auth.js PATCH bannerUrl 分支' +
    '（PAGE_BG_IMAGE_RE 同款校验、null=移除恢复预设渐变）+avatarUrl 加固（顺手修 String(null) 写 "null" 字面串缺陷→NULL 清除语义）+' +
    'social.js GET bannerUrl 守卫行+前端 renderHeader has-img 内联背景图（escapeHtml 双保险）+编辑弹窗横幅组三按钮+隐藏 file input+FC 图库选择器' +
    '（slati_img_library 只收 data: 条目、http(s)/blob: 过滤）+头像图库入口+上传链照抄全站唯一契约（绝不 FormData）+i18n 11 新键×11 语；' +
    'CSS 全进页面专属块→跳过 inline-css.js；FC 恒 v10.28.47.4；npm test 359/359（横幅案+头像加固案+迁移 029 案）+' +
    '电池 profile-banner 122/122（继承母本全套 100 项+B 组 22 项）+舰队 44 套全绿（grep exit=1|💥 复核零命中；' +
    'article-frontend/notif-home 旧 user_version 28 锚随 029 改 29、all-opaque Chrome 未起 flake 独立复跑销账）+冒烟 60/60+i18n 34/34；' +
    '镜像内容验证 48/48+48/48（两次构建各验一次、先验后推；test/ 五锚改查本地工作树——test/ 被 dockerignore 排除不进镜像）；' +
    '线上探针 profile-banner 10/10（S1 页面五 id+58.18+rev 前缀/S2 health 60 表+public users+真 id 主页 GET 含 bannerUrl 键无蛇形泄漏/' +
    'S3 public users 零 bannerUrl/P1 CDP 匿名渲染真资料页 ?id= profileMain 可见+.profile-banner 在 DOM+零 #profileEditBtn/E1 零异常）；' +
    'digest sha256:86d733bb126b12bd3c21860497ca83d77cf0b58a7adcfec30c515068ab86be8c（二次烘焙镜像=当前线上）；' +
    'commit 未 push；新坑：deploy ps1 加管道 2>&1|Select-Object -Last 12 → gcloud stderr 进度行被 PS5.1 包成 NativeCommandError 毒化 exit code' +
    '报「失败」但实际已部署成功（00298 教训再犯）——零重定向直跑是铁律、复跑产生 00332-kzj 消耗一个 rev 终态顺延 00333；' +
    'test/ 被 .dockerignore 排除不进镜像——verify 测试文件锚必须查本地工作树；sed token 族（版本/rev）漏扫 user_version 28 迁移锚→舰队 3 红手改；' +
    '探针 P1 锚克隆错位：community-profile.html 无 guest-hero（following.html 才有）——匿名无 ?id 直接 render404，正确 P1=取 S2c 真 id 导航 ?id=；' +
    'rev 00331-g9b 瞬态→00333-kkx 终态（00332-kzj 意外消耗；live 文本 00331-g9b 烘焙、00333-kkx 真值注记随 commit 滞后一部署=惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev 00333-kkx（') !== -1 && read(f).indexOf('**前身 rev 00330-gcs（') !== -1 && read(f).indexOf('**当前线上 rev 00330-gcs（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.17；FC 当前 v10.28.47.4**。';
  step('versioning 58.17 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.18（补丁位 17→18·新功能轮；2026-09-29）**：个人资料自定义横幅/头像——用户「能不能把个人资料的自定义横幅/头像做一下」；' +
    '六项钦定：编辑权限仅本人／本地上传+FC 图库双来源无 URL 输入／自动适配零裁剪／≤10MB 含 gif／头像也加图库入口／横幅资料页顶部头像叠其上；' +
    '修法=029 迁移 users.banner_url+auth.js PATCH bannerUrl 分支+avatarUrl 加固（String(null) 缺陷）+social.js GET 守卫+前端 has-img 渲染+' +
    '编辑弹窗横幅组+FC 图库选择器（只收 data:）+i18n 11 新键×11 语；CSS 全进页面专属块→跳过 inliner；FC 恒 v10.28.47.4；' +
    'npm test 359/359+电池 profile-banner 122/122+舰队 44 套全绿+冒烟 60/60+i18n 34/34；' +
    '镜像验证 48/48+48/48（两次构建各验一次、先验后推）；线上探针 profile-banner 10/10；digest sha256:86d733bb…；' +
    'commit 未 push，rev 00331-g9b→00333-kkx（00332-kzj 被 deploy 复跑意外消耗——live 文本 00331-g9b 滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.18；FC 当前 v10.28.47.4**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.18 条目+新尾指针在位', read(f).indexOf('v0.2.58.18（补丁位 17→18·新功能轮；2026-09-29）') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.18；FC 当前 v10.28.47.4**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+两处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  // 新行插在 58.17 行之后
  const anchor17 = '](2026-09-29-v025817-following-real.md)\n';
  step('MEMORY.md 58.17 行在位', s.indexOf(anchor17) !== -1);
  const newLine =
    '- [2026-09-29 — v0.2.58.18 个人资料自定义横幅/头像（rev 00331-g9b→00333-kkx commit 未 push）：「能不能把个人资料的自定义横幅/头像做一下」——' +
    '029 迁移 banner_url+auth.js PATCH bannerUrl+avatarUrl 加固（String(null) 缺陷）+social.js GET 守卫+has-img 渲染+编辑弹窗横幅组+' +
    'FC 图库选择器（只收 data:）+头像图库入口+头像叠横幅 36px；CSS 全进页面专属块跳过 inliner；' +
    'npm test 359/359+电池 122/122+舰队 44 全绿（user_version 28 锚随 029 改 29+all-opaque flake 销账）+冒烟 60/60+i18n 34/34+验证 48/48×2+探针 10/10；' +
    '新坑：deploy ps1 管道毒化 exit=1 但实际已部署（复跑消耗 00332-kzj 终态顺延 00333）、test/ 不进镜像 verify 锚查工作树、' +
    'sed token 族漏扫 user_version 28 锚、探针 P1 锚克隆错位（community-profile 无 guest-hero——匿名无 ?id 直接 render404）](2026-09-29-v025818-profile-banner.md)\n';
  s = s.replace(anchor17, anchor17 + newLine);
  // backend-build-state 行「当前线上」指针
  const bbAnchor = '**当前线上 rev 00330-gcs（v0.2.58.17 关注页真实数据接入；FC 恒 v10.28.47.4；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev 00333-kkx（v0.2.58.18 个人资料自定义横幅/头像；FC 恒 v10.28.47.4；commit 未 push）；详见 [[backend-build-state]]**');
  // site-versioning 行「当前」指针
  const svAnchor = '**当前：站点号 v0.2.58.17（58.17 关注页真实数据接入；rev 00330-gcs；commit 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.18（58.18 个人资料自定义横幅/头像；rev 00333-kkx；commit 未 push）、FC v10.28.47.4（47.4 折叠过渡+白底列表；rev 00303-kdj；commit 334943c 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-09-29-v025818-profile-banner.md') !== -1 && s2.indexOf('当前线上 rev 00333-kkx（v0.2.58.18') !== -1 && s2.indexOf('站点号 v0.2.58.18（58.18 个人资料自定义横幅/头像') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-09-29-v025818-profile-banner.md';
  const body =
    '---\n' +
    'name: 2026-09-29-v025818-profile-banner\n' +
    'description: v0.2.58.18 个人资料自定义横幅/头像轮（rev 00331-g9b→00333-kkx 未 push）——029 迁移 banner_url+auth.js PATCH+avatarUrl 加固+FC 图库双来源选择器+头像叠横幅；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.18 — 个人资料自定义横幅/头像（2026-09-29）\n\n' +
    '用户「能不能把个人资料的自定义横幅/头像做一下」。真身：资料页（community-profile.html，唯一资料页）横幅只有 7 玻璃预设无图片；' +
    '头像上传已有但无 FC 图库入口、PATCH avatarUrl 零校验（String(null) 会写 "null" 字面串）。\n\n' +
    '**六项钦定**（全按推荐）：①编辑权限=仅本人（u.isSelf 门控结构已成立零新门）②图片来源=本地上传+FC 图库双来源（无 URL 输入）' +
    '③自动适配零裁剪（服务端限大小/格式，页面居中裁切；横幅约 3:1、头像正方形）④≤10MB 含 gif（jpg/png/webp/gif）' +
    '⑤头像本轮也加图库入口 ⑥横幅资料页顶部、头像叠其上（经典社交布局，叠 36px 半身）。\n\n' +
    '**修法**：\n' +
    '- 后端：029 迁移 users.banner_url 加列（user_version 28→29、health 60 表不变）；auth.js PATCH bannerUrl 分支照抄 pageBgImage 模式' +
    '（PAGE_BG_IMAGE_RE 校验、slice(0,500)、null=移除恢复预设渐变）；avatarUrl 加固同款校验+显式 null→avatar_url=NULL 清除语义' +
    '（不再写 "null" 串）；social.js GET /api/social/users/:id 守卫行 bannerUrl 服务端双保险；publicUser/PATCH 响应形状零改动' +
    '（GET /api/public/users PII 最小口径零 bannerUrl——发现/关注页绝无横幅）。\n' +
    '- 前端：renderHeader 有图挂 .profile-banner.has-img 内联背景图（escapeHtml 防引号注入；预设渐变保留作加载兜底）；' +
    'CSS 三规则全进页面专属块（.profile-top 相对定位让位 72px+.profile-avatar 绝对定位上移叠横幅 36px+.has-img cover center）→**跳过 inline-css.js**；' +
    '编辑弹窗横幅组（预览条+上传/图库/移除三按钮+state 文案）+隐藏 file input 上传链照抄全站唯一契约（fetch POST /social/uploads?ext= 绝不 FormData）；' +
    'FC 图库选择器 openFcLibraryPicker（slati_img_library 只收 data: 条目——http(s)=URL 后门钦定禁止、blob: 跨页不可用，fcDataUrlToBlob 转 Blob 再走上传链）；' +
    '头像图库入口同链落 editPendingAvatar；保存 diff editBannerUrl!==(u.bannerUrl||null) 才入 body（null 显式=移除语义）。\n' +
    '- i18n：11 新键×11 语（zh-Hant OpenCC 重生成、en 值=页面兜底串逐字节一致）；复用 imgOnly/imgTooBig 双预检。\n\n' +
    '**验证全链**：npm test 359/359（横幅案+头像加固案+迁移 029 案）｜电池 profile-banner 122/122（继承母本全套 100 项+B 组 22 项）｜' +
    '舰队 44 套全绿（grep exit=1|💥 零命中；article-frontend/notif-home 旧 user_version 28 锚随 029 改 29、all-opaque Chrome 未起 flake 独立复跑销账）｜' +
    '冒烟 60/60｜i18n 34/34｜镜像验证 48/48+48/48（两次构建各验一次、先验后推；test/ 五锚改查本地工作树）｜线上探针 profile-banner 10/10。\n' +
    'digest sha256:86d733bb126b12bd3c21860497ca83d77cf0b58a7adcfec30c515068ab86be8c（二次烘焙=当前线上）。rev 00331-g9b 瞬态→00333-kkx 终态。\n\n' +
    '**新坑**：\n' +
    '1. deploy ps1 加管道 `2>&1 | Select-Object -Last 12` → gcloud stderr 进度行被 PS5.1 包成 NativeCommandError 毒化 exit code 报「失败」' +
    '但实际部署已成功（00298 教训再犯）——零重定向直跑是铁律；复跑产生 00332-kzj 消耗一个 rev、终态顺延 00333。\n' +
    '2. test/ 被 .dockerignore 排除不进镜像——verify 测试文件锚必须查本地工作树（镜像内 /app/test/... grep 打空输出空串 5 红）。\n' +
    '3. sed token 族（版本/rev 前缀）漏扫 user_version 28 迁移锚——舰队 3 红（article-frontend ❌2+notif-home ❌1）手改 28→29 独立复跑销账。\n' +
    '4. 探针 P1 锚克隆错位：community-profile.html 无 guest-hero（following.html 才有）——匿名无 ?id 直接 render404；' +
    '正确 P1=取 S2c 真 id 导航 ?id= 断言 profileMain 可见+.profile-banner 在 DOM+匿名非本人零 #profileEditBtn。\n' +
    '5. changelog 编辑与 docker build 竞态：后台构建中改 changelog→为保镜像含终态文本需重建一次（缓存命中快）。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-09-29-v025817-following-real]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.18 — 个人资料自定义横幅/头像') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
