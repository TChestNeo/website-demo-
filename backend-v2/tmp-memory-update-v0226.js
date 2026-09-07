// v0.2.22.6 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00108-7bc（';
const REV_NEW = '**当前线上 rev 00109-zb7（2026-09-07 v0.2.22.6 Community 点赞/收藏默认私人——用户「把点赞和收藏变成默认私人的就是只有你可以看见」：①后端 social.js 主页端点 stats.likeCount/favoriteCount 非本人一律 null（获赞量 likeReceivedCount 保持公开——上轮钦定与粉丝/关注并排）；GET /users/:id/posts tab=likes/favorites 非本人一律 403（HttpError FORBIDDEN→http.js 403，匿名/他人同拒，本人 200 不变）；②测试 252→253/253（新 403 隐私测试：匿名 tab=likes 403+他人 tab=favorites 403+本人 200 含 likedByMe/favoritedByMe；匿名 profile stats 双 null 断言；stats 准确性/tab/hidden 排除测试改传本人 cookie——匿名 403 后老断言 .posts 报 undefined 第一跑 1 fail 修正）；③前端 tail：非本人主页只渲染 帖子/转发 2 tab（TAB_DEFS.slice(0,2)）+统计块只 帖子/转发 2 块（u.isSelf 门控，获赞在 counts 仍公开）+ .profile-stats 改 flex wrap 平分（.profile-stat flex:1 1 0 防 2 块空列）+重建 119709 chars；④电池 44/44 本地（O1 新断言 tabs=2+statTabs=posts,reposts；OTHER seed 双 null；S1/L1 版本）+15/15 线上（L2 非本人 2 tab+2 统计块+获赞仍在 counts；L4 线上只走帖子/转发 2 tab——4 tab 全链本地 G 组自测；真用户 TChestBox_Neo 1/0 两块真实渲染）+冒烟 49/49+curl 五连（health 58+版本 v0.2.22.6+匿名 tab=likes/favorites 双 403+匿名 profile stats 双 null）；部署一次 exit 0（revision 00109-zb7）；rev 00109-zb7 commit 37aebc2（未 push））；前身 rev 00108-7bc（';

const SITE_OLD = '站点号当前 **v0.2.22.5**（';
const SITE_NEW = '站点号当前 **v0.2.22.6**（2026-09-07 Community 点赞/收藏默认私人轮——用户「把点赞和收藏变成默认私人的就是只有你可以看见」：非本人主页只 帖子/转发 2 tab+2 统计块（获赞在 counts 仍公开）；后端 tab=likes/favorites 非本人 403+stats 双 null；测试 253/253+电池 44/44 本地+15/15 线上+冒烟 49/49+curl 五连+health 58；rev 00109-zb7 commit 37aebc2（未 push））；前身 v0.2.22.5（';

const SCHEME_OLD = '2026-09-07 v0.2.22.5 = ';
const SCHEME_NEW = '2026-09-07 v0.2.22.6 = Community 点赞/收藏默认私人（补丁位 5→6 口径修正轮——用户「把点赞和收藏变成默认私人的就是只有你可以看见」：非本人主页只 帖子/转发 2 tab+2 统计块（获赞在 counts 仍公开）；后端 tab=likes/favorites 非本人 403+stats.likeCount/favoriteCount null；测试 252→253/253+电池 44/44 本地+15/15 线上+冒烟 49/49+curl 五连+health 58，rev 00109-zb7 commit 37aebc2（未 push））；前身 2026-09-07 v0.2.22.5 = ';

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
