# tmp-deploy-505.ps1 Ã¢â‚¬â€ v0.2.50.5 Messages Ã§Â§Â»Ã©â„¢Â¤Ã¦Âµâ€¹Ã¨Â¯â€¢Ã§Â¾Â¤Ã¥â€™Å’Ã¨ÂÅ Ã¥Â¤Â©Ã¨Â½Â® deployÃ¯Â¼Ë†env Ã¥â€¦Â¨Ã©â€¡ÂÃ¤Â»Å½ describe Ã¥Ââ€“Ã£â‚¬ÂÃ§Â»ÂÃ¤Â¸ÂÃ¦â€°â€œÃ¥ÂÂ°Ã¯Â¼â€ºÃ©â€ºÂ¶Ã¦â€“Â°Ã©â€Â®Ã¯Â¼â€°
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
