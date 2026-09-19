/**
 * world-created.i18n.js — 创建成功页（pages/world-created.html）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld、MicroNationary、FluidCanvas、Slati Studio；
 *   货币/数值不译：RM、MYR、XP）。
 * 页面正文为中英混排——英文装饰文案（badge/processing/bypass/protocol/complete）
 *   zh/en 值逐字节=页面原文，其余语言自然翻译。
 * 记录数据不译：世界名/类型名（world.typeLabel）/emoji/lore 片段（SlatiDB 草稿动态值，
 *   渲染时拼接）——不进字典。
 * 动态元素（#worldTitle/#worldDesc/processing 完成行由 JS 写入）不挂 data-i18n，
 *   走惰性 T() 键 wcr.js.* / wcr.hero.*，重渲由 body 尾部三件套 + window.__mnI18nRerender 钩子驱动。
 * 纪律：必须包含 en 字典（v0.2.54.0 用户钦定加英语）。
 */
window.MN_I18N
  // ═══ zh 简体（默认；值与页面原文逐字节一致——电池中文断言依赖）═══
  .add('zh', {
    // ── 静态节点（data-i18n）──
    'wcr.badge': 'WORLD ENTRY ARCHIVED',
    'wcr.processing.init': 'Finalizing archive entry...',
    'wcr.cta.goDashboard': '前往控制台',
    'wcr.cta.createAnother': '再创建一个',
    'wcr.footer.bypass': 'Bypass to Dashboard',
    'wcr.footer.protocol': 'Archive Protocol v1.0',

    // ── JS 动态文案（惰性 T() 键；无草稿兜底分支 + 拼接片段）──
    'wcr.hero.title': '世界创建成功',
    'wcr.hero.desc': '你的世界已收录进 M.NationWorld 世界档案。',
    'wcr.js.established': ' — 已建立',
    'wcr.js.type': '类型：',
    'wcr.js.archived': ' · 已收录进 M.NationWorld 世界档案。',
    'wcr.js.complete': 'Archive entry complete'
  })
  // ═══ en 英语（v0.2.54.0 用户钦定加英语）═══
  .add('en', {
    'wcr.badge': 'WORLD ENTRY ARCHIVED',
    'wcr.processing.init': 'Finalizing archive entry...',
    'wcr.cta.goDashboard': 'Go to Console',
    'wcr.cta.createAnother': 'Create Another',
    'wcr.footer.bypass': 'Bypass to Dashboard',
    'wcr.footer.protocol': 'Archive Protocol v1.0',
    'wcr.hero.title': 'World Created',
    'wcr.hero.desc': 'Your world has been archived into the M.NationWorld world archive.',
    'wcr.js.established': ' — established',
    'wcr.js.type': 'Type: ',
    'wcr.js.archived': ' · archived into the M.NationWorld world archive.',
    'wcr.js.complete': 'Archive entry complete'
  })
  // ═══ de 德语 ═══
  .add('de', {
    'wcr.badge': 'WELTEINTRAG ARCHIVIERT',
    'wcr.processing.init': 'Archiveeintrag wird abgeschlossen...',
    'wcr.cta.goDashboard': 'Zur Konsole',
    'wcr.cta.createAnother': 'Weiteres erstellen',
    'wcr.footer.bypass': 'Direkt zum Dashboard',
    'wcr.footer.protocol': 'Archivprotokoll v1.0',
    'wcr.hero.title': 'Welt erstellt',
    'wcr.hero.desc': 'Deine Welt wurde ins M.NationWorld-Weltarchiv aufgenommen.',
    'wcr.js.established': ' — erstellt',
    'wcr.js.type': 'Typ: ',
    'wcr.js.archived': ' · ins M.NationWorld-Weltarchiv aufgenommen.',
    'wcr.js.complete': 'Archiveeintrag abgeschlossen'
  })
  // ═══ ru 俄语 ═══
  .add('ru', {
    'wcr.badge': 'МИР ДОБАВЛЕН В АРХИВ',
    'wcr.processing.init': 'Завершение записи в архиве...',
    'wcr.cta.goDashboard': 'Перейти в консоль',
    'wcr.cta.createAnother': 'Создать ещё один',
    'wcr.footer.bypass': 'Перейти напрямую на панель',
    'wcr.footer.protocol': 'Протокол архива v1.0',
    'wcr.hero.title': 'Мир создан',
    'wcr.hero.desc': 'Твой мир внесён в мировой архив M.NationWorld.',
    'wcr.js.established': ' — создан',
    'wcr.js.type': 'Тип: ',
    'wcr.js.archived': ' · внесён в мировой архив M.NationWorld.',
    'wcr.js.complete': 'Запись в архиве завершена'
  })
  // ═══ ms 马来语 ═══
  .add('ms', {
    'wcr.badge': 'ENTRI DUNIA DIARKIBKAN',
    'wcr.processing.init': 'Memuktamadkan entri arkib...',
    'wcr.cta.goDashboard': 'Ke Konsol',
    'wcr.cta.createAnother': 'Cipta Satu Lagi',
    'wcr.footer.bypass': 'Terus ke Papan Pemuka',
    'wcr.footer.protocol': 'Protokol Arkib v1.0',
    'wcr.hero.title': 'Dunia Dicipta',
    'wcr.hero.desc': 'Dunia anda telah dimasukkan ke dalam arkib dunia M.NationWorld.',
    'wcr.js.established': ' — telah ditubuhkan',
    'wcr.js.type': 'Jenis: ',
    'wcr.js.archived': ' · telah dimasukkan ke dalam arkib dunia M.NationWorld.',
    'wcr.js.complete': 'Entri arkib selesai'
  })
  // ═══ th 泰语 ═══
  .add('th', {
    'wcr.badge': 'บันทึกข้อมูลโลกเข้าคลังแล้ว',
    'wcr.processing.init': 'กำลังสรุปบันทึกข้อมูล...',
    'wcr.cta.goDashboard': 'ไปที่คอนโซล',
    'wcr.cta.createAnother': 'สร้างอีกอัน',
    'wcr.footer.bypass': 'ข้ามไปที่แดชบอร์ด',
    'wcr.footer.protocol': 'โปรโตคอลเก็บถาวร v1.0',
    'wcr.hero.title': 'สร้างโลกสำเร็จแล้ว',
    'wcr.hero.desc': 'โลกของคุณถูกบันทึกเข้าคลังโลกของ M.NationWorld แล้ว',
    'wcr.js.established': ' — ถูกสร้างขึ้นแล้ว',
    'wcr.js.type': 'ประเภท: ',
    'wcr.js.archived': ' · ถูกบันทึกเข้าคลังโลกของ M.NationWorld แล้ว',
    'wcr.js.complete': 'บันทึกข้อมูลเสร็จสมบูรณ์'
  })
  // ═══ vi 越南语 ═══
  .add('vi', {
    'wcr.badge': 'HỒ SƠ THẾ GIỚI ĐÃ LƯU TRỮ',
    'wcr.processing.init': 'Đang hoàn tất mục lưu trữ...',
    'wcr.cta.goDashboard': 'Đến Bảng điều khiển',
    'wcr.cta.createAnother': 'Tạo thế giới khác',
    'wcr.footer.bypass': 'Đến thẳng Bảng điều khiển',
    'wcr.footer.protocol': 'Giao thức lưu trữ v1.0',
    'wcr.hero.title': 'Thế giới đã được tạo',
    'wcr.hero.desc': 'Thế giới của bạn đã được đưa vào kho lưu trữ thế giới của M.NationWorld.',
    'wcr.js.established': ' — đã được tạo',
    'wcr.js.type': 'Loại: ',
    'wcr.js.archived': ' · đã được đưa vào kho lưu trữ thế giới của M.NationWorld.',
    'wcr.js.complete': 'Đã hoàn tất mục lưu trữ'
  })
  // ═══ id 印尼语 ═══
  .add('id', {
    'wcr.badge': 'ENTRI DUNIA DIARSIPKAN',
    'wcr.processing.init': 'Menyelesaikan entri arsip...',
    'wcr.cta.goDashboard': 'Ke Konsol',
    'wcr.cta.createAnother': 'Buat Lagi',
    'wcr.footer.bypass': 'Langsung ke Dasbor',
    'wcr.footer.protocol': 'Protokol Arsip v1.0',
    'wcr.hero.title': 'Dunia Dibuat',
    'wcr.hero.desc': 'Dunia Anda telah dimasukkan ke arsip dunia M.NationWorld.',
    'wcr.js.established': ' — telah dibuat',
    'wcr.js.type': 'Jenis: ',
    'wcr.js.archived': ' · telah dimasukkan ke arsip dunia M.NationWorld.',
    'wcr.js.complete': 'Entri arsip selesai'
  })
  // ═══ fr 法语 ═══
  .add('fr', {
    'wcr.badge': 'ENTRÉE MONDIALE ARCHIVÉE',
    'wcr.processing.init': 'Finalisation de l\'entrée d\'archive...',
    'wcr.cta.goDashboard': 'Aller à la console',
    'wcr.cta.createAnother': 'En créer un autre',
    'wcr.footer.bypass': 'Aller directement au tableau de bord',
    'wcr.footer.protocol': 'Protocole d\'archive v1.0',
    'wcr.hero.title': 'Monde créé',
    'wcr.hero.desc': 'Ton monde a été ajouté aux archives mondiales de M.NationWorld.',
    'wcr.js.established': ' — créé',
    'wcr.js.type': 'Type : ',
    'wcr.js.archived': ' · ajouté aux archives mondiales de M.NationWorld.',
    'wcr.js.complete': 'Entrée d\'archive terminée'
  })
  // ═══ es 西班牙语 ═══
  .add('es', {
    'wcr.badge': 'ENTRADA MUNDIAL ARCHIVADA',
    'wcr.processing.init': 'Finalizando la entrada de archivo...',
    'wcr.cta.goDashboard': 'Ir a la consola',
    'wcr.cta.createAnother': 'Crear otro',
    'wcr.footer.bypass': 'Ir directamente al panel',
    'wcr.footer.protocol': 'Protocolo de archivo v1.0',
    'wcr.hero.title': 'Mundo creado',
    'wcr.hero.desc': 'Tu mundo ha sido incorporado al archivo mundial de M.NationWorld.',
    'wcr.js.established': ' — creado',
    'wcr.js.type': 'Tipo: ',
    'wcr.js.archived': ' · incorporado al archivo mundial de M.NationWorld.',
    'wcr.js.complete': 'Entrada de archivo completada'
  })
  // ═══ pt 葡萄牙语 ═══
  .add('pt', {
    'wcr.badge': 'ENTRADA MUNDIAL ARQUIVADA',
    'wcr.processing.init': 'Finalizando a entrada de arquivo...',
    'wcr.cta.goDashboard': 'Ir para o console',
    'wcr.cta.createAnother': 'Criar outro',
    'wcr.footer.bypass': 'Ir direto ao painel',
    'wcr.footer.protocol': 'Protocolo de arquivo v1.0',
    'wcr.hero.title': 'Mundo criado',
    'wcr.hero.desc': 'Seu mundo foi adicionado ao arquivo mundial de M.NationWorld.',
    'wcr.js.established': ' — criado',
    'wcr.js.type': 'Tipo: ',
    'wcr.js.archived': ' · adicionado ao arquivo mundial de M.NationWorld.',
    'wcr.js.complete': 'Entrada de arquivo concluída'
  });
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "wcr.badge": "WORLD ENTRY ARCHIVED",
  "wcr.processing.init": "Finalizing archive entry...",
  "wcr.cta.goDashboard": "前往控制台",
  "wcr.cta.createAnother": "再創建一個",
  "wcr.footer.bypass": "Bypass to Dashboard",
  "wcr.footer.protocol": "Archive Protocol v1.0",
  "wcr.hero.title": "世界創建成功",
  "wcr.hero.desc": "你的世界已收錄進 M.NationWorld 世界檔案。",
  "wcr.js.established": " — 已建立",
  "wcr.js.type": "類型：",
  "wcr.js.archived": " · 已收錄進 M.NationWorld 世界檔案。",
  "wcr.js.complete": "Archive entry complete"
});
