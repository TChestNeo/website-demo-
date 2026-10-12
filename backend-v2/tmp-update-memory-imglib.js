// tmp-update-memory-imglib.js — v0.2.39.0 我的图库收尾锚点：
// build-state head（00209-fd4 → 00210-xr4）+ scheme 链尾 v0.2.39.0 + MEMORY.md 双指针
// （模板=tm p-update-memory-pbgmeta.js：结构断言+** 平衡三文件）
'use strict';
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

const BS_ENTRY = '**当前线上 rev 00210-xr4（2026-09-13 v0.2.39.0 我的图库（上传图进「Search within the platform」可搜可用可管理）——用户「那个上传后可以在平台的上图像搜索那边搜索到对吗」→「肯定是要做的」+三问钦定（入口=添加图片弹窗 Search within the platform 顶部菜单左「全部」右「我的图库」；点图=就是添加图片、图片右上角铅笔编辑icon编辑图片信息但只能编辑自己上传的别人的不能编辑；管理=全部：浏览+搜索+插入+编辑+删除）：图库=纯派生视图（零草稿 schema 改动 v 保持 9、零 fingerprint 改动）；统一键=dataURL 同图多处用=一格、编辑/删除按 dataURL 同步所有使用处；7 类来源扫描（页面背景 WORKING||STATE+卡图+卡背景+标题背景+头像+地图+内联图 data-img-*）；全部页签=12 内置旗（条纹零图标=别人的不可编辑）+我的上传、我的图库=仅上传（硬编码假 MY_FLAGS 退出浏览器，FC_FLAG_LIBRARY 不动）；lib tile=缩略图+可见性徽章（Public/Private/Team）+铅笔/垃圾桶（title 提示），名称/描述 esc() 防注入、dataURL 只进属性不进 onclick；搜索按名称+描述过滤；点格确认=setCardImage+label=名称+三 dataset+全关+toast；铅笔=openImgMetaModal 叠 browser（同 z DOM 后者在上）close:\'self\' 只关 meta、Escape/backdrop 只关顶层既有链路零改动；删除=原生 confirm 报使用数「正用在 N 处」+7 类默认态逐类还原（卡图/卡背景/标题背景/头像/地图/页面背景 WORKING 走 pbgRemoveImage 口径、STATE 走 closePageBgModal 提交路径）+内联图 richFieldSync；真 bug 修复：pageBgModal 整页预览克隆（#pbgCloneWrap）modal 关闭后持久在 DOM 持内联图副本、全局 query 虚增使用数（2 实+2 克隆=4 处）→四处图库查询改 gridCanvas 口径（同 getAllCards，克隆副本下次开窗重建不在这里动）；FC v10.28.29.0（小更新位 28→29·新功能轮·补丁归零）；电池 img-library 41/41（F1-F5+S1-S11+Z，含 S8a-bis 克隆回归钉）+线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00210-xr4）；commit d5a5e67 未 push；每轮 rev 全量链见 [[backend-build-state]]）**；前身 rev 00209-fd4（';

const SCHEME_ENTRY_TAIL = '；2026-09-13 v0.2.39.0 = 我的图库（上传图进「Search within the platform」可搜可用可管理——小改动位 38→39·新功能轮·补丁归零——用户「那个上传后可以在平台的上图像搜索那边搜索到对吗」→「肯定是要做的」+三问钦定：入口=添加图片弹窗顶部菜单左「全部」右「我的图库」；点图=添加图片、右上角铅笔只可编辑自己上传的；管理=全部）：图库=纯派生视图（零草稿 schema v 保持 9、零 fingerprint 改动）；统一键=dataURL 同图多处用=一格、编辑/删除同步所有使用处；7 类来源扫描（页面背景+卡图+卡背景+标题背景+头像+地图+内联图）；全部=12 内置旗零图标+我的上传、我的图库=仅上传（假 MY_FLAGS 退出浏览器）；搜索名称+描述；点格确认=setCardImage+三 dataset；铅笔=openImgMetaModal 叠层 close:\'self\'；删除=confirm 报使用数+逐类默认态还原；真 bug：pageBgModal 预览克隆持久在 DOM 全局 query 虚增使用数→gridCanvas 口径；FC v10.28.29.0（小更新位 28→29·新功能轮·补丁归零）；电池 img-library 41/41 + 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00210-xr4）；commit d5a5e67 未 push）';

// MEMORY.md 双指针行：稳定简介保留 + 当前 rev 紧凑摘要 + 指针（per-round 链只在 topic 文件）
const L9_NEW = '- [后端 v2 重写（SlatiControl）W0-W2+W6 ✅ Cloud Run 加固版已上线（均不 push）：测试 200/200 + smoke-admin 49/49 常驻冒烟（`node backend-v2/scripts/smoke-admin.js`，自建临时库+静态代理同源拓扑+Chrome CDP）；W6（08-28）= 密码+邮箱码双因素（scrypt、迁移 011、verify 三段码→密码→消费、新注册强制密码 ≥8、旧账号首登设密引导）；production 姿态：microcountry2677@gmail.com 密码+邮件码、发信=站务 Gmail slati.official@gmail.com（应用密码）、691032 已作废（救急=NODE_ENV 改 development 重部署）、只留 director Neo；gen2+GCS FUSE 桶 gs://mn-backend-data-641398703651 快照持久化（每实例 snap.<bootId> 防互踩+恢复 mtime 最新+60s 间隔；正式发布换 Cloud SQL）；deploy 链（deploy/cloudrun.md）：docker build（静默失败看 exit code）→ tag → token 直登（docker login 三坑：空 auths 条目盖过 credsStore/PS5.1 Set-Content BOM/管道换行→-p 直传）→ push → gcloud.ps1 run deploy mnationworld-web（完整 env+卷，逗号参数必加引号——09-05 又犯 --add-volume 漏引号（同晚再犯 --add-volume-mount 漏引号）；执行前重读 cloudrun.md）；**当前线上 rev 00210-xr4（2026-09-13 v0.2.39.0 我的图库——上传图进「Search within the platform」可搜可用可管理：图库=纯派生视图零草稿改动、dataURL 统一键同图多处=一格、全部=内置旗+我的上传/我的图库=仅上传、铅笔编辑+垃圾桶删除同步所有使用处、页面背景预览克隆虚增使用数真 bug 修复 gridCanvas 口径；FC v10.28.29.0；电池 41/41+线上电池 PASS；部署一次 exit 0；commit d5a5e67 未 push）**；W3-W5 待做；每轮 rev 全量链见 [[backend-build-state]]](backend-build-state.md)';

const L11_NEW = '- [侧栏版本号口径：大版本.小版本.小改动.补丁（用户钦定），版本单一来源 site-config.js，改版本只动一处；两条独立线——站点号仅侧栏品牌模块、FC 四段线在 FC 头部+编辑器 badge；进位规则+每轮版本/commit/轮型全量链见 [[site-versioning-scheme]]；站点号当前 **v0.2.39.0**（2026-09-13 我的图库——小改动位 38→39 新功能轮·补丁归零；FC v10.28.29.0（小更新位 28→29）；电池 41/41 + 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00210-xr4）；commit d5a5e67 未 push）](site-versioning-scheme.md)';

// —— 1. backend-build-state.md head：00209-fd4 → 00210-xr4 ——
{
  const p = M + '/backend-build-state.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('rev 00210-xr4（') !== -1) { console.log('ℹ build-state 已含 00210-xr4，跳过'); }
  else {
    const anchor = '**当前线上 rev 00209-fd4（';
    const n = s.split(anchor).length - 1;
    if (n !== 1) { console.log('❌ build-state anchor count wrong: ' + n); process.exit(1); }
    s = s.replace(anchor, BS_ENTRY);
    fs.writeFileSync(p, s);
    // 结构断言：新 head 开头一次、结尾 前身 锚点一次、总出现数 1
    const s2 = fs.readFileSync(p, 'utf8');
    const head = s2.split('**当前线上 rev 00210-xr4（').length - 1;
    const prev = s2.split('）**；前身 rev 00209-fd4（').length - 1;
    const total = s2.split('rev 00210-xr4').length - 1;
    if (head !== 1 || prev !== 1 || total !== 1) { console.log('❌ build-state 结构断言失败: ' + JSON.stringify({ head, prev, total })); process.exit(1); }
    console.log('✅ backend-build-state.md updated（00210-xr4 结构断言 head=' + head + ' prev=' + prev + ' total=' + total + '）');
  }
}

// —— 2. site-versioning-scheme.md 链尾：v0.2.38.0 条目后插 v0.2.39.0 ——
{
  const p = M + '/site-versioning-scheme.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.split('v0.2.39.0 = ').length > 1) { console.log('ℹ scheme 已含 v0.2.39.0 条目，跳过'); }
  else {
    const anchor = 'commit 697499c 未 push）';
    const n = s.split(anchor).length - 1;
    if (n !== 1) { console.log('❌ scheme anchor count wrong: ' + n); process.exit(1); }
    s = s.replace(anchor, anchor + SCHEME_ENTRY_TAIL);
    fs.writeFileSync(p, s);
    console.log('✅ site-versioning-scheme.md updated（v0.2.39.0 计数 ' + (s.split('v0.2.39.0').length - 1) + '）');
  }
}

// —— 3. MEMORY.md 双指针 ——
{
  const p = M + '/MEMORY.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('rev 00210-xr4（') !== -1) { console.log('ℹ MEMORY.md 已含 00210-xr4，跳过'); }
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
    const cnt = s.split('rev 00210-xr4').length - 1;
    if (cnt !== 2) { console.log('❌ MEMORY.md rev 计数 wrong: ' + cnt); process.exit(1); }
    console.log('✅ MEMORY.md updated（' + (before / 1024).toFixed(1) + 'KB → ' + (after / 1024).toFixed(1) + 'KB，rev 计数 ' + cnt + '）');
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
