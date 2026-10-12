// tmp-b2-parse3.js — 04:47~05:56 窗口（用户抱怨发生的那次会话）全请求
'use strict';
const fs = require('fs');
let raw = fs.readFileSync(__dirname + '/tmp-b2-logs.json', 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const entries = JSON.parse(raw);

const tMin = '2026-09-20T04:47:00Z', tMax = '2026-09-20T05:56:30Z';
const win = entries.filter(e => e.timestamp >= tMin && e.timestamp <= tMax);
console.log('window entries:', win.length);

// 页面 HTML 加载 + API 请求（过滤静态资源）
const interesting = win.filter(e => {
  const h = e.httpRequest;
  if (!h) return false;
  const u = h.requestUrl;
  // 页面 HTML + /api/ 全部
  return u.indexOf('/api/') !== -1 || /\.html$/.test(u.replace(/\?.*/, '')) || /^HEAD/.test(h.requestMethod);
});
interesting.sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);
console.log('\n=== 页面 + API 请求（04:47~05:56） ===');
for (const e of interesting) {
  const h = e.httpRequest;
  console.log(e.timestamp.slice(11, 19) + '  ' + h.requestMethod + ' ' + h.requestUrl.replace('https://mnationworld.com', '') + '  → ' + h.status);
}

// 这个窗口内的写操作 + 失败
console.log('\n=== 写操作 / 失败 ===');
for (const e of win) {
  const h = e.httpRequest;
  if (!h) continue;
  if (h.requestMethod === 'PUT' || h.requestMethod === 'POST' || h.requestMethod === 'DELETE' || h.status >= 400) {
    console.log(e.timestamp.slice(11, 19) + '  ' + h.requestMethod + ' ' + h.requestUrl.replace('https://mnationworld.com', '') + '  → ' + h.status);
  }
}
