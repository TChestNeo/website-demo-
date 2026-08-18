'use strict';
// DeepSeek V4 Pro 批处理文字审核（高峰 9/0.30/27 元每百万 tokens，低谷半价——cron 错峰三班）。
// 缓存前缀摊薄：system 提示词为字节级常量（上线后不可改，改了整条缓存失效），动态内容全放 user message。
// 输出 schema（response_format json_object，按 id 匹配防乱序）：
//   {"results":[{"id","verdict":"pass|reject|escalate","severity":0-3,"reason_code","labels":[],"confidence":0-1}]}
// 应用判定（queue.js）：pass → ai_approved；reject → ai_rejected + 下架；
//   escalate / severity≥2 / confidence<0.7 → needs_human（AI 只做粗筛，人工兜底）。
// 预算预检由调用方做（budget.canSpend）；本函数负责重试 3 次，全败 → 抛错（queue 转 needs_human）。

// ═══ system 常量：上线后不可改（改动 = 缓存前缀失效 + 判定口径漂移）═══
const SYSTEM_PROMPT = '你是 M.NationWorld 微国家社区的审核员，按规则判定用户内容。只输出 JSON，不要解释。\n'
  + '输出格式：{"results":[{"id":"<内容id>","verdict":"pass|reject|escalate","severity":0,"reason_code":"<短码>","labels":["<标签>"],"confidence":0.9}]}\n'
  + '判定标准：\n'
  + '- pass = 正常内容。注意：本平台核心玩法是虚构世界观（自建国家、架空战争、角色扮演），虚构设定内容一律 pass，不得判违规。\n'
  + '- reject = 真实世界仇恨言论、儿童色情、诈骗广告、真实暴力威胁、针对真人的辱骂攻击。\n'
  + '- escalate = 无法确定或跨文化争议内容。\n'
  + '- severity：0=正常 1=轻微 2=严重 3=零容忍。confidence 低于 0.7 时必须把 verdict 设为 escalate。\n'
  + 'reason_code 用：hate / csam / scam / violence / abuse / spam / none。';

const MAX_TOKENS = 1000;   // 50 项 × ~16 token/项 ≈ 800（计划的 ≤80 针对客服单条回复）

function buildRequest(cfg, items) {
  return {
    model: (cfg.deepseek || {}).model || 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ items }) }
    ],
    response_format: { type: 'json_object' },
    max_tokens: MAX_TOKENS,
    temperature: 0.1
  };
}

// 解析响应 → 按 id 匹配回原条目；坏形状视为失败（重试）
function parseResponse(raw, items) {
  const body = JSON.parse(raw);
  const content = body.choices && body.choices[0] && body.choices[0].message
    ? body.choices[0].message.content : null;
  if (typeof content !== 'string') throw new Error('无 choices[0].message.content');
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed.results)) throw new Error('结果缺 results 数组');
  const byId = new Map(parsed.results.filter(r => r && typeof r.id === 'string').map(r => [r.id, r]));
  const usage = body.usage || {};
  return {
    results: items.map(it => {
      const r = byId.get(it.id);
      return r ? {
        id: it.id,
        verdict: String(r.verdict || 'escalate'),
        severity: Number(r.severity) || 0,
        reasonCode: String(r.reason_code || 'none'),
        labels: Array.isArray(r.labels) ? r.labels : [],
        confidence: Number(r.confidence) || 0
      } : { id: it.id, verdict: 'escalate', severity: 0, reasonCode: 'parse_miss', labels: [], confidence: 0 };
    }),
    usage: {
      in: usage.prompt_tokens || 0,
      out: usage.completion_tokens || 0,
      cached: usage.prompt_cache_hit_tokens || 0
    }
  };
}

// items: [{id, text}]；重试 3 次（每次间隔递增）；成功返回 { results, usage, latencyMs }
async function classifyBatch(cfg, fetchImpl, items, batchId) {
  const baseUrl = (cfg.deepseek || {}).baseUrl || 'https://api.deepseek.com';
  const req = buildRequest(cfg, items);
  const started = Date.now();
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(cfg.deepseek || {}).apiKey || ''}`
        },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(60000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseResponse(await res.text(), items);
      return { results: parsed.results, usage: parsed.usage, latencyMs: Date.now() - started, batchId };
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  throw new Error(`DeepSeek 批处理失败（重试 3 次）: ${lastErr && lastErr.message}`);
}

module.exports = { classifyBatch, parseResponse, SYSTEM_PROMPT, MAX_TOKENS };
