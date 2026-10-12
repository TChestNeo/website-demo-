// tmp-i18n-langflag.js — v0.2.54.0 i18n 轮：全站加 en 字典前，给所有电池 Chrome 加 --lang=zh-CN
// 原因：56 电池 + smoke-admin 的 headless Chrome 默认 navigator.language=en-US；
//       加 en 字典后 en-US 会命中 en（界面变英文、中文断言全红）。--lang=zh-CN 让 navigator 回落 zh。
// 幂等：已含 --lang=zh-CN 的文件跳过；其余在 '--headless=new', 后插入。
'use strict';
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('tmp-battery-') && f.endsWith('.js'))
  .map(f => path.join(__dirname, f));
files.push(path.join(__dirname, 'scripts', 'smoke-admin.js'));

let changed = 0, skipped = 0, missing = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.indexOf('--lang=zh-CN') !== -1) { skipped++; continue; }
  if (s.indexOf("'--headless=new'") === -1) { missing++; console.log('NO headless anchor: ' + path.basename(f)); continue; }
  s = s.replace("'--headless=new',", "'--headless=new', '--lang=zh-CN',");
  fs.writeFileSync(f, s);
  changed++;
}
console.log('changed=' + changed + ' skipped=' + skipped + ' missing=' + missing + ' total=' + files.length);
