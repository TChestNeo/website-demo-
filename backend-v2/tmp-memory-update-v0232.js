// v0.2.23.2 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00111-kxx（';
const REV_NEW = '**当前线上 rev 00112-kq4（2026-09-07 v0.2.23.2 Community 横幅/背景分开——用户「不是我要的是背景你放在自定义内的那个叫横幅不叫背景」：①问询钦定「横幅不动，改卡片背景」——横幅恢复 v0.2.22.5 品牌渐变不动（v0.2.23.1 background:none 覆盖删除），预设只作为横幅下方的卡片背景（卡 background=霜面+预设渐变保留）；②编辑弹窗预览改整卡模型：.edit-bg-preview 顶部 .pv-banner 横幅条（品牌渐变不变）+ 下方 .pv-body 卡片背景区（预设）——不再是一根 48px 横幅条（「叫横幅不叫背景」视觉根因）；默认态=无背景纯卡片底色（预览/默认色块都显示 surface 底色）；③零后端零共享文件；重建 129346 chars；测试 255/255+电池 56→57/57 本地（E6d 卡 background 含 linear-gradient+深海蓝 且 横幅保持品牌渐变非 none；E6f 回默认 → 卡片背景 background-image none + 横幅仍品牌渐变；E6b 新增预览整卡模型断言：pv-banner 品牌渐变 + 默认态 pv-body 无渐变）+16/16 线上（L2 玻璃类与层一致）+冒烟 49/49+curl 三连（health 58+v0.2.23.2+cardBg glass-frost）；部署一次 exit 0（revision 00112-kq4）；rev 00112-kq4 commit 24a8803（未 push））；前身 rev 00111-kxx（';

const SITE_OLD = '站点号当前 **v0.2.23.1**（';
const SITE_NEW = '站点号当前 **v0.2.23.2**（2026-09-07 Community 横幅/背景分开轮——用户「不是我要的是背景你放在自定义内的那个叫横幅不叫背景」：问询钦定「横幅不动，改卡片背景」——横幅恢复 v0.2.22.5 品牌渐变不动，预设只作为横幅下方的卡片背景；编辑弹窗预览改整卡模型（顶部横幅条+下方卡片背景区，不再是一根横幅条）；默认=无背景纯底色；零后端；测试 255/255+电池 57/57 本地+16/16 线上+冒烟 49/49+curl 三连+health 58；rev 00112-kq4 commit 24a8803（未 push））；前身 v0.2.23.1（';

const SCHEME_OLD = '2026-09-07 v0.2.23.1 = ';
const SCHEME_NEW = '2026-09-07 v0.2.23.2 = Community 横幅/背景分开（补丁位 1→2·口径修正轮——用户「不是我要的是背景你放在自定义内的那个叫横幅不叫背景」：问询钦定「横幅不动，改卡片背景」——横幅恢复 v0.2.22.5 品牌渐变不动（v0.2.23.1 background:none 覆盖删除），预设只作为横幅下方的卡片背景；编辑弹窗预览改整卡模型（顶部横幅条+下方卡片背景区，不再是一根 48px 横幅条——「叫横幅不叫背景」视觉根因）；默认=无背景纯卡片底色；零后端零共享文件；测试 255/255+电池 56→57/57 本地（E6d 横幅非 none 改断言；E6f 卡片背景回 none；E6b 预览整卡模型新断言）+16/16 线上+冒烟 49/49+curl 三连+health 58，rev 00112-kq4 commit 24a8803（未 push））；前身 2026-09-07 v0.2.23.1 = ';

function patch(file, pairs) {
  const p = MEM + file;
  let s = fs.readFileSync(p, 'utf8');
  for (const [o, n] of pairs) {
    const c = s.split(o).length - 1;
    if (c !== 1) throw new Error(file + ' anchor count=' + c + ' for: ' + o.slice(0, 40));
    s = s.replace(o, n);
  }
  fs.writeFileSync(p, s, 'utf8');
  console.log('patched', file);
}
patch('MEMORY.md', [[REV_OLD, REV_NEW], [SITE_OLD, SITE_NEW]]);
patch('backend-build-state.md', [[REV_OLD, REV_NEW]]);
patch('site-versioning-scheme.md', [[SCHEME_OLD, SCHEME_NEW]]);
console.log('OK 4 anchors');
