// tmp-memory-update-505.js — v0.2.50.5 记忆仪式（backend-build-state head / scheme 条目 / MEMORY.md 指针）
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

const NEW_HEAD = '**当前线上 rev 00247-cmw（2026-09-18 v0.2.50.5 Messages 移除测试群和聊天——用户「能不能把message内测试用的群和聊天去除？」；改法（只动 messages.html）：移除全部演示数据（3 演示私聊 Marcus Vane/Studio Prime/Sovereign Council + 6 演示群 + 群成员表 + 演示群消息），会话/群从空开始（新增会话 addFriendDemo、建群 createGroupDemo 功能原样保留、云端会话 /api/conversations 不受影响）；DATA_VERSION 3→4 失效旧 localStorage（旧存档会把已删的测试数据合并复活）；侧栏空列表加空态提示（tap + 开始）；公告保留（用户只要求群和聊天）；电池 msg-anim 37/37（F0-12 零残留锚 + M4/M4b 重写真实新建流）+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿（六电池版本锚 50.4→50.5 已同步）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css；部署一次 exit 0（env 30 条零新键）；curl 链全绿（health 58 表/site-config 双版本/messages.html 空默认+DATA_VERSION=4+双空态提示在线+Marcus Vane 零残留）；commit 88128bc 未 push；前身 00246-47s）**\n**前身 rev 00246-47s（';

patch('backend-build-state.md', [['**当前线上 rev 00246-47s（', NEW_HEAD]]);

const SCHEME_APPEND = '**v0.2.50.5（2026-09-18；补丁位 4→5 口径修正轮；rev 00247-cmw）= Messages 移除测试群和聊天**——用户「能不能把message内测试用的群和聊天去除？」；只动 messages.html：演示数据全清（3 演示私聊+6 演示群+群成员表+演示群消息）、会话/群从空开始（新增/建群功能原样保留、云端会话不受影响）、DATA_VERSION 3→4 失效旧 localStorage 防复活、侧栏空态提示、公告保留（用户只要求群和聊天）；电池 msg-anim 37/37+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿（六电池版本锚已同步）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css；部署一次 exit 0；curl 链全绿；commit 88128bc 未 push。';

patch('site-versioning-scheme.md', [['commit a37e433 未 push。', 'commit a37e433 未 push。' + SCHEME_APPEND]]);

patch('MEMORY.md', [
  ['**当前线上 rev 00246-47s（2026-09-18 v0.2.50.4 守卫收窄修复——50.3 双动画守卫把 boot 的 pre-stagger opacity 过渡误判为关键帧动画、部分页卡跳过波浪',
   '**当前线上 rev 00247-cmw（2026-09-18 v0.2.50.5 Messages 移除测试群和聊天——用户「能不能把message内测试用的群和聊天去除？」；只动 messages.html：演示私聊/群/成员/消息全清、会话从空开始（新增/建群功能保留、云端会话不受影响）、DATA_VERSION 3→4 失效旧存档防复活、空态提示、公告保留；电池 msg-anim 37/37+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48+fadefix 36/36 全绿、commit 88128bc 未 push；前身 00246-47s 守卫收窄修复——50.3 双动画守卫把 boot 的 pre-stagger opacity 过渡误判为关键帧动画、部分页卡跳过波浪'],
  ['**当前：站点号 v0.2.50.4（守卫收窄修复——用户「页面切换时的上下淡出淡入动画在有一些页面不见或乱透了」；rev 00246-47s；commit a37e433 未 push）、FC v10.28.35.4**',
   '**当前：站点号 v0.2.50.5（Messages 移除测试群和聊天——用户「能不能把message内测试用的群和聊天去除？」；rev 00247-cmw；commit 88128bc 未 push）、FC v10.28.35.4**'],
]);

console.log('memory ritual done');
