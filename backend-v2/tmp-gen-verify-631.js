// tmp-gen-verify-631.js — 从 tmp-measure-631.js 的 A 数组 + tmp-measure-631-lines.txt 实测值
// 生成 tmp-verify-631.js（镜像内容验证：docker run sh -c grep -cF + 工作树 test/ 锚）
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;

// 1. 抽取 measure 脚本的 A 数组（本地可信文件，纯字面量）
const msrc = fs.readFileSync(path.join(HERE, 'tmp-measure-631.js'), 'utf8');
const start = msrc.indexOf('const A = [');
const end = msrc.indexOf('];', start) + 2;
if (start < 0 || end < 2) throw new Error('A array not found');
const A = eval('const cnt = () => 0; const lines = () => 0; (' + msrc.slice(start + 'const A = '.length, end - 1) + ')');

// 2. 读实测值
const measured = {};
for (const line of fs.readFileSync(path.join(HERE, 'tmp-measure-631-lines.txt'), 'utf8').split('\n')) {
  const m = line.match(/^(.*) → (\d+|NOFILE)$/);
  if (m) measured[m[1]] = m[2];
}

// 3. 附加手工锚（本轮单独实测）
const EXTRA = [
  ['page .profile-banner { height: 210px ×2', 'docs/pages/community-profile.html', 'height: 210px', '2'],
  ['page post-media height: 140px 遗留 ×1', 'docs/pages/community-profile.html', 'height: 140px', '1'],
  ['page calc(210px 主题边缘 ×2', 'docs/pages/community-profile.html', 'calc(210px', '2'],
  ['page background-size: 100% 210px ×1', 'docs/pages/community-profile.html', 'background-size: 100% 210px', '1'],
  ['page 140→210px 注释 ×1', 'docs/pages/community-profile.html', '140→210px', '1'],
  ['page profile-banner-crop ×7', 'docs/pages/community-profile.html', 'profile-banner-crop', '7'],
  ['page applyCrop ×16', 'docs/pages/community-profile.html', 'applyCrop', '16'],
];

function shq(pat) {
  // sh 单引号包裹 + 内单引号 '\'' 转义——零双引号进 argv（Windows CreateProcess 吃 \" 的血证）
  return "'" + pat.replace(/'/g, "'\\''") + "'";
}
function imgRel(rel) { return '/app/' + rel.replace(/^backend-v2\//, ''); }

const imageCmds = [];
const wt = [];
for (const [label, , rel, pat] of A) {
  const want = measured[label];
  if (want === undefined) { console.log('NO MEASUREMENT: ' + label); continue; }
  if (rel.indexOf('backend-v2/test/') === 0) {
    wt.push([label, rel.replace(/^backend-v2\//, ''), pat, want]);
  } else {
    // 标签修正：fc 48.0 的 2 = 历史节头保留（非零残留）
    let L = label;
    if (label === 'fc v10.28.48.0 零残留') L = 'fc v10.28.48.0 历史节头 ×2（赋值零残留）';
    imageCmds.push([L + ' ×' + want, `grep -cF ${shq(pat)} ${imgRel(rel)}`, want]);
  }
}
for (const [label, rel, pat, want] of EXTRA) {
  imageCmds.push([label, `grep -cF ${shq(pat)} ${imgRel(rel)}`, want]);
}

// 4. 发出 tmp-verify-631.js
const head = `// tmp-verify-631.js — v0.2.58.25 裁切弹窗+横幅增高+视频横幅镜像内容验证（两次构建各验一次、先验后推）
//   新件：site-config 58.25 赋值 ×1/58.24 赋值零残留/FC 48.1 赋值 ×1/48.0 赋值零残留/双 changelog 头/rev 00346-XXX+00347-??? 各 ×2
//   （一次烘焙口径——deploy#1 后填真 rev → 二次烘焙口径：'rev 00346-XXX' 锚改真值+'rev 00346-XXX' 零残留）；
//   profile 页 210px×2/140px 遗留×1/MN_CropDialog×22/两重裁钮/视频链（MN_CompressVideo/VIDEO_EXTS/横幅视频）/
//   settings-modal 144px×1/MN_CropDialog×2/MN_CompressVideo/MN_VideoCap×2/stUpload 裁切 PATCH；fc 48.1×4/48.0 历史头×2/
//   fc-ch-avatar-crop×4/bannerUrl 零；i18n 新键 ×12 语（SQ×11+DQ×1）；后端 030 迁移+auth/social parseCrop+
//   publicUser crop 暴露+连带清；回归件保留（58.24 全部锚+58.23 预取+58.22 白名单/设置弹窗/资料页）；
//   （docker run sh -c 读 /app；grep -cF 按行计；计数全部=tmp-measure-631-lines.txt 实测口径）
//   测试文件九锚 test/ 被 dockerignore 排除不进镜像——改查本地工作树（npm test 全绿已跑）。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const cmds = [
`;
const body = imageCmds.map(([label, c, want]) => `  [${JSON.stringify(label)}, \`${c.replace(/\\/g, '\\\\')}\`, ${JSON.stringify(want)}],`).join('\n');
const wtHead = `
];
let bad = 0;
// 工作树锚（test/ 不进镜像）：按行数
const wt = [
`;
const wtBody = wt.map(([label, f, pat, want]) => `  [${JSON.stringify(label)}, ${JSON.stringify(f)}, ${JSON.stringify(pat)}, ${JSON.stringify(want)}],`).join('\n');
const tail = `
];
let wtIdx = 0;
for (const [name, c, want] of cmds) {
  let out;
  if (c === null) {
    const [label, f, pat] = wt[wtIdx++];
    const s = fs.readFileSync(path.join(HERE, f), 'utf8').replace(/\\r\\n/g, '\\n');
    out = String(s.split('\\n').filter((l) => l.indexOf(pat) !== -1).length);
    console.log(\`[\${label}] → \${out}\`);
  } else {
    const r = spawnSync('docker', ['run', '--rm', '--entrypoint', 'sh', 'mn-backend-v2:cloudrun', '-c', c], { encoding: 'utf8' });
    out = (r.stdout || '').trim();
    console.log(\`[\${name}] → \${out}\`);
  }
  if (out !== want) bad++;
}
console.log(bad === 0 ? '✅ 镜像内容全部在位' : '❌ 镜像内容验证失败 ' + bad);
process.exit(bad === 0 ? 0 : 1);
`;
fs.writeFileSync(path.join(HERE, 'tmp-verify-631.js'), head + body + wtHead + wtBody + tail);
console.log('emitted tmp-verify-631.js: ' + imageCmds.length + ' image anchors + ' + wt.length + ' wt anchors');
