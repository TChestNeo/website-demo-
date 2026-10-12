// tmp-update-memory-633.js — FC v10.28.49.0 记忆仪式：
//   ① backend-build-state.md 头旋转（00351-5mm 新 head；00349-hgc 降前身）
//   ② site-versioning-scheme.md 追加 FC 49.0 条目+当前指针（站点号恒 58.26）
//   ③ MEMORY.md 新行+两处「当前」指针更新
//   ④ 新记忆文件 2026-10-02-fc-v1028490-viewport-rotate.md
'use strict';
const REV1 = '00350-6vv';   // 部署#1 瞬态真 rev
const REV2 = '00351-5mm';   // 部署#2 终态真 rev
const DIGEST = 'sha256:49125fad597f1337f8502ba24e9f54739c685789de7f522b551c9b2a82c34525'; // 二次烘焙 push digest（=当前线上）
const fs = require('fs');
const path = require('path');
const MEM = 'C:\\Users\\USER\\.claude\\projects\\c--Users-USER-Downloads-stitch-slatiworld-micronation-interface\\memory';
const read = (f) => fs.readFileSync(path.join(MEM, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(MEM, f), s, 'utf8');
let steps = 0;
const step = (n, cond) => { steps++; console.log((cond ? '  ✅ ' : '  ❌ ') + n); if (!cond) process.exitCode = 1; };

// ═══ ① backend-build-state.md 头旋转 ═══
{
  const f = 'backend-build-state.md';
  let s = read(f);
  const headAnchor = '**当前线上 rev 00349-hgc（';
  const demote = '**前身 rev 00349-hgc（';
  step('build-state 旧 head 在位', s.indexOf(headAnchor) !== -1);
  s = s.replace(headAnchor, demote);
  const newHead =
    '**当前线上 rev ' + REV2 + '（2026-10-02 FC v10.28.49.0 平板 4:3 视口+旋转按钮+逐设备布局（站点恒 v0.2.58.26）——用户「那个FC 编辑器那边平板的比例是 4:3 然后横向 110 × 纵向 77 个格子 然后我希望当用户选择平板比例的时候那个视口选择按钮旁边会滑出一个旋转按钮可以点击旋转方向进行编辑，然后这些视口内这些卡片的位置在所有不同的比例或平板的方向它们的位置可以不一样，但是一定要拥有相关的卡片，就是卡片位置不需要同步但是卡片的内容那些需要同步」；' +
    '五项钦定（①发布侧=全布局一起发、阅读页按设备纯自动选无手动切换钮、?article= 零改动 ②初始位置=系统自动排列、手动动卡才落盘（markPresetCustom 门控）③增删同步所有视口 ④自动排列规则：mobile 全部纵向每卡一行全宽+组展开成员纵向流；tablet/tablet-p 横向最多 2 卡、合并组=一单位比例缩放；half=115 砍半 58 格、一排最多 4 卡第 5 放下方、content/text 长文卡宽≥24 且行内已有 3 单位时最右挤下；169 单列全宽 wiki ⑤旋转按钮选平板时从视口按钮旁滑出）；' +
    '修法=fluidcanvas-editor.html PRESETS 4:3（tablet{cs20,110×77}/tablet-p{cs20,77×110}/half{cs24,58×100}/169·mobile{115×100}）+computeCols preset 感知+applyPreset totalRows+旋转钮 HTML/CSS 滑出（.fc-rotate-wrap max-width 0→160px .25s 过渡+双 span fc-rot-l/fc-rot-p 声明式 i18n）+rotateTablet/tabletOrientation 草稿往返（buildDraft/applyDraft additive+旧草稿缺省 \'l\'）+autoFlowCards v2 确定性排版（组单位 bounding 比例缩/浮点 col row/mobile 组展开/content 长文 24 挤下）+markPresetCustom 全几何提交点挂载+saveCurrentPresetCards 顶部门（未动过不落盘）+deleteSelectedCard 清全预设表+clampPresetEntry 旧 115 格表钳位；' +
    'article.html pickReaderLayout 纯自动（w<768→mobile；768≤w<1280→orientation portrait?tablet-p:tablet；≥1280→169）+autoFlowEntries 与编辑器同款数学+LAYOUT_COLS/ROWS+perLayout 精确 x/y=spanPx 公式+resize/orientation change 重渲染+__slatiForceLayout 测试钩；fc-touch.js 守卫钩子 window.markPresetCustom；i18n fluidcanvas 4 新键×12 语（tablet43/rotate/landscape/portrait；旧 tablet 键×12 保留；zh-Hant 只 OpenCC）；' +
    'site-config 只加 FC 49.0 changelog 单条目（站点条目零改动）；后端零改动 npm test 366/366；ethereal.css/transitions.js/心跳零触碰；' +
    '新电池 tmp-battery-fc-rotate 36/36（S 静态+B 编辑器 CDP 12 段：切 tablet 110 格/旋转 77 格/三布局 auto-flow 精确偏移/合并组一单位/mobile 组展开/自定义落盘+门控+增删同步+旧草稿钳位+orientation 往返/C 阅读页 CDP 6 段：设备自动选四档+half 表钳位+auto-flow 同款数学+E 零异常）；舰队 633 共 53 项全绿（首跑 4 红全=sed-633 连带+计数漂移：fc-632 S1 占位锚已填真值、settings-profilecust S0a、crop S0d 裸版本注释锚、community-nodemo F1 58.26 计数 3→5——各自改锚独立复跑 31/31+28/28+27/27+30/30 销账；grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34+fc-i18n 21/21；' +
    '镜像内容验证两次构建各验一次先验后推 0 mismatch（verify#1 MODE 1 占位口径 ' + REV1.slice(0, 6) + '-XXX ×1+00351-??? ×1；verify#2 MODE 2 终态 ' + REV1 + ' 真值 ×1+' + REV1.slice(0, 6) + '-XXX 零残留）；线上探针 fc-rotate 633 10/10（S1a-e 静态+rev live 口径 ' + REV1 + ' ×1+00351-??? 占位 ×1/P1a-d CDP 切 tablet→旋转钮滑出 maxWidth 160px→点旋转 77 格→点回/E1 零异常）；' +
    'digest ' + DIGEST + '（二次烘焙镜像=当前线上）；commit 未 push；rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态（live 文本滞后一部署=惯例））**';
  const headerAnchor = '# 后端 v2 重写（SlatiControl）——当前主线\n';
  step('build-state 主线头在位', s.indexOf(headerAnchor) !== -1);
  s = s.replace(headerAnchor, headerAnchor + newHead + '\n');
  write(f, s);
  step('build-state 新 head 在位+旧 head 降级', read(f).indexOf('**当前线上 rev ' + REV2 + '（') !== -1 && read(f).indexOf('**前身 rev 00349-hgc（') !== -1 && read(f).indexOf('**当前线上 rev 00349-hgc（') === -1);
}

// ═══ ② site-versioning-scheme.md 追加 ═══
{
  const f = 'site-versioning-scheme.md';
  let s = read(f);
  const tailAnchor = '**站点号当前 v0.2.58.26；FC 当前 v10.28.48.2**。';
  step('versioning 58.26/48.2 尾指针在位', s.indexOf(tailAnchor) !== -1);
  const entry =
    '**FC v10.28.49.0（2026-10-02；站点号恒 v0.2.58.26 同轮）**：平板 4:3 视口+旋转按钮+逐设备布局——用户「那个FC 编辑器那边平板的比例是 4:3 然后横向 110 × 纵向 77 个格子 然后我希望当用户选择平板比例的时候那个视口选择按钮旁边会滑出一个旋转按钮可以点击旋转方向进行编辑，然后这些视口内这些卡片的位置在所有不同的比例或平板的方向它们的位置可以不一样，但是一定要拥有相关的卡片，就是卡片位置不需要同步但是卡片的内容那些需要同步」；' +
    '五项钦定（发布=全布局一起发阅读页按设备纯自动选/初始=系统自动排列手动动卡才落盘/增删同步所有视口/自动排列规则 mobile 全纵+组展开、tablet 2 卡+组单位、half 58 格 4 卡+content 24 挤下、169 单列/旋转钮选平板时滑出）；' +
    '修法=编辑器 PRESETS 4:3+computeCols preset 感知+rotateWrap 滑出动画+rotateTablet+tabletOrientation 草稿往返+autoFlowCards v2+markPresetCustom 门控+clampPresetEntry 旧草稿钳位；article.html pickReaderLayout 纯自动选布局+autoFlowEntries 同款+LAYOUT_COLS/ROWS+__slatiForceLayout 测试钩；fc-touch.js 守卫钩子；' +
    'i18n 4 新键×12 语（旧 tablet 键保留）；site-config 只加 FC 49.0 changelog；后端零改动 npm test 366/366；电池 fc-rotate 36/36+舰队 633 共 53 项全绿（4 红 sed 连带/计数漂移改锚销账）+冒烟 60/60+i18n 34/34+fc-i18n 21/21；验证 ×2 先验后推 0 mismatch；线上探针 fc-rotate 633 10/10；digest ' + DIGEST + '；' +
    'commit 未 push，rev ' + REV1 + '→' + REV2 + '（live 文本滞后一部署=惯例））。' +
    '**站点号当前 v0.2.58.26；FC 当前 v10.28.49.0**。';
  s = s.replace(tailAnchor, tailAnchor + entry);
  write(f, s);
  step('versioning FC 49.0 条目+新尾指针在位', read(f).indexOf('FC v10.28.49.0（2026-10-02') !== -1 && read(f).indexOf('**站点号当前 v0.2.58.26；FC 当前 v10.28.49.0**。') !== -1);
}

// ═══ ③ MEMORY.md 新行+两处当前指针 ═══
{
  const f = 'MEMORY.md';
  let s = read(f);
  const anchor26 = '](2026-10-02-v025826-fc-overview-opaque.md)\n';
  step('MEMORY.md 58.26 行在位', s.indexOf(anchor26) !== -1);
  const newLine =
    '- [2026-10-02 — FC v10.28.49.0 平板 4:3 视口+旋转按钮+逐设备布局（rev ' + REV1 + '→' + REV2 + ' commit 未 push；站点恒 58.26）：「那个FC 编辑器那边平板的比例是 4:3 然后横向 110 × 纵向 77 个格子 然后我希望当用户选择平板比例的时候那个视口选择按钮旁边会滑出一个旋转按钮可以点击旋转方向进行编辑，然后这些视口内这些卡片的位置在所有不同的比例或平板的方向它们的位置可以不一样，但是一定要拥有相关的卡片，就是卡片位置不需要同步但是卡片的内容那些需要同步」——' +
    '五项钦定（①发布=全布局一起发、阅读页按设备纯自动选无切换钮 ②初始=系统自动排列、手动动卡才落盘 markPresetCustom ③增删同步所有视口 ④自动排列：mobile 全纵+组展开/tablet 2 卡+组单位比例缩/half 58 格 4 卡第 5 放下+content 长文≥24 行内已有 3 单位最右挤下/169 单列 wiki ⑤旋转钮选平板时从视口按钮旁滑出）；' +
    '修法=编辑器 PRESETS 4:3（tablet 110×77/tablet-p 77×110/half 58/mobile·169 115×100）+computeCols preset 感知+rotateWrap max-width 0→160px .25s 滑出+rotateTablet+tabletOrientation 草稿往返+autoFlowCards v2（组单位 bounding 浮点 col row/mobile 组展开/content 24 挤下）+saveCurrentPresetCards 门控+deleteSelectedCard 清全表+clampPresetEntry 旧草稿钳位；article pickReaderLayout 纯自动（<768 mobile/768-1280 横竖 tablet 或 tablet-p/≥1280 169）+autoFlowEntries 同款数学+LAYOUT_COLS/ROWS+__slatiForceLayout 钩；fc-touch.js 守卫钩；i18n 4 新键×12 语（旧 tablet 键保留）；site-config 只加 FC 49.0 changelog；后端零改动 npm test 366/366；' +
    '电池 fc-rotate 36/36（B 编辑器 12 段+C 阅读页 6 段 CDP 精确像素）+舰队 633 共 53 项全绿（首跑 4 红全 sed-633 连带/计数漂移：fc-632 S1 占位锚填真值、settings-profilecust S0a、crop S0d 裸注释锚、community-nodemo F1 58.26 计数 3→5——独立复跑 31+28+27+30 销账）+冒烟 60/60+i18n 34/34+fc-i18n 21/21+验证 ×2 先验后推 0 mismatch+探针 fc-rotate 633 10/10；' +
    '新坑：headless Chrome --window-size=1280,900 实际 innerWidth 1258（幻影 22px 滚动条——≥1280 选 169 边界必用 Emulation.setDeviceMetricsOverride 显式宽）、spanPx(4)=86 算术（spanPx(n)=n*cs+max(0,n-1)*GAP——精确偏移断言用公式算不猜）、band-top 用 spanPx(row-1) 公式口径+art-reflow-band 顺序读 DOM 序、C7b 编辑掉行坑（改断言时 st 赋值行被误删→假红，改后查 st 定义在位）、sed 零残留伤害三件（\'v10.28.48.x\'===0 锚被翻成 49.0 恒假×2 电池+fluidcanvas 裸版本注释锚 48.x→49.0 三处）、58.26 计数漂移（新 changelog 头+体各多一次提及 3→5）、currentPreset/computeCols/tabletOrientation 不在 window（编辑器内部作用域——探针 P1 崩溃 ReferenceError，改 DOM 口径 --grid-cols 计算样式/aria-pressed/rotateWrap .show/#viewportBtnState，就绪门 window.switchPreset&&window.rotateTablet）、rotateWrap max-width 过渡时序（.show 类先到但 maxW 仍在过渡 0px——探针 waitFor computed maxWidth===\'160px\' 再断言）](2026-10-02-fc-v1028490-viewport-rotate.md)\n';
  s = s.replace(anchor26, anchor26 + newLine);
  const bbAnchor = '**当前线上 rev 00349-hgc（v0.2.58.26 FC 首页真数据+不透明卡片+FC 48.2；备份一天一次；commit 未 push）；详见 [[backend-build-state]]**';
  step('MEMORY.md build-state 指针在位', s.indexOf(bbAnchor) !== -1);
  s = s.replace(bbAnchor, '**当前线上 rev ' + REV2 + '（FC v10.28.49.0 平板 4:3 视口+旋转按钮+逐设备布局；站点恒 v0.2.58.26；commit 未 push）；详见 [[backend-build-state]]**');
  const svAnchor = '**当前：站点号 v0.2.58.26（58.26 FC 首页真数据+不透明卡片+FC 48.2 同轮；rev 00349-hgc；commit 未 push）、FC v10.28.48.2（48.2 FC 首页真数据+不透明卡片同轮；rev 00349-hgc；commit 未 push）**';
  step('MEMORY.md versioning 指针在位', s.indexOf(svAnchor) !== -1);
  s = s.replace(svAnchor, '**当前：站点号 v0.2.58.26（58.26 FC 首页真数据+不透明卡片+FC 48.2 同轮；rev 00349-hgc；commit 未 push）、FC v10.28.49.0（49.0 平板 4:3 视口+旋转按钮+逐设备布局同轮；rev ' + REV2 + '；commit 未 push）**');
  write(f, s);
  const s2 = read(f);
  step('MEMORY.md 三处全部落位', s2.indexOf('2026-10-02-fc-v1028490-viewport-rotate.md') !== -1 && s2.indexOf('当前线上 rev ' + REV2 + '（FC v10.28.49.0') !== -1 && s2.indexOf('FC v10.28.49.0（49.0 平板 4:3 视口') !== -1);
}

// ═══ ④ 新记忆文件 ═══
{
  const f = '2026-10-02-fc-v1028490-viewport-rotate.md';
  const body =
    '---\n' +
    'name: 2026-10-02-fc-v1028490-viewport-rotate\n' +
    'description: FC v10.28.49.0 平板 4:3 视口+旋转按钮+逐设备布局轮（rev ' + REV1 + '→' + REV2 + ' 未 push；站点恒 v0.2.58.26）——PRESETS 4:3 110×77/77×110、旋转钮滑出、autoFlowCards v2 确定性自动排版、markPresetCustom 门控、article 按设备纯自动选布局；五项钦定全文；电池 36/36+舰队 53 项+探针 10/10；验证全链数值与新坑\n' +
    'metadata:\n' +
    '  type: project\n' +
    '---\n\n' +
    '# FC v10.28.49.0 — 平板 4:3 视口+旋转按钮+逐设备布局（2026-10-02）\n\n' +
    '用户「那个FC 编辑器那边平板的比例是 4:3 然后横向 110 × 纵向 77 个格子 然后我希望当用户选择平板比例的时候那个视口选择按钮旁边会滑出一个旋转按钮可以点击旋转方向进行编辑，然后这些视口内这些卡片的位置在所有不同的比例或平板的方向它们的位置可以不一样，但是一定要拥有相关的卡片，就是卡片位置不需要同步但是卡片的内容那些需要同步」。\n\n' +
    '**五项钦定**（AskUserQuestion）：\n' +
    '1. 发布侧=「这些视口是用于不同设备看到的样子不影响其他功能，发布的时候就是全部一起发布」——所有布局一起发；阅读页按读者设备自动选布局（纯自动，无手动切换钮）；编辑页 ?article= 查看模式零改动。\n' +
    '2. 初始位置=系统自动排列（确定性），手动动过卡才落盘转自定义（markPresetCustom 门控）。\n' +
    '3. 增删同步所有视口（仅位置各异）。\n' +
    '4. 自动排列规则：mobile=全部纵向每卡一行全宽+合并组内容纵向排列（组展开成员流）；tablet/tablet-p=横向最多 2 卡、合并组=一单位（比例缩放）；half=115 格砍半 58 格、一排最多 4 卡第 5 放下方、content/text 长文卡宽≥24 且行内已有 3 单位时最右挤下；169=单列全宽 wiki。\n' +
    '5. 旋转按钮：选平板比例时从视口按钮旁滑出，点击切换横/竖方向编辑。\n\n' +
    '**修法**：\n' +
    '- 编辑器 fluidcanvas-editor.html：PRESETS 4:3（tablet{cs20,110×77}/tablet-p{cs20,77×110}/half{cs24,58×100}/169·mobile{cs20|18,115×100}）；computeCols preset 感知；applyPreset totalRows；画布宽 169·mobile 2528/half 1506/tablet 2418/tablet-p 1692。\n' +
    '- 旋转钮：#rotateWrap 包 #rotateBtn（screen_rotation）插在视口按钮旁；CSS max-width 0→160px .25s 过渡+opacity；双 span fc-rot-l/fc-rot-p 声明式 i18n（landscape/portrait 标签零 JS 管理）；rotateTablet() tablet↔tablet-p；aria-pressed 状态。\n' +
    '- autoFlowCards v2：单位=无 groupId 单卡或同 groupId 组（bounding 比例缩、成员相对偏移保持、浮点 col/row）；mobile 组展开；half content 长文 24 挤下；169 单列。\n' +
    '- 门控链：markPresetCustom 挂全部几何提交点（拖拽/resize/旋转/merge/split/资产创建）→saveCurrentPresetCards 顶部门未 custom 不落盘→deleteSelectedCard 清全部预设表（空则 custom=false）→clampPresetEntry 旧 115 格表钳位 110/77/58。\n' +
    '- 草稿往返 additive：buildDraft 加 tabletOrientation（\'l\'|\'p\'，旧草稿缺省 \'l\'）+presets 自动携带 tablet-p 桶；applyDraft 恢复后再 applyPreset。\n' +
    '- 阅读页 article.html：pickReaderLayout（w<768→mobile；768≤w<1280→orientation portrait?tablet-p:tablet；≥1280→169）；perLayout 分支 autoFlowEntries 与编辑器同款数学；x/y=spanPx 公式（宽恒 spanPx(colSpan)，card.w 是活动预设精确宽 perLayout 必弃）；stage LAYOUT_COLS/ROWS+25；resize+orientation change 重渲染；__slatiForceLayout 测试钩（CDP override 下 matchMedia 不翻转的兜底）。\n' +
    '- fc-touch.js 守卫钩子（window.markPresetCustom 缺席零操作）；i18n fluidcanvas 4 新键×12 语（tablet43/rotate/landscape/portrait；旧 tablet 键×12 保留零消费者；zh-Hant 只 OpenCC）；site-config 只加 FC 49.0 changelog（站点条目零改动）；后端零改动；ethereal.css/transitions.js/心跳零触碰。\n\n' +
    '**验证全链**：新电池 tmp-battery-fc-rotate 36/36（S 静态+B1-B12 编辑器 CDP：默认 169/切 tablet 110 格+滑出/旋转 77 格/三布局 auto-flow 精确像素（spanPx 公式）/合并组一单位/mobile 组展开/自定义落盘+门控+增删同步+旧草稿钳位+orientation 往返/C1-C6 阅读页 CDP：四档设备自动选+half 表钳位+auto-flow 同款数学/E 零异常）→舰队 633 共 53 项全绿（首跑 4 红全=sed-633 连带+计数漂移：fc-632 S1 占位锚已填真值、settings-profilecust S0a、crop S0d 裸版本注释锚、community-nodemo F1 58.26 计数 3→5——各自改锚独立复跑 31/31+28/28+27/27+30/30 销账；grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34+fc-i18n 21/21+npm test 366/366｜镜像验证两次构建各验一次先验后推 0 mismatch（verify#1 MODE 1 占位 ' + REV1.slice(0, 6) + '-XXX ×1+00351-??? ×1；verify#2 MODE 2 终态 ' + REV1 + ' 真值 ×1+占位零残留）｜线上探针 fc-rotate 633 10/10（S1a site-config 49.0/48.2 条目保留+58.26 在位/S1b rev live 口径 ' + REV1 + ' ×1+00351-??? 占位 ×1+00351-5mm 零残留/S1c 编辑器 21 锚/S1d article 10 锚/S1e i18n 4 键×12/P1a-d CDP 切 tablet 110→旋转钮滑出 maxWidth 160px→点旋转 77 格 aria-pressed→点回/E1 零异常）。\n' +
    'digest ' + DIGEST + '（二次烘焙=当前线上）。rev ' + REV1 + ' 瞬态→' + REV2 + ' 终态。\n\n' +
    '**新坑**：\n' +
    '1. headless Chrome --window-size=1280,900 实际 innerWidth=1258（幻影 22px 滚动条）——≥1280 选 169 边界测试必用 Emulation.setDeviceMetricsOverride 显式宽度（override 下 innerWidth 精确等于设定值）。\n' +
    '2. spanPx(4)=86 算术：spanPx(n)=n*cs+max(0,n-1)*GAP（cs20 时 4 卡=4*20+3*2=86）——auto-flow 精确像素断言（left/top/宽）全用公式算不猜。\n' +
    '3. band-top 测量：.art-reflow-band 顶距断言用 spanPx(row-1) 公式口径；band 顺序读 DOM 序而非视觉序。\n' +
    '4. C7b 编辑掉行坑：改写断言时 st 读数行被误删→假红——改断言后先 grep st 赋值在位。\n' +
    '5. sed 零残留伤害三件：①\'v10.28.48.x\'===0 零残留锚被翻成 \'v10.28.49.0\'===0 恒假（fc-632 S1/settings-profilecust S0a 两电池）②fluidcanvas.html 裸版本注释锚 48.x→49.0 三处（crop S0d 3/4/2 计数全 0）——sed 只该扫 tmp-battery-*.js 且改前统计带引号正断言族+裸注释族两类伤害面。\n' +
    '6. 58.26 计数漂移：新 changelog 条目头+体各多一次版本号提及（community-nodemo F1 3→5）——加 changelog 前实测受影响计数锚。\n' +
    '7. currentPreset/computeCols/tabletOrientation 不在 window（编辑器内部作用域）——探针 P1 崩溃 ReferenceError；DOM 口径：--grid-cols/--cell-size 计算样式、rotateBtn aria-pressed、rotateWrap .show、#viewportBtnState textContent；就绪门 window.switchPreset&&window.rotateTablet。\n' +
    '8. rotateWrap max-width 过渡时序：.show 类先到位但 maxW 仍在过渡（读到 0px/opacity 0）——探针 waitFor computed maxWidth===\'160px\' 再断言（电池同款）。\n\n' +
    '关联：[[backend-build-state]]、[[site-versioning-scheme]]、[[2026-10-02-v025826-fc-overview-opaque]]、[[2026-09-21-fc-v102839-viewport]]、[[2026-09-25-fc-v1028430-tablet]]';
  write(f, body);
  step('新记忆文件落盘', read(f).indexOf('FC v10.28.49.0 — 平板 4:3 视口') !== -1);
}

console.log('\n记忆仪式完成：' + steps + ' 步');
