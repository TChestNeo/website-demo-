// story-ch4fx.js — v0.2.30.0 第四章背景特效 + 穹顶画廊
// 1) 无人机粒子群：法国大革命/美国独立/苏联的成立 场景，粒子聚散成字形（自由·1789·独立·1776·1917…）
// 2) 纪录片闪回：一战二战/冷战 场景，历史照片快速闪过 + 胶片颗粒 + 白闪 + 年份闪字
// 3) 穹顶画廊（第四章末尾）：3D 图块球拖拽旋转（带惯性），点击图块弹出该事件简介与要点（正文复用第四章内容）
(function () {
  'use strict';
  if (window.__storyCh4Fx) return; window.__storyCh4Fx = true;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GOLD = '226,193,132';

  function qs(sel, root) { return (root || document).querySelector(sel); }

  /* ================= 粒子群（无人机组成字形） ================= */
  function sampleGlyph(text) {
    var cv = document.createElement('canvas');
    cv.width = 420; cv.height = 140;
    var g = cv.getContext('2d');
    g.font = '900 104px "Noto Serif SC", "Songti SC", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(text, 210, 72);
    var d = g.getImageData(0, 0, 420, 140).data;
    var pts = [];
    for (var y = 0; y < 140; y += 3) {
      for (var x = 0; x < 420; x += 3) {
        if (d[(y * 420 + x) * 4 + 3] > 128) pts.push([x / 420, y / 140]);
      }
    }
    return pts;
  }

  function SwarmFx(scene, glyphs) {
    var cv = document.createElement('canvas');
    cv.className = 'fx-swarm';
    scene.insertBefore(cv, scene.firstChild);
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var N = 460;
    var parts = [];
    var cur = -1, phase = 'idle', phaseStart = 0;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      var r = cv.getBoundingClientRect();
      W = r.width || window.innerWidth; H = r.height || window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function dot(p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fillStyle = 'rgba(' + GOLD + ',' + p.a + ')';
      ctx.fill();
    }
    function makeParts() {
      parts = [];
      for (var i = 0; i < N; i++) {
        parts.push({
          x: Math.random() * W, y: Math.random() * H,
          tx: 0, ty: 0, ox: Math.random() * W, oy: Math.random() * H,
          r: 1 + Math.random() * 1.4, a: .3 + Math.random() * .5,
          seed: Math.random() * 6.28, delay: Math.random() * .45
        });
      }
    }
    function pickGlyph() {
      cur = (cur + 1) % glyphs.length;
      var g = sampleGlyph(glyphs[cur]);
      var cw = Math.min(W * .66, 720);
      var ch = cw * (140 / 420);
      var cx = W / 2, cy = H / 2;
      var shuf = g.slice().sort(function () { return Math.random() - .5; });
      for (var i = 0; i < N; i++) {
        var t = shuf[i % shuf.length];
        var p = parts[i];
        p.ox = p.x; p.oy = p.y;
        p.tx = cx + (t[0] - .5) * cw;
        p.ty = cy + (t[1] - .5) * ch;
      }
      phase = 'assemble'; phaseStart = performance.now();
    }
    function ease(t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
    function frame(now) {
      ctx.clearRect(0, 0, W, H);
      var i, p, t, dt;
      if (phase === 'assemble') {
        for (i = 0; i < N; i++) {
          p = parts[i];
          t = Math.max(0, Math.min(1, (now - phaseStart - p.delay * 900) / 1900));
          p.x = p.ox + (p.tx - p.ox) * ease(t);
          p.y = p.oy + (p.ty - p.oy) * ease(t);
          dot(p);
        }
        if (now - phaseStart > 450 + 1900 + 2400) { phase = 'hold'; phaseStart = now; }
      } else if (phase === 'hold') {
        for (i = 0; i < N; i++) {
          p = parts[i];
          p.x += Math.sin(now / 900 + p.seed) * .35;
          p.y += Math.cos(now / 1100 + p.seed) * .35;
          dot(p);
        }
        if (now - phaseStart > 2500) { phase = 'disperse'; phaseStart = now; }
      } else if (phase === 'disperse') {
        for (i = 0; i < N; i++) {
          p = parts[i];
          dt = Math.min(1, (now - phaseStart) / 1400);
          p.x += (p.ox - p.x) * .08 + Math.sin(now / 700 + p.seed) * .9;
          p.y += (p.oy - p.y) * .08 + Math.cos(now / 800 + p.seed) * .9;
          dot(p);
        }
        if (now - phaseStart > 1400) pickGlyph();
      } else { pickGlyph(); }
      requestAnimationFrame(frame);
    }

    resize();
    makeParts();
    if (reduced) {
      pickGlyph();
      for (var s = 0; s < N; s++) { var p2 = parts[s]; p2.x = p2.tx; p2.y = p2.ty; dot(p2); }
    } else {
      requestAnimationFrame(frame);
    }
    window.addEventListener('resize', resize);
  }

  /* ================= 纪录片闪回 ================= */
  var NEWS_IMAGES = {
    'ch4-03': [
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Into%20the%20Jaws%20of%20Death%2023-0455M%20edit.jpg?width=1000',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/British%20infantry%20Morval%2025%20September%201916.jpg?width=1000',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Bundesarchiv%20Bild%20183-W0506-316%2C%20Russland%2C%20Kampf%20um%20Stalingrad%2C%20Siegesflagge.jpg?width=1000'
    ],
    'ch4-05': [
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Berlinermauer.jpg?width=1000',
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/U-2%20photo%20during%20Cuban%20Missile%20Crisis.jpg?width=1000'
    ]
  };
  var NEWS_DATES = {
    'ch4-03': ['1914', '1916', '1942', '1945'],
    // v0.2.33.0 冷战：1947–1991 挑 14 个关键年份（1991 按用户要求去掉）
    'ch4-05': ['1947', '1948', '1949', '1950', '1956', '1957', '1961', '1962', '1968', '1972', '1979', '1983', '1985', '1989']
  };

  function NewsreelFx(scene, images, dates) {
    var layer = document.createElement('div');
    layer.className = 'fx-newsreel';
    var reel = document.createElement('div'); reel.className = 'fx-reel'; // 画面层（轻微门抖动）
    var img = document.createElement('img');
    img.alt = '';
    var tint = document.createElement('div'); tint.className = 'fx-tint';          // 暖调 + 暗角
    var grain = document.createElement('div'); grain.className = 'fx-grain';       // 细腻胶片颗粒
    var exposure = document.createElement('div'); exposure.className = 'fx-exposure'; // 曝光呼吸
    var leak = document.createElement('div'); leak.className = 'fx-leak';          // 偶发漏光
    reel.appendChild(img); reel.appendChild(tint); reel.appendChild(grain);
    reel.appendChild(exposure); reel.appendChild(leak);
    var scrim = document.createElement('div'); scrim.className = 'fx-scrim';
    var dateEl = document.createElement('div'); dateEl.className = 'fx-date';
    layer.appendChild(reel); layer.appendChild(scrim); layer.appendChild(dateEl);
    scene.insertBefore(layer, scene.firstChild);
    var idx = 0, dateIdx = 0, failed = {};
    function tick() {
      idx = (idx + 1) % images.length;
      var src = images[idx];
      // 年份独立轮转（不跟图片数挂钩——冷战 15 个年份全部轮播）
      dateIdx = (dateIdx + 1) % dates.length;
      dateEl.textContent = dates[dateIdx] || '';
      if (failed[src]) return;
      var pre = new Image();
      pre.onload = function () { img.src = src; };
      pre.onerror = function () { failed[src] = true; };
      pre.src = src;
    }
    dateEl.textContent = dates[0] || '';
    tick();
    if (!reduced) setInterval(tick, 1500);
  }

  /* ================= 穹顶画廊 ================= */
  var EVENTS = [
    {
      scene: 'ch4-01', label: '法国大革命',
      img: [
        'https://commons.wikimedia.org/wiki/Special:Redirect/file/Prise%20de%20la%20Bastille.jpg?width=640',
        'https://commons.wikimedia.org/wiki/Special:Redirect/file/Eug%C3%A8ne%20Delacroix%20-%20La%20libert%C3%A9%20guidant%20le%20peuple.jpg?width=640'
      ]
    },
    {
      scene: 'ch4-02', label: '美国独立',
      img: [
        'https://commons.wikimedia.org/wiki/Special:Redirect/file/Declaration%20of%20Independence%20(1819)%2C%20by%20John%20Trumbull.jpg?width=640',
        'https://commons.wikimedia.org/wiki/Special:Redirect/file/Washington%20Crossing%20the%20Delaware%20by%20Emanuel%20Leutze%2C%20MMA-NYC%2C%201851.jpg?width=640'
      ]
    },
    {
      scene: 'ch4-03', label: '一战与二战',
      img: [
        'https://commons.wikimedia.org/wiki/Special:Redirect/file/British%20infantry%20Morval%2025%20September%201916.jpg?width=640',
        'https://commons.wikimedia.org/wiki/Special:Redirect/file/Into%20the%20Jaws%20of%20Death%2023-0455M%20edit.jpg?width=640',
        'https://commons.wikimedia.org/wiki/Special:Redirect/file/Bundesarchiv%20Bild%20183-W0506-316%2C%20Russland%2C%20Kampf%20um%20Stalingrad%2C%20Siegesflagge.jpg?width=640'
      ]
    },
    {
      scene: 'ch4-04', label: '苏联的成立',
      img: [
        'https://commons.wikimedia.org/wiki/Special:Redirect/file/Lenin%20in%201920%20(cropped).jpg?width=640',
        'https://commons.wikimedia.org/wiki/Special:Redirect/file/Winter%20Palace%20Bolshevik%20Coup%2C%20Petrograd%2C%201917.jpg?width=640'
      ]
    }
    // v0.2.34.0 冷战已按用户要求从穹顶移除（仅剩前四个事件）
  ];

  function initDome() {
    var stage = qs('.scene-dome .scene-stage');
    var sphere = document.getElementById('domeSphere');
    var modal = document.getElementById('domeModal');
    if (!stage || !sphere || !modal) return;

    var COLS = 22, ROWS = 3;
    var spanDeg = 210, vDeg = 7;
    var radius = Math.max(320, Math.min(window.innerWidth, window.innerHeight) * .5);

    var pool = [];
    EVENTS.forEach(function (ev) {
      ev.img.forEach(function (src) { pool.push({ ev: ev, src: src }); });
    });
    var tileW = (2 * Math.PI * radius) * (spanDeg / 360) / COLS * .9;
    var tileH = tileW * .62;

    var rotY = 0, rotX = 2, vel = 0;
    var dragging = false, moved = false, lastX = 0, rafId = null;

    function apply() {
      sphere.style.transform = 'translateZ(' + (-radius) + 'px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg)';
    }

    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r < ROWS; r++) {
        var t = pool[(c * ROWS + r) % pool.length];
        var yDeg = -spanDeg / 2 + (c + .5) * (spanDeg / COLS);
        var xDeg = -vDeg * (ROWS - 1) / 2 + r * vDeg;
        var el = document.createElement('div');
        el.className = 'dome-tile';
        el.style.width = tileW + 'px';
        el.style.height = tileH + 'px';
        el.style.marginLeft = (-tileW / 2) + 'px';
        el.style.marginTop = (-tileH / 2) + 'px';
        el.style.transform = 'rotateY(' + yDeg + 'deg) rotateX(' + xDeg + 'deg) translateZ(' + radius + 'px)';
        var inner = document.createElement('div');
        inner.className = 'tile-inner';
        var fb = document.createElement('div');
        fb.className = 'tile-fallback';
        fb.textContent = t.ev.label.charAt(0);
        inner.appendChild(fb);
        var im = document.createElement('img');
        im.alt = t.ev.label;
        im.draggable = false;
        im.onload = function () { fb.style.display = 'none'; };
        im.onerror = function () { im.remove(); };
        im.src = t.src;
        inner.appendChild(im);
        el.appendChild(inner);
        sphere.appendChild(el);
      }
    }
    apply();

    function onDown(x) {
      dragging = true; moved = false; lastX = x;
      stage.classList.add('dragging');
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }
    function onMove(x) {
      if (!dragging) return;
      var dx = x - lastX;
      if (Math.abs(dx) > 3) moved = true;
      rotY += dx * .28;
      vel = dx * .28;
      lastX = x;
      apply();
    }
    function onUp(target) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('dragging');
      if (Math.abs(vel) > .4) {
        var v = vel;
        (function loop() {
          v *= .94;
          if (Math.abs(v) < .05) return;
          rotY += v;
          apply();
          rafId = requestAnimationFrame(loop);
        })();
      }
      vel = 0;
      if (!moved) openModal(target);
    }

    stage.addEventListener('mousedown', function (e) { onDown(e.clientX); });
    window.addEventListener('mousemove', function (e) { onMove(e.clientX); });
    window.addEventListener('mouseup', function (e) { onUp(e.target); });
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) onDown(e.touches[0].clientX);
    }, { passive: true });
    stage.addEventListener('touchmove', function (e) {
      if (e.touches.length === 1) onMove(e.touches[0].clientX);
    }, { passive: true });
    stage.addEventListener('touchend', function (e) { onUp(e.target); });

    function openModal(el) {
      var tile = el && el.closest ? el.closest('.dome-tile') : null;
      if (!tile) return;
      var idx = Array.prototype.indexOf.call(sphere.children, tile);
      var entry = pool[Math.floor(idx / ROWS) * ROWS + (idx % ROWS)];
      if (entry) renderModal(entry.ev);
    }
    function renderModal(ev) {
      var scene = qs('[data-scene="' + ev.scene + '"]');
      if (!scene) return;
      var titleEl = scene.querySelector('.scene-title');
      var lines = [];
      scene.querySelectorAll('.narration .line').forEach(function (l) { lines.push(l.textContent.trim()); });
      var pts = [];
      scene.querySelectorAll('.evt').forEach(function (b) {
        var h = b.querySelector('h3'), p = b.querySelector('p');
        if (h) pts.push({ h: h.textContent.trim(), p: p ? p.textContent.trim() : '' });
      });
      document.getElementById('dmTitle').textContent = titleEl ? titleEl.textContent.trim() : ev.label;
      document.getElementById('dmIntro').textContent = lines.join('');
      var wrap = document.getElementById('dmPts');
      wrap.innerHTML = '';
      pts.forEach(function (x) {
        var d = document.createElement('div'); d.className = 'dm-pt';
        var h4 = document.createElement('h4'); h4.textContent = x.h;
        var p = document.createElement('p'); p.textContent = x.p;
        d.appendChild(h4); d.appendChild(p);
        wrap.appendChild(d);
      });
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeModal() {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
    qs('.dm-close', modal).addEventListener('click', closeModal);
    qs('.dm-backdrop', modal).addEventListener('click', closeModal);
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    window.addEventListener('resize', function () {
      radius = Math.max(320, Math.min(window.innerWidth, window.innerHeight) * .5);
      apply();
    });
  }

  /* ================= 启动 ================= */
  function boot() {
    var swarms = {
      'ch4-01': ['自由', '1789', '人权'],
      'ch4-02': ['独立', '1776', '自由'],
      'ch4-04': ['1917', '平等', '十月']
    };
    Object.keys(swarms).forEach(function (k) {
      var s = qs('[data-scene="' + k + '"]');
      if (s) SwarmFx(s, swarms[k]);
    });
    Object.keys(NEWS_IMAGES).forEach(function (k) {
      var s = qs('[data-scene="' + k + '"]');
      if (s) NewsreelFx(s, NEWS_IMAGES[k], NEWS_DATES[k]);
    });
    // v0.2.35.0 穹顶画廊整体移除（initDome 不再调用，相关代码留作死代码）
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
