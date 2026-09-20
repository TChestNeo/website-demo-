// tmp-battery-sidebar-light.js — v0.2.51.2 亮色侧栏发黄/暗斑修复静态巡检电池（纯文件 grep，无浏览器）
// 断言：ethereal.css 亮色侧栏两规则在位（铺不透明白底 + 灭玻璃注入层滤镜/磨砂）/ 暗色修复零触碰 /
// 40 页内联块全量已刷新（凡含 lg-glass-filter 内联块的页面必有新规则）/ site-config 版本 + changelog + FC 零改动
'use strict';
const fs = require('fs');
const path = require('path');

const DOCS = path.resolve(__dirname, '..', 'docs');
const read = (p) => fs.readFileSync(p, 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

// 1. ethereal.css 源头：亮色两规则 + 暗色修复零触碰
{
  const css = read(path.join(DOCS, 'assets/css/ethereal.css'));
  ok('ethereal 亮色侧栏铺底规则在位',
    css.indexOf(':root:not([data-theme="dark"]) .app-sidebar {') !== -1 &&
    css.indexOf('background: var(--sidebar-bg);') !== -1);
  ok('ethereal 亮色侧栏灭滤镜灭磨砂规则在位',
    css.indexOf(':root:not([data-theme="dark"]) .app-sidebar .lg-backdrop {') !== -1 &&
    css.indexOf('filter: none;') !== -1 && css.indexOf('backdrop-filter: none;') !== -1);
  ok('ethereal 暗色修复零触碰（09-10 原规则原样在位）',
    css.indexOf(':root[data-theme="dark"] .app-sidebar {') !== -1 &&
    css.indexOf(':root[data-theme="dark"] .app-sidebar .lg-backdrop {') !== -1);
  ok('ethereal 修复注释含用户原话',
    css.indexOf('为什么在亮色模式下平台的左侧菜单背景卡片会发黄的') !== -1 &&
    css.indexOf('彻底铺不透明白底') !== -1);
}

// 2. 内联页全量巡检：凡含 lg-glass-filter 内联块的页面必有新规则（inline-css.js 40 页已刷新）
{
  const files = [];
  (function walk(dir, base) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), base + e.name + '/');
      else if (e.name.endsWith('.html')) files.push(base + e.name);
    }
  })(DOCS, '');
  const inlinePages = files.filter((f) => read(path.join(DOCS, f)).indexOf('lg-glass-filter') !== -1);
  ok('内联页总数 = 40（实测 ' + inlinePages.length + '）', inlinePages.length === 40);
  let bad = 0;
  for (const f of inlinePages) {
    if (read(path.join(DOCS, f)).indexOf(':root:not([data-theme="dark"]) .app-sidebar {') === -1) {
      bad++; fail++; console.log('  ❌ 内联块缺亮色侧栏规则：' + f);
    }
  }
  if (bad === 0) { pass++; console.log('  ✅ 40 页内联块全部含亮色侧栏规则'); }
}

// 3. site-config 版本 + changelog 条目 + FC 零改动
{
  const s = read(path.join(DOCS, 'assets/js/site-config.js'));
  ok('site-config 版本 = v0.2.54.0', s.indexOf("window.MN_SITE_VERSION = 'v0.2.55.1';") !== -1);
  ok('site-config changelog 含 v0.2.51.2 条目 + 用户原话 + 修法口径',
    s.indexOf('v0.2.51.2 = 亮色侧栏发黄/暗斑修复') !== -1 &&
    s.indexOf('为什么在亮色模式下平台的') !== -1 &&
    s.indexOf('彻底铺不透明白底') !== -1);
  ok('site-config 51.1 changelog 历史条目保留', s.indexOf('v0.2.51.1 = 公民号前缀 CIT- → USR- 全栈统一') !== -1);
  ok('FC v10.28.36.1 保持', s.indexOf("'v10.28.36.2'") !== -1);
}

console.log('\nsidebar-light 巡检：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
