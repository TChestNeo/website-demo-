# tmp-deploy-598.ps1 — 图库标签+图库桥+AI 混合查重 round (rev 00298-). Backend + frontend:
#   src/config.js (deepseek.model from env) + src/routes/public/tags.js (POST /api/tags/dedup) + src/server.js +
#   docs/pages/fluidcanvas-editor.html (标签 store/筛选/桥/管理) + docs/assets/i18n/fluidcanvas.i18n.js +
#   docs/assets/js/site-config.js (46.0 changelog). Site version unchanged v0.2.58.0; FC v10.28.45.2 → v10.28.46.0;
#   env from describe + 2 new keys: DEEPSEEK_API_KEY + DEEPSEEK_MODEL (值只进此未跟踪脚本，绝不入 commit)
$ErrorActionPreference = 'Stop'
$gcloud = (Get-Command gcloud.ps1).Source
$img = 'asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest'

# 1) env fully from describe (never handwritten, never printed)
$desc = & $gcloud run services describe mnationworld-web --region asia-southeast1 --format=json | Out-String
$j = $desc | ConvertFrom-Json
$envs = $j.spec.template.spec.containers[0].env
$envNames = @($envs | ForEach-Object { $_.name })
$envArgs = @()
foreach ($e in $envs) { $envArgs += ($e.name + '=' + $e.value) }
$envArgs += 'DEEPSEEK_API_KEY=sk-8486d5cbdf9049e68f8d30f606ae1a95'
$envArgs += 'DEEPSEEK_MODEL=deepseek-v4-flash'
$envArg = ($envArgs -join ',')
Write-Host ("env count: " + $envArgs.Count + " (2 new: DEEPSEEK_API_KEY/DEEPSEEK_MODEL)")

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
