/**
 * Subnav Slider — shared sliding highlight for subnav pills
 * Auto-initializes on all .subnav[data-slider] elements
 *
 * Layered approach (top → bottom):
 *   z-3: Bold clone text (transparent bg)
 *   z-2: Highlight background card
 *   z-1: Original pill text (transparent bg)
 *   z---: Subnav base background
 * This prevents original/clone text from overlapping at the same z-level.
 */
(function(){
  'use strict';

  function initSlider(subnav) {
    if (subnav.querySelector('.subnav-highlight-bg')) return; // already initialized

    var computed = getComputedStyle(subnav);
    if (computed.position === 'static') subnav.style.position = 'relative';
    subnav.style.overflow = 'hidden';

    // ── Original pills: transparent, just provide layout + z-index baseline ──
    var pills = subnav.querySelectorAll('.subnav-pill');
    pills.forEach(function(p) {
      p.style.position = 'relative';
      p.style.zIndex = '1';
      p.style.background = 'transparent';
      if (p.classList.contains('active')) {
        p.style.boxShadow = 'none';
      }
    });

    // ── Layer z-2: Background card (colored pill shape, no text) ──
    var bg = document.createElement('div');
    bg.className = 'subnav-highlight-bg';
    bg.style.cssText = 'position:absolute;top:4.2px;height:calc(100% - 8px);border-radius:var(--radius-full);background:var(--color-surface-container-lowest);box-shadow:var(--shadow-sm);pointer-events:none;z-index:2;will-change:left,width,transform';
    subnav.appendChild(bg);

    // ── Layer z-3: Text overflow clip (bold clones only, no background) ──
    var textClip = document.createElement('div');
    textClip.className = 'subnav-highlight-text';
    textClip.style.cssText = 'position:absolute;top:4.2px;height:calc(100% - 8px);overflow:hidden;border-radius:var(--radius-full);pointer-events:none;z-index:3;will-change:left,width';
    subnav.appendChild(textClip);

    // Inner container with absolute-positioned clone pills
    var inner = document.createElement('div');
    inner.className = 'subnav-highlight-inner';
    inner.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none';
    textClip.appendChild(inner);

    // Clone each pill — bold text, no background
    var clones = [];
    pills.forEach(function(p) {
      var clone = document.createElement('span');
      clone.textContent = p.textContent;
      clone.className = 'subnav-highlight-clone';
      clone.style.cssText = 'position:absolute;top:0;padding:8px 20px;font-size:var(--fs-label-md);font-weight:600;color:var(--color-on-surface);border-radius:var(--radius-full);text-align:center;white-space:nowrap;font-family:inherit;line-height:1.5;';
      inner.appendChild(clone);
      clones.push({ el: clone, src: p });
    });

    // ── Trailing blob (behind everything) ──
    var blob = document.createElement('div');
    blob.className = 'subnav-blob';
    blob.style.cssText = 'position:absolute;top:4.2px;height:calc(100% - 8px);border-radius:var(--radius-full);background:rgba(70,72,212,0.12);opacity:0;pointer-events:none;z-index:0;will-change:left,width,opacity,transform';
    subnav.appendChild(blob);

    // ── State ──
    var sliderReady = false;
    var slimeTimers = [];

    function clearSlimeTimers() {
      slimeTimers.forEach(function(t) { clearTimeout(t); });
      slimeTimers = [];
    }

    function getTarget() {
      var active = subnav.querySelector('.subnav-pill.active');
      if (!active) return null;
      return { left: active.offsetLeft, width: active.offsetWidth };
    }

    function syncCloneWidths() {
      clones.forEach(function(c) {
        c.el.style.left = c.src.offsetLeft + 'px';
        c.el.style.width = c.src.offsetWidth + 'px';
      });
    }

    function updateSlider(skipAnim) {
      var target = getTarget();
      if (!target) return;

      if (skipAnim || !sliderReady) {
        syncCloneWidths();
      }

      var curLeft = parseFloat(bg.style.left) || target.left;
      var curWidth = parseFloat(bg.style.width) || target.width;

      // Background card
      bg.style.transition = skipAnim ? 'none' : 'left 0.55s cubic-bezier(0.25,0.1,0.25,1), width 0.55s cubic-bezier(0.25,0.1,0.25,1), transform 0.55s cubic-bezier(0.25,0.1,0.25,1)';
      bg.style.left = target.left + 'px';
      bg.style.width = target.width + 'px';

      // Text clip — same position as bg
      textClip.style.transition = skipAnim ? 'none' : 'left 0.55s cubic-bezier(0.25,0.1,0.25,1), width 0.55s cubic-bezier(0.25,0.1,0.25,1)';
      textClip.style.left = target.left + 'px';
      textClip.style.width = target.width + 'px';

      // Inner — shift inversely so active clone aligns at 0 inside clip
      inner.style.transition = skipAnim ? 'none' : 'left 0.55s cubic-bezier(0.25,0.1,0.25,1)';
      inner.style.left = '-' + target.left + 'px';

      if (sliderReady && !skipAnim) {
        // Trailing blob
        blob.style.transition = 'none';
        blob.style.left = curLeft + 'px';
        blob.style.width = curWidth + 'px';
        blob.style.opacity = '0.3';
        blob.style.transform = 'scaleX(1) scaleY(1)';
        requestAnimationFrame(function() {
          blob.style.transition = 'opacity 0.5s ease, transform 0.55s cubic-bezier(0.25,0.1,0.25,1)';
          blob.style.opacity = '0';
          blob.style.transform = 'scaleX(0.5) scaleY(0.8)';
        });

        // Slime stretch (on background card only)
        clearSlimeTimers();
        bg.style.transform = 'scaleX(1.06) scaleY(0.94)';
        slimeTimers.push(setTimeout(function() {
          bg.style.transform = 'scaleX(0.97) scaleY(1.03)';
        }, 80));
        slimeTimers.push(setTimeout(function() {
          bg.style.transform = 'scaleX(1) scaleY(1)';
        }, 200));
      } else {
        bg.style.transform = 'scaleX(1) scaleY(1)';
        sliderReady = true;
      }
    }

    // Initial position
    syncCloneWidths();
    updateSlider(true);
    setTimeout(function() { syncCloneWidths(); updateSlider(true); }, 100);
    setTimeout(function() { syncCloneWidths(); updateSlider(true); }, 400);

    // Click handler
    subnav.addEventListener('click', function(e) {
      var btn = e.target.closest('.subnav-pill');
      if (!btn) return;

      subnav.querySelectorAll('.subnav-pill').forEach(function(b) {
        b.classList.remove('active');
        b.style.boxShadow = 'none';
      });
      btn.classList.add('active');

      requestAnimationFrame(function() {
        updateSlider(false);
      });
    });

    // Resize
    var resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() { syncCloneWidths(); updateSlider(true); }, 150);
    });

    // Observe class changes
    var observer = new MutationObserver(function() {
      requestAnimationFrame(function() {
        updateSlider(false);
      });
    });
    pills.forEach(function(p) {
      observer.observe(p, { attributes: true, attributeFilter: ['class'] });
    });

    // IntersectionObserver: re-sync when hidden→visible (fixes display:none containers)
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            syncCloneWidths();
            updateSlider(true);
          }
        });
      }, { threshold: 0.1 });
      io.observe(subnav);
    }
  }

  function initAll() {
    document.querySelectorAll('.subnav[data-slider]').forEach(initSlider);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
