/**
 * 工单提交模块 (Ticket Submission)
 *
 * 双模式设计：
 *   mode: 'discord'（当前）— 返回格式化文本，页面引导用户粘贴到 Discord 工单频道。
 *   mode: 'api'    （后端上线后）— POST 到 {apiBase}/tickets；失败时自动回退 Discord 模式。
 *
 * 切换方式：在 ticket.html 的 window.MN_TICKET_CONFIG 中设置
 *   { mode: 'api', apiBase: 'https://api.example.com' }
 * 无需改动本模块与页面其余代码。
 *
 * ── 后端 API 约定（后端请按此实现）──
 * POST {apiBase}/tickets
 *   请求头: Content-Type: application/json
 *   请求体:
 *     {
 *       "category":    "bug",                 // string, 工单类型（语言无关代码："bug" | "account" | "payment" | "payout" | "suggestion"）
 *       "type":        "refund",              // string, 问题类型（语言无关代码，选项定义见 ticket.html 的 PROBLEM_TYPES）
 *       "contact":     "user@example.com",    // string, 电子邮箱（联系方式）
 *       "subject":     "一句话标题",           // string, 标题
 *       "description": "详细描述…",            // string, 描述
 *       "locale":      "zh",                  // string, 提交时页面语言（由 i18n 系统提供）
 *       "submittedAt": "2026-08-13T09:00:00.000Z"  // string, ISO 8601 UTC 提交时间
 *     }
 *   成功响应 (HTTP 200 / 201):
 *     {
 *       "id":       "MN-2026-000123",  // string, 工单编号
 *       "status":   "queued",          // string, 工单状态
 *       "position": 4                  // number|null, 当前排队位置
 *     }
 *   失败处理: HTTP 4xx/5xx、响应格式不符或网络错误 → 前端自动回退 Discord 粘贴模式，
 *   用户仍可完成提交，不会丢失已填写的内容。
 */
(function (global) {
  'use strict';

  var DEFAULT_CONFIG = { mode: 'discord', apiBase: '' };

  function getConfig() {
    var c = global.MN_TICKET_CONFIG || {};
    return {
      mode: c.mode || DEFAULT_CONFIG.mode,
      apiBase: (c.apiBase || '').replace(/\/+$/, '')
    };
  }

  /** 回退：返回 Discord 粘贴模式的格式化文本 */
  function fallbackToDiscord(text) {
    return Promise.resolve({ ok: false, mode: 'discord', text: text });
  }

  /**
   * 提交工单
   * @param {Object} payload { category, type, contact, subject, description, locale, submittedAt, text }
   * @returns {Promise<Object>}
   *   - API 成功:  { ok: true,  mode: 'api', ticketId, status, position }
   *   - 回退/失败: { ok: false, mode: 'discord', text }
   */
  function submit(payload) {
    var cfg = getConfig();
    if (cfg.mode !== 'api' || !cfg.apiBase) {
      return fallbackToDiscord(payload.text);
    }

    return fetch(cfg.apiBase + '/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: payload.category,
        type: payload.type,
        contact: payload.contact,
        subject: payload.subject,
        description: payload.description,
        locale: payload.locale,
        submittedAt: payload.submittedAt
      })
    }).then(function (res) {
      if (!res.ok) return fallbackToDiscord(payload.text);
      return res.json().then(function (data) {
        if (!data || !data.id) return fallbackToDiscord(payload.text);
        return {
          ok: true,
          mode: 'api',
          ticketId: data.id,
          status: data.status || 'queued',
          position: data.position
        };
      }).catch(function () {
        return fallbackToDiscord(payload.text);
      });
    }).catch(function () {
      return fallbackToDiscord(payload.text);
    });
  }

  global.MN_Ticket = { submit: submit };
})(window);
