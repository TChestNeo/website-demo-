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
      card.addEventListener('mousemove', function (e) {
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
