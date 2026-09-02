/* ================================================================
   liquid-glass.js v2 — 全站液态玻璃（2026-09-02，站点 v0.2.9.0）
   ----------------------------------------------------------------
   移植自 rdev/liquid-glass-react 的 Apple Liquid Glass 效果，纯 CSS+JS（ES5），
   站点零 React。v2 扩展为全站玻璃面统一引擎：
     · 双 SVG 滤镜：#lg-glass-filter（大面，scale 70）、#lg-glass-filter-sm
       （编辑器小卡，scale 35——feDisplacementMap scale 是 px 单位，-70 在
       194px 卡上≈35% 宽会暴烈）
     · 弹性模式（卡片）：鼠标靠近拉伸回弹+高光跟随，rAF lerp 逐帧写 6 个 CSS
       变量 + inline transform（与外部旋转 base 组合，不覆盖编辑器 rotate）
     · 静态模式（大面板）：只注入折射层+高光层，零 rAF 零 transform 写——
       面板自身动画（modal scale/plan hover/mre 滑入）原样保留
     · 层挂 z:-1：垫在父半透明底之上、内容之下（父须建层叠上下文，见 CSS）
   CSS 变量（弹性帧写）：--lg-tx/--lg-ty（px）、--lg-sx/--lg-sy、--lg-px/--lg-py（%）。
   公开 API：window.LG = { apply, remove, scan, version, _els }——动态内容（编辑器
   卡片/动态面板）用 LG.apply/LG.scan 挂载。
   优雅降级：滤镜缺失时 .lg-active/.lg-static 不挂、面保持原样；
   prefers-reduced-motion：全部按静态玻璃处理，不跟踪鼠标。
   ================================================================ */
(function () {
  'use strict';

  var MAP = 'data:image/jpeg;base64,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EkziomgGgkoxZGgxZFQFQlYnQHRdPfj/10KCSCKESCNiVkViPSLpD0h6I0Q0I0A2IoBWBIJIBKBIJoJIJ2R2J0JWBUJ0JUB0XTv479dFZDYiglYigkhEgjZFQjRFQjRFQjQigFYigHYigmgEgmglYlYnQlQlYlQHQlQnQ9P/kf1yVkNiNCNkNiVENiNiViNEViNkVCVgKCViViViSCViSCVgdCViVCViVCdgVCVCdD1D+U/XBWQ2I0I2Q2JUQ2I0JWQ0I2JUQ2JUI2JUI2J0JWJWJWA2R0BWJ0I2JUJ2BUJUJ0P//EABkQAQEBAQEBAAAAAAAAAAAAAAECABEDEP/aAAgBAQABAgB1atWrVq1atWrVq1atWrVq1atWrVq1atWrVq+OrVq1atWrVq1atWrVq1atWrVq1atWrVq1atWrVq1atXxVppppppdWrVq1atWrVq1NNNNNNNNNNNPVWmmmmms6tWrVq1atWpppppppppppppp6q0000uc51atWrVq1ammmmmmmmmmmmmt1Vpppc5znVq1atWrVqaaaaaaaaaaaaaeqtNLnOc51atWrVq1ammmmmmmmmmmmmnqrS5znOc6tWrVq16222mmmmmmlVppp6tKuc5znOrVq1a9TbbbbTTTTTSq000qtLnOc5zq1atWrW0222200000qqqtKqrnOc5zq1atTbbbbbbbbTTTSqqqqqq5znOc6tTTTbbbbbbbbTTTSqqqqrlVznOctNNNtttttttttNNNNKqqqrqznKqrTTTTbbbbbbbbbTTTSqqqqrqznOc5aaaabbbbbbbbbaaaaVVVVVdWc5znVq1NNttttttttttNNKqqqudWc5znVq16tbbbbbbbbbbTTSqqqq5XVnOc6tWrVrb1tttttttttNNKqqqqrWrK5VWmmm22230bbbbbbaaaXOc5zlVa1KuVVppptttt9G22222mmlzlVznK6tWVVWmmmm2222222222mlznOc5znLWppVVWmmm22222229bTWrOc5znOcq1qaaVpWmm222222229erVqznOc5znKtatStK0rTbTTbbbberXr1as5znOc5aVpppppWlabaabbbb1ta9WrVqznOc5znU0rTTTTTTTTTbTTbbbTWvVq1as5znOdTTStNNNNNNNNNtNNtttN6tWvVq1ZznOrU00rTTTTTTTTTTTTTbTWvVq1atWrOc6tTTTStNNNNNNNNNNNtNNtNa9WrVq1Z1Z1NNNNNK1q1NNNNNNNNNNNtNatWrVq1atWrU00000rWrVq1atWrVq1alaaa1atWrVq1NNNammmmla1atWrVq1aterVq16tWrVnVqa1NK1qaaaVX/xAAWEAADAAAAAAAAAAAAAAAAAAAhgJD/2gAIAQEAAz8AaExf/8QAGhEBAQEBAQEBAAAAAAAAAAAAAQISEQADEP/aAAgBAgEBAgDx48ePHjx48ePHjx48ePHjx48ePHjx48ePHj86IiIiIiInjx48ePHjx48IiIiIj0oooooooooRERER73ve60UUUUUUVrWiiiiiihERERER73ve973ooooorRWiiiiihKERERER73ve973RRRWtFFFFFFCIiIiIiPe973ve60UUVrRRRRRRQiIlCIiI973ve973pRRWiiiiiiiiiiiiiiihEe973ve973RRWtFFFFFFFFFFFFFFFFFFa13ve973WitaKKKKKKKKKKKKKKKKKK1rWtd1rutFa1oooooooooosssooorWta1rWta1rRRRRRRRRZZZZZZZZZWta1rWta1rRRRRRRRRZZZZZZZZZZZZe9a1rWta1rWitaKLLLLLLLLLLLLLLLLL3rWta1rWtFbLLLLLLLLLLLLLLLLLLLL3vWta1rWita1ssssssss+hZZZZZZZZe961rWta0Vre97LLLLLLLLLLLPoWWWWWXrWta1oorWta3ssss+hZZZZ9Cyyyyyyyyiita1orWta1ve9llllllllllllllllFFa0VorWta1ve9llllllllllllllllllFFFaK1rWta1rWiyyyyyyyyyyyyiiiiiiitFFa1rWta1oosoosssssoooosoooorRRRWta1rWta0UUUUUWUUUUUUUUUUUVoooorWta1rWtaKKKKKKmiiiiiiiiiiiiiiitd73ve61oSiiipoqaKKKKKKKK0UUUVrve973vREREZoSihEooooorRRRRWtd73ve9EREREREoSiiiiitFllllla73ve9ERERERESiiiiiitH0PoWWWWVrXe96IiIiMoiJRRRRRRWjwlFFllllFFd6IiIiIlCUUUUUUUUUePHjx48ePCIiIiIiIiUUUUUUUUUUUePHjx48ePHjx48ePHjx48IiUUUUUUJRRRX//xAAWEQADAAAAAAAAAAAAAAAAAAABYJD/2gAIAQIBAz8AtEV7/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAECEP/aAAgBAwEBAgCtNNNNNNNNNNNNNNNNNNNNNNNNNNNNNcrTTTTTTTTTTTTTTTTTTTTTTTTTTTTTXKrTTTTTTTU000000000000000000001FVpppppqampqaaaaaaaaaaaaaaaaaaaa5Vaaaaampqampqammmmmmmmmmmlaaaaaaiq0001NTU1NTU1NTTTTTTTTTTSqqtNNNcqtNNSyzU1LNTU1NTTTTTTTTTSqqq001ytNLLLLNTU1NTU1NTbbbTTTTTSqqq001ytNLLLLLNTU1NTU3NttttNNNNNKqq001KrSyyyyyzU1NTU3Nzc02220000qqqqrSqqyyyyyzU1NTU3Nzc3NttttNNNKqqqqqqssssss1NTU3Nzc3NzbbbbTTTSqqqqqqqrLLLLLNTU1Nzc3Nzc22220000qqqqqqqqssss1NTU3Nzc3NzbbbbbTTSqqqqqqqqqqzU1NTc3Nzc3Nzbc22000qqqqqqqqqqqtTU3Nzc3Nzc3NtzbTTSqqqqrKqqqqqtNNzc23Nzc3Nzc3NTU1KqqqrKqqqqqtNNNNttzc3Nzc3NzU1NLLLLLKqqqqqqqq0022223Nzc3NzU1NSyyyyyyqqqqqqqrTTbbbbc3Nzc3NTU1LLLLLLKsqqqqqqrTTTTbbbc3Nzc1NTUsssssssqqqqqqrTTTTTbbbTc3NTU1NTUsssssqqqqqqqq0000222023NTU1NTUsssssqqqqqqqq000000003NTU1NTU1LLLLLNKrTSqqqqtNNNNNNtNNTU1NSzUssss00qq0qqqqrTTTTTTTTTU1NTUs1LLLNNNKrTTTSqqq00000000001NTU1LNTU0000qtNNNKqqqtNNNNNNNNTU1NTUs1NNNNNKss1NNNK00qtK0000001NNTU0s000000qq000001NKrStNNNNK1NNNNStNNNNNKqtNNNNNNNK0000000rU0000rTTTTTSq00000rTTTTTTTTTTTTTTTTStNNNNKr/xAAUEQEAAAAAAAAAAAAAAAAAAACg/9oACAEDAQM/AAAf/9k='; /* 构建时 sed 注入：standard 置换图 base64 data URI */

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var XLINK_NS = 'http://www.w3.org/1999/xlink';
  var ELASTICITY = 0.15;    /* 弹性系数（rdev 默认） */
  var ACTIVATION = 200;     /* 鼠标激活区半径 px（rdev 默认） */
  var LERP = 0.16;          /* 每帧平滑系数（≈ rdev 0.2s ease-out 手感） */
  var SPECULAR_DAMP = 0.6;  /* 高光跟随阻尼（rdev 1.0 高光会跑出卡外，收一点） */
  var RECT_TTL = 300;       /* 矩形缓存刷新间隔 ms（编辑器 20-50 卡时避免每像素全量重排读） */

  var els = [];
  var running = false;
  var reduced = false;
  var suppress = false;     /* 点击导航瞬间冻结 transform 写（保 transitions.js 出场动画） */

  /* 静态面（大面板：只玻璃不跟手）与弹性面（卡片：跟手拉伸）选择器图。
     静态先行——.adm-login 是 .card，静态先占不让弹性图拿走。 */
  var STATIC_SEL = '.sidebar-module, .auth-card, .modal-card, .team-modal-card, .plan-card, .rp-card, .glass-container, .editor-header, .mre-stage, .mre-side, .mre-panel, .stats-edit-panel, .context-menu, .text-toolbar, .font-panel, .studio-header, .adm-login';
  var ELASTIC_SEL = '.liquid-glass, .card, .metric-card, .account-personal, .account-team-wrap';

  /* ---------- SVG 滤镜注入（全页共享，双实例：大面 70 / 小卡 35） ---------- */
  function svgEl(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) {
      if (k === 'href') {
        n.setAttribute('href', attrs[k]);
        n.setAttributeNS(XLINK_NS, 'xlink:href', attrs[k]);
      } else {
        n.setAttribute(k, attrs[k]);
      }
    }
    return n;
  }

  function buildFilterDef(defs, id, s1, s2, s3) {
    var f = svgEl('filter', {
      id: id, x: '-35%', y: '-35%', width: '170%', height: '170%',
      colorInterpolationFilters: 'sRGB'
    });
    f.appendChild(svgEl('feImage', {
      x: '0', y: '0', width: '100%', height: '100%',
      result: 'DISPLACEMENT_MAP', preserveAspectRatio: 'xMidYMid slice', href: MAP
    }));
    /* 用置换图自身亮度做边缘掩膜（rdev：EDGE_INTENSITY → discrete alpha，中心干净边缘折射） */
    f.appendChild(svgEl('feColorMatrix', {
      in: 'DISPLACEMENT_MAP', type: 'matrix',
      values: '0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0 0 0 1 0',
      result: 'EDGE_INTENSITY'
    }));
    var edgeMask = svgEl('feComponentTransfer', { in: 'EDGE_INTENSITY', result: 'EDGE_MASK' });
    edgeMask.appendChild(svgEl('feFuncA', { type: 'discrete', tableValues: '0 0.1 1' }));
    f.appendChild(edgeMask);
    f.appendChild(svgEl('feOffset', { in: 'SourceGraphic', dx: '0', dy: '0', result: 'CENTER_ORIGINAL' }));
    /* 三通道不同位移量 = 色散（rdev standard 模式：70×-1 / 70×-1.1 / 70×-1.2，x=R y=B）；
       sm 实例按 35 等比（-35/-38.5/-42），小卡位移幅度同比例。 */
    f.appendChild(svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: String(s1), xChannelSelector: 'R', yChannelSelector: 'B', result: 'RED_DISPLACED' }));
    f.appendChild(svgEl('feColorMatrix', { in: 'RED_DISPLACED', type: 'matrix', values: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', result: 'RED_CHANNEL' }));
    f.appendChild(svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: String(s2), xChannelSelector: 'R', yChannelSelector: 'B', result: 'GREEN_DISPLACED' }));
    f.appendChild(svgEl('feColorMatrix', { in: 'GREEN_DISPLACED', type: 'matrix', values: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', result: 'GREEN_CHANNEL' }));
    f.appendChild(svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: String(s3), xChannelSelector: 'R', yChannelSelector: 'B', result: 'BLUE_DISPLACED' }));
    f.appendChild(svgEl('feColorMatrix', { in: 'BLUE_DISPLACED', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', result: 'BLUE_CHANNEL' }));
    f.appendChild(svgEl('feBlend', { in: 'GREEN_CHANNEL', in2: 'BLUE_CHANNEL', mode: 'screen', result: 'GB_COMBINED' }));
    f.appendChild(svgEl('feBlend', { in: 'RED_CHANNEL', in2: 'GB_COMBINED', mode: 'screen', result: 'RGB_COMBINED' }));
    f.appendChild(svgEl('feGaussianBlur', { in: 'RGB_COMBINED', stdDeviation: '0.3', result: 'ABERRATED_BLURRED' }));
    f.appendChild(svgEl('feComposite', { in: 'ABERRATED_BLURRED', in2: 'EDGE_MASK', operator: 'in', result: 'EDGE_ABERRATION' }));
    var inv = svgEl('feComponentTransfer', { in: 'EDGE_MASK', result: 'INVERTED_MASK' });
    inv.appendChild(svgEl('feFuncA', { type: 'table', tableValues: '1 0' }));
    f.appendChild(inv);
    f.appendChild(svgEl('feComposite', { in: 'CENTER_ORIGINAL', in2: 'INVERTED_MASK', operator: 'in', result: 'CENTER_CLEAN' }));
    f.appendChild(svgEl('feComposite', { in: 'EDGE_ABERRATION', in2: 'CENTER_CLEAN', operator: 'over' }));
    defs.appendChild(f);
  }

  function injectFilters() {
    if (document.getElementById('lg-glass-filter')) return true;
    var svg = svgEl('svg', { 'aria-hidden': 'true', 'style': 'position:absolute;width:0;height:0;overflow:hidden' });
    var defs = svgEl('defs', {});
    buildFilterDef(defs, 'lg-glass-filter', -70, -77, -84);
    buildFilterDef(defs, 'lg-glass-filter-sm', -35, -38.5, -42);
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return true;
  }

  /* ---------- 弹性面资格过滤（tilt/主题/组内成员/零尺寸不弹） ---------- */
  function elasticOk(el) {
    if (el.closest && el.closest('.tilt-container, .asset-panel')) return false;
    if (el.classList.contains('has-outer-bg') || el.classList.contains('has-card-bg-img')) return false;
    if (el.className && /card-edge-/.test(el.className)) return false;
    if (el.dataset && el.dataset.groupId && el.dataset.groupId !== '' && !el.classList.contains('group-single')) return false;
    if (el.offsetWidth === 0 || el.offsetHeight === 0) return false; /* display:none 不挂 */
    return true;
  }

  /* ---------- 每面初始化（幂等；静态不入 els 零 rAF） ---------- */
  function applyOn(el, opts) {
    if (el._lg || el._lgStatic) return false;
    var o = opts || {};
    var mode = reduced ? 'static' : (o.mode || 'elastic');
    var bd = document.createElement('div');
    bd.className = 'lg-backdrop';
    bd.setAttribute('aria-hidden', 'true');
    var sp = document.createElement('div');
    sp.className = 'lg-specular';
    sp.setAttribute('aria-hidden', 'true');
    /* DOM 序 bd→sp：两层同 z:-1 时后插的画在上，高光必须盖在背层模糊之上 */
    el.insertBefore(sp, el.firstChild);
    el.insertBefore(bd, sp);
    if (o.filterId) bd.style.filter = 'url(#' + o.filterId + ')'; /* 小卡用 sm 滤镜，CSS 默认大面滤镜 */
    if (mode === 'static') {
      el.classList.add('lg-static');
      el._lgStatic = true;
      return true;
    }
    el.classList.add('lg-active');
    el._lg = {
      tx: 0, ty: 0, sx: 1, sy: 1, px: 50, py: 50,
      ttx: 0, tty: 0, tsx: 1, tsy: 1, tpx: 50, tpy: 50,
      rect: null, rectAt: 0, base: '', lastWrite: '', guarded: false, origTransition: ''
    };
    els.push(el);
    return true;
  }

  /* ---------- 摘除（编辑器可选调用；主路径靠 frame 剪枝） ---------- */
  function remove(el) {
    if (!el) return;
    for (var i = el.childNodes.length - 1; i >= 0; i--) {
      var c = el.childNodes[i];
      if (c.nodeType === 1 && (c.className === 'lg-backdrop' || c.className === 'lg-specular')) el.removeChild(c);
    }
    el.classList.remove('lg-active');
    el.classList.remove('lg-static');
    if (el._lg) {
      for (var j = els.length - 1; j >= 0; j--) {
        if (els[j] === el) els.splice(j, 1);
      }
    }
    el._lg = null;
    el._lgStatic = null;
  }

  /* ---------- 扫描挂载（静态先行；可重复调用，幂等） ---------- */
  function scan(root) {
    injectFilters();
    var r = root || document;
    var stat = r.querySelectorAll(STATIC_SEL);
    for (var i = 0; i < stat.length; i++) applyOn(stat[i], { mode: 'static' });
    var e = r.querySelectorAll(ELASTIC_SEL);
    for (var j = 0; j < e.length; j++) {
      if (elasticOk(e[j])) applyOn(e[j], { mode: 'elastic' });
    }
  }

  /* ---------- 矩形缓存（300ms TTL；scroll/resize 失效） ---------- */
  function rectOf(el) {
    var s = el._lg;
    var now = Date.now();
    if (!s.rect || now - s.rectAt > RECT_TTL) {
      s.rect = el.getBoundingClientRect();
      s.rectAt = now;
    }
    return s.rect;
  }

  /* ---------- transition 守卫：transitions.js 给每张 .card 永久留
     inline `transition: ... transform 0.4s ...`，弹性逐帧写会被拖成 0.4s 橡皮筋。
     首次真实鼠标交互时惰性追加 `, transform 0s`（后写条目赢）；点击导航时
     onClick 恢复原串 + 冻结写，保出场动画。 ---------- */
  function guardTransition(el, s) {
    if (s.guarded) return;
    s.guarded = true;
    s.origTransition = el.style.transition || '';
    var cs = '';
    try { cs = window.getComputedStyle(el).transition || ''; } catch (err) { cs = ''; }
    if (cs === 'none' || cs === '') el.style.transition = 'transform 0s linear 0s';
    else el.style.transition = cs + ', transform 0s';
  }

  /* ---------- 鼠标物理（rdev 公式逐条移植） ---------- */
  function computeTargets(el, cx, cy) {
    var s = el._lg;
    guardTransition(el, s);
    var r = rectOf(el);
    var mx = cx - (r.left + r.width / 2);
    var my = cy - (r.top + r.height / 2);
    var ox = (mx / r.width) * 100;
    var oy = (my / r.height) * 100;
    var edx = Math.max(0, Math.abs(mx) - r.width / 2);
    var edy = Math.max(0, Math.abs(my) - r.height / 2);
    var ed = Math.sqrt(edx * edx + edy * edy);
    var fade = ed > ACTIVATION ? 0 : 1 - ed / ACTIVATION;
    var cd = Math.sqrt(mx * mx + my * my);
    var I = Math.min(cd / 300, 1) * ELASTICITY * fade;
    var nx = cd > 0.001 ? mx / cd : 0;
    var ny = cd > 0.001 ? my / cd : 0;
    s.tsx = Math.max(0.8, 1 + Math.abs(nx) * I * 0.3 - Math.abs(ny) * I * 0.15);
    s.tsy = Math.max(0.8, 1 + Math.abs(ny) * I * 0.3 - Math.abs(nx) * I * 0.15);
    s.ttx = mx * ELASTICITY * 0.1 * fade;
    s.tty = my * ELASTICITY * 0.1 * fade;
    s.tpx = 50 + ox * SPECULAR_DAMP;
    s.tpy = 50 + oy * SPECULAR_DAMP;
  }

  function restTargets(el) {
    var s = el._lg;
    s.ttx = 0; s.tty = 0; s.tsx = 1; s.tsy = 1; s.tpx = 50; s.tpy = 50;
  }

  /* ---------- rAF 平滑循环（React 原版靠 CSS transition 0.2s，这里用逐帧 lerp）
     写 inline transform 与外部 base 组合（编辑器 rotate / transitions.js 出场
     目标），外部改写（cur ≠ lastWrite）自动成为新 base。 ---------- */
  function frame() {
    var any = false;
    for (var i = els.length - 1; i >= 0; i--) {
      var el = els[i];
      var s = el._lg;
      if (!el.isConnected) { els.splice(i, 1); continue; }
      /* 组内成员：卡面由组背景接管（v10.28.17.2 口径），变形归零保组轮廓 */
      var grouped = el.dataset && el.dataset.groupId && el.dataset.groupId !== '' && !el.classList.contains('group-single');
      if (grouped) {
        if (s.tx !== 0 || s.ty !== 0 || s.sx !== 1 || s.sy !== 1) {
          s.tx = 0; s.ty = 0; s.sx = 1; s.sy = 1; s.px = 50; s.py = 50;
          s.ttx = 0; s.tty = 0; s.tsx = 1; s.tsy = 1; s.tpx = 50; s.tpy = 50;
          el.style.transform = s.base || '';
        }
        continue;
      }
      s.tx += (s.ttx - s.tx) * LERP;
      s.ty += (s.tty - s.ty) * LERP;
      s.sx += (s.tsx - s.sx) * LERP;
      s.sy += (s.tsy - s.sy) * LERP;
      s.px += (s.tpx - s.px) * LERP;
      s.py += (s.tpy - s.py) * LERP;
      var st = el.style;
      st.setProperty('--lg-tx', s.tx.toFixed(2) + 'px');
      st.setProperty('--lg-ty', s.ty.toFixed(2) + 'px');
      st.setProperty('--lg-sx', s.sx.toFixed(3));
      st.setProperty('--lg-sy', s.sy.toFixed(3));
      st.setProperty('--lg-px', s.px.toFixed(2) + '%');
      st.setProperty('--lg-py', s.py.toFixed(2) + '%');
      if (!suppress) {
        var cur = el.style.transform || '';
        if (!s.lastWrite) s.base = cur;
        else if (cur !== s.lastWrite) s.base = cur;
        st.transform = (s.base ? s.base + ' ' : '') +
          'translate3d(' + s.tx.toFixed(2) + 'px,' + s.ty.toFixed(2) + 'px,0)' +
          ' scaleX(' + s.sx.toFixed(3) + ') scaleY(' + s.sy.toFixed(3) + ')';
        s.lastWrite = st.transform;
      }
      if (Math.abs(s.ttx - s.tx) > 0.01 || Math.abs(s.tty - s.ty) > 0.01 ||
          Math.abs(s.tsx - s.sx) > 0.001 || Math.abs(s.tsy - s.sy) > 0.001 ||
          Math.abs(s.tpx - s.px) > 0.01 || Math.abs(s.tpy - s.py) > 0.01) any = true;
    }
    running = any;
    if (any) window.requestAnimationFrame(frame);
  }

  function wake() {
    if (!running) { running = true; window.requestAnimationFrame(frame); }
  }

  /* ---------- 事件 ---------- */
  function onMove(e) {
    suppress = false;
    for (var i = 0; i < els.length; i++) computeTargets(els[i], e.clientX, e.clientY);
    wake();
  }
  function onLeave() {
    for (var i = 0; i < els.length; i++) restTargets(els[i]);
    wake();
  }
  function onClick() {
    /* 点击（可能触发导航）：解守卫恢复出场过渡 + 冻结本帧写（transitions.js
       随后写出场 transform，不再被覆盖）；下一次 mousemove 自动解冻重守卫 */
    suppress = true;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var s = el._lg;
      if (s.guarded) {
        el.style.transition = s.origTransition;
        s.guarded = false;
      }
      restTargets(el);
    }
  }
  function onScroll() {
    for (var i = 0; i < els.length; i++) els[i]._lg.rect = null;
  }
  function onResize() { onScroll(); }

  function init() {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    scan(document);
    wake(); /* 首帧把静止值写进 CSS 变量/transform（电池可断言确定初值） */
    if (!reduced) {
      window.addEventListener('mousemove', onMove, { passive: true });
      document.addEventListener('mouseleave', onLeave);
      document.addEventListener('click', onClick, true);
      window.addEventListener('scroll', onScroll, { capture: true, passive: true });
      window.addEventListener('resize', onResize);
    }
  }

  window.LG = {
    apply: applyOn,
    remove: remove,
    scan: scan,
    version: 'v0.2.9.0',
    _els: function () { return els.length; } /* 电池断言用 */
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
