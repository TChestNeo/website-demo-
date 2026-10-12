// tmp-memory-update-504.js — v0.2.50.4 记忆仪式（backend-build-state head / scheme 条目 / untouchable 补记 / MEMORY.md 指针）
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

const NEW_HEAD = '**当前线上 rev 00246-47s（2026-09-18 v0.2.50.4 守卫收窄修复——用户报告部分页面切页上下淡出淡入动画「不见或乱透了」；诊断：50.3 双动画守卫 hasActiveOpacityAnim 的 getAnimations() 不只返回 CSS 关键帧动画、也会返回运行中的 CSS 过渡——boot 解除 pre-stagger 的同一 tick 里守卫的 getAnimations() 强制刷样式，.card 基类 transition: all 0.2s（覆盖 opacity）当场起 0→1 过渡，progress=0<1（真实浏览器 phase=active 同样命中）→ 误判「已有关键帧动画」→ 整卡跳过波浪（探针实证 dashboard 10 张卡、community-hub 1 张卡中招——乱透了/动画不见；50.3 电池 76 starts 全绿没抓到=被跳过的卡 pre-stagger 过渡照样发 transitionstart 污染计数+withWC 阈值过松）；修法（只动 transitions.js）：守卫收窄为只认 CSS 关键帧动画（构造器 CSSTransition + transitionProperty 双重过滤）——欢迎卡 animate-fade-in-up 是 CSSAnimation 照常正确跳过，所有动画一个不少、节奏/时长/缓动/双模式逐字不动（纯 bug 修复非观感改动）；新探针 tmp-probe-guard-504.js 23/23（11 页 boot 守卫输入捕获+老守卫判定重放+每页可见卡漏动画=0+would-skip 集合仅欢迎卡）；电池 fadefix 36/36（新 F9 收窄锚+新 M1i/M2i 波浪覆盖断言——transitionstart 瞬间内联过渡目标数=可见卡数，dashboard 23/23 严格相等、Messages ≥5 差额=页内原生入场动画抢先改 transform 写入即终值无新过渡可起快照实证 8 张全被写入观感无损）+回归 msg-anim 31/31+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48 全绿（四回归电池版本锚 50.3→50.4 已同步）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css、页面 HTML 零改动；部署一次 exit 0（docker build/push+gcloud.ps1，env 30 条从 describe 全量重建零新键，无插曲）；curl 链全绿（health 58 表/site-config 双版本 v0.2.50.4+v10.28.35.4+守卫收窄修复标记/transitions.js 收窄双过滤+rAF+守卫+willChange×5+双模式串+安全定时在线）；commit a37e433 未 push；前身 00245-g89）**\n**前身 rev 00245-g89（';

patch('backend-build-state.md', [['**当前线上 rev 00245-g89（', NEW_HEAD]]);

const SCHEME_APPEND = '**v0.2.50.4（2026-09-18；补丁位 3→4 纯修复轮；rev 00246-47s）= 守卫收窄修复**——用户报告部分页面切页上下淡出淡入动画「不见或乱透了」；诊断：50.3 双动画守卫 getAnimations() 也会返回运行中的 CSS 过渡，boot 解除 pre-stagger 同一 tick 守卫强制刷样式，.card 基类 transition: all 0.2s 当场起 0→1 过渡 → 误判「已有关键帧动画」整卡跳过波浪（探针实证 dashboard 10 张、community-hub 1 张中招）；修法（只动 transitions.js）：守卫收窄只认 CSS 关键帧动画（构造器 CSSTransition+transitionProperty 双重过滤），所有动画一个不少、节奏/时长/缓动/双模式逐字不动（纯 bug 修复）；探针 23/23（11 页）+电池 fadefix 36/36（新 M1i/M2i 波浪覆盖断言——transitionstart 瞬间内联过渡目标数=可见卡数，dashboard 23/23 严格相等、Messages ≥5 差额=页内原生入场动画抢先改 transform 写入即终值无新过渡可起快照实证 8 张全被写入观感无损）+回归 msg-anim 31/31+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48 全绿；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动、页面 HTML 零改动；部署一次 exit 0（无插曲）；curl 链全绿；commit a37e433 未 push。';

patch('site-versioning-scheme.md', [['commit 6eb15a5 未 push。', 'commit 6eb15a5 未 push。' + SCHEME_APPEND]]);

patch('transitions-animation-untouchable.md', [['此条与 v0.2.50.1 纠正轮同源：任何性能修法若触碰观感（渐变/时长/缓动/动画范围），先列选项问用户。',
  '此条与 v0.2.50.1 纠正轮同源：任何性能修法若触碰观感（渐变/时长/缓动/动画范围），先列选项问用户。\n\n2026-09-18 v0.2.50.4 守约补记：用户报告「页面切换时的上下淡出淡入动画在有一些页面不见或乱透了」——查实是 50.3 隐形轮的守卫 bug（把 boot 的 pre-stagger opacity 过渡误判为关键帧动画、部分页卡跳过波浪），非观感被砍。修法=守卫收窄只认 CSS 关键帧动画（纯 bug 修复），所有动画（渐隐、全卡波浪、节奏、时长、缓动、双模式）一个不少——用户钦定观感再次全量保留，探针+电池实证。教训落地：任何「隐形」机制都要加观感回归网（本轮新 M1i/M2i 波浪覆盖断言），否则「动画不见」类回归会被过渡事件计数污染蒙混过关。']]);

patch('MEMORY.md', [
  ['**当前线上 rev 00245-g89（2026-09-17 v0.2.50.3 进场帧健康隐形修复——三刀全隐形（rAF 批量波浪/will-change 层提升/双动画守卫）、电池 fadefix 33/33 双模式+五回归全绿、commit 6eb15a5 未 push；前身 00244-6db Messages 页专属轻量切页模式 v0.2.50.2——用户「不是你之间撤销到我要求你优化message页面之前」',
   '**当前线上 rev 00246-47s（2026-09-18 v0.2.50.4 守卫收窄修复——50.3 双动画守卫把 boot 的 pre-stagger opacity 过渡误判为关键帧动画、部分页卡跳过波浪（用户「页面切换时的上下淡出淡入动画在有一些页面不见或乱透了」）；修法只动 transitions.js：守卫收窄只认 CSS 关键帧动画（CSSTransition+transitionProperty 双重过滤）、所有动画一个不少；探针 23/23+电池 fadefix 36/36+五回归全绿、commit a37e433 未 push；前身 00245-g89 进场帧健康隐形修复——三刀全隐形（rAF 批量波浪/will-change 层提升/双动画守卫）、电池 fadefix 33/33 双模式+五回归全绿、commit 6eb15a5 未 push；前身 00244-6db Messages 页专属轻量切页模式 v0.2.50.2——用户「不是你之间撤销到我要求你优化message页面之前」'],
  ['**当前：站点号 v0.2.50.3（进场帧健康隐形修复——用户「之前Gemini都说了会掉帧卡顿现在出现了」；rev 00245-g89；commit 6eb15a5 未 push）、FC v10.28.35.4**',
   '**当前：站点号 v0.2.50.4（守卫收窄修复——用户「页面切换时的上下淡出淡入动画在有一些页面不见或乱透了」；rev 00246-47s；commit a37e433 未 push）、FC v10.28.35.4**'],
  ['（2026-09-17 被纠正「那个你不能动」；v0.2.50.3 隐形轮守约：三刀全隐形零观感变化）',
   '（2026-09-17 被纠正「那个你不能动」；v0.2.50.3 隐形轮守约：三刀全隐形零观感变化；v0.2.50.4 补丁轮：50.3 守卫误判致部分页卡动画不见——收窄守卫修 bug、动画一个不少）'],
]);

console.log('memory ritual done');
