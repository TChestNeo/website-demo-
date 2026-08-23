/**
 * AI 客服对话组件 (AI Support Chat Widget)
 *
 * 页面加载本脚本后，右下角出现「AI 客服」浮动按钮，点击展开对话框。
 * 双模式设计：
 *   mode: 'offline'（当前）— 本地演示规则应答，状态栏显示“演示模式 · 尚未连接 AI”。
 *   mode: 'api'    （后端上线后）— POST {apiBase}/chat；失败时显示错误提示并引导转工单。
 *
 * 切换方式：在页面设置
 *   window.MN_AI_CONFIG = { mode: 'api', apiBase: 'https://api.example.com' }
 * 无需改动本模块。当前仅 help.html 引入；其他页面按需加载
 * i18n.js + ai-chat.zh.js + 本文件即可（对话框内“工单页面”链接使用
 * pages/ 目录下的相对路径 ticket.html）。
 *
 * 安全约定：后端负责代理调用 Gemini / DeepSeek，API 密钥只存在于后端，
 * 前端不持有密钥、不直接调用第三方模型接口。
 *
 * 历史聊天（本机存储）：
 *   会话保存在 localStorage 'mn_ai_chat_history'，仅存于用户本机浏览器，
 *   不上传服务器。保留期为 7 天——每次加载页面与打开对话框时，
 *   超过 7 天未活动的会话将被自动清除；单机最多保留 30 个会话。
 *
 * ── 后端 API 约定（后端请按此实现）──
 * POST {apiBase}/chat
 *   请求头: Content-Type: application/json
 *   请求体:
 *     {
 *       "sessionId": "sid-xxxxxxxx",      // string, 前端生成的会话标识（同一用户连续对话保持一致）
 *       "locale":    "zh",                // string, 当前页面语言
 *       "messages": [                     // array, 对话历史（含本次提问，最多 10 条）
 *         { "role": "user",      "content": "退款怎么申请？" },
 *         { "role": "assistant", "content": "……" }
 *       ]
 *     }
 *   成功响应 (HTTP 200):
 *     {
 *       "reply":      "退款规则详见《财务与支付条款》第 4 条……",  // string, 回答文本
 *       "needsHuman": false,              // boolean, true = 需要特别权限 → 前端展示“转人工工单”卡片
 *       "ticketHint": null                // string|null, needsHuman 为 true 时附带的提示文案
 *     }
 *   失败处理: HTTP 4xx/5xx、响应格式不符或网络错误 → 前端显示错误气泡并引导转工单。
 *
 * 需要特别权限的判断由后端完成（needsHuman=true），前端只负责渲染引导卡片；
 * 离线演示模式下，由本地关键词规则模拟同一流程（human 规则）。
 */
(function (global) {
  'use strict';

  var DEFAULT_CONFIG = { mode: 'offline', apiBase: '' };
  var MAX_HISTORY = 10;       // 每次请求携带的最近消息条数
  var STORAGE_KEY = 'mn_ai_chat_history';
  var RETENTION_MS = 7 * 24 * 60 * 60 * 1000;  // 历史聊天保留 7 天
  var MAX_SESSIONS = 30;      // 本机最多保留的会话数

  function getConfig() {
    var c = global.MN_AI_CONFIG || {};
    return {
      mode: c.mode || DEFAULT_CONFIG.mode,
      apiBase: (c.apiBase || '').replace(/\/+$/, '')
    };
  }

  function isOnline() {
    var cfg = getConfig();
    return cfg.mode === 'api' && !!cfg.apiBase;
  }

  // 取当前语言文案；MN_I18N 未加载或键缺失时使用中文回退文本
  function T(key, fallback) {
    if (global.MN_I18N) {
      var v = global.MN_I18N.t(key);
      if (v != null) return v;
    }
    return fallback;
  }

  var sessionId = 'sid-' + Math.random().toString(36).slice(2, 10);
  var pending = false;

  // ── 会话存储（localStorage，7 天保留）──
  // sessions: [{ id, title, messages: [{role, content, kind}], createdAt, lastActiveAt }]
  var sessions = [];
  var activeId = null;

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        sessions = data.sessions || [];
        activeId = data.activeId || null;
      }
    } catch (e) { sessions = []; activeId = null; }
    purge();
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: sessions, activeId: activeId }));
    } catch (e) {}
  }

  // 清除超过 7 天未活动的会话，并裁剪到 MAX_SESSIONS
  function purge() {
    var cutoff = Date.now() - RETENTION_MS;
    var before = sessions.length;
    sessions = sessions.filter(function (s) { return s.lastActiveAt >= cutoff; });
    if (sessions.length > MAX_SESSIONS) sessions = sessions.slice(-MAX_SESSIONS);
    if (activeId && !getActiveSession()) activeId = null;
    if (sessions.length !== before) saveStore();
  }

  function getActiveSession() {
    if (!activeId) return null;
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id === activeId) return sessions[i];
    }
    return null;
  }

  function getSession(id) {
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id === id) return sessions[i];
    }
    return null;
  }

  // 首次发送消息时才创建会话（打开对话框不产生空会话）
  function ensureSession() {
    if (getActiveSession()) return getActiveSession();
    var s = {
      id: 'ses-' + Math.random().toString(36).slice(2, 10),
      title: '',
      messages: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };
    sessions.push(s);
    if (sessions.length > MAX_SESSIONS) sessions = sessions.slice(-MAX_SESSIONS);
    activeId = s.id;
    saveStore();
    return s;
  }

  function truncate(t) { return t.length > 24 ? t.slice(0, 24) + '…' : t; }

  // ── 离线演示规则（按顺序匹配，命中即停）──
  var DEMO_RULES = [
    { pattern: /价格|订阅|会员|多少钱|付费|basic|premium|ultra/i, key: 'aichat.demo.pricing' },
    { pattern: /退款|扣费|账单/, key: 'aichat.demo.refund' },
    { pattern: /认证|大国|徽章|verify/i, key: 'aichat.demo.verify' },
    { pattern: /工单|人工|申诉|封号|封禁|隐私|删除|数据|权限|账号/, human: true },
    { pattern: /你好|您好|hi|hello|嗨/i, key: 'aichat.hello' }
  ];

  var CHIPS = [
    { q: '订阅价格', key: 'aichat.chip.pricing', label: '订阅与价格' },
    { q: '退款规则', key: 'aichat.chip.refund',  label: '退款规则' },
    { q: '认证标',   key: 'aichat.chip.verify',  label: '认证标' },
    { q: '你好',     key: 'aichat.chip.hello',   label: '打招呼' }
  ];

  // ── DOM ──
  var els = {};
  var built = false;
  var typingEl = null;

  function build() {
    built = true;

    // 样式（随模块注入，前缀 mn-ai-，主题色复用 ethereal.css 变量）
    var style = document.createElement('style');
    style.textContent = [
      '.mn-ai-fab { position:fixed; right:20px; bottom:20px; z-index:300; display:flex; align-items:center; gap:8px;',
      '  padding:12px 18px; border:none; border-radius:28px; background:linear-gradient(135deg,var(--color-primary),#8131cf);',
      '  color:#fff; font-family:inherit; font-size:14px; font-weight:600; cursor:pointer;',
      '  box-shadow:0 8px 24px rgba(70,72,212,0.35); transition:transform .15s ease, box-shadow .15s ease; }',
      '.mn-ai-fab:hover { transform:translateY(-2px); box-shadow:0 12px 28px rgba(70,72,212,0.45); }',
      '.mn-ai-panel { position:fixed; right:20px; bottom:84px; z-index:300; width:370px; max-width:calc(100vw - 32px);',
      '  height:560px; max-height:calc(100vh - 116px); display:flex; flex-direction:column; overflow:hidden;',
      // 磨砂玻璃背景（backdrop-filter 模糊面板后面的页面内容）
      '  background:rgba(255,255,255,0.6);',
      '  -webkit-backdrop-filter:blur(24px) saturate(140%); backdrop-filter:blur(24px) saturate(140%);',
      '  border:1px solid var(--color-outline-variant); border-radius:16px;',
      '  box-shadow:0 16px 48px rgba(0,0,0,0.18); }',
      ':root[data-theme="dark"] .mn-ai-panel { background:rgba(30,30,50,0.62); }',
      '.mn-ai-head { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; color:#fff;',
      '  background:linear-gradient(135deg,var(--color-primary),#8131cf); flex-shrink:0; }',
      '.mn-ai-head-left { display:flex; align-items:center; gap:10px; }',
      '.mn-ai-title { font-size:15px; font-weight:700; }',
      '.mn-ai-status { display:flex; align-items:center; gap:6px; font-size:11.5px; opacity:0.92; margin-top:2px; }',
      '.mn-ai-dot { width:8px; height:8px; border-radius:50%; background:#ffb020; flex-shrink:0; }',
      '.mn-ai-dot.on { background:#4ade80; }',
      '.mn-ai-head-btns { display:flex; gap:6px; }',
      '.mn-ai-close { background:rgba(255,255,255,0.15); border:none; color:#fff; width:30px; height:30px; border-radius:50%;',
      '  cursor:pointer; display:flex; align-items:center; justify-content:center; }',
      '.mn-ai-close:hover { background:rgba(255,255,255,0.3); }',
      '.mn-ai-msgs { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }',
      '.mn-ai-msg { max-width:82%; padding:9px 13px; border-radius:14px; font-size:13.5px; line-height:1.6;',
      '  white-space:pre-wrap; word-break:break-word; }',
      '.mn-ai-msg.user { align-self:flex-end; background:var(--color-primary); color:#fff; border-bottom-right-radius:4px; }',
      '.mn-ai-msg.assistant { align-self:flex-start; background:var(--color-surface-container);',
      '  border:1px solid var(--color-outline-variant); color:var(--color-on-surface); border-bottom-left-radius:4px; }',
      '.mn-ai-human { align-self:stretch; padding:12px 14px; border:1px solid var(--color-primary); border-radius:12px;',
      '  background:rgba(70,72,212,0.06); color:var(--color-on-surface); font-size:13px; line-height:1.6; }',
      '.mn-ai-human-title { font-weight:700; display:flex; align-items:center; gap:6px; margin-bottom:4px; }',
      '.mn-ai-typing { display:flex; align-items:center; gap:8px; align-self:flex-start; padding:9px 13px; border-radius:14px;',
      '  border:1px solid var(--color-outline-variant); background:var(--color-surface-container);',
      '  font-size:12.5px; color:var(--color-outline); }',
      '.mn-ai-typing .dots { display:inline-flex; gap:3px; }',
      '.mn-ai-typing .dots i { width:6px; height:6px; border-radius:50%; background:var(--color-outline);',
      '  animation:mnAiBounce 1.2s infinite; }',
      '.mn-ai-typing .dots i:nth-child(2) { animation-delay:0.15s; }',
      '.mn-ai-typing .dots i:nth-child(3) { animation-delay:0.3s; }',
      '@keyframes mnAiBounce { 0%,60%,100% { transform:translateY(0); opacity:.5; } 30% { transform:translateY(-4px); opacity:1; } }',
      '.mn-ai-chips { display:flex; flex-wrap:wrap; gap:6px; padding:0 16px 10px; flex-shrink:0; }',
      '.mn-ai-chip { border:1px solid var(--color-outline-variant); background:transparent;',
      '  color:var(--color-on-surface-variant); font-size:12.5px; font-family:inherit; padding:5px 12px;',
      '  border-radius:16px; cursor:pointer; }',
      '.mn-ai-chip:hover { border-color:var(--color-primary); color:var(--color-primary); }',
      '.mn-ai-note { padding:0 16px 8px; font-size:11px; color:var(--color-outline); flex-shrink:0; }',
      '.mn-ai-inputrow { display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--color-outline-variant); flex-shrink:0; }',
      '.mn-ai-input { flex:1; border:1px solid var(--color-outline-variant); border-radius:20px; padding:9px 14px;',
      '  font-size:13.5px; font-family:inherit; background:var(--card-bg); color:var(--color-on-surface); }',
      '.mn-ai-input:focus { outline:none; border-color:var(--color-primary); }',
      '.mn-ai-send { width:38px; height:38px; border-radius:50%; border:none; cursor:pointer; background:var(--color-primary);',
      '  color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }',
      '.mn-ai-send:disabled { opacity:0.5; cursor:default; }',
      // 历史聊天视图
      '.mn-ai-history { flex:1; overflow-y:auto; padding:14px 16px; }',
      '.mn-ai-history-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; }',
      '.mn-ai-history-item { display:flex; align-items:center; gap:10px; width:100%; text-align:left; font-family:inherit;',
      '  padding:10px 12px; margin-bottom:8px; border:1px solid var(--color-outline-variant); border-radius:10px;',
      '  background:transparent; cursor:pointer; }',
      '.mn-ai-history-item:hover { border-color:var(--color-primary); }',
      '.mn-ai-history-item.active { border-color:var(--color-primary); background:rgba(70,72,212,0.05); }',
      '.mn-ai-history-item .grow { flex:1; min-width:0; }',
      '.mn-ai-history-ttl { font-size:13px; font-weight:600; color:var(--color-on-surface);',
      '  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
      '.mn-ai-history-meta { font-size:11px; color:var(--color-outline); margin-top:2px; }',
      '.mn-ai-history-del { background:transparent; border:none; color:var(--color-outline); cursor:pointer; flex-shrink:0;',
      '  padding:4px; border-radius:6px; }',
      '.mn-ai-history-del:hover { color:#dc2626; background:rgba(220,38,38,0.08); }',
      '.mn-ai-history-empty { font-size:13px; color:var(--color-outline); padding:28px 0; text-align:center; }',
      '.mn-ai-history-note { font-size:11px; color:var(--color-outline); text-align:center; margin-top:12px; }'
    ].join('\n');
    document.head.appendChild(style);

    // 浮动按钮
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'mn-ai-fab';
    fab.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">smart_toy</span>' +
      '<span data-i18n="aichat.btn">AI 客服</span>';
    fab.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    document.body.appendChild(fab);
    els.fab = fab;

    // 对话框面板
    var chipsHTML = CHIPS.map(function (c) {
      // label 为中文回退文本，data-i18n 在 MN_I18N 存在时覆盖为当前语言
      return '<button type="button" class="mn-ai-chip" data-q="' + c.q + '" data-i18n="' + c.key + '">' + c.label + '</button>';
    }).join('');

    var panel = document.createElement('div');
    panel.className = 'mn-ai-panel';
    panel.style.display = 'none';
    panel.innerHTML =
      '<div class="mn-ai-head">' +
        '<div class="mn-ai-head-left">' +
          '<span class="material-symbols-outlined" style="font-size:20px">smart_toy</span>' +
          '<div>' +
            '<div class="mn-ai-title" data-i18n="aichat.title">AI 客服</div>' +
            '<div class="mn-ai-status"><span class="mn-ai-dot" id="mnAiDot"></span><span id="mnAiStatus">演示模式 · 尚未连接 AI</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="mn-ai-head-btns">' +
          '<button type="button" class="mn-ai-close" id="mnAiNew" aria-label="新对话"><span class="material-symbols-outlined" style="font-size:18px">add_comment</span></button>' +
          '<button type="button" class="mn-ai-close" id="mnAiHist" aria-label="历史聊天"><span class="material-symbols-outlined" style="font-size:18px">history</span></button>' +
          '<button type="button" class="mn-ai-close" id="mnAiClose" aria-label="关闭"><span class="material-symbols-outlined" style="font-size:18px">close</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="mn-ai-msgs" id="mnAiMsgs"></div>' +
      '<div class="mn-ai-history" id="mnAiHistory" style="display:none">' +
        '<div class="mn-ai-history-head">' +
          '<div class="mn-ai-title" style="color:var(--color-on-surface)" data-i18n="aichat.history.title">历史聊天</div>' +
          '<div style="display:flex;gap:6px">' +
            '<button type="button" class="mn-ai-chip" id="mnAiHistBack" data-i18n="aichat.history.back">返回对话</button>' +
            '<button type="button" class="mn-ai-chip" id="mnAiHistClear" data-i18n="aichat.history.clearAll">清空全部</button>' +
          '</div>' +
        '</div>' +
        '<div id="mnAiHistList"></div>' +
        '<div class="mn-ai-history-note" data-i18n="aichat.history.retention">聊天记录仅保存 7 天，过期自动清除</div>' +
      '</div>' +
      '<div class="mn-ai-chips" id="mnAiChips">' + chipsHTML + '</div>' +
      '<div class="mn-ai-note" data-i18n="aichat.foot">回复仅供辅助参考，不构成平台承诺；客服不会向你索要密码、验证码或支付信息。</div>' +
      '<div class="mn-ai-inputrow" id="mnAiInputRow">' +
        '<input type="text" class="mn-ai-input" id="mnAiInput" data-i18n-placeholder="aichat.placeholder" placeholder="输入你的问题，Enter 发送">' +
        '<button type="button" class="mn-ai-send" id="mnAiSend" aria-label="发送">' +
          '<span class="material-symbols-outlined" style="font-size:18px">send</span>' +
        '</button>' +
      '</div>';
    document.body.appendChild(panel);

    els.panel = panel;
    els.msgs = panel.querySelector('#mnAiMsgs');
    els.chips = panel.querySelector('#mnAiChips');
    els.note = panel.querySelector('.mn-ai-note');
    els.inputrow = panel.querySelector('#mnAiInputRow');
    els.input = panel.querySelector('#mnAiInput');
    els.sendBtn = panel.querySelector('#mnAiSend');
    els.status = panel.querySelector('#mnAiStatus');
    els.dot = panel.querySelector('#mnAiDot');
    els.history = panel.querySelector('#mnAiHistory');
    els.histList = panel.querySelector('#mnAiHistList');

    // 事件
    panel.querySelector('#mnAiClose').addEventListener('click', close);
    panel.querySelector('#mnAiNew').addEventListener('click', newChat);
    panel.querySelector('#mnAiHist').addEventListener('click', showHistoryView);
    panel.querySelector('#mnAiHistBack').addEventListener('click', showChatView);
    panel.querySelector('#mnAiHistClear').addEventListener('click', clearAll);

    els.chips.addEventListener('click', function (e) {
      var chip = e.target.closest('.mn-ai-chip');
      if (chip) send(chip.dataset.q);
    });

    els.sendBtn.addEventListener('click', function () { send(els.input.value); });
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') send(els.input.value);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && built && els.panel.style.display !== 'none') close();
    });

    // i18n 渲染（MN_I18N 未加载时保留中文回退文本）
    if (global.MN_I18N) global.MN_I18N.apply();
  }

  function ensureBuilt() { if (!built) build(); }

  // ── 消息渲染 ──
  function scrollBottom() { els.msgs.scrollTop = els.msgs.scrollHeight; }

  function appendMsg(who, text) {
    var div = document.createElement('div');
    div.className = 'mn-ai-msg ' + who;
    div.textContent = text;
    els.msgs.appendChild(div);
    scrollBottom();
    return div;
  }

  function appendHumanCard(hint) {
    var card = document.createElement('div');
    card.className = 'mn-ai-human';
    card.innerHTML =
      '<div class="mn-ai-human-title">' +
        '<span class="material-symbols-outlined" style="font-size:16px;color:var(--color-primary)">support_agent</span>' +
        T('aichat.human.title', '这个问题需要人工处理') +
      '</div>' +
      '<div>' + (hint || T('aichat.human.body', '涉及需要特别权限的事项（账号、订单、申诉等）由人工受理，AI 客服不办理。请提交人工工单，首个人工回复目标为 3 天内。')) + '</div>' +
      '<a href="ticket.html" class="btn btn-primary btn-sm" style="margin-top:10px">' +
        '<span class="material-symbols-outlined" style="font-size:16px">confirmation_number</span> ' +
        T('aichat.human.btn', '前往工单页面') +
      '</a>';
    els.msgs.appendChild(card);
    scrollBottom();
  }

  // 按存储的消息记录渲染（加载历史会话时使用）
  function renderStoredMessage(m) {
    if (m.role === 'user') {
      appendMsg('user', m.content);
    } else if (m.kind === 'human') {
      appendHumanCard();
    } else {
      appendMsg('assistant', m.content);
    }
  }

  function appendGreet() {
    appendMsg('assistant', isOnline()
      ? T('aichat.greet.online', '你好！我是 M.NationWorld 的 AI 客服，7×24 小时在线。你可以问我订阅、价格、功能使用等常规问题；涉及账号、订单、申诉等需要特别权限的事项，我会引导你前往工单页面提交人工工单。')
      : T('aichat.greet.offline', '你好！我是 M.NationWorld 的 AI 客服。当前为演示模式，尚未连接后端 AI；接入后由 Gemini / DeepSeek 实时应答。你可以点击下方快捷提问，或输入订阅价格、退款规则等常规问题；涉及账号、申诉等需要特别权限的事项，我会引导你前往工单页面。'));
  }

  function showTyping() {
    pending = true;
    if (!typingEl) {
      typingEl = document.createElement('div');
      typingEl.className = 'mn-ai-typing';
      typingEl.innerHTML = '<span class="dots"><i></i><i></i><i></i></span><span>' +
        T('aichat.thinking', '正在思考…') + '</span>';
    }
    els.msgs.appendChild(typingEl);
    scrollBottom();
  }

  function hideTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
  }

  function finishAssistant(content, kind) {
    hideTyping();
    var s = getActiveSession();
    if (s) {
      s.messages.push({ role: 'assistant', content: content, kind: kind || null });
      s.lastActiveAt = Date.now();
      saveStore();
    }
    pending = false;
  }

  // ── 发送 ──
  function send(text) {
    text = (text || '').trim();
    if (!text || pending) return;
    var s = ensureSession();
    appendMsg('user', text);
    s.messages.push({ role: 'user', content: text, kind: null });
    if (!s.title) s.title = truncate(text);
    s.lastActiveAt = Date.now();
    saveStore();

    if (isOnline()) {
      callApi(s);
    } else {
      offlineReply(text);
    }
  }

  // 离线演示：本地关键词规则（模拟 needsHuman 流程）
  function offlineReply(text) {
    showTyping();
    setTimeout(function () {
      var matched = null;
      for (var i = 0; i < DEMO_RULES.length; i++) {
        if (DEMO_RULES[i].pattern.test(text)) { matched = DEMO_RULES[i]; break; }
      }
      hideTyping();
      if (!matched) {
        appendMsg('assistant', T('aichat.demo.default',
          '这个问题我暂时没有预设答案（演示模式）。AI 接入后将由 Gemini / DeepSeek 实时解答；如需人工处理，请前往工单页面提交工单。'));
        finishAssistant('[演示默认回复]');
      } else if (matched.human) {
        appendHumanCard();
        finishAssistant('[转人工引导]', 'human');
      } else {
        var reply = T(matched.key, '');
        appendMsg('assistant', reply);
        finishAssistant(reply);
      }
    }, 600);
  }

  // 后端模式：POST {apiBase}/chat
  function callApi(s) {
    showTyping();
    var cfg = getConfig();
    fetch(cfg.apiBase + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        locale: global.MN_I18N ? global.MN_I18N.getLang() : 'zh',
        messages: s.messages.slice(-MAX_HISTORY).map(function (m) {
          return { role: m.role, content: m.content };
        })
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json().then(function (data) {
        if (!data || typeof data.reply !== 'string') throw new Error('bad response');
        return data;
      });
    }).then(function (data) {
      if (data.needsHuman) {
        appendHumanCard(data.ticketHint || null);
        finishAssistant('[转人工引导]', 'human');
      } else {
        appendMsg('assistant', data.reply);
        finishAssistant(data.reply);
      }
    }).catch(function () {
      appendMsg('assistant', T('aichat.error',
        '连接失败，请稍后重试；若问题紧急，可先前往工单页面提交人工工单。'));
      finishAssistant('[连接失败]');
    });
  }

  // ── 历史聊天视图 ──
  function relTime(ts) {
    var diff = Date.now() - ts;
    if (diff < 60 * 1000) return T('aichat.time.justNow', '刚刚');
    if (diff < 60 * 60 * 1000) return Math.floor(diff / (60 * 1000)) + T('aichat.time.minutesAgo', ' 分钟前');
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / (60 * 60 * 1000)) + T('aichat.time.hoursAgo', ' 小时前');
    return Math.floor(diff / (24 * 60 * 60 * 1000)) + T('aichat.time.daysAgo', ' 天前');
  }

  function renderHistoryList() {
    purge();
    els.histList.innerHTML = '';
    var list = sessions.slice().sort(function (a, b) { return b.lastActiveAt - a.lastActiveAt; });

    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'mn-ai-history-empty';
      empty.textContent = T('aichat.history.empty', '暂无历史聊天记录');
      els.histList.appendChild(empty);
      return;
    }

    list.forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'mn-ai-history-item' + (s.id === activeId ? ' active' : '');
      item.innerHTML =
        '<div class="grow">' +
          '<div class="mn-ai-history-ttl"></div>' +
          '<div class="mn-ai-history-meta"></div>' +
        '</div>' +
        '<button type="button" class="mn-ai-history-del" aria-label="删除">' +
          '<span class="material-symbols-outlined" style="font-size:16px">delete</span>' +
        '</button>';
      item.querySelector('.mn-ai-history-ttl').textContent = s.title || '（' + T('aichat.history.untitled', '无标题') + '）';
      item.querySelector('.mn-ai-history-meta').textContent =
        s.messages.length + T('aichat.history.msgCount', ' 条消息') + ' · ' + relTime(s.lastActiveAt);

      item.addEventListener('click', function () { loadSession(s.id); });
      item.querySelector('.mn-ai-history-del').addEventListener('click', function (e) {
        e.stopPropagation();
        deleteSession(s.id);
      });
      els.histList.appendChild(item);
    });
  }

  function showHistoryView() {
    ensureBuilt();
    els.msgs.style.display = 'none';
    els.chips.style.display = 'none';
    els.note.style.display = 'none';
    els.inputrow.style.display = 'none';
    els.history.style.display = 'block';
    renderHistoryList();
  }

  function showChatView() {
    els.history.style.display = 'none';
    els.msgs.style.display = '';
    els.chips.style.display = '';
    els.note.style.display = '';
    els.inputrow.style.display = '';
    scrollBottom();
  }

  function loadSession(id) {
    var s = getSession(id);
    if (!s) return;
    activeId = id;
    s.lastActiveAt = Date.now();
    saveStore();
    els.msgs.innerHTML = '';
    s.messages.forEach(renderStoredMessage);
    showChatView();
  }

  function deleteSession(id) {
    sessions = sessions.filter(function (s) { return s.id !== id; });
    if (activeId === id) {
      activeId = null;
      els.msgs.innerHTML = '';
    }
    saveStore();
    renderHistoryList();
  }

  function clearAll() {
    if (!confirm(T('aichat.confirm.clearAll', '确定清空全部历史聊天吗？此操作不可恢复。'))) return;
    sessions = [];
    activeId = null;
    els.msgs.innerHTML = '';
    saveStore();
    renderHistoryList();
  }

  // ── 开关 ──
  function updateStatus() {
    if (isOnline()) {
      els.dot.className = 'mn-ai-dot on';
      els.status.textContent = T('aichat.status.online', 'AI 在线 · 由 Gemini / DeepSeek 驱动');
    } else {
      els.dot.className = 'mn-ai-dot';
      els.status.textContent = T('aichat.status.offline', '演示模式 · 尚未连接 AI');
    }
  }

  function open() {
    ensureBuilt();
    els.panel.style.display = 'flex';
    els.fab.style.display = 'none';
    updateStatus();
    purge();
    if (!els.msgs.childElementCount) {
      var s = getActiveSession();
      if (s && s.messages.length) {
        s.messages.forEach(renderStoredMessage);
      } else {
        appendGreet();
      }
    }
    els.input.focus();
    scrollBottom();
  }

  function newChat() {
    ensureBuilt();
    els.msgs.innerHTML = '';
    activeId = null;
    saveStore();
    appendGreet();
    showChatView();
  }

  function close() {
    if (!built) return;
    els.panel.style.display = 'none';
    els.fab.style.display = '';
  }

  function toggle() {
    if (built && els.panel.style.display !== 'none') { close(); } else { open(); }
  }

  // ── 初始化：载入本机存储并清理过期会话 ──
  loadStore();

  global.MN_AIChat = {
    open: open,
    close: close,
    toggle: toggle,
    send: send,
    newChat: newChat,
    showHistory: showHistoryView
  };
})(window);
