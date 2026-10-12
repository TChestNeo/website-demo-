/* story-i18n.js — 政治启蒙故事站多语言运行时（v0.2.59.36）
 * 设计：故事动画（BlurText/MagicText/名言逐字）都在 DOMContentLoaded 按文本拆分——
 *       语言必须在 story.js 之前同步套用，动画才对译文生效。
 * 因此：同步 XHR 加载单一语言词典（本域小文件，一次 ~几十 KB）→ 套用 → story.js 再跑。
 * 语言解析：?lang= → localStorage story_lang → navigator.language → zh（HTML 兜底即中文）。
 * data-lang 挂 html 供设计适配 CSS；zh 无需词典（页面兜底文本即简体中文）。
 */
(function () {
  'use strict';

  var LANGS = [
    { code: 'zh', file: null, label: '简体中文' },
    { code: 'zht', file: 'story-zht.js', label: '繁體中文' },
    { code: 'en', file: 'story-en.js', label: 'English' },
    { code: 'de', file: 'story-de.js', label: 'Deutsch' },
    { code: 'ru', file: 'story-ru.js', label: 'Русский' },
    { code: 'ms', file: 'story-ms.js', label: 'Bahasa Melayu' },
    { code: 'th', file: 'story-th.js', label: 'ไทย' },
    { code: 'vi', file: 'story-vi.js', label: 'Tiếng Việt' },
    { code: 'id', file: 'story-id.js', label: 'Bahasa Indonesia' },
    { code: 'fr', file: 'story-fr.js', label: 'Français' },
    { code: 'es', file: 'story-es.js', label: 'Español' },
    { code: 'pt', file: 'story-pt.js', label: 'Português' }
  ];
  var FILE_OF = {};
  LANGS.forEach(function (l) { FILE_OF[l.code] = l.file; });

  // 1. 语言解析
  function langFromNav() {
    try {
      var n = (navigator.language || 'zh').toLowerCase().replace('_', '-');
      if (n.indexOf('zh-hant') === 0 || n.indexOf('zh-tw') === 0 || n.indexOf('zh-hk') === 0) return 'zht';
      if (n.indexOf('zh') === 0) return 'zh';
      var two = n.slice(0, 2);
      if (FILE_OF[two]) return two;
    } catch (e) {}
    return 'zh';
  }
  function resolveLang() {
    var m = /[?&]lang=([a-z]{2,5})/i.exec(location.search);
    if (m && FILE_OF[m[1]] !== undefined) return m[1];
    try {
      var s = localStorage.getItem('story_lang');
      if (s && FILE_OF[s] !== undefined) return s;
    } catch (e) {}
    return langFromNav();
  }
  var lang = resolveLang();
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('data-lang', lang);

  // 2. 同步加载词典（zh 无文件：页面兜底即中文）
  var dict = null;
  var file = FILE_OF[lang];
  if (file) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', 'i18n/' + file, false);
      x.send();
      if (x.status === 200 && x.responseText) {
        (new Function(x.responseText))();
        var g = { en: 'STORY_DICT_EN', de: 'STORY_DICT_DE', ru: 'STORY_DICT_RU', ms: 'STORY_DICT_MS', th: 'STORY_DICT_TH', vi: 'STORY_DICT_VI', id: 'STORY_DICT_ID', fr: 'STORY_DICT_FR', es: 'STORY_DICT_ES', pt: 'STORY_DICT_PT', zht: 'STORY_DICT_ZHT' };
        dict = window[g[lang]] || null;
      }
    } catch (e) { dict = null; }
  }

  // 3. 套用（story.js 之前运行 → 动画拆分的是译文）
  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (dict && dict[k] != null) el.textContent = dict[k];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-html');
      if (dict && dict[k] != null) el.innerHTML = dict[k];
    });
    if (dict && dict.brand) document.title = dict.brand + '｜M.NationWorld';
  }
  apply();

  // 4. 语言选择器（挂品牌头：地球图标 → 下拉）
  function buildPicker() {
    var brand = document.querySelector('.story-brand');
    if (!brand) return;
    var wrap = document.createElement('div');
    wrap.className = 'story-lang';
    var btn = document.createElement('button');
    btn.className = 'story-lang-btn';
    btn.type = 'button';
    btn.title = 'Language / 语言';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.9 5.7 3.9 9S14.5 18.4 12 21c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3z"/></svg>';
    var menu = document.createElement('div');
    menu.className = 'story-lang-menu';
    LANGS.forEach(function (l) {
      var a = document.createElement('button');
      a.type = 'button';
      a.className = 'story-lang-item' + (l.code === lang ? ' on' : '');
      a.textContent = l.label;
      a.addEventListener('click', function () {
        try { localStorage.setItem('story_lang', l.code); } catch (e) {}
        var u = new URL(location.href);
        u.searchParams.set('lang', l.code);
        location.href = u.toString();
      });
      menu.appendChild(a);
    });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      wrap.classList.toggle('open');
    });
    document.addEventListener('click', function () { wrap.classList.remove('open'); });
    wrap.appendChild(btn);
    wrap.appendChild(menu);
    brand.appendChild(wrap);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPicker);
  } else {
    buildPicker();
  }

  window.storyLang = { lang: lang, dictLoaded: !!dict };
})();
