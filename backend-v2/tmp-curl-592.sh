#!/bin/sh
# tmp-curl-592.sh — v10.28.44.2 部署后 curl 链（health 60 表 + 版本锚 58.0/44.2 + 菜单进面板新码 + 搬家/子域）
echo "── health（期望 60 表）──"
curl -s -m 20 https://mnationworld.com/api/health
echo ""
echo "── site-config 版本锚（期望 58.0 / 44.2）+ rev 00292- ──"
SC=$(curl -s -m 20 https://mnationworld.com/assets/js/site-config.js)
echo "$SC" | grep -o "window\.MN_SITE_VERSION = '[^']*'\|window\.FLUIDCANVAS_VERSION = '[^']*'"
echo "$SC" | grep -c "rev 00292-"
echo "── 编辑器页菜单进面板新码（期望 1 1 1 1）──"
H=$(curl -s -m 30 https://mnationworld.com/pages/fluidcanvas-editor.html)
echo "$H" | grep -c "panel.appendChild(contextMenu)"
echo "$H" | grep -c "more_horiz"
echo "$H" | grep -c "position: static;"
echo "$H" | grep -c "left: 14px; top: auto; bottom: 14px;"
echo "── 搬家 302 + 子域根 + admin 资源 ──"
curl -s -o /dev/null -m 20 -w "admin-302 %{http_code} -> %{redirect_url}\n" https://mnationworld.com/admin
curl -s -o /dev/null -m 20 -w "admin-root %{http_code}\n" https://admin.mnationworld.com/
curl -s -o /dev/null -m 20 -w "admin-appjs %{http_code}\n" https://admin.mnationworld.com/js/app.js
curl -s -o /dev/null -m 20 -w "admin-apijs %{http_code}\n" https://admin.mnationworld.com/assets/js/api.js
echo "── 主站首页 ──"
curl -s -o /dev/null -m 20 -w "home %{http_code}\n" https://mnationworld.com/
