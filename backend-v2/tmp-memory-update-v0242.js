// v0.2.24.2 收尾：memory 四锚点更新（backend-build-state.md 全量链 + site-versioning-scheme.md 全量链 + MEMORY.md 两条索引指针）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00115-5mw（';
const REV_NEW = '**当前线上 rev 00116-wd9（2026-09-08 v0.2.24.2 Community 标准液态玻璃改纯透明——用户「把原本除了横幅以外默认的那个白背景也去掉」：①根因=v0.2.24.1 白磨砂（rgba(255,255,255,0.55)/0.15/0.38 三层白渐变）在亮/暗主题下都刷成白底，用户眼里「默认白背景」没走；②修法=.glass-clear 的 --lg-bg 改 transparent——零填充层，只留代码白边环 2px rgba(255,255,255,0.8)（inset 0 0 0 2px）+ 柔影 0 4px 12px rgba(0,0,0,0.4)（.card-halo.glass-clear 不动），卡身直透页面背景=真玻璃；③色块示意：.swatch-fill.glass-clear 加同款白边环+柔影（透明填充下色块不再空白）；横幅组 7 预设不动；后端零改动；重建 133262 chars；④测试 257/257（不变）+电池 61→62/62 本地（E6c2 预览透明断言 pvBg=none 白磨砂移除+新增色块环断言；E6d wrapBg=none 纯透明+卡身透明+横幅深海不动；O1 他人 glass-clear 透明公开渲染）+17/17 线上（L2 真用户 TChestBox_Neo 已自存 glass-clear 纯透明实测 wrapCls=card-halo glass-clear card=rgba(0,0,0,0)）+冒烟 49/49+curl 三连（health 58+v0.2.24.2+profile cardPlate glass-clear）；部署一次 exit 0（revision 00116-wd9）；rev 00116-wd9 commit e1049b5（未 push））；前身 rev 00115-5mw（';

const SCHEME_OLD = '2026-09-08 v0.2.24.1 = ';
const SCHEME_NEW = '2026-09-08 v0.2.24.2 = Community 标准液态玻璃改纯透明（补丁位 1→2·透明玻璃轮——用户「把原本除了横幅以外默认的那个白背景也去掉」：v0.2.24.1 白磨砂在亮/暗主题下都像白背景——.glass-clear 的 --lg-bg 改 transparent（零填充层），只留代码白边环 2px rgba(255,255,255,0.8)+柔影 0 4px 12px rgba(0,0,0,0.4)，卡身直透页面背景；色块加白边环+柔影示意；横幅组 7 预设不动；后端零改动；测试 257/257+电池 61→62/62 本地+17/17 线上+冒烟 49/49+curl 三连+health 58，rev 00116-wd9 commit e1049b5（未 push））；前身 2026-09-08 v0.2.24.1 = ';

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

// MEMORY.md 两条索引指针更新（v0.2.24.1 起已瘦身：全量链在 backend-build-state.md + site-versioning-scheme.md）
function slim() {
  const p = MEM + 'MEMORY.md';
  let lines = fs.readFileSync(p, 'utf8').split('\n');
  let n = 0;
  lines = lines.map(l => {
    if (l.indexOf('- [后端 v2 重写') === 0) {
      n++;
      const i = l.indexOf('**当前线上 rev ');
      if (i < 0) throw new Error('rev anchor missing in backend index line');
      return l.slice(0, i) + '**当前线上 rev 00116-wd9（2026-09-08 v0.2.24.2 Community 标准液态玻璃纯透明轮；每轮 rev 全量链见 [[backend-build-state]]）**' + l.slice(l.indexOf('；W3-W5 待做'));
    }
    if (l.indexOf('- [侧栏版本号口径') === 0) {
      n++;
      const i = l.indexOf('站点号当前 **v0.2.24.1**（');
      if (i < 0) throw new Error('site anchor missing in versioning index line');
      return l.slice(0, i) + '站点号当前 **v0.2.24.2**（2026-09-08 Community 标准液态玻璃纯透明轮，rev 00116-wd9 commit e1049b5 未 push）' + l.slice(l.indexOf('](site-versioning-scheme.md)'));
    }
    return l;
  });
  if (n !== 2) throw new Error('slim matched ' + n + ' lines, want 2');
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  console.log('updated MEMORY.md 2 index lines');
}

patch('backend-build-state.md', [[REV_OLD, REV_NEW]]);
patch('site-versioning-scheme.md', [[SCHEME_OLD, SCHEME_NEW]]);
slim();
console.log('OK 4 anchors');
