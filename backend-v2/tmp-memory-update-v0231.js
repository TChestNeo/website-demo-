// v0.2.23.1 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00110-lvd（';
const REV_NEW = '**当前线上 rev 00111-kxx（2026-09-07 v0.2.23.1 Community 卡片背景改整卡——用户「你那个卡片背景是横幅我要的是背景就是整个，编辑资料按钮所在的卡片的整个背景」：①v0.2.23.0 预设渐变只铺 140px 横幅→口径修正铺满整张 profile-header 卡；②关键 CSS 坑：background: var(--lg-tint), var(--lg-bg) 非法——tint 是颜色值，颜色只许出现在 background 简写最后一层→整条声明被浏览器丢弃（computed background-image:none）→修法=包成均匀渐变图像层 linear-gradient(var(--lg-tint),var(--lg-tint)), var(--lg-bg)；③.profile-header.glass-bg .profile-banner { background:none } 横幅不再单独渐变（140px 高度/头像位置/分割线/圆角全不动——既有几何断言零改动全过）；④重建 128308 chars；零后端零共享文件；测试 255/255+电池 54→56/56 本地（E6d 整卡断言 cardBgImg 含 linear-gradient+品牌色 rgba(30,90,200,0.1)+banner bg-image=none；E6f 恢复断言选默认后 banner 重新 non-none——防横幅单独渐变回归）+16/16 线上（真用户 TChestBox_Neo 已自存 glass-frost 磨砂实测渲染——用户线上自己用起来了）+冒烟 49/49+curl 三连（health 58+v0.2.23.1+profile cardBg glass-frost 公开返回）；部署一次 exit 0（revision 00111-kxx）；rev 00111-kxx commit b60c3c3（未 push））；前身 rev 00110-lvd（';

const SITE_OLD = '站点号当前 **v0.2.23.0**（';
const SITE_NEW = '站点号当前 **v0.2.23.1**（2026-09-07 Community 卡片背景改整卡轮——用户「你那个卡片背景是横幅我要的是背景就是整个，编辑资料按钮所在的卡片的整个背景」：预设渐变从只铺横幅改铺满整张 profile-header 卡（tint 是颜色必须包成 linear-gradient 渐变层才合法——颜色只许出现在 background 简写最后一层，否则整条声明被浏览器丢弃）；横幅 background none 露整卡渐变（140px/头像位置/分割线不动）；零后端；测试 255/255+电池 56/56 本地（E6d 整卡+banner none；E6f banner 恢复）+16/16 线上（真用户已自存 glass-frost 磨砂）+冒烟 49/49+curl 三连+health 58；rev 00111-kxx commit b60c3c3（未 push））；前身 v0.2.23.0（';

const SCHEME_OLD = '2026-09-07 v0.2.23.0 = ';
const SCHEME_NEW = '2026-09-07 v0.2.23.1 = Community 卡片背景改整卡（补丁位 0→1·口径修正轮——用户「你那个卡片背景是横幅我要的是背景就是整个，编辑资料按钮所在的卡片的整个背景」：预设渐变从只铺横幅改铺满整张 profile-header 卡；tint 颜色必须包成 linear-gradient 均匀渐变层才合法（颜色只许出现在 background 简写最后一层，否则整条声明被浏览器丢弃——电池 E6d computed 实测 cardBgImg=none 抓到）；横幅 background none 露整卡渐变（140px 高度/头像位置/分割线全不动）；零后端零共享文件；测试 255/255+电池 54→56/56 本地（E6d 整卡+banner none；E6f banner 恢复防回归）+16/16 线上+冒烟 49/49+curl 三连+health 58，rev 00111-kxx commit b60c3c3（未 push））；前身 2026-09-07 v0.2.23.0 = ';

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
