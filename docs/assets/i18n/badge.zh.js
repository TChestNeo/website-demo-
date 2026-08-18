/**
 * 官方人员身份验证 (Staff Verification) — 简体中文 (zh)
 *
 * 本字典包含两组键：
 *   verify.*  —— 验证区块（badge.html 与 help.html「验证官方人员身份」共用）
 *   badge.*   —— badge.html 页面专属
 *
 * 添加新语言：新建 badge.<lang>.js，使用相同的键，
 * 并在本文件之后引入即可，无需改动页面 HTML。
 */
window.MN_I18N.add('zh', {
  // badge.html 页面专属
  'badge.meta.title': '官方人员身份验证 | M.NationWorld',
  'badge.hero.title': '官方人员身份验证',
  'badge.hero.sub': '输入官方客服私信中出示的验证码（12 小时内有效），即可核实对方身份。',
  'badge.fraud': '⚠️ 防诈骗提示：平台客服在正常情况下不会主动私信联系你；特殊情况下（如账号安全核查、订单异常处理）运营团队会以官方名义主动联系，并会先出示官方验证码（12 小时内有效）自证身份。你可以在本页输入验证码核实，验证结果会显示验证码的创建时间，以及该工作人员的化名、职位与负责事项。官方人员无论何种情况都不会向你索要密码、短信验证码或支付信息；任何不出示验证码、验证码无效、或索要上述信息的“官方私信”均为冒充，请勿回应，并前往官方 Discord 社区核实或举报。',

  // 验证区块（badge.html 与 help.html 共用）
  'verify.desc': '如官方人员在特殊情况下私信联系你，请输入对方出示的官方验证码（12 小时内有效）核实身份。',
  'verify.placeholder': '输入验证码，如 A7K2Q9',
  'verify.btn': '验证',
  'verify.demo': '（演示模式：示例验证码 A7K2Q9）',
  'verify.status.valid': '验证通过，确认为官方人员',
  'verify.status.expired': '验证码已过期',
  'verify.invalid': '无效的验证码',
  'verify.invalidGuide': '验证码可能输入有误或已过期（12 小时内有效）；如对方出示的验证码无法通过验证，请勿信任，并前往官方 Discord 社区核实或举报。',
  'verify.err.empty': '请输入验证码',
  'verify.label.alias': '工作人员（化名）',
  'verify.label.role': '职位',
  'verify.label.duties': '负责事项',
  'verify.label.issued': '验证码创建于',
  'verify.label.expires': '有效期至',
  'verify.label.countdown': '剩余有效期',
  'verify.note': '官方人员一律以化名或员工网民名称示人，不使用真实姓名；每枚验证码有效期为 12 小时。'
});
