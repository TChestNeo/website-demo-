// v0.2.23.3 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00112-kq4（';
const REV_NEW = '**当前线上 rev 00113-6mv（2026-09-07 v0.2.23.3 Community 卡片背景结构重排——横幅=预设+四周阔出 6px 光环——用户「不是你把现在的卡片背景改成横幅，然后下面再开一个卡片背景然后那个背景要阔出去6px参考下方代码：」：①问询钦定「背景四周阔 6px」——横幅=预设渐变（var(--lg-bg) 经外层包层继承）、卡身回纯底色、卡片四周阔出 6px 光环层（#profileHeader 包层 .card-halo：margin:-6px+padding:6px 不挤占原尺寸+border-radius calc(半径+6px)+兜底=参考代码蓝紫渐变 #60a5fa→#a78bfa）；预设类改挂外层包层（CSS 变量继承供横幅+光环共用同一渐变，内卡仍挂 liquid-glass 双层）；②编辑弹窗预览改真实结构缩小版：横幅条+卡身+四周 6px 光环（选非默认 has-bg 露出）；③零后端零共享文件；重建 129581 chars；测试 255/255+电池 57/57 本地（E6b 预览结构+E6c 光环显隐+E6d 结构重排：卡身 none+横幅预设渐变+包层 card-halo glass-ocean 同一渐变+E6f 回默认包层类清空+O1/L2 光环包层断言）+17/17 线上+冒烟 49/49+curl 三连（health 58+v0.2.23.3+cardBg null）；部署一次 exit 0（revision 00113-6mv）；rev 00113-6mv commit 4b8a952（未 push））；前身 rev 00112-kq4（';

const SITE_OLD = '站点号当前 **v0.2.23.2**（';
const SITE_NEW = '站点号当前 **v0.2.23.3**（2026-09-07 Community 卡片背景结构重排轮——用户「不是你把现在的卡片背景改成横幅，然后下面再开一个卡片背景然后那个背景要阔出去6px参考下方代码：」：问询钦定「背景四周阔 6px」——横幅=预设渐变、卡身回纯底色、卡片四周阔出 6px 光环层（.card-halo 包层 margin:-6px+padding:6px，兜底=参考代码蓝紫渐变）；预设类挂外层包层（CSS 变量继承供横幅+光环共用）；预览改真实结构缩小版（has-bg 露光环）；零后端；测试 255/255+电池 57/57 本地+17/17 线上+冒烟 49/49+curl 三连+health 58；rev 00113-6mv commit 4b8a952（未 push））；前身 v0.2.23.2（';

const SCHEME_OLD = '2026-09-07 v0.2.23.2 = ';
const SCHEME_NEW = '2026-09-07 v0.2.23.3 = Community 卡片背景结构重排（补丁位 2→3·结构重排轮——用户「不是你把现在的卡片背景改成横幅，然后下面再开一个卡片背景然后那个背景要阔出去6px参考下方代码：」：问询钦定「背景四周阔 6px」——横幅=预设渐变（var(--lg-bg) 包层继承）、卡身回纯底色、卡片四周阔出 6px 光环层（.card-halo 包层 margin:-6px+padding:6px 不挤占原尺寸+border-radius calc(半径+6px)+兜底=参考代码蓝紫渐变）；预设类挂外层包层（CSS 变量继承供横幅+光环共用同一渐变，内卡仍挂 liquid-glass 双层）；编辑弹窗预览改真实结构缩小版（has-bg 露光环）；零后端零共享文件；测试 255/255+电池 57/57 本地（E6d 结构重排断言：卡身 none+横幅预设渐变+包层 card-halo glass-ocean 同一渐变+E6f 包层类清空）+17/17 线上+冒烟 49/49+curl 三连+health 58，rev 00113-6mv commit 4b8a952（未 push））；前身 2026-09-07 v0.2.23.2 = ';

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
