# tmp-deploy-582.ps1 — v10.28.42.0 FC all cards opaque (user: make every card in FC opaque — frosted-glass era ends, 08-17 "100% opaque" standard revived; also fixes "background vanishes while dragging": with opaque faces the fc-moving glass suspension becomes a no-op for cards). Faces straight --card-bg-color, card-body blur removed, theme-tint/paint ::before back to opacity 1, injected lg layers blanket-hidden, SNE 62% mix untouched; site version unchanged v0.2.58.0; backend zero changes; env fully from describe, never printed; zero new keys
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
