/**
 * create-topic-step-1.i18n.js — 创建主题向导第 1 步页（pages/create-topic-step-1.html）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld、MicroNationary、FluidCanvas、Slati Studio；
 *   货币/数值不译：RM、MYR、XP）。
 * 本页原文为英文——en 值逐字节=页面原文；zh 值为中文翻译（auth.i18n.js 先例）。
 * 示例数据不译：ph.name 中的示例主题名 Digital Sovereignty Protocols（各语言仅译「例如」前缀）；
 *   步骤序号 1/2/3 与图标 ligature（arrow_forward 等）不译（数字/图标，非文案）。
 * 纪律：必须包含 en 字典（v0.2.54.0 用户钦定加英语）。
 */
window.MN_I18N
  // ═══ zh 简体（默认；本页原文为英文——zh 值为中文翻译）═══
  .add('zh', {
    // ── 顶栏 ──
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': '创建主题',

    // ── 步骤条 ──
    'cts1.steps.info': '信息',
    'cts1.steps.branding': '品牌',
    'cts1.steps.review': '确认',

    // ── 标题区 ──
    'cts1.hero.title': '创建新主题',
    'cts1.hero.sub': '第 1 步：定义你的主题',

    // ── 表单 ──
    'cts1.form.name': '主题名称',
    'cts1.form.desc': '简短描述',
    'cts1.form.category': '类别',
    'cts1.ph.name': '例如：Digital Sovereignty Protocols',
    'cts1.ph.desc': '这个主题是关于什么的？',

    // ── 操作 ──
    'cts1.actions.discard': '丢弃草稿',
    'cts1.actions.continue': '继续到品牌',

    // ── 类别按钮（JS 渲染，T() 惰性取值）──
    'cts1.cat.governance': '治理',
    'cts1.cat.art': '艺术与传说',
    'cts1.cat.tech': '科技',
    'cts1.cat.social': '社交',
    'cts1.cat.other': '其他',

    // ── 表单错误（JS 渲染，T() 惰性取值）──
    'cts1.err.name': '请输入主题名称',
    'cts1.err.desc': '请输入描述',
    'cts1.err.category': '请选择一个类别'
  })
  // ═══ en 英语（值逐字节=页面原文）═══
  .add('en', {
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': 'Create Topic',
    'cts1.steps.info': 'Info',
    'cts1.steps.branding': 'Branding',
    'cts1.steps.review': 'Review',
    'cts1.hero.title': 'Create a New Topic',
    'cts1.hero.sub': 'Step 1: Define your topic',
    'cts1.form.name': 'Topic Name',
    'cts1.form.desc': 'Short Description',
    'cts1.form.category': 'Category',
    'cts1.ph.name': 'e.g. Digital Sovereignty Protocols',
    'cts1.ph.desc': 'What is this topic about?',
    'cts1.actions.discard': 'Discard Draft',
    'cts1.actions.continue': 'Continue to Branding',
    'cts1.cat.governance': 'Governance',
    'cts1.cat.art': 'Art & Lore',
    'cts1.cat.tech': 'Technology',
    'cts1.cat.social': 'Social',
    'cts1.cat.other': 'Other',
    'cts1.err.name': 'Please enter a topic name',
    'cts1.err.desc': 'Please enter a description',
    'cts1.err.category': 'Please select a category'
  })
  // ═══ de 德语 ═══
  .add('de', {
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': 'Thema erstellen',
    'cts1.steps.info': 'Info',
    'cts1.steps.branding': 'Branding',
    'cts1.steps.review': 'Überprüfung',
    'cts1.hero.title': 'Neues Thema erstellen',
    'cts1.hero.sub': 'Schritt 1: Definiere dein Thema',
    'cts1.form.name': 'Themenname',
    'cts1.form.desc': 'Kurzbeschreibung',
    'cts1.form.category': 'Kategorie',
    'cts1.ph.name': 'z. B. Digital Sovereignty Protocols',
    'cts1.ph.desc': 'Worum geht es in diesem Thema?',
    'cts1.actions.discard': 'Entwurf verwerfen',
    'cts1.actions.continue': 'Weiter zum Branding',
    'cts1.cat.governance': 'Regierung',
    'cts1.cat.art': 'Kunst & Lore',
    'cts1.cat.tech': 'Technologie',
    'cts1.cat.social': 'Soziales',
    'cts1.cat.other': 'Sonstiges',
    'cts1.err.name': 'Bitte gib einen Themennamen ein',
    'cts1.err.desc': 'Bitte gib eine Beschreibung ein',
    'cts1.err.category': 'Bitte wähle eine Kategorie'
  })
  // ═══ ru 俄语 ═══
  .add('ru', {
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': 'Создать тему',
    'cts1.steps.info': 'Информация',
    'cts1.steps.branding': 'Брендинг',
    'cts1.steps.review': 'Проверка',
    'cts1.hero.title': 'Создать новую тему',
    'cts1.hero.sub': 'Шаг 1. Опишите вашу тему',
    'cts1.form.name': 'Название темы',
    'cts1.form.desc': 'Краткое описание',
    'cts1.form.category': 'Категория',
    'cts1.ph.name': 'например, Digital Sovereignty Protocols',
    'cts1.ph.desc': 'О чём эта тема?',
    'cts1.actions.discard': 'Удалить черновик',
    'cts1.actions.continue': 'Перейти к брендингу',
    'cts1.cat.governance': 'Управление',
    'cts1.cat.art': 'Искусство и лор',
    'cts1.cat.tech': 'Технологии',
    'cts1.cat.social': 'Социальное',
    'cts1.cat.other': 'Другое',
    'cts1.err.name': 'Введите название темы',
    'cts1.err.desc': 'Введите описание',
    'cts1.err.category': 'Выберите категорию'
  })
  // ═══ ms 马来语 ═══
  .add('ms', {
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': 'Cipta Topik',
    'cts1.steps.info': 'Maklumat',
    'cts1.steps.branding': 'Penjenamaan',
    'cts1.steps.review': 'Semakan',
    'cts1.hero.title': 'Cipta Topik Baharu',
    'cts1.hero.sub': 'Langkah 1: Tentukan topik anda',
    'cts1.form.name': 'Nama Topik',
    'cts1.form.desc': 'Penerangan Ringkas',
    'cts1.form.category': 'Kategori',
    'cts1.ph.name': 'cth. Digital Sovereignty Protocols',
    'cts1.ph.desc': 'Topik ini tentang apa?',
    'cts1.actions.discard': 'Buang Draf',
    'cts1.actions.continue': 'Teruskan ke Penjenamaan',
    'cts1.cat.governance': 'Pemerintahan',
    'cts1.cat.art': 'Seni & Lore',
    'cts1.cat.tech': 'Teknologi',
    'cts1.cat.social': 'Sosial',
    'cts1.cat.other': 'Lain-lain',
    'cts1.err.name': 'Sila masukkan nama topik',
    'cts1.err.desc': 'Sila masukkan penerangan',
    'cts1.err.category': 'Sila pilih kategori'
  })
  // ═══ th 泰语 ═══
  .add('th', {
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': 'สร้างหัวข้อ',
    'cts1.steps.info': 'ข้อมูล',
    'cts1.steps.branding': 'แบรนด์',
    'cts1.steps.review': 'ตรวจสอบ',
    'cts1.hero.title': 'สร้างหัวข้อใหม่',
    'cts1.hero.sub': 'ขั้นตอนที่ 1: กำหนดหัวข้อของคุณ',
    'cts1.form.name': 'ชื่อหัวข้อ',
    'cts1.form.desc': 'คำอธิบายสั้น ๆ',
    'cts1.form.category': 'หมวดหมู่',
    'cts1.ph.name': 'เช่น Digital Sovereignty Protocols',
    'cts1.ph.desc': 'หัวข้อนี้เกี่ยวกับอะไร?',
    'cts1.actions.discard': 'ทิ้งแบบร่าง',
    'cts1.actions.continue': 'ไปที่แบรนด์',
    'cts1.cat.governance': 'การปกครอง',
    'cts1.cat.art': 'ศิลปะและตำนาน',
    'cts1.cat.tech': 'เทคโนโลยี',
    'cts1.cat.social': 'สังคม',
    'cts1.cat.other': 'อื่น ๆ',
    'cts1.err.name': 'กรุณากรอกชื่อหัวข้อ',
    'cts1.err.desc': 'กรุณากรอกคำอธิบาย',
    'cts1.err.category': 'กรุณาเลือกหมวดหมู่'
  })
  // ═══ vi 越南语 ═══
  .add('vi', {
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': 'Tạo chủ đề',
    'cts1.steps.info': 'Thông tin',
    'cts1.steps.branding': 'Thương hiệu',
    'cts1.steps.review': 'Xem lại',
    'cts1.hero.title': 'Tạo chủ đề mới',
    'cts1.hero.sub': 'Bước 1: Xác định chủ đề của bạn',
    'cts1.form.name': 'Tên chủ đề',
    'cts1.form.desc': 'Mô tả ngắn',
    'cts1.form.category': 'Danh mục',
    'cts1.ph.name': 'vd. Digital Sovereignty Protocols',
    'cts1.ph.desc': 'Chủ đề này nói về điều gì?',
    'cts1.actions.discard': 'Hủy bản nháp',
    'cts1.actions.continue': 'Tiếp tục đến Thương hiệu',
    'cts1.cat.governance': 'Quản trị',
    'cts1.cat.art': 'Nghệ thuật & Lore',
    'cts1.cat.tech': 'Công nghệ',
    'cts1.cat.social': 'Xã hội',
    'cts1.cat.other': 'Khác',
    'cts1.err.name': 'Vui lòng nhập tên chủ đề',
    'cts1.err.desc': 'Vui lòng nhập mô tả',
    'cts1.err.category': 'Vui lòng chọn danh mục'
  })
  // ═══ id 印尼语 ═══
  .add('id', {
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': 'Buat Topik',
    'cts1.steps.info': 'Info',
    'cts1.steps.branding': 'Branding',
    'cts1.steps.review': 'Tinjau',
    'cts1.hero.title': 'Buat Topik Baru',
    'cts1.hero.sub': 'Langkah 1: Tentukan topik Anda',
    'cts1.form.name': 'Nama Topik',
    'cts1.form.desc': 'Deskripsi Singkat',
    'cts1.form.category': 'Kategori',
    'cts1.ph.name': 'mis. Digital Sovereignty Protocols',
    'cts1.ph.desc': 'Topik ini tentang apa?',
    'cts1.actions.discard': 'Buang Draf',
    'cts1.actions.continue': 'Lanjut ke Branding',
    'cts1.cat.governance': 'Pemerintahan',
    'cts1.cat.art': 'Seni & Lore',
    'cts1.cat.tech': 'Teknologi',
    'cts1.cat.social': 'Sosial',
    'cts1.cat.other': 'Lainnya',
    'cts1.err.name': 'Silakan masukkan nama topik',
    'cts1.err.desc': 'Silakan masukkan deskripsi',
    'cts1.err.category': 'Silakan pilih kategori'
  })
  // ═══ fr 法语 ═══
  .add('fr', {
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': 'Créer un sujet',
    'cts1.steps.info': 'Infos',
    'cts1.steps.branding': 'Identité',
    'cts1.steps.review': 'Vérification',
    'cts1.hero.title': 'Créer un nouveau sujet',
    'cts1.hero.sub': 'Étape 1 : Définissez votre sujet',
    'cts1.form.name': 'Nom du sujet',
    'cts1.form.desc': 'Brève description',
    'cts1.form.category': 'Catégorie',
    'cts1.ph.name': 'p. ex. Digital Sovereignty Protocols',
    'cts1.ph.desc': 'De quoi parle ce sujet ?',
    'cts1.actions.discard': 'Abandonner le brouillon',
    'cts1.actions.continue': 'Continuer vers l\'identité',
    'cts1.cat.governance': 'Gouvernance',
    'cts1.cat.art': 'Art & Lore',
    'cts1.cat.tech': 'Technologie',
    'cts1.cat.social': 'Social',
    'cts1.cat.other': 'Autre',
    'cts1.err.name': 'Veuillez saisir un nom de sujet',
    'cts1.err.desc': 'Veuillez saisir une description',
    'cts1.err.category': 'Veuillez sélectionner une catégorie'
  })
  // ═══ es 西班牙语 ═══
  .add('es', {
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': 'Crear tema',
    'cts1.steps.info': 'Información',
    'cts1.steps.branding': 'Marca',
    'cts1.steps.review': 'Revisión',
    'cts1.hero.title': 'Crear un tema nuevo',
    'cts1.hero.sub': 'Paso 1: Define tu tema',
    'cts1.form.name': 'Nombre del tema',
    'cts1.form.desc': 'Descripción breve',
    'cts1.form.category': 'Categoría',
    'cts1.ph.name': 'p. ej. Digital Sovereignty Protocols',
    'cts1.ph.desc': '¿De qué trata este tema?',
    'cts1.actions.discard': 'Descartar borrador',
    'cts1.actions.continue': 'Continuar a Marca',
    'cts1.cat.governance': 'Gobernanza',
    'cts1.cat.art': 'Arte y lore',
    'cts1.cat.tech': 'Tecnología',
    'cts1.cat.social': 'Social',
    'cts1.cat.other': 'Otros',
    'cts1.err.name': 'Introduce un nombre de tema',
    'cts1.err.desc': 'Introduce una descripción',
    'cts1.err.category': 'Selecciona una categoría'
  })
  // ═══ pt 葡萄牙语（末语言：哨兵收口）═══
  .add('pt', {
    'cts1.topbar.brand': 'M.NationWorld',
    'cts1.topbar.label': 'Criar tópico',
    'cts1.steps.info': 'Informações',
    'cts1.steps.branding': 'Marca',
    'cts1.steps.review': 'Revisão',
    'cts1.hero.title': 'Criar um novo tópico',
    'cts1.hero.sub': 'Passo 1: Defina o seu tópico',
    'cts1.form.name': 'Nome do tópico',
    'cts1.form.desc': 'Descrição curta',
    'cts1.form.category': 'Categoria',
    'cts1.ph.name': 'ex. Digital Sovereignty Protocols',
    'cts1.ph.desc': 'Sobre o que é este tópico?',
    'cts1.actions.discard': 'Descartar rascunho',
    'cts1.actions.continue': 'Continuar para Marca',
    'cts1.cat.governance': 'Governança',
    'cts1.cat.art': 'Arte e Lore',
    'cts1.cat.tech': 'Tecnologia',
    'cts1.cat.social': 'Social',
    'cts1.cat.other': 'Outro',
    'cts1.err.name': 'Insira um nome de tópico',
    'cts1.err.desc': 'Insira uma descrição',
    'cts1.err.category': 'Selecione uma categoria'
  });
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "cts1.topbar.brand": "M.NationWorld",
  "cts1.topbar.label": "創建主題",
  "cts1.steps.info": "信息",
  "cts1.steps.branding": "品牌",
  "cts1.steps.review": "確認",
  "cts1.hero.title": "創建新主題",
  "cts1.hero.sub": "第 1 步：定義你的主題",
  "cts1.form.name": "主題名稱",
  "cts1.form.desc": "簡短描述",
  "cts1.form.category": "類別",
  "cts1.ph.name": "例如：Digital Sovereignty Protocols",
  "cts1.ph.desc": "這個主題是關於什麼的？",
  "cts1.actions.discard": "丟棄草稿",
  "cts1.actions.continue": "繼續到品牌",
  "cts1.cat.governance": "治理",
  "cts1.cat.art": "藝術與傳說",
  "cts1.cat.tech": "科技",
  "cts1.cat.social": "社交",
  "cts1.cat.other": "其他",
  "cts1.err.name": "請輸入主題名稱",
  "cts1.err.desc": "請輸入描述",
  "cts1.err.category": "請選擇一個類別"
});
