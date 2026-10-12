# tmp-deploy-student.ps1 — v0.2.44.0 deploy (env fully from describe, never printed;
# appends 2 student-price Stripe Price IDs — empty = deploy anyway, buttons honestly 409; fill later = env-only redeploy)
param([string]$PriceBasicStudent = '', [string]$PriceBasicStudentOnce = '')
$ErrorActionPreference = 'Stop'
$gcloud = 'C:\Users\USER\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.ps1'
$img = 'asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest'

# 1) env fully from describe (never handwritten, never printed)
$desc = & $gcloud run services describe mnationworld-web --region asia-southeast1 --format=json | Out-String
$j = $desc | ConvertFrom-Json
$envs = $j.spec.template.spec.containers[0].env
$envArg = ($envs | ForEach-Object { $_.name + '=' + $_.value }) -join ','
$envArg += ',STRIPE_PRICE_BASIC_STUDENT=' + $PriceBasicStudent
$envArg += ',STRIPE_PRICE_BASIC_STUDENT_ONCE=' + $PriceBasicStudentOnce
$b1 = if ($PriceBasicStudent) { 'set' } else { 'empty' }
$b2 = if ($PriceBasicStudentOnce) { 'set' } else { 'empty' }
Write-Host ("env count: " + $envs.Count + " + 2 student-price (monthly=" + $b1 + " yearly=" + $b2 + ")")

# 2) deploy (comma args always quoted — hit twice on 09-05)
& $gcloud run deploy mnationworld-web `
  "--image=$img" `
  '--region' 'asia-southeast1' '--allow-unauthenticated' '--port' '8080' `
  '--memory' '512Mi' '--min-instances' '0' '--max-instances' '1' '--execution-environment' 'gen2' `
  '--add-volume=name=mn-data,type=cloud-storage,bucket=mn-backend-data-641398703651' `
  '--add-volume-mount=volume=mn-data,mount-path=/mnt/data' `
  "--set-env-vars=$envArg" `
  '--quiet'
Write-Host ("deploy exit code: " + $LASTEXITCODE)
