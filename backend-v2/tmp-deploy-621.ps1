# tmp-deploy-621.ps1 — v0.2.58.15 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡 round (rev 00325-XXX). Frontend only:
#   docs/assets/css/ethereal.css (.mn-lv-hovercard fixed 卡片块 + 药丸 scale(1.12) + @media(hover+fine) 门控) +
#   docs/assets/js/sidebar.js (initLevelHover/lvHoverHide/matchMedia 门控+renderSidebar 重挂) +
#   40 inline pages refreshed (inline-css.js) + docs/pages/fluidcanvas-editor.html (manual parity) +
#   docs/assets/js/site-config.js (58.15 changelog).
#   Site v0.2.58.14 -> v0.2.58.15; FC v10.28.47.4 unchanged; backend zero changes; env fully from describe
#   (zero new keys).
#   Zero stream redirection (00298 lesson: *> / 2>&1 wraps NativeCommandError and kills the process).
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
