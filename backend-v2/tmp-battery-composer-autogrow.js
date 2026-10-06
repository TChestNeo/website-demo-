'use strict';
// tmp-battery-composer-autogrow.js — v0.2.14.0/14.1/15.0/15.1/15.2/15.3/15.4/15.5/15.6/15.7/15.8 Community 发帖输入栏自适长+边框主题+工具条电池（2026-09-05，tmp 绝不 commit）
// 强制 cloudMode 走真实 renderFeed 路径（composer 仅登录态渲染），断言：
//   版本 v0.2.15.8 / resize:none 不可手拽 / 基线 rows=3 只长不缩 / 短文字基线不变 /
//   多行长高 < 240 / 80 行封顶 =240 且 scrollHeight>clientHeight（滚轮内滑成立）/ 清空回缩基线 /
//   v0.2.15.3 去边框：常态/聚焦描边 0、聚焦蓝环 none（同页 .search-capsule 边框不动——对照）、底保留 /
//   v0.2.15.3 中文四句 → v0.2.15.8 用户「改成每隔30分钟切换一次文本」：撤销 15.7 纯 CSS 轮播（覆盖层已移除）、
//   原生 placeholder = 当前 30 分钟档句（墙钟 floor(Date.now()/30min)%4）、档位与真实墙钟一致、边界定时器已武装、
//   假 Date.now +31min/+61min 重渲染换下两档句（墙钟确定性零等待）、恢复真实时钟回当前档 /
//   v0.2.15.0 工具条：五 icon 按钮（data-tip=上传图片/GIF/投票/表情符号/创办活动，连字 image/gif/poll/sentiment_satisfied/event）、
//   纯图标名称不入行内文字、与 Post 同排（space-between 左工具右发布）、悬停气泡规则 content:attr(data-tip) 存在、
//   真实悬停（CDP mouseMoved）气泡内容出现+icon 转品牌蓝、点击如实「即将上线」toast /
//   v0.2.15.4 悬停放大浮出（已撤）：transform:scale(1.25) 禁用 hinting 致字形变细 /
//   v0.2.15.5 用户「放大icon就从粗体变成细的了」：改动画 font-size 24→30px（保粗壮）+上浮 margin-top -2px、
//   悬停规则 font-size 30px/margin-top -2px 存在、reduced-motion 媒体规则 font-size 24px 存在、
//   真悬停 font-size 30px+无 transform（不碰缩放保 hinting）、移开回 24px/0 /
//   v0.2.15.6 用户「icon 名称 5 秒后才显示+白底黑字」：气泡基础规则白底黑字（#fff/#000）+5s 延迟规则存在、
//   真悬停 300ms 未出现、5s+ 出现、移开回隐藏 /
//   v0.2.15.2 用户「post 按钮也放大一些」：Post 钮 38px 与工具钮等高+上缘对齐、字号 14px /
//   0 脚本异常。
// 用法：node tmp-battery-composer-autogrow.js [--base http://127.0.0.1:8000] [--chrome <chrome.exe>]
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const aB = process.argv.indexOf('--base');
const BASE = (aB !== -1 && process.argv[aB + 1]) || 'https://mnationworld.com';
const arg = process.argv.indexOf('--chrome');
const CHROME = (arg !== -1 && process.argv[arg + 1]) || findChrome();
function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('未找到 Chrome/Edge，请用 --chrome <路径> 指定');
}

function cdp(port) {
  const wsUrl = new Promise((resolve, reject) => {
    const tries = setInterval(() => {
      http.get(`http://127.0.0.1:${port}/json/list`, (r) => {
        let b = '';
        r.on('data', (d) => b += d);
        r.on('end', () => {
          try {
            const list = JSON.parse(b);
            const page = list.find((t) => t.type === 'page'); // 教训：list[0] 可能是扩展后台页
            if (page) { clearInterval(tries); resolve(page.webSocketDebuggerUrl); }
          } catch {}
        });
      }).on('error', () => {});
    }, 150);
    setTimeout(() => { clearInterval(tries); reject(new Error('CDP 超时')); }, 20000);
  });
  let seq = 0;
  const pending = new Map();
  const events = { consoleErrors: [], exceptions: [] };
  let ws;
  async function connect() {
    ws = new WebSocket(await wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WebSocket 连接失败')); });
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') events.consoleErrors.push(msg.params.entry);
      else if (msg.method === 'Runtime.exceptionThrown') events.exceptions.push(msg.params.exceptionDetails);
    };
    send('Log.enable'); send('Runtime.enable'); send('Page.enable');
    // 焦点仿真：headless 窗口无系统焦点时 document.hasFocus()=false，:focus 伪类不匹配
    //（:focus-within 按 activeElement 算不受影响——本地 12/15 三连挂的根因）；真实浏览器窗口有焦点不受影响
    send('Emulation.setFocusEmulationEnabled', { enabled: true });
  }
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evalJs(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) {
      const d = r.result.exceptionDetails;
      throw new Error('页面脚本异常: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.result.value;
  }
  async function waitFor(expression, timeoutMs = 10000, what = expression) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evalJs(expression)) return; } catch {}
      await new Promise((r) => setTimeout(r, 120));
    }
    throw new Error('等待超时: ' + what);
  }
  async function navigate(url) {
    const loaded = new Promise((resolve) => {
      const onMsg = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); resolve(); }
      };
      ws.addEventListener('message', onMsg);
    });
    await send('Page.navigate', { url });
    await loaded;
  }
  return { connect, send, evalJs, waitFor, navigate, events };
}

let passed = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures.push(name + (detail ? ' — ' + detail : '')); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function main() {
  console.log('composer 自适长电池：启动中… base=' + BASE);
  const cdpPort = 9400 + Math.floor(Math.random() * 300);
  const profile = path.join(os.tmpdir(), `composer-profile-${process.pid}`);
  const chrome = spawn(CHROME, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--disable-extensions',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: 'ignore' });
  const client = cdp(cdpPort);
  try {
    await client.connect();
    await client.navigate(BASE + '/pages/community-hub.html');
    await client.waitFor(`window.MN_SITE_VERSION !== undefined`, 15000, 'site-config 加载');
    const ver = await client.evalJs(`window.MN_SITE_VERSION`);
    ok('站点版本 = v0.2.15.8', ver === 'v0.2.15.8', '实得 ' + ver);
    // 强制 cloudMode 走真实 renderFeed 渲染路径（composer 仅登录态渲染，fresh profile 无会话）
    await client.evalJs(`window.cloudMode = true; window.cloudPosts = []; renderFeed(); true`);
    await client.waitFor(`document.getElementById('postComposer') !== null`, 5000, 'composer 渲染');
    // v0.2.14.2：发帖按钮文案 Publish → Post（i18n 机制断言：期望值=当前语言字典值）
    const btnR = await client.evalJs(`(function(){var b=(document.getElementById('postSubmit')||{});return {text:b.innerText,exp:(window.MN_I18N&&MN_I18N.t('hub.composer.post'))||'Post'};})()`);
    ok('发帖按钮文案 = 当前语言字典值（原 Post）', btnR.text === btnR.exp, '实得 ' + btnR.text);
    // v0.2.15.0 工具条：五 icon 按钮（左）与 Post（右）同排、纯图标显示、名称只在悬停气泡（data-tip → ::after）
    const rT = await client.evalJs(`(() => {
      const tools = document.querySelectorAll('.composer-tool');
      return {
        n: tools.length,
        tips: Array.prototype.map.call(tools, (x) => x.getAttribute('data-tip')),
        icons: Array.prototype.map.call(tools, (x) => (x.querySelector('.material-symbols-outlined') || {}).textContent),
        rowText: (document.querySelector('.composer-tools') || {}).textContent || ''
      };
    })()`);
    ok('工具按钮 = 5 个', rT.n === 5, '实得 ' + rT.n);
    ok('data-tip = 上传图片/GIF/投票/表情符号/创办活动', rT.tips.join(',') === '上传图片,GIF,投票,表情符号,创办活动', '实得 ' + rT.tips.join(','));
    ok('icon 连字 = image/gif/poll/sentiment_satisfied/event', rT.icons.join(',') === 'image,gif,poll,sentiment_satisfied,event', '实得 ' + rT.icons.join(','));
    ok('工具行纯图标（名称不入行内文字）', !/上传图片|GIF|投票|表情符号|创办活动/.test(rT.rowText), '实得 ' + rT.rowText);
    const rRow = await client.evalJs(`(() => {
      const t = document.querySelector('.composer-tool');
      const p = document.getElementById('postSubmit');
      const row = document.querySelector('.composer-actions');
      const tr = t.getBoundingClientRect(); const pr = p.getBoundingClientRect();
      return {
        // 同一行 = 两元素垂直中心对齐（v0.2.15.2 起两钮同 38px 高，上缘亦应对齐）
        sameRow: Math.abs((tr.top + tr.bottom) / 2 - (pr.top + pr.bottom) / 2) <= 1,
        topAlign: Math.abs(tr.top - pr.top) <= 1,
        toolsLeft: tr.right <= pr.left,
        justify: getComputedStyle(row).justifyContent
      };
    })()`);
    ok('工具与 Post 同一行（垂直中心对齐）', rRow.sameRow);
    ok('两钮上缘对齐（同 38px 高）', rRow.topAlign);
    ok('工具在左、Post 在右', rRow.toolsLeft);
    ok('composer-actions 用 space-between', rRow.justify === 'space-between', '实得 ' + rRow.justify);
    // v0.2.15.1 用户「这个icon能不能大一些」：钮 34→38（24px 图标标准触控尺寸）+ 图标 20→24px
    //（当时探针实测 Post 钮高 27px 非 38，等高断言不成立撤下；v0.2.15.2 Post 同步放大至 38 后由上方 topAlign 断言恢复覆盖）
    const rSize = await client.evalJs(`(() => {
      const t = document.querySelector('.composer-tool');
      const tr = t.getBoundingClientRect();
      const icon = t.querySelector('.material-symbols-outlined');
      return { w: tr.width, h: tr.height, iconFs: getComputedStyle(icon).fontSize };
    })()`);
    ok('工具钮 38×38（v0.2.15.1 放大）', rSize.w === 38 && rSize.h === 38, '实得 ' + rSize.w + '×' + rSize.h);
    ok('图标 24px（v0.2.15.1 放大）', rSize.iconFs === '24px', '实得 ' + rSize.iconFs);
    // v0.2.15.2 用户「post 按钮也放大一些」：Post 钮 12px/6px 纵向 → 14px/12px + line-height 1 = 38px 与工具钮等高
    //（v0.2.15.1 探针实测 Post 原高 27px；本轮放大后恢复等高+上缘对齐断言）
    const rPost = await client.evalJs(`(() => {
      const p = document.getElementById('postSubmit');
      const pr = p.getBoundingClientRect();
      return { w: pr.width, h: pr.height, fs: getComputedStyle(p).fontSize };
    })()`);
    ok('Post 钮高 = 38（与工具钮等高）', rPost.h === 38, '实得 ' + rPost.h);
    ok('Post 钮字号 = 14px', rPost.fs === '14px', '实得 ' + rPost.fs);
    const rRule = await client.evalJs(`(() => {
      let found = null;
      for (const ss of document.styleSheets) {
        let rules; try { rules = ss.cssRules; } catch (e) { continue; }
        const scan = (list) => { for (const r of list) {
          if (r.selectorText === '.composer-tool::after') found = r.style.getPropertyValue('content');
          if (r.cssRules) scan(r.cssRules);
        } };
        scan(rules);
      }
      return found;
    })()`);
    ok('悬停气泡规则存在（content:attr(data-tip)）', !!rRule && rRule.indexOf('attr(data-tip)') !== -1, '实得 ' + rRule);
    // 真实悬停：CDP 鼠标移到第一个工具中心 → :hover 生效 → ::after 气泡内容出现 + icon 转品牌蓝
    const rHov = await client.evalJs(`(() => {
      const t = document.querySelector('.composer-tool');
      t.scrollIntoView({ block: 'center' });
      t.style.transition = 'none';
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, colorBefore: getComputedStyle(t).color };
    })()`);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rHov.x, y: rHov.y });
    await new Promise((r) => setTimeout(r, 150));
    const rTip = await client.evalJs(`(() => {
      const t = document.querySelector('.composer-tool');
      return { tip: getComputedStyle(t, '::after').content, color: getComputedStyle(t).color };
    })()`);
    ok('真实悬停 → 气泡内容 = 上传图片', rTip.tip.indexOf('上传图片') !== -1, '实得 ' + rTip.tip);
    ok('悬停 icon 转品牌蓝', rTip.color !== rHov.colorBefore, rHov.colorBefore + ' → ' + rTip.color);
    // v0.2.15.4 初版 transform:scale(1.25) 用户实测「放大icon就从粗体变成细的了」——transform 缩放禁用像素网格对齐
    // （hinting）是变细根因；v0.2.15.5 改动画 font-size 24→30px（每帧重新排版+对齐保粗壮）+上浮 margin-top -2px
    // （不碰 transform）；规则扫描（媒体块内同选择器按 inMedia 归属）+ 真悬停读 computed + 移开回位
    const rAnimRule = await client.evalJs(`(() => {
      let found = { hoverFs: null, hoverMt: null, mediaFs: null };
      for (const ss of document.styleSheets) {
        let rules; try { rules = ss.cssRules; } catch (e) { continue; }
        const scan = (list, inMedia) => { for (const r of list) {
          const m = r.media && r.media.mediaText.indexOf('prefers-reduced-motion') !== -1;
          if (r.selectorText === '.composer-tool:hover .material-symbols-outlined') {
            if (!inMedia && !m) { found.hoverFs = r.style.getPropertyValue('font-size'); found.hoverMt = r.style.getPropertyValue('margin-top'); }
            else found.mediaFs = r.style.getPropertyValue('font-size');
          }
          if (r.cssRules) scan(r.cssRules, inMedia || m);
        } };
        scan(rules, false);
      }
      return found;
    })()`);
    ok('悬停放大规则存在（font-size 30px + margin-top -2px）', rAnimRule.hoverFs === '30px' && rAnimRule.hoverMt === '-2px', '实得 ' + rAnimRule.hoverFs + '/' + rAnimRule.hoverMt);
    ok('reduced-motion 媒体规则存在（font-size 24px 不放大）', rAnimRule.mediaFs === '24px', '实得 ' + rAnimRule.mediaFs);
    const rAnim = await client.evalJs(`(() => {
      const ic = document.querySelector('.composer-tool .material-symbols-outlined');
      ic.style.transition = 'none';
      const cs = getComputedStyle(ic);
      return { fs: cs.fontSize, mt: cs.marginTop, tf: cs.transform };
    })()`);
    ok('真悬停 → icon font-size 30px（重新排版保粗壮）', rAnim.fs === '30px', '实得 ' + rAnim.fs);
    ok('真悬停 → icon 无 transform（不碰缩放保 hinting）', rAnim.tf === 'none', '实得 ' + rAnim.tf);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
    await new Promise((r) => setTimeout(r, 120));
    const rAnimOut = await client.evalJs(`(() => {
      const ic = document.querySelector('.composer-tool .material-symbols-outlined');
      ic.style.transition = 'none';
      const cs = getComputedStyle(ic);
      return { fs: cs.fontSize, mt: cs.marginTop };
    })()`);
    ok('移开鼠标 → icon 回 24px/0', rAnimOut.fs === '24px' && rAnimOut.mt === '0px', '实得 ' + rAnimOut.fs + '/' + rAnimOut.mt);
    // v0.2.15.6 用户「icon 的名称能不能是鼠标停留5秒后才显示啊？还有配色能不能是白底黑字啊」：
    // 白底黑字规则 + 5s 延迟规则 → 真悬停 300ms 未出现 → 5s+ 出现 → 移开回隐藏
    const rTipRule = await client.evalJs(`(() => {
      let found = { bg: null, color: null, delay: null };
      for (const ss of document.styleSheets) {
        let rules; try { rules = ss.cssRules; } catch (e) { continue; }
        const scan = (list) => { for (const r of list) {
          if (r.selectorText === '.composer-tool::after') { found.bg = r.style.getPropertyValue('background-color'); found.color = r.style.getPropertyValue('color'); }
          if (r.selectorText === '.composer-tool:hover::after') found.delay = r.style.getPropertyValue('transition-delay');
          if (r.cssRules) scan(r.cssRules);
        } };
        scan(rules);
      }
      return found;
    })()`);
    ok('气泡白底黑字（#fff/#000）', rTipRule.bg === 'rgb(255, 255, 255)' && rTipRule.color === 'rgb(0, 0, 0)', '实得 ' + rTipRule.bg + '/' + rTipRule.color);
    ok('气泡 5s 延迟规则存在', !!rTipRule.delay && rTipRule.delay.indexOf('5s') !== -1, '实得 ' + rTipRule.delay);
    const rTipC = await client.evalJs(`(() => {
      const t = document.querySelector('.composer-tool');
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rTipC.x, y: rTipC.y });
    await new Promise((r) => setTimeout(r, 300));
    const rTipEarly = await client.evalJs(`getComputedStyle(document.querySelector('.composer-tool'), '::after').visibility`);
    ok('悬停 300ms 气泡仍未出现（5s 延迟生效）', rTipEarly === 'hidden', '实得 ' + rTipEarly);
    await new Promise((r) => setTimeout(r, 5300));
    const rTipLate = await client.evalJs(`(() => {
      const cs = getComputedStyle(document.querySelector('.composer-tool'), '::after');
      return { v: cs.visibility, o: parseFloat(cs.opacity) };
    })()`);
    ok('悬停 5s+ 气泡出现', rTipLate.v === 'visible' && rTipLate.o > 0.9, '实得 ' + rTipLate.v + '/' + rTipLate.o);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
    await new Promise((r) => setTimeout(r, 300));
    const rTipOut = await client.evalJs(`getComputedStyle(document.querySelector('.composer-tool'), '::after').visibility`);
    ok('移开后气泡隐藏', rTipOut === 'hidden', '实得 ' + rTipOut);
    // 点击工具 → 如实「即将上线」toast（未上线功能不装死）
    await client.evalJs(`document.querySelector('.composer-tool').click(); true`);
    await new Promise((r) => setTimeout(r, 150));
    const toastTxt = await client.evalJs(`(() => {
      const divs = document.body.querySelectorAll('div');
      let txt = '';
      for (const d of divs) if (d.textContent && d.textContent.indexOf('上传图片功能即将上线') !== -1) txt = d.textContent;
      return txt;
    })()`);
    ok('点击工具 → 「上传图片功能即将上线」toast', toastTxt.indexOf('上传图片功能即将上线') !== -1, '实得 ' + toastTxt);
    const r1 = await client.evalJs(`(() => {
      const el = document.getElementById('postComposer');
      return { resize: getComputedStyle(el).resize, overflowY: getComputedStyle(el).overflowY, h0: el.offsetHeight };
    })()`);
    ok('resize=none 不可手拽', r1.resize === 'none', '实得 ' + r1.resize);
    ok('overflow-y=auto（封顶后滚轮内滑）', r1.overflowY === 'auto', '实得 ' + r1.overflowY);
    ok('基线高度 rows=3 > 0', r1.h0 > 0, '实得 ' + r1.h0);
    // v0.2.15.3 用户「把输入框的边缘移除」：去描边去蓝环（v0.2.14.1 主题描边整体撤销）；
    // 同页 .search-capsule 边框不动（对照——只动 composer）；先 inline 关 transition（0.2s 过渡会让 computed 读到中间值）
    const rB = await client.evalJs(`(() => {
      const el = document.getElementById('postComposer');
      const cap = document.querySelector('.search-capsule');
      el.style.transition = 'none';
      const rest = {
        cW: getComputedStyle(el).borderTopWidth, cBg: getComputedStyle(el).backgroundColor,
        pW: getComputedStyle(cap).borderTopWidth
      };
      el.focus();
      const cF = {
        cW: getComputedStyle(el).borderTopWidth, sh: getComputedStyle(el).boxShadow,
        cBg: getComputedStyle(el).backgroundColor
      };
      el.blur();
      return { rest, cF };
    })()`);
    ok('常态描边移除（border-width = 0）', rB.rest.cW === '0px', '实得 ' + rB.rest.cW);
    ok('同页胶囊边框不动（对照）', rB.rest.pW !== '0px', '实得 ' + rB.rest.pW);
    ok('聚焦描边仍移除', rB.cF.cW === '0px', '实得 ' + rB.cF.cW);
    ok('聚焦蓝环移除（box-shadow = none）', rB.cF.sh === 'none', '实得 ' + rB.cF.sh);
    ok('常态底保留（--input-bg 非透明）', rB.rest.cBg !== 'rgba(0, 0, 0, 0)', '实得 ' + rB.rest.cBg);
    // v0.2.15.3 用户「输入框默认显示（四句中文）」→ v0.2.15.8 用户「算了你把他改成每隔30分钟切换一次文本」：
    // 撤销 v0.2.15.7 纯 CSS 轮播——改原生 placeholder + 30 分钟一档按墙钟取句（floor(Date.now()/30min)%4）。
    // 断言：覆盖层已移除、档位与真实墙钟一致、当前档句正确、边界定时器已武装（正点免刷新切换）、
    // 假 Date.now 偏移 +31min/+61min 重渲染换下两档句（墙钟确定性零等待）、恢复真实时钟回当前档。
    const tips = ['有什么好事？', '有什么新消息？', '同志有什么新消息要分享分享？', '贵国有什么新闻吗？'];
    const phNow = await client.evalJs(`(() => {
      window.cloudMode = true; window.cloudPosts = [];
      renderFeed();
      const b = document.getElementById('postComposer');
      const realNow = Date.now;
      const slot = Math.floor(realNow() / 1800000) % 4;
      return { ph: b.placeholder, rotator: !!document.querySelector('.ph-rotator'), timer: typeof phBoundaryTimer === 'number', slot: slot };
    })()`);
    ok('.ph-rotator 覆盖层已移除（v0.2.15.8 撤销）', phNow.rotator === false, '实得 ' + phNow.rotator);
    ok('档位与真实墙钟一致', phNow.slot === Math.floor(Date.now() / 1800000) % 4, '实得 ' + phNow.slot);
    ok('原生 placeholder = 当前 30 分钟档句', phNow.ph === tips[phNow.slot], '实得 ' + phNow.ph + '（期望 ' + tips[phNow.slot] + '）');
    ok('边界定时器已武装（正点免刷新切换）', phNow.timer === true, '实得 ' + phNow.timer);
    const phFake = await client.evalJs(`(() => {
      const realNow = Date.now;
      Date.now = function () { return realNow() + 31 * 60000; };
      renderFeed();
      const p1 = document.getElementById('postComposer').placeholder;
      Date.now = function () { return realNow() + 61 * 60000; };
      renderFeed();
      const p2 = document.getElementById('postComposer').placeholder;
      Date.now = realNow;
      return { p1: p1, p2: p2, slot: Math.floor(realNow() / 1800000) % 4 };
    })()`);
    ok('墙钟 +31min 重渲染 → 下一档句', phFake.p1 === tips[(phFake.slot + 1) % 4], '实得 ' + phFake.p1 + '（期望 ' + tips[(phFake.slot + 1) % 4] + '）');
    ok('墙钟 +61min 重渲染 → 再下一档句', phFake.p2 === tips[(phFake.slot + 2) % 4], '实得 ' + phFake.p2 + '（期望 ' + tips[(phFake.slot + 2) % 4] + '）');
    const phBack = await client.evalJs(`(() => { renderFeed(); return document.getElementById('postComposer').placeholder; })()`);
    ok('恢复真实时钟 → 回到当前档句', phBack === tips[phFake.slot], '实得 ' + phBack);
    // 短文字：只长不缩，基线不变
    const r2 = await client.evalJs(`(() => {
      const el = document.getElementById('postComposer');
      el.value = 'hi';
      el.dispatchEvent(new Event('input'));
      return { h: el.offsetHeight, h0: ${JSON.stringify(r1.h0)} };
    })()`);
    ok('短文字不缩（仍 = 基线 ' + r1.h0 + '）', r2.h === r2.h0, '实得 ' + r2.h);
    // 多行：变长但未封顶
    const r3 = await client.evalJs(`(() => {
      const el = document.getElementById('postComposer');
      el.value = Array(6).fill('line of text that is fairly long').join('\\n');
      el.dispatchEvent(new Event('input'));
      return { h: el.offsetHeight, h0: ${JSON.stringify(r1.h0)} };
    })()`);
    ok('6 行变长（> 基线 ' + r1.h0 + ' 且 < 240）', r3.h > r3.h0 && r3.h < 240, '实得 ' + r3.h);
    // 80 行：封顶 240，内容溢出（滚轮内滑成立）
    const r4 = await client.evalJs(`(() => {
      const el = document.getElementById('postComposer');
      el.value = Array(80).fill('a very long line of text to overflow the composer box').join('\\n');
      el.dispatchEvent(new Event('input'));
      return { h: el.offsetHeight, sh: el.scrollHeight, ch: el.clientHeight };
    })()`);
    ok('80 行封顶 = 240', r4.h === 240, '实得 ' + r4.h);
    ok('封顶时内容溢出（scrollHeight ' + r4.sh + ' > clientHeight ' + r4.ch + ' → 滚轮内滑）', r4.sh > r4.ch);
    // 清空：回缩基线
    const r5 = await client.evalJs(`(() => {
      const el = document.getElementById('postComposer');
      el.value = '';
      el.dispatchEvent(new Event('input'));
      return { h: el.offsetHeight, h0: ${JSON.stringify(r1.h0)} };
    })()`);
    ok('清空回缩基线 ' + r1.h0, r5.h === r5.h0, '实得 ' + r5.h);
    const excAll = client.events.exceptions.length;
    ok('全程 0 页面脚本异常', excAll === 0, excAll + ' 个 Runtime.exceptionThrown');
    console.log(`════ composer 自适长电池完成：${passed}/${passed + failures.length} 通过 ════`);
    if (failures.length) { console.log('失败：', failures.join(' | ')); process.exit(1); }
  } finally {
    try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch {}
  }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
