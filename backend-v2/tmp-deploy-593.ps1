# tmp-deploy-593.ps1 — FC v10.28.45.0 tablet merge-edge flush + touch image upload overlay + 115-col viewport round (user: "平板移动端在合拼卡片之后边缘会不齐，和无法点击上传图片" + "把125格宽减少一个10格"). Frontend-only: docs/pages/fluidcanvas-editor.html (mergeCards bbox landing, card-upload-input overlay on char-avatar/map-canvas, computeCols 115 + STAGE_COLS 115) + docs/pages/article.html (STAGE_COLS 115) + site-config.js FC version bump. fc-touch.js untouched this round. Site version unchanged v0.2.58.0; env fully from describe, never printed; zero new keys
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
