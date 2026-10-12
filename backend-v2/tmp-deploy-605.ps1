# tmp-deploy-605.ps1 — v0.2.58.2 折叠侧栏等级纵向药丸+经验环 round (rev 00305-). Frontend only:
#   docs/assets/css/ethereal.css (mn-lv-pill rules + avatar spacing) + docs/assets/js/sidebar.js
#   (dual-view badge) + 41 inline pages refreshed (inline-css.js) + docs/pages/fluidcanvas-editor.html
#   (manual parity) + docs/assets/js/site-config.js (58.2 changelog).
#   Site v0.2.58.1 -> v0.2.58.2; FC v10.28.47.4 unchanged; backend zero changes;
#   env fully from describe (zero new keys).
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
