// tmp-memory-update-506.js — v0.2.50.6 记忆仪式（backend-build-state head / scheme 条目 / MEMORY.md 指针）
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

const NEW_HEAD = '**当前线上 rev 00248-zwk（2026-09-18 v0.2.50.6 Messages Add Friend 改用户 ID 添加——用户「把那个Add Friend Chat 的email添加改成 输入用户id添加」；改法（只动 messages.html）：加好友弹窗输入框从 email 改为用户 ID（占位符 User ID (USR-XXXXXX) + 说明文案同步），云端模式 POST /conversations 恒发 {userId}（后端本就 userId 优先，零后端改动；email 分支零残留），404 文案「No user found with that ID.」；本地演示模式加好友流程原样；电池 msg-anim 38/38（新 F0-13 用户 ID 锚）+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿（六电池版本锚 50.5→50.6 已同步）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css；部署一次 exit 0（env 30 条零新键）；curl 链全绿（health 58 表/site-config 双版本/messages.html 用户 ID 占位+404 新文案在线+email 分支零残留）；commit b657ac7 未 push；前身 00247-cmw）**\n**前身 rev 00247-cmw（';

patch('backend-build-state.md', [['**当前线上 rev 00247-cmw（', NEW_HEAD]]);

const SCHEME_APPEND = '**v0.2.50.6（2026-09-18；补丁位 5→6 口径修正轮；rev 00248-zwk）= Messages Add Friend 改用户 ID 添加**——用户「把那个Add Friend Chat 的email添加改成 输入用户id添加」；只动 messages.html：加好友弹窗输入框从 email 改为用户 ID（占位符 User ID (USR-XXXXXX)、说明文案同步）、云端 POST /conversations 恒发 {userId}（后端本就 userId 优先，零后端改动、email 分支零残留）、404 文案「No user found with that ID.」；本地演示模式加好友流程原样；电池 msg-anim 38/38（新 F0-13 锚）+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿（六电池版本锚已同步）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css；部署一次 exit 0；curl 链全绿；commit b657ac7 未 push。';

patch('site-versioning-scheme.md', [['commit 88128bc 未 push。', 'commit 88128bc 未 push。' + SCHEME_APPEND]]);

patch('MEMORY.md', [
  ['**当前线上 rev 00247-cmw（2026-09-18 v0.2.50.5 Messages 移除测试群和聊天——用户「能不能把message内测试用的群和聊天去除？」；只动 messages.html：演示私聊/群/成员/消息全清、会话从空开始（新增/建群功能保留、云端会话不受影响）、DATA_VERSION 3→4 失效旧存档防复活、空态提示、公告保留；电池 msg-anim 37/37+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿、commit 88128bc 未 push；前身 00246-47s',
   '**当前线上 rev 00248-zwk（2026-09-18 v0.2.50.6 Messages Add Friend 改用户 ID 添加——用户「把那个Add Friend Chat 的email添加改成 输入用户id添加」；只动 messages.html：加好友弹窗输入框从 email 改为用户 ID（占位符 User ID (USR-XXXXXX)）、云端 POST /conversations 恒发 {userId}（后端本就 userId 优先，零后端改动、email 分支零残留）、404 文案「No user found with that ID.」；电池 msg-anim 38/38+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿、commit b657ac7 未 push；前身 00247-cmw Messages 移除测试群和聊天——用户「能不能把message内测试用的群和聊天去除？」；只动 messages.html：演示私聊/群/成员/消息全清、会话从空开始（新增/建群功能保留、云端会话不受影响）、DATA_VERSION 3→4 失效旧存档防复活、空态提示、公告保留；电池 msg-anim 37/37+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿、commit 88128bc 未 push；前身 00246-47s'],
  ['**当前：站点号 v0.2.50.5（Messages 移除测试群和聊天——用户「能不能把message内测试用的群和聊天去除？」；rev 00247-cmw；commit 88128bc 未 push）、FC v10.28.35.4**',
   '**当前：站点号 v0.2.50.6（Messages Add Friend 改用户 ID 添加——用户「把那个Add Friend Chat 的email添加改成 输入用户id添加」；rev 00248-zwk；commit b657ac7 未 push）、FC v10.28.35.4**'],
]);

console.log('memory ritual done');
