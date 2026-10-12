# tmp-deploy-628.ps1 — v0.2.58.22 横幅订阅三层门禁+金罩+预设扩展 round (rev 00340-XXX 瞬态 → 二次烘焙终态 00341-???).
#   Frontend only: docs/pages/community-profile.html (三层门禁 canGif/金罩相邻共罩/预设网格+680px 弹窗+80px 缩略) +
#   docs/assets/js/settings-modal.js (stCanImg/stCanGif/ST_BG_DEFS/13 预设/金罩/400px 弹窗 4 列) +
#   docs/assets/i18n/common.i18n.js (5 新键×12 语) + docs/assets/i18n/community-profile.i18n.js (3 新键×12 语) +
#   docs/assets/js/site-config.js (58.22 changelog；FC 48.0 恒).
#   i18n: i18n OpenCC 重生成 zh-Hant.
#   Backend: CARD_BG_KEYS 白名单六键 (auth.js+social.js) only. Site v0.2.58.21 -> v0.2.58.22; FC 恒 v10.28.48.0; env fully from describe (zero new keys).
#   Zero stream redirection (00298/00332 lesson: *> / 2>&1 wraps NativeCommandError and kills the process).
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
