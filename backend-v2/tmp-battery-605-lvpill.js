// tmp-battery-605-lvpill.js — v0.2.58.15 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡电池（58.16 轮 sed-622
//   扫版：版本赋值锚=58.16/rev 00348-/00349- 新入口，58.15 轮 ethereal 注释锚按历史前缀保留；58.10 收成两层/
//   58.11 两色互换/58.12 浪位抬高/58.13 双浪同色深蓝/58.14 慢浪改浅色电池同文件口径随轮改：用户「那么
//   能不能添加一个功能就是当滑鼠靠近那个折叠的药丸时药丸会变大然后 向右滑出 一个卡片完整的显示等级信息
//   和经验条」——折叠态药丸悬停（.mn-lv-badge 整块=悬停区）scale(1.12)+右侧滑出 .mn-lv-hovercard
//   （position:fixed 挂 body 逃双裁剪，z-index 150；内容=每次 show 从活的 .mn-lv-normal clone 最新
//   innerHTML 零陈旧；200ms 宽限防缝隙闪烁；matchMedia(hover+fine) 门控触屏零行为）；展开态原徽章可见
//   零卡片；药丸/水杯/水位/两浪 58.14 全零改动。
//   折叠态等级徽章=纵向药丸 48×116（LV 小字在上）+ 药丸水杯 44×84 只围号码；经验进度=水位从杯底往上灌
//   （.mn-lv-fill 内联 height 百分比）；深蓝水+杯顶两道正弦浪（快 2.2s 深蓝/慢 2.5s 浅色相位漂移，慢浪
//   浪峰周期性从快浪浪谷透明区透出=浅色幽灵浪峰在深浪下流动，纯 CSS 零 JS）；
//   号码 z 上浮+白色描边晕影水位高时仍可读。展开态 .mn-lv-normal 原徽章原样零变化。
// F 静态：site-config 58.15+changelog+rev 00348-/00349-、sidebar.js 三层结构+悬停块、ethereal.css 药丸规则+
//   悬停卡规则+内联块同步；S 浏览器：展开零变化/折叠切换/药丸几何与菜单按钮同宽/水位进度刷新/满级/
//   narrow 列 floating 与卡片齐平/展开恢复 + 悬停开卡/驻留/收卡/重渲染重开/折叠切换收卡/floating 开卡/展开零卡；
//   E 零异常。/api 全 404（demo 模式，同 xp-rebalance 口径）；会话+XP 本地种子。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-lvpill-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url);
  const p = url.split('?')[0];
  if (p.indexOf('/api/') === 0) {
    const b = JSON.stringify({ error: { code: 'NOT_FOUND', message: 'offline' } });
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) });
    res.end(b);
    return;
  }
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push('EXC ' + JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
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
  let lastErr = '';
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; }
    catch (e) { lastErr = String(e.message || e).slice(0, 160); }
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label + (lastErr ? '（最后 eval 错误: ' + lastErr + '）' : ''));
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
const rgbSum = (s) => {
  const t = String(s || '');
  let m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(t);
  if (m) return (+m[1] + +m[2] + +m[3]);
  m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(t);
  if (m) return Math.round((+m[1] + +m[2] + +m[3]) * 255);
  return -1;
};

(async () => {
  // ═══ F 静态检查 ═══
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const sidebarSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'sidebar.js'), 'utf8').replace(/\r\n/g, '\n');
  const etherealSrc = fs.readFileSync(path.join(DOCS, 'assets', 'css', 'ethereal.css'), 'utf8').replace(/\r\n/g, '\n');
  const indexSrc = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const editorSrc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8').replace(/\r\n/g, '\n');

  ok('F1 静态：58.16 赋值 + FC 48.0 在位 + changelog 新条目标题（58.15 悬停卡标题按历史前缀保留）+用户原话三片断（滑鼠靠近/向右滑出/显示等级信息和经验条）+ rev 00348-/00349- 各 1（58.21 单 changelog 条目）+ 58.14 赋值零残留 + 58.14 标题与原话保留 + 58.13/58.12/58.11/58.10/58.9/58.8/58.7/58.6/58.5/58.4/58.3/58.2/58.1 历史条目标题保留',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.26';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.48.2';") !== -1 &&
    sconfSrc.indexOf('v0.2.58.15 = 折叠侧栏等级药丸悬停放大+右侧滑出等级信息卡') !== -1 &&
    sconfSrc.indexOf('滑鼠靠近') !== -1 &&
    sconfSrc.indexOf('向右滑出') !== -1 &&
    sconfSrc.indexOf('显示等级信息和经验条') !== -1 &&
    cnt(sconfSrc, 'rev 00348-') === 2 &&
    cnt(sconfSrc, 'rev 00349-') === 2 &&
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.14';") === -1 &&
    sconfSrc.indexOf('v0.2.58.14 = 折叠侧栏等级水杯慢浪改浅色') !== -1 &&
    sconfSrc.indexOf('第二个波浪我希望是浅色的') !== -1 &&
    sconfSrc.indexOf('rev 00323-') !== -1 &&
    sconfSrc.indexOf('v0.2.58.13 = 折叠侧栏等级水杯双浪同色深蓝+慢浪 z-1 层') !== -1 &&
    sconfSrc.indexOf('然后把两个颜色改成一样的深蓝色') !== -1 &&
    sconfSrc.indexOf('波浪Z轴的-1') !== -1 &&
    sconfSrc.indexOf('慢0.3s') !== -1 &&
    sconfSrc.indexOf('rev 00321-') !== -1 &&
    sconfSrc.indexOf('v0.2.58.12 = 折叠侧栏等级水杯波浪位置抬高 4px') !== -1 &&
    sconfSrc.indexOf('波浪的位置抬高4px') !== -1 &&
    sconfSrc.indexOf('位置抬高 4px') !== -1 &&
    sconfSrc.indexOf('rev 00319-') !== -1 &&
    sconfSrc.indexOf('v0.2.58.11 = 折叠侧栏等级水杯两色互换') !== -1 &&
    sconfSrc.indexOf('波浪和深蓝色倒反') !== -1 &&
    sconfSrc.indexOf('就只是互换一下颜色而已') !== -1 &&
    sconfSrc.indexOf('v0.2.58.10 = 折叠侧栏等级水杯收成两层') !== -1 &&
    sconfSrc.indexOf('为什么是四层颜色') !== -1 &&
    sconfSrc.indexOf('能不能只有两层') !== -1 &&
    sconfSrc.indexOf('一问钦定') !== -1 &&
    sconfSrc.indexOf('只有主色水+一道浅浪') !== -1 &&
    sconfSrc.indexOf('v0.2.58.9 = 折叠侧栏等级药丸波浪改平改宽') !== -1 &&
    sconfSrc.indexOf('那个波浪能不能') !== -1 &&
    sconfSrc.indexOf('高度减半+宽度翻倍') !== -1 &&
    sconfSrc.indexOf('v0.2.58.8 = 折叠侧栏等级药丸收窄对齐菜单按钮') !== -1 &&
    sconfSrc.indexOf('能不能把他的') !== -1 &&
    sconfSrc.indexOf('宽度变成和其他按钮一样') !== -1 &&
    sconfSrc.indexOf('v0.2.58.7 = 折叠侧栏等级药丸与水波全翻倍') !== -1 &&
    sconfSrc.indexOf('那个波浪能不能大2倍啊') !== -1 &&
    sconfSrc.indexOf('v0.2.58.6 = 折叠侧栏等级水杯药丸与波浪再放大') !== -1 &&
    sconfSrc.indexOf('v0.2.58.5 = 折叠侧栏等级水杯改药丸形+波浪加大') !== -1 &&
    sconfSrc.indexOf('v0.2.58.4 = 折叠侧栏等级水位环波纹改正弦水面') !== -1 &&
    sconfSrc.indexOf('v0.2.58.3 = 折叠侧栏等级水位环+双层水波') !== -1 &&
    sconfSrc.indexOf('v0.2.58.2 = 折叠侧栏等级纵向药丸+经验环') !== -1 &&
    sconfSrc.indexOf('v0.2.58.1 = 左侧菜单底部不透明背景完全删除') !== -1);

  ok('F2 静态：sidebar.js 新结构（normal 原徽章字节原样 + 药丸/水杯/水位/三层水件套 wdeep→wlightwave2→wlightwave 序 + fillPct + wlight/wdeepwave 零残留 + conic/ringPct/pill-core 零残留）+ 58.15 悬停块（function initLevelHover ×1/initLevelHover(); ×1/lvHoverHide ×6/matchMedia 门控 ×1/className mn-lv-hovercard ×1/mn-lv-hover ×2/normal.innerHTML 克隆在位/cloneNode 零/getBoundingClientRect ×1）',
    cnt(sidebarSrc, 'class="mn-lv-normal"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-pill"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-ring"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-cup"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-fill"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-wdeep"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-wlight"') === 0 &&
    cnt(sidebarSrc, 'class="mn-lv-wdeepwave"') === 0 &&
    cnt(sidebarSrc, 'class="mn-lv-wlightwave"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-wlightwave2"') === 1 &&
    sidebarSrc.indexOf('class="mn-lv-wdeep"></div>') < sidebarSrc.indexOf('class="mn-lv-wlightwave2"></div>') &&
    sidebarSrc.indexOf('class="mn-lv-wlightwave2"></div>') < sidebarSrc.indexOf('class="mn-lv-wlightwave"></div>') &&
    cnt(sidebarSrc, 'class="mn-lv-pill-tag"') === 1 &&
    cnt(sidebarSrc, 'class="mn-lv-pill-num"') === 1 &&
    sidebarSrc.indexOf("style=\"height:' + fillPct + '%\"") !== -1 &&
    sidebarSrc.indexOf('var fillPct = Math.round(st.progress * 100);') !== -1 &&
    sidebarSrc.indexOf('conic-gradient') === -1 &&
    sidebarSrc.indexOf('ringPct') === -1 &&
    sidebarSrc.indexOf('mn-lv-pill-core') === -1 &&
    sidebarSrc.indexOf('display:flex;align-items:center;justify-content:space-between;margin-bottom:4px') !== -1 &&
    sidebarSrc.indexOf('height:5px;border-radius:999px;background:rgba(128,128,140,0.25)') !== -1 &&
    cnt(sidebarSrc, 'function initLevelHover') === 1 &&
    cnt(sidebarSrc, 'initLevelHover();') === 1 &&
    cnt(sidebarSrc, 'lvHoverHide') === 6 &&
    cnt(sidebarSrc, "matchMedia('(hover: hover) and (pointer: fine)')") === 1 &&
    cnt(sidebarSrc, "className = 'mn-lv-hovercard'") === 1 &&
    cnt(sidebarSrc, "'mn-lv-hover'") === 2 &&
    sidebarSrc.indexOf('lvHoverCard.innerHTML = normal.innerHTML') !== -1 &&
    cnt(sidebarSrc, 'cloneNode') === 0 &&
    cnt(sidebarSrc, 'getBoundingClientRect()') === 1);

  ok('F3 静态：ethereal.css 药丸规则在位（默认隐藏/折叠三规则+keyframes pill-in + 药丸 48×116 + 水杯 44×84 胶囊 + 58.14 慢浪改浅色件套——水 wdeep 背景 var(--color-primary)+z-index:-2、快浪 wlightwave 深蓝 80×16 新路径/400% strip 16px/平移 80px/2.2s+top -12px+z-index:0、慢浪 wlightwave2 浅色 var(--mn-lv-light) 全同款几何+z-index:-1+2.5s、fill z-index:0 建 stacking context、--mn-lv-light 赋值挂 .mn-lv-ring 恢复在位 + LV 标签 14px/号码 28px）+ 旧浅水层/旧深浪/旧 --mn-lv-wave-c 赋值/旧 1.6s/旧顶线 calc(40% - 8px)/旧 opacity 0.65/旧 height 40%/旧 40×32 路径/旧 300% strip/旧平移 40px/旧 64×116/旧 56×84/旧 32×58/旧 28×42/旧 28×48/旧 24×32/旧正圆/旧 20×16/旧 16×12/旧 12×8/旧平移 20px/旧顶线 -16px 旧代/旧花边/7px 7px/conic/pill-core 零残留 + 58.10/58.11/58.12/58.13/58.14 注释在位 + 旧慢浪同色注释零残留 + 58.15 悬停卡块（media 门控 ×1/transition transform 0.18s ×1/scale 1.12 ×1/.mn-lv-hovercard 两规则/z-index 150 ×1/translateX(-10px) scale(0.98) ×1/opacity+transform 过渡 ×1/transform-origin left center ×1/中文注释两片断）+ index/editor 内联块同款同步（media ×1/hovercard ×2/scale ×1/transition ×1；index z-index 150 与页本地样式撞车不计数）',
    etherealSrc.indexOf('.mn-lv-badge .mn-lv-pill { display: none; }') !== -1 &&
    etherealSrc.indexOf('.app-sidebar.collapsed .mn-lv-badge { margin-top: 0 !important; }') !== -1 &&
    etherealSrc.indexOf('.app-sidebar.collapsed .mn-lv-badge .mn-lv-normal { display: none; }') !== -1 &&
    etherealSrc.indexOf('animation: mn-lv-pill-in 0.3s ease;') !== -1 &&
    etherealSrc.indexOf('@keyframes mn-lv-pill-in') !== -1 &&
    etherealSrc.indexOf('width: 48px; height: 116px; border-radius: 999px;') !== -1 &&
    etherealSrc.indexOf('width: 44px; height: 84px; border-radius: 999px;') !== -1 &&
    etherealSrc.indexOf('width: 64px; height: 116px; border-radius: 999px;') === -1 &&
    etherealSrc.indexOf('width: 56px; height: 84px; border-radius: 999px;') === -1 &&
    etherealSrc.indexOf('width: 32px; height: 58px; border-radius: 999px;') === -1 &&
    etherealSrc.indexOf('width: 28px; height: 42px; border-radius: 999px;') === -1 &&
    etherealSrc.indexOf('width: 28px; height: 48px;') === -1 &&
    etherealSrc.indexOf('width: 24px; height: 32px;') === -1 &&
    etherealSrc.indexOf('width: 24px; height: 24px; border-radius: 50%;') === -1 &&
    cnt(etherealSrc, '--mn-lv-light: color-mix(in srgb, var(--color-primary) 55%, #ffffff);') === 1 &&
    etherealSrc.indexOf('.mn-lv-wdeep { position: absolute; inset: 0; background: var(--color-primary); z-index: -2; }') !== -1 &&
    etherealSrc.indexOf('.mn-lv-wdeep { position: absolute; inset: 0; background: var(--mn-lv-light); }') === -1 &&
    etherealSrc.indexOf('z-index: 0; /* 建 stacking context') !== -1 &&
    etherealSrc.indexOf('.mn-lv-wlightwave {') !== -1 &&
    etherealSrc.indexOf('.mn-lv-wlightwave2 {') !== -1 &&
    etherealSrc.indexOf('.mn-lv-wlight {') === -1 &&
    etherealSrc.indexOf('.mn-lv-wdeepwave {') === -1 &&
    etherealSrc.indexOf('.mn-lv-wdeepwave, .mn-lv-wlightwave {') === -1 &&
    cnt(etherealSrc, 'background-color: var(--color-primary);') === 1 &&
    cnt(etherealSrc, 'background-color: var(--mn-lv-light);') === 1 &&
    etherealSrc.indexOf('--mn-lv-wave-c:') === -1 &&
    etherealSrc.indexOf('opacity: 0.65;') === -1 &&
    etherealSrc.indexOf('height: 40%;') === -1 &&
    etherealSrc.indexOf('top: calc(40% - 8px);') === -1 &&
    etherealSrc.indexOf('top: calc(40% - 16px);') === -1 &&
    etherealSrc.indexOf('top: -16px;') === -1 &&
    etherealSrc.indexOf('top: calc(40% - 6px);') === -1 &&
    etherealSrc.indexOf('top: -6px;') === -1 &&
    etherealSrc.indexOf('top: calc(40% - 4px);') === -1 &&
    etherealSrc.indexOf('top: -4px;') === -1 &&
    etherealSrc.indexOf('top: -8px;') === -1 &&
    cnt(etherealSrc, 'top: -12px;') === 2 &&
    cnt(etherealSrc, 'mask-image: url("data:image/svg+xml') === 4 &&
    cnt(etherealSrc, "viewBox='0 0 80 16'") === 4 &&
    cnt(etherealSrc, 'M0 8 Q20 0 40 8 Q60 16 80 8 V16 H0 Z') === 4 &&
    cnt(etherealSrc, "viewBox='0 0 40 32'") === 0 &&
    cnt(etherealSrc, "viewBox='0 0 20 16'") === 0 &&
    cnt(etherealSrc, "viewBox='0 0 16 12'") === 0 &&
    cnt(etherealSrc, "viewBox='0 0 12 8'") === 0 &&
    cnt(etherealSrc, 'M0 16 Q10 0 20 16 Q30 32 40 16') === 0 &&
    cnt(etherealSrc, 'M0 8 Q10 0 20 8 Q30 16 40 8') === 0 &&
    cnt(etherealSrc, 'mask-size: 80px 16px;') === 4 &&
    cnt(etherealSrc, 'mask-size: 40px 32px;') === 0 &&
    cnt(etherealSrc, 'mask-size: 20px 16px;') === 0 &&
    cnt(etherealSrc, 'mask-size: 16px 12px;') === 0 &&
    cnt(etherealSrc, 'mask-size: 12px 8px;') === 0 &&
    cnt(etherealSrc, 'position: absolute; left: -100%; width: 400%; height: 16px;') === 2 &&
    etherealSrc.indexOf('position: absolute; left: -100%; width: 300%; height: 32px;') === -1 &&
    etherealSrc.indexOf('position: absolute; left: -100%; width: 300%; height: 16px;') === -1 &&
    etherealSrc.indexOf('position: absolute; left: -100%; width: 300%; height: 12px;') === -1 &&
    etherealSrc.indexOf('position: absolute; left: -100%; width: 200%; height: 8px;') === -1 &&
    etherealSrc.indexOf('translateX(-80px)') !== -1 &&
    etherealSrc.indexOf('translateX(-40px)') === -1 &&
    etherealSrc.indexOf('translateX(-20px)') === -1 &&
    etherealSrc.indexOf('translateX(-16px)') === -1 &&
    etherealSrc.indexOf('translateX(-12px)') === -1 &&
    etherealSrc.indexOf('animation: mn-lv-wave 2.2s linear infinite;') !== -1 &&
    etherealSrc.indexOf('animation: mn-lv-wave 2.5s linear infinite;') !== -1 &&
    etherealSrc.indexOf('animation: mn-lv-wave 1.6s linear infinite;') === -1 &&
    cnt(etherealSrc, 'z-index: 0;') === 2 &&
    etherealSrc.indexOf('z-index: -1;\n  animation: mn-lv-wave 2.5s linear infinite;') !== -1 &&
    cnt(etherealSrc, 'z-index: -2;') === 1 &&
    etherealSrc.indexOf('@keyframes mn-lv-wave') !== -1 &&
    etherealSrc.indexOf('v0.2.58.10 用户「为什么是四层颜色？') !== -1 &&
    etherealSrc.indexOf('只有主色水+一道浅浪') !== -1 &&
    etherealSrc.indexOf('v0.2.58.11 用户「能不能把那个浅蓝色波浪和深蓝色倒反？') !== -1 &&
    etherealSrc.indexOf('就只是互换一下颜色而已') !== -1 &&
    etherealSrc.indexOf('v0.2.58.12 用户「能不能把波浪的位置抬高4px?') !== -1 &&
    etherealSrc.indexOf('位置抬高 4px') !== -1 &&
    etherealSrc.indexOf('v0.2.58.13 用户「然后把两个颜色改成一样的深蓝色') !== -1 &&
    etherealSrc.indexOf('波浪Z轴的-1') !== -1 &&
    etherealSrc.indexOf('v0.2.58.14 用户「那个刚才提出添加的第二个波浪我希望是浅色的') !== -1 &&
    etherealSrc.indexOf('浅色幽灵浪峰在深浪下流动') !== -1 &&
    etherealSrc.indexOf('透出=两道浪峰不同速叠加 */') === -1 &&
    etherealSrc.indexOf('font-size: 14px; font-weight: 700; letter-spacing: 0.06em;') !== -1 &&
    etherealSrc.indexOf('font-size: 28px; font-weight: 700; color: var(--color-primary);') !== -1 &&
    etherealSrc.indexOf('background: radial-gradient(circle at 50% 0, transparent 3.5px, var(--mn-lv-wave-c) 3.5px) repeat-x;') === -1 &&
    etherealSrc.indexOf('background-size: 7px 7px') === -1 &&
    etherealSrc.indexOf('conic-gradient') === -1 &&
    etherealSrc.indexOf('mn-lv-pill-core') === -1 &&
    etherealSrc.indexOf('v0.2.58.15 用户「那么能不能添加一个功能就是当滑鼠靠近那个折叠的药丸时药丸会变大然后 向右滑出') !== -1 &&
    etherealSrc.indexOf('一个卡片完整的显示等级信息和经验条」：折叠态药丸悬停放大+右侧滑出等级信息卡。') !== -1 &&
    cnt(etherealSrc, '@media (hover: hover) and (pointer: fine)') === 1 &&
    cnt(etherealSrc, 'transition: transform 0.18s ease;') === 1 &&
    cnt(etherealSrc, 'transform: scale(1.12);') === 1 &&
    cnt(etherealSrc, '.mn-lv-hovercard {') === 1 &&
    cnt(etherealSrc, '.mn-lv-hovercard.active {') === 1 &&
    cnt(etherealSrc, 'z-index: 150;') === 1 &&
    cnt(etherealSrc, 'transform: translateX(-10px) scale(0.98);') === 1 &&
    cnt(etherealSrc, 'transition: opacity 0.2s ease, transform 0.2s ease;') === 1 &&
    cnt(etherealSrc, 'transform-origin: left center;') === 1 &&
    cnt(etherealSrc, 'pointer-events: none;') >= 1 &&
    cnt(indexSrc, '.mn-lv-badge .mn-lv-pill { display: none; }') === 1 &&
    cnt(indexSrc, 'mn-lv-pill-in') === 2 &&
    cnt(indexSrc, '.mn-lv-wlightwave {') === 1 &&
    cnt(indexSrc, '.mn-lv-wlightwave2 {') === 1 &&
    cnt(indexSrc, '.mn-lv-wdeepwave {') === 0 &&
    cnt(indexSrc, '.mn-lv-wdeepwave, .mn-lv-wlightwave {') === 0 &&
    cnt(indexSrc, '.mn-lv-wlight {') === 0 &&
    cnt(indexSrc, 'mask-size: 80px 16px;') === 4 &&
    cnt(indexSrc, 'mask-size: 40px 32px;') === 0 &&
    cnt(indexSrc, 'mask-size: 20px 16px;') === 0 &&
    cnt(indexSrc, 'mask-size: 16px 12px;') === 0 &&
    cnt(indexSrc, 'top: -12px;') === 2 &&
    cnt(indexSrc, 'top: -8px;') === 0 &&
    cnt(indexSrc, 'background: var(--mn-lv-light);') === 0 &&
    cnt(indexSrc, '--mn-lv-light: color-mix(in srgb, var(--color-primary) 55%, #ffffff);') === 1 &&
    cnt(indexSrc, 'background-color: var(--color-primary);') === 1 &&
    cnt(indexSrc, '.mn-lv-wdeep { position: absolute; inset: 0; background: var(--color-primary); z-index: -2; }') === 1 &&
    indexSrc.indexOf('z-index: -1;\n  animation: mn-lv-wave 2.5s linear infinite;') !== -1 &&
    cnt(indexSrc, 'background-color: var(--mn-lv-light);') === 1 &&
    cnt(indexSrc, 'left: -100%; width: 400%') === 2 &&
    cnt(indexSrc, 'left: -100%; width: 300%') === 0 &&
    cnt(indexSrc, 'width: 48px; height: 116px; border-radius: 999px;') === 1 &&
    cnt(indexSrc, 'width: 64px; height: 116px; border-radius: 999px;') === 0 &&
    cnt(indexSrc, 'width: 44px; height: 84px; border-radius: 999px;') === 1 &&
    cnt(indexSrc, 'width: 56px; height: 84px; border-radius: 999px;') === 0 &&
    cnt(indexSrc, 'width: 32px; height: 58px; border-radius: 999px;') === 0 &&
    cnt(indexSrc, 'width: 28px; height: 42px; border-radius: 999px;') === 0 &&
    cnt(indexSrc, '@keyframes mn-lv-wave') === 1 &&
    cnt(indexSrc, 'animation: mn-lv-wave ') === 2 &&
    cnt(indexSrc, '@media (hover: hover) and (pointer: fine)') === 1 &&
    cnt(indexSrc, '.mn-lv-hovercard {') === 1 &&
    cnt(indexSrc, '.mn-lv-hovercard.active {') === 1 &&
    cnt(indexSrc, 'transform: scale(1.12);') === 1 &&
    cnt(indexSrc, 'transition: transform 0.18s ease;') === 1 &&
    cnt(editorSrc, 'mn-lv-pill-in') === 2 &&
    cnt(editorSrc, '.mn-lv-wlightwave {') === 1 &&
    cnt(editorSrc, '.mn-lv-wlightwave2 {') === 1 &&
    cnt(editorSrc, '.mn-lv-wdeepwave {') === 0 &&
    cnt(editorSrc, '.mn-lv-wdeepwave, .mn-lv-wlightwave {') === 0 &&
    cnt(editorSrc, '.mn-lv-wlight {') === 0 &&
    cnt(editorSrc, 'mask-size: 80px 16px;') === 4 &&
    cnt(editorSrc, 'mask-size: 40px 32px;') === 0 &&
    cnt(editorSrc, 'mask-size: 20px 16px;') === 0 &&
    cnt(editorSrc, 'mask-size: 16px 12px;') === 0 &&
    cnt(editorSrc, 'top: -12px;') === 2 &&
    cnt(editorSrc, 'top: -8px;') === 0 &&
    cnt(editorSrc, 'background: var(--mn-lv-light);') === 0 &&
    cnt(editorSrc, '--mn-lv-light: color-mix(in srgb, var(--color-primary) 55%, #ffffff);') === 1 &&
    cnt(editorSrc, 'background-color: var(--color-primary);') === 1 &&
    cnt(editorSrc, '.mn-lv-wdeep { position: absolute; inset: 0; background: var(--color-primary); z-index: -2; }') === 1 &&
    editorSrc.indexOf('z-index: -1;\n  animation: mn-lv-wave 2.5s linear infinite;') !== -1 &&
    cnt(editorSrc, 'background-color: var(--mn-lv-light);') === 1 &&
    cnt(editorSrc, 'left: -100%; width: 400%') === 2 &&
    cnt(editorSrc, 'left: -100%; width: 300%') === 0 &&
    cnt(editorSrc, 'width: 48px; height: 116px; border-radius: 999px;') === 1 &&
    cnt(editorSrc, 'width: 64px; height: 116px; border-radius: 999px;') === 0 &&
    cnt(editorSrc, 'width: 44px; height: 84px; border-radius: 999px;') === 1 &&
    cnt(editorSrc, 'width: 56px; height: 84px; border-radius: 999px;') === 0 &&
    cnt(editorSrc, 'width: 32px; height: 58px; border-radius: 999px;') === 0 &&
    cnt(editorSrc, 'width: 28px; height: 42px; border-radius: 999px;') === 0 &&
    cnt(editorSrc, '@keyframes mn-lv-wave') === 1 &&
    cnt(editorSrc, 'animation: mn-lv-wave ') === 2 &&
    cnt(editorSrc, '@media (hover: hover) and (pointer: fine)') === 1 &&
    cnt(editorSrc, '.mn-lv-hovercard {') === 1 &&
    cnt(editorSrc, '.mn-lv-hovercard.active {') === 1 &&
    cnt(editorSrc, 'transform: scale(1.12);') === 1 &&
    cnt(editorSrc, 'transition: transform 0.18s ease;') === 1,
    'index-pill=' + cnt(indexSrc, 'mn-lv-pill-in') + ' editor-pill=' + cnt(editorSrc, 'mn-lv-pill-in'));

  // ═══ 浏览器场景 ═══
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
    '--disable-extensions', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    ok('P0 Chrome CDP 就绪', up, 'port=' + CDP_PORT);
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page') || pages[0];
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('Page.bringToFront');

    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const setLS = async (pairs) => {
      await nav(BASE + '/index.html', "document.readyState === 'complete'", 'LS setup');
      const body = pairs.map(p => p.remove
        ? "localStorage.removeItem('" + p.k + "')"
        : "localStorage.setItem('" + p.k + "', " + JSON.stringify(p.v) + ")").join(';');
      const r = await cdp.evalJs("(function(){ try { " + body + "; return 'ok'; } catch(e){ return 'ERR ' + e.message; } })()");
      if (r !== 'ok') throw new Error('setLS 失败: ' + r);
    };
    // 悬停模拟（announce-hover 先例）：必须先 move 到 (5,5) 再移到目标中心，否则 mouseenter 不触发
    const move = async (x, y) => { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await sleep(80); };
    const rectCenter = async (sel) => {
      const s = await cdp.evalJs("(function(){ var el = document.querySelector(" + JSON.stringify(sel) + "); " +
        "if (!el) return JSON.stringify({ absent: true }); var r = el.getBoundingClientRect(); " +
        "return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }); })()");
      const o = JSON.parse(s);
      if (o.absent) throw new Error('rectCenter 元素缺失: ' + sel);
      return o;
    };
    const hoverNow = () => cdp.evalJs("(function(){ var card = document.querySelector('.mn-lv-hovercard'); " +
      "var pill = document.querySelector('#slati-sidebar .mn-lv-pill'); var badge = document.querySelector('#slati-sidebar .mn-lv-badge'); " +
      "if (!pill || !badge) return JSON.stringify({ absent: true }); " +
      "var pr = pill.getBoundingClientRect(); " +
      "var cr = card ? card.getBoundingClientRect() : null; " +
      "var tf = new DOMMatrixReadOnly(getComputedStyle(pill).transform); " +
      "var bar = card ? card.querySelector('div[style*=\"width\"]') : null; " +
      "return JSON.stringify({ cardExists: !!card, active: card ? card.classList.contains('active') : false, " +
      "opacity: card ? getComputedStyle(card).opacity : null, " +
      "badgeHover: badge.classList.contains('mn-lv-hover'), " +
      "pillScaleA: Math.round(tf.a * 1000) / 1000, pillScaleD: Math.round(tf.d * 1000) / 1000, " +
      "cardLeft: cr ? Math.round(cr.left) : null, cardRight: cr ? Math.round(cr.right) : null, " +
      "cardTop: cr ? Math.round(cr.top) : null, cardBottom: cr ? Math.round(cr.bottom) : null, " +
      "cardW: card ? card.offsetWidth : null, " +
      "pillRight: Math.round(pr.right), pillURight: Math.round(pr.right - (tf.a - 1) * pill.offsetWidth / 2), pillTop: Math.round(pr.top), pillH: Math.round(pr.height), " +
      "txt: card ? card.textContent : null, barWidth: bar ? bar.style.width : null, " +
      "vpW: window.innerWidth, vpH: window.innerHeight }); })()");
    const pillNow = () => cdp.evalJs("(function(){ var b = document.querySelector('#slati-sidebar .mn-lv-badge'); " +
      "if (!b) return JSON.stringify({ absent: true }); " +
      "var n = b.querySelector('.mn-lv-normal'); var p = b.querySelector('.mn-lv-pill'); " +
      "var fill = b.querySelector('.mn-lv-fill'); var num = b.querySelector('.mn-lv-pill-num'); " +
      "var tag = b.querySelector('.mn-lv-pill-tag'); " +
      "var lw = b.querySelector('.mn-lv-wlightwave'); var lw2 = b.querySelector('.mn-lv-wlightwave2'); var wd = b.querySelector('.mn-lv-wdeep'); " +
      "var tagR = tag ? tag.getBoundingClientRect() : null; var ring = b.querySelector('.mn-lv-ring'); " +
      "var ringR = ring ? ring.getBoundingClientRect() : null; " +
      "var lwR = lw ? lw.getBoundingClientRect() : null; " +
      "var lw2R = lw2 ? lw2.getBoundingClientRect() : null; " +
      "var fillR = fill ? fill.getBoundingClientRect() : null; " +
      "return JSON.stringify({ txt: b.textContent, nDisplay: n ? getComputedStyle(n).display : null, " +
      "pDisplay: p ? getComputedStyle(p).display : null, fillStyle: fill ? fill.getAttribute('style') : null, " +
      "num: num ? num.textContent : null, tag: tag ? tag.textContent : null, " +
      "waveKids: fill ? fill.children.length : -1, " +
      "lwAnim: lw ? getComputedStyle(lw).animationName + '/' + getComputedStyle(lw).animationDuration : null, " +
      "lwMask: lw ? getComputedStyle(lw).maskSize : null, " +
      "lwRepeat: lw ? getComputedStyle(lw).maskRepeat : null, " +
      "lwMaskImg: lw ? (getComputedStyle(lw).maskImage || '') : null, " +
      "lwH: lw ? Math.round(lwR.height) : -1, " +
      "lwW: lw ? Math.round(lwR.width) : -1, " +
      "lwRelFill: (lw && fill) ? Math.round(lwR.top - fillR.top) : null, " +
      "lw2Anim: lw2 ? getComputedStyle(lw2).animationName + '/' + getComputedStyle(lw2).animationDuration : null, " +
      "lw2Mask: lw2 ? getComputedStyle(lw2).maskSize : null, " +
      "lw2H: lw2 ? Math.round(lw2R.height) : -1, " +
      "lw2W: lw2 ? Math.round(lw2R.width) : -1, " +
      "lw2RelFill: (lw2 && fill) ? Math.round(lw2R.top - fillR.top) : null, " +
      "lw2Z: lw2 ? getComputedStyle(lw2).zIndex : null, " +
      "lwZ: lw ? getComputedStyle(lw).zIndex : null, " +
      "deepZ: wd ? getComputedStyle(wd).zIndex : null, " +
      "fillZ: fill ? getComputedStyle(fill).zIndex : null, " +
      "lwBg: lw ? getComputedStyle(lw).backgroundColor : null, " +
      "lw2Bg: lw2 ? getComputedStyle(lw2).backgroundColor : null, " +
      "deepBg: wd ? getComputedStyle(wd).backgroundColor : null, " +
      "dwAbsent: !b.querySelector('.mn-lv-wdeepwave'), " +
      "wlAbsent: !b.querySelector('.mn-lv-wlight'), " +
      "tagAbove: (tagR && ringR) ? tagR.bottom <= ringR.top + 0.5 : null, " +
      "barKids: n ? n.children.length : -1, xp: JSON.parse(localStorage.getItem('slati_xp') || '0') }); })()");
    const geoNow = () => cdp.evalJs("(function(){ var pill = document.querySelector('#slati-sidebar .mn-lv-pill'); " +
      "var ring = document.querySelector('#slati-sidebar .mn-lv-ring'); " +
      "var av = document.querySelector('#slati-sidebar .user-info-bar .avatar'); " +
      "var mod = document.querySelector('#slati-sidebar .user-module'); var bd = document.querySelector('#slati-sidebar .mn-lv-badge'); " +
      "var sb = document.querySelector('#slati-sidebar'); var nav = document.querySelector('#slati-sidebar .nav-item'); " +
      "if (!pill || !ring || !av || !mod || !bd || !sb) return JSON.stringify({ absent: true }); " +
      "var p = pill.getBoundingClientRect(), r = ring.getBoundingClientRect(), a = av.getBoundingClientRect(), m = mod.getBoundingClientRect(); " +
      "var s = sb.getBoundingClientRect(); " +
      "var overlap = !(p.right <= a.left || p.left >= a.right || p.bottom <= a.top || p.top >= a.bottom); " +
      "return JSON.stringify({ pw: Math.round(p.width), ph: Math.round(p.height), rw: Math.round(r.width), rh: Math.round(r.height), " +
      "aw: Math.round(a.width), ah: Math.round(a.height), gap: Math.round((p.top - a.bottom) * 10) / 10, " +
      "inMod: p.left >= m.left && p.right <= m.right, inSidebar: p.left >= s.left - 0.5 && p.right <= s.right + 0.5, overlap: overlap, " +
      "alignMod: Math.round(p.left - m.left) + '/' + Math.round(m.right - p.right), " +
      "ringRadius: getComputedStyle(ring).borderRadius, badgeMarginTop: getComputedStyle(bd).marginTop, " +
      "navW: nav ? Math.round(nav.getBoundingClientRect().width) : -1 }); })()");

    // ── 种子：先让页面写下每日登录日期键（+5），再固定 XP=100 ──
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt-605', displayName: 'Pill Tester', citizenId: 'CIT-605', tier: 'free' }) },
      { k: 'slati_xp', v: '0' },
      { k: 'slati_xp_gained', remove: true },
      { k: 'slati_xp_last_login', remove: true },
      { k: 'slati_sidebar_collapsed', remove: true },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(种子)');
    await cdp.evalJs("localStorage.setItem('slati_xp', '100')");
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S1)');
    let r = await pillNow();
    const s1 = JSON.parse(r);
    ok('S1 展开态零变化：原徽章可见（Lv.1·旅行者 100/1200 + 8% 条）+ 药丸默认隐藏 + 头像 40×40',
      s1.txt.indexOf('Lv.1 · 旅行者') !== -1 && s1.txt.indexOf('100 / 1200 XP') !== -1 &&
      s1.nDisplay !== 'none' && s1.pDisplay === 'none' && s1.barKids === 2 && s1.xp === 100, r);
    let g = await geoNow();
    const g1 = JSON.parse(g);
    ok('S1b 展开态头像 40×40（折叠前基准）', g1.aw === 40 && g1.ah === 40 && g1.badgeMarginTop === '8px', g);
    ok('H0 悬停门控：headless 桌面 matchMedia(hover:hover)+(pointer:fine) === true（整组悬停案前置条件）',
      await cdp.evalJs("!!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches)") === true);

    // ── S2 折叠切换 ──
    await cdp.evalJs("window._slatiToggleSidebar()");
    await sleep(500);
    r = await pillNow();
    const s2 = JSON.parse(r);
    ok('S2 折叠切换：normal 隐藏 + 药丸 flex + 水位 8% + 中间 LV/1 + 三层水件套——深蓝水 wdeep（z:-2）+慢浪 wlightwave2（z:-1/2.5s/浅色）+快浪 wlightwave（z:0/2.2s/深蓝，mask 80px 16px repeat-x + 波形 16px 高 + strip 400%=160px）+ 两浪同顶 -12px（浪位抬高 4px 保持）+ 水深蓝+快浪深蓝（lwBg === deepBg）+慢浪浅色（lw2Bg 不同色且亮于 deepBg）+ fill z:0 stacking context + 浅水层/深浪已删零残留 + LV 在杯上方',
      s2.nDisplay === 'none' && s2.pDisplay === 'flex' &&
      s2.fillStyle === 'height:8%' &&
      s2.num === '1' && s2.tag === 'LV' && s2.waveKids === 3 &&
      s2.lwAnim === 'mn-lv-wave/2.2s' &&
      s2.lw2Anim === 'mn-lv-wave/2.5s' &&
      s2.lwMask === '80px 16px' && s2.lwRepeat === 'repeat-x' &&
      s2.lw2Mask === '80px 16px' &&
      s2.lwMaskImg && s2.lwMaskImg !== 'none' &&
      s2.lwH === 16 && s2.lwW === 160 &&
      s2.lw2H === 16 && s2.lw2W === 160 &&
      s2.lwRelFill === -12 && s2.lw2RelFill === -12 &&
      s2.lwBg !== null && s2.lwBg === s2.deepBg &&
      s2.lw2Bg !== null && s2.lw2Bg !== s2.deepBg && rgbSum(s2.lw2Bg) > rgbSum(s2.deepBg) &&
      s2.lw2Z === '-1' && s2.lwZ === '0' && s2.deepZ === '-2' && s2.fillZ === '0' &&
      s2.dwAbsent === true && s2.wlAbsent === true &&
      s2.tagAbove === true, r);
    const clsOk = await cdp.evalJs("document.querySelector('#slati-sidebar').classList.contains('collapsed')");
    ok('S2b .app-sidebar.collapsed 类在位', clsOk === true);

    // ── S3 药丸几何零挤压 ──
    g = await geoNow();
    const g2 = JSON.parse(g);
    ok('S3 药丸几何：药丸 48×116 + 水杯 44×84 胶囊（border-radius 999px）+ 头像 32×32 不挤压 + 上下间距 8px（margin-top 0 生效）+ 零重叠 + 药丸 48=用户卡内容宽（模块 56−垫 8）与内容列齐平（alignMod 4/4）+ 收在 72px 侧栏列内零越界',
      g2.pw === 48 && g2.ph === 116 && g2.rw === 44 && g2.rh === 84 && g2.ringRadius === '999px' &&
      g2.aw === 32 && g2.ah === 32 &&
      g2.gap >= 7 && g2.gap <= 9 && g2.inMod === true && g2.inSidebar === true && g2.overlap === false && g2.badgeMarginTop === '0px' &&
      g2.alignMod === '4/4', g);

    // ── S4 水位进度刷新（折叠态保持）──
    await cdp.evalJs("window.SlatiDB.addXP('batt', 600)");
    await sleep(400);
    r = await pillNow();
    const s4 = JSON.parse(r);
    ok('S4 addXP +600（100→700=58%）：徽章重渲染水位 58% + 折叠态与等级保持（collapsed 不丢）',
      s4.fillStyle === 'height:58%' && s4.num === '1' && s4.xp === 700 &&
      await cdp.evalJs("document.querySelector('#slati-sidebar').classList.contains('collapsed')") === true, r);

    // ── S8 悬停开卡（XP=700）──
    await move(5, 5);
    let pc = await rectCenter('#slati-sidebar .mn-lv-pill');
    await move(pc.x, pc.y);
    await waitFor(cdp, "document.querySelector('.mn-lv-hovercard') && document.querySelector('.mn-lv-hovercard').classList.contains('active')", 1500, '悬停卡出现');
    await sleep(450);
    r = await hoverNow();
    const h8 = JSON.parse(r);
    ok('S8 悬停开卡：卡片 active+opacity 1+徽章 hover 类+药丸 scale(1.12)（a/d∈[1.115,1.125]）+ 卡片左=药丸未缩放右缘+10 ±2（pillURight 按 transform 外扩反算）+视口内（右≤vpW/顶≥8/底≤vpH-8）+ 宽 200 + 内容 Lv.1 · 旅行者/700 / 1200 XP + 经验条 58%',
      h8.cardExists === true && h8.active === true && h8.opacity === '1' && h8.badgeHover === true &&
      h8.pillScaleA >= 1.115 && h8.pillScaleA <= 1.125 && h8.pillScaleD >= 1.115 && h8.pillScaleD <= 1.125 &&
      Math.abs(h8.cardLeft - (h8.pillURight + 10)) <= 2 &&
      h8.cardRight <= h8.vpW && h8.cardTop >= 8 && h8.cardBottom <= h8.vpH - 8 &&
      h8.cardW === 200 &&
      h8.txt !== null && h8.txt.indexOf('Lv.1 · 旅行者') !== -1 && h8.txt.indexOf('700 / 1200 XP') !== -1 &&
      h8.barWidth === '58%', r);

    // ── S9 卡片驻留（防缝隙闪烁）──
    await move(Math.round(h8.cardLeft + h8.cardW / 2), Math.round((h8.cardTop + h8.cardBottom) / 2));
    await sleep(350);
    r = await hoverNow();
    const h9 = JSON.parse(r);
    ok('S9 卡片驻留：鼠标移到卡片上 >200ms 宽限后卡片仍 active+opacity 1（badge→卡片 10px 缝隙零闪烁）',
      h9.active === true && h9.opacity === '1' && h9.badgeHover === true, r);

    // ── S10 离开收卡 ──
    await move(5, 5);
    await sleep(450);
    r = await hoverNow();
    const h10 = JSON.parse(r);
    ok('S10 离开收卡：active 摘除+opacity 0+徽章 hover 类摘除+药丸 transform 回单位矩阵（a/d=1）',
      h10.active === false && h10.opacity === '0' && h10.badgeHover === false &&
      h10.pillScaleA === 1 && h10.pillScaleD === 1, r);

    // ── S11 重渲染重开 + 内容新鲜 ──
    await move(pc.x, pc.y);
    await waitFor(cdp, "document.querySelector('.mn-lv-hovercard') && document.querySelector('.mn-lv-hovercard').classList.contains('active')", 1500, '悬停卡再开(S11)');
    await sleep(450);
    await cdp.evalJs("window.SlatiDB.addXP('batt', 300)");
    await sleep(400);
    r = await hoverNow();
    const h11a = JSON.parse(r);
    // Chrome 静止指针下 DOM 替换会合成 mouseenter 自动重开卡（renderSidebar 先收后开）——
    // 关键守卫=若开则内容必新鲜（1000 / 83%）；陈旧（700 / 58%）即真红
    const h11aFresh = h11a.active === false ||
      (h11a.txt !== null && h11a.txt.indexOf('1000 / 1200 XP') !== -1 && h11a.barWidth === '83%');
    await move(5, 5);
    await sleep(450);
    r = await hoverNow();
    const h11b = JSON.parse(r);
    const h11bHidden = h11b.active === false && h11b.badgeHover === false;
    await move(pc.x, pc.y);
    await waitFor(cdp, "document.querySelector('.mn-lv-hovercard') && document.querySelector('.mn-lv-hovercard').classList.contains('active')", 1500, '悬停卡三开(S11)');
    await sleep(450);
    r = await hoverNow();
    const h11c = JSON.parse(r);
    ok('S11 重渲染重开+内容新鲜：addXP +300（700→1000=83%）后若合成 mouseenter 重开卡则内容必新鲜（1000/83%）→ 移开必收（active false）→ 再悬停重开内容新鲜 Lv.1 · 旅行者/1000 / 1200 XP + 83%',
      h11aFresh === true &&
      h11bHidden === true &&
      h11c.active === true && h11c.badgeHover === true &&
      h11c.txt !== null && h11c.txt.indexOf('Lv.1 · 旅行者') !== -1 && h11c.txt.indexOf('1000 / 1200 XP') !== -1 &&
      h11c.barWidth === '83%', r);

    // ── S12 折叠切换收卡 ──
    await cdp.evalJs("window._slatiToggleSidebar()");
    await sleep(300);
    r = await hoverNow();
    const h12 = JSON.parse(r);
    const h12Gone = h12.active === false && h12.badgeHover === false;
    await cdp.evalJs("window._slatiToggleSidebar()");
    await sleep(500);
    ok('S12 折叠切换收卡：展开时卡片收+徽章类摘；再切回折叠态（collapsed 在位）',
      h12Gone === true &&
      await cdp.evalJs("document.querySelector('#slati-sidebar').classList.contains('collapsed')") === true, r);

    // ── S5 满级 ──
    await cdp.evalJs("localStorage.setItem('slati_xp', '1228800')");
    await cdp.send('Page.reload');
    await waitFor(cdp, "!!document.querySelector('#slati-sidebar .mn-lv-badge')", 20000, '满级重载');
    await sleep(700);
    r = await pillNow();
    const s5 = JSON.parse(r);
    ok('S5 满级 Lv12·传奇：展开视图无条（kids=1）+ 水位 100% + 中间 12 + 折叠偏好重载保持（collapsed 在位）',
      s5.txt.indexOf('Lv.12 · 传奇') !== -1 && s5.txt.indexOf('1228800 XP') !== -1 && s5.txt.indexOf(' / ') === -1 &&
      s5.barKids === 1 && s5.fillStyle === 'height:100%' && s5.num === '12' &&
      await cdp.evalJs("document.querySelector('#slati-sidebar').classList.contains('collapsed')") === true, r);

    // ── S6 窄列 floating（64px 列）药丸 48 收列内（右边线 1px 致模块 47→右溢 1px 可忽略）──
    await cdp.evalJs("document.querySelector('#slati-sidebar').classList.add('floating')");
    await sleep(400);
    g = await geoNow();
    const g3 = JSON.parse(g);
    ok('S6 floating 折叠 64px 列：药丸 48×116（floating 右边线 1px 致模块 47→右溢 1px 可忽略=inMod false）+ 仍收在 64px 列内零越界 + 与头像零重叠',
      g3.pw === 48 && g3.ph === 116 && g3.inMod === false && g3.inSidebar === true && g3.overlap === false, g);

    // ── S13 floating 悬停开卡（满级）──
    await move(5, 5);
    pc = await rectCenter('#slati-sidebar .mn-lv-pill');
    await move(pc.x, pc.y);
    await waitFor(cdp, "document.querySelector('.mn-lv-hovercard') && document.querySelector('.mn-lv-hovercard').classList.contains('active')", 1500, 'floating 悬停卡出现');
    await sleep(450);
    r = await hoverNow();
    const h13 = JSON.parse(r);
    ok('S13 floating 悬停开卡：卡片 active+左=药丸右+10 ±2+视口内+药丸 scale ≈1.12+内容 Lv.12 · 传奇/1228800 XP（满级无条）',
      h13.active === true && h13.badgeHover === true &&
      h13.pillScaleA >= 1.115 && h13.pillScaleA <= 1.125 &&
      Math.abs(h13.cardLeft - (h13.pillURight + 10)) <= 2 &&
      h13.cardRight <= h13.vpW && h13.cardTop >= 8 && h13.cardBottom <= h13.vpH - 8 &&
      h13.txt !== null && h13.txt.indexOf('Lv.12 · 传奇') !== -1 && h13.txt.indexOf('1228800 XP') !== -1 &&
      h13.barWidth === null, r);
    await move(5, 5);
    await sleep(450);

    // ── S7 展开恢复 ──
    await cdp.evalJs("document.querySelector('#slati-sidebar').classList.remove('floating'); window._slatiToggleSidebar()");
    await sleep(500);
    r = await pillNow();
    const s7 = JSON.parse(r);
    ok('S7 展开恢复：normal 复显 + 药丸回隐藏 + margin-top 回 8px',
      s7.nDisplay !== 'none' && s7.pDisplay === 'none' && s7.txt.indexOf('Lv.12 · 传奇') !== -1 &&
      await cdp.evalJs("getComputedStyle(document.querySelector('#slati-sidebar .mn-lv-badge')).marginTop") === '8px', r);

    // ── S14 展开态零卡片 ──
    await move(5, 5);
    pc = await rectCenter('#slati-sidebar .mn-lv-badge');
    await move(pc.x, pc.y);
    await sleep(300);
    r = await hoverNow();
    const h14 = JSON.parse(r);
    ok('S14 展开态零卡片：悬停展开徽章 → 卡片不激活+徽章无 hover 类（原徽章已可见，零卡片）',
      h14.active === false && h14.badgeHover === false, r);
    await move(5, 5);

    ok('E1 全程零 Runtime exception + 零 console error',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      (cdp.errs.slice(0, 3).join(' | ') + cdp.consoleErrs.slice(0, 3).join(' | ')).slice(0, 300));
    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }

  console.log('\nlvpill 电池：' + PASS + ' ✅ / ' + FAIL + ' ❌');
  process.exit(FAIL ? 1 : 0);
})().catch((e) => { console.error('电池崩溃：' + (e && e.stack || e)); process.exit(1); });
