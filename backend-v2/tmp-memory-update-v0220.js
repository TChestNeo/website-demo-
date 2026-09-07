// v0.2.22.0 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00102-k7m（';
const REV_NEW = '**当前线上 rev 00103-w4k（2026-09-07 v0.2.22.0 Community 个人主页「编辑资料」独立弹窗——用户「我希望那个个人页面的简介那边的编辑资料是独立的而不是使用设置的」：编辑资料钮不再开设置弹窗改独立弹窗（头像上传+显示名+性别药丸+简介，字段预填当前值）；保存走 PATCH /api/auth/me 真后端持久化（设置弹窗只写 localStorage 的历史口径，公开门面必须落库）body 只带改动字段（无改动直接关零请求）；头像直传复用 /social/uploads（预检+10MB+就绪提示）；成功→toast+头部真后端重拉+侧栏同页即时更新（直接改 DOM）；401/429/服务端错误分路；本页零 localStorage——saveUser 会触发 mirrorProfile 二次全字段 PATCH（语言/国家/生日回流风险，电池 E1 双 PATCH 实证后移除，由下页 cloudMerge 拉 /auth/me 权威覆盖）；零后端零共享文件；测试 252/252+电池 39/39 本地（G3 可见性断言+E 组保存链+单次写入守卫 rawCalls.length===1 无 avatarUrl）+14/14 线上（L2 非本人无编辑钮 isSelf 专属）+冒烟 49/49+curl 四连+health 58；部署一次 exit 0（revision 00103-flb）；rev 00103-w4k commit 19ad538（未 push））；前身 rev 00102-k7m（';

const SITE_OLD = '站点号当前 **v0.2.21.0**（';
const SITE_NEW = '站点号当前 **v0.2.22.0**（2026-09-07 Community 个人主页「编辑资料」独立弹窗轮——用户「我希望那个个人页面的简介那边的编辑资料是独立的而不是使用设置的」：编辑资料钮改独立弹窗+PATCH /auth/me 落库+头像直传+零 localStorage（mirrorProfile 双写实证移除）；测试 252/252+电池 39/39 本地+14/14 线上+冒烟 49/49+curl 四连+health 58；rev 00103-w4k commit 19ad538（未 push））；前身 v0.2.21.0（';

const SCHEME_OLD = '2026-09-07 v0.2.21.0 = ';
const SCHEME_NEW = '2026-09-07 v0.2.22.0 = Community 个人主页「编辑资料」独立弹窗（小改动位 21→22 新功能轮·补丁清零——用户「我希望那个个人页面的简介那边的编辑资料是独立的而不是使用设置的」：编辑资料钮改独立弹窗（头像上传+显示名+性别药丸+简介）；PATCH /auth/me 真后端持久化 body 只带改动字段；头像复用 /social/uploads 直传；本页零 localStorage（mirrorProfile 双写实证后移除）；重建 117409 chars；测试 252/252+电池 39/39 本地+14/14 线上+冒烟 49/49+curl 四连+health 58，rev 00103-w4k commit 19ad538（未 push））；前身 2026-09-07 v0.2.21.0 = ';

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
