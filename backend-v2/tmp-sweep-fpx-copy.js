// tmp-sweep-fpx-copy.js — v0.2.13.1：FPX 不可用（实证）→ 全站对外文案去 FPX 声称（tmp 绝不 commit，只写文件，无 git）
// 清单精确替换（html 默认 zh 文案 + zh.js 词典同步）；扫尾打印残留 FPX/fpx 供人工确认（意图保留的除外）。
'use strict';
const fs = require('fs');
const P = (p) => 'C:/Users/USER/Downloads/stitch_slatiworld_micronation_interface/' + p;
const EDITS = [
  // [文件, 旧, 新]
  // help FAQ：支付方式与货币（用户在付费前会读）
  [P('docs/assets/i18n/help.zh.js'), "'支持 Stripe 与 FPX（马来西亚网银）等支付网关，信用卡号等敏感信息由支付网关直接处理，平台绝不存储您的支付凭证。'",
    "'支持 Stripe 在线支付（银行卡 / Apple Pay / Google Pay；马来西亚本地支持 GrabPay），信用卡号等敏感信息由支付网关直接处理，平台绝不存储您的支付凭证。'"],
  [P('docs/assets/i18n/help.zh.js'), "'支持的货币由支付网关（Stripe / FPX）与你的发卡行决定，结算时以支付网关页面显示的金额与汇率为准；马来西亚本地支付优先推荐 FPX 网银。'",
    "'支持的货币由支付网关（Stripe）与你的发卡行决定，结算时以支付网关页面显示的金额与汇率为准；马来西亚本地支付推荐 GrabPay 电子钱包，其余地区可用银行卡（支持 Apple / Google Pay）。'"],
  [P('docs/pages/help.html'), '<p data-i18n="faq.a.11">支持 Stripe 与 FPX（马来西亚网银）等支付网关，信用卡号等敏感信息由支付网关直接处理，平台绝不存储您的支付凭证。</p>',
    '<p data-i18n="faq.a.11">支持 Stripe 在线支付（银行卡 / Apple Pay / Google Pay；马来西亚本地支持 GrabPay），信用卡号等敏感信息由支付网关直接处理，平台绝不存储您的支付凭证。</p>'],
  [P('docs/pages/help.html'), '<p data-i18n="faq.a.14">支持的货币由支付网关（Stripe / FPX）与你的发卡行决定，结算时以支付网关页面显示的金额与汇率为准；马来西亚本地支付优先推荐 FPX 网银。</p>',
    '<p data-i18n="faq.a.14">支持的货币由支付网关（Stripe）与你的发卡行决定，结算时以支付网关页面显示的金额与汇率为准；马来西亚本地支付推荐 GrabPay 电子钱包，其余地区可用银行卡（支持 Apple / Google Pay）。</p>'],
  // financial-terms：支付渠道 + 收入用途
  [P('docs/assets/i18n/financial-terms.zh.js'), '通过 Stripe / FPX 等第三方支付网关收款；信用卡号、银行账户等敏感支付信息由支付网关直接处理，平台不存储（详见《隐私政策》）。',
    '通过 Stripe 等第三方支付网关收款；信用卡号、银行账户等敏感支付信息由支付网关直接处理，平台不存储（详见《隐私政策》）。'],
  [P('docs/assets/i18n/financial-terms.zh.js'), '支付网关手续费（Stripe / FPX）', '支付网关手续费（Stripe）'],
  [P('docs/pages/financial-terms.html'), '平台通过 Stripe / FPX 等第三方支付网关收款；信用卡号、银行账户等敏感支付信息由支付网关直接处理，平台不存储（详见《隐私政策》）。',
    '平台通过 Stripe 等第三方支付网关收款；信用卡号、银行账户等敏感支付信息由支付网关直接处理，平台不存储（详见《隐私政策》）。'],
  [P('docs/pages/financial-terms.html'), '支付网关手续费（Stripe / FPX）', '支付网关手续费（Stripe）'],
  // platform-responsibility：第三方服务清单
  [P('docs/assets/i18n/platform-responsibility.zh.js'), 'Discord、Stripe / FPX、Google Cloud、Google Gemini', 'Discord、Stripe、Google Cloud、Google Gemini'],
  [P('docs/pages/platform-responsibility.html'), 'Discord、Stripe / FPX、Google Cloud、Google Gemini', 'Discord、Stripe、Google Cloud、Google Gemini'],
  // terms：依赖服务
  [P('docs/pages/terms.html'), 'Stripe / FPX 等支付网关（支付处理）', 'Stripe 等支付网关（支付处理）'],
  // privacy：支付数据 + 服务供应商
  [P('docs/pages/privacy.html'), '第三方支付网关如 Stripe / FPX 直接处理', '第三方支付网关如 Stripe 直接处理'],
  [P('docs/pages/privacy.html'), '合规支付网关（Stripe / FPX）', '合规支付网关（Stripe）'],
  // site-config.js 注释链（提醒后人别加回账户不可用的方式）
  [P('docs/assets/js/site-config.js'), '非 myr 只允许 card——FPX/支付宝/GrabPay 是马区方式', '非 myr 只允许 card——GrabPay 是马区方式（v0.2.13.1：fpx/支付宝实证账户不可用已去）'],
];
let fail = 0;
for (const [f, old, nw] of EDITS) {
  let s;
  try { s = fs.readFileSync(f, 'utf8'); } catch (e) { console.log('❌ 读不到 ' + f + ' — ' + e.message); fail++; continue; }
  if (!s.includes(old)) { console.log('❌ 未命中：' + f + ' — ' + old.slice(0, 60) + '…'); fail++; continue; }
  fs.writeFileSync(f, s.split(old).join(nw), 'utf8');
  console.log('✅ ' + f);
}
console.log(fail === 0 ? '全命中替换完成' : fail + ' 处失败');
// 残留扫描（意图保留：premium METHOD_ZH 键 fpx/alipay、config/测试历史注释）
const dirs = [P('docs/pages'), P('docs/assets/js'), P('docs/assets/i18n')];
const globs = dirs.flatMap((d) => fs.existsSync(d) ? fs.readdirSync(d).filter((n) => n.endsWith('.js') || n.endsWith('.html')).map((n) => d + '/' + n) : []);
for (const f of globs) {
  const s = fs.readFileSync(f, 'utf8');
  const i = s.indexOf('FPX');
  if (i !== -1) console.log('残留 FPX：' + f + ' …' + s.slice(Math.max(0, i - 70), i + 40).replace(/\n/g, ' '));
}
