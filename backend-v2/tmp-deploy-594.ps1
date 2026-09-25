# tmp-deploy-594.ps1 — admin 订阅发放记录 round (user: "订阅发放的后端记录可以查看是否生效（排列方式：生效 · 高级），然后下方显示发放记录（显示发放时间什么时候开始什么时候结束，总共发放了几次" → 钦定：用户详情内 + 每用户当前订阅状态). Admin+backend-only: backend-v2/src/routes/staff/subscriptions.js (grant audit carries prevExpiry/nextExpiry/months + new GET /api/staff/subscriptions/grants/:userId) + docs/admin/js/pages-users.js (订阅发放记录 card) + docs/assets/i18n/admin.i18n.js (15 new keys x12 langs). Site version unchanged v0.2.58.0; FC unchanged v10.28.45.2; env fully from describe, never printed
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
