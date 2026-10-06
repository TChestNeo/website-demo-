// tmp-battery-fc-tags.js — FC v10.28.46.0 图库标签+头像/地图图库桥+AI 混合查重电池
// 用户「那么之前已经上传了的你能不能补上？」+ 标签系统（标配国旗/国徽/地图+AI 查重+跨语言搜索+筛选多选+双语并排）
// 验证：S 静态锚（site-config 46.0/00298-/58.0 恒、标签 store/两处弹窗/筛选/桥锚在源、i18n 键 12 块、
//         openFlagBrowser(); 无参调用恒 2）＋ T 行为段（桌面 CDP）：
//   T1 惰性播种 3 sys 标签落盘｜T2 meta 弹窗选标签→保存→条目 tags｜T3 跨语言搜索（Flag/国旗/Bandeira 同一 tile）
//   T4 本地查重建 'Flag'→建议「已有相似标签：国旗」→合并=勾选既有不新建｜T5 自建双语「皇室 · Royal」+远端降级直建
//   T6 远端 404 静默零 error｜T7 筛选 OR 并集越选越多+搜索 AND 收窄｜T8 管理面板用量/改名/删除→全库剥离+confirm 文案
//   T9 sys 行锁无删改钮｜T10 桥-头像（右键→从图库选择→双击→charAvatar+fi 保留+草稿零心跳）｜T11 桥-地图
//   T12 图库内上传随 slot｜T13 切 en sys chip 'Flag'/自建仍双语＋E 全程零异常零 console error
// （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fctags-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); });
      return;
    }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; this.dialogs = []; }
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
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.dialogs.push((m.params && m.params.message) || '');
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
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
    // ── S 静态锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text();
    const i18nTxt = await (await fetch(BASE + '/assets/i18n/fluidcanvas.i18n.js')).text();
    ok('S1 site-config：FC v10.28.48.0 + rev 00348- 占位 + 站点恒 v0.2.58.28 + 旧 47.3 版本锚零残留',
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.62.2';") !== -1 &&
      siteCfg.indexOf('00348-') !== -1 && siteCfg.indexOf('v0.2.58.28') !== -1 &&
      siteCfg.indexOf('v10.28.46.0 = 图库标签系统') !== -1 &&
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.3';") === -1);
    ok('S2 标签 store 锚在源：IMG_TAG_KEY/SYS_TAG_IDS/惰性播种/窗口导出（tagLoad/tagCreate/tagDelete/localTagDedup/tagDisplayName）',
      editorHtml.indexOf("var IMG_TAG_KEY = 'slati_img_tags';") !== -1 &&
      editorHtml.indexOf("var SYS_TAG_IDS = ['sys-flag', 'sys-emblem', 'sys-map'];") !== -1 &&
      editorHtml.indexOf('window.tagLoad = tagLoad; window.tagSave = tagSave; window.tagCreate = tagCreate; window.tagDelete = tagDelete;') !== -1 &&
      editorHtml.indexOf('window.localTagDedup = localTagDedup; window.tagDisplayName = tagDisplayName;') !== -1);
    ok('S3 meta 弹窗钉：immTagChips/immNewTagBtn/immTagCreate/imgMetaSave meta 含 tags/imgLibPut 含 tags/IMG_META_PENDING 锚仍在',
      editorHtml.indexOf('id="immTagChips"') !== -1 &&
      editorHtml.indexOf('id="immNewTagBtn"') !== -1 &&
      editorHtml.indexOf('id="immTagCreate"') !== -1 &&
      editorHtml.indexOf('tags: IMG_META_TAGS.slice() // v10.28.46.0') !== -1 &&
      editorHtml.indexOf('tags: (meta && meta.tags) || (i >= 0 ? (list[i].tags || []) : [])') !== -1 &&
      editorHtml.indexOf('IMG_META_PENDING = { apply: applyFn, close: o.close || \'self\', src: previewDataURL }; // v10.28.32: src 供 imgMetaSave 入库') !== -1);
    ok('S4 图库钉：flagFilterBtn/flagTagManageBtn/tagManageModal/flagSlotHint/FILTER_TAG_IDS/renderTagFilterMenu',
      editorHtml.indexOf('id="flagFilterBtn"') !== -1 &&
      editorHtml.indexOf('id="flagTagManageBtn"') !== -1 &&
      editorHtml.indexOf('id="tagManageModal"') !== -1 &&
      editorHtml.indexOf('id="flagSlotHint"') !== -1 &&
      editorHtml.indexOf('var FILTER_TAG_IDS = []') !== -1 &&
      editorHtml.indexOf('window.renderTagFilterMenu = renderTagFilterMenu;') !== -1);
    const noArgCalls = editorHtml.split('openFlagBrowser();').length - 1;
    ok('S5 桥钉：avatar/map 菜单项+openLibForSlot 带参+apply 导出+无参 openFlagBrowser(); 恒 2（F4 红线）',
      editorHtml.indexOf('id="avatarLibMenuItem"') !== -1 &&
      editorHtml.indexOf('id="mapLibMenuItem"') !== -1 &&
      editorHtml.indexOf("onclick=\"openLibForSlot('avatar')\"") !== -1 &&
      editorHtml.indexOf("onclick=\"openLibForSlot('map')\"") !== -1 &&
      editorHtml.indexOf('function openLibForSlot(slot)') !== -1 &&
      editorHtml.indexOf('window.applyLibAvatar = applyLibAvatar;') !== -1 &&
      editorHtml.indexOf('window.applyLibMap = applyLibMap;') !== -1 &&
      noArgCalls === 2,
      'noArg=' + noArgCalls);
    const nKeyFlag = i18nTxt.split('"fc.tag.name.flag"').length - 1;
    const nDescFlag = i18nTxt.split('"fc.tag.desc.flag"').length - 1;
    ok('S6 i18n 钉：fc.tag.name.flag/fc.tag.desc.flag 各 12 块 + zh 值逐字 + zh-Hant OpenCC 值在位',
      nKeyFlag === 12 && nDescFlag === 12 &&
      i18nTxt.indexOf('"fc.tag.pickLabel": "标签"') !== -1 &&
      i18nTxt.indexOf('"fc.tag.name.flag": "国旗"') !== -1 &&
      i18nTxt.indexOf('"fc.ctx.avatarFromLib": "从图库选择头像"') !== -1 &&
      i18nTxt.indexOf('"fc.tag.name.flag": "國旗"') !== -1 &&
      i18nTxt.indexOf('"fc.lib.slotAvatarHint": "正在為頭像卡選圖——所選圖片將補到該頭像上"') !== -1,
      'name.flag×' + nKeyFlag + ' desc.flag×' + nDescFlag);

    // ── 桌面段 ──
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
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!window.MN_I18N && !!document.getElementById('gridCanvas') && !!window.imgMetaSave && !!window.tagLoad && !!window.openLibForSlot", 30000, '编辑器加载');
    await sleep(800);

    // 页内工具：toast / 草稿 / 图库 / 标签 store / 任意目标文件输入合成上传 / 网格 tile src 清单
    await cdp.evalJs("window.__toast = function () { var t = document.getElementById('toast'); return t ? t.textContent : ''; };");
    await cdp.evalJs(`(function(){
      window.__draft = function () { try { return JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || 'null'); } catch (e) { return null; } };
      window.__lib = function () { try { return JSON.parse(localStorage.getItem('slati_img_library') || '[]'); } catch (e) { return []; } };
      window.__tags = function () { return window.tagLoad(); };
      window.__mkImgTo = function (name, colorA, colorB, sel) {
        var cv = document.createElement('canvas'); cv.width = 8; cv.height = 6;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = colorA; ctx.fillRect(0, 0, 8, 6);
        ctx.fillStyle = colorB; ctx.fillRect(0, 0, 4, 6);
        var url = cv.toDataURL('image/png');
        var bin = atob(url.split(',')[1]);
        var u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        var dt = new DataTransfer();
        dt.items.add(new File([u8], name, { type: 'image/png' }));
        var fi = document.querySelector(sel);
        fi.files = dt.files;
        fi.dispatchEvent(new Event('change', { bubbles: true }));
        return url;
      };
      window.__gridSrcs = function () {
        return Array.prototype.slice.call(document.querySelectorAll('#flagGrid .flag-card-item img.flag-thumb')).map(function (i) { return i.getAttribute('src'); });
      };
    })()`);

    const metaOpen = "!!document.getElementById('imgMetaModal') && !!document.querySelector('#imgMetaModal .modal-card.active')";
    const metaClosed = "!document.querySelector('#imgMetaModal .modal-card.active')";
    // 一次性 profile 内清场：标签 store 与图库从零开始（草稿零污染由 pagehide 兜底）
    await cdp.evalJs("localStorage.removeItem('slati_img_tags'); localStorage.removeItem('slati_img_library');");

    const srcM = 'data:image/png;base64,MTIz';   // '123' —— T2 meta 弹窗保存入条目
    const srcA = 'data:image/png;base64,QUFB';   // 'AAA' —— flag 标签（T3/T7/T10 桥-头像）
    const srcB = 'data:image/png;base64,QUJC';   // 'BBB' —— map 标签（T3/T7/T11 桥-地图）
    const srcC = 'data:image/png;base64,ODkw';   // '890' —— flag+map 双标签（T7 AND 收窄）
    const srcM2 = 'data:image/png;base64,NTY3';  // '567' —— 自建标签（T5/T8）

    // ── T1 惰性播种 ──
    const t1r = await cdp.evalJs("(function(){ var t = window.__tags(); var raw = []; try { raw = JSON.parse(localStorage.getItem('slati_img_tags') || '[]'); } catch (e) {} return { n: t.length, sys: t.filter(function(x){ return x.sys; }).length, ids: t.map(function(x){ return x.id; }).join(','), stored: raw.length }; })()");
    ok('T1 惰性播种：3 枚系统标签落盘（sys-flag/sys-emblem/sys-map 全 sys）',
      t1r.n === 3 && t1r.sys === 3 && t1r.ids === 'sys-flag,sys-emblem,sys-map' && t1r.stored === 3, JSON.stringify(t1r));

    // ── T2 meta 弹窗选标签 → 保存 → 条目 tags ──
    await cdp.evalJs(`window.openImgMetaModal('${srcM}', 'T2图', function(){ return true; });`);
    await waitFor(cdp, metaOpen, 5000, 'T2 meta 打开');
    const t2a = await cdp.evalJs("(function(){ var c = document.querySelectorAll('#immTagChips .imm-tag-chip'); c[0].click(); var c2 = document.querySelectorAll('#immTagChips .imm-tag-chip')[0]; return { sel: c2.className.indexOf('selected') !== -1, chips: c.length, noI18n: document.querySelectorAll('#immTagChips [data-i18n]').length }; })()");
    await cdp.evalJs("window.imgMetaSave()");
    await waitFor(cdp, metaClosed, 4000, 'T2 meta 关闭');
    const t2b = await cdp.evalJs(`(function(){ var e = window.__lib().filter(function(x){ return x.src === '${srcM}'; })[0]; return { has: !!e, tags: e ? JSON.stringify(e.tags) : null, name: e ? e.name : null }; })()`);
    ok('T2 meta 弹窗选标签（chip 勾选 selected）→ 保存 → 图库条目 tags==["sys-flag"]',
      t2a.sel === true && t2a.chips === 3 && t2a.noI18n === 0 && t2b.has === true && t2b.tags === '["sys-flag"]' && t2b.name === 'T2图', JSON.stringify({ a: t2a, b: t2b }));

    // ── T3 跨语言搜索 ──
    await cdp.evalJs(`window.imgLibPut('${srcA}', {name:'A图', tags:['sys-flag']}); window.imgLibPut('${srcB}', {name:'B图', tags:['sys-map']}); window.openFlagBrowser();`);
    const t3r = await cdp.evalJs(`(function(){
      var out = {};
      ['Flag','国旗','Bandeira'].forEach(function(q){
        document.getElementById('flagSearchInput').value = q;
        window.filterFlags();
        var s = window.__gridSrcs();
        out[q] = { hitA: s.indexOf('${srcA}') !== -1, hitM: s.indexOf('${srcM}') !== -1, hitB: s.indexOf('${srcB}') !== -1 };
      });
      return out;
    })()`);
    ok('T3 跨语言搜索：Flag/国旗/Bandeira 三语命中同一 flag 标签 tile、map 标签 tile 不中',
      t3r['Flag'].hitA === true && t3r['Flag'].hitM === true && t3r['Flag'].hitB === false &&
      t3r['国旗'].hitA === true && t3r['国旗'].hitB === false &&
      t3r['Bandeira'].hitA === true && t3r['Bandeira'].hitB === false, JSON.stringify(t3r));

    // ── T4 本地查重 → 建议 → 合并 ──
    await cdp.evalJs("window.openImgMetaModal('data:image/png;base64,NDU2', 'T4', function(){ return true; }); window.imgMetaOpenTagCreate();");
    await cdp.evalJs("document.getElementById('immTagOrig').value = 'Flag'; window.imgMetaSubmitTagCreate();");
    const t4a = await cdp.evalJs("(function(){ var s = document.getElementById('immTagSuggest'); var rows = s.querySelectorAll('.imm-tag-suggest-row'); return { shown: s.style.display !== 'none', txt: s.textContent, rows: rows.length, btns: rows[0] ? Array.prototype.slice.call(rows[0].querySelectorAll('button')).map(function(b){ return b.textContent; }) : [] }; })()");
    ok('T4a 本地查重：建 "Flag" → 建议行「已有相似标签：国旗」+ 合并到它/仍要新建 两钮',
      t4a.shown === true && t4a.txt.indexOf('已有相似标签：') !== -1 && t4a.txt.indexOf('国旗') !== -1 &&
      t4a.rows === 1 && t4a.btns.join('|') === '合并到它|仍要新建', JSON.stringify(t4a));
    const t4b = await cdp.evalJs("(function(){ document.querySelector('#immTagSuggest .imm-tag-suggest-row button').click(); var sel = Array.prototype.slice.call(document.querySelectorAll('#immTagChips .imm-tag-chip.selected')).map(function(c){ return c.querySelector('span').textContent; }); var s = document.getElementById('immTagSuggest'); return { selN: sel.length, selTxt: sel.join(','), suggHidden: s.style.display === 'none', tagN: window.__tags().length }; })()");
    ok('T4b 合并到它：勾选既有 sys-flag（selected chip「国旗」）不新建标签、建议行收起',
      t4b.selN === 1 && t4b.selTxt === '国旗' && t4b.suggHidden === true && t4b.tagN === 3, JSON.stringify(t4b));
    await cdp.evalJs("window.imgMetaCancel(); window.closeImgMetaModalCancel();");

    // ── T5 自建双语 + 远端 404 降级直建 ──
    await cdp.evalJs(`window.openImgMetaModal('${srcM2}', 'M2图', function(){ return true; }); window.imgMetaOpenTagCreate();`);
    await cdp.evalJs("document.getElementById('immTagOrig').value='皇室'; document.getElementById('immTagEn').value='Royal'; document.getElementById('immTagDesc').value='王室的象征'; window.imgMetaSubmitTagCreate();");
    await waitFor(cdp, "document.querySelectorAll('#immTagChips .imm-tag-chip').length === 4", 10000, 'T5 远端降级直建');
    const t5r = await cdp.evalJs("(function(){ var chips = Array.prototype.slice.call(document.querySelectorAll('#immTagChips .imm-tag-chip')); var hit = chips.filter(function(c){ return c.querySelector('span').textContent === '皇室 · Royal'; })[0]; var t = window.__tags().filter(function(x){ return !x.sys; })[0]; return { chip: !!hit, chipSel: !!(hit && hit.className.indexOf('selected') !== -1), toast: window.__toast(), orig: t && t.original, en: t && t.enName }; })()");
    await cdp.evalJs("window.imgMetaSave()");
    await waitFor(cdp, metaClosed, 4000, 'T5 meta 关闭');
    const t5b = await cdp.evalJs(`(function(){ var id = window.__tags().filter(function(x){ return !x.sys; })[0].id; var e = window.__lib().filter(function(x){ return x.src === '${srcM2}'; })[0]; return { tags: e ? JSON.stringify(e.tags) : null, id: id }; })()`);
    ok('T5 自建标签「皇室 · Royal」双语并排+直建即勾选+toast+保存后条目带新标签',
      t5r.chip === true && t5r.chipSel === true && t5r.orig === '皇室' && t5r.en === 'Royal' &&
      t5r.toast.indexOf('已创建标签：皇室 · Royal') !== -1 && t5b.tags === '["' + t5b.id + '"]', JSON.stringify({ r: t5r, b: t5b }));

    // ── T6 远端 404 静默 ──
    ok('T6 远端查重 404（本地静态 /api 无此端点）静默降级零 error（不拦创建）',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0, JSON.stringify({ e: cdp.errs.slice(0, 3), c: cdp.consoleErrs.slice(0, 3) }));

    // ── T7 筛选 OR 并集 + 搜索 AND ──
    await cdp.evalJs(`window.imgLibPut('${srcC}', {name:'C图', tags:['sys-flag','sys-map']}); window.openFlagBrowser();`);
    const t7a = await cdp.evalJs(`(function(){
      window.filterTagToggle('sys-flag', true);
      var s1 = window.__gridSrcs();
      window.filterTagToggle('sys-map', true);
      var s2 = window.__gridSrcs();
      return {
        n1: s1.length, n2: s2.length,
        f1: s1.indexOf('${srcM}') !== -1 && s1.indexOf('${srcA}') !== -1 && s1.indexOf('${srcC}') !== -1 && s1.indexOf('${srcB}') === -1,
        union: s2.indexOf('${srcM}') !== -1 && s2.indexOf('${srcA}') !== -1 && s2.indexOf('${srcB}') !== -1 && s2.indexOf('${srcC}') !== -1 && s2.indexOf('${srcM2}') === -1,
        badge: document.getElementById('flagFilterCount').textContent
      };
    })()`);
    ok('T7a 筛选 OR 并集：flag 3 格→+map 4 格越选越多、自建标签格不混入、徽章计数同步',
      t7a.n1 === 3 && t7a.n2 === 4 && t7a.f1 === true && t7a.union === true && t7a.badge === '2', JSON.stringify(t7a));
    const t7b = await cdp.evalJs(`(function(){
      document.getElementById('flagSearchInput').value = 'Bandeira';
      window.filterFlags();
      var s = window.__gridSrcs();
      return { n: s.length,
        hasMAC: s.indexOf('${srcM}') !== -1 && s.indexOf('${srcA}') !== -1 && s.indexOf('${srcC}') !== -1,
        noBnoM2: s.indexOf('${srcB}') === -1 && s.indexOf('${srcM2}') === -1 };
    })()`);
    ok('T7b 搜索 AND 筛选：q=Bandeira（标签名跨语言）且筛 flag+map → map-only B 图被收窄出局、剩 flag 系 3 格',
      t7b.n === 3 && t7b.hasMAC === true && t7b.noBnoM2 === true, JSON.stringify(t7b));

    // ── T8 管理面板：用量/改名/删除 ──
    await cdp.evalJs("window.openTagManage()");
    const t8a = await cdp.evalJs("(function(){ var rows = Array.prototype.slice.call(document.querySelectorAll('#tagManageList .tag-manage-row')); var out = {}; rows.forEach(function(r){ out[r.querySelector('.tag-manage-name').textContent] = r.querySelector('.tag-manage-usage').textContent; }); return { rows: out, n: rows.length }; })()");
    ok('T8a 管理面板用量：国旗 3 张/地图 2 张/皇室 1 张 + 4 行',
      t8a.rows['国旗'] === '3 张图片' && t8a.rows['地图'] === '2 张图片' && t8a.rows['皇室 · Royal'] === '1 张图片' && t8a.n === 4, JSON.stringify(t8a.rows));
    await cdp.evalJs(`(function(){ var rows = Array.prototype.slice.call(document.querySelectorAll('#tagManageList .tag-manage-row')); var r = rows.filter(function(x){ return x.querySelector('.tag-manage-name').textContent === '皇室 · Royal'; })[0]; r.querySelector('.tag-manage-actions button').click(); })()`);
    const t8b = await cdp.evalJs("(function(){ return { orig: document.getElementById('tagManageOrig').value, en: document.getElementById('tagManageEn').value, shown: document.getElementById('tagManageCreate').style.display !== 'none' }; })()");
    ok('T8b 编辑钮回填：原文=皇室/英文名=Royal、面板展开',
      t8b.orig === '皇室' && t8b.en === 'Royal' && t8b.shown === true, JSON.stringify(t8b));
    await cdp.evalJs("document.getElementById('tagManageOrig').value = '皇家'; document.getElementById('tagManageCreate').querySelector('.btn-primary').click();");
    await waitFor(cdp, "Array.prototype.slice.call(document.querySelectorAll('#tagManageList .tag-manage-name')).some(function(x){ return x.textContent === '皇家 · Royal'; })", 10000, 'T8 改名提交');
    const t8c = await cdp.evalJs("(function(){ var t = window.__tags().filter(function(x){ return !x.sys; })[0]; return { orig: t.original, toast: window.__toast() }; })()");
    ok('T8c 改名提交：store original=皇家 + toast 标签已保存',
      t8c.orig === '皇家' && t8c.toast.indexOf('标签已保存：皇家') !== -1, JSON.stringify(t8c));
    const t8id = await cdp.evalJs("window.__tags().filter(function(x){ return !x.sys; })[0].id");
    await cdp.evalJs(`(function(){ var rows = Array.prototype.slice.call(document.querySelectorAll('#tagManageList .tag-manage-row')); var r = rows.filter(function(x){ return x.querySelector('.tag-manage-name').textContent === '皇家 · Royal'; })[0]; r.querySelectorAll('.tag-manage-actions button')[1].click(); })()`);
    await waitFor(cdp, "document.querySelectorAll('#tagManageList .tag-manage-row').length === 3", 5000, 'T8 删除');
    const t8d = await cdp.evalJs(`(function(){ var ids = window.__tags().map(function(x){ return x.id; }); var e = window.__lib().filter(function(x){ return x.src === '${srcM2}'; })[0]; return { gone: ids.indexOf('${t8id}') === -1, stripped: !!(e && (!e.tags || e.tags.length === 0)), toast: window.__toast() }; })()`);
    const t8dialog = cdp.dialogs[cdp.dialogs.length - 1] || '';
    ok('T8d 删除：confirm 文案「删除标签「皇家 · Royal」…」+ store 移除 + 全库条目剥离 tags + toast',
      t8d.gone === true && t8d.stripped === true && t8d.toast.indexOf('已删除标签：皇家 · Royal') !== -1 &&
      t8dialog.indexOf('删除标签「皇家 · Royal」') !== -1, JSON.stringify({ d: t8d, dialog: t8dialog }));

    // ── T9 sys 行锁 ──
    const t9r = await cdp.evalJs("(function(){ var sys = Array.prototype.slice.call(document.querySelectorAll('#tagManageList .tag-manage-row.sys')); var bad = sys.filter(function(r){ return !r.querySelector('.tag-manage-lock') || r.querySelector('.tag-manage-actions'); }); return { sysN: sys.length, bad: bad.length, allN: document.querySelectorAll('#tagManageList .tag-manage-row').length }; })()");
    ok('T9 系统标签行：3 行全 lock、零编辑/删除钮',
      t9r.sysN === 3 && t9r.bad === 0 && t9r.allN === 3, JSON.stringify(t9r));
    await cdp.evalJs("window.closeTagManage()");

    // ── T10 桥-头像 ──
    await cdp.evalJs("window.__charCard = window.createCharacterCard(1, 1, 4, 5);");
    await cdp.evalJs("window.__charCard.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 }));");
    const t10a = await cdp.evalJs("(function(){ return { av: document.getElementById('avatarLibMenuItem').style.display, mp: document.getElementById('mapLibMenuItem').style.display }; })()");
    ok('T10a 右键门控：character 卡 → 头像库项 flex、地图库项 none',
      t10a.av === 'flex' && t10a.mp === 'none', JSON.stringify(t10a));
    await cdp.evalJs("document.getElementById('avatarLibMenuItem').click()");
    const t10b = await cdp.evalJs("(function(){ var h = document.getElementById('flagSlotHint'); return { shown: h.style.display !== 'none', txt: h.textContent, browserOpen: !!document.querySelector('#flagBrowserModal .modal-card.active') }; })()");
    ok('T10b 桥打开图库：slot 提示「正在为头像卡选图…」+ 图库弹窗开',
      t10b.shown === true && t10b.txt.indexOf('正在为头像卡选图') !== -1 && t10b.browserOpen === true, JSON.stringify(t10b));
    await cdp.evalJs(`(function(){ document.querySelector('#flagGrid img[src="${srcA}"]').closest('.flag-card-item').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); })()`);
    const t10d = await cdp.evalJs(`(function(){
      var c = window.__charCard; var d = window.__draft();
      var dc = d && d.cards ? d.cards.filter(function(x){ return x.type === 'character'; })[0] : null;
      return { avatar: c.dataset.charAvatar === '${srcA}', name: c.dataset.charAvatarName === 'A图',
        bg: c.querySelector('.char-avatar').style.backgroundImage.indexOf('${srcA}') !== -1,
        fi: !!c.querySelector('.char-avatar .card-upload-input'),
        draft: !!(dc && dc.charAvatar === '${srcA}'), toast: window.__toast() };
    })()`);
    ok('T10c 双击 tile → 头像卡 charAvatar+bg+fi 覆盖层保留+草稿立即含（零心跳）+toast 图片已添加',
      t10d.avatar === true && t10d.name === true && t10d.bg === true && t10d.fi === true && t10d.draft === true &&
      t10d.toast.indexOf('图片已添加：A图') !== -1, JSON.stringify(t10d));

    // ── T11 桥-地图 ──
    await cdp.evalJs("window.__mapCard = window.createMapCard(6, 1, 8, 6);");
    await cdp.evalJs("window.__mapCard.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 }));");
    const t11a = await cdp.evalJs("(function(){ return { mp: document.getElementById('mapLibMenuItem').style.display, av: document.getElementById('avatarLibMenuItem').style.display }; })()");
    ok('T11a 右键门控：map 卡 → 地图库项 flex、头像库项 none',
      t11a.mp === 'flex' && t11a.av === 'none', JSON.stringify(t11a));
    await cdp.evalJs("document.getElementById('mapLibMenuItem').click()");
    const t11h = await cdp.evalJs("(function(){ var h = document.getElementById('flagSlotHint'); return h.textContent; })()");
    ok('T11b 桥打开图库：slot 提示「正在为地图卡选图…」', t11h.indexOf('正在为地图卡选图') !== -1, JSON.stringify(t11h));
    await cdp.evalJs(`(function(){ document.querySelector('#flagGrid img[src="${srcB}"]').closest('.flag-card-item').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); })()`);
    const t11d = await cdp.evalJs(`(function(){
      var c = window.__mapCard; var d = window.__draft();
      var dm = d && d.cards ? d.cards.filter(function(x){ return x.type === 'map'; })[0] : null;
      var cv = c.querySelector('.map-canvas');
      return { mapImg: c.dataset.mapImg === '${srcB}', name: c.dataset.mapImgName === 'B图',
        emptyGone: !cv.classList.contains('map-empty'), txt: cv.textContent,
        draft: !!(dm && dm.mapImg === '${srcB}'), toast: window.__toast() };
    })()`);
    ok('T11c 双击 tile → 地图卡 mapImg+map-empty 移除+画布清空+草稿立即含+toast 图片已添加',
      t11d.mapImg === true && t11d.name === true && t11d.emptyGone === true && t11d.txt === '' &&
      t11d.draft === true && t11d.toast.indexOf('图片已添加：B图') !== -1, JSON.stringify(t11d));

    // ── T12 图库内上传随 slot ──
    await cdp.evalJs("window.selectCard(window.__charCard); window.openLibForSlot('avatar');");
    const t12url = await cdp.evalJs("window.__mkImgTo('browser1.png', '#0f0', '#000', '#flagBrowserFileInput')");
    await waitFor(cdp, metaOpen, 8000, 'T12 meta 打开');
    await cdp.evalJs("window.imgMetaSave()");
    await waitFor(cdp, metaClosed, 4000, 'T12 meta 关闭');
    const t12r = await cdp.evalJs(`(function(){
      var c = window.__charCard; var d = window.__draft();
      var dc = d && d.cards ? d.cards.filter(function(x){ return x.type === 'character'; })[0] : null;
      var lib = window.__lib().filter(function(x){ return x.src === '${t12url}'; })[0];
      return { applied: c.dataset.charAvatar === '${t12url}', draft: !!(dc && dc.charAvatar === '${t12url}'),
        libHas: !!lib, toast: window.__toast() };
    })()`);
    ok('T12 图库内上传随 slot：avatar 桥打开时上传→头像卡应用+「头像已上传」toast+入持久库',
      t12r.applied === true && t12r.draft === true && t12r.libHas === true && t12r.toast.indexOf('头像已上传') !== -1, JSON.stringify(t12r));

    // ── T13 切 en：sys chip 随界面语言、自建仍双语 ──
    await cdp.evalJs("window.MN_I18N.setLang('en');");
    const t13a = await cdp.evalJs("(function(){ var t = window.tagCreate('皇室', 'Royal', ''); return { sysName: window.tagDisplayName(window.tagLoad().filter(function(x){ return x.id === 'sys-flag'; })[0]), custom: window.tagDisplayName(t) }; })()");
    ok('T13a 切 en：sys 标签显示 Flag（随界面语言）、自建仍双语「皇室 · Royal」',
      t13a.sysName === 'Flag' && t13a.custom === '皇室 · Royal', JSON.stringify(t13a));
    await cdp.evalJs("window.openImgMetaModal('data:image/png;base64,QUFB', 'T13', function(){ return true; });");
    const t13b = await cdp.evalJs("(function(){ var chips = Array.prototype.slice.call(document.querySelectorAll('#immTagChips .imm-tag-chip')); var first = chips[0].querySelector('span').textContent; var i18nAttrs = document.querySelectorAll('#immTagChips [data-i18n], #immTagChips [data-i18n-title]').length; return { first: first, n: chips.length, i18nAttrs: i18nAttrs }; })()");
    ok('T13b en 界面 chips：首 chip 文本 Flag + 全部 textContent 渲染零 data-i18n',
      t13b.first === 'Flag' && t13b.n === 4 && t13b.i18nAttrs === 0, JSON.stringify(t13b));
    await cdp.evalJs("window.imgMetaCancel(); window.closeImgMetaModalCancel(); window.MN_I18N.setLang('zh');");

    ok('E1 全程零 Runtime.exceptionThrown', cdp.errs.length === 0, JSON.stringify(cdp.errs.slice(0, 3)));
    ok('E2 全程零 console error', cdp.consoleErrs.length === 0, JSON.stringify(cdp.consoleErrs.slice(0, 3)));
    cdp.close();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  try { chrome.kill(); } catch (e) {}
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS + '  (fc-tags)' : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(FAIL === 0 ? 0 : 1);
})();
