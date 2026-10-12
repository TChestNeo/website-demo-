'use strict';
// 图库标签查重 POST /api/tags/dedup（FC v10.28.46.0）——混合双查的后端半程：
//   前端本地智能先查（12 语言字典等价 + 归一化），未命中才来这做 DeepSeek 语义近似查重。
// 契约（前端 fluidcanvas-editor.html remoteTagDedup 权威）：
//   req:  { original ≤60, enName ≤120 可空, existing:[{id,original,enName,sys}] ≤40 }
//   res:  200 { ok:true, matches:[{id}], suggestedEn:string }
//         503 { unavailable:true }——无 API key（前端静默转本地-only）
// 降级哲学（与 chat 同）：AI 故障/超时/坏回复 → 200 空 matches（不拦创建，只损失查重建议）。
// 登录门控；宽松节流（用户自己的 key）；AI 调用自含，不 import chat.js（其 SYSTEM_PROMPT 哈希是测试红线）。

const { HttpError, sendJson, readJson } = require('../../http');
const { authenticate } = require('../../middleware/auth');

const MODEL_DEFAULT = 'deepseek-v4-flash'; // 用户钦定「用 DeepSeek V4 Flash 不要用 Pro」（env DEEPSEEK_MODEL 可覆写）
const MAX_TOKENS = 120;

const SYSTEM_TAG_DEDUP = '你是标签查重器。判断新标签与既有标签是否语义近似（同义/别名/同物不同语言）。'
  + '只输出 JSON：{"matches":[{"id":"既有标签id"}],"suggestedEn":"英文名"}。'
  + '语义近似才报 matches；suggestedEn 只在用户未提供英文名时给出意译。不得输出 JSON 以外内容。';

async function callDedupAI(ctx, original, enName, existing) {
  const cfg = (ctx.config || {}).deepseek || {};
  const req = {
    model: cfg.model || MODEL_DEFAULT,
    messages: [
      { role: 'system', content: SYSTEM_TAG_DEDUP },
      { role: 'user', content: JSON.stringify({ original, enName, existing }) }
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0
  };
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await ctx.moderation.fetchImpl(`${cfg.baseUrl || 'https://api.deepseek.com'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey || ''}`
        },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(60000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = JSON.parse(await res.text());
      const content = body.choices && body.choices[0] && body.choices[0].message
        ? body.choices[0].message.content : '';
      if (typeof content !== 'string' || !content.trim()) throw new Error('空回复');
      const cleaned = content.trim().replace(/^```(json)?|```$/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 400));
    }
  }
  throw new Error(`标签查重 AI 调用失败: ${lastErr && lastErr.message}`);
}

function register(router, ctx) {
  router.add('POST', '/api/tags/dedup', async (req, res) => {
    const user = authenticate(ctx.db, req, res, ctx); // 未登录 401 UNAUTHORIZED

    const body = await readJson(req);
    const original = body && typeof body.original === 'string' ? body.original.trim().slice(0, 60) : '';
    if (!original) throw new HttpError('VALIDATION', 'original 不能为空');
    const enName = body && typeof body.enName === 'string' ? body.enName.trim().slice(0, 120) : '';
    const existing = body && Array.isArray(body.existing)
      ? body.existing.slice(0, 40).filter(e => e && typeof e.id === 'string' && e.id)
      : [];

    // 无 key：503 unavailable（前端静默转本地-only，零打扰）
    if (!((ctx.config || {}).deepseek || {}).apiKey) {
      sendJson(res, 503, { unavailable: true });
      return;
    }

    // 宽松节流（用户自己的 key；测试可覆盖 config.rateLimits.tagDedup）
    const rl = ctx.config.rateLimits || {};
    const w = rl.tagDedup || { max: 20, windowMs: 60000 };
    if (!ctx.limiter('tags:dedup:' + user.id, w.max, w.windowMs)) {
      throw new HttpError('RATE_LIMITED', '查重过于频繁，请稍后再试');
    }

    try {
      // v0.2.59.35：AI 排队层——高峰排队等位（超时抛 AiBusyError → 走下方降级 200 空 matches）
      const out = await ctx.aiLimiter.withSlot(() => callDedupAI(ctx, original, enName, existing));
      const matches = Array.isArray(out && out.matches)
        ? out.matches.filter(m => m && m.id && existing.some(e => e.id === m.id)).map(m => ({ id: m.id }))
        : [];
      sendJson(res, 200, {
        ok: true,
        matches,
        suggestedEn: typeof (out && out.suggestedEn) === 'string' ? out.suggestedEn.slice(0, 120) : ''
      });
    } catch (e) {
      // AI 故障降级：200 空 matches（不拦创建）
      sendJson(res, 200, { ok: true, matches: [], suggestedEn: '' });
    }
  });
}

module.exports = { register, callDedupAI, MODEL_DEFAULT, SYSTEM_TAG_DEDUP };
