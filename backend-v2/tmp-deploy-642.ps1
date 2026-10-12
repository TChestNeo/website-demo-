# tmp-deploy-642.ps1 — FC v10.28.52.1 边缘抽屉顶部导航平台同款滑动胶囊 round (rev 00369-XXX 瞬态 → 二次烘焙终态 00370-???).
#   用户「那个FC编辑器点击边缘与边框之后滑出的左侧菜单的顶部的全部和我的 的左右切换能不能是和平台一样的滑动的
#   还有把那个My改成我，界面什么语言就什么语言不要参其他语言」。
#   修法 = fluidcanvas-editor.html 边缘抽屉顶部导航 .segmented-control → .subnav[data-slider] 平台原版（subnav.js
#   注入 0.55s 滑动白胶囊 + 尾部 blob + slime 拉伸）+ subnav.js 引入 + edgeNavResync（圆球滑出挤压后重对齐）
#   + tabMy 兜底「我」+ zh/zh-Hant 词典「我」；site-config FC 52.0→52.1 + changelog 条目；站点恒 58.28；
#   后端零改动 npm test 413/413；i18n 无新键（tabMy 值改）；ethereal.css/inline-css 零触碰（编辑器页豁免）。
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
