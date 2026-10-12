// tmp-i18n-insert-masksync.js — 恢复 fc.edge.maskSync ×12 语
'use strict';
const fs = require('fs');
const f = 'docs/assets/i18n/fluidcanvas.i18n.js';
let s = fs.readFileSync(f, 'utf8');
const tr = [
  '图片与边缘同步',           // zh
  'Sync image with edge',    // en
  'Bild mit Kante synchronisieren', // de
  'Синхронизировать изображение с краем', // ru
  'Sinkronkan gambar dengan tepi', // id
  'ซิงค์รูปภาพกับขอบ',          // th
  'Đồng bộ ảnh với cạnh',      // vi
  'Segerakkan imej dengan tepi', // ms
  "Synchroniser l'image avec le bord", // fr
  'Sincronizar imagen con el borde', // es
  'Sincronizar imagem com a borda', // pt
  '圖片與邊緣同步'            // zh-Hant
];
let i = 0;
s = s.replace(/"fc\.edge\.genTitle": "[^"]*",/g, function (m) {
  const v = tr[i] !== undefined ? tr[i] : 'Sync image with edge';
  i++;
  return m + '\n  "fc.edge.maskSync": "' + v + '",';
});
fs.writeFileSync(f, s);
console.log('inserted ' + i + ' maskSync keys');
