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

    const shot = await cmd('Page.captureScreenshot', process.env.SHOT_FMT === 'jpeg'
      ? { format: 'jpeg', quality: 85 } : { format: 'png' });
    writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('saved:', out, '| bytes:', shot.result.data.length * 3 / 4 | 0);

    // SHOT_DUMP=1：渲染后 DOM 冒烟（Read 工具不支持图片时的替代验证）
    if (process.env.SHOT_DUMP) {
      const expr = `(async function () {
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
        document.querySelector('.fin-curve-card[data-fin-key="rev"]').click();
        await new Promise(function(r){ setTimeout(r, 150); });
        base.finModalShown = document.getElementById('finChartModal').style.display !== 'none';
        base.finChartTitle = document.getElementById('finChartTitle').textContent;
        base.finRangeBtns = document.querySelectorAll('#finRangeBtns [data-fin-range]').length;
        base.finChartMeta = document.getElementById('finChartMeta').textContent.slice(0, 44);
        base.finChartVal = document.getElementById('finChartVal').textContent.slice(0, 30);
        base.finChartW = document.getElementById('finChart').clientWidth;
        // 大图像素断言同上
        var fc = document.getElementById('finChart');
        var bg = fc.getContext('2d').getImageData(0, 0, fc.width, Math.min(fc.height, 120)).data;
        var painted2 = 0;
        for (var pj = 3; pj < bg.length; pj += 4) if (bg[pj] > 0) painted2++;
        base.chartPainted = painted2 > 4;
        document.querySelector('#finRangeBtns [data-fin-range="5y"]').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.finChartMeta5y = document.getElementById('finChartMeta').textContent.slice(0, 30);
        document.querySelector('#finRangeBtns [data-fin-range="1y"]').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.finChartMeta1y = document.getElementById('finChartMeta').textContent.slice(0, 40);
        base.finChartVal1y = document.getElementById('finChartVal').textContent.slice(0, 30);
        document.getElementById('finChartClose').click();
        base.finModalClosed = document.getElementById('finChartModal').style.display === 'none';
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
