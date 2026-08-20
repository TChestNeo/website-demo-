'use strict';
// 无头截图（P9/P10 冒烟复用）：CDP 种会话 cookie → 打开页面 → 截图 + 收集页面 console 错误。
// 用法：node scripts/screenshot.js <url> <out.png> [mn_session_token]
// 依赖：Chrome/Edge 已安装（默认 Chrome 路径，可用 CHROME_PATH 覆盖）；Node 24 原生 WebSocket。

const { spawn } = require('node:child_process');
const { writeFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9223;
const url = process.argv[2];
const out = process.argv[3];
const token = process.argv[4] || '';
if (!url || !out) { console.error('用法: node scripts/screenshot.js <url> <out.png> [token]'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const profile = mkdtempSync(path.join(tmpdir(), 'mn-shot-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile, '--no-first-run', '--disable-gpu',
    '--window-size=1440,1800', '--hide-scrollbars', 'about:blank'
  ], { stdio: 'ignore' });

  try {
    // 等 CDP 就绪
    let target = null;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' });
        if (r.ok) { target = await r.json(); break; }
      } catch (e) {}
      await sleep(300);
    }
    if (!target) throw new Error('CDP 未就绪');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0;
    const pending = new Map();
    const consoleLines = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        const args = (msg.params.args || []).map((a) => a.value != null ? a.value : (a.description || '')).join(' ');
        consoleLines.push(args.slice(0, 300));
      }
    };
    function cmd(method, params) {
      return new Promise((res) => { pending.set(++seq, res); ws.send(JSON.stringify({ id: seq, method, params: params || {} })); });
    }

    await cmd('Page.enable');
    await cmd('Runtime.enable');
    await cmd('Network.enable');
    if (token) {
      await cmd('Network.setCookie', { name: 'mn_session', value: token, domain: '127.0.0.1', path: '/', httpOnly: true });
    }
    const loaded = new Promise((res) => { const h = ws.onmessage; ws.onmessage = (ev) => { h(ev); const m = JSON.parse(ev.data); if (m.method === 'Page.loadEventFired') res(); }; });
    await cmd('Page.navigate', { url });
    await loaded;
    await sleep(2500); // 等 /auth/me + stats/usage XHR 与 sidebar 重渲染
    // SHOT_SEED_LOCAL=1：种入本地 demo 登录态后重载（premium 本地回退态冒烟）
    if (process.env.SHOT_SEED_LOCAL) {
      await cmd('Runtime.evaluate', { expression: `localStorage.setItem('slati_session', JSON.stringify({loggedIn:true, at:new Date().toISOString()})); localStorage.setItem('slati_user', JSON.stringify({email:'demo@local.test', displayName:'LocalDemo', citizenId:'CIT-9999', tier:'free'})); 'seeded'` });
      const loaded2 = new Promise((res) => { const h = ws.onmessage; ws.onmessage = (ev) => { h(ev); const m = JSON.parse(ev.data); if (m.method === 'Page.loadEventFired') res(); }; });
      await cmd('Page.navigate', { url });
      await loaded2;
      await sleep(2500);
    }

    const shot = await cmd('Page.captureScreenshot', process.env.SHOT_FMT === 'jpeg'
      ? { format: 'jpeg', quality: 85 } : { format: 'png' });
    writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('saved:', out, '| bytes:', shot.result.data.length * 3 / 4 | 0);

    // SHOT_DUMP=1：渲染后 DOM 冒烟（Read 工具不支持图片时的替代验证）
    if (process.env.SHOT_DUMP) {
      const expr = `(async function () {
        // ── premium 页（最终支付态）：等级感知 + 在线支付，无申请回退/无预览模式 ──
        if (location.pathname.indexOf('/premium.html') > -1) {
          var b = {
            title: document.title,
            priceKey: (window.SlatiPrice || {}).key,
            premiumPrice: document.getElementById('premiumPrice').textContent,
            pkgPrice: document.getElementById('pkgPremiumPrice').textContent,
            planCards: document.querySelectorAll('[data-plan-card]').length,
            addonCtas: document.querySelectorAll('[data-addon-cta]').length,
            // 功能矩阵（等级模型：普通用户 free / Basic / Premium / Ultra 四档 5 列）
            matrixCols: document.querySelectorAll('table thead th').length,
            matrixHead2: ((document.querySelector('table thead th:nth-child(2)') || {}).textContent || '').slice(0, 10),
            matrixRows: document.querySelectorAll('table tbody tr').length,
            matrixRow1Cells: (function () { var t = document.querySelector('table tbody tr'); return t ? t.querySelectorAll('td').length : 0; })()
          };
          for (var i = 0; i < 30 && !(window.__mnSubState && window.__mnSubState.ready); i++) {
            await new Promise(function (r) { setTimeout(r, 100); });
          }
          b.tier = (window.__mnSubState || {}).tier || null;
          b.source = (window.__mnSubState || {}).source || null;
          b.pay = (window.__mnSubState || {}).pay || null; // 最终态：'stripe'（服务端会话）/'local'（本地资料）/'guest'
          b.enabled = !!(window.__mnSubState || {}).enabled;
          b.payDisabled = !!(window.__mnSubState || {}).payDisabled; // server 会话 + Stripe 未配置 → banner 说明「即将上线」，按钮仍为最终态
          b.hasPortal = !!(window.__mnSubState || {}).hasPortal;
          b.expiry = (window.__mnSubState || {}).expiry || null;
          b.payNoticeShown = getComputedStyle(document.getElementById('payNotice')).display !== 'none';
          b.payNoticeText = document.getElementById('payNotice').textContent.replace(/\\s+/g, ' ').trim().slice(0, 60);
          b.bannerShown = document.getElementById('subStatus').style.display !== 'none';
          b.bannerText = document.getElementById('subStatus').textContent.replace(/\\s+/g, ' ').trim().slice(0, 70);
          b.ctas = {};
          document.querySelectorAll('[data-plan-cta]').forEach(function (x) {
            b.ctas[x.dataset.planCta] = { t: x.textContent.replace(/\\s+/g, ' ').trim(), d: x.disabled };
          });
          b.once = (window.__mnSubState || {}).once || '';
          b.onceKeys = (window.__mnSubState || {}).onceKeys || '';
          b.onceCtas = {};
          document.querySelectorAll('[data-plan-once]').forEach(function (x) {
            b.onceCtas[x.dataset.planOnce] = { t: x.textContent.replace(/\\s+/g, ' ').trim(), v: x.style.display !== 'none' };
          });
          b.onceHint = ((document.querySelector('[data-once-hint]') || {}).textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
          // 目视兜底（电池全绿 ≠ 渲染正确）：单次按钮真实渲染几何——在卡内、在主 CTA 下方、非零尺寸
          var og = document.querySelector('[data-plan-once="premium"]');
          var ogc = document.querySelector('[data-plan-cta="premium"]');
          if (og && ogc && b.pay === 'stripe') {
            var r1 = og.getBoundingClientRect();
            var r2 = ogc.getBoundingClientRect();
            var r3 = og.closest('[data-plan-card]').getBoundingClientRect();
            b.onceGeo = {
              w: r1.width, h: r1.height,
              insideCard: r1.top >= r3.top && r1.bottom <= r3.bottom + 1,
              belowCta: r1.top >= r2.bottom - 1,
              fullWidth: Math.abs(r1.width - r2.width) < 2
            };
          }
          b.chips = Array.prototype.filter.call(document.querySelectorAll('.cur-chip'), function (c) { return c.offsetParent !== null; }).length;
          b.addonCtaText = ((document.querySelector('[data-addon-cta]') || {}).textContent || '').trim();
          var pc = document.querySelector('[data-plan-cta="premium"]');
          // 点击冒烟：仅当通道未配置（本机 dev，checkout 必 409）时点 CTA——验证「按钮保持最终态 + 如实 toast」；
          // 已配置密钥环境点 CTA 会真实倒数跳 Stripe，冒烟不点（payDisabled=false）
          if (pc && !pc.disabled && !pc.dataset.guestLink && b.payDisabled) {
            pc.click();
            await new Promise(function (r) { setTimeout(r, 600); });
            b.toastShown = !!document.querySelector('[data-mn-toast]');
            b.toastText = ((document.querySelector('[data-mn-toast]') || {}).textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 50);
            b.ctaAfter = pc.textContent.replace(/\\s+/g, ' ').trim();
          } else {
            b.clickSkipped = pc ? (pc.dataset.guestLink ? 'guest' : (pc.disabled ? 'disabled' : 'pay-enabled-no-click')) : 'no-cta';
          }
          return JSON.stringify(b);
        }
        var base = {
          title: document.title,
          gate: document.getElementById('adminGate') && document.getElementById('adminGate').style.display,
          root: document.getElementById('adminRoot') && document.getElementById('adminRoot').style.display,
          login: document.getElementById('adminLogin') && document.getElementById('adminLogin').style.display,
          adminLinkGone: !document.querySelector('#slati-sidebar a[href*="admin.html"]'),
          stats: ['dUsers','dPosts','dMod','dTickets','dCost','dBudget'].map(function(id){ return document.getElementById(id).textContent; }),
          dashQueue: document.getElementById('dashQueue').textContent.replace(/\\s+/g,' ').slice(0, 60),
          dashBudget: document.getElementById('dashBudget').textContent.replace(/\\s+/g,' ').slice(0, 60),
          feedCount: document.querySelectorAll('#dashFeed .feed-item').length,
          modCards: document.querySelectorAll('#modList .adm-card').length,
          modFirstPreview: (document.querySelector('#modList .adm-card .preview') || {}).textContent || null,
          banner: document.getElementById('admBanner').style.display === 'none' ? null : document.getElementById('admBanner').textContent.slice(0, 80),
          tabs: Array.prototype.map.call(document.querySelectorAll('#admTabs [data-tab]'), function(b){ return b.textContent.replace(/\\s+/g,'').trim(); }),
          sidebarModules: document.querySelectorAll('.adm-side > .sidebar-module').length,
          navItems: document.querySelectorAll('.adm-side .nav-item').length,
          admShadow: getComputedStyle(document.querySelector('.adm-card')).boxShadow.slice(0, 46),
          admCardBg: getComputedStyle(document.querySelector('.adm-card')).backgroundImage.slice(0, 30),
          admBorder: getComputedStyle(document.querySelector('.adm-card')).borderTopColor,
          statCardH: Math.round(document.querySelector('.stat-card').getBoundingClientRect().height),
          admShellW: Math.round(document.querySelector('.adm-shell').getBoundingClientRect().width),
          admVW: window.innerWidth,
          statCardH2: Math.round(document.querySelectorAll('.stat-card')[11].getBoundingClientRect().height)
        };
        // 切到工单 tab（懒加载）→ 三行卡片（标签状态/标题/详情）→ 点击进专属回复页 → 返回
        document.querySelector('#admTabs [data-tab="ticket"]').click();
        await new Promise(function(r){ setTimeout(r, 1200); });
        base.ticketCards = document.querySelectorAll('#ticketList [data-tk-open]').length;
        var ipFilter = document.querySelector('[data-tk-filter="in_progress"]');
        base.tkRepliedFilter = ipFilter ? ipFilter.textContent.trim() : null;
        base.ticketDetailHidden = document.getElementById('ticketDetail').style.display === 'none';
        var firstCard = document.querySelector('#ticketList [data-tk-open]');
        if (firstCard) { firstCard.click(); await new Promise(function(r){ setTimeout(r, 400); }); }
        base.ticketDetailShown = document.getElementById('ticketDetail').style.display !== 'none';
        base.ticketDetailTitle = ((document.querySelector('#ticketDetailBody .tk-title') || {}).textContent || '').slice(0, 60);
        base.tkInputHeight = Math.round(document.getElementById('tkInput').getBoundingClientRect().height);
        base.ticketHash = location.hash.slice(0, 24);
        // 回复模板弹窗：点「模板」→ 左菜单 6 内置 → 选中 → 右侧预览 → 十语下拉切换/回退提示 → + 添加（十语表单）→ 保存 → 法语预览 → 使用填入回复框
        document.getElementById('tkTplBtn').click();
        await new Promise(function(r){ setTimeout(r, 150); });
        base.tkTplModalShown = document.getElementById('tkTplModal').style.display !== 'none';
        base.tkTplUseGap = Math.round(document.getElementById('tkTplUseBtn').getBoundingClientRect().top -
          document.getElementById('tkTplPreviewText').getBoundingClientRect().bottom);
        base.tkTplMenuCount = document.querySelectorAll('#tkTplMenu [data-tpl-id]').length;
        base.tkTplLangOpts = document.querySelectorAll('#tkTplLangSel option').length;
        base.tkTplLangDefault = document.getElementById('tkTplLangSel').value;
        document.querySelector('#tkTplMenu [data-tpl-id="ack"]').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplPreview = document.getElementById('tkTplPreviewText').textContent.slice(0, 24);
        var langSel = document.getElementById('tkTplLangSel');
        langSel.value = 'en';
        langSel.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplPreviewEn = document.getElementById('tkTplPreviewText').textContent.slice(0, 24);
        langSel.value = 'fr'; // 内置模板无法语 → 回退提示
        langSel.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplFallback = document.getElementById('tkTplPreviewText').textContent.indexOf('回退') > -1;
        document.getElementById('tkTplAddBtn').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplAddShown = document.getElementById('tkTplAddModal').style.display !== 'none';
        base.tkTplAddWidth = Math.round(document.getElementById('tkTplAddName').getBoundingClientRect().width);
        base.tkTplAddLangs = document.querySelectorAll('[data-tpl-add-lang]').length;
        document.getElementById('tkTplAddName').value = 'E2E 测试模板';
        document.querySelector('[data-tpl-add-lang="zh"]').value = '这是测试模板的中文内容。';
        document.querySelector('[data-tpl-add-lang="en"]').value = 'This is the English content of the test template.';
        document.querySelector('[data-tpl-add-lang="ms"]').value = 'Ini ialah kandungan Melayu bagi templat ujian.';
        document.querySelector('[data-tpl-add-lang="fr"]').value = 'Ceci est le contenu français du modèle de test.';
        document.getElementById('tkTplAddSave').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplMenuAfterAdd = document.querySelectorAll('#tkTplMenu [data-tpl-id]').length;
        base.tkTplPreviewNew = document.getElementById('tkTplPreviewText').textContent.slice(0, 24); // 语言重置回工单 locale=zh
        langSel.value = 'fr';
        langSel.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplPreviewFr = document.getElementById('tkTplPreviewText').textContent.slice(0, 24);
        document.getElementById('tkTplUseBtn').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplModalClosed = document.getElementById('tkTplModal').style.display === 'none';
        base.tkTplInserted = document.getElementById('tkInput').value.slice(0, 24);
        // 发送回复 → 状态选择弹窗（等待下一步/已完成）→ 取消不发（不污染活库 fixture）
        document.getElementById('tkSendBtn').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkReplyModalShown = document.getElementById('tkReplyModal').style.display !== 'none';
        base.tkReplyOptWait = document.getElementById('tkReplyWait').textContent.replace(/\\s+/g, '').slice(0, 5);
        base.tkReplyOptDone = document.getElementById('tkReplyDone').textContent.replace(/\\s+/g, '').slice(0, 3);
        document.getElementById('tkReplyCancel').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkReplyModalClosed = document.getElementById('tkReplyModal').style.display === 'none';
        base.tkReplyKept = document.getElementById('tkInput').value.slice(0, 24);
        document.getElementById('tkBackBtn').click(); await new Promise(function(r){ setTimeout(r, 100); });
        base.ticketBackToList = document.getElementById('ticketDetail').style.display === 'none';
        // 财务总览 pane：健康横幅/核心数字/成本结构/季度预期/参数表单/时间线
        document.querySelector('#admTabs [data-tab="sub"]').click();
        await new Promise(function(r){ setTimeout(r, 200); });
        base.subPaneShown = document.getElementById('pane-sub').style.display !== 'none';
        base.subTotal = document.getElementById('dSubTotal').textContent;
        base.subPremium = document.getElementById('dSubPremium').textContent;
        base.subUltra = document.getElementById('dSubUltra').textContent;
        base.subBasic = document.getElementById('dSubBasic').textContent;
        base.subRevenue = document.getElementById('dSubRevenue').textContent;
        base.subPaid = document.getElementById('dSubPaid').textContent;
        base.finHealth = document.getElementById('dFinHealth').textContent;
        base.finQuarterBadge = document.getElementById('dFinQuarter').textContent.replace(/\\s+/g, ' ').slice(0, 30);
        base.finProfit = document.getElementById('dFinProfit').textContent;
        base.finCoverage = document.getElementById('dFinCoverage').textContent;
        base.finCostRows = document.querySelectorAll('#dFinCosts > div').length;
        base.finFormFields = document.querySelectorAll('#finForm input').length;
        base.finQuarterCard = document.getElementById('dFinQuarterCard').textContent.replace(/\\s+/g, ' ').slice(0, 40);
        base.subTimeline = document.getElementById('dSubTimeline').textContent.replace(/\\s+/g, ' ').slice(0, 80);
        // 收入曲线：5 卡迷你曲线 → 点击弹详情（标题/5 时间范围/图表/meta）→ 切 5y → 关闭
        base.sparkCount = document.querySelectorAll('canvas.fin-spark').length;
        // 迷你曲线像素断言：canvas 内需有非透明像素（防止「画了但空白」）
        var spk = document.querySelector('canvas.fin-spark').getContext('2d').getImageData(0, 0, 76, 30).data;
        var painted = 0;
        for (var pi = 3; pi < spk.length; pi += 4) if (spk[pi] > 0) painted++;
        base.sparkPainted = painted > 4;
        // 曲线贴右几何断言：迷你曲线右缘在卡内、距卡右缘 ≈ 内边距；卡宽 ≥ 260
        var fr = document.querySelector('.fin-curve-card').getBoundingClientRect();
        var sr = document.querySelector('canvas.fin-spark').getBoundingClientRect();
        base.finCardW = Math.round(fr.width);
        base.finSparkGap = Math.round(fr.right - sr.right);
        // 标题在卡顶断言：首子元素为 .stat-label（而非数字/曲线）
        base.finLabelTop = fr && document.querySelector('.fin-curve-card').firstElementChild.className + '/' +
          document.querySelector('.fin-curve-card').firstElementChild.textContent.slice(0, 6);
        document.querySelector('.fin-curve-card[data-fin-key="rev"]').click();
        await new Promise(function(r){ setTimeout(r, 150); });
        base.finModalShown = document.getElementById('finChartModal').style.display !== 'none';
        base.finChartTitle = document.getElementById('finChartTitle').textContent;
        base.finRangeBtnsGone = !document.getElementById('finRangeBtns');
        base.finRangeSel = document.getElementById('finRangeSel').value;
        base.finRangeOpts = document.querySelectorAll('#finRangeSel option').length;
        base.finChartMeta = document.getElementById('finChartMeta').textContent.slice(0, 44);
        base.finChartVal = document.getElementById('finChartVal').textContent.slice(0, 30);
        base.finChartW = document.getElementById('finChart').clientWidth;
        // 大图像素断言同上
        var fc = document.getElementById('finChart');
        var bg = fc.getContext('2d').getImageData(0, 0, fc.width, Math.min(fc.height, 120)).data;
        var painted2 = 0;
        for (var pj = 3; pj < bg.length; pj += 4) if (bg[pj] > 0) painted2++;
        base.chartPainted = painted2 > 4;
        // 顶部下拉切 5y → 详情图 + 迷你曲线同步重画（迷你曲线像素复检）
        var sel2 = document.getElementById('finRangeSel');
        sel2.value = '5y';
        sel2.dispatchEvent(new Event('change', { bubbles: true }));
        base.sparkAnimOn5y = !!document.querySelector('canvas.fin-spark')._finTween; // 过渡动画已排程（同步断言）
        base.chartAnimOn5y = !!document.getElementById('finChart')._finTween;
        await new Promise(function(r){ setTimeout(r, 500); }); // 350ms 过渡播完再取像素，防抓到中间帧
        base.finChartMeta5y = document.getElementById('finChartMeta').textContent.slice(0, 30);
        var spk2 = document.querySelector('canvas.fin-spark').getContext('2d').getImageData(0, 0, 76, 30).data;
        var painted3 = 0;
        for (var pk = 3; pk < spk2.length; pk += 4) if (spk2[pk] > 0) painted3++;
        base.sparkPainted5y = painted3 > 4;
        sel2.value = '1y';
        sel2.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(function(r){ setTimeout(r, 100); });
        base.finChartMeta1y = document.getElementById('finChartMeta').textContent.slice(0, 40);
        base.finChartVal1y = document.getElementById('finChartVal').textContent.slice(0, 30);
        document.getElementById('finChartClose').click();
        base.finModalClosed = document.getElementById('finChartModal').style.display === 'none';
        // 成本看板并入财务：顶部子菜单切成本 → 用量条/记录表/预算表单 → 切回总览
        base.finTabBtns = document.querySelectorAll('#finTabs .fin-tab-btn').length;
        base.finTabActive = document.querySelector('#finTabs .fin-tab-btn.active').dataset.finTab;
        // 几何：子菜单在健康横幅上方；激活 tab 背景与未激活不同（样式生效探针）
        base.finTabsAbove = document.getElementById('finTabs').getBoundingClientRect().bottom <=
          document.getElementById('finHealth').getBoundingClientRect().top + 1;
        var tabAct = getComputedStyle(document.querySelector('#finTabs .fin-tab-btn.active')).backgroundColor;
        var tabInact = getComputedStyle(document.querySelector('#finTabs .fin-tab-btn:not(.active)')).backgroundColor;
        base.finTabStyleDiff = tabAct !== tabInact;
        document.querySelector('#finTabs .fin-tab-btn[data-fin-tab="cost"]').click();
        await new Promise(function(r){ setTimeout(r, 200); });
        base.finCostSecShown = document.getElementById('fin-cost-sec').style.display !== 'none';
        base.finOverviewHidden = document.getElementById('fin-overview-sec').style.display === 'none';
        base.finCostTabActive = document.querySelector('#finTabs .fin-tab-btn.active').dataset.finTab;
        base.usageBarRows = document.querySelectorAll('#usageBars > div').length;
        base.usageRowCount = document.querySelectorAll('#usageRows tr').length;
        base.budgetFields = document.querySelectorAll('#budgetForm input').length;
        document.querySelector('#finTabs .fin-tab-btn[data-fin-tab="overview"]').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.finOverviewBack = document.getElementById('fin-overview-sec').style.display !== 'none';
        // 流水子视图：切流水 → 懒加载 → 新增一笔收款 → 行出现 + 实际收款卡更新 → 删除 → 行消失（净零不污染实账）
        document.querySelector('#finTabs .fin-tab-btn[data-fin-tab="ledger"]').click();
        await new Promise(function(r){ setTimeout(r, 400); });
        base.ledSecShown = document.getElementById('fin-ledger-sec').style.display !== 'none';
        base.ledTabActive = document.querySelector('#finTabs .fin-tab-btn.active').dataset.finTab;
        base.ledFormFields = document.querySelectorAll('#ledForm input, #ledForm select').length;
        base.ledLockedInitial = document.getElementById('ledLockedLabel').textContent;
        // 提现类型 + 自动带出「其他」分类（选回收款继续走收款流程）
        base.ledKindOpts = document.querySelectorAll('#ledKind option').length;
        document.getElementById('ledKind').value = 'withdrawal';
        document.getElementById('ledKind').dispatchEvent(new Event('change', { bubbles: true }));
        base.ledCatAfterWithdrawal = document.getElementById('ledCat').value;
        document.getElementById('ledKind').value = 'income';
        document.getElementById('ledCat').value = 'subscription';
        document.getElementById('ledAmount').value = '66.66';
        document.getElementById('ledCurrency').value = 'RM';
        document.getElementById('ledDate').value = new Date().toISOString().slice(0, 10);
        document.getElementById('ledCounter').value = 'smoke@test';
        document.getElementById('ledInvoice').value = 'SMK-1';
        document.getElementById('ledNote').value = '冒烟流水';
        document.getElementById('ledSaveBtn').click();
        await new Promise(function(r){ setTimeout(r, 700); });
        base.ledRowAdded = document.getElementById('ledRows').textContent.indexOf('SMK-1') > -1;
        base.ledRowKind = document.getElementById('ledRows').textContent.indexOf('收款') > -1;
        base.dSubPaidAfter = document.getElementById('dSubPaid').textContent;
        var ledCsv = await fetch('/api/admin/ledger/export', { credentials: 'include' }).then(function(r){ return r.text(); });
        base.ledCsvHeader = ledCsv.indexOf('流水号,日期,类型') > -1;
        base.ledCsvHasRow = ledCsv.indexOf('SMK-1') > -1;
        window.confirm = function () { return true; };
        document.querySelector('#ledRows [data-led-del]').click();
        await new Promise(function(r){ setTimeout(r, 700); });
        base.ledRowRemoved = document.getElementById('ledRows').textContent.indexOf('SMK-1') === -1;
        // 财务参数保存（同值）→ 时间线出现「参数」审计条目（finance_set 审计渲染链路）
        document.getElementById('finSaveBtn').click();
        await new Promise(function(r){ setTimeout(r, 700); });
        base.paramTimeline = document.getElementById('dSubTimeline').textContent.indexOf('调整财务参数') > -1;
        // 财报子视图：切财报 → 选默认本季 → 一键生成 → 报表卡出现 + 分月明细 + CSV 链接 → 导出 CSV 分节断言
        document.querySelector('#finTabs .fin-tab-btn[data-fin-tab="report"]').click();
        await new Promise(function(r){ setTimeout(r, 200); });
        base.rptSecShown = document.getElementById('fin-report-sec').style.display !== 'none';
        base.rptTabActive = document.querySelector('#finTabs .fin-tab-btn.active').dataset.finTab;
        base.rptYearOpts = document.querySelectorAll('#rptYear option').length;
        base.rptQuarterVal = document.getElementById('rptQuarter').value;
        base.rptYearVal = document.getElementById('rptYear').value;
        document.getElementById('rptGenBtn').click();
        await new Promise(function(r){ setTimeout(r, 900); });
        base.rptCardShown = document.getElementById('finReportCard').style.display !== 'none';
        base.rptCardText = document.getElementById('finReportCard').textContent.slice(0, 120);
        base.rptHasTitle = document.getElementById('finReportCard').textContent.indexOf('季度财报') > -1;
        base.rptHasMonthly = document.getElementById('finReportCard').textContent.indexOf('分月明细') > -1;
        base.rptHasNet = document.getElementById('finReportCard').textContent.indexOf('净利润') > -1;
        base.rptHasWithdrawn = document.getElementById('finReportCard').textContent.indexOf('提现转出') > -1;
        base.rptHasRetained = document.getElementById('finReportCard').textContent.indexOf('留存资金') > -1;
        base.rptHasWarn = document.getElementById('finReportCard').textContent.indexOf('草稿') > -1; // 未月结 → 草稿警示
        base.rptMonthsRows = document.querySelectorAll('#finReportCard tbody tr').length;
        base.rptCsvShown = document.getElementById('rptCsvLink').style.display !== 'none';
        base.rptCsvHref = document.getElementById('rptCsvLink').getAttribute('href') || '';
        base.rptPrintShown = document.getElementById('rptPrintBtn').style.display !== 'none';
        var rptCsv = await fetch('/api/admin/finance/report/export?year=' + document.getElementById('rptYear').value + '&quarter=' + document.getElementById('rptQuarter').value, { credentials: 'include' }).then(function(r){ return r.text(); });
        base.rptCsvTitle = rptCsv.indexOf('M.NationWorld 季度财报') > -1;
        base.rptCsvCat = rptCsv.indexOf('支出分类汇总') > -1;
        base.rptCsvWithdrawn = rptCsv.indexOf('提现转出(RM)') > -1;
        // 停在财报子视图（生成后的报表，供 SHOT_AFTER 二次截图目视新页）
        document.querySelector('#finTabs .fin-tab-btn[data-fin-tab="report"]').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        // 暗色主题阴影断言（临时切 data-theme 再还原；先关 transition 防过渡中间值）
        var ac = document.querySelector('.adm-card');
        ac.style.transition = 'none';
        document.documentElement.setAttribute('data-theme', 'dark');
        base.admShadowDark = getComputedStyle(ac).boxShadow.slice(0, 40);
        base.admBorderDark = getComputedStyle(ac).borderTopColor;
        document.documentElement.removeAttribute('data-theme');
        ac.style.transition = '';
        return JSON.stringify(base);
      })()`;
      const ev = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      console.log('DOM dump:', ev.result && ev.result.result && ev.result.result.value);
    }
    if (process.env.SHOT_AFTER) {
      const shot2 = await cmd('Page.captureScreenshot', process.env.SHOT_FMT === 'jpeg'
        ? { format: 'jpeg', quality: 85 } : { format: 'png' });
      const out2 = out.replace(/\.(png|jpe?g)$/i, '-after.$1');
      writeFileSync(out2, Buffer.from(shot2.result.data, 'base64'));
      console.log('saved:', out2, '| bytes:', shot2.result.data.length * 3 / 4 | 0);
    }
    if (consoleLines.length) {
      console.log('page console errors (' + consoleLines.length + '):');
      consoleLines.forEach((l) => console.log('  ' + l));
    } else {
      console.log('page console errors: none');
    }
    ws.close();
  } finally {
    chrome.kill();
  }
})().catch((e) => { console.error('screenshot FAIL:', e.message); process.exit(1); });
