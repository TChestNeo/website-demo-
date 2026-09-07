# tmp-memory-update-v0183.ps1 — v0.2.18.3 收尾：log 追加 + 3 个 memory 文件指针更新（每个替换断言恰好 1 处）
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

# 1) backend-build-state.md 头部：00086 → 00087 当前线上，原 00086 段落降为前身 —— 已在前次运行完成（重跑会二次匹配新头部里的「前身 00086」锚点，故跳过）

# 2) site-versioning-scheme.md 链：v0.2.18.3 条目插在 v0.2.18.2 之后
RepOnce ($mem + '\site-versioning-scheme.md') `
  'rev 00086-tcf commit 1d77efc（未 push））；2026-09-04 v0.2.15.3 =' `
  'rev 00086-tcf commit 1d77efc（未 push））；2026-09-05 v0.2.18.3 = Community 点赞粒子特效完整照搬参考（补丁位 2→3 口径修正轮——用户「而且你特效也没超好啊，而且粒子效果别改颜色啊还有能不能照着搬啊，只是把完整的粒子特效搬出来」：v0.2.18.1 自创 24 粒子不合格，照搬参考完整原版 61 粒子色环逐字不改一色+三动画链原版时长 1.25s bang/1.25s gravity translateY(200px)/6.25s position 5 窗游走+scale(0.4) 并入 gravity 终点+like-pop-icon 参考值 0.5s+armLikePop 摘类等最后一档 6.25s+6.8s 兜底（旧版 950ms 粒子没飞完就收）；零后端零共享文件；测试 227/227+电池 35/35 本地+9/9 线上+冒烟 49/49+curl 七连+health 58，rev 00087-7vn commit 44382d0（未 push））；2026-09-04 v0.2.15.3 ='

# 3) MEMORY.md 第 9 行指针：00086 → 00087（C1 换头 + C2 补右括号）
RepOnce ($mem + '\MEMORY.md') `
  '**当前线上 rev 00086-tcf（2026-09-05 v0.2.18.2 Community hub 假爱心修复轮：用户「为什么只有在独立帖子页面内有而已？」→「没有变实心啊」' `
  '**当前线上 rev 00087-7vn（2026-09-05 v0.2.18.3 Community 点赞粒子特效完整照搬参考轮：用户「而且你特效也没超好啊，而且粒子效果别改颜色啊还有能不能照着搬啊，只是把完整的粒子特效搬出来」——v0.2.18.1 自创 24 粒子不合格，照搬参考完整原版 61 粒子色环逐字不改一色+三动画链原版时长+armLikePop 摘类等最后一档 6.25s（旧版 950ms 粒子没飞完就收）；零后端零共享文件；测试 227/227+电池 35/35 本地+9/9 线上+冒烟 49/49+curl 七连+health 58；commit 44382d0）；前身 rev 00086-tcf（2026-09-05 v0.2.18.2 Community hub 假爱心修复轮：用户「为什么只有在独立帖子页面内有而已？」→「没有变实心啊」'
RepOnce ($mem + '\MEMORY.md') `
  'commit 1d77efc）；前身 rev 00085-vf4（2026-09-05 v0.2.18.1 Community 点赞实心+动画轮：用户「那个点赞后能不能变成实心和有一个动画」' `
  'commit 1d77efc））；前身 rev 00085-vf4（2026-09-05 v0.2.18.1 Community 点赞实心+动画轮：用户「那个点赞后能不能变成实心和有一个动画」'

# 4) MEMORY.md 第 11 行站点号指针：v0.2.18.2 → v0.2.18.3（D1 换头 + D2 补右括号）
RepOnce ($mem + '\MEMORY.md') `
  '站点号当前 **v0.2.18.2**（2026-09-05 Community hub 假爱心修复轮' `
  '站点号当前 **v0.2.18.3**（2026-09-05 Community 点赞粒子特效完整照搬参考轮——用户「而且你特效也没超好啊，而且粒子效果别改颜色啊还有能不能照着搬啊，只是把完整的粒子特效搬出来」：v0.2.18.1 自创 24 粒子不合格，照搬参考完整原版 61 粒子色环逐字不改一色+三动画链原版时长（1.25s bang/1.25s gravity translateY(200px)/6.25s position 5 窗游走）+scale(0.4) 并入 gravity 终点+like-pop-icon 参考值 0.5s+armLikePop 摘类等最后一档 6.25s+6.8s 兜底（旧版 950ms 粒子没飞完就收）；零后端零共享文件；测试 227/227+电池 35/35 本地+9/9 线上+冒烟 49/49+curl 七连+health 58，rev 00087-7vn commit 44382d0（未 push）；前身 v0.2.18.2（Community hub 假爱心修复轮'
RepOnce ($mem + '\MEMORY.md') `
  'rev 00086-tcf commit 1d77efc（未 push）；前身 v0.2.18.1（Community 点赞实心+动画轮' `
  'rev 00086-tcf commit 1d77efc（未 push））；前身 v0.2.18.1（Community 点赞实心+动画轮'

# 5) log 追加 v0.2.18.3 轮条目
$log = 'c:\Users\USER\Downloads\stitch_slatiworld_micronation_interface\logs\2026-08-28 log.txt'
$entry = "`r`n【2026-09-05 深夜轮】v0.2.18.3 Community 点赞粒子特效完整照搬参考（rev 00087-7vn）——用户「而且你特效也没超好啊，而且粒子效果别改颜色啊还有能不能照着搬啊，只是把完整的粒子特效搬出来」：v0.2.18.1 自创 24 粒子小改版不合格，照搬参考代码完整原版。零后端零共享文件（纯前端）：hub CSS 粒子改参考原版——单个 10px 圆点 + 61 条 box-shadow 彩点（色环逐字照搬不改一色）+ 三动画链原版时长（1.25s mn-fireworks-bang ease-out 迸发 → 1.25s mn-fireworks-gravity ease-in 下落 translateY(200px) → 6.25s mn-fireworks-position linear 游走 5 档 margin 窗口）；scale(0.4) 并入 gravity 终点（单元素免 wrapper 与参考 .fireworks 外壳视觉一致）；like-pop-icon 改参考值（0.5s ease-out、0% scale(0) opacity 0、50% scale(1.2) rotate(-10deg)）；armLikePop 摘类改等最后一档（mn-fireworks-position 6.25s）animationend + 6.8s 兜底（旧版 950ms 粒子没飞完就收——「特效没好」主因之一）。版本：补丁位 2→3 口径修正轮。验证：测试 227/227（后端零改）+电池 35/35 本地（HC1-7 CSSOM 直验规则：61 条影子/参考首尾色/禁旧自创色 #e0245e/gravity scale/position 5 窗/三动画链时长——Chrome 规则样式序列化 rgb()+长手写展开两坑按项断言；H5/P3 摘类时机翻转：1.5s 飞行中仍在、7s 全链完才摘）+9/9 线上+冒烟 49/49+curl 七连（hub mn-fireworks-bang/首尾参考色/6.25s 链/帖页 CSS 流入/data-guest-like/空态句/站点号）+health 58（tables 58 v2.0.0）。部署：docker build/tag/token 直登/push → gcloud.ps1 deploy（env 从 describe 取 28 条零改动；逗号参数全带引号零踩坑）→ rev 00087-7vn 100% 流量。commit 44382d0（未 push）。`r`n"
[System.IO.File]::AppendAllText($log, $entry, $enc)
Write-Host 'OK: log 已追加'
Write-Host '全部完成'
