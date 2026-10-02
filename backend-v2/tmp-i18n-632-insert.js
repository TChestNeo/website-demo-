'use strict';
// Round 46 (v0.2.58.26)：fluidcanvas.i18n.js 插入 25 新键 × 11 手工语 + 删 fc.landing.demoSub。
// en 值=代码兜底串逐字节一致；zh-Hant 不手写——本脚本不动，随后 tmp-i18n-hant.js 重生成。
// 插入保持块内按键排序；demoSub 行跳过。
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', 'docs', 'assets', 'i18n', 'fluidcanvas.i18n.js');
let src = fs.readFileSync(FILE, 'utf8');

const NEW = [
  ['fc.analytics.date', { zh: '日期', en: 'Date', de: 'Datum', ru: 'Дата', ms: 'Tarikh', th: 'วันที่', vi: 'Ngày', id: 'Tanggal', fr: 'Date', es: 'Fecha', pt: 'Data' }],
  ['fc.analytics.interactions', { zh: '互动', en: 'Interactions', de: 'Interaktionen', ru: 'Взаимодействия', ms: 'Interaksi', th: 'การโต้ตอบ', vi: 'Tương tác', id: 'Interaksi', fr: 'Interactions', es: 'Interacciones', pt: 'Interações' }],
  ['fc.analytics.newArticles', { zh: '新增文章', en: 'New Articles', de: 'Neue Artikel', ru: 'Новые статьи', ms: 'Artikel Baharu', th: 'บทความใหม่', vi: 'Bài viết mới', id: 'Artikel Baru', fr: 'Nouveaux articles', es: 'Artículos nuevos', pt: 'Novos artigos' }],
  ['fc.analytics.newFollowers', { zh: '新增关注者', en: 'New Followers', de: 'Neue Follower', ru: 'Новые подписчики', ms: 'Pengikut Baharu', th: 'ผู้ติดตามใหม่', vi: 'Người theo dõi mới', id: 'Pengikut Baru', fr: 'Nouveaux abonnés', es: 'Seguidores nuevos', pt: 'Novos seguidores' }],
  ['fc.analytics.newPosts', { zh: '新帖子', en: 'New Posts', de: 'Neue Beiträge', ru: 'Новые посты', ms: 'Siaran Baharu', th: 'โพสต์ใหม่', vi: 'Bài đăng mới', id: 'Postingan Baru', fr: 'Nouveaux posts', es: 'Publicaciones nuevas', pt: 'Novas publicações' }],
  ['fc.analytics.noData', { zh: '暂无分析数据', en: 'No analytics data yet', de: 'Noch keine Analysedaten', ru: 'Пока нет данных аналитики', ms: 'Tiada data analitik lagi', th: 'ยังไม่มีข้อมูลวิเคราะห์', vi: 'Chưa có dữ liệu phân tích', id: 'Belum ada data analitik', fr: "Pas encore de données d'analyse", es: 'Aún no hay datos de análisis', pt: 'Ainda não há dados de análise' }],
  ['fc.analytics.noDataHint', { zh: '你的频道有活动后，数据会显示在这里', en: 'Data appears here once your channel gets activity', de: 'Daten erscheinen hier, sobald dein Kanal aktiv ist', ru: 'Данные появятся здесь, когда на вашем канале появится активность', ms: 'Data akan muncul di sini setelah saluran anda aktif', th: 'ข้อมูลจะปรากฏที่นี่เมื่อช่องของคุณมีกิจกรรม', vi: 'Dữ liệu sẽ xuất hiện ở đây khi kênh của bạn có hoạt động', id: 'Data muncul di sini setelah kanal Anda aktif', fr: 'Les données apparaîtront ici dès que votre chaîne sera active', es: 'Los datos aparecerán aquí cuando tu canal tenga actividad', pt: 'Os dados aparecerão aqui quando o seu canal tiver atividade' }],
  ['fc.analytics.windowText', { zh: '窗口：', en: 'Window: ', de: 'Zeitraum: ', ru: 'Период: ', ms: 'Tetingkap: ', th: 'ช่วงเวลา: ', vi: 'Khoảng thời gian: ', id: 'Periode: ', fr: 'Période : ', es: 'Periodo: ', pt: 'Período: ' }],
  ['fc.articles.thisWeek', { zh: '本周', en: 'this week', de: 'diese Woche', ru: 'на этой неделе', ms: 'minggu ini', th: 'สัปดาห์นี้', vi: 'tuần này', id: 'minggu ini', fr: 'cette semaine', es: 'esta semana', pt: 'esta semana' }],
  ['fc.articles.toastPublishInEditor', { zh: '请在编辑器中打开文章进行发布', en: 'Open an article in the editor to publish it', de: 'Öffne einen Artikel im Editor, um ihn zu veröffentlichen', ru: 'Откройте статью в редакторе, чтобы опубликовать её', ms: 'Buka artikel dalam editor untuk menerbitkannya', th: 'เปิดบทความในตัวแก้ไขเพื่อเผยแพร่', vi: 'Mở bài viết trong trình soạn thảo để xuất bản', id: 'Buka artikel di editor untuk menerbitkannya', fr: "Ouvrez un article dans l'éditeur pour le publier", es: 'Abre un artículo en el editor para publicarlo', pt: 'Abra um artigo no editor para publicá-lo' }],
  ['fc.landing.emptyArticles', { zh: '还没有文章', en: 'No articles yet', de: 'Noch keine Artikel', ru: 'Статей пока нет', ms: 'Tiada artikel lagi', th: 'ยังไม่มีบทความ', vi: 'Chưa có bài viết', id: 'Belum ada artikel', fr: "Pas encore d'articles", es: 'Aún no hay artículos', pt: 'Ainda não há artigos' }],
  ['fc.landing.emptyArticlesHint', { zh: '在编辑器中创建你的第一篇文章', en: 'Create your first article in the editor', de: 'Erstelle deinen ersten Artikel im Editor', ru: 'Создайте свою первую статью в редакторе', ms: 'Cipta artikel pertama anda dalam editor', th: 'สร้างบทความแรกของคุณในตัวแก้ไข', vi: 'Tạo bài viết đầu tiên của bạn trong trình soạn thảo', id: 'Buat artikel pertama Anda di editor', fr: 'Créez votre premier article dans l’éditeur', es: 'Crea tu primer artículo en el editor', pt: 'Crie o seu primeiro artigo no editor' }],
  ['fc.landing.emptyMedia', { zh: '还没有媒体', en: 'No media yet', de: 'Noch keine Medien', ru: 'Медиафайлов пока нет', ms: 'Tiada media lagi', th: 'ยังไม่มีสื่อ', vi: 'Chưa có phương tiện', id: 'Belum ada media', fr: 'Pas encore de médias', es: 'Aún no hay medios', pt: 'Ainda não há mídia' }],
  ['fc.landing.emptyMediaHint', { zh: '上传的媒体将显示在这里', en: 'Uploaded media will appear here', de: 'Hochgeladene Medien erscheinen hier', ru: 'Загруженные медиа появятся здесь', ms: 'Media yang dimuat naik akan muncul di sini', th: 'สื่อที่อัปโหลดจะปรากฏที่นี่', vi: 'Phương tiện đã tải lên sẽ xuất hiện ở đây', id: 'Media yang diunggah akan muncul di sini', fr: 'Les médias téléversés apparaîtront ici', es: 'Los medios subidos aparecerán aquí', pt: 'A mídia enviada aparecerá aqui' }],
  ['fc.landing.myStudio', { zh: '我的工作室', en: 'My Studio', de: 'Mein Studio', ru: 'Моя студия', ms: 'Studio Saya', th: 'สตูดิโอของฉัน', vi: 'Studio của tôi', id: 'Studio Saya', fr: 'Mon studio', es: 'Mi estudio', pt: 'Meu estúdio' }],
  ['fc.landing.recentMedia', { zh: '最近媒体', en: 'Recent Media', de: 'Aktuelle Medien', ru: 'Недавние медиа', ms: 'Media Terkini', th: 'สื่อล่าสุด', vi: 'Phương tiện gần đây', id: 'Media Terbaru', fr: 'Médias récents', es: 'Medios recientes', pt: 'Mídia recente' }],
  ['fc.landing.untitled', { zh: '无标题', en: 'Untitled', de: 'Ohne Titel', ru: 'Без названия', ms: 'Tanpa Tajuk', th: 'ไม่มีชื่อ', vi: 'Không có tiêu đề', id: 'Tanpa Judul', fr: 'Sans titre', es: 'Sin título', pt: 'Sem título' }],
  ['fc.metrics.size', { zh: '大小', en: 'Size', de: 'Größe', ru: 'Размер', ms: 'Saiz', th: 'ขนาด', vi: 'Kích thước', id: 'Ukuran', fr: 'Taille', es: 'Tamaño', pt: 'Tamanho' }],
  ['fc.upload.emptyHint', { zh: '上传的媒体将显示在这里', en: 'Uploaded media will appear here', de: 'Hochgeladene Medien erscheinen hier', ru: 'Загруженные медиа появятся здесь', ms: 'Media yang dimuat naik akan muncul di sini', th: 'สื่อที่อัปโหลดจะปรากฏที่นี่', vi: 'Phương tiện đã tải lên sẽ xuất hiện ở đây', id: 'Media yang diunggah akan muncul di sini', fr: 'Les médias téléversés apparaîtront ici', es: 'Los medios subidos aparecerán aquí', pt: 'A mídia enviada aparecerá aqui' }],
  ['fc.upload.emptyTitle', { zh: '还没有上传', en: 'No uploads yet', de: 'Noch keine Uploads', ru: 'Загрузок пока нет', ms: 'Tiada muat naik lagi', th: 'ยังไม่มีการอัปโหลด', vi: 'Chưa có tải lên', id: 'Belum ada unggahan', fr: 'Pas encore de téléversements', es: 'Aún no hay subidas', pt: 'Ainda não há envios' }],
  ['fc.upload.needLogin', { zh: '请使用注册账号登录后上传', en: 'Log in with a registered account to upload', de: 'Melde dich mit einem registrierten Konto an, um hochzuladen', ru: 'Войдите с зарегистрированным аккаунтом, чтобы загружать', ms: 'Log masuk dengan akaun berdaftar untuk memuat naik', th: 'เข้าสู่ระบบด้วยบัญชีที่ลงทะเบียนเพื่ออัปโหลด', vi: 'Đăng nhập bằng tài khoản đã đăng ký để tải lên', id: 'Masuk dengan akun terdaftar untuk mengunggah', fr: 'Connectez-vous avec un compte enregistré pour téléverser', es: 'Inicia sesión con una cuenta registrada para subir', pt: 'Faça login com uma conta registrada para enviar' }],
  ['fc.upload.statusUploaded', { zh: '已上传', en: 'Uploaded', de: 'Hochgeladen', ru: 'Загружено', ms: 'Dimuat naik', th: 'อัปโหลดแล้ว', vi: 'Đã tải lên', id: 'Diunggah', fr: 'Téléversé', es: 'Subido', pt: 'Enviado' }],
  ['fc.upload.toastNoFile', { zh: '请先选择文件', en: 'Please select a file first', de: 'Bitte wähle zuerst eine Datei aus', ru: 'Сначала выберите файл', ms: 'Sila pilih fail dahulu', th: 'กรุณาเลือกไฟล์ก่อน', vi: 'Vui lòng chọn tệp trước', id: 'Silakan pilih file terlebih dahulu', fr: "Veuillez d'abord sélectionner un fichier", es: 'Selecciona primero un archivo', pt: 'Selecione primeiro um arquivo' }],
  ['fc.upload.toastUploadFail', { zh: '上传失败，请重试', en: 'Upload failed, please try again', de: 'Upload fehlgeschlagen, bitte erneut versuchen', ru: 'Загрузка не удалась, попробуйте ещё раз', ms: 'Muat naik gagal, sila cuba lagi', th: 'อัปโหลดล้มเหลว โปรดลองอีกครั้ง', vi: 'Tải lên thất bại, vui lòng thử lại', id: 'Unggah gagal, silakan coba lagi', fr: 'Échec du téléversement, veuillez réessayer', es: 'Fallo al subir, inténtalo de nuevo', pt: 'Falha no envio, tente novamente' }],
  ['fc.upload.toastUploaded', { zh: '上传成功', en: 'Uploaded successfully', de: 'Erfolgreich hochgeladen', ru: 'Загружено успешно', ms: 'Berjaya dimuat naik', th: 'อัปโหลดสำเร็จ', vi: 'Tải lên thành công', id: 'Berhasil diunggah', fr: 'Téléversé avec succès', es: 'Subido correctamente', pt: 'Enviado com sucesso' }],
];

const DELETE_KEY = 'fc.landing.demoSub';
const MANUAL = ['zh', 'en', 'de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt'];
const lines = src.split('\n');
const out = [];
let cur = null;
let pending = []; // [{key, val}] 排序后待插入
const inserted = {}; // lang -> count
const deleted = {};
let blockStart = null;

function emitKeysBefore(existingKey) {
  while (pending.length && pending[0].key < existingKey) {
    const p = pending.shift();
    if (p.key === existingKey) throw new Error('duplicate key ' + p.key + ' in ' + cur);
    out.push('  ' + JSON.stringify(p.key) + ': ' + JSON.stringify(p.val) + ',');
    inserted[cur] = (inserted[cur] || 0) + 1;
  }
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/window\.MN_I18N\.add\('([^']+)', \{/);
  if (m) {
    cur = m[1];
    out.push(line);
    if (MANUAL.indexOf(cur) !== -1) {
      pending = NEW.map(([k, t]) => ({ key: k, val: t[cur] })).sort((a, b) => (a.key < b.key ? -1 : 1));
      blockStart = out.length;
    } else {
      pending = [];
    }
    continue;
  }
  if (cur && /^\}\);$/.test(line)) {
    // flush remaining
    while (pending.length) {
      const p = pending.shift();
      out.push('  ' + JSON.stringify(p.key) + ': ' + JSON.stringify(p.val) + ',');
      inserted[cur] = (inserted[cur] || 0) + 1;
    }
    out.push(line);
    if (MANUAL.indexOf(cur) !== -1 && inserted[cur] !== 25) {
      throw new Error('lang ' + cur + ' inserted ' + (inserted[cur] || 0) + ' keys, expected 25');
    }
    cur = null;
    continue;
  }
  if (cur && MANUAL.indexOf(cur) !== -1) {
    const km = line.match(/^  ("[^"]+"):/);
    if (km) {
      const key = km[1].slice(1, -1);
      if (key === DELETE_KEY) { deleted[cur] = 1; continue; } // 跳过 demoSub
      emitKeysBefore(key);
    }
  }
  out.push(line);
}
const result = out.join('\n');
if (result === src) throw new Error('no change!');
fs.writeFileSync(FILE, result);
for (const lang of MANUAL) {
  if ((inserted[lang] || 0) !== 25) throw new Error('final check: ' + lang + ' inserted=' + (inserted[lang] || 0));
  if (!deleted[lang]) throw new Error('final check: demoSub not deleted in ' + lang);
}
console.log('inserted 25 keys x', MANUAL.length, 'langs; demoSub deleted x', Object.keys(deleted).length);
