// tmp-diff-verify-629.js — 对拍 verify 期望 vs 实测输出（找 mismatched anchor）
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'tmp-verify-629.js'), 'utf8');
const out = fs.readFileSync(path.join(__dirname, 'tmp-verify-629-out.txt'), 'utf8');

// 解析期望：cmds 与 wt 数组里的 [label, ..., 'want'] 条目
const expects = new Map();
const trip = /^  \['([^']+)', ([`'][\s\S]*?[`']), '([0-9]+)'\],?$/;
for (const line of src.split('\n')) {
  const m = line.match(trip);
  if (m) expects.set(m[1], m[3]);
}
// wt 数组条目 [label, file, pattern, want]
const wtTrip = /^  \['([^']+)', '([^']+)', '([^']*)', '([0-9]+)'\],?$/;
for (const line of src.split('\n')) {
  const m = line.match(wtTrip);
  if (m) expects.set(m[1], m[4]);
}
// 实测输出 [label] → out
const actuals = new Map();
for (const line of out.split('\n')) {
  const m = line.match(/^\[(.*)\] → (.*)$/);
  if (m) actuals.set(m[1], m[2]);
}
let bad = 0;
for (const [label, want] of expects) {
  const got = actuals.get(label);
  if (got !== want) { bad++; console.log('MISMATCH [' + label + '] want=' + want + ' got=' + got); }
}
for (const [label] of actuals) {
  if (!expects.has(label)) console.log('NO-EXPECT [' + label + '] got=' + actuals.get(label));
}
console.log(bad === 0 ? 'ALL MATCH (' + expects.size + ' anchors)' : bad + ' MISMATCHES');
