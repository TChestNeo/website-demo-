# Round 647 换机检查点（2026-10-06）— FC v10.28.53.0 边缘 Mask 化

> 此文件写给「下一个接管本轮的会话」（任何 harness）。按顺序执行【未完成清单】即可。
> 所有代码已写完并验证；当前停在仪式链的**电池→舰队**步骤之间。

## 一、当前状态

- **版本**：FC v10.28.53.0（小改动位 52→53 新功能轮）；站点恒 v0.2.58.28；rev 占位 00379-XXX→00380-???（changelog 内已是占位，未部署）。
- **线上**：仍是 FC v10.28.52.5 / rev 00378-rjd（上轮 646 已上线）。
- **用户三诉求**（本轮全部落地）：
  1. AI 生成的自定义边缘应用后画布看不见 → 已修（根因+修法见下）。
  2. 边缘像 Alight Motion Mask：图片只显示在边缘范围内、形状跟随边缘 + 边缘选择区「图片与边缘同步」勾选。
  3. 边缘要多出去一点（防图片/信息被边缘盖住或越界）。
- **git**：工作树含全部 docs 改动（不提交）；上轮 commit 0d6bb92（646）。绝不 push。

## 二、已完成的实现（勿重做）

### 根因与修法（docs/pages/fluidcanvas-editor.html）
- **根因**：自定义边缘无自动外板（setCardEdge 跳过 custom:）+ customEdgeRecipe 的 cardOverlay:[] → 剪影只活在 ::before（z -1），图片卡 .card-img-bg（z 0）/条纹卡 .card-stripes 整盒内容把剪影全盖住 → 应用自定义边缘=看不见。
- **修法三件**：
  1. **Mask 化**：CSS 4055-4062 `/* v10.28.53.0 — 边缘 Mask...` + `.grid-card .card-img-bg, .grid-card .card-stripes { clip-path: var(--card-mask-clip, none); }`——只剪内容层，卡根不剪（box-shadow/选中环/外板照常）。
  2. **勾选**：抽屉 HTML 18226-18230 `#fcEdgeMaskSec`（含 `#fcEdgeMaskSync` onchange=setEdgeMaskSync(this.checked)，label data-i18n="fc.edge.maskSync"）；JS 13596-13628 `setEdgeMaskSync`（写了旗→applyCardBg→**renderEdgeMaskSec() 同步 UI**（新补）→onContentChange）+ `renderEdgeMaskSec`（edge 有值且非 none 才显示；border 种隐藏；checked=旗 '1' 或缺省且 custom:）。
  3. **外扩**：14445-14464 `CUSTOM_EDGE_EXPAND = 0.06` + `expandClipPct(clip, f)`（% 坐标 `50+(v-50)*(1+f)`、裸值 `v*(1+f)`、2 位小数；非 polygon 防御回退原形；window 暴露）。customEdgeRecipe 14572-14589 现返回 `clip: expandClipPct(e.clip, 0.06)`（装饰剪影多出去一圈）+ `clipRaw: e.clip`（Mask 裁剪窗=原形）。
- **applyCardBg** 14934-14952 Mask 门：`maskOn = 旗==='1' || (旗缺省 && edge.custom && cardLayers.length>0)` → setProperty('--card-mask-clip', edge.clipRaw || edge.clip)；else removeProperty；无边缘分支 14980 removeProperty。
- **setCardEdge** 15475-15506：none 分支 `delete dataset.edgeMask`；custom 分支 edge 种写 `'1'`、border 种删除；内置不动旗（保留用户既有勾选）。三个成功出口都补了 `refreshEdgeDrawer()`（抽屉开着时同步勾选态）。
- **草稿往返**：buildDraft 7199 只收显式 '1'/'0'；applyDraft 7004 恢复；hasNewCardBg 6997 条件加了 `cData.edgeMask`。
- **i18n**：docs/assets/i18n/fluidcanvas.i18n.js 新键 `fc.edge.maskSync` ×12 语（11 手写块 + zh-Hant OpenCC 已重生成，勿手改）。
- **site-config**：2064 changelog 头 `// v10.28.53.0 = AI 边缘 Mask 化+图片与边缘同步勾选+边缘外扩多出去一点（小改动位 52→53 新功能轮；`（内文含用户原话+修法+rev 00379-XXX/00380-??? 占位）；2449 `window.FLUIDCANVAS_VERSION = 'v10.28.53.0';`。
- **后端零改动**（npm test 恒 413/413）。
- 编辑器 7 个 script 块语法已验证 `bad: 0`。

## 三、电池状态

- **新电池 backend-v2/tmp-battery-fc-edgemask.js 已写完并 18/18 全绿**（S1 编辑器 14 锚/S2 site-config/S3 i18n ×12；B0-B9 CDP：edge 种默认 '1'+maskVar 原形+clip 外扩+expandClipPct 数学三式 / 图片卡 imgClip=原形+卡根不剪 / 勾选节三态 / 内置 tech4 旗不动+勾后 url(#hud-frame-4) / border 种无 Mask / 无→清 / 草稿 '1'/'0' 往返 / 组模式无操作 / AI 生成→保存→点击选中→画布出现端到端；E 零异常）。**首跑 6 红已全销账**：S1 两锚行计数口径（12→10、4→3）、B0 样本未渲染（15→0）、B2 摘 box-shadow、B3c/B4b 勾选 UI 不同步（产品侧补 renderEdgeMaskSec() 调用）、B7 卡片数 ≥6→≥5。
- 复跑命令：`cd backend-v2; node tmp-battery-fc-edgemask.js`

## 四、未完成清单（按序执行）

### 1. sed 扫 52.5→53.0（只扫 tmp-battery-*.js）
- 改前实测：`grep -c "v10.28.52.5" backend-v2/tmp-battery-*.js`（应 63 件各 ≥1；edgemask 新件=0）。
- 执行：`sed -i 's/v10\.28\.52\.5/v10.28.53.0/g' backend-v2/tmp-battery-*.js`
- 改后零残留复核：`grep -c "v10.28.52.5" backend-v2/tmp-battery-*.js` → 全部 0。

### 2. 手改 5 件（sed 会改坏的锚）
**a) tmp-battery-fc-togglefly-r.js**（行号=sed 前）：
- 132 行 52.4 零残留 → `'v10.28.52.5'`；
- 134 行 changelog 头链 → `sc('// v10.28.53.0 = ') === 1 && sc('// v10.28.52.5 = ') === 1 && sc('// v10.28.52.4 = ') === 1`（sed 已把第一项变 53.0，手改后两项）；
- 135 行 rev → `sc('rev 00379-') === 1 && sc('rev 00380-') === 1`；
- 145-146 行编辑器 CSS 注释头（sed 会变出错误的 53.0 标题）→ `el('v10.28.53.0 — 边缘 Mask（用户：边缘像 Alight Motion 的 Mask 一样') === 1 && el('v10.28.52.5: 折叠出画加深+画外停一拍+展开加 Q弹') === 1`；
- 178 行 head52/head51 → head53=上面 53.0 标题、head52='v10.28.52.5: 折叠出画加深+画外停一拍+展开加 Q弹'。
**b) tmp-battery-fc-togglefly.js**：125-132/139-140/172 行同款改法。
**c) tmp-battery-fc-whitenav.js**：106 行 52.4 零残留→'v10.28.52.5'；107 行头链→53.0/52.5/52.4；108 行 rev 00371-zvn/00372-svk **保持不动**（真实终态历史）。
**d) tmp-battery-fc-paneltoggle.js**：102 行版本 sed 自动 53.0；106 行详情串顺手改；49.1 零残留保持。
**e) tmp-battery-fc-edgeai.js**（--card-clip 现为外扩多边形，5 处断言必改）：
- 87-88 行后加常量：`const EXP_EDGE = 'polygon(-3% -3%, 103% 0.18%, 100.88% 99.82%, 0.18% 103%, -3% -3%)';` 和 `const EXP_RING = 'polygon(evenodd, -3% -3%, 103% -3%, 103% 103%, -3% 103%, -3% -3%, 5.48% 5.48%, 94.52% 5.48%, 94.52% 94.52%, 5.48% 94.52%, 5.48% 5.48%)';`
- 516 行 B7 `card.clip === RING` → EXP_RING；529 行 B8 `card.clip === EDGE_CLIP` → EXP_EDGE；565 行 B10b `card.clip === RING` → EXP_RING；607 行 B12 `gb.clip === RING` → EXP_RING；636 行 B13 `card.clip === EDGE_CLIP` → EXP_EDGE。
- **保持原形的**：466（B5 预览）、502（B6 预览）、557（B10a 草稿 clip）、665/667（B14 mini/POST 体）、818-819（C1 文章页——文章页不用外扩，零改动）。

### 3. 舰队 647（64 项）
- 克隆 tmp-fleet-646.sh → tmp-fleet-647.sh，FLEET 追加 `tmp-battery-fc-edgemask`，输出名 646→647。
- Git Bash 跑：`cd backend-v2; bash tmp-fleet-647.sh`。
- 复核：`grep -E "exit=1|💥" tmp-batt-647-fleet-runner.txt` → 零命中；红项独立复跑销账（修复后整舰队复跑全绿）。

### 4. 冒烟 + i18n + 测试（后端零改动，恒全绿）
- 冒烟 60/60：`node scripts/smoke-admin.js`（backend-v2 下）。
- i18n 34/34 + fc-i18n 20/20（脚本名先 `ls backend-v2/scripts/` 核对，沿用 646 轮命令）。
- `npm test` → 413/413。

### 5. 构建+验证+推送（×2 先验后推）
- **deploy 前先重读 backend-v2/deploy/cloudrun.md + `gcloud run revisions list`**。
- docker build PowerShell 仓库根无 -f（照 646 命令），构建两次。
- 克隆 tmp-verify-646.js → tmp-verify-647.js：版本/rev 锚更新 + 新 53.0 锚（expandClipPct/mask 等，锚先 grep -cF 实测再写死）。
- 每次构建各验一次再推：verify#1 MODE 1（占位 00379-XXX/00380-???）→ push#1；改终态 rev 后再构建 → verify#2 MODE 2（00379-<真> 在 + 00379-XXX 零残留 + 00380-??? 占位）→ push#2。0 mismatch。
- **docker tag+push 每轮成对**（两推 digest 必须各异=真镜像非遗留 tag）。

### 6. 部署 ×2（tmp-deploy-647.ps1 克隆 646）
- env 34 零重复、无新 env；GEMINI_MODEL 恒强制 gemini-3.8-flash；SNAPSHOT_INTERVAL_MS 恒强制 86400000；gcloud 用 `(Get-Command gcloud.cmd).Source`；login -p 直接。
- deploy#1 瞬态（00379-XXX）→ `gcloud run revisions list` 取真 rev → 工作树 site-config 填真 rev → 重新构建+推 → deploy#2 终态（00380-???）→ 再取真 rev 填工作树。**live 滞后一部署=惯例**。

### 7. 线上探针 tmp-probe-fc-edgemask-647.js
- 照 tmp-probe-fc-togglefly-r-646.js 模板（先读它；P 页内采样表达式照电池原版抄不手写、裸 Promise 不套额外 ()）。
- S 静态：site-config 53.0 赋值 ×1+52.5 零残留+58.28+changelog 头 53.0+rev 00379-<真> ×1+00379-XXX 零残留+00380-<真> 零残留（滞后一部署）；
- P1 CDP live：编辑器开（seed localStorage 会话/用户/库）→ 应用自定义 edge → edgeMask='1' + --card-mask-clip 原形 + --card-clip 外扩 + .card-img-bg clipPath + 勾选节三态（注意 52.5 新坑：computed animationName 断言改 contains 绝不 === 'none'——本探针若用动画断言照此）；
- E1 零异常。目标 12/12 量级。

### 8. 记忆仪式 + commit
- backend-build-state.md 头旋转（线上 rev 00380-<真>、FC v10.28.53.0、站点恒 58.28）；site-versioning-scheme.md 追加+当前指针；MEMORY.md 新顶行；新记忆文件 2026-10-06-fc-v1028530-edgemask.md（含本轮新坑：自定义边缘 --card-clip 已变外扩——旧电池断言原形必改 EXP_*；勾选节程序化改态需 renderEdgeMaskSec 同步）。
- **commit = tmp-battery-*.js only（docs 不提交）**；commit 前密钥扫描：`git grep -n -E "sk-8486|DEEPSEEK_API_KEY|SMTP_PASS|whsec_|sk_live_|sk_test_|GEMINI_API_KEY|AQ.Ab8"` 按暂存族扫描零命中；**绝不 push**。
- 最终中文用户报告（耐心、多鼓励、不教育；用户 16 岁爱用 kaomoji）。

## 五、恒守约束（每轮同）

绝不 push；舰队运行期间绝不 taskkill chrome；transitions.js 切页动画是用户钦定设计「那个你不能动」；ethereal.css 改动后必须重跑 inline-css.js（编辑器页豁免，本轮零触碰→CSS_MARK 恒 41）；探针/电池页内采样表达式照既有原版抄不手写；sed 只扫 tmp-battery-*.js+改前 grep 实测+改后零残留复核；锚先 grep -cF 实测再写死；changelog 避写全 'v0.2.58.26'；docker tag+push 每轮必成对；live 滞后一部署；52.5 新坑=computed animationName 断言改 contains 绝不 === 'none'；用户「那一整个」复合 UI 不摘子功能。

## 六、版本/rev 追踪

- 上轮：FC v10.28.52.5 / rev 00377-628→00378-rjd / commit 0d6bb92（未 push）。
- 本轮：FC v10.28.53.0 / rev 00379-XXX→00380-???（占位待部署填真）。
- 站点：恒 v0.2.58.28。
