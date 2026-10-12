// tmp-update-memory-imglib2.js — v0.2.39.1 样本国旗全撤收尾锚点：
// build-state head（00210-xr4 → 00211-wcr）+ scheme 链尾 v0.2.39.1 + MEMORY.md 双指针
// （模板=tmp-update-memory-imglib.js：结构断言+** 平衡三文件；计数按真实文本口径）
'use strict';
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

const BS_ENTRY = '**当前线上 rev 00211-wcr（2026-09-13 v0.2.39.1 样本国旗全撤——用户「能不能把那些用来做样本的图片国旗去掉？」：SEED_FLAGS（12 内置条纹旗）+MY_FLAGS（3 假「我的旗」）两数组整体移除（数据彻底删、seed 分支全清除），FC_FLAG_LIBRARY=[] 保留为将来真库接口、applyFlagToCard 导出保留兼容、renderLibTiles 循环保留零渲染；图库「全部/我的图库」两页签同源=仅用户上传（全部=将来平台共享图的位置，页签结构保留）；confirmFlagSelection/filterFlags/renderFlagGrid 的 seed 分支清除、空态文案统一「还没有上传过图片——…」；tt-img-pop 头部「国旗库」→「图片」、样本国旗格零渲染（仅上传格+网页搜索）；FC v10.28.29.1（补丁位 0→1·纯改动轮）；电池 img-library 42/42（新增 S12 tt-img-pop 零样本旗）+线上电池 PASS（含新第 0 步线上全部页签零格）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0；commit 499f6d2 未 push）**；前身 rev 00210-xr4（';

const SCHEME_ENTRY_TAIL = '；2026-09-13 v0.2.39.1 = 样本国旗全撤（用户「能不能把那些用来做样本的图片国旗去掉？」——补丁位 0→1·纯改动轮）：SEED_FLAGS 12 内置条纹旗 + MY_FLAGS 3 假「我的旗」两数组整体移除；图库「全部/我的图库」两页签同源=仅用户上传（页签结构保留、全部=将来平台共享图的位置）；confirmFlagSelection/filterFlags/renderFlagGrid 的 seed 分支清除、空态文案统一；tt-img-pop 头部「国旗库」→「图片」零样本旗格（仅上传格+网页搜索）；FC_FLAG_LIBRARY=[] 保留为将来真库接口、applyFlagToCard 导出保留；FC v10.28.29.1（补丁位 0→1）；电池 img-library 42/42 + 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00211-wcr）；commit 499f6d2 未 push）';

// MEMORY.md 双指针行：稳定简介保留 + 当前 rev 紧凑摘要 + 指针（per-round 链只在 topic 文件）
const L9_NEW = '- [后端 v2 重写（SlatiControl）W0-W2+W6 ✅ Cloud Run 加固版已上线（均不 push）：测试 200/200 + smoke-admin 49/49 常驻冒烟（`node backend-v2/scripts/smoke-admin.js`，自建临时库+静态代理同源拓扑+Chrome CDP）；W6（08-28）= 密码+邮箱码双因素（scrypt、迁移 011、verify 三段码→密码→消费、新注册强制密码 ≥8、旧账号首登设密引导）；production 姿态：microcountry2677@gmail.com 密码+邮件码、发信=站务 Gmail slati.official@gmail.com（应用密码）、691032 已作废（救急=NODE_ENV 改 development 重部署）、只留 director Neo；gen2+GCS FUSE 桶 gs://mn-backend-data-641398703651 快照持久化（每实例 snap.<bootId> 防互踩+恢复 mtime 最新+60s 间隔；正式发布换 Cloud SQL）；deploy 链（deploy/cloudrun.md）：docker build（静默失败看 exit code）→ tag → token 直登（docker login 三坑：空 auths 条目盖过 credsStore/PS5.1 Set-Content BOM/管道换行→-p 直传）→ push → gcloud.ps1 run deploy mnationworld-web（完整 env+卷，逗号参数必加引号——09-05 又犯 --add-volume 漏引号（同晚再犯 --add-volume-mount 漏引号）；执行前重读 cloudrun.md）；**当前线上 rev 00211-wcr（2026-09-13 v0.2.39.1 样本国旗全撤——用户「能不能把那些用来做样本的图片国旗去掉？」：SEED_FLAGS 12 内置旗+MY_FLAGS 3 假旗两数组移除、图库两页签同源=仅用户上传（页签保留）、tt-img-pop「国旗库」→「图片」零样本旗、FC_FLAG_LIBRARY=[] 留作真库接口；FC v10.28.29.1；电池 42/42+线上电池 PASS；部署一次 exit 0；commit 499f6d2 未 push）**；W3-W5 待做；每轮 rev 全量链见 [[backend-build-state]]](backend-build-state.md)';

const L11_NEW = '- [侧栏版本号口径：大版本.小版本.小改动.补丁（用户钦定），版本单一来源 site-config.js，改版本只动一处；两条独立线——站点号仅侧栏品牌模块、FC 四段线在 FC 头部+编辑器 badge；进位规则+每轮版本/commit/轮型全量链见 [[site-versioning-scheme]]；站点号当前 **v0.2.39.1**（2026-09-13 样本国旗全撤——补丁位 0→1 纯改动轮；FC v10.28.29.1（补丁位 0→1）；电池 42/42 + 线上电池 PASS；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00211-wcr）；commit 499f6d2 未 push）](site-versioning-scheme.md)';

// —— 1. backend-build-state.md head：00210-xr4 → 00211-wcr ——
{
  const p = M + '/backend-build-state.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('rev 00211-wcr（') !== -1) { console.log('ℹ build-state 已含 00211-wcr，跳过'); }
  else {
    const anchor = '**当前线上 rev 00210-xr4（';
    const n = s.split(anchor).length - 1;
    if (n !== 1) { console.log('❌ build-state anchor count wrong: ' + n); process.exit(1); }
    s = s.replace(anchor, BS_ENTRY);
    fs.writeFileSync(p, s);
    const s2 = fs.readFileSync(p, 'utf8');
    const head = s2.split('**当前线上 rev 00211-wcr（').length - 1;
    const prev = s2.split('）**；前身 rev 00210-xr4（').length - 1;
    const total = s2.split('rev 00211-wcr').length - 1;
    if (head !== 1 || prev !== 1 || total !== 1) { console.log('❌ build-state 结构断言失败: ' + JSON.stringify({ head, prev, total })); process.exit(1); }
    console.log('✅ backend-build-state.md updated（00211-wcr 结构断言 head=' + head + ' prev=' + prev + ' total=' + total + '）');
  }
}

// —— 2. site-versioning-scheme.md 链尾：v0.2.39.0 条目后插 v0.2.39.1 ——
{
  const p = M + '/site-versioning-scheme.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.split('v0.2.39.1 = ').length > 1) { console.log('ℹ scheme 已含 v0.2.39.1 条目，跳过'); }
  else {
    const anchor = 'commit d5a5e67 未 push）';
    const n = s.split(anchor).length - 1;
    if (n !== 1) { console.log('❌ scheme anchor count wrong: ' + n); process.exit(1); }
    s = s.replace(anchor, anchor + SCHEME_ENTRY_TAIL);
    fs.writeFileSync(p, s);
    console.log('✅ site-versioning-scheme.md updated（v0.2.39.1 计数 ' + (s.split('v0.2.39.1').length - 1) + '）');
  }
}

// —— 3. MEMORY.md 双指针 ——
{
  const p = M + '/MEMORY.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('rev 00211-wcr（') !== -1) { console.log('ℹ MEMORY.md 已含 00211-wcr，跳过'); }
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
    // 真实文本口径：L9 行 1 处（rev 00211-wcr）+ L11 行 1 处（（00211-wcr））= 共 2 处 00211-wcr
    const cnt = s.split('00211-wcr').length - 1;
    if (cnt !== 2) { console.log('❌ MEMORY.md 00211-wcr 计数 wrong: ' + cnt); process.exit(1); }
    console.log('✅ MEMORY.md updated（' + (before / 1024).toFixed(1) + 'KB → ' + (after / 1024).toFixed(1) + 'KB，00211-wcr 计数 ' + cnt + '）');
  }
}

// —— 4. ** 平衡校验（MEMORY.md + scheme；build-state 按文件内校验说明不适用奇偶，结构断言在 §1）——
{
  const files = ['MEMORY.md', 'site-versioning-scheme.md'];
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
