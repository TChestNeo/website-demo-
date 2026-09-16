/* story-dots.js — DotGrid 点阵背景（ch2-00「国家的诞生」地球的底）
   来源：用户钦定 React 组件 DotGrid（gsap InertiaPlugin 点阵网格）→ 原生 JS 逐行语义移植。
   原组件结构：section.dot-grid > .dot-grid__wrap > canvas.dot-grid__canvas（wip 内标记原样）；
   props：dotSize 16 / gap 32 / activeColor '#5227FF' / proximity 150 / speedTrigger 100 /
   shockRadius 250 / shockStrength 5 / maxSpeed 5000 / resistance 750 / returnDuration 1.5。
   与原作者默认的两处口径偏差（用户钦定「默认暗、滑鼠靠近才亮起」）：
   ① baseColor '#120826'（原作者默认 base=active=#5227FF 同色 → 靠近混色失效、全点阵常亮；
      改暗底后组件自带 base→active 混色才真正「靠近变亮」）；
   ② 指针初始移出画布 (-9999,-9999)（原作者默认 (0,0) → 画布左上角 150px 内常亮一角；
      移出后初始全暗，滑鼠入画布才亮）。
   电池探测：window.storyDots = { ok, count, config, pointer, getMaxOffset }（参照 story-morph 惯例）。 */
(function () {
  'use strict';

  var el = document.querySelector('.dot-grid');
  var wrap = el ? el.querySelector('.dot-grid__wrap') : null;
  var canvas = el ? el.querySelector('.dot-grid__canvas') : null;

  var CONFIG = {
    dotSize: 16,
    gap: 32,
    baseColor: '#120826',   // 口径偏差①：暗紫底（原作者 #5227FF），滑鼠靠近由组件混色渐亮到 activeColor
    activeColor: '#5227FF',
    proximity: 150,
    speedTrigger: 100,
    shockRadius: 250,
    shockStrength: 5,
    maxSpeed: 5000,
    resistance: 750,
    returnDuration: 1.5
  };

  var dots = [];

  window.storyDots = {
    ok: false,
    count: 0,
    config: CONFIG,
    getMaxOffset: function () {
      var m = 0;
      for (var i = 0; i < dots.length; i++) {
        var v = Math.hypot(dots[i].xOffset, dots[i].yOffset);
        if (v > m) m = v;
      }
      return m;
    }
  };

  // 页内无点阵（index 等）或 CDN 未到/被拦 → 静默跳过，其余页面照常
  if (!el || !wrap || !canvas) return;
  if (!window.gsap || !window.InertiaPlugin) return;

  gsap.registerPlugin(InertiaPlugin);

  /* ===== 以下为原组件逐行移植 ===== */

  // 口径偏差②：原作者 (0,0)（画布左上角常亮一角）；移出画布 → 初始全暗，滑鼠入画布才亮
  var pointer = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, lastTime: 0, lastX: 0, lastY: 0 };
  window.storyDots.pointer = pointer;

  function throttle(func, limit) {
    var lastCall = 0;
    return function () {
      var now = performance.now();
      if (now - lastCall >= limit) {
        lastCall = now;
        func.apply(this, arguments);
      }
    };
  }

  function hexToRgb(hex) {
    var m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16)
    };
  }

  var baseRgb = hexToRgb(CONFIG.baseColor);
  var activeRgb = hexToRgb(CONFIG.activeColor);

  var circlePath = window.Path2D ? new window.Path2D() : null;
  if (circlePath) circlePath.arc(0, 0, CONFIG.dotSize / 2, 0, Math.PI * 2);

  function buildGrid() {
    var w = wrap.getBoundingClientRect().width;
    var h = wrap.getBoundingClientRect().height;
    var dpr = window.devicePixelRatio || 1;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    var cols = Math.floor((w + CONFIG.gap) / (CONFIG.dotSize + CONFIG.gap));
    var rows = Math.floor((h + CONFIG.gap) / (CONFIG.dotSize + CONFIG.gap));
    var cell = CONFIG.dotSize + CONFIG.gap;

    var gridW = cell * cols - CONFIG.gap;
    var gridH = cell * rows - CONFIG.gap;

    var extraX = w - gridW;
    var extraY = h - gridH;

    var startX = extraX / 2 + CONFIG.dotSize / 2;
    var startY = extraY / 2 + CONFIG.dotSize / 2;

    dots = [];
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var cx = startX + x * cell;
        var cy = startY + y * cell;
        dots.push({ cx: cx, cy: cy, xOffset: 0, yOffset: 0, _inertiaApplied: false });
      }
    }
    window.storyDots.count = dots.length;
  }

  var rafId;
  var proxSq = CONFIG.proximity * CONFIG.proximity;

  function draw() {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var px = pointer.x;
    var py = pointer.y;

    for (var i = 0; i < dots.length; i++) {
      var dot = dots[i];
      var ox = dot.cx + dot.xOffset;
      var oy = dot.cy + dot.yOffset;
      var dx = dot.cx - px;
      var dy = dot.cy - py;
      var dsq = dx * dx + dy * dy;

      var style = CONFIG.baseColor;
      if (dsq <= proxSq) {
        var dist = Math.sqrt(dsq);
        var t = 1 - dist / CONFIG.proximity;
        var r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t);
        var g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t);
        var b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t);
        style = 'rgb(' + r + ',' + g + ',' + b + ')';
      }

      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = style;
      ctx.fill(circlePath);
      ctx.restore();
    }

    rafId = requestAnimationFrame(draw);
  }

  buildGrid();
  var ro = null;
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(buildGrid);
    ro.observe(wrap);
  } else {
    window.addEventListener('resize', buildGrid);
  }

  // 惯性推离 + 弹性回位（原组件两处调用点共用同一段逻辑；抽函数保 var 循环闭包每点各绑自身）
  var inertiaPush = function (dot, pushX, pushY) {
    dot._inertiaApplied = true;
    gsap.killTweensOf(dot);
    gsap.to(dot, {
      inertia: { xOffset: pushX, yOffset: pushY, resistance: CONFIG.resistance },
      onComplete: function () {
        gsap.to(dot, {
          xOffset: 0,
          yOffset: 0,
          duration: CONFIG.returnDuration,
          ease: 'elastic.out(1,0.75)'
        });
        dot._inertiaApplied = false;
      }
    });
  };

  var onMove = function (e) {
    var now = performance.now();
    var dt = pointer.lastTime ? now - pointer.lastTime : 16;
    var dx = e.clientX - pointer.lastX;
    var dy = e.clientY - pointer.lastY;
    var vx = (dx / dt) * 1000;
    var vy = (dy / dt) * 1000;
    var speed = Math.hypot(vx, vy);
    if (speed > CONFIG.maxSpeed) {
      var scale = CONFIG.maxSpeed / speed;
      vx *= scale;
      vy *= scale;
      speed = CONFIG.maxSpeed;
    }
    pointer.lastTime = now;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.vx = vx;
    pointer.vy = vy;
    pointer.speed = speed;

    var rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;

    for (var i = 0; i < dots.length; i++) {
      var dot = dots[i];
      var dist = Math.hypot(dot.cx - pointer.x, dot.cy - pointer.y);
      if (speed > CONFIG.speedTrigger && dist < CONFIG.proximity && !dot._inertiaApplied) {
        inertiaPush(dot, dot.cx - pointer.x + vx * 0.005, dot.cy - pointer.y + vy * 0.005);
      }
    }
  };

  var onClick = function (e) {
    var rect = canvas.getBoundingClientRect();
    var cx = e.clientX - rect.left;
    var cy = e.clientY - rect.top;
    for (var i = 0; i < dots.length; i++) {
      var dot = dots[i];
      var dist = Math.hypot(dot.cx - cx, dot.cy - cy);
      if (dist < CONFIG.shockRadius && !dot._inertiaApplied) {
        var falloff = Math.max(0, 1 - dist / CONFIG.shockRadius);
        inertiaPush(dot, (dot.cx - cx) * CONFIG.shockStrength * falloff, (dot.cy - cy) * CONFIG.shockStrength * falloff);
      }
    }
  };

  var throttledMove = throttle(onMove, 50);
  window.addEventListener('mousemove', throttledMove, { passive: true });
  window.addEventListener('click', onClick);

  window.storyDots.ok = true;
  // 原组件 draw effect 在无 Path2D 时早退（画不出点，其余照常）——此处同语义跳过 rAF
  if (circlePath) draw();
})();
