# tmp-curl-fadefix.ps1 — v0.2.50.3 curl 链（版本双线 + transitions.js 新标记在线）
$sc = (Invoke-WebRequest 'https://mnationworld.com/assets/js/site-config.js' -TimeoutSec 30).Content
Write-Host ('sitever_50.3: ' + $sc.Contains("window.MN_SITE_VERSION = 'v0.2.50.3';"))
Write-Host ('fc_35.4: ' + $sc.Contains("window.FLUIDCANVAS_VERSION = 'v10.28.35.4';"))
Write-Host ('changelog: ' + $sc.Contains('进场帧健康隐形修复'))
$tr = (Invoke-WebRequest 'https://mnationworld.com/assets/js/transitions.js' -TimeoutSec 30).Content
Write-Host ('rAF_wave: ' + $tr.Contains('requestAnimationFrame(waveTick)'))
Write-Host ('guard_getAnimations: ' + $tr.Contains('hasActiveOpacityAnim'))
Write-Host ('wc_writes: ' + ([regex]::Matches($tr, 'style\.willChange = ')).Count)
Write-Host ('dual_mode_original: ' + $tr.Contains("'opacity 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)'"))
Write-Host ('dual_mode_light: ' + $tr.Contains("'transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)'"))
Write-Host ('safe_timer: ' + $tr.Contains('animated.length * delay + 600'))
