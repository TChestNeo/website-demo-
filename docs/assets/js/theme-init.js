/**
 * Theme flash prevention — runs BEFORE CSS to avoid white flash.
 * Inline-equivalent: tiny, synchronous, no DOM queries except <html>.
 * 2026-09-16: also applies accent — data-accent="mono" lands before first
 * paint (mono rules live statically in ethereal.css, inlined with the page;
 * previously both applied at end of body via settings-modal.js → the first
 * paint was the blue family, then it flipped to mono = the page-switch flash).
 */
(function () {
  var theme = 'light';
  var accent = 'blue';
  try {
    var raw = localStorage.getItem('slati_settings');
    if (raw) {
      var s = JSON.parse(raw);
      if (s.theme) theme = s.theme;
      if (s.accent) accent = s.accent;
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
  if (accent === 'mono') {
    document.documentElement.setAttribute('data-accent', 'mono');
  }
})();
