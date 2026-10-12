/**
 * registry-step-1.i18n.js — 国家注册向导第一步（docs/pages/registry-step-1.html）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld）。
 * 页面原文为英文——zh 值为中文翻译、fallback 英文保持（电池断言源码字面量安全）。
 * 表单选项值豁免：五种 sovereign classification 分类名（Sovereign Nation / Colonial Territory /
 * Puppet State / Free Association / Protectorate）被 selectClass() 按字面读取、写入草稿、
 * registry-step-2 按值匹配 → 不译、不进词典、不挂 data-i18n。
 * 示例数据豁免：placeholder 内示例国家名（The Republic of Caledonia / Caledonia）不译，
 * 仅前缀 e.g. 按语言本地化；步骤圆点数字 1/2/3 不译。
 */
window.MN_I18N
  .add('zh', {
    'reg1.title': '建国登记处',
    'reg1.subtitle': '步骤 01 — 身份',
    'reg1.step.identity': '身份',
    'reg1.step.geopolitics': '地缘政治',
    'reg1.step.metrics': '宏观指标',
    'reg1.label.name': '国家官方名称',
    'reg1.label.moniker': '常用简称',
    'reg1.label.classification': '主权实体分类',
    'reg1.ph.classification': '选择分类',
    'reg1.ph.name': '例如：The Republic of Caledonia',
    'reg1.ph.moniker': '例如：Caledonia',
    'reg1.cancel': '取消',
    'reg1.next': '下一步：地缘政治',
    'reg1.status': '主权验证节点：在线',
    'reg1.err.name': '请输入国家官方名称',
    'reg1.err.moniker': '请输入常用简称',
    'reg1.err.classification': '请选择主权分类'
  })
  .add('en', {
    'reg1.title': 'National Incorporation Registry',
    'reg1.subtitle': 'Step 01 — Identity',
    'reg1.step.identity': 'Identity',
    'reg1.step.geopolitics': 'Geopolitics',
    'reg1.step.metrics': 'Macro Metrics',
    'reg1.label.name': 'Official Nation Name',
    'reg1.label.moniker': 'Common Moniker',
    'reg1.label.classification': 'Sovereign Entity Classification',
    'reg1.ph.classification': 'Select classification',
    'reg1.ph.name': 'e.g. The Republic of Caledonia',
    'reg1.ph.moniker': 'e.g. Caledonia',
    'reg1.cancel': 'Cancel',
    'reg1.next': 'Next Step: Geopolitics',
    'reg1.status': 'Sovereign Validation Node: Online',
    'reg1.err.name': 'Please enter an official nation name',
    'reg1.err.moniker': 'Please enter a common moniker',
    'reg1.err.classification': 'Please select a sovereign classification'
  })
  .add('de', {
    'reg1.title': 'Nationales Gründungsregister',
    'reg1.subtitle': 'Schritt 01 — Identität',
    'reg1.step.identity': 'Identität',
    'reg1.step.geopolitics': 'Geopolitik',
    'reg1.step.metrics': 'Makro-Kennzahlen',
    'reg1.label.name': 'Offizieller Staatsname',
    'reg1.label.moniker': 'Gebräuchlicher Kurzname',
    'reg1.label.classification': 'Klassifikation souveräner Entitäten',
    'reg1.ph.classification': 'Klassifikation auswählen',
    'reg1.ph.name': 'z. B. The Republic of Caledonia',
    'reg1.ph.moniker': 'z. B. Caledonia',
    'reg1.cancel': 'Abbrechen',
    'reg1.next': 'Nächster Schritt: Geopolitik',
    'reg1.status': 'Souveräner Validierungsknoten: Online',
    'reg1.err.name': 'Bitte gib einen offiziellen Staatsnamen ein',
    'reg1.err.moniker': 'Bitte gib einen gebräuchlichen Kurznamen ein',
    'reg1.err.classification': 'Bitte wähle eine souveräne Klassifikation aus'
  })
  .add('ru', {
    'reg1.title': 'Национальный реестр регистрации государств',
    'reg1.subtitle': 'Шаг 01 — Идентичность',
    'reg1.step.identity': 'Идентичность',
    'reg1.step.geopolitics': 'Геополитика',
    'reg1.step.metrics': 'Макропоказатели',
    'reg1.label.name': 'Официальное название государства',
    'reg1.label.moniker': 'Общепринятое прозвище',
    'reg1.label.classification': 'Классификация суверенного образования',
    'reg1.ph.classification': 'Выберите классификацию',
    'reg1.ph.name': 'например: The Republic of Caledonia',
    'reg1.ph.moniker': 'например: Caledonia',
    'reg1.cancel': 'Отмена',
    'reg1.next': 'Следующий шаг: Геополитика',
    'reg1.status': 'Узел суверенной валидации: онлайн',
    'reg1.err.name': 'Пожалуйста, введите официальное название государства',
    'reg1.err.moniker': 'Пожалуйста, введите общепринятое прозвище',
    'reg1.err.classification': 'Пожалуйста, выберите классификацию суверенного образования'
  })
  .add('ms', {
    'reg1.title': 'Pendaftaran Penubuhan Negara',
    'reg1.subtitle': 'Langkah 01 — Identiti',
    'reg1.step.identity': 'Identiti',
    'reg1.step.geopolitics': 'Geopolitik',
    'reg1.step.metrics': 'Metrik Makro',
    'reg1.label.name': 'Nama Rasmi Negara',
    'reg1.label.moniker': 'Nama Panggilan Umum',
    'reg1.label.classification': 'Klasifikasi Entiti Berdaulat',
    'reg1.ph.classification': 'Pilih klasifikasi',
    'reg1.ph.name': 'cth: The Republic of Caledonia',
    'reg1.ph.moniker': 'cth: Caledonia',
    'reg1.cancel': 'Batal',
    'reg1.next': 'Langkah Seterusnya: Geopolitik',
    'reg1.status': 'Nod Pengesahan Berdaulat: Dalam Talian',
    'reg1.err.name': 'Sila masukkan nama rasmi negara',
    'reg1.err.moniker': 'Sila masukkan nama panggilan umum',
    'reg1.err.classification': 'Sila pilih klasifikasi berdaulat'
  })
  .add('th', {
    'reg1.title': 'ทะเบียนการสถาปนาประเทศ',
    'reg1.subtitle': 'ขั้นตอนที่ 01 — อัตลักษณ์',
    'reg1.step.identity': 'อัตลักษณ์',
    'reg1.step.geopolitics': 'ภูมิรัฐศาสตร์',
    'reg1.step.metrics': 'ตัวชี้วัดมหภาค',
    'reg1.label.name': 'ชื่อทางการของประเทศ',
    'reg1.label.moniker': 'ชื่อเรียกทั่วไป',
    'reg1.label.classification': 'การจำแนกประเภทหน่วยอธิปไตย',
    'reg1.ph.classification': 'เลือกการจำแนกประเภท',
    'reg1.ph.name': 'เช่น The Republic of Caledonia',
    'reg1.ph.moniker': 'เช่น Caledonia',
    'reg1.cancel': 'ยกเลิก',
    'reg1.next': 'ขั้นตอนถัดไป: ภูมิรัฐศาสตร์',
    'reg1.status': 'โหนดตรวจสอบอำนาจอธิปไตย: ออนไลน์',
    'reg1.err.name': 'กรุณากรอกชื่อทางการของประเทศ',
    'reg1.err.moniker': 'กรุณากรอกชื่อเรียกทั่วไป',
    'reg1.err.classification': 'กรุณาเลือกการจำแนกประเภทอธิปไตย'
  })
  .add('vi', {
    'reg1.title': 'Sổ đăng ký thành lập quốc gia',
    'reg1.subtitle': 'Bước 01 — Danh tính',
    'reg1.step.identity': 'Danh tính',
    'reg1.step.geopolitics': 'Địa chính trị',
    'reg1.step.metrics': 'Chỉ số vĩ mô',
    'reg1.label.name': 'Tên quốc gia chính thức',
    'reg1.label.moniker': 'Tên gọi phổ biến',
    'reg1.label.classification': 'Phân loại thực thể có chủ quyền',
    'reg1.ph.classification': 'Chọn phân loại',
    'reg1.ph.name': 'VD: The Republic of Caledonia',
    'reg1.ph.moniker': 'VD: Caledonia',
    'reg1.cancel': 'Hủy',
    'reg1.next': 'Bước tiếp theo: Địa chính trị',
    'reg1.status': 'Nút xác thực chủ quyền: Trực tuyến',
    'reg1.err.name': 'Vui lòng nhập tên quốc gia chính thức',
    'reg1.err.moniker': 'Vui lòng nhập tên gọi phổ biến',
    'reg1.err.classification': 'Vui lòng chọn phân loại có chủ quyền'
  })
  .add('id', {
    'reg1.title': 'Registrasi Pendirian Negara',
    'reg1.subtitle': 'Langkah 01 — Identitas',
    'reg1.step.identity': 'Identitas',
    'reg1.step.geopolitics': 'Geopolitik',
    'reg1.step.metrics': 'Metrik Makro',
    'reg1.label.name': 'Nama Resmi Negara',
    'reg1.label.moniker': 'Julukan Umum',
    'reg1.label.classification': 'Klasifikasi Entitas Berdaulat',
    'reg1.ph.classification': 'Pilih klasifikasi',
    'reg1.ph.name': 'mis. The Republic of Caledonia',
    'reg1.ph.moniker': 'mis. Caledonia',
    'reg1.cancel': 'Batal',
    'reg1.next': 'Langkah Berikutnya: Geopolitik',
    'reg1.status': 'Node Validasi Kedaulatan: Online',
    'reg1.err.name': 'Harap masukkan nama resmi negara',
    'reg1.err.moniker': 'Harap masukkan julukan umum',
    'reg1.err.classification': 'Harap pilih klasifikasi berdaulat'
  })
  .add('fr', {
    'reg1.title': 'Registre national de création d\'États',
    'reg1.subtitle': 'Étape 01 — Identité',
    'reg1.step.identity': 'Identité',
    'reg1.step.geopolitics': 'Géopolitique',
    'reg1.step.metrics': 'Indicateurs macro',
    'reg1.label.name': 'Nom officiel de la nation',
    'reg1.label.moniker': 'Surnom courant',
    'reg1.label.classification': 'Classification de l\'entité souveraine',
    'reg1.ph.classification': 'Sélectionner la classification',
    'reg1.ph.name': 'p. ex. The Republic of Caledonia',
    'reg1.ph.moniker': 'p. ex. Caledonia',
    'reg1.cancel': 'Annuler',
    'reg1.next': 'Étape suivante : Géopolitique',
    'reg1.status': 'Nœud de validation souverain : En ligne',
    'reg1.err.name': 'Veuillez saisir le nom officiel de la nation',
    'reg1.err.moniker': 'Veuillez saisir un surnom courant',
    'reg1.err.classification': 'Veuillez sélectionner une classification souveraine'
  })
  .add('es', {
    'reg1.title': 'Registro Nacional de Incorporación',
    'reg1.subtitle': 'Paso 01 — Identidad',
    'reg1.step.identity': 'Identidad',
    'reg1.step.geopolitics': 'Geopolítica',
    'reg1.step.metrics': 'Métricas macro',
    'reg1.label.name': 'Nombre oficial de la nación',
    'reg1.label.moniker': 'Apodo común',
    'reg1.label.classification': 'Clasificación de la entidad soberana',
    'reg1.ph.classification': 'Seleccionar clasificación',
    'reg1.ph.name': 'p. ej. The Republic of Caledonia',
    'reg1.ph.moniker': 'p. ej. Caledonia',
    'reg1.cancel': 'Cancelar',
    'reg1.next': 'Siguiente paso: Geopolítica',
    'reg1.status': 'Nodo de validación soberana: En línea',
    'reg1.err.name': 'Introduce el nombre oficial de la nación',
    'reg1.err.moniker': 'Introduce un apodo común',
    'reg1.err.classification': 'Selecciona una clasificación soberana'
  })
  .add('pt', {
    'reg1.title': 'Registro Nacional de Incorporação',
    'reg1.subtitle': 'Etapa 01 — Identidade',
    'reg1.step.identity': 'Identidade',
    'reg1.step.geopolitics': 'Geopolítica',
    'reg1.step.metrics': 'Métricas macro',
    'reg1.label.name': 'Nome oficial da nação',
    'reg1.label.moniker': 'Apelido comum',
    'reg1.label.classification': 'Classificação da entidade soberana',
    'reg1.ph.classification': 'Selecionar classificação',
    'reg1.ph.name': 'ex. The Republic of Caledonia',
    'reg1.ph.moniker': 'ex. Caledonia',
    'reg1.cancel': 'Cancelar',
    'reg1.next': 'Próxima etapa: Geopolítica',
    'reg1.status': 'Nó de validação soberana: Online',
    'reg1.err.name': 'Insira o nome oficial da nação',
    'reg1.err.moniker': 'Insira um apelido comum',
    'reg1.err.classification': 'Selecione uma classificação soberana'
  });
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "reg1.title": "建國登記處",
  "reg1.subtitle": "步驟 01 — 身份",
  "reg1.step.identity": "身份",
  "reg1.step.geopolitics": "地緣政治",
  "reg1.step.metrics": "宏觀指標",
  "reg1.label.name": "國家官方名稱",
  "reg1.label.moniker": "常用簡稱",
  "reg1.label.classification": "主權實體分類",
  "reg1.ph.classification": "選擇分類",
  "reg1.ph.name": "例如：The Republic of Caledonia",
  "reg1.ph.moniker": "例如：Caledonia",
  "reg1.cancel": "取消",
  "reg1.next": "下一步：地緣政治",
  "reg1.status": "主權驗證節點：在線",
  "reg1.err.name": "請輸入國家官方名稱",
  "reg1.err.moniker": "請輸入常用簡稱",
  "reg1.err.classification": "請選擇主權分類"
});

/* v0.2.59.15 主权实体分类翻译：五种分类名的「显示值」随语言翻译；草稿/后端仍存英文原值
   （Sovereign Nation / Colonial Territory / Puppet State / Free Association / Protectorate），
   registry-step-2 按原值匹配不变。追加合并块（add 会 merge 进各语言词典）。 */
window.MN_I18N
  .add('zh', {
    'reg1.class.sovereign': '主权国家',
    'reg1.class.colonial': '殖民领土',
    'reg1.class.puppet': '傀儡国家',
    'reg1.class.free': '自由联合',
    'reg1.class.protectorate': '保护国'
  })
  .add('en', {
    'reg1.class.sovereign': 'Sovereign Nation',
    'reg1.class.colonial': 'Colonial Territory',
    'reg1.class.puppet': 'Puppet State',
    'reg1.class.free': 'Free Association',
    'reg1.class.protectorate': 'Protectorate'
  })
  .add('de', {
    'reg1.class.sovereign': 'Souveräner Staat',
    'reg1.class.colonial': 'Kolonialgebiet',
    'reg1.class.puppet': 'Marionettenstaat',
    'reg1.class.free': 'Freie Assoziation',
    'reg1.class.protectorate': 'Protektorat'
  })
  .add('ru', {
    'reg1.class.sovereign': 'Суверенное государство',
    'reg1.class.colonial': 'Колониальная территория',
    'reg1.class.puppet': 'Марионеточное государство',
    'reg1.class.free': 'Свободная ассоциация',
    'reg1.class.protectorate': 'Протекторат'
  })
  .add('ms', {
    'reg1.class.sovereign': 'Negara Berdaulat',
    'reg1.class.colonial': 'Wilayah Kolonial',
    'reg1.class.puppet': 'Negara Boneka',
    'reg1.class.free': 'Persatuan Bebas',
    'reg1.class.protectorate': 'Negeri Naungan'
  })
  .add('th', {
    'reg1.class.sovereign': 'รัฐเอกราช',
    'reg1.class.colonial': 'ดินแดนอาณานิคม',
    'reg1.class.puppet': 'รัฐหุ่นเชิด',
    'reg1.class.free': 'สมาคมอิสระ',
    'reg1.class.protectorate': 'รัฐในอารักขา'
  })
  .add('vi', {
    'reg1.class.sovereign': 'Quốc gia có chủ quyền',
    'reg1.class.colonial': 'Lãnh thổ thuộc địa',
    'reg1.class.puppet': 'Quốc gia bù nhìn',
    'reg1.class.free': 'Liên kết tự do',
    'reg1.class.protectorate': 'Xứ bảo hộ'
  })
  .add('id', {
    'reg1.class.sovereign': 'Negara Berdaulat',
    'reg1.class.colonial': 'Wilayah Kolonial',
    'reg1.class.puppet': 'Negara Boneka',
    'reg1.class.free': 'Asosiasi Bebas',
    'reg1.class.protectorate': 'Protektorat'
  })
  .add('fr', {
    'reg1.class.sovereign': 'Nation souveraine',
    'reg1.class.colonial': 'Territoire colonial',
    'reg1.class.puppet': 'État fantoche',
    'reg1.class.free': 'Libre association',
    'reg1.class.protectorate': 'Protectorat'
  })
  .add('es', {
    'reg1.class.sovereign': 'Nación soberana',
    'reg1.class.colonial': 'Territorio colonial',
    'reg1.class.puppet': 'Estado títere',
    'reg1.class.free': 'Libre asociación',
    'reg1.class.protectorate': 'Protectorado'
  })
  .add('pt', {
    'reg1.class.sovereign': 'Nação soberana',
    'reg1.class.colonial': 'Território colonial',
    'reg1.class.puppet': 'Estado fantoche',
    'reg1.class.free': 'Livre associação',
    'reg1.class.protectorate': 'Protetorado'
  })
  .add('zh-Hant', {
    'reg1.class.sovereign': '主權國家',
    'reg1.class.colonial': '殖民領土',
    'reg1.class.puppet': '傀儡國家',
    'reg1.class.free': '自由聯合',
    'reg1.class.protectorate': '保護國'
  });
