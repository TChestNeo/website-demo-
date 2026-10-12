# tmp-deploy-644.ps1 — FC v10.28.52.3 折叠按钮搬搜索菜单左侧+折叠出画回弹 round (rev 00373-XXX 瞬态 → 二次烘焙终态 00374-???).
#   用户「然后FC编辑器左侧的菜单的折叠按钮能不能变成是放在搜索菜单左侧那边再多出一个圆形，
#   然后我希望折叠的时候他会先跑到画面外然后再回弹弹出这样」。
#   修法 = 桌面（细指针）展开态按钮从面板右缘 266px 改驻左缘 6px=搜索菜单左侧新圆钮（top 16px 与 40px 高
#   搜索胶囊垂直对中；32×32 正圆 49.2 保留、纯白 52.2 保留）；搜索胶囊右移让位（内联 width 搬入 CSS，
#   细指针下 width:calc(100% - 38px)+margin-left:38px）；折叠动画=fcToggleOutSpring 0.9s
#   （0% 左缘 6px 起步→30% 加速跑出画面外 -40px→100% 回弹过冲落定 6px；展开态恒驻原地不动）；
#   平板（粗指针）恒旧行为（266px 右缘+0.25s 滑动折叠）零回归；
#   site-config FC 52.2→52.3 + changelog 条目；站点恒 58.28；后端零改动 npm test 413/413；i18n 零新键；
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
