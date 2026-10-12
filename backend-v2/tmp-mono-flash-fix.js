// tmp-mono-flash-fix.js — 2026-09-16 切页闪修复（用户「黑白主题在切换页面时会先显示默认主题的颜色再转变成黑白主题的颜色」）
// ① settings-modal.js：mono 主题色规则整体迁出（ensureStyle 只留弹窗 UI 规则）+ 注释口径更新
// ② ethereal.css：mono 族追加（随 inline-css.js 内联进 40 页，首帧生效）
// ③ theme-init.js（head 内联块原版源）：同步落 data-accent
// ④ 29 个 HTML 页的 head 内联「防主题白闪」块：同步落 data-accent
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
let problems = 0;
function check(name, cond, detail) {
  if (!cond) { problems++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
  else console.log('  ✅ ' + name);
}

// ═══ ① settings-modal.js ═══
const SM_PATH = path.join(DOCS, 'assets', 'js', 'settings-modal.js');
let sm = fs.readFileSync(SM_PATH, 'utf8');
const smEol = sm.includes('\r\n') ? '\r\n' : '\n';

// 注释口径：applyAccent 头部 + init 两行
const cA = "  // ── Apply accent color（主题色：blue 蓝白 / mono 黑白；2026-09-10 用户「主题色分成黑白和现在这个蓝白两种」）──";
const cANew = cA + smEol + '  // 2026-09-16：mono 规则迁入 ethereal.css 随内联首帧生效、head 内联 theme-init 先落属性（本函数仍负责弹窗实时切换+兜底）';
check('①a applyAccent 注释更新', (sm.match(new RegExp(cA, 'g')) || []).length === 1);
sm = sm.replace(cA, cANew);

const cB = '  applyAccent(); // page-load init' + smEol + '  ensureStyle(); // accent/menu CSS 常驻注入（页面加载即生效，不等开弹窗——否则刷新后 accent 选择会失效）';
const cBNew = '  applyAccent(); // page-load init（head 内联 theme-init 已先落同值——此处兜底；弹窗实时切换仍走它）' + smEol + '  ensureStyle(); // 弹窗 UI 样式常驻注入（mono 规则已迁 ethereal.css 首帧生效，此处仅弹窗自身样式）';
check('①b init 两行注释更新', (sm.match(new RegExp(cB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 1);
sm = sm.replace(cB, cBNew);

// mono 块整体迁出：锚点=块首注释行 ~ 末条 .settings-menu-item.active mono 规则
const smLines = sm.split(/\r?\n/);
const startIdx = smLines.findIndex(l => l.indexOf('// ── 主题色「黑白」mono') !== -1);
const endIdx = smLines.findIndex(l => l.indexOf("'html[data-accent=\"mono\"] .settings-menu-item.active { background: rgba(118, 117, 134, 0.10); }'") !== -1);
check('①c mono 块锚点定位', startIdx > 0 && endIdx > startIdx, 'start=' + startIdx + ' end=' + endIdx);
const blockLines = smLines.slice(startIdx, endIdx + 1);

// JS 数组行 → CSS 文本（// 注释转 /* */）
const cssLines = [];
for (const raw of blockLines) {
  if (/^\s*\/\//.test(raw)) cssLines.push('/* ' + raw.replace(/^\s*\/\/\s*/, '') + ' */');
  else if (/^\s*$/.test(raw)) cssLines.push('');
  else {
    const m = raw.match(/^\s*'([\s\S]+)',\s*$/);
    if (!m) { problems++; console.log('  ❌ mono 块内无法解析行: ' + JSON.stringify(raw)); continue; }
    cssLines.push(m[1]);
  }
}
check('①d mono 块行数（116 行内）', blockLines.length > 100 && blockLines.length < 130, blockLines.length + ' 行');
check('①e mono 块含全部三组锚点（暗黑族/白底白字族/migrate 族）',
  cssLines.some(l => l.indexOf('--color-background: #0b0b0d') !== -1) &&
  cssLines.some(l => l.indexOf('.grid-controls .col-btn.active') !== -1) &&
  cssLines.some(l => l.indexOf('.migrate-pill::before') !== -1));

// 原位置留指针注释
const pointer = [
  '      // ── 2026-09-16 切页闪修复（用户「黑白主题在切换页面时会先显示默认主题的颜色再转变成黑白主题的颜色」）：',
  '      // mono 主题色规则整体迁入 ethereal.css（随内联 CSS 首帧生效），data-accent 由 head 内联 theme-init 同步落——',
  '      // 本注入样式只剩弹窗 UI 规则；弹窗实时切换主题色仍走 applyAccent 开关 html 属性，mono 族即时响应 ──',
];
smLines.splice(startIdx, endIdx - startIdx + 1, ...pointer);
sm = smLines.join(smEol);
fs.writeFileSync(SM_PATH, sm, 'utf8');

// ═══ ② ethereal.css 追加 ═══
const ETH_PATH = path.join(DOCS, 'assets', 'css', 'ethereal.css');
let eth = fs.readFileSync(ETH_PATH, 'utf8');
const ethEol = eth.includes('\r\n') ? '\r\n' : '\n';
check('②a ethereal 无既有 mono 规则', eth.indexOf('data-accent="mono"') === -1);
const ethHeader = [
  '/* ═══ 主题色「黑白」mono 家族（2026-09-16 自 settings-modal.js 运行时注入迁入本文件——切页闪修复）═══',
  '   用户「黑白主题在切换页面时会先显示默认主题的颜色再转变成黑白主题的颜色」——真身=mono 规则与 data-accent 全靠',
  '   settings-modal.js 在 body 末尾运行时注入 → 首帧先画蓝家族再跳黑白；迁入后随本文件内联进 40 页 HTML，',
  '   data-accent 由 head 内联 theme-init 同步落——首帧即黑白；弹窗实时切换主题色仍走 applyAccent（只开关 html 属性） */',
  '',
];
if (!eth.endsWith('\n')) eth += ethEol;
eth += ethEol + ethHeader.join(ethEol) + cssLines.join(ethEol) + ethEol;
fs.writeFileSync(ETH_PATH, eth, 'utf8');
const ethAfter = fs.readFileSync(ETH_PATH, 'utf8');
check('②b ethereal 已含暗黑族+白底白字族+FC 族',
  ethAfter.indexOf('--color-background: #0b0b0d') !== -1 &&
  ethAfter.indexOf('.grid-controls .col-btn.active') !== -1 &&
  ethAfter.indexOf('.migrate-pill::before') !== -1);

// ═══ ③ 29 个 HTML 页 head 内联块补 data-accent ═══
const newBlock = [
  '<script>',
  '/* 防主题白闪：原 theme-init.js 内联——必须 CSS 之前同步执行（外链脚本走网络晚到 → 页面先按默认主题画一帧再跳 = 切页闪白）；mono 主题色一并同步落 data-accent——规则静态在 ethereal.css 随内联首帧生效，不再等 settings-modal.js 注入后才变黑白 */',
  '(function () {',
  '  var theme = \'light\';',
  '  var accent = \'blue\';',
  '  try {',
  '    var raw = localStorage.getItem(\'slati_settings\');',
  '    if (raw) {',
  '      var s = JSON.parse(raw);',
  '      if (s.theme) theme = s.theme;',
  '      if (s.accent) accent = s.accent;',
  '    }',
  '  } catch (e) {}',
  '  if (theme === \'auto\') {',
  '    var h = new Date().getHours();',
  '    theme = (h >= 20 || h < 5) ? \'dark\' : \'light\';',
  '  } else if (theme === \'system\') {',
  '    theme = \'light\';',
  '  }',
  '  if (theme === \'dark\') {',
  '    document.documentElement.setAttribute(\'data-theme\', \'dark\');',
  '  }',
  '  if (accent === \'mono\') {',
  '    document.documentElement.setAttribute(\'data-accent\', \'mono\');',
  '  }',
  '})();',
  '</script>',
];
const re = /(^[ \t]*)<script>\s*\/\* 防主题白闪[\s\S]*?<\/script>/gm;
let patched = 0;
const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.html')) {
      let src = fs.readFileSync(p, 'utf8');
      if (src.indexOf('防主题白闪') === -1) continue;
      const ms = src.match(re);
      check('③ 匹配唯一: ' + path.relative(DOCS, p), ms && ms.length === 1, ms ? ms.length + ' 处' : '0 处');
      if (!ms || ms.length !== 1) continue;
      const eol = src.includes('\r\n') ? '\r\n' : '\n';
      src = src.replace(re, (m, indent) => newBlock.map(l => indent + l).join(eol));
      fs.writeFileSync(p, src, 'utf8');
      patched++;
    }
  }
};
walk(DOCS);
check('③ 总补丁页数 = 29', patched === 29, patched + ' 页');

// 收尾断言
const smFinal = fs.readFileSync(SM_PATH, 'utf8');
check('④ settings-modal 已无 mono 规则残留', smFinal.indexOf('0b0b0d') === -1 && smFinal.indexOf('32324a') === -1);
check('④ settings-modal 弹窗 UI 规则保留', smFinal.indexOf('#settingsCard') !== -1 && smFinal.indexOf('.accent-chip') !== -1);
console.log('');
console.log(problems === 0 ? '🎉 修复脚本全部通过（随后必须重跑 inline-css.js 再部署）' : '💔 有 ' + problems + ' 处问题，未部署资格');
process.exit(problems === 0 ? 0 : 1);
