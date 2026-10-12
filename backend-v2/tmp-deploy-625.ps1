# tmp-deploy-625.ps1 — v0.2.58.19 个人资料横幅/头像订阅分层 round (rev 00334-XXX 瞬态 → 二次烘焙终态 00335-???).
#   Frontend only: docs/pages/community-profile.html (纯前端门禁 sub-locked/blockGif/两升级链接) +
#   docs/assets/js/site-config.js (58.19 changelog). i18n: docs/assets/i18n/community-profile.i18n.js (3 新键族).
#   Backend: zero changes (029/auth.js/social.js 58.18 锚保持). FC v10.28.47.4 unchanged (不互通钦定).
#   Site v0.2.58.18 -> v0.2.58.19; env fully from describe (zero new keys).
#   Zero stream redirection (00298/00332 lesson: *> / 2>&1 wraps NativeCommandError and kills the process).
$ErrorActionPreference = 'Stop'
$gcloud = (Get-Command gcloud.ps1).Source
$img = 'asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest'

# 1) env fully from describe (never handwritten, never printed)
$desc = & $gcloud run services describe mnationworld-web --region asia-southeast1 --format=json | Out-String
$j = $desc | ConvertFrom-Json
$envs = $j.spec.template.spec.containers[0].env
$envArgs = @()
foreach ($e in $envs) { $envArgs += ($e.name + '=' + $e.value) }
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
