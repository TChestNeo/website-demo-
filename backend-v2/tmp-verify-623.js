// tmp-verify-623.js — v0.2.58.17 关注页真实数据接入镜像内容验证（两次构建各验一次、先验后推）
//   锚在位：后端 social.js 三新端点、site-config 版本+changelog、following.html 新 IIFE、i18n 新键族；
//   零残留：58.16 赋值、假数据种子 10 项、旧 i18n 键族。
//   （docker run sh -c 读 /app；grep -c 按行计；-F 字面量；计数全部=电池 tmp-battery-following.js F1 区实测口径）
'use strict';
const { spawnSync } = require('child_process');
const so = '/app/src/routes/public/social.js';
const sc = '/app/docs/assets/js/site-config.js';
const fol = '/app/docs/pages/following.html';
const i18n = '/app/docs/assets/i18n/following.i18n.js';
const act = '/app/docs/pages/activity.html';
const cmds = [
  // ── 后端 social.js 三新端点 ──
  ['social.js feed 端点串 ×1', `grep -cF "'/api/social/feed'" ${so}`, '1'],
  ['social.js following/detail 端点串 ×1', `grep -cF "'/api/social/following/detail'" ${so}`, '1'],
  ['social.js public/users 端点串 ×1', `grep -cF "'/api/public/users'" ${so}`, '1'],
  ['social.js 限流键 pu:ip: ×1', `grep -cF "'pu:ip:'" ${so}`, '1'],
  ['social.js 限流配置 publicUsers ×1', `grep -cF 'publicUsers' ${so}`, '1'],
  ['social.js feed SQL 关注双子句 ×1', `grep -cF 'author_id IN (SELECT target_id FROM following' ${so}`, '1'],
  ['social.js 榜单排序 followerCount DESC ×1', `grep -cF 'followerCount DESC' ${so}`, '1'],
  ['social.js feed LIMIT 100（共享 SQL 模式实测 3）', `grep -cF 'ORDER BY seq DESC LIMIT 100' ${so}`, '3'],
  // ── site-config 版本+changelog ──
  ['site-config 58.17 赋值在位', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.17';" ${sc}`, '1'],
  ['site-config 58.16 赋值零残留(应 0)', `grep -cF "window.MN_SITE_VERSION = 'v0.2.58.16';" ${sc}`, '0'],
  ['site-config FC 47.4 恒（零改动）', `grep -cF "window.FLUIDCANVAS_VERSION = 'v10.28.47.4';" ${sc}`, '1'],
  ['changelog 58.17 条目标题在位', `grep -cF '// v0.2.58.17 = ' ${sc}`, '1'],
  ['changelog 58.17 用户原话片断', `grep -c '那么关注页面的也做一下' ${sc}`, '1'],
  ['changelog rev 00329-6nq 真瞬态注记', `grep -cF 'rev 00329-6nq' ${sc}`, '1'],
  ['changelog rev 00329-XXX 占位零残留(应 0)', `grep -cF 'rev 00329-XXX' ${sc}`, '0'],
  ['changelog rev 00330-??? 终态占位注记', `grep -cF 'rev 00330-???' ${sc}`, '1'],
  ['灯塔 __slatiPvSent ×3（守卫注释+判+置）', `grep -cF '__slatiPvSent' ${sc}`, '3'],
  ['灯塔 /analytics/pageview ×3', `grep -cF '/analytics/pageview' ${sc}`, '3'],
  ['灯塔 slati_cid ×4', `grep -cF 'slati_cid' ${sc}`, '4'],
  // ── following.html 新 IIFE ──
  ['页面 api.js 引入 ×1', `grep -cF 'assets/js/api.js' ${fol}`, '1'],
  ['页面搜索框 id ×1', `grep -cF 'id="followingSearch"' ${fol}`, '1'],
  ['页面 feed 端点调用 ×1', `grep -cF "MN_API.get('/social/feed'" ${fol}`, '1'],
  ['页面 detail 端点调用 ×1', `grep -cF "MN_API.get('/social/following/detail'" ${fol}`, '1'],
  ['页面 public/users 端点调用 ×1', `grep -cF "MN_API.get('/public/users'" ${fol}`, '1'],
  ['页面 nations/topics 端点调用各 ×1', `grep -cF "MN_API.get('/social/nations'" ${fol}`, '1'],
  ['页面 topics 端点调用 ×1', `grep -cF "MN_API.get('/social/topics'" ${fol}`, '1'],
  ['页面链式 rerender ×2', `grep -cF '__mnPrevRerender' ${fol}`, '2'],
  ['页面 401 监听 ×1', `grep -cF 'mn:unauthorized' ${fol}`, '1'],
  ['页面样式类 folg-offline/cta/media ×1/1/3', `grep -cF 'card folg-offline' ${fol}`, '1'],
  ['页面样式类 folg-cta ×1', `grep -cF 'card folg-cta' ${fol}`, '1'],
  ['页面样式类 folg-media ×3（CSS×2+JS×1）', `grep -cF 'folg-media' ${fol}`, '3'],
  ['页面假数据种子零残留(应 0)', `grep -cF 'Republic of Etheria' ${fol}`, '0'],
  ['页面 var feedItems 零残留(应 0)', `grep -cF 'var feedItems' ${fol}`, '0'],
  ['页面 var discoverNations 零残留(应 0)', `grep -cF 'var discoverNations' ${fol}`, '0'],
  ['页面 var discoverTopics 零残留(应 0)', `grep -cF 'var discoverTopics' ${fol}`, '0'],
  ['页面 var discoverUsers 零残留(应 0)', `grep -cF 'var discoverUsers' ${fol}`, '0'],
  ['页面 var recItems 零残留(应 0)', `grep -cF 'var recItems' ${fol}`, '0'],
  ['页面 nameLookup 零残留(应 0)', `grep -cF 'nameLookup' ${fol}`, '0'],
  ['页面 Marcus Vane 零残留(应 0)', `grep -cF 'Marcus Vane' ${fol}`, '0'],
  ['页面 NAT-demo-1 零残留(应 0)', `grep -cF 'NAT-demo-1' ${fol}`, '0'],
  ['页面 TOP-demo-1 零残留(应 0)', `grep -cF 'TOP-demo-1' ${fol}`, '0'],
  // ── i18n 新键族 ×12 语 ──
  ['i18n offline.title ×12', `grep -cF 'following.offline.title' ${i18n}`, '12'],
  ['i18n loginCta.title ×12', `grep -cF 'following.loginCta.title' ${i18n}`, '12'],
  ['i18n feed.time.daysAgo ×12', `grep -cF 'following.feed.time.daysAgo' ${i18n}`, '12'],
  ['i18n empty.users ×12', `grep -cF 'following.empty.users' ${i18n}`, '12'],
  ['i18n rec.empty 规则行 ×12', `grep -cF '"following.rec.empty":' ${i18n}`, '12'],
  ['i18n searchPh ×12', `grep -cF 'following.searchPh' ${i18n}`, '12'],
  ['i18n suffix.followers ×12', `grep -cF 'following.suffix.followers' ${i18n}`, '12'],
  ['i18n feed.badge.nation 零残留(应 0)', `grep -cF 'following.feed.badge.nation' ${i18n}`, '0'],
  ['i18n feed.time.t2h 零残留(应 0)', `grep -cF 'following.feed.time.t2h' ${i18n}`, '0'],
  ['i18n feed.desc.nation 零残留(应 0)', `grep -cF 'following.feed.desc.nation' ${i18n}`, '0'],
  ['i18n discover.natDesc.solarian 零残留(应 0)', `grep -cF 'following.discover.natDesc.solarian' ${i18n}`, '0'],
  ['i18n role.citizen 零残留(应 0)', `grep -cF 'following.role.citizen' ${i18n}`, '0'],
  ['i18n rec.sub.solarian 零残留(应 0)', `grep -cF 'following.rec.sub.solarian' ${i18n}`, '0'],
  ['i18n zh-Hant 自动生成标记 ×1', `grep -cF '__ZH_HANT_AUTO__' ${i18n}`, '1'],
  // ── 58.16 activity 在位回归 ──
  ['activity.html 搜索框 id ×1（58.16 回归）', `grep -cF 'id="activitySearch"' ${act}`, '1'],
  ['activity.html 假数据零残留(应 0)', `grep -cF 'generateGrowthSeries' ${act}`, '0'],
];
let bad = 0;
for (const [name, c, want] of cmds) {
  const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  console.log(`[${name}] → ${out}`);
  if (out !== want) bad++;
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
