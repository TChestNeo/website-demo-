// fc-touch.js — FC v10.28.43.0 iPad 触控桥（touch → 合成 mouse 喂现有监听链）
// 门控：matchMedia('(pointer: coarse)') 不符即整体 return——桌面字节恒同零影响。
// 原理：touchstart 一律 preventDefault（杀 iOS 合成鼠标+原生滚动，避免双处理）；
//   合成 MouseEvent 走 document 级 mousemove/mouseup 收单（编辑器 16.5k 行零
//   isTrusted 检查、零 setPointerCapture，合成事件安全）。
// 手势：卡片拖动 / 拉手柄缩放 / 旋转 / 表格行列柄 / 长按 500ms 菜单（7577-7584
//   组拆分计时器由 __fcTouchGesture 守卫互斥）/ tap 点选 + 双 tap 合成 dblclick /
//   空画布 tap 取消选中 / 单指平移+惯性 / 双指捏合 setViewZoom+双指平移 /
//   资产面板 tap 建卡（不 preventDefault，保面板原生滚动）。
// 文字编辑保命：inEditableZone() 豁免输入区——键盘/光标零拦截。
// 查看模式（body.fc-viewmode）全程 no-op，只读视图保留原生滚动。
(function () {
  'use strict';
  if (!window.matchMedia('(pointer: coarse)').matches) return;

  // §1 状态 + 测试钩
  var GEST = { CARD: 1, HANDLE: 2, ROTATE: 3, GRIP: 4, CANVAS: 5, PINCH: 6, ASSET: 7 };
  var g = null;              // 当前手势
  var longPressTimer = null; // 长按计时器（500ms）
  var suppressClick = false; // 长按路径吞掉本次 click 合成
  var lastTap = null;        // 双 tap 判定
  var mom = null;            // 惯性 rAF 状态
  var assetCooldown = 0;     // 资产 tap 建卡 400ms 冷却
  var stats = { tap: 0, drag: 0, longPress: 0, pinch: 0, pan: 0, asset: 0 };
  window.__fcTouch = { stats: stats, active: function () { return !!g; } };

  // §2 懒 helper（只在手势回调里碰编辑器全局——加载顺序无关）
  function canvasEl() { return document.getElementById('gridCanvas'); }
  function scrollEl() { var c = canvasEl(); return c ? c.parentElement : null; }
  function currentZoom() { var c = canvasEl(); if (!c) return 1; return parseFloat(c.style.zoom) || 1; }
  function isViewmode() { return document.body.classList.contains('fc-viewmode'); }
  function makeMouse(type, x, y, extra) {
    var init = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    if (extra) { for (var k in extra) init[k] = extra[k]; }
    return new MouseEvent(type, init);
  }
  // 文字/输入/按钮区豁免——触控桥零拦截，原生键盘光标点击全保持
  function inEditableZone(el) {
    if (!el || el.nodeType !== 1) return false;
    return !!el.closest('input, textarea, select, button, a, [contenteditable="true"], .card-text-content, .card-edit-field, .card-label');
  }
  // 浮面豁免——面板/弹窗/菜单内的触控走原生（内部滚动+按钮 tap）
  function inFloatExclude(el) {
    if (!el || el.nodeType !== 1) return false;
    return !!el.closest('.asset-panel, .stats-edit-panel, .font-panel, .context-menu, .text-toolbar, .radius-popover, .mre-stage, .mre-side, .mre-panel');
  }
  function classify(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.closest('.resize-handle')) return GEST.HANDLE;
    if (el.closest('.rotate-grip')) return GEST.ROTATE;
    if (el.closest('.sheet-col-grip, .sheet-row-grip')) return GEST.GRIP;
    if (el.closest('.grid-card')) return GEST.CARD;
    return null;
  }
  function clearLongPress() { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } }

  // §3 touchstart 委托（passive:false——document 级触控默认 passive，必须显式关）
  function onTouchStart(e) {
    if (isViewmode()) return; // 查看模式全程 no-op
    stopMomentum();
    var t = e.changedTouches[0];
    if (!t) return;
    var x = t.clientX, y = t.clientY;

    // 第二指落下 → 双指接管：先干净结束在途单指手势
    if (e.touches.length >= 2) {
      if (g && g.type === GEST.PINCH) return; // 第三指忽略
      if (g) {
        if (g.type === GEST.CARD || g.type === GEST.HANDLE || g.type === GEST.ROTATE || g.type === GEST.GRIP) {
          window.__fcTouchGesture = false;
          clearLongPress();
          document.dispatchEvent(makeMouse('mouseup', g.x || g.sx, g.y || g.sy, { button: 0 }));
        }
        g = null; // ASSET 直接放弃；CANVAS 让位捏合
      }
      if (inEditableZone(e.target)) return; // 第二指落在按钮/输入上 → 整体让给原生
      startPinch(e);
      return;
    }
    if (g) return;

    // 资产面板 tap 建卡：不 preventDefault（面板原生滚动保持）
    var assetCard = e.target.closest ? e.target.closest('.asset-panel .card[draggable]') : null;
    if (assetCard) {
      if (inEditableZone(e.target)) return;
      g = { type: GEST.ASSET, el: assetCard, sx: x, sy: y, t0: Date.now(), moved: false };
      return;
    }
    if (inFloatExclude(e.target)) return; // 浮面 → 原生
    if (inEditableZone(e.target)) return; // 输入/按钮 → 原生

    var cls = classify(e.target);
    if (cls) { // CARD / HANDLE / ROTATE / GRIP
      e.preventDefault();
      startCardGesture(e.target, x, y, cls);
      return;
    }
    // 编辑器画布区其余（gridCanvas 空白 / 组背景 / 控件行空隙）→ 单指平移手势
    if (e.target.closest('.editor-body')) {
      e.preventDefault();
      g = { type: GEST.CANVAS, el: e.target, sx: x, sy: y, lx: x, ly: y, moved: false, vx: 0, vy: 0, vt: Date.now() };
      // 空画布按下 = 取消选中（14881 e.target===gridCanvas 同款；组背景自身无 mousedown 监听无害）
      if (e.target === canvasEl()) e.target.dispatchEvent(makeMouse('mousedown', x, y, { button: 0 }));
      return;
    }
    // 其余（header 非按钮区等）原生
  }

  // §4 卡片手势启动 + 长按计时器
  function startCardGesture(el, x, y, type) {
    // 长按守卫：7577-7584 组拆分计时器读它——长按菜单与拆分互斥（双保险：
    // 长按触发的 mouseup 本就会清计时器，守卫防任何漏网路径）
    window.__fcTouchGesture = true;
    el.dispatchEvent(makeMouse('mousedown', x, y, { button: 0 }));
    g = { type: type, el: el, sx: x, sy: y, x: x, y: y, moved: false };
    suppressClick = false;
    if (type === GEST.CARD) {
      longPressTimer = setTimeout(function () {
        if (!g || g.type !== GEST.CARD || g.moved) return;
        g.longPressed = true;
        suppressClick = true;
        window.__fcTouchGesture = false; // 先复位守卫再派发
        document.dispatchEvent(makeMouse('mouseup', g.x, g.y, { button: 0 })); // 干净撤销已 arm 拖拽
        window.__fcTouchMenu = true;                                            // v10.28.44.0: 触控长按旗——showContextMenu 同步读走（药丸菜单）
        el.dispatchEvent(makeMouse('contextmenu', g.x, g.y, { button: 2 }));    // 7869 → showContextMenu
        window.__fcTouchMenu = false;                                           // dispatchEvent 同步已读完；兜底清零
        stats.longPress++;
      }, 500);
    }
  }

  // §5 touchmove 委托
  function onTouchMove(e) {
    if (!g) return;
    var t = e.changedTouches[0];
    if (!t) return;
    var x = t.clientX, y = t.clientY;
    if (g.type === GEST.PINCH) { e.preventDefault(); movePinch(e); return; }
    if (g.type === GEST.ASSET) {
      // 不 preventDefault——面板原生滚动保持；移动超 10px 放弃建卡
      if (Math.abs(x - g.sx) > 10 || Math.abs(y - g.sy) > 10) g.moved = true;
      return;
    }
    if (g.type === GEST.CANVAS) {
      e.preventDefault();
      var s = scrollEl();
      var dx = x - g.lx, dy = y - g.ly;
      if (!g.moved && (Math.abs(x - g.sx) > 3 || Math.abs(y - g.sy) > 3)) { g.moved = true; stats.pan++; }
      if (s) { s.scrollLeft -= dx; s.scrollTop -= dy; }
      var now = Date.now();
      var dt = now - g.vt;
      if (dt > 0) { g.vx = dx / dt * 16; g.vy = dy / dt * 16; } // px/帧 速度采样（惯性）
      g.vt = now;
      g.lx = x; g.ly = y;
      return;
    }
    // CARD / HANDLE / ROTATE / GRIP → 合成 mousemove 转发（dragFrame ÷viewZoom/对齐/合并全复用）
    e.preventDefault();
    if (g.longPressed) return; // 长按菜单已开 → 拖拽死亡
    if (!g.moved && (Math.abs(x - g.sx) > 3 || Math.abs(y - g.sy) > 3)) {
      g.moved = true;
      if (g.type === GEST.CARD) stats.drag++;
    }
    g.x = x; g.y = y;
    document.dispatchEvent(makeMouse('mousemove', x, y));
  }

  // §6 touchend / touchcancel
  function onTouchEnd(e) {
    if (!g) return;
    var t = e.changedTouches[0];
    if (!t) return;
    var x = t.clientX, y = t.clientY;
    if (g.type === GEST.PINCH) {
      for (var i = 0; i < e.changedTouches.length; i++) delete g.pts[e.changedTouches[i].identifier];
      if (e.touches.length < 2) g = null; // 剩一指：不回落到单指手势（防误拖）
      return;
    }
    if (g.type === GEST.ASSET) {
      if (!g.moved && (Date.now() - g.t0) <= 600) addAssetAtCenter(g.el);
      g = null;
      return;
    }
    if (g.type === GEST.CANVAS) {
      if (!g.moved) {
        // 空画布 tap → 派给原触点目标：组背景 click 选中组（10804）/ gridCanvas 取消选中（14881）
        g.el.dispatchEvent(makeMouse('mousedown', x, y, { button: 0 }));
        g.el.dispatchEvent(makeMouse('click', x, y));
      }
      startMomentum(g.vx, g.vy);
      g = null;
      return;
    }
    // CARD / HANDLE / ROTATE / GRIP
    var wasLong = !!g.longPressed;
    var el = g.el, moved = g.moved, type = g.type;
    window.__fcTouchGesture = false; // 先复位守卫再派发（长按路径同口径）
    clearLongPress();
    if (!wasLong) {
      document.dispatchEvent(makeMouse('mouseup', x, y, { button: 0 }));
      if (moved) {
        // v10.28.49: 触控拖/缩/转提交=视口转自定义（编辑器 mouseup 提交链已
        // markPresetCustom，此处兜底；钩子缺席零操作——fc-tablet 电池行为不变）
        if (window.markPresetCustom) window.markPresetCustom();
      }
      if (!moved && !suppressClick) {
        // click 合成：tap 选中（7799）；手柄 tap 冒泡到 document 关菜单（11888 同款）
        el.dispatchEvent(makeMouse('click', x, y));
        if (type === GEST.CARD) {
          stats.tap++;
          // 同卡双 tap ≤500ms ≤10px → dblclick（7834：组卡单独选中 / 非组卡改名——
          // 7818 慢双击兜底是组卡专属，改名在触屏上只能走 dblclick）
          if (lastTap && lastTap.el === el && (Date.now() - lastTap.t) <= 500 &&
              Math.abs(x - lastTap.x) <= 10 && Math.abs(y - lastTap.y) <= 10) {
            el.dispatchEvent(makeMouse('dblclick', x, y, { detail: 2 }));
            lastTap = null;
          } else {
            lastTap = { el: el, t: Date.now(), x: x, y: y };
          }
        }
      }
    }
    suppressClick = false;
    g = null;
  }
  function onTouchCancel(e) {
    if (!g) return;
    if (g.type === GEST.CARD || g.type === GEST.HANDLE || g.type === GEST.ROTATE || g.type === GEST.GRIP) {
      window.__fcTouchGesture = false;
      clearLongPress();
      if (!g.longPressed) document.dispatchEvent(makeMouse('mouseup', g.x || g.sx, g.y || g.sy, { button: 0 }));
    }
    suppressClick = false;
    g = null;
  }

  // §6.5 双指捏合 / 双指平移
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function startPinch(e) {
    e.preventDefault();
    var pts = {};
    for (var i = 0; i < e.touches.length; i++) {
      var t = e.touches[i];
      pts[t.identifier] = { x: t.clientX, y: t.clientY };
    }
    var ids = Object.keys(pts);
    var a = pts[ids[0]], b = pts[ids[1]];
    var d = dist(a, b);
    g = { type: GEST.PINCH, pts: pts, startDist: d || 1, startZoom: currentZoom(), lastDist: d, lastMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }
  function movePinch(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (g.pts[t.identifier]) { g.pts[t.identifier].x = t.clientX; g.pts[t.identifier].y = t.clientY; }
    }
    var ids = Object.keys(g.pts);
    if (ids.length < 2) return;
    var a = g.pts[ids[0]], b = g.pts[ids[1]];
    var d = dist(a, b);
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (Math.abs(d - g.lastDist) > 4) {
      // 距离变化 → 捏合缩放（中点锚定 setViewZoom，zoomChip 实时 %；0.25–4× 钳制同页面）
      var z = Math.max(0.25, Math.min(4, g.startZoom * (d / g.startDist)));
      if (window.setViewZoom) window.setViewZoom(z, mx, my);
      stats.pinch++;
      g.lastDist = d;
    } else {
      // 距离±4px 内视为双指平移
      var s = scrollEl();
      if (s) { s.scrollLeft -= (mx - g.lastMid.x); s.scrollTop -= (my - g.lastMid.y); }
    }
    g.lastMid = { x: mx, y: my };
  }

  // §7 资产 tap 建卡（13715-13807 同款公式：span 表 + cc/cr 偏移 + 类型分发 + XP + 落草稿）
  var ASSET_SPAN = { flag: [8, 5], shield: [5, 5], content: [8, 4], character: [4, 5], map: [8, 6], stats: [6, 5], history_edu: [8, 8], sne: [9, 12], sheet: [10, 7] };
  function addAssetAtCenter(el) {
    var now = Date.now();
    if (now - assetCooldown < 400) return; // 防连点重复建卡
    assetCooldown = now;
    var asset = el.dataset.asset, label = el.dataset.label || asset;
    var span = ASSET_SPAN[asset] || [4, 3];
    var spanW = span[0], spanH = span[1];
    var cv = canvasEl();
    if (!cv) return;
    var rect = cv.getBoundingClientRect();
    var zoom = currentZoom();
    var cs = parseInt(getComputedStyle(cv).getPropertyValue('--cell-size').trim()) || 100; // 5446-5448 同款
    var gap = 2;
    // 视口中心 → 画布局部（÷zoom）→ 格子行列 → cc/cr 偏移（13781-13782 同款）；
    // 用视口中心换算（rect 是视口坐标，画布比视口宽时 rect.width/2 会落在视口外）
    var lx = (window.innerWidth / 2 - rect.left) / zoom;
    var ly = (window.innerHeight / 2 - rect.top) / zoom;
    var col = Math.max(1, Math.floor(lx / (cs + gap)) + 1);
    var row = Math.max(1, Math.floor(ly / (cs + gap)) + 1);
    var cc = Math.max(1, col - Math.floor(spanW / 2));
    var cr = Math.max(1, row - Math.floor(spanH / 2));
    try {
      if (asset === 'flag') window.createFlagCard(label, cc, cr, spanW, spanH);
      else if (asset === 'content') window.createContentCard(cc, cr, spanW, spanH);
      else if (asset === 'character') window.createCharacterCard(cc, cr, spanW, spanH);
      else if (asset === 'map') window.createMapCard(cc, cr, spanW, spanH);
      else if (asset === 'stats') window.createStatsCard(cc, cr, spanW, spanH);
      else if (asset === 'history_edu') window.createTimelineCard(cc, cr, spanW, spanH);
      else if (asset === 'sne') window.createSneCard(cc, cr, spanW, spanH);
      else if (asset === 'sheet') window.createSheetCard(cc, cr, spanW, spanH);
      else window.createAssetCard(asset, label, cc, cr, spanW, spanH);
      if (window.SlatiDB && window.SlatiDB.addXP) window.SlatiDB.addXP('card_create', 10);
      if (window.onContentChange) window.onContentChange();
      if (window.markPresetCustom) window.markPresetCustom(); // v10.28.49: tap 建卡=视口转自定义（编辑器钩子缺席零操作）
      stats.asset++;
    } catch (err) { /* 建卡失败静默——触控桥不打断编辑主流程 */ }
  }

  // §8 平移惯性（rAF 0.94 衰减；任何新触点即停）
  function stopMomentum() { mom = null; }
  function startMomentum(vx, vy) {
    if (Math.abs(vx) < 1 && Math.abs(vy) < 1) return;
    mom = { vx: vx, vy: vy };
    (function step() {
      if (!mom) return;
      mom.vx *= 0.94; mom.vy *= 0.94;
      if (Math.abs(mom.vx) < 0.3 && Math.abs(mom.vy) < 0.3) { mom = null; return; }
      var s = scrollEl();
      if (!s) { mom = null; return; }
      s.scrollLeft -= mom.vx; s.scrollTop -= mom.vy;
      requestAnimationFrame(step);
    })();
  }

  // 挂载（document 单点委托，passive:false——Chrome 对 document 级触控默认 passive）
  document.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });
  document.addEventListener('touchcancel', onTouchCancel, { passive: false });
})();
