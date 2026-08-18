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
          navItems: document.querySelectorAll('.adm-side .nav-item').length
        };
        // 切到工单 tab（懒加载）→ 三行卡片（标签状态/标题/详情）→ 点击进专属回复页 → 返回
        document.querySelector('#admTabs [data-tab="ticket"]').click();
        await new Promise(function(r){ setTimeout(r, 1200); });
        base.ticketCards = document.querySelectorAll('#ticketList [data-tk-open]').length;
        base.ticketDetailHidden = document.getElementById('ticketDetail').style.display === 'none';
        var firstCard = document.querySelector('#ticketList [data-tk-open]');
        if (firstCard) { firstCard.click(); await new Promise(function(r){ setTimeout(r, 400); }); }
        base.ticketDetailShown = document.getElementById('ticketDetail').style.display !== 'none';
        base.ticketDetailTitle = ((document.querySelector('#ticketDetailBody .tk-title') || {}).textContent || '').slice(0, 60);
        base.ticketHash = location.hash.slice(0, 24);
        // 回复模板弹窗：点「模板」→ 左菜单 6 内置 → 选中 → 右侧预览 → 切语言 → + 添加 → 表单保存 → 使用填入回复框
        document.getElementById('tkTplBtn').click();
        await new Promise(function(r){ setTimeout(r, 150); });
        base.tkTplModalShown = document.getElementById('tkTplModal').style.display !== 'none';
        base.tkTplMenuCount = document.querySelectorAll('#tkTplMenu [data-tpl-id]').length;
        base.tkTplLangDefault = document.querySelector('#tkTplLangs .lang-chip.active').textContent;
        document.querySelector('#tkTplMenu [data-tpl-id="ack"]').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplPreview = document.getElementById('tkTplPreviewText').textContent.slice(0, 24);
        document.querySelector('#tkTplLangs [data-tpl-lang="en"]').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplPreviewEn = document.getElementById('tkTplPreviewText').textContent.slice(0, 24);
        document.getElementById('tkTplAddBtn').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplAddShown = document.getElementById('tkTplAddModal').style.display !== 'none';
        base.tkTplAddWidth = Math.round(document.getElementById('tkTplAddName').getBoundingClientRect().width);
        document.getElementById('tkTplAddName').value = 'E2E 测试模板';
        document.getElementById('tkTplAddZh').value = '这是测试模板的中文内容。';
        document.getElementById('tkTplAddEn').value = 'This is the English content of the test template.';
        document.getElementById('tkTplAddMs').value = 'Ini ialah kandungan Melayu bagi templat ujian.';
        document.getElementById('tkTplAddSave').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplMenuAfterAdd = document.querySelectorAll('#tkTplMenu [data-tpl-id]').length;
        base.tkTplPreviewNew = document.getElementById('tkTplPreviewText').textContent.slice(0, 24);
        document.getElementById('tkTplUseBtn').click();
        await new Promise(function(r){ setTimeout(r, 100); });
        base.tkTplModalClosed = document.getElementById('tkTplModal').style.display === 'none';
        base.tkTplInserted = document.getElementById('tkInput').value.slice(0, 24);
        document.getElementById('tkBackBtn').click(); await new Promise(function(r){ setTimeout(r, 100); });
        base.ticketBackToList = document.getElementById('ticketDetail').style.display === 'none';
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
