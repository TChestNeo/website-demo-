// tmp-log-entry-v02815.js — 追加 ㊿4（64）v0.2.28.15 日志条目
'use strict';
const fs = require('fs');
const f = 'C:/Users/USER/Downloads/stitch_slatiworld_micronation_interface/backend-v2/tmp-log-entry-v0260.txt';
let s = fs.readFileSync(f, 'utf8');
const nl = s.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
const entry = [
  '㊿4（64）v0.2.28.15 = Migrate 按钮定制轮（补丁位 14→15·观感微调轮；2026-09-11；rev 00183-wmg）。',
  '用户「大小能不能和旁边的按钮匹配一下然后能不能改成药丸形…滑出的颜色改成白色…字母黑白相反滤镜」——顶部 Migrate 钮四项定制：',
  '①大小对齐旁边 .btn-sm（font-size var(--fs-label-sm)、span padding 7px 16px、svg 24px、margin 8px，高度 38px 与 History/Tags/Save Draft/Publish 一致——邻钮 .btn-outline 含 1px 边框 38px，migrate 无边框用 7px 上下垫等值对齐；首版 6px 垫=36px 被探针 S1 撞出）；',
  '②改药丸形（border-radius var(--radius-full)，与邻居 .btn 同）；',
  '③横扫面板黑→白（#fff，亮/暗主题一致——两主题对顶部钮本就零覆写）；',
  '④字母挂黑白相反滤镜——span 静息 filter:invert(1) 白字反转成黑字压在白色面板上、悬停 invert(0) 面板滑离时同步翻回白字，0.4s 与面板横扫同曲线同步丝滑换色。',
  '探针 tmp-migrate-btn-v02815-probe.js 8/8（F1 静态定制块在/S1 尺寸对齐/S2 静息药丸 9999px+invert(1)+白面板+skew c=0.57735/S3 悬停横扫 translateX>100+滤镜同步翻回/S4 按下 0.95/S5 弹窗回归/S6 暗色一致/Z 零报错；教训：filter:invert(0) 悬停终值序列化 invert(0)/none 两可，断言按两可收）。',
  '线上 curl：health 58 + v0.2.28.15 + 编辑器页 invert(1)/invert(0)/白面板/药丸/7px 垫各在 + root/overview 回归 200。',
  '部署：revision 00183-wmg（exit 0）。docker 登录踩 PS 管道换行坑（--password-stdin 被拒→-p 直传成功）+ 空 auths 条目盖过 wincred 再清。',
  '零后端、ethereal 零改动无需 inline-css。'
].join(nl);
if (!s.endsWith('\n') && !s.endsWith('\r')) s += nl;
s += entry + nl;
fs.writeFileSync(f, s);
console.log('✅ 日志条目 ㊿4（64）已追加');
