// 一次性构建脚本：docs/story/ 2 页 = tmp-story-head.html（共享 head，{{STORY_TITLE}} 占位）+ 各页尾
// v0.2.26.0 单页架构（用户口径：不要分成 8 页、所有内容集中一页）：
//   /（index）= ScrollExpand 序章（整块可点击 → wip）
//   /wip = 六章 + 尾声全部场景拼接的单页长文（章节 tail 是内容单一来源，构建时提取 <main> 内场景拼接）
// 故事站独立影院式设计，不挂平台 ethereal/sidebar；字体 link rel 在前（inline-css 只认 href 在前 → 永不内联）。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const TITLES = {
  index: '政治启蒙故事｜M.NationWorld',
  wip: '政治启蒙 · 完整故事｜M.NationWorld',
};

let head = fs.readFileSync(path.join(__dirname, 'tmp-story-head.html'), 'utf8');
const placeholders = head.split('{{STORY_TITLE}}').length - 1;
if (placeholders !== 1) throw new Error('head 占位符数量=' + placeholders + '，want 1');
if (head.indexOf('</head>') !== -1) throw new Error('head 不应含 </head>');

const outDir = path.join(root, 'docs', 'story');
fs.mkdirSync(outDir, { recursive: true });

// favicon 复制进 story 根（story 域 docRoot=docs/story 只出本级文件，../assets 会 403/404——相对 favicon.png 三种上下文全通）
const logo = path.join(root, 'docs', 'assets', 'image', 'M.NationWorld logo circle_.png');
if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(outDir, 'favicon.png'));
else throw new Error('logo 文件不存在: ' + logo);

// 提取章节 tail 的 <main> 内场景（内容单一来源）
function scenesOf(short) {
  const s = fs.readFileSync(path.join(__dirname, 'tmp-story-' + short + '-tail.html'), 'utf8');
  const m = /<main class="story-flow">([\s\S]*)<\/main>/.exec(s);
  if (!m) throw new Error(short + ' tail 无 <main class="story-flow">');
  return m[1];
}
// 序章 ScrollExpand hero + 六章 + 尾声 = 一张页（用户口径：一个链接 story.mnationworld.com/wip 全站内容）
const wipScenes = ['index', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'finale'].map(scenesOf).join('\n');

let total = 0;

// index：纯跳转页（/ → /wip，一个链接多用；meta refresh + JS replace 双保险）
{
  const html = head.replace('{{STORY_TITLE}}', TITLES.index) +
    '<meta name="story-topic" content="story-home">\n' +
    '</head>\n' +
    '<body class="story-page" data-page="index">\n' +
    '<p style="padding:48px 24px;color:var(--story-dim);text-align:center;font-family:var(--story-serif);font-size:18px">正在进入政治启蒙故事……</p>\n' +
    '<script>location.replace("wip");</script>\n' +
    '</body>\n' +
    '</html>\n';
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  total += html.length;
  console.log('index.html built (redirect → wip):', html.length, 'chars');
}

// wip：全章节场景拼接单页
{
  const html = head.replace('{{STORY_TITLE}}', TITLES.wip) +
    '<style>\n/* ===== wip 单页合并（ch1-ch6+尾声场景内联，页专属无额外样式） ===== */\n' +
    '/* DotGrid 点阵（用户钦定组件 DotGrid.css 原样；ch2-00 地球的底） */\n' +
    '.dot-grid {\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  justify-content: center;\n' +
    '  height: 100%;\n' +
    '  width: 100%;\n' +
    '  position: relative;\n' +
    '}\n' +
    '.dot-grid__wrap {\n' +
    '  width: 100%;\n' +
    '  height: 100%;\n' +
    '  position: relative;\n' +
    '}\n' +
    '.dot-grid__canvas {\n' +
    '  position: absolute;\n' +
    '  inset: 0;\n' +
    '  width: 100%;\n' +
    '  height: 100%;\n' +
    '  pointer-events: none;\n' +
    '}\n' +
    '/* 故事站定位：点阵垫在场景底（z:0，DOM 在 globe canvas 之前 → 位于 z:1 地球之后；scene-stage z:2 文字最上） */\n' +
    '.scene .dot-grid { position: absolute; inset: 0; z-index: 0; }\n' +
    '/* 「冷战」字体轮转（用户口径：冷战两字亮起时硬切 4 字体各停 0.2s、停在最后一个，无淡入淡出）——story-fontcycle.js 定时驱动 */\n' +
    '.fc-words { display: inline-block; }\n' +
    '</style>\n' +
    '<meta name="story-topic" content="story-all">\n' +
    '</head>\n' +
    '<body class="story-page" data-page="wip">\n' +
    '<div class="story-progress"></div>\n' +
    '<main class="story-flow">\n' + wipScenes + '\n</main>\n' +
    '<footer class="story-sources">\n' +
    '  <div class="s-head">阅读口径</div>\n' +
    '  <p><span class="tag tag-fact">Fact</span>普遍接受的事实　<span class="tag tag-interp">Interpretation</span>学界的一种解释　<span class="tag tag-debate">Debate</span>仍在争论的问题</p>\n' +
    '  <p>以上六章均为入门级简化呈现；深入阅读，请以学术著作为准。同一个问题，不同的国家有不同的答案。</p>\n' +
    '</footer>\n' +
    '<script src="story.js"></script>\n' +
    '<script src="story-gl.js"></script>\n' +
    '<script src="story-morph.js"></script>\n' +
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>\n' +
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/InertiaPlugin.min.js"></script>\n' +
    '<script src="story-dots.js"></script>\n' +
    '<script src="story-fontcycle.js"></script>\n' +
    '</body>\n' +
    '</html>\n';
  fs.writeFileSync(path.join(outDir, 'wip.html'), html, 'utf8');
  total += html.length;
  console.log('wip.html built:', html.length, 'chars');
}

// 清理旧分页产物（chapter-1..6/finale——单页架构后不再生成）
for (const old of ['chapter-1.html', 'chapter-2.html', 'chapter-3.html', 'chapter-4.html', 'chapter-5.html', 'chapter-6.html', 'finale.html']) {
  const p = path.join(outDir, old);
  if (fs.existsSync(p)) { fs.rmSync(p); console.log('removed stale', old); }
}
console.log('2 pages total:', total, 'chars');
