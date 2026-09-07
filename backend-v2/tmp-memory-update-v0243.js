// v0.2.24.3 收尾：memory 四锚点更新（backend-build-state.md 全量链 + site-versioning-scheme.md 全量链 + MEMORY.md 两条索引指针）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00116-wd9（';
const REV_NEW = '**当前线上 rev 00117-wz6（2026-09-08 v0.2.24.3 Community 标准液态玻璃换真液态玻璃引擎——用户「不是你液态玻璃是真的吗」+「参考 rdev/liquid-glass-react」：①包层 .card-halo 挂全站液体玻璃引擎（LG.apply：SVG 折射 70+三通道色散+磨砂 24px+饱和 140%+镜面高光双层=rdev 同款配方；renderHeader 先 LG.remove 清守卫再挂——包层跨重渲染常驻 innerHTML 换卡抹层但 _lgStatic 守卫还在直接 apply 空转；默认 remove 兜底卸载）；②glass-clear --lg-bg 改无色极轻白霜（0.14/0.04/0.10=v0.2.24.1 白磨砂 ~1/4——亮/暗主题磨砂玻璃体而非白底；v0.2.24.2 纯透明并入）；③.card-halo 加 position:relative+z-index:0 建层叠上下文（引擎负 z 层不上逃）；④包层配方子代选择器 .card-halo > .lg-backdrop（后代选择器首版误伤卡层 14→24px 电池撞出，子代后横幅组不动）；⑤代码白边环+柔影保留、横幅组 7 预设不动；后端零改动；重建 134323 chars；⑥测试 257/257+电池 63/63 本地（E6c2 预览霜体无色+E6d 包层引擎 lg-static/双层/blur(24px) saturate/wrapCls 含 lg-static+E6f 引擎卸载+O1 他人 glass-clear 真玻璃三断言+L2 卡层口径收窄）+18/18 线上（L2 真用户 TChestBox_Neo wrapCls=card-halo glass-clear lg-static wrapLg=true wrapLayer=true 引擎线上真实挂载）+冒烟 49/49+curl 三连（health 58+v0.2.24.3+新规则 5 处）；部署一次 exit 0（revision 00117-wz6）；rev 00117-wz6 commit 84a0c96（未 push））；前身 rev 00116-wd9（';

const SCHEME_OLD = '2026-09-08 v0.2.24.2 = ';
const SCHEME_NEW = '2026-09-08 v0.2.24.3 = Community 标准液态玻璃换真液态玻璃引擎（补丁位 2→3·真液态玻璃轮——用户「不是你液态玻璃是真的吗」+「参考 rdev/liquid-glass-react」：包层挂全站引擎 LG.apply（折射 70+色散+磨砂 24px+饱和 140%+镜面高光=rdev 同款）；glass-clear 无色极轻白霜 0.14/0.04/0.10（v0.2.24.1 白磨砂 ~1/4，非白底）；.card-halo 建层叠上下文 position:relative+z-index:0；包层配方子代选择器 .card-halo > .lg-backdrop（防误伤卡层）；白边环+柔影保留、横幅组不动；后端零改动；测试 257/257+电池 63/63 本地+18/18 线上+冒烟 49/49+curl 三连+health 58，rev 00117-wz6 commit 84a0c96（未 push））；前身 2026-09-08 v0.2.24.2 = ';

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
      return l.slice(0, i) + '**当前线上 rev 00117-wz6（2026-09-08 v0.2.24.3 Community 标准液态玻璃真引擎轮；每轮 rev 全量链见 [[backend-build-state]]）**' + l.slice(l.indexOf('；W3-W5 待做'));
    }
    if (l.indexOf('- [侧栏版本号口径') === 0) {
      n++;
      const i = l.indexOf('站点号当前 **v0.2.24.2**（');
      if (i < 0) throw new Error('site anchor missing in versioning index line');
      return l.slice(0, i) + '站点号当前 **v0.2.24.3**（2026-09-08 Community 标准液态玻璃真引擎轮，rev 00117-wz6 commit 84a0c96 未 push）' + l.slice(l.indexOf('](site-versioning-scheme.md)'));
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
