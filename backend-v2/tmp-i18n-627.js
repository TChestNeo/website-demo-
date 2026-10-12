// tmp-i18n-627.js — v0.2.58.21 common.i18n.js 21 新键注入（11 手工块；zh-Hant 由 tmp-i18n-hant.js OpenCC 重生成）
//   sidebar.pop 6 键插在 'sidebar.profileTitle' 行后；settings.profile 15 键插在 'settings.profile.changeAvatar' 行后。
//   第二轮 add 链（aichat.* 1281+）无此二锚——全局行匹配只命中首链 11 块。
//   4 个 toast 键文案与 prof.toast.gifLocked/libLocked、fc.toast.imgOnly/imgTooBig10 逐字节一致（词典实取值）。
//   en 值 = settings-modal.js/sidebar.js 兜底串逐字节一致。输出 CRLF。
'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'docs', 'assets', 'i18n', 'common.i18n.js');
const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');

// 语言序 = 首链 11 块顺序（zh, en, de, ru, ms, th, vi, id, fr, es, pt）
const sidebarPop = [
  [ // zh
    "    'sidebar.pop.editProfile': '编辑资料',",
    "    'sidebar.pop.viewProfile': '查看主页',",
    "    'sidebar.pop.following': '关注',",
    "    'sidebar.pop.followers': '粉丝',",
    "    'sidebar.pop.posts': '帖子',",
    "    'sidebar.pop.joined': '加入时间',",
  ],
  [ // en（值=sidebar.js 兜底串逐字节一致）
    "    'sidebar.pop.editProfile': 'Edit profile',",
    "    'sidebar.pop.viewProfile': 'View profile',",
    "    'sidebar.pop.following': 'Following',",
    "    'sidebar.pop.followers': 'Followers',",
    "    'sidebar.pop.posts': 'Posts',",
    "    'sidebar.pop.joined': 'Joined',",
  ],
  [ "    'sidebar.pop.editProfile': 'Profil bearbeiten',", "    'sidebar.pop.viewProfile': 'Profil ansehen',", "    'sidebar.pop.following': 'Folgt',", "    'sidebar.pop.followers': 'Follower',", "    'sidebar.pop.posts': 'Beiträge',", "    'sidebar.pop.joined': 'Beigetreten'," ],
  [ "    'sidebar.pop.editProfile': 'Редактировать профиль',", "    'sidebar.pop.viewProfile': 'Просмотр профиля',", "    'sidebar.pop.following': 'Подписки',", "    'sidebar.pop.followers': 'Подписчики',", "    'sidebar.pop.posts': 'Посты',", "    'sidebar.pop.joined': 'Присоединился'," ],
  [ "    'sidebar.pop.editProfile': 'Edit profil',", "    'sidebar.pop.viewProfile': 'Lihat profil',", "    'sidebar.pop.following': 'Mengikuti',", "    'sidebar.pop.followers': 'Pengikut',", "    'sidebar.pop.posts': 'Catatan',", "    'sidebar.pop.joined': 'Sertai'," ],
  [ "    'sidebar.pop.editProfile': 'แก้ไขโปรไฟล์',", "    'sidebar.pop.viewProfile': 'ดูโปรไฟล์',", "    'sidebar.pop.following': 'กำลังติดตาม',", "    'sidebar.pop.followers': 'ผู้ติดตาม',", "    'sidebar.pop.posts': 'โพสต์',", "    'sidebar.pop.joined': 'เข้าร่วมเมื่อ'," ],
  [ "    'sidebar.pop.editProfile': 'Chỉnh sửa hồ sơ',", "    'sidebar.pop.viewProfile': 'Xem hồ sơ',", "    'sidebar.pop.following': 'Đang theo dõi',", "    'sidebar.pop.followers': 'Người theo dõi',", "    'sidebar.pop.posts': 'Bài đăng',", "    'sidebar.pop.joined': 'Tham gia'," ],
  [ "    'sidebar.pop.editProfile': 'Edit profil',", "    'sidebar.pop.viewProfile': 'Lihat profil',", "    'sidebar.pop.following': 'Mengikuti',", "    'sidebar.pop.followers': 'Pengikut',", "    'sidebar.pop.posts': 'Kiriman',", "    'sidebar.pop.joined': 'Bergabung'," ],
  [ "    'sidebar.pop.editProfile': 'Modifier le profil',", "    'sidebar.pop.viewProfile': 'Voir le profil',", "    'sidebar.pop.following': 'Abonnements',", "    'sidebar.pop.followers': 'Abonnés',", "    'sidebar.pop.posts': 'Publications',", "    'sidebar.pop.joined': 'Inscrit le'," ],
  [ "    'sidebar.pop.editProfile': 'Editar perfil',", "    'sidebar.pop.viewProfile': 'Ver perfil',", "    'sidebar.pop.following': 'Siguiendo',", "    'sidebar.pop.followers': 'Seguidores',", "    'sidebar.pop.posts': 'Publicaciones',", "    'sidebar.pop.joined': 'Se unió'," ],
  [ "    'sidebar.pop.editProfile': 'Editar perfil',", "    'sidebar.pop.viewProfile': 'Ver perfil',", "    'sidebar.pop.following': 'Seguindo',", "    'sidebar.pop.followers': 'Seguidores',", "    'sidebar.pop.posts': 'Publicações',", "    'sidebar.pop.joined': 'Entrou em'," ],
];

const settingsProfile = [
  [ // zh
    "    'settings.profile.banner': '横幅',",
    "    'settings.profile.bannerUpload': '上传横幅',",
    "    'settings.profile.bannerGallery': '从图库选择横幅',",
    "    'settings.profile.bannerRemove': '移除横幅',",
    "    'settings.profile.avatarGallery': '从图库选择头像',",
    "    'settings.profile.avatarSync': '同步到频道主页',",
    "    'settings.profile.gifUpgrade': '订阅后可上传 GIF 动图',",
    "    'settings.profile.toast.avatarUpdated': '头像已更新',",
    "    'settings.profile.toast.bannerUpdated': '横幅已更新',",
    "    'settings.profile.toast.bannerRemoved': '横幅已移除',",
    "    'settings.profile.toast.failed': '更新失败，请稍后再试',",
    "    'settings.profile.toast.gifLocked': 'GIF 动图为订阅用户专属功能',",
    "    'settings.profile.toast.libLocked': '图库为订阅用户专属功能',",
    "    'settings.profile.toast.imgOnly': '只支持 jpg / png / gif / webp 图片',",
    "    'settings.profile.toast.imgTooBig10': '图片不能超过 10MB',",
  ],
  [ // en（值=settings-modal.js 兜底串逐字节一致）
    "    'settings.profile.banner': 'Banner',",
    "    'settings.profile.bannerUpload': 'Upload banner',",
    "    'settings.profile.bannerGallery': 'Choose banner from library',",
    "    'settings.profile.bannerRemove': 'Remove banner',",
    "    'settings.profile.avatarGallery': 'Choose from library',",
    "    'settings.profile.avatarSync': 'Sync to channel homepage',",
    "    'settings.profile.gifUpgrade': 'Subscribe to upload GIF animations',",
    "    'settings.profile.toast.avatarUpdated': 'Avatar updated',",
    "    'settings.profile.toast.bannerUpdated': 'Banner updated',",
    "    'settings.profile.toast.bannerRemoved': 'Banner removed',",
    "    'settings.profile.toast.failed': 'Update failed, please try again later',",
    "    'settings.profile.toast.gifLocked': 'GIF animations are a subscriber-only feature',",
    "    'settings.profile.toast.libLocked': 'The library is a subscriber-only feature',",
    "    'settings.profile.toast.imgOnly': 'Only jpg / png / gif / webp images supported',",
    "    'settings.profile.toast.imgTooBig10': 'Image must be under 10MB',",
  ],
  [ "    'settings.profile.banner': 'Banner',", "    'settings.profile.bannerUpload': 'Banner hochladen',", "    'settings.profile.bannerGallery': 'Banner aus Bibliothek wählen',", "    'settings.profile.bannerRemove': 'Banner entfernen',", "    'settings.profile.avatarGallery': 'Aus Bibliothek wählen',", "    'settings.profile.avatarSync': 'Mit Kanal-Startseite synchronisieren',", "    'settings.profile.gifUpgrade': 'Abonnieren, um GIF-Animationen hochzuladen',", "    'settings.profile.toast.avatarUpdated': 'Avatar aktualisiert',", "    'settings.profile.toast.bannerUpdated': 'Banner aktualisiert',", "    'settings.profile.toast.bannerRemoved': 'Banner entfernt',", "    'settings.profile.toast.failed': 'Aktualisierung fehlgeschlagen, bitte später erneut versuchen',", "    'settings.profile.toast.gifLocked': 'GIF-Animationen sind Abonnenten vorbehalten',", "    'settings.profile.toast.libLocked': 'Die Bibliothek ist Abonnenten vorbehalten',", "    'settings.profile.toast.imgOnly': 'Nur jpg / png / gif / webp Bilder werden unterstützt',", "    'settings.profile.toast.imgTooBig10': 'Bild muss kleiner als 10 MB sein'," ],
  [ "    'settings.profile.banner': 'Баннер',", "    'settings.profile.bannerUpload': 'Загрузить баннер',", "    'settings.profile.bannerGallery': 'Выбрать баннер из библиотеки',", "    'settings.profile.bannerRemove': 'Удалить баннер',", "    'settings.profile.avatarGallery': 'Выбрать из библиотеки',", "    'settings.profile.avatarSync': 'Синхронизировать с главной канала',", "    'settings.profile.gifUpgrade': 'Подпишитесь, чтобы загружать GIF',", "    'settings.profile.toast.avatarUpdated': 'Аватар обновлён',", "    'settings.profile.toast.bannerUpdated': 'Баннер обновлён',", "    'settings.profile.toast.bannerRemoved': 'Баннер удалён',", "    'settings.profile.toast.failed': 'Не удалось обновить, повторите позже',", "    'settings.profile.toast.gifLocked': 'GIF-анимации доступны только подписчикам',", "    'settings.profile.toast.libLocked': 'Библиотека доступна только подписчикам',", "    'settings.profile.toast.imgOnly': 'Поддерживаются только jpg / png / gif / webp',", "    'settings.profile.toast.imgTooBig10': 'Изображение должно быть меньше 10MB'," ],
  [ "    'settings.profile.banner': 'Sepanduk',", "    'settings.profile.bannerUpload': 'Muat naik sepanduk',", "    'settings.profile.bannerGallery': 'Pilih sepanduk dari perpustakaan',", "    'settings.profile.bannerRemove': 'Buang sepanduk',", "    'settings.profile.avatarGallery': 'Pilih dari perpustakaan',", "    'settings.profile.avatarSync': 'Segerakkan ke laman utama saluran',", "    'settings.profile.gifUpgrade': 'Langgan untuk muat naik animasi GIF',", "    'settings.profile.toast.avatarUpdated': 'Avatar dikemas kini',", "    'settings.profile.toast.bannerUpdated': 'Sepanduk dikemas kini',", "    'settings.profile.toast.bannerRemoved': 'Sepanduk dibuang',", "    'settings.profile.toast.failed': 'Kemas kini gagal, sila cuba kemudian',", "    'settings.profile.toast.gifLocked': 'Animasi GIF hanya untuk pelanggan',", "    'settings.profile.toast.libLocked': 'Perpustakaan hanya untuk pelanggan',", "    'settings.profile.toast.imgOnly': 'Hanya imej jpg / png / gif / webp disokong',", "    'settings.profile.toast.imgTooBig10': 'Imej mesti kurang daripada 10MB'," ],
  [ "    'settings.profile.banner': 'แบนเนอร์',", "    'settings.profile.bannerUpload': 'อัปโหลดแบนเนอร์',", "    'settings.profile.bannerGallery': 'เลือกแบนเนอร์จากคลังภาพ',", "    'settings.profile.bannerRemove': 'ลบแบนเนอร์',", "    'settings.profile.avatarGallery': 'เลือกจากคลังภาพ',", "    'settings.profile.avatarSync': 'ซิงค์กับหน้าแรกช่อง',", "    'settings.profile.gifUpgrade': 'สมัครสมาชิกเพื่ออัปโหลด GIF',", "    'settings.profile.toast.avatarUpdated': 'อัปเดตรูปโปรไฟล์แล้ว',", "    'settings.profile.toast.bannerUpdated': 'อัปเดตแบนเนอร์แล้ว',", "    'settings.profile.toast.bannerRemoved': 'ลบแบนเนอร์แล้ว',", "    'settings.profile.toast.failed': 'อัปเดตล้มเหลว โปรดลองอีกครั้งภายหลัง',", "    'settings.profile.toast.gifLocked': 'ภาพเคลื่อนไหว GIF เป็นฟีเจอร์เฉพาะสมาชิก',", "    'settings.profile.toast.libLocked': 'คลังภาพเป็นฟีเจอร์เฉพาะสมาชิก',", "    'settings.profile.toast.imgOnly': 'รองรับเฉพาะรูป jpg / png / gif / webp',", "    'settings.profile.toast.imgTooBig10': 'รูปต้องเล็กกว่า 10MB'," ],
  [ "    'settings.profile.banner': 'Biểu ngữ',", "    'settings.profile.bannerUpload': 'Tải biểu ngữ lên',", "    'settings.profile.bannerGallery': 'Chọn biểu ngữ từ thư viện',", "    'settings.profile.bannerRemove': 'Xóa biểu ngữ',", "    'settings.profile.avatarGallery': 'Chọn từ thư viện',", "    'settings.profile.avatarSync': 'Đồng bộ với trang chủ kênh',", "    'settings.profile.gifUpgrade': 'Đăng ký để tải lên ảnh động GIF',", "    'settings.profile.toast.avatarUpdated': 'Đã cập nhật ảnh đại diện',", "    'settings.profile.toast.bannerUpdated': 'Đã cập nhật biểu ngữ',", "    'settings.profile.toast.bannerRemoved': 'Đã xóa biểu ngữ',", "    'settings.profile.toast.failed': 'Cập nhật thất bại, vui lòng thử lại sau',", "    'settings.profile.toast.gifLocked': 'Ảnh động GIF là tính năng dành riêng cho người đăng ký',", "    'settings.profile.toast.libLocked': 'Thư viện là tính năng dành riêng cho người đăng ký',", "    'settings.profile.toast.imgOnly': 'Chỉ hỗ trợ ảnh jpg / png / gif / webp',", "    'settings.profile.toast.imgTooBig10': 'Ảnh phải nhỏ hơn 10MB'," ],
  [ "    'settings.profile.banner': 'Spanduk',", "    'settings.profile.bannerUpload': 'Unggah spanduk',", "    'settings.profile.bannerGallery': 'Pilih spanduk dari perpustakaan',", "    'settings.profile.bannerRemove': 'Hapus spanduk',", "    'settings.profile.avatarGallery': 'Pilih dari perpustakaan',", "    'settings.profile.avatarSync': 'Sinkronkan ke halaman utama saluran',", "    'settings.profile.gifUpgrade': 'Berlangganan untuk mengunggah animasi GIF',", "    'settings.profile.toast.avatarUpdated': 'Avatar diperbarui',", "    'settings.profile.toast.bannerUpdated': 'Spanduk diperbarui',", "    'settings.profile.toast.bannerRemoved': 'Spanduk dihapus',", "    'settings.profile.toast.failed': 'Pembaruan gagal, silakan coba lagi nanti',", "    'settings.profile.toast.gifLocked': 'Animasi GIF hanya untuk pelanggan',", "    'settings.profile.toast.libLocked': 'Perpustakaan hanya untuk pelanggan',", "    'settings.profile.toast.imgOnly': 'Hanya gambar jpg / png / gif / webp yang didukung',", "    'settings.profile.toast.imgTooBig10': 'Gambar harus kurang dari 10MB'," ],
  [ "    'settings.profile.banner': 'Bannière',", "    'settings.profile.bannerUpload': 'Téléverser une bannière',", "    'settings.profile.bannerGallery': 'Choisir une bannière dans la bibliothèque',", "    'settings.profile.bannerRemove': 'Supprimer la bannière',", "    'settings.profile.avatarGallery': 'Choisir dans la bibliothèque',", "    'settings.profile.avatarSync': 'Synchroniser avec la page du canal',", "    'settings.profile.gifUpgrade': 'Abonnez-vous pour téléverser des GIF',", "    'settings.profile.toast.avatarUpdated': 'Avatar mis à jour',", "    'settings.profile.toast.bannerUpdated': 'Bannière mise à jour',", "    'settings.profile.toast.bannerRemoved': 'Bannière supprimée',", "    'settings.profile.toast.failed': 'Échec de la mise à jour, veuillez réessayer plus tard',", "    'settings.profile.toast.gifLocked': 'Les animations GIF sont réservées aux abonnés',", "    'settings.profile.toast.libLocked': 'La bibliothèque est réservée aux abonnés',", "    'settings.profile.toast.imgOnly': 'Seules les images jpg / png / gif / webp sont prises en charge',", "    'settings.profile.toast.imgTooBig10': \"L'image doit faire moins de 10 Mo\"", ],
  [ "    'settings.profile.banner': 'Banner',", "    'settings.profile.bannerUpload': 'Subir banner',", "    'settings.profile.bannerGallery': 'Elegir banner de la biblioteca',", "    'settings.profile.bannerRemove': 'Quitar banner',", "    'settings.profile.avatarGallery': 'Elegir de la biblioteca',", "    'settings.profile.avatarSync': 'Sincronizar con la página del canal',", "    'settings.profile.gifUpgrade': 'Suscríbete para subir animaciones GIF',", "    'settings.profile.toast.avatarUpdated': 'Avatar actualizado',", "    'settings.profile.toast.bannerUpdated': 'Banner actualizado',", "    'settings.profile.toast.bannerRemoved': 'Banner eliminado',", "    'settings.profile.toast.failed': 'Error al actualizar, inténtalo de nuevo más tarde',", "    'settings.profile.toast.gifLocked': 'Las animaciones GIF son exclusivas para suscriptores',", "    'settings.profile.toast.libLocked': 'La biblioteca es exclusiva para suscriptores',", "    'settings.profile.toast.imgOnly': 'Solo se admiten imágenes jpg / png / gif / webp',", "    'settings.profile.toast.imgTooBig10': 'La imagen debe ser menor de 10MB'," ],
  [ "    'settings.profile.banner': 'Banner',", "    'settings.profile.bannerUpload': 'Enviar banner',", "    'settings.profile.bannerGallery': 'Escolher banner da biblioteca',", "    'settings.profile.bannerRemove': 'Remover banner',", "    'settings.profile.avatarGallery': 'Escolher da biblioteca',", "    'settings.profile.avatarSync': 'Sincronizar com a página do canal',", "    'settings.profile.gifUpgrade': 'Assine para enviar animações GIF',", "    'settings.profile.toast.avatarUpdated': 'Avatar atualizado',", "    'settings.profile.toast.bannerUpdated': 'Banner atualizado',", "    'settings.profile.toast.bannerRemoved': 'Banner removido',", "    'settings.profile.toast.failed': 'Falha na atualização, tente novamente mais tarde',", "    'settings.profile.toast.gifLocked': 'Animações GIF são exclusivas para assinantes',", "    'settings.profile.toast.libLocked': 'A biblioteca é exclusiva para assinantes',", "    'settings.profile.toast.imgOnly': 'Apenas imagens jpg / png / gif / webp são suportadas',", "    'settings.profile.toast.imgTooBig10': 'A imagem deve ter menos de 10MB'," ],
];

function insertAfterAnchor(linesArr, anchorRe, blocks, label) {
  // 从后往前插（索引不动），只命中首链 11 块（第二链 aichat 无此锚）
  const hits = [];
  for (let i = 0; i < linesArr.length; i++) if (anchorRe.test(linesArr[i])) hits.push(i);
  if (hits.length !== 11) throw new Error(label + ' 锚命中 ' + hits.length + ' 处（期望 11）');
  for (let k = hits.length - 1; k >= 0; k--) {
    linesArr.splice(hits[k] + 1, 0, ...blocks[k]);
  }
}

insertAfterAnchor(lines, /^    'sidebar\.profileTitle': /, sidebarPop, 'sidebar.pop');
insertAfterAnchor(lines, /^    'settings\.profile\.changeAvatar': /, settingsProfile, 'settings.profile');

fs.writeFileSync(file, lines.join('\r\n') + '\r\n', 'utf8');
console.log('✅ common.i18n.js 21 键 × 11 块注入完成（CRLF）');
console.log('   sidebar.pop 锚 11 处、settings.profile 锚 11 处');
