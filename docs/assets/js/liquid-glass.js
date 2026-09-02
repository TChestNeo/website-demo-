/* ================================================================
   liquid-glass.js — 液态玻璃效果（2026-09-02，站点 v0.2.8.0）
   ----------------------------------------------------------------
   移植自 rdev/liquid-glass-react 的 Apple Liquid Glass 效果，纯 CSS+JS（ES5），
   站点零 React。用法：给任意卡/面板挂 class="liquid-glass"，脚本自动注入：
     · 共享 SVG 滤镜 #lg-glass-filter（置换图折射 + 三通道色散 + 边缘掩膜）
     · .lg-backdrop 折射层 + .lg-specular 高光层（均 pointer-events:none 不挡点击）
   CSS 变量（脚本每帧写入）：--lg-tx/--lg-ty（弹性位移 px）、--lg-sx/--lg-sy（方向
   缩放，下限 0.8）、--lg-px/--lg-py（高光跟随 %）。
   滤镜注入成功后挂 .lg-active，滤镜缺失时卡片保持原样——优雅降级。
   prefers-reduced-motion：只留静态玻璃，不跟踪鼠标。
   ================================================================ */
(function () {
  'use strict';

  var MAP = 'data:image/jpeg;base64,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cUAUAkEkziomgGgkoxZGgxZFQFQlYnQHRdPfj/10KCSCKESCNiVkViPSLpD0h6I0Q0I0A2IoBWBIJIBKBIJoJIJ2R2J0JWBUJ0JUB0XTv479dFZDYiglYigkhEgjZFQjRFQjRFQjQigFYigHYigmgEgmglYlYnQlQlYlQHQlQnQ9P/kf1yVkNiNCNkNiVENiNiViNEViNkVCVgKCViViViSCViSCVgdCViVCViVCdgVCVCdD1D+U/XBWQ2I0I2Q2JUQ2I0JWQ0I2JUQ2JUI2JUI2J0JWJWJWA2R0BWJ0I2JUJ2BUJUJ0P//EABkQAQEBAQEBAAAAAAAAAAAAAAECABEDEP/aAAgBAQABAgB1atWrVq1atWrVq1atWrVq1atWrVq1atWrVq+OrVq1atWrVq1atWrVq1atWrVq1atWrVq1atXxVppppppdWrVq1atWrVq1NNNNNNNNNNNPVWmmmmms6tWrVq1atWpppppppppppppp6q0000uc51atWrVq1ammmmmmmmmmmmmt1Vpppc5znVq1atWrVqaaaaaaaaaaaaaeqtNLnOc51atWrVq1ammmmmmmmmmmmmnqrS5znOc6tWrVq16222mmmmmmlVppp6tKuc5znOrVq1a9TbbbbTTTTTSq000qtLnOc5zq1atWrW0222200000qqqtKqrnOc5zq1atTbbbbbbbbTTTSqqqqqq5znOc6tTTTbbbbbbbbTTTSqqqqrlVznOctNNNtttttttttNNNNKqqqrqznKqrTTTTbbbbbbbbbTTTSqqqqrqznOc5aaaabbbbbbbbbaaaaVVVVVdWc5znVq1NNttttttttttNNKqqqqudWc5znVq16tbbbbbbbbbbTTSqqqq5XVnOc6tWrVrb1tttttttttNNKqqqqrWrK5VWmmm2230bbbbbbaaaXOc5zlVa1KuVVppptttt9G22222mmlzlVznK6tWVVWmmmm2222222222mlznOc5znLWppVVWmmm22222229bTWrOc5znOcq1qaaVpWmm222222229erVqznOc5znKtatStK0rTbTTbbbberXr1as5znOc5aVpppppWlabaabbbb1ta9WrVnOc5znU0rTTTTTTTTTbTTbbbTWvVq1as5znOdTTStNNNNNNNNNtNNtttN6tWvVq1ZznOrU00rTTTTTTTTTTTTTbTWvVq1atWrOc6tTTTStNNNNNNNNNNtNNtNa9WrVq1Z1Z1NNNNNK1q1NNNNNNNNNNNtNatWrVq1atWrU00000rWrVq1atWrVq1alaaa1atWrVq1NNNammmmla1atWrVq1aterVq16tWrVnVqa1NK1qaaaVX/xAAWEAADAAAAAAAAAAAAAAAAAAAhgJD/2gAIAQEAAz8AaExf/8QAGhEBAQEBAQEBAAAAAAAAAAAAAQISEQADEP/aAAgBAgEBAgDx48ePHjx48ePHjx48ePHjx48ePHjx48ePHj86IiIiIiInjx48ePHjx48IiIiIj0oooooooooRERER73ve60UUUUUUVrWiiiiiihERERER73ve97ooooorRWiiiiihKERERER73ve973RRRRWtFFFFFFCIiIiIiPe973ve60UUVrRRRRRRQiIlCIiI973ve973pRRWiiiiiiiiiiiiiiihEe973ve973RRWtFFFFFFFFFFFFFFFFFFa13ve973WitaKKKKKKKKKKKKKKKKKK1rWtd1rutFa1oooooooooooosssooorWta1rWta1rRRRRRRRRRRZZZZZZZZZWta1rWta1rRRRRRRRRZZZZZZZZZZZZe9a1rWta1rWitaKLLLLLLLLLLLLLLLLL3rWta1rWtFbLLLLLLLLLLLLLLLLLLLL3vWta1rWita1ssssssss+hZZZZZZZZe961rWta0Vre97LLLLLLLLLLLPoWWWWWXrWta1oorWta3ssss+hZZZZ9Cyyyyyyyyiita1orWta1ve9llllllllllllllllFFa0VorWta1ve9llllllllllllllllllFFFaK1rWta1rWiyyyyyyyyyyyyiiiiiiitFFa1rWta1oosoosssssoooosoooorRRRWta1rWta0UUUUUWUUUUUUUUUUUVoooorWta1rWtaKKKKKKmiiiiiiiiiiiiiiitd73ve61oSiiipoqaKKKKKKKKKK0UUUVrve973vREREZoSihEooooorRRRRWtd73ve9EREREREoSiiiiitFllllla73ve9ERERERESiiiiiitH0PoWWWWVrXe96IiIiMoiJRRRRRRWjwlFFllllFFd6IiIiIlCUUUUUUUUUePHjx48ePCIiIiIiIiUUUUUUUUUUUePHjx48ePHjx48ePHjx48IiUUUUUUJRRRX//xAAWEQADAAAAAAAAAAAAAAAAAAABYJD/2gAIAQIBAz8AtEV7/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAECEP/aAAgBAwEBAgCtNNNNNNNNNNNNNNNNNNNNNNNNNNNNNcrTTTTTTTTTTTTTTTTTTTTTTTTTTTTTXKrTTTTTTTU000000000000000000001FVpppppqampqaaaaaaaaaaaaaaaaaaaa5Vaaaaampqampqammmmmmmmmmmlaaaaaaiq0001NTU1NTU1NTTTTTTTTTTSqqtNNNcqtNNSyzU1LNTU1NTTTTTTTTTSqqq001ytNLLLLNTU1NTU1NTbbbTTTTTSqqq001ytNLLLLLNTU1NTU3NttttNNNNNKqq001KrSyyyyyzU1NTU3Nzc02220000qqqqrSqqyyyyyzU1NTU3Nzc3NttttNNNKqqqqqqssssss1NTU3Nzc3NzbbbbTTTSqqqqqqrLLLLLNTU1Nzc3Nzc22220000qqqqqqqqssss1NTU3Nzc3NzbbbbbTTSqqqqqqqqqqzU1NTc3Nzc3Nzbc22000qqqqqqqqqqqtTU3Nzc3Nzc3NtzbTTSqqqqrKqqqqqtNNzc23Nzc3Nzc3NTU1KqqqrKqqqqqtNNNNttzc3Nzc3NzU1NLLLLLKqqqqqqqq0022223Nzc3NzU1NSyyyyyyqqqqqqqrTTbbbbc3Nzc3NTU1LLLLLLKsqqqqqqrTTTTbbbc3Nzc1NTUsssssssqqqqqqrTTTTTbbbTc3NTU1NTUsssssqqqqqqqq0000222023NTU1NTUsssssqqqqqqqq000000003NTU1NTU1LLLLLNKrTSqqqqtNNNNNNtNNTU1NSzUssss00qq0qqqqrTTTTTTTTTU1NTUs1LLLNNNKrTTTSqqq00000000001NTU1LNTU0000qtNNNKqqqtNNNNNNNNTU1NTUs1NNNNNKss1NNNK00qtK0000001NNTU0s000000qq000001NKrStNNNNK1NNNNStNNNNNKqtNNNNNNNK0000000rU0000rTTTTTSq00000rTTTTTTTTTTTTTTTTStNNNNKr/xAAUEQEAAAAAAAAAAAAAAAAAAACg/9oACAEDAQM/AAAf/9k='; /* 构建时 sed 注入：standard 置换图 base64 data URI */

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var XLINK_NS = 'http://www.w3.org/1999/xlink';
  var ELASTICITY = 0.15;    /* 弹性系数（rdev 默认） */
  var ACTIVATION = 200;     /* 鼠标激活区半径 px（rdev 默认） */
  var LERP = 0.16;          /* 每帧平滑系数（≈ rdev 0.2s ease-out 手感） */
  var SPECULAR_DAMP = 0.6;  /* 高光跟随阻尼（rdev 1.0 高光会跑出卡外，收一点） */

  var els = [];
  var running = false;
  var reduced = false;

  /* ---------- SVG 滤镜注入（全页共享一个） ---------- */
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

  function injectFilter() {
    if (document.getElementById('lg-glass-filter')) return true;
    var svg = svgEl('svg', { 'aria-hidden': 'true', 'style': 'position:absolute;width:0;height:0;overflow:hidden' });
    var defs = svgEl('defs', {});
    var f = svgEl('filter', {
      id: 'lg-glass-filter', x: '-35%', y: '-35%', width: '170%', height: '170%',
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
    /* 三通道不同位移量 = 色散（rdev standard 模式：70×-1 / 70×-1.1 / 70×-1.2 = -70/-77/-84，x=R y=B） */
    f.appendChild(svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: '-70', xChannelSelector: 'R', yChannelSelector: 'B', result: 'RED_DISPLACED' }));
    f.appendChild(svgEl('feColorMatrix', { in: 'RED_DISPLACED', type: 'matrix', values: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', result: 'RED_CHANNEL' }));
    f.appendChild(svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: '-77', xChannelSelector: 'R', yChannelSelector: 'B', result: 'GREEN_DISPLACED' }));
    f.appendChild(svgEl('feColorMatrix', { in: 'GREEN_DISPLACED', type: 'matrix', values: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', result: 'GREEN_CHANNEL' }));
    f.appendChild(svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP', scale: '-84', xChannelSelector: 'R', yChannelSelector: 'B', result: 'BLUE_DISPLACED' }));
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
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return true;
  }

  /* ---------- 每卡初始化 ---------- */
  function applyOn(el) {
    if (el._lg) return;
    var bd = document.createElement('div');
    bd.className = 'lg-backdrop';
    bd.setAttribute('aria-hidden', 'true');
    var sp = document.createElement('div');
    sp.className = 'lg-specular';
    sp.setAttribute('aria-hidden', 'true');
    el.insertBefore(bd, el.firstChild);
    el.insertBefore(sp, el.firstChild);
    el.classList.add('lg-active');
    el._lg = { tx: 0, ty: 0, sx: 1, sy: 1, px: 50, py: 50, ttx: 0, tty: 0, tsx: 1, tsy: 1, tpx: 50, tpy: 50 };
    els.push(el);
  }

  /* ---------- 鼠标物理（rdev 公式逐条移植） ---------- */
  function computeTargets(el, cx, cy) {
    var r = el.getBoundingClientRect();
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
    var s = el._lg;
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

  /* ---------- rAF 平滑循环（React 原版靠 CSS transition 0.2s，这里用逐帧 lerp） ---------- */
  function frame() {
    var any = false;
    for (var i = 0; i < els.length; i++) {
      var s = els[i]._lg;
      s.tx += (s.ttx - s.tx) * LERP;
      s.ty += (s.tty - s.ty) * LERP;
      s.sx += (s.tsx - s.sx) * LERP;
      s.sy += (s.tsy - s.sy) * LERP;
      s.px += (s.tpx - s.px) * LERP;
      s.py += (s.tpy - s.py) * LERP;
      var st = els[i].style;
      st.setProperty('--lg-tx', s.tx.toFixed(2) + 'px');
      st.setProperty('--lg-ty', s.ty.toFixed(2) + 'px');
      st.setProperty('--lg-sx', s.sx.toFixed(3));
      st.setProperty('--lg-sy', s.sy.toFixed(3));
      st.setProperty('--lg-px', s.px.toFixed(2) + '%');
      st.setProperty('--lg-py', s.py.toFixed(2) + '%');
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
    for (var i = 0; i < els.length; i++) computeTargets(els[i], e.clientX, e.clientY);
    wake();
  }
  function onLeave() {
    for (var i = 0; i < els.length; i++) restTargets(els[i]);
    wake();
  }

  function init() {
    reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    injectFilter();
    var nodes = document.querySelectorAll('.liquid-glass');
    for (var i = 0; i < nodes.length; i++) applyOn(nodes[i]);
    wake(); /* 首帧把静止值写进 CSS 变量（--lg-tx 等有确定初始值，电池可断言） */
    if (!reduced) {
      window.addEventListener('mousemove', onMove, { passive: true });
      document.addEventListener('mouseleave', onLeave);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
