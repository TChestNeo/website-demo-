// v0.2.22.1 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00103-w4k（';
const REV_NEW = '**当前线上 rev 00104-g9s（2026-09-07 v0.2.22.1 Community 主页性别 男/女 换图标——用户「能不能把男女换成新添加进image文件内的那两个svg」：头部性别徽章+编辑弹窗性别药丸 男/女 文字改用户新加 docs/assets/image/ 的两个 Material 图标（♂蓝#7CA7D8/♀粉#F18AFF，img 引用真文件，两 svg 一并入库）；Other 保持文字「其他」；图标带 alt/title 兜可读性；药丸弹性盒居中+min 52×38px；GENDER_ICONS 三件套放 IIFE 模块层（首稿误插 renderHeader 体内已挪出）；零后端零共享文件；测试 252/252+电池 40/40 本地（男/女文本断言全换 src 断言防漏渲）+14/14 线上+冒烟 49/49+curl 五连（两 svg 各 200）+health 58；部署一次 exit 0（revision 00104-ncc）；rev 00104-g9s commit 1cb402c（未 push））；前身 rev 00103-w4k（';

const SITE_OLD = '站点号当前 **v0.2.22.0**（';
const SITE_NEW = '站点号当前 **v0.2.22.1**（2026-09-07 Community 主页性别 男/女 换图标轮——用户「能不能把男女换成新添加进image文件内的那两个svg」：头部徽章+编辑弹窗药丸 男/女 改用用户新加 image 的 ♂蓝/♀粉 svg（Other 文字，alt/title 兜底）；测试 252/252+电池 40/40 本地+14/14 线上+冒烟 49/49+curl 五连+health 58；rev 00104-g9s commit 1cb402c（未 push））；前身 v0.2.22.0（';

const SCHEME_OLD = '2026-09-07 v0.2.22.0 = ';
const SCHEME_NEW = '2026-09-07 v0.2.22.1 = Community 主页性别 男/女 换图标（补丁位 0→1·观感微调轮——用户「能不能把男女换成新添加进image文件内的那两个svg」：头部性别徽章+编辑弹窗性别药丸 男/女 文字改用户新加 image 的 ♂蓝#7CA7D8/♀粉#F18AFF Material 图标（img 引用真文件，两 svg 入库）；Other 保持文字；重建 118303 chars；测试 252/252+电池 40/40 本地+14/14 线上+冒烟 49/49+curl 五连+health 58，rev 00104-g9s commit 1cb402c（未 push））；前身 2026-09-07 v0.2.22.0 = ';

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
