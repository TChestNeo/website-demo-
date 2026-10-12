// tmp-memory-ritual-657.js — FC v10.28.62.0 字体面板搜索+语言筛选记忆仪式
'use strict';
const fs = require('fs');
const P = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const REAL90 = '00390-cjv';
const DIGEST = '7d27e7b8091ab8a8fd93a546d18bfa8836db21a439b7aefdbc48749c119809fc';

// 1) build-state head
{
  const f = P + 'backend-build-state.md';
  let s = fs.readFileSync(f, 'utf8');
  const OLD = '**当前线上 rev 00389-9fc（2026-10-07 FC v10.28.61.0 恢复「图片与边缘同步」勾选；站点恒 v0.2.58.28）';
  if ((s.match(/当前线上 rev 00389-9fc/g) || []).length !== 1) throw new Error('head anchor');
  const NEW = '**当前线上 rev ' + REAL90 + '（2026-10-07 FC v10.28.62.0 字体面板加搜索栏+语言筛选；站点恒 v0.2.58.28）' +
    '——用户「选字体语言很麻烦，在菜单顶部加语言筛选栏和搜索栏」；' +
    '修法=字体面板 #fontPanel 顶部加 .fp-toolbar（#fpSearch 搜索框 + #fpLangFilter 语言下拉），buildFontPanel 填语言选项+行/组 data-lang，filterFontPanel 名称搜索+语言筛选叠加、空组头隐藏；i18n fc.font.search/fc.font.allLangs ×12；' +
    '后端零改动 npm test 413/413；线上探针 4/4；digest sha256:' + DIGEST + '（当前线上）；commit 未 push；**前身 rev 00389-9fc（2026-10-07 FC v10.28.61.0 恢复「图片与边缘同步」勾选；站点恒 v0.2.58.28）';
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log('1) build-state ✓ ' + REAL90);
}
// 2) scheme 追加 + 指针
{
  const f = P + 'site-versioning-scheme.md';
  let s = fs.readFileSync(f, 'utf8');
  const PTR_OLD = '**站点号当前 v0.2.58.28；FC 当前 v10.28.61.0**';
  if ((s.match(/FC 当前 v10\.28\.61\.0/g) || []).length !== 1) throw new Error('ptr anchor');
  const entry = '**FC v10.28.62.0（2026-10-07；小改动位 61→62 新功能轮；rev ' + REAL90 + '；站点恒 v0.2.58.28）**：字体面板加搜索栏+语言筛选——用户「选字体语言很麻烦」；修法=#fontPanel 顶部 .fp-toolbar（搜索+语言下拉）+filterFontPanel 叠加过滤；i18n fc.font.search/allLangs ×12；后端零改动 npm test 413/413；线上探针 4/4；digest sha256:' + DIGEST + '（当前线上）；commit 未 push）。';
  s = s.replace(PTR_OLD, entry + '**站点号当前 v0.2.58.28；FC 当前 v10.28.62.0**');
  fs.writeFileSync(f, s);
  console.log('2) scheme ✓ 62.0');
}
// 3) MEMORY.md 顶行
{
  const f = P + 'MEMORY.md';
  let s = fs.readFileSync(f, 'utf8');
  const line = '- [2026-10-07 — FC v10.28.62.0 字体面板加搜索栏+语言筛选（rev ' + REAL90 + ' commit 未 push；站点恒 58.28）：#fontPanel 顶部 .fp-toolbar（搜索+语言下拉）+filterFontPanel 叠加过滤；后端零改动 npm test 413/413；线上探针 4/4 见 [2026-10-07-fc-v1028620-fontsearch.md](2026-10-07-fc-v1028620-fontsearch.md)]\n';
  s = line + s;
  fs.writeFileSync(f, s);
  console.log('3) MEMORY.md ✓');
}
// 4) 新记忆文件
{
  const f = P + '2026-10-07-fc-v1028620-fontsearch.md';
  const body = '---\nname: 2026-10-07-fc-v1028620-fontsearch\ndescription: FC v10.28.62.0 字体面板加搜索栏+语言筛选（rev ' + REAL90 + ' commit 未 push；站点恒 58.28）\nmetadata:\n  node_type: memory\n  type: project\n  modified: 2026-10-07T' + new Date().toISOString().slice(11, 19) + 'Z\n---\n\n# FC v10.28.62.0 字体面板加搜索栏+语言筛选（2026-10-07，已完成）\n\n**用户原话**：「选字体语言很麻烦，在菜单顶部加语言筛选栏和搜索栏」\n\n**修法**：字体面板 #fontPanel 顶部加 .fp-toolbar（#fpSearch 搜索框 + #fpLangFilter 语言下拉）；buildFontPanel 填语言选项+给 .fp-group/.fp-row 加 data-lang；filterFontPanel 按名称（小写包含）+语言筛选叠加过滤、遍历 .fp-group 后续兄弟判空隐藏空组头。\n\n**新坑**：fp-list 是 3 列 grid，行 display:none 会自动重排；组头是 grid-column:1/-1 吸顶，隐藏后需重算下一组。\n\n链条：[[2026-10-06-fc-v1028530-edgemask]] ← 本轮；[[site-versioning-scheme]]；[[backend-build-state]]。\n';
  fs.writeFileSync(f, body);
  console.log('4) 新记忆文件 ✓');
}
console.log('记忆仪式四处完成');
