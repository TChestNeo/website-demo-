// tmp-sed-626.js — v0.2.58.20 轮版本/rev token 扫（58.19→58.20、47.4→48.0、00334-→00336-、00335-→00337-）
// 范围：tmp-battery-*.js + tmp-probe-*.js（新电池 avatarsync 尚未存在自然豁免；tmp-verify-* 档案不匹配 glob 天然豁免；site-config/docs 手改不扫）
// 家规：实测计数先行——先打印每 token 命中文件数与总次数，替换后再扫残留报零。
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const TOKENS = [
  ['v0.2.58.19', 'v0.2.58.20'],
  ['v10.28.47.4', 'v10.28.48.0'],
  ['00334-', '00336-'],
  ['00335-', '00337-'],
];
const files = fs.readdirSync(HERE).filter((f) => /^tmp-(battery|probe)-.*\.js$/.test(f)).map((f) => path.join(HERE, f));
// ── 实测计数先行 ──
for (const [oldT] of TOKENS) {
  let nFiles = 0, nHits = 0;
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    const n = s.split(oldT).length - 1;
    if (n > 0) { nFiles++; nHits += n; }
  }
  console.log(`[pre] ${oldT} -> ${TOKENS.find((t) => t[0] === oldT)[1]} : ${nFiles} files / ${nHits} hits`);
}
// ── 替换 ──
let changed = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const orig = s;
  for (const [oldT, newT] of TOKENS) s = s.split(oldT).join(newT);
  if (s !== orig) {
    fs.writeFileSync(f, s); // 纯子串替换不触碰换行字节，EOL 原样保留
    changed++;
  }
}
console.log(`[apply] ${changed} files rewritten`);
// ── 残留扫描 ──
const leftovers = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const [oldT] of TOKENS) {
    const idx = s.indexOf(oldT);
    if (idx !== -1) leftovers.push(`${path.basename(f)}:${s.slice(0, idx).split('\n').length}: ...${s.slice(Math.max(0, idx - 30), idx + 30).replace(/\r?\n/g, '⏎')}...`);
  }
}
if (leftovers.length) {
  console.log(`[leftover] ${leftovers.length} residual hits:`);
  leftovers.slice(0, 20).forEach((l) => console.log('  ' + l));
  process.exitCode = 1;
} else {
  console.log('[leftover] zero residual hits — sweep complete');
}
