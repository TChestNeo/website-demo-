/**
 * transitioning.i18n.js — 过渡倒计时页（pages/transitioning.html）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld、MicroNationary、FluidCanvas、Slati Studio）。
 * 页面原文为英文（5 秒倒计时跳转闪屏）——zh 值为中文翻译、fallback 英文保持（auth 先例，
 * 电池断言源码字面量安全）；en 值 = 页面英文原文逐字节相同。
 * 示例数据不译清单：无表单/无 option；材料图标连字 sync/verified 与倒计时数字由 JS
 * 动态写入不译；版本号 v2.4.1 不译。
 * 动态文案（倒计时五段消息 + 就绪文案）由页面内联脚本 T() 惰性读取（英文兜底），
 * 首载/切语言走 window.__mnI18nRerender 重渲。
 */
window.MN_I18N
  // ═══ zh 简体（默认；页面原文为英文——zh 值为中文翻译）═══
  .add('zh', {
    'trans.footer.console': 'M.NationWorld 控制台 v2.4.1',
    'trans.initial.text': '正在初始化主权工作区...',
    'trans.m1.title': '正在建立连接',
    'trans.m1.text': '正在初始化创意工作区...',
    'trans.m2.title': '正在加载模块',
    'trans.m2.text': '正在准备世界构建工具...',
    'trans.m3.title': '正在同步注册库',
    'trans.m3.text': '正在连接全球账本...',
    'trans.m4.title': '正在校准控制台',
    'trans.m4.text': '正在优化仪表盘布局...',
    'trans.m5.title': '即将就绪',
    'trans.m5.text': '正在完成工作区权限设置...',
    'trans.ready.title': '欢迎，Sovereign',
    'trans.ready.text': '你的控制台已就绪。'
  })
  // ═══ en 英语（= 页面英文原文逐字节相同）═══
  .add('en', {
    'trans.footer.console': 'M.NationWorld Console v2.4.1',
    'trans.initial.text': 'Initializing sovereign workspace...',
    'trans.m1.title': 'Establishing Connection',
    'trans.m1.text': 'Initializing creative workspace...',
    'trans.m2.title': 'Loading Modules',
    'trans.m2.text': 'Preparing worldbuilding tools...',
    'trans.m3.title': 'Syncing Registry',
    'trans.m3.text': 'Connecting to global ledger...',
    'trans.m4.title': 'Calibrating Console',
    'trans.m4.text': 'Optimizing dashboard layout...',
    'trans.m5.title': 'Almost Ready',
    'trans.m5.text': 'Finalizing workspace permissions...',
    'trans.ready.title': 'Welcome, Sovereign',
    'trans.ready.text': 'Your console is ready.'
  })
  // ═══ de 德语 ═══
  .add('de', {
    'trans.footer.console': 'M.NationWorld-Konsole v2.4.1',
    'trans.initial.text': 'Initialisiere souveränen Arbeitsbereich...',
    'trans.m1.title': 'Verbindung wird hergestellt',
    'trans.m1.text': 'Initialisiere kreativen Arbeitsbereich...',
    'trans.m2.title': 'Module werden geladen',
    'trans.m2.text': 'Bereite Worldbuilding-Werkzeuge vor...',
    'trans.m3.title': 'Synchronisiere Register',
    'trans.m3.text': 'Verbinde mit globalem Ledger...',
    'trans.m4.title': 'Kalibriere Konsole',
    'trans.m4.text': 'Optimiere Dashboard-Layout...',
    'trans.m5.title': 'Fast bereit',
    'trans.m5.text': 'Finalisiere Berechtigungen des Arbeitsbereichs...',
    'trans.ready.title': 'Willkommen, Sovereign',
    'trans.ready.text': 'Deine Konsole ist bereit.'
  })
  // ═══ ru 俄语 ═══
  .add('ru', {
    'trans.footer.console': 'Консоль M.NationWorld v2.4.1',
    'trans.initial.text': 'Инициализация суверенного рабочего пространства...',
    'trans.m1.title': 'Устанавливаем соединение',
    'trans.m1.text': 'Инициализация творческого рабочего пространства...',
    'trans.m2.title': 'Загружаем модули',
    'trans.m2.text': 'Готовим инструменты миростроительства...',
    'trans.m3.title': 'Синхронизируем реестр',
    'trans.m3.text': 'Подключаемся к глобальному реестру...',
    'trans.m4.title': 'Калибруем консоль',
    'trans.m4.text': 'Оптимизируем макет панели...',
    'trans.m5.title': 'Почти готово',
    'trans.m5.text': 'Завершаем настройку прав рабочего пространства...',
    'trans.ready.title': 'Добро пожаловать, Sovereign',
    'trans.ready.text': 'Ваша консоль готова.'
  })
  // ═══ ms 马来语 ═══
  .add('ms', {
    'trans.footer.console': 'Konsol M.NationWorld v2.4.1',
    'trans.initial.text': 'Memulakan ruang kerja berdaulat...',
    'trans.m1.title': 'Mewujudkan Sambungan',
    'trans.m1.text': 'Memulakan ruang kerja kreatif...',
    'trans.m2.title': 'Memuatkan Modul',
    'trans.m2.text': 'Menyediakan alat pembinaan dunia...',
    'trans.m3.title': 'Menyegerakkan Pendaftaran',
    'trans.m3.text': 'Menyambung ke lejar global...',
    'trans.m4.title': 'Menentukur Konsol',
    'trans.m4.text': 'Mengoptimumkan susun atur papan pemuka...',
    'trans.m5.title': 'Hampir Sedia',
    'trans.m5.text': 'Memuktamadkan kebenaran ruang kerja...',
    'trans.ready.title': 'Selamat Datang, Sovereign',
    'trans.ready.text': 'Konsol anda sudah sedia.'
  })
  // ═══ th 泰语 ═══
  .add('th', {
    'trans.footer.console': 'คอนโซล M.NationWorld v2.4.1',
    'trans.initial.text': 'กำลังเริ่มต้นพื้นที่ทำงานอธิปไตย...',
    'trans.m1.title': 'กำลังสร้างการเชื่อมต่อ',
    'trans.m1.text': 'กำลังเริ่มต้นพื้นที่ทำงานสร้างสรรค์...',
    'trans.m2.title': 'กำลังโหลดโมดูล',
    'trans.m2.text': 'กำลังเตรียมเครื่องมือสร้างโลก...',
    'trans.m3.title': 'กำลังซิงค์ทะเบียน',
    'trans.m3.text': 'กำลังเชื่อมต่อกับบัญชีแยกประเภททั่วโลก...',
    'trans.m4.title': 'กำลังปรับเทียบคอนโซล',
    'trans.m4.text': 'กำลังปรับแต่งเลย์เอาต์แดชบอร์ด...',
    'trans.m5.title': 'ใกล้พร้อมแล้ว',
    'trans.m5.text': 'กำลังสรุปสิทธิ์พื้นที่ทำงาน...',
    'trans.ready.title': 'ยินดีต้อนรับ Sovereign',
    'trans.ready.text': 'คอนโซลของคุณพร้อมแล้ว'
  })
  // ═══ vi 越南语 ═══
  .add('vi', {
    'trans.footer.console': 'Bảng điều khiển M.NationWorld v2.4.1',
    'trans.initial.text': 'Đang khởi tạo không gian làm việc chủ quyền...',
    'trans.m1.title': 'Đang thiết lập kết nối',
    'trans.m1.text': 'Đang khởi tạo không gian sáng tạo...',
    'trans.m2.title': 'Đang tải mô-đun',
    'trans.m2.text': 'Đang chuẩn bị công cụ xây dựng thế giới...',
    'trans.m3.title': 'Đang đồng bộ sổ đăng ký',
    'trans.m3.text': 'Đang kết nối sổ cái toàn cầu...',
    'trans.m4.title': 'Đang hiệu chỉnh bảng điều khiển',
    'trans.m4.text': 'Đang tối ưu bố cục bảng điều khiển...',
    'trans.m5.title': 'Gần xong',
    'trans.m5.text': 'Đang hoàn tất quyền không gian làm việc...',
    'trans.ready.title': 'Chào mừng, Sovereign',
    'trans.ready.text': 'Bảng điều khiển của bạn đã sẵn sàng.'
  })
  // ═══ id 印尼语 ═══
  .add('id', {
    'trans.footer.console': 'Konsol M.NationWorld v2.4.1',
    'trans.initial.text': 'Memulai ruang kerja berdaulat...',
    'trans.m1.title': 'Membangun Koneksi',
    'trans.m1.text': 'Memulai ruang kerja kreatif...',
    'trans.m2.title': 'Memuat Modul',
    'trans.m2.text': 'Menyiapkan alat pembangunan dunia...',
    'trans.m3.title': 'Menyinkronkan Registri',
    'trans.m3.text': 'Menghubungkan ke ledger global...',
    'trans.m4.title': 'Mengkalibrasi Konsol',
    'trans.m4.text': 'Mengoptimalkan tata letak dasbor...',
    'trans.m5.title': 'Hampir Siap',
    'trans.m5.text': 'Menyelesaikan izin ruang kerja...',
    'trans.ready.title': 'Selamat Datang, Sovereign',
    'trans.ready.text': 'Konsolmu sudah siap.'
  })
  // ═══ fr 法语 ═══
  .add('fr', {
    'trans.footer.console': 'Console M.NationWorld v2.4.1',
    'trans.initial.text': 'Initialisation de l\'espace de travail souverain...',
    'trans.m1.title': 'Établissement de la connexion',
    'trans.m1.text': 'Initialisation de l\'espace créatif...',
    'trans.m2.title': 'Chargement des modules',
    'trans.m2.text': 'Préparation des outils de création de mondes...',
    'trans.m3.title': 'Synchronisation du registre',
    'trans.m3.text': 'Connexion au registre mondial...',
    'trans.m4.title': 'Calibrage de la console',
    'trans.m4.text': 'Optimisation de la mise en page du tableau de bord...',
    'trans.m5.title': 'Presque prêt',
    'trans.m5.text': 'Finalisation des autorisations de l\'espace de travail...',
    'trans.ready.title': 'Bienvenue, Sovereign',
    'trans.ready.text': 'Votre console est prête.'
  })
  // ═══ es 西班牙语 ═══
  .add('es', {
    'trans.footer.console': 'Consola M.NationWorld v2.4.1',
    'trans.initial.text': 'Inicializando espacio de trabajo soberano...',
    'trans.m1.title': 'Estableciendo conexión',
    'trans.m1.text': 'Inicializando espacio de trabajo creativo...',
    'trans.m2.title': 'Cargando módulos',
    'trans.m2.text': 'Preparando herramientas de creación de mundos...',
    'trans.m3.title': 'Sincronizando registro',
    'trans.m3.text': 'Conectando con el libro mayor global...',
    'trans.m4.title': 'Calibrando consola',
    'trans.m4.text': 'Optimizando diseño del panel...',
    'trans.m5.title': 'Casi listo',
    'trans.m5.text': 'Finalizando permisos del espacio de trabajo...',
    'trans.ready.title': 'Bienvenido, Sovereign',
    'trans.ready.text': 'Tu consola está lista.'
  })
  // ═══ pt 葡萄牙语 ═══
  .add('pt', {
    'trans.footer.console': 'Console M.NationWorld v2.4.1',
    'trans.initial.text': 'Inicializando espaço de trabalho soberano...',
    'trans.m1.title': 'Estabelecendo conexão',
    'trans.m1.text': 'Inicializando espaço de trabalho criativo...',
    'trans.m2.title': 'Carregando módulos',
    'trans.m2.text': 'Preparando ferramentas de construção de mundos...',
    'trans.m3.title': 'Sincronizando registro',
    'trans.m3.text': 'Conectando ao livro-razão global...',
    'trans.m4.title': 'Calibrando console',
    'trans.m4.text': 'Otimizando o layout do painel...',
    'trans.m5.title': 'Quase pronto',
    'trans.m5.text': 'Finalizando permissões do espaço de trabalho...',
    'trans.ready.title': 'Bem-vindo, Sovereign',
    'trans.ready.text': 'Seu console está pronto.'
  });
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "trans.footer.console": "M.NationWorld 控制台 v2.4.1",
  "trans.initial.text": "正在初始化主權工作區...",
  "trans.m1.title": "正在建立連接",
  "trans.m1.text": "正在初始化創意工作區...",
  "trans.m2.title": "正在加載模塊",
  "trans.m2.text": "正在準備世界構建工具...",
  "trans.m3.title": "正在同步註冊庫",
  "trans.m3.text": "正在連接全球賬本...",
  "trans.m4.title": "正在校準控制台",
  "trans.m4.text": "正在優化儀表盤佈局...",
  "trans.m5.title": "即將就緒",
  "trans.m5.text": "正在完成工作區權限設置...",
  "trans.ready.title": "歡迎，Sovereign",
  "trans.ready.text": "你的控制台已就緒。"
});
