// tmp-mem-638-versioning.js — 记忆仪式 638：site-versioning-scheme.md 追加 FC v10.28.51.1 条目+尾指针改 51.1
// （PowerShell 中文锚损坏→Node 脚本 UTF-8 读写；幂等：指针已 51.1 或条目已在→零改动退出 2）
'use strict';
const fs = require('fs');
const F = process.env.USERPROFILE + '/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/site-versioning-scheme.md';
let s = fs.readFileSync(F, 'utf8');
const PTR_OLD = '**站点号当前 v0.2.58.26；FC 当前 v10.28.51.0**。';
const PTR_NEW = '**站点号当前 v0.2.58.26；FC 当前 v10.28.51.1**。';
if (s.indexOf('FC v10.28.51.1 =') !== -1 && s.indexOf(PTR_OLD) === -1) { console.log('already-done'); process.exit(2); }
if (s.indexOf('FC v10.28.51.1 =') === -1) {
  const ENTRY = '2026-10-04 FC v10.28.51.1 = 边缘样本默认配色+抽屉顶部导航平台同款+应用链修复+边框裸值放宽+AI 弹窗正向反馈（补丁位 51.0→51.1 修复轮；站点恒 v0.2.58.26）——用户「样本除了展示边缘还要展示默认自带的颜色那些」+「顶部导航的左右切换能不能参考平台的顶部导航的左右切换动画和结构」+测试报告「AI 边缘成功生成了但是无法使用——点击后什么都没有」+「边框那边生成失败」+「弹窗做一个正向反馈——按钮下方小字+三粒点loading条，左侧显示AI当前状态」；真身=样本 mini 恒中性剪影无配色/旧 nav 自绘平板双钮/setCardEdge 无选中卡静默 return（AI 生成→保存→点条目全程不需选卡→新画布零卡=零反馈）/sanitizeClip 裸值只许 0/100（border 双环内环 3-12% 内缩 Gemini 常输出裸值 8/12 之类→全拒→「边框生成失败」而 edge 满盒只用 0/100 故成功）；修法=renderEdgeSamples 传 cardLayers.join(\', \')（纸/藏宝/科技1-6/油漆1-6 各显本色）+nav 改 .segmented-control 滑动白胶囊 0.2s（圆球/edgeDrawerSetTab 零改动）+线型样本画取色器当前色+setCardEdge 无卡→toast fc.common.selectCard 兜底+无标签卡→toast cardUnsupported+服务端/客户端 sanitizeClip 同步放宽裸值 ±100（纯数字零注入面，黑名单不动；百分比仍 0-100）+AI 弹窗两栏（左栏状态灯四态 idle 灰/thinking 蓝脉冲/success 绿/fail 红+状态文本）+按钮下三粒点弹跳+小字（genThinkingHint）；i18n 5 新键×12 语（zh-Hant 只 OpenCC）；ethereal.css/transitions.js/心跳零触碰；npm test 399/399（edge-gen.test.js+fc-edges.test.js 裸值用例移位同数）；新电池 fc-edgecolors 22/22（B6a-e 状态机 idle→thinking→success+border 裸值 evenodd 双环链+保存本地库；B7 fail 红灯+小字+toast）；舰队 638 共 56 项全绿（首跑 2 红=community-nodemo F1 58.26 计数 13→14+fc-team rev 占位锚陈旧——独立复跑 30/30+27/27 销账，grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34+fc-i18n 20/20；验证 ×2 先验后推 0 mismatch（00361 占位→7vk 填真；00362 占位）；deploy 638 ps1 无新 env；线上探针 fc-edgecolors 638 10/11（P1a 无卡 toast live 实证/P1b 四款配色 computed/P1e 弹窗四态 idle live；P2 Gemini 直连被外部配额 429 挡——当晚外部态四连 401（探针设计经端点需真会话→改 636 同款直连）→503 高需求→网络 0→200+evenodd 成功一次（裸值放宽 live 实证在手）→429 配额耗尽（键有效非鉴权问题，配额恢复后 P2 可销账；用户生成会红灯+失败小字））；digest sha256:0810ccbab76cd792f2c587e2e7c6af729c782d9d25c79a5b99c2b8e277ddfa47（二次烘焙=当前线上）；commit 未 push，rev 00361-7vk 瞬态→00362-fdj 终态（live 文本滞后一部署=惯例））。';
  s = s.replace(PTR_OLD, ENTRY + PTR_NEW);
} else {
  s = s.replace(PTR_OLD, PTR_NEW);
}
fs.writeFileSync(F, s, 'utf8');
console.log('done');
