'use strict';
// tmp-update-memory-608.js — v0.2.58.5 记忆仪式（backend-build-state 头旋转 + site-versioning-scheme 指针 + MEMORY.md 新行/两指针）
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
let bad = 0;

function patch(file, pairs) {
  let s = fs.readFileSync(M + file, 'utf8');
  for (const [oldS, newS] of pairs) {
    const n = s.split(oldS).length - 1;
    if (n !== 1) { console.error('MISS/AMBIG ' + file + ' x' + n + ': ' + oldS.slice(0, 70)); bad++; continue; }
    s = s.split(oldS).join(newS);
  }
  fs.writeFileSync(M + file, s, 'utf8');
  console.log('patched ' + file);
}

const newHead = `**当前线上 rev 00308-6xx（2026-09-26 v0.2.58.5 折叠侧栏等级水杯改药丸形+波浪加大——用户「我要的是药丸形不是圆形还有那个波浪能不能大一些？」；真身=58.4 水杯正圆（24×24 border-radius:50%）+正弦波纹 mask 12×8 波长 12px；修法：水杯改胶囊 24×32 border-radius:999px 只加高拉长、LV 号码居中不变；波浪加大——mask SVG viewBox 12×8→16×12（波长 12→16+振幅 4→6 双加）、波浪带高 8px→12px、两波顶线随半高同步（calc(40% - 4px)→-6px / -4px→-6px）、无缝循环 translateX 12px→16px 恰好一个波长、strip 200%→300%（左右余量=杯内宽 20px ≥ 16px 波长，循环末帧不露缺口——58.4 潜伏 2px 缺口同轮根治）；两层结构/两速 1.6s/2.2s 相位漂移/水位从底往上灌/0.5s 过渡全保持；sidebar.js 零改动（纯 CSS 零 JS）；40 页内联块全量刷新+编辑器页手工同款（inliner SKIP_CSS_REFRESH 豁免）；FC 恒 v10.28.47.4、后端零改动、i18n 零新键；电池 fc-lvpill 14/14（重写为 58.5 药丸水杯+大波浪口径：F3 半角分号锚只认规则行+旧正圆/12×8/translateX(-12px)/-4px 零残留+S2 computed maskSize 16px 12px/repeat-x/波形 12px 高/strip 60px 宽/波形色与水面层同色且两色不同）+舰队 41 套全绿（grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；镜像内容验证 63/63（推送前先验后推）；线上探针 lvwater 10/10（S1 58.5+changelog+00308-/S2 药丸水杯件套在位旧正圆 12×8 零残留/S3 index 内联同步/P1 折叠 computed mask 16px 12px+12px 波形+60px strip+两速/P2 几何 28×48 药丸+24×32 胶囊+头像 32×32 零挤压/P3 满级 100%+LV12/P4 floating 零溢出/E 零异常）；digest sha256:526ebf0ea153c118c993278f0cd7fa1d2ecb8b6a03fb1539f6dd659cc36e2596；commit ab74c2f 未 push；新坑：电池零残留锚与注释文字撞车（新轮注释含 calc(40% - 4px)→-6px 字面量被当旧规则残留误报）——锚加半角分号只认规则行）**`;

patch('backend-build-state.md', [
  ['**当前线上 rev 00307-kkt（2026-09-26 v0.2.58.4',
   newHead + '\n**前身 rev 00307-kkt（2026-09-26 v0.2.58.4'],
  ['modified: 2026-09-26T04:10:00.000Z', 'modified: 2026-09-26T15:50:00.000Z'],
]);

const newScheme = `2026-09-26 v0.2.58.5 = 折叠侧栏等级水杯改药丸形+波浪加大（补丁位 4→5·调整轮——用户「我要的是药丸形不是圆形还有那个波浪能不能大一些？」；修法：58.4 正圆水杯改胶囊 24×32 border-radius:999px 只加高拉长 LV 号码居中不变；波浪加大——mask SVG viewBox 12×8→16×12（波长 12→16+振幅 4→6）、波浪带 8px→12px、两波顶线随半高（calc(40% - 4px)→-6px / -4px→-6px）、translateX 12px→16px 恰好一个波长、strip 200%→300%（左右余量=杯内宽 20px ≥ 16px 波长，循环末帧不露缺口——58.4 潜伏 2px 缺口同轮根治）；两层结构/两速 1.6s/2.2s/底灌/0.5s 过渡全保持，sidebar.js 零改动；40 页内联块全量刷新+编辑器页手工同款（SKIP_CSS_REFRESH 豁免）；FC 恒 v10.28.47.4、后端零改动、i18n 零新键；电池 fc-lvpill 14/14（重写 58.5 药丸水杯口径）+舰队 41 套全绿（grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；镜像内容验证 63/63（推送前先验后推）；线上探针 lvwater 10/10；digest 526ebf0e；commit ab74c2f 未 push，rev 00308-6xx）。**站点号当前 v0.2.58.5；FC 当前 v10.28.47.4**。`;

patch('site-versioning-scheme.md', [
  ['**站点号当前 v0.2.58.4；FC 当前 v10.28.47.4**。', newScheme],
]);

const newMemLine = `- [2026-09-26 — v0.2.58.5 折叠侧栏等级水杯改药丸形+波浪加大（rev 00308-6xx commit ab74c2f 未 push；digest 526ebf0e）：用户「我要的是药丸形不是圆形还有那个波浪能不能大一些？」——58.4 正圆水杯改胶囊 24×32 border-radius:999px（只加高拉长、LV 号码居中不变）+波浪加大（mask SVG viewBox 12×8→16×12 波长 12→16+振幅 4→6、波浪带 8px→12px、顶线随半高 calc(40% - 4px)→-6px / -4px→-6px、translateX 12px→16px 恰好一个波长、strip 200%→300%——左右余量=杯内宽 20px ≥ 16px 波长，循环末帧不露缺口，58.4 潜伏 2px 缺口同轮根治）；两层结构/两速 1.6s/2.2s/底灌/0.5s 过渡全保持；sidebar.js 零改动；40 页内联+编辑器页手工同款；FC 恒 47.4/后端零改动/i18n 零新键；电池 fc-lvpill 14/14（重写 58.5 药丸水杯口径）；舰队 41 套全绿（grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；镜像验证 63/63（推送前先验后推）；线上探针 lvwater 10/10；**新坑：电池零残留锚与注释文字撞车（新轮注释含 calc(40% - 4px)→-6px 字面量被当旧规则残留误报）——锚加半角分号只认规则行**](2026-09-26-v02585-pillcup.md)`;

patch('MEMORY.md', [
  ['- [2026-09-26 — v0.2.58.3 折叠侧栏等级水位环+双层水波（rev 00306-855',
   newMemLine + '\n- [2026-09-26 — v0.2.58.3 折叠侧栏等级水位环+双层水波（rev 00306-855'],
  ['**当前线上 rev 00307-kkt（v0.2.58.4 折叠侧栏等级水位环波纹改正弦水面；FC 恒 v10.28.47.4；commit 64021ce 未 push）',
   '**当前线上 rev 00308-6xx（v0.2.58.5 折叠侧栏等级水杯改药丸形+波浪加大；FC 恒 v10.28.47.4；commit ab74c2f 未 push）'],
  ['**当前：站点号 v0.2.58.4（折叠侧栏等级水位环波纹改正弦水面；rev 00307-kkt；commit 64021ce 未 push）',
   '**当前：站点号 v0.2.58.5（折叠侧栏等级水杯改药丸形+波浪加大；rev 00308-6xx；commit ab74c2f 未 push）'],
]);

console.log(bad === 0 ? 'ALL PATCHED OK' : 'FAILURES: ' + bad);
process.exit(bad === 0 ? 0 : 1);
