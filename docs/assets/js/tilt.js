/**
 * 3D Perspective Tilt Effect
 * Shared across all M.NationWorld pages.
 * Apply to any element with class "tilt-container".
 */
(function () {
  'use strict';

  const MAX_ROTATION = 2.0; // degrees
  const PERSPECTIVE = 1000; // px

  function initTilt(containers) {
    containers.forEach(function (card) {
      if (card._slatiTiltBound) return; // v0.2.45.2：防重复绑定（renderContent 每次切换 re-init，旧版监听器永久堆叠）
      card._slatiTiltBound = true;
      card.addEventListener('mousemove', function (e) {
        if (card.getAttribute('data-tilt-off')) return; // v0.2.45.2：切场动画期间冻结（覆写切场 transform → 卡片跳回）
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var centerX = rect.width / 2;
        var centerY = rect.height / 2;
        var rotateY = ((x - centerX) / centerX) * MAX_ROTATION;
        var rotateX = -((y - centerY) / centerY) * MAX_ROTATION;
        card.style.transform =
          'perspective(' + PERSPECTIVE + 'px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
      });

      card.addEventListener('mouseleave', function () {
        if (card.getAttribute('data-tilt-off')) return; // 同上：卡片滑出指针下方触发 mouseleave 时不得覆写切场 transform
        card.style.transform =
          'perspective(' + PERSPECTIVE + 'px) rotateX(0deg) rotateY(0deg)';
      });
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initTilt(document.querySelectorAll('.tilt-container'));
    });
  } else {
    initTilt(document.querySelectorAll('.tilt-container'));
  }

  // Re-init after dynamic content loads (expose globally)
  window.SlatiTilt = { init: initTilt };
})();
