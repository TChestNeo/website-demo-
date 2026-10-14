// tmp-bump-user-version.js — 测试断言 user_version 41 → 42（P0-3 新增 042 迁移）
'use strict';
const fs = require('fs');
const path = require('path');
const files = [
  path.join(__dirname, 'test', 'health.test.js'),
  path.join(__dirname, 'test', 'migrations.test.js'),
  path.join(__dirname, 'test', 'notifications.test.js'),
];
let total = 0;
for (const f of files) {
  let text = fs.readFileSync(f, 'utf8');
  const before = text;
  text = text.replace(/(user_version[^)]*?\)\s*,\s*)41([);])/g, '$142$2');
  text = text.replace(/(user_version=\d+、\d+ 表)/g, (m) => m); // 标题文本另处理
  text = text.replace(/user_version=41/g, 'user_version=42');
  text = text.replace(/user_version、72/g, 'user_version、72');
  if (text !== before) {
    fs.writeFileSync(f, text, 'utf8');
    const n = (before.match(/user_version[^)]*\)\s*,\s*41|user_version=41/g) || []).length;
    total += n;
    console.log(path.basename(f) + ': 替换 ' + n + ' 处');
  } else {
    console.log(path.basename(f) + ': 无变化（检查！）');
  }
}
console.log('总计: ' + total);
