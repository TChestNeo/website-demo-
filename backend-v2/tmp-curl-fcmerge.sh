#!/bin/bash
# tmp-curl-fcmerge.sh — v0.2.45.0 线上验证链（FC 三页合一）
B=https://mnationworld.com
PASS=0; FAIL=0
ck() { if [ "$2" = "ok" ]; then PASS=$((PASS+1)); echo "✅ $1"; else FAIL=$((FAIL+1)); echo "❌ $1 — $3"; fi; }

H=$(curl -s --max-time 30 $B/api/health)
echo "$H" | grep -q '"status":"ok"' && echo "$H" | grep -q '"tables":58' && ck "/api/health 58 表 ok" ok || ck "/api/health" no "$H"

S=$(curl -s --max-time 30 $B/assets/js/site-config.js)
echo "$S" | grep -q "v0.2.45.0" && echo "$S" | grep -q "v10.28.34.0" && ck "site-config 双版本串" ok || ck "site-config 双版本串" no "缺版本串"

C1=$(curl -s --max-time 30 -o /dev/null -w '%{http_code}' $B/pages/fluidcanvas.html)
[ "$C1" = "200" ] && ck "fluidcanvas.html 200" ok || ck "fluidcanvas.html 200" no "$C1"

A=$(curl -s --max-time 30 "$B/pages/fluidcanvas.html?view=analytics")
echo "$A" | grep -q 'id="periodTabs"' && ck "?view=analytics 含 periodTabs" ok || ck "?view=analytics 含 periodTabs" no
echo "$A" | grep -q 'id="artStats"' || true

R=$(curl -s --max-time 30 "$B/pages/fluidcanvas.html?view=articles")
echo "$R" | grep -q 'id="artStats"' && ck "?view=articles 含 artStats" ok || ck "?view=articles 含 artStats" no

S1=$(curl -s --max-time 30 $B/pages/fluidcanvas-analytics.html)
echo "$S1" | grep -q 'fluidcanvas.html?view=analytics' && ck "analytics stub 含目标" ok || ck "analytics stub" no
S2=$(curl -s --max-time 30 $B/pages/fluidcanvas-articles.html)
echo "$S2" | grep -q 'fluidcanvas.html?view=articles' && ck "articles stub 含目标" ok || ck "articles stub" no

C2=$(curl -s --max-time 30 -o /dev/null -w '%{http_code}' $B/pages/fluidcanvas-editor.html)
[ "$C2" = "200" ] && ck "editor 200 回归" ok || ck "editor 200 回归" no "$C2"

echo ""
[ $FAIL -eq 0 ] && echo "🎉 线上链 $PASS/$PASS" || echo "💔 失败 $FAIL / 共 $((PASS+FAIL))"
exit $FAIL
