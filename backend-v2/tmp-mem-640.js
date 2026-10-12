// tmp-mem-640.js — 640 轮记忆仪式（v0.2.58.27 侧栏菜单背景卡片改不透明；rev 00365-6zb→00366-2jw）
//   A. 新记忆文件 2026-10-05-v025827-sidebar-opaque.md
//   B. backend-build-state.md 头旋转：00364-wdg 降前身 + 00366-2jw 新 head（结构断言）
//   C. site-versioning-scheme.md 追加 640 轮条目 + 尾指针 58.26→58.27
//   D. MEMORY.md：backend 索引行指针旋转 + site-versioning 索引行指针刷新 + 顶部新行
'use strict';
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
const now = new Date().toISOString();
const cnt = (s, p) => s.split(p).length - 1;

// ── A. 新记忆文件 ──
const newMem = `---
name: 2026-10-05-v025827-sidebar-opaque
description: v0.2.58.27 侧栏菜单背景卡片改不透明轮新坑——舰队跑动中绝不动 headless chrome 树/电池 CDP 无 send 超时=Chrome 死即卡/ps -W 第 4 列才是 WINPID/639 终态填真值后占位锚陈旧
metadata:
  node_type: memory
  type: project
  originSessionId: 00a58de3-ef10-4ac7-932d-df342e356a52
  modified: ${now}
---

v0.2.58.27 侧栏菜单背景卡片改不透明（用户「那个在个人主页那边的左侧菜单背景卡片是半透明的能不能变成不透明的？」；ethereal.css .sidebar-module background:var(--card-bg)→var(--sidebar-bg)——亮 rgba(255,255,255,0.95)/暗 #1a1a2e 实心（09-18 钦定不透明底）+blur(20px) 保留+.app-sidebar 容器零改动（58.1 不回归）+inline-css.js 40 页刷新 8 豁免（CSS_MARK pages=41）；后端零改动 npm test 413/413；rev 00365-6zb→00366-2jw 终态；commit 未 push；FC 恒 v10.28.52.0；digest sha256:6497ddf23b28304b4a77ad8e142a9d2e1e56c9b9882cf21ae57c75cc73447c9c）。新坑：

1. **舰队跑动期间绝不 taskkill headless chrome 树**：清理残留 Chrome 时误杀正在跑电池的 Chrome → 电池挂起 37 分钟零输出（profile-banner #50）。此后只 Stop-Process 卡死电池的特定 node PID；chrome 清理只在舰队间隙做。
2. **电池 CDP 类无 send 超时=Chrome 死即卡**：Chrome 被硬杀时 WS 无 error 事件 → send 的 await 永不 resolve——node 空闲 CPU≈0、无 socket、无输出=卡死特征（区别于正常退出 exit=127）。复跑即恢复（flake 口径：本机 Chrome 153 间歇性中途死亡，历史 GPU 即死）。
3. **MSYS ps -W 第 4 列才是 WINPID**：ps -W 列序=PID PPID PGID WINPID TTY UID STIME COMMAND——PowerShell Get-Process 用第 4 列（Windows PID）；用 MSYS pid 报 NOT FOUND 造成困惑；netstat + ParentProcessId 查子进程定位。
4. **fc-rewards 锚漂移（本轮唯一真红）**：639 轮终态填真值 00363-ksq/00364-wdg 后，S1 占位锚（rev 00363-XXX/00364-???）陈旧 → 改锚真值复跑 37/37 销账。家规：占位锚若指向已填真值的 rev 必须先改锚再跑。
5. **sed 中文长文本替换报 unterminated \`s' command** → 只替换唯一短 token（如 00365-XXX）。
6. **探针克隆漏 fs 依赖**：克隆 639 探针漏 \`const fs = require('fs');\` → ReferenceError → 补上复跑 12/12。

相关 [[backend-build-state]]、[[site-versioning-scheme]]、[[2026-08-16-session-state]]（电池全绿≠渲染正确）、[[cdp-animation-clock-battery]]。
`;
fs.writeFileSync(MEM + '2026-10-05-v025827-sidebar-opaque.md', newMem, 'utf8');
console.log('A ✅ 新记忆文件 2026-10-05-v025827-sidebar-opaque.md');

// ── B. backend-build-state.md 头旋转（幂等：已旋转则跳过）──
let bbs = fs.readFileSync(MEM + 'backend-build-state.md', 'utf8');
if (bbs.indexOf('**当前线上 rev 00364-wdg（') !== -1) {
{
  const lines = bbs.split('\n');
  const hi = lines.findIndex(l => l.indexOf('**当前线上 rev 00364-wdg（') === 0);
  if (hi < 0) throw new Error('B: head 00364-wdg 未找到');
  const oldHead = lines[hi];
  if (!oldHead.endsWith('**')) throw new Error('B: 旧 head 未以 ** 收尾');
  const demoted = oldHead.replace('**当前线上 rev ', '**前身 rev ');
  if (demoted === oldHead) throw new Error('B: 降级 no-op');
  const newHead = '**当前线上 rev 00366-2jw（2026-10-05 v0.2.58.27 侧栏菜单背景卡片改不透明；FC 恒 v10.28.52.0）——用户「那个在个人主页那边的左侧菜单背景卡片是半透明的能不能变成不透明的？」；修法=ethereal.css .sidebar-module background: var(--card-bg)→var(--sidebar-bg)（09-18 钦定不透明底：亮 rgba(255,255,255,0.95)/暗 #1a1a2e 实心）+backdrop-filter blur(20px) 保留+.app-sidebar 容器零改动（58.1 不回归）+inline-css.js 重跑 40 页刷新（CSS_MARK pages=41）+site-config 58.26→58.27+changelog 条目（刻意避写全 \'v0.2.58.26\' 保 community-nodemo F1 计数）；后端零改动 npm test 413/413；新电池 tmp-battery-sidebar-opaque 14/14（S 静态+CDP 亮色 rgba(255,255,255,0.95)+blur(20px)/暗色 rgb(26,26,46) 实心/容器 rgba(0,0,0,0)/index 同款+E 零异常）；舰队 640 共 58 项全绿（首跑 1 真红=fc-rewards 锚漂移（639 终态填真值后占位锚陈旧→改锚真值 00363-ksq/00364-wdg 复跑销账）+3 flake（banner/subtier/profilecust Chrome 中途死亡→CDP 无 send 超时挂起→杀 node 复跑销账）；grep exit=1|💥 复核零命中）+冒烟 60/60+i18n 34/34+fc-i18n 20/20；镜像内容验证两次构建各验一次先验后推 0 mismatch（verify#1 MODE 1 占位 00365-XXX/00366-???；verify#2 MODE 2 终态 00365-6zb+00365-XXX 零残留）；deploy 640 ps1 无新 env（env 34 零重复）+GEMINI_MODEL 恒强制 gemini-3.8-flash+SNAPSHOT_INTERVAL_MS 恒强制 86400000；线上探针 sidebar-opaque 640 12/12（S1a site-config 58.27 双赋值+58.26 零残留+S1b rev live 口径 00365-6zb ×1+00366-??? 占位 ×1+00366-2jw 零残留（live 滞后一部署）+S1c ethereal sbg ×3+原话+灭滤镜在位+S1d 内联页 cp sbg ×3+index 原话+S2 health tables:66+S3 fc/edges 200+P1a-e CDP live computed 三卡 rgba(255,255,255,0.95)+blur(20px)+容器透明+暗色 rgb(26,26,46)+index 同款+E1 零异常）；digest sha256:6497ddf23b28304b4a77ad8e142a9d2e1e56c9b9882cf21ae57c75cc73447c9c（二次烘焙镜像=当前线上）**';
  lines.splice(hi, 1, newHead, demoted);
  bbs = lines.join('\n');
}
bbs = bbs.replace('modified: 2026-09-28T12:00:00.000Z', 'modified: ' + now);
{
  const c = s => cnt(bbs, s);
  if (c('**当前线上 rev 00366-2jw（') !== 1) throw new Error('B: 新 head 不唯一');
  if (c('**前身 rev 00364-wdg（') !== 1) throw new Error('B: 降级前身锚缺失');
  if (c('**当前线上 rev 00364-wdg（') !== 0) throw new Error('B: 旧 head 开头残留');
  if (c('**前身 rev 00362-fdj（') !== 1 || c('**前身 rev 00360-bk7（') !== 1) throw new Error('B: 邻接前身锚受损');
  const iNew = bbs.indexOf('**当前线上 rev 00366-2jw（');
  const iDem = bbs.indexOf('\n**前身 rev 00364-wdg（', iNew);
  if (iDem < 0 || bbs.slice(iNew, iDem).indexOf('\n') !== -1) throw new Error('B: 新 head 收尾后未紧跟降级前身锚');
}
fs.writeFileSync(MEM + 'backend-build-state.md', bbs, 'utf8');
console.log('B ✅ backend-build-state.md 头旋转（** 总数 ' + cnt(bbs, '**') + '）');
} else {
console.log('B ⏭ 已旋转（跳过）');
}

// ── C. site-versioning-scheme.md 追加 + 尾指针 ──
let sv = fs.readFileSync(MEM + 'site-versioning-scheme.md', 'utf8');
if (sv.indexOf('2026-10-05 v0.2.58.27 = 侧栏菜单背景卡片改不透明') === -1) {
{
  const pk = '**站点号当前 ';
  const pIdx = sv.lastIndexOf(pk); // 每轮条目自带指针——只取文件尾最后一个
  if (pIdx < 0) throw new Error('C: 尾指针缺失');
  if (sv.slice(pIdx - 3, pIdx) !== '））。') throw new Error('C: 指针前邻接异常: ' + JSON.stringify(sv.slice(pIdx - 12, pIdx)));
  const oldPtr = pk + 'v0.2.58.26；FC 当前 v10.28.52.0**。';
  if (!sv.startsWith(oldPtr, pIdx)) throw new Error('C: 旧指针文本不符: ' + JSON.stringify(sv.slice(pIdx, pIdx + 60)));
  const newEntry = '2026-10-05 v0.2.58.27 = 侧栏菜单背景卡片改不透明（FC 恒 v10.28.52.0）——用户「那个在个人主页那边的左侧菜单背景卡片是半透明的能不能变成不透明的？」；真身=.sidebar-module 卡面用 --card-bg 玻璃半透明（09-18 钦定的 --sidebar-bg 不透明底从未接上）；修法=background:var(--card-bg)→var(--sidebar-bg)（亮 rgba(255,255,255,0.95)/暗 #1a1a2e 实心）+blur(20px) 保留+.app-sidebar 容器零改动（58.1 不回归）+inline-css.js 重跑 40 页刷新；后端零改动 npm test 413/413；新电池 sidebar-opaque 14/14+舰队 640 共 58 项全绿（首跑 1 真红=fc-rewards 锚陈旧改真值+3 flake Chrome 死复跑销账；grep exit=1|💥 零命中）+冒烟 60/60+i18n 34/34+fc-i18n 20/20；验证 ×2 先验后推 0 mismatch（00365 占位→6zb 填真；00366 占位）；deploy 640 ps1 无新 env（env 34 零重复；GEMINI_MODEL/SNAPSHOT_INTERVAL_MS 恒强制）；线上探针 sidebar-opaque 640 12/12（P1a-e CDP live computed 三卡 0.95+blur/暗色实心/容器透明+E1 零异常）；digest sha256:6497ddf23b28304b4a77ad8e142a9d2e1e56c9b9882cf21ae57c75cc73447c9c（二次烘焙=当前线上）；commit 未 push）。';
  const newPtr = pk + 'v0.2.58.27；FC 当前 v10.28.52.0**。';
  sv = sv.slice(0, pIdx) + newEntry + newPtr + sv.slice(pIdx + oldPtr.length);
  sv = sv.replace('modified: 2026-10-03T17:56:03.307Z', 'modified: ' + now);
}
fs.writeFileSync(MEM + 'site-versioning-scheme.md', sv, 'utf8');
console.log('C ✅ site-versioning-scheme.md 追加 640 轮 + 指针 58.26→58.27');
} else {
console.log('C ⏭ 已追加（跳过）');
}

// ── D. MEMORY.md（幂等）──
let mm = fs.readFileSync(MEM + 'MEMORY.md', 'utf8');
if (mm.indexOf('- [2026-10-05 — v0.2.58.27 侧栏菜单背景卡片改不透明') === -1) {
{
  const reps = [
    ['当前线上 rev 00362-fdj（FC v10.28.51.1 边缘样本配色+应用链修复+边框裸值放宽+AI 弹窗正向反馈；站点恒 v0.2.58.26；commit 未 push）',
     '当前线上 rev 00366-2jw（2026-10-05 v0.2.58.27 侧栏菜单背景卡片改不透明；FC 恒 v10.28.52.0；commit 未 push）'],
    ['**当前：站点号 v0.2.58.26（58.26 FC 首页真数据+不透明卡片+FC 48.2 同轮；rev 00349-hgc；commit 未 push）、FC v10.28.51.1（51.1 边缘样本配色+应用链修复+边框裸值放宽+AI 弹窗正向反馈同轮；rev 00362-fdj；commit 未 push）**',
     '**当前：站点号 v0.2.58.27（58.27 侧栏菜单背景卡片改不透明；rev 00366-2jw；commit 未 push）、FC v10.28.52.0（52.0 等级奖励；rev 00364-wdg；commit 未 push）**'],
  ];
  for (const [a, b] of reps) {
    const n = cnt(mm, a);
    if (n !== 1) throw new Error('D: 模式计数 ' + n + '（期望 1）: ' + a.slice(0, 50));
    mm = mm.replace(a, b);
  }
  const newLine = '- [2026-10-05 — v0.2.58.27 侧栏菜单背景卡片改不透明（rev 00365-6zb→00366-2jw commit 未 push；FC 恒 52.0）：.sidebar-module background:var(--card-bg)→var(--sidebar-bg) 亮 rgba(255,255,255,0.95)/暗实心+blur(20px) 保留+.app-sidebar 容器零改动（58.1 不回归）+inline-css.js 40 页刷新；新坑见 [2026-10-05-v025827-sidebar-opaque.md](2026-10-05-v025827-sidebar-opaque.md)]\n';
  if (mm.indexOf('2026-10-05-v025827') !== -1) throw new Error('D: 新行已存在');
  mm = newLine + mm;
}
fs.writeFileSync(MEM + 'MEMORY.md', mm, 'utf8');
console.log('D ✅ MEMORY.md 指针 ×2 旋转 + 顶部新行');
} else {
console.log('D ⏭ 已更新（跳过）');
}
console.log('🎉 记忆仪式完成');
