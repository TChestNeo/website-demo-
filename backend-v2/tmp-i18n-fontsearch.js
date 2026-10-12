// tmp-i18n-fontsearch.js — 加 fc.font.search + fc.font.allLangs ×12 语
'use strict';
const fs = require('fs');
const f = 'docs/assets/i18n/fluidcanvas.i18n.js';
let s = fs.readFileSync(f, 'utf8');
const tr = [
  ['搜索字体…', '全部语言'],        // zh
  ['Search fonts…', 'All languages'], // en
  ['Schriftarten suchen…', 'Alle Sprachen'], // de
  ['Поиск шрифтов…', 'Все языки'],   // ru
  ['Cari font…', 'Semua bahasa'],    // id
  ['ค้นหาแบบอักษร…', 'ทุกภาษา'],     // th
  ['Tìm phông chữ…', 'Tất cả ngôn ngữ'], // vi
  ['Cari fon…', 'Semua bahasa'],     // ms
  ['Rechercher des polices…', 'Toutes les langues'], // fr
  ['Buscar fuentes…', 'Todos los idiomas'], // es
  ['Buscar fontes…', 'Todos os idiomas'], // pt
  ['搜尋字體…', '全部語言']          // zh-Hant
];
let i = 0;
s = s.replace(/"fc\.font\.lockedLeft": "[^"]*",/g, function (m) {
  const t = tr[i] !== undefined ? tr[i] : ['Search fonts…', 'All languages'];
  i++;
  return m + '\n  "fc.font.search": "' + t[0] + '",\n  "fc.font.allLangs": "' + t[1] + '",';
});
fs.writeFileSync(f, s);
console.log('inserted ' + i + ' languages (search + allLangs)');
