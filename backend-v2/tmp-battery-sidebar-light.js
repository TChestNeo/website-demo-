// tmp-battery-sidebar-light.js — v0.2.58.25 左侧菜单底部不透明背景完全删除静态巡检电池（纯文件 grep，无浏览器）
// 断言：ethereal.css 侧栏容器铺底规则零残留（深浅两主题）/ 玻璃注入层灭滤镜灭磨砂规则在位 /
// 41 页内联块全量已刷新（凡含 lg-glass-filter 内联块的页面必含新轮注释且零铺底规则）/ 三张卡零触碰
// （.sidebar-module --card-bg+blur 原样）/ dropdown 与全站卡片的 --sidebar-bg 用法不动（计数=2）/
// site-config 版本 58.1+changelog 新条目+58.0 历史条目保留+FC 47.4 零改动
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

// 1. ethereal.css 源头：铺底规则零残留 + 灭滤镜规则在位 + 三卡/下拉/卡片 var 用法零触碰
{
  const css = read(path.join(DOCS, 'assets/css/ethereal.css'));
  ok('ethereal 暗色侧栏铺底规则零残留',
    css.indexOf(':root[data-theme="dark"] .app-sidebar {') === -1);
  ok('ethereal 亮色侧栏铺底规则零残留',
    css.indexOf(':root:not([data-theme="dark"]) .app-sidebar {') === -1);
  ok('ethereal 暗色玻璃注入层灭滤镜灭磨砂规则在位',
    css.indexOf(':root[data-theme="dark"] .app-sidebar .lg-backdrop {') !== -1 &&
    css.indexOf('filter: none;') !== -1 && css.indexOf('backdrop-filter: none;') !== -1);
  ok('ethereal 亮色玻璃注入层灭滤镜灭磨砂规则在位',
    css.indexOf(':root:not([data-theme="dark"]) .app-sidebar .lg-backdrop {') !== -1);
  ok('ethereal 新轮注释含用户原话',
    css.indexOf('我要完全的删除它') !== -1 && css.indexOf('不是我的卡片') !== -1 &&
    css.indexOf('Z 轴最底部背景') !== -1);
  ok('ethereal 三张卡零触碰（.sidebar-module 玻璃卡原样）',
    css.indexOf('.sidebar-module {') !== -1 &&
    css.indexOf('background: var(--card-bg);') !== -1 &&
    css.indexOf('backdrop-filter: blur(20px);') !== -1);
  ok('ethereal --sidebar-bg 用法恒 2 处（dropdown + 全站卡片不透明规则）',
    css.split('background: var(--sidebar-bg);').length - 1 === 2);
  ok('ethereal 09-18 修复历史注释保留（发黄原话）',
    css.indexOf('为什么在亮色模式下平台的左侧菜单背景卡片会发黄的') !== -1);
}

// 2. 内联页全量巡检：凡含 lg-glass-filter 内联块的页面必含新轮注释且零铺底规则（inline-css.js 已刷新）
{
  const files = [];
  (function walk(dir, base) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), base + e.name + '/');
      else if (e.name.endsWith('.html')) files.push(base + e.name);
    }
  })(DOCS, '');
  const inlinePages = files.filter((f) => read(path.join(DOCS, f)).indexOf('lg-glass-filter') !== -1);
  ok('内联页总数 = 41（实测 ' + inlinePages.length + '）', inlinePages.length === 41);
  let bad = 0;
  for (const f of inlinePages) {
    const h = read(path.join(DOCS, f));
    if (h.indexOf('我要完全的删除它') === -1 ||
        h.indexOf(':root[data-theme="dark"] .app-sidebar {') !== -1 ||
        h.indexOf(':root:not([data-theme="dark"]) .app-sidebar {') !== -1) {
      bad++; fail++; console.log('  ❌ 内联块未刷新或铺底规则残留：' + f);
    }
  }
  if (bad === 0) { pass++; console.log('  ✅ 41 页内联块全部已刷新（新轮注释在位、铺底规则零残留）'); }
}

// 3. site-config 版本 + changelog 新条目 + 历史条目保留 + FC 零改动
{
  const s = read(path.join(DOCS, 'assets/js/site-config.js'));
  ok('site-config 版本 = v0.2.58.25', s.indexOf("window.MN_SITE_VERSION = 'v0.2.58.25';") !== -1);
  ok('site-config 旧版本赋值零残留', s.indexOf("window.MN_SITE_VERSION = 'v0.2.58.0';") === -1);
  ok('site-config changelog 含 v0.2.58.25 条目 + 用户原话 + 修法口径',
    s.indexOf('v0.2.58.3 = 折叠侧栏等级水位环+双层水波') !== -1 &&
    s.indexOf('我要完全的删除它') !== -1 && s.indexOf('不是我的卡片') !== -1 &&
    s.indexOf('rev 00346-') !== -1);
  ok('site-config 58.0 历史条目保留', s.indexOf('v0.2.58.0 = 完整格子画布镜像') !== -1);
  const sj = read(path.join(DOCS, 'assets/js/sidebar.js'));
  ok('sidebar.js 53.3 历史注释保留', sj.indexOf('那个左侧菜单的底部背景能不能去掉') !== -1);
  ok('FC v10.28.48.0 保持（零改动）', s.indexOf("'v10.28.48.1'") !== -1);
}

console.log('\nsidebar-light 巡检：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
