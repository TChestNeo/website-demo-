// v0.2.21.0 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00101-vjv（';
const REV_NEW = '**当前线上 rev 00102-k7m（2026-09-07 v0.2.21.0 Community 个人主页+关注系统——用户「先把用户的个人主页做一下吧？」→问询钦定完整版 Twitter 式主页（头像/名字/简介/加入时间/统计 4 块+帖子/转发/点赞/收藏 4 tab）+关注系统+三入口（hub/帖页作者锚+侧栏自己头像锚+自己主页编辑资料钮）；后端：迁移 017 following.users 显示名→id 引用（同名取最早、banned/deleted 映射不到删、idx_following_target、health 58 不变、user_version 16→17）+social.js 四端点 GET /api/social/users/:id（active-only 404+optionalViewer+stats 四查询）+GET /:id/posts?tab=四 tab（复用 postRow+bogus 400）+POST/DELETE /:id/follow（幂等+自关 400）+PUT /following USR- 过滤防显示名回流+commentRow authorId；测试 236→252/252（social-profile 15 测+migrations 017）；前端新页 community-profile.html（构建 109778 chars：头部卡+统计 4 块可点切 tab+关注三态+同款全操作行+撤销出列 maybeReloadTab+分享链接拼帖页 URL+空态文案+灯箱+零 localStorage）；电池 30/30 本地+13/13 线上（真用户 TChestBox_Neo 主页真实渲染 stats 1/0/1/0）+冒烟 49/49+curl 七连+health 58；部署一次 exit 0（catchup#1 线上日志确认）；rev 00102-k7m commit deaa5b5（未 push））；前身 rev 00101-vjv（';

const SITE_OLD = '站点号当前 **v0.2.20.4**（';
const SITE_NEW = '站点号当前 **v0.2.21.0**（2026-09-07 Community 个人主页+关注系统轮——用户「先把用户的个人主页做一下吧？」：新页 community-profile.html+迁移 017+关注端点+三入口；测试 252/252+电池 30/30 本地+13/13 线上+冒烟 49/49+curl 七连+health 58；rev 00102-k7m commit deaa5b5（未 push））；前身 v0.2.20.4（';

const SCHEME_OLD = '2026-09-06 v0.2.20.4 = ';
const SCHEME_NEW = '2026-09-07 v0.2.21.0 = Community 个人主页 + 关注系统（小改动位 20→21 新功能轮·补丁清零——用户「先把用户的个人主页做一下吧？」：新页 community-profile.html（构建 109778 chars：头部卡+统计 4 块+4 tab 药丸+关注三态+同款全操作行+撤销出列+灯箱）+迁移 017 following 显示名→id+关注端点+三入口（hub/帖页作者锚+侧栏 USR- 门控锚）；测试 236→252/252+电池 30/30 本地+13/13 线上+冒烟 49/49+curl 七连+health 58，rev 00102-k7m commit deaa5b5（未 push））；前身 2026-09-06 v0.2.20.4 = ';

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
