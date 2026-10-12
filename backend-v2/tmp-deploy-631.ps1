# tmp-deploy-631.ps1 — v0.2.58.25 裁切弹窗+横幅增高+视频横幅 round (rev 00346-XXX 瞬态 → 二次烘焙终态 00347-???).
#   Frontend only: docs/assets/js/settings-modal.js (MN_CropDialog+MN_CompressVideo+MN_VideoCap)+community-profile.html (210px+视频链)+fluidcanvas.html (48.1) +
#   docs/assets/js/site-config.js (58.25+FC 48.1 双 changelog).
#   i18n 18 新键 x12 语。CSS 页面专属块 (skip inline-css.js)。后端 auth+social crop+030 迁移 (npm test 361/361) 已跑。
#   Site v0.2.58.24 -> v0.2.58.25; FC v10.28.48.0 -> 48.1; env fully from describe (zero new keys).
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
