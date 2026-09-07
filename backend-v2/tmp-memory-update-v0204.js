'use strict';
// tmp-memory-update-v0204.js — v0.2.20.4 记忆文件四锚点更新（rev 00101-vjv，commit 5aecff3 未 push）
// 锚点：MEMORY.md 行9（backend hook）/行11（site-versioning hook）+ backend-build-state.md 行12 + site-versioning-scheme.md 链头
const fs = require('node:fs');
const DIR = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

const HEAD_FULL = '2026-09-06 v0.2.20.4 Community 部署丢点赞修复+星+分享再靠拢 4px——用户「再靠近4px, 然后为什么每次你更新完后我之前点赞过就会消失」：①星钮 margin-right:-18px→-22px——星↔分享间隙 -2px→-6px（按钮盒重叠 6px、图标更贴；margin-left:auto 保留、分享仍贴行右缘；真/演示卡+帖页三处同改+重建 106340 chars）；②丢点赞根因实锤（快照双向实证）=部署瞬间新旧实例并存，新实例冷启动恢复旧实例上一次定时快照，旧实例 SIGTERM 临终快照晚 ~6s 落地无人再读→旧实例最后 ≤interval 写入（点赞/收藏）丢进修剪链（旧快照 like@15:51:44 vs 新实例恢复快照无）；③修复=scripts/snapshot-catchup.js catch-up 追恢复：entrypoint 启动后 +75s/+150s 两次复查桶内其他 bootId 快照，mtime 晚于启动恢复份+本实例零写入（写计数守卫挂 api.db.prepare().run()，浏览量 view_count 自增除外——00098 实测被电池/访客 2 次 view tick 挡死）→ATTACH 整表 DELETE+INSERT 并回活库（活库连接常驻、覆盖库文件不生效；57 表除 audit_log；FK 临时关+foreign_key_check 校验；幂等+restoredM 防 catchup#2 重并；snapDir 模块级防 00099 ReferenceError）+SNAPSHOT_INTERVAL_MS 60000→15000 收窄启动恢复陈旧度；测试 233→236/236（catchup 3 测）+合并单机验证 12/12+电池 59/59 本地（A7 g5 断言改重叠区间 -8~-2px——g5=-6 实测）+19/19 线上+冒烟 49/49+curl 七连（feed likeCount=1 用户点赞经 4 次部署全程保留）+health 58；部署四次（00098-fgd 守卫挡死→00099-cgk snapDir ReferenceError→00100-5sg 追恢复完成 686140ec 57 表 FK 通过但 catchup#2 幂等重并→00101-vjv 修复重并）——线上日志 catchup#1 追恢复完成 c6def771（57 表，FK 校验 通过）+catchup#2 无晚于启动恢复的其他实例快照，机制在线上真实走通，rev 00101-vjv commit 5aecff3（未 push）——踩坑：写计数守卫必须豁免浏览量自增否则每次部署都被电池/访客 view tick 挡死（00098）、catchup#2 幂等重并靠 restoredM 更新防重（00100）';

const SITE_FULL = '2026-09-06 Community 部署丢点赞修复+星+分享再靠拢 4px 轮——用户「再靠近4px, 然后为什么每次你更新完后我之前点赞过就会消失」：①星钮 margin-right:-18px→-22px（星↔分享间隙 -2px→-6px、按钮盒重叠 6px；三处同改+重建 106340 chars）；②丢点赞根因实锤=部署瞬间新旧实例并存、新实例冷启动恢复旧实例上一次定时快照、旧实例 SIGTERM 临终快照晚 ~6s 落地无人再读→最后 ≤interval 写入（点赞/收藏）丢进修剪链（旧快照 like@15:51:44 vs 新实例恢复快照无）；③修复=snapshot-catchup.js catch-up 追恢复（+75s/+150s 复查其他 bootId 快照+本实例零写入（写计数守卫，浏览量自增除外——00098 被 2 次 view tick 挡死）→ATTACH 整表并回活库（57 表除 audit_log；FK 临时关+校验；幂等+restoredM 防重并）+SNAPSHOT_INTERVAL_MS 15s；测试 233→236/236+合并单机验证 12/12+电池 59/59 本地（g5=-6 实测）+19/19 线上+冒烟 49/49+curl 七连（feed likeCount=1 用户点赞经 4 次部署全程保留）+health 58；部署四次（00098-fgd 守卫挡死→00099-cgk snapDir ReferenceError→00100-5sg 追恢复完成但 catchup#2 幂等重并→00101-vjv 修复重并，线上日志 catchup#1 追恢复完成 c6def771+catchup#2 无晚于启动恢复的其他实例快照——机制在线上真实走通），rev 00101-vjv commit 5aecff3（未 push）——踩坑：写计数守卫必须豁免浏览量自增（否则每次部署都被电池/访客 view tick 挡死）、catchup#2 幂等重并靠 restoredM 更新防重';

const SITE_CHAIN = '2026-09-06 v0.2.20.4 = Community 部署丢点赞修复+星+分享再靠拢 4px（补丁位 3→4 修复轮——用户「再靠近4px, 然后为什么每次你更新完后我之前点赞过就会消失」：①星钮 margin-right:-18px→-22px——星↔分享间隙 -2px→-6px（按钮盒重叠 6px、图标更贴；margin-left:auto 保留、分享仍贴行右缘；真/演示卡+帖页三处同改+重建 106340 chars）；②丢点赞根因实锤（快照双向实证）=部署瞬间新旧实例并存、新实例冷启动恢复旧实例上一次定时快照、旧实例 SIGTERM 临终快照晚 ~6s 落地无人再读→最后 ≤interval 写入（点赞/收藏）丢进修剪链（旧快照 like@15:51:44 vs 新实例恢复快照无）；③修复=snapshot-catchup.js catch-up 追恢复（+75s/+150s 复查其他 bootId 快照+mtime 晚于启动恢复份+本实例零写入（写计数守卫挂 prepare().run()，浏览量自增除外——00098 被 2 次 view tick 挡死）→ATTACH 整表并回活库（57 表除 audit_log；FK 临时关+foreign_key_check；幂等+restoredM 防重并；snapDir 模块级防 00099 ReferenceError）+SNAPSHOT_INTERVAL_MS 15s；测试 233→236/236（catchup 3 测）+合并单机验证 12/12+电池 59/59 本地（A7 g5 改重叠区间 -8~-2px——g5=-6 实测）+19/19 线上+冒烟 49/49+curl 七连+health 58；部署四次（00098-fgd 守卫挡死→00099-cgk snapDir ReferenceError→00100-5sg 追恢复完成 686140ec 57 表 FK 通过但 catchup#2 幂等重并→00101-vjv 修复重并）——线上日志 catchup#1 追恢复完成 c6def771（57 表，FK 校验 通过）+catchup#2 无晚于启动恢复的其他实例快照，机制在线上真实走通，rev 00101-vjv commit 5aecff3（未 push））';

const EDITS = [
  { file: 'MEMORY.md', old: '**当前线上 rev 00097-n8v（', new: '**当前线上 rev 00101-vjv（' + HEAD_FULL + '）；前身 rev 00097-n8v（' },
  { file: 'MEMORY.md', old: '站点号当前 **v0.2.20.3**（', new: '站点号当前 **v0.2.20.4**（' + SITE_FULL + '）；前身 v0.2.20.3（' },
  { file: 'backend-build-state.md', old: '当前线上 rev 00097-n8v（', new: '当前线上 rev 00101-vjv（' + HEAD_FULL + '）；前身 rev 00097-n8v（' },
  { file: 'site-versioning-scheme.md', old: '2026-09-06 v0.2.20.3 = ', new: SITE_CHAIN + '）；2026-09-06 v0.2.20.3 = ' }
];

let fail = 0;
for (const e of EDITS) {
  const p = DIR + '/' + e.file;
  const s = fs.readFileSync(p, 'utf8');
  const n = s.split(e.old).length - 1;
  if (n !== 1) { console.error('✗ ' + e.file + ' 锚点出现 ' + n + ' 次（期望 1）: ' + e.old.slice(0, 40)); fail++; continue; }
  fs.writeFileSync(p, s.replace(e.old, e.new));
  console.log('✓ ' + e.file + ': ' + e.old.slice(0, 30) + '… → 已更新');
}
if (fail) { console.error('失败 ' + fail + ' 处，检查锚点'); process.exit(1); }
console.log('4 锚点全部更新完成（H2=5aecff3）');
