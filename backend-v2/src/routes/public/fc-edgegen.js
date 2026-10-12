'use strict';
// FC 边缘 AI 生成 POST /api/fc/edge-gen（FC v10.28.50.0）——Gemini Flash 只负责生成（用户钦定：
// 「Gemini Flash只负责这个生成的部分，Deepseek只负责客服的部分」——本端点只碰 Gemini，不 import chat.js）。
// 契约（前端 fluidcanvas-editor.html FC_EDGE_GEN 权威）：
//   req:  { kind:'edge'|'border', name ≤30, desc ≤500, image dataURL 可空——desc 与 image 至少一非空 }
//   res:  200 { ok:true, edge:{name,clip} }——clip 已过 sanitizeClip 服务端白名单
//         503 { unavailable:true }——无 GEMINI_API_KEY（前端 toast genUnavailable）
//         200 { ok:false }——AI 故障/超时/坏回复降级（前端 toast genFailed；与 tags.js 同哲学不拦创建）
//         200 { budget_exhausted:true }——月度预算耗尽
// 安全：AI 产物进入 CSS 的唯一通道=clip——sanitizeClip 白名单+黑名单双保险（≤2000 字符、polygon() 点表、
// 每点 -?\d+(\.\d{1,2})?%?、%∈0-100、裸值只 0/100、3-80 点、拒 url(/expression(/calc(/var(/javascript:/引号尖括号反斜杠）。
// key 只活 Cloud Run env（AQ. 前缀非 AIza——当不透明 key 走 x-goog-api-key 头 Google 端点；GEMINI_BASE_URL 兜底）。

const { HttpError, sendJson, readJson } = require('../../http');
const { authenticate } = require('../../middleware/auth');

const MODEL_DEFAULT = 'gemini-3.8-flash'; // 线上探测 404：gemini-2.5-flash 退役新用户（Google 指引 3.8-flash；仍 Flash 族）

const SYSTEM_EDGE_GEN = '你是卡片边缘样式生成器。根据用户描述（可附图）生成一个卡片边缘形状。'
  + '只输出 JSON：{"name":"简短中文名≤12字","clip":"polygon(...)"}。'
  + 'kind=edge：满盒 0-100% 的实心剪影（切角/撕边/齿状等），不得空心。'
  + 'kind=border：evenodd 双环——外环贴满盒（0%/100%），内环内缩 3-12%，形成框形剪影。'
  + '坐标只用百分比或裸值 0/100，小数最多 2 位，顶点 3-80 个。'
  + 'clip 只用 polygon()，不得输出其它任何内容或解释。';

// 服务端 sanitizeClip（AI 产物唯一入库口；fc-edges.js 复用，前端有镜像）。
// 合法例：polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)
//         polygon(evenodd, 0 0, 100 0, 100 100, 90 100, 90 10, 10 10, 10 90, 0 90)
// v10.28.51.1: 裸值坐标放宽为 ±100 全收（51.1 前只许 0/100——border 内环 3-12%
// 内缩 Gemini 常输出裸值 8/12 之类→全被拒→「边框生成失败」而 edge 只用 0/100
// 故「边缘成功边框失败」；纯数字零注入面，黑名单不动）。百分比仍 0-100。
// 返回规范化串（单空格点表）；不合法 → null。
function sanitizeClip(clip) {
  const s = String(clip == null ? '' : clip).trim();
  if (!s || s.length > 2000) return null;
  if (/url\(|expression\(|calc\(|var\(|javascript:|[;"'<>\\]/i.test(s)) return null;
  const m = /^polygon\((.*)\)$/s.exec(s);
  if (!m) return null;
  let inner = m[1].trim();
  let fill = null;
  const fm = /^(evenodd|nonzero)\s*,?\s*(.*)$/s.exec(inner);
  if (fm) { fill = fm[1]; inner = fm[2]; }
  const pts = inner.split(',').map((p) => p.trim()).filter(Boolean);
  if (pts.length < 3 || pts.length > 80) return null;
  const out = [];
  for (const p of pts) {
    const nums = p.split(/\s+/).filter(Boolean);
    if (nums.length !== 2) return null;
    for (const n of nums) {
      const nm = /^(-?\d+(?:\.\d{1,2})?)(%)?$/.exec(n);
      if (!nm) return null;
      const v = parseFloat(nm[1]);
      if (nm[2]) { if (v < 0 || v > 100) return null; }
      else if (v < -100 || v > 100) return null; // 51.1: 裸值 ±100（原 0/100 → border 内环裸值被拒）
    }
    out.push(nums[0] + ' ' + nums[1]);
  }
  return 'polygon(' + (fill ? fill + ', ' : '') + out.join(', ') + ')';
}

// dataURL 解析：只收 png/jpeg/webp（inline_data 用），返回 { mimeType, data }；无效 → null
function parseImage(s) {
  if (typeof s !== 'string' || !s) return null;
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(s);
  if (!m) return null;
  return { mimeType: 'image/' + m[1].toLowerCase(), data: m[2] };
}

async function callEdgeGenAI(ctx, kind, name, desc, parsedImage) {
  const cfg = (ctx.config || {}).gemini || {};
  const parts = [
    { text: SYSTEM_EDGE_GEN },
    { text: 'kind=' + kind + (name ? '\n名称提示：' + name : '') + '\n用户描述：' + (desc || '（无描述，请根据附图生成）') }
  ];
  if (parsedImage) {
    parts.push({ inline_data: { mime_type: parsedImage.mimeType, data: parsedImage.data } });
  }
  const req = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
  };
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // v0.2.59.35：AI 排队层——高峰排队等位（Gemini 与 DeepSeek 共享槽位）
      const limiter = (ctx && ctx.aiLimiter) ? ctx.aiLimiter : { withSlot: async (fn) => fn() };
      const res = await limiter.withSlot(() => ctx.moderation.fetchImpl(
        `${cfg.baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${cfg.model || MODEL_DEFAULT}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cfg.apiKey || ''
          },
          body: JSON.stringify(req),
          signal: AbortSignal.timeout(60000)
        }
      ));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = JSON.parse(await res.text());
      const partsOut = (body.candidates && body.candidates[0] && body.candidates[0].content
        && body.candidates[0].content.parts) || [];
      const content = partsOut.map((p) => (p && p.text ? p.text : '')).join('');
      if (!content.trim()) throw new Error('空回复');
      const cleaned = content.trim().replace(/^```(json)?|```$/g, '').trim();
      const out = JSON.parse(cleaned);
      const clip = sanitizeClip(out && out.clip);
      if (!clip) throw new Error('clip 未通过白名单');
      const nameOut = String(out.name == null ? '' : out.name).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 30);
      return {
        edge: { name: nameOut || name || kind, clip },
        tokens: {
          in: (body.usageMetadata && body.usageMetadata.promptTokenCount) || 0,
          out: (body.usageMetadata && body.usageMetadata.candidatesTokenCount) || 0
        }
      };
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`边缘生成 AI 调用失败: ${lastErr && lastErr.message}`);
}

function register(router, ctx) {
  router.add('POST', '/api/fc/edge-gen', async (req, res) => {
    const user = authenticate(ctx.db, req, res, ctx); // 未登录 401 UNAUTHORIZED

    const body = await readJson(req, 8 * 1024 * 1024); // 附图 dataURL 可到 ~6MB
    const kind = body && body.kind === 'border' ? 'border' : 'edge';
    const name = body && typeof body.name === 'string'
      ? body.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 30) : '';
    const desc = body && typeof body.desc === 'string' ? body.desc.trim().slice(0, 500) : '';
    const image = body && typeof body.image === 'string' ? body.image : '';
    if (!desc && !image) throw new HttpError('VALIDATION', '描述与附图至少提供一项');
    const parsedImage = image ? parseImage(image) : null;
    if (image && !parsedImage) throw new HttpError('VALIDATION', '附图格式无效（仅 png/jpeg/webp）');

    // 无 key：503 unavailable（前端 toast 引导，零打扰）
    if (!((ctx.config || {}).gemini || {}).apiKey) {
      sendJson(res, 503, { unavailable: true });
      return;
    }

    // 宽松节流（用户自己的 key；测试可覆盖 config.rateLimits.edgeGen）
    const rl = ctx.config.rateLimits || {};
    const w = rl.edgeGen || { max: 8, windowMs: 60000 };
    if (!ctx.limiter('fc:edgegen:' + user.id, w.max, w.windowMs)) {
      throw new HttpError('RATE_LIMITED', '生成过于频繁，请稍后再试');
    }

    // 月度预算预检（BUDGET_EDGEGEN 默认 10 元；耗尽降级不硬下线）
    if (!ctx.budget.canSpend('edgeGen')) {
      sendJson(res, 200, { budget_exhausted: true });
      return;
    }

    try {
      const { edge, tokens } = await callEdgeGenAI(ctx, kind, name, desc, parsedImage);
      ctx.budget.record('edgeGen', tokens, { status: 'ok' });
      sendJson(res, 200, { ok: true, edge });
    } catch (e) {
      // AI 故障降级：200 ok:false（不拦生成，前端 toast genFailed）
      sendJson(res, 200, { ok: false });
    }
  });
}

module.exports = { register, sanitizeClip, parseImage, callEdgeGenAI, SYSTEM_EDGE_GEN, MODEL_DEFAULT };
