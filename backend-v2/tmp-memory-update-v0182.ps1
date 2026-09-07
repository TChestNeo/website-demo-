# tmp-memory-update-v0182.ps1 — v0.2.18.2 收尾：log 追加 + 3 个 memory 文件指针更新（每个替换断言恰好 1 处）
$ErrorActionPreference = 'Stop'
$enc = New-Object System.Text.UTF8Encoding($false)
function RepOnce($file, $old, $new) {
  $t = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
  $idx = $t.IndexOf($old)
  if ($idx -lt 0) { throw ("未找到: " + (Split-Path $file -Leaf) + " :: " + $old.Substring(0, [Math]::Min(40, $old.Length))) }
  if ($t.IndexOf($old, $idx + 1) -ge 0) { throw ("出现两次: " + (Split-Path $file -Leaf) + " :: " + $old.Substring(0, [Math]::Min(40, $old.Length))) }
  [System.IO.File]::WriteAllText($file, $t.Replace($old, $new), $enc)
  Write-Host ("OK: " + (Split-Path $file -Leaf))
}
$mem = 'C:\Users\USER\.claude\projects\c--Users-USER-Downloads-stitch-slatiworld-micronation-interface\memory'

# 1) backend-build-state.md 头部：00085 → 00086 当前线上，原 00085 段落降为前身
RepOnce ($mem + '\backend-build-state.md') `
  '**当前线上 rev 00085-vf4（2026-09-05 v0.2.18.1 Community 点赞实心+动画轮）**：用户「那个点赞后能不能变成实心和有一个动画」' `
  '**当前线上 rev 00086-tcf（2026-09-05 v0.2.18.2 Community hub 假爱心修复轮）**：用户「为什么只有在独立帖子页面内有而已？」→「没有变实心啊」——探针实锤登录态推荐流真帖+演示卡混排（5 卡 = 1 真 + 3 假），演示卡爱心是 span 摆设点了没反应。零后端零共享文件（纯前端修复）：renderFeed 云模式推荐流只显真帖（cloudPosts 不再 concat 演示项）+空态提示卡「这里还没有帖子，来发第一帖吧 ✨」；演示卡爱心 span→button + data-guest-like，点击 toast「登录后才能点赞」（与帖页访客口径一致；绑定挂云模式块外未登录 demo 模式也生效）。测试 227/227（后端零改）+电池 21→26 本地（+H9 云模式零死爱心/H10 空 feed 空态卡/G 访客演示卡爱心 toast）+7→9 线上（+L5 云模式零死爱心/L6 访客演示卡爱心 toast；L4 乐观态断言改同步快照防 401 回程竞速）+冒烟 49/49+curl 七连+health 58；deploy 00086-tcf 100% 流量（env 从 describe 取 28 条零改动）；commit 1d77efc（未 push）。**前身 rev 00085-vf4（2026-09-05 v0.2.18.1 Community 点赞实心+动画轮）**：用户「那个点赞后能不能变成实心和有一个动画」'

# 2) site-versioning-scheme.md 链：v0.2.18.2 条目插在 v0.2.18.1 之后、v0.2.15.3 之前
RepOnce ($mem + '\site-versioning-scheme.md') `
  'rev 00085-vf4 commit 99a4f09（未 push））；2026-09-04 v0.2.15.3 =' `
  'rev 00085-vf4 commit 99a4f09（未 push））；2026-09-05 v0.2.18.2 = Community hub 假爱心修复（补丁位 1→2 修复轮——用户「为什么只有在独立帖子页面内有而已？」→「没有变实心啊」：探针实锤登录态推荐流真帖+演示卡混排（5 卡 = 1 真 + 3 假）演示卡爱心是 span 摆设点了没反应；云模式推荐流只显真帖+空态提示卡、演示卡爱心改真按钮点击 toast「登录后才能点赞」（与帖页访客口径一致）；零后端零共享文件；测试 227/227+电池 26/26 本地+9/9 线上+冒烟 49/49+curl 七连+health 58，rev 00086-tcf commit 1d77efc（未 push））；2026-09-04 v0.2.15.3 ='

# 3) MEMORY.md 第 9 行指针：00085 → 00086（C1 换头 + C2 补右括号）
RepOnce ($mem + '\MEMORY.md') `
  '**当前线上 rev 00085-vf4（2026-09-05 v0.2.18.1 Community 点赞实心+动画轮：用户「那个点赞后能不能变成实心和有一个动画」' `
  '**当前线上 rev 00086-tcf（2026-09-05 v0.2.18.2 Community hub 假爱心修复轮：用户「为什么只有在独立帖子页面内有而已？」→「没有变实心啊」——探针实锤登录态推荐流真帖+演示卡混排（5 卡 = 1 真 + 3 假）演示卡爱心是 span 摆设点了没反应；云模式推荐流只显真帖+空态提示卡；演示卡爱心 span→button + data-guest-like 点击 toast「登录后才能点赞」；零后端零共享文件；测试 227/227+电池 26/26 本地+9/9 线上+冒烟 49/49+curl 七连+health 58；commit 1d77efc）；前身 rev 00085-vf4（2026-09-05 v0.2.18.1 Community 点赞实心+动画轮：用户「那个点赞后能不能变成实心和有一个动画」'
RepOnce ($mem + '\MEMORY.md') `
  'commit 99a4f09）；前身每轮全量链' `
  'commit 99a4f09））；前身每轮全量链'

# 4) MEMORY.md 第 11 行站点号指针：v0.2.18.1 → v0.2.18.2（D1 换头 + D2 补右括号）
RepOnce ($mem + '\MEMORY.md') `
  '站点号当前 **v0.2.18.1**（2026-09-05 Community 点赞实心+动画轮' `
  '站点号当前 **v0.2.18.2**（2026-09-05 Community hub 假爱心修复轮——用户「为什么只有在独立帖子页面内有而已？」→「没有变实心啊」：探针实锤登录态推荐流真帖+演示卡混排（5 卡 = 1 真 + 3 假）演示卡爱心是 span 摆设点了没反应；云模式推荐流只显真帖+空态提示卡、演示卡爱心改真按钮点击 toast「登录后才能点赞」；零后端零共享文件；测试 227/227+电池 26/26 本地+9/9 线上+冒烟 49/49+curl 七连+health 58，rev 00086-tcf commit 1d77efc（未 push）；前身 v0.2.18.1（Community 点赞实心+动画轮'
RepOnce ($mem + '\MEMORY.md') `
  'commit 6124694））；FC 当前' `
  'commit 6124694）））；FC 当前'

# 5) log 追加 v0.2.18.2 轮条目
$log = 'c:\Users\USER\Downloads\stitch_slatiworld_micronation_interface\logs\2026-08-28 log.txt'
$entry = "`r`n【2026-09-05 深夜轮】v0.2.18.2 Community hub 假爱心修复（rev 00086-tcf）——用户「为什么只有在独立帖子页面内有而已？」→「没有变实心啊」：先误诊缓存（用户 Ctrl+F5 后仍报），探针实锤登录态推荐流真帖+演示卡混排（5 卡 = 1 真 + 3 假），演示卡爱心是 span 摆设点了没反应——用户点的正是假卡。零后端零共享文件（纯前端修复）：renderFeed 云模式推荐流只显真帖（cloudPosts 不再 concat 演示项）+空态提示卡「这里还没有帖子，来发第一帖吧 ✨」；演示卡爱心 span→button + data-guest-like，点击 toast「登录后才能点赞」（与帖页访客口径一致，绑定挂云模式块外未登录 demo 模式也生效）。版本：补丁位 1→2 修复轮。验证：测试 227/227（后端零改）+电池 26/26 本地（新增 H9 云模式零死爱心/H10 空 feed 空态卡/G 访客演示卡爱心 toast；空态经 localStorage __mn_empty_feed 开关进罐头）+9/9 线上（L4 乐观态断言改同步快照——真 401 回程 <120ms 时异步读被竞速吞掉，click 后同一任务内读必现）+冒烟 49/49+curl 七连（hub 页 data-guest-like×2+空态句×1）+health 58（tables 58 v2.0.0）。部署：docker build/tag/token 直登/push → gcloud.ps1 deploy（env 从 describe 取 28 条零改动；逗号参数全带引号零踩坑）→ rev 00086-tcf 100% 流量。commit 1d77efc（未 push）。`r`n"
[System.IO.File]::AppendAllText($log, $entry, $enc)
Write-Host 'OK: log 已追加'
Write-Host '全部完成'
