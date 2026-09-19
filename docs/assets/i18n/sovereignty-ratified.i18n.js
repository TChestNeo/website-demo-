/**
 * sovereignty-ratified.i18n.js — 主权批准页（pages/sovereignty-ratified.html）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld、MicroNationary、FluidCanvas、Slati Studio；
 *   货币/数值不译：RM、MYR、XP）。
 * 页面原文为英文——en 值逐字节=页面原文（电池断言源码字面量安全）、zh 值为中文翻译
 *   （auth.i18n.js 同口径），其余语言自然翻译。
 * 示例数据不译：nation.name / classification / capital（草稿动态值，渲染时拼接）、版本号 v2.4.1。
 * 动态文案（nationTitle/nationDesc/protocolDoneMsg 由 JS 写入）走惰性 T() 键 sov.hero.* / sov.js.*，
 *   重渲由 body 尾部三件套 + window.__mnI18nRerender 钩子驱动。
 * 纪律：必须包含 en 字典（v0.2.54.0 用户钦定加英语）。
 */
window.MN_I18N
  // ═══ zh 简体（默认；本页原文为英文——zh 值为中文翻译，auth.i18n.js 同口径）═══
  .add('zh', {
    // ── 静态节点（data-i18n）──
    'sov.badge.ledger': '账本交易已验证',
    'sov.processing.init': '正在完成协议初始化…',
    'sov.cta.overview': '前往总览',
    'sov.footer.bypass': '直接前往仪表盘',
    'sov.footer.terms': '建国条款 v2.4.1',

    // ── JS 动态文案（惰性 T() 键）──
    'sov.hero.title': '主权已成功批准',
    'sov.hero.desc': '你的国家 Wiki 词条已自动生成，其外交席位现已在 M.NationWorld 注册库中生效。',
    'sov.js.suffixRatified': ' — 已批准',
    'sov.js.classification': '分类：',
    'sov.js.capital': ' · 首都：',
    'sov.js.wikiGenerated': ' · 你的国家 Wiki 已生成，其外交席位现已生效。',
    'sov.js.processingComplete': '协议初始化完成'
  })
  // ═══ en 英语（页面原文；值逐字节=原文——电池断言源码字面量安全）═══
  .add('en', {
    'sov.badge.ledger': 'LEDGER TRANSACTION VERIFIED',
    'sov.processing.init': 'Finalizing protocol initialization...',
    'sov.cta.overview': 'Proceed to Overview',
    'sov.footer.bypass': 'Bypass to Dashboard',
    'sov.footer.terms': 'Terms of Incorporation v2.4.1',
    'sov.hero.title': 'Sovereignty Successfully Ratified',
    'sov.hero.desc': 'Your nation\'s Wiki article has been automatically generated and its diplomatic presence is now active in the M.NationWorld registry.',
    'sov.js.suffixRatified': ' — Ratified',
    'sov.js.classification': 'Classification: ',
    'sov.js.capital': ' · Capital: ',
    'sov.js.wikiGenerated': ' · Your nation\'s Wiki has been generated and its diplomatic presence is now active.',
    'sov.js.processingComplete': 'Protocol initialization complete'
  })
  // ═══ de 德语 ═══
  .add('de', {
    'sov.badge.ledger': 'LEDGERTRANSAKTION VERIFIZIERT',
    'sov.processing.init': 'Protokollinitialisierung wird abgeschlossen...',
    'sov.cta.overview': 'Zur Übersicht',
    'sov.footer.bypass': 'Direkt zum Dashboard',
    'sov.footer.terms': 'Gründungsbedingungen v2.4.1',
    'sov.hero.title': 'Souveränität erfolgreich ratifiziert',
    'sov.hero.desc': 'Der Wiki-Artikel deiner Nation wurde automatisch erstellt und ihre diplomatische Präsenz ist nun im M.NationWorld-Register aktiv.',
    'sov.js.suffixRatified': ' — Ratifiziert',
    'sov.js.classification': 'Klassifizierung: ',
    'sov.js.capital': ' · Hauptstadt: ',
    'sov.js.wikiGenerated': ' · Das Wiki deiner Nation wurde erstellt und ihre diplomatische Präsenz ist jetzt aktiv.',
    'sov.js.processingComplete': 'Protokollinitialisierung abgeschlossen'
  })
  // ═══ ru 俄语 ═══
  .add('ru', {
    'sov.badge.ledger': 'ТРАНЗАКЦИЯ РЕЕСТРА ПОДТВЕРЖДЕНА',
    'sov.processing.init': 'Завершение инициализации протокола...',
    'sov.cta.overview': 'Перейти к обзору',
    'sov.footer.bypass': 'Перейти напрямую на панель',
    'sov.footer.terms': 'Условия учреждения v2.4.1',
    'sov.hero.title': 'Суверенитет успешно ратифицирован',
    'sov.hero.desc': 'Статья вики твоей нации была создана автоматически, и её дипломатическое присутствие теперь активно в реестре M.NationWorld.',
    'sov.js.suffixRatified': ' — Ратифицировано',
    'sov.js.classification': 'Классификация: ',
    'sov.js.capital': ' · Столица: ',
    'sov.js.wikiGenerated': ' · Вики твоей нации создана, и её дипломатическое присутствие теперь активно.',
    'sov.js.processingComplete': 'Инициализация протокола завершена'
  })
  // ═══ ms 马来语 ═══
  .add('ms', {
    'sov.badge.ledger': 'TRANSAKSI LEJER DISAHKAN',
    'sov.processing.init': 'Memuktamadkan permulaan protokol...',
    'sov.cta.overview': 'Terus ke Gambaran Keseluruhan',
    'sov.footer.bypass': 'Terus ke Papan Pemuka',
    'sov.footer.terms': 'Syarat Penubuhan v2.4.1',
    'sov.hero.title': 'Kedaulatan Berjaya Diratifikasi',
    'sov.hero.desc': 'Artikel Wiki negara anda telah dijana secara automatik dan kehadiran diplomatiknya kini aktif dalam pendaftaran M.NationWorld.',
    'sov.js.suffixRatified': ' — Diratifikasi',
    'sov.js.classification': 'Pengelasan: ',
    'sov.js.capital': ' · Ibu kota: ',
    'sov.js.wikiGenerated': ' · Wiki negara anda telah dijana dan kehadiran diplomatiknya kini aktif.',
    'sov.js.processingComplete': 'Permulaan protokol selesai'
  })
  // ═══ th 泰语 ═══
  .add('th', {
    'sov.badge.ledger': 'ยืนยันธุรกรรมบัญชีแยกประเภทแล้ว',
    'sov.processing.init': 'กำลังสรุปการเริ่มต้นโปรโตคอล...',
    'sov.cta.overview': 'ไปที่ภาพรวม',
    'sov.footer.bypass': 'ข้ามไปยังแดชบอร์ด',
    'sov.footer.terms': 'ข้อกำหนดการจัดตั้ง v2.4.1',
    'sov.hero.title': 'อำนาจอธิปไตยได้รับการให้สัตยาบันแล้ว',
    'sov.hero.desc': 'บทความวิกิของชาติของคุณถูกสร้างขึ้นโดยอัตโนมัติ และสถานะทางการทูตของชาตินั้นเปิดใช้งานแล้วในทะเบียน M.NationWorld',
    'sov.js.suffixRatified': ' — ได้รับการให้สัตยาบัน',
    'sov.js.classification': 'การจัดประเภท: ',
    'sov.js.capital': ' · เมืองหลวง: ',
    'sov.js.wikiGenerated': ' · วิกิของชาติคุณถูกสร้างขึ้นแล้ว และสถานะทางการทูตของชาตินั้นเปิดใช้งานแล้ว',
    'sov.js.processingComplete': 'การเริ่มต้นโปรโตคอลเสร็จสมบูรณ์'
  })
  // ═══ vi 越南语 ═══
  .add('vi', {
    'sov.badge.ledger': 'GIAO DỊCH SỔ CÁI ĐÃ XÁC MINH',
    'sov.processing.init': 'Đang hoàn tất khởi tạo giao thức...',
    'sov.cta.overview': 'Đi tới Tổng quan',
    'sov.footer.bypass': 'Bỏ qua, tới Bảng điều khiển',
    'sov.footer.terms': 'Điều khoản thành lập v2.4.1',
    'sov.hero.title': 'Chủ quyền đã được phê chuẩn thành công',
    'sov.hero.desc': 'Bài viết Wiki của quốc gia bạn đã được tạo tự động và sự hiện diện ngoại giao của quốc gia đó hiện đã hoạt động trong sổ đăng ký M.NationWorld.',
    'sov.js.suffixRatified': ' — Đã phê chuẩn',
    'sov.js.classification': 'Phân loại: ',
    'sov.js.capital': ' · Thủ đô: ',
    'sov.js.wikiGenerated': ' · Wiki của quốc gia bạn đã được tạo và sự hiện diện ngoại giao của quốc gia đó hiện đã hoạt động.',
    'sov.js.processingComplete': 'Khởi tạo giao thức hoàn tất'
  })
  // ═══ id 印尼语 ═══
  .add('id', {
    'sov.badge.ledger': 'TRANSAKSI BUKU BESAR TERVERIFIKASI',
    'sov.processing.init': 'Menyelesaikan inisialisasi protokol...',
    'sov.cta.overview': 'Lanjut ke Ikhtisar',
    'sov.footer.bypass': 'Lewati ke Dasbor',
    'sov.footer.terms': 'Ketentuan Pendirian v2.4.1',
    'sov.hero.title': 'Kedaulatan Berhasil Diratifikasi',
    'sov.hero.desc': 'Artikel Wiki negaramu telah dibuat secara otomatis dan kehadiran diplomatiknya kini aktif di registri M.NationWorld.',
    'sov.js.suffixRatified': ' — Diratifikasi',
    'sov.js.classification': 'Klasifikasi: ',
    'sov.js.capital': ' · Ibu kota: ',
    'sov.js.wikiGenerated': ' · Wiki negaramu telah dibuat dan kehadiran diplomatiknya kini aktif.',
    'sov.js.processingComplete': 'Inisialisasi protokol selesai'
  })
  // ═══ fr 法语 ═══
  .add('fr', {
    'sov.badge.ledger': 'TRANSACTION DE REGISTRE VÉRIFIÉE',
    'sov.processing.init': 'Finalisation de l\'initialisation du protocole...',
    'sov.cta.overview': 'Passer à l\'aperçu',
    'sov.footer.bypass': 'Accéder directement au tableau de bord',
    'sov.footer.terms': 'Conditions d\'incorporation v2.4.1',
    'sov.hero.title': 'Souveraineté ratifiée avec succès',
    'sov.hero.desc': 'L\'article Wiki de ta nation a été généré automatiquement et sa présence diplomatique est désormais active dans le registre M.NationWorld.',
    'sov.js.suffixRatified': ' — Ratifié',
    'sov.js.classification': 'Classification : ',
    'sov.js.capital': ' · Capitale : ',
    'sov.js.wikiGenerated': ' · Le Wiki de ta nation a été généré et sa présence diplomatique est désormais active.',
    'sov.js.processingComplete': 'Initialisation du protocole terminée'
  })
  // ═══ es 西班牙语 ═══
  .add('es', {
    'sov.badge.ledger': 'TRANSACCIÓN DE REGISTRO VERIFICADA',
    'sov.processing.init': 'Finalizando la inicialización del protocolo...',
    'sov.cta.overview': 'Ir al resumen',
    'sov.footer.bypass': 'Ir directamente al panel',
    'sov.footer.terms': 'Términos de incorporación v2.4.1',
    'sov.hero.title': 'Soberanía ratificada con éxito',
    'sov.hero.desc': 'El artículo Wiki de tu nación se ha generado automáticamente y su presencia diplomática ya está activa en el registro de M.NationWorld.',
    'sov.js.suffixRatified': ' — Ratificado',
    'sov.js.classification': 'Clasificación: ',
    'sov.js.capital': ' · Capital: ',
    'sov.js.wikiGenerated': ' · El Wiki de tu nación se ha generado y su presencia diplomática ya está activa.',
    'sov.js.processingComplete': 'Inicialización del protocolo completada'
  })
  // ═══ pt 葡萄牙语 ═══
  .add('pt', {
    'sov.badge.ledger': 'TRANSAÇÃO DE REGISTRO VERIFICADA',
    'sov.processing.init': 'Finalizando a inicialização do protocolo...',
    'sov.cta.overview': 'Ir para a visão geral',
    'sov.footer.bypass': 'Ir direto ao painel',
    'sov.footer.terms': 'Termos de incorporação v2.4.1',
    'sov.hero.title': 'Soberania ratificada com sucesso',
    'sov.hero.desc': 'O artigo Wiki da sua nação foi gerado automaticamente e sua presença diplomática já está ativa no registro da M.NationWorld.',
    'sov.js.suffixRatified': ' — Ratificado',
    'sov.js.classification': 'Classificação: ',
    'sov.js.capital': ' · Capital: ',
    'sov.js.wikiGenerated': ' · O Wiki da sua nação foi gerado e sua presença diplomática já está ativa.',
    'sov.js.processingComplete': 'Inicialização do protocolo concluída'
  });
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "sov.badge.ledger": "賬本交易已驗證",
  "sov.processing.init": "正在完成協議初始化…",
  "sov.cta.overview": "前往總覽",
  "sov.footer.bypass": "直接前往儀表盤",
  "sov.footer.terms": "建國條款 v2.4.1",
  "sov.hero.title": "主權已成功批准",
  "sov.hero.desc": "你的國家 Wiki 詞條已自動生成，其外交席位現已在 M.NationWorld 註冊庫中生效。",
  "sov.js.suffixRatified": " — 已批准",
  "sov.js.classification": "分類：",
  "sov.js.capital": " · 首都：",
  "sov.js.wikiGenerated": " · 你的國家 Wiki 已生成，其外交席位現已生效。",
  "sov.js.processingComplete": "協議初始化完成"
});
