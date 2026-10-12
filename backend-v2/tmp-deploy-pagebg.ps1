# tmp-deploy-shapes.ps1 — v0.2.36.0 自由形状合并组部署（纯前端轮 env 零改动；env 全量只从 describe 取）
$ErrorActionPreference = 'Stop'
$gcloud = 'C:\Users\USER\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.ps1'
$img = 'asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest'

# 1) env 全量只从 describe 取（绝不手写、绝不打印）
$desc = & $gcloud run services describe mnationworld-web --region asia-southeast1 --format=json | Out-String
$j = $desc | ConvertFrom-Json
$envs = $j.spec.template.spec.containers[0].env
$envArg = ($envs | ForEach-Object { $_.name + '=' + $_.value }) -join ','
Write-Host ("env 条数: " + $envs.Count)

# 2) deploy（逗号参数必加引号——09-05 已两犯）
& $gcloud run deploy mnationworld-web `
  "--image=$img" `
  '--region' 'asia-southeast1' '--allow-unauthenticated' '--port' '8080' `
  '--memory' '512Mi' '--min-instances' '0' '--max-instances' '1' '--execution-environment' 'gen2' `
  '--add-volume=name=mn-data,type=cloud-storage,bucket=mn-backend-data-641398703651' `
  '--add-volume-mount=volume=mn-data,mount-path=/mnt/data' `
  "--set-env-vars=$envArg" `
  '--quiet'
Write-Host ("deploy 退出码: " + $LASTEXITCODE)
