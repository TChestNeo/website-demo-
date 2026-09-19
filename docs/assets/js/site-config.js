/**
 * site-config — 站点运行时配置（前后端分离部署时生效）。
 * 本地/同域部署默认空对象：MN_API 走同源 '/api'，行为与历史版本完全一致。
 * 部署到 COS/CDN 时按 deploy/cos-deploy.md 把 apiBase 改为后端绝对地址，例如：
 *   window.MN_SITE = { apiBase: 'https://api.mn.world/api' };
 * 必须在 api.js 之前加载（各页已在 storage.js 之前引入本文件）。
 */
window.MN_SITE = window.MN_SITE || {};

// 站点版本号唯一来源（口径：大版本.小版本.小改动.补丁）——侧栏品牌模块显示
// v0.2.3.0 = URL 重构：根 / = dashboard、/signin-and-login = 登录+注册合页（小改动位；2026-08-29）
// v0.2.3.1 = auth 页切 tab 蓝板滑出滑入动画 + 卡后 3 层渐变拖影（补丁位·观感微调；2026-08-29）
// v0.2.3.2 = auth 切 tab 动画口径修正：蓝板扫过表单擦掉旧输入（盖满瞬间切内容）+ 新蓝板从左滑入补位（补丁位·口径修正轮；2026-08-29）
// v0.2.3.3 = auth 卡补整卡磨砂白底（原底只在右板，扫动时蓝板让出的区域透出拖影蓝色）——卡片一体白色（补丁位·修复轮；2026-08-29）
// v0.2.3.4 = auth 页口径修正 v2：登录/注册卡片定高一致 + 右缘内凹圆角 + 动画减速 0.6s→1.1s + 盖满瞬间直接切内容且新蓝板同时从左滑入（双蓝板轮换）+ 拖影改挂蓝板本体（板动影随，不再挂背景卡）（补丁位·口径修正轮；2026-08-29）
// v0.2.3.5 = auth 比例修复：双蓝板改 absolute 脱流（B 板视觉移走但 flex 槽位仍占 → 蓝板 332px/表单 297px/中间 331px 空洞）+ 定高 880→800（注册内容 752+报错余量）（补丁位·修复轮；2026-08-29）
// v0.2.3.6 = auth 切换时机修复：扫出改两段 keyframes（前 71% 慢速滑过表单、71% 盖满瞬间切内容、后 29% ease-out 快速甩出——旧版整段 ease-in-out 盖满后新表单 1058ms 才露全，用户「切换迟了半秒」；修后 ~1013ms 露全）+ AUTH_SWAP_MS 600→780 + 新蓝板滑入 1.1s→0.8s（补丁位·修复轮；2026-08-29）
// v0.2.3.7 = auth 扫出无停顿 + 拖影提亮（用户「为什么滑过去会停一下？我不要停的还有我的移动缠影呢」）：两段 keyframes 缓动速差衔接——段一 cubic-bezier(0.45,0,0.55,0.85) 末输出斜率 dp/du = (1−0.85)/(1−0.55) = 1/3 ≠ 0、段二 cubic-bezier(0.25,0.04,0.58,1) 起步 dp/du = 0.04/0.25 = 0.16（1/3×516.9/781 ≈ 0.16×450.8/319 px/ms 等速接续）——旧版段一 ease-in-out 末速爬向 0 + 段二 ease-out 起步即猛甩 = 停一下再甩出去；拖影掺量 20/10/4%→40/22/10%（白磨砂卡上原值色差仅 2-9% 几乎不可见）+ 移动端 column 布局拖影隐藏（补丁位·修复轮；2026-08-29）
// v0.2.3.8 = auth 页 v2 重设计（用户「算了还是这样……sign in 的输入放左侧 login 放右侧，切换只是蓝色卡片左右移动然后字幕淡出淡入」）：双表单左右各半并排常驻，蓝板单块盖非激活半、切 tab transform 100%↔0 左右滑 0.6s（border-radius 同程过渡贴左缘圆角）；字幕=被盖半品牌文案 grid 叠同格 cross-fade 淡出淡入（incoming delay 0.3s，零 JS 计时器）；右停靠方形右角由两枚页面底色角补丁（z 4 四分之一圆）还原内凹圆角；扫出 keyframes/双板轮换/拖影/card-wrap 全部移除；移动端板变顶部横幅+表单纵排+非激活半隐藏（同一状态类驱动）（补丁位·口径修正轮；2026-08-29）
// v0.2.3.9 = auth 反向滑跷跷板（用户「顶部导航能不能是蓝色卡片向右移动他就向左移动，不需要占用顶部空间，底部也是同理」）：tabs/页脚改绝对浮层（不再占文档流顶部/底部行，表单半独占 800 定高），与蓝板同缓动同程反向同步滑——蓝板盖右半时标签栏+页脚停左半（活跃标签悬可见表单上方），切换时三者同滑反向（补丁位·口径修正轮；2026-08-30）
// v0.2.3.10 = auth 内凹圆角移除 + 蓝板层级置顶（用户「为什么右侧的角落是凹进去的？然后底部和顶部的层级能不能是蓝色卡片在最上方他们在蓝色卡片的下方」）：内凹=旧版滑出设计遗产（v0.2.3.4 钦定「右缘换内凹圆角（只右侧）」），问询钦定改普通圆角（卡四角对称、蓝板右停靠 0 lg lg 0 同程过渡、角补丁退役）；层级=蓝板 z 4 置顶、tabs/页脚 z 2 垫底（跷跷板滑行中从蓝板下穿过）（补丁位·口径修正轮；2026-08-30）
// v0.2.3.11 = auth 标签折行修复 + 表单随蓝板方向淡出淡入（用户「Sign up 的 up 在 Sign 下方，能不能和 Log in 一样是一行的」+「切换时输入根据蓝色卡片移动方向淡出淡入」）：segmented-option 加 white-space:nowrap（active 加粗后最小内容宽塌缩致折行，控件改按整词自适宽）+ auth 标签控件钉 240px 宽（14px 加粗整词 57px 距自适宽差 4px 的保险）；auth-pane 加 opacity 0.6s cubic-bezier(0.4,0,0.2,1) 过渡——与蓝板同缓动同程无延迟，被盖半淡出/露出半淡入，每瞬值=蓝板缓动后进度，状态类翻转驱动（auth-tab-login 下 signup 0/login 1）；移动端 display:none 半切换即时显示无淡入（display:none 不启动 transition，电池实证），板字幕 cross-fade 仍在（补丁位·修复轮；2026-08-30）
// v0.2.3.12 = auth 条款同意迁蓝板 + 注册第一步必勾（用户「把服务条款和隐私条款放在 Login 的蓝色卡片那边，第一个步骤就需要打勾」）：页脚条款行移除（页脚仅剩 demo 提示）；蓝板加 .auth-terms 同意块（原生 checkbox accent-color 白勾 + 服务条款/隐私政策链接，z-index 1 压装饰圆）随状态类 cross-fade——signup 激活（蓝板停 Login 半）显示（incoming delay 0.3s）、login 激活淡出（delay 0s + pointer-events none，登录不需勾）；handleSignup 未勾拦截 Create Account（showError 提示，demo/api 双模式生效）（补丁位·修复轮；2026-08-30）
// v0.2.3.13 = auth 条款同意挂 Login 蓝板 + 登录第一步必勾（用户「不是你把打勾放在sign up 干什么」）：v0.2.3.12 挂反——真身=勾选在 login 激活态蓝板显示（蓝板停 Signup 半、紧挨登录表单）+ 未勾拦截 Log in，Sign up 不拦；状态类规则翻转（auth-tab-login 显示 incoming delay 0.3s / auth-tab-signup 淡出 delay 0s+pointer-events none）、handleSignup 拦截撤除、handleLogin 加拦截（demo/api 双模式生效）（补丁位·口径修正轮；2026-08-30）
// v0.2.3.14 = auth 条款勾选定制样式 + 手机触控适配（用户「能不能给那个打勾的Ui做适配」→问询钦定「定制样式+手机适配」）：勾选框 appearance:none 定制——圆角 6px 玻璃白描边（rgba 0.16/0.75）、hover 提亮、active 缩放 0.92、勾选白底+品牌蓝对勾（::after 边框两画旋转 45°、scale 0→1 回弹 cubic-bezier(0.34,1.56,0.64,1)）、focus-visible 白描环，跨浏览器/设备观感统一；≤768 触控适配——勾选框 22px、字号 14px、gap 10px、整行 padding 10px 0 加大点击区（补丁位·观感微调轮；2026-08-30）
// v0.2.4.0 = auth 全部互换 + URL 更名（用户「那么sign up 和 login倒反了啊」→问询钦定「全部互换」+「还有把链接上的sign-in 改成 sign-up」）：
//   ①全部互换——login 表单左半/signup 表单右半（双表单 DOM 互换）、标签栏 [Log in | Sign up]（登录在前）、默认登录态（auth-tab-login 初始类 + currentTab='login'）、蓝板字幕改配对活跃半（登录态蓝卡=Welcome back/Your world is waiting.、注册态蓝卡=Build Your World+步骤——旧版显示被盖半文案挨着对面表单观感「倒反」）；tabs/页脚/板/表单淡入的状态选择器全部互换；
//   ②URL 更名 /signin-and-login → /signup-and-login（signin 与 login 同义冗余，「注册+登录」合页 URL 应叫 signup；文件 git mv、settings-modal/transitions/help/premium 引用同步，旧 URL 404）
//   （小改动位·口径修正轮；2026-08-30）
// v0.2.4.1 = auth 条款勾选挪进登录表单（用户「为什么打勾右跑去login那了」→问询钦定「挪进登录表单（左半）」）：勾选框从蓝板挪进左半登录表单 Enter Console 按钮上方——随登录半淡入淡出（蓝板字幕不再带条款，注册不拦）；配色反相适配白卡（描边品牌蓝半透 0.45、未勾底 0.06、勾选品牌蓝底白勾、hover 0.12、focus 蓝环），原蓝板白字配色+状态类 cross-fade 规则退役（登录半 opacity 天然覆盖可见性）；（补丁位·口径修正轮；2026-08-30）
// v0.2.4.2 = auth 条款勾选挪进注册表单（用户「不是我是希望用户在注册的时候同意就可以了不需要在登录的时候同意因为都同意过了」）：同意是注册时的一次性动作——勾选框从登录表单挪进右半注册表单 Create Account 按钮上方，随注册半淡入淡出；未勾点 Create Account 由 handleSignup 拦截（demo/api 双模式），登录表单不再显示勾选框、登录拦截撤除；（补丁位·口径修正轮；2026-08-30）
// v0.2.5.0 = 忘记密码独立页 /forgot-password（用户「把Forgot Passwords 变成一个单独的链接页面 然后用户刚打开时只有一个六格验证码输入框 输入完后 输入新密码的卡片才滑出 需要输入一个新密码和一个再次确认」）：
//   新页两段滑卡——打开仅六格验证码（逐格自动跳格/退格/粘贴分发；api 模式带 ?email= 自动发码+60s 重发倒计时、无邮箱直达先输邮箱发码；demo 模式任意六位）；输满六位新密码卡从右滑入（0.6s cubic-bezier(0.4,0,0.2,1) 同 auth 页语言，新密码+再次确认，8-72/一致性校验）；
//   后端无独立验码端点 → 码+密码一次 POST /auth/password-reset 验证，码错报错+Back to code 回退重输；成功回跳 /signup-and-login?reset=1 预填邮箱+「Password reset — log in with your new password」（demo/api 双模式）；
//   auth 页：忘记密码链接改跳新页（带已输邮箱，链接常显）、旧内嵌 resetForm/showReset/hideReset/handleReset 整体移除（小改动位·新功能轮；2026-08-30）
// v0.2.5.1 = 忘记密码滑卡重叠修复（用户「现在是当输入新密码滑出时会和前面的6格重叠」）：新密码卡滑入时六格半透明残影（opacity 0.35）透过磨砂卡仍可见=重叠观感——
//   六格段淡出改彻底消失（opacity 0）+ 淡出单独提速 0.3s ease-out（卡片滑到六格上方时六格已隐形）；滑卡节奏/回滑行为不变（补丁位·纯修复轮；2026-08-30）
// v0.2.5.2 = 忘记密码输满即验码（用户「为什么那个验证码随便打一个都可以啊」）：v0.2.5.0 滑卡只是视觉步骤、码从未被验过（最终提交才一次合验）——输满六位先验码：
//   api 模式 POST /auth/verify-code（新端点：只验码不消费码、与 password-reset 共享 5 次错码锁）→ 码对滑卡/码错清格报错重输；demo 模式照旧任意六位直滑（补丁位·修复轮；2026-08-30）
// v0.2.5.3 = 忘记密码发码中性提示（用户「我填写了我的另外一个电子邮件为什么没有收到验证码」→问询钦定「中性提示，不泄露注册状态」）：
//   未注册邮箱点击发码不再收到「欢迎加入 M.NationWorld」误导邮件——新 purpose=password_reset 注册与否同款中性验证码文案（防枚举：接口响应形状不变、外部试不出注册状态）；
//   页面字幕改中性提示「If an account exists for … the code is on its way — If nothing arrives, this email isn't registered — sign up first」（补丁位·修复轮；2026-08-30）
// v0.2.6.0 = 未登录访客界面（用户「把平台和FluidCanvas的未登录的界面做一下，然后平台左侧的用户卡片直接变成一个注册/登录的按钮」→问询钦定：①平台首页未登录=访客引导页（hero+平台介绍+注册 CTA，登录后=工作台）②FluidCanvas 先登录才能用）：
//   侧栏用户卡片按会话门禁——未登录显示「注册 / 登录」按钮（写死的 Alex Rivera 假卡片对访客退役）；首页访客态互斥显示 .guest-hero 引导页；
//   FluidCanvas 登录门禁——编辑器 head 同步重定向回 FC 引导页（零闪现）、FC 首页访客态显示 🔒 登录引导卡；登录页支持 ?next= 回跳（只认站内绝对路径防开放跳转）（小改动位 5→6·新功能轮；2026-08-31）
// v0.2.6.2 = Identity Setup 必填口径补齐（用户「第二页要求一定要选择生日，国家位置，和语言」）：
//   生日此前不校验可空过 → handleNext 补必填（语言/国家已有校验）；四必填字段标签加 * 红标（补丁位 1→2·修复轮；2026-09-01）
// v0.2.6.1 = 注册步骤指示器修正（用户「注册的第一个页面为什么明明还没有完成就已经打勾了？然后那个打勾能不能改成蓝色的」）：
//   注册页蓝板步骤指示器首步「Create account」误标 completed（还没注册就打勾）→ 改 active 显示数字 1（白底蓝字在蓝板上反相高亮）；
//   completed 勾全站改品牌蓝（.progress-step.completed .dot 绿 #22c55e → var(--color-primary)，create-topic 两页内联绿一并清）（补丁位 0→1·修复轮；2026-09-01）
// v0.2.6.3 = 注册第二页 UI 修复（用户「那个注册手续的第二页的Ui 有bug」）：08-29 auth v2 重构后 ethereal.css 的 .auth-card 改竖排定高 800px+overflow:hidden、.auth-left/.auth-right 样式被移除——本页仍用旧双栏标记：竖排堆叠、左栏白字无蓝底（步骤卡隐形）、表单底部被裁（电池实测 Next Step 底 1037 > 卡底 824）；页内自愈恢复旧双栏基线（row/height auto/overflow visible——国家下拉菜单新增于重构后 hidden 会裁菜单，左/右栏补 border-radius 补齐失去的卡圆角裁切），不动共享 ethereal.css（补丁位 2→3·修复轮；2026-09-02）
// v0.2.7.0 = 注册第二页性别选择栏（用户「在第二项那边添加一个 性别选择栏，包含男/女/其他」）：显示名后第二项 Gender 下拉（Male/Female/Other 站点英文口径，同语言下拉模式：selector+menu+wc 图标+箭头翻转+外点收起），必填同四字段口径（* 红标+handleNext 拦截）；gender 存 saveUser 并回显（只存不回显是 v0.2.6.2 生日同款坑，一步到位）（小改动位 6→7·新功能轮·补丁清零；2026-09-02）
// v0.2.8.0 = 液态玻璃效果（用户「https://github.com/rdev/liquid-glass-react 这个react也安装一下」→问询钦定「移植效果到站点」）：rdev/liquid-glass-react 是 React 组件库、站点零 React——手译成纯 CSS+JS：liquid-glass.js 注入共享 SVG 滤镜 #lg-glass-filter（置换图折射+三通道色散 -70/-77/-84+边缘掩膜）+ .lg-backdrop 折射层/.lg-specular 高光层（均 pointer-events:none 不挡点击），rAF 逐帧 lerp 弹性跟随（rdev 公式：激活区 200px/弹性 0.15/方向缩放下限 0.8/高光阻尼 0.6），挂首页访客引导卡+FC 登录引导卡；prefers-reduced-motion 只留静态玻璃、无 JS 不挂 .lg-active 优雅降级（小改动位 7→8·新功能轮·补丁清零；2026-09-02）
// v0.2.13.0 = 会员年付轮（用户「能不能把单次付费改成年？」→两轮问询钦定：①「就是每年支付 不要提供单次付费」——全站无「单次」口吻，once 语义 = 每年支付 1 年 ②「送 2 个月，月价×10」③「年付的价格拆成 12 个月会显得比月付便宜」）：
//   后端——once 从「1 个月」改 1 年：subscriptions.js ONCE_MONTHS=12（checkout 落 pending 行 months=12 → applyPaid 到期顺延 12 个月；订阅月付行仍 1）、config 注释同步；Stripe 新建 80 个年付 one_time Price（15 币 ×5 SKU = calcYear 月价×10 重吸 .99/.00 尾数 + myr 5 个 legacy，nickname 带年付，metadata mn_term='year' 标记幂等）并停用旧「1 个月」once Price 80 个（metadata mn_mode='once' 无 mn_term 才停，年付不误伤）；STRIPE_CATALOG_B64 单 env 重编（sub 月付 ID 原样 + once 换年付 ID，tmp-year-catalog.js 只读查重组装）；测试 191/191（once 行/metadata months=12 + once webhook 到期顺延 355-370 天窗断言）
//   前端——premium.html 加 yP（1 年总价）/ymP（年总 ÷12 折合每月）双 literal（16 币 ×5 SKU，同币同文兜 usd，金额单一来源 tmp-price-gen.js calcYear/ymDisp）；卡片第二按钮「单次购买 · X · 1 个月」→「每年支付 · Y/年」（5 处静态标签 + setOnceBtn 动态同源），按钮下小字从「支持 XX，1 个月不自动续费」改「折合每月 Ym/月（月付 X/月）」——拆 12 个月看显便宜；plan-note（静态+refresh 双份）/renderUser 状态文案/全页注释去「单次购买 1 个月」口吻（terms/financial-terms/help 里认证标/Boost/捐款等真买断式增值项的「单次付费」法律财务口径不动）；FC 版本线不动（小改动位 12→13·新功能轮·补丁清零；2026-09-04）
// v0.2.12.0 = Stripe 多币种（用户「能不能提供更多货币？网页有多少种就添加多少种」→两轮问询钦定：①15 主流币 usd/eur/gbp/sgd/aud/cad/jpy/hkd/twd/thb/idr/vnd/php/krw/inr（金额=页面现 USD 价目换算，MYR 本地价 RM12 等不动）②「汇率低于马币以马币为准、高于美金以美金为准，尾 X.99/00」——弱币 {thb,idr,vnd,php,inr}（1 USD 换得比 MYR 多）按 MYR 价档、其余按 USD 价档；尾数 X.99/.00（零小数币整百/整千））：
//   后端 Price 服务端解析（前端传 price id 可伪造）——myr = legacy env Price（10 个 STRIPE_PRICE_* 原样）；usd+14 币 = STRIPE_CATALOG_B64 单 env（base64url JSON {currency:{tierKey:{sub,once}}}，避免 gcloud 逗号拆参），status?currency= 逐币回 prices/onceMethods、checkout 收 currency（非 myr 只允许 card——GrabPay 是马区方式（v0.2.13.1：fpx/支付宝实证账户不可用已去））、payments 行记 currency、webhook 幂等不变；已建 150 Price（15 币×5 SKU×sub/once，金额单一来源 tmp-price-gen.js calc，unit_amount 回显全验）；
//   前端同币同文——premium.html 100 行摆设表（~100 locale）→ 16 行真实扣款币价目（myr/usd 行逐字保留原 ms-MY/en-US）；pricing.js 100 行装饰串表 → 16 币 premium 列（data-slati-price 横幅显示实扣币），locale→币 chain 保留 + CC 映射到币（非 16 币 → usd 显示+扣款自洽）+ 补 en-SG/en-PH 漏检 + 欧元区主时区兜底（原链漏西/意/荷 → 误落 usd）；premium 页静态文案 RM12 硬编码（matrix/plan-note/renderGuest）全部动态化 p.basic、startCheckout/status 请求带 ?currency=、plan-note 单次方式按 status 真实 onceMethods 回写；测试 191/191（+3 多币种：status 逐币/checkout eur 卡片与行 currency/unknown 币 400）（小改动位 11→12·新功能轮·补丁清零；2026-09-04）
// v0.2.11.1 = Community 搜索胶囊 UI 适配（用户「那个Community 页面的顶部的输入框的Ui能不能做适配」→问询钦定「就只是Ui适配 和手机无关」）：按站点 .input-glass 语言适配——常态底 --input-bg（此前常驻 focus 底）、描边改 --color-outline-variant；悬停品牌蓝描边 rgba(70,72,212,0.45)+底提亮；聚焦品牌蓝描边+0.1 蓝环+底提亮+放大镜图标转品牌蓝；transition all 0.2s 与 .input-glass 同款；胶囊形状/宽度/手机不动、零共享文件（补丁位 0→1·观感微调轮；2026-09-03）
// v0.2.11.0 = 后端用户性别记录 + 用户资料单独显示（用户「在后端做一下用户性别的记录，然后在用户资料里也单独显示」+「不要把信息只做localStorage」）：性别此前只存前端 localStorage（注册第二页 v0.2.7.0 下拉，handleNext 零 API 调用）——迁移 013 users 加 gender 列（Male/Female/Other 路由层校验同 dob 模式，旧用户 NULL=未填写）、PATCH /me 接受 gender + publicUser 返回 gender（/me 权威回读不丢）+ profile_update 审计 next 含 gender、staff 详情 maskUserRow 返回 gender；前端 storage.js mirrorProfile 同步列表加 gender（saveUser 自动镜像后端）、settings Profile 区新增 Gender 单独一行只读展示（未填写 —）、admin 用户详情基本信息加性别行；测试 188/188（+013 迁移断言 + PATCH gender 合法/非法/审计断言）（小改动位 10→11·新功能轮·补丁清零；2026-09-03）
// v0.2.10.0 = Announcements 邻近上浮（用户「平台首页下方的那个Announcements 的每一项增加一个特性就是当鼠标靠近时在范围内的都会上浮」）：首页公告列表每项按与光标的距离上浮——光标在左侧列内移动时 ≤240px 范围内的项 translateY 上浮（最近项 10px、二次缓降 t²、越近越高），范围外归零、移出列重置、rect 缓存滚动/缩放失效、reduced-motion 跳过；页内样式块常驻 transform 过渡 0.18s（.card-hover:hover 的 transition 只悬停时存在，邻近项不悬停会瞬移）；首页 inline 渲染后挂监听，零共享文件改动（小改动位 9→10·新功能轮·补丁清零；2026-09-03）
// v0.2.9.3 = 侧栏滚动条隐藏（用户「把左侧根菜单的上下滑轨隐藏」）：.nav-module scrollbar-width:none + -ms-overflow-style:none + ::-webkit-scrollbar display:none（滚动功能保留只藏滑轨，置后压过 custom-scrollbar 类）；电池新增 A7 断言（补丁位 2→3·修复轮；2026-09-03）
// v0.2.9.2 = 左侧菜单空位修复（用户「左侧根菜单位置不是在他的卡片的上方…空出很多空位要向下滑才能看见菜单」）：真身=nav-module 玻璃层 position:sticky 在流内占整段高度（实测菜单项 t=1277 vs 卡片顶 t=258，两张层各占 503px 把菜单顶出 2 倍卡片高）→ 层改 absolute 出流+nav-module.lg-static 补 position:relative 建包含块（零视觉位移）；电池新增 A6 回归断言（补丁位 1→2·修复轮；2026-09-03）
// v0.2.9.1 = 撤销轮（用户「算了把前面要求要改的东西都撤销掉」+「除液态玻璃外全部还原」+「Q弹很丑」）：弹性/跟手全部下线（liquid-glass.js 全静态零监听零 transform 写）、挂载态 blanket（position:relative/z-index:0/backdrop-filter:none）整体删除——面自身定位/层级/模糊恢复原本规则、门控/亮环选择器 .lg-active→.lg-static（补丁位 0→1·修复轮；2026-09-03）
// v0.2.9.0 = 全站液态玻璃 v2（用户「那么把全部旧的液态玻璃换成新的这个液态玻璃react」→问询钦定：①全站所有磨砂玻璃面 ②卡片弹性、大面板静态）：liquid-glass.js v2 重写为全站玻璃引擎——双 SVG 滤镜（大面 #lg-glass-filter scale 70 + 小卡 #lg-glass-filter-sm scale 35，feDisplacementMap scale 是 px 单位 -70 在小卡上会暴烈）、静态图（侧栏/登录卡/弹窗/工具栏/面板——只玻璃不跟手，零 rAF 零 transform 写保面板自身动画）+ 弹性图（卡片/hero——鼠标弹性形变+高光跟随）、公开 window.LG={apply,remove,scan} 供编辑器动态卡挂载、层改挂 z:-1 垫父半透明底之上内容之下（父建层叠上下文）、父面旧模糊平移+饱和到层（各面配方：card 6px rdev 原版/modal 24/sidebar 14/mre 32 等）防双层叠加、透明度微调（--modal-bg 0.85→0.72、暗色卡实心→半透明 0.55 真玻璃）、transition 守卫（transitions.js 每卡永久 inline transition 惰性追加 transform 0s+点击解守卫保出场动画）、编辑器卡创建钩子+CSS 门控（组内成员/主题卡/非玻璃族层藏起——成员自身 backdrop-filter:none 管不到注入层，漏门即回归 9-02「独立背景」投诉）、rect 缓存 300ms+isConnected 剪枝、reduced-motion 全静；脚本全站 41 页统一挂载（小改动位 8→9·新功能轮·补丁清零；2026-09-02）
// v0.2.13.1 = 支付方式实证修正轮（用户「那个Stripe 的支付方式没办法增加其他的方式了吗」→「例如 tng, samsung pay, google pay」→问询钦定「先做 Stripe 全开」）：
//   账户侧——PaymentMethodConfigurations 逐方式 available 字段探活：MY 账户真可用 = card/grabpay/apple_pay/google_pay/link；
//   grabpay/google_pay 原 ⚪off → display_preference=on 已真开（grabpay 会话 200 实证、google_pay available:true 随卡自动上结账页）；
//   fpx/alipay available:false 账户级不可用——display_preference=on 也 400「activated in your dashboard」（会话实测），任何开关都开不了（要 Stripe 开通或换本地 PSP）；TnG/Samsung Pay 非 Stripe MY 产品
//   活线 bug——默认 oncePaymentMethods 含 fpx/alipay → 每次 MYR 每年支付 checkout 都 400 全死（v0.2.13.0 年付马区从没建成过会话，电池/curl 探不到因为从不建真会话）：默认去 fpx/alipay 改 card,grabpay、
//   订阅保持 card；premium 页静态/动态 plan-note + 回退清单 + 注释同口径（Apple/Google Pay 随卡自动无需列清单）；测试同步（订阅只卡/once card+grabpay 形状断言）
//   文案清扫——help FAQ「支付方式/货币」、financial-terms 支付渠道与手续费、platform-responsibility 第三方服务、terms 依赖、privacy 两处「Stripe / FPX」→ 一律 Stripe（不再声称可用 FPX）；GrabPay 推荐替代 FPX 网银（补丁位 0→1·修复轮；2026-09-04）
// v0.2.14.0 = Community 发帖输入栏自适长（用户「Recommend 顶部的输入栏不可以手动调整长度，只会根据文字长度慢慢变长，设一个 Max 值长到那边就停止，之后只能滚轮上下滑动」）：postComposer 从 resize:vertical（右下角可手拽）改 resize:none 不可手拽 + overflow-y:auto + max-height:240px；input 监听自适长——height:auto 后取 scrollHeight+2 与 240 取小（max 单一来源读 computed max-height，改 CSS 即改封顶），封顶后滚轮在框内滑；发布成功立即 height:auto 回缩（重渲染前防闪高框）；renderFeed 每次重渲染后重挂监听（innerHTML 换新框）；零共享文件改动（小改动位 13→14·观感微调轮·补丁清零；2026-09-04）
// v0.2.14.1 = Community 发帖输入栏边框主题适配（用户「那个输入框的边缘颜色能不能调一下啊，他和平台主题不相干啊」）：postComposer 原 border:1px solid var(--color-outline)（强灰 #767586）+透明底 与平台输入语言无关 → 页内 #postComposer 规则按 .input-glass/.search-capsule 口径适配——常态底 --input-bg、描边 --color-outline-variant；悬停品牌蓝描边 rgba(70,72,212,0.45)+底提亮；聚焦品牌蓝描边+0.1 蓝环+底提亮；placeholder 同款淡灰；形状（radius-md/自适长 240 封顶）不动；transition 不含 height（自适长逐字驱动，动画化会拖泥带水）；零共享文件改动（补丁位 0→1·观感微调轮；2026-09-04）
// v0.2.14.2 = Community 发帖按钮文案（用户「然后把Publish 改成 Post」）：composerHtml 的 postSubmit 按钮 Publish → Post；零共享文件改动（补丁位 1→2·口吻微调轮；2026-09-04）
// v0.2.15.0 = Community 发帖工具条五按钮（用户「在Post按钮的同一行上添加 上传图片，GIF，投票，表情符号和创办活动，全部采用icon显示只有滑鼠停留在icon上才显示名称」）：composer 底行改 .composer-actions（space-between）——左 .composer-tools 五工具 icon 按钮（上传图片 image/GIF gif/投票 poll/表情符号 sentiment_satisfied/创办活动 event，material-symbols-outlined 图标），右 Post 不动；纯图标显示（名称不入行内文字），名称只在鼠标悬停 icon 时气泡显示（data-tip → .composer-tool:hover::after content:attr(data-tip)，零 JS，倒置配色 on-surface 底/surface 字 + shadow-sm + z30，悬停气泡悬停不断——::after 是按钮后代，悬停其上按钮 :hover 依旧）；点击如实 toast「XX功能即将上线」（house 口径：未上线功能不装死）；工具绑定随 renderFeed 重渲染重挂；零共享文件改动（小改动位 14→15·新功能轮·补丁清零；2026-09-04）
// v0.2.15.1 = Community 发帖工具条 icon 放大（用户「这个icon能不能大一些」）：.composer-tool 钮 34→38px（24px 图标标准触控尺寸；探针实测 Post 钮高 27px 非 38，两钮 flex 中心对齐）+ 图标 20→24px；零共享文件改动（补丁位 0→1·观感微调轮；2026-09-04）
// v0.2.15.2 = Community 发帖 Post 钮放大（用户「post 按钮也放大一些」）：页内 #postSubmit 字号 12→14px + 纵向 padding 6→12px + line-height 1（单行标签安全）＝ 38px 与放大后的工具钮等高（不动共享 .btn-sm——全站其它页钮不受影响）；零共享文件改动（补丁位 1→2·观感微调轮；2026-09-04）
// v0.2.15.3 = Community 发帖输入框去边框+中文轮播（用户「把输入框的边缘移除」+「输入框默认显示（有什么好事？/有什么新消息？/同志有什么新消息要分享分享？/贵国有什么新闻吗？）」）：页内 #postComposer 撤销 v0.2.14.1 主题描边——去描边去蓝环只留底（常态 --input-bg、悬停/聚焦底提亮）；placeholder 四句中文轮播 3.5s 一换（重渲染按 id 现取元素不断档、已有内容不动）；零共享文件改动（补丁位 2→3·观感微调轮；2026-09-04）
// v0.2.15.4 = Community 发帖工具 icon 悬停变大浮出动画（用户「icon 在滑鼠停留的时候有一个变大浮出的动画」）：.composer-tool 悬停只放大 icon（scale 1.25 + 上浮 2px、0.2s 过渡；钮本身不动——气泡 ::after 挂在钮上，钮缩放会把气泡文字一起放大）+ reduced-motion 关动画；零共享文件改动（补丁位 3→4·观感微调轮；2026-09-04）
// v0.2.15.5 = Community 发帖工具 icon 悬停放大保粗修复（用户「为什么放大icon就从粗体变成细的了」）：v0.2.15.4 的 transform:scale(1.25) 禁用像素网格对齐（hinting）致字形变细——改动画 font-size 24→30px（同为 1.25 倍，每帧重新排版+对齐保粗壮）+上浮改 margin-top -2px（不碰 transform）；零共享文件改动（补丁位 4→5·修复轮；2026-09-04）
// v0.2.15.6 = Community 发帖工具 icon 名称气泡 5 秒延迟+白底黑字（用户「那个icon的名称能不能是鼠标停留5秒后才显示啊？还有配色能不能是白底黑字啊」）：气泡基础规则 .composer-tool::after（content:attr(data-tip)+白底 #fff 黑字 #000+细边框+pointer-events:none+默认透明隐藏），hover 只覆盖 opacity/visibility + transition-delay 5s（停留满 5 秒淡入、移开 0.15s 淡出后立刻 hidden 防挡点击）；零共享文件改动（补丁位 5→6·观感微调轮；2026-09-05）
// v0.2.15.7 = Community 发帖输入框 placeholder 轮播改纯 CSS 动画（用户「那个输入框显示的文字的切换只有在刷新页面时会随机变化」）：探针实证 JS setInterval 轮播在线真实路径（真帖+60s 自动刷新+打字清空+切 tab）照常 3.5s 走动——用户症状=浏览器省电/后台节流冻 JS 计时器（走一段就停、刷新又随机重来）；改 .ph-rotator 覆盖层四句叠格 + phSpin 14s 每句 3.5s（正 delay 0/3.5/7/10.5s 分窗插入即从句 1 开始、窗口边缘 0.3s 交叉淡入淡出、pointer-events:none）+ 原生 placeholder 清空防双层字 + 打字 has-text 藏层清空复显 + reduced-motion 静态句 1（合成器驱动不受节流）；零共享文件改动（补丁位 6→7·修复轮；2026-09-05）
// v0.2.15.8 = Community 发帖输入框 placeholder 改 30 分钟一档切换（用户「算了你把他改成每隔30分钟切换一次文本」）：撤销 v0.2.15.7 纯 CSS 轮播（.ph-rotator/phSpin 全删）——改原生 placeholder 属性 + 30 分钟一档按墙钟取句（floor(Date.now()/30min)%4，整点/半点对齐全球同档），renderFeed 每次重渲染现算（60s 云刷新自动推进）+ 边界定时器正点免刷新切换 + visibilitychange 回前台兜底，不依赖任何动画/高频计时；零共享文件改动（补丁位 7→8·观感微调轮；2026-09-05）
// v0.2.16.0 = Community 帖子多图/视频（用户「Post 会展示该post的多个图片/视频，你把功能做一下我后面再上传一个图片」）：
//   后端——迁移 014 uploads 表；POST /api/social/uploads 二进制上传端点（ext 白名单 jpg/jpeg/png/gif/webp/mp4/webm/mov + 魔数嗅探防伪装 + 图片 ≤10MB/视频 ≤30MB + 限流 20/10min + GCS FUSE /mnt/data/uploads 落盘）；posts.media 收紧为本站 /uploads/ 白名单正则；
//   媒体帖状态反转——只有「IMS 已配置且首图为图片」才 pending 先审后发，否则（IMS 未配置/首图为视频）visible 先发后审 + queued（旧版媒体帖永远 pending 不上线 = 功能等于没做，本轮修复）；image.js 加本地文件分支；entrypoint.js /uploads/ 静态分支（单段 Range/ETag/immutable + mp4/webm/mov MIME）；
//   前端——帖子卡媒体网格 .pm-1/.pm-2/.pm-3（img/video 混排，object-fit:cover）+ 灯箱（createElement 构建，×/backdrop/Escape 关、多张左右箭头翻页）+ composer 上传图片/GIF 钮接真上传（隐藏 file input + 客户端预检 + 待传缩略图 × 可移除 + 发布随帖携带）+ 卡片用户内容全量 escapeHtml（顺手修存量存储型 XSS）（小改动位 15→16·新功能轮·补丁清零；2026-09-05）
// v0.2.17.0 = Community 头像/点赞/评论 + 独立帖子页（用户「那个为什么没有头像，然后点赞按钮没有功能，评论也是，然后我希望做成点击帖子查看评论就是和Twitter一样的那种」→问询钦定「独立帖子页」非弹窗）：
//   后端（social.js 单文件）——postRow 加 likeCount/commentCount/likedByMe + 可选鉴权 optionalViewer（裸查 user_sessions JOIN users，绝不复用 authenticate——那会抛 401 还记 activity 污染 DAU，测试钉死零 activity 行）；GET /posts/:id（404 门控）；POST/DELETE /posts/:id/like（INSERT OR IGNORE 自然主键幂等开关）；GET /posts/:id/comments（仅 visible、ASC、LIMIT 200、本轮不分页）；POST /posts/:id/comments（1-2000 校验、一层回复校验、禁言/限频/去重换表自写 SQL 同帖口径、L0 先发后审同帖口径、CMT- id）；无新迁移 health 58 不变；
//   前端 hub——拆地雷：v0.2.16.0 媒体/灯箱样式段移出 ethereal 内联标记块（原在块内 inline-css.js 刷新会整块替换洗掉，已实锤）另开无标记块；帖子卡真头像 + 点赞胶囊钮（乐观更新/失败回滚，不重渲染 feed 防滚动跳动）+ 整卡点击跳独立帖页（按钮内/文字选区不跳）+ 瓦片 stopPropagation；评论数点按冒泡进帖页；
//   新页 docs/pages/community-post.html（自包含，头部复用 hub 同源：主题防闪+纯 ethereal 标记块+字体块；帖页样式另开无标记块）——返回链/404 态/全文不截断/头像/媒体网格+灯箱/点赞/评论区（顶层+缩进回复+回复钮+replyChip）/评论提交（removed 拦截 toast、hold 待审核 toast、成功追加）/访客门控（藏 composer 显 guestPrompt，next=帖页自身回跳）；测试 200→212/212（小改动位 16→17·新功能轮·补丁清零；2026-09-05）
// v0.2.18.0 = Community 转发 + 分享（用户「能不能在帖子的评论后面那边再添加转发按钮和分享按钮？」→问询钦定「真转发」Twitter 式——转发创建新帖引用原帖、上信息流带「转发了」徽章、可附转发语、他人可点赞/评论转发帖；分享=复制帖子链接，移动端调系统分享面板）：
//   后端（social.js 单文件 + 迁移 015）——posts.repost_of 加列+索引（无新表 health 58 不变，user_version 14→15）；postRow 加 repostOfId/repostOf（浅嵌一层不递归：原帖存在且 visible 才嵌否则 null）/repostCount/repostedByMe（任意状态 EXISTS——removed 行点按=撤销与点赞开关同感，避免「L0 拒了的转发行残留→按钮显示未转发→再点 409」死胡同）；POST/DELETE /posts/:id/repost（转发即发帖：共享发帖配额 pw:user: 同预算同 key、新号频控同发帖、同帖一次 (repost_of,author_id) 守卫 409 CONFLICT、转发语可选 0-2000 空串=裸转发、刻意跳过 sha1 去重——空串哈希撞车+短转发语高频误伤、原帖 visible 门控 404、L0 仅非空转发语同帖口径）；测试 212→227/227；
//   前端 hub——cloudPostItem 带 repostOfId 徽章换「转发了」（复用 badge-success 绿徽章零新 CSS）+ 卡片转发语 title 条件渲染（裸转发无空 h4）+ .repost-embedded 嵌入原帖盒（头像/作者/相对时间/正文截 200 字/媒体网格，原帖不可见→「原帖已删除或不可见」占位）+ repostEmbeddedHtml 与帖页同构；灯箱绑定按 .post-media 全量查询自动覆盖内嵌媒体、整卡点击走既有 data-cloud-id 零新绑定；
//   帖页（tail 改+重建）——renderPost 转发分支（.repost-line repeat 图标+头像+「XX 转发了」+转发语+嵌入盒）+ 操作行追加转发钮（repeat 图标+计数、reposted 高亮绿 #16a34a、乐观切换+失败回滚、再点=撤销）+ 分享钮（ios_share）；转发对话框（灯箱模态+自己的 Escape 监听不复用 lbEscape 防误关灯箱+textarea autogrow+removed 拦截/hold 待审核/409 同步置位/401/429 分支 toast）；分享链 navigator.share→clipboard.writeText→textarea+execCommand 三级兜底（访客可用无门禁、URL 从 location 自身拼绝不硬编码）（小改动位 17→18·新功能轮·补丁清零；2026-09-05）
// v0.2.18.1 = Community 点赞实心+动画（用户「那个点赞后能不能变成实心和有一个动画」（附了 like/dislike 参考代码）→「只是要动画而已 一样是用爱心不要换」——爱心图标不换，只要实心+动画）：
//   hub + 帖页点赞钮（同构改动）——点赞瞬间：爱心 favorite_border→favorite 实心（原有）+ 图标弹跳动画 like-pop-icon（scale 0.2 旋转 -35° → 弹到 1 带回弹，0.45s springy 缓动）+ 心形配色粒子迸发 like-burst-fly（单个 6px 圆点 + 24 条 box-shadow 彩点 pinks/reds/purple/gold 径向炸开 0.6s 淡出——参考代码 fireworks 技法的按钮尺寸缩小版，零额外节点）；动画挂一次性类 like-pop（JS 点赞瞬间加、animationend/950ms 兜底定时器摘）——60s 重渲染/已点赞卡片默认渲染不带类不重播；取消点赞/失败回滚同步摘类；reduced-motion 关动画只换实心；
//   零共享文件改动（CSS 进 hub 无标记块经 shared head 自动流入重建后的帖页；帖页 tail 改+重建）（补丁位 0→1·观感微调轮；2026-09-05）
// v0.2.18.2 = Community hub 假爱心修复（用户「没有变实心啊」——线上探针实锤：登录态推荐流 = 真帖+演示卡混排（5 卡 = 1 真 + 3 假），演示卡爱心是 span 摆设点了没反应）：
//   hub renderFeed——云模式推荐流只显真帖（cloudPosts 不再 concat 演示项，空态补「这里还没有帖子」提示卡）；演示卡爱心 span→button + data-guest-like 点击 toast「登录后才能点赞」（与帖页访客口径一致，不再装死；绑定挂云模式块外未登录 demo 模式也生效）；零共享文件零后端零新 CSS（补丁位 1→2·修复轮；2026-09-05）
// v0.2.18.3 = Community 点赞粒子特效完整照搬参考代码（用户「而且你特效也没超好啊，而且粒子效果别改颜色啊还有能不能照着搬啊，只是把完整的粒子特效搬出来」——v0.2.18.1 自创的 24 粒子小改版不合格，要参考代码的完整原版粒子）：
//   hub CSS（经 shared head 自动流入重建后的帖页）——粒子改参考原版：单个 10px 圆点 + 61 条 box-shadow 彩点（色环逐字照搬参考代码不改一色）+ 三动画链照参考原版时长（1.25s mn-fireworks-bang ease-out 迸发 → 1.25s mn-fireworks-gravity ease-in 下落 translateY(200px) → 6.25s mn-fireworks-position linear 游走 5 档 margin 窗口）；scale(0.4) 并入 gravity 终点（单元素免 wrapper，与参考 .fireworks 外壳视觉效果一致）；like-pop-icon 改参考值（0.5s ease-out、0% scale(0) 50% scale(1.2) rotate(-10deg)）；
//   armLikePop（hub + 帖页 tail 同改）——like-pop 摘类改等最后一档动画（mn-fireworks-position 6.25s）animationend 才摘 + 6.8s 兜底（旧版 950ms 摘类粒子没飞完就没了）；零共享文件零后端（补丁位 2→3·口径修正轮；2026-09-05）
// v0.2.19.0 = Community hub 转发/分享按钮 + 分享弹窗 + 点赞粒子中心对齐（用户「转发啊 分享 在外面都没有」「分享按钮是弹出弹窗然后也同时复制帖子链接」「点击后它的中心和点赞按钮的中心位置不一致」）：
//   粒子对齐——照参考 .fireworks 外壳结构重构：.like-burst 改 0×0 定位锚（left/top 50% = 按钮正中心；旧版 right:40px 锚在计数那边就偏了）+ 常量 transform:scale(0.4)（参考外壳恒缩放，粒子整链恒定 0.4 倍不再随 gravity 从 1 缩到 0.4）；61 粒子搬到子元素 .like-fx（10px 圆点 + 61 条 box-shadow 色环逐字不动），三动画链挂子元素照参考原版时长；gravity 恢复参考原值 translateY(200px) 不带 scale；position 5 档 margin 窗口对 0×0 外壳解析恒为 0（与参考同为惰性动画）；.like-fx 的 animationend 冒泡到 .like-burst——armLikePop 摘类时机零改动（最后一档 6.25s + 6.8s 兜底）；
//   hub 卡片操作行——真卡补转发钮（repeat+计数+reposted 绿高亮、toggleRepost/openRepostDialog/setReposted 照帖页同构、乐观切换+失败回滚+409 同步置位+removed/hold/401/429 分支）+ 分享钮；演示卡补同款钮（真按钮 + toast「登录后才能转发/分享」与爱心同口径不装死）；
//   分享——hub + 帖页同改弹窗（modal-backdrop/modal-card 模板、只读 URL 输入框点击全选、打开即自动复制「已复制，可直接粘贴」状态、复制链接重试钮、Escape/backdrop/关闭三路关、URL 从本页 location 相对解析绝不硬编码、访客可用无门禁——替代旧三级链 navigator.share→clipboard→execCommand，clipboard→execCommand 降级链保留）；爱心实心=既有 favorite/favorite_border 切换（hub+帖页两处同构，电池直验）；零后端零共享文件（CSS 经 shared head 自动流入重建后的帖页；帖页 tail 改+重建）（小改动位 18→19·新功能轮·补丁清零；2026-09-06）
// v0.2.19.1 = Community 转发免弹窗直转 + 分享弹窗全场景（用户「为什么分享按钮点击后没有弹窗」「转发的话不需要弹窗啊，它就只是在用户主页那边转发给粉丝看这样的功能而已」）：
//   转发——hub + 帖页删除转发对话框（openRepostDialog 整体移除），点击转发钮直接裸转发（空转发语）发到主页、再点撤销；乐观置位 + 失败回滚 + 409 同步置位 + removed 拦截回滚/hold 待审核 + 401/429 分支照旧；toast 改「已转发到你的主页（，待审核）」；撤销成功补 toast「已取消转发」；
//   分享——演示卡（访客 demo 模式）分享从只 toast 改为也弹分享弹窗（用户实测「点击后没有弹窗」根因即此：v0.2.19.0 演示卡分享只有 toast「登录后才能分享」），复制本社区页链接 + 标题「分享社区」；openShareDialog 加 title 可选参；真卡与帖页弹窗逻辑不变；零后端零共享文件（补丁位 0→1·口径修正轮；2026-09-06）
// v0.2.19.2 = Community 分享弹窗隐形修复 + 分享钮纯图标（用户「分享按钮的icon改成 Upload的icon 然后把旁边分享的按钮去掉」+「点击后依旧只是变模糊没有出现显示链接以复制的弹窗」）：
//   弹窗隐形根因实锤——模态系统 .modal-card 默认 opacity:0（scale(0.95)），必须同时挂 .active（transform:scale(1)+opacity:1+pointer-events:auto）；openShareDialog 只挂了 backdrop.active → 背景变模糊但卡片隐形（还盖在页面中央挡掉点赞等点击——「点赞后爱心没变实心」同源：点击被隐形卡片吞掉）；hub+帖页两处 openShareDialog 补 card.classList.add('active')；
//   分享钮——icon ios_share → upload（用户钦定）+ 去掉「分享」文字（与点赞/转发同口径纯图标钮，title="分享" 保留）；hub 真卡+演示卡+帖页三处同改；零后端零共享文件（帖页 tail 改+重建）（补丁位 1→2·修复轮；2026-09-06）
// v0.2.19.3 = Community 操作行四钮放大+间距拉开（用户「把那四个按钮的间距拉开些然后他们的大小放大些方便被点击」）：
//   .post-action-btn padding 4×10 → 8×14 + min-height:38px + gap 4→6px；操作行容器 gap 12→16px；
//   图标放大：真卡三钮 16→20px、演示卡/评论计数 14→18px；评论计数 span 改挂 post-action-btn-static 同尺寸口径；
//   hub+帖页同改（tail 改+重建）；零后端零共享文件（补丁位 2→3·观感微调轮；2026-09-06）
// v0.2.20.4 = Community 操作行星+分享再靠拢 4px + 部署丢点赞修复（用户「再靠近4px, 然后为什么每次你更新完后我之前点赞过就会消失」）：
//   ①星钮 margin-right:-18px → -22px——星↔分享间隙 -2px → -6px（按钮盒重叠 6px、图标更贴；margin-left:auto 保留星组仍贴行右缘；真/演示卡+帖页三处同改）；
//   ②丢点赞根因=部署瞬间新旧实例并存：新实例冷启动恢复的是旧实例上一次定时快照，旧实例 SIGTERM 临终快照晚 ~6s 落地无人再读→最后 ≤interval 的写入丢进修剪链（快照实证：旧快照 like@15:51:44 vs 新快照 like@15:54:49=用户重赞）；
//   修复=entrypoint catch-up 追恢复：启动后 +75s/+150s 两次复查桶内其他 bootId 快照，mtime 晚于启动恢复那份且本实例零写入（写计数守卫防覆盖新操作）→ATTACH 整表并回活库（57 表除 audit_log append-only；FK 临时关+foreign_key_check 校验；合并逻辑单机验证 12/12）+定时快照 60s→15s 收窄启动恢复陈旧度；
//   （补丁位 3→4·修复轮；2026-09-07）
// v0.2.20.3 = Community 操作行星+分享再靠拢 8px（用户「让他更近8px」）：星钮 margin-right:-10px → -18px——星↔分享间隙 6px → -2px（按钮盒重叠 2px、图标更贴；margin-left:auto 保留星组仍贴行右缘；真/演示卡+帖页三处同改）；零后端零共享文件（tail 改+重建）（补丁位 2→3·观感微调轮；2026-09-06）
// v0.2.20.2 = Community 操作行星+分享间距靠拢（用户「这个收藏和分享两个按钮的间距可以靠近些吗」）：星钮 margin-right:-10px 把星↔分享间隙从容器 gap 16px 收到 6px（margin-left:auto 保留星组仍贴行右缘、分享右缘=行右缘不动；真/演示卡+帖页三处同改）；零后端零共享文件（tail 改+重建）（补丁位 1→2·观感微调轮；2026-09-06）
// v0.2.20.1 = Community 操作行星+分享顶到最右缘（用户「我是说放到最右边不是这样」）：v0.2.20.0 星/分享虽在行尾但仍左对齐挤在浏览量旁——星钮加 margin-left:auto 把星+分享推贴卡片行右缘（真/演示卡+帖页三处同改；行序不变 [赞][评][转][浏览]...[☆][⇧分享]）；零后端零共享文件（tail 改+重建）（补丁位 0→1·口径修正轮；2026-09-06）
// v0.2.20.0 = Community 操作行浏览量+收藏星（用户「把分享按钮的位置换成浏览量然后 把分享按钮放到最右边然后它的左侧再放一个星星作为收藏按钮 两个都不需要显示号码」）：
//   行序重排 [赞][评][转][浏览][☆收藏][⇧分享]——浏览量替代旧分享位、星收藏+分享置最右、两个都不显示号码；
//   浏览量——后端迁移 016 posts.view_count 列 + GET /posts/:id 每开一次 +1（postRow 随行 viewCount；feed 同步带出）；前端 visibility 图标静态展示（hub 真/演示卡 + 帖页）；
//   收藏——后端 POST/DELETE /posts/:id/favorite 真开关（005 已有 favorites 表 target_type='post' 零新表；requireSession+writeLimit+可见性 404+INSERT OR IGNORE / DELETE 幂等，postRow 随行 favoritedByMe）；前端星钮 star↔star_border 切换+金色 .favorited 高亮+FILL 轴实心（乐观更新+失败回滚+访客 toast「登录后才能收藏」）；
//   hub+帖页同改（tail 改+重建）；测试 227→233/233（social-favorites 5 测+migrations/health user_version 15→16 五处）+电池 56/56 本地+18/18 线上+冒烟 49/49+curl 八连+health 58，rev 00094-nj9（小改动位 19→20·新功能轮·补丁清零；2026-09-06）
// v0.2.21.0 = Community 个人主页 + 关注系统（用户「先把用户的个人主页做一下吧？」——问询钦定完整版 Twitter 式主页 + 关注一起做 + 三入口）：
//   后端——迁移 017 following.users 显示名→id 引用（一期按显示名存储，主页上线兑现 005 承诺：映射到 active 用户的替换为 id 同名取最早注册、映射不到删行、先删后改绝不落 NULL）+ idx_following_target 粉丝反查索引（无新表 health 58 不变，user_version 16→17）；social.js 四新端点——GET /users/:id（公开+optionalViewer：displayName/avatarUrl/bio/gender/citizenId/createdAt/isSelf/followedByMe/followerCount/followingCount/stats 四计数）、GET /users/:id/posts?tab=posts|reposts|likes|favorites（复用 postRow、likes/favorites 按互动时间倒序、bogus tab 400）、POST/DELETE /users/:id/follow（幂等开关、自关 400、目标必须 active 404、requireSession+writeLimit）；PUT /following users 只收 /^USR-\d{6}$/（遗留显示名静默丢弃防 storage.js mergeFollowing 回流）；commentRow 加 authorId（additive 铺路）；
//   前端——新页 docs/pages/community-profile.html（build 脚本 tmp-build-community-profile.js + tail，head 复用 hub 同源）：头部卡（头像 72px/名字/@citizenId/性别章/简介/加入时间）+统计行（帖子/转发/点赞/收藏 点击跳 tab）+「N 粉丝 · M 关注」+4 tab 药丸+卡片列表（hub 同款全操作行+灯箱+空态文案）；isSelf →「编辑资料」钮开 SlatiSettings 弹窗（轮询 backdrop 消失后重拉）；访客点关注 toast「登录后才能关注」零请求；toggleFollow 乐观+401/429 回滚；不写 localStorage；
//   三入口——hub renderFeed 作者行头像+名字包 .post-author-link → community-profile.html?id=（cloudPostItem 带 authorId、整卡点击守卫加 closest('a')）；帖页 tail 作者行同改（tail 改+重建）；侧栏用户模块头像+名字包锚（USR- 门控，访客/演示不动）；测试 233→252/252（social-profile 15 测+migrations 017 数据迁移测+social.test.js following 改 id 语义）；
//   （小改动位 20→21·新功能轮·补丁清零；2026-09-07）
// v0.2.22.0 = Community 个人主页「编辑资料」独立弹窗（用户「我希望那个个人页面的简介那边的编辑资料是独立的而不是使用设置的」）：
//   主页编辑资料不再开设置弹窗——独立弹窗（头像上传+显示名+性别药丸+简介）；保存走 PATCH /api/auth/me 真后端持久化
//   （设置弹窗资料区只写 localStorage 的历史口径，主页是公开门面必须落库）；头像直传复用 /social/uploads
//   （二进制直传+客户端预检 jpg/png/gif/webp ≤10MB）；保存后头部真后端重拉+侧栏同页即时更新（sidebar.js 无公开重渲染 API，直接改同页 DOM）；
//   本页零 localStorage——saveUser 会触发 storage.js mirrorProfile 二次全字段 PATCH（含语言/国家/生日陈旧值回流风险，
//   电池 E1 双 PATCH 实证后移除），localStorage 由下页 cloudMerge 拉 /auth/me 权威覆盖；零后端零共享文件；测试 252/252
//   +电池 39/39 本地（G3 独立弹窗 card+backdrop 计算 opacity=1+不开设置弹窗+Escape 关/E 组保存链 body 精确+头像
//   CDP 直传+空名拦截+401 回滚+无改动直关+单次写入守卫）+14/14 线上（L2 非本人无编辑资料钮）+冒烟 49/49+
//   curl 四连（health 58+版本 v0.2.22.0+PATCH/uploads 无 cookie 401×2）+部署一次 exit 0；
//   （小改动位 21→22·新功能轮·补丁清零；2026-09-07）
// v0.2.22.1 = Community 主页性别 男/女 → 图标（用户「能不能把男女换成新添加进image文件内的那两个svg」）：头部性别徽章 + 编辑弹窗性别药丸
//   改用用户新加到 docs/assets/image/ 的两个 Material 图标（♂ 蓝 #7CA7D8 / ♀ 粉 #F18AFF，img 引用真文件）；Other 无图标保持文字「其他」；
//   图标带 alt/title（男/女）兜可读性与悬停提示；药丸加弹性盒居中 + min 52×38px 点按尺寸；零后端零共享文件（tail 改+重建）；
//   （补丁位 0→1·观感微调轮；2026-09-07）
// v0.2.22.2 = Community 主页头部横排（用户「然后我希望把名称和id和性别的位置调到头像的右侧」）：头像左 + 右侧信息列（h2 名字 +
//   @公民号 + 性别徽章竖排）Twitter 式横排——.profile-top 弹性盒 align-items:center + gap var(--space-md)、头像 flex:none 防压缩、
//   信息列 flex:1 竖排居中；bio/加入时间/统计仍全宽在下；零后端零共享文件（tail 改+重建）；
//   （补丁位 1→2·观感微调轮；2026-09-07）
// v0.2.22.3 = Community 主页 粉丝/关注 → 头部最右边 + 获赞量（用户「然后把粉丝关注一样放到右侧但是是最右边，然后再添加一个获赞量」）：
//   .profile-counts 移入 .profile-top 行最右（信息列 flex:1 推贴行右缘）；统计区四块 → 五块加「获赞」纯展示块
//   （无对应 tab 不可点，.profile-stat-static）；后端 GET /api/social/users/:id stats 加 likeReceivedCount
//   （本人可见帖收到赞的 JOIN 聚合，无迁移无新表）；social-profile 测试 stats 断言同步两处；
//   （补丁位 2→3·观感微调轮；2026-09-07）
// v0.2.22.4 = Community 主页 获赞量 → 与粉丝/关注并排（用户「获赞是和粉丝关注并排的」）：获赞从统计区五块移出
//   （统计区恢复四块 grid 4 列、.profile-stat-static 删除）→ 并入 .profile-counts 第三组（粉丝 关注 获赞，
//   仍在 .profile-top 行最右）；后端 likeReceivedCount 保留不动；
//   （补丁位 3→4·观感微调轮；2026-09-07）
// v0.2.22.5 = Community 主页 横幅 + 头像下调 + 简介/头像分割线（用户「然后我希望你把从简介和头像之间画一个分割线 然后把头像的位置下调些 我希望添加一个横幅」）：
//   头部卡顶部全宽横幅（.profile-banner 140px 品牌渐变+双径向高光；卡片 padding 移入 .profile-body、overflow hidden）；
//   头像行随横幅下移（横幅下 space-md 间距）；.profile-top 底 border-bottom 1px 分割线横贯（简介与头像之间）；
//   零后端零共享文件（tail 改+重建）；
//   （补丁位 4→5·观感微调轮；2026-09-07）
// v0.2.22.6 = Community 点赞/收藏默认私人（用户「把点赞和收藏变成默认私人的就是只有你可以看见」）：他人主页
//   只渲染 帖子/转发 两 tab + 统计两块（.profile-stats 改 flex 平分不留空列；获赞量在 counts 保持公开）；
//   后端 GET /api/social/users/:id/posts?tab=likes|favorites 非本人 403 FORBIDDEN、profile stats 非本人
//   likeCount/favoriteCount 返回 null；social-profile 测试同步（匿名 stats null+tab 测试改本人 cookie+新 403 测试）；
//   （补丁位 5→6·口径修正轮；2026-09-07）
// v0.2.23.0 = Community 主页 编辑资料弹窗「基础/自定义」导航 + 卡片背景液体玻璃（用户「使用这个react的 在编辑资料弹窗的顶部添加一个导航，然后导航内有基础和自定义，自定义是可以自定义卡片背景 你先把那个react内的加入那个自定义内一下」）：
//   编辑资料弹窗顶部加 .edit-nav 药丸导航（基础=头像/显示名/性别/简介 原有字段；自定义=卡片背景预设 7 款
//   液体玻璃渐变——默认/磨砂/深海/薰衣草/樱花/薄荷/落日，实时预览+点保存落库）；
//   效果引擎复用站内 liquid-glass.js v2（rdev/liquid-glass-react 的纯 JS 移植，静态模式——v0.2.9.1 用户
//   「Q弹很丑」钦定永久停用弹性，只保留 blur+saturate+SVG 折射滤镜+inset 玻璃环）；主页卡挂 LG.apply（幂等）；
//   后端迁移 018 users.card_bg 加列（NULL=默认品牌横幅；白名单 CARD_BG_KEYS 三处同步 social.js/auth.js/tail；
//   PATCH /auth/me 落库 + 非法键 400 + null 恢复默认；主页公开渲染他人背景）；
//   （小改动位 22→23·新功能轮；2026-09-07）
// v0.2.23.1 = Community 卡片背景改整卡（用户「你那个卡片背景是横幅我要的是背景就是整个，编辑资料按钮所在的卡片的整个背景」）：
//   预设渐变从只铺横幅改为铺满整张 profile-header 卡（background: 霜面 tint + --lg-bg 预设渐变）；
//   横幅不再单独渐变（background none 露整卡渐变，140px 高度/头像位置/分割线不动）；
//   （补丁位 0→1·口径修正轮；2026-09-07）
// v0.2.23.2 = Community 横幅/背景分开（用户「不是我要的是背景你放在自定义内的那个叫横幅不叫背景」）：
//   横幅恢复 v0.2.22.5 品牌渐变不动（background none 覆盖删除），预设只作为横幅下方的卡片背景；
//   编辑弹窗预览改整卡模型（顶部横幅条+下方卡片背景区，不再是一根横幅条）；默认=无背景纯卡片底色；
//   （补丁位 1→2·口径修正轮；2026-09-07）
// v0.2.23.3 = Community 横幅=预设渐变 + 四周阔出 6px 光环背景（用户「你把现在的卡片背景改成横幅，然后下面再开一个
//   卡片背景然后那个背景要阔出去6px」+ 参考代码蓝紫渐变 #60a5fa→#a78bfa 风格）：
//   横幅=所选预设渐变（预设从卡身移回横幅）；卡身回纯底色；#profileHeader 外层包 .card-halo
//   （margin:-6px+padding:6px 不挤占卡片尺寸）四周阔出 6px 光环背景（=预设渐变，兜底蓝紫渐变）；
//   编辑弹窗预览=真实结构缩小版（横幅条+纯底卡身+has-bg 光环）；默认=品牌横幅无光环；
//   （补丁位 2→3·结构重排轮；2026-09-07）
// v0.2.24.0 = Community 横幅与卡片背景彻底分开（用户「不是我要纯透明的还有把他单独变成卡片背景你听得懂吗？
//   不是和横幅塞在一起能不能把那个说是背景但实际是横幅的名称改一下」+ 问询钦定「独立 7 款预设」）：
//   编辑弹窗预设组改名「横幅（液体玻璃）」（cardBg=横幅预设，预设类挂回卡上、横幅读卡上 --lg-bg）；
//   新增独立「卡片背景」组（cardPlate=019 新列，7 款预设各选各的）：卡身改纯透明透出背景层，
//   背景层=外层包层 .card-halo 挂卡片背景预设类（自己的 --lg-bg 与横幅互不干扰），铺满整卡+四周阔出 6px；
//   预览：横幅=纯渐变条、卡片背景=迷你透明卡模型（has-plate 露背景）；
//   （小改动位 23→24·独立背景轮；2026-09-07）
// v0.2.24.1 = Community 卡片背景只留 2 选项（用户「卡片背景我要的是两个选项一个是默认，一个是标准的
//   液态玻璃不要有颜色就和以下代码一模一样」）：默认（无背景层）+ 标准液态玻璃 glass-clear——
//   无色纯白磨砂渐变（无任何色相）+ 参考代码白边环（inset 0 0 0 2px rgba(255,255,255,0.8)）+
//   柔影（0 4px 12px rgba(0,0,0,0.4)），.card-halo.glass-clear 与原卡预览同款；
//   横幅组 7 预设不动；白名单三处同步加 glass-clear（后端零迁移）；
//   （补丁位 0→1·标准液态玻璃轮；2026-09-08）
// v0.2.24.2 = Community 标准液态玻璃填充层改纯透明（用户「把原本除了横幅以外默认的那个白背景也去掉」）：
//   v0.2.24.1 白磨砂在亮/暗主题下都像白背景——glass-clear 的 --lg-bg 改 transparent（零填充层），
//   只留参考代码白边环 2px + 柔影（.card-halo.glass-clear 不变），卡身直透页面背景；
//   色块加白边环+柔影示意（透明玻璃）；横幅组 7 预设不动；后端零改动；
//   （补丁位 1→2·透明玻璃轮；2026-09-08）
// v0.2.24.3 = Community 标准液态玻璃改真液态玻璃（用户「不是你液态玻璃是真的吗」+「参考 rdev/liquid-glass-react」）：
//   包层 .card-halo 挂全站液体玻璃引擎（LG.apply：折射 70+三通道色散 SVG 滤镜+磨砂 24px+饱和 140%+
//   镜面高光双层注入=rdev 同款配方；renderHeader 先 LG.remove 清守卫再挂，默认回退时卸载）；
//   glass-clear 的 --lg-bg 改无色极轻白霜（0.14/0.04/0.10 三层白渐变+双径向高光+surface 底=
//   v0.2.24.1 白磨砂 ~1/4 强度，亮/暗主题都呈磨砂玻璃体而非白底）+ 代码白边环 2px + 柔影保留；
//   .card-halo 加 position:relative+z-index:0 建层叠上下文（引擎负 z 层不上逃）；横幅组 7 预设不动；后端零改动；
//   （补丁位 2→3·真液态玻璃轮；2026-09-08）
// v0.2.24.4 = Community 液态玻璃加内置光场（用户「还是一样没有要不这样你用这个」+ liquid-glass-react 用法贴来）：
//   前几轮玻璃不可见的物理根因=页面背景是纯色平底，磨砂+折射没有后面的光可磨可折（rdev 演示有彩色场景在玻璃后面）；
//   本轮在包层内垫 .lg-orb-field 光场层（z:-2，永远垫在引擎负 z 层之下）：磨砂 24px 把光球磨成光斑、
//   SVG 折射把光斑做三通道色散→玻璃终于「有东西可折射」看得见；高光层改斜向流光渐变（更贴近参考代码玻璃质感）；
//   光球颜色：首版用用户参考代码蓝紫（96,165,250/167,139,250）→用户「为什么这个玻璃会有蓝色和紫色在背面
//   能不能去掉」→改无色纯白光（白 0.5/0.45；折射后光斑边缘会泛轻微彩边=液体玻璃天然色散而非上色）；
//   光场随卡片背景走（默认无板时 display:none 灭灯+不透明卡身天然遮盖，横幅组 7 预设不动，玻璃本体仍无色）；
//   预览迷你卡内同款双光球示意；后端零改动；（补丁位 3→4·玻璃光场轮；2026-09-08）
// v0.2.25.0 = Community 主页整页背景图片 + 编辑资料弹窗放大 1 倍（用户「在自定义那边再加上一个背景图片
//   这个就是整个页面的背景的图片」问询钦定：只个人主页/公开/上传+网址双支持 +「能不能把编辑资料的弹窗
//   的大小变大1倍」）：新迁移 020 users.page_bg_image 列（/uploads/UPL-* 本站直传或 http(s) 外链，
//   白名单正则过滤防 CSS 注入；无新表 → health 58 不变）；编辑弹窗自定义 tab 新增「页面背景」组
//   （默认/自定义图片双选项+上传按钮（头像同款直传）+网址输入+迷你整页预览），保存 PATCH /auth/me；
//   body 整页渲染背景图（--page-bg-image 变量+page-bg-active 类+深色蒙层 0.38 护可读性；.app-layout
//   无背景直接透出，他人主页也渲染本人设置的图——公开）；弹窗 560px→1120px（页级类 edit-profile-card，
//   不污染灯箱/分享弹窗）；（小改动位 24→25·整页背景轮；2026-09-08）
// v0.2.25.1 = Community 液态玻璃体可见化修复（用户「还是一样没有啊」+ 责令精读 liquid-glass-react
//   整个教程+demo+源码）：①移植 rdev 源码两层环形高光（index.tsx Border layer 1/2 原值：1.5px
//   content-box xor 异或环+白渐变 135°（0→0.12/0.32@33%→0.4/0.6@66%→0）+内白环影 0.5px+高光/阴影，
//   层 1 screen 0.2、层 2 overlay；贴卡缘 inset 6px）——库里唯一在任何背景下都可见的玻璃招牌层；
//   ②页面背景图存在时包层背景复刻该图（fixed+cover+center 与 body 同参数=像素级无缝），卡身/引擎
//   磨砂层直接采样包层自己——demo 同款「玻璃后有场景可磨可折」必现，不再依赖浏览器对 body 背景的采样；
//   ③光场光球提亮 0.5/0.45→0.85/0.75（深色默认背景下玻璃体也有可见白光）；预览迷你卡同款双环高光；
//   横幅组 7 预设不动、玻璃仍全无色（纯白）；后端零改动；（补丁位 0→1·玻璃可见化修复轮；2026-09-08）
// v0.2.25.2 = Community 标准液态玻璃去默认底色（用户「默认的那个背景你也没在标准液态玻璃背景的情况下除了
//   横幅以外的移除啊」）：①.glass-clear 配方去掉垫底 var(--color-surface-container-high)——横幅以外区域
//   彻底透到页面，仅留三层无色白霜+引擎光场/高光/双环各层（横幅组 7 预设不动）；②page-bg-active 复刻层
//   加与 body 同款深色蒙层 rgba(10,10,16,0.38)（复刻=页面本来样子：蒙层+图，包层与页周无接缝、白字可读）；
//   预览/色块随配方同步透明；后端零改动；（补丁位 1→2·去默认底色修复轮；2026-09-08）
// v0.2.26.0 = Story 政治启蒙故事站上线（用户引入 ChatGPT 反推提示词+「先了解政治，再创造国家」理念，钦定
//   v1=完整学习路径 8 页+3D 丝滑切换（CSS 3D 为主局部 WebGL））：①story.mnationworld.com 子域接线
//   （Cloud Run DomainMapping REST+Cloud DNS CNAME ghs.googlehosted.com；entrypoint.js Host 路由
//   story.mnationworld.com→docs/story/ 静态根——docRoot 1 插入+4 置换，主站行为不变，纯公开免登录）；
//   ②故事站 8 页（序章/什么是政治/国家的诞生/政治的历史/历史转折/制度的图谱/政治哲学之问/尾声知识地图→主站），
//   滚轮叙事引擎 story.js（IO 加 .in+--p 单变量 CSS 消费+分句揭示+reduced-motion 降级）+局部 WebGL
//   story-gl.js（星空/地球，裸 WebGL1 零库，能力探测 CSS 兜底）；文案中文第二人称故事化中性口径
//   （Fact/Interpretation 标签+来源脚注+topicId/data-voice schema 预留）；③注册成功跳转 story 子域
//   （demo+api 两分支，setOnboardingStep(1) 保留，尾声 CTA 回 onboarding-identity 原链不断）；
//   ④MicroNationary overview 中间信息区 Story 入口卡；后端 API 零改动；（小改动位 25→26·新功能轮；2026-09-08）
// v0.2.26.1 = Community composer 工具 icon 悬停气泡延迟 5s→2.5s（用户 2026-09-10「改成2.5s」——此前 5s
//   口径（用户 09-05 钦定）实测等太久不浮出；.composer-tool:hover::after transition 5s→2.5s，白底黑字/移开
//   0.15s 淡出不变；后端零改动；（补丁位 0→1·观感微调轮；2026-09-10）
// v0.2.26.2 = 同上气泡延迟 2.5s→1.5s（用户同晚「能不能改成1.5s」继续提速；transition 2.5s→1.5s，其余不变；
//   后端零改动；（补丁位 1→2·观感微调轮；2026-09-10）
// v0.2.27.0 = Settings 弹窗左侧菜单（用户「能不能在设置的窗口左侧添加一个菜单」）：六区块从一条长滚动页
//   改成「左菜单 + 右内容区」经典设置布局（Profile/Appearance/Notifications/Privacy/Language/Account 各带
//   icon，点菜单项切换右侧区块 + active 高亮，菜单 sticky 随滚动）；卡片 560→860px；≤640px 视口菜单退化
//   顶部横向滚动条；六区块 DOM 全保留（display 切换）——既有事件接线零改动；后端零改动；
//   （小改动位 26→27·新功能轮；2026-09-10）
// v0.2.27.1 = 同上设置弹窗 Discord 式全屏（用户「覆盖整个页面但是一样是弹窗类似discord的那种大小」）：
//   #settingsCard width/height 100% + max-width none + max-height 100vh + 圆角/边框清零（铺满布局视口，
//   玻璃模糊+缩放入场保留——仍是弹窗；X/ESC 关闭，backdrop 点击关闭随全屏自然失效）；
//   .modal-card-body max-height 改 calc(100vh - 2*lg)；后端零改动；（补丁位 0→1·观感微调轮；2026-09-10）
// v0.2.27.2 = 同上设置弹窗加回边缘（用户「我要有边缘的」）：#settingsCard 近全屏但四周留 24px 空隙
//   （width/height calc(100% - 48px)，背后页面露一圈，backdrop 点击关闭随之复活）+ 圆角 var(--radius-lg)
//   与 --modal-border 边框恢复；.modal-card-body max-height 改 calc(100vh - 48px - 2*lg)；
//   ≤640px 视口边缘收窄到 8px；后端零改动；（补丁位 1→2·观感微调轮；2026-09-10）
// v0.2.28.0 = Settings Appearance 新增主题色（用户「主题色分成黑白和现在这个蓝白两种 + 按钮分成上下两个
//   部分 上半部显示主题配色 下半部就是名称」）：①Font Size 下方新增 Accent Color 区块，两个 .accent-chip
//   按钮上下两段（上半部 swatch 直接是配色——Blue 纯蓝块/Mono 左黑右白对半分，下半部名称）；②accent 设置
//   'blue'|'mono' 持久化 slati_settings（旧存档 merge 补默认值）；③mono 实现=html[data-accent=mono] 覆盖
//   主色家族（--color-primary 亮近黑 #1c1c22/暗近白 #ececf2 等 20 个变量）+ nav/badge/dropdown/auth 勾选/
//   upload-zone/guest-hero 等蓝 tint 组件跟随翻中性灰；④accent CSS 由 ensureStyle 常驻注入（页面加载即生效
//   ——ensureStyle 原来只在开弹窗时跑，改 IIFE 顶层先跑一次，否则刷新后 mono 不生效）；后端零改动；
//   （小改动位 27→28·新功能轮；2026-09-10）
// v0.2.28.1 = 深色 mono 适配（用户「深色模式下按钮和卡片不要变白 除了文字」）：--color-primary 近白把
//   所有「主色当背景」的组件都染白了——深色 mono 下 btn-primary 渐变/auth-panel-body/toggle-switch.active/
//   lb-score-fill/team-avatar/lift-info-btn 全翻深灰底（#3a3a44 系），text-gradient 尾色改浅灰（文字仍近白）；
//   亮色 mono 同步把 btn-primary/auth-panel-body/text-gradient/team-avatar 的硬编码蓝伴色（#5b5de0/#3b3dc4/
//   #8131cf）翻纯黑灰；.settings-menu-item.active 蓝 tint 改中性灰 rgba(118,117,134,0.10)（亮暗通用）；
//   小圆点类进度标记（progress-step dot/connector/milestone-dot/art-sec 条）保留浅色=accent 标记语义；
//   后端零改动；（补丁位 0→1·观感微调轮；2026-09-10）
// v0.2.28.2 = 深色侧边栏+黑白主题观感修正（用户「按钮怎么变成灰色的了 + 卡片中间那个白色还是一样」+
//   「侧边栏选中态改暗色深色调 + 清除容器白边框/阴影」）：①ethereal.css 深色块新增侧边栏规则——nav 选中项
//   暗底 rgba(255,255,255,0.08)+白字白图标+navGlow 动画禁用（forwards 填充会盖过背景声明），hover 白 5%，
//   模块卡片边框/分割线从白 8%/12% 降为白 5% 半透明融合进背景；②深色 mono 按钮灰色被拒（#3a3a44 灰系）→
//   纯黑族 #1e1e2d 系渐变（btn-primary 显式白字——深色 mono 的 --color-on-primary 是近黑，不翻会黑字压黑底），
//   toggle-switch.active/auth-panel-body/lift-info-btn 同族；③发白渐变修复（!important 压内联 style）：
//   sidebar 用户 banner（sidebar.js 内联 主色→#3b3dc4 白→蓝）、头像 3px 白描边降 8% 半透明、AI 悬浮球/聊天头
//   （ai-chat.js 内联 主色→#8131cf 白→紫）、overview 特色国家头像圆（内联主色→紫渐变 56px 圆；
//   注：v0.2.28.3 证实它并非「卡片中间白光」真身）；④mono nav 覆盖规则重构——深色交还 ethereal 统一管
//   （蓝/黑白同款暗色选中态），亮色 mono 规则显式 [data-theme=light] 防串主题；ethereal.css 改动已重跑
//   inline-css（43 页）；后端零改动；（补丁位 1→2·观感微调轮；2026-09-10）
// v0.2.28.3 = 暗色去卡片正中白光（用户「能不能去除卡片中间的那个白光？？你根本没有找到真身」——真身=
//   .lg-specular 镜面高光层：liquid-glass.js 每张玻璃卡注入、圆心恒在卡正中、rgba(255,255,255,0.16)
//   白晕；暗色下弹窗卡/侧栏模块/页面卡正中一片白光。修法=ethereal.css 增 :root[data-theme="dark"]
//   .lg-specular { display: none; }（暗色整层藏起；亮色保留 rdev 高光配方，计算样式断言暗色全灭/
//   亮色恢复）。ethereal.css 改动已重跑 inline-css（43 页）；后端零改动；
//   （补丁位 2→3·观感微调轮；2026-09-10）
// v0.2.28.4 = 首页 Create World 按钮亮色高亮（用户「把那个首页的 Create World 按钮的颜色改成亮色
//   主要是让他变得突出显眼」）：overview 欢迎横幅 CTA 加 create-world-cta 类，页内样式亮蓝紫渐变
//   #6a6cff→#b14dff + 辉光（0 4px 20px rgba(106,108,255,0.45)+内白描）+hover 提亮上浮；
//   !important 压过 mono 黑族 btn-primary 覆盖——亮/暗 × 蓝/黑白四主题一致高亮；ethereal 零改动
//   无需重跑 inline-css；后端零改动；（补丁位 3→4·观感微调轮；2026-09-10）
// v0.2.28.5 = Create World CTA 深色模式改白底黑字（用户「在深色模式下你把他改成白底黑字的」）：
//   :root[data-theme="dark"] 下 CTA 白底 #ffffff 黑字 #000000 + 白色辉光（0 4px 20px rgba(255,255,255,0.25)），
//   hover 微降 #f0f0f5；只按 data-theme 切换（蓝/黑白两种主题色一致），亮色保持 v0.2.28.4 亮蓝紫渐变；
//   ethereal 零改动无需 inline-css；后端零改动；（补丁位 4→5·观感微调轮；2026-09-10）
// v0.2.28.6 = CTA 样式应用到真正的平台首页按钮（用户「我是指平台首页的那个Create World」）：index.html
//   dashboard 欢迎横幅的 Create World 按钮加 create-world-cta 类 + 同款页内样式（亮色亮蓝紫渐变 #6a6cff→#b14dff
//   +辉光；深色白底黑字+白辉光，!important 压 mono 黑族 btn-primary）；overview.html MicroNationary 横幅按钮
//   保持不动（用户「MicroNationary那个你也别撤销」）；ethereal 零改动无需 inline-css；后端零改动；
//   （补丁位 5→6·观感微调轮；2026-09-10）
// v0.2.28.7 = 恢复被 inline-css 洗掉的 Community 三页 composer 样式（用户「输入框卡片没有做适配」+「那个icon按钮又是怎么回事」）：
//   真身=d370f05 重跑 inline-css.js（43 页）时把留在 ethereal 内联标记块内的页级样式整块替换洗掉——
//   community-hub/post/profile 三页各丢 121 行（搜索胶囊 UI 适配 + Composer 输入框 + 发帖工具条 icon 按钮三块）；
//   本次从 git 历史 d370f05^ 原样恢复三块并移入 v0.2.16.0 本地段无标记块（与媒体段同处），杜绝再洗；
//   ethereal 零改动无需 inline-css；后端零改动；（补丁位 6→7·修复轮；2026-09-10）
// v0.2.28.8 = 用户「能不能把那个Post按钮改成白色的」：Community 三页 composer 的 Post 钮白底黑字 + 白色辉光，
//   亮/暗主题一致（!important 压过 .btn-primary 主题渐变，hover 浅灰 #f0f0f5）——沿用 v0.2.28.5 CTA 白底黑字配方；
//   字号 14px/实高 38px 与工具钮等高不变；ethereal 零改动无需 inline-css；后端零改动；（补丁位 7→8·观感微调轮；2026-09-10）
// v0.2.28.9 = 用户「能不能把那个icon按钮名称 滑鼠停留的时常从1.5s改成 0.8s?」：Community 三页 composer 工具钮
//   悬停气泡延迟 5s → 0.8s（hover 态 transition opacity 0.15s ease 0.8s + visibility 0s linear 0.8s，
//   基础态淡出规则不动）；ethereal 零改动无需 inline-css；后端零改动；（补丁位 8→9·观感微调轮；2026-09-10）
// v0.2.28.10 = 用户「呃为什么深色模式下可以看见左侧菜单内有一个亮色的长方形你能隐藏他吗」——真身=用户模块
//   顶部 60px 亮靛蓝横幅（sidebar.js 内联渐变；v0.2.28.2 的 banner 翻黑族只覆盖 mono 黑白主题，
//   默认蓝主题深色下漏网——扫描探针实证 L=81.7 234×60 全栏唯一实心亮块）；修法=ethereal.css 深色侧边栏块
//   增 :root[data-theme="dark"] .user-banner { background: rgba(255,255,255,0.04) !important; }
//   （暗色横幅视觉消失与模块融为一体，齿轮/火箭白图标仍可见，!important 压内联 style；
//   mono 深色自有暗族渐变特异性更高不受影响）；ethereal.css 改动已重跑 inline-css（43 页）；
//   后端零改动；（补丁位 9→10·观感微调轮；2026-09-10）
// v0.2.28.11 = 用户「还是一样有啊，那个东西会不会是向内的阴影导致的？」——升级扫描探针（box-shadow 顶层
//   逗号切层 + 伪元素 + 边框全测）实证：①全侧栏无任何 inset 内阴影（lg-static 环规则要求
//   .liquid-glass.lg-static 双类，侧栏模块只有 lg-static 从未生效——内阴影假设排除）；
//   ②v0.2.28.10 横幅修复确已生效（暗色 bg=4% 白）；真身=访客模块「注册 / 登录」btn-primary——
//   靛蓝渐变填充 186×42 L=81.7（与旧横幅同亮度）+ 16px 靛蓝光晕，修了横幅它还在所以「还是一样」；
//   修法=ethereal.css 深色侧边栏块增 html[data-theme="dark"] .guest-module .btn-primary
//   深靛蓝低调渐变 #23233a→#34344f + 白字 + 灭光晕（hover 微提亮 #2b2b46→#3d3d5c；亮色保留原靛蓝 CTA；
//   html[...] 前缀与 mono 深色黑族规则同特异性 (0,3,1)、settings-modal 运行时注入在后故 mono 仍赢）；ethereal.css 改动
//   已重跑 inline-css（43 页）；后端零改动；（补丁位 10→11·观感微调轮；2026-09-10）
// v0.2.28.12 = 用户「Home 和 MicroNationary 菜单项背后出现异常长方形白色/浅色亮光块」——三轮零阈值扫描
//   （零阈值 nav-module 子树 + 左侧条带几何扫描）实证：侧栏容器 .app-sidebar 全透明（--sidebar-bg 从定义起
//   只被 dropdown 用过，侧栏本身零背景规则），玻璃注入层 .lg-backdrop（透明、挂 SVG 折射滤镜
//   url(#lg-glass-filter) + blur(14px) saturate(1.4) 磨砂）垫在导航模块背后——页面亮内容透过
//   全透明侧栏再经磨砂/滤镜放大 = 亮块真身；修法=ethereal.css 深色侧边栏块增 ①:root[data-theme="dark"]
//   .app-sidebar 铺满不透明深底 var(--sidebar-bg) #1a1a2e（亮块无孔可入、从上到下底色统一干净深色）
//   ②:root[data-theme="dark"] .app-sidebar .lg-backdrop 灭 filter 灭 backdrop-filter（透明层零折射
//   需求，杜绝 feImage 位移图/磨砂伪影）③.nav-item.active 高亮规则零触碰、亮色主题零触碰；
//   ethereal.css 改动已重跑 inline-css（43 页）；后端零改动；（补丁位 11→12·观感微调轮；2026-09-10）
// v0.2.28.13 = 用户「为什么Editor按钮连接的不是 fluidcanvas-editor」——Editor 按钮直入 FC 编辑器 + 删旧页：
//   侧边栏 Editor 菜单项 href editor.html → fluidcanvas-editor.html（旧文章编辑器 editor.html 整页删除，
//   全站引用复查仅 sidebar.js/transitions.js 两处均已改；getActiveId 的 editor 判断本就先于 fluidcanvas
//   判断，FC 编辑器页高亮自动正确零改动）；transitions.js NAV_ORDER 键 editor.html → fluidcanvas-editor.html
//   （导航序 5 不变）；fluidcanvas-editor.html 标签页 <title> 与 editor-header 头部「Article Editor」残留文案
//   （建页时从旧文章编辑器复制模板遗留）→「FluidCanvas Editor」；ethereal.css 零改动无需 inline-css；
//   后端零改动；（补丁位 12→13·口径修正轮；2026-09-11）
// v0.2.28.14 = 用户「为什么fluidcanvas-editor右上角的Migrate按钮有bug」——git 考古定位：v0.2.8.0 液态玻璃
//   移植轮（4a01104）重写 fluidcanvas-editor.html head style 尾部时把 Migrate 两套按钮样式整块误删
//   （189→30 行）：顶部 Migrate 钮 cssbuttons-io 紫渐变（v10.28.17.4 用户钦定设计）+ 弹窗 Migrate to Cards
//   Uiverse 药丸（v10.28.17.3）自此裸奔成默认按钮；修法=从 df70a76（v10.28.17.4 同轮修正终版）原样恢复
//   180 行样式块（含暗色主题覆写）；ethereal.css 零改动无需 inline-css；后端零改动；
//   （补丁位 13→14·纯修复轮；2026-09-11）
// v0.2.28.15 = 用户「大小能不能和旁边的按钮匹配一下然后能不能改成药丸形…滑出的颜色改成白色…字母黑白相反
//   滤镜」——顶部 Migrate 钮定制：①大小对齐旁边 .btn-sm（font-size var(--fs-label-sm)、span padding
//   7px 16px、svg 24px、margin 8px，高度 38px 与 History/Tags/Save Draft/Publish 一致——邻钮 .btn-outline
//   含 1px 边框 38px，migrate 无边框用 7px 上下垫等值对齐）②改药丸形
//   （border-radius: var(--radius-full)，与邻居 .btn 同）③横扫面板黑→白（亮/暗主题一致，两主题对
//   顶部钮本就零覆写）④字母挂黑白相反滤镜——span 静息 filter:invert(1) 白字反转成黑字压在白色面板上、
//   悬停 invert(0) 面板滑离时同步翻回白字，0.4s 与面板横扫同曲线同步丝滑换色；ethereal.css 零改动
//   无需 inline-css；后端零改动；（补丁位 14→15·观感微调轮；2026-09-11）
// v0.2.28.16 = 用户「FuildCanvas怎么还没做主题色的适配？我现在明明设置是黑白主题」——真身=FC 两页从未加载
//   settings-modal.js → data-accent 不落、黑白规则从未注入（FC 页面暗色覆写早已按「settings-modal 运行时
//   注入在后故 mono 族赢」设计，只差接入这一步）。本轮：①FC 两页接入 settings-modal.js（site-config 后一行）；
//   ②次色家族 mono 翻中性灰（亮 mono 中灰 #4a4a56 底白字、暗 mono 亮灰 #b0b0c2 当文字；暗 mono 把次色当
//   背景的组件翻纯黑族——.btn-secondary #1e1e2d 白字、channel-avatar 黑灰渐变）③FC 组件硬编码蓝紫翻黑白
//   （亮 mono 近黑 #1c1c22 族/暗 mono 近白 #ececf2 族：上传区 drag-over+图标、文件条+图标、目标卡选中、
//   发布钮渐变、最近目标章、内容库 article 徽章/操作钮悬停、input-glass 焦点环、榜单槽、里程碑线、图例条、
//   channelOverview 卡渐变；语义色 sovereign 橙/community 绿/status 蓝与内容调色板不动）④FC JS 模板两处
//   硬编码 #4648d4 改 var(--color-primary)（TYPE_META.article + Articles 指标，bg 用 color-mix 8%）；
//   ⑤编辑器顶部 Migrate 钮紫渐变 mono 翻黑灰渐变（亮 #1c1c22→#3a3a46/暗 #1e1e2d→#32324a——白横扫面板
//   与 invert 滤镜机制不动）⑥弹窗 Migrate 药丸悬停紫层/紫光环/暗色星芒翻灰；ethereal.css 零改动无需
//   inline-css；后端零改动；（补丁位 15→16·修复轮；2026-09-11）
// v0.2.29.0 = 表格卡 Sheet Card（用户「我们还缺少一个sheet card」——wiki 表格迁移目标）：FC 新卡片族第 7 型——
//   可编辑表格（首行表头加粗、行内编辑框 .card-edit-field 不 arm 拖拽、底部 +添加行/+添加列、行尾 ✕ 删除
//   删光自补空白行、窄卡 .sheet-scroll 横向滚动）；数据走 dataset.sheetData={cols,cells} JSON 串 additive
//   草稿往返（legacy drafts omit → 种子 2 列 4 行）；调色板 Sheet Card 入口（table 图标 8×5）+ 图层图标表映射；
//   table-layout:fixed 首行 ✕ 占位列防 ✕ 列塌 0 宽；后端零改动、ethereal 零改动无需 inline-css；
//   （小改动位 28→29·新功能轮·补丁归零；2026-09-11）
// v0.2.29.1 = 表格卡默认尺寸 8×5 → 宽10格×长7格（用户「那个卡片大小能不能是默认长7格宽10格」）：
//   工厂默认 spanW||10/spanH||7 + assetSpan {w:10,h:7}（拖放入画布同尺寸）+ 草稿恢复兜底 10/7 三处同改；
//   （补丁位 0→1·观感微调轮；2026-09-11）
// v0.2.29.2 = 表格卡加行/加列自动变长变宽（用户「然后能不能在添加行/列的时候自动变长和宽啊」）：
//   +添加行 → rowSpan+1 卡片变长、+添加列 → colSpan+1 卡片变宽；sheetGrow 读 dataset 现有跨度写回
//   +setCardSize+刷手柄，跨度随草稿往返；种子 3 行与 restoreSheet 恢复路径不增长；
//   （补丁位 1→2·观感微调轮；2026-09-11）
// v0.2.29.3 = 表格卡列宽/行高手柄（用户「能不能在每一列/行的外面再增加一个格子点击这个格子可以调整该行的长度该列的宽度」）：
//   每列上方 ↔ 手柄、每行左侧 ↕ 手柄（含表头行），按住拖动调整单列宽/单行高（最小列宽 40px/行高 22px）；
//   colgroup 三截制（18px 手柄列+数据列+22px ✕ 列）；sheetData 增 colW/rowH 随草稿往返（legacy 省略→默认等分）；
//   （补丁位 2→3·观感微调轮；2026-09-11）
// v0.2.30.0 = 编辑器撤回/恢复按钮（用户「能不能在顶部添加一个撤回和恢复按钮」）：
//   快照式撤销——buildDraft() JSON 串（剥 lastSaved 时间戳）当快照，600ms 防抖跟在每次 onContentChange 后
//   （连打 10 个字=一次快照，零调用点改动）；基线在初始化完成后即拍下（刚打开时的样子）——
//   首个改动即可撤回回原点；撤回/恢复栈上限 60；工具栏 History 左侧加 撤回/恢复 两钮
//   （disabled 灰态）+ Ctrl+Z/Ctrl+Y（焦点在 input/textarea/contenteditable 时让给原生撤销）；
//   （小改动位 29→30·新功能轮·补丁归零；2026-09-11）
// v0.2.30.1 = 吸合误判修复（用户「为什么我把卡片拖到一个位置他会被一个和他没有任何接近的卡片吸附合并？这是否是网页html和css带来的一些bug导致的？」）：
//   真身=纯 JS 判定逻辑 bug，与 HTML/CSS 无关——findMergeSnap 只按单轴边距判命中，
//   横向隔着一千多像素、仅仅上下边同高（≤12px）的卡也会被吸过来（实况探针：落点 (0,160)
//   命中 x=1050 的卡，d=8px 却视觉相距 1050px）；修法=边对判定加垂直轴严格重叠守卫
//   （x 轴边对→y 范围相交，y 轴边对→x 范围相交）；FC v10.28.20.1（补丁位 0→1·纯修复轮；2026-09-11）
// v0.2.30.2 = 一体式高亮（用户「那个编辑的画布是不是一体，如果是重复的一个一个就请你把他改成全部一体式的不要偷懒就搞成一个一个的」→追问「我怕你又偷懒就是做出一个画布然后再复制变长但是只使用一个感应，其他都只是花瓶」）：
//   画布本体本来就一体（单一 div、变长=自身长高、拖拽感应挂 document 全页生效，零复制零花瓶段）；唯一「一个一个」=拖卡/拖资产的覆盖高亮
//   一格建一个 div（拖 10×7 的卡 = 70 个小方块各自描边）——drawHighlightRange 改为整个覆盖范围只建 ONE 块矩形；
//   FC v10.28.20.2（补丁位 1→2·观感微调轮；2026-09-11）
// v0.2.30.3 = 卡框高光清除+边框统一暗色（用户「深色模式下卡片外框右上角有一条很突兀的白色/浅色高光边线…清除卡片
//   右上角及整个外框所有的白色/浅色渐变高光线」+「将卡片整体的外边框统一改为暗色低调的微弱边框…融入深色背景」）：
//   真身=v10.27 磨砂玻璃轮的「右上角 2px 高光条」（background-image 白渐变贴 top right——浅色玻璃 3D 感，
//   深色下变成刺眼白线）；4 处卡片表面高光全清（卡片本体/组背景卡面/主题卡填充层 tint/油漆 ::before），
//   边框统一 var(--divider-line)（深色=rgba(255,255,255,0.08)——正是用户举例值；浅色=rgba(118,117,134,0.08)）；
//   统计编辑面板高光保留（v10.28.6.2 用户钦定要高光的浮动面板，非卡片外框）；
//   FC v10.28.20.3（补丁位 2→3·观感微调轮；2026-09-11）
// v0.2.30.4 = 吸合方向感（用户「能不能判定一下方向，如果卡片是在左侧合并后应该就是在左侧而不是变成跑到下方」）：
//   真身=mergeCards 等宽归一以左缘为锚，窄卡从左/右并入既有组时被拉成组宽、右缘越过目标竖边
//   → reflowGroup 按水平重叠把全组压成一列叠到下方（实况探针：80px 窄卡左并入 174px 组 →
//   整组塌成一列，拖卡落到目标下方）；修法=findMergeSnap 边对加 side（拖动卡在目标左/右/上/下
//   哪一侧），mergeCards(card, target, side) 归一后按 side 重新贴齐（左/右贴竖边、上/下贴横边
//   并 x 对齐目标列）再 reflow——贴齐边恒 flush，reflow 按边分列不再塌；
//   FC v10.28.20.4（补丁位 3→4·纯修复轮；2026-09-12）
// v0.2.30.5 = 国旗卡/国徽卡默认尺寸（用户「把国旗卡片改成 长5格 国徽卡片改成5x5」，问询钦定国旗=8宽×5长）：
//   国旗卡 8×6→8×5（assetSpan flag h 6→5 + 草稿恢复 rowSpan||5）、国徽卡（Emblem 盾徽资产卡）
//   4×3→5×5（assetSpan shield 显式 5×5 + 草稿恢复新增 shield 分支 colSpan||5/rowSpan||5）；
//   零后端、ethereal 零改动无需 inline-css；
//   FC v10.28.20.5（补丁位 4→5·观感微调轮；2026-09-12）
// v0.2.31.0 = 合并组整体缩放 + 单击恒选整组（用户「合并后整体的卡片能不能做一个可以放大缩小的功能和独立卡片一样，
//   然后当我只是要选中整体的卡片时会直接触发到独立卡片而不是在选中独立卡片的情况下双击才会触发」）：
//   整组选中时 8 手柄挂组框（可见成员 bbox 并集、轴对齐、无 GROUP_BG_PAD）——旧 v10.28.17.2 曾把
//   手柄挂被点的那张卡上（「第一个框是单独卡片的框」）后整体隐藏，本轮改挂整组框；拖手柄=整组缩放
//   （组框像素→整格量化、成员位置按框内比例缩放、成员尺寸各自量化到整格 span=尺寸不变量保草稿往返、
//   等比锁成员两轴取小倍率图片永不变形、对边固定）；提交不 reflow/不对齐列顶（用户刚调的结果系统不抢回）；
//   单击组内成员恒选中整组（旧 v10.28.15.1「再次点击同一张卡=单独选中」切换整体移除+mousedownAlreadySelected
//   死变量删除），单独选中只走双击路径；零后端、ethereal 零改动无需 inline-css；
//   FC v10.28.21（小改动位 30→31·新功能轮·补丁归零；2026-09-12）
// v0.2.31.1 = 组内图源弹窗劫持双击修复（用户「我选中了整体然后要再选中单独的卡片时就不让选了」+
//   「再点击一次就打开了」）：真身=组内国旗/国徽卡未设图时单击必弹图源弹窗（遮罩吃掉双击第二击 →
//   单独选中/拆分整条路径失效）；修法=组内单击不再弹图源，单独选中后再双击（e.detail=2）才弹
//   （用户钦定「在选中独立卡片的情况下双击才会触发」）+ 单独选中后单击同一张卡保持单独不重置；
//   零后端、ethereal 零改动无需 inline-css；
//   FC v10.28.21.1（补丁位 0→1·纯修复轮；2026-09-12）
// v0.2.31.2 = 文字工具栏输入中恒显（用户「那个工具栏能不能在输入的时候都会一直展示」）：真身=
//   v10.28.10 输入框口径只认非空选区（框选口径光标态不弹）——卡内编辑框（标签/姓名/表格格…）
//   打字时光标态工具栏不显示；修法=textSelInInput 光标态在 .grid-card 内输入框也弹 + 缓存
//   LAST_INPUT_EL 改存元素（选区态/光标态都可回用）；标题框/搜索框/弹层输入框打字不弹（防干扰）；
//   Escape 在卡内输入框只折叠选区工具栏保持；零后端、ethereal 零改动无需 inline-css；
//   FC v10.28.21.2（补丁位 1→2·观感微调轮；2026-09-12）
// v0.2.32.0 = 工具栏添加图像·Wiki 式内联图（用户「在工具栏的右侧那边再增加一个按钮叫添加图像，
//   就是你可以添加国旗/国徽等等的图像，然后图像的大小是根据文字的大小进行等比例变化的，这样
//   可以完成类似于Wiki的功能」）：工具栏右端 image 钮（输入框态置灰——输入框装不了图）+ 弹层
//   （国旗库 15 面程序化条纹光栅化 PNG data URL + 上传任意图）；只进内容卡文字，插入
//   <img class="tt-inline-img">（CSS height 1.5em，em 继承 → 字号变图等比变：光标态整块字号/
//   选区 span 字号两条路都等比）；内容卡草稿 innerHTML 往返 + sanitizeDraftHtml 放行 data: 图 →
//   保存/恢复无损；零后端、ethereal 零改动无需 inline-css；
//   FC v10.28.22（小更新位 21→22·新功能轮·补丁归零；2026-09-12）
// v0.2.33.0 = 添加图像弹层改版·钮不再置灰（用户「为什么该按钮没办法点击？」——真身=v10.28.22
//   输入框态置灰（pointer-events:none 还无提示）是设计却成了事故；另用户「他这个的图像的弹窗
//   是在工具栏上方的就是用户可以直接进行一个预览，而不是覆盖全屏的」+「一样可以在网页上
//   搜索/上传」）：①钮任何态可点，插入时无内容卡光标 toast 引导（「图像只能插入内容卡的文字里」）；
//   ②弹层锚定工具栏上方直接预览（贴顶放不下才翻下方）；③弹层内网页搜索——Wikimedia Commons
//   维基图库 API（免费免密钥、CORS origin=*），640px 缩略图预览网格、点格插入缩略 URL
//   （原图可能是几十 MB 的 TIFF 用不上）、坏图格自动隐去、无结果/失败回退国旗库（保留用户输入词）；
//   国旗库/上传保留；④搜索框抢焦点后光标回放——打开弹层时记住内容卡光标/选区、插入时先
//   focus 后加范围（Chrome 先加范围再 focus 会丢）；⑤弹层开着时工具栏不收起（点搜索框聚焦
//   会把弹层关掉+display:none 后懒加载缩略图永不加载——电池探针实况，收起改走显式路径）；
//   零后端、ethereal 零改动无需 inline-css；
//   FC v10.28.23（小更新位 22→23·新功能轮·补丁归零；2026-09-12）
// v0.2.34.0 = 图像可以插进任何可打字处（用户「我希望他能添加在任何可以打字的地方而不是
//   只限于文字内容卡片」）：卡内输入框（标签/姓名/头衔/简介/统计指标/时间线事件与描述/
//   表格格…）第一次插图时现场升级成 contentEditable span（同名同类同内联样式、文字照搬），
//   此后文字+图片共存；纯文字字段永远还是 input 零影响既有路径；数字/年份字段除外（数值
//   与图表逻辑要纯文字，toast 引导）；序列化全走 fieldHtml/fieldText/setFieldText/
//   makeTextField——带标记文字按 HTML 往返、草稿零新字段（rich HTML 坐既有 label/charName/
//   charTitle/charBio/statsRows/tlEvents/sheetData 串）；弹层打开记住卡内输入框
//   IMG_SAVED_INPUT（搜索/上传抢焦点后仍插回原位）；零后端、ethereal 零改动无需 inline-css；
//   FC v10.28.24（小更新位 23→24·新功能轮·补丁归零；2026-09-12）
// v0.2.34.1 = 两个修复（补丁位 0→1·纯修复轮；2026-09-12）——用户「在Sheet卡片里添加图像时它的大小
//   没有跟随文本大小」+「为什么在content card输入时工具栏会跑到左上角」：①内联图 1.5em 规则选择器只写
//   .card-text-content，富文本化字段（表格格/标签/统计…）里图掉回自然大小 → 选择器加 [data-rich="1"]
//   img.tt-inline-img（em 取所在 span 字号，随表格格字号等比）②真身=插图后光标 setStartAfter(img)
//   元素级落在内联图边界，Chrome 光标矩形退化（0,0,0,0）→ 工具栏定位锚到视口左上角；修法=光标优先放进
//   图后文本节点偏移 0（探针实证矩形正常）+positionToolbar 退化矩形兜底锚回文字区矩形（图是末节点等
//   残余情况也绝不跳左上角）；零后端、ethereal 零改动无需 inline-css；FC v10.28.24.1（补丁位 0→1）
// v0.2.34.2 = 两个修复（补丁位 1→2·纯修复轮；2026-09-12）——用户「就只有content card正常 sheet card
//   不正常」+「一添加它的大小就已经超出了表格而且也没办法像文字一样删除」：①大字号时宽图溢出表格格——
//   内联图 height 1.5em 下宽图（国旗 1.6:1）在字号 29+ 时宽度超过固定宽表格格（线上探针实证 font 32 →
//   77px 图 > 69px 格溢出）；修法=规则加 max-width:100% + object-fit:contain（普通字号零变化、超宽
//   按比例收进盒内不压扁不溢出）②点击内联图无法像文字一样删除——点击图后光标落点不定且无选中反馈
//   （探针实证 Delete/Backspace 不一定命中图）；修法=点击 rich 字段里的内联图直接整图选中（可视反馈），
//   Delete/Backspace 即删；内容卡点击行为不动（用户基线）；零后端、ethereal 零改动无需 inline-css；
//   FC v10.28.24.2（补丁位 1→2）
// v0.2.35.0 = 合并组可整行成行（小改动位 34→35·新功能轮·补丁清零；2026-09-12）——用户「如果那个卡片
//   已经有左右两个合并了的 然后我在下面上去合并他只会变成左右两列，我希望是从下面合并时他是可以变成
//   上下两行的就是不只是两列」：真身（探针实证）=旧行为把下方拖入卡挤进目标列，reflow 的 fill 把矮列
//   拉高填满（2列组下方并入 → 另一列 130→216 被拉大），组永远只是左右两列；修法=上/下并入既有组时
//   整宽成行贴组底/组顶（rowInGroup 标记随草稿往返 additive、reflowGroup 行卡独立于列——不进列划分/
//   不参与 fill/不随列顶对齐跳动、宽度恒整组宽幂等；左右并入仍是列）；零后端、ethereal 零改动无需
//   inline-css；FC v10.28.25（小更新位 24→25·新功能轮·补丁归零）
// v0.2.35.1 = 合并组内单独选中一张卡调大小修复（补丁位 0→1·纯修复轮；2026-09-12）——用户「当卡片
//   合并后我要在整体单独选中一个卡片调整他的大小时没办法办到，只能长按拆分」：真身（可信输入探针
//   实证）×2——①单独选中只走原生 dblclick 事件，真实双击偏慢（间隔 >~500ms 浏览器阈值）或两击漂移
//   >~4-8px 时 dblclick 根本不触发 → 只能整组选中、手柄永远锚整组外框（长按拆分走 mousedown 不受影响，
//   所以只剩拆分一条路）；②行组内列成员纵向放大后盖住下方行卡（探针实证 44px 重叠，行卡画在列底上
//   层）——修法=①同卡两击 ≤800ms/漂移 ≤10px 即视为双击，延迟 120ms 补发单独选中（原生 dblclick 先到
//   则自然跳过、零重复；延迟翻转保证 v10.28.21.1 钦定的「单独选中后再双击才弹图源」判定时
//   selectionIsSingle 在第 2 击时仍为 false 不受影响；点空画布清双击对——A、空点、A 不算双击）；
//   ②列成员单卡缩放提交后行卡按快照偏移贴回新列块（上下行各贴底/顶 flush 无重叠，探针实证
//   overlapPx 44→0）；零后端、ethereal 零改动无需 inline-css；FC v10.28.25.1（补丁位 0→1）
// v0.2.35.2 = 合并组内单卡调大小挤压让位（补丁位 1→2·纯修复轮；2026-09-12）——用户「可以单独调整了
//   但是旁边的卡片不会因为被挤压而移动…这是最基础就应该做好的」：真身（可信输入探针）=单卡缩放提交
//   路径只做列顶对齐+行卡贴回，旁列伙伴从不位移（2列组 A 东扩+66 → B 原地不动重叠 66px、东收也不
//   回贴、3列组中列东扩右列不动、西扩左列不动、同列叠堆南扩压住下卡）；修法=「移动边=墙」让位模型——
//   提交时同侧伙伴（东墙→右侧整列、西墙→左侧整列、南/北墙→同列上下堆叠）随墙位移量整列平移（贴齐/
//   间距全保留、对边不碰、收边负位移=回贴、落位绝对化幂等）；行宽跟随列块（列块变宽/窄时默认全宽行
//   重断言新宽，自定义宽的行不抢回）；内容卡墙位移按视觉框高（origH 取 minHeight、文本框高超过时墙
//   未动不得推空假缝——探针实证 44px 假缝）；onResizeUp 与 Escape 收口成共享 commitSingleResize
//   （Escape 曾漏行卡贴回）；可信输入探针 14/14（东扩/东收/中列/西扩/行宽跟随/叠堆南扩/北扩/自定义行/
//   独立卡自由/Escape/行卡回归/三叠级联）；零后端、ethereal 零改动无需 inline-css；FC v10.28.25.2（补丁位 1→2）
// v0.2.36.0 = 自由形状合并组（小改动位 35→36·新功能轮·补丁归零；2026-09-12）——用户「合并时能不能不只是
//   正方形…左/右侧合并不会因为长度不一样被拉长而是保持一样的大小合并；从上方/下方合并只根据动到的那
//   一面的最宽值调整大小不是整组最宽；可以是 6 边形 L 型、十字型等排列」：①左右并入完全不做宽度归一
//   （各保原尺寸贴目标侧边+顶对齐目标）；②上/下并入走接触面模型——组内「对边距离 ≤12px 且 x 相交」的
//   成员=面，宽=面并集跨度（倒 L 台阶下并入只匹配接触的那一列宽、平底跨列=整面宽、空面退化 [target]）；
//   ③reflowGroup 保形化（只重画背景/手柄、永不改成员几何）+行卡机制（rowInGroup）整体退役（legacy 草稿
//   忽略该字段、像素几何照存）；④组背景 computeGroupOutline 并集轮廓 clip-path（L/十字剪影、描边/阴影
//   filter drop-shadow 栈跟随剪影、空角点击落到画布）；⑤墙让位 right/left 加垂直重叠守卫（台阶斜对卡不误推）
// v0.2.37.0 = 自定义页面背景（小改动位 36→37·新功能轮·补丁归零；2026-09-13）——用户「在卡片列表的下方添加
//   一个标题叫自定义…上传自己的背景…16:9是最低要求可以做得很长…多图纵向拼接（图2 接图1 下）…拖动改变
//   上下排列顺序…虚化边缘单独调整虚化范围做出渐渐变化的过渡…弹窗右侧整页预览左侧工具栏…预览多个比例
//   （平板16:10/手机20:9/16:9/21:9 + 详细折叠 1:1.4/4:3/1:1）」：资产面板「自定义」区（页面背景入口+状态
//   「未设置/N 张」）；背景=整页背景直接画在 gridCanvas 自身 background-image 上（不建 div——层级天然正确、
//   背景图不是事件目标；.has-page-bg 类灭网格线；minHeight=画布宽×合成高/1600 让画布随背景长高，滚动扩行
//   零侵入）；弹窗左工具栏（上传+图片列表[缩略图/上下虚化滑块 0-400px/删除/拖拽排序把手]+比例区+保存/取消/
//   移除）右整页预览（真实画布克隆剥手柄/对齐线/编辑态 scale 进比例框，aspect-ratio 7 档：1.6/2.222/1.778/
//   2.333 + 详细 0.714/1.333/1）；合成=1600 宽离屏 canvas 纵向拼接+缝区 destination-in 线性渐变交叉淡化
//   （α_i+α_{i+1}≡1；避开 CSS mask-image 史载渲染前科）+先 fillRect 主题底色（JPEG 无 alpha 防深色主题发黑）；
//   16:9 最低校验=合成高/1600 ≥ 9/16 保存拦截+红提示实时重算（羽化重叠降低总高）；上传四门禁（8MB/图片类型/
//   6 张/累积 dataURL 2.5MB 护 localStorage）；草稿 additive pageBg {imgs,order,feathers}（v 保持 9；合成产物
//   不入草稿、载入确定性重算；legacy 草稿省略=无背景）；撤销/重做经 applyDraft 清场/恢复往返；零后端、
//   ethereal 零改动无需 inline-css；getCardFingerprint 补 pagebg 签名（线上电池 draftHas:false 真 bug：指纹
//   不含背景 → autosave 守卫 fp!==lastSavedContent 永不跳变 → 草稿/云 PUT 永不写 → 刷新丢背景）；电池 27/27
//   （新 S7b 自动落草稿回归）+ 线上电池 PASS（上传3→拖序→虚化→7 比例→保存→刷新恢复→撤销/重做→移除；
//   putWithPageBg 仅供参考——fcCloudMode 仅真登录 USR- 用户开）；部署两次 exit 0（00207-hw9 初版、
//   00208-nzm 指纹修复）；FC v10.28.27.0（小更新位 26→27）
// v0.2.38.0 = 上传图片信息弹窗（小改动位 37→38·新功能轮·补丁归零；2026-09-13）——用户「在上传自己的图片的
//   时候都有一个弹窗右上角显示图片同行左侧显示图片名称，下方是详细信息Description…可以设定Public/Private/
//   Team…Description固定长度…字数限制320字…追踪那个词（"code"是一个字不是四个）」：8 个上传入口共用
//   #imgMetaModal（页面背景/国旗国徽/卡背景/名称背景/旧背景/内联图/头像/地图）——读图后先弹窗（预览+名称+
//   描述+可见性分段控件），保存才落地、取消=图不落地且宿主弹窗保持打开；描述 resize:none 固定高+live 计数
//   「N / 320」（按空格分词：code=1、你好世界=1、我的 code 很好=3）+超限红字+保存拦截 toast；弹窗叠层
//   （同 z 110 DOM 后者在上、可叠页面背景弹窗）+closeModalOnly/closeTopModal 只关顶层（backdrop 改
//   closeTopModal 单弹窗等价向后兼容）+Escape isComposing 守卫；草稿 additive（v 保持 9）：pageBg imgs[i]
//   增 name/desc/visibility、卡图 imgMeta、卡背景 cardBgMeta、标题背景 captionBgMeta、头像 charAvatarMeta、
//   地图 mapImgMeta、内联图 data-img-* 属性 innerHTML 往返零字段（legacy 缺省空名/空描述/Private）；
//   getCardFingerprint 补元数据签名；renderPbgList 名称行 esc() 防注入+编辑钮重开弹窗；FC v10.28.28.0
//   （小更新位 27→28）
// v0.2.39.0 = 我的图库（小改动位 38→39·新功能轮·补丁归零；2026-09-13）——用户「那个上传后可以在平台的上
//   图像搜索那边搜索到吗」+「肯定是要做的」，问询钦定：①入口=「Search within the platform」弹窗上方加顶部
//   菜单，右侧「我的图库」左侧「全部」；②点图=就是添加图片，图片右上角铅笔 icon 点击后编辑信息（只能编辑
//   自己上传的、内置国旗不能编辑）；③管理功能=全部（浏览+搜索+插入+编辑+删除）：图库=纯派生视图（打开/切
//   页签时扫描画布现有使用处——页面背景/卡图/卡背景/标题背景/头像/地图/内联图 7 类，按 dataURL 去重，同图
//   多处用=一格）；「全部」=内置 12 旗+我的上传、「我的图库」=仅上传（tile=缩略图+可见性徽章+铅笔/垃圾桶，
//   空态提示）；点上传图=setCardImage+meta 三件套（label=名称）插入国旗卡；铅笔=图片信息弹窗叠层（只关
//   meta、browser 保持，initial 回填），保存按 dataURL 同步所有使用处 meta（不动卡 label）；垃圾桶=原生
//   confirm 报使用数→从所有使用处移除（卡图摘层+icon 恢复+clearAspectLock、卡背景摘层、标题背景重绘、头像/
//   地图还原默认态、pageBg 走 pbgRemoveImage 同款收尾或 closePageBgModal 提交路径、内联图 richFieldSync）；
//   搜索按名称+描述过滤；MY_FLAGS 假数据退出浏览器（FC_FLAG_LIBRARY 喂工具栏国旗库不动）；零草稿字段（v
//   保持 9）、零指纹改动（meta 已入指纹）、零后端、ethereal 零改动无需 inline-css；FC v10.28.29.0（小更新位
//   28→29）
// v0.2.39.1 = 样本国旗全撤（用户「把那些用来做样本的图片国旗去掉」）：SEED_FLAGS 12 内置条纹旗 + MY_FLAGS 3
//   假「我的旗」两数组整体移除——图库「全部/我的图库」两页签同源（=真实上传派生，页签结构保留），空态文案
//   统一；tt-img-pop 国旗格零渲染（头部「国旗库」→「图片」，仅上传格+网页搜索），FC_FLAG_LIBRARY=[] 保留为
//   将来真库接口；applyFlagToCard 导出保留兼容（setCardStripes 仍喂草稿）；补丁位 0→1·纯改动轮；FC v10.28.29.1（补丁位 0→1）
// v0.2.40.0 = 编辑器自动保存周期化（小改动位 39→40·新功能轮·补丁归零；2026-09-13）——用户「平台自动保存能不能
//   是每10分钟一次？用户可以在设置里调整保存时间频率，然后最快是5分钟一次」，问询钦定：频率 5/10/15/30/60 五
//   档药丸（默认 10、最快 5）+ 编辑器顶栏齿轮直开平台设置弹窗：3s 防抖改固定节拍心跳（onContentChange 不再重
//   排、到点 autoSave 脏守卫照旧、再约下一拍）；slati_settings 增 fcAutoSave 键（草稿 schema 不动 v 保持 9、
//   不进草稿）；设置弹窗新「编辑器」区（仅编辑器页显示、该页打开默认落此区；MENU 母数组不动局部 slice 拼装）；
//   saveSettings 广播 slati-settings-changed（编辑器监听重排，无监听页零影响）；pagehide 关页脏内容兜底保存
//   （localStorage 同步写必达、云端 409 留待下次 syncCloudDraft 调和）；QuotaExceeded 放弃机制保留；手动保存
//   （Save Draft/Ctrl+S/publish/historyRestore）零改动；电池 autosave-interval 12/12（时间加速注入：≥60s→150ms 真跑
//   不真等 10 分钟）+ img-library 42/42 + page-bg 27/27 + pbg-meta 38/38 复跑全绿 + 线上电池 PASS（rev 00212-clv）
// v0.2.40.1 = 编辑器撤回/恢复按钮纯图标化（补丁位 0→1·纯改动轮；2026-09-13）——用户「能不能把undo和redo的按钮
//   只是保留icon不需要名称」：工具栏 撤回/恢复 两钮去掉文字只留图标（名称保留在 title 悬停提示「撤回 (Ctrl+Z)」/
//   「恢复 (Ctrl+Y)」）；按钮属性/撤销引擎/快捷键零改动；电池 fc-undo 复跑 15/15（S1 改纯图标断言+版本口径更新）
//   + 线上核验 PASS（rev 00213-644）
// v0.2.40.2 = 编辑器设置/Tags 按钮纯图标化（补丁位 1→2·纯改动轮；2026-09-13）——用户「设置和Tags能不能也是
//   只有一个icon?」：工具栏 设置（settingsBtn）与 Tags（tagsModal）两钮去掉文字只留图标（名称保留在 title 悬停
//   提示「设置」/「Tags」）；按钮属性/弹窗/功能零改动；电池 autosave-interval 复跑 12/12（F1 版本口径+两钮纯图标钉）
//   + fc-undo 复跑 15/15（F4/S8 版本口径）+ 线上核验 PASS（rev 00214-6dg）
// v0.2.41.0 = 用户等级系统 + 订阅/免费功能限制（小改动位 40→41·新功能轮·补丁归零；2026-09-14）——用户「做一下
//   用户等级系统和订阅与无订阅的功能限制」，问询钦定：①等级结构=等级靠活跃+会员靠订阅（两套并行系统）；②免费限制=
//   每语言字体 5 个、不能自定义边缘、不能自定义卡片背景和页面背景、但不限制平台主题；③订阅判定=先做铺垫之后连接
//   Xendit，只要判定钱到账就自动开通（沿用后端 applyPaid webhook 状态机，audit 已预留 via:'xendit'），不要管理员
//   开通；④等级称号=微型国家主题（旅行者→君主 10 级）：FC 编辑器 SUBSCRIPTION_TEST_MODE 翻 false（caption/card 边缘
//   装饰锁正式激活）；字体面板每语言免费 5 个（超限组锁行「剩余 N 个字体」+订阅解锁链接）；卡片背景/页面背景加订阅锁
//   （四控件隐藏+toast+入口锁标「订阅后解锁」）；等级系统本地化 slati_xp（每日登录 +20/建卡 +10/发文章 +100/提交国家
//   +150/提交世界 +150/创建话题 +80/引导完成 +50；侧栏 Lv 徽章+XP 进度条+升级 toast）；premium.html 支付网关升级
//   （Xendit）预告注记（到账自动生效无需人工审核口径不变）；零后端、ethereal 零改动无需 inline-css
//   （电池 tier-gating 29/29 + 复跑 13 组全绿：caredge-dark 9/9、page-bg 27/27、pbg-meta 38/38、img-library 42/42、
//   migrate-btn 41/41（悬停横扫断言改 transition:none 注入+readyExpr 正则双转义修复）、liquid-glass-static 19/19、
//   premium-multi 106/106、autosave-interval 12/12、fc-undo 15/15、group-shapes 17/17、merge-dir 19/19、merge-far 12/12；
//   group-resize 31/34 三红（S9/S15/S17）为 round-Y 前既有陈旧（0dd2153 worktree 同值实证）仅注释不设门禁；
//   group-fill/group-click/group-v172 按设计退役（自由形状合并组轮已替换其功能）不设门禁；另修复 liquid-glass.js
//   置换图 MAP 被 v0.2.9.0 sed 注入损坏的历史 bug（每页加载 console error + 玻璃位移静默失效，恢复 4a01104 原串）；
//   线上核验 PASS（rev 00215-gv4））
// v0.2.42.0 = 图片库直开搜索+搜索栏上传按钮+图库持久化（小改动位 41→42·新功能轮·补丁归零；2026-09-14）——用户
//   「那个添加图片的弹窗是左侧上传右侧搜索 我希望当弹窗出现时是直接打开搜索然后上传按钮放到搜索栏的右侧放置一个上传
//   按钮，然后为什么我上传的图片没办法在全部看见和在我的图库看见？」；探针实证（tmp-probe-imglib-userflow.js 真实点
//   击路径）：图库=画布扫描派生视图——换文章/新画布后旧上传在图库全部「消失」，且上传后有图卡再点不弹（v10.28.7 防
//   误触守卫）无路回图库；修法：①点无图国旗/国徽卡直开图片库（图源选择器 flagSourceModal 弹窗+函数整体移除，打开即
//   焦点落搜索框）②上传按钮并入搜索栏右侧（上传→图片信息弹窗→保存→图落到卡+图库保持打开+网格立刻出现新图并选中——
//   当场看见）③图库升级持久库 slati_img_library（localStorage 上限 2.5MB 给草稿让配额、ts 最旧 FIFO 淘汰、单图超限
//   不入库 toast；全部 8+ 上传入口共用 choke point imgMetaSave→imgLibPut 一处写入全覆盖，铅笔编辑 syncLibMeta/删除
//   removeLibUsages 同步 store；未来真库=后端 Cloud Storage+DB 后迁移）；有图卡点按保持不弹（防误触口径零回归）；
//   零草稿字段（v 保持 9）；FC v10.28.32.0（小更新位 31→32）；电池 imglib-v2 21/21 新 + img-library 44/44 + pbg-meta
//   38/38 适配 + 复跑 13 组全绿（tier-gating 29/29、caredge-dark 9/9（B2 过渡竞态改收敛轮询最长 30 拍根治偶发红）、
//   page-bg 27/27、migrate-btn 41/41、liquid-glass-static 19/19、premium-multi 106/106、autosave-interval 12/12、
//   fc-undo 15/15、group-shapes 17/17、merge-dir 19/19、merge-far 12/12；group-resize 31/34 三红（S9/S15/S17）
//   与 0dd2153 证据同值仅注释不设门禁）（rev 00216-zc9）
// v0.2.42.1 = 合并组整体缩放贴齐缝保持（补丁位 0→1·纯修复轮；2026-09-14）——用户「现在是当卡片合并后调整整体的
//   大小卡片会被拆分但是依旧是整体的就是没有继续保持连接在一起」（问询确认：拖角柄和拖边都会断、表现=卡片之间出现
//   空隙）；根因=整组缩放位置按组框连续缩放、成员尺寸各自整格量化 → 每卡右/底缘各自圆整，贴齐缝裂开最多半格
//   （探针 tmp-probe-seams.js cs=22 口径实测：e+120 裂 +3.1、se+45/+35 裂 +6.4、锁旗 se+120/+20 裂 +40.1、
//   e−20 裂 +9.7、nw−40/−30 裂 +6.4——肉眼可见）且去重叠链只推开重叠从不把缝拉回、提交不重排 → 缝隙随草稿持
//   久化；修法=贴齐缝保持——beginResize 组分支快照起点贴齐的缝对 xSeams/ySeams（隐藏成员跳过），onGroupResizeMove
//   每帧在去重叠链后闭缝遍把缝对右/下成员拉回锚成员当前边缘恰好贴齐（锚升序一遍级联收敛、严格 > 守卫只拉回绝不造
//   重叠、不改成员尺寸——span 不变量与草稿往返口径不动）；缝对检测顺带记上/下缘钉标记，起点顶齐平且无顶钉的成员
//   记顶对齐对（十字组实证：闭缝遍把中心顶钉住后同顶侧臂随框漂 +8.667 与中心顶裂开、S7 红）——顶对齐跟随每帧把跟
//   随顶拉回锚顶（只上拉绝不下拉、顶钉者作锚左者兜底）；位置仍连续浮点（顺滑手感不变）只补缝；隐藏成员不参与组框
//   /快照（与 refreshResizeHandles 口径一致）；已知限制（注释记录本轮不修）=阶梯/L 形纵并成员保持纵贴齐但可能横移
//   ≤~13px（列共享左缘不是被跟踪的关系，修前重叠场景已存在、本轮消除缝隙后严格变好）；FC v10.28.32.1（补丁位
//   0→1）；电池 group-resize 收紧 S6/S7/S8 贴齐断言+新 W1-W9 缝对场景 41/44（S9/S15/S17 三红与 0dd2153 证据同值
//   仅注释不设门禁）+ 复跑 13 组全绿（group-shapes 17/17：S7 臂顶裂为此轮缝钉自曝回归、顶对齐跟随修复；双击配对
//   竞态改收敛重试根治偶发红）；零草稿字段（v 保持 9）；零后端、ethereal 零改动无需 inline-css（rev 00217-32b）
// v0.2.43.0 = 图库 info 图标+图片信息二级弹窗（小改动位 42→43·新功能轮·补丁归零；2026-09-14）——用户「那么那个搜索图片
//   那边能不能做一个就是别人看见的图片右上角有一个info的icon点击后有一个二级弹窗弹出可以查看图片是谁上传的还有图片的
//   简介这些信息」；问询钦定：①纯前端先做（uploader 字段结构预留，未来真库=后端 Cloud Storage+DB 就绪后对接）②只有公
//   开图片显示（info 图标仅 visibility=public/team 的图——别人看得见的；private 无图标）；修法：①slati_img_library 条目
//   新增 uploader 字段（choke point imgLibPut 一处入库，8+ 上传入口+铅笔编辑全覆盖：自己上传=当前用户 displayName 兜底
//   「你」、Wikimedia 搜索图='Wikimedia Commons'；collectImgLibrary 扫描派生化同口径兜底，旧条目缺 uploader 渲染期补齐
//   绝不重写 store）②图库 tile 右上角新 info 图标（仅 public/team 渲染、right:52px 最外侧不挤铅笔/垃圾桶、stopPropagation
//   不触发选中）③二级只读弹窗 imgInfoModal 叠 flagBrowserModal 上（预览+名称+简介兜底「暂无简介」+上传者+上传时间+可见
//   性+尺寸异步读取；closeModalOnly 只关本窗图库保持开、backdrop 点关最上层、Escape 最先关 info）；零草稿字段（v 保持
//   9）；零后端、ethereal 零改动无需 inline-css；FC v10.28.33.0（小更新位 32→33）；电池 imglib-v2 31/31 新（S8a-S8i 上传
//   者落库/公开图标私有无/二级弹窗内容+Escape 优先关 info/维基兜底/重渲染图标保持）+ img-library 44/44 + 复跑 13 组全绿
//   （autosave-interval 12/12：S3a/S7 遮罩竞态改收敛轮询根治——settings 遮罩 active 在 rAF 里挂、固定 300ms 高负载下偶
//   发红；caredge-dark 9/9、fc-undo 15/15、group-shapes 17/17、merge-dir 19/19、merge-far 12/12、migrate-btn 41/41、
//   page-bg 27/27、pbg-meta 38/38、tier-gating 29/29；group-resize 41/44 三红与 0dd2153 证据同值仅注释不设门禁）
//   （rev 00218-ftt）
// v0.2.44.0 = 订阅页学生价 RM5.50 学校邮箱验证码认证（小改动位 43→44·新功能轮·补丁归零；2026-09-14）——用户「然后在订阅
//   那边添加一个学生价格，以RM5为标准，认证方式使用学生电子邮件接受认证码/邮件进行认证」（中途修正「改成RM5.50」）；
//   问询钦定：①两价并存——Basic 常规价 RM12/月人人可买无需认证，已认证学生解锁 RM5.50/月（Basic 卡双价格状态）②只做
//   A 邮箱码——学校邮箱验证码全自动认证（复用 W6 email_codes 基建，purpose 'student_verify'、独立限流桶 sv:email/sv:ip/
//   svf:ip），B 学生证人工审核留待 W3 tickets 轮（弹窗提示「即将上线」）③edu 域名白名单——内置 19 学校域名后缀
//   （students.js DEFAULT_DOMAINS），env STUDENT_EMAIL_DOMAINS 可整表覆盖，白名单外显式 400 STUDENT_EMAIL_DOMAIN
//   ④Stripe 建价=用户建——STRIPE_PRICE_BASIC_STUDENT（RM5.50 月付 MYR）+ STRIPE_PRICE_BASIC_STUDENT_ONCE（RM55 年付
//   MYR，月价×10 送 2、折合 RM4.58/月）部署时回填 env，缺价 checkout 走既有 409 如实 toast；设计口径：学生价仅 MYR 结算
//   （非 MYR 认证仍可做、注明「学生价仅限 MYR 结算」）；认证有效期 365 天（config.student.ttlMs）过期读取路径惰性清除
//   （students.js studentRefresh，同 tier 惰性降级口径，无 cron）；payments.promo_id='student' 记录促销来源，applyPaid/
//   tier 状态机零改动（学生价仍是 basic tier）；迁移 021（users 四列 student_email/student_verified_at/student_expires_at/
//   student_source + email_codes 重建扩 purpose 枚举，user_version 20→21，health 58 表不变）；后端测试 273/273（student-
//   verify 13 用例新）；前端 premium.html Basic 卡双态渲染（RM5.50+原价划线+✓ 学生认证徽章/未认证入口链）+ 学生认证弹窗
//   （三步：学校邮箱→六格 OTP 60s 倒计时→成功；输满即验/粘贴分发/退格跳格同 forgot-password 口径；Escape/backdrop 关、
//   每次打开重置）；法务 financial-terms 两文件+terms.html 价格表学生优惠注同步「常规价 RM12/月；学生用户凭学校邮箱认证
//   后可享学生价 RM5.50/月，认证有效期 365 天」；零草稿字段（v 保持 9）；零 FC 改动（v10.28.33.0 不变）；ethereal 零改动
//   无需 inline-css；电池 student-price 新（F 静态组+S1-S7 浏览器场景+Z 零 console error）+ premium-multi 复跑 + 13 组
//   复跑全绿（group-resize 41/44 三红与 0dd2153 证据同值仅注释不设门禁）（rev 00219-k9k）
// v0.2.44.1 = mono 暗色背景翻黑族 + FC 白底白字按钮修复（补丁位 0→1·观感修复轮；2026-09-14）——用户「你能不能把黑白
//   主题的深色模式背景颜色改成黑色系的而不是原本的蓝色？还有那个FuildCanva里有一些按钮的颜色在深色的黑白主题下是是白底
//   白字的」；扫描探针（tmp-monodark-discover.js）实证：暗 mono 全表面仍蓝紫家族（FC 两页 html/body/卡片/网格画布/输入框
//   /弹窗/侧栏全 h=240°）——真身=暗蓝紫表面令牌（--color-background #161625、--card-bg rgba(30,30,50,.55) 等）从未按
//   mono 翻；白底白字真身=暗 mono 主色近白 #ececf2 当按钮底+硬编码白字（可见 3 处 col-btn.active/tim-search-btn/
//   pbg-ratio-btn.active + 隐藏面板同模式 caption-*/vp-btn.active 等）——修法全在 settings-modal.js：①mono 暗令牌族
//   （背景/表面/容器/玻璃/卡片/输入/弹窗/侧栏/outline 全翻中性黑族 #0b0b0d~#2a2a2f；按钮黑族保留 v0.2.28.15 用户钦定
//   配方不动）②active 按钮族一条规则全翻纯黑族 #32324a 白字 ③progress-step 圆点同修 ④toast 硬编码蓝 #1e1c32 翻黑族
//   （编辑器 toast 亦随翻白字，与「深色不白」口径一致）；小指示点（snap-dot/lb-fill/milestone-dot 无文字）保持近白高亮；
//   亮 mono/蓝 theme 零影响；FC v10.28.33.1（补丁位 0→1）；零后端、ethereal 零改动无需 inline-css；
//   电池 monodark 22/22 新（F 静态 4+M1 暗 mono 首页/M2 暗 mono 编辑器/M3 亮 mono 回归/M4 暗蓝回归+Z 零 console error）
//   （rev 00220-57l）
// v0.2.45.0 = FC 三页合一 Douyin 式 URL 视图切换（小改动位 44→45·新功能轮；2026-09-15）——用户「把 FuildCanva 首页
//   除了编辑页面以外的页面切换方式改成这个链接的结构」（参考抖音用户页：一条路径+查询参数决定显示哪个 tab；只参考结构
//   不访问链接）+ 范围钦定「全部并进一个页面，但除了 editor 的页面是独立的那个」：analytics/articles 并入
//   fluidcanvas.html 成为 ?view=analytics / ?view=articles 两个新视图；首页既有三视图（dashboard/content/upload）同步
//   URL 化（?view= + &tab= + &period= + &filter= + &sort=；pushState 前进后退、刷新保留、旧 #hash 首次 replaceState
//   规范化）；两旧页改 ~12 行重定向 stub（JS location.replace + meta refresh 兜底，零后端）；顺带修 articles 独立页
//   自带 bug（内联 onclick 在 IIFE 外解析不到 → 事件委托）；FC v10.28.34.0（小更新位 33→34）；零后端、ethereal 零改动
//   无需 inline-css；电池 fcmerge 52/52 新（F0 静态 5 + A-J 12 场景：裸载/直载子态/pushState/back 不增条目/委托勾选+
//   删除+批量发布 toast/#hash 规范化/stub 重定向/content tab=media/侧栏点击/reload 保留 + K guest 门禁新 spawn +
//   L 零 Runtime exception+零 console error + M 390px 五视图未裁剪溢出不宽于既有基线——M 实证修 #periodTabs 窄屏换行）
//   （rev 00221-vz9）
// v0.2.45.1 = 暗色菜单卡白顶线修复（补丁位 0→1·观感修复轮；2026-09-15）——用户「FC 首页左侧菜单上方有一个白白的东西？
//   在深色模式下才看得见」；真身=3D 菜单卡顶部 inline box-shadow inset 0 1px 0 rgba(255,255,255,0.8) 白高光线
//   （hover 内联加亮到 0.9；亮色卡上隐形、暗色卡上独亮——扫描探针+像素分析实证左列唯一非文字亮块 72×1px 峰值亮度≈230）；
//   修法=暗色 :root[data-theme="dark"] .tilt-container:not(.card) 覆写 box-shadow（外侧深投影保留，!important 压过内联
//   rest/hover 两态，channelOverview/channelSummary 等 .card 卡除外）；亮色零触碰；零后端、ethereal 零改动无需 inline-css
//   （rev 00222-ww8）
// v0.2.45.2 = FC 首页频道卡边缘光+切换卡顿修复（用户「为什么FC首页顶部的那个个人频道和团队频道的那个边缘的亮光那么
//   割裂，然后顶部的频道切换动画很卡」）+ 编辑器掉帧根治（补丁位 1→2·性能修复轮；2026-09-15）——①首页：暗色 active
//   账户卡边缘统一语言（白细线边框+底部内嵌主色指示条——割裂真身=旧高亮描边+反光条杂拼）；切换期 tilt 倾斜冻结
//   （data-tilt-off token + tilt.js _slatiTiltBound 去重/守卫，切换窗口内 mousemove/mouseleave 不重算倾斜）、统一
//   0.15s/0.2s 退出+200ms 交换+0.02s 交错进入+420ms 解冻、LG.scan 延迟 420ms 避让切换窗口、过渡 0.5s→0.35s；
//   ②编辑器：用户「能不能顺便优化一下整个FC的代码因为连文章编辑那边的操作都有明显的掉帧」；探针 tmp-probe-editor-jank
//   实证真身：①隐藏弹窗（旧隐藏态只 opacity:0 仍每帧渲染）
//   玻璃卡 blur(32px)+卡内无限转圈动画 → 编辑器静息 15fps（二分：摘转圈条 17→52 帧/秒）→ modal-card 隐藏态
//   visibility:hidden + 隐藏态卡内动画全停（animation:none !important 连伪元素；打开 .active 规则失配动画照常起播）
//   静息回 60fps（91 帧/1.5s max 17ms）；②拖拽/缩放/旋转/表格手柄期间玻璃面 backdrop-filter 每帧重采样重光栅
//   （A/B 实证禁玻璃后同拖拽 15 慢帧→0）→ body.fc-moving 全页玻璃暂离+组背景 drop-shadow 栈挂起，提交后下一帧还原；
//   ③拖拽 125Hz 事件 rAF 合并（每帧一次吸合/吸附/落位）+ 拖拽期尺寸缓存（强排读 1421→93/60 事件）+ 缩放/旋转/手柄
//   同步合并；序列化链（buildDraft/stringify 含 546KB pageBg 仅 0.9ms）与处理器（onContentChange 0.1ms）实测无辜；
//   剩余探针慢帧=无头 SwiftShader 软件重绘伪影（真实 GPU 合成不存在，A/B 禁玻璃后同段干净）；零草稿字段（v 保持 9）；
//   零后端、ethereal 零改动无需 inline-css
//   （rev 00223-znx）
// v0.2.46.0 = 文章查看器（其他用户看已发布文章，格子范围硬裁剪——小改动位 45→46·新功能轮；2026-09-15）——用户「现在能不能做一下当我发布文章后其他用户看见这个文章的界面？我要求它的显示范围只有那个格子的范围超出格子就无法显示」：编辑器 ?article=ART-xxx 查看模式（复用 applyDraft 全量渲染器零复制：chrome 全隐+只读硬化+游客可看已发布）+ 格范围硬裁剪（画布包进 #fcViewScaler overflow:hidden + 等比缩放适配视口，越界卡片/超出画布的背景一律不可见）；首页 ?view=articles 列表接云端（GET /api/articles：published 全部+本人各状态置顶合并）+ View 按钮接线查看器 + ART-001 样例正文（demo store 兜底零后端可演示）；零草稿字段（v 保持 9）；零后端、ethereal 零改动无需 inline-css
//   （rev 00224-k5l）
// v0.2.46.1 = 文章发布去除「提交审核」段——发布即公开（补丁位 0→1·发布流程修复轮；2026-09-15）——用户「呃那个我点击
//   上传时是提交审核你能不能先去除掉这一段？」；根因=原 P7 审核管线从未接文章，POST 恒存 pending 永卡死（作者自己可见、
//   他人永远 404）——并非「审核中」而是「没人审」；修法=POST /api/articles 直存 status='published'（响应同带 published）、
//   编辑器 publishCloudArticle 成功态改 badge-success「Published」+ toast「已发布」、查看器占位文案去掉「审核中」；迁移
//   022 把遗留 pending 文章一律转 published（无新表 health 58 不变、user_version 21→22）；GET 列表/详情对遗留 pending
//   防御口径保留（本人可见、他人 404）——GET 路由零改动；零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css；
//   测试 273/273（文章 test 3 重写：直接 published 语义 + 匿名立即可见 + 他人可取全文 + 遗留 pending 防御 + 迁移 022
//   新测试：遗留 pending 转 published/hidden 不动/updated_at 不虚报；三处 user_version 断言 21→22）；电池
//   article-view 38/38 复跑全绿（37 项原断言 + F0-6 发布即公开静态：badge-success+已发布 toast+占位文案无审核；
//   pending fixture 走占位状态卡的防御路径断言仍有效）；后端 v0.2.46.1 + FC v10.28.35.1 双线
//   （rev 00225-6v6）
// v0.2.46.2 = 注册/登录页验证码独立发码按钮（补丁位 1→2·纯修复轮；2026-09-15）——用户「注册页面的验证码能不能单独放一个按钮要不然新用户不知道点击哪里获得验证码」；真身=api 模式下发码藏在主按钮首击（点 Create Account 先发码、按钮文字变 Resend in Xs、第二次点击才验证），新用户看不出点哪里拿码；修法=验证码输入框旁新增显式 Send Code 按钮（flex 并排；倒计时挂发码按钮——Resend in Xs 禁用 → Resend Code 恢复；主按钮文案恒常 Create Account / Enter Console 不再变身）；主按钮首击仍自动发码（旧路径零破坏）、发码成功后焦点落验证码框、codeSent 发码后保持 true（倒计时结束后主按钮带码点击恒走验证不再重发）；登录侧同款（同页同模式）；demo 模式零变化（验证码组隐藏不渲染）；FC v10.28.35.1 零改动、零草稿字段（v 保持 9）、零后端、ethereal 零改动无需 inline-css
//   （rev 00226-q4b）
// v0.2.47.0 = 验证码输入框升级六格 OTP 组件（小改动位 46→47·新功能轮；2026-09-15）——用户「能不能把输入验证码的收入框换成这个」（粘贴 shadcn/motion 的 React OtpInput 组件源码：六格输入+字符弹入+光标闪烁+错误抖动+状态行）；站无 React（纯 HTML/JS 前端）→ 原生 JS/CSS 1:1 复刻（视觉对齐站点 forgot-password .rp-cell 玻璃语言、复用主题令牌自动适配暗色）：6 格自动跳格/整段粘贴分发（非数字字符过滤）/退格跳格+Delete/方向键+Home+End/焦点自动选格并跳回首个空位/字符弹入动画+错误抖动（prefers-reduced-motion 全灭）/错误态红框+信息行变红+焦点回首格（已填值保留——同组件口径）；发码成功焦点落首格；倒计时挂发码按钮、主按钮首击自动发码、429 限流提示、demo 模式零变化——上一轮机制零改动；登录侧同款（同页同模式）；FC v10.28.35.1 零改动、零草稿字段（v 保持 9）、零后端、ethereal 零改动无需 inline-css
//   （rev 00227-mmk）
// v0.2.48.0 = 等级经验值重平衡（小改动位 47→48·数值平衡轮；2026-09-15）——用户「不是啊那个涨等级经验值是怎么涨的」
//   问询机制后给出新数值表「每天登录 +5 完成新手引导 +10 创建话题 +5 创建文章 +15 lv1 需要 1200 个经验 2 需要2400 3需
//   要4800 4需要9600 5需要19200 6需要38400 7需要76800 8需要153600 9需要307200 10需要614400 11需要1228800 12需要
//   2457600」；问询钦定：①提交国家/提交世界原各 +150——保留不变 ②「lv1 需要 1200」=0 经验就是 Lv1（Lv1 起 0、Lv2
//   1200、Lv3 2400……Lv12 1228800 累计阈值，最后的 2457600 用不上）；LEVELS 10 级改 12 级（need 0/1200/2400/4800/
//   9600/19200/38400/76800/153600/307200/614400/1228800；前 10 称号沿用旅行者→君主，新 Lv11 皇帝/Lv12 传奇——称号
//   可随时改名）；经验来源重平衡：每日登录 20→5、新手引导 50→10、创建话题 80→5、发布文章 100→15（编辑器两处）；
//   创建卡片 +10 未在表中保持原值；等级判定/徽章/进度条公式零改动（新表自动适配，Lv1 0 经验起进度恒非负）；
//   零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css；FC v10.28.35.2（补丁位 1→2：编辑器 XP 钩子数值
//   随动）；电池 xp-rebalance 新 + tier-gating 钉更新复跑全绿
//   （rev 00228-w6f）
// v0.2.49.0 = 社交互动经验值来源（小改动位 48→49·新功能轮；2026-09-16）——用户逐字两段「发布一个评论 +2 一篇文章 +120
//   发帖 +25，一个粉丝 +25 一个赞 +15，获得一个评论 +10」+「一个保存 +12」；问询钦定：①文章「发布新文章是 +120，更新
//   文章是 +5」→ 草稿首次发布算新 +120、同一份草稿之后任何再发布（哪怕改了内容）+5、草稿清空重写才回到 +120
//   （fluidcanvas-editor 旗子 slati_article_published 判定：首发布 120/再发布 5，仅 addXP 成功才置旗、草稿清空重置）
//   ②发帖「两个都要」= 社区发帖 +25 立得、创建话题也 +25 但无立即奖励（旧 +5 移除）——话题须保持至少 30 天连续活跃度
//   才结算：活跃日=当天 ≥10 个不同用户各发至少一帖（用户钦定平台热度口径），连续 30 活跃日且话题创建满 30 天 → 每话题
//   +25（前端 pending 队列 + GET /api/social/activity 结算，断档只延迟不清零）③赞/保存「都是获得」= 获得赞 +15、获得
//   收藏 +12（「保存」=帖子星标收藏按钮）④获得类经验「后端实时记录」= 后端 users 新列 xp_gained（迁移 023）在别人操作
//   时直接写库（一个粉丝 +25/一个赞 +15/获得一个评论 +10/一个收藏 +12；重复赞藏关幂等不二记、自赞自评自藏不记、取消不
//   扣回），登录/刷新经 /auth/me 同步前端徽章；双轨架构=动作类 XP 走前端 localStorage addXP、获得类走后端 xp_gained，
//   总经验=本地+获得（getLevelState 内部合计——sidebar.js 零改动，等级表/徽章/进度条公式零改动）；GET /api/social/activity
//   公开端点（60 天窗口、UTC 日域、缺失日补 0、posters≥10 旗 active）；零草稿字段（v 保持 9）、ethereal 零改动无需
//   inline-css；后端测试 282/282（+9 新：XP 记分幂等/自操作排除/removed·hold 口径/activity 端点锚点模式）
//   （rev 00229-d4z）
// v0.2.49.1 = 黑白主题切页闪修复（补丁位 0→1·观感修复轮；2026-09-16）——用户「那个黑白主题在切换页面时会先显示默认
//   主题的颜色再转变成黑白主题的颜色」；真身=mono 规则与 data-accent 全靠 settings-modal.js 在 body 末尾运行时注入
//   → 首帧先画蓝家族再跳黑白；修法三件：①mono 主题色规则整体迁入 ethereal.css（随 inline-css.js 内联进 40 页，首帧
//   即黑白；弹窗实时切换仍走 applyAccent 只开关 html 属性）②29 页 head 内联「防主题白闪」块同步落 data-accent
//   （theme-init.js 原版源同步）③settings-modal.js 注入样式只剩弹窗 UI 规则；零后端、零草稿字段（v 保持 9）；
//   FC v10.28.35.4（补丁位 3→4：FC 两页 head 块随修 + FC mono 规则随迁 ethereal）
//   （rev 00231-8bp）
// v0.2.49.2 = 黑白主题暗色白底白字适配（补丁位 1→2·观感修复轮；2026-09-17）——用户「那个后端的黑白主题有出现白底白字
//   的情况你再适配一下」；全站扫描器（CDP 计算态+祖先链 alpha 合成）锁定 6 页 30 处：mono dark 把主/次色翻浅灰白
//   （#ececf2/#b0b0c2），任何用 var(--color-primary)/var(--color-secondary) 作底+硬编码白字的组件变白底白字；修法：
//   ①messages 页 JS 模板/按钮全量加 msg-acc 类 → 暗 mono 翻深底 #32324a（页内局部规则）②explore 国家代码圆片加
//   world-code-chip 类 → 深灰渐变（#32324a→#2c2c3e）③help .step-num 渐变翻深灰 ④registry-step-3 .stepper-btn
//   硬编码白底 → 所有暗色主题翻深面（白底白字全暗色通病非 mono 独有）⑤admin 裸 .btn（UA buttonface 白底）→ 暗色翻深面；
//   扫描器本身两处修正（渐变只祖先曾因标签已置被跳过→伪白卡误报；背景-clip:text/伪元素滤镜豁免）；扫描复跑暗 mono
//   0 处、亮 mono 0 处回归；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css（五页修复全在页内局部规则）
//   （rev 00234-vs4）
// v0.2.49.3 = 后端黑白主题暗色白底白字第二轮（补丁位 2→3·观感修复轮；2026-09-17）——用户「我在黑白主题的深色模式下看
//   后端还是一样是有白底白字的问题尤其是按钮」；真身=第一轮 admin 修复只盖了静态可见的登录门 #gateLogoutBtn，登录后
//   面板 JS 渲染的裸 .btn（顶栏退出登录、← 返回列表、标记、标记跟进、应用、分页上一页/下一页）全部漏网——真实后端
//   +真实登录 CDP 探针（临时库+种子+mailer 桩码，wow2 扫描器逐区块扫）锁定：裸 .btn 无背景规则 → Chrome UA
//   buttonface 白底 + 继承浅字；修法：admin 页内局部规则泛化「:root[data-theme="dark"] .btn:not(.btn-primary):
//   not(.btn-secondary):not(.btn-outline):not(.btn-ghost) → 深面+浅字」一次盖全（UA buttonface 通病 all accents
//   通用非 mono 独有，:not 排除变体不盖 btn-primary 已有暗色规则）；零后端、零草稿字段（v 保持 9）、ethereal 零改动
//   无需 inline-css；新电池 admin-dark 22/22（mono 暗 17：登录页/重置视图/面板七区块 wow2 零白底白字+启用分页暗底+
//   按钮族计算态；蓝暗回归 4；控制台零错误）+monodark 29/29（F5 泛化规则静态锚）+mono-flash 22/22 复跑全绿
//   （rev 00235-ltg）
// v0.2.49.4 = 后台左侧菜单合并单卡（补丁位 3→4·观感修复轮；2026-09-17）——用户「你把后端的左侧菜单调一下，现在是每个按钮
//   一个卡片，能不能改成一个卡片，只是给按钮分组加上组别名称而已」；改法：renderNav 12 组 .sidebar-module 每组一卡
//   → 1 张 .sidebar-module.nav-card 内包 12 个 .nav-group 块（组名/图标/.soon 徽章/href/active 全保留，route() 零改动，
//   菜单层无权限过滤口径不动）；组间 border-top 细分隔线 + 组名小字弱化（全主题令牌，暗色自动适配）；零后端、
//   零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css；smoke-admin 导航断言同步改 1 卡 + 12 组 49/49 全绿
//   （rev 00236-2wv）
// v0.2.49.5 = 后台菜单单卡扁平化（补丁位 4→5·观感修复轮；2026-09-17）——用户「我希望是做到和前端一样…那个W啥的
//   能不能去掉…能不能只有和前端一样的一层卡片而不是这个这样的多层卡片」；改法：renderNav 组块结构全部拆除 → 1 张
//   .sidebar-module.nav-card 内 23 个扁平 .nav-item（组名/W3-5 徽章全去、图标取各组图标、href/active 全保留、
//   route() 零改动、菜单层无权限过滤口径不动）；.nav-item 尺寸对齐前端（gap 12/padding 10 14/图标 20/fs-label-md）、
//   .nav-card padding var(--space-sm)（仿前端 nav-module）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段
//   （v 保持 9）、ethereal 零改动无需 inline-css；smoke-admin 48/48（导航断言并成 1 卡+23 条目+零组块+零徽章，
//   总断言数 49→48）；部署一次 exit 0（env 30 条从 describe 全量重建）；curl 链 5/5
//   （rev 00237-rct）
// v0.2.49.6 = 后台菜单分类标题回补（补丁位 5→6·观感修复轮；2026-09-17）——用户「不是你没有分类题目」；上轮
//   （00237-rct）扁平化把组名一起拆掉了——本轮把 12 个组名（en+zh 双行小字，主题令牌 var(--color-outline)）
//   回补进单卡：1 张 .sidebar-module.nav-card 内 12 个 .nav-group-title 分类标题 + 23 个图标条目，组间纯留白
//   无分隔线（无嵌套卡片感）、W 徽章仍无；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、
//   ethereal 零改动无需 inline-css；smoke-admin 48/48（导航断言 1 卡+12 标题+23 条目+零徽章）；部署一次
//   exit 0（env 30 条从 describe 全量重建）；curl 链 5/5
//   （rev 00238-b8v）
// v0.2.49.7 = 后台菜单分类合并（补丁位 6→7·观感修复轮；2026-09-17）——用户「用户，分析，内容，社区不需要单独的
//   分类全部放在总览的分类内」；改法：NAV 数据不动（TODO 注册表/图标/点击流全保留），renderNav 视觉分组
//   Analytics/Users/Content/Community 并入「Dashboard 总览」（各条目保留原图标）→ 分类 12→8（总览 5 条目 +
//   财务 8 + 客服/AI/安全/平台/审计 5 组 + 工作人员 5）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段
//   （v 保持 9）、ethereal 零改动无需 inline-css；smoke-admin 48/48（导航断言 1 卡+8 标题+23 条目+零徽章）；
//   部署一次 exit 0（env 30 条从 describe 全量重建）；curl 链 3/3
//   （rev 00239-phh）
// v0.2.49.8 = Messages 页动画掉帧优化（补丁位 7→8·性能修复轮；2026-09-17）——用户「现在是Messages 那边的动画有明显
//   掉帧请优化一下」；CDP 帧间隔探针（transition/animation 事件开窗只计动画进行中的帧，多轮取中位+暖机）锁定：
//   面板切换 0.55s 滑动期间只出 11-13 帧（60fps 应 33，均帧 51-65ms）、侧栏 width 折叠均帧 100ms、公告滚动
//   45% 帧超 20ms；主线程零长任务 → 成本全在合成/光栅侧；修法七刀：①#msgSlide will-change:transform 层提升
//   （滑动=移动缓存位图不再逐帧重绘 3× 宽滑轨）②三面板切换时的 opacity 渐隐 0.4s 改瞬时（渐隐让含磨砂卡的面板
//   滑动期间逐帧重采背景）③announceList CSS mask 移除（mask 强制滚动/滑动逐帧重栅格列表区）④本页 19 处
//   transition:all → 显式属性列表（.btn/.input-glass/.modal-card/.card-hover/.subnav-pill/.upload-zone/
//   .segmented-option/infoTab/群类型按钮/公告卡；公告卡只留 box-shadow 让 tilt 即时跟手不逐 mousemove 重启过渡）
//   ⑤侧栏折叠 width 0.3s ease → 0.25s cubic-bezier(0.22,0.61,0.36,1) 锐曲线 ⑥.msg-row.fade-up will-change
//   ⑦.card-hover 过渡移基类（悬停抬升双向平滑）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、
//   ethereal 零改动无需 inline-css；新电池 msg-anim 31/31（F0 静态 11 + 功能回归 M1-M8 + 帧健康 M9 + 控制台零错误）
//   （rev 00240-gs4）
// v0.2.49.9 = 页面切换掉帧优化（补丁位 8→9·性能修复轮；2026-09-17）——用户「在页面切换的的时候会掉帧卡顿，你再优化
//   一下」；真身=transitions.js 切页进出场动画三病（探针跨文档测量：pagehide 快照退出窗口 + 新文档读入场窗口）：
//   ①入场给全页每张 .card 写 inline transition「opacity 0.4s + transform 0.4s」并逐张 stagger 60ms——fade opacity
//   让磨砂卡族逐帧重采样背景（全页版 Messages 面板渐隐同病；修前入场均帧 75-129ms、64-100% 帧超 20ms、落定近 2s）
//   ②入场 stagger 长尾全卡排队（事件量 112-124 起落）+ inline transition 永不回收——0.4s 橡皮筋永久污染全站
//   hover/tilt，甚至盖掉上一轮 Messages 公告卡的 box-shadow-only 过渡（每次切页进 Messages tilt 又拖 0.4s，探针
//   实证 computed transition 被盖）③退出动画同样 fade opacity（.app-main 整页渐隐/水平逐卡渐隐）；修法（只动
//   transitions.js）：进出场全部 transform-only 不 fade（同 Messages 修法②）·入场波浪头只做前 8 个元素其余零动画
//   零内联残留 ·动画结束 transitionend/cancel 回收 inline transition（恢复卡片自带过渡；隐藏卡 display:none 不
//   渲染、transitionend 永不触发 → 另加 600ms 兜底定时强制清理——电池 M2d 抓到 dashboard 1/18 后补的第五刀）
//   ·stagger 60→40ms ·退出计时 240→220ms/280→240ms；修后：事件量 38/34/30（降 ~3 倍）、dashboard 落定
//   1931→799ms、污染 7/7→0/7（含隐藏卡兜底后 0/18 全干净）、Messages 公告卡 computed 恢复 box-shadow 0.25s；
//   FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css
//   （rev 00241-9lj）⚠观感修法已于 v0.2.50.1 按用户纠正整体回滚——本轮的 transform-only/波浪头 8 张上限/
//   去渐隐/快节奏全部恢复原样，仅保留「动画结束 transitionend/cancel 回收 inline transition + 隐藏卡兜底
//   定时清理」两个不改变观感的隐形修复（详见 v0.2.50.1 注记）
// v0.2.50.0 = Messages 链接抖音式结构（小改动位 49→50·新功能轮；2026-09-17）——用户「能不能把Message的链接的结构
//   改成这种？https://www.douyin.com/user/self?from_tab_name=main&showSubTab=compilation&showTab=favorite_collection」
//   （问询钦定三件套：路径不动 / 只加 showTab= / 点 tab 地址栏跟着变）；改法（messages.html）：①URL 参数直达
//   ?showTab=announcements|groups 直接开对应 tab（private 默认；旧 ?tab= 兼容读取）②switchToPanel 尾部
//   replaceState 联动——点 tab 地址栏实时更新（private 回到干净路径、不刷新不进历史，抖音式体验）
//   ③index.html「View all announcements」链接 ?tab=announcements → ?showTab=announcements；零后端、零草稿字段
//   （v 保持 9）、ethereal 零改动无需 inline-css、FC 零改动（v10.28.35.4 保持）
//   （rev 00242-p77）
// v0.2.50.1 = 切页动画观感恢复（补丁位 0→1·口径修正轮；2026-09-17）——用户纠正「为什么你要简化页面之间的切换？？
//   那个你不能动你知道吗？」：transitions.js 进出场动画观感是用户钦定设计——v0.2.49.9 的性能简化修法
//   （transform-only 不渐隐 / 入场波浪头只做前 8 张 / stagger 60→40ms / 退出计时 240→220/280→240ms）
//   整体回滚，恢复原样观感（全卡片 opacity+transform 渐隐波浪入场、0.4s 橡皮筋节奏、退出渐隐、计时
//   240/280ms 全数回来）；只保留两个不改变观感的隐形修复：①动画结束 transitionend/cancel 回收 inline
//   transition（写前先记 prevOpacity/prevTransition/prevDelay，回收还原——0.4s 橡皮筋不再污染 hover/tilt，
//   如 Messages 公告卡 box-shadow-only 过渡被盖）②隐藏卡（display:none 不渲染、transitionend 永不触发）
//   600ms 兜底定时强制清理（done 守卫幂等，保证零残留）；进出场退出路径保持原样（页面 240/280ms 后
//   即销毁，无残留顾虑）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动
//   无需 inline-css
//   （rev 00243-hls）
// v0.2.50.2 = Messages 页专属轻量切页模式（补丁位 1→2·口径修正轮；2026-09-17）——用户「不是你之间撤销到
//   我要求你优化message页面之前」：v0.2.50.1 观感恢复后进入 Messages 的 63 张卡全卡渐隐波浪 ~4s 才落定，
//   用户纠正此页应保持轻量；改法（只动 transitions.js）：49.9 轻量修法（transform-only 不渐隐 / 入场波浪头
//   只做前 STAGGER_CAP=8 张 / 40ms / 退出计时 220-240ms）作为 LIGHT 分支只作用于进入/离开 messages.html
//   （脚本加载时按当前页判定）——其余页面切页保持 50.1 恢复的原样观感（全卡渐隐波浪/0.4s 橡皮筋/退出渐隐/
//   计时 240/280 全不动）；两个隐形修复（transitionend/cancel 回收 + 隐藏卡兜底）双模式都保留；Messages
//   页内部 49.8 七刀本就零改动（未受影响）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、
//   ethereal 零改动无需 inline-css
//   （rev 00244-6db）
// v0.2.50.3 = 切页进场帧健康隐形修复（补丁位 2→3·隐形性能轮；2026-09-17）——用户「之前Gemini都说了会掉帧
//   卡顿现在出现了……之前的那个淡入的效果也是很卡也不一致」+ 钦定「不可以取舍任何限制拥有的所有过渡动画」
//   （所有动画一个不少、观感零变化）；诊断：入场波浪 opacity<1 让磨砂卡（.card blur 24px/.search-capsule
//   16px/.auth-card 32px）逐帧重采样背景 = 掉帧主因（基线电池实证 dashboard 波浪 75% 帧 >20ms、max 233ms），
//   淡入不一致 = 逐卡 setTimeout 离帧起播 + 欢迎卡 animate-fade-in-up 关键帧与波浪两套动画互搏；改法
//   （只动 transitions.js，三刀全隐形）：①rAF 批量波浪替换逐卡 setTimeout（起播帧对齐、同一帧到点的卡一次
//   style 批量写入；节奏 60/40ms、时长、缓动、LIGHT cap 8 逐字不动，起播量化 ≤1 帧）②动画期间写 inline
//   will-change 层提升（背景只采样一次、opacity/transform 走合成器；cleanup 还原原值，退出双分支同写页面即
//   销毁无需清理）③双动画守卫（hasActiveOpacityAnim 查 phase/fill——已有覆盖 opacity/transform 的关键帧
//   动画的卡跳过一切内联写入，关键帧照常淡入）；另加 rAF 挂起兜底定时（后台标签打开时强制起播剩余卡）；
//   FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css、页面
//   HTML 零改动
//   （rev 00245-g89）
// v0.2.50.4 = 守卫收窄修复（补丁位 3→4·纯修复轮；2026-09-18）——用户报告部分页面切页上下淡出淡入动画
//   「不见或乱透了」；诊断：50.3 双动画守卫 hasActiveOpacityAnim 的 getAnimations() 也会返回运行中的 CSS
//   过渡——boot 解除 pre-stagger 的同一 tick 里守卫强制刷样式，.card 基类 transition: all 0.2s（覆盖
//   opacity）当场起 0→1 过渡（探针实证 dashboard 10 张卡、community-hub 1 张卡中招），progress=0<1/
//   真实浏览器 phase=active → 误判「已有关键帧动画」→ 整卡跳过波浪（旧电池 76 starts 被 pre-stagger
//   过渡的 transitionstart 污染没抓到）；修法（只动 transitions.js）：守卫收窄为只认 CSS 关键帧动画
//   （构造器 CSSTransition + transitionProperty 双重过滤）；欢迎卡 animate-fade-in-up 是 CSSAnimation
//   照常正确跳过——所有动画一个不少，节奏/时长/缓动/双模式逐字不动；探针 23/23（11 页 boot 捕获重放 +
//   每页漏动画=0 + would-skip 集合正确）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、
//   ethereal 零改动无需 inline-css、页面 HTML 零改动
//   （rev 00246-47s）
// v0.2.50.5 = Messages 移除测试群和聊天（补丁位 4→5·口径修正轮；2026-09-18）——用户「能不能把message内
//   测试用的群和聊天去除？」；改法（只动 messages.html）：移除全部演示数据（3 个演示私聊 Marcus Vane/
//   Studio Prime/Sovereign Council + 6 个演示群 + 群成员表 + 演示群消息），会话/群从空开始（新增会话
//   addFriendDemo、建群 createGroupDemo 功能原样保留）；DATA_VERSION 3→4 失效旧 localStorage（旧存档会
//   把已删的测试数据合并复活）；侧栏空列表加空态提示（tap + 开始）；公告保留（用户只要求群和聊天）；
//   云端会话（/api/conversations）不受影响；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、
//   ethereal 零改动无需 inline-css
//   （rev 00247-cmw）
// v0.2.50.6 = Messages Add Friend 改用户 ID 添加（补丁位 5→6·口径修正轮；2026-09-18）——用户「把那个Add
//   Friend Chat 的email添加改成 输入用户id添加」；改法（只动 messages.html）：加好友弹窗输入框从 email
//   改为用户 ID（占位符 User ID (USR-XXXXXX)、说明文案同步），云端模式 POST /conversations 恒发 {userId}
//   （后端本就 userId 优先，零后端改动；email 分支零残留），404 文案「No user found with that ID.」；
//   本地演示模式加好友流程原样；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、
//   ethereal 零改动无需 inline-css
//   （rev 00248-zwk）
// v0.2.50.7 = Messages + 弹窗淡入动画（补丁位 6→7·观感轮；2026-09-18）——用户「那个弹窗出现时能不能添加一个
//   淡入的动画？」；改法（只动 messages.html）：actionModal（Add Friend/Create Group 弹窗）出现时遮罩
//   0.2s 淡入 + 卡片 0.25s 上浮缩放淡入（@keyframes modalFadeIn/modalCardIn，页面专属 CSS 留在页面内）；
//   关闭仍即时（用户只要求淡入）；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、
//   ethereal 零改动无需 inline-css
//   （rev 00249-dll）
// v0.2.50.8 = Messages 搜索栏右侧通知铃铛（补丁位 7→8·观感轮；2026-09-18）——用户「能不能把上方的那个搜索栏
//   统一在右侧和平台首页一样放上一个通知的铃铛？」；改法（只动 messages.html）：搜索胶囊内搜索框右侧加
//   分隔线 + notifications 图标（与平台首页同一结构/样式，首页铃铛目前同为纯展示无点击行为，保持一致）；
//   FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）、ethereal 零改动无需 inline-css
//   （rev 00250-s9m）
// v0.2.51.0 = Messages 好友请求 + 灵动岛通知弹窗（小改动位 50→51·新功能轮；2026-09-18）——用户「这个通知弹窗
//   我希望可以做成有灵动岛效果的，当弹出好友邀请时点击右上角的消息弹窗内的好友邀请右上角整个消息窗会变成
//   一个选择窗口上方中间会显示对方用户名称和ID然后下方左右是同意或不同意的药丸形按钮」（问询钦定真实后端
//   好友请求系统）；
//   后端——迁移 025 friend_requests 表（FR- id、sender/recipient FK、pending/accepted/declined、health
//   58→59 表）；新路由 src/routes/public/friend-requests.js 四端点（发送限流 20/小时/自请求 400/已是好友
//   409/待处理重复 409；GET 待处理列表带发送方公开档案；accept 自动建 DM、decline 标记；dm 去重/建会话抽到
//   dm-shared.js 与 messages.js 共用）；测试 282→294；
//   前端——铃铛 id/onclick + 红点计数徽章；#notifPopup 灵动岛弹窗（铃铛下方右锚定、islandIn 缩放展开 0.28s、
//   列表视图→点邀请整窗 morph 决定视图：上方居中头像+名字+ID、下方左「不同意」右「同意」药丸钮、高度 FLIP
//   过渡+双视图交叉淡入淡出）；云端 GET/accept/decline 真 API（同意后 refreshCloudChat 即时出现新会话）；
//   addFriendDemo 云端分支 POST /conversations → POST /friend-requests（成功文案「✓ 好友请求已发送！」）；
//   demo 模式邀请存 localStorage invites（无预置数据）；FC 零改动（v10.28.35.4 保持）；零草稿字段（v 保持 9）、
//   ethereal 零改动无需 inline-css
//   （rev 00251-44l）
// v0.2.51.1 = 公民号前缀 CIT- → USR- 全栈统一（补丁位 0→1·口径修正轮；2026-09-18）——用户「能不能把CIT改成
//   USR？啊」；
//   后端——auth.js 公民号生成改为恒等于用户 id（USR- 同 seq 天然同号）；迁移 026 存量数据归位（citizen_id
//   NULL 补齐、异值改写为 id；无新表 → health 59 不变）；测试钉 25→26 全同步 + 新 026 迁移测试（017 口径
//   三态验证）；
//   前端——8 处兜底字面量 CIT- → USR-（signup-and-login/sidebar/settings-modal/fluidcanvas/
//   onboarding-identity，真实数据走 /auth/me 零改动）；FC 零改动（v10.28.35.4 保持）；零草稿字段（v 保持 9）、
//   ethereal 零改动无需 inline-css
//   （rev 00252-xgd）
// v0.2.51.2 = 亮色侧栏发黄/暗斑修复（补丁位 1→2·纯修复轮；2026-09-18）——用户「为什么在亮色模式下平台的
//   左侧菜单背景卡片会发黄的还有颜色变深色的？」；真身=亮色侧栏玻璃注入层 .lg-backdrop 的 SVG 三通道
//   折射滤镜（品红噪点位移图把 R/G/B 各推不同距离、蓝推最远 → 边缘剩红+绿=黄晕；噪点斑块=深浅暗斑），
//   暗色同机制已在 2026-09-10 修掉（灭滤镜灭磨砂+铺不透明底），当时注释「亮色主题零触碰」故亮色遗留至今；
//   修法（问询钦定「彻底铺不透明白底」）：ethereal.css 亮色侧栏同样铺满 --sidebar-bg（近纯白 0.95）
//   不透明底 + 灭玻璃注入层滤镜/磨砂（与暗色同款同观感，mono 走 var() 自动适配）；重跑 inline-css.js
//   40 页内联块刷新；FC 零改动（v10.28.35.4 保持）；零后端、零草稿字段（v 保持 9）
//   （rev 00253-np7）
// v0.2.52.0 = 通知铃铛聚合 + 文章点赞/收藏（小改动位 51→52·新功能轮；2026-09-19）——用户「那个铃铛能不能是在Home
//   的时候会显示所有除了公告以外的信息例如谁点赞/收藏了你的帖子，谁点赞/收藏了你的文章，谁关注了你；只有在你进入
//   特定页面时才筛选」（问询钦定：①文章点赞/收藏这轮一起做——平台之前完全没有 ②评论也进通知 ③铃铛就两处：
//   首页=全部通知（除公告，公告是静态区块天然不进通知流）、Messages 页=只显示好友请求（现状天然满足，零改动））；
//   后端：新 GET /api/notifications 七类事件实时聚合（帖子赞/藏、文章赞/藏、帖子评论、关注、好友请求——零迁移：
//   content_likes/favorites 复用 target_type='article'（005 预留无 CHECK），不建事件表不碰 notifications 表；
//   social.js 新增文章点赞/收藏四端点（镜像帖子口径：幂等/异人 XP +15/+12/404 未公开）；articles.js GET /:id
//   扩展 viewCount/likeCount/favoriteCount/likedByMe/favoritedByMe（浏览自增镜像帖子）；测试 295→309 全绿；
//   前端：首页铃铛 dashBellBtn+dashBellBadge 红点（localStorage lastSeen 按用户隔离）+ #dashNotifPopup 灵动岛弹窗
//   （照 messages 观感：缩放展开/好友请求 morph 决定视图同意不同意药丸/15s 轮询/外点 Escape 关闭）；FC 文章查看模式
//   ?article= 右下 #fcViewActions 悬浮操作条（点赞/收藏带计数，乐观更新+回滚，访客 toast 引导登录）
//   （rev 00254-w4f）
// v0.2.53.0 = 个人主页卡片边缘主题（FC 14 主题全量移植；小改动位 52→53·新功能轮；2026-09-19）——用户「能不能把FC里的
//   所有边缘添加到Community 的个人页面内的最上方那一个部分？」（问询钦定：①选择权=本人选、访客可见 ②套用范围=整张
//   header 卡——横幅+头像+名字+简介+统计整卡变边缘剪影 ③订阅门禁=订阅专属 UI-only，FC 同口径渲染器与后端都不查订阅）；
//   community-profile.html：FC EDGE_STYLES 14 款全量逐字移植（paper 破旧的纸/treasure 藏宝图/tech1-6/paint1-6，SVG
//   objectBoundingBox defs 块+剪层/覆盖层/环带 CSS 机制+卡级噪点滤镜 paint5+外板 16px 非油漆专属）；横幅改绝对定位
//   全卡层（background-size 100% 140px 锁顶部带——直接对 140px 盒子 clip 会让 objectBoundingBox y 轴按 140px
//   缩放，tech 底角斜切横穿横幅底边、paint 内缩后整体浮空）+ .profile-body 补 140px padding-top；油漆 cqi 内容内缩
//   （cqi 恒≥剪影内缩保内容在剪影内）；编辑资料弹窗「自定义」tab 加「边缘」区（swatch 网格+迷你剪影预览，diff-only
//   保存；非订阅=锁图标+「订阅后可用」+「订阅」徽标，点击 toast 不生效）；边缘优先于卡片背景板（halo 不挂）；
//   后端：迁移 027 users.card_edge + auth.js/social.js CARD_EDGE_KEYS 双份白名单 + PATCH 校验 + 主页端点公开暴露；
//   测试 309→311 全绿；FC v10.28.36.0 零改动；ethereal/inline-css/entrypoint 零改动
//   （rev 00255-lz2）
// v0.2.53.1 = 边缘选择器真实剪影 + 油漆5 内容扭曲修复（补丁位 0→1·观感修复轮；2026-09-19）——用户「那个边缘的选择在边缘自定义选择那边的展示能不能是整个选择的边缘是用该边缘直接展示的？，还有好像在使用油漆五的时候在FC那边内容也会被他的特效影响到变得扭曲你也修一下」：
//   ①编辑资料弹窗「边缘」区 swatch 从渐变方块改为直显真实剪影（.swatch-shape 内层挂该键真实 clip-path + 族底色
//   渐变，投影挂外层 fill 的 filter 跟随剪影；预览 #editEdgePreview 按当前键写真实 clip-path + cardLayers[0]
//   族底色，旧 pv-edge-* 代表款类删除）②油漆5 噪点撕裂滤镜从卡级移挂剪层/覆盖层（::before/::after）——卡级
//   filter 对整卡渲染结果位移，卡内文字/头像/统计全被噪点扯动（用户反馈「内容也被特效影响变得扭曲」）；CSS 顺序
//   filter→clip-path 下子层位移结果被自身 clip 裁回剪影内、内容层零滤镜完全免疫，剪影边缘墨雾感由纹理特征位移×
//   clip 交互保留；FC 同机制同修（v10.28.36.1）；后端零改动（user_version 27/health 59 表不变）；零草稿字段（v 保持 9）
//   （rev 00256-6bg）
// v0.2.53.2 = 个人页卡片背景液态玻璃换代（用户贴的生成器代码；补丁位 1→2·观感修复轮；2026-09-19）——用户「能不能把那个液态玻璃换成 以下这个代码？」（问询钦定：①只换 Community 个人页编辑资料弹窗「自定义」内的卡片背景玻璃——横幅玻璃预设 + 卡片背景板「标准液态玻璃」，不是全站、不是 FC ②侧栏保持纯色底不装回）：
//   新 #glass-distortion 滤镜（feTurbulence fractalNoise 0.014/2 octaves/seed 92 → feGaussianBlur 2 →
//   feDisplacementMap scale 63 R/G 双通道位移，x/y -20% 140% 区域口径）挂在带 backdrop-filter 的玻璃层上，
//   标准双通道位移不拆颜色通道→无色散不发黄（引擎三通道色散滤镜被页面规则 0,2,0 特异性覆盖）；
//   横幅玻璃层 + 卡片背景板包层磨砂 14/24px→10px（用户代码口径）；横幅模式卡身加半透白霜
//   rgba(255,255,255,0.34)/暗色 rgba(26,26,46,0.58)（用户代码 ::before 白 tint 同思路，卡身有实底调高才透出
//   磨砂折射层；:not(.card-halo) 作用域不压卡片背景板透明卡身）；只动 community-profile.html 页面专块 + defs；
//   ethereal/liquid-glass.js/inline-css/entrypoint 零改动；后端零改动（user_version 27/health 59 表不变）；
//   FC v10.28.36.1 零改动；零草稿字段（v 保持 9）
//   （rev 00257-jl2）
// v0.2.53.3 = 左侧菜单底部空白面板去掉（补丁位 2→3·观感修复轮；2026-09-19）——用户「那个左侧菜单的底部背景能不能去掉？或者变成刚才给你的那个液态玻璃或者只保留那个用户卡片，logo卡片 还有菜单卡片？」（问询钦定「去掉空白面板（推荐）」）：
//   探针实证底部背景真身=菜单卡 flex:1 拉伸到屏幕底部，1080p 下菜单项下面空出一大块空白卡片背景；
//   sidebar.js 菜单卡内联 style 去 flex:1，高度收为内容高——侧栏只剩 logo/用户/菜单三张卡，
//   下方留纯色侧栏底（上轮钦定口径不动）；亮/暗两模式同生效；ethereal/inline-css/entrypoint 零改动
//   （ethereal 零改动无需 inline-css）；后端零改动（user_version 27/health 59 表不变）；
//   FC v10.28.36.1 零改动；零草稿字段（v 保持 9）
//   （rev 00258-7hf）
// v0.2.54.0 = 全站 12 语言 i18n（小改动位 53→54·新功能轮；2026-09-19）——用户「能不能做以下所有语言的适配？新增德语，俄语，马来语，泰语，越南语，印尼语」（问询钦定：①一次性全站 44 页（FC 两页除外）②管理后台也翻 ③语言切换器只在设置弹窗 ④访客首访跟浏览器语言自动选 ⑤加繁体 zh-Hant（OpenCC 机械转换自动生成）⑥加英语 en + 重写电池、加法/西/葡）：
//   12 语言 zh/zh-Hant/en/de/ru/ms/th/vi/id/fr/es/pt；i18n.js LANGS 12 条 + lookup 扁平键优先修复；
//   common.i18n.js（sidebar/settings/aichat/report/verify 共用段）+ 每页 <page>.i18n.js 字典体系；
//   7 个旧 .zh.js（472 键）1:1 迁入新体系后删除；admin 单页应用独立接入 admin.i18n.js；
//   电池统一 --lang=zh-CN + 硬编码中文文案断言改机制断言（期望值=当前语言字典值）；
//   ethereal.css 零改动（不跑 inline-css）；后端零改动（user_version 27/health 59 表不变）；
//   FC v10.28.36.1 零改动；零草稿字段（v 保持 9）
//   （rev 00259-98x）
// v0.2.54.1 = pricing.js 判定链欧洲修复（补丁位 0→1·纯修复轮；2026-09-20）——线上 premium-multi 电池 de-DE→eur 场景稳定超时挖出：
//   Chrome 151 的 setLocaleOverride 不再改 navigator.language（恒 zh-CN）→ 电池 de-DE 场景 loc='zh-cn' 撞
//   China 分支纯语言条件 → key='zh-CN' → usd（EU_TZ 兜底 key==='default' 才生效，永远轮不到）；
//   同构真实缺陷：zh-CN 语言 + 欧元区时区用户（中文浏览器在德国/法国）被 China 分支截胡收 usd 而非 eur——
//   与 v0.2.54.0 新加坡修复（zh 语言新加坡用户多收）同一 bug 的欧洲镜像；
//   修法同哲学（判定链头注释「most accurate first」= 时区优先于语言）：China 分支纯语言条件加 !tz.startsWith('Europe/')
//   限定，欧洲时区留给上方已命中的非欧分支/下方 EU_TZ 兜底；本地探针 de-DE/Berlin→eur + 6 场景零回归 +
//   premium-multi 本地 106/106；电池锚 54.0→54.1（13 电池 15 处）
//   （rev 00260-2jk）
// v0.2.54.2 = i18n 验收修复（补丁位 1→2·纯修复轮；2026-09-20）——用户「为什么在首页和MicroNationary 订阅卡片，和公告的部分还有其他部分都没有被翻译？」：
//   两重根因：①B1 轮「zh 值逐字节=原文」口径下 index/premium/world-created/about/admin 等页 HTML 兜底本就是英文，
//   zh 字典值照搬英文 → 中文浏览器自动选 zh 页面仍英文（index 57%→100%、premium 55%→97%、world-created 58%→100%、
//   about 52 键、admin nav 15 键、全站 93%→97%）；②JS demo 数据数组硬编码英文 0% T() 化（任何语言都不翻译）：
//   index 活动流 4 条 + 公告 10 条 key/En 函数化 + renderActivity/renderAnn/renderMetrics/renderMyWorlds +
//   window.__mnI18nRerender 钩子（i18n.js apply() 触发 listeners，首屏与切语言都重渲染——页面主 script 先于
//   i18n.js 执行的惰性 T() 首屏 fallback 解法）；同模式修复 overview recentContribs、community-hub feedData、
//   messages 公告/好友/群组 demo、activity categories/milestones、following feed/discover/sidebar、workspace assets；
//   新键 29+8+15+... × 11 语言手写 + zh-Hant OpenCC 重跑（幂等管线：哨兵段剥离→stub 捕获全部 add('zh')→cn→tw 转换→追加）；
//   术语保留清单执行（M.NationWorld/MicroNationary/FluidCanvas/Slati Studio/SlatiControl/人名/GDP/USD/GIF/API/OC/
//   代码标识符/althistory-en 英文优先类型全英文步骤=设计豁免）；ethereal/inline-css/entrypoint 零改动；
//   后端零改动（user_version 27/health 59 表不变）；FC v10.28.36.1 零改动；零草稿字段（v 保持 9）
//   （rev 00261-5nw）
// v0.2.54.3 = 首页卡片背景换侧栏同款不透明底（补丁位 2→3·观感修复轮；2026-09-20）——用户「能不能把首页的卡片背景都变成和之前那个左侧菜单一样啊？」（问询钦定「侧栏同款不透明底」）：
//   首页 18 张 .card（问候/活动流/公告/工作台/指标/我的世界）＋搜索胶囊＋访客大卡铺满 --sidebar-bg 不透明底
//   （亮色近纯白 0.95 / 暗色 #1a1a2e / 深色 mono #101013 随 var() 自适应）＋灭玻璃注入层 .lg-backdrop 滤镜/磨砂
//   （与 09-18 亮色侧栏修法同机制——三通道折射发黄/暗斑、半透明漏背景色一并消失；卡片自带 backdrop-filter 保留，
//   底已不透明零可见效果，与侧栏模块保留 blur 同口径）；订阅卡本就是深色不透明渐变底＋白字不动；
//   后端零改动（user_version 27/health 59 表不变）；FC v10.28.36.1 零改动；零草稿字段（v 保持 9）
//   （rev 00262-k59）
// v0.2.54.4 = 全站卡片不透明底（补丁位 3→4·观感修复轮；2026-09-20）——用户「能不能把全部变成不透明的卡片？」（问询钦定：①全站所有页面（FC 两页除外）②首页深色订阅卡保持深色不变③Community 个人页钦定液态玻璃保留）：
//   全站 .card 铺满 --sidebar-bg 不透明底＋灭玻璃注入层 .lg-backdrop 滤镜/磨砂（与 54.3 首页同机制，
//   作用域 body.mn-index → body:not(.fc-page) 全站化）；FC 两页 body 挂 fc-page 排除类（FC 玻璃/倾斜设计零触碰）；
//   profile-header 排除保留个人页钦定玻璃（card-halo 包层非 .card 天然豁免）；订阅卡/plan-card/auth-card/modal-card/
//   pv-card 均无 .card 类天然豁免；后端零改动（user_version 27/health 59 表不变）；FC v10.28.36.1 零改动；
//   零草稿字段（v 保持 9）
//   （rev 00263-hkp）
// v0.2.54.5 = 首页公告卡点击直达 Messages 公告 tab（补丁位 4→5·观感修复轮；2026-09-20）——用户「能不能把首页那边的公告点击后跳转是到这个页面？ https://mnationworld.com/pages/messages.html?showTab=announcements」：
//   首页公告卡 href 补 ?showTab=announcements（原 pages/messages.html 无参数落默认 private 视图；messages 页
//   showTab 直达 v0.2.50.8 已建成、「View all announcements」按钮早已是该链接，本轮只补公告卡这一个入口）；
//   后端零改动（user_version 27/health 59 表不变）；FC v10.28.36.1 零改动；ethereal 零改动；零草稿字段（v 保持 9）
//   （rev 00264-tcv）
// v0.2.54.6 = 用户横幅与头像不再受网页主题影响（补丁位 5→6·观感修复轮；2026-09-20）——用户「那个用户横幅和头像能不能不要被网页主题影响到？」（问询钦定「两处都要」）：
//   ①侧栏用户卡：解除 09-10 暗色隐藏规则 + mono 暗色翻黑族/灰环规则（ethereal 两处移除；sidebar.js 内联
//     var(--color-primary)→固定 #4648d4）——横幅任何主题恒亮靛蓝渐变、头像恒白环（含访客模块横幅同修）；
//   ②Community 个人页：横幅 9 处垫底 var(--color-surface-container-high)→固定 #e6e8ea（默认/bg-default/6 玻璃
//     预设/glass-bg 兜底）+3 处编辑弹窗预览兜底+边缘默认填充色块同修（边缘主题态半透明渐变与卡底复合，
//     垫底固定不透明色才真正主题无关；glass-clear 无垫底=真液态玻璃按设计透明不在此列）、头像环
//     var(--color-surface)→固定 #f7f9fb；ethereal 改动已重跑 inline-css（40 页+admin 刷新）；
//   ③Messages 头像（用户中途追加「还有message那边的头像」）：15 处头像内联色固定（#4648d4×9/#8127cf×6，
//     含 2 处 avatar-sm 静态头像+13 处 JS 模板头像/描边/未读圆点）+11 个 msg-acc 头像元素加 msg-avatar 类；
//     09-17 mono 暗色 .msg-acc 翻深底规则改 :not(.msg-avatar) 豁免（头像族恒亮固定色任何主题不变、
//     按钮/气泡/徽章族保持原行为；成员头像三元本就无 msg-acc 类天然豁免）；
//   后端零改动（user_version 27/health 59 表不变）；FC v10.28.36.1 零改动；零草稿字段（v 保持 9）
//   （rev 00265-hkt）
// v0.2.55.0 = 文章前端（平台侧文章阅读页 + 首页文章搜索/最新文章/评论通知；小改动位 54→55·新功能轮；2026-09-20）——用户「能不能把文章的前端做好？……搜索看不见有搜索不到我之前按过publish的文章」（问询钦定：①搜索只搜文章 ②首页活动流混入最新文章 ③wiki 普通文章阅读页「别那么复杂」④点赞+收藏+评论）：
//   后端：028 迁移 article_comments 独立同构表（ACM- 前缀、一层无回复、FK 级联；health 59→60、user_version 27→28）；
//     GET /api/articles?q= 标题模糊搜索（LIKE %/_ 转义、公开只搜 published、LIMIT 50、authorName 联查）；
//     GET/POST /api/articles/:id/comments（先发后审 L0 同帖子口径、禁言/24h 去重 403、限流 commentWrite、作者 +10 XP）；
//     测试 311→321/321（article-comments 10 测）；点赞/收藏复用 /api/social/articles/:id/*（零新端点）
//   前端：首页搜索框接真文章搜索（300ms 防抖下拉面板三态）+ Recent Activity 下「最新文章」区块（最新 5 篇 published）；
//     通知第八类 article_comment（文案+跳转 pages/article.html）；新建 pages/article.html wiki 式阅读页
//     （标题/作者行（首字母圆头像+主页锚）/日期/浏览数/正文流按 draft v9 卡片 (row,col) 排序渲染
//     content·img·flag·bitmap·text 四型/点赞乐观回滚/收藏无计数/评论区一层无回复/访客 ?next= 登录引导/
//     卡片 HTML 轻量消毒去 script+on*）；新建 article.i18n.js（11 语言 23 键）+index.i18n.js 新键
//     （latestArticles/search.*/notif.articleComment）+searchPh 全语言改文章搜索口径；OpenCC 重跑两文件；
//     inline-css 重跑全站（article 首内联）
//   FC v10.28.36.1 零改动；草稿字段零改动（v 保持 9）
//   （rev 00266-rrq）
window.MN_SITE_VERSION = 'v0.2.55.0';

// FluidCanvas 自身版本号（FC 独立版本线，口径：大版本.小版本.小更新.补丁；与站点号无关）——FC 首页头部 + 编辑器 badge/ready log 显示
// v10.28.9.1 = 区域编辑器口径修正：去掉框完自动弹名称面板（点区域/列表才滑出）+ 编辑器名称标签上缘居中（补丁位 0→1·口径修正轮；2026-08-30）
// v10.28.9.2 = 卡面钉子移除 + 名称只在编辑器显示（用户「在外面没有打开地图的情况下单点可以设置地名请把这个功能移除，然后显示名称是只有在打开地图的情况下才会出现没有打开地图就只是展示区域」）：卡面单击加标注点（钉子带地点名输入）整体移除、卡面只画区域多边形不渲染名称标签，名称标签只在编辑器舞台渲染（补丁位 1→2·口径修正轮；2026-08-30）
// v10.28.9.3 = 编辑器名称标签区域正中间 + 框完自动弹名称面板（用户「为什么我打开地图区域中间没有显示」问询钦定「区域正中间」+「框完自动弹面板」）：名称标签锚点从 v10.28.9.1 上缘居中翻回质心居中（v10.28.9 原位置；顺带根治开编辑器瞬间 overlay display:none 量 canvasH=0 全落回退分支的位置 bug——质心算法不量画布高）；框完区域自动滑出名称面板（v10.28.9.1「点区域/列表才滑出」口径翻回 v10.28.9 原钦定，mreName 随面板聚焦）；卡面口径不动（只画多边形不显示名称）（补丁位 2→3·口径修正轮；2026-08-30）
// v10.28.10 = 任意输入框框选文字弹出工具篮（用户「我希望所有只要是输入框用户框选文字工具篮就会弹出」）：新 textSelInInput 检测（activeElement 为 input/textarea + 非空选区，框选口径光标态不弹；document 捕获阶段 'select' 监听——输入框选区不触发 selectionchange）；按钮语义=元素级样式整框生效（B=fontWeight 翻转/I=fontStyle/U/S=textDecorationLine 增删/字号颜色字体直写 style，execCommand 只认 contenteditable）；LAST_INPUT_SEL 缓存兜键盘 Tab 焦点洞；工具栏 z 202→301/字号弹层字体面板 203→302 压过地图区域编辑器 overlay(z300)；.card-label 加入拖拽 arm 排除；单击标签全选即弹（与卡文字体验一致）；已知限制=输入框样式不随草稿重载、type=number 无 selectionStart 天然排除（小更新位 9→10·小功能轮；2026-08-31）
// v10.28.10.1 = 区域名称标签字体同步（用户「为什么更改了字体 区域中间的字体没有同步？」→问询钦定「字体+大小一起同步」+「每个区域各自」）：区域对象携带 fontFamily/fontSize 随 mapRegions 草稿往返（旧草稿缺省空串走标签 CSS 默认 10px）；mreRenderLabels 按区域套字体；名称面板打开回显该区域字体（工具栏同步态从 computed 读）；#mreName 改字体/字号即同步当前区域标签重渲染（别的区域不动）（补丁位 0→1·纯修复轮；2026-08-31）
// v10.28.11 = 地图区域编辑器升级包（用户「打开地图时我希望默认是鼠标而不是十字……右侧滑出编辑卡片上方打叉的左侧添加一个加……」一批，问询钦定：①点编辑手势「单击删点/按住拖点/按住线加点」②左右列表「左区域列表·右区域信息」③色块「自定义色+边缘/中心透明度分开」④三条横「面板内所有输入框」）：
//   打开地图光标 default、十字只在画区域期间（.drawing 态类）；选中区域点线编辑——单击点删（≤3 点拦）/按住点拖/按住线按下即插点随拖（捕获相抑制手势后 click 防重开面板抢焦点）；
//   区域色自定义色钮 + 中心/边缘两条独立透明度滑杆（fillOpacity/strokeOpacity 0-100 整数存区域对象，旧草稿缺省 35/90）；面板头部 ✕ 左侧 ＋菜单（添加描述至多一 / 添加两排信息 uid 键值块可多可删，desc 存在性语义=新区域不落键）；
//   面板下方左区域列表｜竖分割线｜右区域信息（名称/描述/键值块，右栏默认粗体 700）；面板输入框悬停右上角 ☰ 弹窗自定义背景（色+透明度）/边缘（色/粗细/圆角），样式存 region.inputStyles 按区域+输入框键随草稿往返、重开回放（小更新位 10→11·小功能轮；2026-08-31）
// v10.28.12 = 地图区域编辑器交互轮（用户「为什么两排信息不是左右的？而是上下的？…三条横线是要做什么？也没办法拖动啊，还有增加一下地图放大缩小功能和拖动功能」→问询钦定：①两排信息「左右」②三条横「改成拖动手柄」③缩放「只要鼠标滚轮」④拖动「空格/中键拖」⑤触屏「本轮只做电脑端」）：
//   两排信息块标题/内容左右并排（.mre-info-row 标题定宽 40% 内容弹性，≤768 回纵排）；☰ 双手势——点击仍弹输入框外观窗、按住拖动>4px 拖整个信息面板（漂浮定位+视口 clamp，隐藏/关闭复位 dock、600ms 时间戳抑制拖动后 click）；
//   画布滚轮缩放（1×-4× 光标锚定、passive:false 防页面滚动）+ 空格按住左键/中键拖动平移（Escape 取消手势、>4px 松手复用捕获相 click 抑制器防误开面板/误加点、中键不置旗标防误吞真点击）：
//   #mreView 包装层承载 transform——渲染器全 % 定位零改动，client↔% 换算集中 mreScreenToPct/mrePctToScreen（改造仅 mreDragMove/画图 click 含头尾阈值×s/顶点三命中三处）（小更新位 11→12·小功能轮；2026-08-31）
// v10.28.13 = 登录门禁（平台未登录界面同轮——用户「先登录才能用」）：FC 首页访客态 🔒 登录引导卡（.fc-locked-hero 互斥显示、Open Editor 隐藏）+ 编辑器 head 同步重定向送回 FC 引导页（会话同源读取、零闪现、登录用户零影响）；登录页 ?next=%2Fpages%2Ffluidcanvas.html 登录后自动回 FC（小更新位 12→13·小功能轮；2026-08-31）
// v10.28.14 = wiki 吸合分组（用户「两个卡片靠近时可以和wiki一样合并在一起，然后自动创建一个外背景」；钦定：自动吸合分组/外背景就普通的不透明/长按拖动+双击单独选中+再长按拆分/所有卡片）：未分组卡拖近目标 ≤12px 贴齐成组（吸合优先于网格/对齐吸附）、.grid-group-bg 不透明组背景恒在卡下、组整体移动（成员初位快照+主卡位移）、组内双击单独选中、长按 ≥600ms 拆分（移动即取消）、<2 成员自动解散、groupId 随草稿往返（小更新位 13→14·小功能轮；2026-09-01）
// v10.28.15 = wiki 分组规整轮（用户「吸上去就没办法通过点击外背景再选中卡片拆分了+合拼时宽度一样图片等比例+一体外观去原有边缘统一分割线+规整不擅自增加宽度」；钦定：①等宽以较宽那张为准 ②左右方向加入分左右两列、content card 自动在左右中间加分割线 ③边框+主题边缘全隐藏）：组背景可点击选中整组（此前 pointer-events none 点击穿过只会取消选中）、合并等宽（首次=较宽者、并入组=挤到组宽不擅自增宽）、图片卡等比（宽变高等比缩放 fitW/fitH 同步）、reflowGroup 布局引擎（列=贴齐竖堆、左右加入新开列、下方加入挤进本列、拆分/删除/缩放/草稿恢复提交点重排塌合）、组内卡隐藏自身边框/阴影/外板/环带/剪影填充/焦边（!important 压内联）、列内接缝横分割线+列间 content 卡竖分割线（补丁位 0→1·口径修正轮；2026-09-01）
// v10.28.15.1 = 组内单击切换选中（用户「第一次点击合并卡片时是选中整个，然后再次点击才是单独选中卡片这样就可以拖动拆分」）：组卡第一次点击=整组选中、再次点击同一张卡=单独选中该卡（单选中再点同一张=回到整组，点组背景随时回整组）；单独选中的组成员起拖=单卡拖（单卡选中态在 mousedown 不重置），松手拆出该卡（剩余组 reflow 塌合+背景/分割线重建）；拖拽松手的 click 与双击单独选中旧路径不参与切换（补丁位 1→2·口径修正轮；2026-09-01）
// v10.28.15.2 = 刷新后卡片翻倍修复（用户「为什么在刷新页面后卡片数量翻倍？」）：applyDraft 应用前先清空画布（卡片+组背景/分割线+取消选中）——云端同步/409 冲突「加载云端版本」在已恢复的画布上叠草稿是翻倍真身，清空后所有重应用路径幂等；三处采纳云端分支重戳 lastSaved 再落库（409 确定/sync 无本地草稿补落库/sync 确认）断开「本地永远旧于云端 → 每次刷新再弹窗再叠」的循环；侧栏/设置头像无 avatarUrl 时 src 曾是 undefined → /undefined 404 每次刷新一条 console error，改内联 SVG 人形兜底（补丁位 2→3·修复轮；2026-09-01）
// v10.28.16.0 = 分组主题化+分割线移除（用户「我希望他们合并后保留和普通卡片一样的自定义，一样可以自定义边缘主题那些」；钦定：①组整体像一张大卡——组背景本身可套边缘主题 ②组内分割线去掉）：整组选中（点组背景/右键组/首击成员）后外观弹层走分组模式（「分组外观」标题+菜单项改名，只留边缘主题+外板边距，色盘/透明度/阴影/背景图是卡专属控件分组模式隐藏）；主题写组样式表 groupStyles（键=groupId、值 {cardEdge,outerBgGap}）随草稿 additive 往返（云端同步同链）、组背景重建（合并/拆分/删除/拖拽/缩放/旋转/恢复）重放 applyGroupBgTheme（复用卡片主题 CSS 变量+子层体系——板/剪影填充/环带一体渐变/磨砂玻璃/滤镜阶梯，CSS 规则扩展 .grid-group-bg.card-edge-* 同族选择器；油漆无外板、gap 0 外板消失同卡片口径）；未设主题的组保持 v10.28.14 普通不透明背景；解散/选「无」即清组样式；列内接缝横分割线+列间 content 卡竖分割线绘制循环与 CSS 整体移除（小更新位 15→16·新功能/观感轮·补丁归零；2026-09-02）
// v10.28.17 = 矮列放大填满（用户「为什么当合拼一体时左右两列的高度不一致？」→问询钦定「矮列的卡片放大填满」）：列高=成员高度之和、H=最高列，矮列按 f=H/列高 放大——图卡宽高同比例（aspectRatio 不变、fitW/fitH/colSpan/rowSpan 同步）、content/text 只加高；重排定位列内按实际高度堆叠、列间按填满后实际列宽贴齐（列划分跨重排稳定）；两条防翻倍稳定性约束——①全组等宽归一从重排移除（职责只在 mergeCards 并入入口，防填满尺寸成为新基准每轮再放大——v10.28.15.2 翻倍 bug 同族）②重排对已填满几何幂等（f 每次从当前几何重推，已等高列 f=1 空转）；草稿无新字段（图卡 fitW/fitH 既有字段精确往返、content/text 高度不落草稿自然高+重排补）（小更新位 16→17·观感轮·补丁归零；2026-09-02）
// v10.28.17.1 = 合拼三连修复（用户「为什么高度还是一样不一样？？？？？然后为什么点击一下选中时是他妈的是整个合并内的其中一个而不是整个？合并后除了单独选中以外都是属于一个整体的卡片了不存在任何独立的背景好不好？？？这样子很难吗」）：①真身一=吸合提交只校正 x、y 偏移按拖放保留 → 列高填满后列顶参差、底缘永远对不齐 → reflowGroup 列顶对齐（所有列顶=最上卡顶，等高列+齐顶齐底=一张整卡；列内堆叠不变、重排幂等）②真身二=mergeCards 后整组自动选中 → 用户第一次点击被 mousedownAlreadySelected 判成「再次点击」→ 单卡选中 → 一拖即拆组 → 全散连锁（独立背景/高度回原）→ 合并后 deselectAll（第一次点击=整组、再击同卡=单卡旧钦定保留）；真实手势电池实证（合成拖拽落点必须避开卡中心 .card-label——标签按下不 arm 拖拽且 label onclick 吃掉切换，上缘图片区落点+防御性 elementFromPoint 断言）；草稿仍无新字段（补丁位 0→1 修复轮；2026-09-02）
// v10.28.17.2 = 一体口径补全（用户「为什么我选中的时候他那边的第一个框是单独卡片的框而不是整个框起来？？然后为什么他们还是一样拥有独立的白色背景？然后我希望那个一样长度的是默认合并时但是如果是合并完后用户要单独调整是可以的但最顶部的部分的高度永远一致行不行？中间部分要怎么调就怎么调但是图片的大小永远是等比例」）：
//   ①整组选中=单框——整组选中（有 groupId 且非单独选中）时 8 手柄+旋转钮全隐藏（refreshResizeHandles/refreshRotateGrip 加 wholeGroup 守卫），组背景 .grid-group-bg.selected 升级卡片同款选中环（主色边框+外发光环）——选中看到的就是一条整组框不再是点中那张卡的框；
//   ②成员独立卡面隐藏——组成员（:not(.group-single)）白色磨砂卡面（背景色/高光渐变/backdrop-filter）+背景图 .card-bg-img+装饰纹 .card-stripes 全藏（!important），组背景升级卡面玻璃配方（color-mix 55% 卡底色+白渐变+blur(12px) saturate(1.4)）＝那一张「整卡」的卡面，组内不再有独立白色背景；单独选中（.group-single 生命周期 selectCard/deselectAll/splitCardFromGroup）时该卡完整独立外观全回归；
//   ③合并后单独调整不反弹——缩放（onResizeUp/Escape 中途取消）/旋转（commitRotate）提交点 reflowGroup→alignGroupTops 新函数（只对齐各列顶=最上卡顶，零缩放零等宽零 x 位移）——用户手调尺寸生效不被填满抢回去（默认合并仍填满等宽齐顶齐底）；reflowGroup 只在结构事件（合并/拆分/删除/草稿恢复）保留；图卡尺寸任何路径只等比（aspectRatio 不变）；草稿仍无新字段（全状态类驱动+alignGroupTops 不落草稿）（补丁位 1→2 口径修正轮；2026-09-02）
// v10.28.17.3 = Migrate to Cards 按钮换 Uiverse 设计（用户给 CSS「把 Migrate to Cards 的按钮的 UI 改成这个代码，亮色和深色主题适配一下」）：药丸按钮（近黑药丸+白字渐变裁剪+星芒 SVG 三路径+悬停紫色渐变层/光环+旋转光束+放大回弹；当轮类名 .migrate-btn，v10.28.17.4 同轮修正改名 .migrate-pill），亮/暗双主题走自定义属性——暗色主题药丸翻浅 #f2f1fb、文字翻深色、星芒换深紫（白星浅药丸不可见）（补丁位 2→3·观感微调轮；2026-09-02）
// v10.28.17.4 = 顶部 Migrate 按钮换 cssbuttons-io 设计（用户「再把Migrate按钮的Ui 改成这个」给了紫渐变代码按钮 CSS；首轮误改弹窗内 Migrate to Cards → 同轮修正：cssbuttons-io 归顶部钮，弹窗钮还原 v10.28.17.3 药丸独立类 .migrate-pill）：.migrate-btn 紫渐变底 linear-gradient(#8e2de2,#4a00e0)+ghostwhite 字+代码图标（</> 双箭头 currentColor）+悬停黑色斜面板 skew(30deg) 左→右横扫+按下缩小 0.95；亮/暗主题共用同一套（紫渐变两主题都成立零覆写）（补丁位 3→4·观感微调轮；2026-09-02）
// v10.28.18.1 = 站点 v0.2.9.1 撤销轮同轮：编辑器卡弹性下线全静态（补丁位 0→1·修复轮；2026-09-03）
// v10.28.18 = 编辑器卡全液态玻璃（站点 v0.2.9.0 同轮）：createGridCard 对全部卡无条件 LG.apply 弹性+小卡滤镜（主题/分组是后到状态→层显隐全交 CSS 门控，玻璃族 4 型外/主题卡/外板/图底/组内成员层 display:none）；组背景 .grid-group-bg 静态+小卡滤镜（那张「整卡」的卡面）、stats-edit-panel 动态面板静态挂载；弹性 transform 与编辑器 rotate 组合（逐帧重组 rotate(X) translate3d(...) 不覆盖旋转）（小更新位 17→18·观感轮·补丁归零；2026-09-02）
// v10.28.19 = 表格卡 Sheet Card（用户「我们还缺少一个sheet card」）：可编辑表格卡（首行表头加粗、行内编辑、
//   +添加行/+添加列、行尾 ✕ 删行删光自补、窄卡横向滚动）；dataset.sheetData={cols,cells} additive 草稿往返
//   （cells[0] 恒表头行）；调色板入口 + assetSpan 8×5 + LAYER_TYPE_ICONS sheet:table；table-layout:fixed
//   首行 ✕ 占位列（防 ✕ 列塌 0 宽）（小更新位 18→19·小功能轮·补丁归零；2026-09-11）
// v10.28.19.1 = 表格卡默认尺寸 宽10格×长7格（用户「那个卡片大小能不能是默认长7格宽10格」）：
//   工厂默认/assetSpan/草稿恢复兜底三处 8×5 → 10×7（补丁位 0→1·观感微调轮；2026-09-11）
// v10.28.19.2 = 表格卡加行/加列自动变长变宽（用户「然后能不能在添加行/列的时候自动变长和宽啊」）：
//   sheetGrow 助手读 dataset 现有跨度 +1 写回+setCardSize+refreshResizeHandles；+添加行/+添加列按钮
//   传 grow 参数（种子 3 行与草稿恢复不增长）；草稿无新字段（colSpan/rowSpan 既有字段随跨度往返）
//   （补丁位 1→2·观感微调轮；2026-09-11）
// v10.28.19.3 = 表格卡列宽/行高手柄（用户「能不能在每一列/行的外面再增加一个格子点击这个格子可以调整该行的长度该列的宽度」）：
//   手柄行（每列 ↔）+ 行侧手柄（每行 ↕，含表头行）；sheetGripDrag 按住拖动改单列宽/单行高
//   （mousedown stopPropagation 不 arm 卡拖+白名单两处排除+document 级 move/up）；
//   sheetData 增 colW/rowH 随草稿往返（legacy drafts omit → 默认等分）；colgroup 三截制
//   （补丁位 2→3·观感微调轮；2026-09-11）
// v10.28.20 = 撤回/恢复（用户「能不能在顶部添加一个撤回和恢复按钮」）：快照式撤销栈——
//   historyCommit 剥 lastSaved 后 JSON 串对比防时间戳误判；600ms 防抖挂在 onContentChange 尾（零调用点改动）；
//   基线初始化完成后即拍下（首个改动即可撤回回原点）；historyUndoAction/historyRedoAction 走
//   applyDraft 恢复（v10.28.15.2 先清画布→幂等）+saveDraft 落库 + 重基线 lastCommitted
//   防序列化归一漂移吞恢复链；栈上限 60；工具栏两钮 + Ctrl+Z/Ctrl+Y
//   （input/textarea/contenteditable 焦点时让给原生撤销）（小更新位 19→20·小功能轮·补丁归零；2026-09-11）
// v10.28.20.1 = 吸合误判修复（用户「为什么我把卡片拖到一个位置他会被一个和他没有任何接近的卡片吸附合并？」）：
//   findMergeSnap 边对判定加垂直轴严格重叠守卫——x 轴边对（右-左/左-右）要求两卡
//   y 范围相交、y 轴边对（底-顶/顶-底）要求 x 范围相交（严格重叠，边相切不算）；
//   旧代码只按单轴边距 ≤12px 判命中，同高不同 x 的卡隔着一千多像素照样被吸
//   （探针 tmp-merge-far-probe.js 实况抓出）；吸合提交 recheck 同函数自动继承守卫
//   （补丁位 0→1·纯修复轮；2026-09-11）
// v10.28.20.2 = 一体式高亮（用户「画布是不是一体…改成全部一体式的不要偷懒就搞成一个一个的」→追问「我怕你又偷懒…只使用一个感应，其他都只是花瓶」）：
//   画布本体本来就一体（单一 div、变长=自身长高、拖拽感应挂 document 全页生效，零复制零花瓶段）；
//   drawHighlightRange 旧实现一格建一个 div（拖 10×7 的卡 = 70 个小方块各自描边）——改为整个
//   覆盖范围只建 ONE 块矩形（连续外框位置/尺寸计算）；拖卡覆盖预览与侧栏资产落点预览
//   （两调用点共用本函数）自动一并变一体；范围缓存键/松手整块移除行为零变化
//   （补丁位 1→2·观感微调轮；2026-09-11）
// v10.28.20.3 = 卡框高光清除+边框统一暗色（用户「深色模式下卡片外框右上角有一条很突兀的白色/浅色高光边线」+
//   「清除卡片右上角及整个外框所有的白色/浅色渐变高光线」+「将卡片整体的外边框统一改为暗色低调的微弱边框」）：
//   真身=v10.27 磨砂玻璃轮「右上角 2px 高光条」（linear-gradient 白渐变贴 top right，浅色 3D 感/深色刺眼白线）；
//   4 处卡片表面全清（玻璃卡本体/组背景卡面/主题卡填充层 tint/油漆 ::before）——组背景就是那张「整卡」的卡面，
//   留一根就又变回「一个一个」；边框统一 var(--divider-line)（深色=rgba(255,255,255,0.08) 正是用户举例值、
//   浅色=rgba(118,117,134,0.08)；基础卡宽 2px 不动——主题卡外板几何按 2px 边宽调过只换色）；
//   统计编辑面板高光保留（v10.28.6.2 钦定浮动面板非卡框）
//   （补丁位 2→3·观感微调轮；2026-09-11）
// v10.28.20.4 = 吸合方向感（用户「能不能判定一下方向，如果卡片是在左侧合并后应该就是在左侧而不是变成跑到下方」）：
//   真身=mergeCards 等宽归一以左缘为锚，窄卡并入既有组时被拉成组宽、右缘越过目标竖边 →
//   reflowGroup 按水平重叠把全组压成一列叠到下方（实况探针：80px 窄卡左并入 174px 组 →
//   整组塌成一列）；findMergeSnap 边对加 side（'left'/'right'/'top'/'bottom'=拖动卡在目标
//   哪一侧），mergeCards(card, target, side) 归一后按 side 重新贴齐再 reflow——左/右贴竖边、
//   上/下贴横边并 x 对齐目标列，贴齐边恒 flush、reflow 按边分列不再塌
//   （补丁位 3→4·纯修复轮；2026-09-12）
// v10.28.20.5 = 国旗卡默认 8×6→8×5、国徽卡默认 4×3→5×5（用户「把国旗卡片改成 长5格 国徽卡片改成5x5」，
//   问询钦定国旗=8宽×5长）：assetSpan flag h 6→5 + shield 显式 5×5、草稿恢复兜底同改
//   （补丁位 4→5·观感微调轮；2026-09-12）
// v10.28.21 = 合并组整体缩放 + 单击恒选整组（用户「合并后整体的卡片能不能做一个可以放大缩小的功能和独立卡片一样，
//   然后当我只是要选中整体的卡片时会直接触发到独立卡片而不是在选中独立卡片的情况下双击才会触发」）：
//   ①整组选中 → refreshResizeHandles 整组分支：8 手柄挂组框（可见成员旋转感知 bbox 并集、轴对齐、
//   rotation 0、不含 GROUP_BG_PAD——手柄贴卡边），整组可像独立卡一样缩放；beginResize 整组快照
//   （成员 x/y/w/h/跨度/等比锁 + 组框）+ onGroupResizeMove（组框像素→整格量化、成员位置按框内比例
//   缩放、成员尺寸各自量化到整格保 span=尺寸不变量、等比锁成员 min(scaleX,scaleY) 保长宽比+fitW/fitH、
//   对边固定同单卡公式）+ commitGroupResize（onResizeUp/Escape 共用：每成员 moveCardPx 落位，
//   不 reflow/不对齐列顶——整体缩放就是用户刚调的结果，系统不抢回）
//   ②单击恒选整组：card click 的 v10.28.15.1「再次点击同一张卡=单独选中」切换分支整体移除（用户
//   「当我只是要选中整体的卡片时会直接触发到独立卡片」），单独选中只走 dblclick 路径；死变量
//   mousedownAlreadySelected 删除；合并后不自动选中（deselectAll）保留；草稿无新字段（span 既有字段
//   往返、fitW/fitH 既有字段）；零后端、ethereal 零改动无需 inline-css
//   （小更新位 20→21·新功能轮·补丁归零；2026-09-12）
// v10.28.21.1 = 组内图源弹窗劫持双击修复（用户「选中了整体然后要再选中单独的卡片时就不让选了」+
//   「再点击一次就打开了」）：真身=createFlagCard/createAssetCard(shield) 组内卡未设图时单击必弹
//   openFlagSourceModal，modal 遮罩吃掉双击第二击 → 双击单独选中/拖出拆分整条路径失效；修法=①组内
//   卡单击不再弹图源——只在「单独选中且 e.detail=2（双击第二击）」时弹（用户钦定「在选中独立卡片
//   的情况下双击才会触发」）②单独选中后单击同一张卡保持单独不重置回整组（否则单击把单独态打回整组，
//   图源弹窗永远到不了双击）；草稿无新字段；零后端、ethereal 零改动无需 inline-css
//   （补丁位 0→1·纯修复轮；2026-09-12）
// v10.28.21.2 = 文字工具栏输入中恒显（用户「那个工具栏能不能在输入的时候都会一直展示」）：真身=
//   v10.28.10 输入框口径只认非空选区（「框选文字工具篮就弹出」口径、光标态不弹）——卡内编辑框
//   （标签/姓名/简介/表格格/时间线…）打字时工具栏不显示；修法=textSelInInput 光标态在
//   .grid-card 内输入框也弹（refreshTextToolbar/positionToolbar/syncToolbarState 三处同源自动跟进）+
//   缓存 LAST_INPUT_EL 改存元素（焦点落工具栏自家控件时选区态/光标态都可回用）；框选口径不变
//   （任意输入框框选仍弹）、标题框/搜索框/弹层输入框打字不弹（防干扰）、数字类输入框 selectionStart
//   null 照旧不弹；Escape 在卡内输入框只折叠选区工具栏保持（恒显口径）；草稿无新字段；零后端、
//   ethereal 零改动无需 inline-css
//   （补丁位 1→2·观感微调轮；2026-09-12）
// v10.28.22 = 工具栏添加图像·Wiki 式内联图（用户「在工具栏的右侧那边再增加一个按钮叫添加图像…
//   图像的大小是根据文字的大小进行等比例变化…完成类似于Wiki的功能」）：工具栏右端 image 钮 +
//   tt-img-pop 弹层（国旗库 15 面：块2 IIFE 经 window.FC_FLAG_LIBRARY 供数、canvas 光栅化 PNG
//   data URL；+ 上传任意图，国徽等同口径）；只进内容卡文字（输入框态按钮置灰），insertInlineImage
//   选区替换/光标插入、光标置图后、onContentChange 入撤销快照；img.tt-inline-img height 1.5em →
//   字号变图等比变；草稿 innerHTML 往返 + sanitizeDraftHtml 放行 data: 图无损；块1 showToast
//   上窗（上传成功 toast 跨 IIFE 调用——电池抓出 ReferenceError）；零后端、ethereal 零改动
//   无需 inline-css
//   （小更新位 21→22·新功能轮·补丁归零；2026-09-12）
// v10.28.23 = 添加图像钮不再置灰 + 弹层挂工具栏上方 + 网页搜索（用户「为什么该按钮没办法
//   点击？」——v10.28.22 输入框态置灰 pointer-events:none 成事故，去掉置灰、插入时无内容卡
//   光标 toast 引导；用户「弹窗是在工具栏上方的…直接进行一个预览，而不是覆盖全屏」——
//   showImgPop 上方优先锚定、贴顶翻下方；用户「一样可以在网页上搜索/上传」——弹层顶部
//   搜索框 + Wikimedia Commons API（免费免密钥 CORS origin=*，window.FC_IMG_SEARCH_API 可
//   打桩）：2 列缩略图预览网格、点格插 640px 缩略 URL、坏图格自动隐去、清除搜索/失败回退
//   国旗库；搜索框抢焦点→插入时光标回放（IMG_SAVED_RANGE 打开弹层时记住、先 focus 后加
//   范围）；renderLibTiles/showLibView/runImgSearch/renderImgResults 拆分；弹层 mousedown
//   排除 .tim-search（保输入框聚焦）；hideTextToolbar 弹层开着不收工具栏（点搜索框聚焦会把
//   弹层关掉+display:none 后懒加载缩略图永不加载——电池探针实况，收起改走显式路径）；
//   零后端、ethereal 零改动无需 inline-css
//   （小更新位 22→23·新功能轮·补丁归零；2026-09-12）
// v10.28.24 = 图像插进任何可打字处（用户「我希望他能添加在任何可以打字的地方而不是只限于
//   文字内容卡片」）：卡内输入框（标签/姓名/头衔/简介/统计指标/时间线事件与描述/表格格…）
//   第一次插图时现场升级成 contentEditable span（同名同类同内联样式、文字照搬、dataset.rich=
//   '1'），此后文字+图片共存；纯文字字段永远还是 input 零影响既有路径；数字/年份字段除外
//   （数值与图表逻辑要纯文字，toast「数字或年份字段不能插图」）；textSelInCard/textCaretInCard
//   接受 rich span（富文本字段选区/光标态工具栏照常）；序列化全走 fieldHtml/fieldText/
//   setFieldText/makeTextField——带标记文字按 HTML 往返、草稿零新字段（rich HTML 坐既有
//   label/charName/charTitle/charBio/statsRows/tlEvents/sheetData 串）；IMG_SAVED_INPUT 弹层
//   打开时记住卡内输入框（工具栏 mousedown preventDefault 保焦点、搜索/上传抢焦点后仍插回
//   原位）；richFieldSync 按类名接回 statsSerialize/tlSerialize/sheetSerialize/charSerialize/
//   autoSizeLabel 原管线；零后端、ethereal 零改动无需 inline-css
//   （小更新位 23→24·新功能轮·补丁归零；2026-09-12）
// v10.28.24.1 = 两个修复（补丁位 0→1·纯修复轮；2026-09-12）——用户「在Sheet卡片里添加图像时它的
//   大小没有跟随文本大小」+「content card输入时工具栏跑到左上角」：①内联图 1.5em 规则选择器只写
//   .card-text-content → 加 [data-rich="1"] img.tt-inline-img（富文本化字段里的图随所在字号等比）
//   ②插图后光标 setStartAfter(img) 元素级落在内联图边界，Chrome 光标矩形退化（0,0,0,0）→ 工具栏
//   定位跳左上角；修法=光标优先放进图后文本节点偏移 0（探针实证矩形正常）+positionToolbar 退化
//   矩形兜底锚回 textEl 矩形；零后端、ethereal 零改动无需 inline-css
// v10.28.24.2 = 两个修复（补丁位 1→2·纯修复轮；2026-09-12）——用户「就只有content card正常 sheet card
//   不正常」+「一添加它的大小就已经超出了表格而且也没办法像文字一样删除」：①大字号时宽图溢出表格格——
//   规则加 max-width:100% + object-fit:contain（普通字号零变化、超宽按比例收进盒内不压扁不溢出）
//   ②点击 rich 字段里的内联图直接整图选中（可视反馈），Delete/Backspace 即删；内容卡点击行为不动
//   （用户基线）；零后端、ethereal 零改动无需 inline-css
// v10.28.25 = 合并组可整行成行（小更新位 24→25·新功能轮·补丁归零；2026-09-12）——用户「如果那个卡片
//   已经有左右两个合并了的 然后我在下面上去合并他只会变成左右两列，我希望是从下面合并时他是可以变成
//   上下两行的就是不只是两列」：真身（探针实证）=下方拖入卡被挤进目标列、reflow 的 fill 把矮列拉高
//   填满（2列组下方并入 → 另一列 130→216 被拉大），组永远只是左右两列；修法=上/下并入既有组时整宽
//   成行贴组底/组顶（rowInGroup 标记随草稿往返 additive；reflowGroup 行卡独立于列——不进列划分/不
//   参与 fill/不随列顶对齐跳动、宽度恒整组宽幂等；alignGroupTops 跳过行卡；拆分/侧并入清除标记）；
//   左右并入仍是列；零后端、ethereal 零改动无需 inline-css
// v10.28.25.1 = 合并组内单卡调大小修复（补丁位 0→1·纯修复轮；2026-09-12）——用户「卡片合并后要单独
//   选中一个卡片调整他的大小时没办法办到，只能长按拆分」：真身（可信输入探针）×2——①单独选中只走
//   原生 dblclick，真实双击偏慢/漂移超过浏览器阈值时 dblclick 不触发 → 永远整组选中、手柄锚整组
//   外框（长按拆分走 mousedown 所以只剩拆分一条路）；②行组内列成员纵向放大盖住下方行卡（探针实证
//   44px 重叠）；修法=①同卡两击 ≤800ms/漂移 ≤10px 延迟 120ms 补发单独选中（原生 dblclick 先到自然
//   跳过；延迟翻转不破坏 v10.28.21.1 图源弹窗条件；点空画布清双击对）；②列成员单卡缩放提交后行卡
//   按快照偏移贴回新列块 flush 无重叠（探针实证 44→0）；零后端、ethereal 零改动无需 inline-css
// v10.28.25.2 = 合并组内单卡调大小挤压让位（补丁位 1→2·纯修复轮；2026-09-12）——用户「可以单独调整了
//   但是旁边的卡片不会因为被挤压而移动」：真身（可信输入探针）=单卡缩放提交只做列顶对齐+行卡贴回，
//   旁列伙伴从不位移（A 东扩+66 → B 原位重叠 66px、东收不回贴、中列东扩右列不动、西扩左列不动、同列
//   叠堆南扩压住下卡）；修法=「移动边=墙」——提交时同侧伙伴随墙位移量整列平移（东墙→右侧整列、西墙→
//   左侧整列、南/北墙→同列上下堆叠；贴齐/间距全保留、收边负位移=回贴、落位绝对化幂等）；行宽跟随列块
//   （默认全宽行重断言新宽、自定义宽不抢回）；内容卡墙位移按视觉框高（origH 取 minHeight 致 44px 假缝
//   的根因）；onResizeUp 与 Escape 收口共享 commitSingleResize（Escape 曾漏行卡贴回）；零后端、
//   ethereal 零改动无需 inline-css
// v10.28.26.0 = 自由形状合并组（小更新位 25→26·新功能轮·补丁归零；2026-09-12）——用户「合并时能不能不只是
//   正方形…左/右侧合并不会因为长度不一样被拉长而是保持一样的大小合并；从上方/下方合并只根据动到的那一面
//   的最宽值调整大小不是整组最宽；可以是 6 边形 L 型、十字型等排列」：左右并入保尺寸（不做宽度归一、贴
//   目标侧边+顶对齐）；上下并入=接触面模型（组内对边 ≤12px 且 x 相交的成员=面，宽=面并集跨度，倒 L 台阶
//   下并入只匹配接触的那一列宽、平底跨列=整面宽、空面退化 [target]）；reflowGroup 保形化（只重画背景与
//   手柄，永不改成员位置/尺寸——载入草稿不再归一塌形）；行卡机制（rowInGroup）整体退役（legacy 草稿忽略
//   该字段、像素几何照存）；组背景 clip-path path() 并集轮廓（computeGroupOutline 区间带扫描+边集 XOR+
//   Eulerian 连环+凸角圆弧 r=min(14,邻段半长)、凹角直角；L/十字剪影、空角点击落画布；描边/阴影 drop-shadow
//   栈跟随剪影）；墙让位 right/left 加垂直重叠守卫（台阶斜对卡不误推）；零后端、ethereal 零改动无需 inline-css
// v10.28.27.0 = 自定义页面背景（小更新位 26→27·新功能轮·补丁归零；2026-09-13）——用户「在卡片列表的下方
//   添加一个标题叫自定义…上传自己的背景…16:9是最低要求可以做得很长…多图纵向拼接…拖动改变上下排列顺序…
//   虚化边缘单独调整虚化范围…弹窗右侧整页预览左侧工具栏…预览多个比例（平板16:10/手机20:9/16:9/21:9 +
//   详细折叠 1:1.4/4:3/1:1）」：资产面板「自定义」区入口；背景=整页背景画在 gridCanvas 自身
//   background-image（不建 div，层级/事件零侵入；.has-page-bg 灭网格线；minHeight 随合成高长高）；
//   弹窗左工具栏右整页预览（克隆 scale 进 7 档 aspect-ratio 比例框）；合成=1600 宽 canvas 纵向拼接+缝区
//   destination-in 线性渐变交叉淡化+主题底色预填（JPEG 无 alpha）；16:9 最低校验保存拦截+红提示；
//   草稿 additive pageBg（v 保持 9；产物不入草稿载入重算）；撤销/重做往返；getCardFingerprint 补 pagebg
//   签名（线上电池 draftHas:false：指纹不含背景 → autosave 永不写草稿 → 刷新丢背景）；电池 27/27
//   （新 S7b 自动落草稿回归）+ 线上电池 PASS；部署两次 exit 0（00207-hw9、00208-nzm 指纹修复）；零后端、
//   ethereal 零改动无需 inline-css
// v10.28.28.0 = 上传图片信息弹窗（小更新位 27→28·新功能轮·补丁归零；2026-09-13）——用户「在上传自己的
//   图片的时候都有一个弹窗右上角显示图片同行左侧显示图片名称，下方是详细信息 Description…可以设定
//   Public/Private/Team…Description 固定长度…字数限制 320 字…追踪那个词（"code" 是一个字不是四个）」：
//   8 个上传入口共用 #imgMetaModal（页面背景/国旗国徽/卡背景/名称背景/旧背景弹窗/内联图/人物头像/地图图）
//   ——读图后先弹窗（同行名称+预览、Description 固定高不可拖、live 计数「N / 320」按空格分词实时追踪、超
//   320 红字+保存拦截 toast、可见性 Public/Private/Team 分段控件默认 Private），保存才落地、取消=图不落地
//   且宿主弹窗保持打开；弹窗叠层（同 z-index 110 DOM 后者在上）+closeModalOnly/closeTopModal 只关顶层
//   （backdrop 改 closeTopModal，单弹窗等价向后兼容）+Escape isComposing 守卫；草稿 additive（v 保持 9）：
//   pageBg imgs[i] 增 name/desc/visibility、卡图 imgMeta、卡背景 cardBgMeta、标题背景 captionBgMeta、头像
//   charAvatarMeta、地图 mapImgMeta、内联图 data-img-* 属性 innerHTML 往返零字段（legacy 缺省空名/空描述/
//   Private）；getCardFingerprint 补元数据签名（desc 变更也触发 autosave）；renderPbgList 名称行 esc() 防
//   注入+编辑钮重开弹窗回填；零后端、ethereal 零改动无需 inline-css
// v10.28.29.0 = 我的图库（小更新位 28→29·新功能轮·补丁归零；2026-09-13）——用户「那个上传后可以在平台的
//   上图像搜索那边搜索到吗」+「肯定是要做的」，问询钦定：①入口=「Search within the platform」弹窗上方加
//   顶部菜单，右侧「我的图库」左侧「全部」；②点图=就是添加图片，图片右上角铅笔 icon 点击后编辑信息（只能
//   编辑自己上传的、内置国旗不能编辑）；③管理功能=全部（浏览+搜索+插入+编辑+删除）：flagBrowserModal 页签
//   Search/My flag（演示假数据）→「全部/我的图库」——图库=纯派生视图（collectImgLibrary 扫描 7 类使用处
//   [页面背景/卡图/卡背景/标题背景/头像/地图/内联图] 按 dataURL 去重，同图多处用=一格；零草稿字段 v 保持
//   9、零指纹改动）；「全部」=内置 12 旗+我的上传、「我的图库」=仅上传（tile=缩略图+可见性徽章+右上角铅笔/
//   垃圾桶，空态提示）；点上传图=setCardImage+meta 三件套插入国旗卡；铅笔=图片信息弹窗叠层（initial 回填、
//   只关 meta browser 保持），保存 syncLibMeta 按 dataURL 同步所有使用处（不动卡 label）；垃圾桶=原生
//   confirm 报使用数→removeLibUsages 从所有使用处移除（卡图摘层+icon 恢复+clearAspectLock、卡背景摘层、
//   标题背景重绘、头像/地图还原默认态、pageBg 走 pbgRemoveImage 同款收尾或 closePageBgModal 提交路径、内联
//   图 richFieldSync）；搜索按名称+描述过滤；MY_FLAGS 假数据退出浏览器（FC_FLAG_LIBRARY 喂工具栏国旗库不
//   动）；零后端、ethereal 零改动无需 inline-css
// v10.28.29.1 = 样本国旗全撤（用户「把那些用来做样本的图片国旗去掉」）：SEED_FLAGS（12 内置旗）+MY_FLAGS（3
//   假「我的旗」）两数组移除、FC_FLAG_LIBRARY=[]——图库页签只认真实上传（全部/我的图库同源，页签结构保留、
//   空态文案统一）、renderLibTiles 库格零渲染（tt-img-pop 头「国旗库」→「图片」，仅上传格+网页搜索）；
//   confirmFlagSelection/filterFlags/renderFlagGrid 的 seed 分支清除（applyFlagToCard 导出保留兼容）；
//   补丁位 0→1·纯改动轮
// v10.28.30.0 = 自动保存周期制（小更新位 29→30·新功能轮·补丁归零；2026-09-13）——用户「平台自动保存能不能是
//   每10分钟一次？…最快是5分钟一次」：3s 防抖改固定节拍心跳（onContentChange 移除 clearTimeout/setTimeout 重
//   排；scheduleAutoSaveTick 到点 autoSave 再约下一拍，脏守卫 getCardFingerprint!==lastSavedContent 保留）；
//   频率读 SlatiSettings.getSettings().fcAutoSave（默认 10 分钟、clamp 下限 5）；设置改频 → slati-settings-
//   changed 监听重排（clearTimeout 先清旧拍不双发）；pagehide 兜底保存；QuotaExceeded 同步 lastSavedContent
//   停摆机制保留（每拍口径）；头部新齿轮按钮（id=settingsBtn）直开平台设置弹窗；零后端、ethereal 零改动无需
//   inline-css
// v10.28.30.1 = 撤回/恢复按钮纯图标化（补丁位 0→1·纯改动轮；2026-09-13）——用户「能不能把undo和redo的按钮只是
//   保留icon不需要名称」：工具栏 undoBtn/redoBtn 去掉「撤回/恢复」文字只留图标（名称保留在 title 悬停提示，
//   disabled 灰态/onclick/撤销引擎/快捷键零改动）
// v10.28.30.2 = 设置/Tags 按钮纯图标化（补丁位 1→2·纯改动轮；2026-09-13）——用户「设置和Tags能不能也是只有
//   一个icon?」：工具栏 settingsBtn/tagsModal 去文字只留图标（settingsBtn 原有 title="设置" 保留、tagsModal 新增
//   title="Tags"）；onclick/功能/弹窗零改动
// v10.28.31.0 = 订阅门禁激活 + 字体每语言免费 5 个 + 卡片/页面背景锁 + XP 钩子（小更新位 30→31·新功能轮·补丁归零；
//   2026-09-14）：SUBSCRIPTION_TEST_MODE 翻 false（isSubscriberUser 按 slati_user.tier 判定，caption/card 边缘装饰
//   锁+订阅 chip+升级链接正式生效）；字体面板 FREE_FONT_CAP_PER_LANG=5（免费每语言 5 个、超限组尾 .fp-lock 锁行
//   「剩余 N 个字体」+订阅解锁链接、每次打开重建弃 FP_BUILT 一次守护）；卡片背景订阅锁（#cardBgLockRow+色盘/透明度/
//   阴影/上传四块隐藏、setCardBgColor/updateCardBgOpacity/handleCardBgUpload 守卫 toast，还原类函数不锁）；页面背景
//   订阅锁（openPageBgModal 拦截 toast+资产面板入口 #pageBgEntryLock 锁标+#pageBgUpgradeLink「订阅后解锁」）；
//   XP 钩子（建卡 drop +10/发文章 +100，草稿恢复路径不挂钩）；零后端、ethereal 零改动无需 inline-css
// v10.28.32.0 = 图片库直开+搜索栏上传+图库持久化（小更新位 31→32·新功能轮·补丁归零；2026-09-14）——用户「弹窗出现
//   时直接打开搜索+上传按钮放到搜索栏的右侧+上传的图片没办法在全部/我的图库看见」：图源选择器 flagSourceModal 整体移除
//   （点无图国旗/国徽卡直开图片库，打开即焦点落搜索框）；上传按钮并入搜索栏右侧（保存后图库保持打开+新格即时出现并选
//   中）；图库升级持久库 slati_img_library（上限 2.5MB FIFO 淘汰、单图超限不入库 toast；imgMetaSave choke point 一处写
//   入覆盖 8+ 上传入口；syncLibMeta/removeLibUsages 同步 store）；有图卡点按保持不弹（防误触口径零回归）；零草稿字段
//   （v 保持 9）；零后端、ethereal 零改动无需 inline-css
// v10.28.32.1 = 合并组整组缩放贴齐缝保持（补丁位 0→1·纯修复轮；2026-09-14）——用户「卡片合并后调整整体的大小卡片
//   会被拆分但是依旧是整体的就是没有继续保持连接在一起」：整组缩放位置连续缩放、成员尺寸各自整格量化 → 贴齐缝裂开
//   最多半格（探针 cs=22 实测：e+120 裂 +3.1、se+45/+35 裂 +6.4、锁旗 se+120/+20 裂 +40.1、e−20 裂 +9.7）；
//   beginResize 组分支快照缝对 xSeams/ySeams（隐藏成员跳过、顺带记上/下缘钉标记）+ onGroupResizeMove
//   每帧去重叠链后闭缝遍（锚升序级联、严格 > 守卫只拉回不造重叠、不改成员尺寸）+ 顶对齐跟随（起点顶齐平无顶钉
//   成员记顶对齐对，闭缝遍钉住中心顶后同顶侧臂漂 +8.667 裂开→S7 实证；每帧把跟随顶拉回锚顶只上拉不造重叠）；
//   组框/快照排除隐藏成员（与 refreshResizeHandles 口径一致）；零草稿字段（v 保持 9）；零后端、ethereal 零改动
//   无需 inline-css
// v10.28.33.0 = 图库 info 图标+图片信息二级弹窗（小更新位 32→33·新功能轮·补丁归零；2026-09-14）——图库 tile 右上角
//   新 info 图标（仅 visibility=public/team 渲染，private 无）；点击开只读二级弹窗 imgInfoModal：预览+名称+简介（兜底
//   「暂无简介」）+上传者+上传时间+可见性+尺寸（异步读取带 token 守卫防旧图回写）；slati_img_library 条目新增 uploader
//   字段（imgLibPut 一处入库，自己上传=displayName 兜底「你」、Wikimedia 图='Wikimedia Commons'；collectImgLibrary
//   派生化同口径兜底，旧条目渲染期补齐不重写 store）；弹窗栈：closeModalOnly 只关本窗图库保持开、backdrop 点关最上层、
//   Escape 最先关 info；零草稿字段（v 保持 9）；零后端、ethereal 零改动无需 inline-css
// v10.28.33.1 = mono 暗色背景翻黑族 + 白底白字按钮修复（补丁位 0→1·观感修复轮；2026-09-14）——用户「黑白主题深色模式
//   背景改成黑色系而不是蓝色 + 深色黑白主题下白底白字按钮」：暗 mono 表面令牌族翻中性黑族（网格画布/状态栏/卡片/输入框
//   随 --color-* 令牌全翻黑，settings-modal.js 运行时注入赢页面 :root 覆写）；白底白字 active 族（col-btn/vp-btn/
//   pbg-ratio-btn/caption-*/tim-search-btn/lib-icon:hover）翻纯黑族 #32324a 白字；progress-step 圆点同修；toast 翻黑族；
//   小指示点保持近白高亮；零草稿字段（v 保持 9）；零后端、ethereal 零改动无需 inline-css
// v10.28.34.0 = FC 三页合一 Douyin 式 URL 视图切换（小更新位 33→34·新功能轮；2026-09-15）——analytics/articles 并入
//   fluidcanvas.html 成为 URL 参数驱动的视图（?view=analytics&tab=&period= / ?view=articles&filter=&sort=），首页
//   既有三视图同步 URL 化（分享/后退/前进/刷新保留状态，旧 #hash 兼容）；两旧页改重定向 stub；articles 内联 onclick
//   bug 改事件委托；批量发布补 toast 反馈；门禁变化=analytics/articles 对访客随 fc-guest 锁屏（与编辑器一致）；编辑器页
//   独立不动；零草稿字段（v 保持 9）；零后端、ethereal 零改动无需 inline-css
//   （rev 00221-vz9）
// v10.28.34.1 = 暗色菜单卡白顶线修复（补丁位 0→1·观感修复轮；2026-09-15）——用户「FC 首页左侧菜单上方有一个白白的东西？
//   在深色模式下才看得见」；修法=暗色 .tilt-container:not(.card) 灭顶线覆写（!important 压过内联 hover 加亮，外侧深投影
//   保留）；亮色零触碰；零草稿字段（v 保持 9）；零后端、ethereal 零改动无需 inline-css
//   （rev 00222-ww8）
// v10.28.34.2 = FC 首页频道卡边缘光+切换卡顿修复 + 编辑器掉帧根治（补丁位 1→2·性能修复轮；2026-09-15）——①首页：暗色
//   active 账户卡边缘统一语言（白细线边框+底部内嵌主色指示条——割裂真身=旧高亮描边+反光条杂拼）；切换期 tilt 倾斜冻结
//   （data-tilt-off token + tilt.js _slatiTiltBound 去重/守卫，切换窗口内 mousemove/mouseleave 不重算倾斜）、统一
//   0.15s/0.2s 退出+200ms 交换+0.02s 交错进入+420ms 解冻、LG.scan 延迟 420ms 避让切换窗口、过渡 0.5s→0.35s；
//   ②编辑器：用户「能不能顺便优化一下整个FC的代码因为连文章编辑那边的操作都有明显的掉帧」；探针 tmp-probe-editor-jank
//   实证三真身：隐藏弹窗玻璃+无限动画（静息 15fps→60fps：visibility:hidden + 隐藏态卡内 animation:none 全停）；手势期
//   玻璃重光栅（body.fc-moving 全页玻璃暂离+组背景阴影栈挂起，提交后下一帧还原）；125Hz 事件 rAF 合并+拖拽期尺寸缓存
//   （强排读 1421→93）。序列化链/处理器实测无辜；剩余慢帧=无头 SwiftShader 软件重绘伪影（真实 GPU 不存在）；零草稿字段
//   （v 保持 9）；零后端、ethereal 零改动无需 inline-css
//   （rev 00223-znx）
// v10.28.35.0 = 文章查看器（小更新位 34→35·新功能轮；2026-09-15）——用户「现在能不能做一下当我发布文章后其他用户看见这个文章的界面？我要求它的显示范围只有那个格子的范围超出格子就无法显示」：编辑器 ?article=ART-xxx 只读查看模式（head 门禁跳过 redirect 游客可看已发布；body.fc-viewmode chrome 全隐；applyDraft 全量渲染零新渲染器；saveDraft/putCloudDraft/syncCloudDraft/keydown/refitColumns 五处 viewmode 守卫——绝不覆盖本地草稿；画布包进 #fcViewScaler overflow:hidden 等比缩放适配视口=格子范围硬裁剪；pointer-events:none + contenteditable 关闭 + Tab 序移除只读硬化；云端 404 → localStorage demo store 兜底（ART-001 样例）；非公开/404/无正文 → 占位状态卡）；首页 ?view=articles：View 按钮接线查看器、云端文章合并置顶（author=Member/日期 createdAt/cloud 行无删除钮）、批量发布删除仍只作用本地种子；零草稿字段（v 保持 9）；零后端、ethereal 零改动无需 inline-css
//   （rev 00224-k5l）
// v10.28.35.1 = 文章发布去除「提交审核」段——发布即公开（补丁位 0→1·纯修复轮；2026-09-15）——用户「呃那个我点击上传时
//   是提交审核你能不能先去除掉这一段？」：publishCloudArticle 成功分支改 headerStatus badge-success「Published」+
//   toast「已发布」（原 badge-warning「Pending review」+「已提交审核」）；查看器占位文案「可能仍在审核中」删除（发布
//   即公开无审核态）；后端 POST /api/articles 同步直存 published + 迁移 022 转遗留 pending；零草稿字段（v 保持 9）、
//   零后端、ethereal 零改动无需 inline-css
//   （rev 00225-6v6）
// v10.28.35.2 = 编辑器 XP 钩子重平衡（补丁位 1→2·数值平衡轮；2026-09-15）——站点等级经验值新表（v0.2.48.0：创建文章
//   +15），publishArticle/publishCloudArticle 两处 addXP('publish_article', 100) 改 15（发布即得 15 XP）；零草稿字段
//   （v 保持 9）；零后端、ethereal 零改动无需 inline-css
//   （rev 00228-w6f）
// v10.28.35.3 = 编辑器发布 XP 钩子 120/5 新·更新判定（补丁位 2→3·数值平衡轮；2026-09-16）——站点社交 XP（v0.2.49.0：
//   发布新文章 +120、更新文章 +5）：publishArticle/publishCloudArticle 两处 addXP('publish_article', 15) 换
//   publishXPReward()（读 slati_article_published 旗子：首次发布 120、同草稿再发布 5——「草稿首次发布算新、同草稿再发布
//   算更新、草稿清空重写回新」用户钦定；仅 addXP 成功（非 guest）才置旗）；saveDraft 草稿清空（无标题无卡）重置旗子=
//   新文章起点；零草稿字段（v 保持 9）、零后端、ethereal 零改动无需 inline-css
//   （rev 00229-d4z）
// v10.28.35.4 = 黑白主题切页闪修复随动（补丁位 3→4·观感修复轮；2026-09-16）——mono 规则（含 FC 工作台/编辑器
//   Migrate 族）自 settings-modal.js 运行时注入迁入 ethereal.css 随内联首帧生效 + FC 两页 head 内联块同步落
//   data-accent（与站点 v0.2.49.1 同轮）；零草稿字段（v 保持 9）、零 FC 逻辑改动
//   （rev 00231-8bp）
// v10.28.36.0 = 文章查看模式点赞/收藏操作条（小更新位 35→36·小功能轮；2026-09-19）——?article= 只读查看页右下
//   浮动胶囊 #fcViewActions：点赞（红心+计数）/收藏（金星+计数），数据源=GET /api/articles/:id 新互动字段
//   （likeCount/favoriteCount/likedByMe/favoritedByMe，与站点 v0.2.52.0 同轮）；点击镜像 community-hub
//   乐观更新+失败回滚，访客 toast 引导登录；demo 种子/404 路径不建条；零草稿字段（v 保持 9）
//   （rev 00254-w4f）
// v10.28.36.1 = 油漆5 噪点撕裂滤镜移挂剪层/覆盖层（补丁位 0→1·观感修复轮；2026-09-19）——用户「使用油漆五的时候
//   在FC那边内容也会被他的特效影响到变得扭曲」：卡级 filter: url(#mn-paint-filter-5) 对整卡渲染结果位移，卡内
//   文字/图片一起被噪点扯动；CSS 顺序 filter→clip-path 下改为 ::before/::after 子层挂滤镜——位移结果被自身
//   clip 裁回剪影内、卡身内容层零滤镜完全免疫，剪影边缘墨雾感由纹理特征位移×clip 交互保留（比旧版弱、内容
//   优先）；hover/selected/dragging 三态同步去 url()；defs 零改动；与站点 v0.2.53.1 同轮同机制
//   （rev 00256-6bg）
window.FLUIDCANVAS_VERSION = 'v10.28.36.1';
