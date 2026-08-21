/**
 * M.LoreWorld i18n — lightweight dictionary-based localization.
 *
 * Pages mark translatable text with data-i18n attributes and register
 * per-language dictionaries, then call MN_I18N.apply():
 *
 *   <h1 data-i18n="page.title">社区规则</h1>
 *   MN_I18N.add('zh', { 'page.title': '社区规则' });
 *   MN_I18N.apply();
 *
 * Adding a language later = write one dictionary file
 * (e.g. community-rules.en.js) and include it after the existing one.
 * No HTML changes needed.
 *
 * Current language resolution order:
 *   1. localStorage 'slati_lang' (user choice, e.g. via settings modal)
 *   2. navigator.language (with region fallback, e.g. 'zh-CN' → 'zh')
 *   3. DEFAULT_LANG ('zh')
 * Languages without a registered dictionary are skipped.
 *
 * Supported attributes:
 *   data-i18n              → element textContent
 *   data-i18n-html         → element innerHTML (only when markup is needed)
 *   data-i18n-placeholder  → input placeholder
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'slati_lang';
  var DEFAULT_LANG = 'zh';

  var dicts = {};       // lang → { 'key.path': 'text' }
  var lang = DEFAULT_LANG;
  var listeners = [];   // fn(lang) called after every apply()

  function lookup(dict, key) {
    return key.split('.').reduce(function (o, k) {
      return (o == null) ? undefined : o[k];
    }, dict);
  }

  function t(l, key) {
    var dict = dicts[l];
    return dict ? lookup(dict, key) : undefined;
  }

  function resolveLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && dicts[saved]) return saved;
    } catch (e) {}
    var nav = (navigator.language || '').toLowerCase();
    if (dicts[nav]) return nav;
    var base = nav.split('-')[0];
    if (dicts[base]) return base;
    return DEFAULT_LANG;
  }

  function apply() {
    lang = resolveLang();
    document.documentElement.setAttribute('lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var text = t(lang, el.getAttribute('data-i18n'));
      if (text != null) el.textContent = text;
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var html = t(lang, el.getAttribute('data-i18n-html'));
      if (html != null) el.innerHTML = html;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var ph = t(lang, el.getAttribute('data-i18n-placeholder'));
      if (ph != null) el.setAttribute('placeholder', ph);
    });

    listeners.forEach(function (fn) { try { fn(lang); } catch (e) {} });
  }

  window.MN_I18N = {
    /** Register a language dictionary. Merges into the existing one so pages can
     *  include several dictionary files (e.g. help.zh.js + badge.zh.js). Chainable. */
    add: function (l, dict) {
      var cur = dicts[l] || {};
      Object.keys(dict).forEach(function (k) { cur[k] = dict[k]; });
      dicts[l] = cur;
      return window.MN_I18N;
    },
    /** Persist the user's choice and re-render. Unknown languages fall back gracefully. */
    setLang: function (l) {
      try { localStorage.setItem(STORAGE_KEY, l); } catch (e) {}
      apply();
    },
    /** Current active language code (after apply). */
    getLang: function () { return lang; },
    /** Whether a dictionary exists for the language. */
    hasLang: function (l) { return !!dicts[l]; },
    /** Translate a dotted key in the current language. */
    t: function (key) { return t(lang, key); },
    /** Re-render all data-i18n elements (call after DOM changes). */
    apply: apply,
    /** Register a callback invoked after every language switch. */
    onChange: function (fn) { listeners.push(fn); }
  };
})();
