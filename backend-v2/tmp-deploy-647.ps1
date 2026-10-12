# tmp-deploy-647.ps1 — FC v10.28.53.0 边缘 Mask 化 round (rev 00379-XXX 瞬态 → 二次烘焙终态 00380-???).
#   用户三诉求：「AI 生成的自定义边缘应用后画布看不见」+「边缘像 Alight Motion 的 Mask——图片只显示在边缘范围内、形状跟随边缘 + 边缘选择区图片与边缘同步勾选」+「边缘要多出去一点」。
#   修法 = 自定义边缘无自动外板（setCardEdge 跳过 custom:）+ customEdgeRecipe 的 cardOverlay:[] → 剪影只活在 ::before(z -1)，图片卡 .card-img-bg(z 0)/条纹卡盖住剪影 → 应用即看不见；
#   Mask 化（CSS --card-mask-clip 只剪内容层 .card-img-bg/.card-stripes，卡根不剪 → box-shadow/选中环/外板照常）
#   + 勾选（抽屉 #fcEdgeMaskSync + setEdgeMaskSync 写旗→applyCardBg→renderEdgeMaskSec 同步 UI + 草稿 '1'/'0' 往返）
#   + 外扩（CUSTOM_EDGE_EXPAND = 0.06 + expandClipPct：装饰剪影多出去一圈；Mask 裁剪窗用原形 clipRaw）；
#   站点恒 58.28；后端零改动 npm test 413/413；i18n 新键 fc.edge.maskSync ×12 语；
#   ethereal.css/transitions.js/subnav.js/inline-css 零触碰（编辑器页豁免）。
#   注：checkpoint 提示 gcloud 用 (Get-Command gcloud.cmd).Source（646 版为 gcloud.ps1，本克隆保留 ps1，如需切换见注释）。


#   env: describe 全量 + 无新 env（GEMINI 二件套 636 已上线；SNAPSHOT_INTERVAL_MS 维持 86400000）.
#   Zero stream redirection (00298/00332 lesson: *> / 2>&1 wraps NativeCommandError and kills the process).
$ErrorActionPreference = 'Stop'
$gcloud = (Get-Command gcloud.ps1).Source
$img = 'asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest'

# 1) env fully from describe (never handwritten, never printed)
$desc = & $gcloud run services describe mnationworld-web --region asia-southeast1 --format=json | Out-String
$j = $desc | ConvertFrom-Json
$envs = $j.spec.template.spec.containers[0].env
$envArgs = @()
foreach ($e in $envs) {
  # 632 钦定（2026-10-02）：「备份一天备份一次」——定期快照 60s → 24h（开机/关机保底快照仍保留）；每轮维持
  if ($e.name -eq 'SNAPSHOT_INTERVAL_MS') { $envArgs += 'SNAPSHOT_INTERVAL_MS=86400000' }
  else { $envArgs += ($e.name + '=' + $e.value) }
}
# 636 新增二件套（值只活未跟踪 ps1+Cloud Run；AQ. 前缀非 AIza——当不透明 key 走 x-goog-api-key 头 Google 端点）
$hasGk = $false
foreach ($a in $envArgs) { if ($a -like 'GEMINI_API_KEY=*') { $hasGk = $true } }
if (-not $hasGk) { $envArgs += 'GEMINI_API_KEY=AQ.Ab8RN6I16BgqFGF1lgwcpPXlQXgoslaUAGrN6m3vIMEwUQAfuA' }
# 模型恒强制 gemini-3.8-flash（线上探测 404：gemini-2.5-flash 退役新用户——describe 旧值永不复用）
$envArgs = @($envArgs | Where-Object { $_ -notlike 'GEMINI_MODEL=*' }) + @('GEMINI_MODEL=gemini-3.8-flash')
$envArg = ($envArgs -join ',')
Write-Host ("env count: " + $envArgs.Count + " (gemini +2, zero dup)")

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
