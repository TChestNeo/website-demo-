'use strict';
// L0 规则引擎（纯函数，0 元成本，同步 ~5ms）——成本漏斗第一层。
//   evaluateText(text, blocklist) → { verdict, reasonCode, severity, hits }
//     verdict: 'pass' | 'hold' | 'reject'
//       reject = zero_tolerance（命中即拒绝 + 直接封号，跳过阶梯）
//       hold   = warning 违禁词 / spam（外链刷屏、字符刷屏）→ l0_hold 人工
// 匹配规则：zh 子串匹配（无空格分词）；en/ms 词边界匹配（防 hello 误伤 hell / pembabitan 误伤 babi）。
// 词表 data/blocklist.json 由调用方 require 注入（测试可换）。
// sha1 去重用：normalize（小写 + 合并空白 + 去 URL）后由调用方哈希。

const crypto = require('node:crypto');

const URL_RE = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
const RUN_RE = /(.)\1{9,}/;          // 同一字符连续 ≥10 次（刷屏）
const MAX_LINKS = 3;                  // 外链 ≥3 条 → spam

const LANG_RE = {
  en: /[a-z]/i,
  ms: /[a-z]/i
};

function wordBoundaryMatch(text, word) {
  // \b + 可选复数/词尾变化，防误伤包含词（hell→hello 已由 \b 挡住）
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es)?\\b`, 'i');
  return re.test(text);
}

function scanTier(text, words, lang, tier) {
  const hits = [];
  for (const w of words || []) {
    const hit = (LANG_RE[lang] ? wordBoundaryMatch(text, w) : text.includes(w));
    if (hit) hits.push({ tier, lang, word: w });
  }
  return hits;
}

function evaluateText(text, blocklist) {
  const s = String(text || '');
  // 零容忍优先级最高：命中即 reject（不再看 warning）
  let hits = [];
  for (const lang of ['zh', 'en', 'ms']) {
    hits = hits.concat(scanTier(s, blocklist.zero_tolerance[lang], lang, 'zero_tolerance'));
  }
  if (hits.length) return { verdict: 'reject', reasonCode: 'zero_tolerance', severity: 3, hits };

  for (const lang of ['zh', 'en', 'ms']) {
    hits = hits.concat(scanTier(s, blocklist.warning[lang], lang, 'warning'));
  }
  if (hits.length) return { verdict: 'hold', reasonCode: 'blocklist_warning', severity: 1, hits };

  const links = (s.match(URL_RE) || []).length;
  if (links >= MAX_LINKS) {
    return { verdict: 'hold', reasonCode: 'spam', severity: 1, hits: [{ tier: 'spam', lang: 'any', word: `links:${links}` }] };
  }
  const run = s.match(RUN_RE);
  if (run) {
    return { verdict: 'hold', reasonCode: 'spam', severity: 1, hits: [{ tier: 'spam', lang: 'any', word: `run:${run[1]}` }] };
  }
  return { verdict: 'pass', reasonCode: null, severity: 0, hits: [] };
}

// 去重规范化：小写 + 合并空白 + 去 URL（哈希由调用方算）
function normalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').replace(URL_RE, ' ').trim();
}

function hashOf(text) {
  return crypto.createHash('sha1').update(normalize(text), 'utf8').digest('hex');
}

module.exports = { evaluateText, normalize, hashOf, wordBoundaryMatch };
