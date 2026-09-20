// tmp-add-toc-keys.js — v0.2.57.0: article.i18n.js 每语言块插入 4 新键（tags.label/toc.toggle/toc.title/toc.close）
// zh 值与 article.html 页面兜底串逐字节一致；zh-Hant 由 tmp-i18n-hant.js 单独重生成
const fs = require('fs');
const p = 'docs/assets/i18n/article.i18n.js';
let s = fs.readFileSync(p, 'utf8');
const keys = {
  zh: { tags: '标签', toggle: '打开目录', title: '目录', close: '关闭目录' },
  en: { tags: 'Tags', toggle: 'Open table of contents', title: 'Contents', close: 'Close' },
  de: { tags: 'Tags', toggle: 'Inhaltsverzeichnis öffnen', title: 'Inhaltsverzeichnis', close: 'Schließen' },
  ru: { tags: 'Теги', toggle: 'Открыть оглавление', title: 'Оглавление', close: 'Закрыть' },
  ms: { tags: 'Tag', toggle: 'Buka senarai kandungan', title: 'Senarai kandungan', close: 'Tutup' },
  th: { tags: 'แท็ก', toggle: 'เปิดสารบัญ', title: 'สารบัญ', close: 'ปิด' },
  vi: { tags: 'Thẻ', toggle: 'Mở mục lục', title: 'Mục lục', close: 'Đóng' },
  id: { tags: 'Tag', toggle: 'Buka daftar isi', title: 'Daftar isi', close: 'Tutup' },
  fr: { tags: 'Tags', toggle: 'Ouvrir la table des matières', title: 'Table des matières', close: 'Fermer' },
  es: { tags: 'Etiquetas', toggle: 'Abrir tabla de contenidos', title: 'Tabla de contenidos', close: 'Cerrar' },
  pt: { tags: 'Tags', toggle: 'Abrir índice', title: 'Índice', close: 'Fechar' },
};
let count = 0;
for (const [lang, k] of Object.entries(keys)) {
  const re = new RegExp("(\\.add\\('" + lang + "', \\{[\\s\\S]*?\\n)(  \\}\\))");
  const before = s;
  s = s.replace(re, function (m, pre, post) {
    return pre +
      "\n    // ── v0.2.57.0 标签条 + 目录 ──\n" +
      "    'article.tags.label': '" + k.tags + "',\n" +
      "    'article.toc.toggle': '" + k.toggle + "',\n" +
      "    'article.toc.title': '" + k.title + "',\n" +
      "    'article.toc.close': '" + k.close + "'\n" +
      post;
  });
  if (s === before) { console.error('FAILED: ' + lang); process.exit(1); }
  count++;
}
fs.writeFileSync(p, s);
console.log('inserted into ' + count + ' language blocks');
