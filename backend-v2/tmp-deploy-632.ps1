# tmp-deploy-632.ps1 — v0.2.58.26 FC 首页真数据+不透明卡片 round (rev 00348-XXX 瞬态 → 二次烘焙终态 00349-???).
#   fluidcanvas.html (FC_OVERVIEW 数据层+不透明 CSS+假数据清空) + site-config.js (58.26+FC 48.2 双 changelog) +
#   i18n fluidcanvas 30 新键 x12 语 + 后端 routes/public/fc-overview.js 新端点 (npm test 366/366).
#   Site v0.2.58.25 -> v0.2.58.26; FC v10.28.48.1 -> 48.2; env fully from describe (zero new keys).
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
  # 用户钦定（2026-10-02）：「备份一天备份一次」——定期快照 60s → 24h（开机/关机保底快照仍保留）
  if ($e.name -eq 'SNAPSHOT_INTERVAL_MS') { $envArgs += 'SNAPSHOT_INTERVAL_MS=86400000' }
  else { $envArgs += ($e.name + '=' + $e.value) }
}
$envArg = ($envArgs -join ',')
Write-Host ("env count: " + $envArgs.Count + " (zero new)")

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
