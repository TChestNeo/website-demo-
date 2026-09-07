// v0.2.22.2 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00104-g9s（';
const REV_NEW = '**当前线上 rev 00105-j7h（2026-09-07 v0.2.22.2 Community 主页头部横排——用户「然后我希望把名称和id和性别的位置调到头像的右侧」：头部卡改 Twitter 式横排（.profile-top 弹性盒 align-items:center + gap var(--space-md)、头像 flex:none 保持 72px、右侧信息列 flex:1 min-width:0 竖排居中 gap 4px = h2 名字 + @公民号 + 性别徽章行）；bio/加入时间/统计四块仍全宽在下不动；零后端零共享文件（tail 改 + 重建 118648 chars）；测试 252/252+电池 41/41 本地（G2 新横排几何断言——名字列在头像右侧 nmL≥avR-1+垂直同带重叠，avR=524.5→nmL=548.5 恰 24px=gap 实测）+15/15 线上（L2 几何同款线上同值+真用户 TChestBox_Neo 主页真实渲染 stats 1/0/1/0）+冒烟 49/49+curl 六连（health 58+版本+profile-top×2+两 svg 200）+health 58；部署一次 exit 0（revision 00105-j7h）；rev 00105-j7h commit 35ecfbe（未 push））；前身 rev 00104-g9s（';

const SITE_OLD = '站点号当前 **v0.2.22.1**（';
const SITE_NEW = '站点号当前 **v0.2.22.2**（2026-09-07 Community 主页头部横排轮——用户「然后我希望把名称和id和性别的位置调到头像的右侧」：名称/@公民号/性别 → 头像右侧 Twitter 式横排（bio/加入时间/统计仍全宽在下）；测试 252/252+电池 41/41 本地（G2 横排几何断言）+15/15 线上+冒烟 49/49+curl 六连+health 58；rev 00105-j7h commit 35ecfbe（未 push））；前身 v0.2.22.1（';

const SCHEME_OLD = '2026-09-07 v0.2.22.1 = ';
const SCHEME_NEW = '2026-09-07 v0.2.22.2 = Community 主页头部横排（补丁位 1→2·观感微调轮——用户「然后我希望把名称和id和性别的位置调到头像的右侧」：头部卡 Twitter 式横排 .profile-top（align-items:center + gap var(--space-md)、头像 flex:none、右侧列竖排 h2+@公民号+性别徽章）；bio/加入时间/统计全宽在下；重建 118648 chars；测试 252/252+电池 41/41 本地（G2 横排几何断言 avR=524.5→nmL=548.5）+15/15 线上+冒烟 49/49+curl 六连+health 58，rev 00105-j7h commit 35ecfbe（未 push））；前身 2026-09-07 v0.2.22.1 = ';

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
