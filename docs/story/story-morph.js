/* ===== M.NationWorld Story 融变图集 v0.2.26.0（HextaUI MorphSlider 原生移植）=====
   裸 WebGL1 零依赖：melt/ripple/shear/swirl 四种着色器过渡（片段着色器原文照搬）。
   滚动驱动（用户口径：不是点击、滚轮切换；只在「什么是政治」首标题范围内——story.js 算 msP → setProgress）。
   每张图占 1/(n-1) 进度段；smoothing 0.1 指数平滑；reduced-motion 下 uReduce=1 纯交叉淡化（仍跟滚动）。
   任何失败静默（电池零 console error 口径）——CSS 兜底图 morph-1.jpg 保持可见。 */
(function () {
  'use strict';
  var noop = function () {};
  window.storyMorph = { ok: false, count: 0, progress: 0, idx: 0, local: 0, setProgress: noop };

  var canvas = document.querySelector('canvas.ms-canvas');
  if (!canvas) return;
  var count = Number(canvas.getAttribute('data-morph-count') || 5);

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var gl = null;
  try {
    gl = canvas.getContext('webgl', { antialias: true, alpha: false }) || canvas.getContext('experimental-webgl', { antialias: true });
  } catch (e) {}
  if (!gl) return;

  try {
    // ---------- 着色器（MorphSlider 原文） ----------
    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader');
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER,
      'attribute vec2 position; attribute vec2 uv; varying vec2 vUv;' +
      'void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }'));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER,
      'precision highp float;' +
      'uniform sampler2D tCurrent; uniform sampler2D tNext;' +
      'uniform vec2 uResolution; uniform vec2 uCurrentSize; uniform vec2 uNextSize;' +
      'uniform float uProgress; uniform float uDir; uniform int uMode;' +
      'uniform float uIntensity; uniform float uScale; uniform float uAberration;' +
      'uniform float uDrift; uniform float uTime; uniform float uReduce;' +
      'uniform vec2 uPointer; uniform vec3 uOverlay;' +
      'varying vec2 vUv;' +
      'const float PI = 3.14159265359;' +
      'float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }' +
      'float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }' +
      'float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);' +
      ' float a = hash21(i); float b = hash21(i + vec2(1.0, 0.0)); float c = hash21(i + vec2(0.0, 1.0)); float d = hash21(i + vec2(1.0, 1.0));' +
      ' return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }' +
      'float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }' +
      'mat2 rot(float a) { float s = sin(a); float c = cos(a); return mat2(c, -s, s, c); }' +
      'vec2 coverUV(vec2 uv, vec2 res, vec2 img) { float rA = res.x / max(res.y, 1.0); float iA = img.x / max(img.y, 1.0);' +
      ' vec2 s = vec2(1.0); float ratio = rA / max(iA, 0.0001); if (ratio > 1.0) { s.y = 1.0 / ratio; } else { s.x = ratio; }' +
      ' return (uv - 0.5) * s + 0.5; }' +
      'void main() {' +
      ' float p = clamp(uProgress, 0.0, 1.0); float env = sin(p * PI);' +
      ' vec2 uv = vUv;' +
      ' uv += vec2(sin(uTime * 0.25 + uv.y * 4.0), cos(uTime * 0.22 + uv.x * 4.0)) * uDrift * 0.008;' +
      ' uv = (uv - 0.5) * (1.0 - uDrift * 0.02 * sin(uTime * 0.4)) + 0.5;' +
      ' vec2 uvC = uv; vec2 uvN = uv; float m = smoothstep(0.0, 1.0, p);' +
      ' if (uReduce < 0.5) {' +
      '  if (uMode == 3) { vec2 c = uv - 0.5; float r = length(c); float ang = env * uIntensity * 3.5 * (1.0 - r);' +
      '   uvC = rot(ang) * c + 0.5; uvN = rot(-ang) * c + 0.5; m = smoothstep(0.0, 1.0, p); }' +
      '  else if (uMode == 1) { float d = distance(uv, uPointer); float ring = p * 1.6;' +
      '   float wave = sin((d - ring) * 30.0) * env; vec2 dir = normalize(uv - uPointer + 1e-4);' +
      '   vec2 disp = dir * wave * uIntensity * 0.25; uvC = uv + disp; uvN = uv + disp * 0.6;' +
      '   m = 1.0 - smoothstep(ring - 0.03, ring + 0.03, d); }' +
      '  else if (uMode == 2) { float slices = 14.0; float row = floor(uv.y * slices); float rnd = hash11(row);' +
      '   vec2 disp = vec2((rnd - 0.5) * env * uIntensity * 0.6, 0.0); uvC = uv + disp; uvN = uv + disp;' +
      '   float localX = uDir > 0.0 ? uv.x : 1.0 - uv.x; float th = p * 1.5 - 0.25 + (rnd - 0.5) * 0.25;' +
      '   m = 1.0 - smoothstep(th - 0.06, th + 0.06, localX); }' +
      '  else { float nn = fbm(uv * uScale + uTime * 0.03); float warp = fbm(uv * uScale * 1.7 - uTime * 0.02);' +
      '   vec2 g = vec2(nn, warp) - 0.5; uvC = uv + g * uIntensity * 0.5 * p; uvN = uv - g * uIntensity * 0.5 * (1.0 - p);' +
      '   m = smoothstep(nn - 0.15, nn + 0.15, p); }' +
      ' }' +
      ' vec2 sC = coverUV(uvC, uResolution, uCurrentSize); vec2 sN = coverUV(uvN, uResolution, uNextSize);' +
      ' float ca = uReduce < 0.5 ? uAberration * env * 0.03 : 0.0;' +
      ' vec3 colC = vec3(texture2D(tCurrent, sC + vec2(ca, 0.0)).r, texture2D(tCurrent, sC).g, texture2D(tCurrent, sC - vec2(ca, 0.0)).b);' +
      ' vec3 colN = vec3(texture2D(tNext, sN + vec2(ca, 0.0)).r, texture2D(tNext, sN).g, texture2D(tNext, sN - vec2(ca, 0.0)).b);' +
      ' vec3 col = mix(colC, colN, m);' +
      ' float vig = smoothstep(1.25, 0.25, length(uv - 0.5));' +
      ' col = mix(col, uOverlay, (1.0 - vig) * 0.28);' +
      ' gl_FragColor = vec4(col, 1.0);' +
      '}'));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);

    // ---------- uniform 句柄 ----------
    var U = {};
    ['tCurrent', 'tNext', 'uResolution', 'uCurrentSize', 'uNextSize', 'uProgress', 'uDir', 'uMode',
      'uIntensity', 'uScale', 'uAberration', 'uDrift', 'uTime', 'uReduce', 'uPointer', 'uOverlay'
    ].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    // 全屏三角（大三角技巧：超出裁剪区的第三象限大三角——普通 (-1,-1)/(1,-1)/(-1,1) 只盖住下半三角，
    //   右上角整块黑 + 45° 对角线边界，用户实测「45° 一半是黑的」）
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 1,  3, -1, 2, 1,  -1, 3, 0, -1
    ]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'position');
    var aUv = gl.getAttribLocation(prog, 'uv');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

    // ---------- 纹理（morph-1..n.jpg；加载前深灰占位） ----------
    function fallbackTex() {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([24, 24, 28, 255]));
      return t;
    }
    function makeTex() {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    }
    var textures = [];
    var sizes = [];
    var stage = canvas.closest('.ms-stage') || canvas.parentNode;
    for (var i = 0; i < count; i++) {
      textures.push(fallbackTex());
      sizes.push([1, 1]);
      (function (idx) {
        var img = new Image();
        img.onload = function () {
          var t = makeTex();
          gl.bindTexture(gl.TEXTURE_2D, t);
          // 不加 FLIP_Y：顶点布局是屏幕顶 uv.y=0，默认上传 v=0=图片顶行 → 正立（FLIP_Y 会整图倒反）
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          textures[idx] = t;
          sizes[idx] = [img.naturalWidth || 1, img.naturalHeight || 1];
          if (idx === curIdx) {
            gl.uniform1i(U.tCurrent, 0);
            gl.uniform2f(U.uCurrentSize, sizes[idx][0], sizes[idx][1]);
          } else if (idx === curIdx + 1) {
            gl.uniform1i(U.tNext, 1);
            gl.uniform2f(U.uNextSize, sizes[idx][0], sizes[idx][1]);
          }
        };
        img.onerror = function () {};
        img.src = 'morph-' + (idx + 1) + '.jpg';
      })(i);
    }

    // ---------- 选项（MorphSlider 默认参数） ----------
    var OPTS = { intensity: 0.55, scale: 2.4, aberration: 0.35, drift: 0.4, overlayColor: [0, 0, 0] };
    var MODES = [0, 1, 2, 3]; // melt/ripple/shear/swirl 轮换
    gl.uniform1f(U.uIntensity, OPTS.intensity);
    gl.uniform1f(U.uScale, OPTS.scale);
    gl.uniform1f(U.uAberration, OPTS.aberration);
    gl.uniform1f(U.uDrift, OPTS.drift);
    gl.uniform1f(U.uReduce, reduced ? 1 : 0);
    gl.uniform2f(U.uPointer, 0.5, 0.5);
    gl.uniform3f(U.uOverlay, 0, 0, 0);

    // ---------- 进度与渲染（停留段 HOLD + 过渡段 TRANS 交替：图片有静止停留值，不会背靠背连续扭曲） ----------
    // 用户口径：切换动效长度一致（每段固定 0.6 屏）+ 每张图停留 0.3 屏——滚轮只决定「多快到达」，节奏恒定
    var HOLD = 0.3;   // 每张图停留（屏高单位）
    var TRANS = 0.6;  // 每段过渡（屏高单位）
    var TOTAL = (count - 1) * (HOLD + TRANS) + HOLD; // 4 过渡 + 5 停留 = 3.9 屏
    var curIdx = 0;
    var target = 0;
    var cur = 0;
    gl.uniform1i(U.tCurrent, 0);
    gl.uniform1i(U.tNext, 1);
    gl.uniform2f(U.uCurrentSize, 1, 1);
    gl.uniform2f(U.uNextSize, 1, 1);
    gl.uniform1i(U.uMode, MODES[0]);
    gl.uniform1f(U.uDir, 1);
    gl.uniform1f(U.uProgress, 0);
    gl.clearColor(0.05, 0.05, 0.06, 1);

    function prepare(idx) {
      curIdx = idx;
      gl.uniform1i(U.tCurrent, 0);
      gl.uniform1i(U.tNext, 1);
      gl.uniform2f(U.uCurrentSize, sizes[idx][0], sizes[idx][1]);
      gl.uniform2f(U.uNextSize, sizes[idx + 1][0], sizes[idx + 1][1]);
      gl.uniform1i(U.uMode, MODES[idx % MODES.length]);
      gl.uniform1f(U.uDir, (idx % 2 === 0) ? 1 : -1);
    }

    // 位置 → (图序号, 段内进度)：停留段返回 local=0（图静止）
    function mapPos(pos) {
      if (pos <= HOLD) return [0, 0];
      var i = Math.min(Math.floor((pos - HOLD) / (HOLD + TRANS)), count - 2);
      var sStart = HOLD + i * (HOLD + TRANS);
      if (pos < sStart + TRANS) {
        return [i, Math.max(0, Math.min(1, (pos - sStart) / TRANS))];
      }
      return [i + 1, 0];
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uResolution, canvas.width, canvas.height);
    }
    resize();

    var rafId = 0;
    var running = false;
    var t0 = performance.now();
    function frame(now) {
      running = true;
      gl.uniform1f(U.uTime, now * 0.001);
      // 指数平滑（smoothing 0.1，reduced 直跟）
      var k = reduced ? 1 : 1 - Math.exp(-1 / (60 * 0.1));
      cur += (target - cur) * k;
      if (Math.abs(target - cur) < 0.0004) cur = target;
      window.storyMorph.progress = cur;
      var mp = mapPos(Math.max(0, Math.min(TOTAL, cur)));
      var idx = mp[0];
      var local = mp[1];
      window.storyMorph.idx = idx;
      window.storyMorph.local = local;
      if (idx !== curIdx) prepare(idx);
      gl.uniform1f(U.uProgress, local);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures[idx]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textures[idx + 1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafId = window.requestAnimationFrame(frame);
    }
    rafId = window.requestAnimationFrame(frame);

    // 视口外暂停渲染
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting && !running) {
            t0 = performance.now();
            rafId = window.requestAnimationFrame(frame);
          } else if (!entries[i].isIntersecting && running) {
            window.cancelAnimationFrame(rafId);
            running = false;
          }
        }
      }, { threshold: 0 }).observe(canvas);
    }
    window.addEventListener('resize', function () { if (running) resize(); });

    window.storyMorph = {
      ok: true,
      count: count,
      progress: 0,
      idx: 0,
      local: 0,
      setProgress: function (p) { target = Math.max(0, Math.min(TOTAL, p)); }
    };
    stage.classList.add('ms-on');
  } catch (e) {
    // 任何失败 → 静默保持 CSS 兜底图（.ms-fallback）
    window.storyMorph = { ok: false, count: count, progress: 0, idx: 0, local: 0, setProgress: noop };
  }
})();
