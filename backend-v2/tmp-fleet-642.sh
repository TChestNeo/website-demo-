#!/bin/bash
# tmp-fleet-642.sh — 舰队 641（640 同 58 项 + sidebar-collapsed 新电池）
cd "$(dirname "$0")"
FLEET="tmp-battery-605-lvpill tmp-battery-activity tmp-battery-admin-grant tmp-battery-admin-grantrec tmp-battery-all-opaque tmp-battery-article-1to1 tmp-battery-article-frontend tmp-battery-article-present tmp-battery-article-view tmp-battery-bannerfixed tmp-battery-cit2usr tmp-battery-community-nodemo tmp-battery-crop tmp-battery-fadefix tmp-battery-fc-632 tmp-battery-fc-edgeai tmp-battery-fc-edgecolors tmp-battery-fc-headershrink tmp-battery-fc-i18n tmp-battery-fc-mergefix tmp-battery-fc-opaque tmp-battery-fc-paneltoggle tmp-battery-fc-pillmenu tmp-battery-fc-pilltop tmp-battery-fc-present tmp-battery-fc-publish-log tmp-battery-fc-rotate tmp-battery-fc-sne-canvas tmp-battery-fc-tablet tmp-battery-fc-tags tmp-battery-fc-team tmp-battery-fc-touch-uploads tmp-battery-fc-ttlib tmp-battery-fc-ttwide tmp-battery-fc-uploadsave tmp-battery-fc-viewport tmp-battery-fc-rewards tmp-battery-following tmp-battery-home-bg tmp-battery-i18n tmp-battery-identity tmp-battery-micro-v056 tmp-battery-mono-flash tmp-battery-monodark-v0422 tmp-battery-msglink tmp-battery-notif-home tmp-battery-pageswitch tmp-battery-prefetch tmp-battery-profile-avatarsync tmp-battery-profile-banner tmp-battery-profile-subtier tmp-battery-settings-profilecust tmp-battery-sidebar-light tmp-battery-sidebar-opaque tmp-battery-sidebar-collapsed tmp-battery-fc-edgenav tmp-battery-sidebar-userpop tmp-battery-tier-gating tmp-battery-xp-rebalance tmp-battery-xp-social"
total=0
for b in $FLEET; do
  total=$((total+1))
  node "$b.js" > "tmp-batt-642-$b.txt" 2>&1
  ec=$?
  echo "$b exit=$ec" | tee -a tmp-batt-642-fleet-runner.txt
done
echo "FLEET_DONE total=$total" | tee -a tmp-batt-642-fleet-runner.txt
