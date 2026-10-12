// tmp-update-memory-roundy.js — v0.2.41.0 等级系统+订阅限制收尾锚点：
// build-state head（00214-6dg → 00215-gv4）+ scheme 链尾 v0.2.41.0 + MEMORY.md 双指针
// （模板=tmp-update-memory-icons.js：build-state 用结构断言不做 ** 奇偶，其余两文件做）
'use strict';
const fs = require('fs');
const M = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory';

const BS_ENTRY = '**当前线上 rev 00215-gv4（2026-09-14 v0.2.41.0 用户等级系统+订阅/免费功能限制——用户「做一下用户等级系统和订阅与无订阅的功能限制」问询钦定（①等级靠活跃+会员靠订阅两套并行 ②免费=每语言字体 5 个+不能自定义边缘/卡片背景/页面背景、不限制平台主题 ③订阅=先铺垫后接 Xendit 钱到账自动开通不要管理员开通 ④等级称号=微型国家主题 旅行者→君主 10 级）：SUBSCRIPTION_TEST_MODE 翻 false（caption/card 边缘装饰锁正式激活）；字体面板每语言免费 5 个+.fp-lock 锁行+订阅解锁链接；卡片背景/页面背景订阅锁（四控件隐藏+toast+入口锁标）；XP 本地化 slati_xp（每日登录+20/建卡+10/发文章+100/提交国家+150/提交世界+150/话题+80/引导+50；侧栏 mn-lv-badge+进度条+升级 toast）；premium.html #gatewayNote Xendit 预告（到账自动生效口径不变）；另修复 liquid-glass.js 置换图 MAP 被 v0.2.9.0 sed 注入损坏的历史 bug（每页 console error+玻璃位移静默失效，恢复 4a01104 原串）；FC v10.28.31.0（小更新位 30→31·新功能轮）；电池 tier-gating 29/29 + 复跑 13 组全绿（migrate-btn 41/41 悬停断言修 transition:none 注入+正则双转义；group-resize 31/34 三红 round-Y 前既有 0dd2153 worktree 同值实证；group-fill/group-click/group-v172 按设计退役不设门禁）；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0；commit 61a762f 未 push）**；前身 rev 00214-6dg（';

const SCHEME_ENTRY_TAIL = '；2026-09-14 v0.2.41.0 = 用户等级系统+订阅/免费功能限制（用户「做一下用户等级系统和订阅与无订阅的功能限制」问询钦定——小改动位 40→41·新功能轮）：等级靠活跃+会员靠订阅两套并行；免费=每语言字体 5 个+不能自定义边缘/卡片背景/页面背景（不限制平台主题）；订阅=先铺垫后接 Xendit 钱到账自动开通不要管理员开通；等级称号=微型国家主题（旅行者→君主 10 级）；FC v10.28.31.0（小更新位 30→31）；电池 tier-gating 29/29+复跑 13 组全绿；另修复 liquid-glass.js 置换图 MAP 历史 bug；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00215-gv4）；commit 61a762f 未 push）';

// MEMORY.md 双指针行：稳定简介保留 + 当前 rev 紧凑摘要 + 指针（per-round 链只在 topic 文件）
const L9_NEW = '- [后端 v2 重写（SlatiControl）W0-W2+W6 ✅ Cloud Run 加固版已上线（均不 push）：测试 200/200 + smoke-admin 49/49 常驻冒烟（`node backend-v2/scripts/smoke-admin.js`，自建临时库+静态代理同源拓扑+Chrome CDP）；W6（08-28）= 密码+邮箱码双因素（scrypt、迁移 011、verify 三段码→密码→消费、新注册强制密码 ≥8、旧账号首登设密引导）；production 姿态：microcountry2677@gmail.com 密码+邮件码、发信=站务 Gmail slati.official@gmail.com（应用密码）、691032 已作废（救急=NODE_ENV 改 development 重部署）、只留 director Neo；gen2+GCS FUSE 桶 gs://mn-backend-data-641398703651 快照持久化（每实例 snap.<bootId> 防互踩+恢复 mtime 最新+60s 间隔；正式发布换 Cloud SQL）；deploy 链（deploy/cloudrun.md）：docker build（静默失败看 exit code）→ tag → token 直登（docker login 三坑：空 auths 条目盖过 credsStore/PS5.1 Set-Content BOM/管道换行→-p 直传）→ push → gcloud.ps1 run deploy mnationworld-web（完整 env+卷，逗号参数必加引号——09-05 又犯 --add-volume 漏引号（同晚再犯 --add-volume-mount 漏引号）；执行前重读 cloudrun.md）；**当前线上 rev 00215-gv4（2026-09-14 v0.2.41.0 用户等级系统+订阅/免费功能限制：SUBSCRIPTION_TEST_MODE 翻 false（边缘装饰锁正式激活）；字体面板每语言免费 5 个+.fp-lock 锁行；卡片/页面背景订阅锁；XP 本地化 slati_xp（每日登录+20/建卡+10/发文章+100/提交国家+150/提交世界+150/话题+80/引导+50；侧栏 Lv 徽章+进度条+升级 toast）；premium #gatewayNote Xendit 预告；另修复 liquid-glass.js MAP 损坏历史 bug；FC v10.28.31.0（小更新位 30→31）；电池 tier-gating 29/29+复跑 13 组全绿（migrate-btn 41/41 悬停断言修复；group-resize 31/34 三红 round-Y 前既有实证；旧三组电池退役不设门禁）；部署一次 exit 0；commit 61a762f 未 push）**；W3-W5 待做；每轮 rev 全量链见 [[backend-build-state]]](backend-build-state.md)';

const L11_NEW = '- [侧栏版本号口径：大版本.小版本.小改动.补丁（用户钦定），版本单一来源 site-config.js，改版本只动一处；两条独立线——站点号仅侧栏品牌模块、FC 四段线在 FC 头部+编辑器 badge；进位规则+每轮版本/commit/轮型全量链见 [[site-versioning-scheme]]；站点号当前 **v0.2.41.0**（2026-09-14 用户等级系统+订阅/免费功能限制——小改动位 40→41 新功能轮；FC v10.28.31.0（小更新位 30→31）；电池 tier-gating 29/29+复跑 13 组全绿；另修复 liquid-glass.js MAP 历史 bug；零后端、ethereal 零改动无需 inline-css；部署一次 exit 0（00215-gv4）；commit 61a762f 未 push）](site-versioning-scheme.md)';

// —— 1. backend-build-state.md head：00214-6dg → 00215-gv4 ——
{
  const p = M + '/backend-build-state.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('rev 00215-gv4（') !== -1) { console.log('ℹ build-state 已含 00215-gv4，跳过'); }
  else {
    const anchor = '**当前线上 rev 00214-6dg（';
    const n = s.split(anchor).length - 1;
    if (n !== 1) { console.log('❌ build-state anchor count wrong: ' + n); process.exit(1); }
    s = s.replace(anchor, BS_ENTRY);
    fs.writeFileSync(p, s);
    const s2 = fs.readFileSync(p, 'utf8');
    const head = s2.split('**当前线上 rev 00215-gv4（').length - 1;
    const prev = s2.split('）**；前身 rev 00214-6dg（').length - 1;
    const total = s2.split('rev 00215-gv4').length - 1;
    if (head !== 1 || prev !== 1 || total !== 1) { console.log('❌ build-state 结构断言失败: ' + JSON.stringify({ head, prev, total })); process.exit(1); }
    console.log('✅ backend-build-state.md updated（00215-gv4 结构断言 head=' + head + ' prev=' + prev + ' total=' + total + '）');
  }
}

// —— 2. site-versioning-scheme.md 链尾：v0.2.40.2 条目后插 v0.2.41.0 ——
{
  const p = M + '/site-versioning-scheme.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.split('v0.2.41.0 = ').length > 1) { console.log('ℹ scheme 已含 v0.2.41.0 条目，跳过'); }
  else {
    const anchor = 'commit 0dd2153 未 push）';
    const n = s.split(anchor).length - 1;
    if (n !== 1) { console.log('❌ scheme anchor count wrong: ' + n); process.exit(1); }
    s = s.replace(anchor, anchor + SCHEME_ENTRY_TAIL);
    fs.writeFileSync(p, s);
    console.log('✅ site-versioning-scheme.md updated（v0.2.41.0 计数 ' + (s.split('v0.2.41.0').length - 1) + '）');
  }
}

// —— 3. MEMORY.md 双指针 ——
{
  const p = M + '/MEMORY.md';
  let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('rev 00215-gv4（') !== -1) { console.log('ℹ MEMORY.md 已含 00215-gv4，跳过'); }
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
    // 真实文本口径：L9 行 1 处（rev 00215-gv4）+ L11 行 1 处（（00215-gv4））= 共 2 处 00215-gv4
    const cnt = s.split('00215-gv4').length - 1;
    if (cnt !== 2) { console.log('❌ MEMORY.md 00215-gv4 计数 wrong: ' + cnt); process.exit(1); }
    console.log('✅ MEMORY.md updated（' + (before / 1024).toFixed(1) + 'KB → ' + (after / 1024).toFixed(1) + 'KB，00215-gv4 计数 ' + cnt + '）');
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
