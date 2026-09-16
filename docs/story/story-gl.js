/* ===== M.NationWorld Story WebGL 点缀 v0.2.26.0 =====
   裸 WebGL1、零依赖。页面声明 <canvas class="scene-gl" data-gl-kind="starfield|globe">。
   - 能力探测失败 / prefers-reduced-motion → window.storyWebgl = { ok:false }，
     body 不加 .gl-on（CSS 兜底层 .gl-fallback 保持可见，画布透明无感）。
   - 成功 → storyWebgl = { ok:true, kind } + body.gl-on 亮画布、藏兜底。
   - 全部失败路径静默（不打 console.error——电池全程零 console error 口径）。
   - 绝不做像素级保证：headless/软件渲染差异大，电池只断 canvas 存在 + storyWebgl.ok 布尔。 */
(function () {
  'use strict';
  window.storyWebgl = { ok: false };

  var canvas = document.querySelector('canvas.scene-gl');
  if (!canvas) return;
  var kind = canvas.getAttribute('data-gl-kind') || 'starfield';

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduced) { window.storyWebgl = { ok: false, skipped: 'reduced-motion' }; return; }

  var gl = null;
  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false })
      || canvas.getContext('experimental-webgl', { alpha: true });
  } catch (e) {}
  if (!gl) return;

  try {
    // ---------- 着色器 ----------
    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader');
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER,
      'attribute vec3 aPos; attribute float aSize;' +
      'uniform mat4 uMVP;' +
      'void main(){ gl_Position = uMVP * vec4(aPos, 1.0); gl_PointSize = aSize; }'));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER,
      'precision mediump float; uniform vec4 uColor;' +
      'void main(){ gl_FragColor = uColor; }'));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    var uMVP = gl.getUniformLocation(prog, 'uMVP');
    var uColor = gl.getUniformLocation(prog, 'uColor');

    // ---------- 4x4 矩阵（perspective * view * model，CPU 算） ----------
    function matMul(a, b) {
      var o = new Float32Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      return o;
    }
    function perspective(fovDeg, aspect, near, far) {
      var f = 1 / Math.tan(fovDeg * Math.PI / 360);
      var o = new Float32Array(16);
      o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far);
      o[11] = -1; o[14] = 2 * far * near / (near - far);
      return o;
    }
    function rotY(t) {
      var c = Math.cos(t), s = Math.sin(t), o = new Float32Array(16);
      o[0] = c; o[2] = -s; o[5] = 1; o[8] = s; o[10] = c; o[15] = 1;
      return o;
    }
    function rotX(t) {
      var c = Math.cos(t), s = Math.sin(t), o = new Float32Array(16);
      o[0] = 1; o[5] = c; o[6] = s; o[9] = -s; o[10] = c; o[15] = 1;
      return o;
    }
    function translate(x, y, z) {
      var o = new Float32Array(16);
      o[0] = o[5] = o[10] = o[15] = 1; o[12] = x; o[13] = y; o[14] = z;
      return o;
    }

    // ---------- 几何 ----------
    function makeBuffer(arr) {
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      return buf;
    }
    function bindAttribs(stride) {
      var aPos = gl.getAttribLocation(prog, 'aPos');
      var aSize = gl.getAttribLocation(prog, 'aSize');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(aSize);
      gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, stride, 12);
    }

    var points = null, linesBuf = null, lineCount = 0, lineColor = null;

    if (kind === 'globe') {
      // 经纬线球（12 纬线 + 24 经线，单位球）+ 倾斜光环（半径 1.45）
      var seg = [];
      var LAT = 12, LON = 24, STEP = 6; // 每条线采样段数
      for (var la = 1; la < LAT; la++) {
        var phi = Math.PI * la / LAT;
        for (var s = 0; s < LON * STEP; s++) {
          var t1 = s / (LON * STEP) * Math.PI * 2, t2 = (s + 1) / (LON * STEP) * Math.PI * 2;
          seg.push(Math.sin(phi) * Math.cos(t1), Math.cos(phi), Math.sin(phi) * Math.sin(t1));
          seg.push(Math.sin(phi) * Math.cos(t2), Math.cos(phi), Math.sin(phi) * Math.sin(t2));
        }
      }
      for (var lo = 0; lo < LON; lo++) {
        var th = lo / LON * Math.PI * 2;
        for (var s2 = 0; s2 < LAT * STEP; s2++) {
          var p1 = Math.PI * s2 / (LAT * STEP), p2 = Math.PI * (s2 + 1) / (LAT * STEP);
          seg.push(Math.sin(p1) * Math.cos(th), Math.cos(p1), Math.sin(p1) * Math.sin(th));
          seg.push(Math.sin(p2) * Math.cos(th), Math.cos(p2), Math.sin(p2) * Math.sin(th));
        }
      }
      for (var r = 0; r < 72; r++) {
        var a1 = r / 72 * Math.PI * 2, a2 = (r + 1) / 72 * Math.PI * 2;
        seg.push(Math.cos(a1) * 1.45, 0, Math.sin(a1) * 1.45);
        seg.push(Math.cos(a2) * 1.45, 0, Math.sin(a2) * 1.45);
      }
      linesBuf = makeBuffer(new Float32Array(seg));
      lineCount = seg.length / 3;
      lineColor = [0.79, 0.66, 0.42, 0.5];
    } else {
      // 星空：~150 点散布在视锥盒内，带大小属性
      var pts = new Float32Array(150 * 4);
      for (var i = 0; i < 150; i++) {
        pts[i * 4] = (Math.random() * 2 - 1) * 2.4;
        pts[i * 4 + 1] = (Math.random() * 2 - 1) * 1.6;
        pts[i * 4 + 2] = -2.2 - Math.random() * 4.5;
        pts[i * 4 + 3] = 1.2 + Math.random() * 2.6;
      }
      points = makeBuffer(pts);
    }

    // ---------- 渲染循环 ----------
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    var scene = canvas.closest('.scene') || document.body;
    var t0 = performance.now();
    var rafId = 0, running = false;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function readP() {
      var p = 0.5;
      try {
        var v = window.getComputedStyle(scene).getPropertyValue('--p');
        var f = parseFloat(v);
        if (!isNaN(f)) p = f;
      } catch (e) {}
      return p;
    }

    function frame(now) {
      running = true;
      var t = (now - t0) / 1000;
      var p = readP();
      var aspect = canvas.width / canvas.height;
      var proj = perspective(48, aspect, 0.1, 100);
      var view = translate(0, 0, -3.4);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (points) {
        var m = matMul(view, rotY(t * 0.025));
        gl.uniformMatrix4fv(uMVP, false, matMul(proj, m));
        gl.uniform4f(uColor, 0.9, 0.87, 0.95, 0.75);
        gl.bindBuffer(gl.ARRAY_BUFFER, points);
        bindAttribs(16);
        gl.drawArrays(gl.POINTS, 0, 150);
      } else if (linesBuf) {
        var m2 = matMul(matMul(view, rotY(t * 0.3)), rotX(0.5 + Math.sin(t * 0.12) * 0.08));
        m2 = matMul(m2, translate(0, (p - 0.5) * 0.5, 0));
        gl.uniformMatrix4fv(uMVP, false, matMul(proj, m2));
        gl.uniform4f(uColor, lineColor[0], lineColor[1], lineColor[2], lineColor[3]);
        gl.bindBuffer(gl.ARRAY_BUFFER, linesBuf);
        bindAttribs(12);
        gl.drawArrays(gl.LINES, 0, lineCount);
      }
      rafId = window.requestAnimationFrame(frame);
    }

    // 视口内才渲染（省电），离开即停
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting && !running) {
            resize(); rafId = window.requestAnimationFrame(frame);
          } else if (!entries[i].isIntersecting && running) {
            window.cancelAnimationFrame(rafId); running = false;
          }
        }
      }, { threshold: 0 }).observe(canvas);
    }
    resize();
    if (!('IntersectionObserver' in window)) rafId = window.requestAnimationFrame(frame);
    window.addEventListener('resize', function () { if (running) resize(); });

    window.storyWebgl = { ok: true, kind: kind };
    document.body.classList.add('gl-on');
  } catch (e) {
    // 任何渲染失败 → 静默保持 fallback（body 无 .gl-on）
    window.storyWebgl = { ok: false };
  }
})();
