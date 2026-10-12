# tmp-deploy-505.ps1 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â v0.2.50.5 Messages ÃƒÂ§Ã‚Â§Ã‚Â»ÃƒÂ©Ã¢â€žÂ¢Ã‚Â¤ÃƒÂ¦Ã‚ÂµÃ¢â‚¬Â¹ÃƒÂ¨Ã‚Â¯Ã¢â‚¬Â¢ÃƒÂ§Ã‚Â¾Ã‚Â¤ÃƒÂ¥Ã¢â‚¬â„¢Ã…â€™ÃƒÂ¨Ã‚ÂÃ…Â ÃƒÂ¥Ã‚Â¤Ã‚Â©ÃƒÂ¨Ã‚Â½Ã‚Â® deployÃƒÂ¯Ã‚Â¼Ã‹â€ env ÃƒÂ¥Ã¢â‚¬Â¦Ã‚Â¨ÃƒÂ©Ã¢â‚¬Â¡Ã‚ÂÃƒÂ¤Ã‚Â»Ã…Â½ describe ÃƒÂ¥Ã‚ÂÃ¢â‚¬â€œÃƒÂ£Ã¢â€šÂ¬Ã‚ÂÃƒÂ§Ã‚Â»Ã‚ÂÃƒÂ¤Ã‚Â¸Ã‚ÂÃƒÂ¦Ã¢â‚¬Â°Ã¢â‚¬Å“ÃƒÂ¥Ã‚ÂÃ‚Â°ÃƒÂ¯Ã‚Â¼Ã¢â‚¬ÂºÃƒÂ©Ã¢â‚¬ÂºÃ‚Â¶ÃƒÂ¦Ã¢â‚¬â€œÃ‚Â°ÃƒÂ©Ã¢â‚¬ÂÃ‚Â®ÃƒÂ¯Ã‚Â¼Ã¢â‚¬Â°
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
