// v0.2.22.4 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00106-l9s（';
const REV_NEW = '**当前线上 rev 00107-jpf（2026-09-07 v0.2.22.4 Community 主页 获赞量 → 与粉丝/关注并排——用户「获赞是和粉丝关注并排的」：获赞从统计区五块移出（统计区恢复四块 grid 4 列、profile-stat-static 删除）→ 并入 .profile-counts 第三组（粉丝 关注 获赞 三组并排，仍在 .profile-top 行最右，rightEdge=0 几何断言保持）；后端 likeReceivedCount 保留不动；零后端零共享文件（tail 改+重建 118725 chars）；测试 252/252+电池 42/42 本地（G2 counts 并排断言 2 粉丝 3 关注 1 获赞+rightEdge=0 实测）+16/16 线上（真用户 0 粉丝 0 关注 1 获赞真实渲染）+冒烟 49/49+curl 三连+health 58；部署一次 exit 0（revision 00107-jpf）；rev 00107-jpf commit f6f98d4（未 push））；前身 rev 00106-l9s（';

const SITE_OLD = '站点号当前 **v0.2.22.3**（';
const SITE_NEW = '站点号当前 **v0.2.22.4**（2026-09-07 Community 主页 获赞量 → 与粉丝/关注并排轮——用户「获赞是和粉丝关注并排的」：获赞从统计区五块移出并入 .profile-counts 第三组（粉丝 关注 获赞 并排，仍在行最右）；统计区恢复四块；零后端；测试 252/252+电池 42/42 本地+16/16 线上+冒烟 49/49+curl 三连+health 58；rev 00107-jpf commit f6f98d4（未 push））；前身 v0.2.22.3（';

const SCHEME_OLD = '2026-09-07 v0.2.22.3 = ';
const SCHEME_NEW = '2026-09-07 v0.2.22.4 = Community 主页 获赞量 → 与粉丝/关注并排（补丁位 3→4·观感微调轮——用户「获赞是和粉丝关注并排的」：获赞从统计区五块移出并入 .profile-counts 第三组（粉丝 关注 获赞 并排仍在行最右）；统计区恢复四块 grid；零后端；重建 118725 chars；测试 252/252+电池 42/42 本地+16/16 线上+冒烟 49/49+curl 三连+health 58，rev 00107-jpf commit f6f98d4（未 push））；前身 2026-09-07 v0.2.22.3 = ';

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
