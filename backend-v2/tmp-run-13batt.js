// tmp-run-13batt.js — 13 组电池顺序扫描（不暂存）。用法：node tmp-run-13batt.js
// 输出 tmp-batt-13out.txt：每行电池名 + 结果行；EXIT 汇总。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BATTS = [
  'caredge-dark', 'autosave-interval', 'fc-undo', 'group-shapes',
  'img-library', 'imglib-v2', 'merge-dir', 'merge-far', 'migrate-btn',
  'page-bg', 'pbg-meta', 'tier-gating'
];
// group-resize 本轮刚单独跑完 41/44（tmp-batt-gr-final.txt），不进扫描重复跑

const out = [];
for (const b of BATTS) {
  const f = path.join(__dirname, 'tmp-battery-' + b + '.js');
  if (!fs.existsSync(f)) { out.push(b + ' | 缺失'); continue; }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [f], { cwd: __dirname, encoding: 'utf8', timeout: 25 * 60 * 1000 });
  const sec = ((Date.now() - t0) / 1000).toFixed(0) + 's';
  const lines = (r.stdout || '').split(/\r?\n/);
  const resLine = lines.find(l => l.includes('结果')) || (r.status !== 0 ? '(no 结果 line, exit ' + r.status + ')' : '(no 结果 line)');
  out.push(b + ' [' + sec + '] ' + resLine.trim());
  console.log(out[out.length - 1]);
}
fs.writeFileSync(path.join(__dirname, 'tmp-batt-13out.txt'), out.join('\n') + '\n');
console.log('── 13 组扫描完毕（明细 tmp-batt-13out.txt）');
