// tmp-b2-parse.js — 解析 Cloud Run 日志：06:01 用户发布窗口到底发生了什么
'use strict';
const fs = require('fs');
let raw = fs.readFileSync(__dirname + '/tmp-b2-logs.json', 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // PS Out-File BOM
const entries = JSON.parse(raw);
console.log('total entries:', entries.length);

const tMin = '2026-09-20T05:30:00Z', tMax = '2026-09-20T06:45:00Z';
const inWin = e => e.timestamp >= tMin && e.timestamp <= tMax;

// 1) 请求日志（结构化）
const reqs = entries.filter(e => inWin(e) && e.httpRequest);
console.log('\n=== 请求日志 ' + tMin + ' ~ ' + tMax + ' ===');
for (const e of reqs) {
  const h = e.httpRequest;
  console.log(e.timestamp.slice(11, 19) + '  ' + (h.requestMethod || '?') + ' ' + (h.requestUrl || '?') + '  → ' + h.status);
}

// 2) 窗口内所有文本日志（按时间排序）
const texts = entries.filter(e => inWin(e) && (e.textPayload || (e.jsonPayload && e.jsonPayload.message)));
texts.sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);
console.log('\n=== 文本日志（窗口内） ===');
for (const e of texts) {
  const t = e.textPayload || (e.jsonPayload && e.jsonPayload.message) || '';
  console.log(e.timestamp.slice(11, 19) + '  ' + String(t).slice(0, 200));
}

// 3) 快照/持久化相关
console.log('\n=== 快照/GCS FUSE 相关（全时段） ===');
const snap = entries.filter(e => /snap|OutOfOrder|BufferedWrite|journal|FUSE|gcs/i.test(e.textPayload || JSON.stringify(e.jsonPayload || {})));
console.log('count:', snap.length);
const snapSet = new Set();
for (const e of snap) {
  const t = String(e.textPayload || (e.jsonPayload && e.jsonPayload.message) || JSON.stringify(e.jsonPayload)).slice(0, 150);
  snapSet.add(t);
}
for (const t of snapSet) console.log(t);

// 4) 启动日志
console.log('\n=== 启动/恢复日志（全时段） ===');
const boot = entries.filter(e => /启动|恢复|boot|restore|listen|listening|started|快照/i.test(e.textPayload || ''));
for (const e of boot.slice(0, 15)) {
  console.log((e.timestamp || '').slice(11, 19) + '  ' + String(e.textPayload || '').slice(0, 160));
}
