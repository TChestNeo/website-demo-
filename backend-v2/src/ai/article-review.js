'use strict';
// 文章发布审核 + 简介生成（用户「上传发布文章时让 DeepSeek Flash 读文章检查违规 + 检查/生成简介」）。
// DeepSeek V4 Flash（tags.js 钦定同款）；自含调用，不 import chat.js。
// 降级哲学：无 key / AI 故障 / 超时 / 坏回复 → 抛错，调用方 catch 后放行发布（不拦截、无简介）。
// violated → 调用方拒绝发布（MODERATION 错误）。

const MODEL_DEFAULT = 'deepseek-v4-flash';
const MAX_TOKENS = 500;
const SUMMARY_MAX = 125; // 简介最多 125 字（搜索页展示上限）
const BLOB_MAX = 1500; // 检索摘要 JSON 串上限（省 token 压缩表征）

// v0.2.59.35：AI 排队层——无 ctx.aiLimiter 时直连（测试/独立调用兜底）
function limiterOf(ctx) {
  return (ctx && ctx.aiLimiter) ? ctx.aiLimiter : { withSlot: async (fn) => fn() };
}

// v0.2.59.28：一次调用同时产出简介 + 检索摘要 searchBlob（智能搜索按 blob 匹配，避免反复读全文烧 token）
const SYSTEM_PROMPT = '你是内容审核员兼简介与检索摘要生成器。阅读文章标题与正文，完成三件事：'
  + '1. 判断是否含有违规内容（色情、暴力、仇恨、诈骗、违法、政治敏感等）。'
  + '2. 生成一段中文文章简介（不超过 125 字，概括文章主旨）。'
  + '3. 生成检索摘要 searchBlob（供语义搜索匹配用，JSON 对象，各字段尽量简短）：'
  + '{"topic":"一句话主题(≤30字)","keywords":["关键词1","关键词2","关键词3"],"core":["核心观点1","核心观点2"],"entities":["人名/国家/事件实体1","实体2"],"genre":"文章体裁(政治科普/历史/教程/宣言/虚构等)"}。'
  + '只输出 JSON：{"violated":false,"summary":"简介文字","searchBlob":{...}}。'
  + 'violated=true 时 summary 给空字符串、searchBlob 给 null。不得输出 JSON 以外的任何内容。';

async function reviewArticle(ctx, title, text) {
  const cfg = (ctx.config || {}).deepseek || {};
  if (!cfg.apiKey) throw new Error('无 DeepSeek API key');
  const req = {
    model: cfg.model || MODEL_DEFAULT,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ title, text }) }
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0
  };
  const res = await limiterOf(ctx).withSlot(() => ctx.moderation.fetchImpl(`${cfg.baseUrl || 'https://api.deepseek.com'}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(15000)
  }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = JSON.parse(await res.text());
  const content = body.choices && body.choices[0] && body.choices[0].message
    ? body.choices[0].message.content : '';
  if (typeof content !== 'string' || !content.trim()) throw new Error('空回复');
  const cleaned = content.trim().replace(/^```(json)?|```$/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const violated = !!parsed.violated;
  const summary = (typeof parsed.summary === 'string' ? parsed.summary : '').trim().slice(0, SUMMARY_MAX);
  // v0.2.59.28 检索摘要：对象 → 紧凑 JSON 串入库（供智能搜索候选列表；坏形状/超长直接弃）
  let searchBlob = null;
  if (!violated && parsed.searchBlob && typeof parsed.searchBlob === 'object') {
    try {
      const s = JSON.stringify(parsed.searchBlob).slice(0, BLOB_MAX);
      if (s.length > 2) searchBlob = s;
    } catch (e) { searchBlob = null; }
  }
  return { violated, summary: summary || null, searchBlob };
}

// v0.2.59.28 智能搜索：自然语言查询 + 候选文章（标题/简介/检索摘要）→ DeepSeek Flash 排序返回 id 列表
async function smartSearch(ctx, query, candidates) {
  const cfg = (ctx.config || {}).deepseek || {};
  if (!cfg.apiKey) throw new Error('无 DeepSeek API key');
  const cand = candidates.map((r) => {
    let blob = null;
    if (r.search_blob) { try { blob = JSON.parse(r.search_blob); } catch (e) { blob = null; } }
    return { id: r.id, title: r.title, summary: r.summary || '', blob };
  });
  const req = {
    model: cfg.model || MODEL_DEFAULT,
    messages: [
      {
        role: 'system',
        content: '你是文章搜索匹配器。用户用自然语言描述想找的文章，你根据每篇文章的标题、简介与检索摘要(blob)判断相关性。'
          + '返回 JSON：{"ids":["ART-xxxx",...]}，按相关度从高到低排列，最多 10 个；都不相关返回 {"ids":[]}。只输出 JSON，不得输出其他内容。'
      },
      { role: 'user', content: JSON.stringify({ query, articles: cand }) }
    ],
    max_tokens: 400,
    temperature: 0
  };
  const res = await limiterOf(ctx).withSlot(() => ctx.moderation.fetchImpl(`${cfg.baseUrl || 'https://api.deepseek.com'}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(15000)
  }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = JSON.parse(await res.text());
  const content = body.choices && body.choices[0] && body.choices[0].message
    ? body.choices[0].message.content : '';
  if (typeof content !== 'string' || !content.trim()) throw new Error('空回复');
  const cleaned = content.trim().replace(/^```(json)?|```$/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((x) => typeof x === 'string').slice(0, 10) : [];
  const byId = new Map(candidates.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

// 从 contentJson（FC draft 整体 JSON）提取纯文本（截断 4000 字保护成本）
function extractArticleText(contentJson) {
  let cj = contentJson;
  if (typeof cj === 'string') { try { cj = JSON.parse(cj); } catch (e) { cj = null; } }
  if (!cj || !Array.isArray(cj.cards)) return '';
  const parts = [];
  for (const c of cj.cards) {
    if (!c) continue;
    const raw = (typeof c.content === 'string' && c.content)
      ? c.content
      : (typeof c.label === 'string' ? c.label : '');
    if (!raw) continue;
    const t = raw.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (t) parts.push(t);
  }
  return parts.join(' ').slice(0, 4000);
}

module.exports = { reviewArticle, smartSearch, extractArticleText, MODEL_DEFAULT, SUMMARY_MAX };
