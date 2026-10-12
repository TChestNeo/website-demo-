// tmp-apply-i18n-activity.js — v0.2.58.16 activity.i18n.js 一次性应用：
// ①11 语第 1 轮块删 'activity.kpi.treatiesSigned'/'activity.chart.category' 两键（全仓已核实零引用）
// ②第 2 轮块（cat.* 6+ms.desc.* 5+ms.time.* 4=15 键全删）11 语整体移除
// ③第 4 轮新块 16 键×11 语插到 __ZH_HANT_AUTO__ 标记前（en 值=页面兜底串逐字节一致）
// 之后跑 node tmp-i18n-hant.js 重生成 zh-Hant。文件为纯 LF，直接 LF 读写。
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', 'docs', 'assets', 'i18n', 'activity.i18n.js');
let s = fs.readFileSync(F, 'utf8');
const orig = s;

// ① 第 1 轮块两键逐行删（11 语，单引号键）
const lines = s.split('\n');
const kept = lines.filter((l) =>
  l.indexOf("'activity.kpi.treatiesSigned'") === -1 && l.indexOf("'activity.chart.category'") === -1
);
s = kept.join('\n');
console.log('① 删第 1 轮两键', lines.length - kept.length, '行');

// ②+③ 第 2 轮块整体移除 + 第 4 轮新块插入
const START = '// v0.2.54.2 i18n 补';
const MARK = '/* __ZH_HANT_AUTO__';
const i = s.indexOf(START);
const j = s.indexOf(MARK);
if (i < 0 || j < 0 || i >= j) throw new Error('round-2 block / marker not found');
const r4 = `// v0.2.58.16 i18n 补：真实数据接入（新公民卡/内容类型/里程碑三类型/空态/离线态；zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N
  .add('zh', {
    'activity.kpi.newCitizens': '新公民',
    'activity.chart.contentTypes': '内容类型分布',
    'activity.ct.articles': '文章',
    'activity.ct.posts': '帖子',
    'activity.ct.comments': '评论',
    'activity.ct.likes': '点赞',
    'activity.ms.desc.nationFounded': '国家成立',
    'activity.ms.desc.articlePublished': '文章发布',
    'activity.ms.desc.citizenJoined': '新公民加入',
    'activity.ms.title.citizen': '一位新公民',
    'activity.ms.time.today': '今天',
    'activity.ms.time.daysAgo': '{n} 天前',
    'activity.empty.heatmap': '访问数据正在积累中，稍后再来看看',
    'activity.empty.section': '这里还没有内容',
    'activity.offline.title': '数据暂时不可用',
    'activity.offline.desc': '请检查网络连接后重试。'
  })
  .add('en', {
    'activity.kpi.newCitizens': 'New Citizens',
    'activity.chart.contentTypes': 'Content by Type',
    'activity.ct.articles': 'Articles',
    'activity.ct.posts': 'Posts',
    'activity.ct.comments': 'Comments',
    'activity.ct.likes': 'Likes',
    'activity.ms.desc.nationFounded': 'Nation founded',
    'activity.ms.desc.articlePublished': 'Article published',
    'activity.ms.desc.citizenJoined': 'New citizen joined',
    'activity.ms.title.citizen': 'A new citizen',
    'activity.ms.time.today': 'Today',
    'activity.ms.time.daysAgo': '{n} days ago',
    'activity.empty.heatmap': 'Visit data is still accumulating — check back soon',
    'activity.empty.section': 'Nothing here yet',
    'activity.offline.title': 'Data temporarily unavailable',
    'activity.offline.desc': 'Please check your connection and try again.'
  })
  .add('de', {
    'activity.kpi.newCitizens': 'Neue Bürger',
    'activity.chart.contentTypes': 'Inhaltstypen',
    'activity.ct.articles': 'Artikel',
    'activity.ct.posts': 'Beiträge',
    'activity.ct.comments': 'Kommentare',
    'activity.ct.likes': 'Likes',
    'activity.ms.desc.nationFounded': 'Nation gegründet',
    'activity.ms.desc.articlePublished': 'Artikel veröffentlicht',
    'activity.ms.desc.citizenJoined': 'Neue Bürger beigetreten',
    'activity.ms.title.citizen': 'Ein neuer Bürger',
    'activity.ms.time.today': 'Heute',
    'activity.ms.time.daysAgo': 'vor {n} Tagen',
    'activity.empty.heatmap': 'Besuchsdaten sammeln sich noch — schau bald wieder vorbei',
    'activity.empty.section': 'Hier gibt es noch nichts',
    'activity.offline.title': 'Daten vorübergehend nicht verfügbar',
    'activity.offline.desc': 'Bitte prüfe deine Verbindung und versuche es erneut.'
  })
  .add('ru', {
    'activity.kpi.newCitizens': 'Новые граждане',
    'activity.chart.contentTypes': 'Типы контента',
    'activity.ct.articles': 'Статьи',
    'activity.ct.posts': 'Посты',
    'activity.ct.comments': 'Комментарии',
    'activity.ct.likes': 'Лайки',
    'activity.ms.desc.nationFounded': 'Основано государство',
    'activity.ms.desc.articlePublished': 'Опубликована статья',
    'activity.ms.desc.citizenJoined': 'Присоединился новый гражданин',
    'activity.ms.title.citizen': 'Новый гражданин',
    'activity.ms.time.today': 'Сегодня',
    'activity.ms.time.daysAgo': '{n} дн. назад',
    'activity.empty.heatmap': 'Данные о посещениях ещё накапливаются — загляните позже',
    'activity.empty.section': 'Здесь пока ничего нет',
    'activity.offline.title': 'Данные временно недоступны',
    'activity.offline.desc': 'Проверьте соединение и попробуйте снова.'
  })
  .add('ms', {
    'activity.kpi.newCitizens': 'Warganegara Baharu',
    'activity.chart.contentTypes': 'Jenis Kandungan',
    'activity.ct.articles': 'Artikel',
    'activity.ct.posts': 'Kiriman',
    'activity.ct.comments': 'Komen',
    'activity.ct.likes': 'Suka',
    'activity.ms.desc.nationFounded': 'Negara diasaskan',
    'activity.ms.desc.articlePublished': 'Artikel diterbitkan',
    'activity.ms.desc.citizenJoined': 'Warganegara baharu menyertai',
    'activity.ms.title.citizen': 'Seorang warganegara baharu',
    'activity.ms.time.today': 'Hari ini',
    'activity.ms.time.daysAgo': '{n} hari lalu',
    'activity.empty.heatmap': 'Data lawatan masih terkumpul — kembali lagi nanti',
    'activity.empty.section': 'Tiada apa-apa di sini',
    'activity.offline.title': 'Data tidak tersedia buat sementara waktu',
    'activity.offline.desc': 'Sila semak sambungan anda dan cuba lagi.'
  })
  .add('th', {
    'activity.kpi.newCitizens': 'พลเมืองใหม่',
    'activity.chart.contentTypes': 'ประเภทเนื้อหา',
    'activity.ct.articles': 'บทความ',
    'activity.ct.posts': 'โพสต์',
    'activity.ct.comments': 'ความคิดเห็น',
    'activity.ct.likes': 'ถูกใจ',
    'activity.ms.desc.nationFounded': 'ก่อตั้งประเทศ',
    'activity.ms.desc.articlePublished': 'เผยแพร่บทความ',
    'activity.ms.desc.citizenJoined': 'พลเมืองใหม่เข้าร่วม',
    'activity.ms.title.citizen': 'พลเมืองใหม่หนึ่งคน',
    'activity.ms.time.today': 'วันนี้',
    'activity.ms.time.daysAgo': '{n} วันที่แล้ว',
    'activity.empty.heatmap': 'ข้อมูลการเข้าชมยังสะสมอยู่ — กลับมาใหม่เร็วๆ นี้',
    'activity.empty.section': 'ยังไม่มีอะไรที่นี่',
    'activity.offline.title': 'ข้อมูลไม่พร้อมใช้งานชั่วคราว',
    'activity.offline.desc': 'โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง'
  })
  .add('vi', {
    'activity.kpi.newCitizens': 'Công dân mới',
    'activity.chart.contentTypes': 'Loại nội dung',
    'activity.ct.articles': 'Bài viết',
    'activity.ct.posts': 'Bài đăng',
    'activity.ct.comments': 'Bình luận',
    'activity.ct.likes': 'Lượt thích',
    'activity.ms.desc.nationFounded': 'Thành lập quốc gia',
    'activity.ms.desc.articlePublished': 'Đăng bài viết',
    'activity.ms.desc.citizenJoined': 'Công dân mới tham gia',
    'activity.ms.title.citizen': 'Một công dân mới',
    'activity.ms.time.today': 'Hôm nay',
    'activity.ms.time.daysAgo': '{n} ngày trước',
    'activity.empty.heatmap': 'Dữ liệu truy cập đang tích lũy — quay lại sau nhé',
    'activity.empty.section': 'Chưa có gì ở đây',
    'activity.offline.title': 'Dữ liệu tạm thời không khả dụng',
    'activity.offline.desc': 'Vui lòng kiểm tra kết nối và thử lại.'
  })
  .add('id', {
    'activity.kpi.newCitizens': 'Warga Baru',
    'activity.chart.contentTypes': 'Jenis Konten',
    'activity.ct.articles': 'Artikel',
    'activity.ct.posts': 'Kiriman',
    'activity.ct.comments': 'Komentar',
    'activity.ct.likes': 'Suka',
    'activity.ms.desc.nationFounded': 'Negara didirikan',
    'activity.ms.desc.articlePublished': 'Artikel diterbitkan',
    'activity.ms.desc.citizenJoined': 'Warga baru bergabung',
    'activity.ms.title.citizen': 'Seorang warga baru',
    'activity.ms.time.today': 'Hari ini',
    'activity.ms.time.daysAgo': '{n} hari lalu',
    'activity.empty.heatmap': 'Data kunjungan masih terkumpul — kembali lagi nanti',
    'activity.empty.section': 'Belum ada apa pun di sini',
    'activity.offline.title': 'Data sementara tidak tersedia',
    'activity.offline.desc': 'Periksa koneksi Anda lalu coba lagi.'
  })
  .add('fr', {
    'activity.kpi.newCitizens': 'Nouveaux citoyens',
    'activity.chart.contentTypes': 'Types de contenu',
    'activity.ct.articles': 'Articles',
    'activity.ct.posts': 'Publications',
    'activity.ct.comments': 'Commentaires',
    'activity.ct.likes': 'J’aime',
    'activity.ms.desc.nationFounded': 'Nation fondée',
    'activity.ms.desc.articlePublished': 'Article publié',
    'activity.ms.desc.citizenJoined': 'Nouveau citoyen inscrit',
    'activity.ms.title.citizen': 'Un nouveau citoyen',
    'activity.ms.time.today': 'Aujourd’hui',
    'activity.ms.time.daysAgo': 'il y a {n} jours',
    'activity.empty.heatmap': 'Les données de visite s’accumulent encore — revenez bientôt',
    'activity.empty.section': 'Rien ici pour l’instant',
    'activity.offline.title': 'Données temporairement indisponibles',
    'activity.offline.desc': 'Vérifiez votre connexion puis réessayez.'
  })
  .add('es', {
    'activity.kpi.newCitizens': 'Nuevos ciudadanos',
    'activity.chart.contentTypes': 'Tipos de contenido',
    'activity.ct.articles': 'Artículos',
    'activity.ct.posts': 'Publicaciones',
    'activity.ct.comments': 'Comentarios',
    'activity.ct.likes': 'Me gusta',
    'activity.ms.desc.nationFounded': 'Nación fundada',
    'activity.ms.desc.articlePublished': 'Artículo publicado',
    'activity.ms.desc.citizenJoined': 'Nuevo ciudadano se unió',
    'activity.ms.title.citizen': 'Un nuevo ciudadano',
    'activity.ms.time.today': 'Hoy',
    'activity.ms.time.daysAgo': 'hace {n} días',
    'activity.empty.heatmap': 'Los datos de visitas aún se acumulan — vuelve pronto',
    'activity.empty.section': 'Aún no hay nada aquí',
    'activity.offline.title': 'Datos no disponibles temporalmente',
    'activity.offline.desc': 'Comprueba tu conexión e inténtalo de nuevo.'
  })
  .add('pt', {
    'activity.kpi.newCitizens': 'Novos cidadãos',
    'activity.chart.contentTypes': 'Tipos de conteúdo',
    'activity.ct.articles': 'Artigos',
    'activity.ct.posts': 'Publicações',
    'activity.ct.comments': 'Comentários',
    'activity.ct.likes': 'Curtidas',
    'activity.ms.desc.nationFounded': 'Nação fundada',
    'activity.ms.desc.articlePublished': 'Artigo publicado',
    'activity.ms.desc.citizenJoined': 'Novo cidadão entrou',
    'activity.ms.title.citizen': 'Um novo cidadão',
    'activity.ms.time.today': 'Hoje',
    'activity.ms.time.daysAgo': 'há {n} dias',
    'activity.empty.heatmap': 'Os dados de visita ainda estão acumulando — volte em breve',
    'activity.empty.section': 'Nada aqui ainda',
    'activity.offline.title': 'Dados temporariamente indisponíveis',
    'activity.offline.desc': 'Verifique sua conexão e tente novamente.'
  });

`;
s = s.slice(0, i) + r4 + s.slice(j);
console.log('②③ 第 2 轮块移除 + 第 4 轮 16 键×11 语插入完成（移除', (j - i), 'chars）');

fs.writeFileSync(F, s);
console.log('④ 写入完成；文件长度', orig.length, '→', s.length);

// 自检
const chk = (pat) => (s.split(pat).length - 1);
console.log('treatiesSigned ×', chk('treatiesSigned'), '| chart.category ×', chk('activity.chart.category'),
  '| cat.governance ×', chk('activity.cat.governance'), '| ms.desc.anniv2 ×', chk('ms.desc.anniv2'),
  '| ms.time.t2d ×', chk('ms.time.t2d'), '| newCitizens ×', chk('activity.kpi.newCitizens'),
  '| contentTypes ×', chk('activity.chart.contentTypes'), '| offline.title ×', chk('activity.offline.title'),
  '| __ZH_HANT_AUTO__ ×', chk('__ZH_HANT_AUTO__'));
