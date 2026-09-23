# tmp-deploy-583.ps1 — admin subdomain round (user: turn the backend admin into admin.mnationworld.com). entrypoint.js Host routing three branches: story.mnationworld.com -> docs/story (kept), admin.mnationworld.com -> docs/admin root direct (new), main domain -> docs/ (kept, /admin/ dual entry intact); /api proxy branch precedes host routing so the admin subdomain hits the API same-origin zero CORS; admin app itself path-agnostic (relative paths + hash routing + '/api' base) — zero app changes. Site version unchanged v0.2.58.0; backend zero changes (entrypoint only); env fully from describe, never printed; zero new keys
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
