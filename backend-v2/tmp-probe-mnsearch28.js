// tmp-probe-mnsearch28.js — 验证搜索页重构（v0.2.59.28）
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

(async () => {
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-search28-' + Date.now());
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });

  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/micronationary?showTab=explore' });
    await waitFor(cdp, "!!document.querySelector('.mn-search-bar') && typeof toggleSmartSearch === 'function'", 30000, '搜索页加载');
    await sleep(2500);

    console.log('结构:', await cdp.evalJs(`(function(){
      return {
        searchBar: !!document.querySelector('.mn-search-bar'),
        smartBtn: !!document.getElementById('mnSmartBtn'),
        glassRows: document.querySelectorAll('#mnSuggestGrid .mn-glass-row').length,
        suggestCards: document.querySelectorAll('#mnSuggestGrid .dy-card').length,
        listMode: document.getElementById('mnSuggestGrid').classList.contains('mn-as-list'),
        monoChip: !!(document.querySelector('#mnSuggestGrid .mn-mono')),
        browseTiles: document.querySelectorAll('.mn-browse-tile').length,
        chipRows: [].slice.call(document.querySelectorAll('#mnChipsBlock .mn-chip-row')).filter(function(r){ return r.style.display !== 'none'; }).length,
        totalChips: document.querySelectorAll('#mnChipsBlock .mn-chip').length,
        hint: (document.getElementById('mnModeHint')||{}).textContent
      };
    })()`));

    // 输入关键词 → 搜索态
    await cdp.evalJs(`(function(){
      var i = document.getElementById('exSearchInput');
      i.focus(); i.value = '斯拉';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(2500);
    console.log('关键词搜索态:', await cdp.evalJs(`(function(){
      return {
        searching: document.body.classList.contains('mn-searching'),
        articleResults: (document.getElementById('exArticleResults')||{}).style ? document.getElementById('exArticleResults').style.display : '?',
        nationResults: (document.getElementById('mnSearchNationWrap')||{}).style ? document.getElementById('mnSearchNationWrap').style.display : '?',
        sortVisible: (document.getElementById('mnSortWrap')||{}).style ? document.getElementById('mnSortWrap').style.display : '?',
        resultCards: document.querySelectorAll('#exArticleResults .dy-card').length,
        resultRows: document.querySelectorAll('#exArticleResults .mn-glass-row').length,
        nationCards: document.querySelectorAll('#mnSearchNationGrid .dy-card').length,
        nationRows: document.querySelectorAll('#mnSearchNationGrid .mn-glass-row').length,
        profileHidden: !document.querySelector('.dy-profile') // v0.2.59.28.3 主页区已移除 → 恒 true
      };
    })()`));

    // 智能搜索开关
    await cdp.evalJs('toggleSmartSearch()');
    await sleep(300);
    console.log('智能开关:', await cdp.evalJs(`(function(){
      return {
        on: !!window.mnSmartOn,
        placeholder: document.getElementById('exSearchInput').placeholder,
        hint: (document.getElementById('mnModeHint')||{}).textContent,
        switchOn: document.getElementById('mnSmartBtn').classList.contains('on')
      };
    })()`));
    await cdp.evalJs('toggleSmartSearch()'); // 关回去

    // 清除 → 回浏览态
    await cdp.evalJs('clearExSearch()');
    await sleep(500);
    console.log('清除后:', await cdp.evalJs(`(function(){
      return {
        searching: document.body.classList.contains('mn-searching'),
        suggestVisible: getComputedStyle(document.getElementById('mnSuggestBlock')).display !== 'none',
        browseVisible: getComputedStyle(document.getElementById('mnBrowseBlock')).display !== 'none'
      };
    })()`));

    console.log('runtime exceptions:', JSON.stringify(cdp.errs));
  } catch (e) {
    console.log('PROBE ERROR:', e.message);
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().then(() => { console.log('DONE'); process.exit(0); }).catch(e => { console.log('FATAL', e.message); process.exit(1); });
