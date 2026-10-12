# tmp-deploy-646.ps1 — FC v10.28.52.5 折叠出画加深+画外停一拍+展开加Q弹 round (rev 00377-XXX 瞬态 → 二次烘焙终态 00378-???).
#   用户两连：「为什么他没有短暂的滑出画面外？」+「在展开的时候按钮能不能也附加上Q弹效果」。
#   修法 = 52.4 折叠出画只 -40px 深（40px 宽按钮右缘恰贴屏幕边、完全离屏仅 ~0.2s）且 0.27s 极快眼睛易错过——
#   位移改四站（0% 右缘 214px 起步→28% 加速滑出 -80px 整体出画+40px 余量→50% 画外停留 ~0.2s linear 恒停
#   「短暂的滑出画面外」一眼可见→100% 回弹过冲 cubic-bezier(0.34,1.56,0.64,1) 落定 6px）+ Q弹改五站
#   （28% 微缩 0.85 蓄力→50% 画外保持→70% 回屏瞬间拉长 scale(1.35,0.65)→100% 回规 1）；
#   展开态 fine 规则新增 fcToggleInQSquash 0.28s（45% 弹出拉长 scale(1.3,0.7)→75% 过冲挤扁 scale(0.9,1.1)→100% 回规，
#   与基态 transition:left 0.25s 滑回并行；页面载入播放一次无妨）；
#   平板（粗指针）恒旧行为（266px 右缘+0.25s 滑动折叠）零回归；
#   site-config FC 52.4→52.5 + changelog 条目；站点恒 58.28；后端零改动 npm test 413/413；i18n 零新键；
#   ethereal.css/transitions.js/subnav.js/inline-css 零触碰（编辑器页豁免）。


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
