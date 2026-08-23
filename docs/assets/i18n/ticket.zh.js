/**
 * 人工工单 (Support Ticket) — 简体中文 (zh)
 *
 * 添加新语言：新建 ticket.<lang>.js，使用相同的键，
 * 并在本文件之后引入即可，无需改动页面 HTML。
 */
window.MN_I18N.add('zh', {
  'meta.title': '人工工单 | M.NationWorld',

  'hero.title': '人工工单',
  'hero.sub': '需要特别权限、或 AI 客服无法处理的事项（支付与账单、创作者结算、账号与处罚申诉、隐私请求等），请在此提交人工工单。',

  'fact.1': '首个人工回复目标：3 天内',
  'fact.2': '工单由人工受理，不经过 AI 客服',
  'fact.3': '客服不会索要密码、验证码或支付信息',

  'form.title': '提交工单',
  'form.label.category': '工单类型',
  'form.category.bug': '问题反馈',
  'form.category.account': '账户问题',
  'form.category.payment': '支付与账单',
  'form.category.payout': '创作者结算',
  'form.category.suggestion': '意见与建议',
  'form.label.type': '问题类型',
  'form.type.refund': '退款问题',
  'form.type.billing': '账单争议',
  'form.type.account': '账号申诉',
  'form.type.penalty': '处罚申诉',
  'form.type.privacy': '隐私请求',
  'form.type.other': '其他',
  // 问题反馈组的“问题类型”选项
  'form.type.bug.display': '页面显示异常',
  'form.type.bug.feature': '功能异常',
  'form.type.bug.editor': '编辑器问题',
  'form.type.bug.translation': '翻译错误',
  'form.type.bug.payment': '支付与订阅异常',
  'form.type.bug.other': '其他 bug',
  // 账户问题组
  'form.type.account.login': '登录与验证问题',
  'form.type.account.hijack': '账号被盗',
  // 支付与账单组
  'form.type.payment.failed': '支付失败',
  'form.type.payment.duplicate': '重复扣费',
  'form.type.payment.subscription': '订阅管理与取消',
  // 创作者结算组
  'form.type.payout.query': '结算查询',
  'form.type.payout.withdrawal': '提现问题',
  'form.type.payout.chargeback': '拒付回扣异议',
  'form.type.payout.share': '分成异议',
  // 意见与建议组
  'form.type.suggestion.feature': '功能建议',
  'form.type.suggestion.ux': '体验反馈',
  'form.type.suggestion.other': '其他建议',
  'form.label.contact': '电子邮件',
  'form.placeholder.contact': '例如 name@example.com',
  'form.label.subject': '标题',
  'form.placeholder.subject': '一句话说明问题',
  'form.label.desc': '详细描述',
  'form.placeholder.desc': '请描述：发生了什么、发生时间、相关订单号或内容链接、您期望的处理结果',
  'form.btn.submit': '生成并复制工单内容',
  'form.hint': '点击后将生成格式化工单内容并复制，请粘贴到官方 Discord 伺服器的工单频道提交。',
  'form.alert.incomplete': '请填写完整（工单类型、联系方式、标题、描述）',
  'form.alert.email': '请输入有效的电子邮件地址',

  // 生成工单文本时的字段前缀
  'form.field.category': '【工单类型】',
  'form.field.type': '【问题类型】',
  'form.field.contact': '【电子邮件】',
  'form.field.subject': '【标题】',
  'form.field.desc': '【描述】',

  'done.title': '工单内容已生成',
  'done.intro': '内容已复制到剪贴板（若未自动复制，请点击下方文本框全选后手动复制），然后按以下步骤提交：',
  'done.step1': '前往官方 Discord 伺服器',
  'done.step2': '在工单频道粘贴并发送',
  'done.step3': '管理员按队列处理（紧急事项优先），首个人工回复目标 3 天内',
  'done.join': '加入伺服器',
  'done.note': '站内工单系统尚未直连，Discord 粘贴为当前提交渠道；系统上线后，此处提交将自动进入排队。',

  // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
  'doneapi.title': '工单已提交',
  'doneapi.body': '工单已进入排队处理，编号：',
  'doneapi.bodyPos': '，当前排在第',
  'doneapi.bodyPosSuffix': '位',
  'doneapi.note': '首个人工回复目标为 3 天内；处理进展将通过您留下的电子邮件告知。',

  'fraud': '⚠️ 防诈骗提示：平台客服在正常情况下不会主动私信联系你；特殊情况下（如账号安全核查、订单异常处理）运营团队会以官方名义主动联系，并会先出示官方验证码（12 小时内有效）自证身份——你可以前往帮助中心「验证官方人员身份」输入验证码核实，验证结果会显示验证码的创建时间，以及该工作人员的化名、职位与负责事项。官方人员无论何种情况都不会向你索要密码、短信验证码或支付信息；任何不出示验证码、验证码无效、或索要上述信息的“官方私信”均为冒充，请勿回应，并前往官方 Discord 社区核实或举报。'
});
