#!/bin/sh
# tmp-curl-593.sh — v10.28.44.3 部署后 curl 链（health 60 表 + 版本锚 58.0/44.3 + 合拼 bbox/上传覆盖层/115 格新码 + 搬家/子域）
echo "── health（期望 60 表）──"
curl -s -m 20 https://mnationworld.com/api/health
echo ""
echo "── site-config 版本锚（期望 58.0 / 44.3）+ rev 00293- ──"
SC=$(curl -s -m 20 https://mnationworld.com/assets/js/site-config.js)
echo "$SC" | grep -o "window\.MN_SITE_VERSION = '[^']*'\|window\.FLUIDCANVAS_VERSION = '[^']*'"
echo "$SC" | grep -c "rev 00293-"
echo "── 编辑器页新码（期望 1 1 1 1 1 1）──"
H=$(curl -s -m 30 https://mnationworld.com/pages/fluidcanvas-editor.html)
echo "$H" | grep -c "var tbb = cardBBox(target, tL, tT);"
echo "$H" | grep -c "card-upload-input"
echo "$H" | grep -c "avatar.replaceChildren(fi)"
echo "$H" | grep -c "return 115;"
echo "$H" | grep -c "STAGE_COLS = 115"
echo "$H" | grep -c "map-canvas:not(.map-empty) .card-upload-input"
echo "── 文章页 115 格（期望 1）──"
A=$(curl -s -m 30 https://mnationworld.com/pages/article.html)
echo "$A" | grep -c "STAGE_COLS = 115"
echo "── fc-touch.js inEditableZone input 锚（期望 1）──"
T=$(curl -s -m 20 https://mnationworld.com/assets/js/fc-touch.js)
echo "$T" | grep -c "contenteditable=\"true\""
echo "── 搬家 302 + 子域根 + admin 资源 ──"
curl -s -o /dev/null -m 20 -w "admin-302 %{http_code} -> %{redirect_url}\n" https://mnationworld.com/admin
curl -s -o /dev/null -m 20 -w "admin-root %{http_code}\n" https://admin.mnationworld.com/
curl -s -o /dev/null -m 20 -w "admin-appjs %{http_code}\n" https://admin.mnationworld.com/js/app.js
curl -s -o /dev/null -m 20 -w "admin-apijs %{http_code}\n" https://admin.mnationworld.com/assets/js/api.js
echo "── 主站首页 ──"
curl -s -o /dev/null -m 20 -w "home %{http_code}\n" https://mnationworld.com/