// v0.2.24.0 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00113-6mv（';
const REV_NEW = '**当前线上 rev 00114-gmb（2026-09-07 v0.2.24.0 Community 卡片背景独立双层——用户「不是我要纯透明的还有把他单独变成卡片背景你听得懂吗？不是和横幅塞在一起能不能把那个说是背景但实际是横幅的名称改一下，你这轮根本就没跟着我要求做」：①问询钦定「独立 7 款预设」——自定义 tab 双组：横幅（液体玻璃，原名「卡片背景」改名——用户「叫背景实为横幅」）+ 卡片背景（新组 7 预设独立存储）；②结构：cardBg=横幅预设（预设类挂卡上，横幅读卡上 --lg-bg）、cardPlate=卡片背景预设（预设类挂外层包层 .card-halo，包层自己的 --lg-bg 与横幅互不干扰——CSS 变量继承作用域分离）、卡身纯透明透出背景层（.card-halo .profile-header { background:transparent } 特异性 0,2,0 压过 .card 实底）、背景层铺满整卡+四周阔出 6px（margin:-6px+padding:6px 不挤占原尺寸+border-radius calc(var(--radius-lg)+6px)+兜底=参考代码蓝紫渐变 #60a5fa→#a78bfa）；③后端：迁移 019 users.card_plate 加列（ALTER 无新表 → health 58 不变、user_version 18→19）+PATCH /auth/me 接受 cardPlate（白名单同 CARD_BG_KEYS 六键三处同步、null=恢复无背景层、非法键 400 VALIDATION）+profile 端点公开返回（他人主页也渲染拥有者背景）；④预览：横幅组=纯渐变条（.edit-bg-flat 读自己类）、卡片背景组=迷你卡模型（外层包层挂预设渐变+内层透明卡 pv-card 固定品牌小横幅条——示意背景铺满卡身+四周 6px 阔出）；重建 132288 chars；⑤测试 255→257/257（migrations 019 独立存储互不干扰+social-profile cardPlate 链：PATCH 落库/非法 400/null 恢复/公开渲染/与 cardBg 互不干扰）+电池 57→58/58 本地（E6 双组：改名标签 横幅（液体玻璃）|卡片背景+双网格 7+7+E6c2 樱花渐变 has-plate+E6d PATCH 双字段精确 {"cardBg":"glass-ocean","cardPlate":"glass-rose"}+包层 card-halo glass-rose+卡身 rgba(0,0,0,0)+E6f 双 null 回实底+O1 他人双背景公开渲染+L2 卡透明一致双向断言）+17/17 线上（真用户 TChestBox_Neo cardBg/cardPlate 双 null 默认实底 wrapCls 空）+冒烟 49/49+curl 四连（health 58+v0.2.24.0+posts 首帖 authorId USR-000001+profile cardBg/cardPlate 双 null）；部署一次 exit 0（revision 00114-gmb）；rev 00114-gmb commit 29ab1ab（未 push））；前身 rev 00113-6mv（';

const SITE_OLD = '站点号当前 **v0.2.23.3**（';
const SITE_NEW = '站点号当前 **v0.2.24.0**（2026-09-07 Community 卡片背景独立双层轮——用户「不是我要纯透明的…不是和横幅塞在一起…名称改一下」：问询钦定「独立 7 款预设」——自定义 tab 双组：横幅（液体玻璃，改名）+ 卡片背景（新组 7 预设独立存储）；cardBg=横幅预设挂卡上、cardPlate=卡片背景预设挂外层包层 .card-halo（各自的 --lg-bg 互不干扰）、卡身纯透明透出背景层、背景层铺满整卡+四周阔 6px（兜底=参考代码蓝紫渐变）；迁移 019 users.card_plate（health 58 不变、user_version 18→19）+PATCH /auth/me+profile 公开返回；测试 257/257+电池 58/58 本地+17/17 线上+冒烟 49/49+curl 四连+health 58；rev 00114-gmb commit 29ab1ab（未 push））；前身 v0.2.23.3（';

const SCHEME_OLD = '2026-09-07 v0.2.23.3 = ';
const SCHEME_NEW = '2026-09-07 v0.2.24.0 = Community 卡片背景独立双层（小改动位 23→24·独立背景轮——用户「不是我要纯透明的还有把他单独变成卡片背景你听得懂吗？不是和横幅塞在一起能不能把那个说是背景但实际是横幅的名称改一下」：问询钦定「独立 7 款预设」——自定义 tab 双组：横幅（液体玻璃，原名「卡片背景」改名）+ 卡片背景（新组 7 预设独立存储）；cardBg=横幅预设（预设类挂卡上，横幅读卡上 --lg-bg）、cardPlate=卡片背景预设（预设类挂外层包层 .card-halo，包层自己的 --lg-bg 与横幅互不干扰）、卡身纯透明透出背景层、背景层铺满整卡+四周阔出 6px（margin:-6px+padding:6px+border-radius calc(半径+6px)+兜底=参考代码蓝紫渐变）；迁移 019 users.card_plate（无新表 health 58 不变、user_version 18→19）+PATCH /auth/me 接受 cardPlate+profile 公开返回；预览：横幅组=纯渐变条、卡片背景组=迷你卡模型（外层包层渐变+内层透明卡）；测试 255→257/257+电池 57→58/58 本地（E6 双组+E6d PATCH 双字段+卡身 rgba(0,0,0,0)+E6f 双 null 回实底+O1/L2）+17/17 线上+冒烟 49/49+curl 四连+health 58，rev 00114-gmb commit 29ab1ab（未 push））；前身 2026-09-07 v0.2.23.3 = ';

function patch(file, pairs) {
  const p = MEM + file;
  let s = fs.readFileSync(p, 'utf8');
  for (const [o, n] of pairs) {
    const c = s.split(o).length - 1;
    if (c !== 1) throw new Error(file + ' anchor count=' + c + ' for: ' + o.slice(0, 40));
    s = s.replace(o, n);
  }
  fs.writeFileSync(p, s, 'utf8');
  console.log('patched', file);
}
patch('MEMORY.md', [[REV_OLD, REV_NEW], [SITE_OLD, SITE_NEW]]);
patch('backend-build-state.md', [[REV_OLD, REV_NEW]]);
patch('site-versioning-scheme.md', [[SCHEME_OLD, SCHEME_NEW]]);
console.log('OK 4 anchors');
