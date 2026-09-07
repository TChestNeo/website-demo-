// v0.2.25.1 收尾：memory 四锚点更新（backend-build-state.md 全量链 + site-versioning-scheme.md 全量链 + MEMORY.md 两条索引指针）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00120-g74（';
const REV_NEW = '**当前线上 rev 00121-hdk（2026-09-08 v0.2.25.1 Community 液态玻璃体可见化修复——用户「还是一样没有啊，你能不能仔细看看这个链接内的整个使用教学内容」+ demo https://liquid-glass.maxrovensky.com/ + git clone 直读源码：①根因实锤=rdev demo 玻璃后有彩色照片场景可磨可折、本站主页纯深色平底→磨砂/折射/色散全无对象，库里唯一在任何背景下都可见的招牌层=两层白色环形高光（index.tsx Border layer 1/2）从未移植；②移植原值（index.tsx:508-559）：::before screen 0.2 / ::after overlay=1.5px content-box xor 异或环+白渐变 135°（0→0.12/0.32@33%→0.4/0.6@66%→0 静态定角）+内白环影 0.5px+高光/阴影 1px，贴卡缘 inset 6px——纯白无色符合「不要有颜色」；③page-bg-active 时包层背景复刻页面背景图（.page-bg-active .card-halo.glass-clear 三霜层+var(--page-bg-image)，fixed+cover+center 与 body 同参数=像素级无缝）——卡身/引擎磨砂层直采样包层自己，不再依赖 Chrome 对 body 背景采样，demo 同款「玻璃后有场景可磨可折」必现；④光球提亮 0.5/0.45→0.85/0.75（深色底也有可见白光）；预览迷你双环；横幅组 7 预设不动、零后端；测试 259/259+电池 76→79 本地（+E6c2 预览迷你高光/E6d rdev 双环原值断言/O1 包层复刻背景图断言；掩膜计算样式 Chrome 序列化 \'exclude, exclude\' 双值→断言改包含式）+19/19 线上（L1 v0.2.25.1）+冒烟 49/49+curl 五连（health 58+版本+双环 CSS×2+page-bg-active 复刻 CSS+光球 0.85+匿名 PATCH 401）；部署一次 exit 0（00121-hdk，28 env describe 全量）；commit 79a8e5f（未 push））；前身 rev 00120-g74（';

const SCHEME_OLD = '2026-09-08 v0.2.25.0 = ';
const SCHEME_NEW = '2026-09-08 v0.2.25.1 = Community 液态玻璃体可见化修复（补丁位 0→1·玻璃可见化轮——用户「还是一样没有啊」+责令精读 rdev 教程+demo+源码：移植源码两层白色环形高光（screen 0.2/overlay 双混合+1.5px xor 环+135° 白渐变+内白环影，贴卡缘；纯白无色）；page-bg-active 时包层背景复刻页面背景图（fixed+cover+center 与 body 同参数对齐，磨砂层直采样包层→玻璃后有场景必现）；光球提亮 0.85/0.75；预览迷你双环；零后端；测试 259/259+电池 79/79 本地+19/19 线上+冒烟 49/49+curl 五连，rev 00121-hdk commit 79a8e5f（未 push））；前身 2026-09-08 v0.2.25.0 = ';

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

// MEMORY.md 两条索引指针更新
function slim() {
  const p = MEM + 'MEMORY.md';
  let lines = fs.readFileSync(p, 'utf8').split('\n');
  let n = 0;
  lines = lines.map(l => {
    if (l.indexOf('- [后端 v2 重写') === 0) {
      n++;
      const i = l.indexOf('**当前线上 rev ');
      if (i < 0) throw new Error('rev anchor missing in backend index line');
      return l.slice(0, i) + '**当前线上 rev 00121-hdk（2026-09-08 v0.2.25.1 Community 液态玻璃体可见化修复轮；每轮 rev 全量链见 [[backend-build-state]]）**' + l.slice(l.indexOf('；W3-W5 待做'));
    }
    if (l.indexOf('- [侧栏版本号口径') === 0) {
      n++;
      const i = l.indexOf('站点号当前 **v0.2.25.0**（');
      if (i < 0) throw new Error('site anchor missing in versioning index line');
      return l.slice(0, i) + '站点号当前 **v0.2.25.1**（2026-09-08 Community 液态玻璃体可见化修复轮，rev 00121-hdk commit 79a8e5f 未 push）' + l.slice(l.indexOf('](site-versioning-scheme.md)'));
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
