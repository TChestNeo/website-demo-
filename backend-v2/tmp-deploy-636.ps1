# tmp-deploy-636.ps1 — FC v10.28.50.0 边缘抽屉+AI 生成+本地库+边缘仓库 round (rev 00356-XXX 瞬态 → 二次烘焙终态 00357-???).
#   fluidcanvas-editor.html (fcEdgeDrawer 左侧抽屉/15 样本/AI 生成弹窗/自定义本地库/仓库上传弹窗/圆球) +
#   article.html (customEdges 消费：edge 直写 clipPath/border 框环子层) +
#   site-config.js (FC 50.0 单 changelog；站点恒 v0.2.58.26) +
#   i18n 38 新键 ×12 语. 后端 = fc-edgegen.js + fc-edges.js + 031_fc_edges.sql + budget/config/server + 两测试件 (npm test 389/389).
#   env: describe 全量 + 新增 GEMINI_API_KEY/GEMINI_MODEL（AI 生成只 Gemini Flash——key 只活本未跟踪 ps1+Cloud Run env，绝不 commit）;
#   SNAPSHOT_INTERVAL_MS 维持 86400000 (632 钦定一天一备份).
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
# 636 新增二件套（值只活本文件+Cloud Run；AQ. 前缀非 AIza——当不透明 key 走 x-goog-api-key 头 Google 端点）
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
