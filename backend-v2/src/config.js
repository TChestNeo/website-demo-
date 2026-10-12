'use strict';
// çŽ¯å¢ƒå˜é‡é›†ä¸­è¯»å– + æ ¡éªŒã€‚æ‰€æœ‰å€¼å¸¦é»˜è®¤ï¼›éžæ³•æ•´æ•°å¯åŠ¨å³æŠ¥é”™ï¼ˆfail fastï¼‰ã€‚
// ç”± node --env-file æ³¨å…¥ process.envï¼Œæ—  dotenv ä¾èµ–ã€‚
// v2 ç›¸å¯¹ v1 çš„æ–°å¢žï¼šstaffCookie / geoIpUrl / seedDemoStaff / budgets.copilotã€‚

function int(name, fallback) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`env ${name}=${v} ä¸æ˜¯æ•´æ•°`);
  return n;
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: int('PORT', 3000),
  host: process.env.HOST || '127.0.0.1',
  databasePath: process.env.DATABASE_PATH || './data/mn-v2.sqlite',
  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  // v0.2.16.0 å¸–å­åª’ä½“æ–‡ä»¶ç›®å½•ï¼ˆGCS FUSE æŒ‚è½½ç›˜ï¼Œæ•´æ–‡ä»¶å†™å®‰å…¨ï¼›æµ‹è¯•è¦†ç›–ä¸ºä¸´æ—¶ç›®å½•ï¼‰
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
    // ç•™ç©º = ç«¯ç‚¹å„è‡ªé»˜è®¤ï¼ˆå®¢æœ chat=deepseek-v4-flashï¼›å›¾åº“æ ‡ç­¾æŸ¥é‡=deepseek-v4-flashï¼‰ï¼›é…äº†åˆ™å…±ç”¨
    model: process.env.DEEPSEEK_MODEL || ''
  },

  // Geminiï¼ˆFC v10.28.50.0 è¾¹ç¼˜/è¾¹æ¡† AI ç”Ÿæˆï¼›ç”¨æˆ·é’¦å®šã€ŒGemini Flash åªè´Ÿè´£ç”Ÿæˆã€DeepSeek åªè´Ÿè´£å®¢æœã€ï¼‰ï¼š
  // key åªæ´» Cloud Run envï¼Œç»ä¸ commitï¼ˆAQ. å‰ç¼€éž AIzaâ€”â€”å½“ä¸é€æ˜Ž key èµ° x-goog-api-key å¤´ Google ç«¯ç‚¹ï¼‰ã€‚
  // model ç•™ç©º = fc-edgegen.js MODEL_DEFAULTï¼ˆgemini-3.8-flashâ€”â€”çº¿ä¸ŠæŽ¢æµ‹ 404 åŽ 2.5-flash é€€å½¹æ–°ç”¨æˆ·ï¼‰ï¼›æ—  key ç«¯ç‚¹å›ž 503 unavailableï¼ˆå‰ç«¯ toast å¼•å¯¼ï¼‰ã€‚
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

  // ç³»ç»Ÿæ›´æ–°ï¼ˆP9ï¼‰ï¼š/api/app/latest çš„ç‰ˆæœ¬å•ä¸€æ¥æºâ€”â€”å‘æ–°ç‰ˆåªæ”¹è¿™é‡Œï¼ˆæˆ– envï¼‰+ è¦†ç›– docs/downloads/MNationWorld.apk
  appVersions: {
    androidVersionCode: int('APP_VERSION_CODE', 5),
    androidVersionName: process.env.APP_VERSION_NAME || '1.0.3',
    androidUrl: process.env.APP_URL || '/downloads/MNationWorld.apk',
    androidSizeMb: Number(process.env.APP_SIZE_MB || 10.4),
    androidMinSdk: process.env.APP_MIN_SDK || 'Android 7.0+',
    androidNote: process.env.APP_NOTE || '',
    iosStatus: process.env.IOS_STATUS || 'preparing',
    iosNote: process.env.IOS_NOTE || 'iOS ç‰ˆæ­£åœ¨å‡†å¤‡ä¸Šæž¶',
    iosUrl: process.env.IOS_URL || ''
  },

  // æœˆåº¦é¢„ç®—é»˜è®¤å€¼ï¼ˆå…ƒï¼‰â€”â€”platform_settings budget.* ä¸ºè¿è¡Œæ—¶çœŸå€¼ï¼Œæ­¤å¤„ä¸ºå»ºåº“ç§å­/å…œåº•
  budgets: {
    moderation_text: int('BUDGET_MODERATION_TEXT', 30),
    chat: int('BUDGET_CHAT', 20),
    moderation_image: int('BUDGET_MODERATION_IMAGE', 10),
    copilot: int('BUDGET_COPILOT', 10),
    edgeGen: int('BUDGET_EDGEGEN', 10),
    total: int('BUDGET_TOTAL', 60)
  },

  // è®¤è¯å‚æ•°ï¼ˆD2 åŒä¼šè¯ï¼šå…¬ç½‘ mn_session / staff sc_sessionï¼ŒåŒåŸŸå…±äº«ï¼‰
  sessionTtlMs: 30 * 24 * 3600 * 1000,   // ä¼šè¯ 30 å¤©
  emailCodeTtlMs: 10 * 60 * 1000,        // éªŒè¯ç  10 åˆ†é’Ÿ
  sessionCookie: 'mn_session',
  staffCookie: 'sc_session',

  // å­¦ç”Ÿè®¤è¯ï¼ˆv0.2.44.0 å­¦ç”Ÿä»· RM5.50ï¼‰ï¼šè®¤è¯æœ‰æ•ˆæœŸ 365 å¤©ï¼ˆè¿‡æœŸè¯»å–è·¯å¾„æƒ°æ€§æ¸…é™¤ï¼ŒåŒ tier æƒ°æ€§é™çº§ï¼‰ï¼›
  // domains = å­¦æ ¡é‚®ç®±åŸŸåç™½åå•ï¼ˆå¯é€‰ env é€—å·åˆ†éš”ï¼Œæ•´è¡¨æ›¿æ¢ï¼›ç©º â†’ students.js DEFAULT_DOMAINSï¼‰
  student: {
    ttlMs: 365 * 24 * 3600 * 1000,
    domains: (process.env.STUDENT_EMAIL_DOMAINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  },

  // ç¤¾äº¤ç»éªŒå€¼ï¼ˆv0.2.49.0 ç”¨æˆ·æ•°å€¼è¡¨ï¼šç²‰ä¸+25/èµž+15/èŽ·è¯„è®º+10/æ”¶è—+12ï¼‰ï¼š
  // gained = ã€Œåˆ«äººå¯¹ä½ åšã€æ—¶åŽç«¯å®žæ—¶ç´¯åŠ ï¼ˆusers.xp_gained è¿ç§» 023ï¼‰ï¼›åŠ¨ä½œç±» XP ä»åœ¨å‰ç«¯ localStorageã€‚
  // activity = å¹³å°æ´»è·ƒæ—¥åˆ¤å®šï¼ˆè¯é¢˜ +25 çš„ 30 å¤©è¿žç»­é—¨ç¦ï¼‰ï¼šå½“å¤© â‰¥ minPosters ä¸ªä¸åŒç”¨æˆ·å‘å¸–ç®—æ´»è·ƒæ—¥
  //ï¼ˆç”¨æˆ·é’¦å®šã€Œè‡³å°‘ä¸€å¤©å†…ä¸åŒçš„10ä¸ªç”¨æˆ·å‘å¸ƒä¸€ä¸ªå¸–å­ã€ï¼‰ï¼›windowDays = æ´»åŠ¨çª—å£ï¼ˆâ‰¥30 ä¾›è¯é¢˜åˆ¤å®šï¼‰ã€‚
  xp: {
    gained: { fan: 25, like: 15, comment: 10, favorite: 12 },
    // v10.28.52.0 å›¢é˜Ÿ XP äº”äº‹ä»¶ï¼ˆç”¨æˆ·æ•°å€¼è¡¨ 2026-10-04ï¼‰ï¼šä¸Šä¼ ä½œå“ 24/èŽ·èµž 16/ç²‰ä¸ 32/æ”¶è— 36/åˆ†äº«è½¬å‘ 20ã€‚
    // åŒå‘å¯¹ç§°è®°è´¦ï¼ˆã€Œå°‘ä¸€ä¸ªå°±æ”¶èµ°ã€ï¼‰ï¼šåå‘æ“ä½œåŒé¢æ‰£å›žï¼ˆteam-xp.js loseTeamXpï¼›MAX(0) ä¸ç©¿è´Ÿï¼‰ã€‚
    teamGained: { upload: 24, like: 16, fan: 32, favorite: 36, share: 20 },
    activity: { minPosters: 10, windowDays: 60 }
  },

  // å¼€å‘æ¨¡å¼å›ºå®šç™»å½•ç ï¼ˆDEV_LOGIN_CODEï¼Œä»…æœ¬åœ°æµ‹è¯•ç”¨ï¼‰ï¼š
  // ç”¨æˆ·/Staff éªŒè¯ç çŽ¯èŠ‚ç›´æŽ¥æ”¾è¡Œã€åªå…è®¸ç™»å½•å·²æœ‰è´¦å·/staff è¡Œï¼›ç”Ÿäº§çŽ¯å¢ƒå¼ºåˆ¶å¿½ç•¥ï¼ˆè¯¯é…ä¹Ÿä¸ç”Ÿæ•ˆï¼‰ã€‚
  devLoginCode: process.env.NODE_ENV === 'production' ? '' : (process.env.DEV_LOGIN_CODE || ''),

  // å‰åŽç«¯åˆ†ç¦»ï¼ˆå‰ç«¯ç‹¬ç«‹æ‰˜ç®¡ï¼ŒAPI ç‹¬ç«‹å­åŸŸï¼‰ï¼š
  // COOKIE_DOMAIN ä¾‹ 'mn.world'ï¼ˆä¸å«ç«¯å£ï¼›é…äº†æ‰ä¼šåŠ  Domain=ï¼Œæœ¬åœ°åŒåŸŸå¼€å‘ä¸é…ï¼‰
  // FRONTEND_ORIGIN ä¾‹ 'https://mn.world,https://www.mn.world,https://admin.mn.world'ï¼ˆCORS ç™½åå•ï¼‰
  cookieDomain: process.env.COOKIE_DOMAIN || '',
  frontendOrigins: (process.env.FRONTEND_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),

  // IP åœ°ç†ä½ç½®ï¼ˆå¯é€‰ï¼ŒD10ï¼‰ï¼šGEOIP_URL ä¸ºå¯æŸ¥è¯¢æ¨¡æ¿ï¼ˆå¦‚ https://ipinfo.io/{ip}/jsonï¼‰ã€‚
  // æœªé…ç½®/æŸ¥è¯¢å¤±è´¥ â†’ login_history.country ä¸ºç©ºï¼ŒIP åªä½œé£Žé™©ä¿¡å·ï¼ˆÂ§5ï¼‰ï¼Œä¸å•ç‹¬åˆ¤ç›—å·ã€‚
  geoIpUrl: process.env.GEOIP_URL || '',

  // seed è„šæœ¬ï¼šæ˜¯å¦åˆ›å»ºæ¼”ç¤º staffï¼ˆAlex/Danielï¼‰ï¼›ç”Ÿäº§éƒ¨ç½²ç•™ç©º/è®¾ falseã€‚
  seedDemoStaff: process.env.SEED_DEMO_STAFF !== 'false',

  // Stripe åœ¨çº¿æ”¯ä»˜ï¼ˆçœŸå®žæ‰£æ¬¾ï¼›é›¶å‰ç«¯å¯†é’¥â€”â€”å‰ç«¯åªæ‹¿åŽç«¯è¿”å›žçš„è·³è½¬ URLï¼‰ã€‚æ··åˆæ¨¡å¼ï¼š
  //   subscription = è‡ªåŠ¨ç»­è´¹è®¢é˜…ï¼ˆä»…å¡ç±»æ”¯æ’‘åå¤æ‰£æ¬¾ï¼›Apple Pay/Google Pay éšå¡è‡ªåŠ¨å‡ºçŽ°ï¼‰
  //   once         = æ¯å¹´æ”¯ä»˜ 1 å¹´ï¼ˆv0.2.13.0ï¼šæœˆä»·Ã—10 é€ 2 ä¸ªæœˆï¼Œä¸€æ¬¡ä»˜æ¸…ï¼›GrabPay ç­‰ä¸€æ¬¡æ€§æ”¯ä»˜æ–¹å¼ï¼Œ
  //                  åˆ°æœŸä¸è‡ªåŠ¨ç»­ï¼Œwebhook é¡ºå»¶ 12 ä¸ªæœˆï¼›Apple/Google Pay éšå¡è‡ªåŠ¨å‡ºçŽ°åœ¨ç»“è´¦é¡µï¼‰
  // STRIPE_ENABLED æœªå¼€ / å¯†é’¥æœªé… â†’ ä»˜è´¹é¡µå›žé€€ã€Œç”³è¯·å¼€é€šã€å·¥å•æµç¨‹ï¼ˆé™çº§è·¯å¾„ï¼‰ã€‚
  // pricesï¼š5 ä¸ªä¸» SKUï¼ˆbasic/premium/ultra/pkg-premium/pkg-ultraï¼‰çš„ recurring Price IDï¼›
  // pricesOnceï¼šåŒ SKU çš„å¹´ä»˜ï¼ˆone_timeï¼‰Price IDã€‚Basic = å­¦ç”Ÿä»·æ–¹æ¡ˆ RM12/æœˆï¼ˆä»˜è´¹å±‚ï¼Œæ–°ç”¨æˆ·é»˜è®¤ free æ™®é€šç”¨æˆ·ï¼›
  // å­¦æ ¡é‚®ç®±è®¤è¯åŽå­¦ç”Ÿä»· RM5.50/æœˆèµ° studentPrices ç‹¬ç«‹ Priceï¼‰ã€‚
  // ç¼ºå“ªä¸ªï¼Œå“ªä¸ª SKU çš„å¯¹åº”é€šé“å°±ä¸èµ°æ”¯ä»˜ã€å›žé€€ç”³è¯·æµã€‚
  // paymentMethodsï¼ˆè®¢é˜…ï¼‰ï¼šåªæ”¾å¡ç±»â€”â€”FPX/æ”¯ä»˜å®ç­‰ä¸€æ¬¡æ€§æ–¹å¼ä¸æ”¯æ’‘è®¢é˜…ï¼Œæ”¾è¿›è®¢é˜…æ¸…å• Checkout å»ºä¼šè¯ä¼šå¤±è´¥ã€‚
  // oncePaymentMethodsï¼ˆæ¯å¹´æ”¯ä»˜ï¼‰ï¼šé»˜è®¤ card,grabpayâ€”â€”v0.2.13.1 å®žè¯è½®ï¼ˆ09-04 æŽ¢æ´» PaymentMethodConfigurations
  // é€æ–¹å¼ available å­—æ®µï¼‰ï¼šæœ¬è´¦æˆ·ï¼ˆMYï¼‰fpx/alipay available:falseï¼ˆStripe è´¦æˆ·çº§ä¸å¯ç”¨ï¼Œdisplay_preference å¼€äº†
  // ä¹Ÿå»ºä¸äº†ä¼šè¯ï¼Œæ›¾è‡´ MYR æ¯å¹´æ”¯ä»˜ checkout 400 å…¨æ­»ï¼‰ï¼›å¯ç”¨ = card/grabpay/apple_pay/google_pay/linkï¼ˆé’±åŒ…éšå¡
  // è‡ªåŠ¨å‡ºçŽ°ï¼Œæ— éœ€åˆ—å…¥ï¼‰ï¼›å“ªå¤© Stripe ç»™å¼€é€šå¯åŠ å›žï¼ˆwechat_pay åŒç†éœ€è´¦æˆ·çœŸå¯ç”¨æ‰åˆ—ï¼‰ã€‚
  // å¤šå¸ç§ï¼ˆv0.2.12.0ï¼‰ï¼šmyrï¼ˆé©¬æ¥è¥¿äºšæœ¬åœ°ä»·ï¼Œé»˜è®¤ï¼‰èµ°ä¸Šæ–¹ legacy env Priceï¼›usd + 14 å¸èµ° STRIPE_CATALOG_B64
  // ï¼ˆbase64url JSON {currency:{tierKey:{sub,once}}}ï¼›v0.2.13.0 èµ· once = å¹´ä»˜ Price IDï¼Œæœˆä»˜é‡‘é¢Ã—10 åŽé‡å¸
  // .99/.00 å°¾ï¼‰ï¼›å• env å•å€¼é¿å… gcloud é€—å·æ‹†å‚ï¼‰ã€‚
  //   å¼±å¸ï¼ˆidr/vnd/thb/php/inrï¼Œ1 USD æ¢å¾—æ¯” MYR å¤šï¼‰â†’ æŒ‰ MYR ä»·æ¡£æ¢ç®—ï¼›å…¶ä½™ â†’ æŒ‰ USD ä»·æ¡£æ¢ç®—ï¼›å°¾ X.99/.00ã€‚
  // éž myr ä¼šè¯æ”¯ä»˜æ–¹å¼åªå…è®¸ cardï¼ˆFPX/æ”¯ä»˜å®/GrabPay ä¸ºé©¬åŒºæ–¹å¼ï¼‰ã€‚ç¼ºå¤±/è§£æžå¤±è´¥ â†’ catalog={}ï¼ˆçº¯ legacy å…¼å®¹ï¼‰ã€‚
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
      // FC v10.28.51.0 å›¢é˜Ÿæ‰©å®¹è®¢é˜…ï¼ˆslots-*ï¼Œä¸€æ¬¡ä»˜æ¸… 1 ä¸ªæœˆï¼›ç¼ºåˆ™ç‚¹å‡»å¦‚å®žå›žé€€ï¼‰
      'slots-basic': process.env.STRIPE_PRICE_SLOTS_BASIC || '',
      'slots-plus': process.env.STRIPE_PRICE_SLOTS_PLUS || '',
      'slots-premium': process.env.STRIPE_PRICE_SLOTS_PREMIUM || '',
      'slots-ultra': process.env.STRIPE_PRICE_SLOTS_ULTRA || ''
    },
    // v0.2.44.0 å­¦ç”Ÿä»·ï¼ˆä»… Basic SKU Ã— ä»… myrï¼‰ï¼šæœˆä»˜ RM5.50 + å¹´ä»˜ RM55ï¼ˆç”¨æˆ· Stripe åŽå°åˆ›å»ºï¼‰
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
        console.error('[config] STRIPE_CATALOG_B64 è§£æžå¤±è´¥ï¼š' + e.message);
        return {};
      }
    })()
  }
};

module.exports = config;

