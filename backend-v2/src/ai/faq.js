'use strict';
// FAQ 检索（0 元档，成本漏斗第一级）：无 embedding，关键词交集打分。
// score = min(1, hits / 3)（zh 子串 + en/ms 词边界命中合并计数）→ 阈值 FAQ_SCORE_MIN = 0.6 ⇔ 至少 2 个关键词。
// 语言无关：三条关键词表都试，取最高分（关键词本身按语言区分，跨语言不会互相误伤）。
// 命中 → 直接返回 FAQ 原文，usage_log 记 chat_faq_hit（0 成本）；未命中 → 上层走 DeepSeek。

const faqData = require('./faq.json');

const FAQ_SCORE_MIN = 0.6;
const ENTRIES = faqData.entries || [];

// 规范化：小写 + 去 URL + 只留字母数字（\p{L} 含 CJK）→ 单空格
function normalize(text) {
  return String(text || '').toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// en/ms 词边界匹配（允许单复数后缀；正则特殊字符转义）
function wordMatch(text, kw) {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\b' + esc + '(?:s|es)?\\b').test(text);
}

// zh 子串匹配（对照「带空格」与「去空格」两种形态，如 '13岁' vs '13 岁'）
function zhMatch(text, kw) {
  return text.includes(kw) || text.replace(/\s+/g, '').includes(kw);
}

function matches(text, kw, lang) {
  return lang === 'zh' ? zhMatch(text, kw) : wordMatch(text, kw);
}

// 单条目打分：三语言关键词表分别计数，取最高
function scoreEntry(text, entry) {
  let best = 0;
  for (const lang of ['zh', 'en', 'ms']) {
    const kws = (entry.keywords || {})[lang] || [];
    if (!kws.length) continue;
    let hits = 0;
    for (const kw of kws) if (matches(text, kw, lang)) hits++;
    best = Math.max(best, Math.min(1, hits / 3));
  }
  return best;
}

// 最高分条目（同分取文档序）；未达阈值返回 null
function bestMatch(text) {
  const norm = normalize(text);
  if (!norm) return null;
  let best = null;
  for (const entry of ENTRIES) {
    const score = scoreEntry(norm, entry);
    if (score >= FAQ_SCORE_MIN && (!best || score > best.score)) best = { entry, score };
  }
  return best;
}

module.exports = { bestMatch, scoreEntry, normalize, FAQ_SCORE_MIN };
