// tmp-story-assemble.js — 校验各语言词典（键齐全/语法/无漏译）+ 生成汇总报告
'use strict';
const fs = require('fs');
const path = require('path');

const STORY = path.resolve(__dirname, '..', 'docs', 'story');
const src = JSON.parse(fs.readFileSync(path.join(STORY, 'story-texts.json'), 'utf8'));
const srcKeys = Object.keys(src);
console.log('源键数:', srcKeys.length);

const LANGS = ['en', 'de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt', 'zht'];
const GLOBALS = { en: 'STORY_DICT_EN', de: 'STORY_DICT_DE', ru: 'STORY_DICT_RU', ms: 'STORY_DICT_MS', th: 'STORY_DICT_TH', vi: 'STORY_DICT_VI', id: 'STORY_DICT_ID', fr: 'STORY_DICT_FR', es: 'STORY_DICT_ES', pt: 'STORY_DICT_PT', zht: 'STORY_DICT_ZHT' };

let okAll = true;
for (const l of LANGS) {
  const f = path.join(STORY, 'i18n', 'story-' + l + '.js');
  if (!fs.existsSync(f)) { console.log('[' + l + '] 缺失'); okAll = false; continue; }
  const code = fs.readFileSync(f, 'utf8');
  let dict = null;
  try {
    const g = {};
    new Function('window', code)(g);
    dict = g[GLOBALS[l]];
  } catch (e) {
    console.log('[' + l + '] 语法/执行错误: ' + e.message.slice(0, 120));
    okAll = false;
    continue;
  }
  if (!dict || typeof dict !== 'object') { console.log('[' + l + '] 全局变量缺失'); okAll = false; continue; }
  const dk = Object.keys(dict);
  const missing = srcKeys.filter((k) => !(k in dict));
  const extra = dk.filter((k) => !srcKeys.includes(k));
  const empty = dk.filter((k) => typeof dict[k] !== 'string' || !dict[k].trim());
  // 内联标签完整性抽查：凡原文含 <span 的键，译文也应含 <span
  const tagBroken = srcKeys.filter((k) => src[k].indexOf('<span') !== -1 && (!dict[k] || dict[k].indexOf('<span') === -1));
  console.log(`[${l}] 键 ${dk.length}/${srcKeys.length} 缺 ${missing.length} 多 ${extra.length} 空 ${empty.length} 丢标签 ${tagBroken.length}`);
  if (missing.length || extra.length || empty.length || tagBroken.length) okAll = false;
}
console.log(okAll ? 'ALL OK' : '有问题，见上');
