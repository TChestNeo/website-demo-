# tmp-deploy-626.ps1 — v0.2.58.20 个人资料头像 <-> FC 频道主页头像双向同步 round (rev 00336-XXX 瞬态 → 二次烘焙终态 00337-???).
#   Frontend only: docs/pages/community-profile.html (编辑弹窗同步勾选+保存 raw setItem 合并写 slati_user) +
#   docs/pages/fluidcanvas.html (频道卡头像图/相机徽章/点击换头像 PATCH 只发 avatarUrl 绝不 bio) +
#   docs/assets/js/site-config.js (58.20 + FC 48.0 changelog).
#   i18n: docs/assets/i18n/community-profile.i18n.js (1 新键族) + docs/assets/i18n/fluidcanvas.i18n.js (6 新键族).
#   Backend: zero changes. Site v0.2.58.19 -> v0.2.58.20; FC v10.28.47.4 -> v10.28.48.0; env fully from describe (zero new keys).
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
