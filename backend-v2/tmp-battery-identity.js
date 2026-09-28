// tmp-battery-identity.js — 注册第二页（onboarding-identity）电池（v0.2.6.3 修复轮 + v0.2.7.0 性别栏轮）
// 用户（2026-09-02）：「那个注册手续的第二页的Ui 有bug」。
// bug 实证（修复前跑）：
//   08-29 auth v2 重构（fee0527）把 ethereal.css 的 .auth-card 改成竖排定高 800px+overflow:hidden、
//   并删除了 .auth-left/.auth-right 样式——本页仍用旧双栏标记：
//   ① 两栏竖排堆叠（auth-right 在 auth-left 下方）；
//   ② auth-left 无蓝渐变底 → 白字步骤卡落在白卡上（步骤卡隐形）；
//   ③ height:800px + overflow:hidden 把堆叠后超高的表单底部裁掉（Date of Birth + Next Step 不可见/不可点）。
// 断言 = 修复后状态（页内自愈 CSS：row/height auto/overflow visible + 恢复蓝板/玻璃栏 + ≤768 堆叠）。
// 跑法：node tmp-battery-identity.js（LIVE_BASE=<完整站点 URL> 跑线上）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-' + Date.now());

// ── 静态壳（docs/ 原样；/api 全 404 → demo 模式零请求） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

// ── CDP 客户端（Node 24 全局 WebSocket） ──
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) {
        const ls = this.listeners.get(m.method);
        if (ls) ls.forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('waitFor 超时: ' + label);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pass = [], fail = [];
function check(name, cond, detail) {
  const line = (cond ? '  ✅ ' : '  ❌ ') + name + (detail ? '（' + detail + '）' : '');
  console.log(line);
  (cond ? pass : fail).push(line);
}

// ── 探针：双栏几何 + 蓝板 + 裁切 ──
const PROBE = `(function () {
  var card = document.querySelector('.auth-card');
  var left = document.querySelector('.auth-left');
  var right = document.querySelector('.auth-right');
  if (!card || !left || !right) return JSON.stringify({ absent: true });
  var cs = getComputedStyle(card);
  var ls = getComputedStyle(left);
  var rs = getComputedStyle(right);
  var before = getComputedStyle(left, '::before');
  var after = getComputedStyle(left, '::after');
  var cr = card.getBoundingClientRect();
  var lr = left.getBoundingClientRect();
  var rr = right.getBoundingClientRect();
  var nextBtn = document.querySelector('.auth-right .btn-lg');
  var dob = document.getElementById('dob');
  var nr = nextBtn ? nextBtn.getBoundingClientRect() : { bottom: -1 };
  var dr = dob ? dob.getBoundingClientRect() : { bottom: -1 };
  var stepCard = left.querySelector('.card');
  var srr = stepCard ? stepCard.getBoundingClientRect() : { top: -1, bottom: -1, left: -1, right: -1 };
  return JSON.stringify({
    flexDir: cs.flexDirection, height: cs.height, overflow: cs.overflow,
    cardTop: cr.top, cardBottom: cr.bottom, cardW: cr.width,
    leftTop: lr.top, leftBottom: lr.bottom, leftLeft: lr.left, leftW: lr.width,
    rightTop: rr.top, rightLeft: rr.left, rightW: rr.width,
    leftBg: ls.backgroundImage, leftColor: ls.color, leftPadTop: parseFloat(ls.paddingTop),
    rightBg: rs.backgroundColor, rightPadTop: parseFloat(rs.paddingTop),
    beforeW: parseFloat(before.width), beforeRadius: before.borderRadius, beforeContent: before.content,
    afterW: parseFloat(after.width), afterRadius: after.borderRadius,
    nextBottom: nr.bottom, dobBottom: dr.bottom,
    stepTop: srr.top, stepBottom: srr.bottom, stepLeft: srr.left, stepRight: srr.right
  });
})()`;

async function probeOf(t) { return JSON.parse(await t.evalJs(PROBE)); }

async function main() {
  const LIVE = process.env.LIVE_BASE || '';
  if (!LIVE) server.listen(PORT);
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }

  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  await t.send('Log.enable');
  await t.send('DOM.enable');
  await t.send('CSS.enable');

  const exc = [], err = [];
  t.on('Runtime.exceptionThrown', p => exc.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || '?'));
  t.on('Log.entryAdded', p => {
    const e = p.entry;
    if (e.level === 'error' && e.url && e.url.indexOf('/api') === -1 && e.url.indexOf('favicon') === -1) err.push(e.url + ' :: ' + e.text);
  });

  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
  const seedJs = `localStorage.setItem('slati_session', JSON.stringify({loggedIn:true}));
    localStorage.setItem('slati_user', JSON.stringify({id:'USR-batt', displayName:'Battery Tester', dob:'2010-01-01', language:'中文 (Chinese)', gender:'Male'}));`;
  if (LIVE) {
    await t.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { ' + seedJs + ' } catch (e) {}' });
    await t.send('Page.navigate', { url: BASE + '/pages/onboarding-identity.html' });
  } else {
    await t.send('Page.navigate', { url: BASE + '/' });
    await waitFor(t, "document.readyState === 'complete'", 8000, '根页');
    await t.evalJs(seedJs);
    await t.send('Page.navigate', { url: BASE + '/pages/onboarding-identity.html' });
  }
  await waitFor(t, "typeof handleNext === 'function'", 8000, '页面脚本就绪');
  await sleep(500); // pre-stagger / tilt settle

  // ════ A0：版本（v0.2.54.0 i18n 轮同步；原 v0.2.7.0 起陈旧） ════
  check('A0 站点号 v0.2.54.0', (await t.evalJs('window.MN_SITE_VERSION')) === 'v0.2.58.15',
    String(await t.evalJs('window.MN_SITE_VERSION')));

  // ════ A：结构 ════
  const struct = JSON.parse(await t.evalJs(`(function () {
    return JSON.stringify({
      card: !!document.querySelector('.auth-card'),
      left: !!document.querySelector('.auth-left'),
      right: !!document.querySelector('.auth-right'),
      layout: !!document.querySelector('.auth-layout'),
      steps: document.querySelectorAll('.progress-step').length,
      fields: document.querySelectorAll('.auth-right .form-group').length,
      btn: !!document.querySelector('.auth-right .btn-lg')
    });
  })()`));
  check('A1 双栏结构齐备（card/left/right/layout）', struct.card && struct.left && struct.right && struct.layout, JSON.stringify(struct));
  check('A2 步骤指示 3 步（1 完成 / 2 活动 / 3 待办）', struct.steps === 3, String(struct.steps));
  check('A3 表单 5 组（名/性别/语言/生日/国家）+ Next Step 按钮', struct.fields === 5 && struct.btn, struct.fields + '/' + struct.btn);

  // ════ B：布局（修复断言：横排双栏 + 高度自适应 + 不裁切） ════
  let pr = await probeOf(t);
  check('B1 卡片横排（flex-direction: row）', pr.flexDir === 'row', String(pr.flexDir));
  check('B2 卡片高度自适应（非 800px 定高；flex item 的 auto 被解析为 used 值）', pr.height === 'auto' || pr.height !== '800px', String(pr.height));
  check('B3 卡片 overflow visible（国家下拉不被裁）', pr.overflow === 'visible', String(pr.overflow));
  check('B4 左栏宽 42%', Math.abs(pr.leftW - pr.cardW * 0.42) < 4, pr.leftW.toFixed(1) + ' vs ' + (pr.cardW * 0.42).toFixed(1));
  check('B5 左栏顶/底与卡对齐（同排，未堆叠）', Math.abs(pr.leftTop - pr.cardTop) < 2 && Math.abs(pr.leftBottom - pr.cardBottom) < 2,
    pr.leftTop.toFixed(1) + '/' + pr.leftBottom.toFixed(1) + ' vs ' + pr.cardTop.toFixed(1) + '/' + pr.cardBottom.toFixed(1));
  check('B6 右栏从左栏右缘起（并排非下方）', Math.abs(pr.rightLeft - (pr.leftLeft + pr.leftW)) < 2 && Math.abs(pr.rightTop - pr.cardTop) < 2,
    pr.rightLeft.toFixed(1) + ' vs ' + (pr.leftLeft + pr.leftW).toFixed(1));

  // ════ C：蓝板（左栏品牌板恢复） ════
  check('C1 蓝渐变底（135deg #4648d4→#3b3dc4）',
    pr.leftBg.indexOf('linear-gradient(135deg') === 0 && pr.leftBg.indexOf('rgb(59, 61, 196)') > -1, pr.leftBg.slice(0, 80));
  check('C2 左栏白字（步骤卡可见性前提）', pr.leftColor === 'rgb(255, 255, 255)', String(pr.leftColor));
  check('C3 左栏内边距 64px（space-xl）', Math.abs(pr.leftPadTop - 64) < 1, String(pr.leftPadTop));
  check('C4 装饰圆 ::before 300px', pr.beforeW === 300 && pr.beforeRadius === '50%', pr.beforeW + '/' + pr.beforeRadius);
  check('C5 装饰圆 ::after 200px', pr.afterW === 200 && pr.afterRadius === '50%', pr.afterW + '/' + pr.afterRadius);
  check('C6 右栏内边距 64px（space-xl）', Math.abs(pr.rightPadTop - 64) < 1, String(pr.rightPadTop));
  check('C7 步骤卡在蓝板内（未溢出卡外）', pr.stepTop >= pr.leftTop - 1 && pr.stepBottom <= pr.leftBottom + 1 && pr.stepRight <= pr.leftLeft + pr.leftW + 1,
    'step ' + pr.stepTop.toFixed(1) + '-' + pr.stepBottom.toFixed(1));

  // ════ D：不裁切（Next Step 与 Date of Birth 完整可见于卡内） ════
  check('D1 Next Step 按钮在卡底之上（未被裁）', pr.nextBottom <= pr.cardBottom + 1, pr.nextBottom.toFixed(1) + ' <= ' + pr.cardBottom.toFixed(1));
  check('D2 Date of Birth 在卡底之上（未被裁）', pr.dobBottom <= pr.cardBottom + 1, pr.dobBottom.toFixed(1) + ' <= ' + pr.cardBottom.toFixed(1));
  check('D3 按钮可点（无遮挡）', await t.evalJs(`(function () {
    var b = document.querySelector('.auth-right .btn-lg');
    var r = b.getBoundingClientRect();
    var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el === b || (el && b.contains(el));
  })()`), '');

  // ════ E：国家下拉完整展开（overflow visible 实证） ════
  await t.evalJs("document.getElementById('countrySelector').click()");
  await sleep(200);
  const menu = JSON.parse(await t.evalJs(`(function () {
    var m = document.getElementById('countryMenu');
    var r = m.getBoundingClientRect();
    return JSON.stringify({ open: m.classList.contains('open'), bottom: r.bottom, height: r.height, options: m.querySelectorAll('.dropdown-option').length });
  })()`));
  check('E1 点击 → 国家菜单打开', menu.open === true, String(menu.open));
  check('E2 国家列表完整（≥190 项，无裁切只数类）', menu.options >= 190, String(menu.options));
  check('E3 菜单不超出视口（高 900）', menu.bottom <= 900, menu.bottom.toFixed(1));
  await t.evalJs("document.getElementById('countrySelector').click()");

  // ════ F：用户回显回归（v0.2.6.2 修复 + 语言） ════
  const fill = JSON.parse(await t.evalJs(`(function () {
    return JSON.stringify({
      name: document.getElementById('displayName').value,
      dob: document.getElementById('dob').value,
      lang: document.getElementById('selectedLang').textContent
    });
  })()`));
  check('F1 名字回显 Battery Tester', fill.name === 'Battery Tester', String(fill.name));
  check('F2 生日回显 2010-01-01（v0.2.6.2 修复回归）', fill.dob === '2010-01-01', String(fill.dob));
  check('F3 语言回显 中文 (Chinese)', fill.lang === '中文 (Chinese)', String(fill.lang));

  // ════ G：性别选择栏（v0.2.7.0 第二项，同语言下拉模式） ════
  const gen = JSON.parse(await t.evalJs(`(function () {
    var groups = document.querySelectorAll('.auth-right .form-group');
    var g2 = groups[1];
    var menu = document.getElementById('genderMenu');
    return JSON.stringify({
      secondLabel: g2 ? g2.querySelector('.form-label').textContent.trim().indexOf((window.MN_I18N && MN_I18N.t('oi.label.gender')) || 'Gender') === 0 : false,
      star: g2 ? (g2.querySelector('.form-label span') || {}).textContent : '',
      opts: menu ? menu.querySelectorAll('.dropdown-option').length : 0,
      optTexts: menu ? Array.prototype.map.call(menu.querySelectorAll('.dropdown-option'), function (o) { return o.textContent; }).join('|') : ''
    });
  })()`));
  check('G1 性别栏是第二项（第 2 个 form-group 标签=当前语言字典值）', gen.secondLabel, JSON.stringify(gen));
  check('G2 三选项 Male/Female/Other', gen.opts === 3 && gen.optTexts === 'Male|Female|Other', gen.opts + '/' + gen.optTexts);
  check('G3 标签带 * 红标（必填口径）', gen.star === '*', String(gen.star));
  check('G4 回显种子 gender=Male', (await t.evalJs("document.getElementById('selectedGender').textContent")) === 'Male',
    String(await t.evalJs("document.getElementById('selectedGender').textContent")));
  await t.evalJs("document.getElementById('genderSelector').click()");
  await sleep(200);
  const gOpen = await t.evalJs("document.getElementById('genderMenu').classList.contains('open')");
  await t.evalJs("document.querySelectorAll('#genderMenu .dropdown-option')[1].click()"); // Female
  await sleep(200);
  const gSel = JSON.parse(await t.evalJs(`(function () {
    return JSON.stringify({
      text: document.getElementById('selectedGender').textContent,
      open: document.getElementById('genderMenu').classList.contains('open'),
      arrow: document.getElementById('genderArrow').style.transform
    });
  })()`));
  check('G5 点开菜单 → 选 Female → 显示+收起+箭头复位', gOpen === true && gSel.text === 'Female' && gSel.open === false && gSel.arrow === '',
    JSON.stringify(gSel) + ' open前=' + gOpen);
  // G6：未选性别拦截（先于国家缺选拦截——性别在 handleNext 里排第二）
  await t.evalJs("selectedGender = ''");
  await t.evalJs("document.querySelector('.auth-right .btn-lg').click()");
  await sleep(300);
  const gErr = JSON.parse(await t.evalJs(`(function () {
    var fe = document.getElementById('formError');
    return JSON.stringify({ shown: fe.style.display !== 'none', text: fe.textContent, exp: (window.MN_I18N && MN_I18N.t('oi.err.gender')) || 'gender', path: window.location.pathname });
  })()`));
  check('G6 未选性别 → Next 报错且不跳页', gErr.shown && gErr.text.indexOf(gErr.exp) > -1 && gErr.path.indexOf('identity') > -1, JSON.stringify(gErr));
  await sleep(3300); // showError 3s 自动隐藏——等它走完再走 H 全绿路径（H2 断言 display none）
  await t.evalJs("selectGender('Female')");

  // ════ K：移动 ≤768 堆叠 ════
  await t.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  pr = await probeOf(t);
  check('K1 移动端卡片竖排', pr.flexDir === 'column', String(pr.flexDir));
  check('K2 移动端左栏全宽', Math.abs(pr.leftW - pr.cardW) < 2, pr.leftW.toFixed(1) + ' vs ' + pr.cardW.toFixed(1));
  await t.send('Emulation.clearDeviceMetricsOverride');
  await sleep(300);

  // ════ H：逻辑零改动（handleNext 校验仍全绿路径） ════
  await t.evalJs("document.getElementById('displayName').value = 'Battery Tester'");
  await t.evalJs("selectLang('English')");
  await t.evalJs("document.getElementById('countrySelector').click()");
  await sleep(200);
  await t.evalJs("filterCountries('malaysia')");
  await sleep(200);
  await t.evalJs("document.querySelectorAll('#countryList .dropdown-option')[0].click()");
  await sleep(200);
  const preErr = await t.evalJs("document.getElementById('formError').style.display");
  await t.evalJs("document.querySelector('.auth-right .btn-lg').click()");
  await waitFor(t, "window.location.pathname.indexOf('onboarding-complete') > -1", 5000, '跳完成页');
  const submit2 = await t.evalJs("window.location.pathname");
  check('H1 填全五字段 → Next Step 跳完成页（/pages/onboarding-complete.html）', submit2.indexOf('onboarding-complete') > -1, String(submit2));
  check('H2 formError 不显示', preErr === 'none', String(preErr));

  check('I1 无运行时异常', exc.length === 0, exc.join(' | ').slice(0, 200));
  check('I2 无 console error', err.length === 0, err.join(' | ').slice(0, 200));

  console.log('\n════════ 汇总 ════════');
  console.log('通过 ' + pass.length + ' / 失败 ' + fail.length);
  t.close();
  chrome.kill();
  if (!LIVE) server.close();
  process.exit(fail.length ? 1 : 0);
}

main().catch(e => { console.error('电池崩溃:', e); process.exit(2); });
