# tmp-deploy-645.ps1 — FC v10.28.52.4 折叠按钮右侧+折叠出画回弹+Q弹拉长+按钮同高 round (rev 00375-XXX 瞬态 → 二次烘焙终态 00376-???).
#   用户三连：「我希望那个圆形是在右侧的」+「然后那个按钮回弹的时候能不能有一个Q弹 弹出时被拉长再回规原本现状的动画」
#   +「还有那个按钮的大小能不能和搜索栏一样 现在它的大小对比搜索栏有点小」。
#   修法 = 52.3 桌面驻左缘圆钮镜像到搜索胶囊右侧：胶囊回贴左缘（margin-left 移除），圆钮驻面板右缘内缩 6px
#   （left: calc(var(--asset-panel-w) - 46px) = 214px，top 12px 与胶囊上缘齐、40×40 与搜索胶囊同高、正圆 49.2/纯白 52.2 全保留）；
#   折叠动画 fcToggleOutSpring 0.9s 三站式（0% 右缘 214px 起步→30% 加速出画 -40px→100% 回弹过冲落定左缘 6px）+ Q弹
#   fcToggleQSquash 同 0.9s（0% 原形→30% 蓄力微缩 0.85→58% 弹出拉长 scale(1.35,0.65)→100% 回规 1）；展开=基态 0.25s 过渡滑回右缘；
#   平板（粗指针）恒旧行为（266px 右缘+0.25s 滑动折叠）零回归；
#   site-config FC 52.3→52.4 + changelog 条目；站点恒 58.28；后端零改动 npm test 413/413；i18n 零新键；
#   ethereal.css/transitions.js/subnav.js/inline-css 零触碰（编辑器页豁免）。


#   env: describe 全量 + 无新 env（GEMINI 二件套 636 已上线；SNAPSHOT_INTERVAL_MS 维持 86400000）.
#   Zero stream redirection (00298/00332 lesson: *> / 2>&1 wraps NativeCommandError and kills the process).
$ErrorActionPreference = 'Stop'
$gcloud = (Get-Command gcloud.ps1).Source
$img = 'asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest'

# 1) env fully from describe (never handwritten, never printed)
$desc = & $gcloud run services describe mnationworld-web --region asia-southeast1 --format=json | Out-String
$j = $desc | ConvertFrom-Json
$envs = $j.spec.template.spec.containers[0].env
$envArgs = @()
foreach ($e in $envs) {
  # 632 钦定（2026-10-02）：「备份一天备份一次」——定期快照 60s → 24h（开机/关机保底快照仍保留）；每轮维持
  if ($e.name -eq 'SNAPSHOT_INTERVAL_MS') { $envArgs += 'SNAPSHOT_INTERVAL_MS=86400000' }
  else { $envArgs += ($e.name + '=' + $e.value) }
}
# 636 新增二件套（值只活未跟踪 ps1+Cloud Run；AQ. 前缀非 AIza——当不透明 key 走 x-goog-api-key 头 Google 端点）
$hasGk = $false
foreach ($a in $envArgs) { if ($a -like 'GEMINI_API_KEY=*') { $hasGk = $true } }
if (-not $hasGk) { $envArgs += 'GEMINI_API_KEY=AQ.Ab8RN6I16BgqFGF1lgwcpPXlQXgoslaUAGrN6m3vIMEwUQAfuA' }
# 模型恒强制 gemini-3.8-flash（线上探测 404：gemini-2.5-flash 退役新用户——describe 旧值永不复用）
$envArgs = @($envArgs | Where-Object { $_ -notlike 'GEMINI_MODEL=*' }) + @('GEMINI_MODEL=gemini-3.8-flash')
$envArg = ($envArgs -join ',')
Write-Host ("env count: " + $envArgs.Count + " (gemini +2, zero dup)")

# 2) deploy (comma args always quoted)
& $gcloud run deploy mnationworld-web `
  "--image=$img" `
  '--region' 'asia-southeast1' '--allow-unauthenticated' '--port' '8080' `
  '--memory' '512Mi' '--min-instances' '0' '--max-instances' '1' '--execution-environment' 'gen2' `
  '--add-volume=name=mn-data,type=cloud-storage,bucket=mn-backend-data-641398703651' `
  '--add-volume-mount=volume=mn-data,mount-path=/mnt/data' `
  "--set-env-vars=$envArg" `
  '--quiet'
Write-Host ("deploy exit code: " + $LASTEXITCODE)
