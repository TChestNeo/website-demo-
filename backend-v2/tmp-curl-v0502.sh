#!/bin/bash
# tmp-curl-v0502.sh — v0.2.50.2 线上 curl 验证链
cd /c/Users/USER/Downloads/stitch_slatiworld_micronation_interface || exit 1

H=$(curl -s https://mnationworld.com/api/health)
echo "health: $H"

S=$(curl -s https://mnationworld.com/assets/js/site-config.js)
echo "site-config v0502: $(echo "$S" | grep -c "window.MN_SITE_VERSION = 'v0.2.50.2';")  fc v1035: $(echo "$S" | grep -c "window.FLUIDCANVAS_VERSION = 'v10.28.35.4';")"

T=$(curl -s https://mnationworld.com/assets/js/transitions.js)
echo "LIGHT gate: $(echo "$T" | grep -c "var LIGHT = getFilename(window.location.pathname) === 'messages.html';")"
echo "light entrance (transform-only): $(echo "$T" | grep -c "'transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)'")"
echo "orig entrance (opacity+transform): $(echo "$T" | grep -c "'opacity 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)'")"
echo "stagger60: $(echo "$T" | grep -c "var STAGGER_DELAY = 60;")  light40: $(echo "$T" | grep -c "var LIGHT_STAGGER_DELAY = 40;")  cap8: $(echo "$T" | grep -c "var STAGGER_CAP = 8;")"
echo "h timer LIGHT?240:280: $(echo "$T" | grep -c "LIGHT ? 240 : 280")  v timer LIGHT?220:240: $(echo "$T" | grep -c "LIGHT ? 220 : 240")"
echo "prevOpacities: $(echo "$T" | grep -c "prevOpacities")  transitionend: $(echo "$T" | grep -c "transitionend")  transitioncancel: $(echo "$T" | grep -c "transitioncancel")"
echo "fallback 400+i*delay+200: $(echo "$T" | grep -c "400 + i \* delay + 200")  done guard: $(echo "$T" | grep -c "if (done) return")"

M=$(curl -s https://mnationworld.com/pages/messages.html)
echo "messages showTab: $(echo "$M" | grep -c "showTab")  msgSlide will-change: $(echo "$M" | grep -c "will-change:transform")  sidebar width .25s: $(echo "$M" | grep -c "width 0.25s cubic-bezier(0.22,0.61,0.36,1)")  ann box-shadow: $(echo "$M" | grep -c "box-shadow 0.25s ease")"
