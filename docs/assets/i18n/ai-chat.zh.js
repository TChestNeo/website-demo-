/**
 * AI 客服对话组件 (AI Chat Widget) — 简体中文 (zh)
 *
 * 添加新语言：新建 ai-chat.<lang>.js，使用相同的键，
 * 并在本文件之后引入即可，无需改动组件代码。
 */
window.MN_I18N.add('zh', {
  // 浮动按钮与标题
  'aichat.btn': 'AI 客服',
  'aichat.title': 'AI 客服',

  // 状态栏（离线演示 / 后端在线）
  'aichat.status.offline': '演示模式 · 尚未连接 AI',
  'aichat.status.online': 'AI 在线 · 由 Gemini / DeepSeek 驱动',

  // 开场白
  'aichat.greet.offline': '你好！我是 M.NationWorld 的 AI 客服。当前为演示模式，尚未连接后端 AI；接入后由 Gemini / DeepSeek 实时应答。你可以点击下方快捷提问，或输入订阅价格、退款规则等常规问题；涉及账号、申诉等需要特别权限的事项，我会引导你前往工单页面。',
  'aichat.greet.online': '你好！我是 M.NationWorld 的 AI 客服，7×24 小时在线。你可以问我订阅、价格、功能使用等常规问题；涉及账号、订单、申诉等需要特别权限的事项，我会引导你前往工单页面提交人工工单。',

  // 快捷提问
  'aichat.chip.pricing': '订阅与价格',
  'aichat.chip.refund': '退款规则',
  'aichat.chip.verify': '认证标',
  'aichat.chip.hello': '打招呼',

  // 输入区
  'aichat.placeholder': '输入你的问题，Enter 发送',
  'aichat.thinking': '正在思考…',

  // 历史聊天列表
  'aichat.history.title': '历史聊天',
  'aichat.history.back': '返回对话',
  'aichat.history.clearAll': '清空全部',
  'aichat.history.empty': '暂无历史聊天记录',
  'aichat.history.untitled': '无标题',
  'aichat.history.msgCount': ' 条消息',
  'aichat.history.retention': '聊天记录仅保存在本机浏览器，保留 7 天，过期自动清除',
  'aichat.confirm.clearAll': '确定清空全部历史聊天吗？此操作不可恢复。',

  // 相对时间
  'aichat.time.justNow': '刚刚',
  'aichat.time.minutesAgo': ' 分钟前',
  'aichat.time.hoursAgo': ' 小时前',
  'aichat.time.daysAgo': ' 天前',

  // 底部说明
  'aichat.foot': '回复仅供辅助参考，不构成平台承诺；客服不会向你索要密码、验证码或支付信息。',

  // 离线演示规则回复
  'aichat.hello': '你好！有什么可以帮你的吗？你可以问我订阅价格、退款规则、认证标，或点击下方快捷提问。',
  'aichat.demo.pricing': '会员订阅：Basic RM12/月、Premium RM23.50/月、Ultra RM45.50/月；单次付费：大国团队认证标 RM32 买断、Boost RM8.60。价格会按汇率折算为当地货币，详见《财务与支付条款》第 1、2 条。',
  'aichat.demo.refund': '虚拟服务一经交付原则上不予退款；未使用、重复扣费、未成年人监护人核实等情形可申请。对扣费有异议可通过工单提出：3 天内首个人工回复、7 个工作日内完成核查。详见《财务与支付条款》第 4 条。',
  'aichat.demo.verify': '大国团队官方认证标为买断式：一次付费 RM32.00，永久持有，不随订阅取消而失效。详见《财务与支付条款》第 1 条。',
  'aichat.demo.default': '这个问题我暂时没有预设答案（演示模式）。AI 接入后将由 Gemini / DeepSeek 实时解答；如需人工处理，请前往工单页面提交工单。',

  // 转人工引导卡片（needsHuman）
  'aichat.human.title': '这个问题需要人工处理',
  'aichat.human.body': '涉及需要特别权限的事项（账号、订单、申诉等）由人工受理，AI 客服不办理。请提交人工工单，首个人工回复目标为 3 天内。',
  'aichat.human.btn': '前往工单页面',

  // 连接失败
  'aichat.error': '连接失败，请稍后重试；若问题紧急，可先前往工单页面提交人工工单。'
});
