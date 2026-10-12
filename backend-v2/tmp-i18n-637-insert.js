// tmp-i18n-637-insert.js — FC v10.28.51.0 团队频道 i18n：
//   ① fluidcanvas.i18n.js：fc.team.* 28 键 ×11 手写块（fc.zoom.title 行后插）
//   ② messages.i18n.js：messages.modal.group* 6 键 + toast.groupNoFile 1 键 ×11 手写块
//   ③ premium.i18n.js：slots12/24/36 → slots8/16/26（键名 + <strong>数字</strong>）
// zh-Hant 由 tmp-i18n-hant.js OpenCC 再生成（本脚本不碰 __ZH_HANT_AUTO__ 段）。
'use strict';
const fs = require('fs');
const path = require('path');

const I18N = path.resolve(__dirname, '..', 'docs', 'assets', 'i18n');
const SENTINEL = '/* __ZH_HANT_AUTO__';

function splitSentinel(src) {
  const i = src.indexOf(SENTINEL);
  if (i === -1) return { body: src, tail: '', had: false };
  return { body: src.slice(0, i), tail: src.slice(i), had: true };
}

function applyLines(src, fn) {
  const { body, tail } = splitSentinel(src);
  const out = [];
  for (const line of body.split('\n')) fn(line, out);
  return (body.endsWith('\n') ? out.join('\n') : out.join('\n') + '\n') + tail;
}

// ── ① fluidcanvas.i18n.js：fc.team.* 28 键（fc.zoom.title 后；team>zoom 字母序）──
const FC = {
  zh: {
    wizardTitle: '创建团队频道', step1: '身份', step2: '搬运', step3: '群聊',
    s1Title: '是否直接使用现有横幅&头像&名称&ID 直接转换到团队频道？',
    s1Yes: '是，直接转换', s1YesHint: '横幅/头像/名称/ID 转为团队频道；个人频道保留不动',
    s1No: '否，重新设置', s1NoHint: '为团队频道单独起名', s1NamePh: '团队名称（1-60 字符）',
    s2Title: '选择要搬运到团队频道的内容（只搬数据不搬频道；私人点赞收藏留个人）',
    s2All: '全部', s2Posts: '贴文', s2Media: '视频&贴图', s2Activity: '动态', s2Decorations: '主页装饰',
    s3Title: '建群聊（可选）：拉好友一起进群',
    s3NamePh: '群聊名称（1-60 字符，留空不建群）',
    s3NoFriends: '暂无好友，可先跳过建群', s3Pick: '拉好友进群（只能邀请好友）',
    capHint: '标配 3 名组员；可在订阅页扩容至 8/16/26/∞',
    loginHint: '登录后即可创建团队频道', created: '团队频道已创建', creating: '创建中…',
    createFailed: '创建失败，请稍后重试', create: '创建团队', next: '下一步', back: '上一步'
  },
  en: {
    wizardTitle: 'Create Team Channel', step1: 'Identity', step2: 'Copy', step3: 'Group Chat',
    s1Title: 'Use your current banner, avatar, name & ID directly for the team channel?',
    s1Yes: 'Yes, convert directly', s1YesHint: 'Banner/avatar/name/ID become the team channel; your personal channel stays untouched',
    s1No: 'No, set up fresh', s1NoHint: 'Name the team channel separately', s1NamePh: 'Team name (1-60 characters)',
    s2Title: 'Choose content to copy to the team channel (data only, not the channel; private likes & favorites stay personal)',
    s2All: 'All', s2Posts: 'Posts', s2Media: 'Videos & Stickers', s2Activity: 'Activity', s2Decorations: 'Homepage decorations',
    s3Title: 'Create a group chat (optional): invite friends',
    s3NamePh: 'Group chat name (1-60 characters; leave empty to skip)',
    s3NoFriends: 'No friends yet — you can skip creating the chat', s3Pick: 'Invite friends to the chat (friends only)',
    capHint: '3 members included; expand to 8/16/26/∞ on the subscription page',
    loginHint: 'Log in to create a team channel', created: 'Team channel created', creating: 'Creating…',
    createFailed: 'Creation failed, please try again later', create: 'Create Team', next: 'Next', back: 'Back'
  },
  de: {
    wizardTitle: 'Team-Kanal erstellen', step1: 'Identität', step2: 'Übernahme', step3: 'Gruppenchat',
    s1Title: 'Banner, Avatar, Namen & ID direkt für den Team-Kanal übernehmen?',
    s1Yes: 'Ja, direkt übernehmen', s1YesHint: 'Banner/Avatar/Name/ID werden zum Team-Kanal; dein persönlicher Kanal bleibt unverändert',
    s1No: 'Nein, neu einrichten', s1NoHint: 'Team-Kanal separat benennen', s1NamePh: 'Teamname (1-60 Zeichen)',
    s2Title: 'Inhalte zum Kopieren in den Team-Kanal wählen (nur Daten, nicht der Kanal; private Likes & Favoriten bleiben persönlich)',
    s2All: 'Alle', s2Posts: 'Beiträge', s2Media: 'Videos & Sticker', s2Activity: 'Aktivitäten', s2Decorations: 'Startseiten-Dekoration',
    s3Title: 'Gruppenchat erstellen (optional): Freunde einladen',
    s3NamePh: 'Gruppenchat-Name (1-60 Zeichen; leer lassen zum Überspringen)',
    s3NoFriends: 'Noch keine Freunde — Chat erstellen überspringen', s3Pick: 'Freunde in den Chat einladen (nur Freunde)',
    capHint: '3 Mitglieder inklusive; auf der Abo-Seite auf 8/16/26/∞ erweitern',
    loginHint: 'Melde dich an, um einen Team-Kanal zu erstellen', created: 'Team-Kanal erstellt', creating: 'Wird erstellt…',
    createFailed: 'Erstellung fehlgeschlagen, bitte später erneut versuchen', create: 'Team erstellen', next: 'Weiter', back: 'Zurück'
  },
  ru: {
    wizardTitle: 'Создать командный канал', step1: 'Личность', step2: 'Перенос', step3: 'Групповой чат',
    s1Title: 'Использовать текущие баннер, аватар, имя и ID напрямую для командного канала?',
    s1Yes: 'Да, преобразовать напрямую', s1YesHint: 'Баннер/аватар/имя/ID станут командным каналом; личный канал останется без изменений',
    s1No: 'Нет, настроить заново', s1NoHint: 'Назвать командный канал отдельно', s1NamePh: 'Название команды (1-60 символов)',
    s2Title: 'Выберите контент для переноса в командный канал (только данные, не канал; личные лайки и избранное остаются личными)',
    s2All: 'Всё', s2Posts: 'Посты', s2Media: 'Видео и стикеры', s2Activity: 'Активность', s2Decorations: 'Украшения главной страницы',
    s3Title: 'Создать групповой чат (необязательно): пригласить друзей',
    s3NamePh: 'Название группового чата (1-60 символов; оставьте пустым, чтобы пропустить)',
    s3NoFriends: 'Пока нет друзей — можно пропустить создание чата', s3Pick: 'Пригласить друзей в чат (только друзья)',
    capHint: '3 участника включены; расширение до 8/16/26/∞ на странице подписки',
    loginHint: 'Войдите, чтобы создать командный канал', created: 'Командный канал создан', creating: 'Создание…',
    createFailed: 'Не удалось создать, попробуйте позже', create: 'Создать команду', next: 'Далее', back: 'Назад'
  },
  ms: {
    wizardTitle: 'Cipta Saluran Pasukan', step1: 'Identiti', step2: 'Pindah', step3: 'Sembang Kumpulan',
    s1Title: 'Guna banner, avatar, nama & ID sedia ada terus untuk saluran pasukan?',
    s1Yes: 'Ya, tukar terus', s1YesHint: 'Banner/avatar/nama/ID menjadi saluran pasukan; saluran peribadi kekal tidak berubah',
    s1No: 'Tidak, sediakan baharu', s1NoHint: 'Namakan saluran pasukan secara berasingan', s1NamePh: 'Nama pasukan (1-60 aksara)',
    s2Title: 'Pilih kandungan untuk dipindah ke saluran pasukan (data sahaja, bukan saluran; suka & kegemaran peribadi kekal peribadi)',
    s2All: 'Semua', s2Posts: 'Hantaran', s2Media: 'Video & pelekat', s2Activity: 'Aktiviti', s2Decorations: 'Hiasan laman utama',
    s3Title: 'Cipta sembang kumpulan (pilihan): jemput rakan',
    s3NamePh: 'Nama sembang kumpulan (1-60 aksara; kosongkan untuk langkau)',
    s3NoFriends: 'Tiada rakan lagi — boleh langkau penciptaan sembang', s3Pick: 'Jemput rakan ke sembang (rakan sahaja)',
    capHint: '3 ahli termasuk; kembangkan ke 8/16/26/∞ di halaman langganan',
    loginHint: 'Log masuk untuk mencipta saluran pasukan', created: 'Saluran pasukan dicipta', creating: 'Mencipta…',
    createFailed: 'Penciptaan gagal, sila cuba kemudian', create: 'Cipta Pasukan', next: 'Seterusnya', back: 'Kembali'
  },
  th: {
    wizardTitle: 'สร้างช่องทีม', step1: 'ตัวตน', step2: 'ย้ายข้อมูล', step3: 'แชทกลุ่ม',
    s1Title: 'ใช้แบนเนอร์ รูปโปรไฟล์ ชื่อและ ID ปัจจุบันกับช่องทีมโดยตรงหรือไม่?',
    s1Yes: 'ใช่ แปลงโดยตรง', s1YesHint: 'แบนเนอร์/รูปโปรไฟล์/ชื่อ/ID กลายเป็นช่องทีม; ช่องส่วนตัวของคุณไม่เปลี่ยนแปลง',
    s1No: 'ไม่ ตั้งค่าใหม่', s1NoHint: 'ตั้งชื่อช่องทีมแยกต่างหาก', s1NamePh: 'ชื่อทีม (1-60 ตัวอักษร)',
    s2Title: 'เลือกเนื้อหาที่จะย้ายไปยังช่องทีม (ย้ายเฉพาะข้อมูล ไม่ใช่ช่อง; ไลก์และรายการโปรดส่วนตัวอยู่ที่ส่วนตัว)',
    s2All: 'ทั้งหมด', s2Posts: 'โพสต์', s2Media: 'วิดีโอและสติกเกอร์', s2Activity: 'กิจกรรม', s2Decorations: 'การตกแต่งหน้าแรก',
    s3Title: 'สร้างแชทกลุ่ม (ไม่บังคับ): ชวนเพื่อน',
    s3NamePh: 'ชื่อแชทกลุ่ม (1-60 ตัวอักษร; เว้นว่างเพื่อข้าม)',
    s3NoFriends: 'ยังไม่มีเพื่อน — ข้ามการสร้างแชทได้', s3Pick: 'ชวนเพื่อนเข้าร่วมแชท (เพื่อนเท่านั้น)',
    capHint: 'รวมสมาชิก 3 คน; ขยายเป็น 8/16/26/∞ ที่หน้าสมัครสมาชิก',
    loginHint: 'เข้าสู่ระบบเพื่อสร้างช่องทีม', created: 'สร้างช่องทีมแล้ว', creating: 'กำลังสร้าง…',
    createFailed: 'สร้างไม่สำเร็จ โปรดลองอีกครั้งภายหลัง', create: 'สร้างทีม', next: 'ถัดไป', back: 'ย้อนกลับ'
  },
  vi: {
    wizardTitle: 'Tạo kênh nhóm', step1: 'Danh tính', step2: 'Chuyển dữ liệu', step3: 'Trò chuyện nhóm',
    s1Title: 'Dùng trực tiếp banner, avatar, tên & ID hiện tại cho kênh nhóm?',
    s1Yes: 'Có, chuyển trực tiếp', s1YesHint: 'Banner/avatar/tên/ID trở thành kênh nhóm; kênh cá nhân của bạn không đổi',
    s1No: 'Không, thiết lập mới', s1NoHint: 'Đặt tên riêng cho kênh nhóm', s1NamePh: 'Tên nhóm (1-60 ký tự)',
    s2Title: 'Chọn nội dung chuyển sang kênh nhóm (chỉ dữ liệu, không phải kênh; lượt thích & yêu thích riêng tư ở lại cá nhân)',
    s2All: 'Tất cả', s2Posts: 'Bài đăng', s2Media: 'Video & nhãn dán', s2Activity: 'Hoạt động', s2Decorations: 'Trang trí trang chủ',
    s3Title: 'Tạo trò chuyện nhóm (tùy chọn): mời bạn bè',
    s3NamePh: 'Tên trò chuyện nhóm (1-60 ký tự; để trống để bỏ qua)',
    s3NoFriends: 'Chưa có bạn bè — có thể bỏ qua tạo trò chuyện', s3Pick: 'Mời bạn bè vào trò chuyện (chỉ bạn bè)',
    capHint: 'Gồm 3 thành viên; mở rộng lên 8/16/26/∞ tại trang đăng ký',
    loginHint: 'Đăng nhập để tạo kênh nhóm', created: 'Đã tạo kênh nhóm', creating: 'Đang tạo…',
    createFailed: 'Tạo thất bại, vui lòng thử lại sau', create: 'Tạo nhóm', next: 'Tiếp', back: 'Quay lại'
  },
  id: {
    wizardTitle: 'Buat Saluran Tim', step1: 'Identitas', step2: 'Pindahkan', step3: 'Obrolan Grup',
    s1Title: 'Gunakan banner, avatar, nama & ID saat ini langsung untuk saluran tim?',
    s1Yes: 'Ya, konversi langsung', s1YesHint: 'Banner/avatar/nama/ID menjadi saluran tim; saluran pribadi Anda tetap tidak berubah',
    s1No: 'Tidak, atur baru', s1NoHint: 'Beri nama saluran tim secara terpisah', s1NamePh: 'Nama tim (1-60 karakter)',
    s2Title: 'Pilih konten untuk dipindahkan ke saluran tim (hanya data, bukan saluran; suka & favorit pribadi tetap pribadi)',
    s2All: 'Semua', s2Posts: 'Postingan', s2Media: 'Video & stiker', s2Activity: 'Aktivitas', s2Decorations: 'Dekorasi beranda',
    s3Title: 'Buat obrolan grup (opsional): undang teman',
    s3NamePh: 'Nama obrolan grup (1-60 karakter; kosongkan untuk lewati)',
    s3NoFriends: 'Belum ada teman — bisa lewati pembuatan obrolan', s3Pick: 'Undang teman ke obrolan (hanya teman)',
    capHint: 'Termasuk 3 anggota; perluas ke 8/16/26/∞ di halaman langganan',
    loginHint: 'Masuk untuk membuat saluran tim', created: 'Saluran tim dibuat', creating: 'Membuat…',
    createFailed: 'Pembuatan gagal, silakan coba lagi nanti', create: 'Buat Tim', next: 'Lanjut', back: 'Kembali'
  },
  fr: {
    wizardTitle: "Créer un canal d'équipe", step1: 'Identité', step2: 'Transfert', step3: 'Discussion de groupe',
    s1Title: "Utiliser directement votre bannière, avatar, nom et ID actuels pour le canal d'équipe ?",
    s1Yes: 'Oui, convertir directement', s1YesHint: "Bannière/avatar/nom/ID deviennent le canal d'équipe ; votre canal personnel reste inchangé",
    s1No: 'Non, repartir de zéro', s1NoHint: "Nommer le canal d'équipe séparément", s1NamePh: "Nom de l'équipe (1-60 caractères)",
    s2Title: "Choisissez le contenu à transférer vers le canal d'équipe (données uniquement, pas le canal ; likes et favoris privés restent personnels)",
    s2All: 'Tout', s2Posts: 'Publications', s2Media: 'Vidéos et autocollants', s2Activity: 'Activités', s2Decorations: "Décorations de la page d'accueil",
    s3Title: 'Créer une discussion de groupe (facultatif) : inviter des amis',
    s3NamePh: 'Nom de la discussion (1-60 caractères ; laisser vide pour ignorer)',
    s3NoFriends: "Pas encore d'amis — vous pouvez ignorer la création de la discussion", s3Pick: 'Inviter des amis dans la discussion (amis uniquement)',
    capHint: "3 membres inclus ; étendre à 8/16/26/∞ sur la page d'abonnement",
    loginHint: "Connectez-vous pour créer un canal d'équipe", created: "Canal d'équipe créé", creating: 'Création…',
    createFailed: 'Échec de la création, veuillez réessayer plus tard', create: "Créer l'équipe", next: 'Suivant', back: 'Retour'
  },
  es: {
    wizardTitle: 'Crear canal de equipo', step1: 'Identidad', step2: 'Transferir', step3: 'Chat grupal',
    s1Title: '¿Usar directamente tu banner, avatar, nombre e ID actuales para el canal del equipo?',
    s1Yes: 'Sí, convertir directamente', s1YesHint: 'El banner/avatar/nombre/ID se convierten en el canal del equipo; tu canal personal no cambia',
    s1No: 'No, configurar de nuevo', s1NoHint: 'Pon nombre al canal del equipo por separado', s1NamePh: 'Nombre del equipo (1-60 caracteres)',
    s2Title: 'Elige el contenido a transferir al canal del equipo (solo datos, no el canal; los me gusta y favoritos privados se quedan en lo personal)',
    s2All: 'Todo', s2Posts: 'Publicaciones', s2Media: 'Vídeos y stickers', s2Activity: 'Actividad', s2Decorations: 'Decoraciones de la portada',
    s3Title: 'Crear un chat grupal (opcional): invitar amigos',
    s3NamePh: 'Nombre del chat grupal (1-60 caracteres; déjalo vacío para omitir)',
    s3NoFriends: 'Aún no tienes amigos — puedes omitir la creación del chat', s3Pick: 'Invitar amigos al chat (solo amigos)',
    capHint: '3 miembros incluidos; amplía a 8/16/26/∞ en la página de suscripción',
    loginHint: 'Inicia sesión para crear un canal de equipo', created: 'Canal de equipo creado', creating: 'Creando…',
    createFailed: 'Error al crear, inténtalo de nuevo más tarde', create: 'Crear equipo', next: 'Siguiente', back: 'Atrás'
  },
  pt: {
    wizardTitle: 'Criar canal de equipe', step1: 'Identidade', step2: 'Transferir', step3: 'Chat em grupo',
    s1Title: 'Usar diretamente seu banner, avatar, nome e ID atuais para o canal da equipe?',
    s1Yes: 'Sim, converter diretamente', s1YesHint: 'Banner/avatar/nome/ID viram o canal da equipe; seu canal pessoal permanece inalterado',
    s1No: 'Não, configurar do zero', s1NoHint: 'Dê um nome separado ao canal da equipe', s1NamePh: 'Nome da equipe (1-60 caracteres)',
    s2Title: 'Escolha o conteúdo a transferir para o canal da equipe (apenas dados, não o canal; curtidas e favoritos privados ficam no pessoal)',
    s2All: 'Tudo', s2Posts: 'Publicações', s2Media: 'Vídeos e figurinhas', s2Activity: 'Atividades', s2Decorations: 'Decorações da página inicial',
    s3Title: 'Criar chat em grupo (opcional): convidar amigos',
    s3NamePh: 'Nome do chat em grupo (1-60 caracteres; deixe vazio para pular)',
    s3NoFriends: 'Ainda sem amigos — você pode pular a criação do chat', s3Pick: 'Convidar amigos para o chat (apenas amigos)',
    capHint: '3 membros incluídos; amplie para 8/16/26/∞ na página de assinatura',
    loginHint: 'Faça login para criar um canal de equipe', created: 'Canal de equipe criado', creating: 'Criando…',
    createFailed: 'Falha ao criar, tente novamente mais tarde', create: 'Criar equipe', next: 'Avançar', back: 'Voltar'
  }
};
const FC_ORDER = ['wizardTitle', 'step1', 'step2', 'step3', 's1Title', 's1Yes', 's1YesHint', 's1No', 's1NoHint', 's1NamePh', 's2Title', 's2All', 's2Posts', 's2Media', 's2Activity', 's2Decorations', 's3Title', 's3NamePh', 's3NoFriends', 's3Pick', 'capHint', 'loginHint', 'created', 'creating', 'createFailed', 'create', 'next', 'back'];

const fcFile = path.join(I18N, 'fluidcanvas.i18n.js');
let fcSrc = fs.readFileSync(fcFile, 'utf8');
const fcCounts = {};
fcSrc = applyLines(fcSrc, (line, out) => {
  out.push(line);
  const m = line.match(/^(\s*)"fc\.zoom\.title":/);
  if (m) {
    const indent = m[1];
    out[out.length - 1] = line + ',';
    // 当前处理中的语言块：统计 zoom 行出现序 → 第 n 个 anchor = 第 n 个语言
    const idx = Object.keys(fcCounts).length;
    const lang = Object.keys(FC)[idx];
    fcCounts[lang] = 1;
    FC_ORDER.forEach((k, i) => {
      const last = i === FC_ORDER.length - 1;
      out.push(`${indent}"fc.team.${k}": ${JSON.stringify(FC[lang][k])}${last ? '' : ','}`);
    });
  }
});
fs.writeFileSync(fcFile, fcSrc);
console.log('① fluidcanvas.i18n.js：插入语言块', Object.keys(fcCounts).join(','), '各 28 键');

// ── ② messages.i18n.js：modal 6 键 + toast 1 键（11 手写块；zh-Hant 靠 OpenCC）──
const MSG = {
  zh: { groupFriendsLoading: '加载好友…', groupNoFriends: '暂无好友——也可以直接建群', groupBad400: '无法创建群组——群名需 1-60 字符，且只能邀请好友', group429: '操作过于频繁，请稍后再试', groupFail: '无法创建群组——请稍后再试', groupNameLong: '群名需 1-60 字符', groupNoFile: '⚠ 群聊暂不支持发送附件' },
  en: { groupFriendsLoading: 'Loading friends…', groupNoFriends: 'No friends yet — you can still create the group.', groupBad400: 'Could not create group — name must be 1-60 characters and members must be your friends.', group429: 'Too many requests — try again later.', groupFail: 'Could not create group — try again.', groupNameLong: 'Group name must be 1-60 characters.', groupNoFile: '⚠ Group attachments are not supported yet.' },
  de: { groupFriendsLoading: 'Freunde werden geladen…', groupNoFriends: 'Noch keine Freunde — du kannst die Gruppe trotzdem erstellen.', groupBad400: 'Gruppe konnte nicht erstellt werden — Name 1-60 Zeichen und Mitglieder nur Freunde.', group429: 'Zu viele Anfragen — versuch es später erneut.', groupFail: 'Gruppe konnte nicht erstellt werden — versuch es erneut.', groupNameLong: 'Gruppenname muss 1-60 Zeichen lang sein.', groupNoFile: '⚠ Gruppenanhänge werden noch nicht unterstützt.' },
  ru: { groupFriendsLoading: 'Загрузка друзей…', groupNoFriends: 'Пока нет друзей — группу всё равно можно создать.', groupBad400: 'Не удалось создать группу — имя 1-60 символов, участники только из друзей.', group429: 'Слишком много запросов — попробуйте позже.', groupFail: 'Не удалось создать группу — попробуйте ещё раз.', groupNameLong: 'Имя группы — 1-60 символов.', groupNoFile: '⚠ Вложения в группах пока не поддерживаются.' },
  ms: { groupFriendsLoading: 'Memuat rakan…', groupNoFriends: 'Tiada rakan lagi — anda masih boleh mencipta kumpulan.', groupBad400: 'Tidak dapat mencipta kumpulan — nama 1-60 aksara dan ahli hanya rakan.', group429: 'Terlalu banyak permintaan — cuba kemudian.', groupFail: 'Tidak dapat mencipta kumpulan — cuba lagi.', groupNameLong: 'Nama kumpulan mesti 1-60 aksara.', groupNoFile: '⚠ Lampiran kumpulan belum disokong.' },
  th: { groupFriendsLoading: 'กำลังโหลดเพื่อน…', groupNoFriends: 'ยังไม่มีเพื่อน — คุณยังสามารถสร้างกลุ่มได้', groupBad400: 'ไม่สามารถสร้างกลุ่มได้ — ชื่อ 1-60 ตัวอักษร และสมาชิกต้องเป็นเพื่อนเท่านั้น', group429: 'คำขอบ่อยเกินไป — ลองอีกครั้งภายหลัง', groupFail: 'ไม่สามารถสร้างกลุ่มได้ — ลองอีกครั้ง', groupNameLong: 'ชื่อกลุ่มต้องมี 1-60 ตัวอักษร', groupNoFile: '⚠ ยังไม่รองรับไฟล์แนบในกลุ่ม' },
  vi: { groupFriendsLoading: 'Đang tải bạn bè…', groupNoFriends: 'Chưa có bạn bè — bạn vẫn có thể tạo nhóm.', groupBad400: 'Không thể tạo nhóm — tên 1-60 ký tự và thành viên chỉ là bạn bè.', group429: 'Quá nhiều yêu cầu — thử lại sau.', groupFail: 'Không thể tạo nhóm — thử lại.', groupNameLong: 'Tên nhóm phải 1-60 ký tự.', groupNoFile: '⚠ Chưa hỗ trợ tệp đính kèm trong nhóm.' },
  id: { groupFriendsLoading: 'Memuat teman…', groupNoFriends: 'Belum ada teman — Anda tetap bisa membuat grup.', groupBad400: 'Tidak dapat membuat grup — nama 1-60 karakter dan anggota hanya teman.', group429: 'Terlalu banyak permintaan — coba lagi nanti.', groupFail: 'Tidak dapat membuat grup — coba lagi.', groupNameLong: 'Nama grup harus 1-60 karakter.', groupNoFile: '⚠ Lampiran grup belum didukung.' },
  fr: { groupFriendsLoading: 'Chargement des amis…', groupNoFriends: "Pas encore d'amis — vous pouvez quand même créer le groupe.", groupBad400: 'Impossible de créer le groupe — nom de 1 à 60 caractères et membres uniquement parmi vos amis.', group429: 'Trop de requêtes — réessayez plus tard.', groupFail: 'Impossible de créer le groupe — réessayez.', groupNameLong: 'Le nom du groupe doit faire 1 à 60 caractères.', groupNoFile: '⚠ Les pièces jointes de groupe ne sont pas encore prises en charge.' },
  es: { groupFriendsLoading: 'Cargando amigos…', groupNoFriends: 'Aún sin amigos — igualmente puedes crear el grupo.', groupBad400: 'No se pudo crear el grupo — nombre de 1-60 caracteres y miembros solo amigos.', group429: 'Demasiadas solicitudes — inténtalo más tarde.', groupFail: 'No se pudo crear el grupo — inténtalo de nuevo.', groupNameLong: 'El nombre del grupo debe tener 1-60 caracteres.', groupNoFile: '⚠ Los adjuntos de grupo aún no son compatibles.' },
  pt: { groupFriendsLoading: 'Carregando amigos…', groupNoFriends: 'Ainda sem amigos — você pode criar o grupo mesmo assim.', groupBad400: 'Não foi possível criar o grupo — nome de 1-60 caracteres e membros apenas amigos.', group429: 'Muitas solicitações — tente novamente mais tarde.', groupFail: 'Não foi possível criar o grupo — tente novamente.', groupNameLong: 'O nome do grupo deve ter 1-60 caracteres.', groupNoFile: '⚠ Anexos de grupo ainda não são suportados.' }
};
const MSG_ORDER = ['groupFriendsLoading', 'groupNoFriends', 'groupBad400', 'group429', 'groupFail', 'groupNameLong'];

const msgFile = path.join(I18N, 'messages.i18n.js');
let msgSrc = fs.readFileSync(msgFile, 'utf8');
const msgCounts = { modal: 0, toast: 0 };
msgSrc = applyLines(msgSrc, (line, out) => {
  const mModal = line.match(/^(\s*)['"]messages\.modal\.groupMembersPh['"]:/);
  const mToast = line.match(/^(\s*)['"]messages\.toast\.sendFail['"]:/);
  if (mModal) {
    const lang = Object.keys(MSG)[msgCounts.modal];
    msgCounts.modal++;
    const indent = mModal[1];
    for (const k of MSG_ORDER) out.push(`${indent}${JSON.stringify('messages.modal.' + k)}: ${JSON.stringify(MSG[lang][k])},`);
    out.push(line);
    return;
  }
  if (mToast) {
    const lang = Object.keys(MSG)[msgCounts.toast];
    msgCounts.toast++;
    const indent = mToast[1];
    out.push(`${indent}"messages.toast.groupNoFile": ${JSON.stringify(MSG[lang].groupNoFile)},`);
    out.push(line);
    return;
  }
  out.push(line);
});
fs.writeFileSync(msgFile, msgSrc);
console.log('② messages.i18n.js：modal', msgCounts.modal, '块 ×6 键 + toast', msgCounts.toast, '块 ×1 键');

// ── ③ premium.i18n.js：slots12/24/36 → slots8/16/26（键名+数字）──
const premiumFile = path.join(I18N, 'premium.i18n.js');
let pmSrc = fs.readFileSync(premiumFile, 'utf8');
const pmCounts = { s8: 0, s16: 0, s26: 0 };
pmSrc = applyLines(pmSrc, (line, out) => {
  let l = line;
  if (l.indexOf('premium.addon.slots12') !== -1) { l = l.replace('premium.addon.slots12', 'premium.addon.slots8').replace('>12<', '>8<'); pmCounts.s8++; }
  else if (l.indexOf('premium.addon.slots24') !== -1) { l = l.replace('premium.addon.slots24', 'premium.addon.slots16').replace('>24<', '>16<'); pmCounts.s16++; }
  else if (l.indexOf('premium.addon.slots36') !== -1) { l = l.replace('premium.addon.slots36', 'premium.addon.slots26').replace('>36<', '>26<'); pmCounts.s26++; }
  out.push(l);
});
fs.writeFileSync(premiumFile, pmSrc);
console.log('③ premium.i18n.js：slots8×' + pmCounts.s8, 'slots16×' + pmCounts.s16, 'slots26×' + pmCounts.s26);
