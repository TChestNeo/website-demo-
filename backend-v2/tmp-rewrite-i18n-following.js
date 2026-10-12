// tmp-rewrite-i18n-following.js — v0.2.58.17 关注页真实数据接入：
//   ① 11 语基础块保留（searchPh 值更新为覆盖动态/关注/发现三区的新文案）
//   ② 11 语 v0.2.54.2 demo 块整体替换为 58.17 块：suffix.followers/suffix.members 保留原值 +
//     11 新键（offline×2/loginCta×3/feed.time×2/empty×3/rec.empty）手写译文；
//     37 死键（badge/time/desc/natDesc/topicDesc/role/rec.sub/list.citizen）随 demo 数据一起删除。
//   ③ zh-Hant 自动段剥离——跑完后必须执行 node tmp-i18n-hant.js docs/assets/i18n/following.i18n.js 重生成。
// 用法: node tmp-rewrite-i18n-following.js
'use strict';
const fs = require('fs');
const F = 'C:/Users/USER/Downloads/stitch_slatiworld_micronation_interface/docs/assets/i18n/following.i18n.js';

const LANGS = ['zh', 'en', 'de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt'];

const NEW_SEARCH = {
  zh: '搜索动态、关注和发现的内容...',
  en: 'Search feed, following and discover...',
  de: 'Feed, Gefolgtes und Entdecken durchsuchen …',
  ru: 'Поиск по ленте, подпискам и рекомендациям…',
  ms: 'Cari dalam suapan, ikutan dan teroka...',
  th: 'ค้นหาฟีด รายการที่ติดตาม และค้นพบ...',
  vi: 'Tìm kiếm bảng tin, mục đang theo dõi và khám phá...',
  id: 'Cari feed, yang diikuti, dan jelajah...',
  fr: 'Rechercher dans le fil, les abonnements et la découverte…',
  es: 'Buscar en feed, seguidos y descubrir...',
  pt: 'Pesquisar no feed, nos seguidos e em descobrir...'
};

// 11 新键 × 11 语手写译文（en 值 = 页面兜底串逐字节一致）
const NEW_KEYS = {
  zh: {
    'following.offline.title': '数据暂时不可用',
    'following.offline.desc': '请检查网络连接后重试。',
    'following.loginCta.title': '登录后查看你的动态',
    'following.loginCta.desc': '登录后即可关注国家、话题和公民——他们的更新会出现在这里。',
    'following.loginCta.btn': '去登录',
    'following.feed.time.today': '今天',
    'following.feed.time.daysAgo': '{n} 天前',
    'following.empty.nations': '还没有国家。',
    'following.empty.topics': '还没有话题。',
    'following.empty.users': '还没有公民。',
    'following.rec.empty': '暂时没有推荐。'
  },
  en: {
    'following.offline.title': 'Data temporarily unavailable',
    'following.offline.desc': 'Please check your connection and try again.',
    'following.loginCta.title': 'Log in to see your feed',
    'following.loginCta.desc': 'Sign in to follow nations, topics, and citizens — their updates appear here.',
    'following.loginCta.btn': 'Go to Login',
    'following.feed.time.today': 'Today',
    'following.feed.time.daysAgo': '{n} days ago',
    'following.empty.nations': 'No nations yet.',
    'following.empty.topics': 'No topics yet.',
    'following.empty.users': 'No citizens yet.',
    'following.rec.empty': 'No suggestions right now.'
  },
  de: {
    'following.offline.title': 'Daten vorübergehend nicht verfügbar',
    'following.offline.desc': 'Bitte überprüfe deine Verbindung und versuche es erneut.',
    'following.loginCta.title': 'Melde dich an, um deinen Feed zu sehen',
    'following.loginCta.desc': 'Melde dich an, um Nationen, Themen und Bürgern zu folgen — ihre Updates erscheinen hier.',
    'following.loginCta.btn': 'Zum Login',
    'following.feed.time.today': 'Heute',
    'following.feed.time.daysAgo': 'vor {n} Tagen',
    'following.empty.nations': 'Noch keine Nationen.',
    'following.empty.topics': 'Noch keine Themen.',
    'following.empty.users': 'Noch keine Bürger.',
    'following.rec.empty': 'Aktuell keine Vorschläge.'
  },
  ru: {
    'following.offline.title': 'Данные временно недоступны',
    'following.offline.desc': 'Проверьте подключение и попробуйте ещё раз.',
    'following.loginCta.title': 'Войдите, чтобы увидеть ленту',
    'following.loginCta.desc': 'Войдите, чтобы подписаться на государства, темы и граждан — их обновления появятся здесь.',
    'following.loginCta.btn': 'Войти',
    'following.feed.time.today': 'Сегодня',
    'following.feed.time.daysAgo': '{n} дн. назад',
    'following.empty.nations': 'Пока нет государств.',
    'following.empty.topics': 'Пока нет тем.',
    'following.empty.users': 'Пока нет граждан.',
    'following.rec.empty': 'Сейчас нет рекомендаций.'
  },
  ms: {
    'following.offline.title': 'Data tidak tersedia buat sementara',
    'following.offline.desc': 'Sila semak sambungan anda dan cuba lagi.',
    'following.loginCta.title': 'Log masuk untuk melihat suapan anda',
    'following.loginCta.desc': 'Log masuk untuk mengikuti negara, topik dan warganegara — kemas kini mereka akan muncul di sini.',
    'following.loginCta.btn': 'Pergi ke Log Masuk',
    'following.feed.time.today': 'Hari ini',
    'following.feed.time.daysAgo': '{n} hari lalu',
    'following.empty.nations': 'Tiada negara lagi.',
    'following.empty.topics': 'Tiada topik lagi.',
    'following.empty.users': 'Tiada warganegara lagi.',
    'following.rec.empty': 'Tiada cadangan buat masa ini.'
  },
  th: {
    'following.offline.title': 'ข้อมูลไม่พร้อมใช้งานชั่วคราว',
    'following.offline.desc': 'โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
    'following.loginCta.title': 'เข้าสู่ระบบเพื่อดูฟีดของคุณ',
    'following.loginCta.desc': 'เข้าสู่ระบบเพื่อติดตามประเทศ หัวข้อ และพลเมือง — การอัปเดตของพวกเขาจะปรากฏที่นี่',
    'following.loginCta.btn': 'ไปที่หน้าเข้าสู่ระบบ',
    'following.feed.time.today': 'วันนี้',
    'following.feed.time.daysAgo': '{n} วันที่แล้ว',
    'following.empty.nations': 'ยังไม่มีประเทศ',
    'following.empty.topics': 'ยังไม่มีหัวข้อ',
    'following.empty.users': 'ยังไม่มีพลเมือง',
    'following.rec.empty': 'ยังไม่มีคำแนะนำในตอนนี้'
  },
  vi: {
    'following.offline.title': 'Dữ liệu tạm thời không khả dụng',
    'following.offline.desc': 'Vui lòng kiểm tra kết nối và thử lại.',
    'following.loginCta.title': 'Đăng nhập để xem bảng tin của bạn',
    'following.loginCta.desc': 'Đăng nhập để theo dõi quốc gia, chủ đề và công dân — cập nhật của họ sẽ xuất hiện ở đây.',
    'following.loginCta.btn': 'Đi tới Đăng nhập',
    'following.feed.time.today': 'Hôm nay',
    'following.feed.time.daysAgo': '{n} ngày trước',
    'following.empty.nations': 'Chưa có quốc gia nào.',
    'following.empty.topics': 'Chưa có chủ đề nào.',
    'following.empty.users': 'Chưa có công dân nào.',
    'following.rec.empty': 'Hiện chưa có gợi ý.'
  },
  id: {
    'following.offline.title': 'Data sementara tidak tersedia',
    'following.offline.desc': 'Silakan periksa koneksi Anda dan coba lagi.',
    'following.loginCta.title': 'Masuk untuk melihat feed Anda',
    'following.loginCta.desc': 'Masuk untuk mengikuti negara, topik, dan warga — pembaruan mereka akan muncul di sini.',
    'following.loginCta.btn': 'Buka Halaman Masuk',
    'following.feed.time.today': 'Hari ini',
    'following.feed.time.daysAgo': '{n} hari yang lalu',
    'following.empty.nations': 'Belum ada negara.',
    'following.empty.topics': 'Belum ada topik.',
    'following.empty.users': 'Belum ada warga.',
    'following.rec.empty': 'Belum ada saran saat ini.'
  },
  fr: {
    'following.offline.title': 'Données temporairement indisponibles',
    'following.offline.desc': 'Veuillez vérifier votre connexion et réessayer.',
    'following.loginCta.title': 'Connectez-vous pour voir votre fil',
    'following.loginCta.desc': 'Connectez-vous pour suivre des nations, des sujets et des citoyens — leurs actualités apparaîtront ici.',
    'following.loginCta.btn': 'Aller à la connexion',
    'following.feed.time.today': "Aujourd'hui",
    'following.feed.time.daysAgo': 'il y a {n} jours',
    'following.empty.nations': 'Aucune nation pour le moment.',
    'following.empty.topics': 'Aucun sujet pour le moment.',
    'following.empty.users': 'Aucun citoyen pour le moment.',
    'following.rec.empty': 'Aucune suggestion pour le moment.'
  },
  es: {
    'following.offline.title': 'Datos no disponibles temporalmente',
    'following.offline.desc': 'Comprueba tu conexión e inténtalo de nuevo.',
    'following.loginCta.title': 'Inicia sesión para ver tu feed',
    'following.loginCta.desc': 'Inicia sesión para seguir naciones, temas y ciudadanos: sus novedades aparecerán aquí.',
    'following.loginCta.btn': 'Ir a iniciar sesión',
    'following.feed.time.today': 'Hoy',
    'following.feed.time.daysAgo': 'hace {n} días',
    'following.empty.nations': 'Aún no hay naciones.',
    'following.empty.topics': 'Aún no hay temas.',
    'following.empty.users': 'Aún no hay ciudadanos.',
    'following.rec.empty': 'Sin sugerencias por ahora.'
  },
  pt: {
    'following.offline.title': 'Dados temporariamente indisponíveis',
    'following.offline.desc': 'Verifique sua conexão e tente novamente.',
    'following.loginCta.title': 'Entre para ver seu feed',
    'following.loginCta.desc': 'Entre para seguir nações, tópicos e cidadãos — as novidades deles aparecem aqui.',
    'following.loginCta.btn': 'Ir para o login',
    'following.feed.time.today': 'Hoje',
    'following.feed.time.daysAgo': 'há {n} dias',
    'following.empty.nations': 'Ainda não há nações.',
    'following.empty.topics': 'Ainda não há tópicos.',
    'following.empty.users': 'Ainda não há cidadãos.',
    'following.rec.empty': 'Sem sugestões no momento.'
  }
};

const SENTINEL = '/* __ZH_HANT_AUTO__';

const src = fs.readFileSync(F, 'utf8');
// ① zh-Hant 自动段剥离
let body = src;
const hantIdx = body.indexOf(SENTINEL);
if (hantIdx !== -1) body = body.slice(0, hantIdx).replace(/\s+$/, '') + '\n';

// ② 拆行：基础链块（缩进 2 的 .add(）与 54.2 块（window.MN_I18N.add(）分开
const lines = body.split('\n');
const baseBlocks = {}; // lang -> {headerLineIdx, keyLines}
const secondBlocks = {}; // lang -> {headerLineIdx, keyLines}（待丢弃，但先取 suffix 原值）
let cur = null;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  let m = l.match(/^  \.add\('([a-z-]+)', \{$/);
  if (m) { cur = { kind: 'base', lang: m[1], headerIdx: i, keys: [] }; baseBlocks[m[1]] = cur; continue; }
  m = l.match(/^window\.MN_I18N\.add\('([a-z-]+)', \{$/);
  if (m) { cur = { kind: 'second', lang: m[1], headerIdx: i, keys: [] }; secondBlocks[m[1]] = cur; continue; }
  if (!cur) continue;
  if (l === '  })' || l === '  });') {
    if (cur.kind === 'base') { cur.endIdx = i; cur = null; }
    else if (cur.kind === 'second') { cur.endIdx = i; cur = null; }
    continue;
  }
  if (cur.kind === 'base' || cur.kind === 'second') {
    const km = l.match(/^\s+'following\.([a-zA-Z0-9.]+)':\s*(.+),?\s*$/);
    if (km) cur.keys.push({ key: 'following.' + km[1], raw: l });
    else cur.keys.push({ key: null, raw: l });
  }
}

// ③ 每语取 suffix 原值（单引号 JS 字符串——JSON.parse 不认，手剥引号）
const jsUnquote = (s) => {
  s = s.trim();
  if ((s[0] === "'" && s[s.length - 1] === "'") || (s[0] === '"' && s[s.length - 1] === '"')) {
    return s.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
};
const suffixVals = {};
for (const lang of LANGS) {
  const blk = secondBlocks[lang];
  if (!blk) throw new Error('54.2 块缺失: ' + lang);
  suffixVals[lang] = { followers: null, members: null };
  for (const k of blk.keys) {
    if (k.key === 'following.suffix.followers') suffixVals[lang].followers = jsUnquote(k.raw.match(/: (.+),?$/)[1]);
    if (k.key === 'following.suffix.members') suffixVals[lang].members = jsUnquote(k.raw.match(/: (.+),?$/)[1]);
  }
  if (suffixVals[lang].followers === null || suffixVals[lang].members === null) throw new Error(lang + ' suffix 原值提取失败');
}

// ④ 基础块：searchPh 替换
for (const lang of LANGS) {
  const blk = baseBlocks[lang];
  if (!blk) throw new Error('基础块缺失: ' + lang);
  let hit = false;
  blk.keys = blk.keys.map((k) => {
    if (k.key === 'following.searchPh') {
      hit = true;
      return { key: k.key, raw: "    'following.searchPh': " + JSON.stringify(NEW_SEARCH[lang]) + ',' };
    }
    return k;
  });
  if (!hit) throw new Error(lang + ' searchPh 未找到');
}

// ⑤ 组装新文件
const HEADER = `/**
 * following.i18n.js — 关注页（docs/pages/following.html）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld、MicroNationary、FluidCanvas、Slati Studio；
 * 货币/数值不译：RM、MYR、$11.99、XP）。
 * 页面原文为英文——zh 值为中文翻译（此页无电池断言渲染文本，auth.i18n.js 头注释先例）、
 * fallback 英文保持（HTML 兜底文本/T() 兜底不动）；en 字典=英文原文逐字节。
 * 专有名词不译：国家名、用户名、话题名。
 * v0.2.58.17 关注页真实数据接入：54.2 demo 文案键族（badge/time/desc/natDesc/topicDesc/role/
 * rec.sub/list.citizen）随种子假数据整体删除；新键族：离线卡（following.offline.*）、登录引导
 * （following.loginCta.*）、feed 时间（following.feed.time.today/daysAgo）、发现区空态
 * （following.empty.nations/topics/users）、推荐空态（following.rec.empty）。
 */
`;

const out = [];
out.push(HEADER);
out.push('window.MN_I18N');
LANGS.forEach((lang, i) => {
  const blk = baseBlocks[lang];
  out.push("  .add('" + lang + "', {");
  out.push(blk.keys.map((k) => k.raw).join('\n'));
  out.push(i === LANGS.length - 1 ? '  });' : '  })');
});
out.push('');
out.push('// ── v0.2.58.17 新键族（计数后缀保留 54.2 原值）──');
for (const lang of LANGS) {
  out.push("window.MN_I18N.add('" + lang + "', {");
  out.push("  'following.suffix.followers': " + JSON.stringify(suffixVals[lang].followers) + ',');
  out.push("  'following.suffix.members': " + JSON.stringify(suffixVals[lang].members) + ',');
  for (const [k, v] of Object.entries(NEW_KEYS[lang])) {
    out.push('  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',');
  }
  out.push('  });');
  out.push('');
}
out.push('');
fs.writeFileSync(F, out.join('\n'), 'utf8');
console.log('✅ following.i18n.js 重写完成：11 语基础块（searchPh 更新）+ 11 语 58.17 块（13 键）；请接着跑 tmp-i18n-hant.js');
