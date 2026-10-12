// tmp-update-guidelines-i18n.js — 社区准则页按平台现状重写（12 语言词典值更新）
'use strict';
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'docs', 'assets', 'i18n', 'guidelines.i18n.js');
let s = fs.readFileSync(f, 'utf8');

// 每语言：old 行 → new 行（键不变，值按平台现状重写）
const LOCALES = {
  zh: {
    "'guidelines.badge.system': '系统逻辑'": "'guidelines.badge.system': '内容治理'",
    "'guidelines.card1.title': '通用数据结构'": "'guidelines.card1.title': '世界与创作数据结构'",
    "'guidelines.card1.body': '所有世界档案、外交关系与经济数据必须遵循 M.NationWorld 数据模式，以确保互操作性。'": "'guidelines.card1.body': '世界档案、文章与 FluidCanvas 草稿遵循统一数据结构，发布后可在 MicroNationary 全站检索与展示。'",
    "'guidelines.card1.item1': '模式已验证'": "'guidelines.card1.item1': '世界档案模式'",
    "'guidelines.card1.item2': '版本追踪'": "'guidelines.card1.item2': '文章模式'",
    "'guidelines.card1.item3': '审计留痕'": "'guidelines.card1.item3': '草稿版本追踪'",
    "'guidelines.card2.body': '尊重知识产权、注明协作者贡献，并在所有外交渠道中保持建设性交流。'": "'guidelines.card2.body': '尊重知识产权、注明协作者贡献，并在社区与消息渠道中保持建设性交流。'",
    "'guidelines.card3.title': '行为数据逻辑'": "'guidelines.card3.title': '内容治理与申诉'",
    "'guidelines.card3.body': '经济模拟、冲突解决与随机事件均遵循透明算法，所有结果均可审计。'": "'guidelines.card3.body': '所有公开内容经透明审核流程处置；违规行为按《社区规则》处理，处理决定可通过工单申诉。'",
    "'guidelines.card3.item1': '确定性规则'": "'guidelines.card3.item1': 'AI + 人工审核'",
    "'guidelines.card3.item2': '申诉流程'": "'guidelines.card3.item2': '社区规则执行'",
    "'guidelines.card3.item3': '公开更新日志'": "'guidelines.card3.item3': '工单申诉'"
  },
  en: {
    "'guidelines.badge.system': 'System Logic'": "'guidelines.badge.system': 'Content Governance'",
    "'guidelines.card1.title': 'Universal Data Structures'": "'guidelines.card1.title': 'World & Creation Schemas'",
    "'guidelines.card1.body': 'All world profiles, diplomatic relations, and economic data must follow the M.NationWorld schema to ensure interoperability.'": "'guidelines.card1.body': 'World profiles, articles, and FluidCanvas drafts follow unified data structures, so everything stays searchable and consistent across MicroNationary.'",
    "'guidelines.card1.item1': 'Validated schema'": "'guidelines.card1.item1': 'World profile schema'",
    "'guidelines.card1.item2': 'Version tracked'": "'guidelines.card1.item2': 'Article schema'",
    "'guidelines.card1.item3': 'Audit logged'": "'guidelines.card1.item3': 'Draft versioning'",
    "'guidelines.card2.body': 'Respect intellectual property, attribute collaborators, and maintain constructive discourse in all diplomatic channels.'": "'guidelines.card2.body': 'Respect intellectual property, attribute collaborators, and keep discussions constructive across the community and messaging channels.'",
    "'guidelines.card3.title': 'Behavioral Data Logic'": "'guidelines.card3.title': 'Content Governance & Appeals'",
    "'guidelines.card3.body': 'Economic simulations, conflict resolution, and random events follow transparent algorithms. All outcomes are auditable.'": "'guidelines.card3.body': 'All public content goes through transparent moderation. Violations are handled under the Community Rules, and every decision can be appealed via the ticket system.'",
    "'guidelines.card3.item1': 'Deterministic rules'": "'guidelines.card3.item1': 'AI + human review'",
    "'guidelines.card3.item2': 'Appeal process'": "'guidelines.card3.item2': 'Community Rules enforced'",
    "'guidelines.card3.item3': 'Public changelog'": "'guidelines.card3.item3': 'Ticket appeals'"
  },
  de: {
    "'guidelines.badge.system': 'Systemlogik'": "'guidelines.badge.system': 'Content-Governance'",
    "'guidelines.card1.title': 'Universelle Datenstrukturen'": "'guidelines.card1.title': 'Welt- & Kreationsschemata'",
    "'guidelines.card1.body': 'Alle Weltprofile, diplomatischen Beziehungen und Wirtschaftsdaten müssen dem M.NationWorld-Schema folgen, um Interoperabilität zu gewährleisten.'": "'guidelines.card1.body': 'Weltprofile, Artikel und FluidCanvas-Entwürfe folgen einheitlichen Datenstrukturen, damit alles in MicroNationary durchsuchbar und konsistent bleibt.'",
    "'guidelines.card1.item1': 'Schema validiert'": "'guidelines.card1.item1': 'Weltprofil-Schema'",
    "'guidelines.card1.item2': 'Versioniert'": "'guidelines.card1.item2': 'Artikel-Schema'",
    "'guidelines.card1.item3': 'Audit-Protokoll'": "'guidelines.card1.item3': 'Entwurfs-Versionierung'",
    "'guidelines.card2.body': 'Respektiere geistiges Eigentum, nenne Mitwirkende und pflege in allen diplomatischen Kanälen einen konstruktiven Austausch.'": "'guidelines.card2.body': 'Respektiere geistiges Eigentum, nenne Mitwirkende und pflege in den Community- und Nachrichtenkanälen einen konstruktiven Austausch.'",
    "'guidelines.card3.title': 'Verhaltensdaten-Logik'": "'guidelines.card3.title': 'Content-Governance & Einsprüche'",
    "'guidelines.card3.body': 'Wirtschaftssimulationen, Konfliktlösungen und Zufallsereignisse folgen transparenten Algorithmen. Alle Ergebnisse sind überprüfbar.'": "'guidelines.card3.body': 'Alle öffentlichen Inhalte durchlaufen transparente Moderation. Verstöße werden nach den Community Rules behandelt; Entscheidungen können per Ticket angefochten werden.'",
    "'guidelines.card3.item1': 'Deterministische Regeln'": "'guidelines.card3.item1': 'KI + menschliche Prüfung'",
    "'guidelines.card3.item2': 'Einspruchsverfahren'": "'guidelines.card3.item2': 'Community Rules durchgesetzt'",
    "'guidelines.card3.item3': 'Öffentliches Änderungsprotokoll'": "'guidelines.card3.item3': 'Ticket-Einsprüche'"
  },
  ru: {
    "'guidelines.badge.system': 'Логика системы'": "'guidelines.badge.system': 'Управление контентом'",
    "'guidelines.card1.title': 'Универсальные структуры данных'": "'guidelines.card1.title': 'Схемы миров и творчества'",
    "'guidelines.card1.body': 'Все профили миров, дипломатические отношения и экономические данные должны соответствовать схеме M.NationWorld для обеспечения совместимости.'": "'guidelines.card1.body': 'Профили миров, статьи и черновики FluidCanvas следуют единым структурам данных, поэтому всё доступно для поиска и единообразно в MicroNationary.'",
    "'guidelines.card1.item1': 'Проверенная схема'": "'guidelines.card1.item1': 'Схема профиля мира'",
    "'guidelines.card1.item2': 'Контроль версий'": "'guidelines.card1.item2': 'Схема статьи'",
    "'guidelines.card1.item3': 'Журнал аудита'": "'guidelines.card1.item3': 'Версионирование черновиков'",
    "'guidelines.card2.body': 'Уважайте интеллектуальную собственность, указывайте соавторов и поддерживайте конструктивное общение во всех дипломатических каналах.'": "'guidelines.card2.body': 'Уважайте интеллектуальную собственность, указывайте соавторов и поддерживайте конструктивное общение в каналах сообщества и сообщениях.'",
    "'guidelines.card3.title': 'Логика поведенческих данных'": "'guidelines.card3.title': 'Модерация и апелляции'",
    "'guidelines.card3.body': 'Экономические симуляции, разрешение конфликтов и случайные события следуют прозрачным алгоритмам. Все результаты поддаются аудиту.'": "'guidelines.card3.body': 'Весь публичный контент проходит прозрачную модерацию. Нарушения рассматриваются по Community Rules, решения можно обжаловать через тикеты.'",
    "'guidelines.card3.item1': 'Детерминированные правила'": "'guidelines.card3.item1': 'ИИ + проверка людьми'",
    "'guidelines.card3.item2': 'Процесс апелляции'": "'guidelines.card3.item2': 'Community Rules применяются'",
    "'guidelines.card3.item3': 'Публичный журнал изменений'": "'guidelines.card3.item3': 'Апелляции через тикеты'"
  },
  ms: {
    "'guidelines.badge.system': 'Logik Sistem'": "'guidelines.badge.system': 'Tadbir Urus Kandungan'",
    "'guidelines.card1.title': 'Struktur Data Sejagat'": "'guidelines.card1.title': 'Skema Dunia & Ciptaan'",
    "'guidelines.card1.body': 'Semua profil dunia, hubungan diplomatik dan data ekonomi mesti mengikut skema M.NationWorld untuk memastikan kesalingoperasian.'": "'guidelines.card1.body': 'Profil dunia, rencana dan draf FluidCanvas mengikut struktur data yang seragam, supaya semuanya kekal boleh dicari dan konsisten di MicroNationary.'",
    "'guidelines.card1.item1': 'Skema disahkan'": "'guidelines.card1.item1': 'Skema profil dunia'",
    "'guidelines.card1.item2': 'Versi dijejak'": "'guidelines.card1.item2': 'Skema rencana'",
    "'guidelines.card1.item3': 'Log audit'": "'guidelines.card1.item3': 'Versi draf'",
    "'guidelines.card2.body': 'Hormati harta intelek, berikan kredit kepada penyumbang dan kekalkan wacana yang membina dalam semua saluran diplomatik.'": "'guidelines.card2.body': 'Hormati harta intelek, berikan kredit kepada penyumbang dan kekalkan perbincangan yang membina dalam saluran komuniti dan mesej.'",
    "'guidelines.card3.title': 'Logik Data Tingkah Laku'": "'guidelines.card3.title': 'Tadbir Urus Kandungan & Rayuan'",
    "'guidelines.card3.body': 'Simulasi ekonomi, penyelesaian konflik dan peristiwa rawak mengikut algoritma yang telus. Semua hasil boleh diaudit.'": "'guidelines.card3.body': 'Semua kandungan awam melalui moderasi yang telus. Pelanggaran dikendalikan mengikut Community Rules, dan keputusan boleh dirayu melalui sistem tiket.'",
    "'guidelines.card3.item1': 'Peraturan deterministik'": "'guidelines.card3.item1': 'Semakan AI + manusia'",
    "'guidelines.card3.item2': 'Proses rayuan'": "'guidelines.card3.item2': 'Community Rules dikuatkuasakan'",
    "'guidelines.card3.item3': 'Log perubahan awam'": "'guidelines.card3.item3': 'Rayuan melalui tiket'"
  },
  th: {
    "'guidelines.badge.system': 'ตรรกะของระบบ'": "'guidelines.badge.system': 'การกำกับเนื้อหา'",
    "'guidelines.card1.title': 'โครงสร้างข้อมูลสากล'": "'guidelines.card1.title': 'โครงสร้างโลกและผลงาน'",
    "'guidelines.card1.body': 'โปรไฟล์โลก ความสัมพันธ์ทางการทูต และข้อมูลเศรษฐกิจทั้งหมดต้องเป็นไปตามโครงสร้างของ M.NationWorld เพื่อให้ใช้งานร่วมกันได้'": "'guidelines.card1.body': 'โปรไฟล์โลก บทความ และแบบร่าง FluidCanvas เป็นไปตามโครงสร้างข้อมูลที่เป็นหนึ่งเดียว ทำให้ทุกอย่างค้นหาได้และสม่ำเสมอทั่ว MicroNationary'",
    "'guidelines.card1.item1': 'โครงสร้างที่ผ่านการตรวจสอบ'": "'guidelines.card1.item1': 'โครงสร้างโปรไฟล์โลก'",
    "'guidelines.card1.item2': 'ติดตามเวอร์ชัน'": "'guidelines.card1.item2': 'โครงสร้างบทความ'",
    "'guidelines.card1.item3': 'บันทึกการตรวจสอบ'": "'guidelines.card1.item3': 'การติดตามเวอร์ชันแบบร่าง'",
    "'guidelines.card2.body': 'เคารพทรัพย์สินทางปัญญา ระบุผู้ร่วมสร้างสรรค์ และรักษาการสนทนาเชิงสร้างสรรค์ในทุกช่องทางการทูต'": "'guidelines.card2.body': 'เคารพทรัพย์สินทางปัญญา ระบุผู้ร่วมสร้างสรรค์ และรักษาการสนทนาเชิงสร้างสรรค์ในช่องทางชุมชนและข้อความ'",
    "'guidelines.card3.title': 'ตรรกะข้อมูลพฤติกรรม'": "'guidelines.card3.title': 'การกำกับเนื้อหาและการอุทธรณ์'",
    "'guidelines.card3.body': 'การจำลองเศรษฐกิจ การยุติความขัดแย้ง และเหตุการณ์สุ่มเป็นไปตามอัลกอริทึมที่โปร่งใส ผลลัพธ์ทั้งหมดตรวจสอบได้'": "'guidelines.card3.body': 'เนื้อหาสาธารณะทั้งหมดผ่านการดูแลที่โปร่งใส การละเมิดจะจัดการตาม Community Rules และสามารถอุทธรณ์คำตัดสินผ่านระบบตั๋ว'",
    "'guidelines.card3.item1': 'กฎแบบกำหนดได้'": "'guidelines.card3.item1': 'ตรวจสอบโดย AI + มนุษย์'",
    "'guidelines.card3.item2': 'กระบวนการอุทธรณ์'": "'guidelines.card3.item2': 'บังคับใช้ Community Rules'",
    "'guidelines.card3.item3': 'บันทึกการเปลี่ยนแปลงสาธารณะ'": "'guidelines.card3.item3': 'อุทธรณ์ผ่านตั๋ว'"
  },
  vi: {
    "'guidelines.badge.system': 'Logic hệ thống'": "'guidelines.badge.system': 'Quản trị nội dung'",
    "'guidelines.card1.title': 'Cấu trúc dữ liệu phổ quát'": "'guidelines.card1.title': 'Cấu trúc Thế giới & Sáng tạo'",
    "'guidelines.card1.body': 'Mọi hồ sơ thế giới, quan hệ ngoại giao và dữ liệu kinh tế phải tuân theo lược đồ M.NationWorld để đảm bảo khả năng tương tác.'": "'guidelines.card1.body': 'Hồ sơ thế giới, bài viết và bản nháp FluidCanvas theo cấu trúc dữ liệu thống nhất, để mọi thứ có thể tìm kiếm và nhất quán trên MicroNationary.'",
    "'guidelines.card1.item1': 'Lược đồ đã xác thực'": "'guidelines.card1.item1': 'Cấu trúc hồ sơ thế giới'",
    "'guidelines.card1.item2': 'Theo dõi phiên bản'": "'guidelines.card1.item2': 'Cấu trúc bài viết'",
    "'guidelines.card1.item3': 'Nhật ký kiểm toán'": "'guidelines.card1.item3': 'Theo dõi phiên bản nháp'",
    "'guidelines.card2.body': 'Tôn trọng tài sản trí tuệ, ghi công người cộng tác và duy trì đối thoại mang tính xây dựng trên mọi kênh ngoại giao.'": "'guidelines.card2.body': 'Tôn trọng tài sản trí tuệ, ghi công người cộng tác và giữ thảo luận mang tính xây dựng trên các kênh cộng đồng và tin nhắn.'",
    "'guidelines.card3.title': 'Logic dữ liệu hành vi'": "'guidelines.card3.title': 'Quản trị nội dung & Khiếu nại'",
    "'guidelines.card3.body': 'Mô phỏng kinh tế, giải quyết xung đột và sự kiện ngẫu nhiên tuân theo các thuật toán minh bạch. Mọi kết quả đều có thể kiểm toán.'": "'guidelines.card3.body': 'Mọi nội dung công khai đều qua kiểm duyệt minh bạch. Vi phạm được xử lý theo Community Rules và quyết định có thể khiếu nại qua hệ thống ticket.'",
    "'guidelines.card3.item1': 'Quy tắc xác định'": "'guidelines.card3.item1': 'AI + kiểm duyệt thủ công'",
    "'guidelines.card3.item2': 'Quy trình khiếu nại'": "'guidelines.card3.item2': 'Community Rules được thực thi'",
    "'guidelines.card3.item3': 'Nhật ký thay đổi công khai'": "'guidelines.card3.item3': 'Khiếu nại qua ticket'"
  },
  id: {
    "'guidelines.badge.system': 'Logika Sistem'": "'guidelines.badge.system': 'Tata Kelola Konten'",
    "'guidelines.card1.title': 'Struktur Data Universal'": "'guidelines.card1.title': 'Skema Dunia & Kreasi'",
    "'guidelines.card1.body': 'Semua profil dunia, hubungan diplomatik, dan data ekonomi harus mengikuti skema M.NationWorld untuk memastikan interoperabilitas.'": "'guidelines.card1.body': 'Profil dunia, artikel, dan draf FluidCanvas mengikuti struktur data terpadu, sehingga semuanya tetap dapat dicari dan konsisten di MicroNationary.'",
    "'guidelines.card1.item1': 'Skema tervalidasi'": "'guidelines.card1.item1': 'Skema profil dunia'",
    "'guidelines.card1.item2': 'Versi terlacak'": "'guidelines.card1.item2': 'Skema artikel'",
    "'guidelines.card1.item3': 'Log audit'": "'guidelines.card1.item3': 'Versi draf'",
    "'guidelines.card2.body': 'Hormati kekayaan intelektual, cantumkan kontributor, dan jaga diskusi yang konstruktif di semua saluran diplomatik.'": "'guidelines.card2.body': 'Hormati kekayaan intelektual, cantumkan kontributor, dan jaga diskusi tetap konstruktif di kanal komunitas dan pesan.'",
    "'guidelines.card3.title': 'Logika Data Perilaku'": "'guidelines.card3.title': 'Tata Kelola Konten & Banding'",
    "'guidelines.card3.body': 'Simulasi ekonomi, penyelesaian konflik, dan peristiwa acak mengikuti algoritma yang transparan. Semua hasil dapat diaudit.'": "'guidelines.card3.body': 'Semua konten publik melalui moderasi yang transparan. Pelanggaran ditangani sesuai Community Rules, dan keputusan dapat diajukan banding melalui sistem tiket.'",
    "'guidelines.card3.item1': 'Aturan deterministik'": "'guidelines.card3.item1': 'Tinjauan AI + manusia'",
    "'guidelines.card3.item2': 'Proses banding'": "'guidelines.card3.item2': 'Community Rules ditegakkan'",
    "'guidelines.card3.item3': 'Changelog publik'": "'guidelines.card3.item3': 'Banding via tiket'"
  },
  fr: {
    "'guidelines.badge.system': 'Logique système'": "'guidelines.badge.system': 'Gouvernance du contenu'",
    "'guidelines.card1.title': 'Structures de données universelles'": "'guidelines.card1.title': 'Schémas des mondes & créations'",
    "'guidelines.card1.body': 'Tous les profils de mondes, les relations diplomatiques et les données économiques doivent respecter le schéma M.NationWorld afin de garantir l\\'interopérabilité.'": "'guidelines.card1.body': 'Les profils de mondes, les articles et les brouillons FluidCanvas suivent des structures de données unifiées, pour que tout reste consultable et cohérent sur MicroNationary.'",
    "'guidelines.card1.item1': 'Schéma validé'": "'guidelines.card1.item1': 'Schéma de profil de monde'",
    "'guidelines.card1.item2': 'Versions suivies'": "'guidelines.card1.item2': 'Schéma d\\'article'",
    "'guidelines.card1.item3': 'Journal d\\'audit'": "'guidelines.card1.item3': 'Versionnage des brouillons'",
    "'guidelines.card2.body': 'Respectez la propriété intellectuelle, créditez les collaborateurs et maintenez un discours constructif dans tous les canaux diplomatiques.'": "'guidelines.card2.body': 'Respectez la propriété intellectuelle, créditez les collaborateurs et maintenez des échanges constructifs sur les canaux communautaires et la messagerie.'",
    "'guidelines.card3.title': 'Logique des données comportementales'": "'guidelines.card3.title': 'Gouvernance du contenu & appels'",
    "'guidelines.card3.body': 'Les simulations économiques, la résolution des conflits et les événements aléatoires suivent des algorithmes transparents. Tous les résultats sont auditables.'": "'guidelines.card3.body': 'Tous les contenus publics passent par une modération transparente. Les infractions sont traitées selon les Community Rules et les décisions peuvent être contestées via le système de tickets.'",
    "'guidelines.card3.item1': 'Règles déterministes'": "'guidelines.card3.item1': 'Examen IA + humain'",
    "'guidelines.card3.item2': 'Procédure d\\'appel'": "'guidelines.card3.item2': 'Community Rules appliquées'",
    "'guidelines.card3.item3': 'Journal des modifications public'": "'guidelines.card3.item3': 'Appels via tickets'"
  },
  es: {
    "'guidelines.badge.system': 'Lógica del sistema'": "'guidelines.badge.system': 'Gobernanza de contenido'",
    "'guidelines.card1.title': 'Estructuras de datos universales'": "'guidelines.card1.title': 'Esquemas de mundos y creaciones'",
    "'guidelines.card1.body': 'Todos los perfiles de mundos, relaciones diplomáticas y datos económicos deben seguir el esquema de M.NationWorld para garantizar la interoperabilidad.'": "'guidelines.card1.body': 'Los perfiles de mundos, los artículos y los borradores de FluidCanvas siguen estructuras de datos unificadas, para que todo se pueda buscar y sea coherente en MicroNationary.'",
    "'guidelines.card1.item1': 'Esquema validado'": "'guidelines.card1.item1': 'Esquema de perfil de mundo'",
    "'guidelines.card1.item2': 'Versiones registradas'": "'guidelines.card1.item2': 'Esquema de artículo'",
    "'guidelines.card1.item3': 'Registro de auditoría'": "'guidelines.card1.item3': 'Versionado de borradores'",
    "'guidelines.card2.body': 'Respeta la propiedad intelectual, da crédito a los colaboradores y mantén un discurso constructivo en todos los canales diplomáticos.'": "'guidelines.card2.body': 'Respeta la propiedad intelectual, da crédito a los colaboradores y mantén debates constructivos en los canales de la comunidad y la mensajería.'",
    "'guidelines.card3.title': 'Lógica de datos de comportamiento'": "'guidelines.card3.title': 'Gobernanza de contenido y apelaciones'",
    "'guidelines.card3.body': 'Las simulaciones económicas, la resolución de conflictos y los eventos aleatorios siguen algoritmos transparentes. Todos los resultados son auditables.'": "'guidelines.card3.body': 'Todo el contenido público pasa por una moderación transparente. Las infracciones se tratan según las Community Rules y las decisiones pueden apelarse mediante el sistema de tickets.'",
    "'guidelines.card3.item1': 'Reglas deterministas'": "'guidelines.card3.item1': 'Revisión con IA + humana'",
    "'guidelines.card3.item2': 'Proceso de apelación'": "'guidelines.card3.item2': 'Community Rules aplicadas'",
    "'guidelines.card3.item3': 'Registro de cambios público'": "'guidelines.card3.item3': 'Apelaciones por ticket'"
  },
  zht: {
    '"guidelines.badge.system": "系統邏輯"': '"guidelines.badge.system": "內容治理"',
    '"guidelines.card1.title": "通用數據結構"': '"guidelines.card1.title": "世界與創作數據結構"',
    '"guidelines.card1.body": "所有世界檔案、外交關係與經濟數據必須遵循 M.NationWorld 數據模式，以確保互操作性。"': '"guidelines.card1.body": "世界檔案、文章與 FluidCanvas 草稿遵循統一數據結構，發布後可在 MicroNationary 全站檢索與展示。"',
    '"guidelines.card1.item1": "模式已驗證"': '"guidelines.card1.item1": "世界檔案模式"',
    '"guidelines.card1.item2": "版本追蹤"': '"guidelines.card1.item2": "文章模式"',
    '"guidelines.card1.item3": "審計留痕"': '"guidelines.card1.item3": "草稿版本追蹤"',
    '"guidelines.card2.body": "尊重知識產權、註明協作者貢獻，並在所有外交渠道中保持建設性交流。"': '"guidelines.card2.body": "尊重知識產權、註明協作者貢獻，並在社區與消息渠道中保持建設性交流。"',
    '"guidelines.card3.title": "行為數據邏輯"': '"guidelines.card3.title": "內容治理與申訴"',
    '"guidelines.card3.body": "經濟模擬、衝突解決與隨機事件均遵循透明算法，所有結果均可審計。"': '"guidelines.card3.body": "所有公開內容經透明審核流程處置；違規行為按《社區規則》處理，處理決定可通過工單申訴。"',
    '"guidelines.card3.item1": "確定性規則"': '"guidelines.card3.item1": "AI + 人工審核"',
    '"guidelines.card3.item2": "申訴流程"': '"guidelines.card3.item2": "社區規則執行"',
    '"guidelines.card3.item3": "公開更新日誌"': '"guidelines.card3.item3": "工單申訴"'
  }
};

let applied = 0;
for (const locale in LOCALES) {
  for (const oldLine in LOCALES[locale]) {
    const newLine = LOCALES[locale][oldLine];
    if (s.indexOf(oldLine) === -1) {
      console.log('未找到（跳过）[' + locale + ']: ' + oldLine.slice(0, 70));
      continue;
    }
    s = s.split(oldLine).join(newLine);
    applied++;
  }
}
fs.writeFileSync(f, s);
console.log('应用替换: ' + applied);
