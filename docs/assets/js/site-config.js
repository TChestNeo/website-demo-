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
// v0.2.55.1 = 文章发布去重复 + 云端文章可删（补丁位 0→1·修复轮；2026-09-20）——用户「为什么我点击public时他只是复制出新的一个文章？而不是发布？然后我在FC里无法删除我创建的文章没有删除按钮」：
//   后端：PUT /api/articles/:id 本人更新（编辑器再发布 = 更新原文章不重复建文；非本人 403/不存在 404/校验同 POST）；
//     DELETE /api/articles/:id 本人删除（article_comments FK 级联 + content_likes/favorites 互动行清理；非本人 403）；
//     测试 321→325/325（article-write 4 测）
//   前端：编辑器 localStorage slati_article_publish_id 记忆已发布 id（POST 成功存、再点 Publish 走 PUT 更新
//     「已更新发布」、404/403 清 id 回退新建、草稿清空同步作废）；新增 ?edit=ART-xxx 编辑模式
//     （列表 Edit 云端文章带 id 打开 → GET 拉原文 applyDraft 回填 + 设发布 id + 内容落本地草稿重戳 lastSaved
//     防云端草稿弹窗覆盖）；FC 列表云端文章渲染删除按钮 + deleteArticle/bulkDelete 走 DELETE API（本人可删失败保留）
//   FC v10.28.36.2（补丁位 1→2·修复轮：publishCloudArticle 更新分支 + ?edit= 加载 + 列表删除按钮）
//   （rev 00267-9l4）
// v0.2.55.2 = 文章阅读页国徽卡渲染 + 全卡型兜底（补丁位 1→2·修复轮；2026-09-20）——用户「我在MicroNationary内没有看见啊，到底你有没有把发布做好？」（发布本身无误：线上实测首页最新文章+搜索均见文章；真身=阅读页 renderBody 只画 content·img·bitmap·flag·text，用户的国徽卡被静默丢弃）：
//   阅读页：shield（国徽）卡入渲染（有图同国旗 figure、无图盾徽块 art-emblem 盾形图标+标签）；
//     img·bitmap·flag 无图时 flag 兜底图标块；其余卡型（map/character/stats/timeline/sheet…）不再静默丢弃
//     （有图出图、无图出 art-asset 图标+标签块；CARD_TYPE_ICONS 映射）
//   后端零改动；FC v10.28.36.2 零改动；电池 article-frontend 45→48（B4c/B4d/B4e 新场景）
//   （rev 00268-tcv）
// v0.2.56.2 = 文章阅读页 FC 1:1 画布渲染（补丁位 1→2·修复轮；2026-09-20）——用户「不是啊，我要的是FC里的1:1 文章内的卡片位置什么的都要1：1有那么难吗？？」（真身：阅读页 renderBody 把卡片按 row/col 排序后竖着堆成流——FC 里并排的两张卡在文章页变成上下叠，位置零还原）：
//   article.html 新增 renderBodyCanvas：卡片按编辑器画布绝对定位——x/y 像素 + 宽=span×cellSize+(span−1)×2
//     （cellSize 随 draft.activePreset：169=20/half=24/tablet=20/mobile=18，gap 2，与 FC 恢复路径同口径；
//     preset 存的位置优先于卡顶层，同编辑器 L5824）；aspect-lock 卡 fitW/fitH 取胜、content/text 高度自适应
//     （v10.28.15 w 精确宽优先）；rotate 绕中心转、z 按卡层级、hidden 眼睛开关跳过；
//     bbox 裁剪空余（不是 2200px 空画布）+ 两遍量盒（content 撑高重定 bbox）+ 等比缩放到栏宽（≤1.6×），
//     相对位置严格 1:1；卡面同款还原：图卡 object-fit cover+径向渐隐遮罩、国旗无图条纹、国徽无图盾徽块、
//     label captionPos 12 值同编辑器 CSS（absent=flexbox 居中）、图卡 label 黑底白字药丸；
//     无像素坐标的旧草稿保持流式兜底
//   后端零改动；FC 零改动；零 i18n 新键
//   （rev 00271-hsl）
// v0.2.57.0 = 文章发布后呈现界面统一（小改动位 56→57·新功能轮；2026-09-20）——用户「反正就是在FC的编辑那边把顶部栏变成显示文章标签的小栏，然后去除下方的格子和左侧的菜单变成左侧弹窗目录……中间的那个画布内的内容排版位置一定是要1：1的……窗口宽度较窄那些排版就只是被挤压改变位置而已」（问询钦定：新界面=文章发布后的呈现界面、顶部小栏=真正的标签系统、目录只列文字卡标题、固定 16:9 只在编辑器侧）：
//   阅读页：顶部标签条（contentJson.tags 顶层数组、空则整条不显示）、无全局侧栏（body.art-present 单列，
//     sidebar.js 照常渲染进 display:none 容器零 JS 依赖）、左侧弹窗目录（仅 content/text 且 label 非空卡、
//     点击 scrollIntoView+闪烁高亮）、宽窗严格 1:1（缩放封顶 1 不放大填空——作者看到什么读者看到什么）、
//     窄窗维基式回流（avail<bboxW 时零缩放：y 重叠贪心分带 flex-wrap、content/text 卡弹性换行、
//     stats/sheet/timeline 保自然宽横向滚动条、图卡等比收缩、最窄全上下单列）、防抖 resize 模式翻转重渲染
//   FC 查看模式呈现统一（v10.28.37.0）：灭网格线、同款标签条+目录抽屉（中文）、1:1 bbox 裁剪滚动（scale 恒 1 不放大）
//   后端零改动；ethereal 零改动（页面 CSS 全在 article.html 独立块 + FC head 查看块）；i18n 新键 4×12 + OpenCC
//   （rev 00272-g99）
// v0.2.58.1 = 左侧菜单底部不透明背景完全删除（补丁位 0→1·调整轮；2026-09-26）——用户「平台所有的
//   左侧菜单底部不是有一个不透明背景吗能不能去掉他，我要完全的删除它，注意我是指Z轴最底部的那一个
//   不是我的卡片」（真身=v0.2.53.3 菜单卡收为内容高后，卡下方剩一整块纯色不透明面板——09-10/09-18
//   两轮铺的侧栏整列不透明底 --sidebar-bg，即用户指的 Z 轴最底层背景；修法：侧栏容器铺底规则整体移除
//   （深浅两主题）→ 侧栏列全透明、卡下方不再有任何面板、页面底色直接可见；三张卡（logo/用户/菜单
//   .sidebar-module）零触碰；玻璃注入层灭滤镜灭磨砂规则保留（防 09-10 亮块机制复活）；卡片/下拉的
//   --sidebar-bg 用法不动；窄屏 floating 覆盖态同步透明（口径统一）；41 页内联块全量刷新；
//   FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00304-nzm）
// v0.2.58.7 = 折叠侧栏等级药丸与水波全翻倍（补丁位 6→7·调整轮；2026-09-26）——用户「那个波浪能不能大2倍啊？
//   还有那个药丸能不能大1倍啊」（两问钦定：波浪全翻倍 ×2·药丸长宽都 ×2）：58.6 药丸/水杯再放大——
//   药丸 32×58→64×116、水杯胶囊 28×42→56×84（border-radius:999px 不变、LV 号码居中不变、杯内宽 24→52，
//   LV 标签 7→14px、LV 号码 14→28px 同步放大；药丸 64 宽 > 用户卡内容 46px——折叠 72px 列与最窄 floating 64px 列均溢出用户卡各 4px/边、仍收在侧栏列内零越界=用户钦定取舍）；波浪全翻倍——
//   mask SVG viewBox 20×16→40×32（波长 20→40+振幅 8→16 双翻倍）、波浪带高 16px→32px、两波顶线随半高同步
//   （calc(40% - 8px)→-16px / -8px→-16px）、无缝循环 translateX 20px→40px 恰好一个波长、strip 恒 300%
//   （左右余量=杯内宽 52px ≥ 40px 波长，循环末帧不露缺口）；两层结构/两速 1.6s/2.2s 相位漂移/水位从底往上灌/
//   0.5s 过渡全保持；40 页内联块全量刷新+编辑器页手工同款；FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00310-pbk；同轮首部署瞬态 00309-jbl 已取代——58.6 未上线致编号预估错位）
// v0.2.58.8 = 折叠侧栏等级药丸收窄对齐菜单按钮（补丁位 7→8·调整轮；2026-09-27）——用户「能不能把他的
//   宽度变成和其他按钮一样？」（一问钦定「和菜单按钮一样 48px」）：58.7 药丸 64px 宽比折叠栏卡片
//   （56px）每边溢出 4px；修法：药丸 64→48、水杯胶囊 56→44（border-radius:999px 不变、LV 号码居中
//   不变、杯内宽 52→40=恰好一个波长——波浪 40×32 mask/32px 带高/平移 40px/顶线 -16px 全零改动；
//   LV 标签 14px/LV 号码 28px/药丸高 116px 不动）；药丸 48px=桌面折叠栏用户卡内容宽（模块 56−垫 8）
//   与内容列齐平零溢出；floating 64px 列右边线 1px 致模块 47、药丸右溢 1px 可忽略仍收在列内；两层结构/两速 1.6s/2.2s 相位漂移/水位从底往上灌/0.5s 过渡全保持；
//   40 页内联块全量刷新+编辑器页手工同款；FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00312-2n7；同轮首部署瞬态 00311-wkw 已取代——rev 文本先占位后填真值、二次构建烘焙成此终态）
// v0.2.58.11 = 折叠侧栏等级水杯两色互换（补丁位 10→11·调整轮；2026-09-27）——用户「能不能把那个浅蓝色
//   波浪和深蓝色倒反？」「就只是互换一下颜色而已」：58.10 深水+浅浪两色互换（类名保持不动）——主色水
//   .mn-lv-wdeep 背景 var(--color-primary)→var(--mn-lv-light) 变浅水、浅浪 .mn-lv-wlightwave 背景
//   var(--mn-lv-light)→var(--color-primary) 变深浪；两层结构/80×16 mask/16px 带高/400% strip/平移
//   80px/2.2s 单速/水位从底往上灌/0.5s 过渡/药丸 48×116/水杯 44×84/LV 标签 14px/号码 28px 全零改动；
//   sidebar.js 零改动（纯 CSS 零 JS）；40 页内联块全量刷新+编辑器页手工同款（inliner SKIP_CSS_REFRESH
//   豁免）；FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00317-ht9 瞬态占位上直播；二次烘焙重部署终态 rev 00318-2vk——live 文本 00317-ht9 滞后一部署=58.10 同款下轮烘焙）
// v0.2.58.15 = 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡（补丁位 14→15·调整轮；2026-09-28）——用户
//   「那么能不能添加一个功能就是当滑鼠靠近那个折叠的药丸时药丸会变大然后 向右滑出 一个卡片完整的
//   显示等级信息和经验条」：折叠态药丸悬停（.mn-lv-badge 整块=悬停区，贴近即触发）scale(1.12)+右侧
//   滑出 .mn-lv-hovercard（position:fixed 挂 body 逃双裁剪——侧栏 overflow-x:hidden+用户卡
//   overflow:hidden；z-index 150；内容=每次 show 从活的 .mn-lv-normal clone 最新 innerHTML 零陈旧；
//   200ms 宽限防缝隙闪烁；触屏门控 matchMedia(hover+fine)+CSS @media 同款双保险，触屏/平板零行为）；
//   展开态原徽章可见零卡片；sidebar.js 新 initLevelHover（renderSidebar 尾部每轮重挂监听）；药丸/水杯/
//   水位/两浪 58.14 全零改动；40 页内联块全量刷新+编辑器页手工同款（inliner SKIP_CSS_REFRESH 豁免）；
//   FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00325-555 瞬态占位上直播；二次烘焙重部署终态 rev 00326-j6m——live 文本 00325-555 滞后一部署=58.14 同款下轮烘焙）
// v0.2.58.18 = 个人资料自定义横幅/头像（补丁位 17→18·新功能轮；2026-09-29）——用户「能不能把个人资料的自定义
//   横幅/头像做一下」：资料页横幅 .profile-banner 只有 7 个玻璃预设渐变（无图片）；头像上传已有（编辑弹窗→
//   /social/uploads→PATCH）但无 FC 图库入口、PATCH avatarUrl 零校验（String(null) 会写 "null" 字面串缺陷）。
//   六项用户钦定：①编辑权限=仅本人（u.isSelf 门控结构已成立零新门）②图片来源=本地上传+FC 图库双来源（无 URL
//   输入）③自动适配零裁剪（服务端限大小/格式，页面居中裁切；横幅约 3:1 宽条、头像正方形；零裁剪 UI）④≤10MB 含
//   gif（jpg/png/webp/gif）⑤头像本轮也加图库入口 ⑥横幅显示在资料页顶部、头像叠其上（经典社交布局）；
//   后端：迁移 029_user_banner（users 加 banner_url 列，NULL=默认预设渐变，无新表 health 60 不变）、
//   PATCH /api/auth/me bannerUrl 新分支（null=移除、slice(0,500)+PAGE_BG_IMAGE_RE 校验、审计随行）+
//   avatarUrl 同款加固顺修 String(null) 缺陷、GET /api/social/users/:id bannerUrl 公开守卫行、
//   publicUser/公共 users 零改动（PII 最小口径 banner 绝不出现在发现/关注页）；
//   前端：renderHeader 横幅行（has-img 类+escapeHtml 内联背景图盖预设渐变）、编辑弹窗新组「横幅图片」（预览条+
//   上传/图库/移除三按钮+state 四态）、FC 图库选择器 openFcLibraryPicker（读 slati_img_library 只收 data:
//   条目=URL 输入后门过滤+3 列网格+空态）、fcDataUrlToBlob（dataURL→Blob 双来源同上传链直传绝不 FormData）、
//   头像图库入口同链落 editPendingAvatar、保存 diff-only（null 显式入 body=移除语义）；
//   侧栏 60px user-banner 零触碰（钦定只资料页顶部）；切页动画/10 分钟心跳/药丸悬停卡零触碰；FC 恒
//   v10.28.47.4；i18n 11 新键×11 语（OpenCC 重生成 zh-Hant）；CSS 全进页面专属块→跳过 inline-css.js；
//   后端测试 359/359（横幅案+头像加固案+迁移 029 案）+电池 profile-banner 122/122（继承母本全套 100 项+B 组 22 项）+
//   舰队 44 套全绿（article-frontend/notif-home 旧 user_version 28 锚随 029 改 29、all-opaque Chrome 未起 flake——独立复跑销账）+
//   冒烟 60/60+i18n 34/34；镜像内容验证 两次构建各验一次、先验后推；线上探针 profile-banner 10/10）：
//   （rev 00331-g9b 瞬态占位上直播；二次烘焙重部署终态 rev 00333-kkx——live 文本滞后一部署=惯例）
// v0.2.58.19 = 个人资料横幅/头像订阅分层（补丁位 18→19·新功能轮；2026-09-29）——用户「能不能在个人资料设置内
//   也添加这个功能类似discord那种分成基本和付费，还有这个和用户的频道主页的横幅是不互通的」：58.18 横幅/头像
//   功能（上传+FC 图库双来源、gif 全家放行）无分层。三项用户钦定：①分层=免费（静态图 jpg/png/webp 上传）vs
//   付费（gif 动图+FC 图库来源，tier∈{basic,premium,ultra}）②纯前端门禁（同弹窗「边缘主题」组先例：锁 UI+
//   点击 toast 不生效+premium.html 升级链接；后端零改动——上传端点不能门禁，帖子发图也走它会误伤）
//   ③资料横幅与用户频道主页横幅保持不互通（FC 频道主页 #channelOverview 本轮零改动——FC 卡本来就不读
//   users.banner_url）；
//   前端（community-profile.html）：blockGif(ext) 助手拦 gif（免费 toast gifLocked+零 fetch；横幅 uploadBannerBlob
//   统一漏斗+头像文件/图库两处共三入口）、图库按钮免费点击 toast libLocked 不生效（选择器绝不打开 DOM 零构建）、
//   两图库按钮锁态（.sub-locked 半透明+lock 图标+title「订阅后可用」+「订阅」徽标）、基础/自定义两 tab 各一条
//   升级链接（avatarGifUpgradeLink/bannerGifUpgradeLink 订阅时 display:none）；祖父条款天然成立（渲染无 tier
//   检查——免费用户已有 gif 横幅/头像继续显示；移除按钮永可用）；故意不对称：页面背景组不在本轮范围（免费仍可传
//   gif 页背景）；CSS 全进页面专属块→跳过 inline-css.js；后端零改动、FC 恒 v10.28.47.4；i18n 3 新键×12 语
//   （OpenCC 重生成 zh-Hant、en 值=页面兜底串逐字节一致）；
//   电池：新 tmp-battery-profile-subtier（免费锁 UI/图库拦截/gif 拦截/静态放行/订阅全解锁/祖父 D 组）+
//   profile-banner 旧电池 B 组种 tier 修正；舰队 45 套全绿+冒烟 60/60+i18n 34/34；镜像内容验证两次构建各验
//   一次、先验后推；线上探针 profile-subtier）：
//   （rev 00334-tz6 瞬态占位上直播；二次烘焙重部署终态 rev 00335-fmn——live 文本滞后一部署=惯例）
// v0.2.58.20 = 个人资料头像与 FC 频道主页头像双向同步（补丁位 19→20·新功能轮；2026-09-30）——用户「还有个人
//   资料设置里的头像你没有做更换头像是和频道主页同步的当然用户可以勾选是否要同步」：58.18/58.19 头像只落在
//   资料页，FC 频道主页频道卡头像恒为首字母（从不读 user.avatarUrl）。三项用户钦定：①勾选框默认勾选（键缺失=
//   ON）②双向同步·资料页权威（勾选框只活在资料编辑弹窗；FC 频道卡头像点击也可换，走同一上传+PATCH 链）
//   ③边界「个人资料的自我介绍和频道主页的bio是不互通的」——FC PATCH 只发 avatarUrl 绝不发 bio、资料页 bio
//   保存流零改动（FC 页本身零 bio）；
//   前端：资料页编辑弹窗头像组新勾选行（.toggle-switch 复用 ethereal 已有 CSS 零新样式；toggle 即时落
//   localStorage slati_avatar_sync 不经保存事务）+保存成功分支 avatarUrl 在 body 且勾选 ON → raw 合并写
//   slati_user（绝不 SlatiDB.saveUser——mirrorProfile 二次 PATCH 双写；OFF 零写入，FC 读旗标显字母卡）；
//   FC（fluidcanvas.html）：renderContent 个人分支旗标 ON 且有头像 → 频道卡 img（fcEsc 转义）+fc-avatar-editable
//   类+title 每渲染重打（innerHTML 整换吞监听→一次性委托挂常驻 #channelOverview）；点击换头像链=隐藏 file
//   input 恒挂 body→ext 白名单+gif 订阅门禁（同资料页 tier!=='free' 口径）+10MB→fcEnsureApi 注入（FC 页无
//   api.js 静态引入）→fetch POST /social/uploads?ext=（credentials:'include' 同资料页契约）→PATCH /auth/me
//   只 {avatarUrl}→r.ok 才改 UI（user.avatarUrl+raw 合并写 slati_user+#personalAvatar+renderContent+toast）；
//   团队卡永不受影响（无类无入口）；hover 相机徽章 CSS 全进 FC 页面专属块→跳过 inline-css.js；storage.js
//   零改动；后端零改动；i18n 资料 1 新键+FC 6 新键×12 语（OpenCC 重生成 zh-Hant、en 值=页面兜底串逐字节
//   一致）；FC v10.28.48.0 同轮（FC 频道卡头像同步=FC 功能轮）；
//   电池：新 tmp-battery-profile-avatarsync（P 组资料页默认勾选/关同步零写入/开同步 raw 合并恰 1 PATCH/重载
//   持久化；F 组 FC 图片卡/关旗标字母卡/点击换头像 PATCH 体恰 {avatarUrl} 无 bio/gif 订阅门禁/团队卡零动作/
//   客人零异常）+旧电池五套锚随扫；舰队 46 套全绿+冒烟 60/60+i18n 34/34；镜像内容验证两次构建各验一次、
//   先验后推；线上探针 avatarsync）：
//   （rev 00336-7gr 瞬态占位上直播；二次烘焙重部署终态 rev 00337-wxl——live 文本滞后一部署=惯例）
// v0.2.58.24 = 社区页演示样本全移除+三 tab 全接真数据（补丁位 23→24·新功能轮；2026-09-30）——用户
//   「能不能把社区页面的所有测试使用的样本信息都去除掉」：真身=community-hub 的 feedData 8 张硬编码
//   演示卡（Marcus Vane 等假名假数）+4 个访客静态按钮+发现中心 3 个硬编码假频道+本地演示话题，且云模式下
//   只有推荐 tab 接真数据（关注/主题两 tab 登录用户仍看假卡）。四项钦定（AskUserQuestion）：①只删页面假样本
//   （后端库数据不动、真帖保留）②匿名访客看登录引导卡（58.17 following 先例）③三 tab 全接真数据
//   （recommend=/api/social/posts、following=/api/social/feed、topic=/api/social/topics）④发现中心一并清理
//   接真数据（话题/热门接真话题，空表显空态；频道无数据源保留 tab 显空态；访客看引导）。
//   修法=纯前端 hub 重写：feedData/本地话题/访客引导链全删；cloudMode 改 boot 同步门 isHubAuthed()
//   （USR- 真账号+登录态才算，demo 账号零 API 连 probe 都不发）；访客→登录引导卡、已登录但后端不可达→
//   离线卡（绝不回退假数据）；refreshCloudFeed 三端点并行按 tab 门控重渲染；mn:unauthorized 整流回引导卡；
//   renderDiscovery/renderTrending 接真话题（热门 memberCount 降序 top5）；i18n 删 32 键×12 语+新 10 键×12 语
//   （OpenCC 重生成 zh-Hant、zh 值=页面兜底串逐字节一致）；后端零改动、CSS 零改动→跳过 inline-css.js；FC 恒
//   v10.28.48.0；
//   （rev 00344-ntt 瞬态占位上直播；二次烘焙重部署终态 rev 00345-vhw——live 文本滞后一部署=惯例）
// v0.2.58.28 = 折叠侧栏用户卡不透明补丁（补丁位 27→28·调整轮；2026-10-05）——用户「现在是用户卡片那边
//   在折叠起来的时候还是一样是半透明的」；
//   真身=58.27 修法只改 .sidebar-module 基态，折叠态高特异性覆盖 .app-sidebar.collapsed .user-module
//   （窄栏头像卡）仍写 background:var(--card-bg) 半透明玻璃——折叠时透卡依旧；
//   修法=折叠态覆盖同改 --sidebar-bg 不透明底（09-18 钦定口径+58.27 同款）+blur(20px) 保留；
//   ethereal.css 改动→重跑 inline-css.js（40 页内联刷新+8 页豁免）；
//   FC 恒 v10.28.52.0；后端零改动 npm test 413/413；i18n 零新键；transitions.js/10 分钟心跳零触碰；
//   （rev 00367-4wl 瞬态占位上直播；二次烘焙重部署终态 rev 00368-gmw——live 文本滞后一部署=惯例）
// v0.2.58.27 = 侧栏菜单背景卡片改不透明（补丁位 26→27·调整轮；2026-10-05）——用户「那个在个人主页
//   那边的左侧菜单背景卡片是半透明的能不能变成不透明的？」；
//   真身=v0.2.58.1（09-26 删侧栏容器铺底）后三张卡（logo/用户/菜单 .sidebar-module）仍用 --card-bg
//   （亮色 rgba(255,255,255,0.55)/暗色 rgba(30,30,50,0.55) 半透明玻璃）+blur(20px) 磨砂——页面内容
//   透卡可见=半透明观感；
//   修法=ethereal.css .sidebar-module 卡面 background --card-bg→--sidebar-bg（09-18 钦定不透明底：
//   亮色近纯白 0.95/暗色实心 #1a1a2e/mono 随 var() 自适应）；模块自带 backdrop-filter 保留（底已
//   不透明零可见效果，09-20 全站卡片同口径）；三张卡同规则一并生效；窄屏 floating 覆盖态同步（口径统一）；
//   ethereal.css 改动→重跑 inline-css.js（40 页内联刷新+8 页豁免：FC 编辑器/演示/故事页）；
//   FC 恒 v10.28.52.0；后端零改动 npm test 413/413；i18n 零新键；transitions.js/10 分钟心跳零触碰；
//   （rev 00365-6zb 瞬态占位上直播；二次烘焙重部署终态 rev 00366-2jw——live 文本滞后一部署=惯例）
// v0.2.58.26 = FC 首页假数据全撤接真实聚合+首页卡片不透明（补丁位 25→26·新功能轮；2026-10-02）——用户
//   「能不能顺便把FC的所有并非用户手动创建的测试信息都去除掉，还有把所有FC的首页卡片从玻璃变成不透明的
//   卡片？」；三项钦定（AskUserQuestion）：①清除范围=只页面硬编码假数据（演示文章/图库样例/假统计 48.2K/
//   假上传记录/假趋势）——演示账号与后端库不动 ②假数字区块=接真实数据+空态（后端加真实聚合端点；匿名=
//   登录引导卡 58.24 hub 先例）③玻璃→不透明=只首页卡片（按钮/搜索胶囊保持玻璃）；
//   真身=FC 首页（fluidcanvas.html）八处硬编码测试信息：dashboard 演示统计（个人 48.2K 粉丝/团队乘数）、
//   quickStats 假四卡、内容表硬编码行、上传模块 SIMULATED_FILES 假记录+simulateFilePick、内容库 18 条
//   演示条目、分析页假趋势（pData/sData/mult 三数组）、文章页 15 条种子文章+演示 contentJson blob、
//   头像 Alex Rivera 兜底——图库持久库 slati_img_library 本就纯用户上传零样例无需清理；
//   修法=后端新增 GET /api/fc/overview（routes/public/fc-overview.js+server.js 注册；requireSession 登录
//   专属+限流 fco:user: 30/min）：stats 15 键全真聚合（followers/following/articles/articlesPublished/
//   articleViews/articleLikes/articleFavorites/articleShares/posts/postViews/postLikes/postFavorites/
//   postShares/repostsReceived/media）+windows 7d/28d/month 三窗口（等长前窗对比 newFollowers/
//   articlesCreated/postsCreated/interactionsReceived 各带 Prev+Pct、前窗零 Pct=null、fillDays 日序列恰
//   7/28 点）+articles 清单（互动实时计数+wordCount HTML 剥标签 CJK 正则）+media 最新在前+posts
//   content 截 80 字 media 原样（npm test 361→366/366）；
//   前端假数据全撤接 FC_OVERVIEW（boot 同步门 cloudMode=登录+USR- 前缀——访客/演示账号零 API 连 probe
//   不发；FC_OVERVIEW=null 全站 '—'/空态绝不回退假数据）：dashboard 个人分支真计数（followers/浏览/互动）
//   +团队分支假乘数全撤、quickStats 总浏览/收藏/分享/新关注、内容表文章 viewCount 前 5+媒体前 5（空态
//   提示卡）、上传模块真上传 POST /api/social/uploads（登录门 toast+成功 toast+loadFcOverview(true)
//   刷新）、内容库 articles+posts 聚合（Published/Review/Draft 状态映射）、分析页三窗口真趋势+sparkline+
//   详情表（无数据空态卡）、文章页云端清单（真 DELETE /articles/:id、View 状态判读、批量发布 toast 引导
//   编辑器）；首页卡片玻璃→不透明（钦定③）：body.fc-page .card:not(.profile-header) 背景 --card-bg→
//   --sidebar-bg+>.lg-backdrop 滤镜摘除（09-20 sitewide-opaque 先例镜像）+channelOverview/channelSummary
//   内联渐变 !important 覆写（深色主题同款）；按钮/搜索胶囊保持玻璃；FC v10.28.48.2 同轮；i18n 25 新键
//   ×12 语+fc.landing.demoSub 死键删（OpenCC 重生成 zh-Hant、en 值=页面兜底串逐字节一致）；CSS 全进页面
//   专属块→跳过 inline-css.js；切页动画/10 分钟心跳零触碰）：
//   （rev 00348-t8b 瞬态占位上直播（已实得）；二次烘焙重部署终态 rev 00349-hgc——live 文本滞后一部署=惯例）
// v0.2.58.25 = 横幅/头像上传裁切弹窗+横幅增高 1.5 倍（补丁位 24→25·新功能轮；2026-10-01）——用户
//   「那个横幅和头像在上传后能不能先弹出一个选择裁切范围的弹窗调整裁切范围，还有那个横幅能不能再高
//   1.5倍？」；六项钦定（AskUserQuestion）：①裁切=图片显示范围裁切、裁切后 GIF 保持动画（绝不 canvas
//   重编码——原文件原样上传、裁切元数据存服务端、渲染用 <img>+几何数学 GIF 天然动画）②固定比例框+图片
//   缩放/平移（Discord 换头像式：头像 1:1、横幅 3:1）③横幅 ×1.5 两处同改（资料页 140→210px 含边缘主题
//   硬编码、设置弹窗预览 96→144px）④图库选图也走裁切弹窗 ⑤FC 频道主页频道卡头像也应用个人裁切（FC
//   v10.28.48.1 同轮）⑥已有横幅/头像加「重新裁切」按钮（资料页编辑弹窗+设置弹窗；FC 不加）；
//   修法=裁切元数据=归一化矩形 {x,y,w,h}（0..1 浮点、x+w≤1、y+h≤1）存 users 新列 banner_crop/
//   avatar_crop（TEXT JSON，030 迁移 user_version 30；null=默认 {0,0,1,1} 整图 cover=爷爷辈零回归）；
//   渲染数学（中心锚定式、cover+center 严格推广）：s = max(W/(w·Nw), H/(h·Nh))、img width=Nw·s
//   height=Nh·s、left=W/2−(x+w/2)·Nw·s、top=H/2−(y+h/2)·Nh·s——w=h=1 时与现状 background-size:
//   cover+center 逐像素等价；组件=settings-modal.js 内置 window.MN_CropDialog（open/isOpen/applyCrop/
//   rescaleAll；community-profile/fluidcanvas 已载 settings-modal.js 零新 script 标签；上传链留在调用方
//   弹窗只产 rect；Esc 捕获相 stopPropagation 防连锁关下层弹窗；Blob objectURL 四出口统一 revoke）；
//   门禁序=file change/图库点击→free 门禁（toast 不弹窗）→gif 门禁→白名单/≤10MB（弹窗前）→弹窗→确认
//   后 fetch、取消=零上传零 PATCH；确认不拖不滚恒 rect {0,0,1,1} 且一律写入 PATCH 体（键序 url 先 crop
//   后）；后端 auth.js+social.js parseCrop/parseCropSafe（严格版坏值 400 VALIDATION/宽容版回 null）+
//   publicUser 与 GET /social/users/:id 暴露两 crop+连带清（url:null→crop 清空、换 url 未带 crop→该 crop
//   重置 null 防旧 crop 错配新图）；storage.js mirrorProfile 白名单绝不加 crop 字段（cloudMerge 全量回读
//   自动落 slati_user）；渲染=资料页横幅/头像、设置弹窗双预览、FC 频道卡头像三处 wrapper+img 几何应用
//   （侧栏 60px/userpop 96px/FC 顶栏 #personalAvatar/帖子作者头像零改动）；CSS 全进页面/settings 专属块→
//   跳过 inline-css.js；i18n 10 新键×12 语（common crop.* 6+settings.profile.reCrop* 2、资料页 prof.edit.
//   reCrop* 2；OpenCC 重生成 zh-Hant、zh/en 值=页面兜底串逐字节一致）；
//   （2026-10-01 补报）视频横幅：用户「还有要允许上传视频，大小的话平台自己压缩，然后上传视频最长1分钟」
//   +「那个视频是指横幅的部分」——范围=只横幅（头像保持图片/GIF、视频文件在头像链 toast 拒绝）；
//   压缩=浏览器端 canvas.captureStream+MediaRecorder（宽 1280 上限等比缩、30fps、1.2Mbps、静音无音轨、
//   输出恒 webm；settings-modal.js 全局 MN_CompressVideo/MN_VideoCap——MN_VideoCap=min(时长,60) 纯函数
//   自动截取前 60 秒，超 1 分钟即截、短视频 onended 早停）；门禁=GIF 同门（free/basic 拦 toast+升级链、
//   premium/ultra 可用）；裁切弹窗对视频同样适用（同漏斗：门禁→白名单→压缩（跳过 10MB 预检=输入任意大
//   平台自己压缩）→弹窗→confirm 上传压缩成片；弹窗/预览 <video autoplay muted loop playsinline> 走同
//   applyCrop 几何数学）；后端零改动（v0.2.16.0 帖子媒体链已含 webm/mp4/mov 白名单+魔数+30MB 上限——
//   压缩成片天然合规）；i18n 追加 8 新键×12 语（common settings.profile.video* 4+资料页 prof.* video* 4）；
//   （rev 00346-rn2 瞬态占位上直播；二次烘焙重部署终态 rev 00347-skv——live 文本滞后一部署=惯例）
// v0.2.58.23 = 悬停预加载消除切页白闪（补丁位 22→23·新功能轮；2026-09-30）——用户
//   「为什么我在切换页面的时候会闪一下 然而我在抖音或者Youtube切换页面的时候并不会闪烁一下
//   是不是没有做预先加载？」：真身=本站是多页应用（每页独立 HTML，跳页=销毁旧文档冷下载新文档→
//   白闪），抖音/YouTube 是单页应用（壳常驻内容 JS 换、不重建文档）；本站此前全站零预加载
//   （仅视频 preload 属性）。钦定 A=悬停预加载：鼠标悬停站内链接 65ms 后
//   <link rel="prefetch" as="document"> 后台预下载目标页，点击导航命中预取缓存（本站
//   HTML/JS/CSS no-cache+ETag 也走 304 重校验、正文零传输）→ 切页白闪消除。
//   修法=纯前端 transitions.js 新增悬停预取块（isInternal/isSamePage 复用+桌面 hover 门控
//   matchMedia('(hover: hover)') 触屏自动关+Save-Data 省流量模式跳过+65ms 防误触+每链接一次性
//   dataset 守卫+鼠标移开取消计时器=快速扫过零预取+失败静默——切页动画/点击劫持/节奏时长缓动
//   逐字零改动）；后端零改动、CSS 零改动→跳过 inline-css.js；i18n 零新键；FC 恒 v10.28.48.0；
//   （rev 00342-zsw 瞬态占位上直播；二次烘焙重部署终态 rev 00343-gxb——live 文本滞后一部署=惯例）
// v0.2.58.22 = 横幅订阅三层门禁+免费层单色/渐变预设色卡+金色罩子+图库弹窗加大（补丁位 21→22·新功能轮；2026-09-30）——用户
//   「那个横幅的从图库中选择和上传图片的能不能改成只限于基础订阅项 然后 如果要使用动图就要高级订阅，然后没有订阅的就
//   只能调整横幅的单色和渐变颜色，就是例如黑白中间有渐变的那种效果，还有图库按钮点击后的弹窗能不能大有点？还有我希望
//   那个按钮是在没有订阅的用户目前是被特别的金色罩子盖住的而不是点击后才出现提示反馈」：58.19/58.21 门禁是二元制
//   （free=静态图，basic/premium/ultra=图库+gif），本轮改三层——free：横幅只能预设色卡（上传/图库被锁）；basic：上传+
//   图库静态图 OK、gif 锁（升级链接→高级）；premium/ultra：全部含 gif；头像保持现状（free 仍可传静态头像，仅图库钮锁）。
//   四项钦定：①两处一起改（设置弹窗+资料页编辑弹窗同口径）②免费层=扩展预设色卡（现有 6 玻璃渐变+新增 6 单色/黑白系
//   =13 格点选即存，复用 cardBg 落库零迁移）③金罩=所有被锁按钮且相邻按钮共用一个罩（「如果两个按钮很接近就直接只使用
//   一个罩 不要使用两个」）④头像保持现状；
//   修法=后端唯一改动：CARD_BG_KEYS 白名单 auth.js+social.js 双数组同款追加 6 键（solid-black/solid-white/solid-gray/
//   mono-bw/mono-silver/mono-charcoal，否则新预设 PATCH 400）；资料页：CARD_BG_KEYS/DEFS 追加 13 格（墨黑/纯白/石板灰/
//   黑白渐变/银灰渐变/炭黑渐变）、gif 谓词拆 canGif（premium/ultra 专属）、横幅 upload+lib 免费层包
//   .gold-lock-group（相邻共罩）移除钮永远在罩外、上传点击免费层 toast「横幅图片为订阅用户专属功能」文件选择器绝不打开、
//   升级链接 tier 矩阵（free=imgUpgrade/gifUpgrade 旧键、basic=premGifUpgrade 新键、premium/ultra=不渲染）、
//   FC 图库选择器弹窗 560→680px+缩略图 64→80px；设置弹窗：stCanImg/stCanGif 谓词、ST_BG_KEYS/ST_BG_DEFS 13 条、
//   新 #settingsBgGrid 7 列预设网格（stReal 门内）点击即存 PATCH {cardBg} ok 才落本地+active 换位+预览即时吃色、
//   .settings-banner-preview 吃 var(--lg-bg)、图库浮层 300→400px+max-width 防溢出+3→4 列、横幅 upload+lib 金罩、
//   头像图库钮金罩；金罩 CSS 两处同款（.gold-lock-group 相邻共罩+.gold-locked 单钮+goldShimmer 2.4s 呼吸；伪元素
//   全 pointer-events:none——点击穿透到按钮 toast 反馈保留）；祖父=free 已有 bannerUrl 继续显示+移除钮永可用；
//   侧栏用户弹窗横幅只读不回退预设——故意不对称零改动；CSS 全进两文件注入/页面专属块→跳过 inline-css.js；
//   后端 npm test 359/359 重跑；FC 恒 v10.28.48.0；
//   i18n：common 5 新键+资料页 3 新键×12 语（settings.profile.bannerColor/imgUpgrade/premGifUpgrade/toast.bannerLocked/
//   toast.bgUpdated+prof.edit.imgUpgrade/premGifUpgrade/prof.toast.bannerLocked；现有 gifUpgrade 键保留只改用途=free 层
//   头像行专属文案；OpenCC 重生成 zh-Hant、zh 值=页面兜底串逐字节一致）；
//   （rev 00340-wgj 瞬态占位上直播；二次烘焙重部署终态 rev 00341-hbw——live 文本滞后一部署=惯例）
// v0.2.58.21 = 侧栏用户卡片信息弹窗+设置弹窗头像/横幅完整自定义（补丁位 20→21·新功能轮；2026-09-30）——用户
//   「能不能点击左侧用户卡片或头像时是弹出用户完整信息弹窗而不是跳转到主页，还有你根本就没有在设置里完成我要的
//   用户头像和横幅的自定义功能 >:(」：真身①=侧栏用户模块（22 页共用）头像+名字+公民号包锚整页跳转自己主页；
//   真身②=设置弹窗资料区只有显示名+bio（且只存本地不 PATCH）+公民号/性别只读+头像相机按钮是死的（无 id 无监听）——
//   58.18-58.20 的头像/横幅自定义全部只活在资料页「编辑资料」弹窗，设置弹窗里什么都没有，用户生气属实。三项钦定：
//   ①设置弹窗资料区直接放完整控件（头像：预览+上传+FC 图库；横幅：预览+上传+图库+移除；同步勾选；免费/付费
//   gif 门禁同款），改完即时生效不跳页 ②侧栏卡片弹完整信息卡（横幅+头像+名字+公民号+性别+简介+订阅状态+关注/
//   粉丝/帖子数+加入时间+「编辑资料」「查看主页」两按钮）③弹窗「编辑资料」→就地打开设置弹窗（不跳页）；
//   修法=纯前端、后端零改动（POST /social/uploads、PATCH /auth/me、GET /social/users/:id 全已存在）、FC 恒
//   v10.28.48.0：sidebar.js 锚保留（中键/ctrl/新标签仍跳主页）左键拦截 preventDefault+openUserPop（body 挂载
//   ~380px 卡；数据两段式=本地 slati_user 即时渲染+异步 GET /social/users/:id 回填统计/加入时间/性别/bio/横幅，
//   回填新鲜度守卫+失败离线=本地数据+统计 '—' 零回退假数据；「编辑资料」=SlatiSettings.open() 无则兜底跳资料页）；
//   settings-modal.js 资料区重写（settingsAvatarPreview/settingsAvatarBtn/settingsAvatarLibBtn 免费层
//   sub-locked+settingsBannerPreview 横幅预览条+上传/图库/移除三按钮+settingsBannerRemoveBtn 无横幅隐藏+双升级
//   链接+同步勾选 makeToggle 写 slati_avatar_sync '1'/'0'+两隐藏 file input）上传统一链 stUpload（gif 免费锁
//   toast+显升级链接+零上传零 PATCH→白名单→≤10MB→POST /social/uploads?ext=→PATCH /auth/me 只 {avatarUrl} 或
//   {bannerUrl} 或 {bannerUrl:null} 移除语义→ok 才改 UI：同步 ON 才 raw setItem 合并写 slati_user——绝不
//   SlatiDB.saveUser 双 PATCH 坑、bannerUrl 恒写、预览 src 直改+侧栏头像直改+stToast；stPickFromLibrary 免费
//   libLocked 锁/付费 slati_img_library 只收 data: 条目 3 列网格浮层点格转 Blob 走同链）；i18n common 21 新键
//   ×12 语（sidebar.pop 6+settings.profile 15；OpenCC 重生成 zh-Hant；en 值=兜底串逐字节一致）；
//   （rev 00338-tj5 瞬态占位上直播；二次烘焙重部署终态 rev 00339-m4j——live 文本滞后一部署=惯例）
// v0.2.58.17 = 关注页真实数据接入（补丁位 16→17·新功能轮；2026-09-29）——用户「那么关注页面的也做一下」：
//   关注页全站最假的一页——零 fetch 零 api.js、5 组种子数组（feedItems 8 条/discoverNations·Topics·Users
//   各 4/recItems 3）、搜索胶囊死输入、「+关注」按钮无 handler、唯一数据源是 localStorage 演示种子（种子
//   用户还是显示名，后端 PUT 只收 USR- 格式连镜像都失败）；后端关注体系已完整存在（following 表/POST/DELETE
//   关注/通知/测试）——本轮零迁移、前端重写+补 3 个新端点。四项用户钦定：①动态=关注用户帖+关注话题帖 ②未登录=
//   页面可看、发现给真实公开数据、动态/关注给登录引导卡（不跳转）③离线=离线卡片绝不回退假数据（5 组种子全删）
//   ④发现·用户=新建公开用户端点（暴露度与现公开主页一致：id/displayName/avatarUrl/citizenId，绝无 email/bio）：
//   后端 social.js 三新端点（零迁移、server.js 零改动）：GET /api/social/feed（requireSession；关注用户帖
//   ∪关注话题帖、seq DESC LIMIT 100、postRow 复用）、GET /api/social/following/detail（关注三类明细解析、
//   已删目标静默丢弃、teams 忽略、nation followerCount 现算）、GET /api/public/users（匿名公开+限流 30/min、
//   active only+followerCount DESC·seq ASC 平局+LIMIT 20、viewer 随行 followedByMe）；
//   前端 IIFE 整体重写（渲染器全纯零重拉、搜索实时过滤三区、auth 双门 isLoggedIn+USR- 前缀、mn:unauthorized
//   退登录引导态、nation/topic 切换走 SlatiDB.saveFollowing 触发 PUT 镜像、user 切换走 POST/DELETE 后
//   localStorage 直写绝不 saveFollowing 防双重写、链式 __mnI18nRerender 不踩 activity 页）；
//   i18n：54.2 demo 文案键族 37 死键整体删除、suffix 保留、11 新键×11 语言手写（OpenCC 重生成 zh-Hant）；
//   切页动画/10 分钟心跳/药丸悬停卡零触碰；FC 恒 v10.28.47.4；后端测试 356/356+电池 following 25/25+
//   舰队 43 套全绿（grep exit=1|💥 复核零命中；home-bg Chrome 未起 flake 独立复跑 26/26 销账）+
//   冒烟 60/60+i18n 34/34；镜像内容验证 57/57+57/57（两次构建各验一次、先验后推）；线上探针 following 14/14）：
//   （rev 00329-6nq 瞬态占位上直播；二次烘焙重部署终态 rev 00330-gcs——live 文本 00329-6nq 滞后一部署=58.16 同款下轮烘焙）
// v0.2.58.16 = 活动页真实数据接入（补丁位 15→16·新功能轮；2026-09-29）——用户「能不能先把动态页面的
//   所有实际功能做一下？」：动态页六大区块全是硬编码假数据（kpiData/generateGrowthSeries/topNations
//   等种子数组）、搜索胶囊是死的（输入框无监听）、热力图 page_views 全站无人上报是空表；修法（四项用户
//   钦定：①KPI 第 5 卡「条约签署」无 treaties 表→新公民数（窗口新注册+趋势）②「内容分类分布」无分类
//   字段→内容类型分布（文章/帖子/评论/点赞真实计数）③死搜索框→排行榜名字+里程碑标题实时过滤 ④热力图→
//   全站装 pageview 灯塔攒数据（空态友好提示、保持 6 时段×7 天形状））：
//   后端零迁移新增 GET /api/public/activity（匿名公开+轻限流 30/min）聚合六区块——KPI 五卡（国家/公民=
//   全量总数+窗口增量趋势、新公民/文章/动态=窗口计数、trend=等长前窗 deltaPct 前窗空→'—'）、趋势图恒
//   30 天日序列、内容类型四条形、热力图最近 7 完整 UTC 日×6 时段（page_views）、排行榜 activity_daily
//   请求和 TOP5（零分不上榜）、里程碑三类型（nation/article/citizen）——公民 title 恒 null（公开端点
//   PII 禁令零邮箱零 display_name）；
//   前端 IIFE 整体重写：state{range/cache/search}+loadData 缓存+陈旧守卫、失败/空态绝不回退假数据
//   （离线一张提示卡五容器清空、热力图空态友好提示）、搜索过滤两区零重拉、切语言从缓存重渲、subnav
//   .active 归 subnav.js（页面零触碰）；全站灯塔（本文件尾）：sendBeacon 优先+fetch keepalive 兜底
//   POST /api/analytics/pageview（slati_cid 一次性生成、__slatiPvSent 每页一次守卫、try/catch 静默）；
//   i18n 16 新键×11 语言+旧条约/分类键族整体删除（OpenCC 重生成 zh-Hant）；切页动画/10 分钟心跳/药丸
//   悬停卡零触碰；FC 恒 v10.28.47.4；后端测试 342/342；电池 activity 14/14+舰队 42 套全绿+冒烟 60/60+
//   i18n 34/34；镜像内容验证两次构建各验一次、先验后推；线上探针 activity 8/8）：
//   （rev 00327-n5s 瞬态占位上直播；二次烘焙重部署终态 rev 00328-c67——live 文本 00327-n5s 滞后一部署=58.15 同款下轮烘焙）
// v0.2.58.14 = 折叠侧栏等级水杯慢浪改浅色（补丁位 13→14·调整轮；2026-09-28）——用户「那个刚才提出添加的
//   第二个波浪我希望是浅色的」：慢浪 .mn-lv-wlightwave2 背景 var(--color-primary)→var(--mn-lv-light)
//   （58.11 浅水同款浅色公式 color-mix(in srgb, var(--color-primary) 55%, #ffffff)；赋值挂 .mn-lv-ring
//   恢复——58.13 整体删除后本轮复活）；快浪/水深蓝/两层结构/80×16 mask/16px 带高/400% strip/平移 80px/
//   top -12px 同顶/2.2s+2.5s 两速/z 层级（fill 0→水 -2→慢浪 -1→快浪 0）/水位从底往上灌/0.5s 过渡/药丸
//   48×116/水杯 44×84 全零改动；sidebar.js 零改动（纯 CSS 零 JS）；40 页内联块全量刷新+编辑器页手工同款
//   （inliner SKIP_CSS_REFRESH 豁免）；FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00323-qsz 瞬态占位上直播；二次烘焙重部署终态 rev 00324-xr2——live 文本 00323-qsz 滞后一部署=58.13 同款下轮烘焙）
// v0.2.58.13 = 折叠侧栏等级水杯双浪同色深蓝+慢浪 z-1 层（补丁位 12→13·调整轮；2026-09-28）——用户
//   「然后把两个颜色改成一样的深蓝色，然后在那个波浪Z轴的-1那边再添加一个慢0.3s的波浪」：①水和浪两色
//   统一深蓝——主色水 .mn-lv-wdeep 背景 var(--mn-lv-light)→var(--color-primary)（58.11 两色互换撤销为
//   两色相同）、--mn-lv-light 赋值整体删除（零引用，58.10 --mn-lv-wave-c 先例）；②新慢浪
//   .mn-lv-wlightwave2 与快浪全同款几何（80×16 mask/16px 带高/400% strip/平移 80px/top -12px 全同）
//   置于快浪 z 轴 -1 层（z-index:-1）+动画 2.5s（慢 0.3s）；z 层级：.mn-lv-fill z-index:0 建 stacking
//   context→水 z-index:-2 最底→慢浪 -1→快浪 0；两浪同色相位漂移，慢浪浪峰周期性从快浪浪谷透明区透出
//   =两道浪峰不同速叠加；水位从底往上灌/0.5s 过渡/药丸 48×116/水杯 44×84 全零改动；sidebar.js 模板加
//   慢浪 div（纯 CSS 动画零 JS）；40 页内联块全量刷新+编辑器页手工同款（inliner SKIP_CSS_REFRESH 豁免）；
//   FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00321-jbh 瞬态占位上直播；二次烘焙重部署终态 rev 00322-cv4——live 文本 00321-jbh 滞后一部署=58.12 同款下轮烘焙）
// v0.2.58.12 = 折叠侧栏等级水杯波浪位置抬高 4px（补丁位 11→12·调整轮；2026-09-27）——用户「能不能把
//   波浪的位置抬高4px?」（一问钦定「位置抬高 4px」）：58.11 浅浪 .mn-lv-wlightwave top -8px→-12px（单值
//   改动）；两层结构/80×16 mask/16px 带高/400% strip/平移 80px/2.2s 单速/水位从底往上灌/0.5s 过渡/
//   药丸 48×116/水杯 44×84/两色互换（浅水+深浪）全零改动；sidebar.js 零改动（纯 CSS 零 JS）；40 页
//   内联块全量刷新+编辑器页手工同款（inliner SKIP_CSS_REFRESH 豁免）；FC 恒 v10.28.47.4、后端零改动、
//   i18n 零新键）：
//   （rev 00319-mw5 瞬态占位上直播；二次烘焙重部署终态 rev 00320-wl8——live 文本 00319-mw5 滞后一部署=58.11 同款下轮烘焙）
// v0.2.58.10 = 折叠侧栏等级水杯收成两层（补丁位 9→10·调整轮；2026-09-27）——用户「为什么是四层颜色？
//   能不能只有两层？」（一问钦定「只有主色水+一道浅浪」）：58.9 杯里 4 件套（深水+浅水半透明叠层+深浪
//   压交界线+浅浪）视觉上四段颜色；修法：删浅水层 .mn-lv-wlight 与深浪 .mn-lv-wdeepwave，只留主色水
//   .mn-lv-wdeep+杯顶一道浅色浪 .mn-lv-wlightwave（80×16 mask/16px 带高/400% strip/平移 80px/2.2s
//   全零改动；sidebar.js 模板删两 div）；水位从底往上灌/0.5s 过渡/药丸 48×116/水杯 44×84/LV 标签 14px/
//   号码 28px 全保持；40 页内联块全量刷新+编辑器页手工同款；FC 恒 v10.28.47.4、后端零改动、
//   i18n 零新键）：
//   （rev 00315-bm6 瞬态占位上直播；二次烘焙重部署终态 rev 00316-s6b——live 文本 00315-bm6 滞后一部署=58.9 同款下轮烘焙）
// v0.2.58.9 = 折叠侧栏等级药丸波浪改平改宽（补丁位 8→9·调整轮；2026-09-27）——用户「那个波浪能不能
//   不要那么尖？让他平一些更加宽一些」（一问钦定「高度减半+宽度翻倍」——浪高 32→16px、波长 40→80px）：
//   58.8 正弦水面一个波长 40px 挤在 40px 杯内宽里、浪高 32px 峰谷很陡；修法：mask SVG viewBox
//   40×32→80×16（波长翻倍+振幅减半，正弦路径 x 全翻倍 y 全减半）、波浪带高 32px→16px、两波顶线
//   随半高同步（calc(40% - 16px)→calc(40% - 8px) / -16px→-8px）、无缝循环 translateX 40px→80px
//   恰好一个波长、strip 300%→400%（160px=4×40，循环末帧右缘恰好盖住窗口零缺口）；两层结构/两速
//   1.6s/2.2s 相位漂移/水位从底往上灌/0.5s 过渡全保持；药丸 48×116/水杯 44×84/LV 标签 14px/号码 28px
//   零改动；sidebar.js 零改动（纯 CSS 零 JS）；40 页内联块全量刷新+编辑器页手工同款；FC 恒 v10.28.47.4、
//   后端零改动、i18n 零新键）：
//   （rev 00314-sw5；同轮首部署瞬态 rev 00313-xjs 已取代——rev 文本先占位后填真值、二次构建烘焙成此终态）
// v0.2.58.6 = 折叠侧栏等级水杯药丸与波浪再放大（补丁位 5→6·调整轮；2026-09-26）——用户「那个波浪能不能
//   再大宽一些还有那个药丸也是再大些」：58.5 药丸/水杯再放大——药丸 28×48→32×58、水杯胶囊
//   24×32→28×42（border-radius:999px 不变、LV 号码居中不变、杯内宽 20→24，LV 标签 6→7px、
//   LV 号码 12→14px 同步放大）；波浪再大再宽——mask SVG viewBox 16×12→20×16（波长 16→20+
//   振幅 6→8 双加）、波浪带高 12px→16px、两波顶线随半高同步（calc(40% - 6px)→-8px / -6px→-8px）、
//   无缝循环 translateX 16px→20px 恰好一个波长、strip 恒 300%（左右余量=杯内宽 24px ≥ 20px 波长，
//   循环末帧不露缺口）；两层结构/两速 1.6s/2.2s 相位漂移/水位从底往上灌/0.5s 过渡全保持；
//   40 页内联块全量刷新+编辑器页手工同款；FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （未独立上线，随 58.7 合并上线 rev 00310-pbk）
// v0.2.58.5 = 折叠侧栏等级水杯改药丸形+波浪加大（补丁位 4→5·调整轮；2026-09-26）——用户「我要的是
//   药丸形不是圆形」+「还有那个波浪能不能大一些？」：58.4 水杯是正圆（24×24 border-radius:50%），
//   用户要药丸形——水杯改胶囊（24×32 border-radius:999px，只加高拉长、LV 号码居中不变）；波浪加大——
//   mask SVG 12×8→16×12（波长 12→16+振幅 4→6 双加）、波浪带高 8px→12px、两波顶线随半高同步
//   （calc(40% - 4px)→-6px / -4px→-6px）、无缝循环 translateX 12px→16px 恰好一个波长、strip
//   200%→300%（左右余量=杯内宽 20px ≥ 16px 波长，循环末帧不露缺口）；两层结构/两速 1.6s/2.2s
//   相位漂移/水位从底往上灌/0.5s 过渡全保持；40 页内联块全量刷新+编辑器页手工同款；
//   FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00308-6xx）
// v0.2.58.4 = 折叠侧栏等级水位环波纹改正弦水面（补丁位 3→4·调整轮；2026-09-26）——用户「那个水波能不能
//   参考这个」（贴了 wave.png 水杯代码）「我要你参考他的波纹不是动画」：波纹形状从 58.3 的圆点花边改成
//   参考图的正弦水面——mask SVG 正弦路径（12×8 一个波长、水面线下实填）+背景色 var(--mn-lv-wave-c)
//   着色（主色/浅色随主题自适应），translateX 平移一个波长 12px 无缝循环；两层结构/两速 1.6s/2.2s
//   相位漂移/水位从底往上灌/0.5s 过渡全保持——只换波纹形状，动画节奏零改动；
//   40 页内联块全量刷新+编辑器页手工同款；FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00307-kkt）
// v0.2.58.3 = 折叠侧栏等级水位环+双层水波（补丁位 2→3·调整轮；2026-09-26）——用户「呃那个等级的
//   进度条能不能是一个环围着中间的等级号码而不是这种像时间一样的」+「从底部上灌的时候我希望你添加一个
//   水的飘动动效分成两层这样」+「就是一层主要颜色另一层用一个浅有点的颜色增加层次感」（真身：58.2 的
//   conic 进度环从 12 点顺时针扫像时钟指针；修法：环改成正圆「水杯」只围等级号码（LV 小字移到杯上方），
//   经验进度=水位从杯底往上灌（.mn-lv-fill 内联 height 百分比 sidebar.js 写入+0.5s 过渡平滑上涨）；
//   水动效两层——底层主色 .mn-lv-wdeep + 上层浅色 .mn-lv-wlight（主色兑白 55%+半透明叠出层次感），
//   两层各带波浪花边 .mn-lv-wdeepwave/.mn-lv-wlightwave 反向相位平移飘动（radial-gradient 花边纹+
//   两速 1.6s/2.2s 无缝循环，纯 CSS 零 JS）；号码 z 上浮+白色描边晕影保证水位高时依然可读；
//   40 页内联块全量刷新+编辑器页手工同款；FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00306-855）
// v0.2.58.2 = 折叠侧栏等级纵向药丸+经验环（补丁位 1→2·调整轮；2026-09-26）——用户「然后是平台的
//   左侧菜单折叠起来的时候那个显示的等级我希望折叠起来是变成一个纵向的药丸形然后那个显示经验的条
//   把药丸围起来这样 然后药丸中间显示等级就就可以了，还有现在这个显示等级的在折叠的情况下它挤压到了
//   用户头像」（真身：折叠侧栏 72px 列内原等级徽章（Lv·称号+XP 文本+横向条）文本换行堆叠成高块挤压
//   头像；修法：徽章拆成双视图——展开态 .mn-lv-normal（原徽章原样）+折叠态 .mn-lv-pill 纵向药丸
//   28×48 固定尺寸上阵（零挤压）；XP 条化为药丸外环（.mn-lv-ring conic-gradient 进度环环形包裹药丸，
//   百分比 sidebar.js 内联写入）；药丸中间只显示等级（LV 标签+数字）；折叠切换带 0.3s 淡入动画；
//   40 页内联块全量刷新；FC 恒 v10.28.47.4、后端零改动、i18n 零新键）：
//   （rev 00305-wvr）
// v0.2.57.1 = 文章呈现全屏投影（补丁位 0→1·修复轮；2026-09-20）——用户「还是一样不符合要求啊，还是你用镜像投影的方式把用户在FC编辑好的数据和一些目录操作做好？而且我的要求是覆盖全屏不是中间而已」（真身：57.0 文章栏宽上限 720px 画布全挤在窗中间、目录只认有 label 的 content/text 卡——真文章只有 flag+shield 两卡时目录钮根本不出现；修法：720 上限废除；宽窗 contain fit 缩放不再封顶 1——s=max(0.25,min(availW/bboxW,availH/bboxH)) 投影仪铺满整屏、resize 宽模式只重算缩放不重建 DOM；目录列全部卡——label 优先→正文首行派生 18 字→卡型名兜底（shield=Emblem 等）；窄窗维基回流口径不变）：
//   FC 查看镜像同款（v10.28.37.1）：fit1to1 改 contain fit 随查看窗铺满 + 目录列全部卡
//   后端零改动；ethereal 零改动；i18n 零新键
//   （rev 00274-xfl；初部署 00273-qx2 线上 S8d 实测真文章目录钮缺失→列全部卡修正再部署）
// v0.2.58.0 = 完整格子画布镜像（小改动位 57→58·新功能轮；2026-09-21）——用户「你是不是只是提取了卡片而已？你能不能这样就是你把FC编辑那边的格子画布完完整整搬到发布后出现的独立页面内但是透明度放满就是代码层面看是有格子的，这样应该可以直接取完整的内容了把？然后16：9宽的格子数量是125个做一下这是最大值」（问询钦定「横向125格 长度不限」；纵向三连补充：「纵向是根据文章长度变化的、卡片接近纵向边缘时卡片下边默认多出大概25格自动增长」+「默认纵向填满16:9=横向125格纵向70格，然后再外加25格做预留量」）：
//   阅读页 renderBodyCanvas 不再 bbox 裁剪（58.0 前只提取卡片+裁空余=用户「只是提取了卡片」真身）——
//     画布 = 完整格舞台：横向 125 格最大值（STAGE_COLS×cell+gap 像素）、纵向 stageRows=max(70,内容行数)+25
//     （16:9 125×70 默认再外加 25 行预留；卡片逼近底边按卡片底+25 行自动增长）、格子线代码层面完整定义
//     两笔 linear-gradient、透明度放满（--art-grid-alpha:0 读者看不见结构完整保留）；
//     宽窗 contain fit 投影整个舞台（s=max(0.25,min(availW/stageW,availH/stageH)) 随窗铺满）、
//     窄窗阈值仍按内容 bbox 宽（舞台恒 125 格宽>窗口宽不能拿舞台宽判回流）、回流/目录口径不变
//   FC v10.28.38.0：编辑模式 computeCols 上限 125 格（「这是最大值」）；查看模式同款完整舞台——
//     fit1to1 不再 bbox 裁剪（canvas 0,0 零平移、横向 125 格 × 纵向 max(70,内容行)+25 行 contain fit）、
//     格子线 alpha 0 保留（覆写 2791-2793 编辑器网格线）；纵向自动增长与阅读页同公式
//   后端零改动；ethereal 零改动；i18n 零新键
//   （rev 00276-nnx）
// v0.2.56.1 = explore 页文章搜索（补丁位 0→1·修复轮；2026-09-20）——用户「不是啊 我在 explore.html 搜索都搜索不到你在做什么？」（真身：56.0 把文章搜索接到了首页+概览页，但用户日常搜的地方是 explore.html；该页搜索框只调 filterNations 纯客户端筛世界，零文章接入）：
//   explore 页：搜索胶囊接文章搜索（300ms 防抖下拉三态 + 回车立即搜 + Esc/点击外部关闭，与 overview 同口径）；
//     结果双保险——下拉 .dash-search-item 行 + 主区「文章」结果段（#exArticleResults 卡片列表，均锚 article.html?id=）；
//     placeholder 改「搜索世界、文章...」；api.js 静态入栈；MN_API 缺失时下拉明示「搜索暂不可用」不再无声
//   i18n：explore 新键 4×12 语言（ex.search.articles/noArticles/searching/unavailable）+ ex.ph.search 全语言改文章口径 + OpenCC 重生成
//   后端零改动；FC 零改动
//   （rev 00270-vgf）
// v0.2.56.0 = MicroNationary 真文章（小改动位 55→56·新功能轮；2026-09-20）——用户「不是我现在在MicroNationary看不见也搜索不到啊……FC只是一个编辑器……你就不能想想我的MicroNationary吗？」（真身：MicroNationary=侧栏第一菜单项 overview.html，该页此前零后端接入——Recent Contributions 是 4 条假数据（Alex Rivera created article…）、无任何搜索入口；首页活动流 55.0 钦定「混入最新文章」实际只做了独立区块未混入；FC 列表 View 打开的是编辑器 ?article= 查看器）：
//   概览页（MicroNationary）：接入 api.js；新增文章搜索胶囊（300ms 防抖下拉+回车立即搜+点击外部关闭，
//     与首页同口径，结果锚 article.html?id=）；Recent Contributions 假数据整体移除 → 真实发布文章
//     （GET /api/articles 最多 6 篇：作者·发布了·标题链接·日期；后端不可达/零文章静默空态，绝不回退假数据）
//   首页：真实文章混入活动流（loadLatestArticles 渲染完区块后把最新 5 篇插入 activityFeed 顶部，
//     badge Article + 标题 + 作者 + 日期，整卡锚阅读页；55.0 钦定「首页活动流混入最新文章」字面落地）
//   FC v10.28.36.3（补丁位 2→3：列表 View 云端文章 → 平台阅读页 article.html?id=，
//     本地草稿保留编辑器 ?article= 网格裁剪预览——「FC只是一个编辑器」口径落地）
//   i18n：overview/index 新键 12 语言（ov.searchPh/search.*/contrib.published/empty、index.act.article）+ OpenCC 重生成
//   后端零改动（GET /api/articles 已具备）；电池：新 tmp-battery-micro-v056 + article-view 补 View 锚
//   （rev 00269-52s）
// v0.2.59.0 = 插件商店第一环（小改动位 58→59·新功能轮·补丁清零；2026-10-07）——用户「插件放高级订阅门槛、可改左侧菜单/UI 风格/背景图、万物皆可插件」：
//   后端：迁移 034 建 plugins/plugin_versions/plugin_installs 三表 + 2 演示插件种子；routes/public/plugins.js 列表/详情(含版本历史)/我的安装/安装/卸载（订阅门槛 TIER_RANK 比较，未达 403 PLUGIN_TIER_LOCKED）；health 66→69 表、user_version 33→34；
//   前端：侧栏新增「插件商店」入口 → plugins.html（商店网格+搜索/分类+插件信息弹窗：预览图+简介+版本历史+底部安装按钮，全走 design token 明暗主题自适应）；plugins.js 走 MN_API；
//   测试 413/413（迁移/health/user_version 断言同步更新）；后端零破坏；增长卡片/审核/下放订阅=后续轮；
// v0.2.59.1 = 插件制作指南 + 动态页插件增长卡片（补丁位 0→1·新功能轮；2026-10-07）：
//   指南：plugin-guide.html 完整教学（manifest/能力/示例/版本/审核/订阅下放/最佳实践）+ help.html 快速上手第 5 卡直达；
//   增长卡片：activity.html 右栏新增「插件动态」卡——GET /api/plugins 按安装量降序取前 4，点击跳插件商店；纯前端零后端。
// v0.2.59.2 = 插件指南补「完整操作范围」（补丁位 1→2；2026-10-07）：plugin-guide.html 第④节扩为「能力清单与完整操作范围」——按界面/内容/工具/行为/数据/通信六层列表格，逐项说明插件能操作什么 + 示例；纯前端文档零后端。
// v0.2.59.3 = 插件指南扩为完整参考手册（补丁位 2→3；2026-10-07）：plugin-guide.html 从 9 节扩到 16 节——补 manifest 完整字段（category/tags/license）、capabilities 逐项详解、插件 API 参考（register/storage/on/notify）、扩展点+事件钩子完整列表、开发测试流程、语义化版本表、提交审核+自检清单、沙箱安全边界、命名图标规范、FAQ；纯前端文档零后端。
// v0.2.59.4 = 插件指南补「平台实体速查 + 能力→位置映射 + 完整 API/钩子」（补丁位 3→4；2026-10-07）：plugin-guide.html 扩到 17 节——新增平台全貌、平台实体速查（卡型/边缘/订阅等级/页面/字体的 ID 对应表）、capabilities 逐项对应平台具体位置、API 完整签名（storage.set/get/remove、on、notify）、事件钩子完整参数表；纯前端文档零后端。
// v0.2.59.5 = 插件指南正名为「插件 SDK 手册」（补丁位 4→5；2026-10-07）：plugin-guide.html 标题/hero 改「插件 SDK 手册 · 独立 SDK 手册」；插件商店 header 加「查看插件 SDK 手册」按钮；帮助页快速上手第 5 卡同步更名；纯前端零后端。
// v0.2.59.6 = 插件 SDK 手册补 ui.animation 能力（补丁位 5→6；2026-10-07）：新增能力「ui.animation 操控网页打开/页面切换动画（transitions.js）」，实体速查加动画条目，capabilities 表加一行；纯前端文档零后端。
// v0.2.59.7 = 插件 SDK 手册补「展示层 vs 核心层」边界（补丁位 6→7；2026-10-07）：封面加核心原则卡（能改一切看得到的默认展示方式/动画/卡片/菜单等，不能改核心登录/数据/业务规则）+ 平台全貌补简言边界；纯前端文档零后端。
// v0.2.59.8 = 注册/登录页半透明白底改不透明白（补丁位 7→8；2026-10-07）：用户「注册登录页半透明的东西改成白色不透明」——亮色主题设计令牌（--glass-bg/--card-bg/--input-bg/--modal-bg/--sidebar-bg 及玻璃边框等 14 项）由半透明白 rgba 改 #ffffff，暗色主题不动；纯前端零后端。
// v0.2.59.9 = 设置加「开发者」开关（补丁位 8→9·新功能轮；2026-10-07）：用户「在设置内添加开发者开关，打开后看到更多信息」——settings-modal 新增 Developer 区：开发者模式开关（developerMode 持久化 slati_settings），开启后显示站点版本/FC 版本/用户/订阅等级/语言/主题/主色/API 地址调试信息 + console.log；纯前端零后端。
// v0.2.59.10 = 插件商店开发者上传入口 + GitHub logo + 作者名片（补丁位 9→10·新功能轮；2026-10-07）：用户「开发者模式→上传插件按钮→上传/GitHub 弹窗；GitHub 插件卡片名右侧 logo；高级订阅下方作者头像+名称→作者名片」——后端 035 迁移给 plugins 加 github/author_avatar 列 + 路由 shape 补充（测试 413/413，user_version 34→35）；前端开发者模式显示上传按钮 + 上传弹窗（上传文件/连接 GitHub 占位）+ 卡片 GitHub logo + 作者头像/名称点击出作者名片。
// v0.2.59.11 = 上传插件弹窗选项 UI 适配（补丁位 10→11·修复轮；2026-10-07）：用户「上传插件文件与连接 GitHub 没有做 UI 适配」——两枚「上传插件文件/连接 GitHub」由透明描边药丸改成卡片式选项（主题色图标 + 加粗标题 + 描述 + 右箭头），走 design token 明暗主题自适应；纯前端零后端。
// v0.2.59.12 = 首页网络指标 + 我的世界接真实数据（补丁位 11→12·新功能轮；2026-10-07）：用户「首页网络指标卡片 + 我的世界能不能连接实际数据」——后端加 GET /api/social/nations/mine（当前用户国家）；前端首页指标卡由写死数字改走 /api/public/activity（KPI citizens/nations/articles/activity/newCitizens + trends.users 真实柱状图，失败回退兜底）；「我的世界」改走后端国家（远端空回退本地）；测试 413/413。
// v0.2.59.13 = 创建世界页精简为架空国家相关类型（补丁位 12→13；2026-10-07）：用户「创建世界只保留和架空国家有关的，其他无关的全部去除」——22 种世界类型精简为 8 种（架空国家/架空历史/地缘政治/政治体系/文明/城邦/地图/时间线），去除奇幻/科幻/平行宇宙/OC/小说/游戏/动画/RPG/宇宙/公司/语言/宗教/人物/英文版架空历史；状态文案 22→8（12 语言 i18n 同步）；纯前端零后端。
// v0.2.59.14 = 创建国家完成后自动生成介绍文章（补丁位 13→14·新功能轮；2026-10-07）：用户「创建世界步骤完成后不会生成文章」——registry-step-3 提交改走 publishNation：草稿三步骤拼装正文（国名/分类/首都/建国/简介/人口/领土/GDP/军事）→ POST /api/articles 生成文章并跳转文章页，同时 POST /api/social/nations 落库国家（尽力而为）；未登录回退旧 sovereignty-ratified 跳转；纯前端 + 复用现有文章/国家接口，零迁移。
// v0.2.59.15 = 主权实体分类翻译（补丁位 14→15；2026-10-07）：用户「主权实体分类没有做翻译」——五种分类名（Sovereign Nation/Colonial Territory/Puppet State/Free Association/Protectorate）显示值随语言翻译（12 语言 i18n 追加合并块）；下拉选项挂 data-i18n + selectClass 按 classNameLabel 显示译文；草稿/后端仍存英文原值不变；纯前端零后端。
// v0.2.59.16 = 创建国家文章改卡片式 + 维基百科式排版（补丁位 15→16；2026-10-07）：用户「生成用卡片 + 信息卡片放右侧左侧文字」——publishNation 正文由纯段落改 FC 草稿画布卡（content 卡=带边框卡片盒）；排版=维基百科式（左侧正文文字卡 + 右侧信息卡，信息卡含分类/首都/建国/人口/领土/GDP/军事键值表）；移动端自动回流单列；纯前端零后端。
// v0.2.59.17 = 创建国家文章信息卡补全实际数据（补丁位 16→17；2026-10-07）：用户「把所有信息换成实际数据」——信息卡补齐简称 + 经济部门（6 个行业占比，英文名映射中文）；全部读草稿实际值（空字段跳过）；纯前端零后端。
// v0.2.59.18 = MicroNationary 页接真实数据（补丁位 17→18；2026-10-07）：用户「把 MicroNationary 页面数据换成实际数据」——统计卡由写死（1,402/892/312/+12%/+5%）改走 /api/public/activity KPI（国家/公民/文章）+ /api/social/topics 话题数，趋势 deltaPct 真实；精选国家改走 /api/social/nations 首个可见国家；创建国家同步把人口/领土/GDP/军事存进国家（精选卡显示完整）；新增 ov.stat.citizens/articles i18n 12 语言；纯前端零后端。
// v0.2.59.19 = 平台首页去测试数据接真实接口：活动流改 /api/social/nations + /api/social/topics、移除 10 条硬编码公告、网络指标去掉硬编码兜底/假趋势曲线。
// v0.2.59.20 = 国家三步创建制图数据真上传：后端 /api/social/uploads 支持 .svg/.geojson/.json/.shp/.zip（上限放开到 30MB）；前端 registry-step-2 假上传换真上传、去掉 Max 50MB。
// v0.2.59.21 = 制图数据上传补图片格式：.jpg/.jpeg/.png/.gif/.webp 加入白名单（前端 + 后端）。
// v0.2.59.22 = 修复三步创建第一步「主权实体分类」下拉无法互动：草稿恢复 selectClass 先于 CLASS_I18N 赋值执行抛 TypeError，classNameLabel 加 undefined 守卫。
// v0.2.59.23 = 搜索页去测试数据 + 卡片跳文章 + DeepSeek Flash 审核/简介：explore.html 撤 Top Growing 硬编码、国家/话题接 /api/social/nations+topics、国家卡片带 articleId 跳文章页、搜索结果显示简介(≤125字)；发布时 DeepSeek Flash 审违规+生成简介存 articles.summary（迁移 036）。
// v0.2.59.24 = 搜索下拉点击修复（backdrop-filter 层叠上下文困住面板 z-index，胶囊升层）+ overview 同款修复。
// v0.2.59.25 = MicroNationary 抖音式主页：资料头部 + 作品/文章/话题标签 + 三列封面网格（explore.html）。
// v0.2.59.26 = MicroNationary 一页化：overview/explore/guidelines 合成 /micronationary?showTab=…（旧三页 302 迁移、菜单直连、切标签不刷新）。
// v0.2.59.28 = 搜索页重构（用户钦定）：AI 式顶部搜索栏 + 智能搜索开关（DeepSeek Flash 语义匹配，
//   发布时生成检索摘要 search_blob 省 token）+ 建议文章 25 + 热门/历史/国家/话题 chips +
//   App Store 式浏览瓷贴 + 最新/最热排序；默认 Google 式关键词搜索（标题/简介/摘要 LIKE）。
// v0.2.59.29 = 文章页分组「整体」渲染：阅读页画布补组背景层（成员并集外扩 14px 的不透明卡面 +
//   四向描边投影）+ 组内卡一体外观（藏独立边框/卡面/阴影）——FC 合并的组发布后不再散开。
// v0.2.59.30 = 文章页数据卡/表格卡阅读渲染：stats 卡（statsRows 列表 + column/bar/pie/donut 简易图表，
//   其余图表回退列表）+ sheet 卡（sheetData 真 HTML 表格）；流式兜底模式同步支持。
window.MN_SITE_VERSION = 'v0.2.59.50';

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
// v10.28.36.2 = 文章发布去重复 + ?edit= 编辑模式（补丁位 1→2·修复轮；2026-09-20）——用户「为什么我点击public时
//   他只是复制出新的一个文章？而不是发布？」：publishCloudArticle 记忆 slati_article_publish_id——POST 成功存 id、
//   再点 Publish 走 PUT /api/articles/:id 更新原文章（404/403 清 id 回退新建）；草稿清空同步作废 id；
//   新增 ?edit=ART-xxx（列表 Edit 云端文章带 id 打开 → GET 拉原文 applyDraft 回填+内容落本地草稿重戳
//   lastSaved）；与站点 v0.2.55.1 同轮；零草稿字段（v 保持 9）
//   （rev 00267-9l4）
// v10.28.36.3 = 列表 View 云端文章 → 平台阅读页（补丁位 2→3·修复轮；2026-09-20）——用户「FC只是一个编辑器
//   他的工作就只是一个编辑器和统计平台而不是点击发布后在他妈的编辑器上查看」：?view=articles 列表 View 按钮
//   按云端/本地分流——云端（已发布）→ article.html?id= 平台阅读页；本地草稿保留 ?article= 编辑器查看器
//   （v10.28.35.0 网格裁剪预览，编辑器本职）；与站点 v0.2.56.0 同轮；零草稿字段（v 保持 9）
//   （rev 00269-52s）
// v10.28.37.0 = 查看模式呈现统一（小更新位 36→37·新功能轮；2026-09-20）：?article= 只读查看与平台阅读页同款呈现——
//   灭网格线（fc-viewmode 覆写 background-image）、标签条 #fcViewTags + 目录抽屉（仅 content/text 有 label 卡、中文）、
//   1:1 bbox 裁剪（量所有可见卡旋转外接盒，scale 恒 1 不放大填空、editor-body 滚动）；编辑模式网格自适应行为零改动
//   （rev 00272-g99）
// v10.28.37.1 = 查看模式全屏投影（补丁位 0→1·修复轮；2026-09-20）：与阅读页 v0.2.57.1 同口径——
//   fit1to1 改 contain fit（s=max(0.25,min(availW/bboxW,availH/bboxH))，avail=editor-body 内容区减 padding）
//   随查看窗铺满不再恒 scale(1)；目录列全部卡（label→正文首行派生 18 字→卡型名兜底）；编辑模式零改动
//   （rev 00274-xfl）
// v10.28.38.0 = 完整格子画布查看镜像（小更新位 37→38·新功能轮；2026-09-21）：与阅读页 v0.2.58.0 同口径——
//   查看模式 fit1to1 不再 bbox 裁剪：canvas 0,0 零平移、横向 125 格最大值 × 纵向 max(70,内容行)+25 行
//   （16:9 125×70 默认再外加 25 行预留；卡片逼近底边按卡片底+25 行自动增长）contain fit 随查看窗铺满；
//   格子线代码层面保留、透明度放满（alpha 0 覆写编辑器网格线）；编辑模式 computeCols 上限 125 格
//   （「16：9宽的格子数量是125个做一下这是最大值」——宽窗再多不超 125）
//   （rev 00276-nnx）
// v10.28.39.0 = 编辑视口系统（小更新位 38→39·新功能轮；2026-09-21）：横向恒 125 格（computeCols 恒 125，
//   窗口变窄不缩小不再自适应、窗口 resize 不再 refitColumns——卡片位置固定，不足部分由 .editor-body
//   横向拉条承载）；视口缩放 Ctrl+滚轮 / Ctrl+加减号（CSS zoom 施加 .grid-canvas、默认 100%、0.25–4 倍、
//   锚在光标下、缩放原点 0 0、zoomChip 百分比按钮点击复位）；中键长按拖动平移视口（preventDefault
//   关浏览器自动滚动、中键不误触取消选中）；普通滚轮=纵向、Shift+滚轮=横向（浏览器原生）；查看模式
//   fit1to1 零改动；坐标补丁 7 处（snapToGrid/dragFrame/onResizeMove/onGroupResizeMove/sheet 手柄/
//   rotate 中心/statsEditPanel——屏幕px↔画布px 除乘 viewZoom，gBCR 屏幕盒锚定 UI 天然正确）
//   （rev 00277-djl）
// v10.28.39.1 = 视口移动掉帧修复（补丁位 0→1·性能修复轮；2026-09-21）：用户「现在是我在移动视角时有明显
//   出现掉帧能不能处理一下？」——探针 tmp-probe-pan-jank 实证三处 ~20fps 慢帧：①中键平移 mousemove 125Hz
//   直写 scrollLeft/scrollTop 无合并（60 事件=60 写）+ 无玻璃挂起 ②原生滚轮纵向同样玻璃每帧重光栅
//   （backdrop-filter 背底每帧变化）。修法：平移起拖挂 body.fc-moving（45.2 玻璃暂离纪律第 6 站点——运动
//   中不可察、松手下一帧还原）+ rAF 合并每帧一次写（mouseup 同步 flush 落位最终帧、中键窗外松手 buttons
//   位 4 收尾）；原生滚动 scroll 事件 150ms 防抖挂起玻璃（滚轮 125Hz 连续时 timer 永不到期、停滚 150ms
//   回稳；不用 scrollend——headless/部分浏览器每 tick 即触发把挂起瞬间拆掉）。修后探针：pan@1× 手势期
//   慢帧 11→0、写 60→32、落点逐像素不变；pan@2× 同（client px 直写滚距自洽）；滚轮 41→6 慢帧（余下
//   全在停滚后玻璃还原段——headless 软件光栅 6 帧，真机 GPU 一帧，45.2 已实证可接受）
//   （rev 00278-xpx）
// v10.28.40.0 = SNE 格底随卡色 + 画布边缘阴影（小更新位 39→40·新功能轮；2026-09-21）：用户「SNE Index Card
//   的二级显示分数的卡片颜色能不能根据卡片本身的颜色然后自动变化背景颜色融入背景主题，然后整个画布格子的
//   边缘能不能加上一个淡淡的阴影因为现在边缘有点不明显」——①SNE 卡 3×2 指标格背景从固定
//   surface-container 改为 color-mix(--sne-cell-tint 62%, surface-container)：格底自动跟随卡色融入
//   卡面；无选色时混色恒等、默认观感零变化。tint 写点两处：applyCardBg 统一写 --sne-cell-tint（= 用户选色
//   rgba，plain 卡面/主题边缘 tint 两路同一来源）+ setCardBgColor 无 label 分支直写（SNE 卡无 .card-label
//   ——电池首轮 S3/S5 tint='' 实证 applyCardBg 永不到达，v10.28.6/8 口径；清色由 resetCardBg→
//   applyCardBg(color='') 移除）——两路色混输入全是 CSS var，深浅主题切换自动正确（JS 烤色会过期）②画布整盒
//   加淡淡阴影（1px 主题细线勾边 + var(--shadow-md) 投影），格子区边缘从编辑区背景浮出；查看模式显式
//   box-shadow:none（38.0 起投影由 #fcViewScaler 承担）。站点版本恒 v0.2.58.0；后端零改动 325/325、
//   零草稿字段、ethereal 零改动、i18n 零新键；电池 fc-sne-canvas 12/12（新）+fc-viewport 29/29+fc-present
//   9/9+micro-v056 21/21+article-frontend 48/48+article-present 29/29+article-view 45/45+article-1to1
//   20/20+notif-home 23/23+home-bg 26/26+8 套小型舰队全绿+identity 38/38+cit2usr 21/21+i18n 34/34+
//   冒烟 48/48（版本锚 15 文件 sed 39.1→40.0）；线上实机探针 43/43（新 S10 三项：画布盒 box-shadow 与
//   本地逐字节同串、默认格底=卡面 surface 恒等、tint 写入 62/38 混色 rgb(221,128,128)——建卡读删全在一个
//   IIFE 内、createSneCard 不触发 onContentChange 实机草稿零污染）；digest c715f99f；rev 00279-lk7
// v10.28.41.0 = 发布日志弹窗（小更新位 40→41·新功能轮；2026-09-21）：用户「点击发布的时候能不能先弹出一个
//   弹窗填写日志 他的长度要是固定的会跟着日志长度变化，然后限制320字」——点击 Publish 先弹发布日志弹窗，
//   填写后「确认发布」才走真发布（云端/演示分流）、取消/关闭=放弃本次发布；输入框固定初始高度 110px、
//   随日志自动增长（JS 写 style.height，上限 220px 后内滚；resize:none）；按空格分词计数 320 词硬限
//   （与 v10.28.28 图片描述同口径："code"=1 词）——实时计数 0 / 320、超限红字 .over + 确认拦截 toast
//   「日志超过 320 词上限，请删减」；日志存草稿 log 字段（additive——buildDraft 读弹窗输入框、applyDraft
//   恢复、再发布弹窗预填上一条可继续编辑）随 contentJson 进文章（后端零改动 325/325，文章页暂不渲染）；
//   站点版本恒 v0.2.58.0（伴行隐形修：index.html 活动流混入守护——i18n 重渲染整段重建 demo 项会抹掉
//   v0.2.56.0 混入的真实文章卡（fetch 先于 apply 落地的时序竞态、语言切换必现，micro-v056 B5 间歇红实证），
//   renderActivity 重建前摘出 a.activity-article、重建后放回顶部；ethereal 零改动、i18n 零新键；
//   电池 fc-publish-log 19/19（新）+舰队全绿（版本锚 sed 40.0→41.0；article-frontend B17/B18、
//   xp-social 全发布点走发布日志弹窗确认管线）；线上实机探针 51/51（S11 新发布日志段 8 项）；rev 00280-xrd
// v10.28.42.0 = 全卡不透明（小更新位 41→42·观感修改轮；2026-09-23）：用户「把FC内的所有卡片变成不透明」——
//   磨砂玻璃轮（v10.27 钦定 55% 半透+blur）结束、08-17「100% 不透明」口径复活：①普通卡/组背景卡面
//   color-mix 55% 混色撤下直用 --card-bg-color（用户选色与透明度滑杆照常生效）、卡身 backdrop-filter
//   摘除（面已不透明，模糊零可见效果、留着白费每帧重光栅——45.2/39.1 掉帧纪律同源）②玻璃注入层
//   .lg-backdrop/.lg-specular 对卡全面退出（display:none 门控收编全卡族——模糊/折射残留不透明面会像
//   09-18 侧栏产生色散边缘）③主题卡（纸/藏宝/科技/油漆）剪影填充层 opacity 0.55 撤下回 1（6.2 前口径：
//   底色 base 不透明+渐变自带 alpha 叠其上，卡面不透明且剪影 clip 完好）、主题卡卡身 blur 摘除；外板
//   不透明不动（v10.21 口径）、SNE 格底 62% 混色不动（卡内、40.0 钦定）、stats-edit-panel 是浮动面板
//   不是卡玻璃保留（6.2 钦定）、fc-moving 玻璃挂起保留（对卡已 no-op，仍管镶边玻璃与组背景 filter 描边）；
//   拖动时卡面不再因玻璃挂起而观感变化（用户前问「拖动时背景不见」随不透明一并解决）；站点版本恒 v0.2.58.0、
//   后端零改动 325/325、零草稿字段、ethereal 零改动、i18n 零新键；电池 fc-opaque 21/21（新）+舰队全绿
//   （版本锚 sed 41.0→42.0）；线上实机探针 63/63（新 S12 全卡不透明段 12 项）；rev 00282-2mz
// v10.28.42.1 = 编辑器镶边玻璃全灭（补丁位 42.0→42.1·观感修改轮；2026-09-24）：用户「我要全部 >:( 我说过了」——
//   42.0 只把卡铺不透明，浮动面板/头栏仍是玻璃，用户钦定全部：①编辑器头栏 .editor-header 铺不透明底
//   （surface-container）+摘 16px 模糊 ②stats-edit-panel 铺不透明底+摘 12px 模糊/饱和+右上角白色高光条
//   撤下（6.2 磨砂玻璃轮作废；白光条 20.3 起用户两轮要求清掉，一并解决）③右键菜单/文字工具条/字体面板
//   （含 .fp-group 分组头）铺不透明底+摘 24px 模糊 ④地图区编辑器 .mre-stage/.mre-side/.mre-panel 铺
//   不透明底+摘 32px 模糊 ⑤.modal-card 弹窗（历史/标签/发布日志/迁移/旗库/画布底/图片元数据/图片信息 8 面）
//   铺不透明底+摘 32px 模糊 ⑥.radius-popover 弹层族（视口/图层/多行/表格样式/统计图表/文字尺寸/文字颜色/
//   圆角/旋转/图注位置/卡色 13 面）铺不透明底 ⑦查看模式 .fcv-chip/.fcv-toc-btn/.fcv-toc-drawer/.fcvp-card/
//   #fcViewTitle/#fcViewActions 铺不透明底+摘 14px 模糊 ⑧.input-glass（标签/发布日志/迁移/图片元数据/
//   地图区编辑器 9 个输入框）铺不透明底（surface-container-low）+摘 12px 模糊 ⑨玻璃注入层 .lg-backdrop/
//   .lg-specular 门控（display:none）一并收编 8 个编辑器浮面（不透明面折射有 09-18 色散风险）；暗化遮罩
//   （.modal-backdrop/.mre-backdrop 按设计压暗底层不是表面）与外板/SNE 格底 62% 混色（40.0 钦定、结果
//   不透明）与作者自选透明度滑杆（卡片属性）不动；fc-moving 挂起只剩组背景 filter 描边一个作用面（注释
//   口径同步）；站点版本恒 v0.2.58.0、后端零改动 325/325、零草稿字段、ethereal 零改动、i18n 零新键；
//   电池 fc-all-opaque 24/24（新）+fc-opaque 21/21 面板锚更新+舰队 20 套全绿（版本锚 sed 42.0→42.1）+冒烟 55/55；
//   线上实机探针 fc-all-opaque-live 14/14（新）；rev 00288-clj
// v10.28.43.0 = iPad 触控适配（小改动位 42→43·新功能轮；2026-09-24）：用户「能不能先对平板做一下FC的操作适配？」
//   ——问询钦定：设备 iPad（Safari）、四类全要（拖卡片+拉手柄缩放/画布平移+捏合缩放/长按出菜单/按钮加大+
//   去悬停依赖）、Apple Pencil 以后再说；真身：编辑器 16.5k 行 100% 鼠标事件——资产面板只有 HTML5 拖拽
//   （触屏完全无效=无法建卡）、右键菜单是删除/旋转/图注/卡色唯一入口（iPad 无右键）、中键平移+Ctrl 滚轮
//   缩放无触屏等价物、按钮意义全靠 title 悬停；修法：新增 docs/assets/js/fc-touch.js 触控桥（~300 行 ES5
//   IIFE，matchMedia('(pointer: coarse)') 门控不符即整体 return——桌面字节恒同零影响）——touch 事件合成
//   MouseEvent 喂现有监听链（document 级 move/up 收单、全站零 isTrusted 检查）：卡片拖动/拉手柄缩放/旋转/
//   表格行列柄/长按 500ms 菜单（编辑器 600ms 组拆分计时器加 !window.__fcTouchGesture 守卫互斥——唯一 JS
//   改动）/tap 点选+同卡双 tap 合成 dblclick 改名/空画布 tap 取消选中/单指平移+惯性（rAF 0.94 衰减）/双指
//   捏合 setViewZoom+双指平移/资产面板 tap 建卡（span 表+cc/cr 偏移+类型分发+XP+落草稿同 13753-13830 链，
//   不 preventDefault 保面板原生滚动、400ms 冷却防连点）；文字编辑保命：inEditableZone 豁免输入/按钮/
//   标签区、查看模式全程 no-op；粗指针 CSS 块（@media (hover:none) and (pointer:coarse)）：手柄 ::after
//   扩命中区 10→28px、角手柄 z-index 61、按钮/菜单项 44px 最小尺寸+touch-action:manipulation、卡片
//   touch-action:none+去 callout/tap 高亮、菜单 60vh 内部滚动、touch-action 不继承故手势面各自带、文字区
//   user-select:text 覆写；mre 地图编辑器本轮不做（记录为后续）；站点恒 v0.2.58.0、后端零改动 325/325、
//   零草稿字段、ethereal 零改动、i18n 零新键；rev 00289-s6n
// v10.28.44.0 = 触控长按药丸菜单（小改动位 43→44·新功能轮；2026-09-24）：用户「长按菜单能不能改成
//   左边的小药丸」——问询钦定：触屏长按卡片弹左侧药丸形菜单（底部左缘停靠、上滑入场）、药丸中部 ⋮
//   三点折叠成小药丸（再点展开、仍停左下）、点空处展开态与折叠态全消、桌面右键游标弹层原样不动；
//   修法：fc-touch.js 长按派发前置 window.__fcTouchMenu 旗（dispatchEvent 同步、编辑器读走即清零——
//   桌面零影响）；编辑器 showContextMenu 读旗走 ctx-pill 分支（清内联 left/top 残留、三点钮插到中部
//   可见项后、恒展开入场）；新增 #ctxPillDots 三点钮（toggleCtxPill 折叠/展开，window 导出同
//   openBorderRadiusPopover 口径）+ CSS（.ctx-pill 底缘停靠 999px 药丸 + ctxPillUp 入场动画 +
//   折叠态 48px 只留三点——!important 压条件项内联 display:flex 同 3001 分组口径）；伴行修复：缩放/旋转
//   mouseup flush 加 _lastMoveEv 空守卫（无移动纯点击手柄时 onResizeMove(null) 原会在内部 catch 落一条
//   console.error——桌面点手柄同款噪音，零行为变化）；站点恒 v0.2.58.0、
//   后端零改动 325/325、零草稿字段、ethereal 零改动、i18n 零新键；电池 fc-pillmenu 15/15（新：S 静态
//   +B 药丸实测：长按现身/三点中位/折叠缩点/再点展开/空画布双消/手柄纯 tap/真 tap 删卡/桌面右键零变化/
//   E 零异常）；
//   舰队全绿（版本锚 sed 43.0→44.0 共 23 文件）+冒烟 55/55+i18n 34/34；线上探针 fc-pillmenu-live
//   12/12；rev 00290-8mn
// v10.28.45.0 = FC 两页接入全站 12 语言 i18n（小改动位 44→45·新功能轮；2026-09-25）：
//   用户「还有 FC还没有做翻译」——问询钦定：范围=编辑器页+落地页两页一起翻；卡片类型名=翻译成和平台
//   一样的（显示层本地化，草稿存储的 dataset.label 英文规范名零改动）；
//   修法：新共享字典 docs/assets/i18n/fluidcanvas.i18n.js（505 键 ×12 语言：zh/en/de/ru/ms/th/vi/id/
//   fr/es/pt + zh-Hant OpenCC 自动段，结构与 explore.i18n.js 同款）；i18n.js 引擎加法 data-i18n-title
//   扫描（纯加法，其余 39 页零影响，元素保留原 title 作 zh 兜底）；两页挂字典三件套 + 惰性 T
//   （window.__fcT；每个调用点保留当前中/英文字面量兜底——电池源锚存活）；zh UI 英文 chrome 顺带换中文
//   （视口/模板/图层/历史/保存草稿/发布/草稿/就绪/词/字符，用户钦定意图自然延伸）；语言切换 onChange
//   重渲染：编辑器词数/图层/保存状态徽章（setSaveStatus 统一出口收编 6 处直写）+字体工具栏恒跑、查看
//   模式重跑呈现+操作条、编辑模式守卫（输入中/拖拽中/无卡片跳过）后 applyDraft(buildDraft()) 重建
//   （撤销栈 JSON 快照串 + historyRestore 同路径——历史零重置）；落地页纯渲染集重跑+subnav 克隆逐字同步
//   +resize 重测；卡片类型名显示层本地化（创建器/图层面板/查看目录 TYPE_NAME 经 localizedTypeName
//   规范名映射）；委托陷阱守约：Edit/View/Delete 按钮 title 恒英文绝不挂 data-i18n-title（隐形 tooltip
//   不在钦定 chrome 列表）；数据安全：buildDraft 未改名卡永远存 dataset.label 英文规范名 payload（不做
//   显示文本对比——语言切换重建时卡面还显示旧语言文本，对比必然不等会冻结旧显示文本进草稿；
//   labelEdited 标记用户改名——自取名原样过，存→重载 label 恒等）；站点恒 v0.2.58.0、后端零改动
//   327/327、零草稿字段、ethereal 零改动、i18n.js 引擎 6 行加法（title 扫描）、common.i18n.js 零新键；
//   电池 fc-i18n 20/20（新）+fc-publish-log/fc-viewport 口径更新（徽章/toast zh+rev 锚 00295-）+舰队
//   32 套全绿（版本锚 sed 44.3→45.0 共 32 文件——fc-publish-log/fc-viewport rev 锚同轮手工更新；
//   article-view/notif-home 静态锚口径更新后独立复跑 45/45、23/23）+冒烟 60/60+i18n 34/34；线上探针
//   fc-i18n-live 14/14；rev 00295-btc
// v10.28.48.0 = 频道卡头像与个人资料头像双向同步（小改动位 47→48 新功能轮；2026-09-30）：与站点
//   v0.2.58.20 同轮——用户「还有个人资料设置里的头像你没有做更换头像是和频道主页同步的当然用户可以
//   勾选是否要同步」；三项钦定：①勾选框默认勾选（slati_avatar_sync 键缺失=ON）②双向同步·资料页权威
//   （勾选框只活在资料编辑弹窗）③资料自我介绍与频道主页 bio 互不相通（FC PATCH 只发 avatarUrl 绝不发
//   bio；FC 页零 bio）；
//   修法：renderContent 个人分支旗标 ON 且有 user.avatarUrl → 频道卡 img（fcEsc 转义）+fc-avatar-editable
//   类+title（每渲染重打——innerHTML 整换吞监听）；点击换头像=一次性委托挂常驻 #channelOverview+隐藏
//   file input 恒挂 body→ext 白名单+gif 订阅门禁（tier!=='free' 同资料页口径）+10MB→fcEnsureApi 注入
//   （FC 页无 api.js 静态引入）→fetch POST /social/uploads?ext=（credentials:'include' 同资料页契约）→
//   PATCH /auth/me 只 {avatarUrl}→r.ok 才改 UI（user.avatarUrl+raw 合并写 slati_user 绝不 SlatiDB.saveUser
//   防 mirrorProfile 二次 PATCH+#personalAvatar+renderContent+toast）；团队卡永不受影响（无类无入口）；
//   hover 相机徽章 CSS 全进页面专属块→跳过 inline-css.js；storage.js 零改动；后端零改动；i18n 6 新键×12
//   语（OpenCC 重生成 zh-Hant、en 值=页面兜底串逐字节一致）；站点 v0.2.58.20 同轮、10 分钟自动保存心跳/
//   切页动画零触碰；
//   电池 tmp-battery-profile-avatarsync F 组（图片卡/关旗标字母卡/PATCH 体恰 {avatarUrl} 无 bio/gif 订阅
//   门禁/团队卡零动作/客人零异常）覆盖；舰队 46 套全绿；镜像内容验证两次构建各验一次、先验后推；线上
//   探针 avatarsync；
//   （rev 00336-7gr 瞬态占位上直播；二次烘焙重部署终态 rev 00337-wxl——live 文本滞后一部署=惯例）
// v10.28.52.2 = 折叠按钮+顶部菜单纯白不透明（补丁位 1→2 观感修复轮；2026-10-05）：
//   用户「那个FC编辑器的左侧菜单的折叠按钮的背景能不能改成纯白不透明的？还有顶部菜单也是」；
//   真身=折叠按钮 .asset-panel-toggle 与顶部栏 .editor-header 都用 var(--color-surface-container)——
//   亮色 #eceef0 灰底（非纯白）、暗色 #202038 实心；
//   修法=两者改 --color-surface-container-lowest（亮色 #ffffff 纯白不透明）+暗色主题块还原规则
//   （:root[data-theme="dark"] 下仍 --color-surface-container：默认 #202038/暗 mono #151518 实心，
//   暗色零回归）；站点恒 58.28；后端零改动；i18n 零新键；ethereal.css/transitions.js/10 分钟心跳
//   零触碰（编辑器页豁免 inline-css 零重跑）；
//   （rev 00371-zvn 瞬态占位上直播；二次烘焙重部署终态 rev 00372-svk——live 文本滞后一部署=惯例）
// v10.28.52.4 = 折叠按钮搬搜索菜单右侧+折叠出画回弹落定左缘+Q弹拉长+按钮与搜索栏同高（补丁位 3→4 观感修复轮；2026-10-05）：
//   用户「我希望那个圆形是在右侧的」+「然后那个按钮回弹的时候能不能有一个Q弹
//   弹出时被拉长再回规原本现状的动画」+「还有那个按钮的大小能不能和搜索栏一样
//   现在它的大小对比搜索栏有点小」；
//   真身=52.3 桌面（pointer:fine）圆钮驻搜索胶囊左侧（left 6px）+胶囊 margin-left:38px 右移让位+
//   按钮 32×32 对比 40px 高搜索胶囊偏小；
//   修法=镜像到右侧：胶囊回贴左缘（margin-left 移除）+圆钮驻面板右缘内缩 6px
//   （left:calc(var(--asset-panel-w) - 46px)=214px，top 12px 与胶囊上缘齐、40×40 与搜索胶囊同高、
//   正圆 49.2/纯白 52.2 全保留、胶囊 width:calc(100% - 46px) 让位留 12px 缝）+
//   折叠动画 fcToggleOutSpring 0.9s 三站式（0% 右缘 214px 起步→30% 加速跑出画面外
//   -40px 左出画→100% 回弹过冲 cubic-bezier(0.34,1.56,0.64,1) 落定左缘 6px=49.1 折叠态宿位）+
//   Q弹=fcToggleQSquash 同 0.9s transform 缩放（0% 原形→30% 蓄力微缩 0.85→58% 弹出拉长
//   scale(1.35,0.65)→100% 过冲挤扁回规 1；双动画同触发、位移缩放互不干扰）+
//   展开复用基态 transition:left 0.25s 平滑滑回右缘 214px（动画压过过渡、落定零漂移）；平板（pointer:coarse）
//   恒旧行为（266px 右缘+0.25s 滑动）零回归；站点恒 58.28；后端零改动；i18n 零新键；
//   ethereal.css/transitions.js/10 分钟心跳零触碰（编辑器页豁免 inline-css 零重跑）；
//   （rev 00375-nlm 瞬态占位上直播；二次烘焙重部署终态 rev 00376-8qx——live 文本滞后一部署=惯例）
// v10.28.62.6 = 分组边缘手柄改方向缩放（补丁位 5→6 修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「拖左侧条应调横向宽度结果整体大小、多调几次上下散架跑位」；
//   真身=分组缩放里锁定成员（带图）用 min(scaleX,scaleY) 等比缩，边缘柄(单轴)下把高度也一起缩、与框高脱节逐次漂移；
//   修法=角手柄(双轴)仍等比保图不变形，边缘手柄(单轴)按框轴向各自缩放（宽随 scaleX、高随 scaleY）；诊断实证边缘柄高度恒 130 不漂移；后端零改动 npm test 413/413；
// v10.28.62.5 = 左右合并改底对齐（补丁位 4→5 修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「两个卡片合并时下方的边总是不平总会凹进去」；
//   真身=mergeCards 左右并入用顶对齐，高度不同时底边参差、分割处凹口；
//   修法=左右并入改底对齐（tbb.bottom-cb0.bottom 落位），底边平齐（顶边可参差，各自大小不变）；后端零改动 npm test 413/413；
// v10.28.62.4 = 调卡片背景色不再删图片/边缘（补丁位 3→4 修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「调整卡片背景时图片和选择的自定义边缘会不见」；
//   真身=setCardBgColor 旧设计「背景色与图片互斥」会 img.remove() 删掉卡片图片；
//   修法=setCardBgColor 不再删 .card-img-bg/.card-stripes（图片在上、颜色垫底做边缘底色，与边缘共存）；后端零改动 npm test 413/413；
// v10.28.62.3 = 版本徽章放进状态栏 saveStatus 左侧（补丁位 2→3 修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「把版本号放在右下角的状态文字的左侧」；
//   修法=版本徽章由 position:fixed 改为 span 插入 .editor-statusbar 的 #saveStatus 前（左邻保存状态文字）；后端零改动 npm test 413/413；
// v10.28.62.2 = 版本徽章移到右上角（补丁位 1→2 修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「右下角的版本号和一个状态文字重叠了」；
//   修法=版本徽章 position:fixed 由 bottom:8px 改 top:8px，避开底部状态栏的保存状态文字；后端零改动 npm test 413/413；
// v10.28.62.1 = 字体搜索/筛选可交互修复（补丁位 0→1 修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「搜索栏和筛选下拉菜单都没办法互动」；
//   真身=字体面板 fpanel 的 mousedown e.preventDefault()（保文本选区）把搜索框/下拉的原生聚焦/展开也拦了；
//   修法=fpanel mousedown 对 .fp-search/.fp-lang 跳过 preventDefault + 搜索框/下拉 click 显式 focus 兜底；后端零改动 npm test 413/413；
// v10.28.62.0 = 字体面板加搜索栏+语言筛选（小改动位 61→62 新功能轮；
//   2026-10-07；站点恒 58.28）：
//   用户「选字体语言很麻烦，在菜单顶部加语言筛选栏和搜索栏」；
//   修法=字体面板 #fontPanel 顶部加 .fp-toolbar（搜索框 #fpSearch + 语言下拉 #fpLangFilter），buildFontPanel 填语言选项+行/组 data-lang，filterFontPanel 按名称搜索+语言筛选叠加过滤、空组头隐藏；i18n fc.font.search/fc.font.allLangs ×12 语；后端零改动 npm test 413/413；
// v10.28.61.0 = 恢复「图片与边缘同步」勾选（小改动位 60→61 新功能轮；
//   2026-10-07；站点恒 58.28）：
//   用户「那个让图片和边缘/边框同步的勾选呢」——上一轮去 Mask 时把勾选一起删了；
//   修法=恢复内容层 Mask：CSS .card-edge-custom .card-img-bg/.card-stripes clip-path=var(--card-mask-clip) + applyCardBg 按 edgeMask 写 --card-mask-clip=edge.clip（e.clip 原多边形）+ 勾选节 HTML + setEdgeMaskSync/renderEdgeMaskSec + setCardEdge 旗 + 草稿 edgeMask + i18n maskSync ×12 语；后端零改动 npm test 413/413；
// v10.28.60.0 = 自定义边缘装饰真的伸出矩形（小改动位 59→60 观感修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「还是看不到，可能是那个矩形的 Mask 导致的，去掉」；
//   真身=装饰层 ::before/::after 是 inset:0（矩形），背景只填满矩形、没伸出 1.4× 外扩——clip 虽是 1.4× 但背景只有矩形，被「矩形 mask」框住、藏在图片后看不见；
//   修法=clip 改回原多边形 e.clip，CSS 加 .card-edge-custom::before/::after inset:-20%（对应 CUSTOM_EDGE_SCALE=1.4）撑大装饰盒，clip 相对 1.4× 盒解析 → 剪影真的伸出矩形外一圈；后端零改动 npm test 413/413；
// v10.28.59.0 = AI 边缘藏宝图式呈现（小改动位 58→59 观感修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「参考藏宝图这个边缘的呈现代码，让 AI 生成部分的成品以一样的方式呈现」；
//   修法=customEdgeRecipe 照搬藏宝图渲染：clipSoft=TORN_CLIP_SOFT（软撕边标签）+cardLayers 加中性噪点 NOISE_CUSTOM（黑+alpha 0.30，适配任何自动配色）+cardOverlay 两段暗角 radial-gradient+glow=inset 辉光+border 1px+radius 3px；后端零改动 npm test 413/413；
// v10.28.58.0 = 移除边缘 Mask 效果（小改动位 57→58 观感修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「能不能去掉那个 Mask 效果」——图片不再被裁进边缘形状，恢复完整矩形显示；紫色边缘装饰（1.4×同心）保留；
//   修法=移除内容层 clip-path（CSS .card-img-bg/.card-stripes 规则）+ applyCardBg 的 --card-mask-clip 写入 + 「图片与边缘同步」勾选节（HTML/JS setEdgeMaskSync/renderEdgeMaskSec）+ 草稿 edgeMask + i18n fc.edge.maskSync ×12 语 + recipe clipInner/clipRaw 死代码；后端零改动 npm test 413/413；
// v10.28.57.0 = 紫色=1.4×内容（同心矩形，小改动位 56→57 观感修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「希望紫色始终比原本的内容大 1.4 倍，像苹果的 ConcentricRectangle 同心矩形，外围背景怎么变都始终在范围内」；
//   真身=56.1 用固定内缩 3%（CUSTOM_EDGE_FRAME）非比例关系，紫边随内容大小变化不恒定；
//   修法=customEdgeRecipe 改 clip=expandClipPct(e.clip, CUSTOM_EDGE_SCALE-1)（SCALE=1.4，同心 1.4×缩放）、clipInner=clipRaw=e.clip（内容=原形）；移除「边缘外扩距离」滑杆（HTML/JS/草稿 edgeExpand/i18n expandDist ×12 语）；后端零改动 npm test 413/413；
// v10.28.56.1 = 紫色边框可见（补丁位 0→1 修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「现状是那个紫色的部分不见了」——56.0 让 Mask=装饰同形状后，不透明图片（z0）盖住紫色剪影（z-1），紫边消失；
//   修法=customEdgeRecipe 增 clipInner=expandClipPct(e.clip, f-CUSTOM_EDGE_FRAME)（FRAME=0.03 内缩），applyCardBg 的 Mask 改用 clipInner——内容跟紫色走但内缩一圈，紫色作边框可见；后端零改动 npm test 413/413；
// v10.28.56.0 = Mask 跟随边缘装饰剪影（小改动位 55→56 观感修复轮；
//   2026-10-07；站点恒 58.28）：
//   用户「卡片本身有了 alight motion mask 效果但不符合预期，希望内容在紫色范围内、Mask 跟着紫色部分变化，而不是把 Mask 放在原本矩形上」；
//   真身=内容层 Mask（--card-mask-clip）用原多边形 clipRaw（0-100% 近矩形），而装饰剪影 ::before 用外扩 clip——两者形状不一致，外扩滑杆只动装饰不动内容；
//   修法=applyCardBg 的 Mask 改用外扩 clip（=装饰剪影同一形状），内容随外扩滑杆一起放大缩小、与紫色装饰完全对齐；clipRaw 保留但不再用于 Mask；后端零改动 npm test 413/413；
// v10.28.55.0 = AI 边缘/边框自动配色（小改动位 54→55 新功能轮；
//   2026-10-07；站点恒 58.28）：
//   用户「处理完之后能不能在 Ai 生成边缘/边框那边添加一个底层代码会根据图形或名称给边缘/边框添加自带颜色」；
//   真身=customEdgeRecipe 恒定紫渐变（所有自定义边缘/边框同色，不随名称/形状区分）；
//   修法=CUSTOM_EDGE_PALETTE 关键词色板（星=金/火=红橙/水浪=蓝/叶=绿/金=金黄/粉/雷=亮黄/暗/云=灰/紫=默认）+pickEdgeColor（名称关键词匹配 → 无匹配按 clip 多边形字符串哈希取色，同形状稳定同色）+edgeColorGradients（rgb → tint/layer 双透明度渐变）；customEdgeRecipe 改用 pickEdgeColor(e.name, e.clip)；后端零改动 npm test 413/413；
// v10.28.54.0 = 边缘外扩距离滑杆+卡身透明（小改动位 53→54 新功能轮；
//   2026-10-07；站点恒 58.28）：
//   用户「Z轴最底部的卡片还在并不是透明的…调整图像/内容与卡片边缘的距离时边缘还是在原有卡片范围内增加距离而不是增加整体大小」；
//   真身=①自定义边缘卡身 background 恒 --card-bg 矩形底（applyCardBg 只清内联 '' 不覆盖 CSS 默认）②overflow:hidden 把外扩剪影裁在矩形内③外扩系数 CUSTOM_EDGE_EXPAND 固定 0.06 无 UI 不可调；
//   修法=①.grid-card.card-edge-custom 卡身 transparent+overflow:visible（矩形底去掉、外扩剪影能伸出矩形外）②抽屉「图片与边缘同步」下加「边缘外扩距离」滑杆（0-30% 默认 6%，dataset.edgeExpand %→0-1 系数喂 customEdgeRecipe 的 expandClipPct；仅自定义边缘 edge 种显示）③草稿 edgeExpand 往返+i18n fc.edge.expandDist ×12 语；后端零改动 npm test 413/413；
// v10.28.53.0 = AI 边缘 Mask 化+图片与边缘同步勾选+边缘外扩多出去一点（小改动位 52→53 新功能轮；
//   2026-10-06；站点恒 58.28）：
//   用户「那个边缘在Ai生成完成后还是一样没办法使用，点击选中后还是一样没有在画布里出现，
//   还有能不能把边缘改成像Alight Motion 里的Mask一样就是图片只是会显示在它的范围内，
//   但是图片的现状会跟着边缘的现状而变化，但是用户可以在选择边缘那边选择图片的边框
//   是否要和边缘同步的勾选，然后我希望那个边缘一样要多出去一点预防图片或信息因为边缘的
//   变化而跑到范围外或被边缘遮挡到」；
//   真身=自定义边缘无外板+无 ::after 覆盖层（cardOverlay:[] 50.0 设计），剪影全在 ::before
//   z-index:-1 —— 图片/条纹内容层（.card-img-bg/.card-stripes z 0）整盒铺满把它完全盖住，
//   图片卡/条纹卡应用 AI 边缘=零可见（51.1 只修了未选中卡 toast，选中图片卡仍「什么都没有」）；
//   修法（三件）=
//   ① Mask 化（AM 口径）：内容层 .card-img-bg/.card-stripes 新增 clip-path:
//   var(--card-mask-clip)（CSS 规则+applyCardBg 写原多边形 clipRaw）——图片只显示在边缘
//   范围内、形状跟随边缘变化；卡根不剪（box-shadow/选中环/外板照常）；显式 '1' 开、
//   '0' 关（dataset.edgeMask，草稿 buildDraft/applyDraft 往返）；
//   ② 抽屉新「图片与边缘同步」勾选（fc.edge.maskSync ×12 语；无选中卡/分组/none/border 种
//   自动隐藏）：应用自定义边缘默认勾选（setCardEdge 写 '1'），内置边缘保留用户既有勾选
//   （不写不删），关掉=内容层整矩形旧行为；
//   ③ 边缘外扩（expandClipPct 0.06 系数）：装饰剪影 ::before 用外扩多边形（% 坐标
//   50+(v-50)×1.06、裸值同乘）——边缘多出去一圈，图片按原形裁剪后装饰在图片外露出
//   （不再被图片盖住），内容也不会跑到边缘范围外或被边缘遮挡；Mask 恒用原多边形
//   （clipRaw）形状严格跟随；内置边缘/仓库/文章页零改动（article 消费 raw clip 同前）；
//   后端零改动；i18n 新键 ×1（maskSync）；ethereal.css/transitions.js/10 分钟心跳零触碰
//   （编辑器页豁免 inline-css 零重跑）；
//   （rev 00379-6k8 瞬态占位上直播；二次烘焙重部署终态 rev 00380-8kn——live 文本滞后一部署=惯例）
// v10.28.52.5 = 折叠出画加深+画外停一拍+展开加Q弹（补丁位 4→5 观感修复轮；2026-10-05）：
//   用户「为什么他没有短暂的滑出画面外？」+「在展开的时候按钮能不能也附加上Q弹效果」；
//   真身=52.4 出画只 -40px 深（40px 宽按钮右缘恰贴屏幕边、完全离屏仅 ~0.2s）且 0.27s 极快，眼睛易错过；
//   修法=位移改四站 0% 右缘 214px→28% 加速滑出 -80px（整体出画+40px 余量）→50% 画外停留 ~0.2s
//   （linear 恒停=「短暂的滑出画面外」一眼可见）→100% 回弹过冲 cubic-bezier(0.34,1.56,0.64,1) 落定 6px；
//   Q弹同步改五站（28% 微缩 0.85 蓄力→50% 画外保持→70% 回屏瞬间拉长 scale(1.35,0.65)→100% 回规 1）+
//   展开态 fine 规则新增 fcToggleInQSquash 0.28s（45% 弹出拉长 scale(1.3,0.7)→75% 过冲挤扁
//   scale(0.9,1.1)→100% 回规；与基态 transition:left 0.25s 滑回并行；页面载入播放一次无妨）；
//   平板（pointer:coarse）恒旧行为（266px 右缘+0.25s 滑动）零回归；站点恒 58.28；后端零改动；i18n 零新键；
//   ethereal.css/transitions.js/10 分钟心跳零触碰（编辑器页豁免 inline-css 零重跑）；
//   （rev 00377-628 瞬态已直播；二次烘焙重部署终态 rev 00378-rjd——live 文本滞后一部署=惯例）
// v10.28.52.3 = 折叠按钮搬搜索菜单左侧+折叠出画回弹（补丁位 2→3 观感修复轮；2026-10-05）：
//   用户「然后FC编辑器左侧的菜单的折叠按钮能不能变成是放在搜索菜单左侧那边再多出一个圆形，
//   然后我希望折叠的时候他会先跑到画面外然后再回弹弹出这样」；
//   真身=折叠按钮 .asset-panel-toggle 绝对定位贴面板右缘 266px（49.1/49.2 设计），面板内搜索胶囊
//   全宽铺满无让位；
//   修法=桌面（pointer:fine）展开态按钮改驻左缘 6px=搜索菜单左侧的新圆钮（32×32 正圆 49.2/纯白
//   52.2 全保留、top 16px 与 40px 高搜索胶囊垂直对中）+搜索胶囊让位（width:calc(100% - 38px)+
//   margin-left:38px，按钮右缘 38 与胶囊左缘 46 留 8px 缝，内联 width 搬入 CSS）+折叠动画
//   fcToggleOutSpring 0.9s（先加速跑出画面外 -40px 再回弹过冲 cubic-bezier(0.34,1.56,0.64,1)
//   落定 6px）；平板（pointer:coarse）恒旧行为（266px 右缘+0.25s 滑动）零回归；站点恒 58.28；
//   后端零改动；i18n 零新键；ethereal.css/transitions.js/10 分钟心跳零触碰（编辑器页豁免
//   inline-css 零重跑）；
//   （rev 00373-q4k 瞬态占位上直播；二次烘焙重部署终态 rev 00374-5cz——live 文本滞后一部署=惯例）
// v10.28.52.1 = 边缘抽屉全部/我左右切换平台同款滑动+My 标签全语言化（补丁位 0→1 修复轮；2026-10-05）：
//   用户「那个FC编辑器点击边缘与边框之后滑出的左侧菜单的顶部的全部和我的 的左右切换能不能是和平台
//   一样的滑动的还有把那个My改成我，界面什么语言就什么语言不要参其他语言」；
//   真身=51.1 抽屉顶 nav 已改 segmented-control 结构，但只有 active 底色 0.2s 渐变（白胶囊不滑动）——
//   平台同款滑动=hub 顶部 subnav（data-slider + subnav.js 注入 .subnav-highlight-bg 白胶囊 0.55s
//   left/width 滑动 + 尾部 blob 残影 + slime 拉伸）；tabMy 兜底硬编码英文 My+zh/zh-Hant 词典值=My
//   （OpenCC 不翻拉丁）界面混英文；
//   修法=抽屉 nav 换 .subnav[data-slider]+.subnav-pill 平台原版结构（subnav.js 引入编辑器页；圆球滑出
//   挤压 subnav 宽度后 remove+add 触发观察器重对齐 edgeNavResync）+tabMy 兜底改「我」+zh/zh-Hant 词典值
//   改「我」（其余 9 语本就各语，en 恒 My——12 语零英文混杂）+52.0 旧条目保留；后端零改动；
//   站点恒 58.28；i18n 零新键；ethereal.css/transitions.js/10 分钟心跳零触碰；
//   （rev 00369-gmh 瞬态占位上直播；二次烘焙重部署终态 rev 00370-8g7——live 文本滞后一部署=惯例）
// v10.28.52.0 = 等级奖励（小改动位 51→52 新功能轮；2026-10-04）：与站点 v0.2.58.26 同轮——个人
//   Lv.2/6/9/12 + 团队 Lv.2/6/9/12（阈值=个人 ×1.5）升级领奖：成就+徽章+称号+头像相框+免费名片边缘；
//   团队经验五事件钦定：「上传一个作品 24px / 获得一个赞 16px / 一个粉丝 32px / 一个收藏 36px / 一个
//   分享/转发 20px」+双向对称钦定「少一个就收走 就给了24px少了一个就减24」（反向操作同额扣回 MAX(0,…)
//   不穿负；个人 XP 仍只进不出不变）；
//   修法：后端 033_rewards.sql（teams.xp_gained 列+users.avatar_frame/title 装饰激活列+achievements/
//   user_achievements/team_achievements/user_badges/user_cosmetics 五新表——health 66/user_version 33）
//   +team-xp.js 五事件记账（上传 24/赞 16/粉丝 32/收藏 36/转发 20；取消赞/取消收藏/取关/撤销转发/删除
//   作品同额扣回）+rewards.js POST /api/rewards/claim（幂等 INSERT OR IGNORE；个人信任客户端 lv 纯装饰
//   +团队校验成员+teams.xp_gained ≥ TEAM_LEVELS[lv-1] 阈值表）+GET /api/rewards/me+GET /api/teams/:id/
//   rewards；auth.js PATCH avatarFrame/title（服务端拥有性校验 user_cosmetics 行+白名单；null 卸下恒放行）
//   +publicUser/social 公开 avatarFrame/title；L2 免费名片边缘=claim 后 free-edge 授予行→免费用户
//   cardEdge PATCH 放行（订阅恒放行/null 恒放行祖父条款）；
//   前端：sidebar mn:level-up 监听→POST /rewards/claim→toast+mn:rewards-changed；community-profile 新
//   「成就&徽章」区（成就卡 chips+徽章行+称号/相框/边缘装饰行使用/卸下 PATCH）+昵称旁称号金药丸+头像
//   相框环（rookie 主题蓝环/champion 金 conic 环）+编辑弹窗相框/称号选择器（未解锁金罩锁+名片边缘门改
//   订阅或已解锁）；fluidcanvas 团队卡等级徽章 Lv.X（getTeamLevelState ×1.5 表）+成就 chips 条+关注/
//   取关钮（关注后刷新团队奖励重渲染）；编辑器发布 ?team= 团队作用域（publish id key 加 :TEAMID 后缀
//   +POST body teamId——团队视图发布不再落到个人频道）；i18n common rewards.* 25 键+fluidcanvas
//   fc.rewards.* 5 键 ×12 语（zh-Hant 只 OpenCC）；npm test 413/413（rewards.test.js 新增）；站点恒
//   v0.2.58.26（本条目外零改动）、ethereal.css/transitions.js/心跳零触碰；
//   （rev 00363-ksq 瞬态占位上直播；二次烘焙重部署终态 rev 00364-wdg——live 文本滞后一部署=惯例）
// v10.28.51.0 = 团队频道（小改动位 50→51 新功能轮；2026-10-04）：与站点 v0.2.58.26 同轮——用户
//   「把团队频道体系做出来」：创建团队频道弹三步向导（①是否把现有横幅&头像&名称&id 直接转换到团队频道
//   ②搬运内容多选：贴文/视频&贴图/动态/主页装饰/全部（默认全勾）③建群聊：头像+名称+拉好友），标配最多
//   3 组员、订阅项扩容（Basic 增至 8 / Plus 增至 16 / Premium 增至 26 / Premium Ultra 无限）；搬运=只搬
//   数据不搬频道（个人频道保留、私人点赞收藏留个人）；
//   修法：fluidcanvas.html #fcTeamWizard 三步向导弹窗（step1 身份：是/否大卡+否时团队名称输入；step2
//   搬运多选：全部+贴文/视频&贴图/动态/主页装饰 四复选框默认全勾（勾全部=四类全选）；step3 群聊：名称
//   1-60 字符留空不建群+好友多选列表 GET /api/friends）→ 一次 POST /api/teams {name, copyIdentity,
//   copyItems:['all']|四键数组, chat:{name, memberIds}}；团队切换区/渲染接真数据 loadTeamsFromApi（团队
//   频道卡=头像图/字母卡+名称+成员数；个人↔团队切换）；未登录建团=登录提示 toast；messages.html 建群真
//   接口：createGroupDemo 云模式换 POST /api/conversations {kind:'group', name, memberIds}（好友多选
//   #groupFriendPick 来自 GET /api/friends）+群列表/群消息/发消息接云端（群附件暂不支持 toast）；群头像=
//   名称首字母自动生成（与 messages 群列表同款，无 avatar 列）；premium.html Team Slots 卡数字改
//   8/16/26/∞ 并接通一次性结算（startCheckout mode='once'；slots-* 扩容订阅仅支持一次性购买）；后端
//   032_team_channels.sql 列级 ALTER（conversations.name/users.team_cap_addon+expires/posts.team_id；
//   health 61 恒/user_version 32）+pricing_plans 插 4 扩容 SKU（plan_key slots-basic/plus/premium/ultra
//   口径 8/16/26/∞）+POST /api/teams 一键向导（copyIdentity 拷 display_name/avatar_url/banner_url 入团队
//   data 个人行零改动；copyItems 贴文=复制 team_id 行原创作者标注保留、视频&贴图=uploads 新行同文件、
//   动态同口径、主页装饰=装饰字段入团队 data；点赞收藏恒不搬）+GET /api/teams/:id/members+POST/DELETE
//   成员（owner-only；上限 3+addon 映射 basic→8/plus→16/premium→26/ultra→∞ 满则 403 TEAM_FULL）+
//   GET /api/friends（accepted 双向）+建群写路径（memberIds 逐个限好友/去重/自排除/群名 1-60）；npm test
//   399/399（teams.test.js+friends+群聊矩阵新增）；i18n 36 新键×12 语（fc.team.* 28+messages.modal.group*
//   6+messages.toast.groupNoFile；premium slots12/24/36→slots8/16/26 原位替换；zh-Hant 只 OpenCC）；
//   站点恒 v0.2.58.26（本条目外零改动）、ethereal.css/transitions.js/10 分钟自动保存心跳零触碰；
//   （rev 00359-nfc 瞬态占位上直播；二次烘焙重部署终态 rev 00360-bk7——live 文本滞后一部署=惯例）
// v10.28.51.1 = 边缘样本默认配色+抽屉顶部导航平台同款（补丁位 0→1 修复轮；2026-10-04）：用户「样本除了
//   展示边缘还要展示默认自带的颜色那些」+「顶部导航的左右切换能不能参考平台的顶部导航的左右切换动画和
//   结构」；真身=样本 mini 恒中性紫渐变剪影（配色全在 EDGE_STYLES.cardLayers 从未上样本）、抽屉顶部导航
//   .fc-edge-tab 自绘平板双钮（active 全填充 primary）、边框线型样本画 var(--color-on-surface) 与取色器
//   脱节；修法：fluidcanvas-editor.html 样本网格 15 内置 mini 背景改 EDGE_STYLES[name].cardLayers 直写
//   配色（纸=羊皮纸米黄斑点/藏宝=棕金/科技1-6=暗蓝 HUD/油漆1-6=PAINT_GRADS 六色；「无」虚线空盒不动；
//   自定义剪影仍中性渐变）——edgeMiniHtml 加 bg 参数、renderEdgeSamples 传 cardLayers.join(', ')；
//   顶部导航旧 .fc-edge-tab 双钮删除，改用平台 segmented-control/segmented-option 同款结构（滑动白胶囊
//   thumb+0.2s 过渡；圆球仍从导航左侧滑出、edgeDrawerSetTab 类切换零改动）；边框样式节 7 线型样本改画
//   取色器当前色（默认 #c8c8d0 与卡片实际边框一致）；用户测试报告：「AI 边缘成功生成了但是无法使用
//   ——点击后什么都没有」；真身=setCardEdge 无选中卡时静默 return（AI 生成→保存→点条目全程不需要选卡，
//   新画布零卡=点击应用零反馈零变化）；修法：无选中卡→toast「请先选中一张卡片」（与右键入口同款
//   fc.common.selectCard 兜底文案）+无标签卡（content/text）→toast「该卡片不支持边缘样式」（T 键兜底
//   中文，与 fc.common.selectCard 历史同口径）；用户测试报告②：「边框那边生成失败」；真身=sanitizeClip
//   裸值坐标只许 0/100——border 双环内环 3-12% 内缩 Gemini 常输出裸值 8/12 之类→服务端白名单全拒→
//   200 ok:false→toast 生成失败（edge 满盒只用 0/100 故「边缘成功边框失败」）；修法：服务端 fc-edgegen.js
//   sanitizeClip+客户端 sanitizeClipEdge 同步放宽裸值 ±100 全收（纯数字零注入面，黑名单不动；百分比仍
//   0-100）；用户新请求：「弹窗做一个正向反馈——按钮下方会有小字和一个三粒点的 loading 条，左侧显示 AI
//   当前状态」；修法：AI 弹窗改两栏（左栏 AI 状态灯：灰空闲/蓝脉冲思考中/绿成功/红失败+状态文本；右栏
//   表单不变），按钮下方反馈行=三粒点弹跳 loading（生成中）+小字（正在生成，通常需要几秒钟/生成成功/
//   失败具体原因同 toast）；i18n 新键 5×12 语（fc.edge.genIdle/genThinking/genOk/genFail/
//   genThinkingHint；zh-Hant OpenCC 重生成）；站点恒 v0.2.58.26（本条目外零改动）、npm test 399/399
//   （edge-gen.test.js 裸值放宽用例移位同数）、ethereal.css/transitions.js/心跳零触碰（平台 segmented
//   类原样复用）；
//   （rev 00361-7vk 瞬态占位上直播；二次烘焙重部署终态 rev 00362-fdj——live 文本滞后一部署=惯例）
// v10.28.50.0 = 边缘抽屉+AI 生成+自定义边缘库+边缘仓库（小改动位 49→50 新功能轮；2026-10-04）：与站点
//   v0.2.58.26 同轮——用户「能不能把FC编辑器的弹窗点击后出现的二级窗口改成左侧弹窗？然后展示以该
//   选项的边缘样本展示，然后再那个左侧弹窗的顶部添加一个横向长条的自定义添加按钮，会弹出一个Ai要求
//   弹窗用户输入要求或一起附上图片，Ai生成Polygon Clipping 用clip-path和polygon()等等的代码制作出
//   那个边缘，还有一个叫边框样式的那个选项也是，一样可以通过描述或附赠提供图片让Ai 生成」+「生成完成
//   后上传进仓库之前选择公开/团队/好友/私人（和上传国旗的步骤一样）+左弹窗顶部导航左全部右 My+有
//   Team 和 Friend 时顶部菜单左侧滑出圆球在好友/团队间切换」；三项钦定：①两个入口（右键「选择边框
//   边缘样式」+卡片背景 popover「背景边缘」）合成一个左侧弹窗 ②AI=Gemini Flash 只负责生成、DeepSeek
//   只负责客服 ③自定义边缘/边框直接存进左弹层列表（名称+本体剪影展示），一次过把本地库做好；
//   修法：左侧抽屉 .fc-edge-drawer（z-66 介于 toc 抽屉与弹窗之间，translateX 滑入）：顶部导航左「全部」
//   右「My」+圆球（hasFriends&&hasTeam 时从导航条左侧 max-width 滑出、好友/团队互切；只有一方直达、
//   皆无则纯全部）；全部 tab=全宽「自定义添加」主按钮+15 内置边缘样本（名称+clip 剪影）+边缘仓库列表
//   （名称+本体+上传者名）；My tab=我的自定义（名称+本体+删除/上传仓库钮，已上传显可见性徽章+修改）；
//   两 tab 下方常驻边框样式节（7 CSS 线型+宽度滑杆+取色器——原 borderStyleModal 内容原位迁移，
//   openBorderStyleModal 改走抽屉 border 节）；AI 弹窗 #fcEdgeGenModal：种类边缘/边框+名称+描述+附图
//   （png/jpeg/webp ≤6MB）→ POST /api/fc/edge-gen（后端 Gemini Flash 直调：x-goog-api-key 头
//   GEMINI_API_KEY env、contents-only、temperature 0.4+responseMimeType application/json、60s+2 退避、
//   无 key 503 unavailable/预算 exhausted 200/解析失败 200 ai_failed）→ 服务端 sanitizeClip 白名单
//   （≤2000 字符、polygon 正则、3-80 点、坐标 %0-100 或裸 0/100、小数≤2 位、拒 url(/expression(/calc(/
//   var(/javascript:/引号/尖括号/反斜杠）+客户端镜像复核 → 预览+保存/重新生成；保存=只进本地「我的」；
//   自定义边缘模型：cardEdge='custom:<id>' 沿用现有字段零新卡字段（customEdgeRecipe：border 种
//   cardLayers:[]——边框带由 ::before evenodd 环画、卡背景不清理露卡身；edge 种禁用自动外板）；
//   localStorage slati_custom_edges（200 条+1MB 守卫）；草稿 customEdges 顶层 additive 只收被引用条目
//   （applyDraft 合并草稿赢）；article.html 阅读页消费（edge 种直写 clipPath、border 种
//   .art-card-custom-frame 子层；写前 sanitizeClip 复核）；边缘仓库：031_fc_edges.sql 新表（visibility
//   四值公开/团队/好友/私人）+GET /api/fc/edges?scope= 四范围过滤（optionalViewer 匿名见公开；好友集=
//   accepted 双向；团队集=我团成员）+POST/PUT/DELETE（本人）+scopes 端点（圆球依据）+上传弹窗
//   #fcEdgeRepoModal（imgMetaModal 先例：名称+可见性四选段）→ 条目 uploaded 徽章+「修改」PUT；后端
//   npm test 389/389；i18n 38 新键×12 语（37 fc.edge.*+fc.imgMeta.visFriends；zh-Hant 只 OpenCC）；
//   站点恒 v0.2.58.26（本条目外零改动）、ethereal.css/transitions.js/10 分钟自动保存心跳零触碰；
//   （rev 00356-djq 瞬态占位上直播；二次烘焙重部署终态 rev 00357-sh8——live 文本滞后一部署=惯例）
// v10.28.49.2 = 折叠按钮改圆形（补丁位 49.1→49.2 调整轮；2026-10-02）：与站点 v0.2.58.26 同轮——用户「那个折叠按钮能不能是一个圆形的」；
//   修法=.asset-panel-toggle 22×44 门帘形改 32×32 正圆（border-radius: 50% 双态恒同、border-left: none
//   撤除改四边完整 1px 边框）；49.1 :has 折叠态规则保留但收窄为只改 left: 6px（圆形无需补左边线/覆写圆角）；
//   left 滑动过渡与 49.1 同款零改动；站点恒 v0.2.58.26（本条目外零改动）、后端零改动、i18n 零新键、
//   ethereal.css/transitions.js/心跳零触碰；
//   （rev 00354-z2g 瞬态占位上直播；二次烘焙重部署终态 rev 00355-j7g——live 文本滞后一部署=惯例）
// v10.28.49.1 = 折叠按钮随菜单一起移动（补丁位 49.0→49.1 调整轮；2026-10-02）：与站点 v0.2.58.26 同轮——用户「还有那个FC编辑页左侧菜单的折叠按钮不会在菜单折叠后一起移动」；
//   真身=折叠按钮 .asset-panel-toggle 靠绝对定位 left:calc(面板宽+6px) 贴面板右缘，「面板折叠→按钮左移
//   6px」的旧规则写成 .asset-panel.collapsed + .asset-panel-toggle 相邻兄弟选择器，但 DOM 序里按钮是
//   .canvas-body 首子、面板是次子（按钮在前），相邻兄弟选择器恒不匹配=死规则，面板折叠后按钮滞留在
//   266px 处悬空；
//   修法=改 .canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle 祖先匹配（面板折叠态→按钮滑到
//   左缘 6px 圆角方块+补回左边线），DOM 顺序零改动、展开态口径逐字节不变（left 266px/圆角 0 6 6 0/◂）；
//   站点恒 v0.2.58.26（本条目外零改动）、后端零改动、i18n 零新键、ethereal.css/transitions.js/心跳零触碰；
//   （rev 00352-sdl 瞬态占位上直播；二次烘焙重部署终态 rev 00353-8d2——live 文本滞后一部署=惯例）
// v10.28.49.0 = 平板 4:3 视口+旋转按钮+逐设备布局（2026-10-02）：与站点 v0.2.58.26 同轮——用户「那个
//   FC 编辑器那边平板的比例是 4:3 然后横向 110 × 纵向 77 个格子 然后我希望当用户选择平板比例的时候
//   那个视口选择按钮旁边会滑出一个旋转按钮可以点击旋转方向进行编辑，然后这些视口内这些卡片的位置在
//   所有不同的比例或平板的方向它们的位置可以不一样，但是一定要拥有相关的卡片，就是卡片位置不需要
//   同步但是卡片的内容那些需要同步」；五项钦定：①发布侧=全部视口一起发布、阅读页按设备自动选布局
//   （纯自动无手动切换钮）、编辑页 ?article= 查看模式零改动 ②初始位置=系统自动排列（未动过的视口），
//   手动动卡才转自定义落盘（markPresetCustom 门控）③增删同步所有视口（仅位置各异）④自动排列规则：
//   mobile 全纵向（每卡一行全宽、合并组展开成员纵向流）/tablet+tablet-p 横向最多 2 卡（合并组=一个单位
//   整体等效比例缩放）/half=115 格砍半 58 格一排最多 4 卡第 5 放下方+长文卡至少 24 格（行内已有 3 卡时
//   最右挤到下方）/169=wiki 单列全宽 ⑤旋转按钮：选平板时视口按钮旁滑出、点击横竖互切；
//   修法：编辑器 PRESETS 五视口带 cols/rows（tablet 110×77 / tablet-p 77×110 / half 58 / 169+half+
//   mobile 100 行）、computeCols preset 感知、旋转按钮 .fc-rotate-wrap max-width 0→160px 滑出过渡
//   （display:none 不可过渡）+active 双 span 声明式 i18n（fc-rot-l/fc-rot-p）、autoFlowCards wiki 自动
//   排版（组单位 bounding 比例缩/阅读序 row+col 升序/行距 2 行/长文卡 24 格挤下规则）、
//   markPresetCustom 挂全部用户几何提交点（拖拽/合并/拆组/旋转/缩放/拖放建卡/fc-touch 守卫钩）、
//   删卡同步清全部预设表、草稿往返 additive tabletOrientation 'l'|'p'+presets['tablet-p'] 桶（旧草稿
//   缺省 'l'/旧 115 格表 clampPresetEntry 钳制）；阅读页 article.html 逐布局渲染（LAYOUT_COLS/ROWS 与
//   编辑器同源、pickReaderLayout 按设备自动选 <768 手机/768–1280 平板按横竖屏/≥1280 默认 169、
//   布局表空→autoFlowEntries 与编辑器同款算法、活动预设相等路径逐字节保持原口径、resize+横竖屏翻转
//   重渲染）；i18n 4 新键×12 语（tablet43/rotate/landscape/portrait，zh-Hant 只 OpenCC）；站点恒
//   v0.2.58.26（本条目外零改动）、后端零改动、ethereal.css/transitions.js/10 分钟自动保存心跳零触碰；
//   （rev 00350-6vv 瞬态占位上直播；二次烘焙重部署终态 rev 00351-5mm——live 文本滞后一部署=惯例）
// v10.28.48.2 = 首页假数据全撤接真实聚合+首页卡片不透明（补丁位 48.1→48.2 调整轮；2026-10-02）：与站点
//   v0.2.58.26 同轮——用户「能不能顺便把FC的所有并非用户手动创建的测试信息都去除掉，还有把所有FC的首页
//   卡片从玻璃变成不透明的卡片？」；三项钦定（详见站点 58.26 条目）：①只清页面硬编码假数据（演示账号与
//   后端库不动）②假数字区块接真实聚合+空态、匿名=登录引导卡 ③玻璃→不透明=只首页卡片（按钮/搜索胶囊
//   保持玻璃）；
//   修法：后端新端点 GET /api/fc/overview（stats 15 键全真聚合+windows 三窗口前窗对比+articles/media/
//   posts 清单，npm test 366/366）；页面八处假数据源全撤（dashboard 演示统计/团队乘数/quickStats 假卡/
//   内容表硬编码/上传假记录+simulateFilePick/内容库 18 条/分析假趋势/文章页种子+演示 contentJson/Alex
//   Rivera）→ FC_OVERVIEW 真实聚合（cloudMode=登录+USR- 前缀同步门、null 全站 '—'/空态、上传模块真
//   POST /api/social/uploads、文章页真 DELETE、动作后 loadFcOverview(true) 刷新）；首页卡片玻璃→不透明
//   （body.fc-page .card:not(.profile-header) --card-bg→--sidebar-bg+lg-backdrop 滤镜摘除+channelOverview/
//   channelSummary !important 覆写深浅两主题；按钮/搜索胶囊保持玻璃）；i18n 25 新键+demoSub 死键删；
//   10 分钟自动保存心跳/切页动画零触碰；
//   （rev 00348-t8b 瞬态占位上直播（已实得）；二次烘焙重部署终态 rev 00349-hgc——live 文本滞后一部署=惯例）
// v10.28.48.1 = 频道卡头像应用个人裁切（补丁位 48.0→48.1 调整轮；2026-10-01）：与站点 v0.2.58.25
//   同轮——用户「那个横幅和头像在上传后能不能先弹出一个选择裁切范围的弹窗调整裁切范围，还有那个横幅
//   能不能再高1.5倍？」；钦定⑤=FC 频道主页频道卡头像也应用个人裁切（资料页/设置弹窗裁出的 avatarCrop
//   同源一致）；
//   修法：renderContent 个人分支 img 外包 .fc-ch-avatar-crop 圆裁切盒（overflow:hidden+img 绝对定位
//   几何应用——MN_CropDialog.applyCrop 同款数学，null=默认 {0,0,1,1} 整图 cover=旧渲染零回归）；点击换
//   头像链在 busy 前插裁切弹窗（kind:'avatar'），确认才上传、取消=零上传零 PATCH，PATCH 体 {avatarUrl,
//   avatarCrop}（只 avatarUrl 绝不带 bio）；成功 raw 合并写 slati_user.avatarCrop；editable 类/title
//   重打零改动；边界=#personalAvatar/侧栏/userpop/帖子作者头像不应用裁切、FC 新代码零 bannerUrl 字样；
//   CSS 全进页面专属块→跳过 inline-css.js；storage.js 零改动；后端零改动；i18n 零新键（复用 common
//   crop.*）；站点 v0.2.58.25 同轮、10 分钟自动保存心跳/切页动画零触碰；
//   （rev 00346-rn2 瞬态占位上直播；二次烘焙重部署终态 rev 00347-skv——live 文本滞后一部署=惯例）
// v10.28.47.4 = 平板端药丸菜单平滑折叠过渡+白底列表（补丁位 47.3→47.4 调整轮；2026-09-26）：用户
//   「折叠的过渡动画不顺畅 很割裂」+「列表的背景能不能是白色的？」；真身三连：①折叠用
//   display:none !important——内容瞬间消失零过渡（display 不可 transition）；②关菜单（点药丸/删卡/
//   空点 tap）hideContextMenu 瞬间全消零退出动画；③药丸 0.24s 渐现+弹窗 0.28s 上滑与内容瞬间消失
//   不同步=割裂；修法①平滑折叠：内容收起/展开改走 transform translateY(-56px)+opacity 过渡
//   （fc-pill-fold-prep=收起视觉态——内容上移淡出=把原本内容顶进药丸；过渡挂 @media (pointer:
//   coarse) 限定桌面零影响——长按本就只在触控发生）；门控 fc-pill-fold 延迟 250ms 到内容透明后
//   才落 display:none（JS 计时器，showContextMenu 公共清理块清双计时器+exit/out 类+药丸回收——
//   退出动画中重开不串味）；修法②关窗退出动画：ctxPillFall 弹窗向下滑出+ctxPillFadeOut 药丸淡出
//   （240ms forwards，特异性 .asset-panel > .ctx-pill-dots.ctx-pill-out 压过渐现）+240ms 计时器
//   收尾 finishHideContextMenu（摘 active/exit/out/prep+药丸回收；hideContextMenu 拆出、退出动画中
//   早退防重入）；修法③白底列表：药丸弹窗卡 .context-menu.ctx-pill 恒白 #ffffff（深浅同）+条目
//   #1c1c2e 压暗/hover #f2f3f7/勾选 #4648d4/危险 #d92d20/分隔线 #e3e5ec（显式覆写压过 danger 泛化
//   规则）——桌面右键弹层零变化（只作用 ctx-pill 药丸态）；两卡结构/药丸只做关闭/顶部停靠/
//   桌面右键/面板折叠自动展开全部保持；站点恒 v0.2.58.0、后端零改动 334/334、零草稿字段、
//   ethereal 零改动、i18n 零新键、10 分钟自动保存心跳零触碰；
//   电池 fc-pilltop 11/11（新 B1 两段中态/B3 三段退出动画/B4 prep）+fc-pillmenu 16/16 口径随轮改
//   平滑折叠+白底后全绿+舰队 38 套全绿（micro-v056 首跑 3 红=活动流时序 flake，独立复跑
//   21/21 销账；grep exit=1|💥 复核零残留）+冒烟 60/60+i18n 34/34+后端 334/334；
//   镜像内容验证 27/27；线上探针 fc-pillmenu-live 13/13（B3 三段退出动画实机实证）；
//   rev 00303-kdj
// v10.28.47.3 = 平板端药丸菜单两张独立卡片（补丁位 47.2→47.3 调整轮；2026-09-26）：用户「我要的是
//   原本的那个左侧菜单内容被折叠进那个三粒点内，然后弹窗内容从下向上滑出然后把原本的内容顶进那个
//   三粒点内，然后我原本的图片不是有两个独立的卡片吗三粒点独立一个 弹窗内容独立一个你怎么可以随便
//   整合」——47.2 的药丸头与弹窗条目同箱一体化作废；修法：药丸拆成独立卡片①（面板首子=截图红带，
//   搜索框同规格 40px 横长条药丸+more_horiz），弹窗内容=独立卡片②（面板次子=截图蓝区，保留桌面
//   弹层的卡片底 shadow-lg）；原本的左侧菜单内容（搜索框+卡片列表）随菜单打开折叠进药丸内
//   （fc-pill-fold 门控只留两张卡，!important 压内联 display）；弹窗入场动画 ctxPillIn 顶滑入→
//   ctxPillRise 从下向上滑出（translateY 110% 把原本内容顶进药丸）；药丸只做关闭（点药丸=关弹窗+
//   内容展开回来，47.2 的折叠/展开条目口径随一体化箱作废）；关菜单时药丸回收回菜单箱、折叠门控
//   清除内容展开回来；桌面右键弹窗零变化（弹层回 body 贴指针、药丸恒藏）、面板折叠时长按自动展开
//   照常；47.2 的 flex-shrink:0 禁压修复保持；站点恒 v0.2.58.0、后端零改动 334/334、零草稿字段、
//   ethereal 零改动、i18n 零新键；
//   电池 fc-pilltop 11/11+fc-pillmenu 16/16 口径随轮改两卡结构后全绿+舰队 38 套全绿+冒烟 60/60+
//   i18n 34/34；
//   镜像内容验证 17/17；线上探针 fc-pillmenu-live 13/13；
//   rev 00302-8fz
// v10.28.47.2 = 平板端药丸菜单顶部停靠（补丁位 47.1→47.2 调整轮；2026-09-26）：用户「然后平板端的
//   FC编辑左侧菜单我要的是长这样的」+截图钦定（红带=折叠三粒点的位置在左侧菜单最顶部、蓝区=电脑端
//   弹窗的内容在其下方）；修法：药丸菜单停靠点从面板末位（底部）改为面板首子（顶部）——insertBefore
//   (contextMenu, panel.firstChild)（44.2 的「挂在左侧菜单内」不变，只挪停靠位）；CSS margin-top 8px→
//   margin-bottom 8px（菜单与下方搜索框间隔）；入场动画 ctxPillUp 底部滑入 → ctxPillIn 顶部滑入
//   （translateY 110%→-110%）；折叠/展开、⋮ 恒居菜单首位横药丸头、桌面右键弹窗零变化；面板折叠时长按
//   自动展开、scrollIntoView nearest 照常；顺带修复 44.2 遗留压缩 bug——面板是 scrollable flex 列、粗指针
//   媒体查询给菜单 overflow-y:auto → 自动最小尺寸=0 → flex-shrink 把菜单压成只露药丸头+2 条的小缝；
//   加 flex-shrink:0 菜单全展开（7 项 390px=截图蓝区口径，面板自行滚动、菜单内宽 235→229）；站点恒
//   v0.2.58.0、后端零改动 334/334、零草稿字段、ethereal 零改动、i18n 零新键；
//   电池 fc-pilltop 11/11（新）+fc-pillmenu 16/16 口径随轮改顶停靠后全绿+舰队 38 套全绿（all-opaque 首跑
//   1 红=Chrome 未起来 flake，独立复跑 34/34 销账）+冒烟 60/60+i18n 34/34；
//   镜像内容验证 12/12；线上探针 fc-pillmenu-live 14/14；
//   rev 00301-gsh
// v10.28.47.1 = 添加图像弹层加大（补丁位 47.0→47.1 调整轮；2026-09-26）：用户「那个添加图像的窗口
//   能不能做大些？」；一问钦定：440px·3 列（推荐档）——明显变大一圈、图名可读、网格超高滚动不再无限拉长；
//   修法：.tt-img-pop 280→440px 宽（padding 10→12）；库格 2→3 列（.tim-grid.tt-lib-mode repeat(3,1fr)）；
//   库格缩略图 44→60px、图名 10→11px 两行截断（-webkit-line-clamp 2）；.tim-grid 加 max-height 380px+
//   overflow-y auto（库长不再无限拉长弹层，维基结果同受益）；维基结果格 2→3 列（大窗比例更佳）；锚定数学
//   视口钳制原样（弹层变宽自动左移不越屏）；站点恒 v0.2.58.0、后端零改动 334/334、零草稿字段、ethereal
//   零改动、i18n 零新键；
//   电池 fc-ttwide 12/12（新）+舰队 37 套全绿（micro-v056 首跑 3 红独立复跑 21/21=flake 销账）+冒烟 60/60
//   +i18n 34/34；镜像内容验证 12/12；线上探针 fc-ttwide-live 7/7；
//   rev 00300-s6c
// v10.28.47.0 = 文字工具栏添加图像弹层图库同步（小改动位 46→47 新功能轮；2026-09-26）：用户
//   「文字的工具栏那边的添加图像的图库有没有做好同步图库？」+「能不能同步一下？」；真身：v10.28.22 弹层
//   （#ttImgPop）库视图只渲染 FC_FLAG_LIBRARY（29.1 起空数组）+上传格，从不显示「我的图库」——反向
//   （弹层上传→图库）早经 imgMetaSave choke point 单向通，缺的只是弹层 UI；两问钦定：搜索框保持搜维基
//   （行为不变）/全部同步（库条目+标签筛选下拉多选+标签管理按钮，两入口与主图库同口径）；
//   修法：主 IIFE 两桥+四钩（window.esc/window.currentTabItems 导出；imgMetaSave 入库后与 tagManage
//   合并/新建/删除后 __ttOnTagsChanged 弹层即时重绘——弹层未开时无消费者 no-op）；弹层加 .tt-filter-row
//   （筛选钮+计数徽章+下拉多选菜单全选/清空+标签管理钮复用 #tagManageModal 叠层幂等、关窗 closeModalOnly
//   弹层不坏）；库视图 renderTTLib 两列格（缩略图+名称+chips 复用 renderFlagTagChips 内部转义）+上传格
//   恒尾位；筛选 TT_FILTER_TAG_IDS 每次打开重置、会话内跨搜索/清除保持（runImgSearch 摘 tt-lib-mode
//   搜索态干净）；点库格=先关弹层再 insertInlineImage 镜像维基格路径（插不进 toast 提示；上传流留窗语义
//   属 meta 弹窗）；mousedown 守卫豁免 .tt-filter-row（checkbox 可正常点击）；站点恒 v0.2.58.0、后端
//   零改动 334/334、零草稿字段、ethereal 零改动、i18n 零新键（fc.tag.* 12 语言全复用）；
//   电池 fc-ttlib 23/23（新）+舰队 36 套全绿+冒烟 60/60+i18n 34/34；线上探针 fc-ttlib-live 12/12；
//   rev 00299-dxx
// v10.28.46.0 = 图库标签系统+头像/地图图库桥+AI 混合查重（小改动位 45→46 新功能轮；2026-09-25）：用户
//   「那么之前已经上传了的你能不能补上？」+「做！但是再添加一个标签分类例如默认标配 国旗 国徽 地图 这三个其他
//   用户可以自己创建，但是为了减少重复出现所以需要用Ai检查一下 是否有重复的标签 不同语言可以通过翻译搜索搜索到
//   一个标签上为了减少重复出现，然后标签的语言是一个原文一个翻译成英文的英文名称 默认展示系统翻译或者用户提供的
//   英文名称点击旁边的info icon可以查看标签介绍，然后在图库那么提供一个筛选按钮可以搜索筛选选项的下拉可多选菜单」；
//   四问钦定：AI 查重=混合双查（本地智能先查+后端 DeepSeek V4 Flash 非 Pro，用户供 key）/标签创建查看=两处都要
//   （图片信息弹窗+图库标签管理弹窗）/筛选多选=任选命中 OR 并集（与搜索框条件 AND 叠加）/自建标签显示=双语并排
//   （原文 · 英文名；系统标签随界面语言）；
//   修法：标签 store localStorage slati_img_tags（sys-flag/sys-emblem/sys-map 惰性播种不可删+自建时间戳 id、
//   显示名走 i18n fc.cardtype.* 随界面语言、介绍走 fc.tag.desc.*）；图库条目加 tags:[tagId]（imgMetaSave 唯一
//   choke point 收标签、editLibImg/syncLibMeta 透传、旧条目 it.tags||[] 全路径容忍、草稿格式零改动标签不入草稿）；
//   两处建标签：图片信息弹窗内标签行（chips 多选+info ⓘ 看介绍+新建面板 原文/英文名/介绍三输入）与图库弹窗内
//   「标签管理」弹窗（行列表+用量计数+自建可编辑/删除、系统标签锁）；AI 混合查重：本地归一+12 语言字典等价先查
//   →命中弹「已有相似标签：X——合并到它/仍要新建」（合并=选既有 id 不新建）；未命中后端 POST /api/tags/dedup
//   （DeepSeek v4-flash、temperature 0、60s 超时重试 2 次、matches 只回真实存在 id、无 key 503/故障 200 空
//   全静默降级本地-only 零打扰）；跨语言搜索：filterFlags 搜索词同时匹配名称/介绍/标签名（sys 标签 3×12 语言
//   硬编码表与字典逐字对齐含 OpenCC 繁体）；图库筛选钮→下拉多选菜单（全选/清空+计数徽章）；图库桥：右键菜单
//   新增「从图库选择头像/地图」两项（openLibForSlot 带参调用、confirmFlagSelection 按 slot 分支、apply 镜像
//   上传路径 fi 覆盖层 replaceChildren 保留/map-empty 移除、apply 后 onContentChange+saveDraft(true) 静默=
//   上传即已保存口径、图库内上传跟随所开 slot）；连带效应：DEEPSEEK_API_KEY 使 AI 客服转活（deepseek-chat
//   已退役路由同 v4-flash 行为等价、budgets.chat 20 元/月硬上限兜底）；站点恒 v0.2.58.0、后端 327→334
//   （新端点+7 用例）、零草稿字段、ethereal 零改动、i18n 新键 34×12+zh-Hant OpenCC 重生成 539 键；电池
//   fc-tags 31/31（新）+舰队 35 套全绿（版本锚 sed 45.2→46.0 共 35 文件+00297-→00298- 共 23 文件；
//   fc-opaque 首跑 1 红=新 CSS opacity:0.55 撞其 S5 计数断言→改 0.5 独立复跑 21/21 销账）+冒烟 60/60+
//   i18n 34/34；线上探针 fc-tags-live 14/14（S1/S2 静态+P1-P7 实机+E1）；rev 00298-4qj
// v10.28.45.2 = 上传图片落地即存草稿（补丁位 1→2·用户反馈修复轮；2026-09-25）：用户「还有为什么我上传的图片需要自己按保存？上传就上传了怎么会不见？？」；真身=图片落地（元数据弹窗保存成功）后只进画布内存+「我的图库」持久库，草稿持久化只靠 10 分钟自动保存心跳（用户钦定周期，最快 5 分钟）和 pagehide 关页兜底——中途关页/切后台（iPad Safari pagehide 不可靠）草稿从没写过 → 刷新图片没了，手动按「保存草稿」立刻写库所以不丢；修法①：imgMetaSave（8+ 上传入口唯一 choke point）apply 成功后立刻 saveDraft(true) 静默落草稿——上传=已保存；saveDraft 加 silent 参数只压成功 toast（状态徽章照常 Saved just now、失败 toast 恒弹），10 分钟心跳周期不动；修法②：getCardFingerprint 补 charAvatar/mapImg dataURL 摘要（length+tail 与 cardBgImg 同口径）——同文件名换图不再骗过心跳/pagehide 脏守卫（此前指纹只有元数据）；站点恒 v0.2.58.0、后端零改动 327/327、零草稿字段、ethereal 零改动、i18n 零新键；电池 fc-uploadsave 13/13（新：上传→弹窗保存→草稿立即含 charAvatar 零心跳等待/silent 静默末次 toast 头像已上传非草稿已保存/图库持久库同写/同文件名换图指纹 av:length:tail 精确在场+autoSave 脏守卫放行落新图/地图卡同链/取消弹窗零写入）+舰队 34 套全绿（版本锚 sed 45.1→45.2 共 40 文件+00296-→00297- 共 7 文件）+冒烟 60/60+i18n 34/34；线上探针 fc-uploadsave-live 10/10；rev 00297-gfn
// v10.28.45.1 = 编辑页顶部栏缩身+迁移按钮白底白字修复（补丁位 0→1·用户反馈修正轮；2026-09-25）：用户
//   「能不能吧FC编辑页的顶部栏缩小一些太大了」+「还有顶部的迁移按钮为什么文字默认是白底白字的」；
//   修法①顶部栏缩身：.editor-header 纵向垫 12→5px + gap 12→8px（~64→~42px 高）、作用域化 .btn-sm
//   垫 6→3px 12px、.btn-icon 40→30×30（padding 0 压回——顺序敏感在 .btn-sm 后，返回钮兼带两类居中）、
//   btn-sm 图标 24→20px、Migrate svg 24→20 + span 垫 7→4px 12px、标题 article 图标 22→18px；粗指针
//   （iPad）44px 命中区兜底不变（coarse 媒体查询 min-* 压回，Migrate 钮新入列表）；修法②迁移按钮
//   真身：FC 翻译轮把按钮文字包进内层 <span data-i18n>，后代选择器 .migrate-btn span 连内层一起选中
//   → 双重 invert 文字反了两次=白字压白面板；改子代选择器 .migrate-btn > span 只罩外层衬垫 span——
//   整子树一次反转回原设计（静息黑字黑箭头、悬停翻白），hover 同步改；站点恒 v0.2.58.0、后端零改动
//   327/327、零草稿字段、ethereal 零改动、i18n 零新键；电池 fc-headershrink 18/18（新：头栏 41px/
//   单次反转黑字/真悬停翻白/粗指针 44px 兜底）+舰队 33 套全绿（版本锚 sed 45.0→45.1 共 37 文件+
//   00295-→00296- 共 5 文件；article-frontend 修复后 48/48——FC 翻译轮起 B16-B19 段静默崩溃、
//   runner 💥 不计红数本轮显形修复）+冒烟 60/60+i18n 34/34；线上探针 fc-headershrink-live 8/8；
//   rev 00296-qxx
// v10.28.44.3 = 平板合拼边缘不齐+触控上传修复+125→115 格宽（补丁位 2→3·用户反馈修正轮；2026-09-25）：
//   用户「平板移动端在合拼卡片之后边缘会不齐，和无法点击上传图片」+「把125格宽减少一个10格」；
//   修法①合拼落位统一旋转感知包围盒（cardBBox）口径：预览贴齐（findMergeSnap）按 bbox 算边、旧提交用
//   未旋转 offsetWidth 整数边落位——旋转卡（平板旋转手柄一等手势）合并后视觉错开可达卡宽 10-15%；
//   上下并入面判定/面并集/落位三处全换 bbox（cb0 自身 bbox 原点偏移、未旋转卡恒退化回旧算式零行为变化）、
//   左右并入贴目标 bbox 侧边；捏合浮点 viewZoom 产生的浮点位置几何贴齐（视觉真相），不再制造 ≤半格间隙；
//   修法②触控上传：fi 透明覆盖层盖住头像/空图态地图画布（tap 直击 input 本体=原生手势带用户激活→文件
//   选择器可开；触控桥合成 click 无激活被浏览器静默拒绝，旧 div.click→fi.click 链触屏全断）——input 命中
//   桥 inEditableZone 豁免零桥改动（fc-touch.js 零改动）；avatar.replaceChildren(fi) 保覆盖层不被清掉、
//   地图有图态 .map-canvas:not(.map-empty) 收层（画布让位拖动/双击开区域编辑器）；修法③125→115 格宽：
//   computeCols 恒 115+编辑/查看舞台 STAGE_COLS 115（编辑画布盒 115×20+114×2=2528）+阅读页同源
//   （stageW 115×22=2530），三处注释同步；站点恒 v0.2.58.0、后端零改动 325/325、零草稿字段、
//   ethereal 零改动、i18n 零新键；电池 fc-mergefix 6/6（新：浮点 zoom 合并落位整数 flush/旋转目标 bbox
//   贴齐/未旋转回归/上下并入 bbox 面/零异常）+fc-touch-uploads 7/7（新：iPad 仿真 tap 头像/地图空图态
//   原生选择器拦截实证+有图态收层拖动+零异常）+舰队 29 套全绿（版本锚 sed 44.2→44.3 共 26 文件+
//   125/2748/2750 口径 115/2528/2530 共 6 文件+00292-→00293- 共 4 文件）+冒烟 55/55+i18n 34/34；
//   线上探针 fc-44x3-live 11/11（B2 浮点 zoom+旋转目标 bbox 贴齐实证+B3/B4 原生选择器弹出）；rev 00293-2lk
// v10.28.44.2 = 触控长按药丸菜单进左侧菜单（补丁位 1→2·用户反馈修正轮；2026-09-25）：用户「怎么还是
//   一样是竖着的药丸？我要的是直接就是在左侧菜单内不是单独的弹窗！！」+「那三粒点我要的是横向的不是
//   纵向的」+「三粒点就是把左侧原本的卡片菜单折叠起来而已点击就是展开」——问询钦定：底部停靠（卡片
//   列表保持在面板上方，菜单从面板底部向上滑出、停靠面板最底部）；44.1 左下角独立弹窗方案作废；修法：
//   showContextMenu 药丸分支把 #contextMenu 整体挂进 .asset-panel 末位（flex 列底部停靠；面板折叠时
//   先 toggleAssetPanel 展开；桌面右键分支弹层搬回 body 贴指针——串味路径还原）；CSS .ctx-pill 改
//   position:static 占满面板内宽（236px）+ 去阴影（面板内嵌卡片观感）+ ctxPillUp 入场动画不变（面板
//   overflow 裁切天然形成从底部滑出）；.ctx-pill-dots 改真·横长条药丸（搜索框同规格：40px 高、
//   radius-full、input-bg-focus 底、card-border 边框）+ 横向三点 more_horiz（用户钦定，原 more_vert
//   作废）；折叠态容器透明化只留药丸、三点只做折叠/展开切换（再点展开，不关菜单）；空画布 tap/Esc/
//   菜单项关闭链与桌面右键零变化保持；站点恒 v0.2.58.0、后端零改动 325/325、零草稿字段、ethereal
//   零改动、i18n 零新键、fc-touch.js 零改动；电池 fc-pillmenu 16/16（B1-B7 口径更新：菜单在面板内/
//   static 定位/底部停靠/横药丸头 more_horiz/折叠透明化/桌面右键回 body 贴指针+B8 面板折叠自动展开）+
//   舰队全绿（版本锚 sed 44.1→44.2 共 23 文件）+冒烟 55/55+i18n 34/34；线上探针 fc-pillmenu-live
//   14/14（新 B8）；rev 00292-znm
// v10.28.44.1 = 触控长按药丸菜单横药丸头（补丁位 0→1·用户反馈修正轮；2026-09-25）：用户「那个左侧菜单
//   不是我要的，我要的是把原本的卡片菜单折叠起来变成一个横着的长条药丸就是现在平板上左侧菜单上的卡片
//   搜索输入框那种大小，然后下方就变成自定义功能栏的内容」——44.0 竖药丸+三点插中部的方案作废；修法：
//   三点钮改插菜单首位成横长条药丸头（资产面板卡片搜索框同规格：40px 高、面板内宽 236px=260−2×12、
//   radius-full、⋮ 居中），功能栏条目排在药丸下方（展开态药丸头带底边分界线）；折叠态只藏条目不缩宽
//   （48px 竖药丸废弃——药丸横卧左下恒在 236×40）；空画布 tap/Esc/菜单项关闭链与桌面右键零变化保持；
//   站点恒 v0.2.58.0、后端零改动 325/325、零草稿字段、ethereal 零改动、i18n 零新键；电池 fc-pillmenu
//   15/15（B1-B4 口径更新：药丸头首位/横药丸 236×40/折叠不缩宽/条目在药丸下方）+舰队全绿（版本锚 sed
//   44.0→44.1 共 23 文件）+冒烟 55/55+i18n 34/34；线上探针 fc-pillmenu-live 13/13（新 B2 药丸头首位）；
//   rev 00291-61e
// v10.28.62.25 = 发布画布改为开放展示、整页滚动（用户「开放展示不要框在范围内，上下滚动用整个页面」）：.art-canvas overflow auto→visible，去掉画布内部滚动条，纵向交给页面滚动。
// v10.28.62.26 = 修复国家三步创建文章点编辑打不开（用户「FC内容那边点编辑编辑不了该文章」）：applyDraft 兼容「只有 x/y/w 无 col/row」的卡片（按格子反推 col/row）；loadArticleForEdit 用文章表 title 补 contentJson 缺失的标题。
// v10.28.63.0 = 整组缩放改 Canva 刚体变换（用户「像 Canva 框选多项目调整大小，彻底解决上下错位/变形/破图」）：拖动全程不量化（组框/成员位置/尺寸全浮点、同一倍率缩放，缝永不裂、零校正）；松手 commitGroupResize 才一次性量化尺寸+写回 colSpan/rowSpan、等比锁保留精确像素。
// v10.28.63.1 = 资产面板（选择图标种类）改左侧抽屉弹窗（与边缘/边框抽屉同款）：默认收起、左侧圆钮点开滑入、头部标题+关闭钮；搜索胶囊回 100% 宽。
// v10.28.63.2 = 保存草稿错误分诊（用户「点击保存草稿没办法保存」）：buildDraft 进守卫不再静默失败；非配额错误把原因打进提示，便于定位。
// v10.28.63.3 = 合并留间距（用户「两个图片合并在一起中间可以有一段间隔的距离」）：mergeCards 上下左右四个方向落位各留 MERGE_GAP=12px 间距，不再贴齐。
// v10.28.63.4 = 组背景套边缘主题不被裁切（用户「选择边缘的时候边缘被裁切掉了」）：applyGroupBgTheme 撤掉自由形状 clip-path，外板环带/边缘 artwork 完整伸出。
// v10.28.63.5 = 撤销 63.1 资产面板抽屉化（用户「左侧菜单为什么不见了，原本有带动画的那个」）：恢复常驻左侧资产面板 + Q弹折叠动画 + 搜索胶囊让位，全部还原。
// v10.28.63.6 = 折叠滑出改「重力拉长」Q弹（用户「滑出窗口外的时候没有地心引力的那种拉长」）：滑出瞬间沿运动方向拽长 scale(1.4,0.6)、画外保持、回屏落地压扁过冲回规。
// v10.28.63.7 = 折叠内容动画（用户「折叠时搜索栏向上滑出、卡片从下到上逐一掉下去、掉下去时被地心引力拉伸、搜索栏向上也拉伸」）：搜索栏 fcFoldUp 向上拉长滑出；卡片/标题/自定义条目 fcFoldDown 逐一重力掉落（倒序延迟）；动画放完再收面板宽度。
// v10.28.63.8 = 折叠时序修正（用户「等他们动画跑才开始折叠」）：面板收窄改按「最大延迟+时长+缓冲」动态计算，最后一张也掉完才收。
// v10.28.63.9 = 折叠动画统一向左滑出（用户「让全部搜索卡片选项等等全部改成向左滑出」）：搜索栏/卡片/标题/自定义条目全走 fcFoldLeft 向左滑出 + 右缘锚定沿运动方向重力拉长。
// v10.28.63.10 = 折叠顺序调整（用户「先是搜索和卡片选项那些然后逐步才到那个按钮」）：按钮 Q弹 改到条目全部滑出 + 面板收起之后才登场。
// v10.28.63.11 = 折叠同刻完结（用户「动画完结的时间是一样的只是那个按钮慢一个 0.2s」）：条目延迟按 1.1s 总长均摊、按钮 0.2s 后登场（0.9s Q弹），两者 1.1s 同时完结。
// v10.28.63.12 = 条目先于按钮滑出窗口（用户「自定义和卡片选项会在按钮动画开始到滑出窗口范围前就已经先滑出」）：条目压到 ~0.42s 内滑完、单条 0.22s；按钮 0.2s 登场约 0.45s 滑出窗口时条目已清空。
// v10.28.63.13 = 折叠跟随按钮动画开始（用户「折叠是跟着那个按钮的动画开始的」）：按钮 Q弹 与条目折叠同刻出发，不再错开 0.2s。
// v10.28.63.14 = 画布底 100% 透明（用户「把Z轴最底的那个底变成100%透明的」）：grid-canvas 背景色撤掉，只留网格线，页面底色直接透出。
// v10.28.63.15 = 画布盒描边+阴影一并撤掉（用户「那个底我还是看得见啊有一个边框的线」）：box-shadow 改 none，Z轴最底的画布完全不可见只剩网格线。
// v10.28.63.16 = 面板宽度收放跟随按钮 Q弹 速度曲线（用户「那个底的移动能不能跟着那个按钮还有它的动画速度曲线」）：transition 换 spring 过冲曲线 0.4s，与按钮回弹段同步。
// v10.28.63.17 = 折叠与按钮同刻出发（用户「按钮都开始移动了那个折叠慢半拍」）：条目改为从上面（按钮旁）开始向下逐一滑出，最上层零延迟跟按钮同帧动。
// v10.28.63.18 = 条目与按钮共用一个动画（用户「还是一样慢了...给他和按钮共用一个动画...除了回弹的部分不要」）：fcFoldLeft 改 0.9s 与按钮 Q弹 同曲线同节奏、零逐条延迟；条目滑出后停在画面外淡出，不跟回弹。
// v10.28.63.19 = 完成前卡顿修复（用户「为什么他会在要完成的时候卡一下」）：fc-fold-anim 摘类延迟到面板收完（条目不再瞬间弹回闪一下）；refitColumns 挪到动画全部落定后（不再与按钮落点同帧全卡重排掉帧）。
// v10.28.63.20 = 条目淡出提前到 28%（用户「选项卡片该完成的时候却慢了一个0.1秒」）：与按钮滑出窗口完成点同刻结束淡出，不再慢半拍。
// v10.28.63.21 = 右侧画布左移加速（用户「右侧内容滑向左侧慢了」）：面板收放改 0.25s 加速曲线、条目淡出完（0.3s）即收面板，右侧画布轻快左移。
// v10.28.63.22 = 整体再快 0.2s（用户「能不能让它再快0.2s」）：按钮 Q弹 与条目动画 0.9s→0.7s、面板 0.24s 开收、refit 0.8s。
// v10.28.63.23 = 整体再快 0.3s（用户「能不能再快0.3s」）：按钮 Q弹 与条目动画 0.7s→0.4s、面板 0.14s 开收、refit 0.6s。
// v10.28.63.24 = 加速目标修正（用户「我是指右侧内容向左侧移动的速度啊」）：按钮 Q弹/条目动画还原 0.9s；面板收放 0.25s→0.12s 疾收、0.25s 即开收——右侧画布左移瞬间完成。
// v10.28.63.25 = 展开甩出动画（用户「展开的时候按钮能不能有一个被甩出来拉伸后再恢复的动画」）：fcToggleInQSquash 改 0.5s——甩出拉长 scale(1.45,0.62)→压扁过冲→恢复。
// v10.28.63.26 = 展开甩出加位移过冲（用户「给他一小段的甩出范围然后再回弹回原位」）：40% translateX(+24px) 甩出一小段 + 拉长，70% -6px 回弹，100% 回原位。
// v10.28.63.27 = 甩出更远+阻尼回弹（用户「甩出的距离更远一点希望更加自然」）：三段阻尼振荡——35% +38px 拉长、62% -9px 压扁、82% +4px 小过冲、100% 回原位。
// v10.28.63.28 = 回弹放慢（用户「回弹速度可以不要那么快」）：0.5s→0.7s、回弹段拉长（70%）、二次小过冲后置（88%），衰减更舒缓。
window.FLUIDCANVAS_VERSION = 'v10.28.64.20';

/* ─────────────────────────────────────────────
   v0.2.58.16 全站灯塔：每页一次 POST /api/analytics/pageview（动态页热力图数据源）。
   sendBeacon 优先 + fetch keepalive 兜底；全程 try/catch 静默——绝不干扰页面任何功能。
   slati_cid 一次性生成（localStorage）；UA 嗅探只发粗粒度设备/浏览器/OS。
   ───────────────────────────────────────────── */
(function () {
  'use strict';
  try {
    if (window.__slatiPvSent) return;
    window.__slatiPvSent = true;
    var cid = null;
    try { cid = localStorage.getItem('slati_cid'); } catch (e) { cid = null; }
    if (!cid) {
      cid = 'pv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem('slati_cid', cid); } catch (e) {}
    }
    var ua = navigator.userAgent || '';
    var payload = {
      path: location.pathname,
      clientId: cid,
      referer: (document.referrer || '').slice(0, 512),
      language: (navigator.language || '').slice(0, 16),
      device: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop',
      browser: /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'other',
      os: /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'other'
    };
    var url = ((window.MN_SITE && MN_SITE.apiBase) || '/api') + '/analytics/pageview';
    var body = JSON.stringify(payload);
    var sent = false;
    if (navigator.sendBeacon) {
      try { sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' })); } catch (e) { sent = false; }
    }
    if (!sent && window.fetch) {
      try { fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {}); } catch (e) {}
    }
  } catch (e) {}
})();
