# tmp-deploy-624.ps1 — v0.2.58.18 个人资料自定义横幅/头像 round (rev 00331-XXX 瞬态 → 二次烘焙终态 00332-???).
#   Frontend: docs/pages/community-profile.html (横幅渲染+编辑弹窗新组+图库选择器+头像图库入口) +
#   docs/assets/js/site-config.js (58.18 changelog). i18n: docs/assets/i18n/community-profile.i18n.js (11 新键族).
#   Backend: migrations/029_user_banner.sql + src/routes/public/auth.js (PATCH bannerUrl+avatarUrl 加固) +
#   src/routes/public/social.js (GET 守卫行).
#   Site v0.2.58.17 -> v0.2.58.18; FC v10.28.47.4 unchanged; env fully from describe (zero new keys).
#   Zero stream redirection (00298 lesson: *> / 2>&1 wraps NativeCommandError and kills the process).
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
