// tmp-story-extract.js — 提取故事站全文清单 + 页面改造成 data-i18n 键
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STORY = path.join(ROOT, 'docs', 'story');
const wipPath = path.join(STORY, 'wip.html');
const idxPath = path.join(STORY, 'index.html');

let html = fs.readFileSync(wipPath, 'utf8');
const dict = {};

// 辅助：登记键（重复内容同值不重复登记——键唯一即可）
function put(key, value) {
  if (key in dict) {
    // 同一键不同值 → 追加序号（理论上不会发生；防御）
    let i = 2;
    while ((key + '_' + i) in dict) i++;
    dict[key + '_' + i] = value;
    return key + '_' + i;
  }
  dict[key] = value;
  return key;
}

let sceneKey = null; // 当前场景 data-scene

// 1. 品牌
put('brand', '政治启蒙');

// 2. 序章 hero
put('home.title', '政治');
put('home.sub', '先了解政治，再创造国家');

// 3. 遍历场景：kicker / title / narration 行 / quote / evt / reflect / thinkers / kmap
const sceneRe = /<section[^>]*data-scene="([^"]+)"[^>]*>([\s\S]*?)(?=<section|\n\s*<\/main>)/g;
let sm;
while ((sm = sceneRe.exec(html))) {
  sceneKey = sm[1];
  const block = sm[2];

  const kicker = /<p class="scene-kicker"[^>]*>([\s\S]*?)<\/p>/.exec(block);
  if (kicker) put(sceneKey + '.kicker', kicker[1].trim());

  const title = /<h[12] class="scene-title"[^>]*>([\s\S]*?)<\/h[12]>/.exec(block);
  if (title) put(sceneKey + '.title', title[1].trim());

  const narr = /<div class="narration"[^>]*>([\s\S]*?)<\/div>/.exec(block);
  if (narr) {
    let li = 0;
    const lineRe = /<p class="line">([\s\S]*?)<\/p>/g;
    let lm;
    while ((lm = lineRe.exec(narr[1]))) {
      li++;
      put(sceneKey + '.l' + li, lm[1].trim());
    }
  }

  const quote = /<blockquote class="quote"><q>([\s\S]*?)<\/q><cite>([\s\S]*?)<\/cite><\/blockquote>/.exec(block);
  if (quote) {
    put(sceneKey + '.q', quote[1].trim());
    put(sceneKey + '.cite', quote[2].trim());
  }

  // evt 块：按顺序 + 类名
  let ei = 0;
  const evtRe = /<div class="evt(?: (evt-\w+))?">\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/g;
  let em;
  while ((em = evtRe.exec(block))) {
    ei++;
    const type = em[1] || ('evt' + ei);
    put(sceneKey + '.evt.' + type.replace(/^evt-/, '') + '.h', em[2].trim());
    put(sceneKey + '.evt.' + type.replace(/^evt-/, '') + '.b', em[3].trim());
  }

  const refl = /<div class="reflect">\s*<div class="r-head">([\s\S]*?)<\/div>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/.exec(block);
  if (refl) {
    put(sceneKey + '.reflect.h', refl[1].trim());
    put(sceneKey + '.reflect.b', refl[2].trim());
  }

  const thinkers = /<div class="thinkers">([\s\S]*?)<\/div>/.exec(block);
  if (thinkers) put(sceneKey + '.thinkers', thinkers[1].trim());

  // fc-words 内的词（冷战）
  const fcw = /<span class="fc-words"[^>]*>([\s\S]*?)<\/span>/.exec(block);
  if (fcw) put(sceneKey + '.fcw', fcw[1].trim());

  const cta = /<a class="story-cta"[^>]*>([\s\S]*?)<\/a>/.exec(block);
  if (cta) put(sceneKey + '.cta', cta[1].trim());

  // kmap
  const kmRoot = /<div class="kmap-root">([\s\S]*?)<\/div>/.exec(block);
  if (kmRoot) put(sceneKey + '.kmap.root', kmRoot[1].trim());
  const kmNodes = block.match(/<li class="kmap-node"[^>]*>([\s\S]*?)<\/li>/g) || [];
  kmNodes.forEach((n, i) => {
    const t = /<li class="kmap-node"[^>]*>([\s\S]*?)<\/li>/.exec(n);
    if (t) put(sceneKey + '.kmap.n' + (i + 1), t[1].trim());
  });
  const kmLeg = /<div class="kmap-legend">([\s\S]*?)<\/div>/.exec(block);
  if (kmLeg) put(sceneKey + '.kmap.legend', kmLeg[1].trim());
}

// 4. 页脚
put('foot.head', '阅读口径');
put('foot.p1', '普遍接受的事实');
put('foot.p2', '学界的一种解释');
put('foot.p3', '仍在争论的问题');
put('foot.note', '以上六章均为入门级简化呈现；深入阅读，请以学术著作为准。同一个问题，不同的国家有不同的答案。');

// 5. index.html 加载页
const idx = fs.readFileSync(idxPath, 'utf8');
const loading = /正在进入政治启蒙故事……/.test(idx) ? '正在进入政治启蒙故事……' : '';
put('idx.loading', loading);

// 6. 页面改造：静态中文 → data-i18n 键（zh 文本保留为兜底）
// 键按文档顺序消费（同值多次出现各得各键）
const used = {};
const getKey = (val) => {
  for (const k in dict) { if (!used[k] && dict[k] === val) { used[k] = 1; return k; } }
  return null;
};

let out = html;

// 品牌
out = out.replace(/<span class="sb-cn">政治启蒙<\/span>/, '<span class="sb-cn" data-i18n="brand">政治启蒙</span>');
// hero
out = out.replace(/<h1 class="se-title">政治<\/h1>/, '<h1 class="se-title" data-i18n="home.title">政治</h1>');
out = out.replace(/<div class="se-sub-line">先了解政治，再创造国家<\/div>/, '<div class="se-sub-line" data-i18n="home.sub">先了解政治，再创造国家</div>');

// kicker
out = out.replace(/<p class="scene-kicker">([\s\S]*?)<\/p>/g, (m, t) => {
  const k = getKey(t.trim());
  return k ? `<p class="scene-kicker" data-i18n="${k}">${t}</p>` : m;
});
// title（h1/h2 纯文本）
out = out.replace(/(<h[12]) class="scene-title">([\s\S]*?)<\/h[12]>/g, (m, tag, t) => {
  const k = getKey(t.trim());
  return k ? `${tag} class="scene-title" data-i18n="${k}">${t}</h${tag[2]}>` : m;
});
// narration 行（可能带 tag/fc-words 内联 → html 口径）
out = out.replace(/<p class="line">([\s\S]*?)<\/p>/g, (m, t) => {
  const k = getKey(t.trim());
  return k ? `<p class="line" data-i18n-html="${k}">${t}</p>` : m;
});
// quote
out = out.replace(/<blockquote class="quote"><q>([\s\S]*?)<\/q><cite>([\s\S]*?)<\/cite><\/blockquote>/g, (m, q, c) => {
  const kq = getKey(q.trim());
  const kc = getKey(c.trim());
  const aq = kq ? ` data-i18n="${kq}"` : '';
  const ac = kc ? ` data-i18n="${kc}"` : '';
  return `<blockquote class="quote"><q${aq}>${q}</q><cite${ac}>${c}</cite></blockquote>`;
});
// evt h3（背景/经过/行动者/…）
out = out.replace(/<h3>([\s\S]*?)<\/h3>/g, (m, t) => {
  const k = getKey(t.trim());
  return k ? `<h3 data-i18n="${k}">${t}</h3>` : m;
});
// reflect 头
out = out.replace(/<div class="r-head">([\s\S]*?)<\/div>/g, (m, t) => {
  const k = getKey(t.trim());
  return k ? `<div class="r-head" data-i18n="${k}">${t}</div>` : m;
});
// thinkers
out = out.replace(/<div class="thinkers">([\s\S]*?)<\/div>/g, (m, t) => {
  const k = getKey(t.trim());
  return k ? `<div class="thinkers" data-i18n="${k}">${t}</div>` : m;
});
// fc-words 内词
out = out.replace(/<span class="fc-words"([^>]*)>([\s\S]*?)<\/span>/g, (m, attr, t) => {
  const k = getKey(t.trim());
  return k ? `<span class="fc-words"${attr} data-i18n="${k}">${t}</span>` : m;
});
// CTA
out = out.replace(/<a class="story-cta"([^>]*)>([\s\S]*?)<\/a>/g, (m, attr, t) => {
  const k = getKey(t.trim());
  return k ? `<a class="story-cta"${attr} data-i18n="${k}">${t}</a>` : m;
});
// kmap
out = out.replace(/<div class="kmap-root">([\s\S]*?)<\/div>/g, (m, t) => {
  const k = getKey(t.trim());
  return k ? `<div class="kmap-root" data-i18n="${k}">${t}</div>` : m;
});
out = out.replace(/<li class="kmap-node"([^>]*)>([\s\S]*?)<\/li>/g, (m, attr, t) => {
  const k = getKey(t.trim());
  return k ? `<li class="kmap-node"${attr} data-i18n="${k}">${t}</li>` : m;
});
out = out.replace(/<div class="kmap-legend">([\s\S]*?)<\/div>/g, (m, t) => {
  const k = getKey(t.trim());
  return k ? `<div class="kmap-legend" data-i18n="${k}">${t}</div>` : m;
});
// 泛化：剩余纯 <p>（evt 正文 / reflect 正文等，可能含内联 tag → html 口径）
out = out.replace(/<p>([\s\S]*?)<\/p>/g, (m, t) => {
  const k = getKey(t.trim());
  return k ? `<p data-i18n-html="${k}">${t}</p>` : m;
});
// footer
out = out.replace(/<div class="s-head">阅读口径<\/div>/, '<div class="s-head" data-i18n="foot.head">阅读口径</div>');
out = out.replace(/<span class="tag tag-fact">Fact<\/span>普遍接受的事实/, '<span class="tag tag-fact">Fact</span><span data-i18n="foot.p1">普遍接受的事实</span>');
out = out.replace(/<span class="tag tag-interp">Interpretation<\/span>学界的一种解释/, '<span class="tag tag-interp">Interpretation</span><span data-i18n="foot.p2">学界的一种解释</span>');
out = out.replace(/<span class="tag tag-debate">Debate<\/span>仍在争论的问题/, '<span class="tag tag-debate">Debate</span><span data-i18n="foot.p3">仍在争论的问题</span>');
out = out.replace(/<p>以上六章均为入门级简化呈现[\s\S]*?<\/p>/, `<p data-i18n="foot.note">以上六章均为入门级简化呈现；深入阅读，请以学术著作为准。同一个问题，不同的国家有不同的答案。</p>`);

fs.writeFileSync(wipPath, out);
fs.writeFileSync(path.join(STORY, 'story-texts.json'), JSON.stringify(dict, null, 2));

// 统计
const nKeys = Object.keys(dict).length;
const totalChars = Object.values(dict).reduce((s, v) => s + v.length, 0);
console.log('键数:', nKeys, '| 总字符:', totalChars);
console.log('清单已写:', path.join(STORY, 'story-texts.json'));
console.log('页面已改造:', wipPath);
