// tmp-i18n-gen.js — v0.2.54.0 i18n 轮：HTML 静态文本采集器（零依赖）
// 用法：node tmp-i18n-gen.js scan <html文件>
// 原理：去掉 script/style 内容后，反复对「无子标签的叶子元素」提取直接文本并置空，
//       直到无叶子——完整采集 body 内所有静态文本节点（含实体解码）。
// 输出：tag | attrs摘要 | 解码后文本（供手工命名键 + 翻译；仅采集不漏，不生成字典）。
'use strict';
const fs = require('fs');

const RE = /<([a-zA-Z][a-zA-Z0-9-]*)([^<>]*?)>([^<>]*?)<\/\1>/;

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); });
}

function attrSummary(attrs) {
  var id = attrs.match(/\bid="([^"]*)"/);
  var cls = attrs.match(/\bclass="([^"]*)"/);
  var s = [];
  if (id) s.push('#' + id[1]);
  if (cls) s.push('.' + cls[1].split(/\s+/).slice(0, 2).join('.'));
  return s.join(' ') || '(none)';
}

function scan(file) {
  var html = fs.readFileSync(file, 'utf8');
  var start = html.indexOf('<body');
  if (start === -1) { console.log('NO <body>'); return; }
  var body = html.slice(start)
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '<$1></$1>');
  var out = [];
  var guard = 0;
  while (guard++ < 600) { // 大页（about 300+ 叶）单轮自闭合只消耗一层，需远大于 60 轮；截断时打满即漏扫
    var count = 0;
    body = body.replace(RE, function (full, tag, attrs, text) {
      count++;
      var t = decodeEntities(text).replace(/\s+/g, ' ').trim();
      if (t) out.push({ tag: tag, sel: attrSummary(attrs), text: t });
      return '<' + tag + attrs + ' />'; // 自闭合：消耗本叶子，不再匹配 RE
    });
    if (!count) break;
  }
  console.log('passes=' + guard + ' leaves=' + out.length + (guard >= 600 ? '  ⚠ 打满守卫=结果被截断！' : ''));
  out.forEach(function (o, i) {
    console.log('[' + i + '] <' + o.tag + '> ' + o.sel + '  =>  ' + o.text);
  });
}

var args = process.argv.slice(2);
if (args[0] === 'scan' && args[1]) scan(args[1]);
else console.log('usage: node tmp-i18n-gen.js scan <html>');
