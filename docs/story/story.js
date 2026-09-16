/* ===== M.NationWorld Story 滚轮叙事引擎 v0.2.26.0 =====
   职责：
   1. IntersectionObserver（threshold 0.2）——场景进视口加 .in 并 unobserve（只加不减）
   2. scroll(passive) + rAF 合并——每场景进度 p（0..1）写成该场景 --p；CSS 是唯一消费点
      （景深视差、3D 倾斜、分句揭示阈值全部由 CSS/本脚本阈值驱动，无其他 JS 直写样式）
   3. 分句 .line 按 p 阈值加 .on（只加不减）
   4. localStorage story-read[pageId]=true——尾声知识地图点亮用（story 子域自属存储）
   5. prefers-reduced-motion → 跳过 rAF 与动画，全场景 .in/.on 直接可见（内容优先）
   6. 顶部 --progress 阅读进度条
   无 scroll-jacking、无 smooth-scroll 劫持；无场景页直接 no-op。 */
(function () {
  'use strict';
  var doc = document;
  var scenes = doc.querySelectorAll('.scene');
  if (!scenes.length) return;

  var page = (doc.body && doc.body.getAttribute('data-page')) || '';

  // 页读标记（finale 知识地图点亮用；公开站匿名存储，容错静默）
  if (page) {
    try {
      var raw = localStorage.getItem('story-read');
      var map = raw ? JSON.parse(raw) : {};
      map[page] = true;
      localStorage.setItem('story-read', JSON.stringify(map));
    } catch (e) {}
  }

  // 分句错峰序号（CSS 用它做 transition-delay）
  for (var i = 0; i < scenes.length; i++) {
    var lines = scenes[i].querySelectorAll('.line');
    for (var j = 0; j < lines.length; j++) {
      lines[j].style.setProperty('--li', String(j));
    }
  }

  // BlurText 逐字标题（reactbits 同款）：标题按字符拆成 span.tc + --ci 错峰序号——
  // CSS 动画在 .scene.in 时逐字落下（fill both 保证延迟期保持 from 态）。纯文本标题一次拆分，
  // data-tc 守卫防重入；空格转 &nbsp; 防折行丢失。
  for (var i = 0; i < scenes.length; i++) {
    var titles = scenes[i].querySelectorAll('.scene-title, .se-title, .se-title-o');
    for (var ti = 0; ti < titles.length; ti++) {
      var title = titles[ti];
      if (title.getAttribute('data-tc') || title.getAttribute('data-sr')) continue;
      // ScrollReveal（用户口径）：从「同一座大房子」起的所有场景标题（非序章/非融变区字幕）
      var isSr = !(title.classList.contains('se-title') || title.closest('.ms-scene'));
      var text = title.textContent;
      var frag = doc.createDocumentFragment();
      for (var j = 0; j < text.length; j++) {
        var span = doc.createElement('span');
        if (isSr) {
          span.className = 'word';
          span.style.setProperty('--wi', String(j));
        } else {
          span.className = 'tc';
          span.style.setProperty('--ci', String(j));
        }
        span.textContent = text.charAt(j) === ' ' ? ' ' : text.charAt(j);
        frag.appendChild(span);
      }
      title.textContent = '';
      title.appendChild(frag);
      if (isSr) { title.classList.add('sr-title'); title.setAttribute('data-sr', '1'); }
      else title.setAttribute('data-tc', '1');
    }
  }

  // MagicText 滚动逐字揭示（HextaUI 同款）：narration 行按字符拆成 .mw（ghost 20% 垫底 + fill 随滚动点亮）。
  // 只拆文本节点——行内元素（.tag 口径标签等）原样保留；data-mw 守卫防重入。
  function splitMagicLine(line) {
    var kids = Array.prototype.slice.call(line.childNodes);
    for (var a = 0; a < kids.length; a++) {
      var kid = kids[a];
      if (kid.nodeType === 3) { // 文本节点
        var t = kid.textContent;
        if (!t) continue;
        var f = doc.createDocumentFragment();
        for (var b = 0; b < t.length; b++) {
          var ch = t.charAt(b) === ' ' ? ' ' : t.charAt(b);
          var w = doc.createElement('span');
          w.className = 'mw';
          var g = doc.createElement('span'); g.className = 'mw-ghost'; g.textContent = ch;
          var fl = doc.createElement('span'); fl.className = 'mw-fill'; fl.textContent = ch;
          w.appendChild(g); w.appendChild(fl);
          f.appendChild(w);
        }
        line.replaceChild(f, kid);
      } else if (kid.nodeType === 1) { // 元素节点（.tag 等）只拆其内部文本
        splitMagicLine(kid);
      }
    }
  }
  for (var i = 0; i < scenes.length; i++) {
    var mls = scenes[i].querySelectorAll('.narration .line');
    for (var j = 0; j < mls.length; j++) {
      if (!mls[j].getAttribute('data-mw')) {
        splitMagicLine(mls[j]);
        mls[j].setAttribute('data-mw', '1');
      }
    }
  }

  function revealAll() {
    for (var i = 0; i < scenes.length; i++) {
      scenes[i].classList.add('in');
      markChapter(scenes[i]);
      var ls = scenes[i].querySelectorAll('.line');
      for (var j = 0; j < ls.length; j++) {
        ls[j].classList.add('on');
        var fills = ls[j].querySelectorAll('.mw-fill');
        for (var k = 0; k < fills.length; k++) fills[k].style.opacity = '1';
      }
      measureSe(scenes[i]);
      applySe(scenes[i], 1); // 无 IO 兜底：序章展开直接呈现终态（reduced 路径随后会被 updateSe 按滚动位置覆盖）
      var srT = scenes[i].querySelectorAll('.sr-title');
      for (var sj = 0; sj < srT.length; sj++) {
        srT[sj].style.transform = 'rotate(0deg)';
        var ws2 = srT[sj].querySelectorAll('.word');
        for (var wk = 0; wk < ws2.length; wk++) {
          ws2[wk].style.opacity = '1';
          ws2[wk].style.filter = 'blur(0px)';
        }
      }
    }
    lightKmap();
    doc.documentElement.style.setProperty('--progress', '1');
  }

  // ── ScrollExpand 序章展开（HextaUI 同款：小卡 42×58% 随滚动展开到全屏，smoothing 0.1 指数平滑） ──
  function smoothstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a || 1e-6)));
    return t * t * (3 - 2 * t);
  }
  function measureSe(sc) {
    var stage = sc.querySelector('.se-stage');
    var track = sc.querySelector('.se-track');
    if (!stage || !track) return;
    var vh = window.innerHeight || 1;
    stage.style.height = vh + 'px';
    track.style.height = Math.round(vh * (1 + 1.2 + 0.35)) + 'px';
    var w = sc.clientWidth || vh;
    stage.style.setProperty('--se-title-size', Math.max(20, Math.min(84, w * 0.075)) + 'px');
  }
  function applySe(sc, p) {
    var frame = sc.querySelector('.se-frame');
    var media = sc.querySelector('.se-media');
    if (!frame || !media) return;
    var e = smoothstep(0, 1, p);
    var w = 42 + 58 * e, h = 58 + 42 * e;
    var ix = Math.max(0, (100 - w) / 2), iy = Math.max(0, (100 - h) / 2);
    frame.style.clipPath = 'inset(' + iy + '% ' + ix + '% ' + iy + '% ' + ix + '% round ' + (24 * (1 - e)) + 'px)';
    // 卡片金边/光晕随展开溶解（全屏后不留框）
    frame.style.borderColor = 'rgba(201,168,106,' + (0.35 * (1 - e)).toFixed(3) + ')';
    frame.style.boxShadow = '0 0 ' + (70 * (1 - e)).toFixed(1) + 'px rgba(96,104,220,' + (0.2 * (1 - e)).toFixed(3) + '), inset 0 0 ' + (40 * (1 - e)).toFixed(1) + 'px rgba(201,168,106,' + (0.08 * (1 - e)).toFixed(3) + ')';
    media.style.transform = 'scale(' + (1.35 - 0.35 * e) + ')';
    var scrim = sc.querySelector('.se-scrim');
    if (scrim) scrim.style.opacity = String(0.45 * e);
    var title = sc.querySelector('.se-title');
    if (title) {
      var out = smoothstep(0.4, 0.88, p);
      title.style.opacity = String(1 - out);
      title.style.transform = 'translate3d(0,' + (-28 * out) + 'px,0) scale(' + (1 + 0.06 * out) + ')';
      var sub = sc.querySelector('.se-sub-line');
      if (sub) sub.style.opacity = String(1 - out);
    }
    var hint = sc.querySelector('.se-hint');
    if (hint) {
      var gone = smoothstep(0, 0.12, p);
      hint.style.opacity = String(1 - gone);
      hint.style.transform = 'translate3d(0,' + (8 * gone) + 'px,0)';
    }
    var overlay = sc.querySelector('.se-overlay');
    if (overlay) {
      var inn = smoothstep(0.68, 1, p);
      overlay.style.opacity = String(inn);
      overlay.style.transform = 'translate3d(0,' + (18 * (1 - inn)) + 'px,0)';
      if (p > 0.75) overlay.classList.add('tc-in'); // 「什么是政治」BlurText 入场（一次性）
    }
  }

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduced) {
    revealAll();
    // 减少动态只关自主动画（BlurText/光球/平滑）；滚动驱动的序章展开是用户主动滚动，组件同口径保留
    var updateSe = function () {
      for (var i = 0; i < scenes.length; i++) {
        var tr = scenes[i].querySelector('.se-track');
        if (!tr) continue;
        var vh2 = window.innerHeight || 1;
        var t2 = Math.max(0, Math.min(1, -tr.getBoundingClientRect().top / (vh2 * 1.2)));
        scenes[i].__seCur = t2;
        applySe(scenes[i], t2);
      }
    };
    updateSe();
    window.addEventListener('scroll', updateSe, { passive: true });
    return;
  }

  // 入场观察（threshold 0.08：场景刚进入屏幕即触发——淡入全程在可视范围内发生；
  // 用户反馈 0.2 太晚：短场景内容已在屏内动画才开始/完成在屏外）
  // v0.2.26.0 单页合并：场景 data-scene 带 ch1..ch6 前缀 → 入场即标 story-read[chX] + 实时点亮尾声知识地图
  // （点亮逻辑收进引擎——wip 拼接只带 <main> 场景，页尾内联脚本带不进来；单页模式下读完一章亮一盏）
  function lightKmap() {
    var nodes = doc.querySelectorAll('.kmap-node');
    if (!nodes.length) return;
    var map = {};
    try { map = JSON.parse(localStorage.getItem('story-read') || '{}'); } catch (e) {}
    for (var i = 0; i < nodes.length; i++) {
      if (map[nodes[i].getAttribute('data-read')]) nodes[i].classList.add('lit');
    }
  }
  function markChapter(scEl) {
    var ds = scEl.getAttribute('data-scene') || '';
    var mm = /^(ch[1-6])-/.exec(ds);
    if (!mm) return;
    try {
      var raw2 = localStorage.getItem('story-read');
      var map2 = raw2 ? JSON.parse(raw2) : {};
      map2[mm[1]] = true;
      localStorage.setItem('story-read', JSON.stringify(map2));
    } catch (e) {}
    lightKmap();
  }
  // .in 不再由 IO 触发——严格序列入场（用户口径：前场景出场后才到本场景入场）：
  // 场景内容保持黑暗，直到本场景顶通过视口顶（相邻布局下等价于前场景已出场），
  // 然后揭示进度随本场景自身通过（0.6 场景高）推进——一个接一个，绝不重叠点亮。由 tick 统一驱动。

  // 进度驱动：scroll + rAF 合并
  var rafId = null;
  function tick() {
    rafId = null;
    var vh = window.innerHeight || 1;
    var total = doc.documentElement.scrollHeight - vh;
    var seRunning = false; // ScrollExpand 平滑未收敛 → 自续帧（组件同款：rAF 循环跑到收敛才停）
    for (var i = 0; i < scenes.length; i++) {
      var sc = scenes[i];
      var r = sc.getBoundingClientRect();
      var p = (vh * 0.85 - r.top) / (r.height + vh * 0.85);
      p = Math.max(0, Math.min(1, p));
      sc.style.setProperty('--p', p.toFixed(3));
      // 严格序列入场 + 中间停留：q = 本场景顶通过视口顶后的进度（前 22% 屏内 0→1——
      // 场景 200vh 两屏滚动，sticky 内容第一屏停留：q 提前亮完后内容在屏中静止停留一整屏再滑走）
      var q = 1;
      if (i > 0) {
        q = Math.max(0, Math.min(1, -r.top / (vh * 0.22)));
      }
      if (q > 0.08 && !sc.__in) {
        sc.__in = true;
        sc.classList.add('in');
        markChapter(sc);
      }
      // MagicText 逐字点亮：行首从 90% 视口滚到 25% 视口 = lineP 0→1（HextaUI offset 同口径），
      // 每字占 1/n 区间映射 fill opacity；lineP>0 即行入场（.on 只加不减）；屏外行跳过。
      // 融变区（.ms-track 吸顶）内的行位置固定不动 → 改用区段滚动进度驱动；
      // 每行独立窗口（总 2.7 屏均分）：一行亮完才亮下一行，且第四张图片出现（hold3 起点 = 2.7 屏）时全部亮完
      // （用户口径：一个一个的，不多排一起 + 亮起速度到第四张图时才亮完）
      var msTrackOf = sc.querySelector('.ms-track');
      var msPos = msTrackOf ? Math.max(0, -msTrackOf.getBoundingClientRect().top / vh) : 0;
      var msWin = msTrackOf ? 2.7 / Math.max(1, sc.querySelectorAll('.narration .line').length) : 0;
      var ls = sc.querySelectorAll('.narration .line');
      for (var j = 0; j < ls.length; j++) {
        var line = ls[j];
        var lineP;
        if (msTrackOf) {
          lineP = Math.max(0, Math.min(1, (msPos - j * msWin) / msWin));
        } else {
          // 全场景统一「一行亮完才亮下一行」（用户口径：不要多行一起亮）：
          // 普通场景用严格序列入场进度 q 均分窗口（总 0.9）——行 j 在 q∈[j·W,(j+1)·W] 内逐字点亮
          var lWin = 0.9 / Math.max(1, ls.length);
          lineP = Math.max(0, Math.min(1, (q - j * lWin) / lWin));
        }
        if (lineP > 0) line.classList.add('on');
        var fills = line.querySelectorAll('.mw-fill');
        var fn = fills.length;
        if (!fn) continue;
        for (var k = 0; k < fn; k++) {
          var s = k / fn, e = (k + 1) / fn;
          var o = (lineP - s) / (e - s);
          o = Math.max(0, Math.min(1, o));
          fills[k].style.opacity = o.toFixed(3);
        }
      }
      // ScrollExpand 序章展开：track 顶过 0 → 1.2 视口映射目标进度，smoothing 0.1 指数平滑
      var track = sc.querySelector('.se-track');
      if (track) {
        var tgt = Math.max(0, Math.min(1, -track.getBoundingClientRect().top / (vh * 1.2)));
        var cur = sc.__seCur == null ? tgt : sc.__seCur;
        var kse = 1 - Math.exp(-1 / (60 * 0.1));
        cur += (tgt - cur) * kse;
        if (Math.abs(tgt - cur) < 0.0004) cur = tgt;
        else seRunning = true;
        sc.__seCur = cur;
        applySe(sc, cur);
      }
      // MorphSlider 融变图集：传原始屏高单位位置（停留 0.3 屏/过渡 0.6 屏由引擎映射）；引擎自平滑
      var msTrack = sc.querySelector('.ms-track');
      if (msTrack && window.storyMorph) {
        window.storyMorph.setProgress(-msTrack.getBoundingClientRect().top / vh);
      }
      // ScrollReveal（用户组件语义：容器 rotate 3°→0 + 逐字 0.1→1 + blur 4px→0，每字 0.05 错峰）
      // 驱动改为严格序列入场进度 q——标题随本场景通过视口顶揭示，动画全程可见、可逆（滚回去即回 0.1/旋转态）
      var srTitles = sc.querySelectorAll('.sr-title');
      for (var sj = 0; sj < srTitles.length; sj++) {
        var tEl = srTitles[sj];
        var wp = q;
        tEl.style.transform = 'rotate(' + (3 * (1 - wp)).toFixed(2) + 'deg)';
        var ws = tEl.querySelectorAll('.word');
        var wn = ws.length;
        if (wn) {
          var factor = 1 + (wn - 1) * 0.05;
          for (var wk = 0; wk < wn; wk++) {
            var wi = Math.max(0, Math.min(1, wp * factor - wk * 0.05));
            ws[wk].style.opacity = (0.1 + 0.9 * wi).toFixed(3);
            ws[wk].style.filter = 'blur(' + (4 * (1 - wi)).toFixed(2) + 'px)';
          }
        }
      }
    }
    var top = window.pageYOffset || doc.documentElement.scrollTop || 0;
    doc.documentElement.style.setProperty('--progress', total > 0 ? (top / total).toFixed(4) : '0');
    if (seRunning) schedule();
  }
  function schedule() {
    if (rafId === null) rafId = window.requestAnimationFrame(tick);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', function () {
    for (var i = 0; i < scenes.length; i++) {
      measureSe(scenes[i]);
      scenes[i].__seCur = null; // 尺寸变了进度直接对齐目标（跟 ScrollExpand onResize 同口径）
    }
    schedule();
  });
  for (var i = 0; i < scenes.length; i++) measureSe(scenes[i]);
  tick();
})();
