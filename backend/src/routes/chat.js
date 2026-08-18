'use strict';
// AI 客服 POST /api/chat（P8）——契约逐字对齐 docs/assets/js/ai-chat.js（前端权威）：
//   req:  { sessionId, locale, messages: [{role, content}] ≤10 }
//   res:  200 { reply: string, needsHuman: boolean, ticketHint: string|null }；错误走统一 {"error":{code,message}}
// 服务端不存对话内容（前端本机 7 天/30 会话口径不变），只记 usage_log 账单。
// 成本漏斗（每级 0 元才到下一级，AI 故障/预算耗尽只降级不硬下线）：
//   1. needsHuman 规则先行（退款/被盗/执法/数据导出/<13 岁，0 元）→ 人工卡 + ticketHint
//   2. FAQ 检索（ai/faq.js 关键词交集 ≥0.6，0 元）→ FAQ 原文直答
//   3. budget.canSpend('chat') 预检失败 → 降级引导语 HTTP 200
//   4. DeepSeek（静态 system 前缀缓存 + max_tokens 80）→ 失败也降级 HTTP 200

const { HttpError, sendJson, readJson } = require('../http');
const { ipOf } = require('../middleware/ratelimit');
const { bestMatch, normalize } = require('../ai/faq');
const { SYSTEM_PROMPT, MAX_TOKENS } = require('../ai/prompt');

const MAX_MESSAGES = 10;      // 契约 ≤10 条
const MAX_CONTENT = 4000;     // 与私讯同档上限，防刷 token
const MAX_REPLY = 400;        // 回复兜底截断（max_tokens 80 下正常远小于此）

// ── needsHuman 规则（先行 0 元档）：zh 子串 / en·ms 词边界；命中 → 人工卡，不调 AI ──
const HUMAN_RULES = [
  { zh: ['退款', '退钱', '退费', '重复扣款', '乱扣钱', '扣了两次'], en: ['refund', 'chargeback', 'money back', 'double charged', 'overcharged'], ms: ['bayar balik', 'pulangan wang', 'caj dua kali'],
    hint: '退款与账单问题需要人工核查。请提交工单（支付与订阅 → 退款问题），首个人工回复目标为 3 天内。' },
  { zh: ['被盗', '盗号', '账号被偷', '被黑', '异常登录', '账号丢失'], en: ['hijacked', 'account stolen', 'got hacked', 'someone logged into my account', 'lost my account'], ms: ['akaun dicuri', 'digodam', 'akaun hilang'],
    hint: '账号安全问题需要人工核实。请提交工单（账号问题 → 账号被盗），并保留注册邮箱的访问权用于身份验证。' },
  { zh: ['执法', '警方', '警察', '法院', '传票', '律师函', '执法机构', '调查令'], en: ['law enforcement', 'police', 'court', 'subpoena', 'warrant', 'legal request', 'attorney'], ms: ['polis', 'mahkamah', 'subpoena', 'guaman'],
    hint: '涉及法律与执法机构的事项由人工受理。请提交工单（账号问题 → 隐私请求）并注明机构名称与联系方式。' },
  { zh: ['导出数据', '数据导出', '删除我的数据', '擦除数据', 'gdpr', '隐私请求', '导出我的'], en: ['export my data', 'data export', 'erase my data', 'gdpr', 'right to be forgotten', 'delete my data'], ms: ['eksport data', 'gdpr', 'padam data saya'],
    hint: '数据导出/删除请求由人工受理。请提交工单（账号问题 → 隐私请求），首个人工回复目标为 3 天内。' },
  { zh: ['13岁', '13 岁', '12岁', '12 岁', '未成年', '儿童', '小孩', '孩子'], en: ['13 years old', '12 years old', 'under 13', 'underage', 'minor', 'my child', 'my kid'], ms: ['13 tahun', '12 tahun', 'bawah umur', 'kanak-kanak'],
    hint: '平台不为 13 周岁以下儿童提供服务；相关事项由人工受理，请提交工单（账号问题）。' }
];

const DEGRADE_REPLY = '抱歉，客服机器人当前不可用，已为你转人工处理。';
const DEGRADE_HINT = 'AI 客服当前繁忙或暂不可用。请提交工单，人工客服首个人工回复目标为 3 天内。';

function zhHit(text, kw) {
  return text.includes(kw) || text.replace(/\s+/g, '').includes(kw);
}

function wordHit(text, kw) {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\b' + esc + '(?:s|es)?\\b').test(text);
}

function humanRuleFor(text) {
  const norm = normalize(text);
  for (const rule of HUMAN_RULES) {
    if (rule.zh.some(kw => zhHit(norm, kw))) return rule;
    if (rule.en.some(kw => wordHit(norm, kw))) return rule;
    if (rule.ms.some(kw => wordHit(norm, kw))) return rule;
  }
  return null;
}

// 0 成本路径也落 usage_log（零成本行 = 可观测降级/命中率）
function recordZero(ctx, feature) {
  ctx.moderation.budget.record(feature, { in: 0, out: 0, cached: 0 });
}

function degrade() {
  return { reply: DEGRADE_REPLY, needsHuman: true, ticketHint: DEGRADE_HINT };
}

// DeepSeek 单轮（重试 2 次；system 前缀字节级常量保住缓存前缀）
async function callDeepSeek(ctx, locale, messages) {
  const cfg = ctx.config;
  const baseUrl = (cfg.deepseek || {}).baseUrl || 'https://api.deepseek.com';
  const req = {
    model: (cfg.deepseek || {}).model || 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ locale, messages }) }
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0.5
  };
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await ctx.moderation.fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(cfg.deepseek || {}).apiKey || ''}`
        },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(60000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = JSON.parse(await res.text());
      const content = body.choices && body.choices[0] && body.choices[0].message
        ? body.choices[0].message.content : '';
      if (typeof content !== 'string' || !content.trim()) throw new Error('空回复');
      const usage = body.usage || {};
      return {
        reply: cleanReply(content),
        usage: {
          in: usage.prompt_tokens || 0,
          out: usage.completion_tokens || 0,
          cached: usage.prompt_cache_hit_tokens || 0
        }
      };
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  throw new Error(`DeepSeek 客服调用失败: ${lastErr && lastErr.message}`);
}

function cleanReply(content) {
  return String(content).trim()
    .replace(/^["'「『\s]+|["'」』\s]+$/g, '')
    .slice(0, MAX_REPLY);
}

function register(router, ctx) {
  router.add('POST', '/api/chat', async (req, res) => {
    // 校验（契约字段；匿名可用——帮助页无登录门槛）
    const body = await readJson(req);
    const sessionId = body && body.sessionId;
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 64) {
      throw new HttpError('VALIDATION', 'sessionId 非法');
    }
    const locale = typeof body.locale === 'string' ? body.locale.slice(0, 8) : 'zh';
    const messages = body && Array.isArray(body.messages) ? body.messages : null;
    if (!messages || messages.length < 1 || messages.length > MAX_MESSAGES) {
      throw new HttpError('VALIDATION', `messages 需为 1-${MAX_MESSAGES} 条`);
    }
    for (const m of messages) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')
        || typeof m.content !== 'string' || !m.content.trim() || m.content.length > MAX_CONTENT) {
        throw new HttpError('VALIDATION', '消息格式非法');
      }
    }

    // 限流：8/min/IP + 20/min/sessionId（内存滑动窗口；测试可覆盖 config.rateLimits）
    const rl = ctx.config.rateLimits || {};
    const ipW = rl.chatIp || { max: 8, windowMs: 60000 };
    const sW = rl.chatSession || { max: 20, windowMs: 60000 };
    if (!ctx.limiter('chat:ip:' + ipOf(req), ipW.max, ipW.windowMs)) {
      throw new HttpError('RATE_LIMITED', '提问过于频繁，请稍后再试');
    }
    if (!ctx.limiter('chat:s:' + sessionId, sW.max, sW.windowMs)) {
      throw new HttpError('RATE_LIMITED', '本会话提问过于频繁，请稍后再试');
    }

    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const lastText = lastUser ? lastUser.content : '';
    const budget = ctx.moderation.budget;

    // 1. needsHuman 规则先行（0 元）
    const rule = humanRuleFor(lastText);
    if (rule) {
      recordZero(ctx, 'chat');
      sendJson(res, 200, { reply: DEGRADE_REPLY, needsHuman: true, ticketHint: rule.hint });
      return;
    }

    // 2. FAQ 检索（0 元）
    const hit = bestMatch(lastText);
    if (hit) {
      recordZero(ctx, 'chat_faq_hit');
      sendJson(res, 200, {
        reply: hit.entry.answer,
        needsHuman: !!hit.entry.needsHuman,
        ticketHint: hit.entry.needsHuman ? hit.entry.ticketHint : null
      });
      return;
    }

    // 3. 预算预检 → 降级（HTTP 200，不硬下线）
    if (!budget.canSpend('chat')) {
      recordZero(ctx, 'chat');
      sendJson(res, 200, degrade());
      return;
    }

    // 4. DeepSeek（失败也降级 200）
    const slim = messages.slice(-6).map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
    try {
      const { reply, usage } = await callDeepSeek(ctx, locale, slim);
      budget.record('chat', usage);
      sendJson(res, 200, { reply, needsHuman: false, ticketHint: null });
    } catch (err) {
      recordZero(ctx, 'chat');
      sendJson(res, 200, degrade());
    }
  });
}

module.exports = { register, HUMAN_RULES, DEGRADE_REPLY, DEGRADE_HINT };
