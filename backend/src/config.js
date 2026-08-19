'use strict';
// 环境变量集中读取 + 校验。所有值带默认；非法整数启动即报错（fail fast）。
// 由 node --env-file 注入 process.env，无 dotenv 依赖。

function int(name, fallback) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`env ${name}=${v} 不是整数`);
  return n;
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: int('PORT', 3000),
  host: process.env.HOST || '127.0.0.1',
  databasePath: process.env.DATABASE_PATH || './data/mn.sqlite',
  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),

  mail: {
    from: process.env.MAIL_FROM || 'M.NationWorld <no-reply@example.com>',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: int('SMTP_PORT', 465),
      secure: process.env.SMTP_SECURE !== 'false',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  },

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  },

  tencent: {
    secretId: process.env.TENCENT_SECRET_ID || '',
    secretKey: process.env.TENCENT_SECRET_KEY || '',
    imsRegion: process.env.TENCENT_IMS_REGION || 'ap-singapore'
  },

  // 月度预算默认值（元）——kv 表可被管理员覆盖
  budgets: {
    moderation_text: int('BUDGET_MODERATION_TEXT', 30),
    chat: int('BUDGET_CHAT', 20),
    moderation_image: int('BUDGET_MODERATION_IMAGE', 10),
    total: int('BUDGET_TOTAL', 60)
  },

  // 认证参数
  sessionTtlMs: 30 * 24 * 3600 * 1000,   // 会话 30 天
  emailCodeTtlMs: 10 * 60 * 1000,        // 验证码 10 分钟
  sessionCookie: 'mn_session',

  // 开发模式固定登录码（DEV_LOGIN_CODE，仅本地测试用）：
  // 验证码环节直接放行、只允许登录已有账号；生产环境强制忽略（误配也不生效）。
  devLoginCode: process.env.NODE_ENV === 'production' ? '' : (process.env.DEV_LOGIN_CODE || ''),

  // 前后端分离（前端独立托管，API 独立子域）：
  // COOKIE_DOMAIN 例 'mn.world'（不含端口；配了才会加 Domain=，本地同域开发不配）
  // FRONTEND_ORIGIN 例 'https://mn.world,https://www.mn.world'（CORS 白名单，逗号分隔；不在白名单的 Origin 不返回 CORS 头）
  cookieDomain: process.env.COOKIE_DOMAIN || '',
  frontendOrigins: (process.env.FRONTEND_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),

  // Stripe 在线支付（真实扣款；零前端密钥——前端只拿后端返回的跳转 URL）。混合模式：
  //   subscription = 自动续费订阅（仅卡类支撑反复扣款；Apple Pay/Google Pay 随卡自动出现）
  //   once         = 单次购买 1 个月（FPX 网银/支付宝/GrabPay 等一次性支付方式，到期不自动续）
  // STRIPE_ENABLED 未开 / 密钥未配 → 付费页回退一期「申请开通」工单流程（降级路径）。
  // prices：5 个主 SKU（basic/premium/ultra/pkg-premium/pkg-ultra）的 recurring Price ID；
  // pricesOnce：同 SKU 的一次性（one_time）Price ID。Basic = 学生价 RM12/月（付费层，新用户默认 free 普通用户）。
  // 缺哪个，哪个 SKU 的对应通道就不走支付、回退申请流。
  // paymentMethods（订阅）：只放卡类——FPX/支付宝等一次性方式不支撑订阅，放进订阅清单 Checkout 建会话会失败。
  // oncePaymentMethods（单次）：默认 card,fpx,alipay,grabpay；微信支付等需先在 Dashboard 确认马区可用再加 wechat_pay。
  stripe: {
    enabled: process.env.STRIPE_ENABLED === 'true',
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    paymentMethods: (process.env.STRIPE_PAYMENT_METHODS || 'card').split(',').map((s) => s.trim()).filter(Boolean),
    oncePaymentMethods: (process.env.STRIPE_ONCE_PAYMENT_METHODS || 'card,fpx,alipay,grabpay').split(',').map((s) => s.trim()).filter(Boolean),
    returnOrigin: process.env.STRIPE_RETURN_ORIGIN || '',
    prices: {
      basic: process.env.STRIPE_PRICE_BASIC || '',
      premium: process.env.STRIPE_PRICE_PREMIUM || '',
      ultra: process.env.STRIPE_PRICE_ULTRA || '',
      'pkg-premium': process.env.STRIPE_PRICE_PKG_PREMIUM || '',
      'pkg-ultra': process.env.STRIPE_PRICE_PKG_ULTRA || ''
    },
    pricesOnce: {
      basic: process.env.STRIPE_PRICE_BASIC_ONCE || '',
      premium: process.env.STRIPE_PRICE_PREMIUM_ONCE || '',
      ultra: process.env.STRIPE_PRICE_ULTRA_ONCE || '',
      'pkg-premium': process.env.STRIPE_PRICE_PKG_PREMIUM_ONCE || '',
      'pkg-ultra': process.env.STRIPE_PRICE_PKG_ULTRA_ONCE || ''
    }
  }
};

module.exports = config;
