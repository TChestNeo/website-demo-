// tmp-i18n-hant.js — v0.2.54.0：从各 .i18n.js 的 zh 字典用 OpenCC（cn→tw）机械生成 zh-Hant 字典追加
// 用法: node tmp-i18n-hant.js            → docs/assets/i18n/*.i18n.js 全部
//       node tmp-i18n-hant.js <file...>  → 指定文件
// 幂等：已存在的 __ZH_HANT_AUTO__ 自动段先剥离再重新生成（重跑安全）
'use strict';
const fs = require('fs');
const path = require('path');

const SENTINEL = '/* __ZH_HANT_AUTO__';
const I18N_DIR = path.resolve(__dirname, '..', 'docs', 'assets', 'i18n');

(async () => {
  const argv = process.argv.slice(2).map(f => path.resolve(f));
  const targets = argv.length
    ? argv
    : fs.readdirSync(I18N_DIR).filter(f => f.endsWith('.i18n.js')).map(f => path.join(I18N_DIR, f));

  const OpenCC = await import('opencc-js');
  const cn2tw = OpenCC.Converter({ from: 'cn', to: 'tw' });

  for (const file of targets) {
    if (!fs.existsSync(file)) { console.error('❌ 不存在:', file); process.exitCode = 1; continue; }
    // 1. 剥离旧自动段（幂等）
    let src = fs.readFileSync(file, 'utf8');
    const i = src.indexOf(SENTINEL);
    if (i !== -1) src = src.slice(0, i).replace(/\s+$/, '') + '\n';

    // 2. 执行文件提取 zh 字典（add() 全量合并捕获）
    const captured = {};
    const stub = { MN_I18N: { add: (l, d) => { if (l === 'zh') Object.assign(captured, d); return stub.MN_I18N; } } };
    new Function('window', src)(stub);

    // 3. 逐值 OpenCC 转换（键不变）
    const entries = [];
    for (const [k, v] of Object.entries(captured)) entries.push(`  ${JSON.stringify(k)}: ${JSON.stringify(await cn2tw(v))}`);

    const hant = '/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */\n'
      + "window.MN_I18N.add('zh-Hant', {\n" + entries.join(',\n') + '\n});\n';
    fs.writeFileSync(file, src + hant);
    console.log('✅', path.basename(file), entries.length + ' 键');
  }
})().catch(e => { console.error('❌', e); process.exit(1); });
