# tmp-deploy-600.ps1 â€” æ·»åŠ å›¾åƒå¼¹å±‚åŠ å¤§ round (rev 00300-). Frontend only:
#   docs/pages/fluidcanvas-editor.html (å¼¹å±‚ 440px/3 åˆ—/380px æ»šåŠ¨) + docs/assets/js/site-config.js (47.1 changelog).
#   Site version unchanged v0.2.58.0; FC v10.28.47.0 â†’ v10.28.47.1; backend zero changes;
#   env fully from describe (DEEPSEEK äºŒä»¶å¥— 00298 å·²åœ¨ä½, é›¶æ–°é”®). é›¶æµé‡å®šå‘ç›´è·‘ï¼ˆ00298 æ•™è®­ï¼š*> / 2>&1 åŒ… NativeCommandError æ€è¿›ç¨‹ï¼‰
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
