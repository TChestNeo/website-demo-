// tmp-update-memory-pbgmeta.js — v0.2.38.0 上传图片信息弹窗收尾锚点：
// build-state head（00208-nzm → 00209-fd4）+ scheme 链尾 v0.2.38.0 + MEMORY.md 双指针
// 本轮额外：MEMORY.md 两条巨型索引行精简（per-round 链细节留在 topic 文件——已验证两文件
// 含完整链与稳定简介；索引只留指针+稳定简介+当前 rev 摘要）解决 24.7KB 超限
'use strict';
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

const BS_ENTRY = '**当前线上 rev 00209-fd4（2026-09-13 v0.2.38.0 上传图片信息弹窗（名称/描述/可见性）——用户「在上传自己的图片的时候都有一个弹窗右上角显示图片同行左侧显示图片名称，下方是详细信息Description…可以设定Public/Private/Team…Description不要是那种可以调整长度的我要固定长度的，字数限制320字…追踪那个词（不是单纯的"code"占四个，"code"是一个字）」：单一共享 #imgMetaModal 8 入口全接（页面背景/国旗国徽/卡背景/名称背景/旧背景/内联图/头像/地图）——读图后先弹窗保存才落地、取消=图不落地且宿主弹窗保持打开（比现状更好）；右上角预览图与名称同行左侧名称、Description resize:none 固定高+live 计数「N / 320」按空格分词（code=1、你好世界=1、我的 code 很好=3）+超限红字+保存拦截 toast（不硬截断避 IME）；可见性 Public/Private/Team 默认 Private（无真实团队功能，仅标记存储）；同 z 110 DOM 后者在上叠弹窗（可叠 pageBgModal）+closeModalOnly/closeTopModal 只关顶层（backdrop 改 closeTopModal，单弹窗与 closeAllModals 等价）+Escape isComposing 守卫（保存不绑 Enter 避 IME）；草稿 additive（v 保持 9）：pageBg imgs[i] 三字段（只改 pbgDeepCopy 拷贝）、卡图 imgMeta、卡背景 cardBgMeta、标题背景 captionBgMeta、头像 charAvatarMeta、地图 mapImgMeta、内联图 data-img-* 属性 innerHTML 往返零字段（legacy 兜底空名/空描述/Private）；getCardFingerprint 补元数据签名（desc 变更也触发 autosave）；renderPbgList 名称行 esc() 五转义防注入+编辑钮 pbgEditImageMeta 回填；FC v10.28.28.0（小更新位 27→28·新功能轮·补丁归零）；电池 pbg-meta 38/38（F1-F7+S1-S13+Z，含 321 词拦截、叠层关闭语义 S11a-d、autosave 落草稿、草稿往返、IME 守卫）+ 线上电池 PASS（上传→meta→保存→刷新恢复；flag 双窗关+三 dataset+label=名称；内联图 data-*；取消宿主窗保持）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00209-fd4）；commit 697499c 未 push；每轮 rev 全量链见 [[backend-build-state]]）**；前身 rev 00208-nzm（';

const SCHEME_ENTRY_TAIL = '；2026-09-13 v0.2.38.0 = 上传图片信息弹窗（名称/描述/可见性——小改动位 37→38·新功能轮·补丁归零——用户「在上传自己的图片的时候都有一个弹窗右上角显示图片同行左侧显示图片名称，下方是详细信息Description…可以设定Public/Private/Team…Description固定长度…字数限制320字…追踪那个词（"code"是一个字不是四个）」：单一共享 #imgMetaModal 8 入口全接（页面背景/国旗国徽/卡背景/名称背景/旧背景/内联图/头像/地图）——读图后先弹窗保存才落地、取消=图不落地且宿主弹窗保持；右上角预览同行左名称+Description resize:none 固定高+live 计数「N / 320」按空格分词（code=1、你好世界=1）+超限红字+保存拦截 toast；可见性 Public/Private/Team 默认 Private（仅标记存储）；叠层只关顶层（closeModalOnly/closeTopModal+backdrop closeTopModal+Escape isComposing 守卫）；草稿 additive（v 保持 9）五 meta 字段（pageBg imgs[i] 三字段/imgMeta/cardBgMeta/captionBgMeta/charAvatarMeta/mapImgMeta）+内联图 data-img-* 属性零字段（legacy 兜底空名/空描述/Private）；getCardFingerprint 补元数据签名（desc 变更也触发 autosave）；renderPbgList 名称行 esc() 防注入+编辑钮回填；FC v10.28.28.0（小更新位 27→28）；电池 pbg-meta 38/38 + 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00209-fd4）；commit 697499c 未 push）';

// MEMORY.md 精简后两行：稳定简介保留 + 当前 rev 紧凑摘要 + 指针（per-round 链只在 topic 文件）
const L9_NEW = '- [后端 v2 重写（SlatiControl）W0-W2+W6 ✅ Cloud Run 加固版已上线（均不 push）：测试 200/200 + smoke-admin 49/49 常驻冒烟（`node backend-v2/scripts/smoke-admin.js`，自建临时库+静态代理同源拓扑+Chrome CDP）；W6（08-28）= 密码+邮箱码双因素（scrypt、迁移 011、verify 三段码→密码→消费、新注册强制密码 ≥8、旧账号首登设密引导）；production 姿态：microcountry2677@gmail.com 密码+邮件码、发信=站务 Gmail slati.official@gmail.com（应用密码）、691032 已作废（救急=NODE_ENV 改 development 重部署）、只留 director Neo；gen2+GCS FUSE 桶 gs://mn-backend-data-641398703651 快照持久化（每实例 snap.<bootId> 防互踩+恢复 mtime 最新+60s 间隔；正式发布换 Cloud SQL）；deploy 链（deploy/cloudrun.md）：docker build（静默失败看 exit code）→ tag → token 直登（docker login 三坑：空 auths 条目盖过 credsStore/PS5.1 Set-Content BOM/管道换行→-p 直传）→ push → gcloud.ps1 run deploy mnationworld-web（完整 env+卷，逗号参数必加引号——09-05 又犯 --add-volume 漏引号（同晚再犯 --add-volume-mount 漏引号）；执行前重读 cloudrun.md）；**当前线上 rev 00209-fd4（2026-09-13 v0.2.38.0 上传图片信息弹窗（名称/描述/可见性）——单一 #imgMetaModal 8 入口全接、320 词空格分词硬限+固定 Description、Public/Private/Team 标记；FC v10.28.28.0；电池 38/38+线上电池 PASS；部署一次 exit 0；commit 697499c 未 push）**；W3-W5 待做；每轮 rev 全量链见 [[backend-build-state]]](backend-build-state.md)';

const L11_NEW = '- [侧栏版本号口径：大版本.小版本.小改动.补丁（用户钦定），版本单一来源 site-config.js，改版本只动一处；两条独立线——站点号仅侧栏品牌模块、FC 四段线在 FC 头部+编辑器 badge；进位规则+每轮版本/commit/轮型全量链见 [[site-versioning-scheme]]；站点号当前 **v0.2.38.0**（2026-09-13 上传图片信息弹窗——小改动位 37→38 新功能轮·补丁归零；FC v10.28.28.0（小更新位 27→28）；电池 38/38 + 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00209-fd4）；commit 697499c 未 push）](site-versioning-scheme.md)';

// —— 1. backend-build-state.md head：00208-nzm → 00209-fd4 ——
{
  const p = M + '/backend-build-state.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('rev 00209-fd4（') !== -1) { console.log('ℹ build-state 已含 00209-fd4，跳过'); }
  else {
    const anchor = '**当前线上 rev 00208-nzm（';
    const n = s.split(anchor).length - 1;
    if (n !== 1) { console.log('❌ build-state anchor count wrong: ' + n); process.exit(1); }
    s = s.replace(anchor, BS_ENTRY);
    fs.writeFileSync(p, s);
    console.log('✅ backend-build-state.md updated（00209-fd4 计数 ' + (s.split('00209-fd4').length - 1) + '）');
  }
}

// —— 2. site-versioning-scheme.md 链尾：v0.2.37.0 条目后插 v0.2.38.0 ——
{
  const p = M + '/site-versioning-scheme.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.split('v0.2.38.0 = ').length > 1) { console.log('ℹ scheme 已含 v0.2.38.0 条目，跳过'); }
  else {
    const anchor = 'commit 5056473 未 push）';
    const n = s.split(anchor).length - 1;
    if (n !== 1) { console.log('❌ scheme anchor count wrong: ' + n); process.exit(1); }
    s = s.replace(anchor, anchor + SCHEME_ENTRY_TAIL);
    fs.writeFileSync(p, s);
    console.log('✅ site-versioning-scheme.md updated（v0.2.38.0 计数 ' + (s.split('v0.2.38.0').length - 1) + '）');
  }
}

// —— 3. MEMORY.md 双指针 + 两条巨型行精简 ——
{
  const p = M + '/MEMORY.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('rev 00209-fd4（') !== -1) { console.log('ℹ MEMORY.md 已含 00209-fd4，跳过'); }
  else {
    const before = Buffer.byteLength(s, 'utf8');
    const r9 = /- \[后端 v2 重写（SlatiControl）[^\n]*?\]\(backend-build-state\.md\)/;
    if (!r9.test(s)) { console.log('❌ MEMORY.md L9 pattern not found'); process.exit(1); }
    s = s.replace(r9, L9_NEW);
    const r11 = /- \[侧栏版本号口径[^\n]*?\]\(site-versioning-scheme\.md\)/;
    if (!r11.test(s)) { console.log('❌ MEMORY.md L11 pattern not found'); process.exit(1); }
    s = s.replace(r11, L11_NEW);
    fs.writeFileSync(p, s);
    const after = Buffer.byteLength(s, 'utf8');
    console.log('✅ MEMORY.md updated（' + (before / 1024).toFixed(1) + 'KB → ' + (after / 1024).toFixed(1) + 'KB）');
  }
}

// —— 4. ** 平衡校验（三文件）——
{
  const files = ['MEMORY.md', 'backend-build-state.md', 'site-versioning-scheme.md'];
  let ok = true;
  for (const f of files) {
    const s = fs.readFileSync(M + '/' + f, 'utf8');
    const open = (s.match(/\*\*/g) || []).length;
    const good = open % 2 === 0;
    console.log((good ? '✅ ' : '❌ ') + f + ' ** ' + (good ? '平衡（' : '不平衡: ') + open + ' 个）');
    if (!good) ok = false;
  }
  if (!ok) process.exit(1);
}
