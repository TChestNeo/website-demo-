// tmp-sed-631b.js — 631 补钉：FC 48.1 版本锚 + rev 占位口径 + tier-gating 订阅计数
// 真身：631 主 sed 只换站点版本+rev 前缀，FC 版本锚（window.FLUIDCANVAS_VERSION 引号族）与
//       虚构 rev（'rev 00346-ntt'）全部失配 → 舰队 26 套 38 ❌。本补钉只扫 tmp-battery-* 电池。
// 口径：FC 赋值 48.1；rev 占位 '00346-'/'00347-' 各 2（站点+FC 双 changelog）——裸前缀部署后恒 2 不变（终态同数）。
const fs = require('fs'), path = require('path');
const HERE = __dirname;
const PAIRS = [
  // FC 版本赋值（带分号形式）
  ["window.FLUIDCANVAS_VERSION = 'v10.28.48.0';", "window.FLUIDCANVAS_VERSION = 'v10.28.48.1';"],
  // FC 版本赋值（无分号 + === 1 后缀——避开 settings-profilecust 的 === 0 零残留锚）
  ["window.FLUIDCANVAS_VERSION = 'v10.28.48.0'\") === 1", "window.FLUIDCANVAS_VERSION = 'v10.28.48.1'\") === 1"],
  // 运行时比较短引号形式（micro-v056/img-library/pbg-meta）
  [" === 'v10.28.48.0'", " === 'v10.28.48.1'"],
  // indexOf 短引号形式（home-bg/all-opaque/sidebar-light）
  ["\"'v10.28.48.0'\"", "\"'v10.28.48.1'\""],
  // activity/following rev 锚（裸前缀，部署后恒 2）
  ["count(sconf, 'rev 00346-ntt') === 1", "count(sconf, 'rev 00346-') === 2"],
  ["count(sconf, 'rev 00347-vhw') === 1", "count(sconf, 'rev 00347-') === 2"],
  // community-nodemo rev 锚
  ["c(cfg, 'rev 00346-ntt') === 1 && c(cfg, 'rev 00347-vhw') === 1", "c(cfg, 'rev 00346-') === 2 && c(cfg, 'rev 00347-') === 2"],
  // community-nodemo 58.25 计数（版本行+双 changelog 头 = 4）
  ["c(cfg, 'v0.2.58.25') === 2", "c(cfg, 'v0.2.58.25') === 4"],
  // prefetch rev 计数
  ["cnt(siteSrc, '00346-') === 1 && cnt(siteSrc, '00347-') === 1", "cnt(siteSrc, '00346-') === 2 && cnt(siteSrc, '00347-') === 2"],
  // tier-gating 订阅计数（58.25 +2：videoLocked 兜底+升级链）
  ["cnt(smSrc, '订阅') === 9", "cnt(smSrc, '订阅') === 11"],
  // 标签同步（虚构 rev 标签修正）
  ["F1 rev 终态双锚（00346-ntt + 00347-vhw 各 1）", "F1 rev 占位双锚（00346-XXX + 00347-??? 各 2，部署后终态同数）"],
  ["F1 site-config v0.2.58.25 恰 2 处（版本行+changelog 头）", "F1 site-config v0.2.58.25 恰 4 处（版本行+双 changelog 头）"],
  ["设置弹窗订阅仅限资料区三层门禁 ×9", "设置弹窗订阅仅限资料区三层门禁 ×11"],
  ["rev 00346-/00347- 各 1（占位口径）+ FC 48.0 不动", "rev 00346-/00347- 各 2（占位口径，部署后终态同数）+ FC 48.1"],
];
const files = fs.readdirSync(HERE).filter((f) => f.startsWith('tmp-battery-') && f.endsWith('.js'));
let total = 0, filesTouched = 0;
for (const f of files) {
  let s = fs.readFileSync(path.join(HERE, f), 'utf8');
  const orig = s;
  let n = 0;
  for (const [from, to] of PAIRS) {
    const c = s.split(from).length - 1;
    if (c > 0) { s = s.split(from).join(to); n += c; }
  }
  if (s !== orig) {
    fs.writeFileSync(path.join(HERE, f), s);
    console.log(f + ': ' + n + ' swaps');
    total += n; filesTouched++;
  }
}
console.log('── total', total, 'swaps in', filesTouched, 'files');
// 复核零残留（打印命中行供目视——settings-profilecust 零残留锚/crop FC 页历史锚属正确保留）
let residue = 0;
for (const f of files) {
  const lines = fs.readFileSync(path.join(HERE, f), 'utf8').split('\n');
  lines.forEach((L, i) => {
    if (/window\.FLUIDCANVAS_VERSION = 'v10\.28\.48\.0'| === 'v10\.28\.48\.0'|rev 00346-ntt|rev 00347-vhw/.test(L)) {
      console.log('RESIDUE? ' + f + ':' + (i + 1) + ': ' + L.trim().slice(0, 130));
      residue++;
    }
  });
}
console.log('── residue lines:', residue);
