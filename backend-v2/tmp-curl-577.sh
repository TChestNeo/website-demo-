#!/bin/sh
# tmp-curl-577.sh — v10.28.39.1 部署后 curl 链（health + 版本锚 + 新码在场 + 关键页 200）
echo "── health ──"
curl -s -m 20 https://mnationworld.com/api/health
echo ""
echo "── site-config 版本锚（期望 2 行：58.0 / 39.1）──"
curl -s -m 20 https://mnationworld.com/assets/js/site-config.js | grep -o "window\.MN_SITE_VERSION = '[^']*'\|window\.FLUIDCANVAS_VERSION = '[^']*'"
echo "── 编辑器页新码在场（期望 ≥1：endViewPan / ≥1：fc-moving 滚动挂起）──"
H=$(curl -s -m 30 https://mnationworld.com/pages/fluidcanvas-editor.html)
echo "$H" | grep -c "endViewPan"
echo "$H" | grep -c "150ms 防抖"
echo "── 页面状态码 ──"
curl -s -o /dev/null -m 20 -w "home %{http_code}\n" https://mnationworld.com/
curl -s -o /dev/null -m 20 -w "editor %{http_code}\n" https://mnationworld.com/pages/fluidcanvas-editor.html
curl -s -o /dev/null -m 20 -w "article %{http_code}\n" "https://mnationworld.com/pages/article.html?id=ART-000004"
