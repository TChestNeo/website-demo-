'use strict';
// 环境变量集中读取 + 校验。所有值带默认；非法整数启动即报错（fail fast）。
// 由 node --env-file 注入 process.env，无 dotenv 依赖。
// v2 相对 v1 的新增：staffCookie / geoIpUrl / seedDemoStaff / budgets.copilot。

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
  databasePath: process.env.DATABASE_PATH || './data/mn-v2.sqlite',
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

  // 月度预算默认值（元）——platform_settings budget.* 为运行时真值，此处为建库种子/兜底
  budgets: {
    moderation_text: int('BUDGET_MODERATION_TEXT', 30),
    chat: int('BUDGET_CHAT', 20),
    moderation_image: int('BUDGET_MODERATION_IMAGE', 10),
    copilot: int('BUDGET_COPILOT', 10),
    total: int('BUDGET_TOTAL', 60)
  },

  // 认证参数（D2 双会话：公网 mn_session / staff sc_session，同域共享）
  sessionTtlMs: 30 * 24 * 3600 * 1000,   // 会话 30 天
  emailCodeTtlMs: 10 * 60 * 1000,        // 验证码 10 分钟
  sessionCookie: 'mn_session',
  staffCookie: 'sc_session',

  // 开发模式固定登录码（DEV_LOGIN_CODE，仅本地测试用）：
  // 用户/Staff 验证码环节直接放行、只允许登录已有账号/staff 行；生产环境强制忽略（误配也不生效）。
  devLoginCode: process.env.NODE_ENV === 'production' ? '' : (process.env.DEV_LOGIN_CODE || ''),

  // 前后端分离（前端独立托管，API 独立子域）：
  // COOKIE_DOMAIN 例 'mn.world'（不含端口；配了才会加 Domain=，本地同域开发不配）
  // FRONTEND_ORIGIN 例 'https://mn.world,https://www.mn.world,https://admin.mn.world'（CORS 白名单）
  cookieDomain: process.env.COOKIE_DOMAIN || '',
  frontendOrigins: (process.env.FRONTEND_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),

  // IP 地理位置（可选，D10）：GEOIP_URL 为可查询模板（如 https://ipinfo.io/{ip}/json）。
  // 未配置/查询失败 → login_history.country 为空，IP 只作风险信号（§5），不单独判盗号。
  geoIpUrl: process.env.GEOIP_URL || '',

  // seed 脚本：是否创建演示 staff（Alex/Daniel）；生产部署留空/设 false。
  seedDemoStaff: process.env.SEED_DEMO_STAFF !== 'false',

  // Stripe 在线支付（真实扣款；零前端密钥——前端只拿后端返回的跳转 URL）。混合模式：
  //   subscription = 自动续费订阅（仅卡类支撑反复扣款；Apple Pay/Google Pay 随卡自动出现）
  //   once         = 每年支付 1 年（v0.2.13.0：月价×10 送 2 个月，一次付清；GrabPay 等一次性支付方式，
  //                  到期不自动续，webhook 顺延 12 个月；Apple/Google Pay 随卡自动出现在结账页）
  // STRIPE_ENABLED 未开 / 密钥未配 → 付费页回退「申请开通」工单流程（降级路径）。
  // prices：5 个主 SKU（basic/premium/ultra/pkg-premium/pkg-ultra）的 recurring Price ID；
  // pricesOnce：同 SKU 的年付（one_time）Price ID。Basic = 学生价 RM12/月（付费层，新用户默认 free 普通用户）。
  // 缺哪个，哪个 SKU 的对应通道就不走支付、回退申请流。
  // paymentMethods（订阅）：只放卡类——FPX/支付宝等一次性方式不支撑订阅，放进订阅清单 Checkout 建会话会失败。
  // oncePaymentMethods（每年支付）：默认 card,grabpay——v0.2.13.1 实证轮（09-04 探活 PaymentMethodConfigurations
  // 逐方式 available 字段）：本账户（MY）fpx/alipay available:false（Stripe 账户级不可用，display_preference 开了
  // 也建不了会话，曾致 MYR 每年支付 checkout 400 全死）；可用 = card/grabpay/apple_pay/google_pay/link（钱包随卡
  // 自动出现，无需列入）；哪天 Stripe 给开通可加回（wechat_pay 同理需账户真可用才列）。
  // 多币种（v0.2.12.0）：myr（马来西亚本地价，默认）走上方 legacy env Price；usd + 14 币走 STRIPE_CATALOG_B64
  // （base64url JSON {currency:{tierKey:{sub,once}}}；v0.2.13.0 起 once = 年付 Price ID，月付金额×10 后重吸
  // .99/.00 尾）；单 env 单值避免 gcloud 逗号拆参）。
  //   弱币（idr/vnd/thb/php/inr，1 USD 换得比 MYR 多）→ 按 MYR 价档换算；其余 → 按 USD 价档换算；尾 X.99/.00。
  // 非 myr 会话支付方式只允许 card（FPX/支付宝/GrabPay 为马区方式）。缺失/解析失败 → catalog={}（纯 legacy 兼容）。
  stripe: {
    enabled: process.env.STRIPE_ENABLED === 'true',
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    paymentMethods: (process.env.STRIPE_PAYMENT_METHODS || 'card').split(',').map((s) => s.trim()).filter(Boolean),
    oncePaymentMethods: (process.env.STRIPE_ONCE_PAYMENT_METHODS || 'card,grabpay').split(',').map((s) => s.trim()).filter(Boolean),
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
    },
    catalog: (() => {
      try {
        const b = process.env.STRIPE_CATALOG_B64;
        if (!b) return {};
        const j = JSON.parse(Buffer.from(b.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
        return j && typeof j === 'object' ? j : {};
      } catch (e) {
        console.error('[config] STRIPE_CATALOG_B64 解析失败：' + e.message);
        return {};
      }
    })()
  }
};

module.exports = config;
