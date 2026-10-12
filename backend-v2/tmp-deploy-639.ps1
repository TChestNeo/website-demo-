# tmp-deploy-639.ps1 — FC v10.28.52.0 等级奖励 round (rev 00363-XXX 瞬态 → 二次烘焙终态 00364-???).
#   个人 Lv.2/6/9/12 + 团队 Lv.2/6/9/12(×1.5) 升级领奖：成就/徽章/称号/相框/免费名片边缘。
#   前端 = sidebar claim 链 + community-profile 成就&徽章区/称号金药丸/相框环/编辑弹窗选择器/边缘门 +
#   fluidcanvas 团队等级徽章+成就条+关注切换 + 编辑器 teamId 发布分键 + i18n 30 新键 ×12 语。
#   后端 = 033_rewards.sql 五新表 + team-xp 五事件双向对称 + rewards claim/me + auth PATCH 装饰门
#   + social 钩子 + server 注册 (npm test 413/413)。站点恒 v0.2.58.26。
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
