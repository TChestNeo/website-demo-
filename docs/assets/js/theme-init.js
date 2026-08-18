/**
 * Theme flash prevention — runs BEFORE CSS to avoid white flash.
 * Inline-equivalent: tiny, synchronous, no DOM queries except <html>.
 */
(function () {
  var theme = 'light';
  try {
    var raw = localStorage.getItem('slati_settings');
    if (raw) {
      var s = JSON.parse(raw);
      if (s.theme) theme = s.theme;
    }
  } catch (e) {}

  // Resolve auto / system → light | dark
  if (theme === 'auto') {
    var h = new Date().getHours();
    theme = (h >= 20 || h < 5) ? 'dark' : 'light';
  } else if (theme === 'system') {
    theme = 'light';
  }

  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
