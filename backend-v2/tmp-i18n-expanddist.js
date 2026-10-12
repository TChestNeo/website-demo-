// tmp-i18n-expanddist.js — 给 fluidcanvas.i18n.js 加 fc.edge.expandDist ×12 语
'use strict';
const fs = require('fs');
const f = 'docs/assets/i18n/fluidcanvas.i18n.js';
let s = fs.readFileSync(f, 'utf8');
const tr = [
  '边缘外扩距离',            // zh
  'Edge expand distance',    // en
  'Kantenabstand',           // de
  'Отступ края',             // ru
  'Jarak perluasan tepi',    // id
  'ระยะห่างขยายขอบ',          // th
  'Khoảng cách mở rộng cạnh', // vi
  'Jarak perluasan tepi',    // ms
  "Distance d'expansion du bord", // fr
  'Distancia de expansión del borde', // es
  'Distância de expansão da borda',   // pt
  '邊緣外擴距離'             // zh-Hant
];
let i = 0;
s = s.replace(/"fc\.edge\.maskSync": "[^"]*",/g, function (m) {
  const v = tr[i] !== undefined ? tr[i] : 'Edge expand distance';
  i++;
  return m + '\n  "fc.edge.expandDist": "' + v + '",';
});
fs.writeFileSync(f, s);
console.log('inserted ' + i + ' expandDist keys');
