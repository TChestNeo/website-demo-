# Stripe 在线支付开通手册（混合模式：订阅自动续费 + 单次购买）

付费页二期 = 真实在线支付，双通道：

- **订阅（自动续费）**：Stripe Checkout **Subscription**，仅卡类（Visa/Mastercard/Amex；Apple Pay/Google Pay 随卡自动出现）。适合长期会员。
- **单次购买 1 个月**：Stripe Checkout **Payment**（one_time 价），支持 FPX 网银（Maybank/CIMB 等约 20 家大马银行）/ 支付宝 / GrabPay / 卡类。到期不自动续，可再买。

前端零密钥（后端创建会话、前端只拿 URL 跳转），一期「申请开通」工单流保留为回退（Stripe 未配置 / 本地 demo 登录 / addon 加购 / checkout 失败）。

**支付方式能力边界（Stripe 马来西亚区）**：TNG eWallet / PayPal **不在 Stripe 体系内，任何配置都出不来**（需要的话是另一套集成，本次不做）；微信支付马区可用性未确认，Dashboard 实测可用再加（见 §5）。Apple Pay 需要 Dashboard 注册站点域名后才出现在卡类结账页。

**未配置任何 STRIPE_* 时付费页自动回退一期申请流，可后补开通**——上线不必被此项阻塞。

## 1. 注册与基础信息

1. 注册 <https://stripe.com>（国家 **马来西亚**、币种 **MYR**）。测试模式无需 KYC，全程用 `sk_test` 联调。
2. Dashboard → Developers → API keys 拿 `sk_test_...`。
3. 下载 **Stripe CLI**（<https://stripe.com/docs/stripe-cli>）——本地联调 webhook 用。

## 2. 建 4×2 个价（Product + Price）

最快方式（推荐）：本地跑一条命令自动建齐并打印 .env 行（幂等，可重复跑）：

```bash
cd backend && node scripts/stripe-init.js <sk_test_xxx>
```

或手动：Dashboard → Product catalog → Add product，每个 SKU 一个 Product，建**两个** price——Recurring / Monthly（订阅）+ One time（单次），金额（MYR）：

| SKU（后端 key） | 方案 | 月价 MYR |
|---|---|---|
| `premium` | Premium | 23.50 |
| `ultra` | Premium Ultra | 45.50 |
| `pkg-premium` | Premium + 团队包 | 29.90 |
| `pkg-ultra` | Premium Ultra + 团队包 | 60.90 |

记下 8 个 Price ID（`price_...`）。**缺哪个，哪个 SKU 的对应通道就自动回退申请流**（前端按 `/api/subscription/status` 的 `prices[key].hasPrice`/`hasOnce` 判断，零代码改动）。

> 正式上线激活 live 后要再建一组 live Price（8 个），替换 `.env` 里的 ID。

## 3. Customer Portal（用户自助取消/换卡/看账单）

Dashboard → Settings → Billing → **Customer portal**：
- 激活 portal；取消订阅开关打开（Proration 随意）；
- Return URL 填 `https://<域名>/pages/premium.html`。

后端只建 portal session（POST `/api/subscription/portal`），用户有 `stripe_customer_id` 才出「管理订阅」链接。

## 4. Webhook

后端端点 `POST /api/webhooks/stripe`（HMAC-SHA256 验签，±300s 容忍）。**只订阅 5 个事件**：

| 事件 | 后端动作 |
|---|---|
| `checkout.session.completed` | 存 customer/subscription id；`payment_status=paid` 才开通（FPX 异步到账时为 unpaid，等下一个事件）。`mode=payment`（单次购买）同样走这里开通，审计 `via=stripe_once` |
| `checkout.session.async_payment_succeeded` | 开通（与上面二选一先到者生效，事件去重保证只开一次） |
| `invoice.paid` | 首期 = pending 行转 paid；续费 = 新增行 + 到期顺延 1 个月（只订阅有，单次购买无发票） |
| `invoice.payment_failed` | 记 failed 行，tier 不动（Stripe 催款重试；最终失败会发 deleted） |
| `customer.subscription.deleted` | 立即降回 basic + 清到期 |

其他事件一律 200 忽略。

**本地联调**（拿到 webhook 签名密钥）：

```bash
stripe listen --forward-to http://127.0.0.1:3000/api/webhooks/stripe
# 输出的 whsec_... 填进 STRIPE_WEBHOOK_SECRET
```

**生产**：Dashboard → Developers → Webhooks → Add endpoint，URL `https://api.<域名>/api/webhooks/stripe`，事件勾上面 5 个，拿 `whsec_...`。

## 5. 后端 .env

```ini
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PREMIUM=price_xxx
STRIPE_PRICE_ULTRA=price_xxx
STRIPE_PRICE_PKG_PREMIUM=price_xxx
STRIPE_PRICE_PKG_ULTRA=price_xxx
STRIPE_PRICE_PREMIUM_ONCE=price_xxx
STRIPE_PRICE_ULTRA_ONCE=price_xxx
STRIPE_PRICE_PKG_PREMIUM_ONCE=price_xxx
STRIPE_PRICE_PKG_ULTRA_ONCE=price_xxx
# 订阅支付方式：只放卡类。FPX/支付宝等一次性方式不支撑订阅，放进去 Checkout 建会话会失败
STRIPE_PAYMENT_METHODS=card
# 单次购买支付方式。微信支付先在 Dashboard 确认马区可用再补 wechat_pay
STRIPE_ONCE_PAYMENT_METHODS=card,fpx,alipay,grabpay
# 支付回跳前缀（默认：请求 Origin（白名单内）→ FRONTEND_ORIGIN 首项 → 本地默认，一般留空即可）
STRIPE_RETURN_ORIGIN=
```

另：Dashboard → Settings → Payment methods 确认 card 已启用，并开启 FPX / Alipay / GrabPay；Apple Pay 需在 Dashboard 注册站点域名。

重启后端后 `GET /api/subscription/status` 的 `enabled` 应为 `true`，付费页出现双按钮：「订阅 · RMxx/月」+「单次购买 · RMxx · 1 个月」。

## 6. 测试全链路（test mode，测试卡）

1. 登录付费页 → 点 Premium「订阅 · RM23.50/月」→ Stripe 结账页：
   - 卡号 `4242 4242 4242 4242`（任意未来有效期/CVC）→ 立即成功 → 回跳 `?paid=1` 绿色横幅 → 用户 tier 变 premium，到期 +1 个月（管理后台用户详情可见 `tierExpiresAt` 与 payments 记录）。
   - 卡号 `4000 0000 0000 0002`（declined）→ 扣款失败 → 生成 `invoice.payment_failed`，tier 不动。
2. 单次购买：点「单次购买 · RM23.50 · 1 个月」→ 结账页选 **FPX** → 测试银行（模拟成功/失败两个选项）→ 验证异步到账开通路径（`async_payment_succeeded`）→ tier 开通、到期 +1 个月、审计 `via=stripe_once`（不产生订阅，无「管理订阅」入口）。
3. 到期顺延：Stripe Dashboard 对该订阅点「模拟下月账单/立即收月费」（或直接等 `invoice.paid`）→ 到期 +1 个月。
4. 取消：「管理订阅」进 portal → 取消 → `customer.subscription.deleted` → 用户立即降 basic。
5. 本地联调记得开 `stripe listen`，否则 webhook 进不来、支付成功但 tier 不动。

## 7. 正式上线（live 激活）

1. Dashboard → Settings → Activate your account：提交公司/个人信息 + 银行账户（MYR 收款）。
2. 建 live 版 8 个 Price（4 订阅 + 4 单次），`.env` 换 `sk_live_...` + live Price ID + 生产 webhook `whsec_live_...`（STRIPE_ENABLED 保持 true）。
3. 先用自己卡跑一遍 §6 全链路（会真实扣款，随后可退款）。

## 8. 故障排查

| 现象 | 原因与处理 |
|---|---|
| webhook 返回 400 | 签名不匹配：`whsec` 与事件来源不是同一密钥（stripe listen 的 whsec 只在本地有效）；时间偏差超 ±300s 需校时 |
| 支付成功但 tier 没动 | webhook 没进后端：`stripe listen` 没开 / 生产 endpoint 没配 / 事件没勾全（看后端日志 `[webhook]` 行） |
| 付费页 CTA 还是「申请开通」 | `STRIPE_ENABLED=true` 未重启；或该 SKU 缺 Price ID（`/api/subscription/status` 查 `hasPrice`/`hasOnce`）；或本地 demo 登录（本地态恒走申请流） |
| 单次购买按钮不出现 | 该 SKU 缺 `STRIPE_PRICE_*_ONCE`；或 `onceMethods` 为空（`/api/subscription/status` 查 `onceMethods`） |
| 订阅结账页报错/建会话失败 | 订阅清单混入了非卡类方式（FPX/支付宝不支撑订阅）：`STRIPE_PAYMENT_METHODS` 只保留 `card` |
| 微信支付不出现 | 马区未开通：Dashboard → Payment methods 确认后，把 `wechat_pay` 加进 `STRIPE_ONCE_PAYMENT_METHODS` 重启 |
| 退款 | Stripe 后台手动退款（我方不做自动退款接口）→ 管理员在管理后台把该用户 PATCH 回 basic（手动授予 = 永久，清空到期时间） |
| 扣款失败催款 | Stripe 自动重试（默认 dunning 配置）；最终失败发 `customer.subscription.deleted` 自动降级，无需人工 |
| FPX 走不通 | 改 `STRIPE_ONCE_PAYMENT_METHODS=card`，零代码改动 |

## 财务口径备忘

- **流水账不变**：Stripe 打款（扣手续费）到账后，管理员在流水账录 income 实收；payments 表只是支付事件账，不自动对接 ledger。
- **财报/曲线口径不变**：Stripe 开通写 `set_tier` 审计行（via=stripe），季度财报与 7 天增长照常把支付订阅者计入预计收入。
- 管理员手动 PATCH tier = 永久授予（清空到期）；若用户仍有活跃订阅，下一次 `invoice.paid` 会重新写入到期时间。
