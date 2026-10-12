// tmp-probe-group-synth.js — 注入合成分组文章，验证阅读页组背景渲染
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
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-grps-' + Date.now());
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

  // 合成文章：两张卡同组（groupId G1），x/y 并排 + 12px 组内间距
  const SYNTH = {
    article: {
      id: 'ART-SYNTH', title: '分组渲染验证', status: 'published',
      authorName: 'Probe', createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z',
      summary: '分组渲染验证文章', viewCount: 1, likeCount: 0, favoriteCount: 0, likedByMe: false, favoritedByMe: false,
      contentJson: {
        v: 9, title: '分组渲染验证', tags: [], cards: [
          { id: 'c1', type: 'shield', label: '盾徽 A', col: 1, row: 1, colSpan: 6, rowSpan: 6, x: 0, y: 0, rotate: 0, borderRadius: 8, background: '#ffffff', borderStyle: 'solid', borderColor: '#4648d4', borderWidth: 2, groupId: 'G1' },
          { id: 'c2', type: 'shield', label: '盾徽 B', col: 8, row: 1, colSpan: 6, rowSpan: 6, x: 144, y: 0, rotate: 0, borderRadius: 8, background: '#ffffff', borderStyle: 'solid', borderColor: '#4648d4', borderWidth: 2, groupId: 'G1' },
          { id: 'c3', type: 'stats', label: '数据卡·柱状', col: 1, row: 8, colSpan: 8, rowSpan: 8, x: 0, y: 166, rotate: 0, borderRadius: 8, background: '#ffffff', borderStyle: 'solid', borderColor: '#4648d4', borderWidth: 2, statsRows: JSON.stringify([{ label: '人口', value: 1280000 }, { label: '面积', value: 9600 }, { label: 'GDP', value: 4200 }]), statsChart: 'column' },
          { id: 'c6', type: 'stats', label: '数据卡·占比', col: 10, row: 8, colSpan: 6, rowSpan: 8, x: 188, y: 166, rotate: 0, borderRadius: 8, background: '#ffffff', borderStyle: 'solid', borderColor: '#4648d4', borderWidth: 2, statsRows: JSON.stringify([{ label: '农业', value: 40, color: '#00aa55' }, { label: '工业', value: 35, color: '#ff8800' }, { label: '服务', value: 25 }]), statsChart: 'pie' },
          { id: 'c7', type: 'stats', label: '数据卡·趋势', col: 1, row: 17, colSpan: 10, rowSpan: 8, x: 0, y: 380, rotate: 0, borderRadius: 8, background: '#ffffff', borderStyle: 'solid', borderColor: '#4648d4', borderWidth: 2, statsRows: JSON.stringify([{ label: '2020', value: 100 }, { label: '2021', value: 160 }, { label: '2022', value: 140 }, { label: '2023', value: 220 }]), statsChart: 'line' },
          { id: 'c4', type: 'sheet', label: '表格卡', col: 12, row: 17, colSpan: 10, rowSpan: 8, x: 240, y: 380, rotate: 0, borderRadius: 8, background: '#ffffff', borderStyle: 'solid', borderColor: '#4648d4', borderWidth: 2, sheetData: JSON.stringify({ cols: 3, cells: [['项目', '数量', '备注'], ['军队', '1200', '常备'], ['城市', '4', ''], ['贸易', '88', '航线']] }) },
          { id: 'c5', type: 'content', label: '正文', col: 1, row: 26, colSpan: 12, rowSpan: 8, x: 0, y: 590, rotate: 0, borderRadius: 8, background: '#f2f4f6', borderStyle: 'solid', borderColor: '#767586', borderWidth: 1, content: '<p>正文内容测试</p>' }
        ],
        settings: { snapOn: true, alignOn: true }
      }
    }
  };

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
    // 页内 fetch 覆写：ART-SYNTH 请求直接回合成数据（比 Fetch 域拦截稳）
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{' +
        'window.__SYNTH=' + JSON.stringify(SYNTH) + ';' +
        'var __of=window.fetch;' +
        'window.fetch=function(u,o){' +
          'if(String(u).indexOf("ART-SYNTH")!==-1){' +
            'return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve(window.__SYNTH);},text:function(){return Promise.resolve(JSON.stringify(window.__SYNTH));},headers:{get:function(){return null;}}});' +
          '}' +
          'return __of.apply(this,arguments);' +
        '};' +
      '}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: 'https://mnationworld.com/pages/article.html?id=ART-SYNTH' });
    try {
      await waitFor(cdp, "!!document.querySelector('#artBody .art-canvas')", 30000, '合成文章加载');
    } catch (e) {
      console.log('页面状态:', await cdp.evalJs(`(function(){
        return {
          synthSet: !!window.__SYNTH,
          bodyText: ((document.body || {}).innerText || '').slice(0, 150),
          artBody: ((document.getElementById('artBody')||{}).innerText || '').slice(0, 120),
          canvas: !!document.querySelector('#artBody .art-canvas')
        };
      })()`).catch(function (e2) { return 'eval失败 ' + e2.message; }));
      console.log('runtime exceptions:', JSON.stringify(cdp.errs));
      throw e;
    }
    await sleep(800);

    console.log('分组渲染:', await cdp.evalJs(`(function(){
      var canvas = document.querySelector('#artBody .art-canvas');
      var bgs = canvas.querySelectorAll('.art-group-bg');
      var cards = canvas.querySelectorAll('.art-card');
      var grouped = canvas.querySelectorAll('.art-card-grouped');
      var b = bgs[0];
      var bRect = b ? (function(){ var r = b.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null;
      var g = grouped[0];
      var gStyle = g ? { borderW: getComputedStyle(g).borderTopWidth, bg: getComputedStyle(g).backgroundColor } : null;
      return { groupBgs: bgs.length, cards: cards.length, groupedCards: grouped.length, bgRect: bRect, groupedStyle: gStyle };
    })()`));
    console.log('数据卡/表格卡:', await cdp.evalJs(`(function(){
      var canvas = document.querySelector('#artBody .art-canvas');
      var statsCards = canvas.querySelectorAll('.art-card-stats');
      var sheet = canvas.querySelector('.art-card-sheet');
      var column = statsCards[0], pie = statsCards[1], line = statsCards[2];
      var colBox = column ? column.getBoundingClientRect() : null;
      var colBody = column ? column.querySelector('.art-stats-body').getBoundingClientRect() : null;
      var shBox = sheet ? sheet.getBoundingClientRect() : null;
      var shBody = sheet ? sheet.querySelector('.art-sheet-body').getBoundingClientRect() : null;
      return {
        statsCards: statsCards.length,
        columnBars: column ? column.querySelectorAll('.art-chart-colbar').length : 0,
        columnTicks: column ? column.querySelectorAll('.art-chart-tick').length : 0,
        columnLegend: column ? column.querySelectorAll('.art-chart-legend').length : 0,
        pieLegend: pie ? pie.querySelectorAll('.art-chart-legend').length : 0,
        pieSegs: pie ? (pie.querySelector('.art-chart-pie') || {}).style.background.indexOf('conic-gradient') !== -1 : false,
        pieCustomColor: pie ? (pie.querySelector('.art-chart-pie') || {}).style.background.indexOf('#00aa55') !== -1 : false,
        pieLegendCustom: pie ? ([].slice.call(pie.querySelectorAll('.art-chart-legend i')).some(function (el) { return el.style.background === 'rgb(0, 170, 85)'; })) : false,
        lineChart: line ? !!line.querySelector('.art-chart-lpath') : false,
        lineValues: line ? line.querySelectorAll('.art-chart-ptval').length : 0,
        lineLegend: line ? line.querySelectorAll('.art-chart-legend').length : 0,
        sheetCard: !!sheet,
        sheetTh: sheet ? sheet.querySelectorAll('.art-sheet-table th').length : 0,
        sheetTd: sheet ? sheet.querySelectorAll('.art-sheet-table td').length : 0,
        sheetHead: sheet ? (sheet.querySelector('.art-sheet-table th') || {}).textContent : '',
        colGapBelow: colBox && colBody ? Math.round(colBox.height - colBody.height) : -1,
        shGapBelow: shBox && shBody ? Math.round(shBox.height - shBody.height) : -1
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
