// tmp-extract-fc-i18n.js — 提取 FC 两页全部 i18n 键 + 当前渲染文本（生成字典用，不部署）
const fs = require('fs');
const path = require('path');
const pages = [
  { name: 'editor', file: path.join(__dirname, '..', 'docs', 'pages', 'fluidcanvas-editor.html') },
  { name: 'landing', file: path.join(__dirname, '..', 'docs', 'pages', 'fluidcanvas.html') }
];
const out = {}; // key -> { zh, src:Set, kind }
function note(key, zh, src, kind) {
  if (!out[key]) out[key] = { zh: zh, src: new Set(), kind: new Set() };
  out[key].src.add(src);
  out[key].kind.add(kind);
  if (zh != null) out[key].zh = zh;
}
function unesc(s) {
  return s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/\\"/g, '"');
}
for (const p of pages) {
  const html = fs.readFileSync(p.file, 'utf8');
  // 静态 data-i18n（纯文本内容）
  const re1 = /<[^>]*data-i18n="(fc\.[A-Za-z0-9._]+)"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/g;
  let m;
  while ((m = re1.exec(html))) {
    const inner = m[2].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (inner) note(m[1], inner, p.name, 'static');
  }
  // data-i18n-html
  const re2 = /<[^>]*data-i18n-html="(fc\.[A-Za-z0-9._]+)"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/g;
  while ((m = re2.exec(html))) note(m[1], m[2].trim(), p.name, 'html');
  // data-i18n-title / placeholder
  const re3 = /data-i18n-(?:title|placeholder)="(fc\.[A-Za-z0-9._]+)"/g;
  while ((m = re3.exec(html))) {
    // 取同标签内对应真实属性值
    const tagStart = html.lastIndexOf('<', m.index);
    const tagEnd = html.indexOf('>', m.index);
    const tag = html.slice(tagStart, tagEnd);
    const attr = m[0].indexOf('title') >= 0 ? 'title' : 'placeholder';
    const av = tag.match(new RegExp(attr + '="([^"]*)"'));
    note(m[1], av ? av[1] : null, p.name, attr);
  }
  // JS 调用点：T/FT/__fcT('key') || '字面量' 或 || (非字面量)
  const re4 = /(?:T|FT|__fcT)\('(fc\.[A-Za-z0-9._]+)'\)\s*\|\|\s*(?:'((?:[^'\\]|\\.)*)'|\((?!['"])[^)]*\))/g;
  while ((m = re4.exec(html))) {
    if (m[2] != null) note(m[1], unesc(m[2]), p.name, 'js');
    else note(m[1], null, p.name, 'js-data-fallback');
  }
}
const keys = Object.keys(out).sort();
const obj = {};
for (const k of keys) obj[k] = { zh: out[k].zh, src: [...out[k].src].join('+'), kind: [...out[k].kind].join('+') };
console.log('KEYS=' + keys.length);
fs.writeFileSync(path.join(__dirname, 'tmp-fc-i18n-keys.json'), JSON.stringify(obj, null, 1), 'utf8');
// 打印 zh 为英文的键（zh 需翻译成中文的 chrome）
const enKeys = keys.filter(k => /^[\x20-\x7E]*$/.test(out[k].zh || '') && out[k].zh);
console.log('--- keys whose current text is pure ASCII (zh needs Chinese translation) ---');
enKeys.forEach(k => console.log(k + ' => ' + out[k].zh.replace(/\n/g, '\\n')));
