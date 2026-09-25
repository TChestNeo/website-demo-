# tmp-deploy-596.ps1 — 顶部栏缩身+迁移按钮白底白字修复 round (user: 「FC编辑页的顶部栏缩小一些太大了」+「迁移按钮为什么文字默认是白底白字的」). Frontend-only: docs/pages/fluidcanvas-editor.html (.editor-header 缩身 scoped 规则 + .migrate-btn 子代选择器双重 invert 修复) + docs/assets/js/site-config.js (45.1 changelog). Site version unchanged v0.2.58.0; FC v10.28.45.0 → v10.28.45.1; env fully from describe, never printed
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
