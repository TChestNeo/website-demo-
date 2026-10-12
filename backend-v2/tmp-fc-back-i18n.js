// tmp-fc-back-i18n.js — FC 编辑器返回键文案：返回工作台 → 返回 FluidCanvas（12 语言）
'use strict';
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'docs', 'assets', 'i18n', 'fluidcanvas.i18n.js');
let s = fs.readFileSync(f, 'utf8');
const MAP = {
  '返回工作台': '返回 FluidCanvas',
  'Back to Dashboard': 'Back to FluidCanvas',
  'Zurück zum Dashboard': 'Zurück zu FluidCanvas',
  'Назад к панели': 'Назад к FluidCanvas',
  'Kembali ke Papan Pemuka': 'Kembali ke FluidCanvas',
  'กลับไปยังแดชบอร์ด': 'กลับไปยัง FluidCanvas',
  'Về Bảng điều khiển': 'Về FluidCanvas',
  'Kembali ke Dasbor': 'Kembali ke FluidCanvas',
  'Retour au tableau de bord': 'Retour à FluidCanvas',
  'Volver al panel': 'Volver a FluidCanvas',
  'Voltar ao painel': 'Voltar ao FluidCanvas',
  '返回工作臺': '返回 FluidCanvas'
};
let n = 0;
for (const o in MAP) {
  if (s.indexOf(o) === -1) { console.log('未找到: ' + o); continue; }
  s = s.split(o).join(MAP[o]);
  n++;
}
fs.writeFileSync(f, s);
console.log('替换:', n, '/ 12');
