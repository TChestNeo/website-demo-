// v0.2.24.4 收尾：memory 四锚点更新（backend-build-state.md 全量链 + site-versioning-scheme.md 全量链 + MEMORY.md 两条索引指针）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00117-wz6（';
const REV_NEW = '**当前线上 rev 00119-mqh（2026-09-08 v0.2.24.4 Community 液态玻璃内置无色光场轮——用户「还是一样没有要不这样你用这个」+ liquid-glass-react 用法贴来（React 库无法 import——原生 JS 多页，效果本质=玻璃+后面的光）+「为什么这个玻璃会有蓝色和紫色在背面能不能去掉」：①根因=v0.2.24.3 玻璃不可见=页面背景纯色平底磨砂折射无光可折（rdev demo 有彩色场景）；②包层垫 .lg-orb-field 光场（z:-2 垫引擎负 z 层下——磨砂 24px 磨光斑+SVG 折射三通道色散）；③光球首版蓝紫 96,165,250/167,139,250=参考代码同色→用户去色→纯白 0.5/0.45（蓝紫全页清零；折射边缘泛彩边=天然色散非上色）；④高光层斜向流光 115deg；⑤光场随卡片背景走（display:none 基础+halo 子代才 block——默认灭灯+实底遮盖，横幅组 7 预设不动，玻璃本体无色）；⑥预览双白光球示意；后端零改动；重建 136346 chars；测试 257/257+电池 65/65 本地+19/19 线上（TChestBox_Neo orbVis=block 白光场线上真实亮起）+冒烟 49/49+curl（health 58+白光在/蓝紫清零）；部署两次 exit 0（00118-9w4 蓝紫首版→00119-mqh 去色定稿）；commit dec4559a（未 push））；前身 rev 00117-wz6（';

const SCHEME_OLD = '2026-09-08 v0.2.24.3 = ';
const SCHEME_NEW = '2026-09-08 v0.2.24.4 = Community 液态玻璃内置无色光场（补丁位 3→4·玻璃光场轮——用户「还是一样没有」+「蓝紫在背面能不能去掉」：包层垫 .lg-orb-field 无色白光球（首版蓝紫参考代码同色被驳回→纯白 0.5/0.45，蓝紫全页清零）；磨砂 24px+SVG 折射色散让玻璃有光可折；高光层斜向流光；光场随卡片背景走默认灭灯；横幅组不动；后端零改动；测试 257/257+电池 65/65 本地+19/19 线上+冒烟 49/49+curl，rev 00119-mqh commit dec4559a（未 push））；前身 2026-09-08 v0.2.24.3 = ';

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
      return l.slice(0, i) + '**当前线上 rev 00119-mqh（2026-09-08 v0.2.24.4 Community 液态玻璃无色光场轮；每轮 rev 全量链见 [[backend-build-state]]）**' + l.slice(l.indexOf('；W3-W5 待做'));
    }
    if (l.indexOf('- [侧栏版本号口径') === 0) {
      n++;
      const i = l.indexOf('站点号当前 **v0.2.24.3**（');
      if (i < 0) throw new Error('site anchor missing in versioning index line');
      return l.slice(0, i) + '站点号当前 **v0.2.24.4**（2026-09-08 Community 液态玻璃无色光场轮，rev 00119-mqh commit dec4559a 未 push）' + l.slice(l.indexOf('](site-versioning-scheme.md)'));
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
