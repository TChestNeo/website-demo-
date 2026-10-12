// tmp-update-memory-pbg.js — v0.2.37.0 自定义页面背景收尾锚点：build-state head + scheme 链尾 + MEMORY.md 双指针
'use strict';
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

const BS_ENTRY = '**当前线上 rev 00208-nzm（2026-09-13 v0.2.37.0 自定义页面背景（多图纵向拼接·边缘虚化·7 比例整页预览）——用户「在卡片列表的下方添加一个标题叫自定义…上传自己的背景…16:9是最低要求可以做得很长…多图纵向拼接（图2接图1下）…拖动改变上下排列顺序…虚化边缘单独调整虚化范围…弹窗右侧整页预览左侧工具栏…预览多个比例（平板16:10/手机20:9/16:9/21:9+详细折叠1:1.4/4:3/1:1）」：背景=整页背景画在 gridCanvas 自身 background-image（100% auto/top center/no-repeat，零新元素零事件风险；否决 z:-1 子元素——负 z 先于画布自身背景绘制被盖）+has-page-bg 灭网格线；高度衔接=minHeight=宽×compH/1600（offsetHeight=max(内容,背景)），refitColumns 尾部一行钩子全覆盖；合成=1600×compH 离屏先 fillRect 主题底色（JPEG 无 alpha 防深色发黑）→逐图 temp 画布 destination-in 4-stop 线性渐变→主画布 y+=H−O_i（O_i=min(B_i,H/2)+min(T_{i+1},H/2)）缝区两图 α 互补完全交叉淡化（中间图有效淡入淡出宽=O[i-1]/O[i]，调任一边加宽渐变；T+B>H 按比例压缩；羽化重叠降总高→16:9 校验实时红提示+保存拦截）；上传 4 门禁（8MB/类型/≤6 张/累积 dataURL 2.5MB）；弹窗左工具栏右预览、HTML5 DnD insertBefore 换位（顺序从 DOM 重推）、data-onclose 取消钩子（Escape 仅弹窗激活时，开窗 blur 防键盘漂移）；草稿 additive pageBg:{imgs,order,feathers}（产物不入草稿载入确定性重算）；**线上电池抓出 draftHas:false 真 bug→getCardFingerprint 补 pagebg 签名（张数+顺序+虚化值，不入 dataURL）——autosave 守卫 fp!==lastSavedContent 曾永不跳变→草稿/云 PUT 永不写→刷新丢背景（本地电池显式 saveDraft 曾掩盖，新 S7b 回归钉死）**；撤销/重做经 applyDraft 清场/恢复往返；FC v10.28.27.0（小更新位 26→27·新功能轮·补丁归零）；电池 page-bg 27/27（F1-F6+S1-S16+Z，含 S7b）+ 线上电池 PASS（上传3→拖序→虚化→7 比例→保存→刷新恢复→撤销/重做→移除；putWithPageBg 仅供参考——fcCloudMode 仅真登录 USR- 用户开，载荷由 buildDraft 保证）；零后端、ethereal 零改动无需 inline-css；部署两次 exit 0（00207-hw9 初版、00208-nzm 指纹修复）；commit 5056473 未 push；每轮 rev 全量链见 [[backend-build-state]]）**；前身 rev 00206-m9x（';

const SV_ENTRY = '站点号当前 **v0.2.37.0**（2026-09-13 自定义页面背景——小改动位 36→37 新功能轮·补丁归零（用户「在卡片列表的下方添加一个标题叫自定义…上传自己的背景…16:9是最低要求可以做得很长…多图纵向拼接…拖动改变上下排列顺序…虚化边缘单独调整虚化范围…弹窗右侧整页预览左侧工具栏…预览多个比例（平板16:10/手机20:9/16:9/21:9+详细折叠1:1.4/4:3/1:1）」：背景画在 gridCanvas 自身 background-image（零新元素+has-page-bg 灭网格线+minHeight 随合成高长高）；合成=离屏 canvas 纵向拼接+缝区 destination-in 交叉淡化+主题底色预填；16:9 最低校验保存拦截+红提示；上传 4 门禁；拖拽换位+data-onclose 取消；草稿 additive pageBg；getCardFingerprint 补 pagebg 签名（线上电池 draftHas:false→autosave 永不写草稿→刷新丢背景）；FC v10.28.27.0（小更新位 26→27）；电池 27/27 + 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署两次 exit 0（00207-hw9、00208-nzm）；commit 5056473 未 push）；前身 v0.2.36.0（';

// —— 1. backend-build-state.md head：00206-m9x → 00208-nzm ——
{
  const p = M + '/backend-build-state.md';
  let s = fs.readFileSync(p, 'utf8');
  const anchor = '**当前线上 rev 00206-m9x（';
  const n = s.split(anchor).length - 1;
  if (n !== 1) { console.log('❌ build-state anchor count wrong: ' + n); process.exit(1); }
  s = s.replace(anchor, BS_ENTRY);
  fs.writeFileSync(p, s);
  console.log('✅ backend-build-state.md updated（00208-nzm 计数 ' + (s.split('00208-nzm').length - 1) + '）');
}

// —— 2. site-versioning-scheme.md 链尾：v0.2.36.0 条目后插 v0.2.37.0 ——
{
  const p = M + '/site-versioning-scheme.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.split('v0.2.37.0 = ').length > 1) { console.log('ℹ scheme 已含 v0.2.37.0 条目，跳过'); }
  else {
    const anchor = '部署一次 exit 0（00206-m9x）；commit 446dd57 未 push）';
    const n = s.split(anchor).length - 1;
    if (n !== 1) { console.log('❌ scheme anchor count wrong: ' + n); process.exit(1); }
    const entry = anchor + '；2026-09-13 v0.2.37.0 = 自定义页面背景（小改动位 36→37·新功能轮·补丁归零——用户「在卡片列表的下方添加一个标题叫自定义…上传自己的背景…16:9是最低要求可以做得很长…多图纵向拼接…拖动改变上下排列顺序…虚化边缘单独调整虚化范围…弹窗右侧整页预览左侧工具栏…预览多个比例（平板16:10/手机20:9/16:9/21:9+详细折叠1:1.4/4:3/1:1）」：背景=整页背景画在 gridCanvas 自身 background-image（零新元素零事件风险；否决 z:-1 子元素被画布自身背景盖；has-page-bg 灭网格线；minHeight=宽×compH/1600 随背景长高、refitColumns 一处钩子）；合成=1600 宽离屏 canvas 先填主题底色→逐图 destination-in 线性渐变→y+=H−O_i 缝区 α 互补交叉淡化（羽化重叠降总高→16:9 校验红提示+保存拦截）；上传四门禁；弹窗左工具栏右整页预览（克隆 7 档 aspect-ratio）+拖拽换位+data-onclose 取消；草稿 additive pageBg（产物不入草稿）；getCardFingerprint 补 pagebg 签名（线上电池 draftHas:false 真 bug：autosave 守卫永不跳变→刷新丢背景）；FC v10.28.27.0（小更新位 26→27）；电池 27/27（新 S7b 自动落草稿回归）+ 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署两次 exit 0（00207-hw9 初版、00208-nzm 指纹修复）；commit 5056473 未 push）';
    s = s.replace(anchor, entry);
    fs.writeFileSync(p, s);
    console.log('✅ site-versioning-scheme.md updated（v0.2.37.0 计数 ' + (s.split('v0.2.37.0').length - 1) + '）');
  }
}

// —— 3. MEMORY.md 双指针 ——
{
  const p = M + '/MEMORY.md';
  let s = fs.readFileSync(p, 'utf8');
  const a1 = '**当前线上 rev 00206-m9x（';
  const n1 = s.split(a1).length - 1;
  if (n1 !== 1) { console.log('❌ MEMORY.md bs anchor count wrong: ' + n1); process.exit(1); }
  s = s.replace(a1, BS_ENTRY);
  const a2 = '站点号当前 **v0.2.36.0**（';
  const n2 = s.split(a2).length - 1;
  if (n2 !== 1) { console.log('❌ MEMORY.md sv anchor count wrong: ' + n2); process.exit(1); }
  s = s.replace(a2, SV_ENTRY);
  fs.writeFileSync(p, s);
  console.log('✅ MEMORY.md updated（00208 计数 ' + (s.split('00208-nzm').length - 1) + '、v0.2.37.0 计数 ' + (s.split('v0.2.37.0').length - 1) + '）');
}

// —— 4. ** 平衡校验 ——
{
  const p = M + '/MEMORY.md';
  const s = fs.readFileSync(p, 'utf8');
  const open = (s.match(/\*\*/g) || []).length;
  console.log(open % 2 === 0 ? '✅ MEMORY.md ** 平衡（' + open + ' 个）' : '❌ MEMORY.md ** 不平衡: ' + open);
  if (open % 2 !== 0) process.exit(1);
  const b = M + '/backend-build-state.md';
  const sb = fs.readFileSync(b, 'utf8');
  const openB = (sb.match(/\*\*/g) || []).length;
  console.log(openB % 2 === 0 ? '✅ backend-build-state.md ** 平衡（' + openB + ' 个）' : '❌ backend-build-state.md ** 不平衡: ' + openB);
  if (openB % 2 !== 0) process.exit(1);
  const v = M + '/site-versioning-scheme.md';
  const sv2 = fs.readFileSync(v, 'utf8');
  const openV = (sv2.match(/\*\*/g) || []).length;
  console.log(openV % 2 === 0 ? '✅ site-versioning-scheme.md ** 平衡（' + openV + ' 个）' : '❌ site-versioning-scheme.md ** 不平衡: ' + openV);
  if (openV % 2 !== 0) process.exit(1);
}
