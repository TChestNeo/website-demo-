// tmp-update-memory-631.js — v0.2.58.25 记忆仪式：
//   ① backend-build-state.md 头旋转（REV2 新 head；00345-vhw 降前身）
//   ② site-versioning-scheme.md 追加 58.25 条目+当前指针
//   ③ MEMORY.md 新行+三处「当前」指针更新
//   ④ 新记忆文件 2026-10-01-v025825-crop-dialog.md
'use strict';
const REV1 = '00346-rn2';   // 部署#1 瞬态真 rev
const REV2 = '00347-skv';   // 部署#2 终态真 rev
const DIGEST = 'sha256:c47be7b325efd058cd22b5db77529c800578472616ebeac2356d83c9c1217edb'; // 二次烘焙 push digest（=当前线上）
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
  const headAnchor = '**当前线上 rev 00345-vhw（';
  const demote = '**前身 rev 00345-vhw（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-10-01 v0.2.58.25 横幅/头像上传裁切弹窗+横幅增高 1.5 倍+视频横幅+FC 48.1 同轮——用户「那个横幅和头像在上传后能不能先弹出一个选择裁切范围的弹窗调整裁切范围，还有那个横幅能不能再高1.5倍？」+「还有要允许上传视频，大小的话平台自己压缩，然后上传视频最长1分钟」+「那个视频是指横幅的部分」；' +
    '真身=58.18-58.22 头像/横幅上传直传（白名单/10MB 门后立即 fetch 零预览零调整）用户无法裁切范围，横幅恒 140px；' +
    '六项钦定（①裁切=显示范围裁切、GIF 保持动画——绝不 canvas 重编码、原文件原样上传、裁切元数据存服务端、渲染 img+几何数学 ②固定比例框+图片缩放/平移 Discord 式 ③横幅 ×1.5 两处同改：资料页 140→210px 含 3 处边缘主题硬编码、设置弹窗预览 96→144px ④图库选图也走裁切弹窗 ⑤FC 频道卡头像也应用个人裁切（FC 48.0→48.1 同轮）⑥已有横幅/头像加「重新裁切」钮（资料页+设置弹窗；FC 不加））+视频六钦定（①只横幅——头像视频 toast 拒 ②浏览器端压缩 canvas.captureStream+MediaRecorder：1280 上限等比缩/30fps/1.2Mbps/静音/恒 webm ③超 1 分钟自动截前 60 秒 MN_VideoCap 纯函数 ④GIF 同款三层门禁 premium/ultra ⑤裁切弹窗对视频同样适用 ⑥后端零改动——v0.2.16.0 帖子媒体链已含 webm/mp4/mov 白名单）；' +
    '修法=settings-modal.js 内置 window.MN_CropDialog（open/isOpen/applyCrop/rescaleAll 全局暴露——community-profile/fluidcanvas 均已载该件，三处零新增 script）+渲染数学 s=max(W/(w·Nw),H/(h·Nh)) 中心锚定、w=h=1 与 cover+center 逐像素等价+归一化 rect {x,y,w,h} 存 users 新列 banner_crop/avatar_crop（030 迁移 user_version 30；null=整图）+连带清（url null→crop null、换 url 未带 crop→重置 null）+publicUser 暴露+storage.js mirrorProfile 白名单绝不加 crop+资料页渲染改内嵌 img/视频横幅改 video autoplay muted loop playsinline+FC 频道卡 .fc-ch-avatar-crop wrapper+FC 换头像链走同弹窗 PATCH {avatarUrl,avatarCrop}+视频链 MN_CompressVideo/MN_VideoCap/VIDEO_EXTS/压缩中状态/跳过 10MB 预检；' +
    'i18n 18 新键×12 语（crop 6+reCrop 4+video 8；zh-Hant 只 OpenCC）；CSS 全页面专属块→跳过 inline-css.js；后端 auth.js+social.js parseCrop/parseCropSafe+CARD_BG_KEYS 双处先例 npm test 361/361；' +
    '电池 tmp-battery-crop 新 27/27（C 组裁切 14+V 组视频 8+E）+六套受影响电池重写/金丝雀+冒烟 60/60+i18n 34/34+舰队 51 套全绿（首跑 38 ❌ 全=631 sed 陈旧锚：无 FC 版本对+前缀换位虚构 rev——tmp-sed-631b 补钉 42 swaps/29 files 只扫电池；grep exit=1|💥 复核零命中；无 flake）；' +
    '镜像内容验证两次构建各验一次先验后推 0 mismatch（二次锚改终态口径 ' + REV1 + ' 真值 ×2+' + REV1.slice(0, 6) + '-XXX 零残留）；线上探针 crop 631 9/9（S1a-e 静态+后端 030 live 实证=用户端点 bannerCrop/avatarCrop 两键/P1 CDP 零写安全 data:svg→confirm→rect 深等 {0,0,1,1}→零 /api 零 /uploads 请求/E1 零异常）；' +
    'digest ' + DIGEST + '（二次烘焙镜像=当前线上）；commit 未 push；rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 文本滞后一部署=惯例；裸前缀 rev 锚 deploy-proof——部署后电池 rev mini-sed 作废跳过））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00345-vhw（') !== -1 && read(f).indexOf('**当前线上 rev 00345-vhw（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.24；FC 当前 v10.28.48.0**。';
  step('versioning 58.24 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**v0.2.58.25（补丁位 24→25·新功能轮；2026-10-01；FC v10.28.48.0→48.1 同轮）**：横幅/头像上传裁切弹窗+横幅增高 1.5 倍+视频横幅——用户「那个横幅和头像在上传后能不能先弹出一个选择裁切范围的弹窗调整裁切范围，还有那个横幅能不能再高1.5倍？」+「还有要允许上传视频，大小的话平台自己压缩，然后上传视频最长1分钟」+「那个视频是指横幅的部分」；' +
    '六项钦定（显示范围裁切+GIF 保动画原文件上传/固定比例框缩放平移/横幅两处 140→210 与 96→144/图库同链/FC 频道卡同裁切 48.1/重裁钮两处）+视频六钦定（只横幅/浏览器压缩 1280@30fps 1.2Mbps webm 静音/60s 截取/三层门禁/弹窗通用/后端零改动）；' +
    '修法=MN_CropDialog 全局组件（settings-modal.js 内置零新增 script）+归一化 rect+users banner_crop/avatar_crop 新列（030 迁移 user_version 30；null=整图 cover）+渲染数学中心锚定 w=h=1 与现状逐像素等价+连带清+FC 48.1 频道卡 wrapper+视频链 MN_CompressVideo/MN_VideoCap；' +
    'i18n 18 新键×12 语（zh-Hant 只 OpenCC）；CSS 页面专属块→跳过 inliner；后端 auth+social+030 npm test 361/361；' +
    '电池 crop 新 27/27+六套受影响重写+冒烟 60/60+i18n 34/34+舰队 51 套全绿；镜像验证 ×2 先验后推 0 mismatch；线上探针 crop 631 9/9（含 030 live 实证+CDP 零写安全）；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例；裸前缀 rev 锚 deploy-proof——电池 mini-sed 作废跳过））。' +
    '**站点号当前 v0.2.58.25；FC 当前 v10.28.48.1**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning 58.25 条目+新尾指针在位', read(f).indexOf('v0.2.58.25（补丁位 24→25·新功能轮；2026-10-01') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.25；FC 当前 v10.28.48.1**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+三处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  const anchor23 = '](2026-09-30-v025824-hub-nodemo.md)\n';
  step('MEMORY.md 58.24 行在位', s.indexOf(anchor23) !== -1);
  const newLine =
    '- [2026-10-01 — v0.2.58.25 横幅/头像上传裁切弹窗+横幅增高+视频横幅+FC 48.1（rev ' + REV1 + '→' + REV2 + ' commit 未 push）：「那个横幅和头像在上传后能不能先弹出一个选择裁切范围的弹窗调整裁切范围，还有那个横幅能不能再高1.5倍？」+「还有要允许上传视频，大小的话平台自己压缩，然后上传视频最长1分钟」+「那个视频是指横幅的部分」——' +
    '十二钦定（裁切=显示范围+GIF 保动画原文件/固定比例框 Discord 式/横幅两处 140→210 与 96→144/图库同链/FC 频道卡同裁切 48.1/重裁钮两处；视频=只横幅/浏览器压缩 1280@30fps 1.2Mbps webm 静音/60s 截取 MN_VideoCap/三层门禁/弹窗通用/后端零改动）；' +
    '修法=settings-modal 内置 window.MN_CropDialog 全局组件（三处零新增 script）+渲染数学 s=max(W/(w·Nw),H/(h·Nh)) 中心锚定 w=h=1 与 cover+center 逐像素等价+归一化 rect 存 users banner_crop/avatar_crop（030 迁移 user_version 30；null=整图）+连带清+publicUser 暴露+mirrorProfile 白名单绝不加 crop+资料页 img/视频横幅 video+FC .fc-ch-avatar-crop wrapper+换头像链同弹窗 PATCH {avatarUrl,avatarCrop}+视频链 MN_CompressVideo；' +
    'i18n 18 新键×12 语（zh-Hant 只 OpenCC）/CSS 页面专属块跳过 inliner/后端 auth+social+030 npm test 361/361；' +
    '电池 crop 新 27/27（C14+V8+E）+六套重写金丝雀+冒烟 60/60+i18n 34/34+舰队 51 全绿（首跑 38 ❌ 全=631 sed 陈旧锚——无 FC 版本对+前缀换位虚构 rev；tmp-sed-631b 补钉只扫电池 42 swaps/29 files）+验证 ×2 先验后推 0 mismatch+探针 crop 631 9/9（030 live 实证用户端点两键+CDP 零写安全 rect 深等）；' +
    '新坑：Windows argv 吃 \\" 引号（grep 模式内部双引号经 sh 双引号包裹 CreateProcess 静默丢引号→错配计数；修法=sh 单引号包裹+内单引号 \'\\\'\' 转义零双引号进 argv）、JS 模板字面量吃 \\\'（生成器发出文件里反斜杠序列被解释→verify#2 40 mismatch；修法=嵌入前 c.replace(/\\\\/g, \'\\\\\\\\\')）、探针行计数 vs 出现计数两套口径再证（grep -cF 行语义 vs mk() split 出现语义——live=树仍 9≠7 假红，探针改行计数）、deploy-proof rev 锚（裸前缀计数占位填真值后恒 2——部署后电池 mini-sed 作废跳过）、/api/health 无 user_version 键（030 live 证明走用户端点 bannerCrop/avatarCrop 两键）、旧探针历史冻结含 sed 累计虚构 rev 伤害（hub-630 被 631 sed 改成 00346-ntt——冻结不动惯例维持）、Docker Desktop 未运行 npipe 连不上（老坑再证）](2026-10-01-v025825-crop-dialog.md)\n';
  s = s.replace(anchor23, anchor23 + newLine);
  const bbAnchor = '**当前线上 rev 00345-vhw（v0.2.58.24 社区页演示样本全移除+三 tab 全接真数据；FC 恒 v10.28.48.0；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（v0.2.58.25 裁切弹窗+横幅增高+视频横幅+FC 48.1；commit 未 push）；详见 [[backend-build-state]]**');
  const svAnchor = '**当前：站点号 v0.2.58.24（58.24 社区页演示样本全移除+三 tab 全接真数据；rev 00345-vhw；commit 未 push）、FC v10.28.48.0（48.0 频道卡头像图+点击换头像同轮；rev 00337-wxl；commit 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.25（58.25 裁切弹窗+横幅增高+视频横幅+FC 48.1 同轮；rev ' + REV2 + '；commit 未 push）、FC v10.28.48.1（48.1 频道卡头像个人裁切+换头像链走裁切弹窗同轮；rev ' + REV2 + '；commit 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-10-01-v025825-crop-dialog.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（v0.2.58.25') !== -1 && s2.indexOf('站点号 v0.2.58.25（58.25 裁切弹窗') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-10-01-v025825-crop-dialog.md';
  const body =
    '---\n' +
    'name: 2026-10-01-v025825-crop-dialog\n' +
    'description: v0.2.58.25 横幅/头像上传裁切弹窗+横幅增高 1.5 倍+视频横幅+FC 48.1 同轮（rev ' + REV1 + '→' + REV2 + ' 未 push）——MN_CropDialog 全局组件+渲染数学+users banner_crop/avatar_crop 新列（030 迁移）+MN_CompressVideo/MN_VideoCap 视频链；十二钦定全文；电池 27/27+舰队 51+探针 9/9；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# v0.2.58.25 — 裁切弹窗+横幅增高+视频横幅（2026-10-01）\n\n' +
    '用户「那个横幅和头像在上传后能不能先弹出一个选择裁切范围的弹窗调整裁切范围，还有那个横幅能不能再高1.5倍？」+「还有要允许上传视频，大小的话平台自己压缩，然后上传视频最长1分钟」+「那个视频是指横幅的部分」。\n\n' +
    '**真身**：58.18-58.22 头像/横幅上传直传（白名单/10MB 门后立即 fetch 零预览零调整）用户无法裁切范围；横幅恒 140px。\n\n' +
    '**六项钦定**（AskUserQuestion）：①裁切=图片显示范围裁切、裁切后 GIF 保持动画（绝不 canvas 重编码；原文件原样上传；裁切元数据存服务端；渲染用 img+几何数学，GIF 天然动画）②固定比例框+图片缩放/平移（Discord 换头像式）③横幅 ×1.5 两处同改（资料页 140→210px 含 3 处边缘主题硬编码、设置弹窗预览 96→144px）④图库选图也走裁切弹窗 ⑤FC 频道主页频道卡头像也应用个人裁切（FC 48.0→48.1 同轮）⑥已有横幅/头像加「重新裁切」钮（资料页编辑弹窗+设置弹窗；FC 不加）。\n\n' +
    '**视频六钦定**（2026-10-01 补报）：①范围=只横幅（头像保持图片/GIF，视频文件在头像链 toast 拒绝）②压缩=浏览器端（canvas.captureStream+MediaRecorder：宽 1280 上限等比缩、30fps、1.2Mbps、静音无音轨、输出恒 webm）③超 1 分钟=自动截取前 60 秒（min(duration,60) 录制窗；MN_VideoCap 纯函数可电池直测）④门禁=GIF 同款三层（free/basic 拦 toast+升级链、premium/ultra 可用）⑤裁切弹窗对视频同样适用 ⑥后端零改动（v0.2.16.0 帖子媒体链已含 webm/mp4/mov 白名单+魔数+30MB 上限——压缩成片 ≤9MB 天然合规）。\n\n' +
    '**架构核心**：\n' +
    '- 裁切元数据=归一化矩形 {x,y,w,h}（0..1 浮点，x+w≤1、y+h≤1），存 users 新列 banner_crop/avatar_crop（TEXT JSON，030 迁移 user_version 30）。null=默认 {0,0,1,1} 整图 cover。\n' +
    '- 渲染数学（中心锚定式，cover+center 的严格推广）：s = max(W/(w·Nw), H/(h·Nh))；left=W/2−(x+w/2)·Nw·s；top=H/2−(y+h/2)·Nh·s。w=h=1 时与 background-size:cover+center 逐像素等价=爷爷辈零回归。\n' +
    '- 组件=settings-modal.js 内置全局 window.MN_CropDialog（open/isOpen/applyCrop/rescaleAll）——community-profile.html 与 fluidcanvas.html 均已载该件，三处零新增 script 标签；上传链留在调用方（弹窗只产 rect）。\n' +
    '- 框比例固定：头像 1:1；横幅 3:1（kind 驱动）。确定值：confirm 不拖不滚 → rect 恒 {0,0,1,1} 且一律写入 PATCH 体（电池断言确定性来源）；确认时 Math.round(v*10000)/10000。键序 url 先 crop 后，rect 内 x,y,w,h。\n' +
    '- 门禁序：file change/图库点击 → free 门禁（toast 不弹窗）→ gif 门禁 → 白名单/≤10MB（弹窗前）→ 弹窗 → 确认后 fetch。取消=零上传零 PATCH。移除链 {"bannerUrl":null} 精确体不带 crop（后端连带清）。\n' +
    '- 视窗模型：rect 恒等于 stage 可见窗口——每次缩放后围绕旧 rect 中心重算 rect（w=W/(Nw·s)、h=H/(Nh·s) 钳 ≤1 贴边），弹窗所见=confirm 所得=applyCrop 渲染逐像素一致；Esc 捕获相+stopPropagation（防连锁关下层弹窗）；Blob 入参 objectURL 四出口统一 revoke；URL 字符串零处理。\n' +
    '- 后端：auth.js+social.js 双处 parseCrop/parseCropSafe（58.22 CARD_BG_KEYS 先例）；PATCH /auth/me avatarCrop/bannerCrop 块+audit 两字段；**连带清规则** avatarUrl:null→avatar_crop=null、bannerUrl:null→banner_crop=null、换 url 未带 crop→该 crop 重置 null（防旧 crop 错配新图）；publicUser 加两字段（settings 全站读 slati_user 需要）。**红线：storage.js mirrorProfile 白名单绝不加 crop 字段**（加 publicUser 不会漏进镜像 PATCH）。\n' +
    '- 视频：MN_CompressVideo(blob)→Promise<{blob,ext:\'webm\'}>（video 读 metadata→canvas 等比缩→captureStream(30)→MediaRecorder vp9→vp8→裸 webm 三级回退 1.2Mbps→rAF drawImage 录制窗=MN_VideoCap(duration)→静音不接 audio 轨）；applyCrop nw=naturalWidth||videoWidth；rescaleAll 选择器 [data-crop]；弹窗 src 判视频（type 前缀 video/ 或尾 .mp4/.webm/.mov）→video autoplay muted loop playsinline；VIDEO_EXTS=[\'mp4\',\'webm\',\'mov\']；accept += mp4/mov/webm；视频分支跳过 10MB 预检（输入任意大）；图库链零改动（图库只存图片 dataURL 无视频条目）。\n\n' +
    '**验证全链**：tmp-battery-crop 新 27/27（C1-C14 裁切+爷爷 null crop 居中 cover 零回归+GIF 保真 blob 前缀原字节+V1-V8 视频+E 零异常）+六套受影响电池重写/金丝雀（profile-banner/profile-subtier/profile-avatarsync/settings-profilecust/bannerfixed/community-profile）→舰队 51 套全绿（首跑 38 ❌ 全=631 sed 陈旧锚：PAIRS 无 FC 版本对致 \'v10.28.48.0\' 带引号断言全失配+前缀换位 00344-→00346- 造出虚构 rev \'rev 00346-ntt\'——tmp-sed-631b 补钉只扫电池 42 swaps/29 files 含 lvpill 不同锚形手修；grep exit=1|💥 复核零命中；无 flake）+冒烟 60/60+i18n 34/34+npm test 361/361｜镜像验证两次构建各验一次先验后推 0 mismatch（二次锚改终态口径 ' + REV1 + ' 真值 ×2+00346-XXX 零残留）｜线上探针 crop 631 9/9（S1a site-config 58.25/48.1+零残留/S1b rev live 口径 ' + REV1 + ' ×2+00347-??? 占位 ×2/S1c profile 16 锚/S1d settings-modal 8 锚/S1e 后端 030 live 实证=GET users/USR-000001 含 bannerCrop+avatarCrop 两键/P1 CDP 零写安全 data:svg→confirm→rect 深等 {0,0,1,1}→baseline 后零新 /api|/uploads 请求/E1 零异常）。\n' +
    'digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态。\n\n' +
    '**新坑**：\n' +
    '1. Windows argv 吃 \\" 引号：grep 模式含内部双引号经 sh 双引号包裹在 CreateProcess 下静默丢引号→错配计数（verify#1 23 mismatch 全是引号锚；直接进镜像 grep 证明镜像无错只模式坏）——修法=sh 单引号包裹+内单引号 \'\\\'\' 转义，零双引号进 argv。\n' +
    '2. JS 模板字面量吃 \\\'：生成器发出的文件里模板字面量解释反斜杠序列（\'maxWidth = \'\\\'\'680px\'\\\'\'\' 丢反斜杠→verify#2 40 mismatch 更糟）——修法=嵌入前 c.replace(/\\\\/g, \'\\\\\\\\\')。\n' +
    '3. 探针行计数 vs 出现计数两套口径再证：写锚用 grep -cF（行语义）但探针 mk() split（出现语义）→live=树同字节仍 9≠7/25≠22 假红（profile-banner-crop 行内双出现）——探针改行计数口径。\n' +
    '4. deploy-proof rev 锚：裸前缀计数 cnt(sconf, \'rev 00346-\')===2 在占位填真值后计数不变——部署后电池 rev mini-sed 本轮作废跳过（631 sed 的 00344-→00346- 前缀换位正是历史 mini-sed 需要真值的原因；裸前缀锚免疫）。\n' +
    '5. /api/health 无 user_version 键（live 实证 {"status","db","tables":60,"version","time"}）——后端 030 live 证明改走用户端点：GET /api/social/users/:id 响应含 bannerCrop+avatarCrop 两键（null 合法）=迁移已应用+公开暴露。\n' +
    '6. 旧探针历史冻结含 sed 累计虚构 rev 伤害：hub-630 等旧探针被 631 sed 改成 \'00346-ntt\'（从未存在）——历史冻结不动惯例维持（旧探针永不重跑，只新轮探针按 live 实况写），本轮起记注防未来误读。\n' +
    '7. Docker Desktop 未运行 npipe 连不上（老坑再证）：Start-Process Docker Desktop.exe+轮询 docker info 直到 up 再 build。\n' +
    '8. 舰队 runner 💔 总结行误伤电池自身总结行「PASS N / 💔 FAIL 0」——新电池总结改条件输出（FAIL>0 才印），旧坑再证。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-09-30-v025824-hub-nodemo]]、[[2026-09-30-v025822-banner-tier-gold]]、[[2026-09-30-v025819-profile-subtier]]、[[2026-09-30-v025818-profile-banner]]、[[2026-09-30-v025820-avatar-sync]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('v0.2.58.25 — 裁切弹窗+横幅增高+视频横幅') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
