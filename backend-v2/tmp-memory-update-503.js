// tmp-memory-update-503.js — v0.2.50.3 记忆仪式（backend-build-state head / scheme 条目 / untouchable 补记 / MEMORY.md 指针）
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

const NEW_HEAD = '**当前线上 rev 00245-g89（2026-09-17 v0.2.50.3 切页进场帧健康隐形修复——用户「之前Gemini都说了会掉帧卡顿现在出现了……之前的那个淡入的效果也是很卡也不一致」+钦定红线「不可以取舍任何限制拥有的所有过渡动画」（所有动画一个不少、观感零变化）；诊断：入场波浪 opacity<1 让磨砂卡（.card blur 24px/.search-capsule 16px/.auth-card 32px）逐帧重采样背景=掉帧主因（fadefix 电池 before 基线实证 dashboard 波浪 75% 帧>20ms、max 233ms），淡入不一致=逐卡 setTimeout 离帧起播+欢迎卡 animate-fade-in-up 关键帧与波浪两套动画互搏；改法（只动 transitions.js 三刀全隐形）：①rAF 批量波浪替换逐卡 setTimeout（起播帧对齐、同帧到点卡一次 style 批量写入；节奏 60/40ms、时长、缓动、LIGHT cap 8 逐字不动）②动画期间写 inline will-change 层提升（磨砂卡背景只采样一次走合成器；cleanup 还原原值，退出双分支同写页面即销毁无需清理）③双动画守卫 hasActiveOpacityAnim（getAnimations 查 phase/fill——关键帧动画卡跳过一切内联写入、关键帧照常淡入；实测 headless 151 getComputedTiming() 无 phase 键、主用 fill/progress 兜底）+rAF 挂起兜底定时（后台标签强制起播防 opacity:0 卡死）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css、页面 HTML 零改动；电池 fadefix 33/33 双模式（F0-F8 静态锚含三刀标记/M1h M2h will-change 起播+落定全清/N2 N2b 欢迎卡守卫零内联+中场快照自定位 mid=4/N3v N3h 退出 will-change/A4 auth 入场；before 24/24 基线→after 帧健康全面改善 M2 max 233→99.9、M1 mean 138.9→120——无头相对差值+机制正确，真实 GPU 以用户肉眼终审）+回归 msg-anim 31/31+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48 全绿（四电池版本锚 50.2→50.3 已同步；msg-anim 首跑 M5/M9 时序噪声 28/31 重跑即绿）；部署一次 exit 0（docker build/push+gcloud.ps1，env 30 条从 describe 全量重建零新键；插曲=外层 *> 重定向踩 PS5.1 NativeCommandError 中断未产生 revision，去重定向重跑即成）；curl 链全绿（health 58 表/site-config 双版本 v0.2.50.3+v10.28.35.4/transitions.js rAF+守卫+willChange×4+双模式串+安全定时在线）；commit 6eb15a5 未 push；前身 00244-6db）**\n**前身 rev 00244-6db（';

patch('backend-build-state.md', [['**当前线上 rev 00244-6db（', NEW_HEAD]]);

const SCHEME_APPEND = '**v0.2.50.3（2026-09-17；补丁位 2→3 隐形性能轮；rev 00245-g89）= 切页进场帧健康隐形修复**——用户「之前Gemini都说了会掉帧卡顿现在出现了……之前的那个淡入的效果也是很卡也不一致」+钦定红线「不可以取舍任何限制拥有的所有过渡动画」（所有动画一个不少、观感零变化）；诊断：入场波浪 opacity<1 让磨砂卡逐帧重采样背景=掉帧主因（基线实证 dashboard 波浪 75% 帧>20ms、max 233ms），淡入不一致=逐卡 setTimeout 离帧起播+欢迎卡关键帧与波浪互搏；改法（只动 transitions.js 三刀全隐形）：①rAF 批量波浪替换逐卡 setTimeout（起播帧对齐；节奏/时长/缓动/LIGHT cap 8 逐字不动）②动画期间写 inline will-change 层提升（cleanup 还原；退出双分支同写）③双动画守卫 hasActiveOpacityAnim（关键帧动画卡跳过一切内联；headless 151 无 phase 键主用 fill/progress 兜底）+rAF 挂起兜底定时；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动、页面 HTML 零改动；电池 fadefix 33/33 双模式（before 24/24 基线→after 帧健康全面改善 M2 max 233→99.9/M1 mean 138.9→120；真实 GPU 用户肉眼终审）+回归 msg-anim 31/31+msglink 15/15+mono-flash 22/22+monodark 29/29+smoke-admin 48/48 全绿（四电池版本锚 50.2→50.3 已同步）；部署一次 exit 0（docker build/push+gcloud.ps1，env 30 条从 describe 全量重建零新键）；curl 链全绿（health 58 表/site-config 双版本 v0.2.50.3+v10.28.35.4/transitions.js rAF+守卫+willChange×4+双模式串+安全定时在线）；commit 6eb15a5 未 push。';

patch('site-versioning-scheme.md', [['commit 617d87f 未 push。', 'commit 617d87f 未 push。' + SCHEME_APPEND]]);

patch('transitions-animation-untouchable.md', [['——此双模式结构同属钦定，改动 LIGHT 分支或原样分支同样必须先问。',
  '——此双模式结构同属钦定，改动 LIGHT 分支或原样分支同样必须先问。\n\n2026-09-17 v0.2.50.3 隐形轮守约记录：用户再发红线「记得不可以取舍任何限制拥有的所有过渡动画」——本轮掉帧+淡入不一致修复全程只做不改变观感的隐形改动：所有动画（渐隐、全卡波浪、节奏 60/40ms、时长、缓动、LIGHT cap 8、退出计时 280/240·240/220）逐字保留；三刀全隐形（rAF 批量波浪替代 setTimeout 起播、动画期间 inline will-change 层提升+cleanup 还原、欢迎卡双动画守卫跳过内联）——观感零变化，电池 fadefix before/after 双模式同口径 33/33 实证。此条与 v0.2.50.1 纠正轮同源：任何性能修法若触碰观感（渐变/时长/缓动/动画范围），先列选项问用户。']]);

patch('MEMORY.md', [
  ['**当前线上 rev 00244-6db（2026-09-17 Messages 页专属轻量切页模式 v0.2.50.2——用户「不是你之间撤销到我要求你优化message页面之前」',
   '**当前线上 rev 00245-g89（2026-09-17 v0.2.50.3 进场帧健康隐形修复——三刀全隐形（rAF 批量波浪/will-change 层提升/双动画守卫）、电池 fadefix 33/33 双模式+五回归全绿、commit 6eb15a5 未 push；前身 00244-6db Messages 页专属轻量切页模式 v0.2.50.2——用户「不是你之间撤销到我要求你优化message页面之前」'],
  ['**当前：站点号 v0.2.50.2（Messages 页专属轻量切页模式——用户「不是你之间撤销到我要求你优化message页面之前」；rev 00244-6db；commit 617d87f 未 push）、FC v10.28.35.4**',
   '**当前：站点号 v0.2.50.3（进场帧健康隐形修复——用户「之前Gemini都说了会掉帧卡顿现在出现了」；rev 00245-g89；commit 6eb15a5 未 push）、FC v10.28.35.4**'],
  ['切页动画观感是用户钦定设计（2026-09-17 被纠正「那个你不能动」）——性能修复只做不改变观感的隐形改动',
   '切页动画观感是用户钦定设计（2026-09-17 被纠正「那个你不能动」；v0.2.50.3 隐形轮守约：三刀全隐形零观感变化）——性能修复只做不改变观感的隐形改动'],
]);

console.log('memory ritual done');
