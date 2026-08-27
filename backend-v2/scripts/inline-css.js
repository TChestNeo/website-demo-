'use strict';
// inline-css.js — 切页闪白修复第 2 层（08-28）构建脚本（常驻，ethereal.css 改动后须重跑再部署）：
// ① ethereal.css 内联进全部引用它的 HTML <head>（原位替换 <link> → <style>，级联顺序不变）——
//    浏览器画第一帧不再需要单独等一个样式表往返（实测冷缓存 FCP 304ms → ~130ms；热缓存 HTML 走 304 无体积代价）；
// ② Google Fonts CSS2 @font-face 内联（按 URL 抓取缓存，woff2 文件仍走 fonts.gstatic.com，非渲染阻塞、带浏览器缓存）——
//    首帧零渲染阻塞外部请求；display=swap 由 Google 返回的 CSS 自带；
// ③ 引用 transitions.js 的页面：<body> 加 pre-stagger 类（CSS 让卡片在淡入编排开始前保持隐藏，
//    防「浏览器在 DOMContentLoaded 前先画全内容 → JS 藏起来 → 再逐个淡入」的双重绘制闪）
//    + transitions.js 标签后插 1.6s 兜底脚本（脚本失效时解除隐藏防永久空白）。
// 幂等：三处改动均可重复运行（已内联/已加类/已有兜底则跳过）。
// 用法：node scripts/inline-css.js
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT = path.join(__dirname, '..', '..');
const DOCS = path.join(ROOT, 'docs');
const CSS_PATH = path.join(DOCS, 'assets', 'css', 'ethereal.css');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

const CSS_MARK = '/* ethereal.css 内联（切页闪修复 08-28：样式与 HTML 同包到达——浏览器画第一帧不再等样式表往返）*/';
const FONT_MARK = '/* Google Fonts @font-face 内联（同修复；woff2 文件仍走 fonts.gstatic.com，非渲染阻塞、带缓存）*/';
const SAFETY_MARK = 'pre-stagger 兜底';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (r) => {
      let b = '';
      r.on('data', (d) => b += d);
      r.on('end', () => (r.statusCode === 200 ? resolve(b) : reject(new Error(`字体 CSS ${r.statusCode}: ${url}`))));
    }).on('error', reject);
  });
}

function htmlFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

async function main() {
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const fontCache = new Map(); // URL → CSS 文本
  const files = htmlFiles(DOCS);
  const stats = { inlined: 0, fonts: 0, stagger: 0, skipped: 0 };

  for (const file of files) {
    let text = fs.readFileSync(file, 'utf8');
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const before = text;
    const rel = path.relative(DOCS, file).replace(/\\/g, '/');

    // ① ethereal.css → <style>（两种属性顺序都认）
    text = text.replace(/<link rel="stylesheet" href="[^"]*ethereal\.css">/g, () => `<style>${eol}${CSS_MARK}${eol}${css}${eol}</style>`);
    text = text.replace(/<link href="[^"]*ethereal\.css" rel="stylesheet">/g, () => `<style>${eol}${CSS_MARK}${eol}${css}${eol}</style>`);

    // ② Google Fonts <link> → <style>（按 URL 抓取缓存）
    const fontLink = /<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]*)" rel="stylesheet">/g;
    const urls = [...new Set([...text.matchAll(fontLink)].map((m) => m[1]))];
    for (const url of urls) {
      if (!fontCache.has(url)) fontCache.set(url, await fetchText(url));
    }
    text = text.replace(fontLink, (whole, url) => {
      const fontCss = fontCache.get(url);
      return `<style>${eol}${FONT_MARK}${eol}${fontCss}${eol}</style>`;
    });

    // ③ transitions.js 页面：pre-stagger + 兜底。
    //    注意：必须用脚本标签正则判断——内联的 ethereal.css 注释里就有「transitions.js」字样，
    //    用 includes 会把所有页面都误判（08-28 首跑教训，已恢复重跑）。
    const TRANSITIONS_TAG = /<script src="[^"]*transitions\.js"><\/script>/;
    let addedStagger = false;
    if (TRANSITIONS_TAG.test(text)) {
      if (!/<body[^>]*class="[^"]*pre-stagger/.test(text)) {
        text = text.replace(/<body([^>]*?)>/, (m, attrs) => {
          const cm = attrs.match(/^(\s*)class="([^"]*)"/);
          if (cm) return `<body${cm[1]}class="${cm[2]} pre-stagger"${attrs.slice(cm[0].length)}>`;
          return `<body class="pre-stagger"${attrs}>`;
        });
        addedStagger = true;
      }
      if (!text.includes(SAFETY_MARK)) {
        const safety = `<script>/* ${SAFETY_MARK}（切页闪修复 08-28）：若 transitions.js 未执行，1.6s 后解除隐藏防页面永久空白 */${eol}setTimeout(function () { var b = document.body; if (b) b.classList.remove('pre-stagger'); }, 1600);${eol}</script>`;
        text = text.replace(TRANSITIONS_TAG, (m) => m + eol + safety);
      }
    }

    if (text !== before) {
      fs.writeFileSync(file, text, 'utf8');
      stats.inlined++;
      if (addedStagger) stats.stagger++;
      if (text.includes(FONT_MARK)) stats.fonts++;
      console.log(`  改: ${rel}`);
    } else {
      stats.skipped++;
      console.log(`  跳过（无改动）: ${rel}`);
    }
  }

  console.log(`\n完成：共 ${files.length} 个 HTML，内联 ${stats.inlined}（含字体 ${stats.fonts}、pre-stagger ${stats.stagger}）、跳过 ${stats.skipped}`);
  console.log(`字体 CSS 抓取 ${fontCache.size} 个 URL（${[...fontCache.keys()].join(' | ')}）`);
}

main().catch((e) => { console.error('inline-css 失败:', e.message); process.exit(1); });
