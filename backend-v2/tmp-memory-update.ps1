# tmp-memory-update.ps1 — v0.2.18.1 收尾：三份 memory 文件精确替换（UTF-8 无 BOM）
$ErrorActionPreference = 'Stop'
$enc = New-Object System.Text.UTF8Encoding($false)
$M = 'C:\Users\USER\.claude\projects\c--Users-USER-Downloads-stitch-slatiworld-micronation-interface\memory'

function Replace-Once($file, $old, $new) {
  $t = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::GetEncoding('UTF-8'))
  $n = ([regex]::Matches($t, [regex]::Escape($old))).Count
  if ($n -ne 1) { throw "$file 锚点命中 $n 次（须为 1）：$($old.Substring(0, [Math]::Min(60, $old.Length)))" }
  $t = $t.Replace($old, $new)
  [System.IO.File]::WriteAllText($file, $t, $enc)
  Write-Host "OK: $(Split-Path $file -Leaf)"
}

# ── 1. backend-build-state.md：换头（00085 新当前 + 00084 降前身）──
Replace-Once "$M\backend-build-state.md" @'
**当前线上 rev 00084-rnh（2026-09-05 v0.2.18.0 Community 转发+分享轮）**：用户「能不能在帖子的评论后面那边再添加转发按钮和分享按钮？」
'@ @'
**当前线上 rev 00085-vf4（2026-09-05 v0.2.18.1 Community 点赞实心+动画轮）**：用户「那个点赞后能不能变成实心和有一个动画」（附 like/dislike 参考代码）→「只是要动画而已 一样是用爱心不要换」——爱心图标不换只取动画。零后端零共享文件（纯前端观感微调）：hub+帖页点赞钮加 .like-burst 单粒子 span（6px 圆点+24 条 box-shadow 彩点四向迸发零额外节点）；点击 JS 加一次性类 like-pop（armLikePop：animationend{once}+950ms 兜底摘类——reduced-motion 无 animationend）→图标 like-pop-icon 0.45s 弹性弹跳（scale 0.2→1+rotate -35°→0）+粒子 like-burst-fly 0.6s ease-out 迸发；like-pop 不进默认渲染——60s feed 重渲染/初始已点赞卡不重播动画；取消/401 回滚同步摘类；reduced-motion 关动画只换实心；帖页 tail 改+重建 100686 chars 自检过（like-burst×6/armLikePop×3/script 14=14）。测试 227/227（后端零改）+电池 21/21 本地+7/7 线上+冒烟 49/49+curl 十连+health 58；deploy 00085-vf4 100% 流量（env 从 describe 取 28 条零改动，逗号参数本轮全带引号零踩坑）；commit 99a4f09（未 push）。**前身 rev 00084-rnh（2026-09-05 v0.2.18.0 Community 转发+分享轮）**：用户「能不能在帖子的评论后面那边再添加转发按钮和分享按钮？」
'@

# ── 2. site-versioning-scheme.md：链上 00084 之后插 v0.2.18.1 ──
Replace-Once "$M\site-versioning-scheme.md" @'
，rev 00084-rnh；2026-09-04 v0.2.15.3
'@ @'
，rev 00084-rnh；2026-09-05 v0.2.18.1 = Community 点赞实心+动画（补丁位 0→1 观感微调轮——用户「那个点赞后能不能变成实心和有一个动画」（附 like/dislike 参考代码）→「只是要动画而已 一样是用爱心不要换」：爱心图标不换只取动画——hub+帖页点赞钮加 .like-burst 单粒子 span（6px 圆点+24 条 box-shadow 彩点四向迸发零额外节点）+点击 JS 加一次性类 like-pop（armLikePop：animationend{once}+950ms 兜底摘类）→图标 like-pop-icon 0.45s 弹性弹跳+粒子 like-burst-fly 0.6s 迸发；like-pop 不进默认渲染——60s feed 重渲染/初始已点赞不重播；取消/401 回滚同步摘类；reduced-motion 关动画只换实心；帖页 tail 改+重建；测试 227/227+电池 21/21 本地+7/7 线上+冒烟 49/49+curl 十连+health 58，rev 00085-vf4 commit 99a4f09（未 push））；2026-09-04 v0.2.15.3
'@

# ── 3. MEMORY.md 指针两行 ──
Replace-Once "$M\MEMORY.md" @'
**当前线上 rev 00084-rnh（2026-09-05 v0.2.18.0 Community 转发+分享轮：用户「能不能在帖子的评论后面那边再添加转发按钮和分享按钮？」→问询钦定真转发（Twitter 式转发即发帖）；后端迁移 015 posts.repost_of 加列+索引（无新表 health 58 不变）+postRow 转发四字段+POST/DELETE /posts/:id/repost（同帖一次守卫 409+跳过 sha1 去重+postsWrite 共享配额+L0 仅非空转发语）；前端 hub 转发卡内嵌盒+帖页转发/分享按钮+转发对话框+分享三级兜底链；测试 212→227/227+电池 26/26 本地+8/8 线上+冒烟 49/49+curl 七连+health 58；commit fdd9c9d）；前身每轮全量链（00005→00083 内容/commit/电池数）见文件内**
'@ @'
**当前线上 rev 00085-vf4（2026-09-05 v0.2.18.1 Community 点赞实心+动画轮：用户「那个点赞后能不能变成实心和有一个动画」（附 like/dislike 参考代码）→「只是要动画而已 一样是用爱心不要换」——爱心不换只取动画；hub+帖页点赞钮 .like-burst 粒子 span+点击一次性类 like-pop→图标 like-pop-icon 弹跳+粒子 like-burst-fly 迸发（animationend{once}+950ms 摘类、初始已点赞不重播、取消/401 回滚摘类、reduced-motion 只换实心）；零后端零共享文件；测试 227/227+电池 21/21 本地+7/7 线上+冒烟 49/49+curl 十连+health 58；commit 99a4f09）；前身每轮全量链（00005→00084 内容/commit/电池数）见文件内**
'@

Replace-Once "$M\MEMORY.md" @'
站点号当前 **v0.2.18.0**（2026-09-05 Community 转发+分享轮——用户「能不能在帖子的评论后面那边再添加转发按钮和分享按钮？」→问询钦定真转发（Twitter 式转发即发帖）；后端迁移 015 repost_of 加列+索引（无新表 health 58）+postRow 转发四字段+POST/DELETE /posts/:id/repost（同帖一次守卫 409+跳过 sha1 去重+postsWrite 共享配额+L0 仅非空转发语）；前端 hub 转发卡内嵌盒+帖页转发/分享按钮+转发对话框+分享三级兜底链；测试 212→227/227+电池 26/26 本地+8/8 线上+冒烟 49/49+curl 七连+health 58，rev 00084-rnh commit fdd9c9d（未 push）；前身 v0.2.17.0（头像/点赞/评论+独立帖页轮：social.js 四端点+新页 community-post.html，电池 31/31 本地+11/11 线上，rev 00083-jgk commit d3732e6）；前身 v0.2.16.0（多图/视频轮：上传端点+画廊+灯箱，电池 13/13，rev 00082-bpx commit 6124694））
'@ @'
站点号当前 **v0.2.18.1**（2026-09-05 Community 点赞实心+动画轮——用户「那个点赞后能不能变成实心和有一个动画」（附 like/dislike 参考代码）→「只是要动画而已 一样是用爱心不要换」：爱心图标不换只取动画；hub+帖页点赞钮 .like-burst 粒子 span+一次性类 like-pop（图标弹跳+粒子迸发，初始已点赞不重播/取消回滚摘类/reduced-motion 只换实心）；零后端零共享文件；测试 227/227+电池 21/21 本地+7/7 线上+冒烟 49/49+curl 十连+health 58，rev 00085-vf4 commit 99a4f09（未 push）；前身 v0.2.18.0（Community 转发+分享轮：后端迁移 015 repost_of+postRow 转发四字段+POST/DELETE /posts/:id/repost；前端 hub 转发卡内嵌盒+帖页转发/分享按钮+转发对话框+分享三级兜底链；测试 212→227/227+电池 26/26 本地+8/8 线上+冒烟 49/49+curl 七连+health 58，rev 00084-rnh commit fdd9c9d）；前身 v0.2.17.0（头像/点赞/评论+独立帖页轮：social.js 四端点+新页 community-post.html，电池 31/31 本地+11/11 线上，rev 00083-jgk commit d3732e6）；前身 v0.2.16.0（多图/视频轮：上传端点+画廊+灯箱，电池 13/13，rev 00082-bpx commit 6124694））
'@

Write-Host "全部 3 文件替换完成"
