# tmp-deploy-595.ps1 — FC 翻译 round (user: "还有 FC还没有做翻译" → 钦定：两页一起翻 + 卡片类型名翻译成和平台一样的). Frontend-only: docs/assets/i18n/fluidcanvas.i18n.js (new, 505 keys x12 langs) + docs/assets/js/i18n.js (data-i18n-title scan, 6-line addition) + docs/pages/fluidcanvas-editor.html + docs/pages/fluidcanvas.html (i18n three-piece mount + lazy T + zh chrome + labelEdited payload branch) + docs/assets/js/site-config.js (45.0 changelog). Site version unchanged v0.2.58.0; FC v10.28.44.3 → v10.28.46.0; env fully from describe, never printed
$ErrorActionPreference = 'Stop'
$gcloud = (Get-Command gcloud.ps1).Source
$img = 'asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest'

# 1) env fully from describe (never handwritten, never printed)
$desc = & $gcloud run services describe mnationworld-web --region asia-southeast1 --format=json | Out-String
$j = $desc | ConvertFrom-Json
$envs = $j.spec.template.spec.containers[0].env
$envArg = ($envs | ForEach-Object { $_.name + '=' + $_.value }) -join ','
Write-Host ("env count: " + $envs.Count + " (zero new keys)")

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
