// v0.2.25.2 收尾：memory 四锚点更新（backend-build-state.md 全量链 + site-versioning-scheme.md 全量链 + MEMORY.md 两条索引指针）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00121-hdk（';
const REV_NEW = '**当前线上 rev 00122-sx9（2026-09-08 v0.2.25.2 Community 标准液态玻璃去默认底色——用户「有是有了但是默认的那个背景你也没在标准液态玻璃背景的情况下除了横幅以外的移除啊」：玻璃可见化（v0.2.25.1）后横幅以外默认底色仍在，根因=.glass-clear 配方垫底 var(--color-surface-container-high)（默认卡底色）→去掉垫底层只剩三层无色白霜，包层背景色=透明（rgba(0,0,0,0)）横幅以外彻底透到页面（引擎光场/高光/双环各层不动）；page-bg-active 复刻层加与 body 同款深色蒙层 rgba(10,10,16,0.38)（去底色后白霜薄，蒙层保白字对比+复刻=页面本来样子=蒙层+图，包层与页周零接缝）；预览/色块随配方同步透明；横幅组 7 预设不动、玻璃仍全无色（纯白）、零后端；测试 259/259+电池 79→81 本地（+E6c2 预览无默认底色/E6d+O1 包层背景色透明+复刻层含蒙层）+20/20 线上（+L2 wrapBgColor=rgba(0,0,0,0) 实测）+冒烟 49/49+curl 七连（health 58+版本 v0.2.25.2+glass-clear 无 surface 垫底+复刻层蒙层×2+双环 exclude×2+光球 0.85+匿名 PATCH 401）；部署一次 exit 0（00122-sx9，28 env describe 全量+逗号参数引号）；commit cfcd68a（未 push））；前身 rev 00121-hdk（';

const SCHEME_OLD = '2026-09-08 v0.2.25.1 = ';
const SCHEME_NEW = '2026-09-08 v0.2.25.2 = Community 标准液态玻璃去默认底色（补丁位 1→2·去默认底色轮——用户「默认的那个背景你也没在标准液态玻璃背景的情况下除了横幅以外的移除啊」：.glass-clear 去掉垫底 var(--color-surface-container-high)、横幅以外彻底透到页面；page-bg-active 复刻层加 body 同款深色蒙层；预览/色块同步透明；零后端；测试 259/259+电池 81/81 本地+20/20 线上+冒烟 49/49+curl 七连，rev 00122-sx9 commit cfcd68a（未 push））；前身 2026-09-08 v0.2.25.1 = ';

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
      return l.slice(0, i) + '**当前线上 rev 00122-sx9（2026-09-08 v0.2.25.2 Community 标准液态玻璃去默认底色轮；每轮 rev 全量链见 [[backend-build-state]]）**' + l.slice(l.indexOf('；W3-W5 待做'));
    }
    if (l.indexOf('- [侧栏版本号口径') === 0) {
      n++;
      const i = l.indexOf('站点号当前 **v0.2.25.1**（');
      if (i < 0) throw new Error('site anchor missing in versioning index line');
      return l.slice(0, i) + '站点号当前 **v0.2.25.2**（2026-09-08 Community 标准液态玻璃去默认底色轮，rev 00122-sx9 commit cfcd68a 未 push）' + l.slice(l.indexOf('](site-versioning-scheme.md)'));
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
