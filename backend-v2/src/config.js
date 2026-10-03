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
  // v0.2.16.0 帖子媒体文件目录（GCS FUSE 挂载盘，整文件写安全；测试覆盖为临时目录）
  uploadDir: process.env.UPLOADS_DIR || '/mnt/data/uploads',

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
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    // 留空 = 端点各自默认（chat=deepseek-chat；图库标签查重=deepseek-v4-flash）；配了则共用
    model: process.env.DEEPSEEK_MODEL || ''
  },

  // Gemini（FC v10.28.50.0 边缘/边框 AI 生成；用户钦定「Gemini Flash 只负责生成、DeepSeek 只负责客服」）：
  // key 只活 Cloud Run env，绝不 commit（AQ. 前缀非 AIza——当不透明 key 走 x-goog-api-key 头 Google 端点）。
  // model 留空 = fc-edgegen.js MODEL_DEFAULT（gemini-3.8-flash——线上探测 404 后 2.5-flash 退役新用户）；无 key 端点回 503 unavailable（前端 toast 引导）。
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
    model: process.env.GEMINI_MODEL || ''
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
    edgeGen: int('BUDGET_EDGEGEN', 10),
    total: int('BUDGET_TOTAL', 60)
  },

  // 认证参数（D2 双会话：公网 mn_session / staff sc_session，同域共享）
  sessionTtlMs: 30 * 24 * 3600 * 1000,   // 会话 30 天
  emailCodeTtlMs: 10 * 60 * 1000,        // 验证码 10 分钟
  sessionCookie: 'mn_session',
  staffCookie: 'sc_session',

  // 学生认证（v0.2.44.0 学生价 RM5.50）：认证有效期 365 天（过期读取路径惰性清除，同 tier 惰性降级）；
  // domains = 学校邮箱域名白名单（可选 env 逗号分隔，整表替换；空 → students.js DEFAULT_DOMAINS）
  student: {
    ttlMs: 365 * 24 * 3600 * 1000,
    domains: (process.env.STUDENT_EMAIL_DOMAINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  },

  // 社交经验值（v0.2.49.0 用户数值表：粉丝+25/赞+15/获评论+10/收藏+12）：
  // gained = 「别人对你做」时后端实时累加（users.xp_gained 迁移 023）；动作类 XP 仍在前端 localStorage。
  // activity = 平台活跃日判定（话题 +25 的 30 天连续门禁）：当天 ≥ minPosters 个不同用户发帖算活跃日
  //（用户钦定「至少一天内不同的10个用户发布一个帖子」）；windowDays = 活动窗口（≥30 供话题判定）。
  xp: {
    gained: { fan: 25, like: 15, comment: 10, favorite: 12 },
    activity: { minPosters: 10, windowDays: 60 }
  },

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
  // pricesOnce：同 SKU 的年付（one_time）Price ID。Basic = 学生价方案 RM12/月（付费层，新用户默认 free 普通用户；
  // 学校邮箱认证后学生价 RM5.50/月走 studentPrices 独立 Price）。
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
      'pkg-ultra': process.env.STRIPE_PRICE_PKG_ULTRA_ONCE || '',
      // FC v10.28.51.0 团队扩容订阅（slots-*，一次付清 1 个月；缺则点击如实回退）
      'slots-basic': process.env.STRIPE_PRICE_SLOTS_BASIC || '',
      'slots-plus': process.env.STRIPE_PRICE_SLOTS_PLUS || '',
      'slots-premium': process.env.STRIPE_PRICE_SLOTS_PREMIUM || '',
      'slots-ultra': process.env.STRIPE_PRICE_SLOTS_ULTRA || ''
    },
    // v0.2.44.0 学生价（仅 Basic SKU × 仅 myr）：月付 RM5.50 + 年付 RM55（用户 Stripe 后台创建）
    studentPrices: {
      basic: process.env.STRIPE_PRICE_BASIC_STUDENT || ''
    },
    studentPricesOnce: {
      basic: process.env.STRIPE_PRICE_BASIC_STUDENT_ONCE || ''
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
