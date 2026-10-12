# tmp-deploy-619.ps1 — v0.2.58.13 折叠侧栏等级水杯双浪同色深蓝+慢浪 z-1 层 round (rev 00321-XXX). Frontend only:
#   docs/assets/css/ethereal.css (dual-wave same-color: wdeep background var(--mn-lv-light)->var(--color-primary) +
#   z-index:-2, --mn-lv-light assignment deleted; new slow wave .mn-lv-wlightwave2 same geometry + top -12px +
#   z-index:-1 + 2.5s; fast wave z-index:0; fill z-index:0 stacking context) +
#   41 inline pages refreshed (inline-css.js) + docs/pages/fluidcanvas-editor.html (manual parity) +
#   docs/assets/js/sidebar.js (insert slow wave div) + docs/assets/js/site-config.js (58.13 changelog).
#   Site v0.2.58.12 -> v0.2.58.13; FC v10.28.47.4 unchanged; backend zero changes; env fully from describe
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
