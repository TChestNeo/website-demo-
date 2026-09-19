/**
 * create-topic-step-3.i18n.js — 创建话题向导第 3 步（Review & Launch）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld/MicroNationary/FluidCanvas/Slati Studio；
 *   货币数值不译：RM/MYR/XP）。
 * 页面原文为英文——zh 值为中文翻译、fallback 英文保持（HTML 静态兜底与 T() 兜底均为英文原文，
 *   电池断言源码字面量安全）；JS 动态文案（预览/摘要标签、可见性 Public/Private、alert、按钮
 *   Processing/Launched 态）原文同为英文——翻译在调用点 T('cts3.*') 惰性取值，首载/切语言重渲由
 *   window.__mnI18nRerender 钩子（renderReview）按当前语言落一遍。
 * 豁免清单：顶栏品牌词 M.NationWorld（含 img alt）不译不挂 data-i18n；Material Symbols 图标
 *   字形（check/arrow_back/rocket_launch/category/visibility/palette）与步骤序号（3）不译；
 *   话题分类码（governance/art/tech/social/other 为草稿存储值，页面原样展示）、草稿 name/description、
 *   accentColor 色值、'r/' 前缀名不译；本页无 select/option、无 input placeholder。
 */
window.MN_I18N
  // ═══ zh 简体（默认；值为中文翻译，fallback 英文原文保持）═══
  .add('zh', {
    'cts3.topbar.cancel': '取消',
    'cts3.steps.info': '信息',
    'cts3.steps.branding': '品牌',
    'cts3.steps.review': '确认',
    'cts3.hero.title': '审核并发布',
    'cts3.hero.subtitle': '第 3 步：确认你的话题',
    'cts3.terms.agree': '我同意 M.NationWorld 社区准则',
    'cts3.nav.prev': '上一步',
    'cts3.nav.launch': '发布话题',
    'cts3.preview.public': '🌐 公开',
    'cts3.preview.private': '🔒 私密',
    'cts3.summary.category': '分类：',
    'cts3.summary.visibility': '可见性：',
    'cts3.summary.accent': '强调色：',
    'cts3.visibility.public': '公开',
    'cts3.visibility.private': '私密',
    'cts3.err.agree': '发布前请先同意社区准则。',
    'cts3.launching': '正在处理发布...',
    'cts3.launched': '话题已发布！'
  })
  // ═══ en 英语（页面原文即英文，值与原文逐字节一致）═══
  .add('en', {
    'cts3.topbar.cancel': 'Cancel',
    'cts3.steps.info': 'Info',
    'cts3.steps.branding': 'Branding',
    'cts3.steps.review': 'Review',
    'cts3.hero.title': 'Review & Launch',
    'cts3.hero.subtitle': 'Step 3: Confirm your topic',
    'cts3.terms.agree': 'I agree to the M.NationWorld Community Guidelines',
    'cts3.nav.prev': 'Previous',
    'cts3.nav.launch': 'Launch Topic',
    'cts3.preview.public': '🌐 Public',
    'cts3.preview.private': '🔒 Private',
    'cts3.summary.category': 'Category:',
    'cts3.summary.visibility': 'Visibility:',
    'cts3.summary.accent': 'Accent:',
    'cts3.visibility.public': 'Public',
    'cts3.visibility.private': 'Private',
    'cts3.err.agree': 'Please agree to the Community Guidelines before launching.',
    'cts3.launching': 'Processing Launch...',
    'cts3.launched': 'Topic Launched!'
  })
  // ═══ de 德语 ═══
  .add('de', {
    'cts3.topbar.cancel': 'Abbrechen',
    'cts3.steps.info': 'Info',
    'cts3.steps.branding': 'Branding',
    'cts3.steps.review': 'Überprüfen',
    'cts3.hero.title': 'Überprüfen & Veröffentlichen',
    'cts3.hero.subtitle': 'Schritt 3: Bestätige dein Thema',
    'cts3.terms.agree': 'Ich stimme den Community-Richtlinien von M.NationWorld zu',
    'cts3.nav.prev': 'Zurück',
    'cts3.nav.launch': 'Thema veröffentlichen',
    'cts3.preview.public': '🌐 Öffentlich',
    'cts3.preview.private': '🔒 Privat',
    'cts3.summary.category': 'Kategorie:',
    'cts3.summary.visibility': 'Sichtbarkeit:',
    'cts3.summary.accent': 'Akzent:',
    'cts3.visibility.public': 'Öffentlich',
    'cts3.visibility.private': 'Privat',
    'cts3.err.agree': 'Bitte stimme den Community-Richtlinien zu, bevor du veröffentlichst.',
    'cts3.launching': 'Veröffentlichung wird verarbeitet...',
    'cts3.launched': 'Thema veröffentlicht!'
  })
  // ═══ ru 俄语 ═══
  .add('ru', {
    'cts3.topbar.cancel': 'Отмена',
    'cts3.steps.info': 'Инфо',
    'cts3.steps.branding': 'Оформление',
    'cts3.steps.review': 'Проверка',
    'cts3.hero.title': 'Проверка и запуск',
    'cts3.hero.subtitle': 'Шаг 3: Подтвердите вашу тему',
    'cts3.terms.agree': 'Я согласен с Правилами сообщества M.NationWorld',
    'cts3.nav.prev': 'Назад',
    'cts3.nav.launch': 'Запустить тему',
    'cts3.preview.public': '🌐 Публичная',
    'cts3.preview.private': '🔒 Приватная',
    'cts3.summary.category': 'Категория:',
    'cts3.summary.visibility': 'Видимость:',
    'cts3.summary.accent': 'Акцент:',
    'cts3.visibility.public': 'Публичная',
    'cts3.visibility.private': 'Приватная',
    'cts3.err.agree': 'Пожалуйста, примите Правила сообщества перед запуском.',
    'cts3.launching': 'Запуск обрабатывается...',
    'cts3.launched': 'Тема запущена!'
  })
  // ═══ ms 马来语 ═══
  .add('ms', {
    'cts3.topbar.cancel': 'Batal',
    'cts3.steps.info': 'Maklumat',
    'cts3.steps.branding': 'Penjenamaan',
    'cts3.steps.review': 'Semak',
    'cts3.hero.title': 'Semak & Lancarkan',
    'cts3.hero.subtitle': 'Langkah 3: Sahkan topik anda',
    'cts3.terms.agree': 'Saya bersetuju dengan Garis Panduan Komuniti M.NationWorld',
    'cts3.nav.prev': 'Sebelumnya',
    'cts3.nav.launch': 'Lancarkan Topik',
    'cts3.preview.public': '🌐 Awam',
    'cts3.preview.private': '🔒 Peribadi',
    'cts3.summary.category': 'Kategori:',
    'cts3.summary.visibility': 'Keterlihatan:',
    'cts3.summary.accent': 'Aksen:',
    'cts3.visibility.public': 'Awam',
    'cts3.visibility.private': 'Peribadi',
    'cts3.err.agree': 'Sila setujui Garis Panduan Komuniti sebelum melancarkan.',
    'cts3.launching': 'Memproses Pelancaran...',
    'cts3.launched': 'Topik Dilancarkan!'
  })
  // ═══ th 泰语 ═══
  .add('th', {
    'cts3.topbar.cancel': 'ยกเลิก',
    'cts3.steps.info': 'ข้อมูล',
    'cts3.steps.branding': 'การสร้างแบรนด์',
    'cts3.steps.review': 'ตรวจสอบ',
    'cts3.hero.title': 'ตรวจสอบและเปิดตัว',
    'cts3.hero.subtitle': 'ขั้นตอนที่ 3: ยืนยันหัวข้อของคุณ',
    'cts3.terms.agree': 'ฉันยอมรับแนวทางปฏิบัติของชุมชน M.NationWorld',
    'cts3.nav.prev': 'ก่อนหน้า',
    'cts3.nav.launch': 'เปิดตัวหัวข้อ',
    'cts3.preview.public': '🌐 สาธารณะ',
    'cts3.preview.private': '🔒 ส่วนตัว',
    'cts3.summary.category': 'หมวดหมู่:',
    'cts3.summary.visibility': 'การมองเห็น:',
    'cts3.summary.accent': 'สีเน้น:',
    'cts3.visibility.public': 'สาธารณะ',
    'cts3.visibility.private': 'ส่วนตัว',
    'cts3.err.agree': 'กรุณายอมรับแนวทางปฏิบัติของชุมชนก่อนเปิดตัว',
    'cts3.launching': 'กำลังประมวลผลการเปิดตัว...',
    'cts3.launched': 'เปิดตัวหัวข้อแล้ว!'
  })
  // ═══ vi 越南语 ═══
  .add('vi', {
    'cts3.topbar.cancel': 'Hủy',
    'cts3.steps.info': 'Thông tin',
    'cts3.steps.branding': 'Thương hiệu',
    'cts3.steps.review': 'Xem lại',
    'cts3.hero.title': 'Xem lại & Khởi chạy',
    'cts3.hero.subtitle': 'Bước 3: Xác nhận chủ đề của bạn',
    'cts3.terms.agree': 'Tôi đồng ý với Nguyên tắc cộng đồng của M.NationWorld',
    'cts3.nav.prev': 'Trước',
    'cts3.nav.launch': 'Khởi chạy chủ đề',
    'cts3.preview.public': '🌐 Công khai',
    'cts3.preview.private': '🔒 Riêng tư',
    'cts3.summary.category': 'Danh mục:',
    'cts3.summary.visibility': 'Quyền xem:',
    'cts3.summary.accent': 'Màu nhấn:',
    'cts3.visibility.public': 'Công khai',
    'cts3.visibility.private': 'Riêng tư',
    'cts3.err.agree': 'Vui lòng đồng ý với Nguyên tắc cộng đồng trước khi khởi chạy.',
    'cts3.launching': 'Đang xử lý khởi chạy...',
    'cts3.launched': 'Chủ đề đã khởi chạy!'
  })
  // ═══ id 印尼语 ═══
  .add('id', {
    'cts3.topbar.cancel': 'Batal',
    'cts3.steps.info': 'Info',
    'cts3.steps.branding': 'Pencitraan',
    'cts3.steps.review': 'Tinjau',
    'cts3.hero.title': 'Tinjau & Luncurkan',
    'cts3.hero.subtitle': 'Langkah 3: Konfirmasi topikmu',
    'cts3.terms.agree': 'Saya menyetujui Pedoman Komunitas M.NationWorld',
    'cts3.nav.prev': 'Sebelumnya',
    'cts3.nav.launch': 'Luncurkan Topik',
    'cts3.preview.public': '🌐 Publik',
    'cts3.preview.private': '🔒 Pribadi',
    'cts3.summary.category': 'Kategori:',
    'cts3.summary.visibility': 'Visibilitas:',
    'cts3.summary.accent': 'Aksen:',
    'cts3.visibility.public': 'Publik',
    'cts3.visibility.private': 'Pribadi',
    'cts3.err.agree': 'Harap setujui Pedoman Komunitas sebelum meluncurkan.',
    'cts3.launching': 'Memproses Peluncuran...',
    'cts3.launched': 'Topik Diluncurkan!'
  })
  // ═══ fr 法语 ═══
  .add('fr', {
    'cts3.topbar.cancel': 'Annuler',
    'cts3.steps.info': 'Infos',
    'cts3.steps.branding': 'Identité',
    'cts3.steps.review': 'Vérification',
    'cts3.hero.title': 'Vérification et lancement',
    'cts3.hero.subtitle': 'Étape 3 : Confirmez votre sujet',
    'cts3.terms.agree': 'J\'accepte les Règles de la communauté de M.NationWorld',
    'cts3.nav.prev': 'Précédent',
    'cts3.nav.launch': 'Lancer le sujet',
    'cts3.preview.public': '🌐 Public',
    'cts3.preview.private': '🔒 Privé',
    'cts3.summary.category': 'Catégorie :',
    'cts3.summary.visibility': 'Visibilité :',
    'cts3.summary.accent': 'Accent :',
    'cts3.visibility.public': 'Public',
    'cts3.visibility.private': 'Privé',
    'cts3.err.agree': 'Veuillez accepter les Règles de la communauté avant de lancer.',
    'cts3.launching': 'Lancement en cours...',
    'cts3.launched': 'Sujet lancé !'
  })
  // ═══ es 西班牙语 ═══
  .add('es', {
    'cts3.topbar.cancel': 'Cancelar',
    'cts3.steps.info': 'Información',
    'cts3.steps.branding': 'Marca',
    'cts3.steps.review': 'Revisar',
    'cts3.hero.title': 'Revisar y publicar',
    'cts3.hero.subtitle': 'Paso 3: Confirma tu tema',
    'cts3.terms.agree': 'Acepto las Normas de la comunidad de M.NationWorld',
    'cts3.nav.prev': 'Anterior',
    'cts3.nav.launch': 'Publicar tema',
    'cts3.preview.public': '🌐 Público',
    'cts3.preview.private': '🔒 Privado',
    'cts3.summary.category': 'Categoría:',
    'cts3.summary.visibility': 'Visibilidad:',
    'cts3.summary.accent': 'Acento:',
    'cts3.visibility.public': 'Público',
    'cts3.visibility.private': 'Privado',
    'cts3.err.agree': 'Acepta las Normas de la comunidad antes de publicar.',
    'cts3.launching': 'Procesando publicación...',
    'cts3.launched': '¡Tema publicado!'
  })
  // ═══ pt 葡萄牙语 ═══
  .add('pt', {
    'cts3.topbar.cancel': 'Cancelar',
    'cts3.steps.info': 'Informação',
    'cts3.steps.branding': 'Marca',
    'cts3.steps.review': 'Revisar',
    'cts3.hero.title': 'Revisar e lançar',
    'cts3.hero.subtitle': 'Passo 3: Confirme seu tópico',
    'cts3.terms.agree': 'Concordo com as Diretrizes da comunidade do M.NationWorld',
    'cts3.nav.prev': 'Anterior',
    'cts3.nav.launch': 'Publicar tópico',
    'cts3.preview.public': '🌐 Público',
    'cts3.preview.private': '🔒 Privado',
    'cts3.summary.category': 'Categoria:',
    'cts3.summary.visibility': 'Visibilidade:',
    'cts3.summary.accent': 'Destaque:',
    'cts3.visibility.public': 'Público',
    'cts3.visibility.private': 'Privado',
    'cts3.err.agree': 'Aceite as Diretrizes da comunidade antes de lançar.',
    'cts3.launching': 'Processando publicação...',
    'cts3.launched': 'Tópico publicado!'
  });
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "cts3.topbar.cancel": "取消",
  "cts3.steps.info": "信息",
  "cts3.steps.branding": "品牌",
  "cts3.steps.review": "確認",
  "cts3.hero.title": "審核併發布",
  "cts3.hero.subtitle": "第 3 步：確認你的話題",
  "cts3.terms.agree": "我同意 M.NationWorld 社區準則",
  "cts3.nav.prev": "上一步",
  "cts3.nav.launch": "發佈話題",
  "cts3.preview.public": "🌐 公開",
  "cts3.preview.private": "🔒 私密",
  "cts3.summary.category": "分類：",
  "cts3.summary.visibility": "可見性：",
  "cts3.summary.accent": "強調色：",
  "cts3.visibility.public": "公開",
  "cts3.visibility.private": "私密",
  "cts3.err.agree": "發佈前請先同意社區準則。",
  "cts3.launching": "正在處理發佈...",
  "cts3.launched": "話題已發佈！"
});
