// tmp-memory-update-507.js — v0.2.50.7 记忆仪式（backend-build-state head / scheme 条目 / MEMORY.md 指针）
'use strict';
const fs = require('fs');
const DIR = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

function patch(file, pairs) {
  let c = fs.readFileSync(DIR + file, 'utf8');
  for (const [from, to] of pairs) {
    if (c.indexOf(from) === -1) throw new Error(file + ': NOT FOUND: ' + from.slice(0, 70));
    if (c.split(from).length > 2) throw new Error(file + ': NOT UNIQUE: ' + from.slice(0, 70));
    c = c.replace(from, to);
  }
  fs.writeFileSync(DIR + file, c, 'utf8');
  console.log('patched: ' + file);
}

const NEW_HEAD = '**当前线上 rev 00249-dll（2026-09-18 v0.2.50.7 Messages + 弹窗淡入动画——用户「那个弹窗出现时能不能添加一个淡入的动画？」；改法（只动 messages.html）：actionModal（Add Friend/Create Group 弹窗）出现时遮罩 0.2s 淡入 + 卡片 0.25s 上浮缩放淡入（@keyframes modalFadeIn/modalCardIn，页面专属 CSS 留在页面内）；关闭仍即时（用户只要求淡入）；电池 msg-anim 40/40（新 F0-14 弹窗淡入静态锚 + 新 M8-2b 开场双动画在跑+落定全不透明——M8-2b 首跑踩坑：headless 动画时间轴滞后墙钟（M9 已知 ~10-15fps），卡片 0.25s 动画在 +500ms 墙钟时仍标记运行中，落定断言只看 computed opacity 全不透明）+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿（六电池版本锚 50.6→50.7 已同步）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css；部署一次 exit 0（env 30 条零新键）；curl 链全绿（health 58 表/site-config 双版本/messages.html 双 keyframes+双动画规则在线+506 用户 ID 改动无回退）；commit 35318da 未 push；前身 00248-zwk）**\n**前身 rev 00248-zwk（';

patch('backend-build-state.md', [['**当前线上 rev 00248-zwk（', NEW_HEAD]]);

const SCHEME_APPEND = '**v0.2.50.7（2026-09-18；补丁位 6→7 观感轮；rev 00249-dll）= Messages + 弹窗淡入动画**——用户「那个弹窗出现时能不能添加一个淡入的动画？」；只动 messages.html：actionModal（Add Friend/Create Group 弹窗）出现时遮罩 0.2s 淡入 + 卡片 0.25s 上浮缩放淡入（@keyframes modalFadeIn/modalCardIn，页面专属 CSS 留在页面内）；关闭仍即时（用户只要求淡入）；电池 msg-anim 40/40（新 F0-14 静态锚 + 新 M8-2b 运行时淡入——headless 动画时间轴滞后墙钟，落定断言只看 computed opacity）+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿（六电池版本锚已同步）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css；部署一次 exit 0；curl 链全绿；commit 35318da 未 push。';

patch('site-versioning-scheme.md', [['commit b657ac7 未 push。', 'commit b657ac7 未 push。' + SCHEME_APPEND]]);

patch('MEMORY.md', [
  ['**当前线上 rev 00248-zwk（2026-09-18 v0.2.50.6 Messages Add Friend 改用户 ID 添加——用户「把那个Add Friend Chat 的email添加改成 输入用户id添加」；只动 messages.html：加好友弹窗输入框从 email 改为用户 ID（占位符 User ID (USR-XXXXXX)）、云端 POST /conversations 恒发 {userId}（后端本就 userId 优先，零后端改动、email 分支零残留）、404 文案「No user found with that ID.」；电池 msg-anim 38/38+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿、commit b657ac7 未 push；前身 00247-cmw',
   '**当前线上 rev 00249-dll（2026-09-18 v0.2.50.7 Messages + 弹窗淡入动画——用户「那个弹窗出现时能不能添加一个淡入的动画？」；只动 messages.html：actionModal（Add Friend/Create Group 弹窗）出现时遮罩 0.2s 淡入 + 卡片 0.25s 上浮缩放淡入（@keyframes modalFadeIn/modalCardIn，页面专属 CSS 留在页面内）；关闭仍即时；电池 msg-anim 40/40+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿、commit 35318da 未 push；前身 00248-zwk Messages Add Friend 改用户 ID 添加——用户「把那个Add Friend Chat 的email添加改成 输入用户id添加」；只动 messages.html：加好友弹窗输入框从 email 改为用户 ID（占位符 User ID (USR-XXXXXX)）、云端 POST /conversations 恒发 {userId}（后端本就 userId 优先，零后端改动、email 分支零残留）、404 文案「No user found with that ID.」；电池 msg-anim 38/38+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿、commit b657ac7 未 push；前身 00247-cmw'],
  ['**当前：站点号 v0.2.50.6（Messages Add Friend 改用户 ID 添加——用户「把那个Add Friend Chat 的email添加改成 输入用户id添加」；rev 00248-zwk；commit b657ac7 未 push）、FC v10.28.35.4**',
   '**当前：站点号 v0.2.50.7（Messages + 弹窗淡入动画——用户「那个弹窗出现时能不能添加一个淡入的动画？」；rev 00249-dll；commit 35318da 未 push）、FC v10.28.35.4**'],
]);

console.log('memory ritual done');
