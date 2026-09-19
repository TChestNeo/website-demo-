/**
 * explore.i18n.js — 探索页（docs/pages/explore.html）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld）。
 * 页面原文为英文——zh 值为地道中文翻译（auth.i18n.js 先例），en 保持英文原文、HTML 兜底英文不动。
 * 示例/用户数据不译：国家卡名称/分类/lore/徽章/日期、热门话题列表、增长榜条目、
 * 'M.NationWorld Premium' 卡标题（品牌，与 premium.i18n.js 同口径保留）。
 * 空态两行与默认 lore 走惰性 T()（页面内联脚本，事件重渲染时生效）。
 */
window.MN_I18N
  // ═══ zh 简体（默认）═══
  .add('zh', {
    'ex.nav.overview': '概览',
    'ex.nav.explore': '探索',
    'ex.nav.guidelines': '指南',
    'ex.ph.search': '搜索世界、事件...',
    'ex.heading': '全部世界与实体',
    'ex.premium.desc': '高级分析、自定义主题、优先支持。',
    'ex.premium.subscribe': '订阅 — ',
    'ex.premium.perMo': '/月',
    'ex.premium.viewPlans': '查看全部方案 →',
    'ex.trending': '热门话题',
    'ex.popular': '热门世界',
    'ex.growing': '增长最快',
    'ex.empty': '没有符合你搜索的世界。',
    'ex.createFirst': '创建第一个世界 →',
    'ex.loreFallback': 'M.NationWorld 登记名录中的一个世界。'
  })
  // ═══ en 英语（页面原文；HTML 兜底同文）═══
  .add('en', {
    'ex.nav.overview': 'Overview',
    'ex.nav.explore': 'Explore',
    'ex.nav.guidelines': 'Guidelines',
    'ex.ph.search': 'Search worlds, events...',
    'ex.heading': 'All Worlds & Entities',
    'ex.premium.desc': 'Advanced analytics, custom themes, priority support.',
    'ex.premium.subscribe': 'Subscribe — ',
    'ex.premium.perMo': '/mo',
    'ex.premium.viewPlans': 'View all plans →',
    'ex.trending': 'Trending Topics',
    'ex.popular': 'Popular Worlds',
    'ex.growing': 'Top Growing',
    'ex.empty': 'No worlds match your search.',
    'ex.createFirst': 'Create the first world →',
    'ex.loreFallback': 'A world in the M.NationWorld registry.'
  })
  // ═══ de 德语 ═══
  .add('de', {
    'ex.nav.overview': 'Übersicht',
    'ex.nav.explore': 'Entdecken',
    'ex.nav.guidelines': 'Richtlinien',
    'ex.ph.search': 'Welten, Ereignisse suchen...',
    'ex.heading': 'Alle Welten & Entitäten',
    'ex.premium.desc': 'Erweiterte Analysen, eigene Themen, Prioritäts-Support.',
    'ex.premium.subscribe': 'Abonnieren — ',
    'ex.premium.perMo': '/Monat',
    'ex.premium.viewPlans': 'Alle Tarife ansehen →',
    'ex.trending': 'Beliebte Themen',
    'ex.popular': 'Beliebte Welten',
    'ex.growing': 'Top-Wachstum',
    'ex.empty': 'Keine Welten entsprechen deiner Suche.',
    'ex.createFirst': 'Erstelle die erste Welt →',
    'ex.loreFallback': 'Eine Welt im M.NationWorld-Register.'
  })
  // ═══ ru 俄语 ═══
  .add('ru', {
    'ex.nav.overview': 'Обзор',
    'ex.nav.explore': 'Исследовать',
    'ex.nav.guidelines': 'Правила',
    'ex.ph.search': 'Поиск миров, событий...',
    'ex.heading': 'Все миры и сущности',
    'ex.premium.desc': 'Расширенная аналитика, собственные темы, приоритетная поддержка.',
    'ex.premium.subscribe': 'Подписаться — ',
    'ex.premium.perMo': '/мес',
    'ex.premium.viewPlans': 'Все тарифы →',
    'ex.trending': 'Популярные темы',
    'ex.popular': 'Популярные миры',
    'ex.growing': 'Быстрый рост',
    'ex.empty': 'Нет миров, соответствующих вашему поиску.',
    'ex.createFirst': 'Создайте первый мир →',
    'ex.loreFallback': 'Мир в реестре M.NationWorld.'
  })
  // ═══ ms 马来语 ═══
  .add('ms', {
    'ex.nav.overview': 'Gambaran Keseluruhan',
    'ex.nav.explore': 'Teroka',
    'ex.nav.guidelines': 'Garis Panduan',
    'ex.ph.search': 'Cari dunia, peristiwa...',
    'ex.heading': 'Semua Dunia & Entiti',
    'ex.premium.desc': 'Analitik lanjutan, tema tersuai, sokongan keutamaan.',
    'ex.premium.subscribe': 'Langgan — ',
    'ex.premium.perMo': '/bln',
    'ex.premium.viewPlans': 'Lihat semua pelan →',
    'ex.trending': 'Topik Hangat',
    'ex.popular': 'Dunia Popular',
    'ex.growing': 'Pertumbuhan Teratas',
    'ex.empty': 'Tiada dunia sepadan dengan carian anda.',
    'ex.createFirst': 'Cipta dunia pertama →',
    'ex.loreFallback': 'Sebuah dunia dalam pendaftaran M.NationWorld.'
  })
  // ═══ th 泰语 ═══
  .add('th', {
    'ex.nav.overview': 'ภาพรวม',
    'ex.nav.explore': 'สำรวจ',
    'ex.nav.guidelines': 'แนวทาง',
    'ex.ph.search': 'ค้นหาโลก เหตุการณ์...',
    'ex.heading': 'โลกและเอนทิตีทั้งหมด',
    'ex.premium.desc': 'การวิเคราะห์ขั้นสูง ธีมแบบกำหนดเอง การสนับสนุนลำดับแรก',
    'ex.premium.subscribe': 'สมัครสมาชิก — ',
    'ex.premium.perMo': '/เดือน',
    'ex.premium.viewPlans': 'ดูแพ็กเกจทั้งหมด →',
    'ex.trending': 'หัวข้อมาแรง',
    'ex.popular': 'โลกยอดนิยม',
    'ex.growing': 'เติบโตสูงสุด',
    'ex.empty': 'ไม่มีโลกที่ตรงกับคำค้นของคุณ',
    'ex.createFirst': 'สร้างโลกแรก →',
    'ex.loreFallback': 'โลกหนึ่งในทะเบียน M.NationWorld'
  })
  // ═══ vi 越南语 ═══
  .add('vi', {
    'ex.nav.overview': 'Tổng quan',
    'ex.nav.explore': 'Khám phá',
    'ex.nav.guidelines': 'Hướng dẫn',
    'ex.ph.search': 'Tìm kiếm thế giới, sự kiện...',
    'ex.heading': 'Tất cả thế giới & thực thể',
    'ex.premium.desc': 'Phân tích nâng cao, chủ đề tùy chỉnh, hỗ trợ ưu tiên.',
    'ex.premium.subscribe': 'Đăng ký — ',
    'ex.premium.perMo': '/tháng',
    'ex.premium.viewPlans': 'Xem tất cả gói →',
    'ex.trending': 'Chủ đề thịnh hành',
    'ex.popular': 'Thế giới phổ biến',
    'ex.growing': 'Tăng trưởng hàng đầu',
    'ex.empty': 'Không có thế giới nào khớp với tìm kiếm của bạn.',
    'ex.createFirst': 'Tạo thế giới đầu tiên →',
    'ex.loreFallback': 'Một thế giới trong sổ đăng ký M.NationWorld.'
  })
  // ═══ id 印尼语 ═══
  .add('id', {
    'ex.nav.overview': 'Ikhtisar',
    'ex.nav.explore': 'Jelajahi',
    'ex.nav.guidelines': 'Panduan',
    'ex.ph.search': 'Cari dunia, peristiwa...',
    'ex.heading': 'Semua Dunia & Entitas',
    'ex.premium.desc': 'Analitik lanjutan, tema kustom, dukungan prioritas.',
    'ex.premium.subscribe': 'Berlangganan — ',
    'ex.premium.perMo': '/bln',
    'ex.premium.viewPlans': 'Lihat semua paket →',
    'ex.trending': 'Topik Hangat',
    'ex.popular': 'Dunia Populer',
    'ex.growing': 'Pertumbuhan Teratas',
    'ex.empty': 'Tidak ada dunia yang cocok dengan pencarianmu.',
    'ex.createFirst': 'Buat dunia pertama →',
    'ex.loreFallback': 'Sebuah dunia dalam registri M.NationWorld.'
  })
  // ═══ fr 法语 ═══
  .add('fr', {
    'ex.nav.overview': 'Aperçu',
    'ex.nav.explore': 'Explorer',
    'ex.nav.guidelines': 'Consignes',
    'ex.ph.search': 'Rechercher des mondes, des événements...',
    'ex.heading': 'Tous les mondes et entités',
    'ex.premium.desc': 'Analyses avancées, thèmes personnalisés, support prioritaire.',
    'ex.premium.subscribe': 'S\'abonner — ',
    'ex.premium.perMo': '/mois',
    'ex.premium.viewPlans': 'Voir tous les forfaits →',
    'ex.trending': 'Sujets tendance',
    'ex.popular': 'Mondes populaires',
    'ex.growing': 'Plus forte croissance',
    'ex.empty': 'Aucun monde ne correspond à votre recherche.',
    'ex.createFirst': 'Créer le premier monde →',
    'ex.loreFallback': 'Un monde du registre M.NationWorld.'
  })
  // ═══ es 西班牙语 ═══
  .add('es', {
    'ex.nav.overview': 'Resumen',
    'ex.nav.explore': 'Explorar',
    'ex.nav.guidelines': 'Directrices',
    'ex.ph.search': 'Buscar mundos, eventos...',
    'ex.heading': 'Todos los mundos y entidades',
    'ex.premium.desc': 'Análisis avanzados, temas personalizados, soporte prioritario.',
    'ex.premium.subscribe': 'Suscribirse — ',
    'ex.premium.perMo': '/mes',
    'ex.premium.viewPlans': 'Ver todos los planes →',
    'ex.trending': 'Temas de moda',
    'ex.popular': 'Mundos populares',
    'ex.growing': 'Mayor crecimiento',
    'ex.empty': 'Ningún mundo coincide con tu búsqueda.',
    'ex.createFirst': 'Crea el primer mundo →',
    'ex.loreFallback': 'Un mundo en el registro de M.NationWorld.'
  })
  // ═══ pt 葡萄牙语 ═══
  .add('pt', {
    'ex.nav.overview': 'Visão geral',
    'ex.nav.explore': 'Explorar',
    'ex.nav.guidelines': 'Diretrizes',
    'ex.ph.search': 'Pesquisar mundos, eventos...',
    'ex.heading': 'Todos os mundos e entidades',
    'ex.premium.desc': 'Análises avançadas, temas personalizados, suporte prioritário.',
    'ex.premium.subscribe': 'Assinar — ',
    'ex.premium.perMo': '/mês',
    'ex.premium.viewPlans': 'Ver todos os planos →',
    'ex.trending': 'Tópicos em alta',
    'ex.popular': 'Mundos populares',
    'ex.growing': 'Maior crescimento',
    'ex.empty': 'Nenhum mundo corresponde à sua pesquisa.',
    'ex.createFirst': 'Crie o primeiro mundo →',
    'ex.loreFallback': 'Um mundo no registro do M.NationWorld.'
  });
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "ex.nav.overview": "概覽",
  "ex.nav.explore": "探索",
  "ex.nav.guidelines": "指南",
  "ex.ph.search": "搜索世界、事件...",
  "ex.heading": "全部世界與實體",
  "ex.premium.desc": "高級分析、自定義主題、優先支持。",
  "ex.premium.subscribe": "訂閱 — ",
  "ex.premium.perMo": "/月",
  "ex.premium.viewPlans": "查看全部方案 →",
  "ex.trending": "熱門話題",
  "ex.popular": "熱門世界",
  "ex.growing": "增長最快",
  "ex.empty": "沒有符合你搜索的世界。",
  "ex.createFirst": "創建第一個世界 →",
  "ex.loreFallback": "M.NationWorld 登記名錄中的一個世界。"
});
