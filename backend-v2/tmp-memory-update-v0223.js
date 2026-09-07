// v0.2.22.3 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00105-j7h（';
const REV_NEW = '**当前线上 rev 00106-l9s（2026-09-07 v0.2.22.3 Community 主页 粉丝/关注 → 头部最右边 + 获赞量——用户「然后把粉丝关注一样放到右侧但是是最右边，然后再添加一个获赞量」：①粉丝/关注移入 .profile-top 行最右（信息列 flex:1 推贴行右缘、counts flex:none 防压缩、profileFollowerCount id 保留关注链即时更新）；②统计区四块 → 五块加「获赞」纯展示块（帖子/转发/获赞/点赞/收藏，无 tab 不可点——profile-stat-static cursor:default+hover 覆盖+grid 5 列）；③后端 GET /api/social/users/:id stats 加 likeReceivedCount（本人可见帖收到赞 JOIN 聚合含转发帖，无迁移无新表 health 58 不变）；测试 252/252（social-profile 两处 stats 断言同步+种赞获赞量 1）+电池 42/42 本地（G2 新几何断言——粉丝关注贴行最右缘 rightEdge=0 实测+在头像右侧 pcL=944.5>avR=524.5+统计五块 1/1/1/2/1）+16/16 线上（L2 rightEdge=0+真用户 TChestBox_Neo 获赞量真实渲染 nums=1/0/1/1/0）+冒烟 49/49+curl 四连（health 58+版本+profile stats 含 likeReceivedCount=1 真实+stat-static×3）+health 58；部署一次 exit 0（revision 00106-l9s）；rev 00106-l9s commit 51b59e2（未 push））；前身 rev 00105-j7h（';

const SITE_OLD = '站点号当前 **v0.2.22.2**（';
const SITE_NEW = '站点号当前 **v0.2.22.3**（2026-09-07 Community 主页 粉丝/关注 → 头部最右边 + 获赞量轮——用户「然后把粉丝关注一样放到右侧但是是最右边，然后再添加一个获赞量」：粉丝/关注移 .profile-top 行最右+统计区加「获赞」纯展示块五块+后端 stats 加 likeReceivedCount；测试 252/252+电池 42/42 本地（G2 最右缘几何断言）+16/16 线上+冒烟 49/49+curl 四连+health 58；rev 00106-l9s commit 51b59e2（未 push））；前身 v0.2.22.2（';

const SCHEME_OLD = '2026-09-07 v0.2.22.2 = ';
const SCHEME_NEW = '2026-09-07 v0.2.22.3 = Community 主页 粉丝/关注 → 头部最右边 + 获赞量（补丁位 2→3·观感微调轮——用户「然后把粉丝关注一样放到右侧但是是最右边，然后再添加一个获赞量」：粉丝/关注移 .profile-top 行最右（rightEdge=0 几何断言实证）+统计区加「获赞」纯展示块（5 列 grid，无 tab 不可点）+后端 stats 加 likeReceivedCount JOIN 聚合（无迁移）；重建 119029 chars；测试 252/252+电池 42/42 本地+16/16 线上+冒烟 49/49+curl 四连+health 58，rev 00106-l9s commit 51b59e2（未 push））；前身 2026-09-07 v0.2.22.2 = ';

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
