'use strict';
// v10.28.50.0 边缘抽屉/AI 生成/仓库 i18n 插入脚本（37 fc.edge.* + 1 fc.imgMeta.visFriends）
// 11 个手写块同位插入（zh-Hant 由 tmp-i18n-hant.js OpenCC 重生成）。
// 插入位（每块内键唯一）：
//   A: "fc.edge.lockedHint" 前  — custom*/drawerTitle/gen*（25 键）
//   B: "fc.edge.tech" 前       — repo*/samplesTitle/saved/tabAll/tabMy（9 键）
//   C: "fc.edge.treasure" 行后 — uploadFailed/uploadRepo/uploaded（3 键）
//   D: "fc.imgMeta.visPrivate" 前 — visFriends（1 键）
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'docs', 'assets', 'i18n', 'fluidcanvas.i18n.js');
let src = fs.readFileSync(FILE, 'utf8');
const EOL = src.indexOf('\r\n') !== -1 ? '\r\n' : '\n';

const LANGS = ['zh', 'en', 'de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt'];
const D = {
  zh: {
    customAdd: '自定义添加（AI 生成）', customDel: '删除',
    customEmpty: '还没有自定义边缘——点击上方「自定义添加」用 AI 生成',
    customFull: '自定义边缘已达上限（200 条）', customInUse: '该边缘正在使用中，先移除卡片上的应用再删除',
    customTitle: '我的自定义', drawerTitle: '边缘与边框',
    genAttach: '附图（可选）', genBtn: '生成', genBudget: '本月 AI 生成额度已用完', genDesc: '描述',
    genDescPh: '描述你想要的边缘形状，例如：四周撕纸般的锯齿边缘', genFailed: '生成失败，请稍后再试',
    genImgAttached: '已附图', genImgTooBig: '图片不能超过 6MB', genKindBorder: '边框', genKindEdge: '边缘',
    genLoading: '生成中…', genName: '名称', genNamePh: '给这个边缘起个名字',
    genNeedInput: '请输入描述或附上图片', genRegen: '重新生成', genSave: '保存', genTitle: 'AI 生成边缘',
    genUnavailable: 'AI 生成暂不可用',
    repoApplied: '已添加并应用', repoEdit: '修改', repoEmpty: '暂无仓库边缘', repoSave: '保存修改',
    repoTitle: '边缘仓库', samplesTitle: '边缘样本', saved: '已保存到我的自定义',
    tabAll: '全部', tabMy: 'My',
    uploadFailed: '上传失败，请稍后再试', uploadRepo: '上传仓库', uploaded: '已上传仓库',
    visFriends: '好友'
  },
  en: {
    customAdd: 'Custom (AI Generate)', customDel: 'Delete',
    customEmpty: 'No custom edges yet — tap “Custom” above to generate one with AI',
    customFull: 'Custom edge limit reached (200)', customInUse: 'This edge is in use on cards — remove it from cards first',
    customTitle: 'My Custom', drawerTitle: 'Edges & Borders',
    genAttach: 'Attach image (optional)', genBtn: 'Generate', genBudget: 'AI generation quota used up this month', genDesc: 'Description',
    genDescPh: 'Describe the edge shape you want, e.g. torn-paper zigzag edges all around', genFailed: 'Generation failed, please try again',
    genImgAttached: 'Image attached', genImgTooBig: 'Image must be under 6MB', genKindBorder: 'Border', genKindEdge: 'Edge',
    genLoading: 'Generating…', genName: 'Name', genNamePh: 'Name this edge',
    genNeedInput: 'Enter a description or attach an image', genRegen: 'Regenerate', genSave: 'Save', genTitle: 'AI Generate Edge',
    genUnavailable: 'AI generation is temporarily unavailable',
    repoApplied: 'Added and applied', repoEdit: 'Edit', repoEmpty: 'No edges in the repository yet', repoSave: 'Save changes',
    repoTitle: 'Edge Repository', samplesTitle: 'Edge Samples', saved: 'Saved to My Custom',
    tabAll: 'All', tabMy: 'My',
    uploadFailed: 'Upload failed, please try again', uploadRepo: 'Upload to Repository', uploaded: 'Uploaded to repository',
    visFriends: 'Friends'
  },
  de: {
    customAdd: 'Benutzerdefiniert (KI generieren)', customDel: 'Löschen',
    customEmpty: 'Noch keine benutzerdefinierten Kanten — tippe oben auf „Benutzerdefiniert“, um eine mit KI zu erzeugen',
    customFull: 'Limit für benutzerdefinierte Kanten erreicht (200)', customInUse: 'Diese Kante wird auf Karten verwendet — entferne sie zuerst von den Karten',
    customTitle: 'Meine benutzerdefinierten', drawerTitle: 'Kanten & Rahmen',
    genAttach: 'Bild anhängen (optional)', genBtn: 'Generieren', genBudget: 'KI-Generierungskontingent diesen Monat aufgebraucht', genDesc: 'Beschreibung',
    genDescPh: 'Beschreibe die gewünschte Kantenform, z. B. zackige Ränder wie gerissenes Papier', genFailed: 'Generierung fehlgeschlagen, bitte erneut versuchen',
    genImgAttached: 'Bild angehängt', genImgTooBig: 'Bild muss unter 6 MB liegen', genKindBorder: 'Rahmen', genKindEdge: 'Kante',
    genLoading: 'Wird generiert…', genName: 'Name', genNamePh: 'Gib dieser Kante einen Namen',
    genNeedInput: 'Beschreibung eingeben oder Bild anhängen', genRegen: 'Neu generieren', genSave: 'Speichern', genTitle: 'Kante per KI generieren',
    genUnavailable: 'KI-Generierung vorübergehend nicht verfügbar',
    repoApplied: 'Hinzugefügt und angewendet', repoEdit: 'Bearbeiten', repoEmpty: 'Noch keine Kanten im Repository', repoSave: 'Änderungen speichern',
    repoTitle: 'Kanten-Repository', samplesTitle: 'Kantenbeispiele', saved: 'In „Meine benutzerdefinierten“ gespeichert',
    tabAll: 'Alle', tabMy: 'Meine',
    uploadFailed: 'Upload fehlgeschlagen, bitte erneut versuchen', uploadRepo: 'Ins Repository hochladen', uploaded: 'Ins Repository hochgeladen',
    visFriends: 'Freunde'
  },
  ru: {
    customAdd: 'Своё (ИИ генерация)', customDel: 'Удалить',
    customEmpty: 'Своих краёв пока нет — нажмите «Своё» выше, чтобы сгенерировать с помощью ИИ',
    customFull: 'Достигнут лимит своих краёв (200)', customInUse: 'Этот край используется на карточках — сначала уберите его с карточек',
    customTitle: 'Мои свои', drawerTitle: 'Края и рамки',
    genAttach: 'Прикрепить изображение (необязательно)', genBtn: 'Сгенерировать', genBudget: 'Лимит генерации ИИ на этот месяц исчерпан', genDesc: 'Описание',
    genDescPh: 'Опишите желаемую форму края, например зубчатые рваные края со всех сторон', genFailed: 'Не удалось сгенерировать, попробуйте ещё раз',
    genImgAttached: 'Изображение прикреплено', genImgTooBig: 'Изображение должно быть меньше 6 МБ', genKindBorder: 'Рамка', genKindEdge: 'Край',
    genLoading: 'Генерация…', genName: 'Название', genNamePh: 'Дайте имя этому краю',
    genNeedInput: 'Введите описание или прикрепите изображение', genRegen: 'Сгенерировать заново', genSave: 'Сохранить', genTitle: 'ИИ генерация края',
    genUnavailable: 'Генерация ИИ временно недоступна',
    repoApplied: 'Добавлено и применено', repoEdit: 'Изменить', repoEmpty: 'В репозитории пока нет краёв', repoSave: 'Сохранить изменения',
    repoTitle: 'Репозиторий краёв', samplesTitle: 'Примеры краёв', saved: 'Сохранено в «Мои свои»',
    tabAll: 'Все', tabMy: 'Мои',
    uploadFailed: 'Загрузка не удалась, попробуйте ещё раз', uploadRepo: 'Загрузить в репозиторий', uploaded: 'Загружено в репозиторий',
    visFriends: 'Друзья'
  },
  ms: {
    customAdd: 'Tersuai (Jana AI)', customDel: 'Padam',
    customEmpty: 'Belum ada sisi tersuai — ketik "Tersuai" di atas untuk jana dengan AI',
    customFull: 'Had sisi tersuai dicapai (200)', customInUse: 'Sisi ini sedang digunakan pada kad — alihkan daripada kad dahulu',
    customTitle: 'Tersuai Saya', drawerTitle: 'Sisi & Sempadan',
    genAttach: 'Lampirkan imej (pilihan)', genBtn: 'Jana', genBudget: 'Kuota janaan AI bulan ini habis', genDesc: 'Penerangan',
    genDescPh: 'Terangkan bentuk sisi yang anda mahu, cth. tepi bergerigi seperti kertas koyak', genFailed: 'Gagal menjana, sila cuba lagi',
    genImgAttached: 'Imej dilampirkan', genImgTooBig: 'Imej mesti di bawah 6MB', genKindBorder: 'Sempadan', genKindEdge: 'Sisi',
    genLoading: 'Menjana…', genName: 'Nama', genNamePh: 'Namakan sisi ini',
    genNeedInput: 'Masukkan penerangan atau lampirkan imej', genRegen: 'Jana semula', genSave: 'Simpan', genTitle: 'Jana Sisi AI',
    genUnavailable: 'Janaan AI tidak tersedia buat sementara',
    repoApplied: 'Ditambah dan digunakan', repoEdit: 'Sunting', repoEmpty: 'Belum ada sisi dalam repositori', repoSave: 'Simpan perubahan',
    repoTitle: 'Repositori Sisi', samplesTitle: 'Contoh Sisi', saved: 'Disimpan ke Tersuai Saya',
    tabAll: 'Semua', tabMy: 'Saya',
    uploadFailed: 'Muat naik gagal, sila cuba lagi', uploadRepo: 'Muat Naik ke Repositori', uploaded: 'Dimuat naik ke repositori',
    visFriends: 'Rakan'
  },
  th: {
    customAdd: 'กำหนดเอง (สร้างด้วย AI)', customDel: 'ลบ',
    customEmpty: 'ยังไม่มีขอบกำหนดเอง — แตะ "กำหนดเอง" ด้านบนเพื่อสร้างด้วย AI',
    customFull: 'ถึงขีดจำกัดขอบกำหนดเองแล้ว (200)', customInUse: 'ขอบนี้กำลังใช้อยู่บนการ์ด — นำออกจากการ์ดก่อนจึงลบได้',
    customTitle: 'กำหนดเองของฉัน', drawerTitle: 'ขอบและกรอบ',
    genAttach: 'แนบรูปภาพ (ไม่บังคับ)', genBtn: 'สร้าง', genBudget: 'โควต้าสร้างด้วย AI เดือนนี้หมดแล้ว', genDesc: 'คำอธิบาย',
    genDescPh: 'อธิบายรูปทรงขอบที่ต้องการ เช่น ขอบหยักเหมือนกระดาษฉีกโดยรอบ', genFailed: 'สร้างไม่สำเร็จ โปรดลองอีกครั้ง',
    genImgAttached: 'แนบรูปภาพแล้ว', genImgTooBig: 'รูปภาพต้องเล็กกว่า 6MB', genKindBorder: 'กรอบ', genKindEdge: 'ขอบ',
    genLoading: 'กำลังสร้าง…', genName: 'ชื่อ', genNamePh: 'ตั้งชื่อขอบนี้',
    genNeedInput: 'กรอกคำอธิบายหรือแนบรูปภาพ', genRegen: 'สร้างใหม่', genSave: 'บันทึก', genTitle: 'สร้างขอบด้วย AI',
    genUnavailable: 'การสร้างด้วย AI ไม่พร้อมใช้งานชั่วคราว',
    repoApplied: 'เพิ่มและนำไปใช้แล้ว', repoEdit: 'แก้ไข', repoEmpty: 'ยังไม่มีขอบในคลัง', repoSave: 'บันทึกการเปลี่ยนแปลง',
    repoTitle: 'คลังขอบ', samplesTitle: 'ตัวอย่างขอบ', saved: 'บันทึกไปยัง กำหนดเองของฉัน แล้ว',
    tabAll: 'ทั้งหมด', tabMy: 'ของฉัน',
    uploadFailed: 'อัปโหลดไม่สำเร็จ โปรดลองอีกครั้ง', uploadRepo: 'อัปโหลดไปยังคลัง', uploaded: 'อัปโหลดไปยังคลังแล้ว',
    visFriends: 'เพื่อน'
  },
  vi: {
    customAdd: 'Tùy chỉnh (tạo bằng AI)', customDel: 'Xóa',
    customEmpty: 'Chưa có cạnh tùy chỉnh — chạm "Tùy chỉnh" ở trên để tạo bằng AI',
    customFull: 'Đã đạt giới hạn cạnh tùy chỉnh (200)', customInUse: 'Cạnh này đang dùng trên thẻ — gỡ khỏi thẻ trước đã',
    customTitle: 'Tùy chỉnh của tôi', drawerTitle: 'Cạnh & Viền',
    genAttach: 'Đính kèm ảnh (tùy chọn)', genBtn: 'Tạo', genBudget: 'Đã dùng hết hạn mức tạo AI tháng này', genDesc: 'Mô tả',
    genDescPh: 'Mô tả hình dạng cạnh bạn muốn, ví dụ cạnh răng cưa như giấy xé quanh viền', genFailed: 'Tạo thất bại, vui lòng thử lại',
    genImgAttached: 'Đã đính kèm ảnh', genImgTooBig: 'Ảnh phải dưới 6MB', genKindBorder: 'Viền', genKindEdge: 'Cạnh',
    genLoading: 'Đang tạo…', genName: 'Tên', genNamePh: 'Đặt tên cho cạnh này',
    genNeedInput: 'Nhập mô tả hoặc đính kèm ảnh', genRegen: 'Tạo lại', genSave: 'Lưu', genTitle: 'Tạo cạnh bằng AI',
    genUnavailable: 'Tạo bằng AI tạm thời không khả dụng',
    repoApplied: 'Đã thêm và áp dụng', repoEdit: 'Sửa', repoEmpty: 'Chưa có cạnh nào trong kho', repoSave: 'Lưu thay đổi',
    repoTitle: 'Kho cạnh', samplesTitle: 'Cạnh mẫu', saved: 'Đã lưu vào Tùy chỉnh của tôi',
    tabAll: 'Tất cả', tabMy: 'Của tôi',
    uploadFailed: 'Tải lên thất bại, vui lòng thử lại', uploadRepo: 'Tải lên kho', uploaded: 'Đã tải lên kho',
    visFriends: 'Bạn bè'
  },
  id: {
    customAdd: 'Kustom (buat dengan AI)', customDel: 'Hapus',
    customEmpty: 'Belum ada tepi kustom — ketuk "Kustom" di atas untuk membuat dengan AI',
    customFull: 'Batas tepi kustom tercapai (200)', customInUse: 'Tepi ini sedang dipakai di kartu — lepas dari kartu dulu',
    customTitle: 'Kustom Saya', drawerTitle: 'Tepi & Bingkai',
    genAttach: 'Lampirkan gambar (opsional)', genBtn: 'Buat', genBudget: 'Kuota pembuatan AI bulan ini habis', genDesc: 'Deskripsi',
    genDescPh: 'Jelaskan bentuk tepi yang diinginkan, mis. tepi bergerigi seperti kertas sobek', genFailed: 'Gagal membuat, silakan coba lagi',
    genImgAttached: 'Gambar terlampir', genImgTooBig: 'Gambar harus di bawah 6MB', genKindBorder: 'Bingkai', genKindEdge: 'Tepi',
    genLoading: 'Membuat…', genName: 'Nama', genNamePh: 'Beri nama tepi ini',
    genNeedInput: 'Masukkan deskripsi atau lampirkan gambar', genRegen: 'Buat ulang', genSave: 'Simpan', genTitle: 'Buat Tepi dengan AI',
    genUnavailable: 'Pembuatan AI sementara tidak tersedia',
    repoApplied: 'Ditambahkan dan diterapkan', repoEdit: 'Ubah', repoEmpty: 'Belum ada tepi di repositori', repoSave: 'Simpan perubahan',
    repoTitle: 'Repositori Tepi', samplesTitle: 'Contoh Tepi', saved: 'Tersimpan ke Kustom Saya',
    tabAll: 'Semua', tabMy: 'Saya',
    uploadFailed: 'Unggah gagal, silakan coba lagi', uploadRepo: 'Unggah ke Repositori', uploaded: 'Diunggah ke repositori',
    visFriends: 'Teman'
  },
  fr: {
    customAdd: 'Personnalisé (générer par IA)', customDel: 'Supprimer',
    customEmpty: 'Aucun bord personnalisé — touchez « Personnalisé » ci-dessus pour en générer un avec l’IA',
    customFull: 'Limite de bords personnalisés atteinte (200)', customInUse: 'Ce bord est utilisé sur des cartes — retirez-le d’abord des cartes',
    customTitle: 'Mes personnalisés', drawerTitle: 'Bords et bordures',
    genAttach: 'Joindre une image (facultatif)', genBtn: 'Générer', genBudget: 'Quota de génération IA du mois épuisé', genDesc: 'Description',
    genDescPh: 'Décrivez la forme de bord souhaitée, ex. bords dentelés comme du papier déchiré', genFailed: 'Échec de la génération, veuillez réessayer',
    genImgAttached: 'Image jointe', genImgTooBig: 'L’image doit faire moins de 6 Mo', genKindBorder: 'Bordure', genKindEdge: 'Bord',
    genLoading: 'Génération…', genName: 'Nom', genNamePh: 'Nommez ce bord',
    genNeedInput: 'Saisissez une description ou joignez une image', genRegen: 'Régénérer', genSave: 'Enregistrer', genTitle: 'Générer un bord par IA',
    genUnavailable: 'Génération IA momentanément indisponible',
    repoApplied: 'Ajouté et appliqué', repoEdit: 'Modifier', repoEmpty: 'Aucun bord dans le dépôt pour l’instant', repoSave: 'Enregistrer les modifications',
    repoTitle: 'Dépôt de bords', samplesTitle: 'Échantillons de bords', saved: 'Enregistré dans Mes personnalisés',
    tabAll: 'Tous', tabMy: 'Mes',
    uploadFailed: 'Échec de l’envoi, veuillez réessayer', uploadRepo: 'Envoyer au dépôt', uploaded: 'Envoyé au dépôt',
    visFriends: 'Amis'
  },
  es: {
    customAdd: 'Personalizado (generar con IA)', customDel: 'Eliminar',
    customEmpty: 'Aún no hay bordes personalizados — toca «Personalizado» arriba para generar uno con IA',
    customFull: 'Límite de bordes personalizados alcanzado (200)', customInUse: 'Este borde se usa en tarjetas — retíralo primero de las tarjetas',
    customTitle: 'Mis personalizados', drawerTitle: 'Bordes y marcos',
    genAttach: 'Adjuntar imagen (opcional)', genBtn: 'Generar', genBudget: 'Cuota de generación IA de este mes agotada', genDesc: 'Descripción',
    genDescPh: 'Describe la forma del borde que quieres, p. ej. bordes dentados como papel rasgado', genFailed: 'No se pudo generar, inténtalo de nuevo',
    genImgAttached: 'Imagen adjuntada', genImgTooBig: 'La imagen debe pesar menos de 6 MB', genKindBorder: 'Marco', genKindEdge: 'Borde',
    genLoading: 'Generando…', genName: 'Nombre', genNamePh: 'Pon nombre a este borde',
    genNeedInput: 'Escribe una descripción o adjunta una imagen', genRegen: 'Regenerar', genSave: 'Guardar', genTitle: 'Generar borde con IA',
    genUnavailable: 'Generación IA temporalmente no disponible',
    repoApplied: 'Añadido y aplicado', repoEdit: 'Editar', repoEmpty: 'Aún no hay bordes en el repositorio', repoSave: 'Guardar cambios',
    repoTitle: 'Repositorio de bordes', samplesTitle: 'Muestras de bordes', saved: 'Guardado en Mis personalizados',
    tabAll: 'Todos', tabMy: 'Míos',
    uploadFailed: 'Error al subir, inténtalo de nuevo', uploadRepo: 'Subir al repositorio', uploaded: 'Subido al repositorio',
    visFriends: 'Amigos'
  },
  pt: {
    customAdd: 'Personalizado (gerar com IA)', customDel: 'Excluir',
    customEmpty: 'Nenhuma borda personalizada ainda — toque em "Personalizado" acima para gerar uma com IA',
    customFull: 'Limite de bordas personalizadas atingido (200)', customInUse: 'Esta borda está em uso nos cartões — remova-a dos cartões primeiro',
    customTitle: 'Meus personalizados', drawerTitle: 'Bordas e molduras',
    genAttach: 'Anexar imagem (opcional)', genBtn: 'Gerar', genBudget: 'Cota de geração por IA deste mês esgotada', genDesc: 'Descrição',
    genDescPh: 'Descreva o formato de borda desejado, ex. bordas serrilhadas como papel rasgado', genFailed: 'Falha na geração, tente novamente',
    genImgAttached: 'Imagem anexada', genImgTooBig: 'A imagem deve ter menos de 6MB', genKindBorder: 'Moldura', genKindEdge: 'Borda',
    genLoading: 'Gerando…', genName: 'Nome', genNamePh: 'Dê um nome a esta borda',
    genNeedInput: 'Digite uma descrição ou anexe uma imagem', genRegen: 'Gerar novamente', genSave: 'Salvar', genTitle: 'Gerar borda com IA',
    genUnavailable: 'Geração por IA temporariamente indisponível',
    repoApplied: 'Adicionado e aplicado', repoEdit: 'Editar', repoEmpty: 'Nenhuma borda no repositório ainda', repoSave: 'Salvar alterações',
    repoTitle: 'Repositório de bordas', samplesTitle: 'Amostras de bordas', saved: 'Salvo em Meus personalizados',
    tabAll: 'Todos', tabMy: 'Meus',
    uploadFailed: 'Falha no envio, tente novamente', uploadRepo: 'Enviar ao repositório', uploaded: 'Enviado ao repositório',
    visFriends: 'Amigos'
  }
};

const GROUP_A = ['customAdd', 'customDel', 'customEmpty', 'customFull', 'customInUse', 'customTitle', 'drawerTitle',
  'genAttach', 'genBtn', 'genBudget', 'genDesc', 'genDescPh', 'genFailed', 'genImgAttached', 'genImgTooBig',
  'genKindBorder', 'genKindEdge', 'genLoading', 'genName', 'genNamePh', 'genNeedInput', 'genRegen', 'genSave',
  'genTitle', 'genUnavailable'];
const GROUP_B = ['repoApplied', 'repoEdit', 'repoEmpty', 'repoSave', 'repoTitle', 'samplesTitle', 'saved', 'tabAll', 'tabMy'];
const GROUP_C = ['uploadFailed', 'uploadRepo', 'uploaded'];
const ALL_KEYS = GROUP_A.concat(GROUP_B, GROUP_C, ['visFriends']);

function kv(lang, key) {
  const v = D[lang][key];
  return '  "fc.edge.' + key + '": ' + JSON.stringify(v) + ',';
}
function kvFriends(lang) {
  return '  "fc.imgMeta.visFriends": ' + JSON.stringify(D[lang].visFriends) + ',';
}

// 按语言块切分：window.MN_I18N.add('<lang>', { ... });
const blocks = {};
LANGS.forEach(function (lang) {
  const marker = "window.MN_I18N.add('" + lang + "', {";
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('block not found: ' + lang);
  const end = src.indexOf('});', start);
  if (end === -1) throw new Error('block end not found: ' + lang);
  blocks[lang] = { start: start, body: src.slice(start + marker.length, end) };
});

let out = src;
// 从后往前替换，保持行号稳定（用字符位置处理）
const edits = [];
LANGS.forEach(function (lang) {
  const b = blocks[lang];
  const mlen = ("window.MN_I18N.add('" + lang + "', {").length;
  // A: 在 "fc.edge.lockedHint" 行前
  const aAnchor = '  "fc.edge.lockedHint"';
  const aIdx = b.body.indexOf(aAnchor);
  if (aIdx === -1) throw new Error('anchor A not found: ' + lang);
  const aText = GROUP_A.map(function (k) { return kv(lang, k); }).join(EOL) + EOL;
  edits.push({ at: b.start + mlen + aIdx, text: aText });
  // B: 在 "fc.edge.tech" 行前
  const bAnchor = '  "fc.edge.tech":';
  const bIdx = b.body.indexOf(bAnchor);
  if (bIdx === -1) throw new Error('anchor B not found: ' + lang);
  const bText = GROUP_B.map(function (k) { return kv(lang, k); }).join(EOL) + EOL;
  edits.push({ at: b.start + mlen + bIdx, text: bText });
  // C: 在 "fc.edge.treasure" 行后（到该行行尾）
  const cAnchor = '  "fc.edge.treasure":';
  const cIdx = b.body.indexOf(cAnchor);
  if (cIdx === -1) throw new Error('anchor C not found: ' + lang);
  const cLineEnd = b.body.indexOf(EOL, cIdx) + EOL.length;
  const cText = EOL + GROUP_C.map(function (k) { return kv(lang, k); }).join(EOL);
  edits.push({ at: b.start + mlen + cLineEnd, text: cText });
  // D: 在 "fc.imgMeta.visPrivate" 行前
  const dAnchor = '  "fc.imgMeta.visPrivate"';
  const dIdx = b.body.indexOf(dAnchor);
  if (dIdx === -1) throw new Error('anchor D not found: ' + lang);
  const dText = kvFriends(lang) + EOL;
  edits.push({ at: b.start + mlen + dIdx, text: dText });
});
edits.sort(function (a, b) { return b.at - a.at; });
edits.forEach(function (e) { out = out.slice(0, e.at) + e.text + out.slice(e.at); });

// 奇偶校验：每个新键在每个手写块恰出现 1 次（zh-Hant 块此时不含这些键）
let fail = 0;
LANGS.forEach(function (lang) {
  const b = blocks[lang];
  ALL_KEYS.forEach(function (k) {
    const key = k === 'visFriends' ? 'fc.imgMeta.visFriends' : 'fc.edge.' + k;
    // 只在该语言块内计数
    const marker = "window.MN_I18N.add('" + lang + "', {";
    const s2 = out.indexOf(marker);
    const e2 = out.indexOf('});', s2);
    const seg = out.slice(s2, e2);
    const cnt = seg.split('"' + key + '"').length - 1;
    if (cnt !== 1) { console.error('❌ ' + lang + ' ' + key + ' count=' + cnt); fail++; }
  });
});
if (fail) { console.error('❌ parity failed: ' + fail); process.exit(1); }

fs.writeFileSync(FILE, out, 'utf8');
console.log('✅ 11 blocks × ' + ALL_KEYS.length + ' keys inserted (parity OK)');
