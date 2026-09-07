// v0.2.22.5 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00107-jpf（';
const REV_NEW = '**当前线上 rev 00108-7bc（2026-09-07 v0.2.22.5 Community 主页 横幅 + 头像下调 + 简介/头像分割线——用户「然后我希望你把从简介和头像之间画一个分割线 然后把头像的位置下调些 我希望添加一个横幅」：①头部卡顶部全宽横幅 .profile-banner（140px 品牌渐变+双径向高光，卡片 padding 移入 .profile-body、overflow hidden 圆角裁切）；②头像行随横幅下移（横幅下 space-md，avT 265>bnB 241 实测）；③.profile-top 底 border-bottom 1px 分割线横贯（简介与头像之间）；零后端零共享文件（tail 改+重建 119476 chars）；测试 252/252+电池 43/43 本地（G2 新断言——横幅 h=140+分割线 1px+头像在横幅下方 avT≥bnB）+17/17 线上+冒烟 49/49+curl 三连+health 58；部署一次 exit 0（revision 00108-7bc）；rev 00108-7bc commit 7e165c7（未 push））；前身 rev 00107-jpf（';

const SITE_OLD = '站点号当前 **v0.2.22.4**（';
const SITE_NEW = '站点号当前 **v0.2.22.5**（2026-09-07 Community 主页 横幅+头像下调+分割线轮——用户「画分割线+头像下调些+添加横幅」：顶部全宽横幅 140px 品牌渐变+头像行横幅下下调+简介/头像间 1px 分割线；零后端；测试 252/252+电池 43/43 本地+17/17 线上+冒烟 49/49+curl 三连+health 58；rev 00108-7bc commit 7e165c7（未 push））；前身 v0.2.22.4（';

const SCHEME_OLD = '2026-09-07 v0.2.22.4 = ';
const SCHEME_NEW = '2026-09-07 v0.2.22.5 = Community 主页 横幅 + 头像下调 + 简介/头像分割线（补丁位 4→5·观感微调轮——用户「画分割线+头像下调些+添加横幅」：.profile-banner 140px 全宽品牌渐变横幅顶满卡+padding 移入 .profile-body+头像行横幅下下调+.profile-top 底 1px 分割线）；零后端；重建 119476 chars；测试 252/252+电池 43/43 本地+17/17 线上+冒烟 49/49+curl 三连+health 58，rev 00108-7bc commit 7e165c7（未 push））；前身 2026-09-07 v0.2.22.4 = ';

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
