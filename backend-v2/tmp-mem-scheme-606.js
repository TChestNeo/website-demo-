// tmp-mem-scheme-606.js — site-versioning-scheme.md 指针轮换（临时脚本，用完即弃不提交）
'use strict';
const fs = require('fs');
const p = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/site-versioning-scheme.md';
let s = fs.readFileSync(p, 'utf8');
const oldPtr = '**站点号当前 v0.2.58.2；FC 当前 v10.28.47.4**。';
const newEntry = '2026-09-26 v0.2.58.3 = 折叠侧栏等级水位环+双层水波（补丁位 2→3·调整轮——用户「呃那个等级的进度条能不能是一个环围着中间的等级号码而不是这种像时间一样的」+「从底部上灌的时候我希望你添加一个水的飘动动效分成两层这样」+「就是一层主要颜色另一层用一个浅有点的颜色增加层次感」（一问钦定「环围号码·从底部往上灌」）；修法：58.2 conic 进度环 12 点顺时针扫像时钟→环改成正圆「水杯」只围等级号码（LV 小字移到杯上方），经验进度=水位从杯底往上灌（.mn-lv-fill 内联 height 百分比 sidebar.js fillPct 写入+0.5s 过渡）；水动效两层——底层主色 .mn-lv-wdeep+上层浅色 .mn-lv-wlight（主色兑白 55%+opacity 0.65 叠出层次感），两层各带波浪花边 .mn-lv-wdeepwave/.mn-lv-wlightwave（radial-gradient 花边纹+两速 1.6s/2.2s 无缝循环，纯 CSS 零 JS）；号码 z 上浮+白色描边晕影水位高时仍可读；40 页内联块全量刷新+编辑器页手工同款（SKIP_CSS_REFRESH 豁免）；FC 恒 v10.28.47.4、后端零改动、i18n 零新键；电池 fc-lvpill 14/14（重写水位环口径）+舰队 41 套全绿（grep exit=1|💥 复核零命中）+冒烟 60/60；镜像内容验证 34/34（推送前先验后推）；线上探针 lvwater 10/10；digest 2efeb1bc；commit cc04ad5 未 push，rev 00306-855）。**站点号当前 v0.2.58.3；FC 当前 v10.28.47.4**。';
const n = s.split(oldPtr).length - 1;
if (n !== 1) { console.error('指针命中数异常: ' + n); process.exit(1); }
s = s.replace(oldPtr, newEntry);
fs.writeFileSync(p, s, 'utf8');
console.log('scheme 指针轮换完成：58.2→58.3');
