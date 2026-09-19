/**
 * create-topic-step-2.i18n.js — 创建话题向导第 2 步（Topic Branding）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld/MicroNationary/FluidCanvas/Slati Studio；
 *   货币数值不译：RM/MYR/XP）。
 * 页面原文为英文（Cancel/Info/Branding/Topic Avatar 等）——zh 值为中文翻译、fallback 英文保持
 *   （电池断言源码字面量安全，先例见 auth.i18n.js）；en 值 = 页面原文逐字节一致。
 *   JS 动态文案（visDesc 两条可见性说明，点击 Public/Private 切换）翻译在调用点 T('cts2.*')
 *   惰性取值（兜底英文原文），visDesc 首载/切语言重渲由 window.__mnI18nRerender 钩子按当前
 *   语言与当前 visibility 状态落文案。
 * 豁免清单：顶栏品牌词 M.NationWorld（含 img alt）不译不挂 data-i18n；Material Symbols 图标
 *   字形（check/add_a_photo/arrow_back/arrow_forward）与步骤序号（2/3）、颜色色板
 *   data-color 十六进制值不译；本页无 select/option、无 input placeholder、无示例数据。
 */
window.MN_I18N
  // ═══ zh 简体（默认；页面原文为英文，此处为中文翻译——fallback 英文保持，先例 auth.i18n.js）═══
  .add('zh', {
    'cts2.topbar.cancel': '取消',
    'cts2.steps.info': '信息',
    'cts2.steps.branding': '品牌',
    'cts2.steps.review': '确认',
    'cts2.hero.title': '话题品牌设计',
    'cts2.hero.subtitle': '第 2 步：自定义外观',
    'cts2.avatar.label': '话题头像',
    'cts2.avatar.upload': '上传图片',
    'cts2.color.label': '强调色',
    'cts2.visibility.label': '可见性',
    'cts2.visibility.public': '公开',
    'cts2.visibility.private': '私密',
    'cts2.visibility.publicDesc': '任何人都可以查看并加入该话题。',
    'cts2.visibility.privateDesc': '只有受邀成员可以查看该话题。',
    'cts2.nav.prev': '上一步',
    'cts2.nav.next': '前往确认'
  })
  // ═══ en 英语（值 = 页面原文逐字节一致）═══
  .add('en', {
    'cts2.topbar.cancel': 'Cancel',
    'cts2.steps.info': 'Info',
    'cts2.steps.branding': 'Branding',
    'cts2.steps.review': 'Review',
    'cts2.hero.title': 'Topic Branding',
    'cts2.hero.subtitle': 'Step 2: Customize the look',
    'cts2.avatar.label': 'Topic Avatar',
    'cts2.avatar.upload': 'Upload image',
    'cts2.color.label': 'Accent Color',
    'cts2.visibility.label': 'Visibility',
    'cts2.visibility.public': 'Public',
    'cts2.visibility.private': 'Private',
    'cts2.visibility.publicDesc': 'Anyone can view and join this topic.',
    'cts2.visibility.privateDesc': 'Only invited members can view this topic.',
    'cts2.nav.prev': 'Previous',
    'cts2.nav.next': 'Continue to Review'
  })
  // ═══ de 德语 ═══
  .add('de', {
    'cts2.topbar.cancel': 'Abbrechen',
    'cts2.steps.info': 'Info',
    'cts2.steps.branding': 'Branding',
    'cts2.steps.review': 'Überprüfen',
    'cts2.hero.title': 'Themen-Branding',
    'cts2.hero.subtitle': 'Schritt 2: Optik anpassen',
    'cts2.avatar.label': 'Themen-Avatar',
    'cts2.avatar.upload': 'Bild hochladen',
    'cts2.color.label': 'Akzentfarbe',
    'cts2.visibility.label': 'Sichtbarkeit',
    'cts2.visibility.public': 'Öffentlich',
    'cts2.visibility.private': 'Privat',
    'cts2.visibility.publicDesc': 'Jeder kann dieses Thema ansehen und ihm beitreten.',
    'cts2.visibility.privateDesc': 'Nur eingeladene Mitglieder können dieses Thema ansehen.',
    'cts2.nav.prev': 'Zurück',
    'cts2.nav.next': 'Weiter zur Überprüfung'
  })
  // ═══ ru 俄语 ═══
  .add('ru', {
    'cts2.topbar.cancel': 'Отмена',
    'cts2.steps.info': 'Инфо',
    'cts2.steps.branding': 'Оформление',
    'cts2.steps.review': 'Проверка',
    'cts2.hero.title': 'Оформление темы',
    'cts2.hero.subtitle': 'Шаг 2: Настройка внешнего вида',
    'cts2.avatar.label': 'Аватар темы',
    'cts2.avatar.upload': 'Загрузить изображение',
    'cts2.color.label': 'Акцентный цвет',
    'cts2.visibility.label': 'Видимость',
    'cts2.visibility.public': 'Публичная',
    'cts2.visibility.private': 'Приватная',
    'cts2.visibility.publicDesc': 'Любой может просматривать эту тему и присоединиться к ней.',
    'cts2.visibility.privateDesc': 'Только приглашённые участники могут просматривать эту тему.',
    'cts2.nav.prev': 'Назад',
    'cts2.nav.next': 'Перейти к проверке'
  })
  // ═══ ms 马来语 ═══
  .add('ms', {
    'cts2.topbar.cancel': 'Batal',
    'cts2.steps.info': 'Maklumat',
    'cts2.steps.branding': 'Penjenamaan',
    'cts2.steps.review': 'Semak',
    'cts2.hero.title': 'Penjenamaan Topik',
    'cts2.hero.subtitle': 'Langkah 2: Sesuaikan rupa',
    'cts2.avatar.label': 'Avatar Topik',
    'cts2.avatar.upload': 'Muat naik imej',
    'cts2.color.label': 'Warna Aksen',
    'cts2.visibility.label': 'Keterlihatan',
    'cts2.visibility.public': 'Awam',
    'cts2.visibility.private': 'Peribadi',
    'cts2.visibility.publicDesc': 'Sesiapa sahaja boleh melihat dan menyertai topik ini.',
    'cts2.visibility.privateDesc': 'Hanya ahli yang dijemput boleh melihat topik ini.',
    'cts2.nav.prev': 'Sebelumnya',
    'cts2.nav.next': 'Teruskan ke Semakan'
  })
  // ═══ th 泰语 ═══
  .add('th', {
    'cts2.topbar.cancel': 'ยกเลิก',
    'cts2.steps.info': 'ข้อมูล',
    'cts2.steps.branding': 'การสร้างแบรนด์',
    'cts2.steps.review': 'ตรวจสอบ',
    'cts2.hero.title': 'การสร้างแบรนด์หัวข้อ',
    'cts2.hero.subtitle': 'ขั้นตอนที่ 2: ปรับแต่งรูปลักษณ์',
    'cts2.avatar.label': 'อวตารหัวข้อ',
    'cts2.avatar.upload': 'อัปโหลดรูปภาพ',
    'cts2.color.label': 'สีเน้น',
    'cts2.visibility.label': 'การมองเห็น',
    'cts2.visibility.public': 'สาธารณะ',
    'cts2.visibility.private': 'ส่วนตัว',
    'cts2.visibility.publicDesc': 'ทุกคนสามารถดูและเข้าร่วมหัวข้อนี้ได้',
    'cts2.visibility.privateDesc': 'เฉพาะสมาชิกที่ได้รับเชิญเท่านั้นที่สามารถดูหัวข้อนี้ได้',
    'cts2.nav.prev': 'ก่อนหน้า',
    'cts2.nav.next': 'ไปยังการตรวจสอบ'
  })
  // ═══ vi 越南语 ═══
  .add('vi', {
    'cts2.topbar.cancel': 'Hủy',
    'cts2.steps.info': 'Thông tin',
    'cts2.steps.branding': 'Thương hiệu',
    'cts2.steps.review': 'Xem lại',
    'cts2.hero.title': 'Thương hiệu chủ đề',
    'cts2.hero.subtitle': 'Bước 2: Tùy chỉnh giao diện',
    'cts2.avatar.label': 'Ảnh đại diện chủ đề',
    'cts2.avatar.upload': 'Tải ảnh lên',
    'cts2.color.label': 'Màu nhấn',
    'cts2.visibility.label': 'Quyền xem',
    'cts2.visibility.public': 'Công khai',
    'cts2.visibility.private': 'Riêng tư',
    'cts2.visibility.publicDesc': 'Bất kỳ ai cũng có thể xem và tham gia chủ đề này.',
    'cts2.visibility.privateDesc': 'Chỉ thành viên được mời mới có thể xem chủ đề này.',
    'cts2.nav.prev': 'Trước',
    'cts2.nav.next': 'Tiếp tục để xem lại'
  })
  // ═══ id 印尼语 ═══
  .add('id', {
    'cts2.topbar.cancel': 'Batal',
    'cts2.steps.info': 'Info',
    'cts2.steps.branding': 'Pencitraan',
    'cts2.steps.review': 'Tinjau',
    'cts2.hero.title': 'Pencitraan Topik',
    'cts2.hero.subtitle': 'Langkah 2: Sesuaikan tampilan',
    'cts2.avatar.label': 'Avatar Topik',
    'cts2.avatar.upload': 'Unggah gambar',
    'cts2.color.label': 'Warna Aksen',
    'cts2.visibility.label': 'Visibilitas',
    'cts2.visibility.public': 'Publik',
    'cts2.visibility.private': 'Pribadi',
    'cts2.visibility.publicDesc': 'Siapa pun dapat melihat dan bergabung dengan topik ini.',
    'cts2.visibility.privateDesc': 'Hanya anggota yang diundang yang dapat melihat topik ini.',
    'cts2.nav.prev': 'Sebelumnya',
    'cts2.nav.next': 'Lanjut ke Tinjauan'
  })
  // ═══ fr 法语 ═══
  .add('fr', {
    'cts2.topbar.cancel': 'Annuler',
    'cts2.steps.info': 'Infos',
    'cts2.steps.branding': 'Identité',
    'cts2.steps.review': 'Vérification',
    'cts2.hero.title': 'Identité du sujet',
    'cts2.hero.subtitle': 'Étape 2 : Personnalisez l\'apparence',
    'cts2.avatar.label': 'Avatar du sujet',
    'cts2.avatar.upload': 'Importer une image',
    'cts2.color.label': 'Couleur d\'accent',
    'cts2.visibility.label': 'Visibilité',
    'cts2.visibility.public': 'Public',
    'cts2.visibility.private': 'Privé',
    'cts2.visibility.publicDesc': 'Tout le monde peut consulter et rejoindre ce sujet.',
    'cts2.visibility.privateDesc': 'Seuls les membres invités peuvent consulter ce sujet.',
    'cts2.nav.prev': 'Précédent',
    'cts2.nav.next': 'Passer à la vérification'
  })
  // ═══ es 西班牙语 ═══
  .add('es', {
    'cts2.topbar.cancel': 'Cancelar',
    'cts2.steps.info': 'Información',
    'cts2.steps.branding': 'Marca',
    'cts2.steps.review': 'Revisar',
    'cts2.hero.title': 'Marca del tema',
    'cts2.hero.subtitle': 'Paso 2: Personaliza el aspecto',
    'cts2.avatar.label': 'Avatar del tema',
    'cts2.avatar.upload': 'Subir imagen',
    'cts2.color.label': 'Color de acento',
    'cts2.visibility.label': 'Visibilidad',
    'cts2.visibility.public': 'Público',
    'cts2.visibility.private': 'Privado',
    'cts2.visibility.publicDesc': 'Cualquiera puede ver y unirse a este tema.',
    'cts2.visibility.privateDesc': 'Solo los miembros invitados pueden ver este tema.',
    'cts2.nav.prev': 'Anterior',
    'cts2.nav.next': 'Continuar a la revisión'
  })
  // ═══ pt 葡萄牙语 ═══
  .add('pt', {
    'cts2.topbar.cancel': 'Cancelar',
    'cts2.steps.info': 'Informação',
    'cts2.steps.branding': 'Marca',
    'cts2.steps.review': 'Revisar',
    'cts2.hero.title': 'Marca do tópico',
    'cts2.hero.subtitle': 'Passo 2: Personalize a aparência',
    'cts2.avatar.label': 'Avatar do tópico',
    'cts2.avatar.upload': 'Enviar imagem',
    'cts2.color.label': 'Cor de destaque',
    'cts2.visibility.label': 'Visibilidade',
    'cts2.visibility.public': 'Público',
    'cts2.visibility.private': 'Privado',
    'cts2.visibility.publicDesc': 'Qualquer pessoa pode ver e participar deste tópico.',
    'cts2.visibility.privateDesc': 'Apenas membros convidados podem ver este tópico.',
    'cts2.nav.prev': 'Anterior',
    'cts2.nav.next': 'Continuar para revisão'
  });
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "cts2.topbar.cancel": "取消",
  "cts2.steps.info": "信息",
  "cts2.steps.branding": "品牌",
  "cts2.steps.review": "確認",
  "cts2.hero.title": "話題品牌設計",
  "cts2.hero.subtitle": "第 2 步：自定義外觀",
  "cts2.avatar.label": "話題頭像",
  "cts2.avatar.upload": "上傳圖片",
  "cts2.color.label": "強調色",
  "cts2.visibility.label": "可見性",
  "cts2.visibility.public": "公開",
  "cts2.visibility.private": "私密",
  "cts2.visibility.publicDesc": "任何人都可以查看並加入該話題。",
  "cts2.visibility.privateDesc": "只有受邀成員可以查看該話題。",
  "cts2.nav.prev": "上一步",
  "cts2.nav.next": "前往確認"
});
