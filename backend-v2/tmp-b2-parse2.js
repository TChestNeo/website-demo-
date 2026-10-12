// tmp-b2-parse2.js — 全时段关键请求：写操作/搜索/失败 + 时间范围
'use strict';
const fs = require('fs');
let raw = fs.readFileSync(__dirname + '/tmp-b2-logs.json', 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const entries = JSON.parse(raw);

console.log('total:', entries.length);
console.log('time range:', entries[entries.length - 1].timestamp, '→', entries[0].timestamp);

// 1) 所有写操作（PUT/POST/DELETE）
console.log('\n=== 全部 PUT/POST/DELETE ===');
for (const e of entries) {
  const h = e.httpRequest;
  if (!h) continue;
  const m = h.requestMethod;
  if (m === 'PUT' || m === 'POST' || m === 'DELETE') {
    console.log(e.timestamp.slice(11, 19) + '  ' + m + ' ' + h.requestUrl + '  → ' + h.status);
  }
}

// 2) 所有搜索请求
console.log('\n=== 全部搜索请求（q=） ===');
for (const e of entries) {
  const h = e.httpRequest;
  if (h && h.requestUrl && h.requestUrl.indexOf('q=') !== -1) {
    console.log(e.timestamp.slice(11, 19) + '  ' + h.requestMethod + ' ' + h.requestUrl + '  → ' + h.status);
  }
}

// 3) 所有非 2xx/3xx 状态
console.log('\n=== 全部失败状态（4xx/5xx） ===');
for (const e of entries) {
  const h = e.httpRequest;
  if (h && h.status >= 400) {
    console.log(e.timestamp.slice(11, 19) + '  ' + h.requestMethod + ' ' + h.requestUrl + '  → ' + h.status);
  }
}

// 4) /api/articles 全部请求
console.log('\n=== 全部 /api/articles 请求 ===');
for (const e of entries) {
  const h = e.httpRequest;
  if (h && h.requestUrl && h.requestUrl.indexOf('/api/articles') !== -1) {
    console.log(e.timestamp.slice(11, 19) + '  ' + h.requestMethod + ' ' + h.requestUrl.replace('https://mnationworld.com', '') + '  → ' + h.status);
  }
}
