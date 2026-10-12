/**
 * create-world.i18n.js — 创建世界选型页（pages/create-world.html）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld、MicroNationary、FluidCanvas、Slati Studio）。
 * 世界类型名豁免：WORLD_TYPES 的 key/label/en/emoji 均为数据值（URL ?type= 参数、
 * 入库记录、world-created 展示都吃原文）——不译、不进字典；本页类型卡渲染只用数据值，
 * 零 T() 调用点（T 辅助函数为将来 tagline/描述字段预留）。
 * 本页壳层（h1/状态行）为英文原文——zh 值为中文翻译、fallback 英文保持（auth.i18n.js 先例）；
 * 电池零英文文本断言（已 grep 全库 tmp-battery-*）。副标题原文即中文，zh 照抄原文。
 * 纪律：必须包含 en 字典（v0.2.54.0 用户钦定加英语）。
 */
window.MN_I18N
  // ═══ zh 简体（壳层英文原文→zh 中文翻译，auth 先例）═══
  .add('zh', {
    // ── 头部 ──
    'cwr.title': '创建世界',
    'cwr.sub': '选择你要创建的世界类型 —— 每一种类型都有专属的创建流程',
    // ── 状态行 ──
    'cwr.status': '创建引擎：在线 · 8 种国家类型可用'
  })
  // ═══ en 英语（v0.2.54.0 用户钦定加英语）═══
  .add('en', {
    'cwr.title': 'Create World',
    'cwr.sub': 'Choose the type of world you want to create — each type has its own dedicated creation flow',
    'cwr.status': 'Creation Engine: Online · 8 nation types available'
  })
  // ═══ de 德语 ═══
  .add('de', {
    'cwr.title': 'Welt erstellen',
    'cwr.sub': 'Wähle den Typ der Welt aus, die du erschaffen möchtest — jeder Typ hat seinen eigenen Erstellungsablauf',
    'cwr.status': 'Erstellungs-Engine: Online · 8 Nationstypen verfügbar'
  })
  // ═══ ru 俄语 ═══
  .add('ru', {
    'cwr.title': 'Создать мир',
    'cwr.sub': 'Выберите тип мира, который хотите создать, — для каждого типа предусмотрен собственный процесс создания',
    'cwr.status': 'Движок создания: в сети · доступно 8 типов государств'
  })
  // ═══ ms 马来语 ═══
  .add('ms', {
    'cwr.title': 'Cipta Dunia',
    'cwr.sub': 'Pilih jenis dunia yang ingin anda cipta — setiap jenis mempunyai aliran penciptaan tersendiri',
    'cwr.status': 'Enjin Penciptaan: Dalam Talian · 8 jenis negara tersedia'
  })
  // ═══ th 泰语 ═══
  .add('th', {
    'cwr.title': 'สร้างโลก',
    'cwr.sub': 'เลือกประเภทของโลกที่คุณต้องการสร้าง — แต่ละประเภทมีขั้นตอนการสร้างเฉพาะของตัวเอง',
    'cwr.status': 'เอ็นจิ้นการสร้าง: ออนไลน์ · มีประเภทประเทศให้เลือก 8 ประเภท'
  })
  // ═══ vi 越南语 ═══
  .add('vi', {
    'cwr.title': 'Tạo Thế Giới',
    'cwr.sub': 'Chọn loại thế giới bạn muốn tạo — mỗi loại đều có quy trình tạo riêng',
    'cwr.status': 'Công cụ tạo: Trực tuyến · có 8 loại quốc gia'
  })
  // ═══ id 印尼语 ═══
  .add('id', {
    'cwr.title': 'Buat Dunia',
    'cwr.sub': 'Pilih jenis dunia yang ingin kamu buat — setiap jenis memiliki alur pembuatan khususnya sendiri',
    'cwr.status': 'Mesin Kreasi: Online · 8 jenis negara tersedia'
  })
  // ═══ fr 法语 ═══
  .add('fr', {
    'cwr.title': 'Créer un monde',
    'cwr.sub': 'Choisissez le type de monde que vous souhaitez créer — chaque type possède son propre processus de création',
    'cwr.status': 'Moteur de création : en ligne · 8 types de nation disponibles'
  })
  // ═══ es 西班牙语 ═══
  .add('es', {
    'cwr.title': 'Crear Mundo',
    'cwr.sub': 'Elige el tipo de mundo que quieres crear — cada tipo tiene su propio flujo de creación',
    'cwr.status': 'Motor de creación: En línea · 8 tipos de nación disponibles'
  })
  // ═══ pt 葡萄牙语 ═══
  .add('pt', {
    'cwr.title': 'Criar Mundo',
    'cwr.sub': 'Escolha o tipo de mundo que deseja criar — cada tipo tem seu próprio fluxo de criação',
    'cwr.status': 'Motor de criação: Online · 8 tipos de nação disponíveis'
  });
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "cwr.title": "創建世界",
  "cwr.sub": "選擇你要創建的世界類型 —— 每一種類型都有專屬的創建流程",
  "cwr.status": "創建引擎：在線 · 8 種國家類型可用"
});
