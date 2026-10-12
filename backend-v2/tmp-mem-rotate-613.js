// tmp-mem-rotate-613.js — 58.8 记忆仪式：backend-build-state.md 头部旋转（00312-2n7 新 head + 00310-pbk 降前身）
'use strict';
const fs = require('fs');
const F = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/backend-build-state.md';
const head = '**当前线上 rev 00312-2n7（2026-09-27 v0.2.58.8 折叠侧栏等级药丸收窄对齐菜单按钮——用户「能不能把他的宽度变成和其他按钮一样？」（一问钦定「和菜单按钮一样 48px」）；真身=58.7 药丸 64px 宽比折叠栏卡片 56px 每边溢出 4px；修法：药丸 64→48×116、水杯胶囊 56→44×84（border-radius:999px 不变、LV 号码居中不变、杯内宽 52→40=恰好一个波长——波浪 40×32 mask/32px 带高/平移 40px/顶线 -16px 全零改动；LV 标签 14px/LV 号码 28px/药丸高 116px 不动）；药丸 48px=桌面折叠栏用户卡内容宽（模块 56−垫 8）与内容列齐平零溢出；floating 64px 列右边线 1px 致模块 47、药丸右溢 1px 可忽略仍收在列内；strip 300%=120px（3×40，杯内宽 40 ≥ 40 波长末帧不露缺口）；两层结构/两速 1.6s/2.2s 相位漂移/水位从底往上灌/0.5s 过渡全保持；sidebar.js 零改动（纯 CSS 零 JS）；40 页内联块全量刷新+编辑器页手工同款（inliner SKIP_CSS_REFRESH 豁免）；FC 恒 v10.28.47.4、后端零改动、i18n 零新键；电池 fc-lvpill 14/14（重写 58.8 收窄口径：F1 rev 00312-+瞬态注记 00311-wkw+rev 00311- 零残留+F3 半角分号锚只认规则行+旧 64×116/56×84/32×58/28×42/28×48/24×32/正圆/20×16/16×12/12×8/16px 波形/平移 20px/-8px 零残留+S2 computed strip 120px+S3 桌面 inMod true·alignMod 4/4+S6 floating inMod false 右溢 1px 可忽略）+舰队 41 套全绿（grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34；镜像内容验证 98 锚全命中（推送前先验后推）；线上探针 lvpill 10/10（S1 58.8+烘焙 rev 00311-wkw 文本在位、repo 已记 00312-2n7 滞后注记+00310-pbk×2+00309-jbl 历史注记/S2 药丸 48×116+水杯 44×84 在位旧件套零残留+波浪零改动/S3 index 内联同步/P1 折叠 mask 40px 32px+32px 波形+120px strip+两速/P2 几何 48×116+44×84+头像 32×32 零挤压+inMod true 齐平/P3 满级 100%+LV12/P4 floating 右溢 1px 可忽略零越界/E 零异常）；digest sha256:76a55b480abdb8036163785f4614bbf27d8da07ede3543714184d625c8c6e8fd；commit 未 push；**新坑：rev 编号二次烘焙**——58.8 轮首部署先建 00311-wkw 但 rev 文本仍占位 XXX（先部署后填值致占位上直播），二次构建烘焙真文本再部署终态 00312-2n7（live 文本 00311-wkw 滞后一部署=58.7 同款下轮烘焙；探针 S1 按 live 实况断言+注记）；sed 613→614 双家族（终态真值二次扫描））**';
let s = fs.readFileSync(F, 'utf8');
const lines = s.split('\n');
if (!lines[12].startsWith('**当前线上 rev 00310-pbk（')) throw new Error('head 行不对：' + lines[12].slice(0, 60));
lines[12] = head + '\n' + lines[12].replace('**当前线上 rev 00310-pbk（', '**前身 rev 00310-pbk（');
s = lines.join('\n');
s = s.replace(/modified: 2026-09-26T16:20:00\.000Z/, 'modified: 2026-09-27T01:20:00.000Z');
fs.writeFileSync(F, s, 'utf8');
// 结构断言：head 唯一、新 head 收尾后紧跟降级前身锚
const t = fs.readFileSync(F, 'utf8');
const heads = t.split('\n').filter(l => l.startsWith('**当前线上'));
console.log('当前线上行数（应 1）:', heads.length);
console.log('新 head 在位:', t.indexOf('**当前线上 rev 00312-2n7（') !== -1);
console.log('降级前身锚紧随:', t.indexOf(head + '\n**前身 rev 00310-pbk（') !== -1);
console.log('modified 已更新:', t.indexOf('modified: 2026-09-27T01:20:00.000Z') !== -1);
