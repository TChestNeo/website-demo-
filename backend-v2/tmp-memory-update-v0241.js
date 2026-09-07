// v0.2.24.1 收尾：memory 四锚点更新（backend-build-state.md 全量链 + site-versioning-scheme.md 全量链 + MEMORY.md 两条索引瘦身为指针）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00114-gmb（';
const REV_NEW = '**当前线上 rev 00115-5mw（2026-09-08 v0.2.24.1 Community 卡片背景双选项 默认/标准液态玻璃——用户「卡片背景我要的是两个选项一个是默认，一个是标准的液态玻璃不要有颜色就和以下代码一模一样」（附 Next.js globals.css 滑块代码）：①卡片背景组从 7 预设收为 2 选项：默认（无背景层）+ 标准液态玻璃（新键 glass-clear 无色——用户「不要有颜色」；代码蓝紫渐变拇指/轨道=滑块样式与本轮无关，玻璃壳两行样式逐字取用）；②glass-clear=无色白磨砂（--lg-bg 三层白渐变 rgba(255,255,255,0.55)/rgba(255,255,255,0.15)/rgba(255,255,255,0.38)+双径向白高光，零色相）+ 代码同款玻璃细节：2px 白边环 rgba(255,255,255,0.8)（box-shadow inset 0 0 0 2px 实现）+ 柔影 0 4px 12px rgba(0,0,0,0.4)（.card-halo.glass-clear + .edit-bg-preview.has-plate.glass-clear 两处同款）；③后端 CARD_BG_KEYS 七键加 glass-clear 三处同步（social.js/auth.js/tail）；CARD_PLATE_DEFS 独立双选项 [["",默认],["glass-clear",标准液态玻璃]]（横幅组 CARD_BG_DEFS 7 不动）；重建 133283 chars；④测试 257/257（cardPlate glass-clear 白名单链：PATCH 200 落库+与 cardBg 互不干扰）+电池 61/61 本地（E6b 板网格 2 选项 plLabels 默认|标准液态玻璃 而横幅仍 7；E6c2 预览无色断言：白磨砂在+樱花粉 232,110,160/品牌蓝 30,90,200/紫 96,100,230 均不在+白边环+柔影；E6d PATCH 精确双字段 {"cardBg":"glass-ocean","cardPlate":"glass-clear"}+包层 card-halo glass-clear 无色+卡身透明+横幅 ocean 不动；E6e 预填；E6f 双 null 回默认；O1 他人 glass-clear 公开渲染）+17/17 线上（L2 真用户 TChestBox_Neo 自存 glass-frost 磨砂渲染实测 card-halo⇔卡透明一致）+冒烟 49/49+curl 三连（health 58+v0.2.24.1+profile cardBg/cardPlate 公开）；部署一次 exit 0（revision 00115-5mw）；rev 00115-5mw commit b518c4f（未 push））；前身 rev 00114-gmb（';

const SCHEME_OLD = '2026-09-07 v0.2.24.0 = ';
const SCHEME_NEW = '2026-09-08 v0.2.24.1 = Community 卡片背景双选项 默认/标准液态玻璃（补丁位 0→1·标准液态玻璃轮——用户「卡片背景我要的是两个选项一个是默认，一个是标准的液态玻璃不要有颜色就和以下代码一模一样」（附 Next.js globals.css 滑块代码）：卡片背景组 7 预设收为 2 选项——默认（无背景层）+ 标准液态玻璃（新键 glass-clear 无色白磨砂——用户「不要有颜色」；代码蓝紫渐变拇指/轨道=滑块样式与本轮无关）；玻璃壳细节逐字照代码：2px 白边环 rgba(255,255,255,0.8)（box-shadow inset 0 0 0 2px 实现）+ 柔影 0 4px 12px rgba(0,0,0,0.4)（.card-halo.glass-clear + .edit-bg-preview.has-plate.glass-clear 两处同款）；CARD_BG_KEYS 七键加 glass-clear 三处同步（social.js/auth.js/tail）+CARD_PLATE_DEFS 独立双选项（横幅组 CARD_BG_DEFS 7 不动）；零迁移（复用 019 card_plate 列）；测试 257/257+电池 61/61 本地（E6b 双选项 默认|标准液态玻璃+E6c2 无色断言+E6d PATCH 精确双字段+E6f 双 null 回默认+O1）+17/17 线上+冒烟 49/49+curl 三连+health 58，rev 00115-5mw commit b518c4f（未 push））；前身 2026-09-07 v0.2.24.0 = ';

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

// MEMORY.md 两条索引瘦身：巨链移出索引（全量链已在 backend-build-state.md + site-versioning-scheme.md），修 29.5KB 超限
function slim() {
  const p = MEM + 'MEMORY.md';
  let lines = fs.readFileSync(p, 'utf8').split('\n');
  let n = 0;
  lines = lines.map(l => {
    if (l.indexOf('- [后端 v2 重写') === 0) {
      n++;
      const i = l.indexOf('**当前线上 rev ');
      if (i < 0) throw new Error('rev anchor missing in backend index line');
      return l.slice(0, i) + '**当前线上 rev 00115-5mw（2026-09-08 v0.2.24.1 Community 卡片背景双选项 默认/标准液态玻璃轮；每轮 rev 全量链见 [[backend-build-state]]）**；W3-W5 待做](backend-build-state.md)';
    }
    if (l.indexOf('- [侧栏版本号口径') === 0) {
      n++;
      const i = l.indexOf('；进位规则+每轮版本');
      if (i < 0) throw new Error('chain anchor missing in versioning index line');
      return l.slice(0, i) + '；进位规则+每轮版本/commit/轮型全量链见 [[site-versioning-scheme]]；站点号当前 **v0.2.24.1**（2026-09-08 Community 卡片背景双选项 默认/标准液态玻璃轮，rev 00115-5mw commit b518c4f 未 push）](site-versioning-scheme.md)';
    }
    return l;
  });
  if (n !== 2) throw new Error('slim matched ' + n + ' lines, want 2');
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  console.log('slimmed MEMORY.md 2 index lines');
}

patch('backend-build-state.md', [[REV_OLD, REV_NEW]]);
patch('site-versioning-scheme.md', [[SCHEME_OLD, SCHEME_NEW]]);
slim();
console.log('OK 4 anchors');
