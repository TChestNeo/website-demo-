// tmp-sed-612.js — rev 终态扫：终态服务 revision = mnationworld-web-00310-pbk（58.7 轮两部署——首部署瞬态
// 00309-jbl 因编号预估错位被取代、同轮重部署终态 00310-pbk）——repo 锚回扫 00310-，site-config 两处 rev
// 文本手工填 00310-pbk（本脚本只负责 00309-→00310- 文本回扫）。
// 坑：EXCLUDE 用正斜杠路径与 path.relative 反斜杠不匹配全部失效——sed 脚本被自扫（头部/规则文字错乱），
// sed-610/611/612 三脚本已手工重写修正；Windows 下排除路径必须 path.join 生成。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const EXCLUDE = new Set([
  path.join(ROOT, 'backend-v2', 'tmp-sed-610.js'),
  path.join(ROOT, 'backend-v2', 'tmp-sed-611.js'),
  path.join(ROOT, 'backend-v2', 'tmp-verify-610.js'),
  path.join(ROOT, 'backend-v2', 'tmp-battery-605-lvpill.js'),
  path.join(ROOT, 'backend-v2', 'tmp-probe-610-lvwater.js'),
]);
let total = 0;
let files = ['docs/assets/js/site-config.js'];
function collect(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (f !== 'node_modules') collect(p); continue; }
    if (!/\.(js|html|css|ps1|txt)$/.test(f)) continue;
    files.push(path.relative(ROOT, p));
  }
}
collect(path.join(ROOT, 'backend-v2'));
collect(path.join(ROOT, 'docs'));
for (const rel of files) {
  const p = path.join(ROOT, rel);
  if (EXCLUDE.has(p)) continue;
  let s = fs.readFileSync(p, 'utf8');
  const n = s.split('00309-').length - 1;
  if (n === 0) continue;
  s = s.split('00309-').join('00310-');
  fs.writeFileSync(p, s);
  total += n;
  console.log(`${rel}: ${n}`);
}
console.log(`swept ${total} 处`);
