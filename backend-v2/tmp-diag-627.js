// 临时诊断：列出 83 行所有引号串（双/单引号）及位置
'use strict';
const fs = require('fs');
const L = fs.readFileSync(__dirname + '/tmp-i18n-627.js', 'utf8').split(/\r?\n/)[82];
const arr = [];
let i = 0;
while (i < L.length) {
  const c = L[i];
  if (c === '"' || c === "'") {
    let j = i + 1;
    while (j < L.length && L[j] !== c) j++;
    arr.push([i, c, JSON.stringify(L.slice(i, j + 1)).slice(0, 90)]);
    i = j + 1;
  } else i++;
}
console.log('strings:', arr.length);
arr.forEach((x) => console.log(x[0], x[1], x[2]));
