/**
 * overview.i18n.js — 知识总览页（docs/pages/overview.html）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld / MicroNationary）。
 * 页面原文：主体英文 + Story 卡中文——英文原文 zh 值为地道中文翻译（auth.i18n.js 先例）、
 * en 保持英文原文、HTML 兜底原文不动；Story 卡中文原文 zh 值逐字节=原文（电池 tmp-battery-story L 交叉安全）。
 * 示例/用户数据不译：统计数字（1,402/+12%/312）、精选国家名称/分类/lore、贡献列表、
 * 'M.NationWorld Premium' 卡标题（品牌，与 premium.i18n.js 同口径保留）。
 * 统计标签与精选卡兜底文案走惰性 T()（页面内联脚本）。
 */
window.MN_I18N
  // ═══ zh 简体（默认）═══
  .add('zh', {
    'ov.nav.overview': '概览',
    'ov.nav.explore': '探索',
    'ov.nav.guidelines': '指南',
    'ov.knowledgeBase': '知识库',
    'ov.heading': 'MicroNationary 概览',
    'ov.sub': '通往全球世界名录、设定档案与社区知识的大门。',
    'ov.createWorld': '创建世界',
    'ov.viewArchive': '查看档案',
    'ov.story.tag': 'M.NATIONWORLD · 知识入口',
    'ov.story.title': '政治启蒙 · 故事站',
    'ov.story.desc': '先了解政治，再创造国家——滚轮式叙事带你从零认识政治、国家与制度。',
    'ov.story.read': '开始阅读',
    'ov.featuredBadge': '⭐ 精选世界',
    'ov.premium.desc': '高级分析、自定义主题、优先支持。',
    'ov.premium.subscribe': '订阅 — ',
    'ov.premium.perMo': '/月',
    'ov.premium.viewPlans': '查看全部方案 →',
    'ov.recent': '近期贡献',
    'ov.stat.worlds': '已创建世界',
    'ov.stat.topics': '精选话题',
    'ov.stat.countries': '架空国家',
    'ov.stat.regions': '文明区域',
    'ov.classFallback': '主权国家',
    'ov.since': ' · 自 ',
    'ov.loreFallback': 'M.NationWorld 登记名录中的一个世界。',
    'ov.gdpPrefix': 'GDP '
  })
  // ═══ en 英语（页面原文；HTML 兜底同文）═══
  .add('en', {
    'ov.nav.overview': 'Overview',
    'ov.nav.explore': 'Explore',
    'ov.nav.guidelines': 'Guidelines',
    'ov.knowledgeBase': 'Knowledge Base',
    'ov.heading': 'MicroNationary Overview',
    'ov.sub': 'Your gateway to the global registry of worlds, lore archives, and community knowledge.',
    'ov.createWorld': 'Create World',
    'ov.viewArchive': 'View Archive',
    'ov.story.tag': 'M.NATIONWORLD · Knowledge Gateway',
    'ov.story.title': 'Political Enlightenment · Story Hub',
    'ov.story.desc': 'Understand politics first, then create your nation — a scroll-driven narrative takes you from zero to knowing politics, nations and institutions.',
    'ov.story.read': 'Start Reading',
    'ov.featuredBadge': '⭐ Featured World',
    'ov.premium.desc': 'Advanced analytics, custom themes, priority support.',
    'ov.premium.subscribe': 'Subscribe — ',
    'ov.premium.perMo': '/mo',
    'ov.premium.viewPlans': 'View all plans →',
    'ov.recent': 'Recent Contributions',
    'ov.stat.worlds': 'Worlds Created',
    'ov.stat.topics': 'Featured Topics',
    'ov.stat.countries': 'Fictional Countries',
    'ov.stat.regions': 'Civilization Regions',
    'ov.classFallback': 'Sovereign Nation',
    'ov.since': ' · Since ',
    'ov.loreFallback': 'A world in the M.NationWorld registry.',
    'ov.gdpPrefix': 'GDP '
  })
  // ═══ de 德语 ═══
  .add('de', {
    'ov.nav.overview': 'Übersicht',
    'ov.nav.explore': 'Entdecken',
    'ov.nav.guidelines': 'Richtlinien',
    'ov.knowledgeBase': 'Wissensdatenbank',
    'ov.heading': 'MicroNationary-Überblick',
    'ov.sub': 'Dein Tor zum globalen Register der Welten, Lore-Archive und des Community-Wissens.',
    'ov.createWorld': 'Welt erstellen',
    'ov.viewArchive': 'Archiv ansehen',
    'ov.story.tag': 'M.NATIONWORLD · Wissensportal',
    'ov.story.title': 'Politische Aufklärung · Story-Portal',
    'ov.story.desc': 'Verstehe zuerst Politik, dann erschaffe deine Nation — eine scrollende Erzählung führt dich von null zu Politik, Nationen und Institutionen.',
    'ov.story.read': 'Jetzt lesen',
    'ov.featuredBadge': '⭐ Vorgestellte Welt',
    'ov.premium.desc': 'Erweiterte Analysen, eigene Themen, Prioritäts-Support.',
    'ov.premium.subscribe': 'Abonnieren — ',
    'ov.premium.perMo': '/Monat',
    'ov.premium.viewPlans': 'Alle Tarife ansehen →',
    'ov.recent': 'Aktuelle Beiträge',
    'ov.stat.worlds': 'Erstellte Welten',
    'ov.stat.topics': 'Vorgestellte Themen',
    'ov.stat.countries': 'Fiktive Länder',
    'ov.stat.regions': 'Zivilisationsregionen',
    'ov.classFallback': 'Souveräne Nation',
    'ov.since': ' · Seit ',
    'ov.loreFallback': 'Eine Welt im M.NationWorld-Register.',
    'ov.gdpPrefix': 'BIP '
  })
  // ═══ ru 俄语 ═══
  .add('ru', {
    'ov.nav.overview': 'Обзор',
    'ov.nav.explore': 'Исследовать',
    'ov.nav.guidelines': 'Правила',
    'ov.knowledgeBase': 'База знаний',
    'ov.heading': 'Обзор MicroNationary',
    'ov.sub': 'Ваши ворота в глобальный реестр миров, архивы лора и знания сообщества.',
    'ov.createWorld': 'Создать мир',
    'ov.viewArchive': 'Смотреть архив',
    'ov.story.tag': 'M.NATIONWORLD · Портал знаний',
    'ov.story.title': 'Политпросвещение · Сюжетный сайт',
    'ov.story.desc': 'Сначала пойми политику, затем создай свою нацию — скролл-нарратив проведёт тебя с нуля до знания политики, государств и институтов.',
    'ov.story.read': 'Начать чтение',
    'ov.featuredBadge': '⭐ Избранный мир',
    'ov.premium.desc': 'Расширенная аналитика, собственные темы, приоритетная поддержка.',
    'ov.premium.subscribe': 'Подписаться — ',
    'ov.premium.perMo': '/мес',
    'ov.premium.viewPlans': 'Все тарифы →',
    'ov.recent': 'Недавний вклад',
    'ov.stat.worlds': 'Созданные миры',
    'ov.stat.topics': 'Избранные темы',
    'ov.stat.countries': 'Вымышленные страны',
    'ov.stat.regions': 'Регионы цивилизаций',
    'ov.classFallback': 'Суверенная нация',
    'ov.since': ' · С ',
    'ov.loreFallback': 'Мир в реестре M.NationWorld.',
    'ov.gdpPrefix': 'ВВП '
  })
  // ═══ ms 马来语 ═══
  .add('ms', {
    'ov.nav.overview': 'Gambaran Keseluruhan',
    'ov.nav.explore': 'Teroka',
    'ov.nav.guidelines': 'Garis Panduan',
    'ov.knowledgeBase': 'Pangkalan Pengetahuan',
    'ov.heading': 'Gambaran MicroNationary',
    'ov.sub': 'Pintu masuk anda ke pendaftaran global dunia, arkib lore dan pengetahuan komuniti.',
    'ov.createWorld': 'Cipta Dunia',
    'ov.viewArchive': 'Lihat Arkib',
    'ov.story.tag': 'M.NATIONWORLD · Portal Pengetahuan',
    'ov.story.title': 'Kesedaran Politik · Hab Cerita',
    'ov.story.desc': 'Fahami politik dahulu, kemudian cipta negara anda — naratif skrol membawa anda dari sifar mengenali politik, negara dan institusi.',
    'ov.story.read': 'Mula Membaca',
    'ov.featuredBadge': '⭐ Dunia Pilihan',
    'ov.premium.desc': 'Analitik lanjutan, tema tersuai, sokongan keutamaan.',
    'ov.premium.subscribe': 'Langgan — ',
    'ov.premium.perMo': '/bln',
    'ov.premium.viewPlans': 'Lihat semua pelan →',
    'ov.recent': 'Sumbangan Terkini',
    'ov.stat.worlds': 'Dunia Dicipta',
    'ov.stat.topics': 'Topik Pilihan',
    'ov.stat.countries': 'Negara Fiksyen',
    'ov.stat.regions': 'Kawasan Tamadun',
    'ov.classFallback': 'Negara Berdaulat',
    'ov.since': ' · Sejak ',
    'ov.loreFallback': 'Sebuah dunia dalam pendaftaran M.NationWorld.',
    'ov.gdpPrefix': 'KDNK '
  })
  // ═══ th 泰语 ═══
  .add('th', {
    'ov.nav.overview': 'ภาพรวม',
    'ov.nav.explore': 'สำรวจ',
    'ov.nav.guidelines': 'แนวทาง',
    'ov.knowledgeBase': 'ฐานความรู้',
    'ov.heading': 'ภาพรวม MicroNationary',
    'ov.sub': 'ประตูสู่ทะเบียนโลก คลังเรื่องราว และความรู้ชุมชนระดับโลก',
    'ov.createWorld': 'สร้างโลก',
    'ov.viewArchive': 'ดูคลังข้อมูล',
    'ov.story.tag': 'M.NATIONWORLD · พอร์ทัลความรู้',
    'ov.story.title': 'ความรู้การเมือง · เว็บเรื่องเล่า',
    'ov.story.desc': 'เข้าใจการเมืองก่อน แล้วจึงสร้างชาติของคุณ — เรื่องเล่าแบบเลื่อนพาคุณจากศูนย์ไปรู้จักการเมือง ชาติและสถาบัน',
    'ov.story.read': 'เริ่มอ่าน',
    'ov.featuredBadge': '⭐ โลกแนะนำ',
    'ov.premium.desc': 'การวิเคราะห์ขั้นสูง ธีมแบบกำหนดเอง การสนับสนุนลำดับแรก',
    'ov.premium.subscribe': 'สมัครสมาชิก — ',
    'ov.premium.perMo': '/เดือน',
    'ov.premium.viewPlans': 'ดูแพ็กเกจทั้งหมด →',
    'ov.recent': 'ผลงานล่าสุด',
    'ov.stat.worlds': 'โลกที่สร้างแล้ว',
    'ov.stat.topics': 'หัวข้อแนะนำ',
    'ov.stat.countries': 'ประเทศสมมติ',
    'ov.stat.regions': 'เขตอารยธรรม',
    'ov.classFallback': 'ชาติอธิปไตย',
    'ov.since': ' · ตั้งแต่ ',
    'ov.loreFallback': 'โลกหนึ่งในทะเบียน M.NationWorld',
    'ov.gdpPrefix': 'GDP '
  })
  // ═══ vi 越南语 ═══
  .add('vi', {
    'ov.nav.overview': 'Tổng quan',
    'ov.nav.explore': 'Khám phá',
    'ov.nav.guidelines': 'Hướng dẫn',
    'ov.knowledgeBase': 'Cơ sở kiến thức',
    'ov.heading': 'Tổng quan MicroNationary',
    'ov.sub': 'Cánh cổng của bạn đến sổ đăng ký thế giới toàn cầu, kho lưu trữ lore và kiến thức cộng đồng.',
    'ov.createWorld': 'Tạo thế giới',
    'ov.viewArchive': 'Xem kho lưu trữ',
    'ov.story.tag': 'M.NATIONWORLD · Cổng tri thức',
    'ov.story.title': 'Khai sáng chính trị · Trang truyện',
    'ov.story.desc': 'Hiểu chính trị trước, rồi tạo quốc gia của bạn — câu chuyện cuộn dẫn bạn từ con số không đến hiểu biết về chính trị, quốc gia và thể chế.',
    'ov.story.read': 'Bắt đầu đọc',
    'ov.featuredBadge': '⭐ Thế giới nổi bật',
    'ov.premium.desc': 'Phân tích nâng cao, chủ đề tùy chỉnh, hỗ trợ ưu tiên.',
    'ov.premium.subscribe': 'Đăng ký — ',
    'ov.premium.perMo': '/tháng',
    'ov.premium.viewPlans': 'Xem tất cả gói →',
    'ov.recent': 'Đóng góp gần đây',
    'ov.stat.worlds': 'Thế giới đã tạo',
    'ov.stat.topics': 'Chủ đề nổi bật',
    'ov.stat.countries': 'Quốc gia hư cấu',
    'ov.stat.regions': 'Vùng văn minh',
    'ov.classFallback': 'Quốc gia có chủ quyền',
    'ov.since': ' · Từ ',
    'ov.loreFallback': 'Một thế giới trong sổ đăng ký M.NationWorld.',
    'ov.gdpPrefix': 'GDP '
  })
  // ═══ id 印尼语 ═══
  .add('id', {
    'ov.nav.overview': 'Ikhtisar',
    'ov.nav.explore': 'Jelajahi',
    'ov.nav.guidelines': 'Panduan',
    'ov.knowledgeBase': 'Basis Pengetahuan',
    'ov.heading': 'Ikhtisar MicroNationary',
    'ov.sub': 'Gerbangmu menuju registri global dunia, arsip lore, dan pengetahuan komunitas.',
    'ov.createWorld': 'Buat Dunia',
    'ov.viewArchive': 'Lihat Arsip',
    'ov.story.tag': 'M.NATIONWORLD · Portal Pengetahuan',
    'ov.story.title': 'Edukasi Politik · Situs Cerita',
    'ov.story.desc': 'Pahami politik dulu, lalu ciptakan negaramu — narasi gulir membawamu dari nol mengenal politik, negara, dan institusi.',
    'ov.story.read': 'Mulai Membaca',
    'ov.featuredBadge': '⭐ Dunia Unggulan',
    'ov.premium.desc': 'Analitik lanjutan, tema kustom, dukungan prioritas.',
    'ov.premium.subscribe': 'Berlangganan — ',
    'ov.premium.perMo': '/bln',
    'ov.premium.viewPlans': 'Lihat semua paket →',
    'ov.recent': 'Kontribusi Terbaru',
    'ov.stat.worlds': 'Dunia Tercipta',
    'ov.stat.topics': 'Topik Unggulan',
    'ov.stat.countries': 'Negara Fiksi',
    'ov.stat.regions': 'Kawasan Peradaban',
    'ov.classFallback': 'Negara Berdaulat',
    'ov.since': ' · Sejak ',
    'ov.loreFallback': 'Sebuah dunia dalam registri M.NationWorld.',
    'ov.gdpPrefix': 'PDB '
  })
  // ═══ fr 法语 ═══
  .add('fr', {
    'ov.nav.overview': 'Aperçu',
    'ov.nav.explore': 'Explorer',
    'ov.nav.guidelines': 'Consignes',
    'ov.knowledgeBase': 'Base de connaissances',
    'ov.heading': 'Aperçu de MicroNationary',
    'ov.sub': 'Votre porte d\'entrée vers le registre mondial des mondes, les archives de lore et le savoir communautaire.',
    'ov.createWorld': 'Créer un monde',
    'ov.viewArchive': 'Voir les archives',
    'ov.story.tag': 'M.NATIONWORLD · Portail du savoir',
    'ov.story.title': 'Éveil politique · Site d\'histoires',
    'ov.story.desc': 'Comprenez d\'abord la politique, puis créez votre nation — un récit défilant vous mène de zéro à la connaissance de la politique, des nations et des institutions.',
    'ov.story.read': 'Commencer la lecture',
    'ov.featuredBadge': '⭐ Monde vedette',
    'ov.premium.desc': 'Analyses avancées, thèmes personnalisés, support prioritaire.',
    'ov.premium.subscribe': 'S\'abonner — ',
    'ov.premium.perMo': '/mois',
    'ov.premium.viewPlans': 'Voir tous les forfaits →',
    'ov.recent': 'Contributions récentes',
    'ov.stat.worlds': 'Mondes créés',
    'ov.stat.topics': 'Sujets vedettes',
    'ov.stat.countries': 'Pays fictifs',
    'ov.stat.regions': 'Régions de civilisation',
    'ov.classFallback': 'Nation souveraine',
    'ov.since': ' · Depuis ',
    'ov.loreFallback': 'Un monde du registre M.NationWorld.',
    'ov.gdpPrefix': 'PIB '
  })
  // ═══ es 西班牙语 ═══
  .add('es', {
    'ov.nav.overview': 'Resumen',
    'ov.nav.explore': 'Explorar',
    'ov.nav.guidelines': 'Directrices',
    'ov.knowledgeBase': 'Base de conocimiento',
    'ov.heading': 'Resumen de MicroNationary',
    'ov.sub': 'Tu puerta de entrada al registro global de mundos, archivos de lore y conocimiento comunitario.',
    'ov.createWorld': 'Crear mundo',
    'ov.viewArchive': 'Ver archivo',
    'ov.story.tag': 'M.NATIONWORLD · Portal del saber',
    'ov.story.title': 'Educación política · Sitio de historias',
    'ov.story.desc': 'Comprende primero la política y luego crea tu nación — una narrativa con scroll te lleva de cero a conocer la política, las naciones y las instituciones.',
    'ov.story.read': 'Empezar a leer',
    'ov.featuredBadge': '⭐ Mundo destacado',
    'ov.premium.desc': 'Análisis avanzados, temas personalizados, soporte prioritario.',
    'ov.premium.subscribe': 'Suscribirse — ',
    'ov.premium.perMo': '/mes',
    'ov.premium.viewPlans': 'Ver todos los planes →',
    'ov.recent': 'Contribuciones recientes',
    'ov.stat.worlds': 'Mundos creados',
    'ov.stat.topics': 'Temas destacados',
    'ov.stat.countries': 'Países ficticios',
    'ov.stat.regions': 'Regiones de civilización',
    'ov.classFallback': 'Nación soberana',
    'ov.since': ' · Desde ',
    'ov.loreFallback': 'Un mundo en el registro de M.NationWorld.',
    'ov.gdpPrefix': 'PIB '
  })
  // ═══ pt 葡萄牙语 ═══
  .add('pt', {
    'ov.nav.overview': 'Visão geral',
    'ov.nav.explore': 'Explorar',
    'ov.nav.guidelines': 'Diretrizes',
    'ov.knowledgeBase': 'Base de conhecimento',
    'ov.heading': 'Visão geral do MicroNationary',
    'ov.sub': 'Sua porta de entrada para o registro global de mundos, arquivos de lore e conhecimento comunitário.',
    'ov.createWorld': 'Criar mundo',
    'ov.viewArchive': 'Ver arquivo',
    'ov.story.tag': 'M.NATIONWORLD · Portal do saber',
    'ov.story.title': 'Educação política · Site de histórias',
    'ov.story.desc': 'Entenda a política primeiro e depois crie sua nação — uma narrativa com rolagem leva você do zero ao conhecimento de política, nações e instituições.',
    'ov.story.read': 'Começar a ler',
    'ov.featuredBadge': '⭐ Mundo em destaque',
    'ov.premium.desc': 'Análises avançadas, temas personalizados, suporte prioritário.',
    'ov.premium.subscribe': 'Assinar — ',
    'ov.premium.perMo': '/mês',
    'ov.premium.viewPlans': 'Ver todos os planos →',
    'ov.recent': 'Contribuições recentes',
    'ov.stat.worlds': 'Mundos criados',
    'ov.stat.topics': 'Tópicos em destaque',
    'ov.stat.countries': 'Países fictícios',
    'ov.stat.regions': 'Regiões de civilização',
    'ov.classFallback': 'Nação soberana',
    'ov.since': ' · Desde ',
    'ov.loreFallback': 'Um mundo no registro do M.NationWorld.',
    'ov.gdpPrefix': 'PIB '
  });

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('zh', {
  "ov.contrib.action.createdArticle": "创建了文章",
  "ov.contrib.action.updatedLoreFor": "更新了设定：",
  "ov.contrib.action.published": "发布了",
  "ov.contrib.action.revised": "修订了",
  "ov.contrib.time.hours2": "2 小时前",
  "ov.contrib.time.hours5": "5 小时前",
  "ov.contrib.time.hours8": "8 小时前",
  "ov.contrib.time.day1": "1 天前"
});

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('en', {
  "ov.contrib.action.createdArticle": "created article",
  "ov.contrib.action.updatedLoreFor": "updated lore for",
  "ov.contrib.action.published": "published",
  "ov.contrib.action.revised": "revised",
  "ov.contrib.time.hours2": "2 hours ago",
  "ov.contrib.time.hours5": "5 hours ago",
  "ov.contrib.time.hours8": "8 hours ago",
  "ov.contrib.time.day1": "1 day ago"
});

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('de', {
  "ov.contrib.action.createdArticle": "hat einen Artikel erstellt",
  "ov.contrib.action.updatedLoreFor": "hat Lore aktualisiert für",
  "ov.contrib.action.published": "hat veröffentlicht",
  "ov.contrib.action.revised": "hat überarbeitet",
  "ov.contrib.time.hours2": "vor 2 Stunden",
  "ov.contrib.time.hours5": "vor 5 Stunden",
  "ov.contrib.time.hours8": "vor 8 Stunden",
  "ov.contrib.time.day1": "vor 1 Tag"
});

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('ru', {
  "ov.contrib.action.createdArticle": "создал(а) статью",
  "ov.contrib.action.updatedLoreFor": "обновил(а) лор для",
  "ov.contrib.action.published": "опубликовал(а)",
  "ov.contrib.action.revised": "исправил(а)",
  "ov.contrib.time.hours2": "2 часа назад",
  "ov.contrib.time.hours5": "5 часов назад",
  "ov.contrib.time.hours8": "8 часов назад",
  "ov.contrib.time.day1": "1 день назад"
});

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('ms', {
  "ov.contrib.action.createdArticle": "mencipta artikel",
  "ov.contrib.action.updatedLoreFor": "mengemas kini lore untuk",
  "ov.contrib.action.published": "menerbitkan",
  "ov.contrib.action.revised": "menyemak semula",
  "ov.contrib.time.hours2": "2 jam lalu",
  "ov.contrib.time.hours5": "5 jam lalu",
  "ov.contrib.time.hours8": "8 jam lalu",
  "ov.contrib.time.day1": "1 hari lalu"
});

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('th', {
  "ov.contrib.action.createdArticle": "สร้างบทความ",
  "ov.contrib.action.updatedLoreFor": "อัปเดตเนื้อเรื่องสำหรับ",
  "ov.contrib.action.published": "เผยแพร่",
  "ov.contrib.action.revised": "แก้ไข",
  "ov.contrib.time.hours2": "2 ชั่วโมงที่แล้ว",
  "ov.contrib.time.hours5": "5 ชั่วโมงที่แล้ว",
  "ov.contrib.time.hours8": "8 ชั่วโมงที่แล้ว",
  "ov.contrib.time.day1": "1 วันที่แล้ว"
});

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('vi', {
  "ov.contrib.action.createdArticle": "đã tạo bài viết",
  "ov.contrib.action.updatedLoreFor": "đã cập nhật lore cho",
  "ov.contrib.action.published": "đã xuất bản",
  "ov.contrib.action.revised": "đã chỉnh sửa",
  "ov.contrib.time.hours2": "2 giờ trước",
  "ov.contrib.time.hours5": "5 giờ trước",
  "ov.contrib.time.hours8": "8 giờ trước",
  "ov.contrib.time.day1": "1 ngày trước"
});

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('id', {
  "ov.contrib.action.createdArticle": "membuat artikel",
  "ov.contrib.action.updatedLoreFor": "memperbarui lore untuk",
  "ov.contrib.action.published": "menerbitkan",
  "ov.contrib.action.revised": "merevisi",
  "ov.contrib.time.hours2": "2 jam lalu",
  "ov.contrib.time.hours5": "5 jam lalu",
  "ov.contrib.time.hours8": "8 jam lalu",
  "ov.contrib.time.day1": "1 hari lalu"
});

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('fr', {
  "ov.contrib.action.createdArticle": "a créé l'article",
  "ov.contrib.action.updatedLoreFor": "a mis à jour le lore de",
  "ov.contrib.action.published": "a publié",
  "ov.contrib.action.revised": "a révisé",
  "ov.contrib.time.hours2": "il y a 2 heures",
  "ov.contrib.time.hours5": "il y a 5 heures",
  "ov.contrib.time.hours8": "il y a 8 heures",
  "ov.contrib.time.day1": "il y a 1 jour"
});

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('es', {
  "ov.contrib.action.createdArticle": "creó el artículo",
  "ov.contrib.action.updatedLoreFor": "actualizó el lore de",
  "ov.contrib.action.published": "publicó",
  "ov.contrib.action.revised": "revisó",
  "ov.contrib.time.hours2": "hace 2 horas",
  "ov.contrib.time.hours5": "hace 5 horas",
  "ov.contrib.time.hours8": "hace 8 horas",
  "ov.contrib.time.day1": "hace 1 día"
});

// v0.2.54.2 i18n 补：最近贡献（zh-Hant 由 tmp-i18n-hant.js 重跑生成）
window.MN_I18N.add('pt', {
  "ov.contrib.action.createdArticle": "criou o artigo",
  "ov.contrib.action.updatedLoreFor": "atualizou a lore de",
  "ov.contrib.action.published": "publicou",
  "ov.contrib.action.revised": "revisou",
  "ov.contrib.time.hours2": "há 2 horas",
  "ov.contrib.time.hours5": "há 5 horas",
  "ov.contrib.time.hours8": "há 8 horas",
  "ov.contrib.time.day1": "há 1 dia"
});
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "ov.nav.overview": "概覽",
  "ov.nav.explore": "探索",
  "ov.nav.guidelines": "指南",
  "ov.knowledgeBase": "知識庫",
  "ov.heading": "MicroNationary 概覽",
  "ov.sub": "通往全球世界名錄、設定檔案與社區知識的大門。",
  "ov.createWorld": "創建世界",
  "ov.viewArchive": "查看檔案",
  "ov.story.tag": "M.NATIONWORLD · 知識入口",
  "ov.story.title": "政治啟蒙 · 故事站",
  "ov.story.desc": "先了解政治，再創造國家——滾輪式敘事帶你從零認識政治、國家與制度。",
  "ov.story.read": "開始閱讀",
  "ov.featuredBadge": "⭐ 精選世界",
  "ov.premium.desc": "高級分析、自定義主題、優先支持。",
  "ov.premium.subscribe": "訂閱 — ",
  "ov.premium.perMo": "/月",
  "ov.premium.viewPlans": "查看全部方案 →",
  "ov.recent": "近期貢獻",
  "ov.stat.worlds": "已創建世界",
  "ov.stat.topics": "精選話題",
  "ov.stat.countries": "架空國家",
  "ov.stat.regions": "文明區域",
  "ov.classFallback": "主權國家",
  "ov.since": " · 自 ",
  "ov.loreFallback": "M.NationWorld 登記名錄中的一個世界。",
  "ov.gdpPrefix": "GDP ",
  "ov.contrib.action.createdArticle": "創建了文章",
  "ov.contrib.action.updatedLoreFor": "更新了設定：",
  "ov.contrib.action.published": "發佈了",
  "ov.contrib.action.revised": "修訂了",
  "ov.contrib.time.hours2": "2 小時前",
  "ov.contrib.time.hours5": "5 小時前",
  "ov.contrib.time.hours8": "8 小時前",
  "ov.contrib.time.day1": "1 天前"
});
